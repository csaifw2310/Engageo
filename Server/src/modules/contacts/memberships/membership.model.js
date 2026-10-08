import mongoose from 'mongoose';

/**
 * Junction collection implementing the many-to-many relationship between
 * Contacts and Groups.
 *
 * WHY a separate collection instead of an embedded array?
 *  - Embedding `contacts: []` on a Group risks hitting MongoDB's 16MB document
 *    limit and causes write contention as a group grows.
 *  - A junction collection gives O(index) membership checks in both directions
 *    and a clean uniqueness guarantee.
 *
 * `userId` is duplicated here for tenant-scoped queries without an extra lookup.
 */
const membershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// A contact can be assigned to a group only once.
membershipSchema.index({ groupId: 1, contactId: 1 }, { unique: true });

// Fast "contacts in this group" and "groups for this contact" lookups.
membershipSchema.index({ userId: 1, groupId: 1 });
membershipSchema.index({ userId: 1, contactId: 1 });

export default mongoose.model('GroupMembership', membershipSchema);
