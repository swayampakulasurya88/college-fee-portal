import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  useToast,
} from '../../components/ui.jsx';
import { clearCustomFieldsCache } from '../student/studentShared.jsx';

const INPUT_TYPES = [
  ['text', 'Text'],
  ['number', 'Number'],
  ['select', 'Dropdown'],
  ['date', 'Date'],
];

const EMPTY = { label: '', key: '', inputType: 'text', options: '', required: false, showInExport: true };

export default function AdminExtraFields() {
  const toast = useToast();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // field id when editing
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/custom-fields?all=true');
      setFields(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  };

  const openEdit = (f) => {
    setEditing(f.id);
    setForm({
      label: f.label,
      key: f.key,
      inputType: f.inputType,
      options: (f.options || []).join(', '),
      required: f.required,
      showInExport: f.showInExport,
      active: f.active,
    });
    setFormOpen(true);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) return toast.error('Enter a field label, e.g. “Number of backlogs”.');
    setBusy(true);
    try {
      const body = {
        label: form.label.trim(),
        key: form.key.trim() || undefined,
        inputType: form.inputType,
        options: form.options,
        required: form.required,
        showInExport: form.showInExport,
      };
      if (editing) {
        if (form.active !== undefined) body.active = form.active;
        await api(`/custom-fields/${editing}`, { method: 'PATCH', body });
        toast.success(`“${body.label}” updated.`);
      } else {
        await api('/custom-fields', { method: 'POST', body });
        toast.success(`“${body.label}” added to every student page.`);
      }
      clearCustomFieldsCache();
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (f) => {
    try {
      await api(`/custom-fields/${f.id}`, { method: 'PATCH', body: { active: !f.active } });
      clearCustomFieldsCache();
      toast.success(f.active ? `“${f.label}” hidden from students.` : `“${f.label}” is now visible.`);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/custom-fields/${toDelete.id}`, { method: 'DELETE' });
      clearCustomFieldsCache();
      toast.success(`“${toDelete.label}” removed from all students.`);
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Extra fields</h1>
          <p className="muted">
            Add custom details like “Number of backlogs”, “Hostel room” or “Aadhaar last 4”. Once added, the
            field appears on every student's page (admin and student login) and in exports.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>
            + Add field
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading fields…" />
      ) : fields.length === 0 ? (
        <EmptyState
          icon="🧩"
          title="No extra fields yet"
          hint="Add a field to collect the same extra detail from every student."
          action={
            <button className="btn btn-primary" onClick={openCreate}>
              + Add your first field
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Options</th>
                <th>Required</th>
                <th>In export</th>
                <th>Visible</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{f.label}</div>
                    <div className="muted small">{f.key}</div>
                  </td>
                  <td>
                    <span className="chip">{INPUT_TYPES.find(([v]) => v === f.inputType)?.[1] || f.inputType}</span>
                  </td>
                  <td className="small">{f.inputType === 'select' ? (f.options || []).join(', ') : '—'}</td>
                  <td>{f.required ? 'Yes' : '—'}</td>
                  <td>{f.showInExport ? 'Yes' : '—'}</td>
                  <td>
                    <span className={`chip ${f.active ? 'chip-emerald' : ''}`}>{f.active ? 'Visible' : 'Hidden'}</span>
                  </td>
                  <td className="right">
                    <div className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(f)}>
                        Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(f)}>
                        {f.active ? 'Hide' : 'Show'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setToDelete(f)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit extra field' : 'Add an extra field'}
        subtitle="Shown on every student page and in the admin portal."
        size="md"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add field'}
            </button>
          </>
        }
      >
        <form onSubmit={submit}>
          <Field label="Label" required hint="What the student sees, e.g. “Number of backlogs”.">
            <Input value={form.label} onChange={set('label')} placeholder="Number of backlogs" />
          </Field>
          <div className="grid-2">
            <Field label="Input type">
              <Select value={form.inputType} onChange={set('inputType')}>
                {INPUT_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Key (optional)" hint="Auto-created from the label. Cannot be changed later.">
              <Input
                value={form.key}
                onChange={set('key')}
                placeholder="backlogs"
                disabled={Boolean(editing)}
              />
            </Field>
          </div>
          {form.inputType === 'select' && (
            <Field label="Dropdown options" required hint="Comma-separated, e.g. None, 1, 2, 3+.">
              <Input value={form.options} onChange={set('options')} placeholder="None, 1, 2, 3+" />
            </Field>
          )}
          <div className="grid-2">
            <Field label="Students must fill this in">
              <label className="inline" style={{ gap: '0.5rem', cursor: 'pointer', paddingTop: '0.35rem' }}>
                <input
                  type="checkbox"
                  checked={form.required}
                  onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
                />
                <span>{form.required ? 'Required' : 'Optional'}</span>
              </label>
            </Field>
            <Field label="Include in Excel / PDF exports">
              <label className="inline" style={{ gap: '0.5rem', cursor: 'pointer', paddingTop: '0.35rem' }}>
                <input
                  type="checkbox"
                  checked={form.showInExport}
                  onChange={(e) => setForm((f) => ({ ...f, showInExport: e.target.checked }))}
                />
                <span>{form.showInExport ? 'Included' : 'Excluded'}</span>
              </label>
            </Field>
          </div>
          <button type="submit" hidden />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete “${toDelete?.label || 'field'}”?`}
        message="This removes the field from every student's record and from all pages. This cannot be undone."
        confirmLabel="Delete field"
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
        busy={busy}
      />
    </>
  );
}
