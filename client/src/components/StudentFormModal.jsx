import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field, Input, Modal, Select, useToast } from './ui.jsx';
import { CustomFieldInput } from '../pages/student/studentShared.jsx';

const EMPTY = {
  rollNumber: '',
  name: '',
  college: '',
  branch: '',
  year: '',
  section: '',
  email: '',
  phone: '',
  alternatePhone: '',
  parentPhone: '',
  address: '',
  village: '',
  mandal: '',
  district: '',
  state: '',
  pincode: '',
  fatherName: '',
  motherName: '',
  dob: '',
  gender: '',
  bloodGroup: '',
  hostel: false,
  emergencyContactName: '',
  emergencyContactPhone: '',
  loan: false,
  loanNote: '',
  quota: 'ACAT',
};

export default function StudentFormModal({ open, onClose, onSaved, student = null, customFields = [] }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [custom, setCustom] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustom({ ...(student?.customFields || {}) });
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
            alternatePhone: student.alternatePhone || '',
            parentPhone: student.parentPhone || '',
            address: student.address || '',
            village: student.village || '',
            mandal: student.mandal || '',
            district: student.district || '',
            state: student.state || '',
            pincode: student.pincode || '',
            fatherName: student.fatherName || '',
            motherName: student.motherName || '',
            dob: student.dob || '',
            gender: student.gender || '',
            bloodGroup: student.bloodGroup || '',
            hostel: student.hostel === true,
            emergencyContactName: student.emergencyContactName || '',
            emergencyContactPhone: student.emergencyContactPhone || '',
            loan: student.loan === true,
            loanNote: student.loanNote || '',
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
        customFields: custom,
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
          <Field label="Student Phone">
            <Input value={form.phone} onChange={set('phone')} placeholder="98xxxxxxx" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Parent Phone">
            <Input value={form.parentPhone} onChange={set('parentPhone')} placeholder="98xxxxxxx" />
          </Field>
          <Field label="Alternate Phone">
            <Input value={form.alternatePhone} onChange={set('alternatePhone')} placeholder="Second number" />
          </Field>
        </div>
        <Field label="Address">
          <Input
            value={form.address}
            onChange={set('address')}
            placeholder="House / street, village or town, district, state — PIN"
          />
        </Field>
        <div className="grid-3">
          <Field label="Village / street">
            <Input value={form.village} onChange={set('village')} />
          </Field>
          <Field label="Mandal">
            <Input value={form.mandal} onChange={set('mandal')} />
          </Field>
          <Field label="District">
            <Input value={form.district} onChange={set('district')} />
          </Field>
        </div>
        <div className="grid-3">
          <Field label="State">
            <Input value={form.state} onChange={set('state')} placeholder="Andhra Pradesh" />
          </Field>
          <Field label="PIN code">
            <Input value={form.pincode} onChange={set('pincode')} inputMode="numeric" placeholder="6 digits" />
          </Field>
          <div />
        </div>

        <h4 style={{ margin: '0.6rem 0 0.4rem' }}>Personal details</h4>
        <p className="muted small" style={{ marginTop: '-0.3rem', marginBottom: '0.5rem' }}>
          Students can also fill these in from their own login — updates appear here.
        </p>
        <div className="grid-2">
          <Field label="Father's name">
            <Input value={form.fatherName} onChange={set('fatherName')} placeholder="Father / guardian name" />
          </Field>
          <Field label="Mother's name">
            <Input value={form.motherName} onChange={set('motherName')} placeholder="Mother name" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Date of birth">
            <Input type="date" value={form.dob} onChange={set('dob')} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={set('gender')}>
              <option value="">Select…</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Blood group">
            <Select value={form.bloodGroup} onChange={set('bloodGroup')}>
              <option value="">Select…</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Staying">
            <Select
              value={form.hostel ? 'hostel' : 'day'}
              onChange={(e) => setForm((f) => ({ ...f, hostel: e.target.value === 'hostel' }))}
            >
              <option value="day">Day scholar</option>
              <option value="hostel">Hosteller</option>
            </Select>
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Emergency contact name">
            <Input
              value={form.emergencyContactName}
              onChange={set('emergencyContactName')}
              placeholder="Person to call in an emergency"
            />
          </Field>
          <Field label="Emergency contact phone">
            <Input
              value={form.emergencyContactPhone}
              onChange={set('emergencyContactPhone')}
              inputMode="tel"
              placeholder="98xxxxxxx"
            />
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
        <div className="grid-2">
          <Field label="Education loan" hint="When on, the fee is shown as fully settled — ₹0 due.">
            <label className="inline" style={{ gap: '0.5rem', cursor: 'pointer', paddingTop: '0.35rem' }}>
              <input
                type="checkbox"
                checked={form.loan}
                onChange={(e) => setForm((f) => ({ ...f, loan: e.target.checked }))}
              />
              <span>{form.loan ? 'Fee covered by loan (₹0 due)' : 'Not on loan'}</span>
            </label>
          </Field>
          {form.loan && (
            <Field label="Loan note (optional)" hint="Bank / sanction number.">
              <Input value={form.loanNote} onChange={set('loanNote')} placeholder="e.g. SBI sanction 12345" />
            </Field>
          )}
        </div>
        <p className="muted small" style={{ marginTop: '-0.4rem' }}>
          Fixed tuition & hostel fees are assigned term-wise from the “Fee Structure” page. The monthly mess
          fee is added from the “Mess Fees” page. Total fee = tuition + hostel + mess.
        </p>

        {customFields.length > 0 && (
          <>
            <h4 style={{ margin: '0.6rem 0 0.4rem' }}>Extra details</h4>
            <p className="muted small" style={{ marginTop: '-0.3rem', marginBottom: '0.5rem' }}>
              Fields you added on the “Extra fields” page. Students can also fill these in from their own login.
            </p>
            <div className="grid-2">
              {customFields.map((f) => (
                <Field key={f.key} label={f.label} required={f.required}>
                  <CustomFieldInput
                    field={f}
                    value={custom[f.key]}
                    onChange={(value) => setCustom((c) => ({ ...c, [f.key]: value }))}
                  />
                </Field>
              ))}
            </div>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
