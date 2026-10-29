export interface ApiUser {
  id: string;
  role: string;
  name: string;
  email?: string;
  customerId?: string;
  phone?: string;
  permissions?: string[];
}

export interface ProblemDetails {
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ProblemDetails | { detail: string; [key: string]: unknown };
  status: number;
}

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

import { ROLE_PERMISSIONS } from '../shared-kernel/permissions.ts';
import { UserRole } from '../modules/types.ts';

const VALID_USER_ROLES: ReadonlySet<string> = new Set(['ADMIN', 'SALES_REP', 'CUSTOMER_CONTACT']);

/**
 * Valida en tiempo de ejecución la estructura del usuario almacenado en Web Storage.
 * Previene pantallas blancas por JSON corrupto y neutraliza escalación de privilegios
 * recalculando los permisos exclusivamente desde la matriz canónica del rol.
 */
export function parseSafeApiUser(raw: unknown): ApiUser | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      candidate.id.trim().length === 0 ||
      typeof candidate.name !== 'string' ||
      candidate.name.trim().length === 0 ||
      typeof candidate.role !== 'string' ||
      !VALID_USER_ROLES.has(candidate.role)
    ) {
      return null;
    }

    const validRole = candidate.role as UserRole;
    const canonicalPermissions = ROLE_PERMISSIONS[validRole] ? [...ROLE_PERMISSIONS[validRole]] : [];

    return {
      id: candidate.id.trim(),
      role: validRole,
      name: candidate.name.trim(),
      email: typeof candidate.email === 'string' ? candidate.email.trim() : undefined,
      customerId: typeof candidate.customerId === 'string' ? candidate.customerId.trim() : undefined,
      phone: typeof candidate.phone === 'string' ? candidate.phone.trim() : undefined,
      permissions: canonicalPermissions,
    };
  } catch {
    return null;
  }
}

/**
 * Sanitiza URLs dinámicas para prevenir vectores XSS basados en esquemas javascript:, vbscript: o data:text/html.
 */
export function sanitizeSafeUrl(rawUrl: string | undefined | null, allowSafeDataUrl = true): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '#';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '#';

  // Permitir rutas relativas internas seguras
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Validar data: URLs permitidas (no ejecutables) cuando aplique a adjuntos
  if (allowSafeDataUrl && /^data:/i.test(trimmed)) {
    const safeDataPattern = /^data:(application\/pdf|image\/(png|jpeg|jpg|webp|gif)|text\/(plain|csv)|application\/(msword|vnd\.openxmlformats-officedocument\.[a-z0-9.]+|vnd\.ms-[a-z0-9.]+|octet-stream));base64,[a-zA-Z0-9+/=]+$/i;
    return safeDataPattern.test(trimmed) ? trimmed : '#';
  }

  if (allowSafeDataUrl && /^blob:/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '#';
  } catch {
    return '#';
  }
}

/**
 * Escapa caracteres HTML especiales para prevenir inyección DOM/XSS en plantillas de impresión.
 */
export function escapeHtml(unsafe: string | undefined | null): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let activeApiUser: ApiUser | null = null;
let authToken: string | null = null;

// Initialize token and user from storage with safe schema validation and fallback
try {
  if (typeof window !== 'undefined') {
    const rawToken = window.localStorage?.getItem('cotizador_token') || window.sessionStorage?.getItem('cotizador_token');
    authToken = typeof rawToken === 'string' && rawToken.trim().length > 0 ? rawToken.trim() : null;

    const storedUser = window.localStorage?.getItem('cotizador_user') || window.sessionStorage?.getItem('cotizador_user');
    if (storedUser) {
      const validatedUser = parseSafeApiUser(storedUser);
      if (validatedUser) {
        activeApiUser = validatedUser;
      } else {
        // Purge corrupted or tampered state automatically
        window.localStorage?.removeItem('cotizador_user');
        window.sessionStorage?.removeItem('cotizador_user');
        window.localStorage?.removeItem('cotizador_token');
        window.sessionStorage?.removeItem('cotizador_token');
        authToken = null;
      }
    }
  }
} catch {
  // Ignore storage errors in iframe/sandbox
  activeApiUser = null;
  authToken = null;
}

