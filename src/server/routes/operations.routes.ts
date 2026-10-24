import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import { AuditService } from '../services/audit.service.js';
import { NumberingService } from '../services/numbering.service.js';
import { OperationOrder } from '../../modules/types.js';

export const operationsRouter = express.Router();

operationsRouter.use(authenticateStaff);

// GET /operations con paginación ?page&pageSize&q&status -> { items, total }
operationsRouter.get('/operations', (req: Request, res: Response) => {
  const state = dbStore.getState();
  let list = [...state.operations];

  // REGLA: El SALES_REP solo ve las órdenes de sus cotizaciones
  if (req.user?.role === 'SALES_REP') {
    const repQuoteIds = new Set(
      state.quotations.filter((q) => q.salesRepId === req.user?.id).map((q) => q.id)
    );
    list = list.filter((op) => repQuoteIds.has(op.quotationId));
  }

  const { status, type, q, page, pageSize } = req.query;
  if (status) list = list.filter((op) => op.status === status);
  if (type) list = list.filter((op) => op.type === type);
  if (q) {
    const query = String(q).toLowerCase();
    list = list.filter(
      (op) =>
        op.orderNumber.toLowerCase().includes(query) ||
        op.quotationNumber.toLowerCase().includes(query) ||
        op.title.toLowerCase().includes(query) ||
        op.customerBusinessName.toLowerCase().includes(query)
    );
  }

  list.sort((a, b) => new Date(b.scheduledDate || '').getTime() - new Date(a.scheduledDate || '').getTime());

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

operationsRouter.get('/operations/:id', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede acceder a órdenes de otro asesor.');
    }
  }

  res.json(op);
});

operationsRouter.post('/operations', async (req: Request, res: Response) => {
  const { quotationId, type, title, description, scheduledDate, assignedStaff, deliveryAddress } = req.body;
  if (!quotationId || !type || !title) {
    return sendProblem(res, 400, 'Datos incompletos', 'Se requiere quotationId, type y title.');
  }

  const state = dbStore.getState();
  const quote = state.quotations.find((q) => q.id === quotationId);
  if (!quote) return sendProblem(res, 404, 'Cotización no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP' && quote.salesRepId !== req.user.id) {
    return sendProblem(res, 403, 'Acceso denegado', 'Solo puede crear órdenes de sus propias cotizaciones.');
  }

  // Folio dinámico con año de la fecha (Punto 4)
  const orderNumber = await NumberingService.nextOperationNumber();

  const cust = state.customers.find((c) => c.id === quote.customerId);
  const businessName = quote.customerBusinessName || cust?.businessName || 'Cliente';

  // Inicializar hitos estándar (P2.k)
  const initialMs = Array.isArray(req.body.milestones) && req.body.milestones.length > 0
    ? req.body.milestones.map((m: any) => ({
        id: m.id || `ms-${crypto.randomUUID()}`,
        name: m.name,
        date: m.date || new Date().toISOString().split('T')[0],
        status: m.status || 'PENDING',
        completedAt: m.status === 'COMPLETED' ? new Date().toISOString() : undefined,
      }))
    : [
        { id: `ms-${crypto.randomUUID()}`, name: 'Planificación Técnica y Levantamiento de Información', date: scheduledDate || new Date().toISOString().split('T')[0], status: 'PENDING' },
        { id: `ms-${crypto.randomUUID()}`, name: 'Ejecución Técnica en Terreno / Taller', date: scheduledDate || new Date().toISOString().split('T')[0], status: 'PENDING' },
        { id: `ms-${crypto.randomUUID()}`, name: 'Emisión de Informe Técnico Final y Planos', date: scheduledDate || new Date().toISOString().split('T')[0], status: 'PENDING' },
      ];

  const initialDels = Array.isArray(req.body.deliverables)
    ? req.body.deliverables.map((d: any) => ({
        id: d.id || `dl-${crypto.randomUUID()}`,
        name: d.name,
        status: d.status || 'PENDING',
        link: d.link,
      }))
    : [
        { id: `dl-${crypto.randomUUID()}`, name: 'Memoria Técnica y Planos Firmados', status: 'PENDING' },
      ];

  const completedCount = initialMs.filter((m: any) => m.status === 'COMPLETED').length;
  const progressPct = initialMs.length > 0 ? Math.round((completedCount / initialMs.length) * 100) : 0;

  const newOp: OperationOrder = {
    id: crypto.randomUUID(),
    orderNumber,
    quotationId: quote.id,
    quotationNumber: quote.quotationNumber,
    customerId: quote.customerId,
    customerBusinessName: businessName,
    type,
    title,
    description: description || quote.notes || '',
    status: 'SCHEDULED',
    progressPct,
    assignedStaff: assignedStaff || 'Equipo de Operaciones ML',
    scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
    deliveryAddress: deliveryAddress || 'Instalaciones del cliente',
    itemsIncluded: quote.lines.map((l) => `${l.quantity}x ${l.name}`),
    milestones: initialMs,
    deliverables: initialDels,
  };

  state.operations.push(newOp);

  await AuditService.logFromReq(
    req,
    'CREATE_OPERATION',
    'operation',
    newOp.id,
    `Creó orden de trabajo ${newOp.orderNumber} para ${businessName}`,
    null,
    newOp
  );

  res.status(201).json(newOp);
});

