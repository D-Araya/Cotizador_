import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

// Extend Express Request type to include id, user and clientUser
declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: {
        id: string;
        email: string;
        role: 'ADMIN' | 'SALES_REP';
        name: string;
      };
      clientUser?: {
        contactId: string;
        customerId: string;
        email: string;
        name: string;
        role: 'CLIENT';
      };
    }
  }
}

/**
 * Middleware para asignar id único de petición y header X-Request-Id
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

/**
 * Limitador de tasa para rutas de autenticación
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 intentos
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    type: 'https://tools.ietf.org/html/rfc7807',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Demasiados intentos de autenticación. Por favor intente más tarde.',
  },
});

/**
 * Limitador de tasa para vistas públicas de cotizaciones
 */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // 60 peticiones
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    type: 'https://tools.ietf.org/html/rfc7807',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Límite de solicitudes excedido en enlaces públicos. Intente en unos segundos.',
  },
});

/**
 * Limitador de tasa para endpoints de Gemini AI
 */
export const geminiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 consultas
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    type: 'https://tools.ietf.org/html/rfc7807',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Ha alcanzado el límite de consultas al asesor de IA. Intente en breve.',
  },
});

/**
 * Neutraliza fórmulas en celdas de CSV para evitar inyección (CSV Formula Injection)
 * Prefija cualquier valor que empiece por '=', '+', '-', '@' con un apóstrofe (')
 */
export function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  // Escapar comillas dobles si contiene coma, comilla o salto de línea
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Detecta y neutraliza intentos de polución de prototipos (__proto__, constructor, prototype)
 */
export function sanitizeObjectKeys<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectKeys) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    clean[key] = typeof val === 'object' && val !== null ? sanitizeObjectKeys(val) : val;
  }
  return clean as T;
}

/**
 * Envía una respuesta estandarizada según RFC 7807 Problem Details
 */
export function sendProblem(
  res: Response,
  status: number,
  title: string,
  detail: string,
  extra: Record<string, any> = {}
) {
  return res.status(status).contentType('application/problem+json').json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title,
    status,
    detail,
    ...extra,
  });
}

/**
 * Manejador global de errores en formato application/problem+json sin trazas
 */
export function globalErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = typeof err.status === 'number' ? err.status : 500;
  const title = err.name || (status >= 500 ? 'Internal Server Error' : 'Bad Request');
  const detail = status >= 500 ? 'Ha ocurrido un error interno en el servidor.' : (err.message || 'Error en la petición');

  res.status(status).contentType('application/problem+json').json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title,
    status,
    detail,
    instance: req.originalUrl,
    requestId: req.id,
  });
}
