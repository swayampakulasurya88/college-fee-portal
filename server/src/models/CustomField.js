import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

// Admin-defined extra student details (e.g. "Number of backlogs", "Hostel room",
// "Aadhaar last 4"). Each definition tells the portal what to show on every
// student page and which input to use when editing.
const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    inputType: {
      type: String,
      enum: ['text', 'number', 'select', 'date'],
      default: 'text',
    },
    options: { type: [String], default: [] }, // for inputType 'select'
    required: { type: Boolean, default: false }, // students should fill this in
    showInExport: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customFieldSchema.plugin(jsonPlugin);

export const CustomField = mongoose.model('CustomField', customFieldSchema);
