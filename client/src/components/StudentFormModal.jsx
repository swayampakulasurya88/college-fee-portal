import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field, Input, Modal, Select, useToast } from './ui.jsx';

const EMPTY = {
  rollNumber: '',
  name: '',
  college: '',
  branch: '',
  year: '',
  section: '',
  email: '',
  phone: '',
  quota: 'ACAT',
};

export default function StudentFormModal({ open, onClose, onSaved, student = null }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      student
        ? {
            rollNumber: student.rollNumber || '',
            name: student.name || '',
            college: student.college || '',
            branch: student.branch || '',
            year: student.year || '',
            section: student.section || '',
            email: student.email || '',
            phone: student.phone || '',
            quota: student.quota || 'ACAT',
          }
        : EMPTY,
    );
  }, [open, student]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        rollNumber: form.rollNumber.trim().toUpperCase(),
      };
      const res = student
        ? await api(`/students/${student.id}`, { method: 'PATCH', body: payload })
        : await api('/students', { method: 'POST', body: payload });
      toast.success(student ? 'Student updated.' : `Student ${res.student.rollNumber} added.`);
      onSaved?.(res.student);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? `Edit ${student.rollNumber}` : 'Add a student'}
      subtitle={student ? 'Update student details and quota.' : 'Create a new student account with a roll number.'}
      size="md"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : student ? 'Save changes' : 'Add student'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <div className="grid-2">
          <Field label="Roll Number" required hint="Students log in with this.">
            <Input value={form.rollNumber} onChange={set('rollNumber')} placeholder="CSE001" />
          </Field>
          <Field label="Full Name" required>
            <Input value={form.name} onChange={set('name')} placeholder="Student name" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="College" hint="e.g. KIET or KIEK.">
            <Input value={form.college} onChange={set('college')} placeholder="KIET" />
          </Field>
          <Field label="Branch">
            <Input value={form.branch} onChange={set('branch')} placeholder="CSE" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Year">
            <Input value={form.year} onChange={set('year')} placeholder="2" />
          </Field>
          <Field label="Section">
            <Input value={form.section} onChange={set('section')} placeholder="A" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="name@college.edu" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} placeholder="98xxxxxxx" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Quota" required hint="Sets the term-wise tuition rate (ACAT ₹18,750 · BCAT/Spot ₹31,250 per term).">
            <Select value={form.quota} onChange={set('quota')}>
              <option value="ACAT">ACAT — came through rank</option>
              <option value="BCAT">BCAT — management quota</option>
              <option value="SPOT">SPOT — spot admission</option>
            </Select>
          </Field>
        </div>
        <p className="muted small" style={{ marginTop: '-0.4rem' }}>
          Fixed tuition & hostel fees are assigned term-wise from the “Fee Structure” page. The monthly mess
          fee is added from the “Mess Fees” page. Total fee = tuition + hostel + mess.
        </p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
