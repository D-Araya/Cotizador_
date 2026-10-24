import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest } from '../../src/ui/api.ts';

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

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-admin-01',
      },
    });
  });
});
