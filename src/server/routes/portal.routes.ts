import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateClient } from '../middleware/auth.js';
import { toPublicQuotationDTO, toClientInvoiceDTO, toClientOperationDTO } from '../dto.js';
import { computeQuotationValidity } from '../services/quotation-operations.js';
import { applyInvoiceOverdueCheck } from './invoices.routes.js';
import { sendProblem } from '../security.js';

export const portalRouter = express.Router();

// Todas las rutas del portal exigen autenticación por Enlace Mágico
portalRouter.use(authenticateClient);

// S3: Si el cliente envía ?customerId= ajeno, es rechazado con 403 Forbidden
portalRouter.use((req: Request, res: Response, next) => {
  if (req.query.customerId && req.query.customerId !== req.clientUser?.customerId) {
    return sendProblem(res, 403, 'Acceso Denegado', 'No tiene autorización para consultar información de otro cliente');
  }
  next();
});

/**
 * GET /api/v1/portal/me
 */
portalRouter.get('/me', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const customer = state.customers.find((c) => c.id === req.clientUser?.customerId);
  res.json({
    user: {
      ...req.clientUser,
      id: req.clientUser?.contactId ? `usr-${req.clientUser.contactId}` : 'usr-client-01',
      role: 'CUSTOMER_CONTACT',
    },
    customer: customer ? {
      id: customer.id,
      businessName: customer.businessName,
      taxId: customer.taxId,
      address: customer.address,
    } : null,
  });
});

/**
 * GET /api/v1/portal/summary
 * Resumen de cotizaciones de la empresa del cliente (Derivado estrictamente de la sesión).
 */
portalRouter.get('/summary', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const state = dbStore.getState();

  const list = state.quotations.filter((q) => q.customerId === customerId && q.status !== 'DRAFT');

  const accepted = list.filter((q) => q.status === 'ACCEPTED').length;
  const pending = list.filter((q) => q.status === 'SENT' || q.status === 'VIEWED').length;
  const rejected = list.filter((q) => q.status === 'REJECTED').length;

  res.json({
    total: list.length,
    accepted,
    pending,
    rejected,
  });
});

/**
 * GET /api/v1/portal/quotations
 * Cotizaciones aprobadas o enviadas de la empresa (sin borradores, vista sanitizada sin costos ni margen).
 */
portalRouter.get('/quotations', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const state = dbStore.getState();

  let list = state.quotations.filter((q) => q.customerId === customerId && q.status !== 'DRAFT');

  // Comprobar vigencia de cada cotización
  list.forEach((q) => {
    const { isExpired } = computeQuotationValidity(q);
    if (isExpired && q.status !== 'EXPIRED' && q.status !== 'ACCEPTED') {
      q.status = 'EXPIRED';
    }
  });

  if (req.query.status) {
    list = list.filter((q) => q.status === req.query.status);
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const customer = state.customers.find((c) => c.id === customerId);

  const dtoList = list.map((q) => {
    const contact = state.contacts.find((c) => c.id === q.contactId);
    const salesRepUser = state.users.find((u) => u.id === q.salesRepId);
    const salesRep = salesRepUser
      ? {
          name: salesRepUser.name,
          email: salesRepUser.email,
          phone: salesRepUser.phone,
        }
      : undefined;

    // Calcular si existe una revisión más reciente en el mismo grupo
    const groupId = q.quotationGroupId || q.id;
    const groupQuotes = state.quotations.filter((gq) => gq.quotationGroupId === groupId || gq.id === groupId);
    const latestQuote = [...groupQuotes].sort((a, b) => (b.revision || 1) - (a.revision || 1))[0];
    const hasNewerRevision = latestQuote && latestQuote.id !== q.id && (latestQuote.revision || 1) > (q.revision || 1);
    const meta = hasNewerRevision
      ? {
          hasNewerRevision: true,
          latestRevisionNumber: latestQuote.quotationNumber,
          latestRevisionToken: latestQuote.publicToken,
          latestRevisionId: latestQuote.id,
        }
      : undefined;

    return toPublicQuotationDTO(q, customer, contact, salesRep, meta);
  });

  res.json(dtoList);
});

