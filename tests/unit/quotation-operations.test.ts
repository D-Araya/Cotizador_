import { describe, it, expect, vi } from 'vitest';
import {
  computeQuotationValidity,
  checkExpiringQuotationsWarning,
  createInvoiceForAcceptedQuotation,
} from '../../src/server/services/quotation-operations.js';
import { dbStore } from '../../src/modules/db/store.js';
import { Quotation } from '../../src/modules/types.js';

describe('Quotation Operations Unit Tests (src/server/services/quotation-operations.ts)', () => {
  const baseQuote = {
    id: 'quote-test-01',
    quotationNumber: 'COT-2026-00099',
    customerId: 'cust-01',
    customerBusinessName: 'Austral Salmón & Mar SpA',
    salesRepId: 'usr-sales-01',
    salesRepName: 'Sebastián Morales',
    status: 'SENT' as const,
    currency: 'CLP',
    taxRatePct: 19,
    validityDays: 15,
    createdAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    lines: [],
    subtotal: 1000000,
    netSubtotal: 1000000,
    taxAmount: 190000,
    total: 1190000,
    grandTotal: 1190000,
    totalCost: 650000,
    marginPct: 35,
    statusHistory: [],
  } as unknown as Quotation;

  describe('computeQuotationValidity', () => {
    it('calcula la fecha de vencimiento a 15 días si no se especifica', () => {
      const now = Date.now();
      const quote: Quotation = {
        ...baseQuote,
        createdAt: new Date(now).toISOString(),
        sentAt: new Date(now).toISOString(),
        validityDays: 15,
        validUntil: undefined,
      };

      const { validUntil, isExpired } = computeQuotationValidity(quote);
      expect(isExpired).toBe(false);
      const diffMs = new Date(validUntil).getTime() - now;
      const diffDays = Math.round(diffMs / 86400000);
      expect(diffDays).toBe(15);
    });

    it('marca isExpired=true para cotizaciones SENT cuya vigencia ha expirado', () => {
      const pastDate = new Date(Date.now() - 20 * 86400000).toISOString(); // 20 días atrás
      const quote: Quotation = {
        ...baseQuote,
        createdAt: pastDate,
        sentAt: pastDate,
        validityDays: 15,
        status: 'SENT',
        validUntil: undefined,
      };

      const { isExpired } = computeQuotationValidity(quote);
      expect(isExpired).toBe(true);
    });

    it('NUNCA marca como expirada una cotización con estado DRAFT, ACCEPTED o REJECTED', () => {
      const pastDate = new Date(Date.now() - 50 * 86400000).toISOString();
      const expiredUntil = new Date(Date.now() - 30 * 86400000).toISOString();

      const draftQuote: Quotation = {
        ...baseQuote,
        status: 'DRAFT',
        createdAt: pastDate,
        validUntil: expiredUntil,
      };
      const acceptedQuote: Quotation = {
        ...baseQuote,
        status: 'ACCEPTED',
        createdAt: pastDate,
        validUntil: expiredUntil,
      };
      const rejectedQuote: Quotation = {
        ...baseQuote,
        status: 'REJECTED',
        createdAt: pastDate,
        validUntil: expiredUntil,
      };

      expect(computeQuotationValidity(draftQuote).isExpired).toBe(false);
      expect(computeQuotationValidity(acceptedQuote).isExpired).toBe(false);
      expect(computeQuotationValidity(rejectedQuote).isExpired).toBe(false);
    });

    it('utiliza createdAt si sentAt no está presente', () => {
      const pastDate = new Date(Date.now() - 2 * 86400000).toISOString();
      const quote: Quotation = {
        ...baseQuote,
        sentAt: undefined,
        createdAt: pastDate,
        validityDays: 10,
        validUntil: undefined,
      };

      const { validUntil, isExpired } = computeQuotationValidity(quote);
      expect(isExpired).toBe(false);
      expect(validUntil).toBeDefined();
    });
  });

  describe('checkExpiringQuotationsWarning', () => {
    it('genera un aviso en outbox si faltan 3 días o menos para vencer', () => {
      const now = Date.now();
      const expiresSoon = new Date(now + 2 * 86400000).toISOString(); // en 2 días

      const expiringQuote: Quotation = {
        ...baseQuote,
        id: 'quote-warning-01',
        quotationNumber: 'COT-2026-WARN-01',
        status: 'SENT',
        validUntil: expiresSoon,
      };

      const addedItems: any[] = [];
      const spy = vi.spyOn(dbStore, 'addOutbox').mockImplementation((item: any) => {
        addedItems.push(item);
        return item;
      });

      const mockState = {
        quotations: [expiringQuote],
        outbox: [],
        users: [{ id: 'usr-sales-01', email: 'smorales@mlingenieria.cl', name: 'Sebastián Morales', role: 'SALES_REP' }],
      };

      checkExpiringQuotationsWarning(mockState as any);

      expect(addedItems.length).toBe(1);
      expect(addedItems[0].quotationId).toBe('quote-warning-01');
      expect(addedItems[0].subject).toContain('próxima a vencer');
      expect(addedItems[0].subject).toContain('COT-2026-WARN-01');

      spy.mockRestore();
    });

    it('no genera avisos duplicados si ya existe uno en la bandeja outbox', () => {
      const now = Date.now();
      const expiresSoon = new Date(now + 2 * 86400000).toISOString();

      const expiringQuote: Quotation = {
        ...baseQuote,
        id: 'quote-warning-02',
        quotationNumber: 'COT-2026-WARN-02',
        status: 'SENT',
        validUntil: expiresSoon,
      };

      const addedItems: any[] = [];
      const spy = vi.spyOn(dbStore, 'addOutbox').mockImplementation((item: any) => {
        addedItems.push(item);
        return item;
      });

      const mockState = {
        quotations: [expiringQuote],
        outbox: [
          {
            quotationId: 'quote-warning-02',
            subject: 'Aviso: Cotización COT-2026-WARN-02 próxima a vencer (2 días restantes)',
          },
        ],
        users: [{ id: 'usr-sales-01', email: 'smorales@mlingenieria.cl', name: 'Sebastián Morales', role: 'SALES_REP' }],
      };

      checkExpiringQuotationsWarning(mockState as any);

      // No debe agregar un segundo mensaje
      expect(addedItems.length).toBe(0);

      spy.mockRestore();
    });
  });

  describe('createInvoiceForAcceptedQuotation', () => {
    it('crea un documento de cobro con totales, cliente y plan de pagos al aceptar la cotización', async () => {
      const acceptedQuote: Quotation = {
        ...baseQuote,
        id: 'quote-accepted-01',
        quotationNumber: 'COT-2026-ACC-01',
        status: 'ACCEPTED',
        grandTotal: 2380000,
        subtotal: 2000000,
        netSubtotal: 2000000,
        taxAmount: 380000,
        taxRatePct: 19,
        paymentTerms: '50% anticipo, 50% contra entrega',
      };

      const mockInvoices: any[] = [];
      const mockState = {
        invoices: mockInvoices,
        customers: [{ id: 'cust-01', businessName: 'Austral Salmón & Mar SpA' }],
      };

      const invoice = await createInvoiceForAcceptedQuotation(acceptedQuote, mockState as any);

      expect(invoice).toBeDefined();
      expect(invoice.quotationId).toBe('quote-accepted-01');
      expect(invoice.quotationNumber).toBe('COT-2026-ACC-01');
      expect(invoice.total).toBe(2380000);
      expect(invoice.balance).toBe(2380000);
      expect(invoice.paidAmount).toBe(0);
      expect(invoice.paymentSchedule!.length).toBe(2);
      expect(invoice.paymentSchedule![0].amount + invoice.paymentSchedule![1].amount).toBe(2380000);
    });

    it('devuelve el documento existente si ya había sido generado previamente (idempotencia)', async () => {
      const quote: Quotation = {
        ...baseQuote,
        id: 'quote-accepted-existing',
      };

      const existingInvoice = {
        id: 'inv-existing-123',
        invoiceNumber: 'DOC-2026-00001',
        quotationId: 'quote-accepted-existing',
        total: 1000000,
      };

      const mockState = {
        invoices: [existingInvoice],
        customers: [],
      };

      const result = await createInvoiceForAcceptedQuotation(quote, mockState as any);
      expect(result).toBe(existingInvoice);
      expect(result.id).toBe('inv-existing-123');
    });
  });
});
