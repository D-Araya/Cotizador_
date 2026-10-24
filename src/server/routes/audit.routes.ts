import express, { Request, Response } from 'express';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { sanitizeCsvValue } from '../security.js';

export const auditRouter = express.Router();

auditRouter.use(authenticateStaff);

// GET /audit-logs con paginación ?page&pageSize&q&entity&action -> { items, total }
auditRouter.get('/audit-logs', (req: Request, res: Response) => {
  const state = dbStore.getState();
  let list = [...state.auditLogs];

  const { entity, action, userId, q, page, pageSize } = req.query;
  if (entity) list = list.filter((l) => l.entity === entity);
  if (action) list = list.filter((l) => l.action === action);
  if (userId) list = list.filter((l) => l.userId === userId);
  if (q) {
    const query = String(q).toLowerCase();
    list = list.filter((l) => {
      const text = (l.summary || l.description || '').toLowerCase();
      const user = (l.userName || l.actorName || '').toLowerCase();
      const entity = (l.entityId || '').toLowerCase();
      return text.includes(query) || user.includes(query) || entity.includes(query);
    });
  }

  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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

// Exportación CSV de auditoría (solo ADMIN)
auditRouter.get('/audit-logs/export-csv', requireAdmin, (_req: Request, res: Response) => {
  const state = dbStore.getState();
  const logs = state.auditLogs;

  const headers = ['ID', 'Fecha y Hora', 'Usuario', 'Rol', 'Acción', 'Entidad', 'Id Entidad', 'Resumen'];
  const rows = logs.map((l) => [
    sanitizeCsvValue(l.id),
    sanitizeCsvValue(l.timestamp),
    sanitizeCsvValue(l.userName || l.actorName),
    sanitizeCsvValue(l.userRole || l.actorRole),
    sanitizeCsvValue(l.action),
    sanitizeCsvValue(l.entity),
    sanitizeCsvValue(l.entityId),
    sanitizeCsvValue(l.summary || l.description),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="auditoria_ml_naval_${Date.now()}.csv"`);
  res.send('\uFEFF' + csvContent);
});
