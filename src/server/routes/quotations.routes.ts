import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { Quotation, QuotationLine, ExtraCostLine } from '../../modules/types.js';
import { authenticateStaff } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import {
  updateQuotationLinesSchema,
  quotationSettingsUpdateSchema,
  quotationExtraCostsSchema,
  quotationCreateSchema,
  quotationStatusUpdateSchema,
  quotationOfflineAcceptSchema,
  quotationNextActionSchema,
  quotationRejectSchema,
  quotationMarginApprovalSchema,
  quotationMarginRejectSchema,
  quotationMarginRequestSchema,
  quotationAttachmentSchema,
} from '../schemas.js';
import { requireAdmin } from '../middleware/auth.js';
import { computeTotals } from '../../shared-kernel/pricing/computeTotals.js';
import { generatePublicQuotationToken } from '../auth.js';
import { NumberingService } from '../services/numbering.service.js';
import { AuditService } from '../services/audit.service.js';
import { OutboxService } from '../services/outbox.service.js';
import { Quantity } from '../../shared-kernel/value-objects.js';
import {
  computeQuotationValidity,
  checkExpiringQuotationsWarning,
  createInvoiceForAcceptedQuotation,
} from '../services/quotation-operations.js';

export const quotationsRouter = express.Router();

// Todas las rutas de cotizaciones internas requieren personal autenticado
quotationsRouter.use(authenticateStaff);

/**
 * GET /api/v1/quotations
 * Lista de cotizaciones con paginación y filtros ?page&pageSize&q&status
 * Si el usuario es SALES_REP, devuelve ÚNICAMENTE las suyas.
 */
quotationsRouter.get('/', (req: Request, res: Response) => {
  const state = dbStore.getState();
  checkExpiringQuotationsWarning(state);

  let list = [...state.quotations];

  // Comprobar vigencia de cada cotización
  list.forEach((q) => {
    const { isExpired } = computeQuotationValidity(q);
    if (isExpired && q.status !== 'ACCEPTED' && q.status !== 'REJECTED' && q.status !== 'DRAFT') {
      q.status = 'EXPIRED';
    }
  });

  const { status, customerId, salesRepId, q, page, pageSize } = req.query;

  // REGLA DE AUTORIZACIÓN: El SALES_REP solo accede a sus propias cotizaciones
  if (req.user?.role === 'SALES_REP') {
    list = list.filter((item) => item.salesRepId === req.user?.id);
  } else if (salesRepId) {
    list = list.filter((item) => item.salesRepId === salesRepId);
  }

  if (status) {
    list = list.filter((item) => item.status === status);
  }
  if (customerId) {
    list = list.filter((item) => item.customerId === customerId);
  }
  if (q) {
    const query = (q as string).toLowerCase();
    list = list.filter(
      (item) =>
        item.quotationNumber.toLowerCase().includes(query) ||
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.customerBusinessName && item.customerBusinessName.toLowerCase().includes(query))
    );
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

/**
 * POST /api/v1/quotations
 * Crea un nuevo borrador (Paso 1). El salesRepId se deriva del usuario autenticado.
 */
quotationsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = quotationCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'Datos de cotización inválidos');
  }

  const { customerId, contactId, salesRepId: requestedRepId, internalNotes } = parsed.data;
  const state = dbStore.getState();

  const customer = state.customers.find((c) => c.id === customerId && !c.deletedAt);
  if (!customer) {
    return sendProblem(res, 404, 'Cliente no encontrado', 'El cliente seleccionado no existe o está inactivo.');
  }

  const contact = contactId
    ? state.contacts.find((c) => c.id === contactId && c.customerId === customerId && !c.deletedAt)
    : state.contacts.find((c) => c.customerId === customerId && !c.deletedAt);

  const company = state.company;
  const qNum = await NumberingService.nextQuotationNumber();
  const { token: publicToken } = generatePublicQuotationToken();

  // El salesRepId: Admin puede crear a nombre de un asesor elegido; SALES_REP siempre sus propias cotizaciones
  let salesRepId = req.user?.id || 'usr-admin-01';
  let salesRepName = req.user?.name || 'Asesor Comercial';

  if (req.user?.role === 'ADMIN' && requestedRepId) {
    const chosenRep = state.users.find((u) => u.id === requestedRepId && !u.deletedAt);
    if (chosenRep) {
      salesRepId = chosenRep.id;
      salesRepName = chosenRep.name;
    }
  } else if (req.user?.role === 'SALES_REP') {
    salesRepId = req.user.id;
    salesRepName = req.user.name;
  } else if (customer.salesRepId) {
    const custRep = state.users.find((u) => u.id === customer.salesRepId && !u.deletedAt);
    if (custRep) {
      salesRepId = custRep.id;
      salesRepName = custRep.name;
    }
  }

  const newQuotation: Quotation = {
    id: `quot-${crypto.randomUUID()}`,
    quotationNumber: qNum,
    customerId,
    customerBusinessName: customer.businessName,
    contactId: contact?.id || '',
    salesRepId,
    salesRepName,
    title: req.body.title || `Suministros y Servicios Navales - ${customer.businessName}`,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    validityDays: 15,
    publicToken,
    currency: parsed.data.currency || company.currency || 'CLP',
    ufRate: company.ufRate || 38500,
    marginException: false,
    marginApprovalStatus: 'NONE',
    attachments: [],
    minMarginPctApplied: company.minMarginPct,
    presentationText: company.defaultPresentationText,
    notes: 'Cotización técnica sujeta a disponibilidad de astillero y suministros.',
    internalNotes: internalNotes || '',
    terms: company.defaultTerms,
    termsAccepted: false,
    lines: [],
    extraCosts: [],
    statusHistory: [
      {
        id: `hist-${crypto.randomUUID()}`,
        fromStatus: null,
        toStatus: 'DRAFT',
        actor: req.user?.name || 'Personal',
        actorRole: req.user?.role || 'SALES_REP',
        comment: 'Creación de nuevo borrador de cotización',
        timestamp: new Date().toISOString(),
      },
    ],
    totalCost: 0,
    totalSale: 0,
    profit: 0,
    marginPct: 0,
    subtotal: 0,
    netSubtotal: 0,
    taxRatePct: company.taxRatePct,
    taxAmount: 0,
    total: 0,
    grandTotal: 0,
    extraCostsTotal: 0,
  };

  state.quotations.unshift(newQuotation);

  await AuditService.logFromReq(
    req,
    'CREATE_QUOTATION',
    'quotation',
    newQuotation.id,
    `Creó el borrador de cotización ${newQuotation.quotationNumber} para el cliente '${customer.businessName}'.`,
    null,
    newQuotation
  );

  res.status(201).json(newQuotation);
});