operationsRouter.patch('/operations/:id', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const { status, guideNumber, assignedStaff, completedDate, milestones, deliverables } = req.body;
  const before = { ...op };

  if (milestones && Array.isArray(milestones)) {
    op.milestones = milestones;
  }
  if (deliverables && Array.isArray(deliverables)) {
    op.deliverables = deliverables;
  }

  // REGLA P2.k: El avance se calcula estrictamente desde los hitos; se elimina el control libre de porcentaje
  if (op.milestones && op.milestones.length > 0) {
    const completedCount = op.milestones.filter((m) => m.status === 'COMPLETED').length;
    op.progressPct = Math.round((completedCount / op.milestones.length) * 100);
  }

  if (status) {
    if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return sendProblem(res, 400, 'Estado inválido', 'Estado de orden no permitido.');
    }
    op.status = status;
    if (status === 'COMPLETED' && !op.completedDate) {
      op.completedDate = completedDate || new Date().toISOString().split('T')[0];
    }
  } else if (op.progressPct === 100 && op.status !== 'COMPLETED') {
    op.status = 'COMPLETED';
    op.completedDate = completedDate || new Date().toISOString().split('T')[0];
  } else if (op.progressPct > 0 && op.progressPct < 100 && op.status === 'SCHEDULED') {
    op.status = 'IN_PROGRESS';
  }

  if (guideNumber !== undefined) op.guideNumber = String(guideNumber);
  if (assignedStaff !== undefined) op.assignedStaff = String(assignedStaff);

  await AuditService.logFromReq(
    req,
    'UPDATE_OPERATION',
    'operation',
    op.id,
    `Actualizó orden ${op.orderNumber} (estado: ${op.status}, avance calculado: ${op.progressPct}%)`,
    before,
    op
  );

  res.json(op);
});

/**
 * POST /api/v1/operations/:id/milestones (P2.k)
 * Añade un nuevo hito y recalcula el progreso.
 */
operationsRouter.post('/operations/:id/milestones', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const { name, date, status } = req.body;
  if (!name || !date) {
    return sendProblem(res, 400, 'Datos incompletos', 'Nombre y fecha del hito son requeridos.');
  }

  if (!op.milestones) op.milestones = [];
  const newMilestone = {
    id: `ms-${crypto.randomUUID()}`,
    name,
    date,
    status: status || 'PENDING',
    completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined,
  };
  op.milestones.push(newMilestone);

  // Recalcular progreso
  const completed = op.milestones.filter((m) => m.status === 'COMPLETED').length;
  op.progressPct = Math.round((completed / op.milestones.length) * 100);
  if (op.progressPct === 100) op.status = 'COMPLETED';
  else if (op.progressPct > 0 && op.status === 'SCHEDULED') op.status = 'IN_PROGRESS';

  res.status(201).json(op);
});

/**
 * PATCH /api/v1/operations/:id/milestones/:milestoneId (P2.k)
 * Actualiza el estado de un hito y recalcula automáticamente el avance.
 */
