import { Router } from 'express';
import { Backup } from '../models/Backup.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { backupPayload, createBackup, ensureTodayBackup } from '../utils/backup.js';

const router = Router();
router.use(authRequired, adminOnly);

// GET /api/backups -> list every daily snapshot (metadata only, no payload)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Lazy guarantee: make sure today's snapshot exists when the admin looks.
    await ensureTodayBackup('on-request');

    const rows = await Backup.find({}).sort({ date: -1 }).limit(400).lean();
    res.json({ data: rows.map(backupPayload), total: rows.length });
  }),
);

// POST /api/backups/run -> create today's snapshot now (force = overwrite)
router.post(
  '/run',
  asyncHandler(async (req, res) => {
    const force = req.body?.force === true || req.body?.force === 'true';
    const out = await createBackup({ trigger: 'manual', force });
    res.status(out.created ? 201 : 200).json({
      message: out.created
        ? `Backup created for ${out.date}`
        : `A backup for ${out.date} already exists — use force to redo it`,
      ...out,
    });
  }),
);

// GET /api/backups/:date -> download the gzipped JSON snapshot
router.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const date = String(req.params.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpError(400, 'Backup date must be YYYY-MM-DD');
    }

    const doc = await Backup.findOne({ date }).select('+data');
    if (!doc || !doc.data?.length) throw new HttpError(404, `No backup for ${date}`);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="kiet-fee-backup-${date}.json.gz"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(doc.data);
  }),
);

export default router;
