import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

const paymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    // Which fee head this payment belongs to.
    category: {
      type: String,
      enum: ['tuition', 'hostel', 'mess'],
      default: 'tuition',
      index: true,
    },
    // Which term this payment settles (1..HEAD_TERMS[category]). Null for mess,
    // which is billed monthly instead of term-wise.
    term: {
      type: Number,
      default: null,
      min: [1, 'Term must be 1 or more'],
    },
    // UPI / bank reference the student enters when paying.
    transactionId: { type: String, trim: true, default: '' },
    // Who recorded the payment.
    submittedBy: { type: String, enum: ['admin', 'student'], default: 'admin' },
    paidOn: { type: Date, default: Date.now, index: true },
    method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'netbanking', 'cheque', 'dd', 'other'],
      default: 'cash',
    },
    receiptNo: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: String, default: 'admin' },
  },
  { timestamps: true },
);

paymentSchema.plugin(jsonPlugin);

// A receipt number / transaction reference may never repeat. Empty strings are
// ignored by the partial filter so old rows without a reference stay valid.
paymentSchema.index(
  { receiptNo: 1 },
  { unique: true, partialFilterExpression: { receiptNo: { $gt: '' } }, name: 'uniq_receiptNo' },
);
paymentSchema.index(
  { transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $gt: '' } }, name: 'uniq_transactionId' },
);

export const Payment = mongoose.model('Payment', paymentSchema);
