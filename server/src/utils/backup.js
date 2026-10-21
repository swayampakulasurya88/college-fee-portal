// Daily in-app backups: snapshot every collection to a gzip JSON blob, one per
// day, so the admin portal can list and download them.
//
// The free tier sleeps and restarts, so instead of relying on a cron we use a
// belt-and-braces approach: an hourly tick while the service is awake, plus a
// lazy check whenever the backups page or an admin login is hit.
import zlib from 'node:zlib';
import { Backup } from '../models/Backup.js';
import { Student } from '../models/Student.js';
import { Payment } from '../models/Payment.js';
import { MessBill } from '../models/MessBill.js';
import { TermFee } from '../models/TermFee.js';
import { Message } from '../models/Message.js';
import { DuplicateAttempt } from '../models/DuplicateAttempt.js';
import { Trash } from '../models/Trash.js';
import { CustomField } from '../models/CustomField.js';

const COLLECTIONS = [
  ['students', Student],
  ['payments', Payment],
  ['termFees', TermFee],
  ['messBills', MessBill],
  ['messages', Message],
  ['duplicateAttempts', DuplicateAttempt],
  ['customFields', CustomField],
  ['trash', Trash],
];

/** Today's date label in college-local time (Asia/Kolkata). */
export function istDate(input = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input);
}

export function backupPayload(row) {
  const raw = typeof row.toObject === 'function' ? row.toObject() : { ...row };
  return {
    id: String(raw._id || raw.id),
    date: raw.date,
    counts: raw.counts || {},
    size: Number(raw.size || 0),
    trigger: raw.trigger || 'scheduler',
    takenAt: raw.takenAt || raw.createdAt,
    createdAt: raw.createdAt,
  };
}

/** Takes (or refreshes) the snapshot for `date`. */
export async function createBackup({ date = istDate(), trigger = 'manual', force = false } = {}) {
  if (!force) {
    const existing = await Backup.exists({ date });
    if (existing) return { created: false, date };
  }

  const payload = { date, generatedAt: new Date().toISOString(), collections: {} };
  const counts = {};
  for (const [name, Model] of COLLECTIONS) {
    const docs = await Model.find({}).lean();
    payload.collections[name] = docs;
    counts[name] = docs.length;
  }

  const data = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });

  await Backup.findOneAndUpdate(
    { date },
    { $set: { date, counts, size: data.length, data, trigger, takenAt: new Date() } },
    { upsert: true, setDefaultsOnInsert: true },
  );

  return { created: true, date, size: data.length, counts };
}

/** Ensures a snapshot exists for today; never throws (used as a side effect). */
export async function ensureTodayBackup(trigger = 'scheduler') {
  try {
    const date = istDate();
    const existing = await Backup.exists({ date });
    if (existing) return { created: false, date };
    return await createBackup({ date, trigger });
  } catch (err) {
    console.error('[backup] failed:', err.message);
    return null;
  }
}

/** Hourly tick while the service is awake (plus one shortly after boot). */
export function startBackupScheduler() {
  const run = () => ensureTodayBackup('scheduler');
  setTimeout(run, 45 * 1000).unref?.();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref?.();
  return timer;
}