operationsRouter.patch('/operations/:id/milestones/:milestoneId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  if (!op.milestones) op.milestones = [];
  const ms = op.milestones.find((m) => m.id === req.params.milestoneId);
  if (!ms) return sendProblem(res, 404, 'Hito no encontrado', 'No existe.');

  const { status, name, date } = req.body;
  if (name !== undefined) ms.name = name;
  if (date !== undefined) ms.date = date;
  if (status !== undefined) {
    ms.status = status;
    if (status === 'COMPLETED') {
      ms.completedAt = new Date().toISOString();
    } else {
      ms.completedAt = undefined;
    }
  }

  // Recalcular progreso estrictamente desde los hitos
  const completed = op.milestones.filter((m) => m.status === 'COMPLETED').length;
  op.progressPct = Math.round((completed / op.milestones.length) * 100);

  if (op.progressPct === 100) {
    op.status = 'COMPLETED';
    if (!op.completedDate) op.completedDate = new Date().toISOString().split('T')[0];
  } else if (op.progressPct > 0) {
    if (op.status === 'SCHEDULED') op.status = 'IN_PROGRESS';
  }

  res.json(op);
});

/**
 * POST /api/v1/operations/:id/deliverables (P2.k)
 * Añade un entregable a la orden.
 */
operationsRouter.post('/operations/:id/deliverables', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const { name, status, link } = req.body;
  if (!name) return sendProblem(res, 400, 'Nombre requerido', 'El nombre del entregable es obligatorio.');

  if (!op.deliverables) op.deliverables = [];
  const newDel = {
    id: `dl-${crypto.randomUUID()}`,
    name,
    status: status || 'PENDING',
    link: link || '',
  };
  op.deliverables.push(newDel);

  res.status(201).json(op);
});

/**
 * PATCH /api/v1/operations/:id/deliverables/:deliverableId (P2.k)
 */
operationsRouter.patch('/operations/:id/deliverables/:deliverableId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  if (!op.deliverables) op.deliverables = [];
  const del = op.deliverables.find((d) => d.id === req.params.deliverableId);
  if (!del) return sendProblem(res, 404, 'Entregable no encontrado', 'No existe.');

  const { name, status, link } = req.body;
  if (name !== undefined) del.name = name;
  if (status !== undefined) del.status = status;
  if (link !== undefined) del.link = link;

  res.json(op);
});

/**
 * POST /api/v1/operations/:id/deliverables/:deliverableId/attachments (P3.n)
 * Añade un enlace a archivo en un entregable.
 */
operationsRouter.post('/operations/:id/deliverables/:deliverableId/attachments', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  if (!op.deliverables) op.deliverables = [];
  const del = op.deliverables.find((d) => d.id === req.params.deliverableId);
  if (!del) return sendProblem(res, 404, 'Entregable no encontrado', 'No existe.');

  const { name, url, description } = req.body;
  if (!name || !url) {
    return sendProblem(res, 400, 'Datos incompletos', 'El nombre y enlace URL del archivo son obligatorios.');
  }

  const newAttachment = {
    id: `datt-${crypto.randomUUID()}`,
    name,
    url,
    description: description || '',
    addedAt: new Date().toISOString(),
  };

  if (!del.attachments) del.attachments = [];
  del.attachments.push(newAttachment);

  res.status(201).json(newAttachment);
});

/**
 * DELETE /api/v1/operations/:id/deliverables/:deliverableId/attachments/:attachmentId (P3.n)
 * Elimina un enlace adjunto de un entregable.
 */
operationsRouter.delete('/operations/:id/deliverables/:deliverableId/attachments/:attachmentId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const op = state.operations.find((o) => o.id === req.params.id);
  if (!op) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  if (!op.deliverables) op.deliverables = [];
  const del = op.deliverables.find((d) => d.id === req.params.deliverableId);
  if (!del) return sendProblem(res, 404, 'Entregable no encontrado', 'No existe.');

  if (!del.attachments) del.attachments = [];
  const attIndex = del.attachments.findIndex((a) => a.id === req.params.attachmentId);
  if (attIndex === -1) return sendProblem(res, 404, 'Adjunto no encontrado', 'No existe.');

  del.attachments.splice(attIndex, 1);

  res.status(204).send();
});
