import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StatusBadge, ItemTypeBadge, statusLabels, getEffectiveQuotationStatus } from '../../src/ui/components/CommonBadges.tsx';
import { QuotationStatus, CatalogItemType } from '../../src/modules/types.ts';

describe('CommonBadges Component Tests', () => {
  describe('StatusBadge and statusLabels', () => {
    const statuses: Array<{ status: QuotationStatus; label: string }> = [
      { status: 'DRAFT', label: 'Borrador' },
      { status: 'SENT', label: 'Enviada / Pendiente' },
      { status: 'VIEWED', label: 'Vista por Cliente' },
      { status: 'ACCEPTED', label: 'Aceptada' },
      { status: 'REJECTED', label: 'Rechazada' },
      { status: 'EXPIRED', label: 'Vencida' },
    ];

    statuses.forEach(({ status, label }) => {
      it(`renderiza correctamente la insignia para estado ${status}`, () => {
        const html = renderToString(<StatusBadge status={status} />);
        expect(html).toContain(label);
        expect(statusLabels[status]).toContain(label);
      });
    });

    it('calcula estado EXPIRED correctamente a partir de la vigencia', () => {
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      // Cotización antigua (30 días atrás, validez 15) -> EXPIRED
      expect(getEffectiveQuotationStatus({ status: 'SENT', createdAt: pastDate, validityDays: 15 })).toBe('EXPIRED');
      // Cotización reciente (2 días atrás, validez 15) -> SENT
      expect(getEffectiveQuotationStatus({ status: 'SENT', createdAt: recentDate, validityDays: 15 })).toBe('SENT');
      // Cotización aceptada antigua no expira -> ACCEPTED
      expect(getEffectiveQuotationStatus({ status: 'ACCEPTED', createdAt: pastDate, validityDays: 15 })).toBe('ACCEPTED');
    });

    it('retorna null para estados no reconocidos', () => {
      const html = renderToString(<StatusBadge status={'UNKNOWN' as any} />);
      expect(html).toBe('');
    });
  });

  describe('ItemTypeBadge', () => {
    it('renderiza insignia para tipo PRODUCT', () => {
      const html = renderToString(<ItemTypeBadge type="PRODUCT" />);
      expect(html).toContain('Producto');
    });

    it('renderiza insignia para tipo SERVICE', () => {
      const html = renderToString(<ItemTypeBadge type="SERVICE" />);
      expect(html).toContain('Servicio');
    });
  });
});
