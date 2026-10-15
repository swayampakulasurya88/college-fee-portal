import { useState } from 'react';
import { api } from '../api.js';
import { Field, Modal, TextArea, useToast } from './ui.jsx';

const PLACEHOLDER = `Roll No, Name, Total Fee
CSE101, Riya Verma, 85000
CSE102, Arjun Rao, 85000
ECE101, Meera Joshi, 78000

Tip: copy cells straight from Excel and paste here (tab-separated works too).`;

const splitRow = (line) => {
  const sep = line.includes('\t') ? '\t' : ',';
  return line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
};

const parseMoney = (value) => {
  if (value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Accepts rows copied from Excel/CSV. Detects a header row and maps columns by
// name; otherwise assumes: roll number, name, total fee, branch, year, section, phone.
function parse(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const first = splitRow(lines[0]).map((c) => c.toLowerCase());
  const looksHeader = first.some((c) => /roll|name|fee|college|branch|phone|dept/.test(c));

  let map = { rollNumber: 0, name: 1, totalFee: 2, college: 3, branch: 4, year: 5, section: 6, phone: 7, address: 8 };
  let rows = lines;

  if (looksHeader) {
    map = {};
    first.forEach((c, i) => {
      if (/roll/.test(c)) map.rollNumber = i;
      else if (/name|student/.test(c)) map.name = i;
      else if (/fee|amount|total|due/.test(c)) map.totalFee = i;
      else if (/college|institute/.test(c)) map.college = i;
      else if (/branch|dept|course/.test(c)) map.branch = i;
      else if (/year/.test(c)) map.year = i;
      else if (/section|sec\b/.test(c)) map.section = i;
      else if (/phone|mobile|contact/.test(c)) map.phone = i;
      else if (/mail/.test(c)) map.email = i;
      else if (/address|addr|residence/.test(c)) map.address = i;
    });
    rows = lines.slice(1);
  }

  return rows
    .map((line) => {
      const cells = splitRow(line);
      const pick = (idx) => (idx === undefined ? '' : String(cells[idx] ?? '').trim());
      const rollNumber = pick(map.rollNumber).toUpperCase();
      return {
        rollNumber,
        name: pick(map.name) || rollNumber,
        totalFee: parseMoney(pick(map.totalFee)),
        college: pick(map.college),
        branch: pick(map.branch),
        year: pick(map.year),
        section: pick(map.section),
        phone: pick(map.phone),
        ...(map.email !== undefined ? { email: pick(map.email) } : {}),
        ...(map.address !== undefined ? { address: pick(map.address) } : {}),
      };
    })
    .filter((s) => s.rollNumber);
}

export default function BulkImportModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const close = () => {
    setText('');
    setResult(null);
    onClose();
  };

  const submit = async () => {
    const students = parse(text);
    if (!students.length) return toast.error('Paste at least one student line.');
    setBusy(true);
    try {
      const res = await api('/students/bulk', { method: 'POST', body: { students } });
      setResult(res);
      toast.success(`Added ${res.createdCount} student(s).`);
      onSaved?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Bulk import students"
      subtitle="One student per line: roll number, name, total fee."
      size="md"
      footer={
        <>
          <button className="btn btn-ghost" onClick={close} disabled={busy}>
            {result ? 'Close' : 'Cancel'}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Importing…' : 'Import students'}
          </button>
        </>
      }
    >
      <Field
        label="Students"
        hint="Paste rows copied from Excel or CSV. Columns: roll number, name, total fee, then optional college, branch, year, section, phone. A header row is detected automatically."
        required
      >
        <TextArea
          style={{ minHeight: 170, fontFamily: 'ui-monospace, monospace' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
        />
      </Field>

      {result && (
        <div style={{ marginTop: '0.5rem' }}>
          <div className="inline" style={{ marginBottom: '0.5rem' }}>
            <span className="badge badge-success">Added {result.createdCount}</span>
            <span className="badge badge-warn">Skipped {result.skippedCount}</span>
          </div>
          {result.skipped.length > 0 && (
            <div className="message-reply" style={{ background: 'var(--amber-soft)', color: '#92400e' }}>
              {result.skipped.map((s, i) => (
                <div key={i} className="small">
                  <strong>{s.rollNumber}</strong> — {s.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
