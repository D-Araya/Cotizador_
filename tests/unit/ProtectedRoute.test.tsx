// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../../src/ui/components/ProtectedRoute.tsx';
import { User } from '../../src/modules/types.ts';

describe('ProtectedRoute Unit Tests (src/ui/components/ProtectedRoute.tsx)', () => {
  const adminUser: User = {
    id: 'usr-admin-01',
    email: 'admin@mlingenieria.cl',
    name: 'Victoria Villegas',
    role: 'ADMIN',
    phone: '+56 9 1234 5678',
    active: true,
  };

  const salesUser: User = {
    id: 'usr-sales-01',
    email: 'smorales@mlingenieria.cl',
    name: 'Sebastián Morales',
    role: 'SALES_REP',
    phone: '+56 9 8765 4321',
    active: true,
  };

  const clientUser: User = {
    id: 'usr-client-01',
    email: 'mbarrientos@australsalmon.cl',
    name: 'Matías Barrientos',
    role: 'CUSTOMER_CONTACT',
    phone: '+56 9 7654 3210',
    active: true,
  };

  it('redirige a /login si no hay usuario autenticado', () => {
    render(
      <MemoryRouter initialEntries={['/app/quotations']}>
        <Routes>
          <Route path="/login" element={<div>Página de Login</div>} />
          <Route
            path="/app/quotations"
            element={
              <ProtectedRoute user={null}>
                <div>Contenido Protegido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Página de Login')).toBeTruthy();
    expect(screen.queryByText('Contenido Protegido')).toBeNull();
  });

  it('permite renderizar el contenido protegido para usuario autorizado', () => {
    render(
      <MemoryRouter initialEntries={['/app/quotations']}>
        <Routes>
          <Route
            path="/app/quotations"
            element={
              <ProtectedRoute user={adminUser} permission="quotations:read_own">
                <div>Contenido Cotizaciones Admin</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Contenido Cotizaciones Admin')).toBeTruthy();
  });

  it('redirige al fallback /app/dashboard si el personal no tiene el permiso requerido', () => {
    render(
      <MemoryRouter initialEntries={['/app/team']}>
        <Routes>
          <Route path="/app/dashboard" element={<div>Dashboard Asesor</div>} />
          <Route
            path="/app/team"
            element={
              <ProtectedRoute user={salesUser} permission="users:manage">
                <div>Gestión de Equipo</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard Asesor')).toBeTruthy();
    expect(screen.queryByText('Gestión de Equipo')).toBeNull();
  });

  it('redirige a /portal/dashboard si un CUSTOMER_CONTACT intenta ingresar a ruta administrativa protegida', () => {
    render(
      <MemoryRouter initialEntries={['/app/quotations']}>
        <Routes>
          <Route path="/portal/dashboard" element={<div>Portal Cliente Dashboard</div>} />
          <Route
            path="/app/quotations"
            element={
              <ProtectedRoute user={clientUser} permission="quotations:read_own">
                <div>Cotizaciones Staff</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Portal Cliente Dashboard')).toBeTruthy();
    expect(screen.queryByText('Cotizaciones Staff')).toBeNull();
  });
});
