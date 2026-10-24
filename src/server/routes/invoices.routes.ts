import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import { AuditService } from '../services/audit.service.js';
import { NumberingService } from '../services/numbering.service.js';
import { Invoice, PaymentMilestone, PaymentMethod, InvoicePaymentRecord } from '../../modules/types.js';
import { recordPaymentSchema } from '../schemas.js';
import { toClientInvoiceDTO } from '../dto.js';

export function applyInvoiceOverdueCheck(inv: Invoice): void {
  const now = Date.now();
  const total = inv.total || 0;
  const paid = (inv.payments || []).reduce((sum, p) => sum + p.amount, 0);
  inv.paidAmount = paid;
  inv.balance = Math.max(0, total - paid);

  // Recalcular hitos
  if (inv.paymentSchedule && inv.paymentSchedule.length > 0) {
    let rem = paid;
    for (const ms of inv.paymentSchedule) {
      if (rem >= ms.amount) {
        ms.status = 'PAID';
        ms.paidAmount = ms.amount;
        rem -= ms.amount;
      } else if (rem > 0) {
        ms.status = 'PARTIAL';
        ms.paidAmount = rem;
        rem = 0;
      } else {
        ms.paidAmount = 0;
        const isPast = new Date(ms.dueDate).getTime() < now;
        ms.status = isPast ? 'OVERDUE' : 'PENDING';
      }
    }
  }

  // Recalcular estado del documento: PENDING, PARTIAL, PAID u OVERDUE
  if (paid >= total && total > 0) {
    inv.status = 'PAID';
  } else if (paid > 0) {
    inv.status = 'PARTIAL';
  } else {
    const isPast = new Date(inv.dueDate).getTime() < now;
    inv.status = isPast ? 'OVERDUE' : 'PENDING';
  }
}

