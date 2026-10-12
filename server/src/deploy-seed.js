import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { Student } from './models/Student.js';
import { Payment } from './models/Payment.js';
import { Message } from './models/Message.js';
import { MessBill } from './models/MessBill.js';
import { TermFee } from './models/TermFee.js';
import { syncAllStudentFees, HEAD_TERMS, TERM_RATES } from './utils/finance.js';

// Populates a fresh (e.g. MongoDB Atlas) database with the college roster and
// the term-wise fee structure. Safe to re-run: students are upserted and term
// fees are rebuilt from the roster. Use --fresh to also wipe payments/messages.
//
//   MONGODB_URI="mongodb+srv://..." npm run deploy:seed
//   MONGODB_URI="mongodb+srv://..." npm run deploy:seed -- --fresh

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');

// Quota overrides live in data/quotas.json (kept out of source control because
// it maps real roll numbers). Students not listed there default to ACAT.
const quotasFile = path.resolve(__dirname, '..', 'data', 'quotas.json');
let QUOTA_OVERRIDES = { BCAT: [], SPOT: [] };
if (fs.existsSync(quotasFile)) {
  try {
    QUOTA_OVERRIDES = JSON.parse(fs.readFileSync(quotasFile, 'utf8'));
  } catch (err) {
    console.warn('[deploy] could not read data/quotas.json:', err.message);
  }
}

function quotaFor(rollNumber) {
  const r = rollNumber.toUpperCase();
  if ((QUOTA_OVERRIDES.BCAT || []).includes(r)) return 'BCAT';
  if ((QUOTA_OVERRIDES.SPOT || []).includes(r)) return 'SPOT';
  return 'ACAT';
}

async function run() {
  const fileArg = args.find((a) => !a.startsWith('--'));
  const rosterPath = path.resolve(__dirname, '..', fileArg || 'data/students.json');
  const parsed = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  const roster = Array.isArray(parsed) ? parsed : parsed.students || [];

  if (!roster.length) {
    console.error(`[deploy] no students found in ${rosterPath}`);
    process.exit(1);
  }

  await connectDB();

  if (fresh) {
    await Promise.all([
      Payment.deleteMany({}),
      Message.deleteMany({}),
      MessBill.deleteMany({}),
      TermFee.deleteMany({}),
    ]);
    console.log('[deploy] cleared payments, messages, mess bills and term fees');
  }

  let created = 0;
  let updated = 0;
  const rowRecords = [];

  for (const rec of roster) {
    const rollNumber = String(rec.rollNumber || rec.roll || '').trim().toUpperCase();
    if (!rollNumber) continue;
    const quota = quotaFor(rollNumber);
    const name = String(rec.name || rec.studentName || rollNumber).trim();
    const college = String(rec.college || '').trim();

    let student = await Student.findOne({ rollNumber });
    if (!student) {
      student = await Student.create({ rollNumber, name, college, quota });
      created += 1;
    } else {
      student.name = name || student.name;
      if (college) student.college = college;
      student.quota = quota;
      student.active = true;
      await student.save();
      updated += 1;
    }
    rowRecords.push({ id: student._id, quota });
  }

  const ids = rowRecords.map((r) => r.id);

  // Rebuild the per-term fixed fees from the quota rates.
  await TermFee.deleteMany({ student: { $in: ids } });
  const termDocs = [];
  for (const { id, quota } of rowRecords) {
    const rate = TERM_RATES[quota] || TERM_RATES.ACAT;
    for (let term = 1; term <= HEAD_TERMS.tuition; term += 1) {
      termDocs.push({ student: id, head: 'tuition', term, amount: rate.tuition, note: `${quota} tuition term ${term}`, createdBy: 'deploy' });
    }
    for (let term = 1; term <= HEAD_TERMS.hostel; term += 1) {
      termDocs.push({ student: id, head: 'hostel', term, amount: rate.hostel, note: `Hostel term ${term}`, createdBy: 'deploy' });
    }
  }
  if (termDocs.length) await TermFee.insertMany(termDocs);
  const synced = await syncAllStudentFees();

  const totals = await TermFee.aggregate([{ $group: { _id: '$head', amount: { $sum: '$amount' } } }]);
  const byHead = totals.map((t) => `${t._id}=${t.amount}`).join(', ');
  const grand = totals.reduce((a, t) => a + t.amount, 0);

  console.log(`[deploy] students created ${created}, updated ${updated} (total ${rowRecords.length})`);
  console.log(`[deploy] term fees inserted ${termDocs.length}, synced ${synced} student caches`);
  console.log(`[deploy] totals: ${byHead} (grand ${grand})`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[deploy] failed:', err.message);
  process.exit(1);
});
