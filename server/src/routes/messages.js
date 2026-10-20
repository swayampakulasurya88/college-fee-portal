import { Router } from 'express';
import { Message } from '../models/Message.js';
import { Student } from '../models/Student.js';
import { messagePayload } from '../utils/serialize.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { archiveDeleted } from '../utils/trash.js';
import { escapeRegex } from '../utils/query.js';
import { authRequired, adminOnly, studentOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const STATUSES = ['unread', 'read', 'resolved'];

// ---------- Student side ----------

// Send a message / update request to the admin.
router.post(
  '/',
  studentOnly,
  asyncHandler(async (req, res) => {
    const body = String(req.body?.body || '').trim();
    const subject = String(req.body?.subject || '').trim();
    if (body.length < 2) throw new HttpError(400, 'Please write a message');

    const student = await Student.findById(req.user.sub);
    if (!student) throw new HttpError(404, 'Student not found');

    const message = await Message.create({
      student: student._id,
      rollNumber: student.rollNumber,
      subject,
      body,
      direction: 'student-to-admin',
      status: 'unread',
    });

    res.status(201).json({
      message: messagePayload({ ...message.toObject(), student }),
    });
  }),
);

// The student's own messages and any admin replies.
router.get(
  '/mine',
  studentOnly,
  asyncHandler(async (req, res) => {
    const messages = await Message.find({ student: req.user.sub }).sort({ createdAt: -1 });
    res.json({ data: messages.map((m) => messagePayload(m)) });
  }),
);

// ---------- Admin side ----------

router.get(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const match = {};
    if (status && STATUSES.includes(status)) match.status = status;

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    ];
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      pipeline.push({
        $match: {
          $or: [{ 'student.rollNumber': rx }, { 'student.name': rx }, { subject: rx }, { body: rx }],
        },
      });
    }
    pipeline.push({
      $facet: {
        rows: [
          { $sort: { status: 1, createdAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
        counts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
      },
    });

    const [result] = await Message.aggregate(pipeline);
    const counts = { unread: 0, read: 0, resolved: 0 };
    (result?.counts || []).forEach((c) => {
      if (counts[c._id] !== undefined) counts[c._id] = c.count;
    });

    res.json({
      data: (result?.rows || []).map((m) => messagePayload(m)),
      total: result?.total?.[0]?.count || 0,
      counts,
      page,
      limit,
    });
  }),
);

router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const status = String(req.body?.status || '').trim();
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status');

    const message = await Message.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!message) throw new HttpError(404, 'Message not found');

    const student = await Student.findById(message.student);
    res.json({ message: messagePayload({ ...message.toObject(), student }) });
  }),
);

router.post(
  '/:id/reply',
  adminOnly,
  asyncHandler(async (req, res) => {
    const reply = String(req.body?.reply || '').trim();
    if (!reply) throw new HttpError(400, 'Reply cannot be empty');

    const message = await Message.findById(req.params.id);
    if (!message) throw new HttpError(404, 'Message not found');

    message.reply = reply;
    message.repliedAt = new Date();
    message.status = 'resolved';
    await message.save();

    const student = await Student.findById(message.student);
    res.json({ message: messagePayload({ ...message.toObject(), student }) });
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);
    if (!message) throw new HttpError(404, 'Message not found');

    const student = await Student.findById(message.student);
    await archiveDeleted({
      entity: 'message',
      label: student ? `${student.name} (${student.rollNumber})` : 'Message',
      studentRoll: student?.rollNumber || '',
      studentName: student?.name || '',
      reference: message.subject || '',
      summary: message.subject || 'Message',
      counts: { messages: 1 },
      items: [{ collection: Message.collection.name, doc: message.toObject() }],
      deletedBy: req.user?.username || 'admin',
    });

    await message.deleteOne();
    res.json({ message: 'Message deleted — recoverable from the Deleted page' });
  }),
);

export default router;
