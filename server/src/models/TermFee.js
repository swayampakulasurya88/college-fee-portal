import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

// A single fixed-fee installment for one student. Tuition is billed across 4
// terms and hostel across 2 terms; the admin assigns these in bulk (by quota)
// or per student. The student's Student.tuitionFee / Student.hostelFee are the
// SUM of these rows and stay in sync (see utils/finance.js syncStudentFees).
const termFeeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    // Which fixed head this term belongs to.
    head: {
      type: String,
      enum: ['tuition', 'hostel'],
      required: [true, 'Fee head is required'],
      index: true,
    },
    // 1-based term number (1..HEAD_TERMS[head]).
    term: {
      type: Number,
      required: [true, 'Term is required'],
      min: [1, 'Term must be 1 or more'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: String, default: 'admin' },
  },
  { timestamps: true },
);

// One amount per student, per head, per term.
termFeeSchema.index({ student: 1, head: 1, term: 1 }, { unique: true });

termFeeSchema.plugin(jsonPlugin);

export const TermFee = mongoose.model('TermFee', termFeeSchema);
