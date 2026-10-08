import mongoose from 'mongoose';
import Group from './group.model.js';
import Membership from '../memberships/membership.model.js';
import Contact from '../../contacts/contact/contact.model.js';
import ApiError from '../../../utils/ApiError.js';

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const oid = (v) => new mongoose.Types.ObjectId(String(v));

// Collection names the $lookup stages join against. Derived from the models
// rather than hardcoded, so a model rename can't silently break the joins.
const CONTACTS_COLLECTION = Contact.collection.name;
const MEMBERSHIPS_COLLECTION = Membership.collection.name;

// Upper bound on a single "select all" bulk operation, so one request can
// never try to write an unbounded number of junction rows.
const BULK_LIMIT = 10000;

/** Case-insensitive contact search filter, or null when there's no search. */
function contactSearchMatch(search, prefix = '') {
  const term = (search || '').trim();
  if (!term) return null;
  const rx = new RegExp(escapeRegex(term), 'i');
  return {
    $or: [
      { [`${prefix}name`]: rx },
      { [`${prefix}phoneNumber`]: rx },
      { [`${prefix}email`]: rx },
    ],
  };
}

function paginate(options = {}, defaultLimit = 50) {
  const page = Math.max(parseInt(options.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(options.limit, 10) || defaultLimit, 1),
    100
  );
  return { page, limit, skip: (page - 1) * limit };
}

