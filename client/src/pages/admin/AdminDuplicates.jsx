import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../../api.js';
import { categoryLabel, formatDate, inr, methodLabel, num } from '../../format.js';
import {
  ConfirmDialog,
  EmptyState,
  Input,
  SectionCard,
  Spinner,
  StatCard,
  useToast,
} from '../../components/ui.jsx';
import { exportToExcel, exportToPdf } from '../../export.js';

const LIMIT = 25;

// One row = one student involved with a reused reference.
const EXPORT_COLUMNS = [
  { header: 'Reference', get: (r) => r.reference },
  { header: 'Reference Type', get: (r) => r.kindLabel },
  { header: 'Role', get: (r) => (r.source === 'paid' ? 'Recorded payment' : 'Blocked attempt') },
  { header: 'Roll No.', get: (r) => r.rollNumber },
  { header: 'Name', get: (r) => r.name },
  { header: 'Phone', get: (r) => r.phone },
  { header: 'Branch', get: (r) => r.branch },
  { header: 'Year', get: (r) => r.year },
  { header: 'Section', get: (r) => r.section },
  { header: 'Fee Type', get: (r) => categoryLabel[r.category] || r.category || '' },
  { header: 'Term', get: (r) => (r.category === 'mess' ? '' : r.term || '') },
  { header: 'Method', get: (r) => methodLabel[r.method] || r.method || '' },
  { header: 'Amount', get: (r) => r.amount, money: true },
  { header: 'Payment Date', get: (r) => (r.paidOn ? formatDate(r.paidOn) : '') },
  { header: 'Submitted By', get: (r) => (r.source === 'attempted' ? `${r.submittedBy}${r.attemptedBy ? ` (${r.attemptedBy})` : ''}` : r.submittedBy) },
  { header: 'Already Used By', get: (r) => r.conflicting || '' },
  { header: 'Logged At', get: (r) => (r.recordedAt ? formatDate(r.recordedAt) : '') },
];

