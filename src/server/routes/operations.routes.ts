import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import { AuditService } from '../services/audit.service.js';
import { NumberingService } from '../services/numbering.service.js';
import { OperationOrder, OperationMilestone, OperationDeliverable } from '../../modules/types.js';

export const operationsRouter = express.Router();

operationsRouter.use(authenticateStaff);

/**
 * Recalcula de manera pura e inmutable el porcentaje de avance y el estado de la orden
 * exclusivamente a partir del arreglo de hitos (incluyendo regresiones de 100% -> En Proceso -> Programado).
 */
function recalculateOperationProgressAndStatus(
  op: OperationOrder,
  nextMilestones: OperationMilestone[],
  nextDeliverables?: OperationDeliverable[]
): OperationOrder {
  const safeMilestones = nextMilestones.map((m) => ({ ...m }));
  const safeDeliverables = (nextDeliverables ?? op.deliverables ?? []).map((d) => ({
    ...d,
    attachments: d.attachments ? d.attachments.map((a) => ({ ...a })) : undefined,
  }));

  const totalCount = safeMilestones.length;
  const completedCount = safeMilestones.filter((m) => m.status === 'COMPLETED').length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  let nextStatus: OperationOrder['status'] = 'SCHEDULED';
  let nextCompletedDate: string | undefined = undefined;

  if (totalCount > 0 && progressPct === 100) {
    nextStatus = 'COMPLETED';
    nextCompletedDate = op.completedDate || new Date().toISOString();
  } else if (progressPct > 0 || safeMilestones.some((m) => m.status === 'IN_PROGRESS')) {
    nextStatus = 'IN_PROGRESS';
    nextCompletedDate = undefined;
  } else {
    nextStatus = 'SCHEDULED';
    nextCompletedDate = undefined;
  }

  return {
    ...op,
    milestones: safeMilestones,
    deliverables: safeDeliverables,
    progressPct,
    status: nextStatus,
    completedDate: nextCompletedDate,
  };
}

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

  const orderNumber = await NumberingService.nextOperationNumber();

  const cust = state.customers.find((c) => c.id === quote.customerId);
  const businessName = quote.customerBusinessName || cust?.businessName || 'Cliente';

  const initialMs: OperationMilestone[] = Array.isArray(req.body.milestones) && req.body.milestones.length > 0
    ? req.body.milestones.map((m: any) => ({
        id: m.id || `ms-${crypto.randomUUID()}`,
        name: String(m.name || 'Hito Técnico').trim(),
        date: m.date || new Date().toISOString().split('T')[0],
        status: m.status || 'PENDING',
        completedAt: m.status === 'COMPLETED' ? new Date().toISOString() : undefined,
      }))
    : [
        { id: `ms-${crypto.randomUUID()}`, name: 'Planificación Técnica y Levantamiento de Información', date: scheduledDate || new Date().toISOString().split('T')[0], status: 'PENDING' },
        { id: `ms-${crypto.randomUUID()}`, name: 'Ejecución Técnica en Terreno / Taller', date: scheduledDate || new Date().toISOString().split('T')[0], status: 'PENDING' },
        { id: `ms-${crypto.randomUUID()}`, name: 'Emisión de Informe Técnico Final y Planos', date: scheduledDate || new Date().toISOString().split('T')[0], status: 'PENDING' },
      ];

  const initialDels: OperationDeliverable[] = Array.isArray(req.body.deliverables)
    ? req.body.deliverables.map((d: any) => ({
        id: d.id || `dl-${crypto.randomUUID()}`,
        name: String(d.name || 'Entregable Técnico').trim(),
        status: d.status || 'PENDING',
        link: d.link || `https://docs.mlingenieria.cl/${orderNumber.toLowerCase()}/entregable.pdf`,
      }))
    : [
        {
          id: `dl-${crypto.randomUUID()}`,
          name: 'Memoria Técnica y Planos Firmados',
          status: 'PENDING',
          link: `https://docs.mlingenieria.cl/${orderNumber.toLowerCase()}/memoria-tecnica.pdf`,
        },
      ];

  const baseOp: OperationOrder = {
    id: crypto.randomUUID(),
    orderNumber,
    quotationId: quote.id,
    quotationNumber: quote.quotationNumber,
    customerId: quote.customerId,
    customerBusinessName: businessName,
    type,
    title: String(title).trim(),
    description: description || quote.notes || '',
    status: 'SCHEDULED',
    progressPct: 0,
    assignedStaff: assignedStaff || 'Equipo de Operaciones ML',
    scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
    deliveryAddress: deliveryAddress || 'Instalaciones del cliente',
    itemsIncluded: quote.lines.map((l) => `${l.quantity}x ${l.name}`),
    milestones: initialMs,
    deliverables: initialDels,
  };

  const newOp = recalculateOperationProgressAndStatus(baseOp, initialMs, initialDels);
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
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const { status, guideNumber, assignedStaff, completedDate, milestones, deliverables } = req.body;
  const before = { ...op };

  const nextMilestones = Array.isArray(milestones) ? milestones : (op.milestones || []);
  const nextDeliverables = Array.isArray(deliverables) ? deliverables : (op.deliverables || []);

  let updatedOp = recalculateOperationProgressAndStatus(op, nextMilestones, nextDeliverables);

  if (status) {
    if (!['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return sendProblem(res, 400, 'Estado inválido', 'Estado de orden no permitido.');
    }
    updatedOp = {
      ...updatedOp,
      status,
      completedDate: status === 'COMPLETED' ? (completedDate || updatedOp.completedDate || new Date().toISOString()) : undefined,
    };
  }

  if (guideNumber !== undefined) updatedOp = { ...updatedOp, guideNumber: String(guideNumber) };
  if (assignedStaff !== undefined) updatedOp = { ...updatedOp, assignedStaff: String(assignedStaff) };

  state.operations[opIndex] = updatedOp;

  await AuditService.logFromReq(
    req,
    'UPDATE_OPERATION',
    'operation',
    updatedOp.id,
    `Actualizó orden ${updatedOp.orderNumber} (estado: ${updatedOp.status}, avance calculado: ${updatedOp.progressPct}%)`,
    before,
    updatedOp
  );

  res.json(updatedOp);
});

