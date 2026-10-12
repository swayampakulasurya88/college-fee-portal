import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

const studentSchema = new mongoose.Schema(
  {
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: [true, 'Student name is required'], trim: true },
    // Which college/institute the student belongs to (e.g. KIET, KIEK).
    college: { type: String, trim: true, default: '', index: true },
    branch: { type: String, trim: true, default: '' },
    year: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    // Admission quota — drives the per-term tuition rate.
    //   ACAT = came through rank/counselling, BCAT = management quota, SPOT = spot admission.
    quota: {
      type: String,
      enum: ['ACAT', 'BCAT', 'SPOT'],
      default: 'ACAT',
      uppercase: true,
      trim: true,
      index: true,
    },
    // Fixed fee components assigned by the admin. These are the SUM of the
    // per-term amounts in the TermFee collection (kept in sync automatically) so
    // lists and reports stay fast. The monthly mess fee is stored separately
    // (see MessBill) so it can be added every month.
    tuitionFee: {
      type: Number,
      default: 0,
      min: [0, 'Tuition fee cannot be negative'],
    },
    hostelFee: {
      type: Number,
      default: 0,
      min: [0, 'Hostel fee cannot be negative'],
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

studentSchema.plugin(jsonPlugin);

export const Student = mongoose.model('Student', studentSchema);
