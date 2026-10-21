import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Field, Input, Modal, Select, TextArea, useToast } from './ui.jsx';
import { CustomFieldInput } from '../pages/student/studentShared.jsx';

// Fields a student may edit on their own record. Academic fields (name, branch,
// year, quota) and all fee fields stay admin-only.
const EMPTY = {
  email: '',
  phone: '',
  alternatePhone: '',
  parentPhone: '',
  fatherName: '',
  motherName: '',
  dob: '',
  gender: '',
  bloodGroup: '',
  hostel: false,
  address: '',
  village: '',
  mandal: '',
  district: '',
  state: '',
  pincode: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

export default function StudentProfileModal({ open, onClose, student, customFields = [], onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [custom, setCustom] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    setForm({
      email: student.email || '',
      phone: student.phone || '',
      alternatePhone: student.alternatePhone || '',
      parentPhone: student.parentPhone || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      dob: student.dob || '',
      gender: student.gender || '',
      bloodGroup: student.bloodGroup || '',
      hostel: student.hostel === true,
      address: student.address || '',
      village: student.village || '',
      mandal: student.mandal || '',
      district: student.district || '',
      state: student.state || '',
      pincode: student.pincode || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
    });
    setCustom({ ...(student.customFields || {}) });
  }, [open, student]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setCustomValue = (key, value) => setCustom((c) => ({ ...c, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api('/students/me', { method: 'PATCH', body: { ...form, customFields: custom } });
      toast.success('Your details were saved.');
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
      size="lg"
      title="My details"
      subtitle="Fill in your personal information — the college office can see it from the admin portal."
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save details'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        <div className="grid-2">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="name@college.edu" />
          </Field>
          <Field label="Student phone">
            <Input value={form.phone} onChange={set('phone')} placeholder="98xxxxxxx" />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Alternate phone">
            <Input
              value={form.alternatePhone}
              onChange={set('alternatePhone')}
              placeholder="Second number"
            />
          </Field>
          <Field label="Parent / guardian phone">
            <Input value={form.parentPhone} onChange={set('parentPhone')} placeholder="98xxxxxxx" />
          </Field>
        </div>

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
          <Field label="Blood group" hint="Used by the office for emergency records.">
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

        <Field label="Full address">
          <TextArea
            rows={2}
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

        {customFields.length > 0 && (
          <>
            <h4 style={{ marginTop: '0.25rem' }}>Extra details</h4>
            <p className="muted small" style={{ marginTop: -4 }}>
              Added by the college office — please fill these in if they are blank.
            </p>
            <div className="grid-2">
              {customFields.map((f) => (
                <Field key={f.key} label={f.label} required={f.required}>
                  <CustomFieldInput
                    field={f}
                    value={custom[f.key]}
                    onChange={(value) => setCustomValue(f.key, value)}
                  />
                </Field>
              ))}
            </div>
          </>
        )}

        <p className="muted small">
          Your name, roll number, branch, year, section and quota are set by the college and can only be changed
          by the office. Fees are shown from your fee report.
        </p>

        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