/**
 * POST /api/v1/operations/:id/milestones (P2.k)
 * Añade un nuevo hito de forma inmutable y recalcula el progreso y estado.
 */
operationsRouter.post('/operations/:id/milestones', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const { name, date, status } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedDate = typeof date === 'string' && date.trim() ? date.trim() : new Date().toISOString().split('T')[0];

  if (!trimmedName) {
    return sendProblem(res, 400, 'Datos incompletos', 'El nombre del hito es requerido.');
  }

  const validStatus: OperationMilestone['status'] =
    status === 'COMPLETED' || status === 'IN_PROGRESS' ? status : 'PENDING';

  const newMilestone: OperationMilestone = {
    id: `ms-${crypto.randomUUID()}`,
    name: trimmedName,
    date: trimmedDate,
    status: validStatus,
    completedAt: validStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
  };

  const nextMilestones = [...(op.milestones || []), newMilestone];
  const updatedOp = recalculateOperationProgressAndStatus(op, nextMilestones);
  state.operations[opIndex] = updatedOp;

  await AuditService.logFromReq(
    req,
    'ADD_OPERATION_MILESTONE',
    'operation',
    updatedOp.id,
    `Añadió hito "${newMilestone.name}" en orden ${updatedOp.orderNumber} (avance: ${updatedOp.progressPct}%)`,
    op,
    updatedOp
  );

  res.status(201).json(updatedOp);
});

/**
 * PATCH /api/v1/operations/:id/milestones/:milestoneId (P2.k)
 * Actualiza de forma inmutable el estado, nombre o fecha de un hito y recalcula automáticamente el avance.
 */
operationsRouter.patch('/operations/:id/milestones/:milestoneId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const currentMilestones = op.milestones || [];
  const msExists = currentMilestones.some((m) => m.id === req.params.milestoneId);
  if (!msExists) return sendProblem(res, 404, 'Hito no encontrado', 'No existe el hito especificado.');

  const { status, name, date } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return sendProblem(res, 400, 'Nombre inválido', 'El nombre del hito no puede estar vacío.');
  }

  const nextMilestones: OperationMilestone[] = currentMilestones.map((m) => {
    if (m.id !== req.params.milestoneId) return { ...m };
    const nextStatus: OperationMilestone['status'] =
      status !== undefined && ['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)
        ? status
        : m.status;
    return {
      ...m,
      name: name !== undefined ? String(name).trim() : m.name,
      date: date !== undefined && String(date).trim() ? String(date).trim() : m.date,
      status: nextStatus,
      completedAt:
        status !== undefined
          ? nextStatus === 'COMPLETED'
            ? m.completedAt || new Date().toISOString()
            : undefined
          : m.completedAt,
    };
  });

  const updatedOp = recalculateOperationProgressAndStatus(op, nextMilestones);
  state.operations[opIndex] = updatedOp;

  await AuditService.logFromReq(
    req,
    'UPDATE_OPERATION_MILESTONE',
    'operation',
    updatedOp.id,
    `Actualizó hito en orden ${updatedOp.orderNumber} (avance: ${updatedOp.progressPct}%, estado: ${updatedOp.status})`,
    op,
    updatedOp
  );

  res.json(updatedOp);
});

