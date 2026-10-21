import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import {
  categoryLabel,
  categoryTone,
  currentMonth,
  formatDate,
  inr,
  methodLabel,
  monthLabel,
  paidPercent,
} from '../format.js';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  Spinner,
  StatusBadge,
  useToast,
} from './ui.jsx';
import PaymentFormModal from './PaymentFormModal.jsx';
import StudentFormModal from './StudentFormModal.jsx';
import StudentAvatar, { readPhotoFile } from './StudentAvatar.jsx';
import { useCustomFields } from '../pages/student/studentShared.jsx';

function Cell({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="muted small">{label}</div>
      <div style={{ fontWeight: 600, marginTop: 2, overflowWrap: 'anywhere' }}>
        {value || <span className="muted">—</span>}
      </div>
    </div>
  );
}

// Every detail the student has filled in, plus their photo (admins can set or
// clear the photo too — handy for bulk enrolment sessions).
function StudentIdentity({ student, onPhoto, busy, customFields = [] }) {
  const fileRef = useRef(null);

  return (
    <>
      <div className="divider" />
      <div className="space-between" style={{ marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h4 style={{ margin: 0 }}>Student details</h4>
        <span className="muted small">Filled by the student from their own login · ✎ Edit details to change</span>
      </div>

      <div className="inline" style={{ gap: '1rem', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        <StudentAvatar student={student} size={84} />
        <div>
          <div className="inline">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Saving…' : student.photo ? '📷 Replace photo' : '📷 Upload photo'}
            </button>
            {student.photo && (
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => onPhoto('')}>
                Remove
              </button>
            )}
          </div>
          <p className="muted small" style={{ marginTop: 6 }}>
            {student.photo ? 'Student photo on file.' : 'No student photo yet.'}
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const photo = await readPhotoFile(file);
              await onPhoto(photo);
            } catch (err) {
              onPhoto(null, err.message);
            }
          }}
        />
      </div>

      <div className="grid-3">
        <Cell label="Date of birth" value={student.dob} />
        <Cell label="Gender" value={student.gender} />
        <Cell label="Blood group" value={student.bloodGroup} />
        <Cell label="Father's name" value={student.fatherName} />
        <Cell label="Mother's name" value={student.motherName} />
        <Cell label="Staying" value={student.hostel ? 'Hosteller' : 'Day scholar'} />
        <Cell label="Student phone" value={student.phone} />
        <Cell label="Alternate phone" value={student.alternatePhone} />
        <Cell label="Parent phone" value={student.parentPhone} />
        <Cell label="Email" value={student.email} />
        <Cell label="Village / street" value={student.village} />
        <Cell label="Mandal" value={student.mandal} />
        <Cell label="District" value={student.district} />
        <Cell label="State" value={student.state} />
        <Cell label="PIN code" value={student.pincode} />
        <Cell label="Full address" value={student.address} />
        <Cell
          label="Emergency contact"
          value={[student.emergencyContactName, student.emergencyContactPhone].filter(Boolean).join(' · ')}
        />
        <Cell label="Quota" value={student.quota} />
        <Cell label="College / Branch" value={[student.college, student.branch].filter(Boolean).join(' · ')} />
        <Cell label="Year / Section" value={[student.year && `Year ${student.year}`, student.section && `Sec ${student.section}`].filter(Boolean).join(' · ')} />
        <Cell label="Loan" value={student.loan ? `Yes${student.loanNote ? ` · ${student.loanNote}` : ''}` : 'No'} />
        {customFields.map((f) => (
          <Cell key={f.key} label={f.label} value={student.customFields ? student.customFields[f.key] : ''} />
        ))}
      </div>
    </>
  );
}