/**
 * GET /api/v1/quotations/follow-up/due
 * Vista "Hoy / Atrasadas" para el asesor (P2.h).
 * Lista cotizaciones con nextActionAt vencido (atrasadas) o programado para hoy.
 * El asesor (SALES_REP) solo ve las suyas; el ADMIN ve todas.
 */
quotationsRouter.get('/follow-up/due', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  let list = [...state.quotations];

  if (req.user?.role === 'SALES_REP') {
    list = list.filter((q) => q.salesRepId === req.user?.id);
  }

  // Filtrar solo las que tienen nextActionAt definido y cuya fecha sea <= hoy (hoy o atrasada)
  const dueQuotes = list.filter((q) => {
    if (q.status === 'ACCEPTED' || q.status === 'REJECTED') return false;
    if (q.nextActionAt) {
      return new Date(q.nextActionAt).getTime() <= todayEnd;
    }
    return false;
  });

  // Ordenar: primero las más atrasadas (nextActionAt más antiguo)
  dueQuotes.sort((a, b) => new Date(a.nextActionAt!).getTime() - new Date(b.nextActionAt!).getTime());

  res.json(dueQuotes);
});

/**
 * GET /api/v1/quotations/:id
 */
quotationsRouter.get('/:id', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  // REGLA: El SALES_REP solo puede ver sus propias cotizaciones
  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No tiene permisos para ver cotizaciones asignadas a otro asesor.');
  }

  const { isExpired } = computeQuotationValidity(quot);
  if (isExpired && quot.status !== 'ACCEPTED' && quot.status !== 'REJECTED' && quot.status !== 'DRAFT') {
    quot.status = 'EXPIRED';
  }

  const groupId = quot.quotationGroupId || quot.id;
  const groupQuotes = state.quotations.filter((q) => q.quotationGroupId === groupId || q.id === groupId);
  const revisionsHistory = groupQuotes
    .sort((a, b) => (b.revision || 1) - (a.revision || 1))
    .map((q) => ({
      id: q.id,
      quotationNumber: q.quotationNumber,
      revision: q.revision || 1,
      status: q.status,
      createdAt: q.createdAt,
      grandTotal: q.grandTotal,
      isLatestRevision: q.isLatestRevision !== false,
    }));

  res.json({
    ...quot,
    revisionsHistory,
  });
});

/**
 * PATCH /api/v1/quotations/:id
 * Paso 4 y Autoguardado: Actualiza texto de presentación, notas, términos y validez (OpenAPI updateQuotationSettings).
 */
quotationsRouter.patch('/:id', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar cotizaciones de otro asesor.');
  }

  if (quot.status !== 'DRAFT' && quot.status !== 'PENDING_APPROVAL') {
    return sendProblem(res, 400, 'Cotización no editable', 'Solo las cotizaciones en estado borrador o pendiente de aprobación pueden ser modificadas.');
  }

  const parsed = quotationSettingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Datos de configuración de cotización inválidos');
  }

  const { presentationText, notes, internalNotes, terms, validityDays, title, currency, discountPct } = parsed.data;

  if (presentationText !== undefined) quot.presentationText = presentationText;
  if (notes !== undefined) quot.notes = notes;
  if (internalNotes !== undefined) quot.internalNotes = internalNotes;
  if (terms !== undefined) quot.terms = terms;
  if (title !== undefined) quot.title = title;
  if (currency !== undefined) quot.currency = currency;
  if (validityDays !== undefined) {
    quot.validityDays = validityDays;
    if (quot.sentAt) {
      quot.validUntil = new Date(new Date(quot.sentAt).getTime() + validityDays * 86400000).toISOString();
    }
  }
  if (discountPct !== undefined) {
    quot.discountPct = discountPct;
  }

  quot.updatedAt = new Date().toISOString();

  res.json(quot);
});

/**
 * PUT /api/v1/quotations/:id/lines
 * Reemplaza líneas de la cotización con validación estricta de margen y derivación de costos del catálogo.
 * - Acepta solo { catalogItemId, quantity, price | marginPct }
 * - El servidor toma cost, unit y name del catálogo real (el costo enviado por cliente es IGNORADO)
 * - Las líneas sin catálogo ("ítem libre") exigen rol ADMIN
 */