/**
 * DELETE /api/v1/operations/:id/milestones/:milestoneId
 * Elimina de forma inmutable un hito de la orden y recalcula automáticamente el avance.
 */
operationsRouter.delete('/operations/:id/milestones/:milestoneId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const currentMilestones = op.milestones || [];
  const targetMs = currentMilestones.find((m) => m.id === req.params.milestoneId);
  if (!targetMs) return sendProblem(res, 404, 'Hito no encontrado', 'No existe el hito especificado.');

  const nextMilestones = currentMilestones.filter((m) => m.id !== req.params.milestoneId);
  const updatedOp = recalculateOperationProgressAndStatus(op, nextMilestones);
  state.operations[opIndex] = updatedOp;

  await AuditService.logFromReq(
    req,
    'DELETE_OPERATION_MILESTONE',
    'operation',
    updatedOp.id,
    `Eliminó hito "${targetMs.name}" en orden ${updatedOp.orderNumber} (avance: ${updatedOp.progressPct}%)`,
    op,
    updatedOp
  );

  res.json(updatedOp);
});

/**
 * POST /api/v1/operations/:id/deliverables (P2.k)
 * Añade un entregable de forma inmutable a la orden.
 */
operationsRouter.post('/operations/:id/deliverables', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const { name, status, link } = req.body;
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    return sendProblem(res, 400, 'Nombre requerido', 'El nombre del entregable es obligatorio.');
  }

  const alreadyExists = (op.deliverables || []).some(
    (d) => d.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (alreadyExists) {
    return sendProblem(res, 409, 'Entregable duplicado', 'Ya existe un entregable con ese nombre en esta orden de trabajo.');
  }

  const validStatus: OperationDeliverable['status'] =
    status === 'READY' || status === 'DELIVERED' ? status : 'PENDING';

  const newDel: OperationDeliverable = {
    id: `dl-${crypto.randomUUID()}`,
    name: trimmedName,
    status: validStatus,
    link: typeof link === 'string' && link.trim()
      ? link.trim()
      : `https://docs.mlingenieria.cl/${op.orderNumber.toLowerCase()}/${encodeURIComponent(trimmedName.toLowerCase().replace(/\s+/g, '-'))}.pdf`,
  };

  const nextDeliverables = [...(op.deliverables || []), newDel];
  const updatedOp = recalculateOperationProgressAndStatus(op, op.milestones || [], nextDeliverables);
  state.operations[opIndex] = updatedOp;

  await AuditService.logFromReq(
    req,
    'ADD_OPERATION_DELIVERABLE',
    'operation',
    updatedOp.id,
    `Añadió entregable "${newDel.name}" en orden ${updatedOp.orderNumber}`,
    op,
    updatedOp
  );

  res.status(201).json(updatedOp);
});

/**
 * PATCH /api/v1/operations/:id/deliverables/:deliverableId (P2.k)
 * Actualiza de forma inmutable un entregable (nombre, estado o enlace).
 */
operationsRouter.patch('/operations/:id/deliverables/:deliverableId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const currentDeliverables = op.deliverables || [];
  const delExists = currentDeliverables.some((d) => d.id === req.params.deliverableId);
  if (!delExists) return sendProblem(res, 404, 'Entregable no encontrado', 'No existe el entregable especificado.');

  const { name, status, link } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return sendProblem(res, 400, 'Nombre inválido', 'El nombre del entregable no puede estar vacío.');
  }

  if (name !== undefined) {
    const trimmedCandidate = String(name).trim().toLowerCase();
    const duplicate = currentDeliverables.some(
      (d) => d.id !== req.params.deliverableId && d.name.trim().toLowerCase() === trimmedCandidate
    );
    if (duplicate) {
      return sendProblem(res, 409, 'Entregable duplicado', 'Ya existe otro entregable con ese nombre en esta orden.');
    }
  }

  const nextDeliverables: OperationDeliverable[] = currentDeliverables.map((d) => {
    if (d.id !== req.params.deliverableId) return { ...d };
    const nextStatus: OperationDeliverable['status'] =
      status !== undefined && ['PENDING', 'READY', 'DELIVERED'].includes(status)
        ? status
        : d.status;
    return {
      ...d,
      name: name !== undefined ? String(name).trim() : d.name,
      status: nextStatus,
      link: link !== undefined ? String(link).trim() : d.link,
    };
  });

  const updatedOp = recalculateOperationProgressAndStatus(op, op.milestones || [], nextDeliverables);
  state.operations[opIndex] = updatedOp;

  await AuditService.logFromReq(
    req,
    'UPDATE_OPERATION_DELIVERABLE',
    'operation',
    updatedOp.id,
    `Actualizó entregable en orden ${updatedOp.orderNumber}`,
    op,
    updatedOp
  );

  res.json(updatedOp);
});

