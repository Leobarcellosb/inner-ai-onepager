import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/permissions';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { roles, loading } = useAuth();

  if (loading) return null;
  if (!isAdmin(roles)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