quotationsRouter.put('/:id/lines', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  // Comprobar propiedad
  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar cotizaciones de otro asesor.');
  }

  if (quot.status !== 'DRAFT' && quot.status !== 'PENDING_APPROVAL') {
    return sendProblem(res, 400, 'Cotización no editable', 'Solo las cotizaciones en estado borrador o pendiente de aprobación pueden ser modificadas.');
  }

  const parsed = updateQuotationLinesSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Líneas inválidas', parsed.error.issues[0]?.message || 'Estructura de líneas inválida');
  }

  const rawLines = parsed.data.lines;
  const lineInputsForPricing: Array<{
    catalogItemId?: string;
    cost: number;
    price?: number;
    marginPct?: number;
    discountPct?: number;
    quantity: number;
    name: string;
    unit: string;
  }> = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (raw.catalogItemId) {
      const catItem = state.catalogItems.find((ci) => ci.id === raw.catalogItemId);
      if (!catItem) {
        return sendProblem(res, 400, 'Ítem no encontrado', `El ítem de catálogo con ID ${raw.catalogItemId} no existe.`);
      }
      const unit = catItem.unit || 'UND';
      try {
        new Quantity(raw.quantity, unit);
      } catch (err: any) {
        return sendProblem(res, 400, 'Cantidad inválida', err.message || 'Cantidad no válida');
      }

      // Servidor deriva cost, unit y name del catálogo real (ignora cualquier costo del cliente)
      lineInputsForPricing.push({
        catalogItemId: catItem.id,
        cost: catItem.unitCost,
        price: raw.price !== undefined ? raw.price : (raw.marginPct !== undefined ? undefined : catItem.listPrice),
        marginPct: raw.marginPct,
        discountPct: raw.discountPct,
        quantity: raw.quantity,
        name: catItem.name,
        unit,
      });
    } else {
      // Línea sin catálogo ("ítem libre"): Exige rol ADMIN
      if (req.user?.role !== 'ADMIN') {
        return sendProblem(
          res,
          403,
          'Privilegio insuficiente',
          `La línea ${i + 1} no corresponde a un ítem de catálogo. Solo un Administrador puede crear ítems libres no catalogados.`
        );
      }
      try {
        new Quantity(raw.quantity, 'UND');
      } catch (err: any) {
        return sendProblem(res, 400, 'Cantidad inválida', err.message || 'Cantidad no válida');
      }
      lineInputsForPricing.push({
        cost: 0,
        price: raw.price || 0,
        marginPct: raw.marginPct,
        discountPct: raw.discountPct,
        quantity: raw.quantity,
        name: raw.description || 'Ítem de Servicio Libre',
        unit: 'UND',
      });
    }
  }

  const company = state.company;
  const globalDiscountPct = parsed.data.discountPct !== undefined ? parsed.data.discountPct : (quot.discountPct || 0);
  const hardFloor = company.hardMinMarginPct !== undefined ? company.hardMinMarginPct : 0;
  const totals = computeTotals(lineInputsForPricing, company.minMarginPct, company.taxRatePct, globalDiscountPct, hardFloor, company.ufRate);

  // Validación de margen (P3.l)
  if (lineInputsForPricing.length > 0) {
    // 1. Si está bajo el piso duro: SIEMPRE SE BLOQUEA
    if (totals.marginPct < hardFloor) {
      return sendProblem(
        res,
        422,
        'Margen insuficiente',
        `El margen actual (${totals.marginPct}%) es inferior al mínimo corporativo (${totals.minMarginPct}%) y al piso duro no negociable (${hardFloor}%). La cotización está estrictamente bloqueada. Faltan $ ${(totals.shortfall || 0).toLocaleString('es-CL')} para alcanzar el margen requerido.`,
        {
          marginPct: totals.marginPct,
          minMarginPct: totals.minMarginPct,
          hardMinMarginPct: hardFloor,
          shortfall: totals.shortfall,
        }
      );
    }

    // 2. Si cae entre el piso duro y el mínimo corporativo:
    // P3.l: no se bloquea, pasa a "Pendiente de aprobación"; el asesor escribe un motivo
    if (!totals.meetsMinimum) {
      if (!quot.marginException || quot.marginApprovalStatus !== 'APPROVED') {
        quot.status = 'PENDING_APPROVAL';
        quot.marginApprovalStatus = 'PENDING';
        if (parsed.data.marginExceptionReason) {
          quot.marginExceptionReason = parsed.data.marginExceptionReason;
        }
      }
    } else {
      // Cumple el mínimo normalmente: si estaba pendiente de aprobación por margen, vuelve a DRAFT
      if (quot.status === 'PENDING_APPROVAL') {
        quot.status = 'DRAFT';
        quot.marginApprovalStatus = 'NONE';
      }
    }
  }

  // Asignar líneas procesadas con IDs seguros
  const processedLines: QuotationLine[] = totals.lines.map((l, idx) => {
    const catItem = l.catalogItemId ? state.catalogItems.find((ci) => ci.id === l.catalogItemId) : null;
    return {
      id: `line-${crypto.randomUUID()}`,
      catalogItemId: l.catalogItemId,
      type: catItem?.type || 'SERVICE',
      skuOrCode: (catItem as any)?.sku || (catItem as any)?.code || undefined,
      name: lineInputsForPricing[idx].name,
      unit: lineInputsForPricing[idx].unit,
      cost: l.cost,
      originalUnitPrice: l.originalUnitPrice,
      price: l.unitPrice,
      discountPct: l.discountPct,
      discountAmount: l.discountAmount,
      quantity: l.quantity,
      marginPct: l.marginPct,
      costTotal: l.costTotal,
      subtotal: l.subtotal,
    };
  });

  quot.lines = processedLines;
  quot.discountPct = totals.discountPct;
  quot.discountAmount = totals.discountAmount;
  quot.totalSavings = totals.totalSavings;
  quot.grossSubtotal = totals.grossNetSubtotal;
  quot.netSubtotal = totals.netSubtotal;
  quot.totalCost = totals.totalCost;
  quot.totalSale = totals.netSubtotal;
  quot.profit = totals.profit;
  quot.marginPct = totals.marginPct;
  quot.subtotal = totals.netSubtotal;
  quot.taxRatePct = totals.taxRatePct;
  quot.taxAmount = totals.taxAmount;
  quot.grandTotal = totals.grandTotal;
  quot.total = totals.grandTotal;
  quot.ufRate = totals.ufRate;
  quot.ufNetSubtotal = totals.ufNetSubtotal;
  quot.ufGrandTotal = totals.ufGrandTotal;
  quot.updatedAt = new Date().toISOString();

  res.json(quot);
});

