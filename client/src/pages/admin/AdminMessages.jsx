import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../api.js';
import { formatDateTime, num } from '../../format.js';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Input,
  SectionCard,
  Spinner,
  TextArea,
  useToast,
} from '../../components/ui.jsx';

const TABS = [
  ['', 'All'],
  ['unread', 'Unread'],
  ['read', 'Seen'],
  ['resolved', 'Resolved'],
];

const badgeFor = (status) =>
  status === 'unread' ? 'danger' : status === 'resolved' ? 'success' : 'neutral';

export default function AdminMessages() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, read: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [replying, setReplying] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(`/messages${qs({ status, q, limit: 100 })}`);
      setRows(res.data);
      setCounts(res.counts);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, q, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const setMessageStatus = async (msg, next) => {
    try {
      await api(`/messages/${msg.id}`, { method: 'PATCH', body: { status: next } });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const sendReply = async (msg) => {
    if (!replyText.trim()) return toast.error('Reply cannot be empty.');
    try {
      await api(`/messages/${msg.id}/reply`, { method: 'POST', body: { reply: replyText.trim() } });
      toast.success('Reply sent to the student.');
      setReplying(null);
      setReplyText('');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api(`/messages/${toDelete.id}`, { method: 'DELETE' });
      toast.success('Message deleted.');
      setToDelete(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const total = counts.unread + counts.read + counts.resolved;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Messages</h1>
          <p className="muted">
            {num(counts.unread)} unread · {num(total)} total student queries
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={load}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              className={`tab ${status === value ? 'active' : ''}`}
              onClick={() => setStatus(value)}
            >
              {label}
              {value === 'unread' && counts.unread > 0 ? ` (${counts.unread})` : ''}
            </button>
          ))}
        </div>
        <div className="search">
          <Input placeholder="Search messages…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <SectionCard>
        {loading ? (
          <Spinner label="Loading messages…" />
        ) : rows.length === 0 ? (
          <EmptyState icon="✉️" title="No messages here" hint="When students send queries they will appear in this inbox." />
        ) : (
          <div className="message-list">
            {rows.map((m) => (
              <div key={m.id} className={`message-item ${m.status}`}>
                <div className="message-meta">
                  <span className="message-from">{m.studentName || 'Student'}</span>
                  <span className="chip">{m.rollNumber}</span>
                  <Badge variant={badgeFor(m.status)}>{m.status}</Badge>
                  <span className="muted small">{formatDateTime(m.createdAt)}</span>
                </div>
                {m.subject && <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{m.subject}</div>}
                <div className="message-body">{m.body}</div>

                {m.reply && (
                  <div className="message-reply">
                    <strong>Your reply:</strong> {m.reply}
                  </div>
                )}

                {replying === m.id ? (
                  <div style={{ marginTop: '0.7rem' }}>
                    <TextArea
                      style={{ minHeight: 70 }}
                      placeholder="Type your reply to the student…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="inline" style={{ marginTop: '0.5rem' }}>
                      <button className="btn btn-success btn-sm" onClick={() => sendReply(m)}>
                        Send reply
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setReplying(null);
                          setReplyText('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inline" style={{ marginTop: '0.7rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setReplying(m.id);
                        setReplyText(m.reply || '');
                      }}
                    >
                      {m.reply ? 'Edit reply' : 'Reply'}
                    </button>
                    {m.status === 'unread' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setMessageStatus(m, 'read')}>
                        Mark as seen
                      </button>
                    )}
                    {m.status !== 'resolved' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setMessageStatus(m, 'resolved')}>
                        Mark resolved
                      </button>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => setToDelete(m)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this message?"
        message={toDelete ? `Delete the message from ${toDelete.studentName} (${toDelete.rollNumber})? This cannot be undone.` : ''}
        confirmLabel="Delete message"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
