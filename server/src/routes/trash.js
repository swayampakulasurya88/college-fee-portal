import { Router } from 'express';
import { Trash } from '../models/Trash.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/query.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { ENTITY_LABEL, restoreTrashEntry, trashPayload } from '../utils/trash.js';

const router = Router();
router.use(authRequired, adminOnly);

// GET /api/trash -> everything that was deleted, in one list
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const entity = String(req.query.entity || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const match = {};
    if (entity && ENTITY_LABEL[entity]) match.entity = entity;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      match.$or = [
        { label: rx },
        { studentRoll: rx },
        { studentName: rx },
        { reference: rx },
        { summary: rx },
      ];
    }

    const [rows, total] = await Promise.all([
      Trash.find(match)
        .sort({ deletedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Trash.countDocuments(match),
    ]);

    res.json({ data: rows.map(trashPayload), total, page, limit });
  }),
);

// POST /api/trash/:id/restore -> put the record (and everything with it) back
router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const entry = await Trash.findById(req.params.id);
    if (!entry) throw new HttpError(404, 'Deleted item not found');

    const { restored, skipped } = await restoreTrashEntry(entry);
    const label = entry.label || ENTITY_LABEL[entry.entity] || 'record';
    await entry.deleteOne();

    res.json({
      message: `Restored ${restored} record(s) for ${label}${skipped.length ? ` · ${skipped.length} already existed` : ''}`,
      restored,
      skipped,
    });
  }),
);

// DELETE /api/trash/:id -> forget the deleted record permanently
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const entry = await Trash.findById(req.params.id);
    if (!entry) throw new HttpError(404, 'Deleted item not found');

    const label = entry.label || ENTITY_LABEL[entry.entity] || 'record';
    const count = entry.recordCount || entry.items?.length || 1;
    await entry.deleteOne();

    res.json({ message: `Permanently deleted ${label} (${count} record(s))` });
  }),
);

export default router;
