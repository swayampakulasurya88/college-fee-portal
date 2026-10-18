import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import {
  HEAD_TERMS,
  categoryLabel,
  categoryShort,
  categoryTone,
  currentMonth,
  formatDate,
  formatDateTime,
  inr,
  methodLabel,
  monthLabel,
  paidPercent,
  quotaShort,
  quotaTone,
  todayISO,
} from '../../format.js';
import {
  Badge,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  SectionCard,
  Select,
  Spinner,
  StatCard,
  TextArea,
  useToast,
} from '../../components/ui.jsx';

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

export default function StudentDashboard() {
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [pay, setPay] = useState(emptyPay);
  const [paying, setPaying] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [r, m] = await Promise.all([api('/reports/student/me'), api('/messages/mine')]);
        setReport(r);
        setMessages(m.data);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (body.trim().length < 2) {
      toast.error('Please write a message before sending.');
      return;
    }
    setSending(true);
    try {
      await api('/messages', { method: 'POST', body: { subject: subject.trim(), body: body.trim() } });
      setSubject('');
      setBody('');
      toast.success('Message sent to the admin.');
      const m = await api('/messages/mine');
      setMessages(m.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
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

  if (loading) return <Spinner label="Loading your fee report…" />;
  if (!report) return <EmptyState title="Could not load your report" hint="Please refresh the page." />;

  const s = report.student;
  const pct = paidPercent(s.totalPaid, s.totalFee);
  const cleared = s.totalDue <= 0;
  const bannerClass = cleared ? 'clear' : s.totalPaid > 0 ? '' : 'overdue';

  const heads = [
    { key: 'tuition', label: 'Tuition Fee', fee: s.tuitionFee, paid: s.tuitionPaid, due: s.tuitionDue },
    { key: 'hostel', label: 'Hostel Fee', fee: s.hostelFee, paid: s.hostelPaid, due: s.hostelDue },
    { key: 'mess', label: 'Mess Fee', fee: s.messFee, paid: s.messPaid, due: s.messDue },
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hello, {s.name.split(' ')[0]} 👋</h1>
          <p className="muted">
            Roll number <strong>{s.rollNumber}</strong>
            {s.college ? ` · ${s.college}` : ''}
            {s.branch ? ` · ${s.branch}` : ''}
            {s.year ? ` · Year ${s.year}` : ''}
            {s.section ? ` · Section ${s.section}` : ''}
          </p>
          {s.quota && (
            <span className={`chip chip-${quotaTone[s.quota] || 'indigo'}`} style={{ marginTop: 4 }}>
              {quotaShort[s.quota] || s.quota} quota
            </span>
          )}
          {s.loan && (
            <span className="chip chip-emerald" style={{ marginTop: 4, marginLeft: 6 }}>
              🎓 Education loan
            </span>
          )}
          {s.address && (
            <p className="muted small" style={{ marginTop: 6 }}>📍 {s.address}</p>
          )}
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => load(true)}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className={`due-banner ${bannerClass}`}>
        <div>
          <h2>{cleared ? 'All fees are cleared 🎉' : 'Outstanding balance'}</h2>
          <p style={{ opacity: 0.9, marginTop: 4 }}>
            {s.totalFee <= 0
              ? 'Your fee structure has not been published yet. Please check back soon.'
              : s.loan
                ? 'Your fees are covered by an education loan — nothing is due.'
                : cleared
                  ? 'Thank you — you have no pending dues.'
                  : `You have paid ${inr(s.totalPaid)} of ${inr(s.totalFee)}.`}
          </p>
        </div>
        <div className="amount">
          {inr(s.totalDue)} <small>{cleared ? 'balanced' : 'due'}</small>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Grand Total Fee" value={inr(s.totalFee)} tone="indigo" icon="🧾" sub="Tuition + Hostel + Mess" />
        <StatCard label="Total Paid" value={inr(s.totalPaid)} tone="emerald" icon="✅" sub={`${s.paymentCount} payment${s.paymentCount === 1 ? '' : 's'} recorded`} />
        <StatCard label="Total Due" value={inr(s.totalDue)} tone={cleared ? 'emerald' : 'rose'} icon="⏳" sub={cleared ? 'Nothing pending' : 'To be paid'} />
        <StatCard label="Payment Progress" value={`${pct}%`} tone="amber" icon="📈" sub={`${inr(s.totalPaid)} / ${inr(s.totalFee)}`} />
      </div>

      <SectionCard title="Fee break-up" subtitle="Your fee is split into tuition, hostel and monthly mess">
        <div className="grid-3">
          {heads.map((h) => {
            const hp = paidPercent(h.paid, h.fee);
            return (
              <div key={h.key} className="card" style={{ padding: '1rem', margin: 0 }}>
                <div className="space-between" style={{ marginBottom: 6 }}>
                  <strong>{h.label}</strong>
                  <Badge variant={h.fee <= 0 ? 'neutral' : h.due <= 0 ? 'success' : h.paid > 0 ? 'warn' : 'danger'}>
                    {h.fee <= 0 ? 'Not set' : h.due <= 0 ? 'Cleared' : `${100 - hp}% left`}
                  </Badge>
                </div>
                <div className="stat-value" style={{ fontSize: '1.35rem' }}>{inr(h.fee)}</div>
                <div className="muted small" style={{ margin: '4px 0 8px' }}>
                  Paid {inr(h.paid)} · Due <strong style={{ color: h.due > 0 ? 'var(--rose)' : 'var(--emerald)' }}>{inr(h.due)}</strong>
                </div>
                <ProgressBar percent={hp} tone={categoryTone[h.key]} />
              </div>
            );
          })}
        </div>

        {(s.terms?.tuition?.length || s.terms?.hostel?.length) ? (
          <>
            <h4 style={{ margin: '1rem 0 0.4rem' }}>Term-wise break-up</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Head</th>
                    <th>Term</th>
                    <th className="right">Fee</th>
                    <th className="right">Paid</th>
                    <th className="right">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {['tuition', 'hostel'].flatMap((head) =>
                    (s.terms[head] || []).map((t) => (
                      <tr key={`${head}-${t.term}`}>
                        <td>
                          <span className={`chip chip-${categoryTone[head]}`}>{categoryShort[head]}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>Term {t.term}</td>
                        <td className="right">{inr(t.fee)}</td>
                        <td className="right" style={{ color: 'var(--emerald)' }}>{inr(t.paid)}</td>
                        <td
                          className="right"
                          style={{ color: t.due > 0 ? 'var(--rose)' : 'var(--emerald)', fontWeight: 600 }}
                        >
                          {inr(t.due)}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {s.messFee > 0 && (
          <p className="muted small" style={{ marginTop: '0.75rem' }}>
            Mess fee is billed monthly ({s.messBillCount} month{s.messBillCount === 1 ? '' : 's'} so far).
          </p>
        )}
      </SectionCard>

      <div className="two-col" style={{ marginTop: '1.25rem' }}>
        <SectionCard
          title={s.loan ? 'Fees covered by loan' : 'Pay your fee'}
          subtitle={s.loan ? 'This account is settled by an education loan' : 'Paid online? Record it here with your transaction ID'}
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
              <Field label="Which term?" required hint={`${categoryLabel[pay.category]} is billed across ${HEAD_TERMS[pay.category]} terms.`}>
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

        <SectionCard title="Message the office" subtitle="Raise a fee query or send an update">
          <form onSubmit={sendMessage}>
            <Field label="Subject">
              <Input placeholder="e.g. Receipt correction" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Message" required>
              <TextArea
                placeholder="Describe your query or update for the admin…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </form>
        </SectionCard>
      </div>

      <SectionCard title="Payment history" subtitle="Every payment recorded on your account" className="card" style={{ marginTop: '1.25rem' }}>
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
                    {inr(s.totalPaid)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Monthly mess fee"
        subtitle={`Mess is charged every month${s.messBillCount ? ` · ${s.messBillCount} bill${s.messBillCount === 1 ? '' : 's'}` : ''}`}
        className="card"
        style={{ marginTop: '1.25rem' }}
      >
        {report.messBills.length === 0 ? (
          <EmptyState icon="🍽️" title="No mess bills yet" hint="Monthly mess charges added by the office will be listed here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Note</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.messBills.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{monthLabel(b.month)}</td>
                    <td className="muted small">{b.note || '—'}</td>
                    <td className="right" style={{ fontWeight: 700 }}>{inr(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>
                    Mess Total
                  </td>
                  <td className="right" style={{ fontWeight: 800 }}>
                    {inr(s.messFee)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="muted small" style={{ marginTop: '0.5rem' }}>
          Current month: {monthLabel(currentMonth())}
        </p>
      </SectionCard>

      <SectionCard title="Your messages" subtitle="Replies from the admin appear here" className="card" style={{ marginTop: '1.25rem' }}>
        {messages.length === 0 ? (
          <EmptyState icon="✉️" title="No messages yet" hint="Messages you send to the office will be listed here." />
        ) : (
          <div className="message-list">
            {messages.map((m) => (
              <div key={m.id} className={`message-item ${m.status}`}>
                <div className="message-meta">
                  <span className="message-from">{m.subject || 'Fee query'}</span>
                  <Badge variant={m.status === 'resolved' ? 'success' : m.status === 'read' ? 'neutral' : 'danger'}>
                    {m.status === 'resolved' ? 'Replied' : m.status === 'read' ? 'Seen' : 'Sent'}
                  </Badge>
                  <span className="muted small">{formatDateTime(m.createdAt)}</span>
                </div>
                <div className="message-body">{m.body}</div>
                {m.reply && (
                  <div className="message-reply">
                    <strong>Admin reply:</strong> {m.reply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}
