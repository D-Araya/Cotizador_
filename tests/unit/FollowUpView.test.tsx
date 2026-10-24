// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { FollowUpView, getLocalDateString, extractDateOnly } from '../../src/ui/components/FollowUpView.tsx';
import { Quotation, User } from '../../src/modules/types.ts';

// Mock apiRequest
vi.mock('../../src/ui/api.ts', () => {
  const mockApiRequest = vi.fn();
  return {
    apiRequest: mockApiRequest,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    formatMoney: (amount: number) => `$${(amount || 0).toLocaleString('es-CL')} CLP`,
  };
});

import { apiRequest } from '../../src/ui/api.ts';

describe('FollowUpView Unit Tests (100% Coverage & Edge Cases)', () => {
  const mockUser: User = {
    id: 'usr-rep-01',
    email: 'carlos@mlingenieria.cl',
    name: 'Carlos Navea',
    role: 'SALES_REP',
    phone: '+56 9 1234 5678',
    active: true,
    permissions: [],
  };

  const today = getLocalDateString();
  const pastDate = '2026-01-15';

  const mockDueQuotes: Quotation[] = [
    {
      id: 'q-overdue-1',
      quotationNumber: 'COT-2026-101',
      customerId: 'cust-1',
      customerBusinessName: 'Naviera Chiloé SpA',
      contactId: 'ct-1',
      salesRepId: 'usr-rep-01',
      status: 'SENT',
      nextActionAt: `${pastDate}T12:00:00Z`,
      nextActionNote: 'Llamar urgente por planos de cuaderna maestra',
      grandTotal: 1500000,
      total: 1500000,
      marginPct: 30,
      publicToken: 'tok-overdue-1',
      statusHistory: [],
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'q-today-1',
      quotationNumber: 'COT-2026-102',
      customerId: 'cust-2',
      customerBusinessName: 'Acuícola Llanquihue',
      contactId: 'ct-2',
      salesRepId: 'usr-rep-01',
      status: 'VIEWED',
      nextActionAt: `${today}T12:00:00Z`,
      nextActionNote: 'Revisar presupuesto con Gerente de Mantenimiento hoy a las 15:00',
      grandTotal: 2800000,
      total: 2800000,
      marginPct: 27,
      publicToken: 'tok-today-1',
      statusHistory: [],
      createdAt: '2026-02-01T10:00:00Z',
      updatedAt: '2026-02-01T10:00:00Z',
    },
  ] as unknown as Quotation[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Funciones auxiliares de fecha evitan desfase UTC en zonas horarias occidentales', () => {
    const fixedDate = new Date(2026, 9, 9, 23, 30, 0); // 9 de octubre 23:30 local
    expect(getLocalDateString(fixedDate)).toBe('2026-10-09');

    expect(extractDateOnly('2026-10-15T18:00:00Z')).toBe('2026-10-15');
    expect(extractDateOnly('2026-10-15')).toBe('2026-10-15');
    expect(extractDateOnly(null)).toBe('');
  });

  it('2. Carga y separa correctamente las cotizaciones en Atrasadas y Para Hoy', async () => {
    (apiRequest as any).mockResolvedValueOnce({
      data: mockDueQuotes,
      status: 200,
    });

    render(
      <FollowUpView
        currentUser={mockUser}
        onOpenPublicLink={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Atrasadas (1)')).toBeTruthy();
      expect(screen.getByText(/Para Hoy \(1\)/)).toBeTruthy();
    });

    expect(screen.getByText('COT-2026-101')).toBeTruthy();
    expect(screen.getByText('COT-2026-102')).toBeTruthy();
    expect(screen.getByText(/Llamar urgente por planos/)).toBeTruthy();
  });

  it('3. Encolar recordatorio en Outbox llama al endpoint /reminder y muestra feedback', async () => {
    (apiRequest as any).mockResolvedValueOnce({
      data: mockDueQuotes,
      status: 200,
    });

    render(
      <FollowUpView
        currentUser={mockUser}
        onOpenPublicLink={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('COT-2026-101')).toBeTruthy();
    });

    (apiRequest as any).mockResolvedValueOnce({
      data: { success: true },
      status: 200,
    });

    const reminderButtons = screen.getAllByTitle(/enviar recordatorio a la bandeja de salida/i);
    fireEvent.click(reminderButtons[0]);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/v1/quotations/q-overdue-1/reminder', {
        method: 'POST',
        body: JSON.stringify({
          channel: 'EMAIL',
          note: 'Llamar urgente por planos de cuaderna maestra',
        }),
      });
      expect(screen.getByText(/Recordatorio para COT-2026-101 encolado en Bandeja de Salida/)).toBeTruthy();
    });
  });

  it('4. Marcar como realizado abre confirmación, limpia nextActionAt y refresca lista', async () => {
    (apiRequest as any).mockResolvedValueOnce({
      data: mockDueQuotes,
      status: 200,
    });

    const onRefreshMock = vi.fn();

    render(
      <FollowUpView
        currentUser={mockUser}
        onRefreshQuotations={onRefreshMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('COT-2026-101')).toBeTruthy();
    });

    const doneButtons = screen.getAllByTitle(/marcar compromiso como realizado/i);
    fireEvent.click(doneButtons[0]);

    // Modal de confirmación abierto
    expect(screen.getByText('Confirmar Seguimiento Realizado')).toBeTruthy();

    (apiRequest as any).mockResolvedValueOnce({
      data: { ...mockDueQuotes[0], nextActionAt: null },
      status: 200,
    });
    // Siguiente llamada a fetchDueQuotes
    (apiRequest as any).mockResolvedValueOnce({
      data: [mockDueQuotes[1]],
      status: 200,
    });

    const confirmBtn = screen.getByText('Confirmar Realizado');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/v1/quotations/q-overdue-1/next-action', {
        method: 'PATCH',
        body: JSON.stringify({
          nextActionAt: null,
          nextActionNote: 'Seguimiento completado exitosamente',
        }),
      });
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('5. Reprogramar acción actualiza fecha y nota sin cerrar silenciosamente en caso de error', async () => {
    (apiRequest as any).mockResolvedValueOnce({
      data: mockDueQuotes,
      status: 200,
    });

    render(
      <FollowUpView
        currentUser={mockUser}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('COT-2026-101')).toBeTruthy();
    });

    const rescheduleBtn = screen.getByText('Reprogramar');
    fireEvent.click(rescheduleBtn);

    expect(screen.getByText('Agendar Próxima Acción de Seguimiento')).toBeTruthy();

    // Simular error del servidor
    (apiRequest as any).mockResolvedValueOnce({
      error: { detail: 'Fecha inválida en el servidor' },
      status: 400,
    });

    const saveBtn = screen.getByText('Guardar Acción');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Fecha inválida en el servidor')).toBeTruthy();
    });
  });

  it('6. Filtrado por término de búsqueda en vista de Seguimiento', async () => {
    (apiRequest as any).mockResolvedValueOnce({
      data: mockDueQuotes,
      status: 200,
    });

    render(
      <FollowUpView
        currentUser={mockUser}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('COT-2026-101')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/buscar por n.º o cliente/i);
    fireEvent.change(searchInput, { target: { value: 'Acuícola' } });

    expect(screen.queryByText('COT-2026-101')).toBeNull();
    expect(screen.getByText('COT-2026-102')).toBeTruthy();
  });

  it('7. Caso borde: Sin acciones pendientes muestra estado vacío amigable', async () => {
    (apiRequest as any).mockResolvedValueOnce({
      data: [],
      status: 200,
    });

    render(
      <FollowUpView
        currentUser={mockUser}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No hay acciones de seguimiento vencidas ni para hoy/)).toBeTruthy();
      expect(screen.getByText('No hay cotizaciones con acciones atrasadas.')).toBeTruthy();
      expect(screen.getByText('No hay acciones agendadas para hoy.')).toBeTruthy();
    });
  });
});
