import { Router } from 'express';
import { Student } from '../models/Student.js';
import { Payment } from '../models/Payment.js';
import { Message } from '../models/Message.js';
import { MessBill } from '../models/MessBill.js';
import { TermFee } from '../models/TermFee.js';
import { buildFinance, financeForStudent, round2, feeStatus, QUOTAS } from '../utils/finance.js';
import { studentPayload, paymentPayload, messBillPayload, termFeePayload } from '../utils/serialize.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/query.js';
import { authRequired, adminOnly, studentOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function normalize(doc) {
  const loan = doc.loan === true;
  const tuitionFee = Number(doc.tuitionFee || 0);
  const hostelFee = Number(doc.hostelFee || 0);
  const messFee = Number(doc.messFee || 0);
  const totalFee = round2(doc.totalFee ?? tuitionFee + hostelFee + messFee);
  // Loan students are shown as fully settled: paid mirrors the fees, due is 0.
  const totalPaid = loan ? totalFee : round2(doc.totalPaid || 0);
  const tuitionPaid = loan ? tuitionFee : round2(doc.tuitionPaid || 0);
  const hostelPaid = loan ? hostelFee : round2(doc.hostelPaid || 0);
  const messPaid = loan ? messFee : round2(doc.messPaid || 0);
  return {
    id: String(doc._id),
    rollNumber: doc.rollNumber,
    name: doc.name,
    college: doc.college || '',
    branch: doc.branch || '',
    year: doc.year || '',
    section: doc.section || '',
    email: doc.email || '',
    phone: doc.phone || '',
    parentPhone: doc.parentPhone || '',
    address: doc.address || '',
    loan,
    loanNote: doc.loanNote || '',
    quota: (doc.quota || 'ACAT').toUpperCase(),
    active: doc.active !== false,
    tuitionFee,
    hostelFee,
    messFee,
    totalFee,
    totalPaid,
    totalDue: round2(totalFee - totalPaid),
    tuitionPaid,
    hostelPaid,
    messPaid,
    tuitionDue: round2(Math.max(tuitionFee - tuitionPaid, 0)),
    hostelDue: round2(Math.max(hostelFee - hostelPaid, 0)),
    messDue: round2(Math.max(messFee - messPaid, 0)),
    paymentCount: doc.paymentCount || 0,
    messBillCount: doc.messBillCount || 0,
    status: loan && totalFee > 0 ? 'paid' : feeStatus(totalFee, totalPaid),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Sums the amounts of payments in one category (used inside the list pipeline).
const sumCategory = (category) => ({
  $sum: {
    $map: {
      input: {
        $filter: {
          input: '$pays',
          as: 'p',
          cond: { $eq: [{ $ifNull: ['$$p.category', 'tuition'] }, category] },
        },
      },
      as: 'p',
      in: '$$p.amount',
    },
  },
});

const STATUS_EXPR = {
  $switch: {
    branches: [
      { case: { $lte: ['$totalPaid', 0] }, then: 'unpaid' },
      {
        case: { $lte: [{ $subtract: ['$totalFee', '$totalPaid'] }, 0.001] },
        then: 'paid',
      },
    ],
    default: 'partial',
  },
};

function pickStudentFields(body, { requireCore = false } = {}) {
  const out = {};
  const setIf = (key, transform = (v) => v) => {
    if (body[key] !== undefined) out[key] = transform(body[key]);
  };
  setIf('rollNumber', (v) => String(v).trim().toUpperCase());
  setIf('name', (v) => String(v).trim());
  setIf('college', (v) => String(v).trim());
  setIf('branch', (v) => String(v).trim());
  setIf('year', (v) => String(v).trim());
  setIf('section', (v) => String(v).trim());
  setIf('email', (v) => String(v).trim().toLowerCase());
  setIf('phone', (v) => String(v).trim());
  setIf('parentPhone', (v) => String(v).trim());
  setIf('address', (v) => String(v).trim());
  setIf('loanNote', (v) => String(v).trim());
  setIf('loan', (v) => v === true || v === 'true' || v === 1 || v === '1');
  setIf('quota', (v) => String(v).trim().toUpperCase());
  setIf('active', (v) => Boolean(v));

  if (requireCore) {
    if (!out.rollNumber) throw new HttpError(400, 'Roll number is required');
    if (!out.name) throw new HttpError(400, 'Student name is required');
    // Fixed fees start at 0 — they are assigned term-wise via the Fee Structure page.
    out.tuitionFee = 0;
    out.hostelFee = 0;
  }
  if (out.quota !== undefined && !QUOTAS.includes(out.quota)) {
    throw new HttpError(400, 'Quota must be ACAT, BCAT or SPOT');
  }
  return out;
}

// ---------- Student self-service (must be before /:id) ----------

router.get(
  '/me',
  studentOnly,
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.user.sub);
    if (!student) throw new HttpError(404, 'Student not found');
    const finance = await financeForStudent(student);
    res.json({ student: studentPayload(student, finance) });
  }),
);

