import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, qs } from '../../api.js';
import { num, quotaShort, quotaTone } from '../../format.js';
import { EmptyState, Input, Select, Spinner, useToast } from '../../components/ui.jsx';
import StudentAvatar from '../../components/StudentAvatar.jsx';
import StudentFormModal from '../../components/StudentFormModal.jsx';
import { useCustomFields } from '../student/studentShared.jsx';
import { exportToExcel, exportToPdf } from '../../export.js';

const LIMIT = 200;

// Every detail a student has on record — the table and both exports read from
// this one definition so what you see is exactly what you download.
function detailColumns(customFields = []) {
  return [
    { header: 'Roll No.', get: (s) => s.rollNumber || '' },
    { header: 'Name', get: (s) => s.name || '' },
    { header: 'College', get: (s) => s.college || '' },
    { header: 'Branch', get: (s) => s.branch || '' },
    { header: 'Year', get: (s) => s.year || '' },
    { header: 'Section', get: (s) => s.section || '' },
    { header: 'Quota', get: (s) => s.quota || '' },
    { header: 'Date of birth', get: (s) => s.dob || '' },
    { header: 'Gender', get: (s) => s.gender || '' },
    { header: 'Blood group', get: (s) => s.bloodGroup || '' },
    { header: "Father's name", get: (s) => s.fatherName || '' },
    { header: "Mother's name", get: (s) => s.motherName || '' },
    { header: 'Student phone', get: (s) => s.phone || '' },
    { header: 'Alternate phone', get: (s) => s.alternatePhone || '' },
    { header: 'Parent phone', get: (s) => s.parentPhone || '' },
    { header: 'Email', get: (s) => s.email || '' },
    { header: 'Staying', get: (s) => (s.hostel ? 'Hosteller' : 'Day scholar') },
    { header: 'Village / street', get: (s) => s.village || '' },
    { header: 'Mandal', get: (s) => s.mandal || '' },
    { header: 'District', get: (s) => s.district || '' },
    { header: 'State', get: (s) => s.state || '' },
    { header: 'PIN code', get: (s) => s.pincode || '' },
    { header: 'Full address', get: (s) => s.address || '' },
    {
      header: 'Emergency contact',
      get: (s) => [s.emergencyContactName, s.emergencyContactPhone].filter(Boolean).join(' · '),
    },
    ...customFields.map((f) => ({
      header: f.label,
      get: (s) => (s.customFields ? s.customFields[f.key] || '' : ''),
    })),
    { header: 'Loan', get: (s) => (s.loan ? 'Yes' : '') },
    { header: 'Profile filled', get: (s) => (s.photo ? 'Photo added' : 'No photo') },
  ];
}

const STATUS_LABEL = { paid: 'Fully Paid', partial: 'Partial', unpaid: 'Unpaid' };

