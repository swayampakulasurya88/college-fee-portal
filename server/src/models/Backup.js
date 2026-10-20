import mongoose from 'mongoose';
import { jsonPlugin } from './plugins.js';

// One row per day: a gzip-compressed JSON snapshot of every collection, kept in
// the portal database so the admin can browse and download backups from the UI.
// (A separate GitHub Actions job also ships an encrypted copy off-site.)
const backupSchema = new mongoose.Schema(
  {
    // Snapshot day label, YYYY-MM-DD in Asia/Kolkata.
    date: { type: String, required: true, unique: true, index: true },
    counts: { type: mongoose.Schema.Types.Mixed, default: {} },
    size: { type: Number, default: 0 },
    trigger: { type: String, default: 'scheduler' },
    // Hidden from normal queries — only fetched when actually downloading.
    data: { type: Buffer, required: true, select: false },
    takenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

backupSchema.plugin(jsonPlugin);

export const Backup = mongoose.model('Backup', backupSchema);
