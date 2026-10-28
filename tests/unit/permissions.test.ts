import { describe, it, expect } from 'vitest';
import {
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
} from '../../src/shared-kernel/permissions.js';

describe('Permissions Unit Tests (src/shared-kernel/permissions.ts)', () => {
  describe('getPermissionsForRole', () => {
    it('retorna la lista canónica de permisos para ADMIN', () => {
      const perms = getPermissionsForRole('ADMIN');
      expect(perms).toContain('quotations:read_all');
      expect(perms).toContain('users:manage');
      expect(perms).toContain('company:edit');
      expect(perms).toContain('system:backup');
      expect(perms).toContain('system:restore');
      expect(perms).toContain('dashboard:global');
    });

    it('retorna permisos limitados para SALES_REP', () => {
      const perms = getPermissionsForRole('SALES_REP');
      expect(perms).toContain('quotations:read_own');
      expect(perms).toContain('quotations:create');
      expect(perms).toContain('customers:create');
      expect(perms).toContain('dashboard:own');

      // Restricciones de seguridad para SALES_REP
      expect(perms).not.toContain('users:manage');
      expect(perms).not.toContain('company:edit');
      expect(perms).not.toContain('system:backup');
      expect(perms).not.toContain('system:restore');
      expect(perms).not.toContain('dashboard:global');
    });

    it('retorna array vacío para CUSTOMER_CONTACT (deny-by-default)', () => {
      const perms = getPermissionsForRole('CUSTOMER_CONTACT');
      expect(perms).toEqual([]);
    });

    it('retorna array vacío para rol inexistente o desconocido', () => {
      const perms = getPermissionsForRole('UNKNOWN_ROLE' as any);
      expect(perms).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('retorna true si el usuario tiene el permiso derivado de su rol', () => {
      const admin = { id: '1', role: 'ADMIN' };
      expect(hasPermission(admin, 'users:manage')).toBe(true);
      expect(hasPermission(admin, 'quotations:create')).toBe(true);
    });

    it('retorna false si el rol del usuario no tiene el permiso', () => {
      const salesRep = { id: '2', role: 'SALES_REP' };
      expect(hasPermission(salesRep, 'users:manage')).toBe(false);
      expect(hasPermission(salesRep, 'company:edit')).toBe(false);
    });

    it('retorna false siempre para CUSTOMER_CONTACT sin permisos explícitos', () => {
      const client = { id: '3', role: 'CUSTOMER_CONTACT' };
      expect(hasPermission(client, 'quotations:read_own')).toBe(false);
      expect(hasPermission(client, 'dashboard:own')).toBe(false);
    });

    it('respeta la lista explícita permissions si está presente en el objeto', () => {
      const customUser = {
        id: '4',
        role: 'SALES_REP',
        permissions: ['custom:permission' as any, 'users:manage'],
      };
      expect(hasPermission(customUser, 'users:manage')).toBe(true);
      expect(hasPermission(customUser, 'quotations:read_own')).toBe(false); // Overridden por permissions explícito
    });

    it('retorna false si el usuario es null o undefined', () => {
      expect(hasPermission(null, 'quotations:read_own')).toBe(false);
      expect(hasPermission(undefined, 'quotations:read_own')).toBe(false);
    });
  });
});
