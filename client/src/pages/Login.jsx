import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Field, Input, Spinner } from '../components/ui.jsx';

const FEATURES = [
  {
    icon: '📊',
    title: 'Live fee reports',
    text: 'Grand total, amount paid and outstanding dues in one place.',
  },
  {
    icon: '💳',
    title: 'Every payment recorded',
    text: 'Admins add, edit or delete fee entries and dues update instantly.',
  },
  {
    icon: '✉️',
    title: 'Talk to the office',
    text: 'Students can raise fee queries and get replies from the admin.',
  },
];

export default function Login() {
  const { login, role, ready } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('student');
  const [rollNumber, setRollNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && role) navigate(role === 'admin' ? '/admin' : '/student', { replace: true });
  }, [ready, role, navigate]);

  if (!ready) {
    return (
      <div className="center" style={{ minHeight: '100vh' }}>
        <Spinner />
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload =
        mode === 'student'
          ? await api('/auth/student-login', {
              method: 'POST',
              auth: false,
              body: { rollNumber: rollNumber.trim() },
            })
          : await api('/auth/admin-login', {
              method: 'POST',
              auth: false,
              body: { username: username.trim(), password },
            });
      login(payload);
      navigate(payload.role === 'admin' ? '/admin' : '/student', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div>
          <span className="hero-badge">
            <img src="/kiet-logo.png" alt="" className="hero-badge-logo" /> KIET College Fee Portal
          </span>
          <h1 className="hero-title">
            Fees, dues and reports — all in one dashboard.
          </h1>
          <p className="hero-sub">
            A simple, reliable way for the college office to track every student&apos;s fee
            status and for students to see exactly what they owe.
          </p>

          <div className="hero-features">
            {FEATURES.map((f) => (
              <div className="hero-feature" key={f.title}>
                <div className="hero-feature-icon">{f.icon}</div>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-foot">Secure access · Data stored in MongoDB</div>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <img src="/kiet-logo.png" alt="KIET" className="login-card-logo" />
          <h1>Welcome back</h1>
          <p className="muted">Sign in to continue to your fee dashboard.</p>

          <div className="login-tabs">
            <button className={mode === 'student' ? 'active' : ''} onClick={() => { setMode('student'); setError(''); }}>
              Student
            </button>
            <button className={mode === 'admin' ? 'active' : ''} onClick={() => { setMode('admin'); setError(''); }}>
              Admin
            </button>
          </div>

          {error && <div className="login-alert">{error}</div>}

          <form onSubmit={submit}>
            {mode === 'student' ? (
              <Field label="Roll Number" required hint="Use the roll number issued by the college office.">
                <Input
                  autoFocus
                  placeholder="e.g. CSE001"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                  autoComplete="username"
                />
              </Field>
            ) : (
              <>
                <Field label="Username" required>
                  <Input
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </Field>
                <Field label="Password" required>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
              </>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ marginTop: '0.4rem' }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {mode === 'student' ? (
            <div className="login-hint">
              Students sign in with only their <strong>roll number</strong> - no password is
              needed.
            </div>
          ) : (
            <div className="login-hint">
              Staff access only. Sign in with the admin username and password issued
              by the college office.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
