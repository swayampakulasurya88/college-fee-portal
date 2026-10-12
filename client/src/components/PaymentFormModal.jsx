import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { HEAD_TERMS, categoryLabel, inr, todayISO } from '../format.js';
import { Field, Input, Modal, Select, TextArea, useToast } from './ui.jsx';

const METHODS = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['card', 'Card'],
  ['netbanking', 'Net Banking'],
  ['cheque', 'Cheque'],
  ['dd', 'Demand Draft'],
  ['other', 'Other'],
];

const CATEGORIES = ['tuition', 'hostel', 'mess'];

export default function PaymentFormModal({
  open,
  onClose,
  onSaved,
  students = [],
  fixedStudent = null,
  payment = null,
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    studentId: '',
    amount: '',
    category: 'tuition',
    term: 1,
    transactionId: '',
    paidOn: todayISO(),
    method: 'cash',
    receiptNo: '',
    note: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      payment
        ? {
            studentId: payment.studentId || '',
            amount: String(payment.amount ?? ''),
            category: payment.category || 'tuition',
            term: payment.term || 1,
            transactionId: payment.transactionId || '',
            paidOn: (payment.paidOn || '').slice(0, 10) || todayISO(),
            method: payment.method || 'cash',
            receiptNo: payment.receiptNo || '',
            note: payment.note || '',
          }
        : {
            studentId: fixedStudent?.id || '',
            amount: '',
            category: 'tuition',
            term: 1,
            transactionId: '',
            paidOn: todayISO(),
            method: 'cash',
            receiptNo: '',
            note: '',
          },
    );
  }, [open, payment, fixedStudent]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setCategory = (e) => {
    const category = e.target.value;
    setForm((f) => ({ ...f, category, term: category === 'mess' ? null : 1 }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.studentId) return toast.error('Please select a student.');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter a valid amount.');
    if (form.category !== 'mess' && !form.term) return toast.error('Please choose the term.');

    setBusy(true);
    try {
      const body = {
        amount: Number(form.amount),
        category: form.category,
        term: form.category === 'mess' ? null : Number(form.term),
        transactionId: form.transactionId.trim(),
        paidOn: form.paidOn,
        method: form.method,
        receiptNo: form.receiptNo.trim(),
        note: form.note.trim(),
      };
      if (!payment) body.studentId = form.studentId;
      const res = payment
        ? await api(`/payments/${payment.id}`, { method: 'PATCH', body })
        : await api('/payments', { method: 'POST', body });
      toast.success(
        payment
          ? 'Payment updated — due recalculated.'
          : `Payment of ${inr(body.amount)} added.`,
      );
      onSaved?.(res);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const editing = Boolean(payment);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit fee payment' : 'Record a fee payment'}
      subtitle={
        editing
          ? 'Changing the amount or fee type will update the student’s outstanding due.'
          : 'Add a payment received from a student.'
      }
      size="md"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add payment'}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {!fixedStudent && !editing && (
          <Field label="Student" required>
            <Select value={form.studentId} onChange={set('studentId')}>
              <option value="">Select a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.rollNumber} — {s.name} (due {inr(s.totalDue)})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid-2">
          <Field label="Fee Type" required>
            <Select value={form.category} onChange={setCategory}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </Select>
          </Field>
          {form.category !== 'mess' ? (
            <Field label="Term" required hint={`${categoryLabel[form.category]} is billed across ${HEAD_TERMS[form.category]} terms.`}>
              <Select value={form.term ?? ''} onChange={set('term')}>
                {Array.from({ length: HEAD_TERMS[form.category] }, (_, i) => i + 1).map((t) => (
                  <option key={t} value={t}>
                    Term {t}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Billing cycle" hint="Mess is added month by month.">
              <Input value="Monthly mess" readOnly />
            </Field>
          )}
        </div>

        <Field label="Amount (₹)" required>
          <Input type="number" min="1" step="1" value={form.amount} onChange={set('amount')} placeholder="10000" />
        </Field>

        <div className="grid-2">
          <Field label="Payment Date">
            <Input type="date" value={form.paidOn} onChange={set('paidOn')} max={todayISO()} />
          </Field>
          <Field label="Payment Method">
            <Select value={form.method} onChange={set('method')}>
              {METHODS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Transaction / UTR ID" hint="From the student's receipt">
            <Input value={form.transactionId} onChange={set('transactionId')} placeholder="e.g. 4012XXXXXX" />
          </Field>
          <Field label="Receipt No.">
            <Input value={form.receiptNo} onChange={set('receiptNo')} placeholder="RCPT-1042" />
          </Field>
        </div>

        <Field label="Note">
          <TextArea
            style={{ minHeight: 70 }}
            value={form.note}
            onChange={set('note')}
            placeholder="e.g. Semester 2 installment"
          />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
