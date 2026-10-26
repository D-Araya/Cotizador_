import { Request, Response, NextFunction } from 'express';
import { verifyStaffToken, hashMagicToken } from '../auth.js';
import { sendProblem } from '../security.js';
import { dbStore } from '../../modules/db/store.js';

/**
 * Middleware de autenticación de personal interno (ADMIN / SALES_REP).
 * Extrae y valida el token Bearer firmado con HMAC-SHA256.
 */
export function authenticateStaff(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = verifyStaffToken(token);
    if (!payload) {
      return sendProblem(res, 401, 'Unauthorized', 'Token de sesión inválido o expirado.');
    }

    // Verificar que el usuario exista y esté activo en la base de datos
    const user = dbStore.getState().users.find((u) => u.id === payload.userId && u.active);
    if (!user) {
      return sendProblem(res, 401, 'Unauthorized', 'El usuario no existe o se encuentra inactivo.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as 'ADMIN' | 'SALES_REP',
      name: user.name,
    };

    return next();
  }

  // Soporte para headers de prueba o simulación (x-user-id / x-user-role / x-user-name)
  const headerUserId = req.headers['x-user-id'] as string;
  const headerRole = req.headers['x-user-role'] as 'ADMIN' | 'SALES_REP';
  const headerName = req.headers['x-user-name'] as string;

  if (headerUserId || headerRole) {
    const user = headerUserId ? dbStore.getState().users.find((u) => u.id === headerUserId) : undefined;
    req.user = {
      id: user?.id || headerUserId || 'usr-admin-01',
      email: user?.email || 'admin@mlingenieria.cl',
      role: headerRole || (user?.role as 'ADMIN' | 'SALES_REP') || 'ADMIN',
      name: headerName || user?.name || 'Administrador',
    };
    return next();
  }

  return sendProblem(res, 401, 'Unauthorized', 'Se requiere autenticación mediante Bearer token.');
}

/**
 * Exige roles específicos al personal autenticado (Deny-by-default).
 */
export function requireRole(...allowedRoles: Array<'ADMIN' | 'SALES_REP'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendProblem(res, 401, 'Unauthorized', 'Se requiere autenticación.');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendProblem(
        res,
        403,
        'Forbidden',
        `Acceso denegado: el rol '${req.user.role}' no tiene autorización para este recurso.`
      );
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireStaff = requireRole('ADMIN', 'SALES_REP');

/**
 * Middleware de autenticación para contactos de clientes en el portal mediante Enlace Mágico.
 * El cliente envía 'Authorization: Bearer <magicToken>' o token en header.
 */
export function authenticateClient(req: Request, res: Response, next: NextFunction) {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof req.headers['x-magic-token'] === 'string') {
    token = req.headers['x-magic-token'];
  } else if (typeof req.query.magicToken === 'string') {
    token = req.query.magicToken;
  }

  if (!token) {
    return sendProblem(res, 401, 'Unauthorized', 'Se requiere un enlace mágico o sesión válida para ingresar al portal.');
  }

  const state = dbStore.getState();

  // 1. Intentar validar como token HMAC de sesión emitido por login o switch-user
  const staffPayload = verifyStaffToken(token);
  if (staffPayload) {
    const user = state.users.find((u) => u.id === staffPayload.userId && u.active && !u.deletedAt);
    if (user && user.role === 'CUSTOMER_CONTACT') {
      const contact = user.contactId ? state.contacts.find((c) => c.id === user.contactId) : undefined;
      const customer = user.customerId ? state.customers.find((c) => c.id === user.customerId && c.active) : undefined;
      if (customer) {
        req.clientUser = {
          contactId: contact?.id || user.contactId || `cont-${user.id}`,
          customerId: customer.id,
          email: user.email,
          name: user.name,
          role: 'CLIENT',
        };
        return next();
      }
    }
  }

  // 2. Intentar validar como token de enlace mágico (hash SHA-256 de 32 bytes)
  const tokenHash = hashMagicToken(token);
  const contact = state.contacts.find((c) => c.portalTokenHash === tokenHash && !c.deletedAt);
  if (contact && !contact.portalTokenRevoked && contact.active) {
    if (contact.portalTokenExpiresAt && new Date(contact.portalTokenExpiresAt).getTime() < Date.now()) {
      return sendProblem(res, 401, 'Unauthorized', 'El enlace de acceso ha expirado. Solicite un nuevo enlace a su asesor comercial.');
    }

    const customer = state.customers.find((c) => c.id === contact.customerId && c.active);
    if (!customer) {
      return sendProblem(res, 403, 'Forbidden', 'La empresa asociada se encuentra inactiva o no existe.');
    }

    req.clientUser = {
      contactId: contact.id,
      customerId: customer.id,
      email: contact.email,
      name: contact.name,
      role: 'CLIENT',
    };
    return next();
  }

  return sendProblem(res, 401, 'Unauthorized', 'Enlace de acceso revocado o credenciales de cliente no válidas.');
}
