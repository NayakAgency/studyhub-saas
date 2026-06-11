import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    const loginPath = role === 'super_admin'
      ? '/super-admin/login'
      : role === 'hall_admin'
      ? '/admin/login'
      : location.pathname.split('/')[1]
        ? `/${location.pathname.split('/')[1]}/login`
        : '/';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
