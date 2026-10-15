import { Router } from 'express';
import mongoose from 'mongoose';
import { Payment } from '../models/Payment.js';
import { Student } from '../models/Student.js';
import { financeForStudent, round2, CATEGORIES, HEAD_TERMS } from '../utils/finance.js';
import { paymentPayload, studentPayload } from '../utils/serialize.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex, parseDate } from '../utils/query.js';
import { authRequired, adminOnly, studentOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const METHODS = ['cash', 'upi', 'card', 'netbanking', 'cheque', 'dd', 'other'];

const RECEIPT_PREFIX = 'KIET';

// Builds the next free receipt number, e.g. KIET-2026-0007.
async function generateReceiptNo() {
  const year = new Date().getFullYear();
  const prefix = `${RECEIPT_PREFIX}-${year}-`;
  const last = await Payment.findOne({ receiptNo: { $regex: `^${prefix}` } })
    .sort({ receiptNo: -1 })
    .select('receiptNo')
    .lean();
  let n = 1;
  if (last?.receiptNo) {
    const m = String(last.receiptNo).match(/(\d+)\s*$/);
    if (m) n = Number(m[1]) + 1;
  }
  for (let i = 0; i < 200; i += 1) {
    const candidate = `${prefix}${String(n + i).padStart(4, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    const clash = await Payment.findOne({ receiptNo: candidate }).select('_id').lean();
    if (!clash) return candidate;
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

// Rejects a payment whose receipt number or transaction id is already in use.
async function assertUniqueReceipt({ receiptNo, transactionId }, excludeId = null) {
  const jobs = [];
  if (receiptNo) {
    const q = { receiptNo };
    if (excludeId) q._id = { $ne: excludeId };
    jobs.push(
      Payment.findOne(q)
        .select('_id')
        .lean()
        .then((dup) => {
          if (dup) throw new HttpError(409, `Receipt No. ${receiptNo} is already used on another payment. Receipt numbers must be unique.`);
        }),
    );
  }
  if (transactionId) {
    const q = { transactionId };
    if (excludeId) q._id = { $ne: excludeId };
    jobs.push(
      Payment.findOne(q)
        .select('_id')
        .lean()
        .then((dup) => {
          if (dup) throw new HttpError(409, `Transaction / UTR ID ${transactionId} is already recorded. Duplicate receipts are not allowed.`);
        }),
    );
  }
  await Promise.all(jobs);
}

// Turns a Mongo duplicate-key error into a readable 409.
function duplicateKeyError(err) {
  if (err?.code !== 11000) return err;
  const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
  if (field === 'receiptNo') return new HttpError(409, 'That receipt number already exists. Receipt numbers must be unique.');
  if (field === 'transactionId') return new HttpError(409, 'That transaction / UTR ID is already recorded. Duplicate receipts are not allowed.');
  return new HttpError(409, 'A payment with the same receipt details already exists.');
}


function pickPaymentFields(body, { partial = false, requireTransaction = false } = {}) {
  const out = {};
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new HttpError(400, 'Amount must be greater than zero');
    }
    out.amount = round2(amount);
  } else if (!partial) {
    throw new HttpError(400, 'Amount is required');
  }

  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) {
      throw new HttpError(400, 'Fee type must be tuition, hostel or mess');
    }
    out.category = body.category;
  } else if (!partial) {
    out.category = 'tuition';
  }

  if (body.term !== undefined) {
    if (body.term === null || body.term === '') {
      out.term = null;
    } else {
      const term = Number(body.term);
      if (!Number.isInteger(term) || term < 1) {
        throw new HttpError(400, 'Term must be a positive whole number');
      }
      out.term = term;
    }
  }

  if (body.transactionId !== undefined) out.transactionId = String(body.transactionId).trim();
  if (requireTransaction && !out.transactionId) {
    throw new HttpError(400, 'Please enter the transaction / reference ID');
  }

  if (body.paidOn !== undefined) {
    const d = new Date(body.paidOn);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Invalid payment date');
    out.paidOn = d;
  }
  if (body.method !== undefined) {
    if (!METHODS.includes(body.method)) throw new HttpError(400, 'Invalid payment method');
    out.method = body.method;
  }
  if (body.receiptNo !== undefined) out.receiptNo = String(body.receiptNo).trim();
  if (body.note !== undefined) out.note = String(body.note).trim();
  return out;
}

// Enforces the term rule: tuition & hostel payments must name a valid term;
// mess payments are monthly, so they carry no term.
function applyTermRules(fields, existing = null) {
  const category = fields.category ?? existing?.category ?? 'tuition';
  const term = fields.term !== undefined ? fields.term : existing?.term ?? null;

  if (category === 'mess') {
    fields.term = null;
    return fields;
  }
  const max = HEAD_TERMS[category] || 0;
  if (term == null) {
    throw new HttpError(400, `Please choose which ${category} term this payment is for`);
  }
  if (!Number.isInteger(term) || term < 1 || term > max) {
    throw new HttpError(400, `Term must be between 1 and ${max} for ${category} fee`);
  }
  fields.term = term;
  return fields;
}

// GET /api/payments/mine -> the logged-in student's own payments
router.get(
  '/mine',
  studentOnly,
  asyncHandler(async (req, res) => {
    const payments = await Payment.find({ student: req.user.sub }).sort({ paidOn: -1, createdAt: -1 });
    res.json({ data: payments.map((p) => paymentPayload(p)) });
  }),
);

// GET /api/payments -> all payments (admin), filterable by student, category, date, text
router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const studentId = String(req.query.studentId || '').trim();
    const category = String(req.query.category || '').trim();
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));

    const match = {};
    if (studentId && mongoose.isValidObjectId(studentId)) {
      match.student = new mongoose.Types.ObjectId(studentId);
    }
    if (category && CATEGORIES.includes(category)) match.category = category;
    if (from || to) {
      match.paidOn = {};
      if (from) match.paidOn.$gte = from;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        match.paidOn.$lte = end;
      }
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    ];

    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'student.rollNumber': rx },
            { 'student.name': rx },
            { receiptNo: rx },
            { transactionId: rx },
            { note: rx },
          ],
        },
      });
    }

    pipeline.push({
      $facet: {
        rows: [
          { $sort: { paidOn: -1, createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
        sum: [{ $group: { _id: null, amount: { $sum: '$amount' } } }],
      },
    });

    const [result] = await Payment.aggregate(pipeline);
    const rows = result?.rows || [];
    res.json({
      data: rows.map((p) => paymentPayload(p)),
      total: result?.total?.[0]?.count || 0,
      sum: round2(result?.sum?.[0]?.amount || 0),
      page,
      limit,
    });
  }),
);

// POST /api/payments -> admin records a payment, or a student submits their own.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const isStudent = req.user?.role === 'student';

    let student;
    if (isStudent) {
      student = await Student.findById(req.user.sub);
    } else {
      const studentId = String(req.body?.studentId || '').trim();
      if (!mongoose.isValidObjectId(studentId)) throw new HttpError(400, 'A valid student is required');
      student = await Student.findById(studentId);
    }
    if (!student) throw new HttpError(404, 'Student not found');

    const fields = pickPaymentFields(req.body || {}, { requireTransaction: isStudent });
    applyTermRules(fields);
    // Every payment gets a unique receipt number (auto-issued when the admin
    // leaves the field blank).
    if (!fields.receiptNo) fields.receiptNo = await generateReceiptNo();
    await assertUniqueReceipt(fields);

    let payment;
    try {
      payment = await Payment.create({
        ...fields,
        student: student._id,
        submittedBy: isStudent ? 'student' : 'admin',
        createdBy: isStudent ? student.rollNumber : req.user?.username || 'admin',
      });
    } catch (err) {
      throw duplicateKeyError(err);
    }

    const finance = await financeForStudent(student);
    res.status(201).json({
      payment: paymentPayload(payment, student),
      student: studentPayload(student, finance),
    });
  }),
);

// PATCH /api/payments/:id -> edit a payment (admin; due is recalculated)
router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new HttpError(404, 'Payment not found');

    const fields = pickPaymentFields(req.body || {}, { partial: true });
    applyTermRules(fields, payment);
    await assertUniqueReceipt(fields, payment._id);
    Object.assign(payment, fields);
    try {
      await payment.save();
    } catch (err) {
      throw duplicateKeyError(err);
    }

    const student = await Student.findById(payment.student);
    const finance = await financeForStudent(student);
    res.json({
      payment: paymentPayload(payment, student),
      student: studentPayload(student, finance),
    });
  }),
);

// DELETE /api/payments/:id -> remove a payment (admin; due is recalculated)
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) throw new HttpError(404, 'Payment not found');

    const student = await Student.findById(payment.student);
    await payment.deleteOne();

    const finance = await financeForStudent(student);
    res.json({
      message: 'Payment deleted',
      student: student ? studentPayload(student, finance) : null,
    });
  }),
);

export default router;
