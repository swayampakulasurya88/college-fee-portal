// Recycle-bin helpers: move deleted documents into the Trash collection and
// put them back exactly as they were when an admin restores them.
import { Trash } from '../models/Trash.js';
import { Student } from '../models/Student.js';
import { Payment } from '../models/Payment.js';
import { MessBill } from '../models/MessBill.js';
import { TermFee } from '../models/TermFee.js';
import { Message } from '../models/Message.js';
import { HttpError } from './asyncHandler.js';
import { syncStudentFees } from './finance.js';

const MODELS = [Student, Payment, MessBill, TermFee, Message];

export const BY_COLLECTION = Object.fromEntries(MODELS.map((m) => [m.collection.name, m]));

export const ENTITY_BY_COLLECTION = {
  [Student.collection.name]: 'student',
  [Payment.collection.name]: 'payment',
  [MessBill.collection.name]: 'messBill',
  [TermFee.collection.name]: 'termFee',
  [Message.collection.name]: 'message',
};

export const ENTITY_LABEL = {
  student: 'Student',
  payment: 'Fee payment',
  messBill: 'Mess bill',
  termFee: 'Term fee',
  message: 'Message',
};

// Restoring a student must happen before their dependent records.
const ENTITY_ORDER = { student: 0, termFee: 1, messBill: 2, payment: 3, message: 4 };

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const describe = (doc) =>
  doc.rollNumber ||
  doc.subject ||
  (doc.transactionId ? `UTR ${doc.transactionId}` : '') ||
  (doc.month ? `Mess ${doc.month}` : '') ||
  String(doc._id).slice(-8);

/** Archives the given documents so the delete can be undone later. */
export async function archiveDeleted({
  entity,
  label = '',
  reference = '',
  summary = '',
  studentRoll = '',
  studentName = '',
  counts = {},
  items = [],
  deletedBy = 'admin',
}) {
  const docs = items.filter((item) => item?.doc && BY_COLLECTION[item.collection]);
  if (!docs.length) return null;

  return Trash.create({
    entity,
    label,
    reference,
    summary,
    studentRoll,
    studentName,
    counts,
    recordCount: docs.length,
    items: docs,
    deletedBy,
    deletedAt: new Date(),
  });
}

/** API shape for a Trash row (the archived payload is omitted — it can be large). */
export function trashPayload(t) {
  const raw = typeof t.toObject === 'function' ? t.toObject() : { ...t };
  return {
    id: String(raw._id || raw.id),
    entity: raw.entity,
    label: raw.label || '',
    studentRoll: raw.studentRoll || '',
    studentName: raw.studentName || '',
    reference: raw.reference || '',
    summary: raw.summary || '',
    recordCount: raw.recordCount || raw.items?.length || 0,
    counts: raw.counts || {},
    deletedBy: raw.deletedBy || 'admin',
    deletedAt: raw.deletedAt,
    createdAt: raw.createdAt,
  };
}

/**
 * Re-inserts every archived document with its original id, references and
 * timestamps. Returns { restored, skipped } where `skipped` holds records that
 * already exist again (duplicate roll number / UTR / receipt).
 */
export async function restoreTrashEntry(entry) {
  const items = [...(entry.items || [])].sort((a, b) => {
    const ao = ENTITY_ORDER[ENTITY_BY_COLLECTION[a.collection]] ?? 9;
    const bo = ENTITY_ORDER[ENTITY_BY_COLLECTION[b.collection]] ?? 9;
    return ao - bo;
  });

  let restored = 0;
  const skipped = [];
  // Students whose fixed-fee totals must be re-summed once term fees return.
  const syncIds = new Set();

  for (const item of items) {
    const Model = BY_COLLECTION[item.collection];
    if (!Model) continue;

    const doc = { ...item.doc };
    const id = doc._id != null ? String(doc._id) : null;

    try {
      // Already back in the database (e.g. a second restore) — leave it alone.
      if (id && (await Model.exists({ _id: id }))) {
        skipped.push(describe(doc));
        continue;
      }

      const created = await Model.create(doc);

      // Mongoose refreshes timestamps on insert; put the originals back so the
      // restored record keeps its original history.
      const ts = {};
      if (doc.createdAt) ts.createdAt = new Date(doc.createdAt);
      if (doc.updatedAt) ts.updatedAt = new Date(doc.updatedAt);
      if (Object.keys(ts).length) {
        await Model.collection.updateOne({ _id: created._id }, { $set: ts });
      }
      if (item.collection === TermFee.collection.name && doc.student != null) {
        syncIds.add(String(doc.student));
      }
      restored += 1;
    } catch (err) {
      if (err?.code === 11000) {
        if (entry.entity === 'student') {
          throw new HttpError(
            409,
            `Cannot restore: a student with roll number ${entry.studentRoll || doc.rollNumber} already exists`,
          );
        }
        skipped.push(describe(doc));
        continue;
      }
      throw err;
    }
  }

  // Term fees feed the student's stored tuition/hostel totals — recompute them.
  for (const id of syncIds) {
    try {
      await syncStudentFees(id);
    } catch (err) {
      console.error('[trash] fee sync failed:', err.message);
    }
  }

  return { restored, skipped };
}
