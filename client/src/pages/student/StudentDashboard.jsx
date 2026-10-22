import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import {
  categoryLabel,
  categoryTone,
  formatDate,
  formatDateTime,
  inr,
  paidPercent,
} from '../../format.js';
import {
  Badge,
  EmptyState,
  Field,
  Input,
  SectionCard,
  Spinner,
  StatCard,
  TextArea,
  useToast,
} from '../../components/ui.jsx';
import { StudentHeader, profileCompleteness, useStudentReport } from './studentShared.jsx';

export default function StudentDashboard() {
  const { report, loading } = useStudentReport();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      const m = await api('/messages/mine');
      setMessages(m.data || []);
    } catch {
      /* dashboard still works without messages */
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

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
      toast.success('Message sent to the office.');
      await loadMessages();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Spinner label="Loading your dashboard…" />;
  if (!report) return <EmptyState title="Could not load your report" hint="Please refresh the page." />;

  const s = report.student;
  const pct = paidPercent(s.totalPaid, s.totalFee);
  const cleared = s.totalDue <= 0;
  const bannerClass = cleared ? 'clear' : s.totalPaid > 0 ? '' : 'overdue';
  const recent = (report.payments || []).slice(0, 5);
  const completeness = profileCompleteness(s);
  const latestMessages = messages.slice(0, 3);

  return (
    <>
      <StudentHeader
        student={s}
        title={`Hello, ${s.name.split(' ')[0]} 👋`}
        subtitle={[
          `Roll number ${s.rollNumber}`,
          s.college,
          s.branch,
          s.year ? `Year ${s.year}` : '',
          s.section ? `Section ${s.section}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      />

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
        <StatCard
          label="Total Paid"
          value={inr(s.totalPaid)}
          tone="emerald"
          icon="✅"
          sub={`${s.paymentCount} payment${s.paymentCount === 1 ? '' : 's'} recorded`}
        />
        <StatCard
          label="Total Due"
          value={inr(s.totalDue)}
          tone={cleared ? 'emerald' : 'rose'}
          icon="⏳"
          sub={cleared ? 'Nothing pending' : 'To be paid'}
        />
        <StatCard label="Payment Progress" value={`${pct}%`} tone="amber" icon="📈" sub={`${inr(s.totalPaid)} / ${inr(s.totalFee)}`} />
      </div>

      <div className="grid-3" style={{ marginTop: '1.25rem' }}>
        <Link to="/student/details" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '1rem' }}>
          <div className="space-between">
            <strong>👤 Student details</strong>
            <span className="muted small">View →</span>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {completeness.filled} of {completeness.total} fields filled
          </div>
          <div style={{ marginTop: 8 }}>
            {s.photo ? (
              <span className="chip chip-emerald">📷 Photo added</span>
            ) : (
              <span className="chip chip-amber">📷 Add a profile photo</span>
            )}
          </div>
        </Link>

        <Link to="/student/fees" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '1rem' }}>
          <div className="space-between">
            <strong>🧾 Fee details</strong>
            <span className="muted small">View →</span>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {inr(s.totalPaid)} paid of {inr(s.totalFee)}
          </div>
          <div style={{ marginTop: 8 }} className="inline">
            <span className={`chip chip-${categoryTone.tuition}`}>Tuition {inr(s.tuitionFee)}</span>
            <span className={`chip chip-${categoryTone.hostel}`}>Hostel {inr(s.hostelFee)}</span>
            <span className={`chip chip-${categoryTone.mess}`}>Mess {inr(s.messFee)}</span>
          </div>
        </Link>

        <Link to="/student/payments" className="card" style={{ textDecoration: 'none', color: 'inherit', padding: '1rem' }}>
          <div className="space-between">
            <strong>💰 Fee payments</strong>
            <span className="muted small">Open →</span>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {s.loan ? 'Covered by your education loan' : cleared ? 'Nothing pending' : `${inr(s.totalDue)} still due`}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className={`chip chip-${cleared ? 'emerald' : 'rose'}`}>
              {s.loan ? '🎓 Loan' : cleared ? 'Cleared' : 'Pay now'}
            </span>
          </div>
        </Link>
      </div>

      <div className="two-col" style={{ marginTop: '1.25rem' }}>
        <SectionCard
          title="Recent payments"
          subtitle={`${s.paymentCount} payment${s.paymentCount === 1 ? '' : 's'} on your account`}
          actions={
            <Link className="btn btn-ghost btn-sm" to="/student/payments">
              View all →
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState icon="🧾" title="No payments yet" hint="Payments you record or the office adds will appear here." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fee type</th>
                    <th className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.paidOn)}</td>
                      <td>
                        <span className={`chip chip-${categoryTone[p.category] || 'indigo'}`}>
                          {categoryLabel[p.category] || p.category}
                        </span>
                        <div className="muted small">{p.category === 'mess' ? 'Monthly' : p.term ? `Term ${p.term}` : ''}</div>
                      </td>
                      <td className="right" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                        {inr(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

          {latestMessages.length > 0 && (
            <div className="message-list" style={{ marginTop: '0.9rem' }}>
              {latestMessages.map((m) => (
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
      </div>
    </>
  );
}