router.get(
  '/me/payments',
  studentOnly,
  asyncHandler(async (req, res) => {
    const payments = await Payment.find({ student: req.user.sub }).sort({ paidOn: -1, createdAt: -1 });
    res.json({ data: payments.map((p) => paymentPayload(p)) });
  }),
);

// ---------- Admin: list & create ----------

router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const quota = String(req.query.quota || '').trim().toUpperCase();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));

    const match = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      match.$or = [{ rollNumber: rx }, { name: rx }, { college: rx }, { branch: rx }, { phone: rx }, { address: rx }];
    }
    if (QUOTAS.includes(quota)) match.quota = quota;
    const loanParam = String(req.query.loan || '').trim();
    if (loanParam === 'true') match.loan = true;
    else if (loanParam === 'false') match.loan = { $ne: true };

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'payments', localField: '_id', foreignField: 'student', as: 'pays' } },
      { $lookup: { from: 'messbills', localField: '_id', foreignField: 'student', as: 'mess' } },
      {
        $addFields: {
          totalPaid: { $sum: '$pays.amount' },
          paymentCount: { $size: '$pays' },
          tuitionPaid: sumCategory('tuition'),
          hostelPaid: sumCategory('hostel'),
          messPaid: sumCategory('mess'),
          messFee: { $sum: '$mess.amount' },
          messBillCount: { $size: '$mess' },
          tuitionFee: { $ifNull: ['$tuitionFee', 0] },
          hostelFee: { $ifNull: ['$hostelFee', 0] },
        },
      },
      {
        $addFields: {
          totalFee: {
            $add: [{ $ifNull: ['$tuitionFee', 0] }, { $ifNull: ['$hostelFee', 0] }, '$messFee'],
          },
        },
      },
      {
        $addFields: {
          isLoan: { $eq: [{ $ifNull: ['$loan', false] }, true] },
        },
      },
      {
        // Loan students: the loan settles every head, so paid mirrors the fees
        // and the account shows a 0 balance below.
        $addFields: {
          totalPaid: { $cond: ['$isLoan', '$totalFee', '$totalPaid'] },
          tuitionPaid: { $cond: ['$isLoan', '$tuitionFee', '$tuitionPaid'] },
          hostelPaid: { $cond: ['$isLoan', '$hostelFee', '$hostelPaid'] },
          messPaid: { $cond: ['$isLoan', '$messFee', '$messPaid'] },
        },
      },
      {
        $addFields: {
          totalDue: { $subtract: ['$totalFee', '$totalPaid'] },
          tuitionDue: { $max: [{ $subtract: ['$tuitionFee', '$tuitionPaid'] }, 0] },
          hostelDue: { $max: [{ $subtract: ['$hostelFee', '$hostelPaid'] }, 0] },
          messDue: { $max: [{ $subtract: ['$messFee', '$messPaid'] }, 0] },
          status: STATUS_EXPR,
        },
      },
    ];
    if (status && ['paid', 'partial', 'unpaid'].includes(status)) {
      pipeline.push({ $match: { status } });
    }
    pipeline.push({
      $facet: {
        rows: [
          { $sort: { rollNumber: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { pays: 0 } },
        ],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await Student.aggregate(pipeline);
    const rows = result?.rows || [];
    const total = result?.total?.[0]?.count || 0;

    res.json({ data: rows.map(normalize), total, page, limit });
  }),
);

router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const fields = pickStudentFields(req.body || {}, { requireCore: true });
    const existing = await Student.findOne({ rollNumber: fields.rollNumber });
    if (existing) throw new HttpError(409, `Roll number ${fields.rollNumber} already exists`);

    const student = await Student.create(fields);
    const finance = buildFinance({ tuitionFee: student.tuitionFee, hostelFee: student.hostelFee });
    res.status(201).json({ student: studentPayload(student, finance) });
  }),
);

