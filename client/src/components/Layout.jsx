import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Layout({ nav, children, roleLabel }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = (user?.name || user?.username || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img className="brand-logo" src="/kiet-logo.png" alt="KIET" />
          <div>
            <div className="brand-name">KIET Fee Portal</div>
            <div className="brand-role">{roleLabel}</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            {user?.name || user?.username}
            {role === 'student' && user?.rollNumber ? ` · ${user.rollNumber}` : ''}
          </div>
          <button
            className="btn btn-ghost btn-sm btn-block"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <div className="inline">
            <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu">
              ☰
            </button>
            <h2>{role === 'admin' ? 'Administration' : 'My Fee Account'}</h2>
          </div>
          <div className="topbar-right">
            <span className={`badge badge-${role === 'admin' ? 'indigo' : 'success'}`}>
              {role === 'admin' ? 'Admin' : 'Student'}
            </span>
            <div className="avatar" title={user?.name}>{initials}</div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