/**
 * PUT /api/v1/quotations/:id/extra-costs
 * Paso 3: Reemplaza costos adicionales que no suman al total de la venta ni afectan el margen (OpenAPI replaceExtraCosts).
 */
quotationsRouter.put('/:id/extra-costs', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar cotizaciones de otro asesor.');
  }

  if (quot.status !== 'DRAFT' && quot.status !== 'PENDING_APPROVAL') {
    return sendProblem(res, 400, 'Cotización no editable', 'Solo las cotizaciones en estado borrador o pendiente de aprobación pueden ser modificadas.');
  }

  const parsed = quotationExtraCostsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Costos extra inválidos', parsed.error.issues[0]?.message || 'Estructura de costos adicionales inválida');
  }

  const processedExtraCosts: ExtraCostLine[] = (parsed.data.extraCosts || []).map((ec, idx) => {
    const qty = ec.quantity || 1;
    const price = ec.price || 0;
    const subtotal = ec.subtotal !== undefined ? ec.subtotal : price * qty;
    return {
      id: ec.id || `ec-${crypto.randomUUID()}-${idx}`,
      name: ec.name,
      unit: ec.unit || 'GLOBAL',
      cost: ec.cost || 0,
      price,
      quantity: qty,
      subtotal,
      notes: ec.notes || undefined,
      type: 'SERVICE',
      catalogItemId: ec.catalogItemId || undefined,
    };
  });

  const extraCostsTotal = processedExtraCosts.reduce((acc, ec) => acc + ec.subtotal, 0);

  quot.extraCosts = processedExtraCosts;
  quot.extraCostsTotal = extraCostsTotal;
  quot.updatedAt = new Date().toISOString();

  res.json(quot);
});

/**
 * POST /api/v1/quotations/:id/send
 * Pasa de DRAFT a SENT. Exige al menos una línea y margen válido.
 */
quotationsRouter.post('/:id/send', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede enviar cotizaciones de otro asesor.');
  }

  if (quot.status === 'PENDING_APPROVAL') {
    return sendProblem(
      res,
      400,
      'Pendiente de aprobación',
      'No se puede enviar una cotización que se encuentra pendiente de aprobación de margen por Administración.'
    );
  }

  if (quot.status !== 'DRAFT') {
    return sendProblem(res, 400, 'Estado inválido', 'Solo se puede enviar una cotización que se encuentre en borrador.');
  }

  if (!quot.lines || quot.lines.length === 0) {
    return sendProblem(res, 400, 'Sin líneas', 'Para enviar la cotización debe incluir al menos una línea de producto o servicio.');
  }

  const hardFloor = state.company.hardMinMarginPct !== undefined ? state.company.hardMinMarginPct : 0;
  if (quot.marginPct < hardFloor) {
    return sendProblem(
      res,
      422,
      'Margen bajo piso duro',
      `El margen actual (${quot.marginPct}%) es inferior al piso duro no negociable (${hardFloor}%).`
    );
  }

  if (quot.marginPct < state.company.minMarginPct) {
    if (!quot.marginException || quot.marginApprovalStatus !== 'APPROVED') {
      return sendProblem(
        res,
        422,
        'Margen bajo',
        'No se puede enviar una cotización cuyo margen esté por debajo del mínimo exigido sin una excepción de margen aprobada por el Administrador.'
      );
    }
  }

  const now = new Date().toISOString();
  quot.status = 'SENT';
  quot.sentAt = quot.sentAt || now;
  const validityDays = quot.validityDays || 15;
  quot.validUntil = new Date(new Date(quot.sentAt).getTime() + validityDays * 86400000).toISOString();
  quot.updatedAt = now;
  if (!quot.publicToken) {
    const { token } = generatePublicQuotationToken(quot.validUntil);
    quot.publicToken = token;
  }

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: 'DRAFT',
    toStatus: 'SENT',
    actor: req.user?.name || 'Asesor Comercial',
    actorRole: req.user?.role || 'SALES_REP',
    comment: 'Cotización finalizada y enviada formalmente al cliente',
    timestamp: new Date().toISOString(),
  });

  // Encolar notificación en Outbox
  const contact = state.contacts.find((c) => c.id === quot.contactId);
  const cust = state.customers.find((c) => c.id === quot.customerId);
  const recipientEmail = contact?.email || cust?.email || 'contacto@cliente.cl';
  const recipientName = contact?.name || quot.customerBusinessName || cust?.businessName || 'Cliente';
  const origin = req.get('origin') || `http://${req.get('host') || 'localhost:3000'}`;
  const publicUrl = `${origin}/q/${quot.publicToken}`;

  await OutboxService.enqueue({
    quotationId: quot.id,
    quotationNumber: quot.quotationNumber,
    customerId: quot.customerId,
    recipientName,
    recipientEmail,
    recipientPhone: contact?.phone,
    channel: req.body.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL',
    publicUrl,
    totalFormatted: `$${(quot.total || quot.grandTotal || 0).toLocaleString('es-CL')} CLP`,
  });

  await AuditService.logFromReq(
    req,
    'SEND_QUOTATION',
    'quotation',
    quot.id,
    `Envió cotización ${quot.quotationNumber} a ${recipientEmail}`
  );

  res.json(quot);
});

/**
 * POST /api/v1/quotations/:id/status
 * Actualización controlada de estado:
 * - El personal NO puede fijar ACCEPTED ni REJECTED por este endpoint.
 * - Una cotización aceptada NUNCA vuelve a DRAFT.
 */
