/* Imports/updates students from a JSON or CSV file.
 *
 *   npm run import                       # loads data/students.json (default)
 *   npm run import -- path/to/file.csv   # any .json or .csv export
 *   npm run import -- file.csv --fresh   # wipe students/payments/messages first
 *
 * Recognises these columns (case-insensitive, header row auto-detected in CSV):
 *   roll number, name, college, branch, year, section, email, phone, quota
 * Existing roll numbers are updated; new ones are created. Safe to re-run.
 *
 * Fixed fees (tuition / hostel) are NOT imported here — they are assigned
 * term-wise from the admin "Fee Structure" page after the roster is loaded.
 */
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const fileArg = args.find((a) => !a.startsWith('--'));
const file = path.resolve(__dirname, '..', fileArg || 'data/students.json');

// ---- value helpers -------------------------------------------------------

function clean(value) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

const KEY_MAP = [
  [/roll/i, 'rollNumber'],
  [/name|student/i, 'name'],
  [/college|institute|institution/i, 'college'],
  [/quota|allotment|admission.*type/i, 'quota'],
  [/branch|dept|department|course/i, 'branch'],
  [/year/i, 'year'],
  [/section|sec\b/i, 'section'],
  [/mail/i, 'email'],
  [/phone|mobile|contact|cell/i, 'phone'],
];

function keyFor(header) {
  const h = String(header).trim();
  for (const [rx, key] of KEY_MAP) if (rx.test(h)) return key;
  return null;
}

// ---- input parsing -------------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function toRecords(text, ext) {
  if (ext === '.json') {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : data.students || [];
  }

  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => keyFor(h));
  const looksHeader = header.filter(Boolean).length >= 2;
  const cols = looksHeader
    ? header
    : ['rollNumber', 'name', 'college', 'branch', 'year', 'section', 'phone', 'email'];
  const body = looksHeader ? rows.slice(1) : rows;

  return body.map((cells) => {
    const obj = {};
    cols.forEach((key, i) => { if (key) obj[key] = cells[i]; });
    return obj;
  });
}

function normalizeRecord(input) {
  // Also accept loose keys (e.g. "Roll Number", "Student Name") from JSON.
  const rec = {};
  for (const [k, v] of Object.entries(input || {})) {
    const key = keyFor(k) || k;
    if (rec[key] === undefined) rec[key] = v;
  }

  const out = {};
  const rollNumber = clean(rec.rollNumber);
  if (!rollNumber) return null;
  out.rollNumber = rollNumber.toUpperCase();
  out.name = clean(rec.name) || out.rollNumber;
  for (const key of ['college', 'branch', 'year', 'section', 'email', 'phone']) {
    const v = clean(rec[key]);
    if (v !== undefined) out[key] = key === 'email' ? v.toLowerCase() : v;
  }
  // Admission quota drives the per-term tuition rate.
  const quota = clean(rec.quota);
  if (quota !== undefined) {
    const q = quota.toUpperCase();
    if (['ACAT', 'BCAT', 'SPOT'].includes(q)) out.quota = q;
  }
  // NOTE: fixed fees (tuition / hostel) are not imported here. They are set
  // term-wise from the admin "Fee Structure" page (TermFee) after the roster is
  // loaded, so any fee columns in the file are ignored.
  return out;
}

// ---- run -----------------------------------------------------------------

async function run() {
  if (!fs.existsSync(file)) {
    console.error(`[import] file not found: ${file}`);
    process.exit(1);
  }
  const text = fs.readFileSync(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  const records = toRecords(text, ext).map(normalizeRecord).filter(Boolean);

  if (!records.length) {
    console.error('[import] no valid student rows found');
    process.exit(1);
  }

  await connectDB();

  if (fresh) {
    await Promise.all([
      Student.deleteMany({}),
      Payment.deleteMany({}),
      Message.deleteMany({}),
      MessBill.deleteMany({}),
      TermFee.deleteMany({}),
    ]);
    console.log('[import] cleared existing students, term fees, payments, mess bills and messages');
  }

  let created = 0;
  let updated = 0;
  for (const rec of records) {
    const existing = await Student.findOne({ rollNumber: rec.rollNumber });
    if (existing) {
      Object.assign(existing, rec);
      await existing.save();
      updated += 1;
    } else {
      await Student.create(rec);
      created += 1;
    }
  }

  const total = await Student.countDocuments();
  console.log(`[import] created ${created}, updated ${updated} (total students: ${total})`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[import] failed:', err.message);
  process.exit(1);
});
