import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import {
  catalogItemCreateSchema,
  catalogItemUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
} from '../schemas.js';

export const catalogRouter = express.Router();

// Todas las rutas de catálogo requieren personal autenticado (ADMIN o SALES_REP)
catalogRouter.use(authenticateStaff);

/**
 * GET /api/v1/categories
 */
catalogRouter.get('/categories', (_req: Request, res: Response) => {
  res.json(dbStore.getState().categories);
});

catalogRouter.post('/categories', requireAdmin, (req: Request, res: Response) => {
  const parsed = categoryCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'El nombre de categoría es obligatorio');
  }

  const { name, description } = parsed.data;
  const newCat = {
    id: `cat-${crypto.randomUUID()}`,
    name,
    description: description || '',
    active: true,
  };
  dbStore.getState().categories.push(newCat);
  res.status(201).json(newCat);
});

catalogRouter.patch('/categories/:id', requireAdmin, (req: Request, res: Response) => {
  const parsed = categoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Estructura de categoría no válida');
  }

  const state = dbStore.getState();
  const idx = state.categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return sendProblem(res, 404, 'Categoría no encontrada', 'No existe.');

  state.categories[idx] = { ...state.categories[idx], ...parsed.data };
  res.json(state.categories[idx]);
});

catalogRouter.delete('/categories/:id', requireAdmin, (req: Request, res: Response) => {
  const state = dbStore.getState();
  const catIdx = state.categories.findIndex((c) => c.id === req.params.id);
  if (catIdx === -1) return sendProblem(res, 404, 'Categoría no encontrada', 'No existe.');
  state.categories.splice(catIdx, 1);
  res.status(204).send();
});

/**
 * GET /api/v1/catalog-items
 * ADMIN y SALES_REP pueden leer (con costo para calcular margen comercial).
 */
catalogRouter.get('/catalog-items', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const { type, categoryId, q, includeInactive } = req.query;
  let items = includeInactive === 'true'
    ? state.catalogItems
    : state.catalogItems.filter((i) => i.active !== false);

  if (type) items = items.filter((i) => i.type === type);
  if (categoryId) items = items.filter((i) => i.categoryId === categoryId);
  if (q) {
    const query = String(q).toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(query) ||
        ((i as any).sku && (i as any).sku.toLowerCase().includes(query))
    );
  }

  const { page, pageSize } = req.query;
  if (page !== undefined || pageSize !== undefined) {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.max(1, Number(pageSize) || 20);
    const start = (p - 1) * ps;
    return res.json({
      items: items.slice(start, start + ps),
      total: items.length,
      page: p,
      pageSize: ps,
    });
  }

  res.json(items);
});

catalogRouter.get('/catalog-items/:id', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const item = state.catalogItems.find((i) => i.id === req.params.id);
  if (!item) return sendProblem(res, 404, 'Ítem no encontrado', 'No existe.');
  res.json(item);
});

/**
 * POST /api/v1/catalog-items
 * REGLA: Solo ADMIN puede crear ítems en el catálogo.
 */
catalogRouter.post('/catalog-items', requireAdmin, (req: Request, res: Response) => {
  const parsed = catalogItemCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'Datos de catálogo inválidos');
  }

  const state = dbStore.getState();
  const item = parsed.data;

  if (item.type === 'PRODUCT' && item.sku) {
    const existing = state.catalogItems.find(
      (i) => i.active !== false && i.type === 'PRODUCT' && (i as any).sku === item.sku
    );
    if (existing) {
      return sendProblem(res, 409, 'SKU duplicado', `El SKU ${item.sku} ya existe.`);
    }
  }

  let calculatedCost = item.unitCost;
  let calculatedPrice = item.listPrice;

  // Si es un KIT (ítem compuesto), el costo se suma y el precio sugerido se calcula (P2.j)
  if (item.isKit && Array.isArray(item.kitItems) && item.kitItems.length > 0) {
    let sumCost = 0;
    for (const k of item.kitItems) {
      const sub = state.catalogItems.find((ci) => ci.id === k.catalogItemId);
      if (sub) {
        sumCost += (sub.unitCost || 0) * k.quantity;
      }
    }
    calculatedCost = sumCost;
    const minMargin = state.company.minMarginPct || 28.0;
    const suggested = Math.ceil(sumCost / (1 - minMargin / 100));
    calculatedPrice = item.listPrice && item.listPrice >= suggested ? item.listPrice : suggested;
  }

  const newItem = {
    ...item,
    id: `${item.type.toLowerCase()}-${crypto.randomUUID()}`,
    unitCost: calculatedCost,
    listPrice: calculatedPrice,
    unit: item.unit || (item.type === 'PRODUCT' ? 'UND' : 'SERVICIO'),
    categoryId: item.categoryId,
    active: true,
    createdAt: new Date().toISOString(),
  };

  state.catalogItems.unshift(newItem as any);

  dbStore.recordAudit({
    entity: 'CATALOG',
    action: 'CREATE',
    entityId: newItem.id,
    entityName: newItem.name,
    description: `Añadió ${newItem.type === 'PRODUCT' ? 'producto' : 'servicio'} '${newItem.name}'${newItem.isKit ? ' (Kit compuesto)' : ''}.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.status(201).json(newItem);
});

/**
 * PUT /api/v1/catalog-items/:id
 * REGLA: Solo ADMIN puede modificar ítems del catálogo.
 */
catalogRouter.put('/catalog-items/:id', requireAdmin, (req: Request, res: Response) => {
  const parsed = catalogItemUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Datos inválidos');
  }

  const state = dbStore.getState();
  const idx = state.catalogItems.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return sendProblem(res, 404, 'Ítem no encontrado', 'No existe.');

  const updateData = { ...parsed.data };

  // Si es un KIT (ítem compuesto), recalcular costo y precio sugerido
  if (updateData.isKit && Array.isArray(updateData.kitItems) && updateData.kitItems.length > 0) {
    let sumCost = 0;
    for (const k of updateData.kitItems) {
      const sub = state.catalogItems.find((ci) => ci.id === k.catalogItemId);
      if (sub) {
        sumCost += (sub.unitCost || 0) * k.quantity;
      }
    }
    updateData.unitCost = sumCost;
    const minMargin = state.company.minMarginPct || 28.0;
    const suggested = Math.ceil(sumCost / (1 - minMargin / 100));
    updateData.listPrice = updateData.listPrice && updateData.listPrice >= suggested ? updateData.listPrice : suggested;
  }

  state.catalogItems[idx] = { ...state.catalogItems[idx], ...updateData };

  dbStore.recordAudit({
    entity: 'CATALOG',
    action: 'UPDATE',
    entityId: state.catalogItems[idx].id,
    entityName: state.catalogItems[idx].name,
    description: `Modificó ítem '${state.catalogItems[idx].name}'.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.json(state.catalogItems[idx]);
});

/**
 * DELETE /api/v1/catalog-items/:id
 * REGLA: Solo ADMIN puede dar de baja ítems del catálogo.
 */
catalogRouter.delete('/catalog-items/:id', requireAdmin, (req: Request, res: Response) => {
  const state = dbStore.getState();
  const idx = state.catalogItems.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return sendProblem(res, 404, 'Ítem no encontrado', 'No existe.');

  const item = state.catalogItems[idx];
  item.active = false;

  res.status(204).send();
});