quotationsRouter.post('/:id/status', async (req: Request, res: Response) => {
  const parsed = quotationStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Estado inválido', parsed.error.issues[0]?.message || 'Estado no reconocido');
  }

  const { status: targetStatus, note } = parsed.data;
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar cotizaciones de otro asesor.');
  }

  // REGLA: El personal no puede fijar ACCEPTED, REJECTED ni VIEWED arbitrariamente
  if (targetStatus === 'ACCEPTED' || targetStatus === 'REJECTED' || targetStatus === 'VIEWED') {
    return sendProblem(
      res,
      403,
      'Operación no permitida',
      `El personal no puede marcar una cotización como '${targetStatus}' manualmente. El estado 'Vista por Cliente' (VIEWED) solo se activa ante una lectura genuina del cliente, y la decisión ('ACCEPTED'/'REJECTED') debe provenir del mandante mediante su portal o enlace.`
    );
  }

  // REGLA: Una cotización aceptada nunca vuelve a DRAFT
  if (quot.status === 'ACCEPTED' && targetStatus === 'DRAFT') {
    return sendProblem(res, 400, 'Transición prohibida', 'Una cotización ya aceptada por el cliente no puede revertirse a borrador.');
  }

  // Transición a SENT exige líneas y margen válido
  if (targetStatus === 'SENT') {
    if (!quot.lines || quot.lines.length === 0) {
      return sendProblem(res, 400, 'Sin líneas', 'No se puede cambiar a ENVIADA sin líneas.');
    }
    const hardFloor = state.company.hardMinMarginPct !== undefined ? state.company.hardMinMarginPct : 0;
    if (quot.marginPct < hardFloor) {
      return sendProblem(res, 422, 'Margen bajo piso duro', 'Margen por debajo del piso duro no negociable.');
    }
    if (quot.marginPct < state.company.minMarginPct) {
      if (!quot.marginException || quot.marginApprovalStatus !== 'APPROVED') {
        return sendProblem(res, 422, 'Margen bajo', 'Requiere una excepción de margen aprobada por Administración.');
      }
    }
  }

  const oldStatus = quot.status;
  quot.status = targetStatus;
  quot.updatedAt = new Date().toISOString();

  if (targetStatus === 'SENT') {
    if (!quot.sentAt) {
      quot.sentAt = quot.updatedAt;
    }
    if (!quot.validUntil) {
      const validityDays = quot.validityDays || 15;
      quot.validUntil = new Date(new Date(quot.sentAt).getTime() + validityDays * 86400000).toISOString();
    }
    if (!quot.publicToken) {
      const { token } = generatePublicQuotationToken(quot.validUntil);
      quot.publicToken = token;
    }
  }

  if (parsed.data.internalNotes !== undefined) {
    quot.internalNotes = parsed.data.internalNotes;
  }

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: targetStatus,
    actor: req.user?.name || 'Personal',
    actorRole: req.user?.role || 'ADMIN',
    comment: note || `Cambio de estado de ${oldStatus} a ${targetStatus}`,
    timestamp: new Date().toISOString(),
  });

  await AuditService.logFromReq(
    req,
    'UPDATE_QUOTATION_STATUS',
    'quotation',
    quot.id,
    `Cambió estado de cotización ${quot.quotationNumber} de ${oldStatus} a ${targetStatus}`
  );

  res.json(quot);
});

/**
 * PATCH & POST /api/v1/quotations/:id/next-action
 * Actualiza nextActionAt y nextActionNote en una cotización (P2.h).
 */
const handleNextAction = async (req: Request, res: Response) => {
  const parsed = quotationNextActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Fecha y nota de próxima acción requeridas');
  }

  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar cotizaciones de otro asesor.');
  }

  const { nextActionAt, nextActionNote } = parsed.data;

  if (!nextActionAt) {
    quot.nextActionAt = undefined;
    if (nextActionNote) {
      quot.nextActionNote = nextActionNote;
    }
    quot.updatedAt = new Date().toISOString();
    quot.statusHistory.push({
      id: `hist-${crypto.randomUUID()}`,
      fromStatus: quot.status,
      toStatus: quot.status,
      actor: req.user?.name || 'Asesor Comercial',
      actorRole: req.user?.role || 'SALES_REP',
      comment: `Seguimiento marcado como realizado.${nextActionNote ? ' ' + nextActionNote : ''}`,
      timestamp: new Date().toISOString(),
    });

    await AuditService.logFromReq(
      req,
      'COMPLETE_NEXT_ACTION',
      'quotation',
      quot.id,
      `Marcó seguimiento como realizado para cotización ${quot.quotationNumber}`
    );

    return res.json(quot);
  }

  quot.nextActionAt = nextActionAt;
  quot.nextActionNote = nextActionNote || 'Seguimiento programado';
  quot.updatedAt = new Date().toISOString();

  await AuditService.logFromReq(
    req,
    'UPDATE_NEXT_ACTION',
    'quotation',
    quot.id,
    `Programó próxima acción para ${new Date(nextActionAt).toLocaleDateString('es-CL')}: ${quot.nextActionNote}`
  );

  res.json(quot);
};

quotationsRouter.patch('/:id/next-action', handleNextAction);
quotationsRouter.post('/:id/next-action', handleNextAction);

/**
 * POST /api/v1/quotations/:id/reminder & /api/v1/quotations/:id/follow-up-reminder
 * Encola un recordatorio de seguimiento en la bandeja de salida (Outbox) (P2.h).
 */