export default function AdminStudentDetails() {
  const toast = useToast();
  const customFields = useCustomFields();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [quota, setQuota] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState('');
  const [editStudent, setEditStudent] = useState(null);

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
      const res = await api(`/students${qs({ q, quota, page, limit: LIMIT })}`);
      setRows(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, quota, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const columns = useMemo(() => detailColumns(customFields), [customFields]);

  const exportData = async (kind) => {
    setExporting(kind);
    try {
      const res = await api(`/students${qs({ q, quota, page: 1, limit: 500 })}`);
      const list = res.data || [];
      if (!list.length) {
        toast.info('Nothing to export for the current search.');
        return;
      }
      const opts = {
        columns,
        rows: list,
        filename: `Student_Details_${new Date().toISOString().slice(0, 10)}.${kind === 'excel' ? 'xlsx' : 'pdf'}`,
        title: 'Student Details',
        subtitle: `${list.length} student${list.length === 1 ? '' : 's'}${q ? ` · search "${q}"` : ''}${
          quota ? ` · quota ${quota}` : ''
        }`,
        orientation: 'landscape',
      };
      if (kind === 'excel') await exportToExcel({ ...opts, sheetName: 'Student Details' });
      else await exportToPdf(opts);
      toast.success(`${kind === 'excel' ? 'Excel' : 'PDF'} downloaded (${list.length} students).`);
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
          <h1>Student Details</h1>
          <p className="muted">
            {num(total)} student{total === 1 ? '' : 's'} · every detail each student has on record — personal,
            contact, address and extra fields.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" disabled={!!exporting} onClick={() => exportData('excel')}>
            {exporting === 'excel' ? 'Exporting…' : '⬇ Excel'}
          </button>
          <button className="btn btn-ghost" disabled={!!exporting} onClick={() => exportData('pdf')}>
            {exporting === 'pdf' ? 'Exporting…' : '⬇ PDF'}
          </button>
          <button className="btn btn-ghost" onClick={load}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Input
            placeholder="Search by roll number, name, father's name, village, PIN, extra fields…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={quota}
          onChange={(e) => {
            setQuota(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All quotas</option>
          <option value="ACAT">ACAT</option>
          <option value="BCAT">BCAT</option>
          <option value="SPOT">SPOT</option>
        </Select>
      </div>

      <div className="card">
        {loading ? (
          <Spinner label="Loading student details…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🧑🎓"
            title="No students found"
            hint={q ? 'Try a different search.' : 'Add students from the Students page first.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Roll No.</th>
                    <th>Student</th>
                    <th>Personal</th>
                    <th>Parents</th>
                    <th>Contact</th>
                    <th>Address</th>
                    <th>Extra details</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{s.rollNumber}</td>
                      <td>
                        <div className="inline" style={{ gap: '0.6rem', alignItems: 'center' }}>
                          <StudentAvatar student={s} size={38} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{s.name}</div>
                            <div className="muted small">
                              {[s.college, s.branch, s.year && `Y${s.year}`, s.section && `Sec ${s.section}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                            <span className={`chip chip-${quotaTone[s.quota] || 'indigo'}`} style={{ marginTop: 4 }}>
                              {quotaShort[s.quota] || s.quota}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="small">
                        <div>{s.dob || '—'}</div>
                        <div className="muted small">{s.gender || '—'}</div>
                        <div className="muted small">{s.bloodGroup ? `Blood ${s.bloodGroup}` : ''}</div>
                        <div className="muted small">{s.hostel ? '🏠 Hosteller' : '🚌 Day scholar'}</div>
                      </td>
                      <td className="small">
                        <div>
                          <span className="muted small">Father: </span>
                          {s.fatherName || '—'}
                        </div>
                        <div>
                          <span className="muted small">Mother: </span>
                          {s.motherName || '—'}
                        </div>
                      </td>
                      <td className="small">
                        <div>
                          <span className="muted small">Student: </span>
                          {s.phone || '—'}
                        </div>
                        <div>
                          <span className="muted small">Parent: </span>
                          {s.parentPhone || '—'}
                        </div>
                        {s.alternatePhone && (
                          <div>
                            <span className="muted small">Alt: </span>
                            {s.alternatePhone}
                          </div>
                        )}
                        {s.email && <div className="muted small">{s.email}</div>}
                      </td>
                      <td className="small" style={{ maxWidth: 240 }}>
                        {[s.village, s.mandal, s.district, s.state, s.pincode].filter(Boolean).length > 0 ? (
                          <div>{[s.village, s.mandal, s.district].filter(Boolean).join(', ')}</div>
                        ) : null}
                        <div className="muted small">
                          {[s.state, s.pincode].filter(Boolean).join(' · ')}
                        </div>
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
                      <td className="small">
                        {customFields.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          customFields.map((f) => {
                            const value = s.customFields ? s.customFields[f.key] : '';
                            return (
                              <div key={f.key} className={value ? '' : 'muted'}>
                                <span className="muted small">{f.label}: </span>
                                {value || '—'}
                              </div>
                            );
                          })
                        )}
                      </td>
                      <td className="right">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditStudent(s)}>
                          ✎ Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="space-between" style={{ marginTop: '1rem' }}>
                <span className="muted small">
                  Page {page} of {pages} · showing {rows.length} of {num(total)}
                </span>
                <div className="inline">
                  <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    ← Prev
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <StudentFormModal
        open={Boolean(editStudent)}
        student={editStudent}
        onClose={() => setEditStudent(null)}
        onSaved={load}
        customFields={customFields}
      />
    </>
  );
}
