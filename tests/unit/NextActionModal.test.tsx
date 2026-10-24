// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { NextActionModal } from '../../src/ui/modals/NextActionModal.tsx';
import { Quotation } from '../../src/modules/types.ts';

describe('NextActionModal Unit Tests', () => {
  const mockQuote: Quotation = {
    id: 'q-mod-1',
    quotationNumber: 'COT-2026-555',
    customerId: 'cust-1',
    customerBusinessName: 'Naviera Austral SpA',
    contactId: 'ct-1',
    salesRepId: 'usr-1',
    status: 'SENT',
    nextActionAt: '2026-10-25T12:00:00Z',
    nextActionNote: 'Llamar a jefe de máquinas por cotización de carena',
    grandTotal: 1000000,
    total: 1000000,
    marginPct: 30,
    statusHistory: [],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
  } as unknown as Quotation;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza e inicializa los campos con la fecha y nota existentes de la cotización', () => {
    render(
      <NextActionModal
        isOpen={true}
        onClose={vi.fn()}
        quotation={mockQuote}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText(/Programar Próxima Acción — COT-2026-555/)).toBeTruthy();
    const dateInput = screen.getByLabelText(/fecha de próxima acción/i) as HTMLInputElement;
    expect(dateInput.value).toBe('2026-10-25');

    const noteInput = screen.getByLabelText(/nota descriptiva/i) as HTMLTextAreaElement;
    expect(noteInput.value).toBe('Llamar a jefe de máquinas por cotización de carena');
  });

  it('2. Actualiza los valores cuando la prop quotation cambia', () => {
    const { rerender } = render(
      <NextActionModal
        isOpen={true}
        onClose={vi.fn()}
        quotation={mockQuote}
        onSave={vi.fn()}
      />
    );

    const otherQuote: Quotation = {
      ...mockQuote,
      id: 'q-mod-2',
      quotationNumber: 'COT-2026-999',
      nextActionAt: '2026-11-05T12:00:00Z',
      nextActionNote: 'Coordinar visita técnica a muelle',
    };

    rerender(
      <NextActionModal
        isOpen={true}
        onClose={vi.fn()}
        quotation={otherQuote}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText(/COT-2026-999/)).toBeTruthy();
    const dateInput = screen.getByLabelText(/fecha de próxima acción/i) as HTMLInputElement;
    expect(dateInput.value).toBe('2026-11-05');

    const noteInput = screen.getByLabelText(/nota descriptiva/i) as HTMLTextAreaElement;
    expect(noteInput.value).toBe('Coordinar visita técnica a muelle');
  });

  it('3. Llama a onSave con la fecha y nota editadas y cierra el modal en éxito', async () => {
    const onSaveMock = vi.fn().mockResolvedValue({ success: true });
    const onCloseMock = vi.fn();

    render(
      <NextActionModal
        isOpen={true}
        onClose={onCloseMock}
        quotation={mockQuote}
        onSave={onSaveMock}
      />
    );

    const dateInput = screen.getByLabelText(/fecha de próxima acción/i);
    fireEvent.change(dateInput, { target: { value: '2026-10-30' } });

    const noteInput = screen.getByLabelText(/nota descriptiva/i);
    fireEvent.change(noteInput, { target: { value: 'Nueva nota de seguimiento' } });

    const submitBtn = screen.getByText('Guardar Próxima Acción');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith('2026-10-30', 'Nueva nota de seguimiento');
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  it('4. Muestra mensaje de error cuando onSave retorna failure', async () => {
    const onSaveMock = vi.fn().mockResolvedValue({ success: false, error: 'Fecha inválida en backend' });
    const onCloseMock = vi.fn();

    render(
      <NextActionModal
        isOpen={true}
        onClose={onCloseMock}
        quotation={mockQuote}
        onSave={onSaveMock}
      />
    );

    const submitBtn = screen.getByText('Guardar Próxima Acción');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Fecha inválida en backend')).toBeTruthy();
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  it('5. Retorna null cuando isOpen es falso o quotation es null', () => {
    const { container } = render(
      <NextActionModal
        isOpen={false}
        onClose={vi.fn()}
        quotation={null}
        onSave={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
