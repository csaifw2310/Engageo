import mongoose from 'mongoose';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactSchema = new mongoose.Schema(
  {
    // Tenant owner. Every query is scoped by this field.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      validate: {
        validator: (v) => v == null || v === '' || EMAIL_REGEX.test(v),
        message: 'Invalid email format',
      },
    },
    tags: {
      type: [String],
      default: [],
    },
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive'],
        message: 'Status must be either "active" or "inactive"',
      },
      default: 'active',
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    versionKey: false,
  }
);

/**
 * Core business rule: a single user cannot have two contacts with the same
 * phone number. Enforced atomically at the DB layer (race-safe).
 */
contactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });

// Supports default listing (sorted by newest) within a tenant.
contactSchema.index({ userId: 1, createdAt: -1 });

// Supports name sort/lookup within a tenant.
contactSchema.index({ userId: 1, name: 1 });

// Analytics: contact-status breakdown (GET /api/analytics/contacts) groups a
// tenant's contacts by active/inactive status.
contactSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Contact', contactSchema);