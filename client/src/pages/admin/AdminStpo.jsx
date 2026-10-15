import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../../api.js';
import { inr, num } from '../../format.js';
import { Spinner, StatusBadge, useToast } from '../../components/ui.jsx';
import { exportToExcel, exportToPdf } from '../../export.js';
import { STPO_CLASS_ID, STPO_TEAMS } from '../../data/stpoTeams.js';

// Columns used by both the on-screen table and the exports.
const EXPORT_COLUMNS = [
  { header: 'Team', get: (r) => r.team },
  { header: 'S.No', get: (r) => r.sno },
  { header: 'Roll No.', get: (r) => r.rollNumber },
  { header: 'Name', get: (r) => r.name },
  { header: 'Level', get: (r) => r.level },
  { header: 'Student Phone', get: (r) => r.studentPhone },
  { header: 'Parent Phone', get: (r) => r.parentPhone },
  { header: 'Total Fee', get: (r) => r.totalFee, money: true },
  { header: 'Paid', get: (r) => r.totalPaid, money: true },
  { header: 'Due', get: (r) => r.totalDue, money: true },
  { header: 'Status', get: (r) => r.statusLabel },
];

export default function AdminStpo() {
  const toast = useToast();
  const [byRoll, setByRoll] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch every student once, then pick the STPO members out of the map.
      const res = await api(`/students${qs({ limit: 500 })}`);
      const map = {};
      (res.data || []).forEach((s) => {
        map[s.rollNumber] = s;
      });
      setByRoll(map);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Merge the fixed roster with the live fee figures from the database.
  const teams = useMemo(
    () =>
      STPO_TEAMS.map((group) => ({
        team: group.team,
        rows: group.members.map((m, i) => {
          const s = byRoll[m.rollNumber] || {};
          return {
            team: group.team,
            sno: i + 1,
            rollNumber: m.rollNumber,
            name: s.name || m.name,
            level: m.level,
            studentPhone: m.studentPhone,
            parentPhone: m.parentPhone,
            totalFee: s.totalFee || 0,
            totalPaid: s.totalPaid || 0,
            totalDue: s.totalDue || 0,
            status: s.status || 'unpaid',
            statusLabel: { paid: 'Fully Paid', partial: 'Partial', unpaid: 'Unpaid' }[s.status] || '—',
            linked: Boolean(s.id),
          };
        }),
      })),
    [byRoll],
  );

  const flat = useMemo(() => teams.flatMap((t) => t.rows), [teams]);

  const totals = useMemo(
    () =>
      flat.reduce(
        (acc, r) => ({
          fee: acc.fee + r.totalFee,
          paid: acc.paid + r.totalPaid,
          due: acc.due + r.totalDue,
        }),
        { fee: 0, paid: 0, due: 0 },
      ),
    [flat],
  );

  const missing = flat.filter((r) => !r.linked).length;

  const filename = (ext) => `STPO_${STPO_CLASS_ID}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  const run = async (kind) => {
    setBusy(kind);
    try {
      const opts = {
        columns: EXPORT_COLUMNS,
        rows: flat,
        filename: filename(kind === 'excel' ? 'xlsx' : 'pdf'),
        title: `STPO Report · Class ${STPO_CLASS_ID}`,
        subtitle: `${flat.length} students across ${STPO_TEAMS.length} teams · Total ${inr(totals.fee)} · Due ${inr(totals.due)}`,
      };
      if (kind === 'excel') await exportToExcel({ ...opts, sheetName: 'STPO' });
      else await exportToPdf(opts);
      toast.success(`STPO ${kind === 'excel' ? 'Excel' : 'PDF'} downloaded.`);
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>STPO</h1>
          <p className="muted">
            {num(flat.length)} students · {STPO_TEAMS.length} teams · class <b>{STPO_CLASS_ID}</b>
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
        <div className="stat-card stat-indigo">
          <div className="stat-label">Students</div>
          <div className="stat-value">{num(flat.length)}</div>
          <div className="stat-sub">across {STPO_TEAMS.length} teams</div>
        </div>
        <div className="stat-card stat-amber">
          <div className="stat-label">Total Fee</div>
          <div className="stat-value">{inr(totals.fee)}</div>
        </div>
        <div className="stat-card stat-emerald">
          <div className="stat-label">Collected</div>
          <div className="stat-value">{inr(totals.paid)}</div>
        </div>
        <div className="stat-card stat-rose">
          <div className="stat-label">Pending Due</div>
          <div className="stat-value">{inr(totals.due)}</div>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <Spinner label="Loading STPO students…" />
        </div>
      ) : (
        <>
          {missing > 0 && (
            <p className="muted small" style={{ marginBottom: '0.75rem' }}>
              ⚠ {missing} student{missing === 1 ? '' : 's'} in this list have no record in the portal yet — their fees show as ₹0.
            </p>
          )}

          {teams.map((group) => {
            const gTotals = group.rows.reduce(
              (a, r) => ({ fee: a.fee + r.totalFee, paid: a.paid + r.totalPaid, due: a.due + r.totalDue }),
              { fee: 0, paid: 0, due: 0 },
            );
            return (
              <div className="card" key={group.team + group.rows[0]?.rollNumber}>
                <header className="card-head">
                  <div>
                    <h3>{group.team}</h3>
                    <p className="muted small">
                      {group.rows.length} member{group.rows.length === 1 ? '' : 's'} · Due {inr(gTotals.due)} of {inr(gTotals.fee)}
                    </p>
                  </div>
                </header>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Roll No.</th>
                        <th>Name</th>
                        <th>Level</th>
                        <th>Student Phone</th>
                        <th>Parent Phone</th>
                        <th className="right">Total Fee</th>
                        <th className="right">Paid</th>
                        <th className="right">Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((r) => (
                        <tr key={r.rollNumber}>
                          <td className="muted">{r.sno}</td>
                          <td style={{ fontWeight: 700 }}>{r.rollNumber}</td>
                          <td>{r.name}</td>
                          <td>{r.level === '-' ? <span className="muted">—</span> : <span className="chip chip-indigo">{r.level}</span>}</td>
                          <td>{r.studentPhone}</td>
                          <td>{r.parentPhone}</td>
                          <td className="right">{inr(r.totalFee)}</td>
                          <td className="right" style={{ color: 'var(--emerald)' }}>{inr(r.totalPaid)}</td>
                          <td className="right" style={{ color: r.totalDue > 0 ? 'var(--rose)' : 'var(--slate-500)', fontWeight: 600 }}>
                            {inr(r.totalDue)}
                          </td>
                          <td><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} style={{ fontWeight: 700, textAlign: 'right' }}>Team total</td>
                        <td className="right" style={{ fontWeight: 700 }}>{inr(gTotals.fee)}</td>
                        <td className="right" style={{ fontWeight: 700, color: 'var(--emerald)' }}>{inr(gTotals.paid)}</td>
                        <td className="right" style={{ fontWeight: 700, color: 'var(--rose)' }}>{inr(gTotals.due)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
