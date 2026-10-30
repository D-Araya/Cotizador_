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

export const AUTH_USER_CHANGED_EVENT = 'cotizador_auth_user_changed';
const inMemoryAuthListeners = new Set<(user: ApiUser | null) => void>();

function emitAuthUserChanged(user: ApiUser | null) {
  inMemoryAuthListeners.forEach((cb) => {
    try {
      cb(user);
    } catch {
      // ignore listener errors
    }
  });
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(AUTH_USER_CHANGED_EVENT, { detail: { user } }));
  }
}

export function subscribeToAuthUserChange(callback: (user: ApiUser | null) => void): () => void {
  inMemoryAuthListeners.add(callback);
  return () => {
    inMemoryAuthListeners.delete(callback);
  };
}

// Initialize token and user from storage with per-tab sessionStorage priority and safe schema validation
try {
  if (typeof window !== 'undefined') {
    const sessionToken = window.sessionStorage?.getItem('cotizador_token');
    const localToken = window.localStorage?.getItem('cotizador_token');
    const rawToken = sessionToken || localToken;
    authToken = typeof rawToken === 'string' && rawToken.trim().length > 0 ? rawToken.trim() : null;
    if (authToken && !sessionToken) {
      window.sessionStorage?.setItem('cotizador_token', authToken);
    }

    const sessionUser = window.sessionStorage?.getItem('cotizador_user');
    const localUser = window.localStorage?.getItem('cotizador_user');
    const storedUser = sessionUser || localUser;
    if (storedUser) {
      const validatedUser = parseSafeApiUser(storedUser);
      if (validatedUser) {
        activeApiUser = validatedUser;
        if (!sessionUser) {
          window.sessionStorage?.setItem('cotizador_user', JSON.stringify(validatedUser));
        }
      } else {
        // Purge corrupted or tampered state automatically
        window.sessionStorage?.removeItem('cotizador_user');
        window.localStorage?.removeItem('cotizador_user');
        window.sessionStorage?.removeItem('cotizador_token');
        window.localStorage?.removeItem('cotizador_token');
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
        // Primary per-tab isolation in sessionStorage
        window.sessionStorage?.setItem('cotizador_token', authToken);
        window.localStorage?.setItem('cotizador_token', authToken);
      } else {
        window.sessionStorage?.removeItem('cotizador_token');
        window.localStorage?.removeItem('cotizador_token');
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function getAuthToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const sessionTok = window.sessionStorage?.getItem('cotizador_token');
      if (typeof sessionTok === 'string' && sessionTok.trim().length > 0) {
        authToken = sessionTok.trim();
        return authToken;
      }
    }
  } catch {
    // Fallback to in-memory
  }
  return authToken;
}

export function setActiveApiUser(user: ApiUser | null) {
  const safeUser = user ? parseSafeApiUser(user) : null;
  const prevId = activeApiUser?.id;
  const prevRole = activeApiUser?.role;
  activeApiUser = safeUser;
  try {
    if (typeof window !== 'undefined') {
      if (safeUser) {
        const str = JSON.stringify(safeUser);
        // Primary per-tab isolation in sessionStorage
        window.sessionStorage?.setItem('cotizador_user', str);
        window.localStorage?.setItem('cotizador_user', str);
      } else {
        window.sessionStorage?.removeItem('cotizador_user');
        window.localStorage?.removeItem('cotizador_user');
      }
    }
  } catch {
    // Ignore storage errors
  }
  if (prevId !== safeUser?.id || prevRole !== safeUser?.role) {
    emitAuthUserChanged(safeUser);
  }
}

export function getActiveApiUser(): ApiUser | null {
  try {
    if (typeof window !== 'undefined') {
      const sessionRaw = window.sessionStorage?.getItem('cotizador_user');
      if (sessionRaw) {
        const parsed = parseSafeApiUser(sessionRaw);
        if (parsed) {
          activeApiUser = parsed;
          return activeApiUser;
        }
      }
    }
  } catch {
    // Fallback to in-memory
  }
  return activeApiUser;
}

export function clearClientSession() {
  const hadSession = Boolean(activeApiUser || authToken);
  authToken = null;
  activeApiUser = null;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem('cotizador_token');
      window.sessionStorage?.removeItem('cotizador_user');
      window.localStorage?.removeItem('cotizador_token');
      window.localStorage?.removeItem('cotizador_user');
    }
  } catch {
    // Ignore
  }
  if (hadSession) {
    emitAuthUserChanged(null);
  }
}

