import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { publicLimiter, sendProblem } from '../security.js';
import { toPublicQuotationDTO } from '../dto.js';
import { computeQuotationValidity, createInvoiceForAcceptedQuotation, createOperationForAcceptedQuotation } from '../services/quotation-operations.js';
import { publicQuotationAcceptSchema } from '../schemas.js';
import { verifyStaffToken } from '../auth.js';

export const publicRouter = express.Router();

// Aplica limitador de tasa para enlaces públicos
publicRouter.use(publicLimiter);

/**
 * GET /api/v1/public/quotations/:token
 * NO MODIFICA ESTADO (Idempotente).
 * Devuelve un DTO estrictamente sanitizado: NADA de costos, utilidad, margen ni comentarios internos.
 */
publicRouter.get('/quotations/:token', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.publicToken === req.params.token);
  if (!quot) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'El enlace es inválido o ha caducado.');
  }

  // Comprobar vigencia calculada
  const { isExpired } = computeQuotationValidity(quot);
  if (isExpired && quot.status !== 'EXPIRED' && quot.status !== 'ACCEPTED') {
    quot.status = 'EXPIRED';
  }

  // Comprobar si existe una revisión vigente más reciente en el mismo grupo
  const groupId = quot.quotationGroupId || quot.id;
  const groupQuotes = state.quotations.filter((q) => q.quotationGroupId === groupId || q.id === groupId);
  const latestQuote = [...groupQuotes].sort((a, b) => (b.revision || 1) - (a.revision || 1))[0];
  const hasNewerRevision = latestQuote && latestQuote.id !== quot.id && (latestQuote.revision || 1) > (quot.revision || 1);
  const meta = hasNewerRevision ? {
    hasNewerRevision: true,
    latestRevisionNumber: latestQuote.quotationNumber,
    latestRevisionToken: latestQuote.publicToken,
    latestRevisionId: latestQuote.id,
  } : undefined;

  const customer = state.customers.find((c) => c.id === quot.customerId);
  const contact = state.contacts.find((c) => c.id === quot.contactId);
  const salesRepUser = state.users.find((u) => u.id === quot.salesRepId);
  const salesRep = salesRepUser ? {
    name: salesRepUser.name,
    email: salesRepUser.email,
    phone: salesRepUser.phone,
  } : undefined;

  const publicDto = toPublicQuotationDTO(quot, customer, contact, salesRep, meta);

  res.json({
    quotation: publicDto,
    customer: publicDto.customer,
    contact: publicDto.contact,
    salesRep: publicDto.commercialContact,
    company: {
      name: state.company.name,
      legalName: state.company.legalName,
      rut: state.company.rut,
      address: state.company.address,
      phone: state.company.phone,
      email: state.company.email,
      currency: state.company.currency,
      taxRatePct: state.company.taxRatePct,
    },
  });
});

/**
 * POST /api/v1/public/quotations/:token/view
 * El cliente notifica explícitamente que la cotización fue vista.
 * Pasa de SENT a VIEWED.
 */
