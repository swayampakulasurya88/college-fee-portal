import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { api } from './api.js';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import StudentDetails from './pages/student/StudentDetails.jsx';
import StudentFees from './pages/student/StudentFees.jsx';
import StudentPayments from './pages/student/StudentPayments.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminStudents from './pages/admin/AdminStudents.jsx';
import AdminStpo from './pages/admin/AdminStpo.jsx';
import AdminFeeStructure from './pages/admin/AdminFeeStructure.jsx';
import AdminPayments from './pages/admin/AdminPayments.jsx';
import AdminMess from './pages/admin/AdminMess.jsx';
import AdminMessages from './pages/admin/AdminMessages.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminDuplicates from './pages/admin/AdminDuplicates.jsx';
import AdminCalendar from './pages/admin/AdminCalendar.jsx';
import AdminTrash from './pages/admin/AdminTrash.jsx';
import AdminBackups from './pages/admin/AdminBackups.jsx';
import AdminExtraFields from './pages/admin/AdminExtraFields.jsx';
import AdminStudentDetails from './pages/admin/AdminStudentDetails.jsx';

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
    <Layout
      roleLabel="Student Portal"
      nav={[
        { to: '/student', end: true, icon: '📊', label: 'Dashboard' },
        { to: '/student/details', icon: '👤', label: 'Student Details' },
        { to: '/student/fees', icon: '🧾', label: 'Fee Details' },
        { to: '/student/payments', icon: '💰', label: 'Fee Payments' },
      ]}
    >
      <Outlet />
    </Layout>
  );
}

function AdminLayout() {
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [deleted, setDeleted] = useState(0);

  useEffect(() => {
    let active = true;
    api('/messages?status=unread&limit=1')
      .then((d) => active && setUnread(d.counts?.unread || 0))
      .catch(() => {});
    api('/duplicates?limit=1')
      .then((d) => active && setDuplicates(d.total || 0))
      .catch(() => {});
    api('/trash?limit=1')
      .then((d) => active && setDeleted(d.total || 0))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const nav = [
    { to: '/admin', end: true, icon: '🏠', label: 'Dashboard' },
    { to: '/admin/students', icon: '🎓', label: 'Students' },
    { to: '/admin/student-details', icon: '🧑🎓', label: 'Student Details' },
    { to: '/admin/stpo', icon: '🧩', label: 'STPO' },
    { to: '/admin/fees', icon: '🧮', label: 'Fee Structure' },
    { to: '/admin/payments', icon: '💰', label: 'Fee Payments' },
    { to: '/admin/mess', icon: '🍽️', label: 'Mess Fees' },
    { to: '/admin/messages', icon: '✉️', label: 'Messages', badge: unread },
    { to: '/admin/reports', icon: '📅', label: 'Daily Reports' },
    { to: '/admin/calendar', icon: '📆', label: 'Payment Calendar' },
    { to: '/admin/duplicates', icon: '⚠️', label: 'Duplicates', badge: duplicates },
    { to: '/admin/deleted', icon: '🗑️', label: 'Deleted', badge: deleted },
    { to: '/admin/backups', icon: '💾', label: 'Backups' },
    { to: '/admin/extra-fields', icon: '🧩', label: 'Extra Fields' },
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
          <Route path="/student/details" element={<StudentDetails />} />
          <Route path="/student/fees" element={<StudentFees />} />
          <Route path="/student/payments" element={<StudentPayments />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/students" element={<AdminStudents />} />
          <Route path="/admin/student-details" element={<AdminStudentDetails />} />
          <Route path="/admin/stpo" element={<AdminStpo />} />
          <Route path="/admin/fees" element={<AdminFeeStructure />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/mess" element={<AdminMess />} />
          <Route path="/admin/messages" element={<AdminMessages />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/calendar" element={<AdminCalendar />} />
          <Route path="/admin/duplicates" element={<AdminDuplicates />} />
          <Route path="/admin/deleted" element={<AdminTrash />} />
          <Route path="/admin/backups" element={<AdminBackups />} />
          <Route path="/admin/extra-fields" element={<AdminExtraFields />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
