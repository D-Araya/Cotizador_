import crypto from 'node:crypto';
import { Quotation, Invoice, OperationOrder } from '../../modules/types.js';
import { NumberingService } from './numbering.service.js';
import { buildPaymentSchedule } from '../routes/invoices.routes.js';
import { dbStore } from '../../modules/db/store.js';

/**
 * Calcula la fecha de expiración y si una cotización está vencida.
 * validUntil = sentAt + validityDays (o createdAt + validityDays si aún no enviada)
 */
export function computeQuotationValidity(q: Quotation): { validUntil: string; isExpired: boolean } {
  let validUntil = q.validUntil;
  if (!validUntil) {
    const baseDate = q.sentAt ? new Date(q.sentAt).getTime() : new Date(q.createdAt).getTime();
    const days = q.validityDays || 15;
    validUntil = new Date(baseDate + days * 86400000).toISOString();
  }
  const isPast = Date.now() > new Date(validUntil).getTime();
  const isExpired = isPast && q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && q.status !== 'DRAFT';
  return { validUntil, isExpired };
}

/**
 * Revisa cotizaciones enviadas/vistas y encola una advertencia en outbox
 * si faltan 3 días o menos para su vencimiento.
 */
export function checkExpiringQuotationsWarning(state = dbStore.getState()): void {
  const now = Date.now();
  const threeDaysMs = 3 * 86400000;

  for (const q of state.quotations) {
    if (q.status !== 'SENT' && q.status !== 'VIEWED' && q.status !== 'CHANGES_REQUESTED') {
      continue;
    }
    const { validUntil, isExpired } = computeQuotationValidity(q);
    if (isExpired) {
      q.status = 'EXPIRED';
      continue;
    }
    const msLeft = new Date(validUntil).getTime() - now;
    if (msLeft > 0 && msLeft <= threeDaysMs) {
      // Comprobar si ya existe un aviso en la bandeja de salida para este folio
      const alreadyWarned = state.outbox.some(
        (msg) => msg.quotationId === q.id && msg.subject?.includes('próxima a vencer')
      );
      if (!alreadyWarned) {
        const salesRep = state.users.find((u) => u.id === q.salesRepId) || state.users.find((u) => u.role === 'ADMIN') || state.users[0];
        const daysLeft = Math.max(1, Math.ceil(msLeft / 86400000));
        dbStore.addOutbox({
          quotationId: q.id,
          channel: 'EMAIL',
          recipient: salesRep?.email || 'ventas@mylnaval.cl',
          recipientName: salesRep?.name || 'Asesor Comercial',
          subject: `Aviso: Cotización ${q.quotationNumber} próxima a vencer (${daysLeft} días restantes)`,
          body: `Estimado/a ${salesRep?.name || 'Asesor'},\n\nLe informamos que la cotización N.º ${q.quotationNumber} para el cliente '${q.customerBusinessName || 'Cliente'}' vencerá el ${new Date(validUntil).toLocaleDateString('es-CL')} (en ${daysLeft} días).\n\nLe recomendamos realizar seguimiento comercial o generar una reactivación si el cliente lo requiere.`,
        });
      }
    }
  }
}

/**
 * Genera de forma inmediata el Documento de Cobro (DC-XXXXXX) con su PaymentSchedule
 * cuando una cotización es aceptada (online u offline).
 */
