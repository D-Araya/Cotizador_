import { Quotation, QuotationLine, Customer, Contact, Invoice, OperationOrder } from '../modules/types.js';
import { dbStore } from '../modules/db/store.js';

export interface PublicQuotationLineDTO {
  id: string;
  name: string;
  description?: string;
  unit: string;
  quantity: number;
  originalUnitPrice?: number;
  unitPrice: number;
  discountPct?: number;
  discountAmount?: number;
  subtotal: number;
}

export interface PublicQuotationDTO {
  id: string;
  quotationNumber: string;
  quotationGroupId: string;
  revision: number;
  isLatestRevision?: boolean;
  hasNewerRevision?: boolean;
  latestRevisionNumber?: string;
  latestRevisionToken?: string;
  latestRevisionId?: string;
  status: string;
  createdAt: string;
  sentAt?: string;
  validUntil: string;
  acceptedAt?: string;
  currency: string;
  grossSubtotal?: number;
  discountPct?: number;
  discountAmount?: number;
  totalSavings?: number;
  netSubtotal: number;
  subtotal: number;
  taxRatePct: number;
  taxAmount: number;
  grandTotal: number;
  total: number;
  presentationText?: string;
  notes?: string;
  terms?: string;
  lines: PublicQuotationLineDTO[];
  clientSignerName?: string;
  clientSignerPosition?: string;
  acceptanceHash?: string;
  acceptedOffline?: boolean;
  offlinePurchaseOrderNumber?: string;
  offlineAcceptedBy?: string;
  offlineNote?: string;
  ufRate?: number;
  ufNetSubtotal?: number;
  ufGrandTotal?: number;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    description?: string;
    addedAt: string;
  }>;
  customer?: {
    businessName: string;
    taxId: string;
    address: string;
  };
  contact?: {
    name: string;
    email: string;
    phone: string;
  };
  commercialContact?: {
    name: string;
    email: string;
    phone: string;
  };
  timelineEvents: Array<{
    title: string;
    description: string;
    timestamp: string;
  }>;
}

/**
 * Convierte una cotización interna a un DTO público/cliente estrictamente sanitizado.
 * Garantía: Ningún costo, utilidad, margen ni comentario interno es devuelto.
 */