publicRouter.post('/quotations/:token/view', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.publicToken === req.params.token);
  if (!quot) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'El enlace es inválido o ha caducado.');
  }

  // 1. Comprobar si quien abre el enlace es un usuario interno (ADMIN o SALES_REP)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    const staffPayload = verifyStaffToken(rawToken);
    if (staffPayload) {
      const user = state.users.find((u) => u.id === staffPayload.userId && u.active && !u.deletedAt);
      if (user && (user.role === 'ADMIN' || user.role === 'SALES_REP')) {
        // Previsualización técnica por el equipo interno: NO altera el estado comercial
        return res.json({
          success: true,
          status: quot.status,
          isStaffPreview: true,
          message: 'Previsualización técnica interna registrada sin alterar estado al cliente.',
        });
      }
    }
  }

  // 2. Si la cotización está en SENT, ahora sí se registra la lectura genuina del cliente
  if (quot.status === 'SENT') {
    quot.status = 'VIEWED';
    quot.firstViewedAt = new Date().toISOString();
    quot.updatedAt = new Date().toISOString();

    const contact = state.contacts.find((c) => c.id === quot.contactId);
    const customer = state.customers.find((c) => c.id === quot.customerId);
    const salesRep = state.users.find((u) => u.id === quot.salesRepId);

    const clientActorName = contact?.name || customer?.businessName || 'Cliente';

    quot.statusHistory.push({
      id: `hist-${crypto.randomUUID()}`,
      fromStatus: 'SENT',
      toStatus: 'VIEWED',
      actor: clientActorName,
      actorRole: 'CUSTOMER_CONTACT',
      comment: `El cliente '${customer?.businessName || clientActorName}' abrió y visualizó la propuesta técnica y económica.`,
      timestamp: new Date().toISOString(),
    });

    dbStore.recordAudit({
      entity: 'QUOTATION',
      action: 'STATUS_CHANGE',
      entityId: quot.id,
      entityName: quot.quotationNumber,
      description: `El cliente '${customer?.businessName || clientActorName}' abrió y visualizó la cotización ${quot.quotationNumber}. Estado actualizado a 'Vista por Cliente'.`,
      actorId: contact?.id || 'portal-client',
      actorName: clientActorName,
      actorRole: 'CUSTOMER_CONTACT',
    });

    // Notificar al asesor comercial
    if (salesRep) {
      dbStore.addOutbox({
        quotationId: quot.id,
        channel: 'EMAIL',
        recipient: salesRep.email,
        recipientName: salesRep.name,
        subject: `Cotización ${quot.quotationNumber} VISTA por el cliente (${customer?.businessName || clientActorName})`,
        body: `Estimado/a ${salesRep.name}, la cotización N.º ${quot.quotationNumber} ha sido leída y visualizada en línea por el cliente '${customer?.businessName || clientActorName}'.`,
      });
    }
  }

  res.json({ success: true, status: quot.status, firstViewedAt: quot.firstViewedAt });
});

/**
 * POST /api/v1/public/quotations/:token/accept
 * El cliente acepta formalmente la cotización con firma digital y evidencia legal (P1.d).
 */
