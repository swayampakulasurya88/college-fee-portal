import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/* ------------------------------- Toasts ------------------------------- */
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (message, type = 'info') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((list) => [...list, { id, message, type }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const toast = useMemo(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            <span className="toast-dot" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx) || { success() {}, error() {}, info() {} };

/* ------------------------------- Modal -------------------------------- */
export function Modal({ open, title, subtitle, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ Inputs -------------------------------- */
export function Field({ label, hint, required, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {required && <b className="req">*</b>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export const Input = (props) => <input className="input" {...props} />;

export const Select = ({ children, ...props }) => (
  <select className="input" {...props}>
    {children}
  </select>
);

export const TextArea = (props) => <textarea className="input" {...props} />;

/* ------------------------------ Display ------------------------------- */
export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const map = { paid: 'success', partial: 'warn', unpaid: 'danger' };
  const label = { paid: 'Fully Paid', partial: 'Partial', unpaid: 'Unpaid' };
  return <Badge variant={map[status] || 'neutral'}>{label[status] || status}</Badge>;
}

export function StatCard({ label, value, sub, tone = 'indigo', icon }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ percent, tone = 'indigo' }) {
  return (
    <div className="progress">
      <div className={`progress-fill progress-${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label && <span className="muted small">{label}</span>}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here', hint, action, icon = '📭' }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h4>{title}</h4>
      {hint && <p className="muted small">{hint}</p>}
      {action}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}

export function SectionCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
