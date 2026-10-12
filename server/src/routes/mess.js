import { Router } from 'express';
import mongoose from 'mongoose';
import { MessBill } from '../models/MessBill.js';
import { Student } from '../models/Student.js';
import { messBillPayload } from '../utils/serialize.js';
import { round2 } from '../utils/finance.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/query.js';
import { authRequired, adminOnly, studentOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function pickMonth(value, { required = true } = {}) {
  if (value === undefined || value === '') {
    if (required) throw new HttpError(400, 'Month is required (YYYY-MM)');
    return undefined;
  }
  const month = String(value).trim();
  if (!MONTH_RE.test(month)) throw new HttpError(400, 'Month must look like YYYY-MM');
  return month;
}

function pickAmount(value, { required = true } = {}) {
  if (value === undefined || value === '') {
    if (required) throw new HttpError(400, 'Amount is required');
    return undefined;
  }
  const amount = Number(value);
  if (Number.isNaN(amount) || amount < 0) throw new HttpError(400, 'Amount must be zero or more');
  return round2(amount);
}

// GET /api/mess/mine -> the student's own monthly mess bills
router.get(
  '/mine',
  studentOnly,
  asyncHandler(async (req, res) => {
    const bills = await MessBill.find({ student: req.user.sub }).sort({ month: -1 });
    res.json({ data: bills.map((b) => messBillPayload(b)) });
  }),
);

// GET /api/mess/months -> admin: month-by-month mess totals
router.get(
  '/months',
  adminOnly,
  asyncHandler(async (req, res) => {
    const rows = await MessBill.aggregate([
      { $group: { _id: '$month', students: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { _id: -1 } },
    ]);
    res.json({
      data: rows.map((r) => ({ month: r._id, students: r.students, amount: round2(r.amount) })),
    });
  }),
);

// GET /api/mess -> admin: list mess bills (filter by month / student text)
router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const month = pickMonth(req.query.month, { required: false });
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));

    const pipeline = [
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    ];
    const match = {};
    if (month) match.month = month;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      match.$or = [{ 'student.rollNumber': rx }, { 'student.name': rx }];
    }
    if (Object.keys(match).length) pipeline.push({ $match: match });

    pipeline.push({
      $facet: {
        rows: [
          { $sort: { month: -1, 'student.rollNumber': 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
        sum: [{ $group: { _id: null, amount: { $sum: '$amount' } } }],
      },
    });

    const [result] = await MessBill.aggregate(pipeline);
    res.json({
      data: (result?.rows || []).map((b) => messBillPayload(b)),
      total: result?.total?.[0]?.count || 0,
      sum: round2(result?.sum?.[0]?.amount || 0),
      page,
      limit,
    });
  }),
);

// POST /api/mess -> admin: add/update one student's mess bill for a month
router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const studentId = String(req.body?.studentId || '').trim();
    if (!mongoose.isValidObjectId(studentId)) throw new HttpError(400, 'A valid student is required');
    const student = await Student.findById(studentId);
    if (!student) throw new HttpError(404, 'Student not found');

    const month = pickMonth(req.body?.month);
    const amount = pickAmount(req.body?.amount);

    const bill = await MessBill.findOneAndUpdate(
      { student: student._id, month },
      { amount, note: String(req.body?.note || '').trim(), createdBy: req.user?.username || 'admin' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.status(201).json({ bill: messBillPayload(bill, student) });
  }),
);

// POST /api/mess/bulk -> admin: set the same monthly mess fee for many students
router.post(
  '/bulk',
  adminOnly,
  asyncHandler(async (req, res) => {
    const month = pickMonth(req.body?.month);
    const amount = pickAmount(req.body?.amount);
    const note = String(req.body?.note || '').trim();
    const applyAll = req.body?.applyAll !== false && !Array.isArray(req.body?.studentIds);

    let ids = Array.isArray(req.body?.studentIds)
      ? req.body.studentIds.filter((id) => mongoose.isValidObjectId(id))
      : [];

    if (applyAll && ids.length === 0) {
      const all = await Student.find({ active: { $ne: false } }).select('_id');
      ids = all.map((s) => s._id);
    }
    if (!ids.length) throw new HttpError(400, 'Select at least one student');

    let created = 0;
    let updated = 0;
    for (const id of ids) {
      const existing = await MessBill.findOne({ student: id, month });
      if (existing) {
        existing.amount = amount;
        if (note) existing.note = note;
        existing.createdBy = req.user?.username || 'admin';
        await existing.save();
        updated += 1;
      } else {
        await MessBill.create({ student: id, month, amount, note, createdBy: req.user?.username || 'admin' });
        created += 1;
      }
    }

    res.status(201).json({ created, updated, total: ids.length, month, amount });
  }),
);

// PATCH /api/mess/:id -> admin: edit a mess bill
router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const bill = await MessBill.findById(req.params.id);
    if (!bill) throw new HttpError(404, 'Mess bill not found');

    const month = pickMonth(req.body?.month, { required: false });
    const amount = pickAmount(req.body?.amount, { required: false });
    if (month !== undefined) bill.month = month;
    if (amount !== undefined) bill.amount = amount;
    if (req.body?.note !== undefined) bill.note = String(req.body.note).trim();
    await bill.save();

    const student = await Student.findById(bill.student);
    res.json({ bill: messBillPayload(bill, student) });
  }),
);

// DELETE /api/mess/:id -> admin
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const bill = await MessBill.findById(req.params.id);
    if (!bill) throw new HttpError(404, 'Mess bill not found');
    await bill.deleteOne();
    res.json({ message: 'Mess bill deleted' });
  }),
);

export default router;