export function buildPaymentSchedule(
  terms: string = '',
  total: number,
  issueDate: string,
  defaultDueDate: string
): PaymentMilestone[] {
  const normTerms = (terms || '').toLowerCase();

  if (normTerms.includes('100') || normTerms.includes('contado')) {
    return [
      {
        id: `ms-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Pago Total 100%',
        percentage: 100,
        amount: total,
        dueDate: defaultDueDate,
        status: 'PENDING',
        paidAmount: 0,
      },
    ];
  }

  if (normTerms.includes('30') && normTerms.includes('70')) {
    const part1 = Math.round(total * 0.3);
    const part2 = total - part1;
    return [
      {
        id: `ms-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Anticipo 30%',
        percentage: 30,
        amount: part1,
        dueDate: issueDate,
        status: 'PENDING',
        paidAmount: 0,
      },
      {
        id: `ms-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Saldo Contra Entrega 70%',
        percentage: 70,
        amount: part2,
        dueDate: defaultDueDate,
        status: 'PENDING',
        paidAmount: 0,
      },
    ];
  }

  // Por defecto: 50% anticipo, 50% contra entrega
  const half1 = Math.round(total * 0.5);
  const half2 = total - half1;
  return [
    {
      id: `ms-${crypto.randomUUID().slice(0, 8)}`,
      label: 'Hito 1: Anticipo Comercial (50%)',
      percentage: 50,
      amount: half1,
      dueDate: issueDate,
      status: 'PENDING',
      paidAmount: 0,
    },
    {
      id: `ms-${crypto.randomUUID().slice(0, 8)}`,
      label: 'Hito 2: Contra Entrega y Recepción (50%)',
      percentage: 50,
      amount: half2,
      dueDate: defaultDueDate,
      status: 'PENDING',
      paidAmount: 0,
    },
  ];
}

export const invoicesRouter = express.Router();

invoicesRouter.use(authenticateStaff);

// GET /invoices con paginación ?page&pageSize&q&status -> { items, total }
invoicesRouter.get('/invoices', (req: Request, res: Response) => {
  const state = dbStore.getState();
  let list = [...state.invoices];

  // REGLA: El SALES_REP solo ve los documentos de sus cotizaciones
  if (req.user?.role === 'SALES_REP') {
    const repQuoteIds = new Set(
      state.quotations.filter((q) => q.salesRepId === req.user?.id).map((q) => q.id)
    );
    list = list.filter((inv) => repQuoteIds.has(inv.quotationId));
  }

  // Recalcular vencimientos y saldos
  list.forEach(applyInvoiceOverdueCheck);

  const { status, q, page, pageSize } = req.query;
  if (status) list = list.filter((inv) => inv.status === status);
  if (q) {
    const query = String(q).toLowerCase();
    list = list.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.quotationNumber.toLowerCase().includes(query) ||
        inv.customerBusinessName.toLowerCase().includes(query)
    );
  }

  list.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());

  if (page !== undefined || pageSize !== undefined) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.max(1, Number(pageSize) || 20);
    const start = (p - 1) * ps;
    return res.json({
      items: list.slice(start, start + ps),
      total: list.length,
      page: p,
      pageSize: ps,
    });
  }

  res.json(list);
});

invoicesRouter.get('/invoices/:id', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const inv = state.invoices.find((i) => i.id === req.params.id);
  if (!inv) return sendProblem(res, 404, 'Documento no encontrado', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === inv.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede acceder a documentos de otro asesor.');
    }
  }

  applyInvoiceOverdueCheck(inv);

  res.json(inv);
});

invoicesRouter.post('/invoices', async (req: Request, res: Response) => {
  const { quotationId, paymentTerms, dueDate } = req.body;
  if (!quotationId) {
    return sendProblem(res, 400, 'Datos incompletos', 'Se requiere quotationId.');
  }

  const state = dbStore.getState();
  const quote = state.quotations.find((q) => q.id === quotationId);
  if (!quote) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'No existe la cotización.');
  }

  if (quote.status !== 'ACCEPTED') {
    return sendProblem(
      res,
      400,
      'Cotización no aceptada',
      'Solo se puede generar documento de cobro para cotizaciones con estado ACEPTADA.'
    );
  }

  if (req.user?.role === 'SALES_REP' && quote.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'Solo puede facturar sus propias cotizaciones.');
  }

  const existing = state.invoices.find((i) => i.quotationId === quotationId);
  if (existing) {
    return sendProblem(res, 409, 'Documento ya emitido', 'Ya existe un documento de cobro para esta cotización.');
  }

  const invoiceNumber = await NumberingService.nextInvoiceNumber();

  const cust = state.customers.find((c) => c.id === quote.customerId);
  const total = quote.grandTotal ?? quote.total ?? 0;
  const issueDate = new Date().toISOString().split('T')[0];
  const finalDueDate = dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const terms = paymentTerms || quote.paymentTerms || quote.terms || '50% anticipo, 50% contra entrega';
  const paymentSchedule = buildPaymentSchedule(terms, total, issueDate, finalDueDate);

  const newInvoice: Invoice = {
    id: `inv-${crypto.randomUUID()}`,
    invoiceNumber,
    quotationId: quote.id,
    quotationNumber: quote.quotationNumber,
    customerId: quote.customerId,
    customerBusinessName: quote.customerBusinessName || cust?.businessName || 'Cliente',
    issueDate,
    dueDate: finalDueDate,
    netSubtotal: quote.netSubtotal ?? quote.subtotal,
    subtotal: quote.subtotal,
    taxRatePct: quote.taxRatePct,
    taxAmount: quote.taxAmount,
    total,
    paidAmount: 0,
    balance: total,
    status: 'PENDING',
    paymentTerms: terms,
    items: quote.lines.map((l) => ({
      id: crypto.randomUUID(),
      description: l.name,
      quantity: l.quantity,
      unitPrice: l.price,
      total: l.subtotal,
    })),
    paymentSchedule,
    payments: [],
  };

  state.invoices.push(newInvoice);

  await AuditService.logFromReq(
    req,
    'CREATE_INVOICE',
    'invoice',
    newInvoice.id,
    `Emitió documento de cobro ${newInvoice.invoiceNumber} por $${(newInvoice.total || 0).toLocaleString('es-CL')}`,
    null,
    newInvoice
  );

  res.status(201).json(newInvoice);
});

invoicesRouter.patch('/invoices/:id', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const inv = state.invoices.find((i) => i.id === req.params.id);
  if (!inv) return sendProblem(res, 404, 'Documento no encontrado', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === inv.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar cobros de otro asesor.');
    }
  }

  const { status, paymentTerms, dueDate, paidAt, paymentMethod } = req.body;
  const before = { ...inv };

  if (status) {
    if (!['ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'].includes(status)) {
      return sendProblem(res, 400, 'Estado inválido', 'Estado de cobro no permitido.');
    }
    inv.status = status;
    if (status === 'PAID') {
      inv.paidAt = paidAt || new Date().toISOString();
    }
  }
  if (paymentTerms !== undefined) inv.paymentTerms = String(paymentTerms);
  if (dueDate !== undefined) inv.dueDate = String(dueDate);
  if (paymentMethod !== undefined) inv.paymentMethod = String(paymentMethod);

  await AuditService.logFromReq(
    req,
    'UPDATE_INVOICE',
    'invoice',
    inv.id,
    `Actualizó documento ${inv.invoiceNumber} (estado: ${inv.status})`,
    before,
    inv
  );

  res.json(inv);
});

/**
 * POST /api/v1/invoices/:id/payments
 * Registra un abono o pago a un documento de cobro.
 * Admite abonos parciales y recalcula automáticamente los hitos y el estado (PENDING, PARTIAL, PAID, OVERDUE).
 */
invoicesRouter.post('/invoices/:id/payments', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const inv = state.invoices.find((i) => i.id === req.params.id);
  if (!inv) return sendProblem(res, 404, 'Documento no encontrado', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === inv.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede registrar pagos en documentos de otro asesor.');
    }
  }

  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(
      res,
      400,
      'Datos de pago inválidos',
      parsed.error.issues[0]?.message || 'Verifique los campos obligatorios del pago.'
    );
  }

  const { amount, paymentMethod, reference, paymentDate, notes } = parsed.data;

  const paymentRecord: InvoicePaymentRecord = {
    id: `pay-${crypto.randomUUID()}`,
    amount,
    paymentMethod,
    reference,
    paymentDate: paymentDate || new Date().toISOString().split('T')[0],
    registeredAt: new Date().toISOString(),
    registeredBy: req.user?.name || 'Personal',
    notes,
  };

  if (!inv.payments) inv.payments = [];
  inv.payments.push(paymentRecord);
  inv.paymentMethod = paymentMethod;

  applyInvoiceOverdueCheck(inv);

  await AuditService.logFromReq(
    req,
    'RECORD_PAYMENT',
    'invoice',
    inv.id,
    `Registró pago de $${amount.toLocaleString('es-CL')} (${paymentMethod}, Ref: ${reference}) para el documento ${inv.invoiceNumber}. Nuevo estado: ${inv.status}.`,
    null,
    paymentRecord
  );

  res.status(201).json({
    success: true,
    invoice: inv,
    payment: paymentRecord,
  });
});

