import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  const hideHeader =
    location.pathname === '/login' ||
    location.pathname === '/login/student' ||
    location.pathname === '/login/teacher';

  return (
    <div className="app-shell">
      {!hideHeader && (
        <header className="app-header">
          <Link to="/" className="app-header__brand">
            <span className="app-header__brand-icon">AI</span>
            AI Based Cross Platform Clipboard System
          </Link>

          {!loading && (
            <nav className="app-header__nav">
              {user ? (
                <>
                  {user.role === 'teacher' && (
                    <>
                      <Link to="/teacher">Batches</Link>
                      <Link to="/teacher/exams">Exam Sessions</Link>
                      <Link to="/teacher/live">Live Feed</Link>
                    </>
                  )}
                  {user.role === 'student' && (
                    <>
                      <Link to="/student/dashboard">Dashboard</Link>
                      <Link to="/student">My Questions</Link>
                      <Link to="/student/submissions">My Submissions</Link>
                    </>
                  )}
                  {user.role === 'admin' && <Link to="/admin">Admin</Link>}

                  <div className="app-header__user">
                    <div className="app-header__avatar">
                      {initials(user.fullName || user.email)}
                    </div>
                    <span>{user.fullName || user.email}</span>
                  </div>

                  <button type="button" className="btn-header-logout" onClick={logout}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login">Login</Link>
                  <Link to="/student/register">Student Register</Link>
                  <Link to="/teacher/register">Teacher Register</Link>
                </>
              )}
            </nav>
          )}
        </header>
      )}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
