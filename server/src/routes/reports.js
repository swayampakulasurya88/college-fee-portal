import { Router } from 'express';
import { Student } from '../models/Student.js';
import { Payment } from '../models/Payment.js';
import { Message } from '../models/Message.js';
import { MessBill } from '../models/MessBill.js';
import { round2, financeForStudent } from '../utils/finance.js';
import { paymentPayload, studentPayload, messBillPayload } from '../utils/serialize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseDate } from '../utils/query.js';
import { authRequired, adminOnly, studentOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// Sums one payment category (used to see what loan students already paid).
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

// Adds totalPaid / totalFee (incl. monthly mess) / totalDue to every student row.
// Loan students are treated as fully settled — the loan covers the balance.
const PER_STUDENT_PIPELINE = [
  { $lookup: { from: 'payments', localField: '_id', foreignField: 'student', as: 'pays' } },
  { $lookup: { from: 'messbills', localField: '_id', foreignField: 'student', as: 'mess' } },
  {
    $addFields: {
      realPaid: { $sum: '$pays.amount' },
      tuitionRealPaid: sumCategory('tuition'),
      hostelRealPaid: sumCategory('hostel'),
      messRealPaid: sumCategory('mess'),
      messFee: { $sum: '$mess.amount' },
      isLoan: { $eq: [{ $ifNull: ['$loan', false] }, true] },
      totalFee: {
        $add: [
          { $ifNull: ['$tuitionFee', 0] },
          { $ifNull: ['$hostelFee', 0] },
          { $sum: '$mess.amount' },
        ],
      },
    },
  },
  { $addFields: { totalPaid: { $cond: ['$isLoan', '$totalFee', '$realPaid'] } } },
  { $addFields: { totalDue: { $subtract: ['$totalFee', '$totalPaid'] } } },
];

// Day-by-day + category breakdown for the admin dashboard.
router.get(
  '/summary',
  adminOnly,
  asyncHandler(async (req, res) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [fixedRows, messRows, payRows, countRows, todayRows, byCategory, defaulters, messages, loanRows] =
      await Promise.all([
      Student.aggregate([
        {
          $group: {
            _id: null,
            tuitionTotal: { $sum: { $ifNull: ['$tuitionFee', 0] } },
            hostelTotal: { $sum: { $ifNull: ['$hostelFee', 0] } },
            studentCount: { $sum: 1 },
          },
        },
      ]),
      MessBill.aggregate([
        { $group: { _id: null, messTotal: { $sum: '$amount' }, billCount: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $group: { _id: null, totalPaid: { $sum: '$amount' }, paymentCount: { $sum: 1 } } },
      ]),
      Student.aggregate([
        ...PER_STUDENT_PIPELINE,
        {
          $group: {
            _id: null,
            paid: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$totalPaid', 0] }, { $lte: ['$totalDue', 0.001] }] },
                  1,
                  0,
                ],
              },
            },
            unpaid: { $sum: { $cond: [{ $lte: ['$totalPaid', 0] }, 1, 0] } },
            partial: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$totalPaid', 0] }, { $gt: ['$totalDue', 0.001] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { paidOn: { $gte: todayStart } } },
        { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $group: { _id: { $ifNull: ['$category', 'tuition'] }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Student.aggregate([
        ...PER_STUDENT_PIPELINE,
        { $match: { totalDue: { $gt: 0.001 } } },
        { $sort: { totalDue: -1 } },
        { $limit: 10 },
        { $project: { pays: 0, mess: 0 } },
      ]),
      Message.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Student.aggregate([
        ...PER_STUDENT_PIPELINE,
        { $match: { isLoan: true } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: { $subtract: ['$totalFee', '$realPaid'] } },
            tuition: {
              $sum: { $max: [{ $subtract: [{ $ifNull: ['$tuitionFee', 0] }, '$tuitionRealPaid'] }, 0] },
            },
            hostel: {
              $sum: { $max: [{ $subtract: [{ $ifNull: ['$hostelFee', 0] }, '$hostelRealPaid'] }, 0] },
            },
            mess: { $sum: { $max: [{ $subtract: ['$messFee', '$messRealPaid'] }, 0] } },
          },
        },
      ]),
    ]);

    const fixed = fixedRows?.[0] || {};
    const mess = messRows?.[0] || {};
    const payments = payRows?.[0] || {};
    const counts = countRows?.[0] || {};
    const today = todayRows?.[0] || {};

    const tuitionFee = round2(fixed.tuitionTotal || 0);
    const hostelFee = round2(fixed.hostelTotal || 0);
    const messFee = round2(mess.messTotal || 0);
    const grandTotal = round2(tuitionFee + hostelFee + messFee);
    const totalPaid = round2(payments.totalPaid || 0);

    // How much of the billed fees education loans have already covered.
    const loanRow = loanRows?.[0] || {};
    const loanCovered = round2(loanRow.total || 0);
    const loanByCategory = {
      tuition: round2(loanRow.tuition || 0),
      hostel: round2(loanRow.hostel || 0),
      mess: round2(loanRow.mess || 0),
    };

    const paidByCategory = { tuition: 0, hostel: 0, mess: 0 };
    (byCategory || []).forEach((row) => {
      if (paidByCategory[row._id] !== undefined) paidByCategory[row._id] = round2(row.amount);
    });

    const messageCounts = { unread: 0, read: 0, resolved: 0 };
    (messages || []).forEach((m) => {
      if (messageCounts[m._id] !== undefined) messageCounts[m._id] = m.count;
    });

    const categoryTotals = (fee, paid, covered = 0) => ({
      fee,
      paid,
      loanCovered: covered,
      due: round2(Math.max(fee - paid - covered, 0)),
    });

    res.json({
      grandTotal,
      totalPaid,
      loanCovered,
      loanCount: loanRow.count || 0,
      totalDue: round2(grandTotal - totalPaid - loanCovered),
      tuitionFee,
      hostelFee,
      messFee,
      categories: {
        tuition: categoryTotals(tuitionFee, paidByCategory.tuition, loanByCategory.tuition),
        hostel: categoryTotals(hostelFee, paidByCategory.hostel, loanByCategory.hostel),
        mess: categoryTotals(messFee, paidByCategory.mess, loanByCategory.mess),
      },
      studentCount: fixed.studentCount || 0,
      paymentCount: payRows?.[0]?.paymentCount || 0,
      messBillCount: mess.billCount || 0,
      paidCount: counts.paid || 0,
      partialCount: counts.partial || 0,
      unpaidCount: counts.unpaid || 0,
      collectedToday: round2(today.amount || 0),
      collectedTodayCount: today.count || 0,
      messages: messageCounts,
      defaulters: defaulters.map((d) => ({
        id: String(d._id),
        rollNumber: d.rollNumber,
        name: d.name,
        totalFee: round2(d.totalFee),
        totalPaid: round2(d.totalPaid),
        totalDue: round2(d.totalDue),
      })),
    });
  }),
);

// Day-by-day collection between two dates (defaults to the last 30 days).
router.get(
  '/daily',
  adminOnly,
  asyncHandler(async (req, res) => {
    const to = parseDate(req.query.to, new Date());
    to.setHours(23, 59, 59, 999);
    const from = parseDate(req.query.from, new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000));
    from.setHours(0, 0, 0, 0);

    const rows = await Payment.aggregate([
      { $match: { paidOn: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$paidOn' } },
            category: { $ifNull: ['$category', 'tuition'] },
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': -1 } },
    ]);

    const byDate = new Map();
    for (const r of rows) {
      const entry = byDate.get(r._id.date) || { date: r._id.date, amount: 0, count: 0, tuition: 0, hostel: 0, mess: 0 };
      entry.amount = round2(entry.amount + r.amount);
      entry.count += r.count;
      if (entry[r._id.category] !== undefined) entry[r._id.category] = round2(entry[r._id.category] + r.amount);
      byDate.set(r._id.date, entry);
    }
    const data = [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));

    res.json({
      from,
      to,
      data,
      total: round2(data.reduce((sum, r) => sum + r.amount, 0)),
    });
  }),
);

// Student's own fee report (fixed fees + monthly mess + payments).
router.get(
  '/student/me',
  studentOnly,
  asyncHandler(async (req, res) => {
    const student = await Student.findById(req.user.sub);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const [finance, payments, messBills] = await Promise.all([
      financeForStudent(student),
      Payment.find({ student: student._id }).sort({ paidOn: -1, createdAt: -1 }),
      MessBill.find({ student: student._id }).sort({ month: -1 }),
    ]);
    res.json({
      student: studentPayload(student, finance),
      payments: payments.map((p) => paymentPayload(p, student)),
      messBills: messBills.map((b) => messBillPayload(b, student)),
    });
  }),
);

export default router;
