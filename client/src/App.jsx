import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api } from './api.js';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminStudents from './pages/admin/AdminStudents.jsx';
import AdminStpo from './pages/admin/AdminStpo.jsx';
import AdminFeeStructure from './pages/admin/AdminFeeStructure.jsx';
import AdminPayments from './pages/admin/AdminPayments.jsx';
import AdminMess from './pages/admin/AdminMess.jsx';
import AdminMessages from './pages/admin/AdminMessages.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';

function RequireRole({ role }) {
  const { ready, role: current } = useAuth();
  if (!ready) {
    return (
      <div className="center" style={{ minHeight: '100vh' }}>
        <Spinner label="Loading portal…" />
      </div>
    );
  }
  if (current !== role) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function StudentLayout() {
  return (
    <Layout roleLabel="Student Portal" nav={[{ to: '/student', end: true, icon: '📊', label: 'My Fee Report' }]}>
      <Outlet />
    </Layout>
  );
}

function AdminLayout() {
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    api('/messages?status=unread&limit=1')
      .then((d) => active && setUnread(d.counts?.unread || 0))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const nav = [
    { to: '/admin', end: true, icon: '🏠', label: 'Dashboard' },
    { to: '/admin/students', icon: '🎓', label: 'Students' },
    { to: '/admin/stpo', icon: '🧩', label: 'STPO' },
    { to: '/admin/fees', icon: '🧮', label: 'Fee Structure' },
    { to: '/admin/payments', icon: '💰', label: 'Fee Payments' },
    { to: '/admin/mess', icon: '🍽️', label: 'Mess Fees' },
    { to: '/admin/messages', icon: '✉️', label: 'Messages', badge: unread },
    { to: '/admin/reports', icon: '📅', label: 'Daily Reports' },
  ];

  return (
    <Layout roleLabel="Admin Console" nav={nav}>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  const { role } = useAuth();
  const home = role === 'admin' ? '/admin' : role === 'student' ? '/student' : '/login';

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireRole role="student" />}>
        <Route element={<StudentLayout />}>
          <Route path="/student" element={<StudentDashboard />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/students" element={<AdminStudents />} />
          <Route path="/admin/stpo" element={<AdminStpo />} />
          <Route path="/admin/fees" element={<AdminFeeStructure />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/mess" element={<AdminMess />} />
          <Route path="/admin/messages" element={<AdminMessages />} />
          <Route path="/admin/reports" element={<AdminReports />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
