import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { sendProblem } from '../security.js';
import { companyUpdateSchema, restoreBackupSchema, ufRateUpdateSchema, userCreateSchema, userUpdateSchema } from '../schemas.js';
import { hashPassword } from '../auth.js';

export const companyRouter = express.Router();

/**
 * GET /api/v1/company
 */
companyRouter.get('/company', (_req: Request, res: Response) => {
  res.json(dbStore.getCompany());
});

/**
 * PUT /api/v1/company
 * REGLA: Solo ADMIN puede modificar empresa y margen mínimo.
 */
companyRouter.put('/company', authenticateStaff, requireAdmin, (req: Request, res: Response) => {
  const parsed = companyUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Configuración no válida');
  }

  const currentCompany = dbStore.getCompany();
  const targetMinMargin = parsed.data.minMarginPct !== undefined ? parsed.data.minMarginPct : currentCompany.minMarginPct;

  // Validación P3.l: El piso duro debe ser menor que el mínimo
  if (parsed.data.hardMinMarginPct !== undefined && parsed.data.hardMinMarginPct >= targetMinMargin) {
    return sendProblem(
      res,
      400,
      'Piso duro inválido',
      `El piso duro de margen (${parsed.data.hardMinMarginPct}%) debe ser menor que el margen mínimo (${targetMinMargin}%).`
    );
  }

  const updateData: any = { ...parsed.data };
  if (parsed.data.ufRate !== undefined) {
    updateData.ufRateUpdatedAt = new Date().toISOString();
  }

  const updated = dbStore.updateCompany(updateData);

  dbStore.recordAudit({
    entity: 'COMPANY',
    action: 'UPDATE',
    entityId: updated.id,
    entityName: updated.name,
    description: `Actualizó configuración corporativa (Margen mínimo: ${updated.minMarginPct}%, Piso duro: ${updated.hardMinMarginPct ?? 'N/A'}%, UF: $ ${updated.ufRate ?? 'N/A'}).`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.json(updated);
});

/**
 * POST /api/v1/company/uf-rate (P3.m)
 * Actualiza el valor de la UF para el día.
 */
companyRouter.post('/company/uf-rate', authenticateStaff, requireAdmin, (req: Request, res: Response) => {
  const parsed = ufRateUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Valor UF no válido');
  }

  const updated = dbStore.updateCompany({
    ufRate: parsed.data.ufRate,
    ufRateUpdatedAt: new Date().toISOString(),
  });

  dbStore.recordAudit({
    entity: 'COMPANY',
    action: 'UPDATE',
    entityId: updated.id,
    entityName: updated.name,
    description: `Actualizó valor de la UF del día a $ ${parsed.data.ufRate.toLocaleString('es-CL')} CLP.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.json({
    ufRate: updated.ufRate,
    ufRateUpdatedAt: updated.ufRateUpdatedAt,
  });
});

// ==========================================
// USUARIOS DEL EQUIPO (SOLO ADMIN)
// ==========================================
companyRouter.get('/users', authenticateStaff, (req: Request, res: Response) => {
  const { role } = req.query;
  let users = dbStore.getState().users.filter((u) => !u.deletedAt);

  if (role) {
    users = users.filter((u) => u.role === role);
  }

  // Sanitizar hashes de la respuesta
  const sanitized = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    active: u.active,
  }));

  res.json(sanitized);
});

companyRouter.post('/users', authenticateStaff, requireAdmin, (req: Request, res: Response) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos incompletos', parsed.error.issues[0]?.message || 'Datos de usuario inválidos');
  }

  const { name, email, role, phone, password } = parsed.data;
  const state = dbStore.getState();
  const normalizedEmail = email.toLowerCase().trim();

  const existing = state.users.find((u) => u.email.toLowerCase() === normalizedEmail && !u.deletedAt);
  if (existing) {
    return sendProblem(res, 409, 'Email duplicado', `Ya existe un usuario con el email ${email}`);
  }

  const { hash, salt } = hashPassword(password || 'admin123');

  const newUser = {
    id: `usr-${crypto.randomUUID()}`,
    name,
    email: normalizedEmail,
    role,
    phone,
    active: true,
    passwordHash: hash,
    passwordSalt: salt,
  };

  state.users.push(newUser);

  dbStore.recordAudit({
    entity: 'USERS',
    action: 'CREATE',
    entityId: newUser.id,
    entityName: newUser.name,
    description: `Añadió usuario ${newUser.name} (${newUser.email}) con rol ${newUser.role}.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.status(201).json({
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    phone: newUser.phone,
    active: newUser.active,
  });
});

companyRouter.patch('/users/:id', authenticateStaff, requireAdmin, (req: Request, res: Response) => {
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Campos no permitidos');
  }

  const state = dbStore.getState();
  const idx = state.users.findIndex((u) => u.id === req.params.id && !u.deletedAt);
  if (idx === -1) return sendProblem(res, 404, 'Usuario no encontrado', 'El usuario no existe.');

  state.users[idx] = { ...state.users[idx], ...parsed.data };

  dbStore.recordAudit({
    entity: 'USERS',
    action: 'UPDATE',
    entityId: state.users[idx].id,
    entityName: state.users[idx].name,
    description: `Modificó datos de ${state.users[idx].name}.`,
    actorId: req.user?.id || '',
    actorName: req.user?.name || '',
    actorRole: req.user?.role || 'ADMIN',
  });

  res.json({
    id: state.users[idx].id,
    name: state.users[idx].name,
    email: state.users[idx].email,
    role: state.users[idx].role,
    phone: state.users[idx].phone,
    active: state.users[idx].active,
  });
});

companyRouter.delete('/users/:id', authenticateStaff, requireAdmin, (req: Request, res: Response) => {
  const state = dbStore.getState();
  const idx = state.users.findIndex((u) => u.id === req.params.id && !u.deletedAt);
  if (idx === -1) return sendProblem(res, 404, 'Usuario no encontrado', 'El usuario no existe.');

  const user = state.users[idx];
  user.deletedAt = new Date().toISOString();
  user.active = false;

  res.status(204).send();
});