quotationsRouter.post(['/:id/reminder', '/:id/follow-up-reminder'], async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede gestionar cotizaciones de otro asesor.');
  }

  const contact = state.contacts.find((c) => c.id === quot.contactId);
  const cust = state.customers.find((c) => c.id === quot.customerId);
  const recipientEmail = contact?.email || cust?.email || 'contacto@cliente.cl';
  const recipientName = contact?.name || quot.customerBusinessName || cust?.businessName || 'Cliente';
  const origin = req.get('origin') || `http://${req.get('host') || 'localhost:3000'}`;
  const publicUrl = quot.publicToken ? `${origin}/q/${quot.publicToken}` : `${origin}/portal`;
  const channel = req.body.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';
  const note = req.body.note || quot.nextActionNote || 'Recordatorio de seguimiento técnico y comercial';

  const outboxMsg = await OutboxService.enqueue({
    quotationId: quot.id,
    quotationNumber: quot.quotationNumber,
    customerId: quot.customerId,
    recipientName,
    recipientEmail,
    recipientPhone: contact?.phone,
    channel,
    publicUrl,
    totalFormatted: `$${(quot.total || quot.grandTotal || 0).toLocaleString('es-CL')} CLP`,
  });

  if (outboxMsg) {
    outboxMsg.subject = `Recordatorio Seguimiento: Cotización ${quot.quotationNumber}`;
    outboxMsg.body = `Estimado/a ${recipientName}, le contactamos de M&L Ingeniería Naval SpA en relación a su cotización ${quot.quotationNumber}. Próxima acción: ${note}. Acceso a propuesta: ${publicUrl}`;
  }

  await AuditService.logFromReq(
    req,
    'SEND_REMINDER',
    'quotation',
    quot.id,
    `Encoló recordatorio en bandeja de salida para cotización ${quot.quotationNumber}`
  );

  res.json({
    success: true,
    message: 'Recordatorio encolado en bandeja de salida con éxito.',
    outboxMessage: outboxMsg,
  });
});

/**
 * POST /api/v1/quotations/:id/reject
 * Registro de rechazo/pérdida por personal con motivo configurable (P2.h).
 */
quotationsRouter.post('/:id/reject', async (req: Request, res: Response) => {
  const parsed = quotationRejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'Motivo de pérdida requerido');
  }

  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar cotizaciones de otro asesor.');
  }

  if (quot.status === 'ACCEPTED') {
    return sendProblem(res, 400, 'Cotización aceptada', 'No se puede rechazar una cotización ya aceptada formalmente.');
  }

  const { lossReason, note } = parsed.data;
  const configuredReasons = state.company.lossReasons || ['precio', 'plazo', 'competencia', 'proyecto aplazado', 'otro'];
  if (!configuredReasons.includes(lossReason)) {
    return sendProblem(res, 422, 'Motivo de pérdida no válido', `El motivo '${lossReason}' no pertenece a la lista configurada por administración.`);
  }

  const oldStatus = quot.status;
  quot.status = 'REJECTED';
  quot.rejectedAt = new Date().toISOString();
  quot.lossReason = lossReason;
  quot.rejectionReason = note ? `${lossReason}: ${note}` : lossReason;
  quot.updatedAt = new Date().toISOString();

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'REJECTED',
    actor: req.user?.name || 'Personal Comercial',
    actorRole: req.user?.role || 'SALES_REP',
    comment: `Cotización desestimada por personal. Motivo de pérdida: ${lossReason}.${note ? ' Detalle: ' + note : ''}`,
    timestamp: new Date().toISOString(),
  });

  await AuditService.logFromReq(
    req,
    'REJECT_QUOTATION',
    'quotation',
    quot.id,
    `Registró rechazo de cotización ${quot.quotationNumber} por motivo: ${lossReason}`
  );

  res.json(quot);
});

/**
 * POST /api/v1/quotations/:id/duplicate
 */
quotationsRouter.post('/:id/duplicate', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const source = state.quotations.find((q) => q.id === req.params.id);
  if (!source) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && source.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede duplicar cotizaciones de otro asesor.');
  }

  const qNum = await NumberingService.nextQuotationNumber();
  const { token: publicToken } = generatePublicQuotationToken();

  const newQuote: Quotation = {
    ...JSON.parse(JSON.stringify(source)),
    id: `quot-${crypto.randomUUID()}`,
    quotationNumber: qNum,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    salesRepId: req.user?.id || source.salesRepId,
    publicToken,
    termsAccepted: false,
    acceptedAt: undefined,
    rejectedAt: undefined,
    statusHistory: [
      {
        id: `hist-${crypto.randomUUID()}`,
        fromStatus: null,
        toStatus: 'DRAFT',
        actor: req.user?.name || 'Personal',
        actorRole: req.user?.role || 'SALES_REP',
        comment: `Duplicada a partir de ${source.quotationNumber}`,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  state.quotations.unshift(newQuote);

  await AuditService.logFromReq(
    req,
    'DUPLICATE_QUOTATION',
    'quotation',
    newQuote.id,
    `Duplicó la cotización ${source.quotationNumber} como ${newQuote.quotationNumber}`
  );

  res.status(201).json(newQuote);
});

/**
 * POST /api/v1/quotations/:id/revisions
 * Crea una nueva revisión a partir de una cotización enviada o existente (P1.a).
 * La cotización origen es inmutable; la nueva tiene el mismo quotationGroupId, revision N+1,
 * folio correlativo COT-000123-RN y estado DRAFT para corregir o reactivar.
 */
quotationsRouter.post('/:id/revisions', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const source = state.quotations.find((q) => q.id === req.params.id);
  if (!source) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && source.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede crear revisiones de cotizaciones de otro asesor.');
  }

  const quotationGroupId = source.quotationGroupId || source.id;
  source.quotationGroupId = quotationGroupId;

  const groupQuotes = state.quotations.filter((q) => q.quotationGroupId === quotationGroupId || q.id === quotationGroupId);
  const maxRevision = Math.max(...groupQuotes.map((q) => q.revision || 1), 1);
  const nextRevision = maxRevision + 1;

  const rootQuotationNumber = source.rootQuotationNumber || source.quotationNumber.replace(/-R\d+$/, '');
  const newQuotationNumber = `${rootQuotationNumber}-R${nextRevision}`;

  const { token: publicToken } = generatePublicQuotationToken();
  const newId = `quot-${crypto.randomUUID()}`;

  // Marcar revisiones anteriores como superadas
  groupQuotes.forEach((q) => {
    q.isLatestRevision = false;
  });
  source.supersededByQuotationId = newId;

  const newQuote: Quotation = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    quotationNumber: newQuotationNumber,
    quotationGroupId,
    revision: nextRevision,
    isLatestRevision: true,
    supersededByQuotationId: undefined,
    rootQuotationNumber,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sentAt: undefined,
    validUntil: undefined,
    acceptedAt: undefined,
    rejectedAt: undefined,
    rejectionReason: undefined,
    firstViewedAt: undefined,
    termsAccepted: false,
    clientSignerName: undefined,
    clientSignerPosition: undefined,
    clientIp: undefined,
    clientUserAgentHash: undefined,
    acceptanceHash: undefined,
    acceptedOffline: false,
    offlinePurchaseOrderNumber: undefined,
    offlineAcceptedBy: undefined,
    offlineNote: undefined,
    salesRepId: req.user?.id || source.salesRepId,
    publicToken,
    statusHistory: [
      {
        id: `hist-${crypto.randomUUID()}`,
        fromStatus: null,
        toStatus: 'DRAFT',
        actor: req.user?.name || 'Personal',
        actorRole: req.user?.role || 'SALES_REP',
        comment: `Revisión ${nextRevision} creada a partir de ${source.quotationNumber}`,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  state.quotations.unshift(newQuote);

  await AuditService.logFromReq(
    req,
    'CREATE_REVISION',
    'quotation',
    newQuote.id,
    `Creó la revisión ${newQuote.quotationNumber} a partir de ${source.quotationNumber}`
  );

  res.status(201).json(newQuote);
});

/**
 * GET /api/v1/quotations/:id/revisions
 * Devuelve el historial de todas las revisiones del grupo de la cotización.
 */
quotationsRouter.get('/:id/revisions', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No tiene permisos para ver cotizaciones de otro asesor.');
  }

  const groupId = quot.quotationGroupId || quot.id;
  const groupQuotes = state.quotations
    .filter((q) => q.quotationGroupId === groupId || q.id === groupId)
    .sort((a, b) => (b.revision || 1) - (a.revision || 1));

  res.json({
    quotationGroupId: groupId,
    revisions: groupQuotes,
  });
});

