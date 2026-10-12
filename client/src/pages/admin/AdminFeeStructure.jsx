import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../../api.js';
import {
  HEAD_TERMS,
  TERM_RATES,
  categoryShort,
  categoryTone,
  inr,
  num,
  quotaLabel,
  quotaShort,
  quotaTone,
} from '../../format.js';
import {
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

const HEADS = ['tuition', 'hostel'];
const QUOTAS = ['ACAT', 'BCAT', 'SPOT'];

const termsFor = (head) => Array.from({ length: HEAD_TERMS[head] }, (_, i) => i + 1);

export default function AdminFeeStructure() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    head: 'tuition',
    terms: [1, 2, 3, 4],
    amount: '',
    note: '',
    target: 'ACAT',
  });
  const [selected, setSelected] = useState([]);
  const [studentFilter, setStudentFilter] = useState({ q: '', quota: '' });

  const [filters, setFilters] = useState({ head: '', term: '', quota: '', q: '' });
  const [picker, setPicker] = useState({ q: '', quota: '' });
  const [editing, setEditing] = useState(null); // { id, amount, note }
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

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api('/fees/summary'));
    } catch (err) {
      toast.error(err.message);
    }
  }, [toast]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/fees${qs({ ...filters, limit: 500 })}`);
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const termsForHead = useMemo(
    () => Array.from({ length: HEAD_TERMS[form.head] }, (_, i) => i + 1),
    [form.head],
  );

  const filteredStudents = useMemo(() => {
    const q = picker.q.trim().toLowerCase();
    return students.filter((s) => {
      if (picker.quota && s.quota !== picker.quota) return false;
      if (!q) return true;
      return s.rollNumber.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    });
  }, [students, picker]);

  const toggleTerm = (term) =>
    setForm((f) => ({
      ...f,
      terms: f.terms.includes(term) ? f.terms.filter((t) => t !== term) : [...f.terms, term].sort((a, b) => a - b),
    }));

  const chooseHead = (head) =>
    setForm((f) => ({ ...f, head, terms: Array.from({ length: HEAD_TERMS[head] }, (_, i) => i + 1) }));

  const applyPreset = (quota) => {
    const rate = TERM_RATES[quota];
    setForm((f) => ({
      ...f,
      head: 'tuition',
      terms: [1, 2, 3, 4],
      amount: String(rate.tuition),
      target: quota,
    }));
  };

  const applyHostelPreset = () => {
    setForm((f) => ({ ...f, head: 'hostel', terms: [1, 2], amount: String(TERM_RATES.ACAT.hostel), target: 'all' }));
  };

  const toggle = (id) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const submitBulk = async (e) => {
    e.preventDefault();
    if (!form.terms.length) return toast.error('Tick at least one term.');
    if (form.amount === '' || Number(form.amount) < 0) return toast.error('Enter the amount per term.');
    if (form.target === 'selected' && selected.length === 0) {
      return toast.error('Select at least one student, or choose a quota / all students.');
    }

    setBusy(true);
    try {
      const body = {
        head: form.head,
        terms: form.terms,
        amount: Number(form.amount || 0),
        note: form.note.trim(),
      };
      if (form.target === 'selected') body.studentIds = selected;
      else if (form.target !== 'all') body.quota = form.target;

      const res = await api('/fees/bulk', { method: 'POST', body });
      toast.success(
        `${categoryShort[form.head]} · term${res.terms.length === 1 ? '' : 's'} ${res.terms.join(', ')} saved for ${res.students} student(s) — ${res.created} added, ${res.updated} updated.`,
      );
      setSelected([]);
      await Promise.all([loadRows(), loadSummary()]);
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
      await api(`/fees/${editing.id}`, {
        method: 'PATCH',
        body: { amount: Number(editing.amount || 0), note: editing.note },
      });
      toast.success('Term fee updated.');
      setEditing(null);
      await Promise.all([loadRows(), loadSummary()]);
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
      await api(`/fees/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Term fee deleted.');
      setToDelete(null);
      await Promise.all([loadRows(), loadSummary(), loadStudents()]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const tuitionBilled = summary?.byHead?.tuition?.amount || 0;
  const hostelBilled = summary?.byHead?.hostel?.amount || 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Fee structure</h1>
          <p className="muted">
            Assign fixed fees <strong>term-wise</strong>. Tuition runs across 4 terms and hostel across 2 — pick a
            term, a quota and set the amount in bulk.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => { loadStudents(); loadSummary(); loadRows(); }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Tuition billed · college" value={inr(tuitionBilled)} tone="indigo" icon="🎓" sub={`across 4 terms · ${num(summary?.students?.total || 0)} students`} />
        <StatCard label="Hostel billed · college" value={inr(hostelBilled)} tone="amber" icon="🏠" sub="across 2 terms" />
        <StatCard label="Total fixed fees" value={inr(tuitionBilled + hostelBilled)} tone="emerald" icon="🧾" sub="Tuition + Hostel" />
        <StatCard
          label="Quota mix"
          value={`${num(summary?.students?.ACAT || 0)} / ${num(summary?.students?.BCAT || 0)} / ${num(summary?.students?.SPOT || 0)}`}
          tone="rose"
          icon="🎯"
          sub="ACAT / BCAT / Spot"
        />
      </div>

      <SectionCard title="Assign fees term-wise" subtitle="Choose the head, the term(s), who it applies to, and the amount per term">
        <div className="inline" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyPreset('ACAT')}>
            ACAT tuition ×4 · ₹18,750
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyPreset('BCAT')}>
            BCAT tuition ×4 · ₹31,250
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyPreset('SPOT')}>
            Spot tuition ×4 · ₹31,250
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={applyHostelPreset}>
            Hostel ×2 · ₹25,000
          </button>
        </div>

        <form onSubmit={submitBulk}>
          <div className="grid-3">
            <Field label="Fee head" required>
              <Select value={form.head} onChange={(e) => chooseHead(e.target.value)}>
                <option value="tuition">Tuition Fee</option>
                <option value="hostel">Hostel Fee</option>
              </Select>
            </Field>
            <Field label="Apply to" required>
              <Select value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}>
                <option value="all">All active students</option>
                <option value="ACAT">ACAT quota only</option>
                <option value="BCAT">BCAT quota only</option>
                <option value="SPOT">SPOT quota only</option>
                <option value="selected">Selected students…</option>
              </Select>
            </Field>
            <Field label="Amount per term (₹)" required>
              <Input type="number" min="0" step="1" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder={form.head === 'tuition' ? '18750' : '25000'} />
            </Field>
          </div>

          <div className="grid-2">
            <div className="field">
              <span className="field-label">
                Terms <b className="req">*</b>
              </span>
              <div className="inline" style={{ flexWrap: 'wrap' }}>
                {termsForHead.map((t) => (
                  <label key={t} className="inline">
                    <input type="checkbox" checked={form.terms.includes(t)} onChange={() => toggleTerm(t)} />
                    <span>Term {t}</span>
                  </label>
                ))}
              </div>
              <span className="field-hint">{categoryShort[form.head]} has {HEAD_TERMS[form.head]} terms.</span>
            </div>
            <Field label="Note (optional)">
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Tuition installment 1" />
            </Field>
          </div>

          {form.target === 'selected' && (
            <>
              <div className="toolbar" style={{ marginBottom: '0.6rem' }}>
                <div className="search">
                  <Input
                    placeholder="Filter students by roll number or name…"
                    value={picker.q}
                    onChange={(e) => setPicker((p) => ({ ...p, q: e.target.value }))}
                  />
                </div>
                <Select value={picker.quota} onChange={(e) => setPicker((p) => ({ ...p, quota: e.target.value }))}>
                  <option value="">All quotas</option>
                  <option value="ACAT">ACAT</option>
                  <option value="BCAT">BCAT</option>
                  <option value="SPOT">SPOT</option>
                </Select>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelected((list) => [...new Set([...list, ...filteredStudents.map((s) => s.id)])])}
                >
                  Select all shown
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setSelected([])}>
                  Clear ({selected.length})
                </button>
              </div>

              <div className="card" style={{ maxHeight: 240, overflowY: 'auto', padding: '0.6rem 0.75rem' }}>
                {filteredStudents.length === 0 ? (
                  <p className="muted small">No students match this filter.</p>
                ) : (
                  filteredStudents.map((s) => (
                    <label key={s.id} className="list-row" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                      <span className="list-row-main">
                        <strong>
                          {s.rollNumber} — {s.name}
                        </strong>
                        <span>
                          {s.college || '—'} · {quotaLabel[s.quota] || s.quota} · tuition {inr(s.tuitionFee)} · hostel {inr(s.hostelFee)}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </>
          )}

          <div className="space-between" style={{ marginTop: '0.9rem' }}>
            <span className="muted small">
              {form.target === 'selected'
                ? `${selected.length} student(s) selected.`
                : form.target === 'all'
                  ? 'All active students will be billed.'
                  : `${form.target} quota students will be billed.`}
            </span>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : `Apply ${categoryShort[form.head]} · term ${form.terms.join(', ') || '—'}`}
            </button>
          </div>
        </form>
      </SectionCard>

      {summary?.data?.length ? (
        <SectionCard title="College term-wise totals" subtitle="How much is billed in each term" style={{ marginTop: '1.25rem' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Head</th>
                  <th>Term</th>
                  <th className="right">Students</th>
                  <th className="right">Amount billed</th>
                </tr>
              </thead>
              <tbody>
                {summary.data.map((r) => (
                  <tr key={`${r.head}-${r.term}`}>
                    <td>
                      <span className={`chip chip-${categoryTone[r.head]}`}>{categoryShort[r.head]}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>Term {r.term}</td>
                    <td className="right">{num(r.students)}</td>
                    <td className="right" style={{ fontWeight: 700 }}>{inr(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Term fee records"
        subtitle={`${num(rows.length)} record(s) shown`}
        style={{ marginTop: '1.25rem' }}
      >
        <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
          <Select value={filters.head} onChange={setFilter('head')}>
            <option value="">All heads</option>
            <option value="tuition">Tuition</option>
            <option value="hostel">Hostel</option>
          </Select>
          <Select value={filters.term} onChange={setFilter('term')}>
            <option value="">All terms</option>
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>Term {t}</option>
            ))}
          </Select>
          <Select value={filters.quota} onChange={setFilter('quota')}>
            <option value="">All quotas</option>
            <option value="ACAT">ACAT</option>
            <option value="BCAT">BCAT</option>
            <option value="SPOT">SPOT</option>
          </Select>
          <div className="search">
            <Input placeholder="Search roll number or name…" value={filters.q} onChange={setFilter('q')} />
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading term fees…" />
        ) : rows.length === 0 ? (
          <EmptyState icon="🧮" title="No term fees found" hint="Assign fees above, or change the filters." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Student</th>
                  <th>Quota</th>
                  <th>Head</th>
                  <th>Term</th>
                  <th className="right">Amount</th>
                  <th>Note</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.rollNumber}</td>
                    <td>{r.studentName}</td>
                    <td>
                      <span className={`chip chip-${quotaTone[r.quota] || 'indigo'}`}>{quotaShort[r.quota] || r.quota}</span>
                    </td>
                    <td>
                      <span className={`chip chip-${categoryTone[r.head]}`}>{categoryShort[r.head]}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>Term {r.term}</td>
                    <td className="right" style={{ fontWeight: 700 }}>
                      {editing?.id === r.id ? (
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={editing.amount}
                          onChange={(e) => setEditing((x) => ({ ...x, amount: e.target.value }))}
                        />
                      ) : (
                        inr(r.amount)
                      )}
                    </td>
                    <td className="muted small">
                      {editing?.id === r.id ? (
                        <Input value={editing.note} onChange={(e) => setEditing((x) => ({ ...x, note: e.target.value }))} />
                      ) : (
                        r.note || '—'
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {editing?.id === r.id ? (
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
                              onClick={() => setEditing({ id: r.id, amount: r.amount, note: r.note || '' })}
                            >
                              Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setToDelete(r)}>
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this term fee?"
        message={
          toDelete
            ? `Remove ${inr(toDelete.amount)} for ${categoryShort[toDelete.head]} term ${toDelete.term} of ${toDelete.rollNumber}?`
            : ''
        }
        confirmLabel="Delete term fee"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
