import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '../../api.js';
import { formatDateTime, num } from '../../format.js';
import { EmptyState, SectionCard, Spinner, StatCard, useToast } from '../../components/ui.jsx';

const kb = (bytes) => (bytes ? `${(bytes / 1024).toFixed(1)} KB` : '—');

/**
 * Daily in-portal backups: a gzip-compressed snapshot of the whole database for
 * every day, browsable and downloadable from the admin login.
 */
export default function AdminBackups() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/backups');
      setRows(res.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const runNow = async () => {
    setBusy('run');
    try {
      const res = await api('/backups/run', { method: 'POST', body: {} });
      toast.success(res.message || 'Backup taken.');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const download = async (date) => {
    setBusy(date);
    try {
      const res = await fetch(`/api/backups/${date}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kiet-fee-backup-${date}.json.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Backup for ${date} downloaded.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const latest = rows[0];
  const counts = latest?.counts || {};

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Backups</h1>
          <p className="muted">
            A snapshot of every student, payment, fee, message and deleted item, taken daily (and whenever an
            admin logs in). Keep them safe — they are your recovery path.
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            ↻ Refresh
          </button>
          <button className="btn btn-primary" onClick={runNow} disabled={busy === 'run'}>
            {busy === 'run' ? 'Backing up…' : '＋ Back up now'}
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <StatCard
          label="Backups kept"
          value={num(rows.length)}
          tone="indigo"
          icon="💾"
          sub={latest ? `Latest: ${latest.date}` : 'No snapshots yet'}
        />
        <StatCard label="Students" value={num(counts.students || 0)} tone="indigo" icon="🎓" sub="In the latest snapshot" />
        <StatCard label="Payments" value={num(counts.payments || 0)} tone="emerald" icon="💰" sub="In the latest snapshot" />
        <StatCard
          label="Size"
          value={kb(latest?.size)}
          tone="amber"
          icon="📦"
          sub="Latest snapshot (compressed)"
        />
      </div>

      <SectionCard
        title="Daily snapshots"
        subtitle="One file per day · gzip-compressed JSON of the whole database"
      >
        {loading ? (
          <Spinner label="Loading backups…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="💾"
            title="No backups yet"
            hint="Press “Back up now”, or just log in tomorrow — a snapshot is taken automatically every day."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Taken at</th>
                  <th className="right">Students</th>
                  <th className="right">Payments</th>
                  <th className="right">Term fees</th>
                  <th className="right">Mess bills</th>
                  <th className="right">Messages</th>
                  <th className="right">Deleted items</th>
                  <th className="right">Size</th>
                  <th className="right">Download</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.date}</td>
                    <td className="small">{formatDateTime(b.takenAt)}</td>
                    <td className="right">{num(b.counts?.students || 0)}</td>
                    <td className="right">{num(b.counts?.payments || 0)}</td>
                    <td className="right">{num(b.counts?.termFees || 0)}</td>
                    <td className="right">{num(b.counts?.messBills || 0)}</td>
                    <td className="right">{num(b.counts?.messages || 0)}</td>
                    <td className="right">{num(b.counts?.trash || 0)}</td>
                    <td className="right">{kb(b.size)}</td>
                    <td className="right">
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy === b.date}
                        onClick={() => download(b.date)}
                      >
                        {busy === b.date ? '…' : '⬇ .json.gz'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          Each download is a single gzip file containing the whole database as JSON. Unzip it with{' '}
          <span className="mono">gunzip kiet-fee-backup-YYYY-MM-DD.json.gz</span>. An encrypted copy is also sent
          off-site every night by GitHub Actions (see <span className="mono">docs/BACKUP-RESTORE.md</span>).
        </p>
      </SectionCard>
    </>
  );
}