export async function createInvoiceForAcceptedQuotation(
  quote: Quotation,
  state = dbStore.getState(),
  actorName: string = 'Sistema'
): Promise<Invoice> {
  const existing = state.invoices.find((i) => i.quotationId === quote.id);
  if (existing) {
    return existing;
  }

  const invoiceNumber = await NumberingService.nextInvoiceNumber();
  const cust = state.customers.find((c) => c.id === quote.customerId);
  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const total = quote.grandTotal ?? quote.total ?? 0;

  const paymentTerms = quote.paymentTerms || quote.terms || '50% anticipo, 50% contra entrega';
  const paymentSchedule = buildPaymentSchedule(paymentTerms, total, issueDate, dueDate);

  const newInvoice: Invoice = {
    id: `inv-${crypto.randomUUID()}`,
    invoiceNumber,
    quotationId: quote.id,
    quotationNumber: quote.quotationNumber,
    customerId: quote.customerId,
    customerBusinessName: quote.customerBusinessName || cust?.businessName || 'Cliente',
    issueDate,
    dueDate,
    netSubtotal: quote.netSubtotal ?? quote.subtotal,
    subtotal: quote.subtotal,
    taxRatePct: quote.taxRatePct || 19,
    taxAmount: quote.taxAmount,
    total,
    paidAmount: 0,
    balance: total,
    status: 'PENDING',
    paymentTerms,
    items: (quote.lines || []).map((l) => ({
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
  return newInvoice;
}

/**
 * Genera automáticamente la Orden de Trabajo (OP-YYYY-XXXX) con hitos y entregables iniciales
 * cuando una cotización es aceptada (online u offline), si aún no existe una para dicha cotización.
 */
export async function createOperationForAcceptedQuotation(
  quote: Quotation,
  state = dbStore.getState()
): Promise<OperationOrder> {
  const existing = state.operations.find((o) => o.quotationId === quote.id);
  if (existing) {
    return existing;
  }

  const orderNumber = await NumberingService.nextOperationNumber();
  const cust = state.customers.find((c) => c.id === quote.customerId);
  const salesRep = state.users.find((u) => u.id === quote.salesRepId);
  const scheduledDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  const hasServices = (quote.lines || []).some((l) => l.type === 'SERVICE');
  const opType = hasServices ? 'SERVICE_EXECUTION' : 'PRODUCT_DELIVERY';
  const firstLineName = quote.lines?.[0]?.name || 'Proyecto de Ingeniería Naval';

  const newOp: OperationOrder = {
    id: `op-${crypto.randomUUID()}`,
    orderNumber,
    quotationId: quote.id,
    quotationNumber: quote.quotationNumber,
    customerId: quote.customerId,
    customerBusinessName: quote.customerBusinessName || cust?.businessName || 'Cliente',
    type: opType,
    title: quote.title || `Ejecución: ${firstLineName}`,
    description: quote.notes || 'Orden operativa generada automáticamente tras aprobación de cotización.',
    status: 'SCHEDULED',
    progressPct: 0,
    assignedStaff: salesRep?.name || 'Equipo de Operaciones M&L',
    scheduledDate,
    deliveryAddress: cust?.address || 'Instalaciones del cliente',
    itemsIncluded: (quote.lines || []).map((l) => `${l.quantity}x ${l.name}`),
    milestones: [
      {
        id: `ms-${crypto.randomUUID()}`,
        name: 'Planificación Técnica y Levantamiento de Información',
        date: scheduledDate,
        status: 'PENDING',
      },
      {
        id: `ms-${crypto.randomUUID()}`,
        name: opType === 'PRODUCT_DELIVERY' ? 'Preparación y Certificación de Suministros' : 'Ejecución Técnica en Terreno / Taller',
        date: scheduledDate,
        status: 'PENDING',
      },
      {
        id: `ms-${crypto.randomUUID()}`,
        name: opType === 'PRODUCT_DELIVERY' ? 'Despacho y Acta de Recepción Conforme' : 'Emisión de Informe Técnico Final y Planos',
        date: scheduledDate,
        status: 'PENDING',
      },
    ],
    deliverables: [
      {
        id: `dl-${crypto.randomUUID()}`,
        name: opType === 'PRODUCT_DELIVERY' ? 'Guía de Despacho y Certificados de Calidad' : 'Memoria Técnica y Planos Firmados',
        status: 'PENDING',
        link: `https://docs.mlingenieria.cl/${orderNumber.toLowerCase()}/entregable-principal.pdf`,
      },
    ],
  };

  state.operations.unshift(newOp);
  return newOp;
}