/**
 * GET /api/v1/portal/quotations/:id
 * Consulta individual de cotización por parte del cliente autenticado.
 */
portalRouter.get('/quotations/:id', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const state = dbStore.getState();

  const q = state.quotations.find((item) => item.id === req.params.id && item.customerId === customerId && item.status !== 'DRAFT');
  if (!q) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'No existe o no pertenece a su empresa.');
  }

  const { isExpired } = computeQuotationValidity(q);
  if (isExpired && q.status !== 'EXPIRED' && q.status !== 'ACCEPTED') {
    q.status = 'EXPIRED';
  }

  const customer = state.customers.find((c) => c.id === customerId);
  const contact = state.contacts.find((c) => c.id === q.contactId);
  const salesRepUser = state.users.find((u) => u.id === q.salesRepId);
  const salesRep = salesRepUser
    ? {
        name: salesRepUser.name,
        email: salesRepUser.email,
        phone: salesRepUser.phone,
      }
    : undefined;

  const groupId = q.quotationGroupId || q.id;
  const groupQuotes = state.quotations.filter((gq) => gq.quotationGroupId === groupId || gq.id === groupId);
  const latestQuote = [...groupQuotes].sort((a, b) => (b.revision || 1) - (a.revision || 1))[0];
  const hasNewerRevision = latestQuote && latestQuote.id !== q.id && (latestQuote.revision || 1) > (q.revision || 1);
  const meta = hasNewerRevision
    ? {
        hasNewerRevision: true,
        latestRevisionNumber: latestQuote.quotationNumber,
        latestRevisionToken: latestQuote.publicToken,
        latestRevisionId: latestQuote.id,
      }
    : undefined;

  res.json(toPublicQuotationDTO(q, customer, contact, salesRep, meta));
});

/**
 * POST /api/v1/portal/quotations/:id/view
 * El cliente autenticado notifica que abrió o visualizó la propuesta técnica.
 * Pasa de SENT a VIEWED garantizando lectura genuina del cliente.
 */
portalRouter.post('/quotations/:id/view', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const state = dbStore.getState();

  const quot = state.quotations.find((item) => item.id === req.params.id && item.customerId === customerId);
  if (!quot) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'No existe o no pertenece a su empresa.');
  }

  if (quot.status === 'SENT') {
    quot.status = 'VIEWED';
    quot.firstViewedAt = new Date().toISOString();
    quot.updatedAt = new Date().toISOString();

    const contact = state.contacts.find((c) => c.id === quot.contactId);
    const customer = state.customers.find((c) => c.id === customerId);
    const salesRep = state.users.find((u) => u.id === quot.salesRepId);

    const clientActorName = req.clientUser?.name || contact?.name || customer?.businessName || 'Cliente';

    quot.statusHistory.push({
      id: `hist-${crypto.randomUUID()}`,
      fromStatus: 'SENT',
      toStatus: 'VIEWED',
      actor: clientActorName,
      actorRole: 'CUSTOMER_CONTACT',
      comment: `El cliente '${customer?.businessName || clientActorName}' abrió y visualizó la propuesta técnica y económica desde el Portal de Clientes.`,
      timestamp: new Date().toISOString(),
    });

    dbStore.recordAudit({
      entity: 'QUOTATION',
      action: 'STATUS_CHANGE',
      entityId: quot.id,
      entityName: quot.quotationNumber,
      description: `El cliente '${customer?.businessName || clientActorName}' abrió la cotización ${quot.quotationNumber} en el Portal de Clientes. Estado sincronizado a 'Vista por Cliente'.`,
      actorId: req.clientUser?.contactId || 'portal-client',
      actorName: clientActorName,
      actorRole: 'CUSTOMER_CONTACT',
    });

    if (salesRep) {
      dbStore.addOutbox({
        quotationId: quot.id,
        channel: 'EMAIL',
        recipient: salesRep.email,
        recipientName: salesRep.name,
        subject: `Cotización ${quot.quotationNumber} VISTA en Portal por cliente (${customer?.businessName || clientActorName})`,
        body: `Estimado/a ${salesRep.name}, la cotización N.º ${quot.quotationNumber} fue visualizada en el portal por el cliente ${clientActorName}.`,
      });
    }
  }

  res.json({ success: true, status: quot.status, firstViewedAt: quot.firstViewedAt });
});

