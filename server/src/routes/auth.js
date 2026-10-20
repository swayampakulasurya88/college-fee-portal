import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Student } from '../models/Student.js';
import { financeForStudent } from '../utils/finance.js';
import { studentPayload } from '../utils/serialize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authRequired } from '../middleware/auth.js';
import { ensureTodayBackup } from '../utils/backup.js';

const router = Router();

const sign = (payload) => jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpires });

// ---- Student login: roll number only ----
router.post(
  '/student-login',
  asyncHandler(async (req, res) => {
    const rollNumber = String(req.body?.rollNumber || '').trim().toUpperCase();
    if (!rollNumber) {
      return res.status(400).json({ message: 'Roll number is required' });
    }

    const student = await Student.findOne({ rollNumber });
    if (!student || student.active === false) {
      return res
        .status(401)
        .json({ message: 'No active student found for this roll number' });
    }

    const finance = await financeForStudent(student);
    const token = sign({
      role: 'student',
      sub: String(student._id),
      rollNumber: student.rollNumber,
    });

    return res.json({
      token,
      role: 'student',
      user: studentPayload(student, finance),
    });
  }),
);

// ---- Admin login: username + password from env ----
router.post('/admin-login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (username !== config.adminUsername || password !== config.adminPassword) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  const token = sign({ role: 'admin', sub: 'admin', username });
  // Side effect: make sure today's data snapshot exists (never blocks login).
  ensureTodayBackup('admin-login').catch(() => {});
  return res.json({
    token,
    role: 'admin',
    user: { id: 'admin', name: 'Administrator', username },
  });
});

// ---- Returns the currently logged-in identity ----
router.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      return res.json({
        role: 'admin',
        user: { id: 'admin', name: 'Administrator', username: req.user.username || 'admin' },
      });
    }

    const student = await Student.findById(req.user.sub);
    if (!student || student.active === false) {
      return res.status(401).json({ message: 'Student account not found' });
    }

    const finance = await financeForStudent(student);
    return res.json({ role: 'student', user: studentPayload(student, finance) });
  }),
);

export default router;
