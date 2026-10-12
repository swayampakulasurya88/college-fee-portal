import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

// A monthly mess charge for one student. The admin imports these every month
// (bulk or per student); they add to the student's total fee.
const messBillSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    // Billing month in 'YYYY-MM' form (e.g. '2026-08').
    month: {
      type: String,
      required: [true, 'Month is required'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like YYYY-MM'],
      index: true,
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

// One mess bill per student per month.
messBillSchema.index({ student: 1, month: 1 }, { unique: true });

messBillSchema.plugin(jsonPlugin);

export const MessBill = mongoose.model('MessBill', messBillSchema);