export function setAuthToken(token: string | null) {
  authToken = typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
  try {
    if (typeof window !== 'undefined') {
      if (authToken) {
        window.localStorage?.setItem('cotizador_token', authToken);
        window.sessionStorage?.setItem('cotizador_token', authToken);
      } else {
        window.localStorage?.removeItem('cotizador_token');
        window.sessionStorage?.removeItem('cotizador_token');
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setActiveApiUser(user: ApiUser | null) {
  const safeUser = user ? parseSafeApiUser(user) : null;
  activeApiUser = safeUser;
  try {
    if (typeof window !== 'undefined') {
      if (safeUser) {
        const str = JSON.stringify(safeUser);
        window.localStorage?.setItem('cotizador_user', str);
        window.sessionStorage?.setItem('cotizador_user', str);
      } else {
        window.localStorage?.removeItem('cotizador_user');
        window.sessionStorage?.removeItem('cotizador_user');
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function getActiveApiUser(): ApiUser | null {
  return activeApiUser;
}

export function clearClientSession() {
  authToken = null;
  activeApiUser = null;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.removeItem('cotizador_token');
      window.localStorage?.removeItem('cotizador_user');
      window.sessionStorage?.removeItem('cotizador_token');
      window.sessionStorage?.removeItem('cotizador_user');
    }
  } catch {
    // Ignore
  }
}

import { formatMoney } from '../shared-kernel/formatMoney.ts';
export { formatMoney };

export function formatCurrency(amount: number, currency: string = 'CLP'): string {
  return formatMoney(amount, currency);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  const maxRetries = options.retries !== undefined ? options.retries : (isRead ? 2 : 0);
  const timeoutMs = options.timeoutMs ?? 15000;
  const retryDelay = options.retryDelayMs ?? 250;

  let attempt = 0;
  while (true) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let signalToUse: AbortSignal | undefined = options.signal ?? undefined;

    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      const controller = new AbortController();
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }
      timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
      signalToUse = controller.signal;
    }

    try {
      const authHeaders: Record<string, string> = {};
      if (authToken) {
        authHeaders['Authorization'] = `Bearer ${authToken}`;
      }

      const fetchOptions: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...(options.headers || {}),
        },
      };

      if (signalToUse) {
        fetchOptions.signal = signalToUse;
      }

      const res = await fetch(endpoint, fetchOptions);
      if (timeoutId) clearTimeout(timeoutId);

      const status = res.status;
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        // If it's a read operation and server gave 502/503/504, we can retry
        if (isRead && (status === 502 || status === 503 || status === 504) && attempt < maxRetries) {
          attempt++;
          await sleep(retryDelay * attempt);
          continue;
        }

        return { error: data || { detail: 'Error en la petición' }, status };
      }

      return { data, status };
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);

      // Only retry on network errors if it's a read operation (GET / HEAD)
      if (isRead && attempt < maxRetries) {
        attempt++;
        await sleep(retryDelay * attempt);
        continue;
      }

      const isAbort = err?.name === 'AbortError';
      const detail = isAbort
        ? 'Tiempo de espera agotado al comunicar con el servidor'
        : (err?.message || 'Error de conexión con el servidor');

      return {
        error: { detail },
        status: isAbort ? 408 : 500,
      };
    }
  }
}

// Strongly typed REST client helpers
export const api = {
  get: <T>(url: string, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(url: string, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),
};

export const SYNC_EVENT_NAME = 'cotizador_quotations_sync';

export function notifyQuotationSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail: { timestamp: Date.now() } }));
    try {
      window.localStorage?.setItem('cotizador_sync_timestamp', Date.now().toString());
    } catch {
      // ignore
    }
  }
}

export function subscribeToQuotationSync(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = () => callback();
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === 'cotizador_sync_timestamp') {
      callback();
    }
  };

  window.addEventListener(SYNC_EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}
