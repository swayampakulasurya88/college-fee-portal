import { Router } from 'express';
import mongoose from 'mongoose';
import { CustomField } from '../models/CustomField.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { authRequired, adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

const INPUT_TYPES = ['text', 'number', 'select', 'date'];

const slug = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

export const customFieldPayload = (field) => {
  const raw = typeof field.toObject === 'function' ? field.toObject() : { ...field };
  return {
    id: String(raw._id || raw.id),
    key: raw.key,
    label: raw.label,
    inputType: raw.inputType || 'text',
    options: raw.options || [],
    required: raw.required === true,
    showInExport: raw.showInExport !== false,
    order: Number(raw.order || 0),
    active: raw.active !== false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const parseOptions = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).slice(0, 30);
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 30);
};

// The list is public to any logged-in user: students need it to render their forms.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeInactive = req.user?.role === 'admin' && String(req.query.all || '') === 'true';
    const match = includeInactive ? {} : { active: true };
    const fields = await CustomField.find(match).sort({ order: 1, label: 1 });
    res.json({ data: fields.map(customFieldPayload), total: fields.length });
  }),
);

router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const label = String(body.label || '').trim();
    if (!label) throw new HttpError(400, 'Field label is required');

    const inputType = INPUT_TYPES.includes(body.inputType) ? body.inputType : 'text';
    const options = inputType === 'select' ? parseOptions(body.options) : [];
    if (inputType === 'select' && options.length < 2) {
      throw new HttpError(400, 'A dropdown needs at least two options');
    }

    const key = slug(body.key || label) || 'field';
    if (await CustomField.exists({ key })) {
      throw new HttpError(409, `A field with key "${key}" already exists`);
    }

    const count = await CustomField.countDocuments();
    const field = await CustomField.create({
      key,
      label,
      inputType,
      options,
      required: body.required === true || body.required === 'true',
      showInExport: body.showInExport !== false && body.showInExport !== 'false',
      order: Number.isFinite(Number(body.order)) && body.order !== undefined ? Number(body.order) : count,
      active: true,
    });

    res.status(201).json({ field: customFieldPayload(field) });
  }),
);

router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const field = await CustomField.findById(req.params.id);
    if (!field) throw new HttpError(404, 'Field not found');

    const body = req.body || {};
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) throw new HttpError(400, 'Field label cannot be empty');
      field.label = label;
    }
    if (body.inputType !== undefined) {
      if (!INPUT_TYPES.includes(body.inputType)) throw new HttpError(400, 'Unknown field type');
      field.inputType = body.inputType;
    }
    if (body.options !== undefined) field.options = parseOptions(body.options);
    if (field.inputType === 'select' && field.options.length < 2) {
      throw new HttpError(400, 'A dropdown needs at least two options');
    }
    if (body.required !== undefined) field.required = body.required === true || body.required === 'true';
    if (body.showInExport !== undefined) {
      field.showInExport = body.showInExport !== false && body.showInExport !== 'false';
    }
    if (body.order !== undefined) field.order = Number(body.order) || 0;
    if (body.active !== undefined) field.active = body.active === true || body.active === 'true';

    await field.save();
    res.json({ field: customFieldPayload(field) });
  }),
);

// Hard delete: the definition (and its values on students) is removed for good.
router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const field = await CustomField.findById(req.params.id);
    if (!field) throw new HttpError(404, 'Field not found');
    const label = field.label;

    await field.deleteOne();
    // Clear the stored value from every student so nothing is shown any more.
    await mongoose.connection
      .collection('students')
      .updateMany({}, { $unset: { [`customFields.${field.key}`]: '' } });

    res.json({ message: `Removed the "${label}" field from all students` });
  }),
);

export default router;