/**
 * POST /api/v1/quotations/:id/accept-offline
 * Aceptación offline registrada por el personal con evidencia (P1.d).
 * Exige N.º de Orden de Compra o referencia y comentario.
 */
quotationsRouter.post('/:id/accept-offline', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede gestionar cotizaciones de otro asesor.');
  }

  const parsed = quotationOfflineAcceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(
      res,
      400,
      'Datos de aceptación offline incompletos',
      parsed.error.issues[0]?.message || 'Debe indicar el N.º de Orden de Compra / referencia y el comentario.'
    );
  }

  if (quot.status === 'DRAFT') {
    return sendProblem(res, 400, 'Estado inválido', 'Una cotización en borrador no puede ser aceptada.');
  }
  if (quot.status === 'ACCEPTED') {
    return sendProblem(res, 409, 'Ya aceptada', 'La cotización ya fue aceptada previamente.');
  }
  if (quot.status === 'REJECTED') {
    return sendProblem(res, 409, 'Cotización rechazada', 'No se puede aceptar una cotización desestimada.');
  }

  const { purchaseOrderNumber, offlineNote } = parsed.data;
  const acceptTimestamp = new Date().toISOString();
  const oldStatus = quot.status;

  quot.status = 'ACCEPTED';
  quot.acceptedAt = acceptTimestamp;
  quot.updatedAt = acceptTimestamp;
  quot.termsAccepted = true;
  quot.acceptedOffline = true;
  quot.offlinePurchaseOrderNumber = purchaseOrderNumber;
  quot.offlineAcceptedBy = req.user?.name || 'Personal Comercial';
  quot.offlineNote = offlineNote;

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'ACCEPTED',
    actor: req.user?.name || 'Personal Comercial',
    actorRole: req.user?.role || 'SALES_REP',
    comment: `Aceptación offline registrada por el personal con Orden de Compra/Ref: ${purchaseOrderNumber}. Observaciones: ${offlineNote}`,
    timestamp: acceptTimestamp,
  });

  // Generar automáticamente el documento de cobro (DC-XXXXXX) con sus hitos
  await createInvoiceForAcceptedQuotation(quot, state, req.user?.name || 'Personal');

  await AuditService.logFromReq(
    req,
    'OFFLINE_ACCEPT_QUOTATION',
    'quotation',
    quot.id,
    `Registró aceptación offline para la cotización ${quot.quotationNumber} con Orden de Compra: ${purchaseOrderNumber}`
  );

  res.json({
    success: true,
    message: 'Aceptación offline registrada con éxito.',
    quotation: quot,
  });
});

/**
 * POST /api/v1/quotations/:id/request-margin-approval (P3.l)
 * El asesor solicita excepción de margen ingresando un motivo justificado.
 */
quotationsRouter.post('/:id/request-margin-approval', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede gestionar cotizaciones de otro asesor.');
  }

  const parsed = quotationMarginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'El motivo es obligatorio.');
  }

  const hardFloor = state.company.hardMinMarginPct !== undefined ? state.company.hardMinMarginPct : 0;
  if (quot.marginPct < hardFloor) {
    return sendProblem(
      res,
      422,
      'Margen bajo piso duro',
      `El margen (${quot.marginPct}%) es inferior al piso duro no negociable (${hardFloor}%). No se permite solicitar excepción.`
    );
  }

  const oldStatus = quot.status;
  quot.status = 'PENDING_APPROVAL';
  quot.marginApprovalStatus = 'PENDING';
  quot.marginExceptionReason = parsed.data.reason;
  quot.updatedAt = new Date().toISOString();

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'PENDING_APPROVAL',
    actor: req.user?.name || 'Asesor Comercial',
    actorRole: req.user?.role || 'SALES_REP',
    comment: `Solicitud de excepción de margen (${quot.marginPct}% vs mín ${state.company.minMarginPct}%): ${parsed.data.reason}`,
    timestamp: new Date().toISOString(),
  });

  await AuditService.logFromReq(
    req,
    'MARGIN_EXCEPTION_REQUESTED',
    'quotation',
    quot.id,
    `Solicitó excepción de margen para cotización ${quot.quotationNumber} (${quot.marginPct}%): ${parsed.data.reason}`
  );

  res.json(quot);
});

