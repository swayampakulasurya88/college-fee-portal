import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { quotaShort, quotaTone } from '../../format.js';
import { Input, SectionCard, Select, useToast } from '../../components/ui.jsx';
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

/**
 * Loads the admin-defined extra details (backlogs, hostel room, …). Cached so
 * every student page can render them without a round trip each time.
 */
let customFieldsCache = null;
let customFieldsPromise = null;

export function useCustomFields({ refresh = false } = {}) {
  const [fields, setFields] = useState(customFieldsCache || []);

  useEffect(() => {
    if (customFieldsCache && !refresh) return;
    if (!customFieldsPromise || refresh) {
      customFieldsPromise = api('/custom-fields')
        .then((res) => {
          customFieldsCache = res.data || [];
          return customFieldsCache;
        })
        .catch(() => []);
    }
    let active = true;
    customFieldsPromise.then((list) => active && setFields(list));
    return () => {
      active = false;
    };
  }, [refresh]);

  return fields;
}

/** Invalidates the cached field list (called after an admin edits them). */
export function clearCustomFieldsCache() {
  customFieldsCache = null;
  customFieldsPromise = null;
}

/** An input matching an admin-defined field's type. */
export function CustomFieldInput({ field, value, onChange, disabled = false }) {
  const common = {
    value: value ?? '',
    onChange: (e) => onChange(e.target.value),
    disabled,
  };
  if (field.inputType === 'select') {
    return (
      <Select {...common}>
        <option value="">Select…</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }
  return (
    <Input
      {...common}
      type={field.inputType === 'number' ? 'number' : field.inputType === 'date' ? 'date' : 'text'}
    />
  );
}

/** "Extra details" block shown on every student page. */
export function ExtraDetailsCard({ student, fields, onEdit, actions }) {
  const values = student?.customFields || {};
  return (
    <SectionCard
      title="Extra details"
      subtitle="Added by the college office — these apply to every student"
      actions={actions ?? (onEdit ? <button className="btn btn-ghost btn-sm" onClick={onEdit}>✎ Edit details</button> : null)}
    >
      {fields.length === 0 ? (
        <p className="muted small">No extra details have been added yet.</p>
      ) : (
        <div className="grid-3">
          {fields.map((f) => (
            <Detail key={f.key} label={f.label} value={values[f.key]} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}