/**
 * GET /api/v1/portal/invoices
 * Documentos de cobro de la empresa del cliente.
 */
portalRouter.get('/invoices', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const state = dbStore.getState();

  const clientInvoices = state.invoices.filter((inv) => inv.customerId === customerId);
  clientInvoices.forEach(applyInvoiceOverdueCheck);

  const list = clientInvoices
    .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
    .map(toClientInvoiceDTO);

  res.json(list);
});

/**
 * GET /api/v1/portal/operations
 * Órdenes de trabajo de la empresa del cliente (solo lectura).
 */
portalRouter.get('/operations', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const state = dbStore.getState();

  const list = state.operations
    .filter((op) => op.customerId === customerId)
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
    .map(toClientOperationDTO);

  res.json(list);
});

/**
 * GET /api/v1/portal/timeline
 * Eventos e hitos orientados al cliente.
 */
portalRouter.get('/timeline', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const state = dbStore.getState();

  const list = state.quotations.filter((q) => q.customerId === customerId && q.status !== 'DRAFT');

  const timelineEntries: any[] = [];
  list.forEach((q) => {
    (q.statusHistory || []).forEach((h) => {
      // Filtrar estrictamente comentarios internos para el cliente
      let comment = 'Actualización en propuesta comercial';
      if (h.actorRole === 'CUSTOMER_CONTACT') {
        comment = h.comment;
      } else if (h.toStatus === 'SENT') {
        comment = 'Propuesta técnica y económica remitida al cliente.';
      } else if (h.toStatus === 'VIEWED') {
        comment = 'Propuesta visualizada por el cliente.';
      } else if (h.toStatus === 'ACCEPTED') {
        comment = 'Propuesta técnica y comercial aceptada.';
      } else if (h.toStatus === 'REJECTED') {
        comment = 'Cotización desestimada.';
      }

      timelineEntries.push({
        quotationId: q.id,
        quotationNumber: q.quotationNumber,
        status: h.toStatus,
        comment,
        actor: h.actorRole === 'CUSTOMER_CONTACT' ? (h.actor || 'Cliente') : 'M&L Ingeniería Naval',
        timestamp: h.timestamp,
        grandTotal: q.grandTotal,
      });
    });
  });

  timelineEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  res.json(timelineEntries);
});

/**
 * POST /api/v1/portal/quotations/:id/request-adjustment
 * Solicitud de ajuste desde el portal del cliente autenticado.
 */
portalRouter.post('/quotations/:id/request-adjustment', (req: Request, res: Response) => {
  const customerId = req.clientUser!.customerId;
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return sendProblem(res, 400, 'Mensaje requerido', 'Debe indicar el ajuste o comentario solicitado.');
  }

  const state = dbStore.getState();
  const quot = state.quotations.find((q) => q.id === req.params.id && q.customerId === customerId);
  if (!quot) {
    return sendProblem(res, 404, 'Cotización no encontrada', 'No existe o no pertenece a su empresa.');
  }

  if (quot.status === 'DRAFT') {
    return sendProblem(res, 400, 'Estado inválido', 'Una cotización en borrador no puede recibir solicitudes de ajuste.');
  }

  const salesRepUser = state.users.find((u) => u.id === quot.salesRepId);

  const oldStatus = quot.status;
  quot.status = 'CHANGES_REQUESTED';
  quot.updatedAt = new Date().toISOString();
  quot.statusHistory.push({
    id: `hist-${crypto.randomUUID()}`,
    fromStatus: oldStatus,
    toStatus: 'CHANGES_REQUESTED',
    actor: req.clientUser?.name || 'Cliente Mandante',
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
      body: `El cliente ${req.clientUser?.name || 'Cliente'} ha solicitado el siguiente ajuste para la cotización ${quot.quotationNumber}:\n\n"${message.trim()}"`,
    });
  }

  res.json({
    success: true,
    message: 'Su solicitud de ajuste ha sido enviada con éxito.',
  });
});