export default function ManageFeesModal({ open, onClose, studentId, onChanged }) {
  const toast = useToast();
  const customFields = useCustomFields();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payModal, setPayModal] = useState({ open: false, payment: null });
  const [editStudent, setEditStudent] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [messForm, setMessForm] = useState({ month: currentMonth(), amount: '', note: '' });
  const [messBusy, setMessBusy] = useState(false);
  const [termEdit, setTermEdit] = useState(null); // { head, term, amount, note }
  const [termBusy, setTermBusy] = useState(false);
  const [loanBusy, setLoanBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const d = await api(`/students/${studentId}`);
      setData(d);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [studentId, toast]);

  useEffect(() => {
    if (open && studentId) load();
    if (!open) setData(null);
  }, [open, studentId, load]);

  const afterChange = async () => {
    await load();
    onChanged?.();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/payments/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Payment deleted — due recalculated.');
      setToDelete(null);
      await afterChange();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addMess = async (e) => {
    e.preventDefault();
    if (!messForm.amount && messForm.amount !== 0) return toast.error('Enter the mess amount.');
    setMessBusy(true);
    try {
      await api('/mess', {
        method: 'POST',
        body: {
          studentId,
          month: messForm.month,
          amount: Number(messForm.amount || 0),
          note: messForm.note.trim(),
        },
      });
      toast.success(`Mess fee set for ${monthLabel(messForm.month)}.`);
      setMessForm((f) => ({ ...f, amount: '', note: '' }));
      await afterChange();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMessBusy(false);
    }
  };

  const deleteMess = async (bill) => {
    try {
      await api(`/mess/${bill.id}`, { method: 'DELETE' });
      toast.success('Mess bill removed.');
      await afterChange();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const saveTerm = async () => {
    if (!termEdit) return;
    if (termEdit.amount === '' || Number(termEdit.amount) < 0) return toast.error('Enter the term amount.');
    setTermBusy(true);
    try {
      await api('/fees', {
        method: 'POST',
        body: {
          studentId,
          head: termEdit.head,
          term: termEdit.term,
          amount: Number(termEdit.amount || 0),
          note: termEdit.note || '',
        },
      });
      toast.success(`${categoryLabel[termEdit.head]} term ${termEdit.term} updated.`);
      setTermEdit(null);
      await afterChange();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTermBusy(false);
    }
  };

  const clearTerm = async (head, term) => {
    const row = (data?.termFees || []).find((f) => f.head === head && f.term === term);
    if (!row) return;
    try {
      await api(`/fees/${row.id}`, { method: 'DELETE' });
      toast.success(`${categoryLabel[head]} term ${term} cleared.`);
      await afterChange();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const s = data?.student;
  const pct = s ? paidPercent(s.totalPaid, s.totalFee) : 0;

  const heads = s
    ? [
        { key: 'tuition', label: 'Tuition', fee: s.tuitionFee, paid: s.tuitionPaid, due: s.tuitionDue },
        { key: 'hostel', label: 'Hostel', fee: s.hostelFee, paid: s.hostelPaid, due: s.hostelDue },
        { key: 'mess', label: 'Mess', fee: s.messFee, paid: s.messPaid, due: s.messDue },
      ]
    : [];

  const toggleLoan = async () => {
    setLoanBusy(true);
    try {
      await api(`/students/${s.id}`, { method: 'PATCH', body: { loan: !s.loan } });
      toast.success(s.loan ? 'Loan removed — dues recalculated.' : 'Marked as loan — fee cleared to ₹0.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoanBusy(false);
    }
  };

  // Admin can set a student's photo (or clear it) from the details view.
  const savePhoto = async (photo, errorMessage) => {
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    setPhotoBusy(true);
    try {
      await api(`/students/${s.id}`, { method: 'PATCH', body: { photo: photo || '' } });
      toast.success(photo ? 'Student photo updated.' : 'Student photo removed.');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={s ? `${s.name} · ${s.rollNumber}` : 'Fee details'}
        subtitle="Manage tuition, hostel and monthly mess — the due updates automatically."
        footer={
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        }
      >
        {loading && !data ? (
          <Spinner label="Loading student…" />
        ) : !s ? (
          <EmptyState title="Student not found" />
        ) : (
          <>
            <div className="space-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="inline">
                <StatusBadge status={s.status} />
                {s.college && <span className="chip">{s.college}</span>}
                {s.branch && <span className="chip">{s.branch}</span>}
                {s.year && <span className="chip">Year {s.year}</span>}
                {s.section && <span className="chip">Sec {s.section}</span>}
                {s.loan && <span className="chip chip-emerald">Loan</span>}
              </div>
              <div className="inline">
                <button className="btn btn-ghost btn-sm" onClick={() => setEditStudent(true)}>
                  ✎ Edit details
                </button>
                <button
                  className={s.loan ? 'btn btn-loan btn-sm' : 'btn btn-ghost btn-sm'}
                  disabled={loanBusy}
                  title={s.loan ? 'Remove loan — recalculate dues' : 'Mark as loan — clears the fee to ₹0'}
                  onClick={toggleLoan}
                >
                  {loanBusy ? '…' : s.loan ? 'Loan ✓' : 'Loan'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setPayModal({ open: true, payment: null })}>
                  + Add payment
                </button>
              </div>
            </div>

            {(s.phone || s.parentPhone || s.email || s.address) && (
              <div className="muted small" style={{ marginBottom: '0.75rem' }}>
                {s.phone && <span>📞 {s.phone}</span>}
                {s.parentPhone && <span>{s.phone ? ' · ' : ''}👪 {s.parentPhone} (parent)</span>}
                {s.email && <span>{s.phone || s.parentPhone ? ' · ' : ''}✉ {s.email}</span>}
                {s.address && <div style={{ marginTop: 2 }}>📍 {s.address}</div>}
              </div>
            )}

            {s.loan && (
              <div
                className="small"
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 8,
                  background: 'var(--emerald-soft)',
                  color: '#065f46',
                  fontWeight: 600,
                }}
              >
                🎓 Education loan — fees shown as fully settled (₹0 due).{s.loanNote ? ` ${s.loanNote}` : ''}
              </div>
            )}

            <StudentIdentity student={s} busy={photoBusy} onPhoto={savePhoto} customFields={customFields} />

            <div className="grid-3" style={{ marginBottom: '0.5rem' }}>
              <div>
                <div className="muted small">Grand Total</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{inr(s.totalFee)}</div>
              </div>
              <div>
                <div className="muted small">Total Paid</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--emerald)' }}>{inr(s.totalPaid)}</div>
              </div>
              <div>
                <div className="muted small">Total Due</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.totalDue > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                  {inr(s.totalDue)}
                </div>
              </div>
            </div>

            <ProgressBar percent={pct} tone={pct >= 100 ? 'emerald' : 'indigo'} />

            <div className="grid-3" style={{ marginTop: '1rem' }}>
              {[
                { key: 'tuition', fee: s.tuitionFee, paid: s.tuitionPaid, due: s.tuitionDue },
                { key: 'hostel', fee: s.hostelFee, paid: s.hostelPaid, due: s.hostelDue },
                { key: 'mess', fee: s.messFee, paid: s.messPaid, due: s.messDue },
              ].map((c) => (
                <div key={c.key} className="card" style={{ padding: '0.75rem 0.85rem', margin: 0 }}>
                  <div className="space-between" style={{ marginBottom: 4 }}>
                    <span className={`chip chip-${categoryTone[c.key]}`}>{categoryLabel[c.key]}</span>
                    <strong>{inr(c.fee)}</strong>
                  </div>
                  <div className="muted small">
                    Paid {inr(c.paid)} · Due <strong style={{ color: c.due > 0 ? 'var(--rose)' : 'var(--emerald)' }}>{inr(c.due)}</strong>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <ProgressBar percent={paidPercent(c.paid, c.fee)} tone={categoryTone[c.key]} />
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <h4 style={{ marginBottom: '0.5rem' }}>Fixed fees · term-wise</h4>
            <div className="grid-2">
              {['tuition', 'hostel'].map((head) => (
                <div key={head}>
                  <div className="space-between" style={{ marginBottom: 4 }}>
                    <span className={`chip chip-${categoryTone[head]}`}>{categoryLabel[head]}</span>
                    <span className="muted small">{inr(head === 'tuition' ? s.tuitionFee : s.hostelFee)} total</span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Term</th>
                          <th className="right">Fee</th>
                          <th className="right">Paid</th>
                          <th className="right">Due</th>
                          <th className="right">Set</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(s.terms?.[head] || []).map((t) => {
                          const editingThis = termEdit?.head === head && termEdit?.term === t.term;
                          return (
                            <tr key={t.term}>
                              <td style={{ fontWeight: 600 }}>Term {t.term}</td>
                              <td className="right">{inr(t.fee)}</td>
                              <td className="right" style={{ color: 'var(--emerald)' }}>{inr(t.paid)}</td>
                              <td className="right" style={{ color: t.due > 0 ? 'var(--rose)' : 'var(--emerald)' }}>{inr(t.due)}</td>
                              <td>
                                <div className="row-actions">
                                  {editingThis ? (
                                    <>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={termEdit.amount}
                                        onChange={(e) => setTermEdit((x) => ({ ...x, amount: e.target.value }))}
                                        style={{ width: 110 }}
                                      />
                                      <button className="btn btn-primary btn-sm" onClick={saveTerm} disabled={termBusy}>
                                        Save
                                      </button>
                                      <button className="btn btn-ghost btn-sm" onClick={() => setTermEdit(null)}>
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => setTermEdit({ head, term: t.term, amount: String(t.fee), note: '' })}
                                      >
                                        Edit
                                      </button>
                                      {t.fee > 0 && (
                                        <button className="btn btn-danger btn-sm" onClick={() => clearTerm(head, t.term)}>
                                          Clear
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <h4 style={{ marginBottom: '0.5rem' }}>Payments ({data.payments.length})</h4>
            {data.payments.length === 0 ? (
              <EmptyState icon="🧾" title="No payments yet" hint="Add a payment or wait for the student to record one." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Fee Type</th>
                      <th>Term</th>
                      <th>Transaction / Receipt</th>
                      <th>By</th>
                      <th className="right">Amount</th>
                      <th className="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.paidOn)}</td>
                          <td>
                          <span className={`chip chip-${categoryTone[p.category] || 'indigo'}`}>
                            {categoryLabel[p.category] || p.category}
                          </span>
                        </td>
                        <td className="small">{p.category === 'mess' ? '—' : p.term ? `Term ${p.term}` : '—'}</td>
                        <td className="small">
                          {p.transactionId || p.receiptNo || '—'}
                          {p.note ? <div className="muted small">{p.note}</div> : null}
                        </td>
                        <td>
                          <span className="chip">{p.submittedBy === 'student' ? 'Student' : 'Admin'}</span>
                        </td>
                        <td className="right" style={{ fontWeight: 700 }}>
                          {inr(p.amount)}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-ghost btn-sm" onClick={() => setPayModal({ open: true, payment: p })}>
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setToDelete(p)}>
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

            <div className="divider" />

            <div className="space-between" style={{ marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4>Monthly mess fee ({data.messBills.length})</h4>
              {s.messFee > 0 && <Badge variant="indigo">Mess total {inr(s.messFee)}</Badge>}
            </div>

            <form onSubmit={addMess} className="toolbar" style={{ alignItems: 'flex-end' }}>
              <Field label="Month">
                <Input type="month" value={messForm.month} onChange={(e) => setMessForm((f) => ({ ...f, month: e.target.value }))} />
              </Field>
              <Field label="Amount (₹)">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={messForm.amount}
                  onChange={(e) => setMessForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="3500"
                />
              </Field>
              <Field label="Note">
                <Input
                  value={messForm.note}
                  onChange={(e) => setMessForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>
              <button className="btn btn-primary" type="submit" disabled={messBusy}>
                {messBusy ? 'Saving…' : 'Add / update month'}
              </button>
            </form>

            {data.messBills.length === 0 ? (
              <p className="muted small">No monthly mess bills for this student yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Note</th>
                      <th className="right">Amount</th>
                      <th className="right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.messBills.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600 }}>{monthLabel(b.month)}</td>
                        <td className="muted small">{b.note || '—'}</td>
                        <td className="right" style={{ fontWeight: 700 }}>{inr(b.amount)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setMessForm({ month: b.month, amount: String(b.amount), note: b.note || '' })}
                            >
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteMess(b)}>
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
          </>
        )}
      </Modal>

      <PaymentFormModal
        open={payModal.open}
        onClose={() => setPayModal({ open: false, payment: null })}
        onSaved={afterChange}
        fixedStudent={s}
        payment={payModal.payment}
      />

      <StudentFormModal
        open={editStudent}
        onClose={() => setEditStudent(false)}
        onSaved={afterChange}
        student={s}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this payment?"
        message={
          toDelete
            ? `Remove the ${inr(toDelete.amount)} ${categoryLabel[toDelete.category] || ''} payment? The student's due will increase.`
            : ''
        }
        confirmLabel="Delete payment"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
