import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

/**
 * A blocked attempt to reuse a receipt reference.
 *
 * A payment can never share a transaction / UTR id or a receipt number with
 * another payment (both carry unique indexes), so this collection is how the
 * office still sees WHO tried to reuse a reference — and whose payment already
 * owns it.
 */
const duplicateAttemptSchema = new mongoose.Schema(
  {
    // Which reference was reused, and its value.
    kind: {
      type: String,
      enum: ['transactionId', 'receiptNo'],
      required: true,
      index: true,
    },
    reference: { type: String, trim: true, required: true, index: true },

    // The student whose payment was blocked.
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    rollNumber: { type: String, trim: true, uppercase: true, default: '' },
    studentName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
    year: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },

    // What they tried to record.
    amount: { type: Number, default: 0 },
    category: { type: String, trim: true, default: '' },
    term: { type: Number, default: null },
    method: { type: String, trim: true, default: '' },
    paidOn: { type: Date, default: null },
    note: { type: String, trim: true, default: '' },
    submittedBy: { type: String, enum: ['admin', 'student'], default: 'admin' },
    attemptedBy: { type: String, trim: true, default: '' },

    // The existing payment / student that already owns the reference.
    conflictingPayment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    conflictingStudent: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    conflictingRollNumber: { type: String, trim: true, uppercase: true, default: '' },
    conflictingStudentName: { type: String, trim: true, default: '' },

    status: { type: String, enum: ['new', 'reviewed'], default: 'new', index: true },
  },
  { timestamps: true },
);

duplicateAttemptSchema.plugin(jsonPlugin);

export const DuplicateAttempt = mongoose.model('DuplicateAttempt', duplicateAttemptSchema);
