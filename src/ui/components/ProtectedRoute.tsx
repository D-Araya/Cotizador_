import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { User, Permission } from '../../modules/types.ts';
import { hasPermission } from '../../shared-kernel/permissions.ts';

interface ProtectedRouteProps {
  user: User | null;
  permission?: Permission;
  children: React.ReactElement;
  redirectTo?: string;
}

export function ProtectedRoute({
  user,
  permission,
  children,
  redirectTo,
}: ProtectedRouteProps) {
  const location = useLocation();

  if (!user) {
    // Preserve current URL in state so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(user, permission)) {
    // User lacks required permission (e.g. SALES_REP accessing /app/team)
    return <Navigate to={redirectTo || '/app/dashboard'} replace />;
  }

  return children;
}
