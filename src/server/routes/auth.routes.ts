import express, { Request, Response } from 'express';
import { dbStore } from '../../modules/db/store.js';
import { hashPassword, verifyPassword, createStaffToken, hashMagicToken } from '../auth.js';
import { loginSchema, magicLoginSchema, switchUserSchema } from '../schemas.js';
import { authLimiter, sendProblem } from '../security.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { getPermissionsForRole } from '../../shared-kernel/permissions.js';

export const authRouter = express.Router();

/**
 * POST /api/v1/auth/login
 * Autenticación para personal interno (ADMIN / SALES_REP) con hash scrypt y token HMAC.
 */
authRouter.post('/login', authLimiter, (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', parsed.error.issues[0]?.message || 'Email y contraseña requeridos');
  }

  const { email, password } = parsed.data;
  const state = dbStore.getState();
  const normalizedEmail = email.toLowerCase().trim();

  // Buscar usuario en staff
  const user = state.users.find(
    (u) => u.email.toLowerCase() === normalizedEmail && !u.deletedAt
  );

  if (!user || !user.active) {
    return sendProblem(res, 401, 'Credenciales inválidas', 'Usuario o contraseña no válidos.');
  }

  // Verificar si es el primer ADMIN configurado por secreto ADMIN_EMAIL
  if (process.env.ADMIN_EMAIL && normalizedEmail === process.env.ADMIN_EMAIL.toLowerCase().trim()) {
    user.role = 'ADMIN';
  }

  // Validar hash scrypt seguro de la contraseña
  if (user.passwordHash && user.passwordSalt) {
    const valid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!valid) {
      return sendProblem(res, 401, 'Credenciales inválidas', 'Usuario o contraseña no válidos.');
    }
  } else {
    // Si la cuenta no tiene credenciales configuradas (ej. contacto solo de portal), rechazar acceso por login estándar
    return sendProblem(res, 401, 'Credenciales inválidas', 'Usuario o contraseña no válidos.');
  }

  // Generar token HMAC
  const token = createStaffToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const redirectTo = user.role === 'CUSTOMER_CONTACT' ? '/portal/dashboard' : '/app/dashboard';

  const permissions = getPermissionsForRole(user.role);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      customerId: user.customerId,
      contactId: user.contactId,
      permissions,
    },
    token,
    role: user.role,
    permissions,
    redirectTo,
  });
});

/**
 * POST /api/v1/auth/magic-login
 * Autenticación para contactos de clientes mediante Enlace Mágico.
 */
authRouter.post('/magic-login', authLimiter, (req: Request, res: Response) => {
  const parsed = magicLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Datos inválidos', 'Token de enlace mágico inválido.');
  }

  const { token } = parsed.data;
  const tokenHash = hashMagicToken(token);
  const state = dbStore.getState();

  const contact = state.contacts.find((c) => c.portalTokenHash === tokenHash && !c.deletedAt);
  if (!contact || contact.portalTokenRevoked || !contact.active) {
    return sendProblem(res, 401, 'Enlace no válido', 'El enlace mágico ha sido revocado o no es válido.');
  }

  if (contact.portalTokenExpiresAt && new Date(contact.portalTokenExpiresAt).getTime() < Date.now()) {
    return sendProblem(res, 401, 'Enlace expirado', 'El enlace mágico ha expirado.');
  }

  const customer = state.customers.find((c) => c.id === contact.customerId && c.active);
  if (!customer) {
    return sendProblem(res, 403, 'Empresa inactiva', 'La empresa del cliente no se encuentra activa.');
  }

  res.json({
    user: {
      id: `usr-${contact.id}`,
      contactId: contact.id,
      customerId: customer.id,
      email: contact.email,
      name: contact.name,
      role: 'CUSTOMER_CONTACT',
      phone: contact.phone,
    },
    token, // El token mágico en crudo es el Bearer token del portal
    role: 'CUSTOMER_CONTACT',
    redirectTo: '/portal/dashboard',
  });
});

/**
 * POST /api/v1/auth/switch-user
 * Solo permitido en desarrollo (NODE_ENV !== 'production') y exigiendo un ADMIN autenticado.
 */
authRouter.post('/switch-user', authLimiter, (req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'production') {
    return sendProblem(res, 403, 'No disponible', 'El cambio de usuario está deshabilitado en producción.');
  }
  next();
}, (req: Request, res: Response) => {
  const parsed = switchUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendProblem(res, 400, 'Email requerido', 'Debe suministrar un email válido.');
  }

  const { email } = parsed.data;
  const state = dbStore.getState();
  const targetUser = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim() && !u.deletedAt);

  if (!targetUser) {
    return sendProblem(res, 404, 'Usuario no encontrado', 'El usuario solicitado no existe.');
  }

  if (!targetUser.active) {
    targetUser.active = true;
  }

  const token = createStaffToken({
    id: targetUser.id,
    email: targetUser.email,
    role: targetUser.role,
    name: targetUser.name,
  });

  const permissions = getPermissionsForRole(targetUser.role);
  const redirectTo = targetUser.role === 'CUSTOMER_CONTACT' ? '/portal/dashboard' : '/app/dashboard';

  res.json({
    user: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      phone: targetUser.phone,
      customerId: targetUser.customerId,
      contactId: targetUser.contactId,
      permissions,
    },
    token,
    role: targetUser.role,
    permissions,
    redirectTo,
  });
});

/**
 * GET /api/v1/auth/me
 * Devuelve el usuario actualmente autenticado por su token Bearer con permisos derivados.
 */
authRouter.get('/me', authenticateStaff, (req: Request, res: Response) => {
  const state = dbStore.getState();
  const user = state.users.find((u) => u.id === req.user?.id);
  if (!user) {
    return sendProblem(res, 404, 'Usuario no encontrado', 'Usuario no registrado.');
  }

  const permissions = getPermissionsForRole(user.role);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      permissions,
    },
    role: user.role,
    permissions,
    expiresInMinutes: state.company.sessionTimeoutMinutes,
  });
});

/**
 * POST /api/v1/auth/logout
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Sesión cerrada con éxito' });
});