publicRouter.post('/quotations/:token/accept', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.publicToken === req.params.token);
  if (!quot) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');
  }

  // P1.b: Una cotización vencida no se puede aceptar
  const { isExpired } = computeQuotationValidity(quot);
  if (isExpired || quot.status === 'EXPIRED') {
    quot.status = 'EXPIRED';
    return sendProblem(
      res,
      400,
      'Cotización vencida',
      'El plazo de validez de esta cotización ha expirado. Solicite una reactivación o nueva revisión al asesor comercial.'
    );
  }

  const parsed = publicQuotationAcceptSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(
      res,
      400,
      'Datos de aceptación incompletos',
      parsed.error.issues[0]?.message || 'Debe indicar su nombre completo, cargo y aceptar los términos.'
    );
  }

  if (quot.isLatestRevision === false || Boolean(quot.supersededByQuotationId)) {
    return sendProblem(
      res,
      409,
      'Revisión superada',
      'Existe una revisión más reciente para esta cotización. Por favor abra la versión vigente para registrar su decisión.'
    );
  }

  if (req.body?.expectedUpdatedAt && req.body.expectedUpdatedAt !== quot.updatedAt) {
    return sendProblem(
      res,
      409,
      'Colisión de edición detectada',
      'La propuesta fue actualizada recientemente por el asesor comercial. Recargue la página antes de confirmar su decisión.'
    );
  }

  if (quot.status === 'DRAFT') {
    return sendProblem(res, 400, 'Estado inválido', 'Una cotización en borrador no puede ser aceptada.');
  }
  if (quot.status === 'ACCEPTED') {
    return res.json({ success: true, message: 'La cotización ya fue aceptada previamente.' });
  }
  if (quot.status === 'REJECTED') {
    return sendProblem(res, 409, 'Conflicto de decisión', 'No se puede aceptar una cotización desestimada.');
  }

  const { signerName, signerPosition } = parsed.data;
  const acceptTimestamp = new Date().toISOString();
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    '127.0.0.1';
  const userAgent = (req.headers['user-agent'] as string) || 'N/A';
  const clientUserAgentHash = crypto.createHash('sha256').update(userAgent).digest('hex');
  const acceptancePayload = `${quot.id}:${quot.quotationNumber}:${quot.revision || 1}:${quot.grandTotal}:${signerName}:${signerPosition}:${acceptTimestamp}`;
  const acceptanceHash = crypto.createHash('sha256').update(acceptancePayload).digest('hex');

  const oldStatus = quot.status;
  quot.status = 'ACCEPTED';
  quot.termsAccepted = true;
  quot.acceptedAt = acceptTimestamp;
  quot.updatedAt = acceptTimestamp;
  quot.clientSignerName = signerName;
  quot.clientSignerPosition = signerPosition;
  quot.clientIp = clientIp;
  quot.clientUserAgentHash = clientUserAgentHash;
  quot.acceptanceHash = acceptanceHash;

  const customer = state.customers.find((c) => c.id === quot.customerId);
  const contact = state.contacts.find((c) => c.id === quot.contactId);
  const salesRepUser = state.users.find((u) => u.id === quot.salesRepId);

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'ACCEPTED',
    actor: `${signerName} (${signerPosition})`,
    actorRole: 'CUSTOMER_CONTACT',
    comment: `Aprobación y conformidad confirmada por el cliente con firma digital y hash ${acceptanceHash.slice(0, 16)}...`,
    timestamp: acceptTimestamp,
  });

  // Generar de forma inmediata el Documento de Cobro correlativo (DC-XXXXXX) y la Orden de Trabajo (OP-YYYY-XXXX)
  await createInvoiceForAcceptedQuotation(quot, state, signerName);
  await createOperationForAcceptedQuotation(quot, state);

  if (salesRepUser) {
    dbStore.addOutbox({
      quotationId: quot.id,
      channel: 'EMAIL',
      recipient: salesRepUser.email,
      recipientName: salesRepUser.name,
      subject: `Cotización ${quot.quotationNumber} ACEPTADA formalmente`,
      body: `Estimado/a ${salesRepUser.name},\n\nLa cotización N.º ${quot.quotationNumber} ha sido aceptada por ${signerName} (${signerPosition}) con fecha ${new Date(acceptTimestamp).toLocaleString('es-CL')}.\n\nSe ha generado automáticamente el documento de cobro respectivo.`,
    });
  }

  const salesRep = salesRepUser
    ? {
        name: salesRepUser.name,
        email: salesRepUser.email,
        phone: salesRepUser.phone,
      }
    : undefined;

  const publicDto = toPublicQuotationDTO(quot, customer, contact, salesRep);

  res.json({
    success: true,
    message: 'Cotización aceptada con éxito. Nuestro equipo de proyectos iniciará la coordinación.',
    quotation: publicDto,
  });
});

/**
 * POST /api/v1/public/quotations/:token/reject
 * El cliente rechaza o desestima la cotización.
 */
publicRouter.post('/quotations/:token/reject', (req: Request, res: Response) => {
  const { reason, lossReason } = req.body;
  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.publicToken === req.params.token);
  if (!quot) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');
  }

  if (quot.isLatestRevision === false || Boolean(quot.supersededByQuotationId)) {
    return sendProblem(
      res,
      409,
      'Revisión superada',
      'Existe una revisión más reciente para esta cotización. Por favor abra la versión vigente para registrar su decisión.'
    );
  }

  if (req.body?.expectedUpdatedAt && req.body.expectedUpdatedAt !== quot.updatedAt) {
    return sendProblem(
      res,
      409,
      'Colisión de edición detectada',
      'La propuesta fue actualizada recientemente por el asesor comercial. Recargue la página antes de confirmar su decisión.'
    );
  }

  if (quot.status === 'DRAFT') {
    return sendProblem(res, 400, 'Estado inválido', 'Una cotización en borrador no puede ser desestimada por el cliente.');
  }
  if (quot.status === 'ACCEPTED') {
    return sendProblem(res, 409, 'Conflicto', 'La cotización ya fue aceptada por el cliente.');
  }
  if (quot.status === 'REJECTED') {
    return res.json({ success: true, message: 'La cotización ya fue rechazada anteriormente.' });
  }

  const oldStatus = quot.status;
  quot.status = 'REJECTED';
  quot.rejectedAt = new Date().toISOString();
  quot.updatedAt = new Date().toISOString();
  const chosenReason = lossReason || reason || 'otro';
  quot.lossReason = chosenReason;
  quot.rejectionReason = reason || chosenReason;

  const customer = state.customers.find((c) => c.id === quot.customerId);
  const contact = state.contacts.find((c) => c.id === quot.contactId);
  const salesRepUser = state.users.find((u) => u.id === quot.salesRepId);

  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'REJECTED',
    actor: contact?.name || 'Cliente Mandante',
    actorRole: 'CUSTOMER_CONTACT',
    comment: reason ? `Desestimada por el cliente: ${reason}` : 'Desestimada por el cliente.',
    timestamp: new Date().toISOString(),
  });

  const salesRep = salesRepUser ? {
    name: salesRepUser.name,
    email: salesRepUser.email,
    phone: salesRepUser.phone,
  } : undefined;

  const publicDto = toPublicQuotationDTO(quot, customer, contact, salesRep);

  res.json({
    success: true,
    message: 'La cotización ha sido desestimada.',
    quotation: publicDto,
  });
});

