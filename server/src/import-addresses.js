/* Imports residential addresses (and parent phone) for EXISTING students.
 *
 *   npm run import:addresses -- "path/to/Filtered_Students_Addresses.csv"
 *   npm run import:addresses -- "path/to/file.csv" --dry   # preview only
 *
 * Expected columns (case-insensitive, header row auto-detected):
 *   Hall Ticket No / Roll Number  → roll number (matched against the database)
 *   Student Phone                 → phone (only filled when currently blank)
 *   Parent Phone                  → parentPhone
 *   Village/Street, Mandal, District, State, Pincode → combined into `address`
 *
 * Nothing else is changed: names, college, branch, year and fees are untouched,
 * and roll numbers that are not already in the database are reported (never
 * created). Safe to re-run — running it twice changes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { Student } from './models/Student.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const fileArg = args.find((a) => !a.startsWith('--'));
const file = path.resolve(__dirname, '..', fileArg || 'data/addresses.csv');

// ---- CSV parsing (handles quoted fields with commas) ---------------------

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

const norm = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Which source column feeds which field.
function classify(header) {
  const h = norm(header);
  if (/(hall\s*ticket|roll)/.test(h)) return 'rollNumber';
  if (/student\s*name|^name$/.test(h)) return 'name';
  if (/class\s*id/.test(h)) return 'classId';
  if (/parent/.test(h) && /phone|mobile|contact|cell/.test(h)) return 'parentPhone';
  if (/student\s*phone/.test(h)) return 'phone';
  if (/phone|mobile|contact|cell/.test(h)) return 'phone';
  if (/pincode|pin\s*code|postal/.test(h)) return 'pincode';
  if (/village|street/.test(h)) return 'village';
  if (/mandal/.test(h)) return 'mandal';
  if (/district/.test(h)) return 'district';
  if (/state/.test(h)) return 'state';
  if (/address|addr|residence/.test(h)) return 'address';
  return null;
}

function toRecords(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const cols = rows[0].map(classify);
  const hasHeader = cols.some((c) => c === 'rollNumber' || c === 'name');
  const body = hasHeader ? rows.slice(1) : rows;
  // Fallback column order if the file has no header.
  const order = hasHeader ? cols : ['rollNumber', 'name', 'classId', 'phone', 'parentPhone', 'village', 'mandal', 'district', 'state', 'pincode'];

  return body.map((cells) => {
    const rec = {};
    order.forEach((key, i) => {
      if (!key) return;
      const v = String(cells[i] ?? '').trim();
      if (key === 'address') rec.address = rec.address ? `${rec.address}, ${v}` : v;
      else if (rec[key] === undefined) rec[key] = v;
    });
    return rec;
  });
}

// Builds "Village, Mandal, District, State - Pincode" from whichever parts exist.
function buildAddress(rec) {
  const parts = [rec.village, rec.mandal, rec.district, rec.state].map((p) => (p || '').trim()).filter(Boolean);
  const pin = (rec.pincode || '').trim();
  const base = parts.join(', ');
  if (pin) return base ? `${base} - ${pin}` : pin;
  return base || rec.address || '';
}

// ---- run -----------------------------------------------------------------

async function run() {
  if (!fs.existsSync(file)) {
    console.error(`[import:addresses] file not found: ${file}`);
    process.exit(1);
  }

  const records = toRecords(fs.readFileSync(file, 'utf8'));
  if (!records.length) {
    console.error('[import:addresses] no rows found in file');
    process.exit(1);
  }

  await connectDB();

  let matched = 0;
  let updated = 0;
  let unchanged = 0;
  const notFound = [];
  const created = [];

  for (const rec of records) {
    const rollNumber = String(rec.rollNumber || '').trim().toUpperCase();
    if (!rollNumber) continue;
    const address = buildAddress(rec);
    const parentPhone = String(rec.parentPhone || '').trim();
    const phone = String(rec.phone || '').trim();

    const student = await Student.findOne({ rollNumber });
    if (!student) {
      notFound.push(rollNumber);
      continue;
    }
    matched += 1;

    const set = {};
    if (address && student.address !== address) set.address = address;
    if (parentPhone && student.parentPhone !== parentPhone) set.parentPhone = parentPhone;
    // Only fill the student's phone when it is currently empty.
    if (phone && !student.phone) set.phone = phone;

    if (Object.keys(set).length === 0) {
      unchanged += 1;
      continue;
    }
    if (dry) {
      created.push({ rollNumber, ...set });
      updated += 1;
      continue;
    }
    Object.assign(student, set);
    await student.save();
    updated += 1;
  }

  console.log(`[import:addresses] file: ${path.basename(file)}`);
  console.log(`[import:addresses] rows: ${records.length} | matched: ${matched} | updated: ${updated} | unchanged: ${unchanged} | not found: ${notFound.length}`);
  if (notFound.length) console.log(`[import:addresses] NOT in database: ${notFound.join(', ')}`);
  if (dry) {
    console.log('[import:addresses] --dry run, nothing written. First 5 changes:');
    console.log(JSON.stringify(created.slice(0, 5), null, 2));
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[import:addresses] failed:', err.message);
  process.exit(1);
});
