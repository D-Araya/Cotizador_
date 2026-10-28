import { describe, it, expect } from 'vitest';
import {
  buildPaymentSchedule,
  applyInvoiceOverdueCheck,
} from '../../src/server/routes/invoices.routes.js';
import { Invoice } from '../../src/modules/types.js';

describe('Invoices & Payment Schedule Unit Tests (src/server/routes/invoices.routes.ts)', () => {
  const issueDate = '2026-09-01';
  const dueDate = '2026-10-01';

  describe('buildPaymentSchedule', () => {
    it('genera 1 hito de 100% cuando los términos indican contado', () => {
      const schedule = buildPaymentSchedule('Pago 100% al contado', 1000000, issueDate, dueDate);
      expect(schedule.length).toBe(1);
      expect(schedule[0].percentage).toBe(100);
      expect(schedule[0].amount).toBe(1000000);
      expect(schedule[0].status).toBe('PENDING');
      expect(schedule[0].paidAmount).toBe(0);
    });

    it('genera división 30% / 70% cuando los términos lo especifican', () => {
      const schedule = buildPaymentSchedule('30% anticipo, 70% contra entrega', 1500000, issueDate, dueDate);
      expect(schedule.length).toBe(2);
      expect(schedule[0].percentage).toBe(30);
      expect(schedule[0].amount).toBe(450000);
      expect(schedule[0].dueDate).toBe(issueDate);

      expect(schedule[1].percentage).toBe(70);
      expect(schedule[1].amount).toBe(1050000);
      expect(schedule[1].dueDate).toBe(dueDate);

      // Suma total sin pérdida de pesos
      expect(schedule[0].amount + schedule[1].amount).toBe(1500000);
    });

    it('genera división 50% / 50% por defecto (estándar naval chileno)', () => {
      const schedule = buildPaymentSchedule('', 2500000, issueDate, dueDate);
      expect(schedule.length).toBe(2);
      expect(schedule[0].percentage).toBe(50);
      expect(schedule[0].amount).toBe(1250000);
      expect(schedule[1].percentage).toBe(50);
      expect(schedule[1].amount).toBe(1250000);
      expect(schedule[0].amount + schedule[1].amount).toBe(2500000);
    });

    it('maneja totales impares sin perder ningún peso por redondeo', () => {
      // 1000001 / 2 = 500000.5 -> 500001 y 500000
      const schedule = buildPaymentSchedule('50% / 50%', 1000001, issueDate, dueDate);
      expect(schedule[0].amount + schedule[1].amount).toBe(1000001);
    });
  });

  describe('applyInvoiceOverdueCheck', () => {
    function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
      const base: Invoice = {
        id: 'inv-test-01',
        invoiceNumber: 'DOC-2026-00010',
        quotationId: 'quote-01',
        quotationNumber: 'COT-2026-00010',
        customerId: 'cust-01',
        customerBusinessName: 'Austral Salmón & Mar SpA',
        issueDate: '2026-08-01',
        dueDate: '2026-09-01',
        subtotal: 1000000,
        netSubtotal: 1000000,
        taxRatePct: 19,
        taxAmount: 190000,
        total: 1190000,
        paidAmount: 0,
        balance: 1190000,
        status: 'PENDING',
        paymentTerms: '50% anticipo, 50% contra entrega',
        paymentSchedule: [
          {
            id: 'ms-1',
            label: 'Hito 1 (50%)',
            percentage: 50,
            amount: 595000,
            dueDate: '2026-08-01',
            status: 'PENDING',
            paidAmount: 0,
          },
          {
            id: 'ms-2',
            label: 'Hito 2 (50%)',
            percentage: 50,
            amount: 595000,
            dueDate: '2026-09-01',
            status: 'PENDING',
            paidAmount: 0,
          },
        ],
        items: [],
        payments: [],
      };
      return { ...base, ...overrides };
    }

    it('actualiza el balance y marca estado PENDING cuando no hay pagos', () => {
      const inv = createMockInvoice({ dueDate: new Date(Date.now() + 864000000).toISOString() });
      applyInvoiceOverdueCheck(inv);

      expect(inv.paidAmount).toBe(0);
      expect(inv.balance).toBe(1190000);
      expect(inv.status).toBe('PENDING');
    });

    it('marca OVERDUE si la fecha de vencimiento ya pasó y no hay pagos', () => {
      const pastDate = new Date(Date.now() - 864000000).toISOString();
      const inv = createMockInvoice({ dueDate: pastDate });
      applyInvoiceOverdueCheck(inv);

      expect(inv.status).toBe('OVERDUE');
    });

    it('marca PARTIAL y actualiza el primer hito cuando se paga parcialmente', () => {
      const inv = createMockInvoice({
        payments: [
          {
            id: 'pay-01',
            paymentDate: '2026-08-10',
            amount: 595000,
            paymentMethod: 'TRANSFERENCIA_BANCARIA',
            reference: 'TRANSF-9871',
            registeredBy: 'usr-admin-01',
            registeredAt: '2026-08-10T10:00:00Z',
          },
        ],
      });

      applyInvoiceOverdueCheck(inv);

      expect(inv.paidAmount).toBe(595000);
      expect(inv.balance).toBe(595000);
      expect(inv.status).toBe('PARTIAL');
      expect(inv.paymentSchedule![0].status).toBe('PAID');
      expect(inv.paymentSchedule![0].paidAmount).toBe(595000);
      expect(inv.paymentSchedule![1].status).toBe('OVERDUE'); // o PENDING según fecha
    });

    it('marca PAID y salda todos los hitos cuando el pago es completo', () => {
      const inv = createMockInvoice({
        payments: [
          {
            id: 'pay-01',
            paymentDate: '2026-08-10',
            amount: 1190000,
            paymentMethod: 'TRANSFERENCIA_BANCARIA',
            reference: 'TRANSF-TOTAL',
            registeredBy: 'usr-admin-01',
            registeredAt: '2026-08-10T10:00:00Z',
          },
        ],
      });

      applyInvoiceOverdueCheck(inv);

      expect(inv.paidAmount).toBe(1190000);
      expect(inv.balance).toBe(0);
      expect(inv.status).toBe('PAID');
      expect(inv.paymentSchedule![0].status).toBe('PAID');
      expect(inv.paymentSchedule![1].status).toBe('PAID');
    });
  });
});
