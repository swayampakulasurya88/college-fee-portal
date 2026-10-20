import { useState } from 'react';
import {
  HEAD_TERMS,
  categoryLabel,
  categoryTone,
  formatDate,
  inr,
  methodLabel,
  todayISO,
} from '../../format.js';
import { EmptyState, Field, Input, SectionCard, Select, Spinner, StatCard, useToast } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { StudentHeader, useStudentReport } from './studentShared.jsx';

const METHODS = [
  ['upi', 'UPI'],
  ['netbanking', 'Net Banking'],
  ['card', 'Card'],
  ['cash', 'Cash'],
  ['cheque', 'Cheque'],
  ['dd', 'Demand Draft'],
  ['other', 'Other'],
];

const emptyPay = () => ({
  category: 'tuition',
  term: 1,
  amount: '',
  transactionId: '',
  method: 'upi',
  paidOn: todayISO(),
  note: '',
});

export default function StudentPayments() {
  const { report, loading, load } = useStudentReport();
  const toast = useToast();
  const [pay, setPay] = useState(emptyPay);
  const [paying, setPaying] = useState(false);

  if (loading) return <Spinner label="Loading your payments…" />;
  if (!report) return <EmptyState title="Could not load your payments" hint="Please refresh the page." />;

  const s = report.student;
  const heads = [
    { key: 'tuition', label: 'Tuition Fee', due: s.tuitionDue },
    { key: 'hostel', label: 'Hostel Fee', due: s.hostelDue },
    { key: 'mess', label: 'Mess Fee', due: s.messDue },
  ];
  const selectedHead = heads.find((h) => h.key === pay.category);
  const termRows = pay.category !== 'mess' ? s.terms?.[pay.category] || [] : [];
  const selectedTerm = pay.category !== 'mess' ? termRows.find((t) => t.term === Number(pay.term)) : null;
  const setPayField = (key) => (e) => setPay((p) => ({ ...p, [key]: e.target.value }));

  const chooseCategory = (category) => {
    const head = heads.find((h) => h.key === category);
    if (category === 'mess') {
      setPay((p) => ({ ...p, category, term: null, amount: head && head.due > 0 ? String(head.due) : '' }));
      return;
    }
    const rows = s.terms?.[category] || [];
    const first = rows.find((t) => t.due > 0) || rows[0];
    setPay((p) => ({
      ...p,
      category,
      term: first?.term || 1,
      amount: first && first.due > 0 ? String(first.due) : '',
    }));
  };

  const chooseTerm = (e) => {
    const term = Number(e.target.value);
    const row = (s.terms?.[pay.category] || []).find((t) => t.term === term);
    setPay((p) => ({ ...p, term, amount: row && row.due > 0 ? String(row.due) : '' }));
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(pay.amount);
    if (!amount || amount <= 0) return toast.error('Enter the amount you paid.');
    if (!pay.transactionId.trim()) return toast.error('Enter the transaction / reference ID.');
    setPaying(true);
    try {
      await api('/payments', {
        method: 'POST',
        body: {
          category: pay.category,
          term: pay.category === 'mess' ? null : Number(pay.term || 1),
          amount,
          transactionId: pay.transactionId.trim(),
          method: pay.method,
          paidOn: pay.paidOn,
          note: pay.note.trim(),
        },
      });
      toast.success(`Payment of ${inr(amount)} recorded. Thank you!`);
      setPay(emptyPay());
      await load(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  const totalPaidShown = (report.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <>
      <StudentHeader
        student={s}
        title="Fee payments"
        subtitle={`${s.paymentCount} payment${s.paymentCount === 1 ? '' : 's'} recorded · ${inr(s.totalPaid)} paid · ${inr(s.totalDue)} due`}
        onRefresh={() => load(true)}
      />

      <div className="stat-grid">
        <StatCard label="Total Paid" value={inr(s.totalPaid)} tone="emerald" icon="✅" sub="Across all fee heads" />
        <StatCard label="Total Due" value={inr(s.totalDue)} tone={s.totalDue > 0 ? 'rose' : 'emerald'} icon="⏳" sub={s.totalDue > 0 ? 'To be paid' : 'Nothing pending'} />
        <StatCard label="Payments" value={String(s.paymentCount)} tone="indigo" icon="🧾" sub="Recorded on your account" />
        <StatCard label="Mess bills" value={String(s.messBillCount)} tone="amber" icon="🍽️" sub="Monthly mess charges" />
      </div>

      <SectionCard
        title={s.loan ? 'Fees covered by loan' : 'Pay your fee'}
        subtitle={s.loan ? 'This account is settled by an education loan' : 'Paid online? Record it here with your transaction ID'}
        style={{ marginTop: '1.25rem' }}
      >
        {s.loan ? (
          <div
            style={{
              padding: '1rem',
              borderRadius: 10,
              background: 'var(--emerald-soft)',
              color: '#065f46',
              fontWeight: 600,
            }}
          >
            🎓 Your fees are covered by an education loan, so there is nothing to pay here. Please contact the
            office if this looks incorrect.
          </div>
        ) : (
          <form onSubmit={submitPayment}>
            <Field label="Which fee are you paying?" required>
              <Select value={pay.category} onChange={(e) => chooseCategory(e.target.value)}>
                {heads.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.label} — due {inr(h.due)}
                  </option>
                ))}
              </Select>
            </Field>
            {pay.category !== 'mess' && (
              <Field
                label="Which term?"
                required
                hint={`${categoryLabel[pay.category]} is billed across ${HEAD_TERMS[pay.category]} terms.`}
              >
                <Select value={pay.term ?? 1} onChange={chooseTerm}>
                  {(s.terms?.[pay.category] || []).map((t) => (
                    <option key={t.term} value={t.term}>
                      Term {t.term} — {inr(t.fee)} · due {inr(t.due)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid-2">
              <Field
                label="Amount (₹)"
                required
                hint={
                  pay.category === 'mess'
                    ? selectedHead && selectedHead.due > 0
                      ? `Outstanding ${inr(selectedHead.due)}`
                      : 'This head is fully paid'
                    : selectedTerm
                      ? `Term outstanding ${inr(selectedTerm.due)}`
                      : ''
                }
              >
                <Input type="number" min="1" step="1" value={pay.amount} onChange={setPayField('amount')} placeholder="10000" />
              </Field>
              <Field label="Paid on">
                <Input type="date" value={pay.paidOn} onChange={setPayField('paidOn')} max={todayISO()} />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Transaction / UTR ID" required hint="From your UPI / bank receipt · each ID can be used only once">
                <Input value={pay.transactionId} onChange={setPayField('transactionId')} placeholder="e.g. 4012XXXXXX" />
              </Field>
              <Field label="Payment method">
                <Select value={pay.method} onChange={setPayField('method')}>
                  {METHODS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Note (optional)">
              <Input value={pay.note} onChange={setPayField('note')} placeholder="e.g. Semester 2 tuition" />
            </Field>
            <button className="btn btn-primary btn-block" type="submit" disabled={paying}>
              {paying ? 'Recording…' : 'I have paid — record it'}
            </button>
          </form>
        )}
      </SectionCard>

      <SectionCard
        title="Payment history"
        subtitle="Every payment recorded on your account"
        style={{ marginTop: '1.25rem' }}
      >
        {report.payments.length === 0 ? (
          <EmptyState icon="🧾" title="No payments yet" hint="Payments you record or the office adds will appear here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fee Type</th>
                  <th>Term</th>
                  <th>Transaction ID</th>
                  <th>Method</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paidOn)}</td>
                    <td>
                      <span className={`chip chip-${categoryTone[p.category] || 'indigo'}`}>
                        {categoryLabel[p.category] || p.category}
                      </span>
                    </td>
                    <td className="small">{p.category === 'mess' ? 'Monthly' : p.term ? `Term ${p.term}` : '—'}</td>
                    <td className="small">
                      {p.transactionId || p.receiptNo || '—'}
                      {p.transactionId && p.receiptNo ? <div className="muted small">Rcpt {p.receiptNo}</div> : null}
                    </td>
                    <td>
                      <span className="chip">{methodLabel[p.method] || p.method}</span>
                    </td>
                    <td className="right" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                      {inr(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>
                    Total Paid
                  </td>
                  <td className="right" style={{ fontWeight: 800 }}>
                    {inr(totalPaidShown)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