/**
 * DELETE /api/v1/operations/:id/deliverables/:deliverableId
 * Elimina de forma inmutable un entregable de la orden.
 */
operationsRouter.delete('/operations/:id/deliverables/:deliverableId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const currentDeliverables = op.deliverables || [];
  const targetDel = currentDeliverables.find((d) => d.id === req.params.deliverableId);
  if (!targetDel) return sendProblem(res, 404, 'Entregable no encontrado', 'No existe el entregable especificado.');

  const nextDeliverables = currentDeliverables.filter((d) => d.id !== req.params.deliverableId);
  const updatedOp = recalculateOperationProgressAndStatus(op, op.milestones || [], nextDeliverables);
  state.operations[opIndex] = updatedOp;

  await AuditService.logFromReq(
    req,
    'DELETE_OPERATION_DELIVERABLE',
    'operation',
    updatedOp.id,
    `Eliminó entregable "${targetDel.name}" en orden ${updatedOp.orderNumber}`,
    op,
    updatedOp
  );

  res.json(updatedOp);
});

/**
 * POST /api/v1/operations/:id/deliverables/:deliverableId/attachments (P3.n)
 * Añade un enlace a archivo en un entregable de forma inmutable.
 */
operationsRouter.post('/operations/:id/deliverables/:deliverableId/attachments', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const currentDeliverables = op.deliverables || [];
  const delExists = currentDeliverables.some((d) => d.id === req.params.deliverableId);
  if (!delExists) return sendProblem(res, 404, 'Entregable no encontrado', 'No existe.');

  const { name, url, description } = req.body;
  if (!name || !url) {
    return sendProblem(res, 400, 'Datos incompletos', 'El nombre y enlace URL del archivo son obligatorios.');
  }

  const newAttachment = {
    id: `datt-${crypto.randomUUID()}`,
    name: String(name).trim(),
    url: String(url).trim(),
    description: description ? String(description).trim() : '',
    addedAt: new Date().toISOString(),
  };

  const nextDeliverables = currentDeliverables.map((d) =>
    d.id === req.params.deliverableId
      ? { ...d, attachments: [...(d.attachments || []), newAttachment] }
      : { ...d }
  );

  state.operations[opIndex] = recalculateOperationProgressAndStatus(op, op.milestones || [], nextDeliverables);

  res.status(201).json(newAttachment);
});

/**
 * DELETE /api/v1/operations/:id/deliverables/:deliverableId/attachments/:attachmentId (P3.n)
 * Elimina un enlace adjunto de un entregable de forma inmutable.
 */
operationsRouter.delete('/operations/:id/deliverables/:deliverableId/attachments/:attachmentId', async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const opIndex = state.operations.findIndex((o) => o.id === req.params.id);
  if (opIndex === -1) return sendProblem(res, 404, 'Orden no encontrada', 'No existe.');
  const op = state.operations[opIndex];

  if (req.user?.role === 'SALES_REP') {
    const quote = state.quotations.find((q) => q.id === op.quotationId);
    if (quote && quote.salesRepId !== req.user.id) {
      return sendProblem(res, 403, 'Acceso denegado', 'No puede modificar órdenes de otro asesor.');
    }
  }

  const currentDeliverables = op.deliverables || [];
  const del = currentDeliverables.find((d) => d.id === req.params.deliverableId);
  if (!del) return sendProblem(res, 404, 'Entregable no encontrado', 'No existe.');

  const currentAtts = del.attachments || [];
  if (!currentAtts.some((a) => a.id === req.params.attachmentId)) {
    return sendProblem(res, 404, 'Adjunto no encontrado', 'No existe.');
  }

  const nextDeliverables = currentDeliverables.map((d) =>
    d.id === req.params.deliverableId
      ? { ...d, attachments: (d.attachments || []).filter((a) => a.id !== req.params.attachmentId) }
      : { ...d }
  );

  state.operations[opIndex] = recalculateOperationProgressAndStatus(op, op.milestones || [], nextDeliverables);

  res.status(204).send();
});