import { formatMoney } from '../shared-kernel/formatMoney.ts';
export { formatMoney };

export function formatCurrency(amount: number, currency: string = 'CLP'): string {
  return formatMoney(amount, currency);
}

export type SyncDomain =
  | 'quotations'
  | 'invoices'
  | 'operations'
  | 'catalog'
  | 'customers'
  | 'company'
  | 'users'
  | 'audit'
  | 'outbox'
  | 'portal'
  | 'dashboard'
  | 'all';

export interface SyncEventPayload {
  domain: SyncDomain;
  action?: string;
  entityId?: string;
  timestamp: number;
  eventId: string;
}

export const SYNC_EVENT_NAME = 'cotizador_quotations_sync';
const inMemorySyncListeners = new Set<(payload: SyncEventPayload) => void>();
export const DOMAIN_SYNC_CHANNEL_NAME = 'cotizador_domain_sync_channel';

let broadcastChannelInstance: BroadcastChannel | null = null;

function getSyncBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!broadcastChannelInstance) {
    try {
      broadcastChannelInstance = new BroadcastChannel(DOMAIN_SYNC_CHANNEL_NAME);
    } catch {
      broadcastChannelInstance = null;
    }
  }
  return broadcastChannelInstance;
}

function inferDomainFromEndpoint(endpoint: string): SyncDomain | null {
  if (!endpoint.startsWith('/api/v1/')) return null;
  if (endpoint.startsWith('/api/v1/auth/') || endpoint.startsWith('/api/v1/gemini/')) {
    return null;
  }
  if (
    endpoint.startsWith('/api/v1/quotations') ||
    endpoint.startsWith('/api/v1/public/quotations') ||
    endpoint.startsWith('/api/v1/portal/quotations')
  ) {
    return 'quotations';
  }
  if (endpoint.startsWith('/api/v1/invoices')) return 'invoices';
  if (endpoint.startsWith('/api/v1/operations')) return 'operations';
  if (endpoint.startsWith('/api/v1/catalog-items') || endpoint.startsWith('/api/v1/categories') || endpoint.startsWith('/api/v1/templates')) {
    return 'catalog';
  }
  if (endpoint.startsWith('/api/v1/customers') || endpoint.startsWith('/api/v1/contacts')) {
    return 'customers';
  }
  if (endpoint.startsWith('/api/v1/company')) return 'company';
  if (endpoint.startsWith('/api/v1/users')) return 'users';
  if (endpoint.startsWith('/api/v1/notifications')) return 'outbox';
  if (endpoint.startsWith('/api/v1/system/restore')) return 'all';
  return 'all';
}

function doesDomainMatch(emitted: SyncDomain, subscribed: ReadonlySet<SyncDomain>): boolean {
  if (emitted === 'all' || subscribed.has('all') || subscribed.has(emitted)) {
    return true;
  }
  // Cross-domain reactive dependencies:
  // A quotation mutation impacts dashboard, invoices (on accept), operations (on accept), portal, audit, and outbox
  if (emitted === 'quotations') {
    return (
      subscribed.has('dashboard') ||
      subscribed.has('invoices') ||
      subscribed.has('operations') ||
      subscribed.has('portal') ||
      subscribed.has('audit') ||
      subscribed.has('outbox')
    );
  }
  if (emitted === 'invoices' || emitted === 'operations') {
    return subscribed.has('dashboard') || subscribed.has('portal') || subscribed.has('audit');
  }
  if (emitted === 'company') {
    return subscribed.has('dashboard') || subscribed.has('quotations') || subscribed.has('portal') || subscribed.has('audit');
  }
  if (emitted === 'customers' || emitted === 'catalog' || emitted === 'users') {
    return subscribed.has('dashboard') || subscribed.has('audit') || subscribed.has('outbox');
  }
  return false;
}

