import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../../api.js';
import { currentMonth, inr, monthLabel, num } from '../../format.js';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  SectionCard,
  Select,
  Spinner,
  StatCard,
  useToast,
} from '../../components/ui.jsx';

export default function AdminMess() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [bills, setBills] = useState([]);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [month, setMonth] = useState(currentMonth());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [applyAll, setApplyAll] = useState(false);
  const [selected, setSelected] = useState([]);
  const [studentFilter, setStudentFilter] = useState({ q: '', college: '' });

  const [editing, setEditing] = useState(null); // { id, month, amount, note }
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const res = await api(`/students${qs({ limit: 500 })}`);
      setStudents(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/mess${qs({ month, limit: 500 })}`);
      setBills(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  const loadMonths = useCallback(async () => {
    try {
      const res = await api('/mess/months');
      setMonths(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Reload just the bills when the selected month changes.
  useEffect(() => {
    loadBills();
  }, [loadBills]);

  useEffect(() => {
    loadMonths();
  }, [loadMonths]);

  const filteredStudents = useMemo(() => {
    const q = studentFilter.q.trim().toLowerCase();
    return students.filter((s) => {
      if (studentFilter.college && s.college !== studentFilter.college) return false;
      if (!q) return true;
      return (
        s.rollNumber.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.branch || '').toLowerCase().includes(q)
      );
    });
  }, [students, studentFilter]);

  const toggle = (id) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((s) => s.id);
    setSelected((list) => [...new Set([...list, ...ids])]);
  };

  const submitBulk = async (e) => {
    e.preventDefault();
    if (!applyAll && selected.length === 0) {
      return toast.error('Select at least one student, or tick “Apply to all students”.');
    }
    if (amount === '' || Number(amount) < 0) return toast.error('Enter the mess amount.');

    setBusy(true);
    try {
      const res = await api('/mess/bulk', {
        method: 'POST',
        body: {
          month,
          amount: Number(amount || 0),
          note: note.trim(),
          ...(applyAll ? { applyAll: true } : { studentIds: selected }),
        },
      });
      toast.success(
        `Mess fee for ${monthLabel(month)} saved — ${res.created} added, ${res.updated} updated.`,
      );
      setAmount('');
      setNote('');
      setSelected([]);
      setApplyAll(false);
      await Promise.all([loadBills(), loadMonths()]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api(`/mess/${editing.id}`, {
        method: 'PATCH',
        body: { amount: Number(editing.amount || 0), note: editing.note, month: editing.month },
      });
      toast.success('Mess bill updated.');
      setEditing(null);
      await Promise.all([loadBills(), loadMonths()]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/mess/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Mess bill deleted.');
      setToDelete(null);
      await Promise.all([loadBills(), loadMonths()]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const monthTotal = bills.reduce((sum, b) => sum + b.amount, 0);
  const allTimeTotal = months.reduce((sum, m) => sum + m.amount, 0);
  const allTimeBills = months.reduce((sum, m) => sum + m.students, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mess fees</h1>
          <p className="muted">
            Import the monthly mess fee for chosen students. Each month adds to the student&apos;s total fee.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => { loadStudents(); loadMonths(); loadBills(); }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label={`Mess billed · ${monthLabel(month)}`} value={inr(monthTotal)} tone="indigo" icon="🍽️" sub={`${num(bills.length)} students`} />
        <StatCard label="Mess collected · all months" value={inr(allTimeTotal)} tone="emerald" icon="💰" sub={`${num(allTimeBills)} bills in total`} />
        <StatCard label="Students on record" value={num(students.length)} tone="amber" icon="🎓" sub="Choose who gets a mess charge" />
      </div>

      <SectionCard title="Import monthly mess fee" subtitle="Bulk-add a month's mess amount to the selected students">
        <form onSubmit={submitBulk}>
          <div className="grid-3">
            <Field label="Month" required>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Field label="Amount per student (₹)" required>
              <Input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="3500" />
            </Field>
            <Field label="Note (optional)">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Hostel mess" />
            </Field>
          </div>

          <label className="inline" style={{ margin: '0.25rem 0 0.75rem' }}>
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            <span>
              Apply to <strong>all active students</strong> (ignore the selection below)
            </span>
          </label>

          <div className="toolbar" style={{ marginBottom: '0.6rem' }}>
            <div className="search">
              <Input
                placeholder="Filter students by roll number, name or branch…"
                value={studentFilter.q}
                onChange={(e) => setStudentFilter((f) => ({ ...f, q: e.target.value }))}
                disabled={applyAll}
              />
            </div>
            <Select
              value={studentFilter.college}
              onChange={(e) => setStudentFilter((f) => ({ ...f, college: e.target.value }))}
              disabled={applyAll}
            >
              <option value="">All colleges</option>
              <option value="KIET">KIET</option>
              <option value="KIEK">KIEK</option>
            </Select>
            <button type="button" className="btn btn-ghost" onClick={selectAllFiltered} disabled={applyAll}>
              Select all shown
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSelected([])} disabled={applyAll}>
              Clear ({selected.length})
            </button>
          </div>

          <div
            className="card"
            style={{
              maxHeight: 240,
              overflowY: 'auto',
              padding: '0.6rem 0.75rem',
              opacity: applyAll ? 0.5 : 1,
            }}
          >
            {filteredStudents.length === 0 ? (
              <p className="muted small">No students match this filter.</p>
            ) : (
              filteredStudents.map((s) => (
                <label key={s.id} className="list-row" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={applyAll}
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span className="list-row-main">
                    <strong>
                      {s.rollNumber} — {s.name}
                    </strong>
                    <span>
                      {[s.college, s.branch, s.year ? `Year ${s.year}` : ''].filter(Boolean).join(' · ') || '—'}
                      {s.messFee > 0 ? ` · mess so far ${inr(s.messFee)}` : ''}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="space-between" style={{ marginTop: '0.9rem' }}>
            <span className="muted small">
              {applyAll ? 'All active students will be billed.' : `${selected.length} student(s) selected.`}
            </span>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : `Import mess fee for ${monthLabel(month)}`}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title={`Mess bills · ${monthLabel(month)}`}
        subtitle={`${bills.length} bill(s) · total ${inr(monthTotal)}`}
        className="card"
        style={{ marginTop: '1.25rem' }}
      >
        {loading ? (
          <Spinner label="Loading mess bills…" />
        ) : bills.length === 0 ? (
          <EmptyState icon="🍽️" title="No mess bills for this month" hint="Import a monthly mess fee above." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Student</th>
                  <th>Month</th>
                  <th className="right">Amount</th>
                  <th>Note</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.rollNumber}</td>
                    <td>{b.studentName}</td>
                    <td>
                      {editing?.id === b.id ? (
                        <Input type="month" value={editing.month} onChange={(e) => setEditing((x) => ({ ...x, month: e.target.value }))} />
                      ) : (
                        monthLabel(b.month)
                      )}
                    </td>
                    <td className="right" style={{ fontWeight: 700 }}>
                      {editing?.id === b.id ? (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={editing.amount}
                          onChange={(e) => setEditing((x) => ({ ...x, amount: e.target.value }))}
                        />
                      ) : (
                        inr(b.amount)
                      )}
                    </td>
                    <td className="muted small">
                      {editing?.id === b.id ? (
                        <Input value={editing.note} onChange={(e) => setEditing((prev) => ({ ...prev, note: e.target.value }))} />
                      ) : (
                        b.note || '—'
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {editing?.id === b.id ? (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={busy}>
                              Save
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setEditing({ id: b.id, month: b.month, amount: b.amount, note: b.note || '' })}
                            >
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setToDelete(b)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>
                    Mess total · {monthLabel(month)}
                  </td>
                  <td className="right" style={{ fontWeight: 800 }}>
                    {inr(monthTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      {months.length > 0 && (
        <SectionCard title="Month-by-month totals" subtitle="Every mess import so far" style={{ marginTop: '1.25rem' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="right">Students billed</th>
                  <th className="right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td style={{ fontWeight: 600 }}>{monthLabel(m.month)}</td>
                    <td className="right">{num(m.students)}</td>
                    <td className="right" style={{ fontWeight: 700 }}>{inr(m.amount)}</td>
                    <td className="right">
                      <button className="btn btn-ghost btn-sm" onClick={() => setMonth(m.month)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this mess bill?"
        message={
          toDelete
            ? `Remove ${inr(toDelete.amount)} mess fee for ${toDelete.rollNumber} (${monthLabel(toDelete.month)})?`
            : ''
        }
        confirmLabel="Delete bill"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
