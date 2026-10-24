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

let activeApiUser: ApiUser | null = null;
let authToken: string | null = null;

// Initialize token and user from storage
try {
  if (typeof window !== 'undefined') {
    authToken = window.localStorage?.getItem('cotizador_token') || window.sessionStorage?.getItem('cotizador_token') || null;
    const storedUser = window.localStorage?.getItem('cotizador_user') || window.sessionStorage?.getItem('cotizador_user');
    if (storedUser) {
      activeApiUser = JSON.parse(storedUser);
    }
  }
} catch {
  // Ignore storage errors in iframe/sandbox
}

export function setAuthToken(token: string | null) {
  authToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage?.setItem('cotizador_token', token);
        window.sessionStorage?.setItem('cotizador_token', token);
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
  activeApiUser = user;
  try {
    if (typeof window !== 'undefined') {
      if (user) {
        const str = JSON.stringify(user);
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