export function toPublicQuotationDTO(
  q: Quotation,
  customer?: Customer,
  contact?: Contact,
  salesRep?: { name: string; email: string; phone: string },
  meta?: {
    hasNewerRevision?: boolean;
    latestRevisionNumber?: string;
    latestRevisionToken?: string;
    latestRevisionId?: string;
  }
): PublicQuotationDTO {
  const sanitizedLines: PublicQuotationLineDTO[] = (q.lines || []).map((line: QuotationLine) => ({
    id: line.id,
    name: line.name || 'Ítem de Servicio Naval',
    description: line.skuOrCode || '',
    unit: line.unit || 'UND',
    quantity: line.quantity,
    originalUnitPrice: line.originalUnitPrice ?? line.price,
    unitPrice: line.price,
    discountPct: line.discountPct,
    discountAmount: line.discountAmount,
    subtotal: line.subtotal,
  }));

  // Generar eventos de cara al cliente con textos fijos orientados al cliente
  const clientEvents = [
    {
      title: 'Cotización Emitida',
      description: `Propuesta comercial ${q.quotationNumber} formalizada y remitida por el equipo de ingeniería.`,
      timestamp: q.createdAt,
    },
  ];

  if (q.status === 'VIEWED' || q.status === 'ACCEPTED' || q.status === 'REJECTED' || q.status === 'CHANGES_REQUESTED') {
    clientEvents.push({
      title: 'Cotización Revisada',
      description: 'El documento técnico y comercial fue visualizado por el cliente.',
      timestamp: q.updatedAt,
    });
  }

  if (q.status === 'CHANGES_REQUESTED') {
    clientEvents.push({
      title: 'Ajuste Solicitado',
      description: 'El cliente solicitó ajustes y observaciones en la propuesta técnica/económica.',
      timestamp: q.updatedAt,
    });
  }

  if (q.status === 'ACCEPTED') {
    clientEvents.push({
      title: q.acceptedOffline ? 'Aceptación Registrada (Orden de Compra)' : 'Aprobación Comercial Confirmada',
      description: q.acceptedOffline
        ? `Propuesta aceptada con N.º de Orden de Compra/Ref: ${q.offlinePurchaseOrderNumber || 'S/N'}. Registrado por el personal.`
        : 'La propuesta técnica ha sido formalmente aceptada con firma digital por el mandante.',
      timestamp: q.acceptedAt || q.updatedAt,
    });
  } else if (q.status === 'REJECTED') {
    clientEvents.push({
      title: 'Cotización Desestimada',
      description: 'El requerimiento fue cerrado sin adjudicación.',
      timestamp: q.rejectedAt || q.updatedAt,
    });
  }

  const validUntil = q.validUntil || (q.sentAt
    ? new Date(new Date(q.sentAt).getTime() + (q.validityDays || 15) * 86400000).toISOString()
    : new Date(new Date(q.createdAt).getTime() + (q.validityDays || 15) * 86400000).toISOString());

  return {
    id: q.id,
    quotationNumber: q.quotationNumber,
    quotationGroupId: q.quotationGroupId || q.id,
    revision: q.revision || 1,
    isLatestRevision: meta?.hasNewerRevision ? false : true,
    hasNewerRevision: meta?.hasNewerRevision,
    latestRevisionNumber: meta?.latestRevisionNumber,
    latestRevisionToken: meta?.latestRevisionToken,
    latestRevisionId: meta?.latestRevisionId,
    status: q.status,
    createdAt: q.createdAt,
    sentAt: q.sentAt,
    validUntil,
    acceptedAt: q.acceptedAt,
    currency: q.currency || 'CLP',
    grossSubtotal: q.grossSubtotal ?? q.subtotal,
    discountPct: q.discountPct,
    discountAmount: q.discountAmount,
    totalSavings: q.totalSavings,
    netSubtotal: q.subtotal,
    subtotal: q.subtotal,
    taxRatePct: q.taxRatePct || 19,
    taxAmount: q.taxAmount,
    grandTotal: q.grandTotal,
    total: q.grandTotal,
    presentationText: q.presentationText,
    notes: q.notes,
    terms: q.terms,
    lines: sanitizedLines,
    clientSignerName: q.clientSignerName,
    clientSignerPosition: q.clientSignerPosition,
    acceptanceHash: q.acceptanceHash,
    acceptedOffline: q.acceptedOffline,
    offlinePurchaseOrderNumber: q.offlinePurchaseOrderNumber,
    offlineAcceptedBy: q.offlineAcceptedBy,
    offlineNote: q.offlineNote,
    ufRate: q.ufRate || dbStore.getState().company.ufRate,
    ufNetSubtotal: q.ufNetSubtotal ?? ((q.ufRate || dbStore.getState().company.ufRate) ? Number(((q.subtotal ?? q.netSubtotal ?? 0) / (q.ufRate || dbStore.getState().company.ufRate)!).toFixed(2)) : undefined),
    ufGrandTotal: q.ufGrandTotal ?? ((q.ufRate || dbStore.getState().company.ufRate) ? Number(((q.grandTotal ?? q.total ?? 0) / (q.ufRate || dbStore.getState().company.ufRate)!).toFixed(2)) : undefined),
    attachments: (q.attachments || []).map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      description: a.description,
      addedAt: a.addedAt,
    })),
    customer: customer ? {
      businessName: customer.businessName,
      taxId: customer.taxId,
      address: customer.address,
    } : undefined,
    contact: contact ? {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
    } : undefined,
    commercialContact: salesRep ? {
      name: salesRep.name,
      email: salesRep.email,
      phone: salesRep.phone,
    } : undefined,
    timelineEvents: clientEvents,
  };
}

/**
 * Sanitiza documentos de cobro para el portal del cliente
 */
export function toClientInvoiceDTO(inv: Invoice) {
  const isPaid = inv.status === 'PAID';
  const total = inv.total || 0;
  const paidAmount = inv.paidAmount !== undefined ? inv.paidAmount : (isPaid ? total : 0);
  const balance = inv.balance !== undefined ? inv.balance : Math.max(0, total - paidAmount);

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    quotationId: inv.quotationId,
    quotationNumber: inv.quotationNumber,
    subtotal: inv.subtotal,
    taxAmount: inv.taxAmount,
    total,
    paidAmount,
    balance,
    status: inv.status,
    issuedAt: inv.issueDate,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    paymentMethod: inv.paymentMethod,
    paymentTerms: inv.paymentTerms,
    items: inv.items,
    paymentSchedule: inv.paymentSchedule || [],
    payments: inv.payments || [],
  };
}

/**
 * Sanitiza órdenes de trabajo para el portal del cliente
 */
export function toClientOperationDTO(op: OperationOrder) {
  return {
    id: op.id,
    orderNumber: op.orderNumber,
    quotationId: op.quotationId,
    quotationNumber: op.quotationNumber,
    status: op.status,
    title: op.title,
    description: op.description,
    progressPct: op.progressPct,
    assignedStaff: op.assignedStaff,
    scheduledDate: op.scheduledDate,
    completedDate: op.completedDate,
    itemsIncluded: op.itemsIncluded,
    milestones: (op.milestones || []).map((m) => ({
      id: m.id,
      name: m.name,
      date: m.date,
      status: m.status,
      completedAt: m.completedAt,
    })),
    deliverables: (op.deliverables || []).map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      link: d.link,
      attachments: (d.attachments || []).map((a) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        description: a.description,
        addedAt: a.addedAt,
      })),
    })),
  };
}
