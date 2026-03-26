import { Routes, Route, NavLink } from 'react-router-dom';
import BatchListPage from './BatchListPage';
import BatchDetailPage from './BatchDetailPage';
import LiveSubmissionsPage from './LiveSubmissionsPage';
import ExamSessionsPage from './ExamSessionsPage';
import ExamSessionDetailPage from './ExamSessionDetailPage';

const NAV = [
  { to: '/teacher',       label: 'Batches',      icon: '📚', end: true },
  { to: '/teacher/exams', label: 'Exam Sessions', icon: '🗓️' },
  { to: '/teacher/live',  label: 'Live Feed',     icon: '📡' },
];

export default function TeacherLayout() {
  return (
    <div className="sidebar-layout">
      <aside className="sidebar">
        <span className="sidebar__section-label">Teacher Panel</span>
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => 'sidebar__link' + (isActive ? ' active' : '')}
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </aside>

      <div className="sidebar-content">
        <Routes>
          <Route index element={<BatchListPage />} />
          <Route path="batch/:batchId" element={<BatchDetailPage />} />
          <Route path="exams" element={<ExamSessionsPage />} />
          <Route path="exams/:examId" element={<ExamSessionDetailPage />} />
          <Route path="live" element={<LiveSubmissionsPage />} />
        </Routes>
      </div>
    </div>
  );
}
