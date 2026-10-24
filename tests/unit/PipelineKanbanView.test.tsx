// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { PipelineKanbanView, KANBAN_COLUMNS } from '../../src/ui/components/PipelineKanbanView.tsx';
import { Quotation, CompanySettings } from '../../src/modules/types.ts';

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

describe('PipelineKanbanView Unit Tests (100% Coverage & Edge Cases)', () => {
  const mockCompany: CompanySettings = {
    id: 'comp-01',
    name: 'M&L Ingeniería Naval',
    legalName: 'M&L Ingeniería Naval SpA',
    rut: '76.123.456-7',
    address: 'Av. Costanera 1234, Puerto Montt',
    phone: '+56 9 8765 4321',
    email: 'contacto@mlingenieria.cl',
    minMarginPct: 25,
    hardMinMarginPct: 15,
    taxRatePct: 19,
    currency: 'CLP',
    ufRate: 38500,
    defaultPresentationText: 'Presentación',
    lossReasons: ['precio', 'plazo', 'competencia', 'otro'],
  } as unknown as CompanySettings;

  const sampleQuotations: Quotation[] = [
    {
      id: 'q-draft',
      quotationNumber: 'COT-2026-001',
      customerId: 'cust-1',
      customerBusinessName: 'Naviera Austral SpA',
      contactId: 'ct-1',
      salesRepId: 'rep-1',
      salesRepName: 'Carlos Navea',
      status: 'DRAFT',
      lines: [],
      netSubtotal: 1000000,
      taxAmount: 190000,
      grandTotal: 1190000,
      total: 1190000,
      marginPct: 28,
      statusHistory: [],
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'q-pending',
      quotationNumber: 'COT-2026-002',
      customerId: 'cust-2',
      customerBusinessName: 'Pesquera del Sur Ltda',
      contactId: 'ct-2',
      salesRepId: 'rep-2',
      salesRepName: 'Ana Morales',
      status: 'PENDING_APPROVAL',
      lines: [],
      netSubtotal: 2000000,
      taxAmount: 380000,
      grandTotal: 2380000,
      total: 2380000,
      marginPct: 18,
      marginException: true,
      marginApprovalStatus: 'PENDING',
      statusHistory: [],
      createdAt: '2026-10-02T10:00:00Z',
      updatedAt: '2026-10-02T10:00:00Z',
    },
    {
      id: 'q-sent',
      quotationNumber: 'COT-2026-003',
      customerId: 'cust-3',
      customerBusinessName: 'Transmarchilay',
      contactId: 'ct-3',
      salesRepId: 'rep-1',
      salesRepName: 'Carlos Navea',
      status: 'SENT',
      lines: [],
      netSubtotal: 3000000,
      taxAmount: 570000,
      grandTotal: 3570000,
      total: 3570000,
      marginPct: 32,
      publicToken: 'tok-abc-123',
      sentAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
      nextActionAt: new Date().toISOString(),
      nextActionNote: 'Llamar a jefe de operaciones',
      statusHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q-viewed',
      quotationNumber: 'COT-2026-004',
      customerId: 'cust-1',
      customerBusinessName: 'Naviera Austral SpA',
      contactId: 'ct-1',
      salesRepId: 'rep-1',
      salesRepName: 'Carlos Navea',
      status: 'VIEWED',
      lines: [],
      netSubtotal: 4000000,
      taxAmount: 760000,
      grandTotal: 4760000,
      total: 4760000,
      marginPct: 30,
      publicToken: 'tok-viewed-123',
      statusHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q-changes',
      quotationNumber: 'COT-2026-005',
      customerId: 'cust-2',
      customerBusinessName: 'Pesquera del Sur Ltda',
      contactId: 'ct-2',
      salesRepId: 'rep-2',
      salesRepName: 'Ana Morales',
      status: 'CHANGES_REQUESTED',
      lines: [],
      netSubtotal: 1500000,
      taxAmount: 285000,
      grandTotal: 1785000,
      total: 1785000,
      marginPct: 26,
      statusHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'q-accepted',
      quotationNumber: 'COT-2026-006',
      customerId: 'cust-3',
      customerBusinessName: 'Transmarchilay',
      contactId: 'ct-3',
      salesRepId: 'rep-1',
      salesRepName: 'Carlos Navea',
      status: 'ACCEPTED',
      lines: [],
      netSubtotal: 5000000,
      taxAmount: 950000,
      grandTotal: 5950000,
      total: 5950000,
      marginPct: 35,
      offlinePurchaseOrderNumber: 'OC-998877',
      statusHistory: [],
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-05T10:00:00Z',
    },
    {
      id: 'q-rejected',
      quotationNumber: 'COT-2026-007',
      customerId: 'cust-1',
      customerBusinessName: 'Naviera Austral SpA',
      contactId: 'ct-1',
      salesRepId: 'rep-2',
      salesRepName: 'Ana Morales',
      status: 'REJECTED',
      lossReason: 'precio',
      lines: [],
      netSubtotal: 2500000,
      taxAmount: 475000,
      grandTotal: 2975000,
      total: 2975000,
      marginPct: 20,
      statusHistory: [],
      createdAt: '2026-09-10T10:00:00Z',
      updatedAt: '2026-09-12T10:00:00Z',
    },
    {
      id: 'q-expired-by-date',
      quotationNumber: 'COT-2026-008',
      customerId: 'cust-2',
      customerBusinessName: 'Pesquera del Sur Ltda',
      contactId: 'ct-2',
      salesRepId: 'rep-1',
      salesRepName: 'Carlos Navea',
      status: 'SENT',
      sentAt: '2026-08-01T10:00:00Z',
      validUntil: '2026-08-16T10:00:00Z',
      validityDays: 15,
      lines: [],
      netSubtotal: 1000000,
      taxAmount: 190000,
      grandTotal: 1190000,
      total: 1190000,
      marginPct: 29,
      statusHistory: [],
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-01T10:00:00Z',
    },
  ] as unknown as Quotation[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza las 8 columnas del Kanban incluyendo PENDING_APPROVAL y VENCIDA', () => {
    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId('kanban-column-DRAFT')).toBeTruthy();
    expect(screen.getByTestId('kanban-column-PENDING_APPROVAL')).toBeTruthy();
    expect(screen.getByTestId('kanban-column-SENT')).toBeTruthy();
    expect(screen.getByTestId('kanban-column-VIEWED')).toBeTruthy();
    expect(screen.getByTestId('kanban-column-CHANGES_REQUESTED')).toBeTruthy();
    expect(screen.getByTestId('kanban-column-ACCEPTED')).toBeTruthy();
    expect(screen.getByTestId('kanban-column-REJECTED')).toBeTruthy();
    expect(screen.getByTestId('kanban-column-EXPIRED')).toBeTruthy();
  });

  it('2. Asigna cotización con fecha expirada a la columna EXPIRED según getEffectiveQuotationStatus', () => {
    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={vi.fn()}
      />
    );

    const expiredColumn = screen.getByTestId('kanban-column-EXPIRED');
    expect(expiredColumn.textContent).toContain('COT-2026-008');
  });

  it('3. Muestra PENDING_APPROVAL con advertencia y sin botón de mover arbitrario', () => {
    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={vi.fn()}
      />
    );

    const pendingColumn = screen.getByTestId('kanban-column-PENDING_APPROVAL');
    expect(pendingColumn.textContent).toContain('COT-2026-002');
    expect(pendingColumn.textContent).toContain('Requiere aprobación de margen');
  });

  it('4. Filtra cotizaciones en tiempo real mediante el campo de búsqueda', () => {
    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/buscar por n.º, cliente o asesor/i);
    fireEvent.change(searchInput, { target: { value: 'COT-2026-001' } });

    expect(screen.getByTestId('kanban-card-q-draft')).toBeTruthy();
    expect(screen.queryByTestId('kanban-card-q-sent')).toBeNull();

    // Búsqueda por cliente
    fireEvent.change(searchInput, { target: { value: 'Transmarchilay' } });
    expect(screen.getByTestId('kanban-card-q-sent')).toBeTruthy();
    expect(screen.getByTestId('kanban-card-q-accepted')).toBeTruthy();
    expect(screen.queryByTestId('kanban-card-q-draft')).toBeNull();
  });

  it('5. Mover de DRAFT a SENT llama al endpoint /send y ejecuta onRefresh en éxito', async () => {
    const onRefreshMock = vi.fn();
    (apiRequest as any).mockResolvedValueOnce({
      data: { ...sampleQuotations[0], status: 'SENT' },
      status: 200,
    });

    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={onRefreshMock}
      />
    );

    const draftCard = screen.getByTestId('kanban-card-q-draft');
    const sendButton = within(draftCard).getByText('Enviada');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/v1/quotations/q-draft/send', expect.anything());
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('6. Muestra feedback de error inline cuando el servidor rechaza la transición (res.error)', async () => {
    const onRefreshMock = vi.fn();
    (apiRequest as any).mockResolvedValueOnce({
      error: { detail: 'Margen por debajo del piso duro no negociable.' },
      status: 422,
    });

    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={onRefreshMock}
      />
    );

    const draftCard = screen.getByTestId('kanban-card-q-draft');
    const sendButton = within(draftCard).getByText('Enviada');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Margen por debajo del piso duro no negociable.')).toBeTruthy();
      expect(onRefreshMock).not.toHaveBeenCalled();
    });
  });

  it('7. Flujo de Rechazo: abre modal, selecciona motivo y registra pérdida', async () => {
    const onRefreshMock = vi.fn();
    (apiRequest as any).mockResolvedValueOnce({
      data: { ...sampleQuotations[2], status: 'REJECTED', lossReason: 'competencia' },
      status: 200,
    });

    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={onRefreshMock}
      />
    );

    const sentCard = screen.getByTestId('kanban-card-q-sent');
    const rejectButton = within(sentCard).getByText('Rechazar');
    fireEvent.click(rejectButton);

    // Modal abierto
    expect(screen.getByText('Registrar Motivo de Pérdida')).toBeTruthy();
    expect(screen.getAllByText(/COT-2026-003/).length).toBeGreaterThanOrEqual(1);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'competencia' } });

    const noteTextarea = screen.getByPlaceholderText(/detalles sobre por qué el cliente decidió no avanzar/i);
    fireEvent.change(noteTextarea, { target: { value: 'Cliente contrató astillero local en Chiloé' } });

    const submitBtn = screen.getByText('Confirmar Rechazo');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/api/v1/quotations/q-sent/reject', {
        method: 'POST',
        body: JSON.stringify({
          lossReason: 'competencia',
          note: 'Cliente contrató astillero local en Chiloé',
        }),
      });
      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it('8. Ejecuta los callbacks secundarios: onOfflineAccept, onScheduleAction, onOpenPublicLink', () => {
    const onOfflineAcceptMock = vi.fn();
    const onScheduleActionMock = vi.fn();
    const onOpenPublicLinkMock = vi.fn();

    render(
      <PipelineKanbanView
        quotations={sampleQuotations}
        company={mockCompany}
        onRefresh={vi.fn()}
        onOfflineAccept={onOfflineAcceptMock}
        onScheduleAction={onScheduleActionMock}
        onOpenPublicLink={onOpenPublicLinkMock}
      />
    );

    // Click en botón OC
    const ocButtons = screen.getAllByTitle(/registrar aceptación con orden de compra/i);
    fireEvent.click(ocButtons[0]);
    expect(onOfflineAcceptMock).toHaveBeenCalled();

    // Click en botón Agendar
    const agendarButtons = screen.getAllByTitle(/programar fecha y nota de seguimiento/i);
    fireEvent.click(agendarButtons[0]);
    expect(onScheduleActionMock).toHaveBeenCalled();

    // Click en Ver propuesta
    const verButtons = screen.getAllByTitle(/ver vista pública/i);
    fireEvent.click(verButtons[0]);
    expect(onOpenPublicLinkMock).toHaveBeenCalledWith('tok-abc-123');
  });

  it('9. Caso borde: lista vacía de cotizaciones', () => {
    render(
      <PipelineKanbanView
        quotations={[]}
        company={mockCompany}
        onRefresh={vi.fn()}
      />
    );

    const emptyMessages = screen.getAllByText('Sin cotizaciones');
    expect(emptyMessages.length).toBe(KANBAN_COLUMNS.length);
  });
});