class GroupService {
  /** Create a group owned by the user. */
  async create(userId, data) {
    try {
      return await Group.create({
        userId,
        name: data.name,
        description: data.description || '',
      });
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(409, 'A group with this name already exists');
      }
      throw err;
    }
  }

  /**
   * List groups for a tenant with optional search + pagination.
   * Each group is enriched with a `contactCount`.
   *
   * The count joins through to the contacts collection instead of counting
   * junction rows directly. Counting rows alone includes memberships whose
   * contact no longer exists, which is how a group could advertise
   * "5 contacts" while its member list rendered 2.
   */
  async list(userId, options = {}) {
    const { page, limit, skip } = paginate(options, 20);

    const filter = { userId };
    if (options.search) {
      const rx = new RegExp(escapeRegex(options.search.trim()), 'i');
      filter.$or = [{ name: rx }, { description: rx }];
    }

    const [groups, totalGroups] = await Promise.all([
      Group.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Group.countDocuments(filter),
    ]);

    const groupIds = groups.map((g) => g._id);
    let countMap = new Map();

    if (groupIds.length) {
      const counts = await Membership.aggregate([
        { $match: { userId: oid(userId), groupId: { $in: groupIds } } },
        {
          $lookup: {
            from: CONTACTS_COLLECTION,
            localField: 'contactId',
            foreignField: '_id',
            as: 'contact',
          },
        },
        // Drops memberships whose contact was deleted.
        { $match: { 'contact.0': { $exists: true } } },
        { $group: { _id: '$groupId', count: { $sum: 1 } } },
      ]);
      countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    }

    return {
      groups: groups.map((g) => ({
        ...g,
        contactCount: countMap.get(String(g._id)) || 0,
      })),
      totalGroups,
      totalPages: Math.ceil(totalGroups / limit) || 0,
      currentPage: page,
    };
  }

  /** Fetch an owned group or throw. Shared ownership gate. */
  async #ownedGroup(userId, groupId) {
    const group = await Group.findOne({ _id: groupId, userId }).lean();
    if (!group) throw new ApiError(404, 'Group not found');
    return group;
  }

  /**
   * Members of a group, searchable and paginated.
   *
   * Resolves each membership to its contact inside the aggregation, so a
   * deleted contact is excluded from BOTH the page and the total. The previous
   * implementation paginated junction rows and filtered unresolved ones out
   * afterwards, so a page of 50 could render fewer than 50 rows while the
   * total still counted the missing ones.
   */
  async listMembers(userId, groupId, options = {}) {
    await this.#ownedGroup(userId, groupId);
    const { page, limit, skip } = paginate(options, 50);

    const search = contactSearchMatch(options.search, 'contact.');

    const [result] = await Membership.aggregate([
      { $match: { userId: oid(userId), groupId: oid(groupId) } },
      {
        $lookup: {
          from: CONTACTS_COLLECTION,
          localField: 'contactId',
          foreignField: '_id',
          as: 'contact',
        },
      },
      { $unwind: '$contact' },
      ...(search ? [{ $match: search }] : []),
      { $sort: { 'contact.name': 1, 'contact._id': 1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: limit },
            { $replaceRoot: { newRoot: '$contact' } },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    const contacts = result?.rows ?? [];
    const totalContacts = result?.total?.[0]?.n ?? 0;

    return {
      contacts,
      totalContacts,
      totalPages: Math.ceil(totalContacts / limit) || 0,
      currentPage: page,
    };
  }

  /**
   * Contacts NOT yet in the group, searchable and paginated.
   *
   * Exists so the "add members" picker never has to pull the tenant's entire
   * contact book into the browser to work out what's addable — that approach
   * silently caps out at whatever page size the client happens to request.
   */
  async listAvailableContacts(userId, groupId, options = {}) {
    await this.#ownedGroup(userId, groupId);
    const { page, limit, skip } = paginate(options, 50);

    const search = contactSearchMatch(options.search);

    const [result] = await Contact.aggregate([
      { $match: { userId: oid(userId), ...(search || {}) } },
      {
        $lookup: {
          from: MEMBERSHIPS_COLLECTION,
          let: { contactId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$contactId', '$$contactId'] },
                    { $eq: ['$groupId', oid(groupId)] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'membership',
        },
      },
      { $match: { membership: { $size: 0 } } },
      { $project: { membership: 0 } },
      { $sort: { name: 1, _id: 1 } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    const contacts = result?.rows ?? [];
    const totalContacts = result?.total?.[0]?.n ?? 0;

    return {
      contacts,
      totalContacts,
      totalPages: Math.ceil(totalContacts / limit) || 0,
      currentPage: page,
    };
  }

  /**
   * Fetch a single owned group with a first page of members.
   * Kept for the existing GET /groups/:id contract.
   */
  async getById(userId, id, contactOptions = {}) {
    const group = await this.#ownedGroup(userId, id);
    const members = await this.listMembers(userId, id, contactOptions);
    return { ...group, ...members };
  }

  /** Update an owned group. */
  async update(userId, id, data) {
    const payload = { ...data };
    delete payload.userId;
    delete payload._id;

    try {
      const group = await Group.findOneAndUpdate(
        { _id: id, userId },
        { $set: payload },
        { new: true, runValidators: true }
      );
      if (!group) throw new ApiError(404, 'Group not found');
      return group;
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(409, 'A group with this name already exists');
      }
      throw err;
    }
  }

  /** Delete an owned group and cascade-remove its memberships. */
  async remove(userId, id) {
    const group = await Group.findOneAndDelete({ _id: id, userId });
    if (!group) throw new ApiError(404, 'Group not found');
    await Membership.deleteMany({ userId, groupId: id });
    return group;
  }

  /**
   * Resolve which contact ids a bulk operation should act on.
   *
   * Either an explicit list, or `all: true` meaning "every contact matching
   * the current search" — the same set the user is looking at in the picker,
   * resolved server-side so selecting 5,000 contacts never requires the client
   * to have loaded 5,000 rows.
   */
  async #resolveTargetIds(userId, groupId, { contactIds, all, search }, scope) {
    if (!all) {
      const list = Array.isArray(contactIds) ? contactIds : [];
      if (list.length === 0) throw new ApiError(400, 'No contacts selected');
      if (list.length > BULK_LIMIT) {
        throw new ApiError(
          400,
          `Too many contacts in one request (max ${BULK_LIMIT})`
        );
      }
      return list;
    }

    const fetchPage = (page) =>
      scope === 'members'
        ? this.listMembers(userId, groupId, { search, limit: 100, page })
        : this.listAvailableContacts(userId, groupId, {
            search,
            limit: 100,
            page,
          });

    const first = await fetchPage(1);

    if (first.totalContacts > BULK_LIMIT) {
      throw new ApiError(
        400,
        `That selection covers ${first.totalContacts} contacts. Narrow it with search — a single operation is limited to ${BULK_LIMIT}.`
      );
    }

    const ids = first.contacts.map((c) => c._id);
    for (let page = 2; page <= first.totalPages; page += 1) {
      const next = await fetchPage(page);
      ids.push(...next.contacts.map((c) => c._id));
    }
    return ids;
  }

  /**
   * Add many contacts to a group in one round trip.
   *
   * Idempotent: already-assigned contacts are reported as `skipped` rather
   * than failing the batch, so retrying after a partial network failure is
   * safe. Ids belonging to another tenant are dropped by the ownership filter
   * and counted as `invalid` instead of erroring.
   */
  async addContacts(userId, groupId, payload = {}) {
    await this.#ownedGroup(userId, groupId);

    const requested = await this.#resolveTargetIds(
      userId,
      groupId,
      payload,
      'available'
    );

    const owned = await Contact.find({ userId, _id: { $in: requested } })
      .select('_id')
      .lean();

    if (owned.length === 0) {
      return { added: 0, skipped: 0, invalid: requested.length };
    }

    const result = await Membership.bulkWrite(
      owned.map((c) => ({
        updateOne: {
          filter: { groupId, contactId: c._id },
          update: { $setOnInsert: { userId, groupId, contactId: c._id } },
          upsert: true,
        },
      })),
      { ordered: false }
    );

    const added = result.upsertedCount || 0;

    return {
      added,
      skipped: owned.length - added,
      invalid: requested.length - owned.length,
    };
  }

  /** Remove many contacts from a group in one round trip. */
  async removeContacts(userId, groupId, payload = {}) {
    await this.#ownedGroup(userId, groupId);

    const targets = await this.#resolveTargetIds(
      userId,
      groupId,
      payload,
      'members'
    );

    const result = await Membership.deleteMany({
      userId,
      groupId,
      contactId: { $in: targets },
    });

    return { removed: result.deletedCount || 0 };
  }

  /**
   * Assign a single contact to a group. BOTH the group and the contact must
   * belong to the requesting user, otherwise 404 (no cross-tenant linking).
   */
  async assignContact(userId, groupId, contactId) {
    const [group, contact] = await Promise.all([
      Group.findOne({ _id: groupId, userId }).lean(),
      Contact.findOne({ _id: contactId, userId }).lean(),
    ]);
    if (!group) throw new ApiError(404, 'Group not found');
    if (!contact) throw new ApiError(404, 'Contact not found');

    try {
      return await Membership.create({ userId, groupId, contactId });
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(409, 'Contact is already assigned to this group');
      }
      throw err;
    }
  }

  /** Remove a single contact from a group (tenant-scoped). */
  async removeContact(userId, groupId, contactId) {
    await this.#ownedGroup(userId, groupId);

    const membership = await Membership.findOneAndDelete({
      userId,
      groupId,
      contactId,
    });
    if (!membership) {
      throw new ApiError(404, 'Contact is not assigned to this group');
    }
    return membership;
  }
}

export default new GroupService();