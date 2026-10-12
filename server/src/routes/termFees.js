import { Router } from 'express';
import mongoose from 'mongoose';
import { TermFee } from '../models/TermFee.js';
import { Student } from '../models/Student.js';
import { termFeePayload } from '../utils/serialize.js';
import { HEAD_TERMS, FIXED_HEADS, QUOTAS, round2, syncStudentFees } from '../utils/finance.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/query.js';
import { authRequired, adminOnly, studentOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

function pickHead(value) {
  const head = String(value || '').trim().toLowerCase();
  if (!FIXED_HEADS.includes(head)) throw new HttpError(400, 'Fee head must be tuition or hostel');
  return head;
}

function pickTerm(head, value) {
  const term = Number(value);
  if (!Number.isInteger(term) || term < 1 || term > HEAD_TERMS[head]) {
    throw new HttpError(400, `Term must be between 1 and ${HEAD_TERMS[head]} for ${head} fee`);
  }
  return term;
}

function pickAmount(value, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, 'Amount is required');
    return undefined;
  }
  const amount = Number(value);
  if (Number.isNaN(amount) || amount < 0) throw new HttpError(400, 'Amount must be zero or more');
  return round2(amount);
}

// GET /api/fees/mine -> the student's own term-wise fixed fees
router.get(
  '/mine',
  studentOnly,
  asyncHandler(async (req, res) => {
    const rows = await TermFee.find({ student: req.user.sub }).sort({ head: 1, term: 1 });
    res.json({ data: rows.map((r) => termFeePayload(r)) });
  }),
);

// GET /api/fees/summary -> admin: billed totals per head and per term
router.get(
  '/summary',
  adminOnly,
  asyncHandler(async (req, res) => {
    const rows = await TermFee.aggregate([
      { $group: { _id: { head: '$head', term: '$term' }, students: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { '_id.head': 1, '_id.term': 1 } },
    ]);
    const studentCounts = await Promise.all([
      Student.countDocuments({}),
      Student.countDocuments({ quota: 'ACAT' }),
      Student.countDocuments({ quota: 'BCAT' }),
      Student.countDocuments({ quota: 'SPOT' }),
    ]);

    const data = rows.map((r) => ({
      head: r._id.head,
      term: r._id.term,
      students: r.students,
      amount: round2(r.amount),
    }));
    const byHead = {};
    for (const head of FIXED_HEADS) {
      const headRows = data.filter((r) => r.head === head);
      byHead[head] = {
        amount: round2(headRows.reduce((sum, r) => sum + r.amount, 0)),
        terms: headRows,
      };
    }

    res.json({
      data,
      byHead,
      students: {
        total: studentCounts[0],
        ACAT: studentCounts[1],
        BCAT: studentCounts[2],
        SPOT: studentCounts[3],
      },
    });
  }),
);

// GET /api/fees -> admin: list term fees (filter by head / term / quota / student text)
router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const head = String(req.query.head || '').trim().toLowerCase();
    const quota = String(req.query.quota || '').trim().toUpperCase();
    const term = req.query.term !== undefined && req.query.term !== '' ? Number(req.query.term) : null;
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100));

    const pipeline = [
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    ];
    const match = {};
    if (FIXED_HEADS.includes(head)) match.head = head;
    if (Number.isInteger(term)) match.term = term;
    if (QUOTAS.includes(quota)) match['student.quota'] = quota;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      match.$or = [{ 'student.rollNumber': rx }, { 'student.name': rx }];
    }
    if (Object.keys(match).length) pipeline.push({ $match: match });

    pipeline.push({
      $facet: {
        rows: [
          { $sort: { head: 1, term: 1, 'student.rollNumber': 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
        sum: [{ $group: { _id: null, amount: { $sum: '$amount' } } }],
      },
    });

    const [result] = await TermFee.aggregate(pipeline);
    res.json({
      data: (result?.rows || []).map((r) => termFeePayload(r)),
      total: result?.total?.[0]?.count || 0,
      sum: round2(result?.sum?.[0]?.amount || 0),
      page,
      limit,
    });
  }),
);

