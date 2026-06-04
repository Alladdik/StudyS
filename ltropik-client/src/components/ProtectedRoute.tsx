import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

interface Props {
  children: React.ReactNode;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { token, role } = useAuthStore();

  if (!token) return <Navigate to="/login" replace />;
  // null role with required roles → deny access (prevents bypass via corrupted localStorage)
  if (roles && (!role || !roles.includes(role))) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
}