// Bulk add many roll numbers at once (used by the "bulk import" box).
router.post(
  '/bulk',
  adminOnly,
  asyncHandler(async (req, res) => {
    const list = Array.isArray(req.body?.students) ? req.body.students : [];
    if (!list.length) throw new HttpError(400, 'No students provided');

    const created = [];
    const skipped = [];

    for (const raw of list) {
      try {
        const fields = pickStudentFields(raw || {}, { requireCore: true });
        const exists = await Student.findOne({ rollNumber: fields.rollNumber });
        if (exists) {
          skipped.push({ rollNumber: fields.rollNumber, reason: 'already exists' });
          continue;
        }
        const student = await Student.create(fields);
        created.push(
          studentPayload(student, buildFinance({ tuitionFee: student.tuitionFee, hostelFee: student.hostelFee })),
        );
      } catch (err) {
        skipped.push({
          rollNumber: raw?.rollNumber ? String(raw.rollNumber).toUpperCase() : '(missing)',
          reason: err.message || 'invalid row',
        });
      }
    }

    res.status(201).json({ created, skipped, createdCount: created.length, skippedCount: skipped.length });
  }),
);

// ---------- Admin: single student ----------

router.get(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw new HttpError(404, 'Student not found');
    const [finance, payments, messBills, termFees] = await Promise.all([
      financeForStudent(student),
      Payment.find({ student: student._id }).sort({ paidOn: -1, createdAt: -1 }),
      MessBill.find({ student: student._id }).sort({ month: -1 }),
      TermFee.find({ student: student._id }).sort({ head: 1, term: 1 }),
    ]);
    res.json({
      student: studentPayload(student, finance),
      payments: payments.map((p) => paymentPayload(p, student)),
      messBills: messBills.map((b) => messBillPayload(b, student)),
      termFees: termFees.map((t) => termFeePayload(t, student)),
    });
  }),
);

router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw new HttpError(404, 'Student not found');

    const fields = pickStudentFields(req.body || {});
    if (fields.rollNumber && fields.rollNumber !== student.rollNumber) {
      const clash = await Student.findOne({ rollNumber: fields.rollNumber, _id: { $ne: student._id } });
      if (clash) throw new HttpError(409, `Roll number ${fields.rollNumber} already exists`);
    }

    Object.assign(student, fields);
    await student.save();

    const finance = await financeForStudent(student);
    res.json({ student: studentPayload(student, finance) });
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw new HttpError(404, 'Student not found');

    await Promise.all([
      Payment.deleteMany({ student: student._id }),
      Message.deleteMany({ student: student._id }),
      MessBill.deleteMany({ student: student._id }),
      TermFee.deleteMany({ student: student._id }),
      student.deleteOne(),
    ]);
    res.json({ message: `Deleted ${student.rollNumber} and all related fee records` });
  }),
);

export default router;
