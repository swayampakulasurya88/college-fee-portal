import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api.js';
import { categoryLabel, categoryTone, formatDate, inr, methodLabel, num, todayISO } from '../../format.js';
import {
  ConfirmDialog,
  EmptyState,
  Input,
  SectionCard,
  Select,
  Spinner,
  StatCard,
  useToast,
} from '../../components/ui.jsx';
import PaymentFormModal from '../../components/PaymentFormModal.jsx';

const LIMIT = 25;

export default function AdminPayments() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [sum, setSum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', category: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const res = await api(`/students${qs({ limit: 500 })}`);
      setStudents(res.data);
    } catch {
      /* non fatal - only needed for the add form */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/payments${qs({ ...filters, page, limit: LIMIT })}`);
      setRows(res.data);
      setTotal(res.total);
      setSum(res.sum);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page, toast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    load();
  }, [load]);

  const afterChange = () => {
    load();
    loadStudents();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/payments/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Payment deleted — the student’s due was updated.');
      setToDelete(null);
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else afterChange();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fee payments</h1>
          <p className="muted">Every payment recorded across all students.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
            + Add payment
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Payments in view" value={num(total)} tone="indigo" icon="🧾" />
        <StatCard label="Amount in view" value={inr(sum)} tone="emerald" icon="💰" sub="Sum of the current filter" />
      </div>

      <div className="toolbar">
        <div className="search">
          <Input
            placeholder="Search by roll number, student, receipt or note…"
            value={filters.q}
            onChange={setFilter('q')}
          />
        </div>
        <Select value={filters.category} onChange={setFilter('category')}>
          <option value="">All fee types</option>
          <option value="tuition">Tuition Fee</option>
          <option value="hostel">Hostel Fee</option>
          <option value="mess">Mess Fee</option>
        </Select>
        <Input type="date" value={filters.from} onChange={setFilter('from')} max={todayISO()} />
        <Input type="date" value={filters.to} onChange={setFilter('to')} max={todayISO()} />
        <button
          className="btn btn-ghost"
          onClick={() => {
            setFilters({ q: '', category: '', from: '', to: '' });
            setPage(1);
          }}
        >
          Clear
        </button>
      </div>

      <SectionCard>
        {loading ? (
          <Spinner label="Loading payments…" />
        ) : rows.length === 0 ? (
          <EmptyState icon="💰" title="No payments found" hint="Adjust the filters or record a new payment." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Roll No.</th>
                    <th>Student</th>
                    <th>Fee Type</th>
                    <th>Term</th>
                    <th>Method</th>
                    <th>Txn / Receipt</th>
                    <th>Note</th>
                    <th className="right">Amount</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.paidOn)}</td>
                      <td style={{ fontWeight: 700 }}>{p.rollNumber}</td>
                      <td>{p.studentName}</td>
                      <td>
                        <span className={`chip chip-${categoryTone[p.category] || 'indigo'}`}>
                          {categoryLabel[p.category] || p.category}
                        </span>
                      </td>
                      <td className="small">{p.category === 'mess' ? '—' : p.term ? `Term ${p.term}` : '—'}</td>
                      <td>
                        <span className="chip">{methodLabel[p.method] || p.method}</span>
                      </td>
                      <td className="small">{p.transactionId || p.receiptNo || '—'}</td>
                      <td className="muted small">{p.note || '—'}</td>
                      <td className="right" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                        {inr(p.amount)}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditPayment(p)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setToDelete(p)}>
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
                Page {page} of {pages} · {num(total)} payments
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
      </SectionCard>

      <PaymentFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={afterChange}
        students={students}
      />
      <PaymentFormModal
        open={Boolean(editPayment)}
        payment={editPayment}
        onClose={() => setEditPayment(null)}
        onSaved={afterChange}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this payment?"
        message={
          toDelete
            ? `Remove the ${inr(toDelete.amount)} payment for ${toDelete.rollNumber}? The student's due will increase.`
            : ''
        }
        confirmLabel="Delete payment"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
