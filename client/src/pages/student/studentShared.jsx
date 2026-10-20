import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { quotaShort, quotaTone } from '../../format.js';
import { useToast } from '../../components/ui.jsx';
import StudentAvatar from '../../components/StudentAvatar.jsx';

/** Loads the student's own fee report (profile + finance + payments + mess). */
export function useStudentReport() {
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const r = await api('/reports/student/me');
        setReport(r);
        return r;
      } catch (err) {
        toast.error(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { report, setReport, loading, load };
}

/** Page header with the student's photo, greeting and quota/loan chips. */
export function StudentHeader({ student, title, subtitle, onRefresh, refreshing = false }) {
  return (
    <div className="page-head">
      <div className="inline" style={{ gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <StudentAvatar student={student} size={64} />
        <div>
          <h1 style={{ margin: 0 }}>{title}</h1>
          {subtitle && (
            <p className="muted" style={{ marginTop: 4 }}>
              {subtitle}
            </p>
          )}
          <div className="inline" style={{ marginTop: 6 }}>
            {student.quota && (
              <span className={`chip chip-${quotaTone[student.quota] || 'indigo'}`}>
                {quotaShort[student.quota] || student.quota} quota
              </span>
            )}
            {student.loan && <span className="chip chip-emerald">🎓 Education loan</span>}
            <span className="chip">{student.hostel ? '🏠 Hosteller' : '🚌 Day scholar'}</span>
          </div>
        </div>
      </div>
      {onRefresh && (
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => onRefresh()} disabled={refreshing}>
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}

/** Small "label over value" cell used across the student pages. */
export function Detail({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="muted small">{label}</div>
      <div style={{ fontWeight: 600, marginTop: 2, overflowWrap: 'anywhere' }}>
        {value || <span className="muted">—</span>}
      </div>
    </div>
  );
}

/** Fields the student fills in from their own login, with friendly names. */
export const PROFILE_LABELS = {
  email: 'email',
  phone: 'phone number',
  alternatePhone: 'alternate phone',
  parentPhone: 'parent phone',
  fatherName: "father's name",
  motherName: "mother's name",
  dob: 'date of birth',
  gender: 'gender',
  bloodGroup: 'blood group',
  address: 'address',
  village: 'village/street',
  mandal: 'mandal',
  district: 'district',
  state: 'state',
  pincode: 'PIN code',
  emergencyContactName: 'emergency contact name',
  emergencyContactPhone: 'emergency contact phone',
};

export function profileCompleteness(student) {
  const keys = Object.keys(PROFILE_LABELS);
  const missing = keys.filter((k) => !student?.[k]);
  return { total: keys.length, filled: keys.length - missing.length, missing };
}
