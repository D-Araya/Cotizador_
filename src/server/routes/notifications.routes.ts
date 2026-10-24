import express, { Request, Response } from 'express';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import { OutboxService } from '../services/outbox.service.js';
import { AuditService } from '../services/audit.service.js';

export const notificationsRouter = express.Router();

notificationsRouter.use(authenticateStaff);

// GET /notifications, /notifications/outbox, /outbox con paginación ?page&pageSize&q&status -> { items, total }
notificationsRouter.get(['/notifications', '/notifications/outbox', '/outbox'], (req: Request, res: Response) => {
  const state = dbStore.getState();
  let list = [...state.outbox];

  const { status, channel, q, page, pageSize } = req.query;
  if (status) list = list.filter((m) => m.status === status);
  if (channel) list = list.filter((m) => m.channel === channel);
  if (q) {
    const query = String(q).toLowerCase();
    list = list.filter(
      (m) =>
        (m.recipientEmail && m.recipientEmail.toLowerCase().includes(query)) ||
        (m.recipient && m.recipient.toLowerCase().includes(query)) ||
        (m.recipientName && m.recipientName.toLowerCase().includes(query)) ||
        (m.quotationNumber && m.quotationNumber.toLowerCase().includes(query))
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

// Reintento manual de envío (solo ADMIN)
notificationsRouter.post('/notifications/:id/retry', requireAdmin, async (req: Request, res: Response) => {
  const state = dbStore.getState();
  const msg = state.outbox.find((m) => m.id === req.params.id);
  if (!msg) return sendProblem(res, 404, 'Mensaje no encontrado', 'No existe el mensaje.');

  const result = await OutboxService.retry(msg.id);

  await AuditService.logFromReq(
    req,
    'RETRY_OUTBOX_NOTIFICATION',
    'outbox',
    msg.id,
    `Reintento de envío de mensaje ${msg.id} para ${msg.recipientEmail || msg.recipient} (${msg.channel})`
  );

  res.json({
    success: true,
    message: 'Procesamiento de reintento ejecutado',
    outboxMessage: result || msg,
  });
});
