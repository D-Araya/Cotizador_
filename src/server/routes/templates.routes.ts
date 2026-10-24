import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import {
  quotationTemplateCreateSchema,
  quotationTemplateUpdateSchema,
} from '../schemas.js';
import { QuotationTemplate } from '../../modules/types.js';

export const templatesRouter = express.Router();

templatesRouter.use(authenticateStaff);

/**
 * GET /api/v1/templates
 * Lista todas las plantillas activas (o todas si ?includeInactive=true)
 */
templatesRouter.get('/templates', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const { categoryId, includeInactive } = req.query;

  let list = state.templates || [];
  if (includeInactive !== 'true') {
    list = list.filter((t) => t.active !== false);
  }
  if (categoryId) {
    list = list.filter((t) => t.categoryId === categoryId);
  }

  res.json(list);
});

/**
 * GET /api/v1/templates/:id
 */
templatesRouter.get('/templates/:id', (req: Request, res: Response) => {
  const state = dbStore.getState();
  const template = (state.templates || []).find((t) => t.id === req.params.id);
  if (!template) {
    return sendProblem(res, 404, 'Plantilla no encontrada', 'No existe.');
  }
  res.json(template);
});

/**
 * POST /api/v1/templates
 * Solo ADMIN puede crear plantillas
 */
templatesRouter.post('/templates', requireAdmin, (req: Request, res: Response) => {
  const parsed = quotationTemplateCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'Datos de plantilla inválidos');
  }

  const state = dbStore.getState();
  const cat = state.categories.find((c) => c.id === parsed.data.categoryId);

  const newTemplate: QuotationTemplate = {
    id: `tmpl-${crypto.randomUUID()}`,
    name: parsed.data.name,
    categoryId: parsed.data.categoryId,
    categoryName: cat?.name || 'Categoría Técnica',
    description: parsed.data.description || '',
    lines: parsed.data.lines,
    terms: parsed.data.terms,
    presentationText: parsed.data.presentationText || state.company.defaultPresentationText,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!state.templates) state.templates = [];
  state.templates.unshift(newTemplate);

  dbStore.recordAudit({
    entity: 'CATALOG',
    action: 'CREATE',
    entityId: newTemplate.id,
    entityName: newTemplate.name,
    description: `Creó plantilla de cotización '${newTemplate.name}' para categoría '${newTemplate.categoryName}'.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.status(201).json(newTemplate);
});

/**
 * PUT /api/v1/templates/:id
 * Solo ADMIN puede editar plantillas
 */
templatesRouter.put('/templates/:id', requireAdmin, (req: Request, res: Response) => {
  const parsed = quotationTemplateUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Datos de plantilla inválidos');
  }

  const state = dbStore.getState();
  if (!state.templates) state.templates = [];
  const idx = state.templates.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    return sendProblem(res, 404, 'Plantilla no encontrada', 'No existe.');
  }

  const cat = parsed.data.categoryId ? state.categories.find((c) => c.id === parsed.data.categoryId) : undefined;
  const current = state.templates[idx];

  const updated: QuotationTemplate = {
    ...current,
    ...parsed.data,
    categoryName: cat ? cat.name : current.categoryName,
    updatedAt: new Date().toISOString(),
  };

  state.templates[idx] = updated;

  dbStore.recordAudit({
    entity: 'CATALOG',
    action: 'UPDATE',
    entityId: updated.id,
    entityName: updated.name,
    description: `Actualizó plantilla de cotización '${updated.name}'.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.json(updated);
});

/**
 * DELETE /api/v1/templates/:id
 */
templatesRouter.delete('/templates/:id', requireAdmin, (req: Request, res: Response) => {
  const state = dbStore.getState();
  if (!state.templates) state.templates = [];
  const idx = state.templates.findIndex((t) => t.id === req.params.id);
  if (idx === -1) {
    return sendProblem(res, 404, 'Plantilla no encontrada', 'No existe.');
  }

  state.templates[idx].active = false;
  state.templates[idx].updatedAt = new Date().toISOString();

  res.status(204).send();
});