/**
 * POST /api/v1/quotations/:id/approve-margin (P3.l)
 * REGLA: Solo ADMIN aprueba la excepción de margen con comentario.
 */
quotationsRouter.post('/:id/approve-margin', requireAdmin, async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  const parsed = quotationMarginApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Comentario no válido.');
  }

  const hardFloor = state.company.hardMinMarginPct !== undefined ? state.company.hardMinMarginPct : 0;
  if (quot.marginPct < hardFloor) {
    return sendProblem(
      res,
      422,
      'Margen bajo piso duro',
      `El margen (${quot.marginPct}%) está por debajo del piso duro no negociable (${hardFloor}%). No puede ser aprobado.`
    );
  }

  const oldStatus = quot.status;
  const comment = parsed.data.comment || 'Aprobada excepción de margen por Gerencia/Administración';
  quot.marginException = true;
  quot.marginApprovalStatus = 'APPROVED';
  quot.marginApprovedBy = req.user?.id;
  quot.marginApprovedByName = req.user?.name;
  quot.marginApprovedAt = new Date().toISOString();
  quot.marginApprovalComment = comment;
  quot.status = 'DRAFT'; // Pasa a DRAFT habilitada para enviar
  quot.updatedAt = new Date().toISOString();

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'DRAFT',
    actor: req.user?.name || 'Administrador',
    actorRole: 'ADMIN',
    comment: `Excepción de margen APROBADA (${quot.marginPct}%): ${comment}`,
    timestamp: new Date().toISOString(),
  });

  await AuditService.logFromReq(
    req,
    'MARGIN_EXCEPTION_APPROVED',
    'quotation',
    quot.id,
    `Aprobó excepción de margen para cotización ${quot.quotationNumber} (${quot.marginPct}% vs mín ${state.company.minMarginPct}%): ${comment}`
  );

  res.json(quot);
});

/**
 * POST /api/v1/quotations/:id/reject-margin (P3.l)
 * REGLA: Solo ADMIN rechaza la excepción de margen con comentario obligatorio.
 */
quotationsRouter.post('/:id/reject-margin', requireAdmin, async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  const parsed = quotationMarginRejectSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'El comentario de rechazo es obligatorio.');
  }

  const oldStatus = quot.status;
  quot.marginException = false;
  quot.marginApprovalStatus = 'REJECTED';
  quot.marginApprovalComment = parsed.data.comment;
  quot.status = 'DRAFT';
  quot.updatedAt = new Date().toISOString();

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'DRAFT',
    actor: req.user?.name || 'Administrador',
    actorRole: 'ADMIN',
    comment: `Excepción de margen RECHAZADA: ${parsed.data.comment}`,
    timestamp: new Date().toISOString(),
  });

  await AuditService.logFromReq(
    req,
    'MARGIN_EXCEPTION_REJECTED',
    'quotation',
    quot.id,
    `Rechazó excepción de margen para cotización ${quot.quotationNumber}: ${parsed.data.comment}`
  );

  res.json(quot);
});

/**
 * POST /api/v1/quotations/:id/attachments (P3.n)
 * Añade un enlace a archivo adjunto en la cotización.
 */
quotationsRouter.post('/:id/attachments', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede gestionar cotizaciones de otro asesor.');
  }

  const parsed = quotationAttachmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'El nombre y enlace URL son obligatorios.');
  }

  const newAttachment = {
    id: `att-${crypto.randomUUID()}`,
    name: parsed.data.name,
    url: parsed.data.url,
    description: parsed.data.description || '',
    addedAt: new Date().toISOString(),
    addedBy: req.user?.id,
    addedByName: req.user?.name,
  };

  if (!quot.attachments) quot.attachments = [];
  quot.attachments.push(newAttachment);
  quot.updatedAt = new Date().toISOString();

  await AuditService.logFromReq(
    req,
    'ADD_ATTACHMENT',
    'quotation',
    quot.id,
    `Añadió enlace adjunto "${newAttachment.name}" (${newAttachment.url}) a cotización ${quot.quotationNumber}`
  );

  res.status(201).json(newAttachment);
});

/**
 * DELETE /api/v1/quotations/:id/attachments/:attachmentId (P3.n)
 * Elimina un enlace adjunto de la cotización.
 */
quotationsRouter.delete('/:id/attachments/:attachmentId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id);
  if (!quot) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quot.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'No puede gestionar cotizaciones de otro asesor.');
  }

  if (!quot.attachments) quot.attachments = [];
  const attIndex = quot.attachments.findIndex((a) => a.id === req.params.attachmentId);
  if (attIndex === -1) return sendProblem(res, 404, 'Adjunto no encontrado', 'El adjunto no existe en la cotización.');

  const removed = quot.attachments[attIndex];
  quot.attachments.splice(attIndex, 1);
  quot.updatedAt = new Date().toISOString();

  await AuditService.logFromReq(
    req,
    'REMOVE_ATTACHMENT',
    'quotation',
    quot.id,
    `Eliminó enlace adjunto "${removed.name}" de cotización ${quot.quotationNumber}`
  );

  res.status(204).send();
});
