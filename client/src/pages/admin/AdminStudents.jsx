import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api.js';
import { inr, num, quotaShort, quotaTone } from '../../format.js';
import {
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Spinner,
  StatusBadge,
  useToast,
} from '../../components/ui.jsx';
import StudentFormModal from '../../components/StudentFormModal.jsx';
import BulkImportModal from '../../components/BulkImportModal.jsx';
import ManageFeesModal from '../../components/ManageFeesModal.jsx';
import { exportToExcel, exportToPdf } from '../../export.js';

const LIMIT = 20;

const STATUS_LABEL = { paid: 'Fully Paid', partial: 'Partial', unpaid: 'Unpaid' };

const EXPORT_COLUMNS = [
  { header: 'Roll No.', get: (s) => s.rollNumber },
  { header: 'Name', get: (s) => s.name },
  { header: 'College', get: (s) => s.college || '' },
  { header: 'Branch', get: (s) => s.branch || '' },
  { header: 'Year', get: (s) => s.year || '' },
  { header: 'Quota', get: (s) => s.quota },
  { header: 'Student Phone', get: (s) => s.phone || '' },
  { header: 'Address', get: (s) => s.address || '' },
  { header: 'Tuition Fee', get: (s) => Number(s.tuitionFee || 0), money: true },
  { header: 'Hostel Fee', get: (s) => Number(s.hostelFee || 0), money: true },
  { header: 'Mess Fee', get: (s) => Number(s.messFee || 0), money: true },
  { header: 'Grand Total', get: (s) => Number(s.totalFee || 0), money: true },
  { header: 'Paid', get: (s) => Number(s.totalPaid || 0), money: true },
  { header: 'Due', get: (s) => Number(s.totalDue || 0), money: true },
  { header: 'Status', get: (s) => STATUS_LABEL[s.status] || s.status || '' },
];

export default function AdminStudents() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [quota, setQuota] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [manageId, setManageId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/students${qs({ q, status, quota, page, limit: LIMIT })}`);
      setRows(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, status, quota, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/students/${toDelete.id}`, { method: 'DELETE' });
      toast.success(`${toDelete.rollNumber} and all fee records deleted.`);
      setToDelete(null);
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  // Export ALL students matching the current filters (not just the visible page).
  const exportData = async (kind) => {
    setExporting(kind);
    try {
      const res = await api(`/students${qs({ q, status, quota, page: 1, limit: 500 })}`);
      const rows = res.data || [];
      if (!rows.length) {
        toast.info('Nothing to export for the current filters.');
        return;
      }
      const fees = rows.reduce(
        (a, s) => ({ total: a.total + Number(s.totalFee || 0), paid: a.paid + Number(s.totalPaid || 0), due: a.due + Number(s.totalDue || 0) }),
        { total: 0, paid: 0, due: 0 },
      );
      const filters = [q && `search "${q}"`, status && `status ${STATUS_LABEL[status]}`, quota && `quota ${quota}`].filter(Boolean).join(', ');
      const opts = {
        columns: EXPORT_COLUMNS,
        rows,
        filename: `Students_${new Date().toISOString().slice(0, 10)}.${kind === 'excel' ? 'xlsx' : 'pdf'}`,
        title: 'Student Fee Report',
        subtitle: `${rows.length} students${filters ? ` · ${filters}` : ''} · Total ${inr(fees.total)} · Paid ${inr(fees.paid)} · Due ${inr(fees.due)}`,
      };
      if (kind === 'excel') await exportToExcel({ ...opts, sheetName: 'Students' });
      else await exportToPdf(opts);
      toast.success(`${kind === 'excel' ? 'Excel' : 'PDF'} downloaded (${rows.length} students).`);
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting('');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Students</h1>
          <p className="muted">
            {num(total)} student{total === 1 ? '' : 's'} · manage roll numbers, total fees and dues.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" disabled={!!exporting} onClick={() => exportData('excel')}>
            {exporting === 'excel' ? 'Exporting…' : '⬇ Excel'}
          </button>
          <button className="btn btn-ghost" disabled={!!exporting} onClick={() => exportData('pdf')}>
            {exporting === 'pdf' ? 'Exporting…' : '⬇ PDF'}
          </button>
          <button className="btn btn-ghost" onClick={() => setBulkOpen(true)}>
            ⬆ Bulk import
          </button>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + Add student
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Input
            placeholder="Search by roll number, name, college, branch, phone or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="paid">Fully paid</option>
          <option value="partial">Partially paid</option>
          <option value="unpaid">Unpaid</option>
        </Select>
        <Select value={quota} onChange={(e) => { setQuota(e.target.value); setPage(1); }}>
          <option value="">All quotas</option>
          <option value="ACAT">ACAT</option>
          <option value="BCAT">BCAT</option>
          <option value="SPOT">SPOT</option>
        </Select>
        <button className="btn btn-ghost" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner label="Loading students…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="No students found"
            hint={q || status ? 'Try a different search or filter.' : 'Add your first student or bulk import roll numbers.'}
            action={
              !q && !status ? (
                <button className="btn btn-primary" onClick={() => setAddOpen(true)} style={{ marginTop: '0.75rem' }}>
                  + Add student
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Roll No.</th>
                    <th>Student</th>
                    <th>College / Branch</th>
                    <th>Quota</th>
                    <th className="right">Grand Total</th>
                    <th className="right">Paid</th>
                    <th className="right">Due</th>
                    <th>Status</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.rollNumber}</td>
                      <td>
                        <div>{s.name}</div>
                        {s.phone && <div className="muted small">{s.phone}</div>}
                        {s.address && (
                          <div
                            className="muted small"
                            title={s.address}
                            style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {s.address}
                          </div>
                        )}
                      </td>
                      <td>
                        {s.college && <div style={{ fontWeight: 600 }}>{s.college}</div>}
                        <div className={s.college ? 'muted small' : ''}>
                          {s.branch || (s.college ? '' : '—')}
                          {s.year ? `${s.branch ? ' · ' : ''}Y${s.year}` : ''}
                        </div>
                      </td>
                      <td>
                        <span className={`chip chip-${quotaTone[s.quota] || 'indigo'}`}>{quotaShort[s.quota] || s.quota}</span>
                      </td>
                      <td className="right">{inr(s.totalFee)}</td>
                      <td className="right" style={{ color: 'var(--emerald)' }}>{inr(s.totalPaid)}</td>
                      <td className="right" style={{ color: s.totalDue > 0 ? 'var(--rose)' : 'var(--slate-500)', fontWeight: 600 }}>
                        {inr(s.totalDue)}
                      </td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => setManageId(s.id)}>
                            Fees
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditStudent(s)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setToDelete(s)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-between" style={{ marginTop: '1rem' }}>
              <span className="muted small">
                Page {page} of {pages} · showing {rows.length} of {num(total)}
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
      </div>

      <StudentFormModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <StudentFormModal
        open={Boolean(editStudent)}
        student={editStudent}
        onClose={() => setEditStudent(null)}
        onSaved={load}
      />
      <BulkImportModal open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={load} />
      <ManageFeesModal
        open={Boolean(manageId)}
        studentId={manageId}
        onClose={() => setManageId(null)}
        onChanged={load}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title={`Delete ${toDelete?.rollNumber || 'student'}?`}
        message="This permanently removes the student along with all their fee payments and messages. This cannot be undone."
        confirmLabel="Delete student"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
