import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { categoryLabel, categoryTone, formatDate, inr, num, paidPercent } from '../../format.js';
import { Badge, EmptyState, ProgressBar, SectionCard, Spinner, StatCard, useToast } from '../../components/ui.jsx';

export default function AdminOverview() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api('/reports/summary'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Building dashboard…" />;
  if (!data) return <EmptyState title="No data available" />;

  const pct = paidPercent(data.totalPaid, data.grandTotal);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fee dashboard</h1>
          <p className="muted">A live overview of every student&apos;s fee status across the college.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-ghost" to="/admin/reports">
            📅 Daily report
          </Link>
          <Link className="btn btn-primary" to="/admin/students">
            + Manage students
          </Link>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="College Grand Total" value={inr(data.grandTotal)} tone="indigo" icon="🏛️" sub={`${num(data.studentCount)} students billed`} />
        <StatCard label="Total Collected" value={inr(data.totalPaid)} tone="emerald" icon="💰" sub={`${num(data.paymentCount)} payments received`} />
        <StatCard label="Total Outstanding" value={inr(data.totalDue)} tone="rose" icon="⏳" sub={`${num(data.partialCount + data.unpaidCount)} students pending`} />
        <StatCard label="Collection Rate" value={`${pct}%`} tone="amber" icon="📈" sub={`${inr(data.totalPaid)} of ${inr(data.grandTotal)}`} />
      </div>

      <div className="stat-grid">
        <StatCard label="Fully Paid" value={num(data.paidCount)} tone="emerald" icon="✅" sub="No dues remaining" />
        <StatCard label="Partially Paid" value={num(data.partialCount)} tone="amber" icon="🕗" sub="Balance pending" />
        <StatCard label="Unpaid" value={num(data.unpaidCount)} tone="rose" icon="⚠️" sub="No payment yet" />
        <StatCard label="Collected Today" value={inr(data.collectedToday)} tone="indigo" icon="📆" sub={`${num(data.collectedTodayCount)} payments today`} />
      </div>

      <SectionCard title="Fee heads" subtitle="College-wide totals split across tuition, hostel and monthly mess">
        <div className="grid-3">
          {['tuition', 'hostel', 'mess'].map((key) => {
            const c = data.categories?.[key] || { fee: 0, paid: 0, due: 0 };
            return (
              <div key={key} className="card" style={{ padding: '0.85rem 0.95rem', margin: 0 }}>
                <div className="space-between" style={{ marginBottom: 4 }}>
                  <span className={`chip chip-${categoryTone[key]}`}>{categoryLabel[key]}</span>
                  <strong>{inr(c.fee)}</strong>
                </div>
                <div className="muted small">
                  Paid {inr(c.paid)} · Due{' '}
                  <strong style={{ color: c.due > 0 ? 'var(--rose)' : 'var(--emerald)' }}>{inr(c.due)}</strong>
                </div>
                <div style={{ marginTop: 6 }}>
                  <ProgressBar percent={paidPercent(c.paid, c.fee)} tone={categoryTone[key]} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="two-col">
        <SectionCard
          title="Top outstanding dues"
          subtitle="Students who owe the most"
          actions={<Link className="btn btn-ghost btn-sm" to="/admin/students">View all</Link>}
        >
          {data.defaulters.length === 0 ? (
            <EmptyState icon="🎉" title="Every student is fully paid" hint="No outstanding dues right now." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Roll No.</th>
                    <th>Student</th>
                    <th className="right">Paid</th>
                    <th className="right">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.defaulters.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.rollNumber}</td>
                      <td>{d.name}</td>
                      <td className="right" style={{ color: 'var(--emerald)' }}>{inr(d.totalPaid)}</td>
                      <td className="right" style={{ color: 'var(--rose)', fontWeight: 700 }}>{inr(d.totalDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div>
          <SectionCard title="Collection progress" subtitle="Amount collected against the grand total">
            <div className="space-between" style={{ marginBottom: '0.6rem' }}>
              <span className="muted small">Collected</span>
              <strong>{inr(data.totalPaid)}</strong>
            </div>
            <ProgressBar percent={pct} tone={pct >= 100 ? 'emerald' : 'indigo'} />
            <div className="totals-row" style={{ marginTop: '1rem' }}>
              <span className="muted">Grand total</span>
              <strong>{inr(data.grandTotal)}</strong>
            </div>
            <div className="totals-row">
              <span className="muted">Collected</span>
              <strong style={{ color: 'var(--emerald)' }}>{inr(data.totalPaid)}</strong>
            </div>
            <div className="totals-row">
              <span className="muted">Outstanding</span>
              <strong style={{ color: 'var(--rose)' }}>{inr(data.totalDue)}</strong>
            </div>
          </SectionCard>

          <SectionCard
            title="Messages"
            subtitle="Student queries awaiting attention"
            actions={<Link className="btn btn-ghost btn-sm" to="/admin/messages">Open inbox</Link>}
          >
            <div className="list-tight">
              <div className="list-row">
                <Badge variant="danger">{data.messages.unread} unread</Badge>
                <span className="muted small">New queries from students</span>
              </div>
              <div className="list-row">
                <Badge variant="neutral">{data.messages.read} seen</Badge>
                <span className="muted small">Opened but not resolved</span>
              </div>
              <div className="list-row">
                <Badge variant="success">{data.messages.resolved} resolved</Badge>
                <span className="muted small">Replied and closed</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
