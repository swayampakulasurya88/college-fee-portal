import { useRef, useState } from 'react';
import { api } from '../../api.js';
import { EmptyState, ProgressBar, SectionCard, Spinner, useToast } from '../../components/ui.jsx';
import StudentAvatar, { readPhotoFile } from '../../components/StudentAvatar.jsx';
import StudentProfileModal from '../../components/StudentProfileModal.jsx';
import { exportToExcel, exportToPdf } from '../../export.js';
import {
  Detail,
  PROFILE_LABELS,
  StudentHeader,
  ExtraDetailsCard,
  profileCompleteness,
  useCustomFields,
  useStudentReport,
} from './studentShared.jsx';

// The student's own record, exactly as shown on this page — used for the
// Excel / PDF downloads so they always match what is on screen.
function recordColumns(student, customFields = []) {
  return [
    { header: 'Full name', get: () => student.name || '' },
    { header: 'Roll number', get: () => student.rollNumber || '' },
    { header: 'College', get: () => student.college || '' },
    { header: 'Branch', get: () => student.branch || '' },
    { header: 'Year', get: () => student.year || '' },
    { header: 'Section', get: () => student.section || '' },
    { header: 'Quota', get: () => student.quota || '' },
    { header: 'Date of birth', get: () => student.dob || '' },
    { header: 'Gender', get: () => student.gender || '' },
    { header: 'Blood group', get: () => student.bloodGroup || '' },
    { header: "Father's name", get: () => student.fatherName || '' },
    { header: "Mother's name", get: () => student.motherName || '' },
    { header: 'Student phone', get: () => student.phone || '' },
    { header: 'Alternate phone', get: () => student.alternatePhone || '' },
    { header: 'Parent phone', get: () => student.parentPhone || '' },
    { header: 'Email', get: () => student.email || '' },
    { header: 'Staying', get: () => (student.hostel ? 'Hosteller' : 'Day scholar') },
    { header: 'Village / street', get: () => student.village || '' },
    { header: 'Mandal', get: () => student.mandal || '' },
    { header: 'District', get: () => student.district || '' },
    { header: 'State', get: () => student.state || '' },
    { header: 'PIN code', get: () => student.pincode || '' },
    { header: 'Full address', get: () => student.address || '' },
    {
      header: 'Emergency contact',
      get: () => [student.emergencyContactName, student.emergencyContactPhone].filter(Boolean).join(' · '),
    },
    ...customFields.map((f) => ({
      header: f.label,
      get: () => (student.customFields ? student.customFields[f.key] || '' : ''),
    })),
  ];
}

