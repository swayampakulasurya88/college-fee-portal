import { Router } from 'express';
import mongoose from 'mongoose';
import { DuplicateAttempt } from '../models/DuplicateAttempt.js';
import { Payment } from '../models/Payment.js';
import { Student } from '../models/Student.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/query.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const studentShape = (s) => ({
  rollNumber: s?.rollNumber || '',
  name: s?.name || '',
  phone: s?.phone || '',
  branch: s?.branch || '',
  year: s?.year || '',
  section: s?.section || '',
});

const kindLabel = (kind) => (kind === 'receiptNo' ? 'Receipt No.' : 'Transaction / UTR ID');

// GET /api/duplicates
// Groups every reused receipt reference (a UTR id or a receipt number) together
// with the students involved: those who already own the reference and those who
// were blocked from reusing it.
router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    // 1) Every reference a student/admin was blocked from reusing.
    const attemptGroups = await DuplicateAttempt.aggregate([
      {
        $group: {
          _id: { kind: '$kind', reference: '$reference' },
          attemptCount: { $sum: 1 },
          firstAt: { $min: '$createdAt' },
          lastAt: { $max: '$createdAt' },
        },
      },
    ]);

    // 2) Any genuine duplicates already stored (e.g. recorded before the rule).
    const paymentGroups = [];
    for (const [field, kind] of [
      ['transactionId', 'transactionId'],
      ['receiptNo', 'receiptNo'],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await Payment.aggregate([
        { $match: { [field]: { $gt: '' } } },
        { $group: { _id: `$${field}`, paidCount: { $sum: 1 }, lastAt: { $max: '$paidOn' } } },
        { $match: { paidCount: { $gt: 1 } } },
      ]);
      rows.forEach((r) =>
        paymentGroups.push({ kind, reference: r._id, paidCount: r.paidCount, lastAt: r.lastAt, attemptCount: 0 }),
      );
    }

    // Merge both sources into one list of groups.
    const merged = new Map();
    const add = (kind, reference, patch) => {
      const key = `${kind}::${reference}`;
      const cur = merged.get(key) || { kind, reference, attemptCount: 0, paidCount: 0, firstAt: null, lastAt: null };
      Object.assign(cur, patch);
      if (patch.lastAt && (!cur.lastAt || new Date(patch.lastAt) > new Date(cur.lastAt))) cur.lastAt = patch.lastAt;
      merged.set(key, cur);
    };
    attemptGroups.forEach((g) =>
      add(g._id.kind, g._id.reference, { attemptCount: g.attemptCount, firstAt: g.firstAt, lastAt: g.lastAt }),
    );
    paymentGroups.forEach((g) => add(g.kind, g.reference, { paidCount: g.paidCount, lastAt: g.lastAt }));

    let list = [...merged.values()];
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      list = list.filter((g) => rx.test(g.reference));
    }
    list.sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));

    const total = list.length;
    const slice = list.slice((page - 1) * limit, page * limit);

    // Load everything for this page of groups in a couple of queries.
    const refs = slice.map((g) => g.reference);
    const [attempts, payments] = await Promise.all([
      refs.length
        ? DuplicateAttempt.find({ reference: { $in: refs } }).sort({ createdAt: -1 }).lean()
        : [],
      refs.length
        ? Payment.find({ $or: [{ transactionId: { $in: refs } }, { receiptNo: { $in: refs } }] }).lean()
        : [],
    ]);

    const ids = new Set();
    attempts.forEach((a) => {
      if (a.student) ids.add(String(a.student));
      if (a.conflictingStudent) ids.add(String(a.conflictingStudent));
    });
    payments.forEach((p) => p.student && ids.add(String(p.student)));
    const students = ids.size
      ? await Student.find({ _id: { $in: [...ids] } }).select('rollNumber name phone branch year section').lean()
      : [];
    const smap = new Map(students.map((s) => [String(s._id), s]));

    const data = slice.map((g) => {
      const gPayments = payments.filter((p) =>
        g.kind === 'receiptNo' ? p.receiptNo === g.reference : p.transactionId === g.reference,
      );
      const gAttempts = attempts.filter((a) => a.kind === g.kind && a.reference === g.reference);

      // The students whose recorded payment owns this reference.
      const paidRows = gPayments.map((p) => {
        const s = smap.get(String(p.student));
        return {
          source: 'paid',
          studentId: p.student ? String(p.student) : '',
          ...studentShape(s),
          amount: Number(p.amount || 0),
          category: p.category || '',
          term: p.term ?? null,
          method: p.method || '',
          paidOn: p.paidOn,
          reference: g.reference,
          kind: g.kind,
          kindLabel: kindLabel(g.kind),
          receiptNo: p.receiptNo || '',
          transactionId: p.transactionId || '',
          submittedBy: p.submittedBy || p.createdBy || 'admin',
          conflicting: '',
          recordedAt: p.createdAt,
          paymentId: String(p._id),
        };
      });

      // The students who tried to reuse it.
      const attemptRows = gAttempts.map((a) => {
        const s = smap.get(String(a.student));
        const c = smap.get(String(a.conflictingStudent));
        const conflictingRoll = c?.rollNumber || a.conflictingRollNumber || '';
        const conflictingName = c?.name || a.conflictingStudentName || '';
        return {
          source: 'attempted',
          studentId: a.student ? String(a.student) : '',
          rollNumber: s?.rollNumber || a.rollNumber || '',
          name: s?.name || a.studentName || '',
          phone: s?.phone || a.phone || '',
          branch: s?.branch || a.branch || '',
          year: s?.year || a.year || '',
          section: s?.section || a.section || '',
          amount: Number(a.amount || 0),
          category: a.category || '',
          term: a.term ?? null,
          method: a.method || '',
          paidOn: a.paidOn,
          reference: a.reference,
          kind: a.kind,
          kindLabel: kindLabel(a.kind),
          receiptNo: a.kind === 'receiptNo' ? a.reference : '',
          transactionId: a.kind === 'transactionId' ? a.reference : '',
          submittedBy: a.submittedBy || 'admin',
          attemptedBy: a.attemptedBy || '',
          conflicting: conflictingRoll ? `${conflictingRoll} · ${conflictingName}`.trim() : '',
          conflictingRollNumber: conflictingRoll,
          conflictingStudentName: conflictingName,
          recordedAt: a.createdAt,
          attemptId: String(a._id),
          status: a.status || 'new',
        };
      });

      const involved = [...paidRows, ...attemptRows];

      return {
        id: `${g.kind}::${g.reference}`,
        kind: g.kind,
        kindLabel: kindLabel(g.kind),
        reference: g.reference,
        attemptCount: gAttempts.length,
        paidCount: gPayments.length,
        studentCount: involved.length,
        lastAt: g.lastAt,
        students: involved,
      };
    });

    res.json({
      data,
      total,
      page,
      limit,
      totals: {
        groups: total,
        attempts: list.reduce((n, g) => n + (g.attemptCount || 0), 0),
        students: (await DuplicateAttempt.distinct('student')).filter(Boolean).length,
      },
    });
  }),
);

// DELETE /api/duplicates?kind=&reference= -> clear every blocked attempt for one reference
router.delete(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const kind = String(req.query.kind || '').trim();
    const reference = String(req.query.reference || '').trim();
    if (!kind || !reference) throw new HttpError(400, 'kind and reference are required');

    const out = await DuplicateAttempt.deleteMany({ kind, reference });
    res.json({ message: `Cleared ${out.deletedCount} duplicate record(s)` });
  }),
);

// DELETE /api/duplicates/:id -> remove one blocked attempt
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
    const doc = await DuplicateAttempt.findByIdAndDelete(req.params.id);
    if (!doc) throw new HttpError(404, 'Record not found');
    res.json({ message: 'Duplicate record removed' });
  }),
);

export default router;
