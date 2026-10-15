import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api.js';
import { categoryLabel, formatDate, inr, methodLabel, num } from '../../format.js';
import { EmptyState, SectionCard, Spinner, StatCard, useToast } from '../../components/ui.jsx';
import { exportToExcel, exportToPdf } from '../../export.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// local YYYY-MM-DD (avoids the UTC shift of toISOString)
const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthKeyOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;

const compactInr = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v}`;
};

const timeOf = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const EXPORT_COLUMNS = [
  { header: 'Date', get: (r) => formatDate(r.paidOn) },
  { header: 'Time', get: (r) => timeOf(r.createdAt) },
  { header: 'Roll No.', get: (r) => r.rollNumber },
  { header: 'Student', get: (r) => r.studentName },
  { header: 'Fee Type', get: (r) => categoryLabel[r.category] || r.category || '' },
  { header: 'Term', get: (r) => (r.category === 'mess' ? '' : r.term || '') },
  { header: 'Method', get: (r) => methodLabel[r.method] || r.method || '' },
  { header: 'Transaction / UTR ID', get: (r) => r.transactionId || '' },
  { header: 'Receipt No.', get: (r) => r.receiptNo || '' },
  { header: 'Amount', get: (r) => r.amount, money: true },
  { header: 'Recorded By', get: (r) => r.submittedBy || '' },
  { header: 'Note', get: (r) => r.note || '' },
];

export default function AdminCalendar() {
  const toast = useToast();
  const today = ymd(new Date());
  const [view, setView] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [summary, setSummary] = useState({});
  const [monthTotals, setMonthTotals] = useState({ amount: 0, count: 0 });
  const [monthLoading, setMonthLoading] = useState(true);
  const [selected, setSelected] = useState(today);
  const [dayRows, setDayRows] = useState([]);
  const [daySum, setDaySum] = useState(0);
  const [dayLoading, setDayLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const monthKey = monthKeyOf(view.y, view.m);
  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const offset = first.getDay(); // 0 = Sunday

  const loadMonth = useCallback(async () => {
    setMonthLoading(true);
    try {
      const from = ymd(new Date(view.y, view.m, 1));
      const to = ymd(new Date(view.y, view.m + 1, 0));
      const res = await api(`/reports/daily${qs({ from, to })}`);
      const map = {};
      (res.data || []).forEach((d) => {
        map[d.date] = d;
      });
      setSummary(map);
      setMonthTotals({
        amount: res.total || 0,
        count: (res.data || []).reduce((n, d) => n + d.count, 0),
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMonthLoading(false);
    }
  }, [view.y, view.m, toast]);

  const loadDay = useCallback(async () => {
    setDayLoading(true);
    try {
      const res = await api(`/payments${qs({ from: selected, to: selected, limit: 500 })}`);
      setDayRows(res.data || []);
      setDaySum(res.sum || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDayLoading(false);
    }
  }, [selected, toast]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  const goMonth = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    const ny = d.getFullYear();
    const nm = d.getMonth();
    const key = monthKeyOf(ny, nm);
    setView({ y: ny, m: nm });
    setSelected(today.slice(0, 7) === key ? today : `${key}-01`);
  };

  const goToday = () => {
    const d = new Date();
    setView({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  };

  const monthLabel = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const openDay = summary[selected];

  const run = async (kind) => {
    if (!dayRows.length) {
      toast.error('No payments on this date to export.');
      return;
    }
    setBusy(kind);
    try {
      const opts = {
        columns: EXPORT_COLUMNS,
        rows: dayRows,
        filename: `Fee_Collection_${selected}.${kind === 'excel' ? 'xlsx' : 'pdf'}`,
        title: `Fee collection · ${formatDate(selected)}`,
        subtitle: `${num(dayRows.length)} payment${dayRows.length === 1 ? '' : 's'} · Total ${inr(daySum)}`,
      };
      if (kind === 'excel') await exportToExcel({ ...opts, sheetName: 'Collection' });
      else await exportToPdf(opts);
      toast.success(`${kind === 'excel' ? 'Excel' : 'PDF'} downloaded.`);
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setBusy('');
    }
  };

  const activeDays = Object.keys(summary).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Payment calendar</h1>
          <p className="muted">Pick any date to see exactly who paid, at what time, how much and with which ID.</p>
        </div>
        <div className="page-actions no-print">
          <button className="btn btn-ghost" disabled={monthLoading} onClick={loadMonth}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <StatCard
          label="Collected this month"
          value={inr(monthTotals.amount)}
          tone="emerald"
          icon="💰"
          sub={`${num(monthTotals.count)} payment${monthTotals.count === 1 ? '' : 's'}`}
        />
        <StatCard label="Active days" value={num(activeDays)} tone="indigo" icon="📆" sub="Days with at least one payment" />
        <StatCard
          label="Selected day"
          value={inr(daySum)}
          tone="amber"
          icon="🗓️"
          sub={`${formatDate(selected)} · ${num(dayRows.length)} payment${dayRows.length === 1 ? '' : 's'}`}
        />
      </div>

      <SectionCard className="no-print">
        <div className="cal-toolbar" style={{ marginBottom: '0.9rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => goMonth(-1)} aria-label="Previous month">
            ← Prev
          </button>
          <span className="cal-month-label">{monthLabel}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => goMonth(1)} aria-label="Next month">
            Next →
          </button>
          <button className="btn btn-ghost btn-sm" onClick={goToday}>
            Today
          </button>
          <div className="cal-legend" style={{ marginLeft: 'auto' }}>
            <span>
              <i className="cal-dot" style={{ background: 'var(--indigo)' }} /> Tuition
            </span>
            <span>
              <i className="cal-dot" style={{ background: 'var(--amber)' }} /> Hostel
            </span>
            <span>
              <i className="cal-dot" style={{ background: 'var(--emerald)' }} /> Mess
            </span>
          </div>
        </div>

        {monthLoading ? (
          <Spinner label="Loading calendar…" />
        ) : (
          <div className="calendar-wrap">
            <div className="calendar">
              <div className="cal-dow-row">
                {DOW.map((d) => (
                  <div className="cal-dow" key={d}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="calendar-grid">
                {Array.from({ length: offset }).map((_, i) => (
                  <div className="cal-cell is-empty" key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
                  const entry = summary[dateStr];
                  return (
                    <button
                      type="button"
                      key={dateStr}
                      className={[
                        'cal-cell',
                        entry ? 'has-pay' : '',
                        dateStr === today ? 'is-today' : '',
                        dateStr === selected ? 'is-selected' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSelected(dateStr)}
                      title={entry ? `${formatDate(dateStr)} · ${inr(entry.amount)} · ${entry.count} payment(s)` : formatDate(dateStr)}
                    >
                      <span className="cal-day">{day}</span>
                      {entry ? (
                        <>
                          <span className="cal-amount">{compactInr(entry.amount)}</span>
                          <span className="cal-payers">
                            {entry.count} paid
                          </span>
                          <span className="cal-bars">
                            {entry.tuition ? <i className="cal-bar cal-bar-tuition" /> : null}
                            {entry.hostel ? <i className="cal-bar cal-bar-hostel" /> : null}
                            {entry.mess ? <i className="cal-bar cal-bar-mess" /> : null}
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={`Payments on ${formatDate(selected)}`}
        subtitle={
          openDay
            ? `${num(dayRows.length)} payment${dayRows.length === 1 ? '' : 's'} · Total ${inr(daySum)}`
            : 'No collections recorded on this date'
        }
        actions={
          <>
            <button className="btn btn-ghost btn-sm" disabled={dayLoading || busy === 'excel'} onClick={() => run('excel')}>
              ⬇ Excel
            </button>
            <button className="btn btn-ghost btn-sm" disabled={dayLoading || busy === 'pdf'} onClick={() => run('pdf')}>
              ⬇ PDF
            </button>
          </>
        }
      >
        {dayLoading ? (
          <Spinner label="Loading day…" />
        ) : dayRows.length === 0 ? (
          <EmptyState icon="🗓️" title="No payments on this date" hint="Choose a highlighted day on the calendar to see its payments." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Roll No.</th>
                  <th>Student</th>
                  <th>Fee Type</th>
                  <th>Term</th>
                  <th>Method</th>
                  <th>Transaction / UTR ID</th>
                  <th>Receipt No.</th>
                  <th className="right">Amount</th>
                  <th>Recorded By</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((p) => (
                  <tr key={p.id}>
                    <td className="small" title={p.createdAt || p.paidOn}>
                      {timeOf(p.createdAt)}
                    </td>
                    <td style={{ fontWeight: 700 }}>{p.rollNumber}</td>
                    <td>{p.studentName}</td>
                    <td>
                      <span className={`chip chip-${p.category === 'mess' ? 'emerald' : p.category === 'hostel' ? 'amber' : 'indigo'}`}>
                        {categoryLabel[p.category] || p.category}
                      </span>
                    </td>
                    <td className="small">{p.category === 'mess' ? '—' : p.term ? `Term ${p.term}` : '—'}</td>
                    <td>{methodLabel[p.method] || p.method || '—'}</td>
                    <td className="small mono">{p.transactionId || '—'}</td>
                    <td className="small mono">{p.receiptNo || '—'}</td>
                    <td className="right" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                      {inr(p.amount)}
                    </td>
                    <td className="small">{p.submittedBy}</td>
                    <td className="muted small">{p.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} style={{ fontWeight: 700, textAlign: 'right' }}>
                    Day total
                  </td>
                  <td className="right" style={{ fontWeight: 800, color: 'var(--emerald)' }}>
                    {inr(daySum)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