export default function StudentDetails() {
  const { report, setReport, loading, load } = useStudentReport();
  const customFields = useCustomFields();
  const toast = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [exporting, setExporting] = useState('');
  const fileRef = useRef(null);

  if (loading) return <Spinner label="Loading your details…" />;
  if (!report) return <EmptyState title="Could not load your details" hint="Please refresh the page." />;

  const s = report.student;
  const completeness = profileCompleteness(s);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const photo = await readPhotoFile(file);
      const res = await api('/students/me/photo', { method: 'POST', body: { photo } });
      setReport((r) => (r ? { ...r, student: res.student } : r));
      toast.success('Profile photo updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      const res = await api('/students/me/photo', { method: 'DELETE' });
      setReport((r) => (r ? { ...r, student: res.student } : r));
      toast.success('Profile photo removed.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const exportRecord = async (kind) => {
    setExporting(kind);
    try {
      const filename = `My_Details_${s.rollNumber || 'student'}_${new Date().toISOString().slice(0, 10)}.${
        kind === 'excel' ? 'xlsx' : 'pdf'
      }`;
      const opts = {
        columns: recordColumns(s, customFields),
        rows: [s],
        filename,
        title: 'Student Details',
        subtitle: `${s.name} · ${s.rollNumber}${s.college ? ` · ${s.college}` : ''}${s.branch ? ` · ${s.branch}` : ''}`,
      };
      if (kind === 'excel') await exportToExcel({ ...opts, sheetName: 'My Details', orientation: 'landscape' });
      else await exportToPdf({ ...opts, orientation: 'landscape' });
      toast.success(`${kind === 'excel' ? 'Excel' : 'PDF'} downloaded.`);
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting('');
    }
  };

  return (
    <>
      <StudentHeader
        student={s}
        title="My details"
        subtitle="Everything here is visible to the college office in the admin portal"
        onRefresh={() => load(true)}
        actions={
          <>
            <button className="btn btn-ghost" disabled={!!exporting} onClick={() => exportRecord('excel')}>
              {exporting === 'excel' ? 'Exporting…' : '⬇ Excel'}
            </button>
            <button className="btn btn-ghost" disabled={!!exporting} onClick={() => exportRecord('pdf')}>
              {exporting === 'pdf' ? 'Exporting…' : '⬇ PDF'}
            </button>
          </>
        }
      />

      <div className="two-col">
        <SectionCard title="Profile photo" subtitle="Shown on your dashboard and in the admin portal">
          <div className="inline" style={{ gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <StudentAvatar student={s} size={112} />
            <div>
              <div className="inline">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={photoBusy}
                >
                  {photoBusy ? 'Uploading…' : s.photo ? '📷 Change photo' : '📷 Upload photo'}
                </button>
                {s.photo && (
                  <button className="btn btn-danger btn-sm" onClick={removePhoto} disabled={photoBusy}>
                    Remove
                  </button>
                )}
              </div>
              <p className="muted small" style={{ marginTop: 8 }}>
                A square photo works best. It is resized automatically before upload.
              </p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        </SectionCard>

        <SectionCard
          title="Profile completeness"
          subtitle="Filling these in helps the office reach you"
          actions={
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
              ✎ Edit details
            </button>
          }
        >
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>
            {completeness.filled} <span className="muted" style={{ fontSize: '1rem' }}>/ {completeness.total}</span>
          </div>
          <div style={{ margin: '8px 0 10px' }}>
            <ProgressBar
              percent={Math.round((completeness.filled / completeness.total) * 100)}
              tone={completeness.filled === completeness.total ? 'emerald' : 'indigo'}
            />
          </div>
          {completeness.missing.length === 0 ? (
            <span className="chip chip-emerald">All details filled 🎉</span>
          ) : (
            <p className="muted small">
              Missing:{' '}
              <strong>
                {completeness.missing
                  .slice(0, 4)
                  .map((k) => PROFILE_LABELS[k] || k)
                  .join(', ')}
                {completeness.missing.length > 4 ? ` and ${completeness.missing.length - 4} more` : ''}
              </strong>
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Personal record"
        subtitle="Academic details are maintained by the college; the rest is yours to update"
        actions={
          <div className="row-actions">
            <button className="btn btn-ghost btn-sm" disabled={!!exporting} onClick={() => exportRecord('excel')}>
              {exporting === 'excel' ? 'Exporting…' : '⬇ Excel'}
            </button>
            <button className="btn btn-ghost btn-sm" disabled={!!exporting} onClick={() => exportRecord('pdf')}>
              {exporting === 'pdf' ? 'Exporting…' : '⬇ PDF'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setEditOpen(true)}>
              ✎ Edit details
            </button>
          </div>
        }
      >
        <div className="grid-3">
          <Detail label="Full name" value={s.name} />
          <Detail label="Roll number" value={s.rollNumber} />
          <Detail label="College" value={s.college} />
          <Detail label="Branch" value={s.branch} />
          <Detail label="Year / Section" value={s.year ? `${s.year}${s.section ? ` · Sec ${s.section}` : ''}` : ''} />
          <Detail label="Quota" value={s.quota} />
          <Detail label="Date of birth" value={s.dob} />
          <Detail label="Gender" value={s.gender} />
          <Detail label="Blood group" value={s.bloodGroup} />
          <Detail label="Father's name" value={s.fatherName} />
          <Detail label="Mother's name" value={s.motherName} />
          <Detail label="Student phone" value={s.phone} />
          <Detail label="Alternate phone" value={s.alternatePhone} />
          <Detail label="Parent phone" value={s.parentPhone} />
          <Detail label="Email" value={s.email} />
          <Detail label="Staying" value={s.hostel ? 'Hosteller' : 'Day scholar'} />
          <Detail label="Village / street" value={s.village} />
          <Detail label="Mandal" value={s.mandal} />
          <Detail label="District" value={s.district} />
          <Detail label="State" value={s.state} />
          <Detail label="PIN code" value={s.pincode} />
          <Detail label="Full address" value={s.address} />
          <Detail
            label="Emergency contact"
            value={[s.emergencyContactName, s.emergencyContactPhone].filter(Boolean).join(' · ')}
          />
        </div>
      </SectionCard>

      <StudentProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        student={s}
        customFields={customFields}
        onSaved={(student) => setReport((r) => (r ? { ...r, student } : r))}
      />

      <div style={{ marginTop: '1.25rem' }}>
        <ExtraDetailsCard student={s} fields={customFields} onEdit={() => setEditOpen(true)} />
      </div>
    </>
  );
}