// POST /api/fees -> admin: set one student's fee for a single term
router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const studentId = String(req.body?.studentId || '').trim();
    if (!mongoose.isValidObjectId(studentId)) throw new HttpError(400, 'A valid student is required');
    const student = await Student.findById(studentId);
    if (!student) throw new HttpError(404, 'Student not found');

    const head = pickHead(req.body?.head);
    const term = pickTerm(head, req.body?.term);
    const amount = pickAmount(req.body?.amount);

    const fee = await TermFee.findOneAndUpdate(
      { student: student._id, head, term },
      { amount, note: String(req.body?.note || '').trim(), createdBy: req.user?.username || 'admin' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const totals = await syncStudentFees(student._id);

    res.status(201).json({ fee: termFeePayload(fee, student), totals });
  }),
);

// POST /api/fees/bulk -> admin: set the same term amount for many students
//   body: { head, term | terms[], amount, quota?, studentIds?, note? }
router.post(
  '/bulk',
  adminOnly,
  asyncHandler(async (req, res) => {
    const head = pickHead(req.body?.head);
    const rawTerms = Array.isArray(req.body?.terms)
      ? req.body.terms
      : req.body?.term !== undefined
        ? [req.body.term]
        : [];
    if (!rawTerms.length) throw new HttpError(400, 'Select at least one term');
    const terms = [...new Set(rawTerms.map((t) => pickTerm(head, t)))];

    const amount = pickAmount(req.body?.amount);
    const note = String(req.body?.note || '').trim();
    const quota = String(req.body?.quota || '').trim().toUpperCase();
    if (quota && !QUOTAS.includes(quota)) throw new HttpError(400, 'Quota must be ACAT, BCAT or SPOT');

    let ids = Array.isArray(req.body?.studentIds)
      ? req.body.studentIds.filter((id) => mongoose.isValidObjectId(id))
      : [];

    if (!ids.length) {
      const filter = { active: { $ne: false } };
      if (quota) filter.quota = quota;
      const all = await Student.find(filter).select('_id');
      ids = all.map((s) => s._id);
    }
    if (!ids.length) throw new HttpError(400, 'No students match that selection');

    let created = 0;
    let updated = 0;
    for (const id of ids) {
      for (const term of terms) {
        const existing = await TermFee.findOne({ student: id, head, term });
        if (existing) {
          existing.amount = amount;
          if (note) existing.note = note;
          existing.createdBy = req.user?.username || 'admin';
          await existing.save();
          updated += 1;
        } else {
          await TermFee.create({ student: id, head, term, amount, note, createdBy: req.user?.username || 'admin' });
          created += 1;
        }
      }
    }

    await Promise.all(ids.map((id) => syncStudentFees(id)));

    res.status(201).json({ created, updated, students: ids.length, terms, head, amount, quota: quota || null });
  }),
);

// PATCH /api/fees/:id -> admin: edit a term fee
router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const fee = await TermFee.findById(req.params.id);
    if (!fee) throw new HttpError(404, 'Term fee not found');

    const head = req.body?.head !== undefined ? pickHead(req.body.head) : fee.head;
    const term = req.body?.term !== undefined ? pickTerm(head, req.body.term) : fee.term;
    const amount = pickAmount(req.body?.amount, { required: false });

    fee.head = head;
    fee.term = term;
    if (amount !== undefined) fee.amount = amount;
    if (req.body?.note !== undefined) fee.note = String(req.body.note).trim();
    await fee.save();

    await syncStudentFees(fee.student);
    const student = await Student.findById(fee.student);
    res.json({ fee: termFeePayload(fee, student) });
  }),
);

// DELETE /api/fees/:id -> admin
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const fee = await TermFee.findById(req.params.id);
    if (!fee) throw new HttpError(404, 'Term fee not found');
    const studentId = fee.student;
    await fee.deleteOne();
    await syncStudentFees(studentId);
    res.json({ message: 'Term fee deleted' });
  }),
);

export default router;
