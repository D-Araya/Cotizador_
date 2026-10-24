import { Permission, UserRole } from '../modules/types.js';

/**
 * Matriz canónica de permisos por rol objetivo (docs/CURRENT_STATE.md)
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    'quotations:read_all',
    'quotations:read_own',
    'quotations:create',
    'quotations:edit',
    'quotations:create_on_behalf',
    'customers:create',
    'customers:edit',
    'customers:deactivate',
    'contacts:create',
    'contacts:edit',
    'contacts:deactivate',
    'contacts:send_magic_link',
    'catalog:create',
    'catalog:edit',
    'catalog:deactivate',
    'company:edit',
    'company:read',
    'users:manage',
    'invoices:read_all',
    'invoices:read_own',
    'invoices:register_payment',
    'invoices:create',
    'operations:read_all',
    'operations:read_own',
    'operations:update',
    'audit:read_all',
    'audit:read_own',
    'outbox:read_all',
    'outbox:read_own',
    'system:backup',
    'system:restore',
    'dashboard:global',
    'dashboard:by_sales_rep',
    'dashboard:own',
    'ai:chat',
  ],
  SALES_REP: [
    'quotations:read_own',
    'quotations:create',
    'quotations:edit',
    'customers:create',
    'customers:edit',
    'contacts:create',
    'contacts:edit',
    'contacts:send_magic_link',
    'company:read',
    'invoices:read_own',
    'operations:read_own',
    'audit:read_own',
    'outbox:read_own',
    'dashboard:own',
    'ai:chat',
  ],
  CUSTOMER_CONTACT: [],
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(
  user: { permissions?: string[]; role?: string } | null | undefined,
  permission: Permission
): boolean {
  if (!user) return false;
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.includes(permission);
  }
  if (user.role && (user.role in ROLE_PERMISSIONS)) {
    return ROLE_PERMISSIONS[user.role as UserRole].includes(permission);
  }
  return false;
}