export default function AdminDuplicates() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({ groups: 0, attempts: 0, students: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [toClear, setToClear] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/duplicates${qs({ q, page, limit: LIMIT })}`);
      setRows(res.data || []);
      setTotals(res.totals || { groups: 0, attempts: 0, students: 0 });
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Flatten every student in the loaded groups for the exports.
  const flatRows = useMemo(
    () => rows.flatMap((g) => g.students.map((s) => ({ ...s, reference: g.reference, kindLabel: g.kindLabel }))),
    [rows],
  );

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  const filename = (ext) => `Duplicate_Receipts_${new Date().toISOString().slice(0, 10)}.${ext}`;

  const run = async (kind) => {
    if (!flatRows.length) {
      toast.error('Nothing to export on this page.');
      return;
    }
    setBusy(kind);
    try {
      const opts = {
        columns: EXPORT_COLUMNS,
        rows: flatRows,
        filename: filename(kind === 'excel' ? 'xlsx' : 'pdf'),
        title: 'Duplicate Receipt Report',
        subtitle: `${num(totals.groups)} reference${totals.groups === 1 ? '' : 's'} · ${num(totals.attempts)} blocked attempt${totals.attempts === 1 ? '' : 's'}`,
      };
      if (kind === 'excel') await exportToExcel({ ...opts, sheetName: 'Duplicates' });
      else await exportToPdf(opts);
      toast.success(`Duplicates ${kind === 'excel' ? 'Excel' : 'PDF'} downloaded.`);
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setBusy('');
    }
  };

  const clearGroup = async () => {
    if (!toClear) return;
    setBusy('clear');
    try {
      await api(`/duplicates${qs({ kind: toClear.kind, reference: toClear.reference })}`, { method: 'DELETE' });
      toast.success('Duplicates cleared for this receipt.');
      setToClear(null);
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Duplicates</h1>
          <p className="muted">
            Students who tried to pay with a receipt / UTR ID that was already used. The duplicate
            payment is blocked and listed here for review.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" disabled={loading || busy === 'excel'} onClick={() => run('excel')}>
            ⬇ Excel
          </button>
          <button className="btn btn-ghost" disabled={loading || busy === 'pdf'} onClick={() => run('pdf')}>
            ⬇ PDF
          </button>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <StatCard label="Duplicate receipts" value={num(totals.groups)} tone="rose" icon="⚠️" sub="Reused UTX / receipt IDs" />
        <StatCard label="Blocked attempts" value={num(totals.attempts)} tone="amber" icon="🚫" sub="Rejected duplicate submissions" />
        <StatCard label="Students involved" value={num(totals.students)} tone="indigo" icon="🎓" sub="Attempted to reuse an ID" />
      </div>

      <div className="toolbar">
        <div className="search">
          <Input
            placeholder="Search by receipt / UTR ID…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setQ('');
            setPage(1);
          }}
        >
          Clear
        </button>
      </div>

      {loading ? (
        <SectionCard>
          <Spinner label="Loading duplicates…" />
        </SectionCard>
      ) : rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon="✅"
            title="No duplicates found"
            hint="When a student tries to reuse a receipt or UTR ID that is already recorded, they will appear here."
          />
        </SectionCard>
      ) : (
        <>
          {rows.map((g) => (
            <div className="card" key={g.id}>
              <header className="card-head">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`chip chip-${g.kind === 'receiptNo' ? 'indigo' : 'amber'}`}>{g.kindLabel}</span>
                    <span className="mono">{g.reference}</span>
                  </h3>
                  <p className="muted small">
                    {num(g.paidCount)} recorded payment{g.paidCount === 1 ? '' : 's'} ·{' '}
                    {num(g.attemptCount)} blocked attempt{g.attemptCount === 1 ? '' : 's'} ·{' '}
                    {num(g.studentCount)} student{g.studentCount === 1 ? '' : 's'} involved
                  </p>
                </div>
                {g.attemptCount > 0 && (
                  <div className="card-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setToClear(g)}>
                      Clear
                    </button>
                  </div>
                )}
              </header>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Roll No.</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Branch</th>
                      <th>Year</th>
                      <th>Sec</th>
                      <th>Fee Type</th>
                      <th>Term</th>
                      <th>Method</th>
                      <th className="right">Amount</th>
                      <th>Date</th>
                      <th>Submitted By</th>
                      <th>Already Used By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.students.map((s, i) => (
                      <tr key={`${s.source}-${s.rollNumber}-${i}`}>
                        <td>
                          <span className={`chip chip-${s.source === 'paid' ? 'emerald' : 'rose'}`}>
                            {s.source === 'paid' ? 'Recorded' : 'Blocked'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{s.rollNumber || '—'}</td>
                        <td>{s.name || '—'}</td>
                        <td>{s.phone || '—'}</td>
                        <td>{s.branch || '—'}</td>
                        <td>{s.year || '—'}</td>
                        <td>{s.section || '—'}</td>
                        <td>{categoryLabel[s.category] || s.category || '—'}</td>
                        <td className="small">{s.category === 'mess' ? '—' : s.term ? `Term ${s.term}` : '—'}</td>
                        <td>{methodLabel[s.method] || s.method || '—'}</td>
                        <td className="right" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                          {inr(s.amount)}
                        </td>
                        <td>{s.paidOn ? formatDate(s.paidOn) : '—'}</td>
                        <td className="small">
                          {s.submittedBy}
                          {s.attemptedBy ? ` · ${s.attemptedBy}` : ''}
                        </td>
                        <td className="small">{s.conflicting || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="space-between" style={{ marginTop: '1rem' }}>
            <span className="muted small">
              Page {page} of {pages} · {num(total)} duplicate receipt{total === 1 ? '' : 's'}
            </span>
            <div className="inline">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </button>
              <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(toClear)}
        title="Clear these duplicate records?"
        message={
          toClear
            ? `Remove the ${toClear.attemptCount} blocked attempt(s) logged for ${toClear.reference}? The recorded payment is not affected.`
            : ''
        }
        confirmLabel="Clear records"
        busy={busy === 'clear'}
        onConfirm={clearGroup}
        onClose={() => setToClear(null)}
      />
    </>
  );
}
