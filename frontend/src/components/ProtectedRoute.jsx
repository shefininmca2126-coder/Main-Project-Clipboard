import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleHome = {
  teacher: '/teacher',
  student: '/student/dashboard',
  admin: '/admin',
};

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="spinner-wrap" style={{ padding: '2rem', justifyContent: 'center' }}>
        <div className="spinner" />
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to the user's correct home instead of showing a confusing message
    return <Navigate to={roleHome[user.role] ?? '/'} replace />;
  }

  return children;
}