export function notifyDomainSync(domain: SyncDomain = 'all', actionOrEntityId?: string) {
  const timestamp = Date.now();
  const eventId = `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
  const payload: SyncEventPayload = {
    domain,
    action: actionOrEntityId,
    entityId: actionOrEntityId,
    timestamp,
    eventId,
  };

  inMemorySyncListeners.forEach((cb) => {
    try {
      cb(payload);
    } catch {
      // ignore listener errors
    }
  });

  if (typeof window === 'undefined') return;

  // 1. Same-tab CustomEvent
  if (typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail: payload }));
  }

  // 2. Cross-tab BroadcastChannel
  const channel = getSyncBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage(payload);
    } catch {
      // ignore
    }
  }

  // 3. Cross-tab localStorage fallback
  try {
    window.localStorage?.setItem('cotizador_sync_event', JSON.stringify(payload));
    window.localStorage?.setItem('cotizador_sync_timestamp', timestamp.toString());
  } catch {
    // ignore
  }
}

export function notifyQuotationSync(entityId?: string) {
  notifyDomainSync('quotations', entityId);
}

export function subscribeToDomainSync(
  domains: SyncDomain[] | 'all',
  callback: (payload: SyncEventPayload) => void
): () => void {
  const domainSet: ReadonlySet<SyncDomain> =
    domains === 'all' ? new Set<SyncDomain>(['all']) : new Set<SyncDomain>(domains);

  let lastProcessedEventId = '';
  let lastTriggerTime = 0;

  const triggerIfRelevant = (rawPayload?: Partial<SyncEventPayload>) => {
    const payload: SyncEventPayload = {
      domain: rawPayload?.domain || 'all',
      action: rawPayload?.action,
      entityId: rawPayload?.entityId,
      timestamp: rawPayload?.timestamp || Date.now(),
      eventId: rawPayload?.eventId || `${Date.now()}`,
    };

    if (payload.eventId && payload.eventId === lastProcessedEventId) {
      return;
    }
    if (!doesDomainMatch(payload.domain, domainSet)) {
      return;
    }
    const now = Date.now();
    if (now - lastTriggerTime < 40 && lastProcessedEventId !== '') {
      lastProcessedEventId = payload.eventId;
      return;
    }
    lastProcessedEventId = payload.eventId;
    lastTriggerTime = now;
    callback(payload);
  };

  inMemorySyncListeners.add(triggerIfRelevant);

  if (typeof window === 'undefined') {
    return () => {
      inMemorySyncListeners.delete(triggerIfRelevant);
    };
  }

  const handleCustomEvent = (e: Event) => {
    const ce = e as CustomEvent<SyncEventPayload>;
    triggerIfRelevant(ce.detail);
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === 'cotizador_sync_event' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as SyncEventPayload;
        triggerIfRelevant(parsed);
      } catch {
        triggerIfRelevant({ domain: 'all' });
      }
    } else if (e.key === 'cotizador_sync_timestamp') {
      triggerIfRelevant({ domain: 'quotations' });
    }
  };

  const handleBroadcastMessage = (e: MessageEvent) => {
    if (e.data && typeof e.data === 'object') {
      triggerIfRelevant(e.data as SyncEventPayload);
    }
  };

  const channel = getSyncBroadcastChannel();
  window.addEventListener(SYNC_EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);
  if (channel) {
    channel.addEventListener('message', handleBroadcastMessage);
  }

  return () => {
    inMemorySyncListeners.delete(triggerIfRelevant);
    window.removeEventListener(SYNC_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (channel) {
      channel.removeEventListener('message', handleBroadcastMessage);
    }
  };
}

export function subscribeToQuotationSync(callback: () => void): () => void {
  return subscribeToDomainSync(['quotations'], () => callback());
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  const maxRetries = options.retries !== undefined ? options.retries : (isRead ? 2 : 0);
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
      const currentToken = getAuthToken();
      const authHeaders: Record<string, string> = {};
      if (currentToken) {
        authHeaders['Authorization'] = `Bearer ${currentToken}`;
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

      // Automatically broadcast domain synchronization on successful mutations
      if (!isRead) {
        const domain = inferDomainFromEndpoint(endpoint);
        if (domain) {
          notifyDomainSync(domain, `${method}:${endpoint}`);
        }
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

