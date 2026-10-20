import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api.js';
import { formatDateTime, num } from '../../format.js';
import {
  ConfirmDialog,
  EmptyState,
  Input,
  SectionCard,
  Select,
  Spinner,
  useToast,
} from '../../components/ui.jsx';

const LIMIT = 25;

const ENTITY_META = {
  student: { label: 'Student', chip: 'indigo', icon: '🎓' },
  payment: { label: 'Fee payment', chip: 'emerald', icon: '💰' },
  messBill: { label: 'Mess bill', chip: 'amber', icon: '🍽️' },
  termFee: { label: 'Term fee', chip: 'indigo', icon: '🧮' },
  message: { label: 'Message', chip: 'rose', icon: '✉️' },
};

/**
 * The recycle bin: every deleted record (students take their payments, term
 * fees, mess bills and messages with them) is listed here and can be brought
 * back with one click.
 */
export default function AdminTrash() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [action, setAction] = useState(null); // { row, mode: 'restore' | 'purge' }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/trash${qs({ q, entity, page, limit: LIMIT })}`);
      setRows(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, entity, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  const runAction = async () => {
    if (!action) return;
    const { row, mode } = action;
    setBusy(mode);
    try {
      if (mode === 'restore') {
        const res = await api(`/trash/${row.id}/restore`, { method: 'POST' });
        toast.success(res.message || 'Restored.');
      } else {
        const res = await api(`/trash/${row.id}`, { method: 'DELETE' });
        toast.success(res.message || 'Permanently deleted.');
      }
      setAction(null);
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
          <h1>Deleted</h1>
          <p className="muted">
            Everything removed from the portal lands here first — restore it with one click. Deleting a student
            also archives their payments, term fees, mess bills and messages.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Input
            placeholder="Search by student, roll number, receipt / UTR, month…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          <option value="student">Students</option>
          <option value="payment">Fee payments</option>
          <option value="messBill">Mess bills</option>
          <option value="termFee">Term fees</option>
          <option value="message">Messages</option>
        </Select>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setQ('');
            setEntity('');
            setPage(1);
          }}
        >
          Clear
        </button>
      </div>

      {loading ? (
        <SectionCard>
          <Spinner label="Loading deleted items…" />
        </SectionCard>
      ) : rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon="🗑️"
            title="Nothing is waiting here"
            hint="Deleted students, payments, mess bills, term fees and messages show up on this page so they can be restored."
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Deleted items" subtitle={`${num(total)} item${total === 1 ? '' : 's'} · newest first`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Deleted at</th>
                    <th>Type</th>
                    <th>Item</th>
                    <th>Details</th>
                    <th className="right">Records</th>
                    <th>Deleted by</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const meta = ENTITY_META[r.entity] || { label: r.entity, chip: 'neutral', icon: '📄' };
                    return (
                      <tr key={r.id}>
                        <td className="small">{formatDateTime(r.deletedAt)}</td>
                        <td>
                          <span className={`chip chip-${meta.chip}`}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{r.label || '—'}</td>
                        <td className="small muted">{r.summary || r.reference || '—'}</td>
                        <td className="right">{num(r.recordCount)}</td>
                        <td className="small">{r.deletedBy || 'admin'}</td>
                        <td className="right">
                          <span className="inline">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setAction({ row: r, mode: 'restore' })}
                            >
                              ↩ Restore
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setAction({ row: r, mode: 'purge' })}
                            >
                              Delete forever
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="space-between" style={{ marginTop: '1rem' }}>
            <span className="muted small">
              Page {page} of {pages} · {num(total)} deleted item{total === 1 ? '' : 's'}
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
        open={Boolean(action)}
        title={action?.mode === 'restore' ? 'Restore this record?' : 'Delete forever?'}
        message={
          action
            ? action.mode === 'restore'
              ? `Put ${action.row.label || 'this record'} back (${num(action.row.recordCount)} record(s))${
                  action.row.entity === 'student'
                    ? ', including their payments, term fees, mess bills and messages'
                    : ''
                }. It will reappear in its own list.`
              : `Permanently forget ${action.row.label || 'this record'}? This cannot be undone — it will no longer be restorable.`
            : ''
        }
        confirmLabel={action?.mode === 'restore' ? 'Restore' : 'Delete forever'}
        busy={busy === action?.mode}
        onConfirm={runAction}
        onClose={() => setAction(null)}
      />
    </>
  );
}