/**
 * POST /api/v1/public/quotations/:token/request-adjustment
 * El cliente solicita ajustes o deja un requerimiento de modificación sobre la propuesta.
 * Pasa el estado a CHANGES_REQUESTED y notifica al asesor comercial (P1.c).
 */
publicRouter.post('/quotations/:token/request-adjustment', (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return sendProblem(res, 400, 'Mensaje requerido', 'Debe indicar el ajuste o comentario solicitado.');
  }

  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.publicToken === req.params.token);
  if (!quot) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');
  }

  if (quot.isLatestRevision === false || Boolean(quot.supersededByQuotationId)) {
    return sendProblem(
      res,
      409,
      'Revisión superada',
      'Existe una revisión más reciente para esta cotización. Solicite ajustes sobre la versión vigente.'
    );
  }

  if (req.body?.expectedUpdatedAt && req.body.expectedUpdatedAt !== quot.updatedAt) {
    return sendProblem(
      res,
      409,
      'Colisión de edición detectada',
      'La propuesta fue actualizada recientemente por el asesor comercial. Recargue la página antes de enviar su solicitud.'
    );
  }

  if (quot.status === 'DRAFT') {
    return sendProblem(res, 400, 'Estado inválido', 'Una cotización en borrador no puede recibir solicitudes de ajuste.');
  }

  const customer = state.customers.find((c) => c.id === quot.customerId);
  const contact = state.contacts.find((c) => c.id === quot.contactId);
  const salesRepUser = state.users.find((u) => u.id === quot.salesRepId) || state.users.find((u) => u.role === 'ADMIN') || state.users[0];

  const oldStatus = quot.status;
  quot.status = 'CHANGES_REQUESTED';
  quot.updatedAt = new Date().toISOString();
  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'CHANGES_REQUESTED',
    actor: contact?.name || 'Cliente Mandante',
    actorRole: 'CUSTOMER_CONTACT',
    comment: `Solicitud de ajuste: ${message.trim()}`,
    timestamp: new Date().toISOString(),
  });

  if (salesRepUser) {
    dbStore.addOutbox({
      quotationId: quot.id,
      channel: 'EMAIL',
      recipient: salesRepUser.email,
      recipientName: salesRepUser.name,
      subject: `Solicitud de ajuste para Cotización ${quot.quotationNumber}`,
      body: `El cliente ${contact?.name || 'Cliente'} ha solicitado el siguiente ajuste para la cotización ${quot.quotationNumber}:\n\n"${message.trim()}"`,
    });
  }

  const salesRep = salesRepUser ? {
    name: salesRepUser.name,
    email: salesRepUser.email,
    phone: salesRepUser.phone,
  } : undefined;

  const publicDto = toPublicQuotationDTO(quot, customer, contact, salesRep);

  res.json({
    success: true,
    message: 'Su solicitud de ajuste ha sido enviada al asesor comercial.',
    quotation: publicDto,
  });
});
