import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Group name is required'],
      trim: true,
      maxlength: [120, 'Group name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * DECISION: group names are unique per user. This keeps a tenant's group list
 * unambiguous. If you'd rather allow duplicate names, remove `unique: true`
 * below and drop the matching 409 handling in the service.
 */
groupSchema.index({ userId: 1, name: 1 }, { unique: true });
groupSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Group', groupSchema);
