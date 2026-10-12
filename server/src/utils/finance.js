import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { MessBill } from '../models/MessBill.js';
import { TermFee } from '../models/TermFee.js';
import { Student } from '../models/Student.js';

export const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export const CATEGORIES = ['tuition', 'hostel', 'mess'];

// Fixed fee heads are billed term-wise. Tuition = 4 terms, hostel = 2 terms.
export const HEAD_TERMS = { tuition: 4, hostel: 2 };
export const FIXED_HEADS = ['tuition', 'hostel'];

export const QUOTAS = ['ACAT', 'BCAT', 'SPOT'];

// Default per-term rate for a quota (used by the Fee Structure page presets).
export const TERM_RATES = {
  ACAT: { tuition: 18750, hostel: 25000 },
  BCAT: { tuition: 31250, hostel: 25000 },
  SPOT: { tuition: 31250, hostel: 25000 },
};

export function feeStatus(totalFee, totalPaid) {
  if (totalPaid <= 0) return 'unpaid';
  if (totalFee - totalPaid <= 0.001) return 'paid';
  return 'partial';
}

// Builds the full finance view for a student.
//   totalFee = tuitionFee + hostelFee + sum(monthly mess bills)
//   totalPaid = sum of every payment, split by category
export function buildFinance({
  tuitionFee = 0,
  hostelFee = 0,
  messFee = 0,
  paidByCategory = {},
  paymentCount = 0,
  messBillCount = 0,
  terms,
} = {}) {
  const t = round2(tuitionFee);
  const h = round2(hostelFee);
  const m = round2(messFee);

  const tuitionPaid = round2(paidByCategory.tuition || 0);
  const hostelPaid = round2(paidByCategory.hostel || 0);
  const messPaid = round2(paidByCategory.mess || 0);

  const totalPaid = round2(tuitionPaid + hostelPaid + messPaid);
  const totalFee = round2(t + h + m);

  return {
    tuitionFee: t,
    hostelFee: h,
    messFee: m,
    totalFee,
    totalPaid,
    totalDue: round2(totalFee - totalPaid),

    tuitionPaid,
    hostelPaid,
    messPaid,
    tuitionDue: round2(Math.max(t - tuitionPaid, 0)),
    hostelDue: round2(Math.max(h - hostelPaid, 0)),
    messDue: round2(Math.max(m - messPaid, 0)),

    // Per-term breakdown for the fixed heads (empty array when not provided).
    terms: terms || { tuition: [], hostel: [] },

    paymentCount,
    messBillCount,
    status: feeStatus(totalFee, totalPaid),
  };
}

// Recomputes and stores Student.tuitionFee / Student.hostelFee from TermFee rows.
export async function syncStudentFees(studentId) {
  const oid = new mongoose.Types.ObjectId(String(studentId));
  const rows = await TermFee.aggregate([
    { $match: { student: oid } },
    { $group: { _id: '$head', amount: { $sum: '$amount' } } },
  ]);
  const totals = { tuition: 0, hostel: 0 };
  for (const r of rows) if (r._id in totals) totals[r._id] = round2(r.amount);

  await Student.updateOne(
    { _id: oid },
    { $set: { tuitionFee: totals.tuition, hostelFee: totals.hostel } },
  );
  return totals;
}

// Recomputes every student's cached fixed-fee totals from TermFee rows.
export async function syncAllStudentFees() {
  const rows = await TermFee.aggregate([
    { $group: { _id: { student: '$student', head: '$head' }, amount: { $sum: '$amount' } } },
  ]);
  const byStudent = new Map();
  for (const r of rows) {
    const key = String(r._id.student);
    const cur = byStudent.get(key) || { tuition: 0, hostel: 0 };
    if (r._id.head in cur) cur[r._id.head] = round2(r.amount);
    byStudent.set(key, cur);
  }

  const students = await Student.find({}).select('_id tuitionFee hostelFee');
  const ops = [];
  for (const s of students) {
    const cur = byStudent.get(String(s._id)) || { tuition: 0, hostel: 0 };
    if (Number(s.tuitionFee || 0) !== cur.tuition || Number(s.hostelFee || 0) !== cur.hostel) {
      ops.push({
        updateOne: {
          filter: { _id: s._id },
          update: { $set: { tuitionFee: cur.tuition, hostelFee: cur.hostel } },
        },
      });
    }
  }
  if (ops.length) await Student.bulkWrite(ops);
  return ops.length;
}

// Computes a single student's financials from the term fees, payments and mess bills.
export async function financeForStudent(student) {
  const id = student?._id || student?.id || student;
  const oid = new mongoose.Types.ObjectId(String(id));

  const [termRows, payRows, messRows] = await Promise.all([
    TermFee.aggregate([
      { $match: { student: oid } },
      { $group: { _id: { head: '$head', term: '$term' }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { student: oid } },
      {
        $group: {
          _id: { category: { $ifNull: ['$category', 'tuition'] }, term: { $ifNull: ['$term', null] } },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    MessBill.aggregate([
      { $match: { student: oid } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const termFee = { tuition: {}, hostel: {} };
  for (const row of termRows) {
    const { head, term } = row._id;
    if (termFee[head]) termFee[head][term] = round2(row.amount);
  }

  const paidByCategory = {};
  const paidByTerm = { tuition: {}, hostel: {} };
  let paymentCount = 0;
  for (const row of payRows) {
    const category = row._id.category;
    const term = row._id.term;
    paidByCategory[category] = (paidByCategory[category] || 0) + row.amount;
    paymentCount += row.count || 0;
    if (paidByTerm[category] && term != null) {
      paidByTerm[category][term] = (paidByTerm[category][term] || 0) + row.amount;
    }
  }

  const tuitionFee = round2(Object.values(termFee.tuition).reduce((a, b) => a + b, 0));
  const hostelFee = round2(Object.values(termFee.hostel).reduce((a, b) => a + b, 0));

  const terms = { tuition: [], hostel: [] };
  for (const head of FIXED_HEADS) {
    for (let t = 1; t <= HEAD_TERMS[head]; t += 1) {
      const fee = round2(termFee[head][t] || 0);
      const paid = round2(paidByTerm[head][t] || 0);
      terms[head].push({ term: t, fee, paid, due: round2(Math.max(fee - paid, 0)) });
    }
  }

  return buildFinance({
    tuitionFee,
    hostelFee,
    messFee: messRows[0]?.amount || 0,
    paidByCategory,
    paymentCount,
    messBillCount: messRows[0]?.count || 0,
    terms,
  });
}
