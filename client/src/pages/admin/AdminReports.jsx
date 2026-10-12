import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api.js';
import { inr, num } from '../../format.js';
import { EmptyState, Field, Input, SectionCard, Spinner, StatCard, useToast } from '../../components/ui.jsx';

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function AdminReports() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(daysAgo(0));
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/reports/daily${qs({ from, to })}`);
      setData(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const payments = data.reduce((sum, d) => sum + d.count, 0);
  const activeDays = data.length;
  const average = activeDays ? total / activeDays : 0;
  const best = data.reduce((max, d) => (d.amount > (max?.amount || 0) ? d : max), null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Daily fee report</h1>
          <p className="muted">Day-by-day fee collection for the selected period.</p>
        </div>
        <div className="page-actions no-print">
          <button className="btn btn-ghost" onClick={() => window.print()}>
            🖨 Print
          </button>
          <button className="btn btn-primary" onClick={load}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="toolbar no-print">
        <Field label="From" style={{ margin: 0 }}>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ margin: 0 }} />
        </Field>
        <Field label="To" style={{ margin: 0 }}>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ margin: 0 }} />
        </Field>
        <button className="btn btn-ghost" onClick={() => { setFrom(daysAgo(6)); setTo(daysAgo(0)); }}>
          Last 7 days
        </button>
        <button className="btn btn-ghost" onClick={() => { setFrom(daysAgo(29)); setTo(daysAgo(0)); }}>
          Last 30 days
        </button>
      </div>

      <div className="stat-grid">
        <StatCard label="Collected in period" value={inr(total)} tone="emerald" icon="💰" sub={`${num(payments)} payments`} />
        <StatCard label="Active days" value={num(activeDays)} tone="indigo" icon="📆" sub="Days with at least one payment" />
        <StatCard label="Average per day" value={inr(average)} tone="amber" icon="📈" sub="Across active days" />
        <StatCard label="Best day" value={best ? inr(best.amount) : '—'} tone="indigo" icon="🏆" sub={best ? best.date : 'No payments'} />
      </div>

      <SectionCard title="Collection history" subtitle={`${from} to ${to}`}>
        {loading ? (
          <Spinner label="Loading report…" />
        ) : data.length === 0 ? (
          <EmptyState icon="📅" title="No payments in this period" hint="Pick a wider date range to see collections." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="right">Payments</th>
                  <th className="right">Amount collected</th>
                  <th className="right">Running total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let running = 0;
                  return [...data].reverse().map((d) => {
                    running += d.amount;
                    return (
                      <tr key={d.date}>
                        <td style={{ fontWeight: 600 }}>{d.date}</td>
                        <td className="right">{num(d.count)}</td>
                        <td className="right" style={{ color: 'var(--emerald)', fontWeight: 700 }}>
                          {inr(d.amount)}
                        </td>
                        <td className="right muted">{inr(running)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td className="right" style={{ fontWeight: 700 }}>{num(payments)}</td>
                  <td className="right" style={{ fontWeight: 800 }}>{inr(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
