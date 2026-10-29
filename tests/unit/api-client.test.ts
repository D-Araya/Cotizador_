import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiRequest, parseSafeApiUser, sanitizeSafeUrl, escapeHtml } from '../../src/ui/api.ts';

describe('apiRequest Client Helper Tests', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('procesa respuestas exitosas 200 con payload JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'quot-1', grandTotal: 1500 }),
    } as any);

    const res = await apiRequest('/api/v1/quotations/quot-1');
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: 'quot-1', grandTotal: 1500 });
    expect(res.error).toBeUndefined();
  });

  it('procesa respuestas exitosas 204 No Content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('No JSON');
      },
    } as any);

    const res = await apiRequest('/api/v1/customers/cust-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(res.data).toBeNull();
    expect(res.error).toBeUndefined();
  });

  it('procesa respuestas con error HTTP 400 y RFC 9457 Problem Details', async () => {
    const problemDetails = {
      title: 'Validación fallida',
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: 'El RUC es obligatorio.',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => problemDetails,
    } as any);

    const res = await apiRequest('/api/v1/customers', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(res.data).toBeUndefined();
    expect(res.error).toEqual(problemDetails);
  });

  it('captura errores de red y devuelve status 500 con mensaje de detalle', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const res = await apiRequest('/api/v1/company');
    expect(res.status).toBe(500);
    expect(res.error).toEqual({ detail: 'Failed to fetch' });
  });

  it('aplica encabezado Content-Type: application/json por defecto y permite headers adicionales', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as any);
    global.fetch = fetchMock;

    await apiRequest('/api/v1/auth/me', {
      headers: {
        'x-user-id': 'usr-admin-01',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-user-id': 'usr-admin-01',
        }),
      })
    );
  });
});

describe('Frontend Security Helpers (parseSafeApiUser, sanitizeSafeUrl, escapeHtml)', () => {
  it('parseSafeApiUser rechaza JSON corrupto, tipos primitivos o esquemas incompletos con fallback null', () => {
    expect(parseSafeApiUser('{invalid-json')).toBeNull();
    expect(parseSafeApiUser('"solo-un-string"')).toBeNull();
    expect(parseSafeApiUser('12345')).toBeNull();
    expect(parseSafeApiUser('[]')).toBeNull();
    expect(parseSafeApiUser(JSON.stringify({ id: 'u1', role: 'ADMIN' }))).toBeNull(); // Falta name
    expect(parseSafeApiUser(JSON.stringify({ id: 'u1', name: 'Test', role: 'SUPER_HACKER' }))).toBeNull(); // Rol inválido
  });

  it('parseSafeApiUser ignora permisos inyectados manualmente en localStorage y asigna los permisos canónicos del rol', () => {
    const tamperedPayload = JSON.stringify({
      id: 'usr-sales-01',
      name: 'Sebastián Morales',
      role: 'SALES_REP',
      permissions: ['users:manage', 'dashboard:global', 'quotations:read_all'],
    });

    const user = parseSafeApiUser(tamperedPayload);
    expect(user).not.toBeNull();
    expect(user?.role).toBe('SALES_REP');
    expect(user?.permissions).not.toContain('users:manage');
    expect(user?.permissions).not.toContain('dashboard:global');
    expect(user?.permissions).toContain('dashboard:own');
  });

  it('sanitizeSafeUrl bloquea esquemas peligrosos (javascript:, vbscript:, data:text/html, //evil.com)', () => {
    expect(sanitizeSafeUrl('javascript:alert(document.cookie)')).toBe('#');
    expect(sanitizeSafeUrl('  JAVASCRIPT:alert(1) ')).toBe('#');
    expect(sanitizeSafeUrl('vbscript:msgbox(1)')).toBe('#');
    expect(sanitizeSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe('#');
    expect(sanitizeSafeUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe('#');
    expect(sanitizeSafeUrl('//evil.attacker.com/phishing')).toBe('#');
    expect(sanitizeSafeUrl('https://mlingenieria.cl/informe.pdf')).toBe('https://mlingenieria.cl/informe.pdf');
    expect(sanitizeSafeUrl('data:application/pdf;base64,JVBERi0xLjQK')).toBe('data:application/pdf;base64,JVBERi0xLjQK');
  });

  it('escapeHtml neutraliza etiquetas y atributos maliciosos en plantillas HTML', () => {
    const raw = '</title><script>alert("xss")</script>';
    expect(escapeHtml(raw)).toBe('&lt;/title&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

