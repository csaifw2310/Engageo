import { parse } from "csv-parse/sync";
import Contact from "./contact.model.js";
import Conversation from "../../conversation/conversation.model.js";
import Membership from "../memberships/membership.model.js";
import ApiError from "../../../utils/ApiError.js";
import { normalizePhone } from "../../../utils/phone.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Escape user input before using it inside a RegExp (prevents ReDoS / injection).
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class ContactService {
  /**
   * Create a contact owned by `userId`.
   * Relies on the unique { userId, phoneNumber } index for duplicate protection.
   */
  async create(userId, data) {
    try {
      const result = normalizePhone(data.phoneNumber);

      if (!result.success) {
        throw new ApiError(400, result.error);
      }

      const contact = await Contact.create({
        userId,
        name: data.name,
        phoneNumber: result.waId,
        email: data.email || null,
        tags: data.tags || [],
        customFields: data.customFields || {},
        status: data.status || "active",
      });

      return contact;
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(
          409,
          "A contact with this phone number already exists",
        );
      }
      throw err;
    }
  }

  /**
   * List contacts for a tenant with search + filtering + pagination.
   * Returns the exact shape: { contacts, totalContacts, totalPages, currentPage }
   */
  async list(userId, options = {}) {
    const page = Math.max(parseInt(options.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    // Tenant scope is ALWAYS applied first.
    const filter = { userId };

    if (options.status) filter.status = options.status;
    if (options.tag) filter.tags = options.tag;

    if (options.search) {
      const rx = new RegExp(escapeRegex(options.search.trim()), "i");
      filter.$or = [{ name: rx }, { phoneNumber: rx }, { email: rx }];
    }

    // Whitelisted sort to avoid arbitrary field injection.
    let sort = { createdAt: -1 };
    if (options.sort) {
      const dir = options.sort.startsWith("-") ? -1 : 1;
      const field = options.sort.replace(/^-/, "");
      sort = { [field]: dir };
    }

    const [contacts, totalContacts] = await Promise.all([
      Contact.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Contact.countDocuments(filter),
    ]);

    return {
      contacts,
      totalContacts,
      totalPages: Math.ceil(totalContacts / limit) || 0,
      currentPage: page,
    };
  }

  /** Fetch a single owned contact (404 if not found OR not owned). */
  async getById(userId, id) {
    const contact = await Contact.findOne({ _id: id, userId });
    if (!contact) throw new ApiError(404, "Contact not found");
    return contact;
  }

  /** Update an owned contact. userId is stripped to prevent tenant reassignment. */
  async update(userId, id, data) {
    const payload = { ...data };

    if (payload.phoneNumber !== undefined) {
      const result = normalizePhone(payload.phoneNumber);

      if (!result.success) {
        throw new ApiError(400, result.error);
      }

      payload.phoneNumber = result.waId;
    }

    delete payload.userId;
    delete payload._id;

    try {
      const contact = await Contact.findOneAndUpdate(
        { _id: id, userId },
        { $set: payload },
        { new: true, runValidators: true },
      );
      if (!contact) throw new ApiError(404, "Contact not found");
      return contact;
    } catch (err) {
      if (err && err.code === 11000) {
        throw new ApiError(
          409,
          "A contact with this phone number already exists",
        );
      }
      throw err;
    }
  }

  /** Delete an owned contact. Also unlinks any conversations pointing to it,
   *  so Conversation.contactId is honestly `null` instead of a dangling
   *  reference left over after the Contact document is gone. */
  async remove(userId, id) {
    const contact = await Contact.findOneAndDelete({ _id: id, userId });
    if (!contact) throw new ApiError(404, "Contact not found");

    await Conversation.updateMany(
      { userId, contactId: id },
      { $set: { contactId: null } },
    );

    // Cascade group memberships. Without this the junction rows survive their
    // contact and become orphans, which surface in three places:
    //   • a group's card counts them, so "5 contacts" shows next to a member
    //     list containing 2
    //   • campaigns expand the group via Membership.distinct("contactId") and
    //     materialise a message per orphan, which then fails as "Unknown
    //     Contact / No phone"
    //   • the group can never reach an accurate size again on its own
    await Membership.deleteMany({ userId, contactId: id });

    return contact;
  }

  /**
   * Bulk import from a CSV buffer.
   * Columns (case-insensitive): name, phoneNumber, email
   * - Validates every row, skips invalid rows (collecting reasons)
   * - Skips duplicates already owned by the user AND duplicates within the file
   * - Bulk-inserts valid rows in a single unordered insertMany
   * Returns: { importedCount, skippedCount, errors }
   */
  async importFromCsv(userId, buffer) {
    if (!buffer || !buffer.length) {
      throw new ApiError(400, "CSV file is empty or missing");
    }

    let records;
    try {
      records = parse(buffer, {
        columns: (header) => header.map((h) => String(h).trim().toLowerCase()),
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      });
    } catch (e) {
      throw new ApiError(400, "Malformed CSV file");
    }

    const errors = [];
    const seenInFile = new Set();
    const candidates = [];

    records.forEach((row, idx) => {
      const line = idx + 2; // +1 for header, +1 for 1-based numbering
      const name = (row.name || "").trim();
      const rawPhone = (row.phonenumber || row.phone || "").trim();

      if (!rawPhone) {
        return errors.push({ line, error: "Missing phoneNumber" });
      }

      const result = normalizePhone(rawPhone);

      if (!result.success) {
        return errors.push({ line, error: result.error });
      }

      const phoneNumber = result.waId;

      const email = (row.email || "").trim();

      if (!name) return errors.push({ line, error: "Missing name" });

      if (email && !EMAIL_REGEX.test(email)) {
        return errors.push({ line, error: "Invalid email" });
      }
      if (seenInFile.has(phoneNumber)) {
        return errors.push({
          line,
          error: "Duplicate phoneNumber within file",
        });
      }

      seenInFile.add(phoneNumber);
      candidates.push({ userId, name, phoneNumber, email: email || null });
    });

    // Rows that failed validation above are already "skipped".
    let skippedCount = records.length - candidates.length;
    let importedCount = 0;

    if (candidates.length) {
      // Skip contacts that already exist for this user.
      const phones = candidates.map((c) => c.phoneNumber);
      const existing = await Contact.find({
        userId,
        phoneNumber: { $in: phones },
      })
        .select("phoneNumber")
        .lean();
      const existingSet = new Set(existing.map((e) => e.phoneNumber));

      const toInsert = candidates.filter((c) => {
        if (existingSet.has(c.phoneNumber)) {
          skippedCount += 1;
          errors.push({
            phoneNumber: c.phoneNumber,
            error: "Contact already exists",
          });
          return false;
        }
        return true;
      });

      if (toInsert.length) {
        try {
          const inserted = await Contact.insertMany(toInsert, {
            ordered: false,
          });
          importedCount = inserted.length;
        } catch (bulkErr) {
          // ordered:false => valid docs still inserted; tally what succeeded.
          const nInserted =
            (bulkErr.insertedDocs && bulkErr.insertedDocs.length) ||
            (bulkErr.result && bulkErr.result.insertedCount) ||
            0;
          importedCount = nInserted;
          const failed = toInsert.length - nInserted;
          skippedCount += failed;

          const writeErrors = bulkErr.writeErrors || [];
          writeErrors.forEach((we) => {
            errors.push({
              error: "Insert failed (likely a concurrent duplicate)",
              detail: we.errmsg || we.message,
            });
          });
        }
      }
    }

    return { importedCount, skippedCount, errors };
  }

  /**
   * Export ALL contacts owned by the user as a CSV string.
   * Columns: name, phoneNumber, email, status
   */
  async exportToCsv(userId) {
    const contacts = await Contact.find({ userId })
      .select("name phoneNumber email status")
      .sort({ createdAt: -1 })
      .lean();

    const escapeCell = (val) => {
      const s = val === undefined || val === null ? "" : String(val);
      // Quote if the cell contains comma, quote, or newline; double-up quotes.
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = ["name", "phoneNumber", "email", "status"];
    const rows = contacts.map((c) =>
      [c.name, c.phoneNumber, c.email, c.status].map(escapeCell).join(","),
    );

    return [header.join(","), ...rows].join("\r\n");
  }
}

export default new ContactService();