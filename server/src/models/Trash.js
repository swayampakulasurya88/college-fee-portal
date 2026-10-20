import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

// Recycle bin. When an admin deletes a record it is archived here together with
// everything that went with it (a student carries their payments, term fees,
// mess bills and messages), so it can be restored later from one place.
const trashSchema = new mongoose.Schema(
  {
    entity: {
      type: String,
      required: true,
      enum: ['student', 'payment', 'messBill', 'termFee', 'message'],
      index: true,
    },
    // Human-readable name shown in the list, e.g. "Anusha (25B21A45E8)".
    label: { type: String, default: '' },
    studentRoll: { type: String, default: '', index: true },
    studentName: { type: String, default: '' },
    reference: { type: String, default: '' }, // UTR / receipt / month / subject
    summary: { type: String, default: '' }, // "2 payments · 4 term fees"
    recordCount: { type: Number, default: 1 },
    counts: { type: mongoose.Schema.Types.Mixed, default: {} },
    // The archived documents themselves, in raw form so they can be re-inserted
    // exactly as they were (ids, timestamps and references preserved).
    items: [
      {
        _id: false,
        collection: { type: String, required: true },
        doc: { type: mongoose.Schema.Types.Mixed, required: true },
      },
    ],
    deletedBy: { type: String, default: 'admin' },
    deletedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

trashSchema.index({ deletedAt: -1 });
trashSchema.plugin(jsonPlugin);

export const Trash = mongoose.model('Trash', trashSchema);
