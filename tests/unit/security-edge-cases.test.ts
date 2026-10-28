import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeCsvValue,
  sendProblem,
  globalErrorHandler,
  requestIdMiddleware,
} from '../../src/server/security.js';

describe('Security Utilities Unit Tests (src/server/security.ts)', () => {
  describe('sanitizeCsvValue (CSV Formula Injection Protection)', () => {
    it('escapa prefijos de fórmulas peligrosas (=, +, -, @) con apóstrofe', () => {
      expect(sanitizeCsvValue('=1+2')).toBe(`'=1+2`);
      expect(sanitizeCsvValue('+1+2')).toBe(`'+1+2`);
      expect(sanitizeCsvValue('-100')).toBe(`'-100`);
      expect(sanitizeCsvValue('@SUM(A1:A10)')).toBe(`'@SUM(A1:A10)`);
    });

    it('escapa comillas y envuelve entre comillas si contiene comas o saltos de línea', () => {
      expect(sanitizeCsvValue('Ingeniería, Naval')).toBe('"Ingeniería, Naval"');
      expect(sanitizeCsvValue('Línea 1\nLínea 2')).toBe('"Línea 1\nLínea 2"');
      expect(sanitizeCsvValue('Dijo: "Hola"')).toBe('"Dijo: ""Hola"""');
    });

    it('escapa fórmulas combinadas con comas o comillas correctamente', () => {
      const sanitized = sanitizeCsvValue('=1+2, texto');
      expect(sanitized).toBe('"\'=1+2, texto"');

      const withQuotes = sanitizeCsvValue('=CMD("calc")');
      expect(withQuotes).toBe('"\'=CMD(""calc"")"');
    });

    it('retorna texto plano sin apóstrofe si no empieza con caracteres de fórmula', () => {
      expect(sanitizeCsvValue('M&L Ingeniería')).toBe('M&L Ingeniería');
      expect(sanitizeCsvValue('COT-2026-0001')).toBe('COT-2026-0001');
      expect(sanitizeCsvValue(12345)).toBe('12345');
    });

    it('devuelve cadena vacía para null y undefined', () => {
      expect(sanitizeCsvValue(null)).toBe('');
      expect(sanitizeCsvValue(undefined)).toBe('');
    });
  });

  describe('sendProblem (RFC 7807 Problem Details)', () => {
    it('emite cabecera application/problem+json y estructura canónica', () => {
      const mockJson = vi.fn();
      const mockContentType = vi.fn().mockReturnValue({ json: mockJson });
      const mockStatus = vi.fn().mockReturnValue({ contentType: mockContentType });

      const res = {
        status: mockStatus,
      } as any;

      sendProblem(res, 400, 'Datos inválidos', 'El campo RUT es obligatorio', { customField: 'extra' });

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockContentType).toHaveBeenCalledWith('application/problem+json');
      expect(mockJson).toHaveBeenCalledWith({
        type: 'https://tools.ietf.org/html/rfc7807',
        title: 'Datos inválidos',
        status: 400,
        detail: 'El campo RUT es obligatorio',
        customField: 'extra',
      });
    });
  });

  describe('globalErrorHandler', () => {
    it('oculta trazas y detalles internos para errores 500+', () => {
      const mockJson = vi.fn();
      const mockContentType = vi.fn().mockReturnValue({ json: mockJson });
      const mockStatus = vi.fn().mockReturnValue({ contentType: mockContentType });

      const res = { status: mockStatus } as any;
      const req = { originalUrl: '/api/v1/quotations', id: 'req-uuid-123' } as any;
      const err = new Error('Database connection leak at postgres://secret');

      globalErrorHandler(err, req, res, vi.fn());

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 500,
          detail: 'Ha ocurrido un error interno en el servidor.',
          instance: '/api/v1/quotations',
          requestId: 'req-uuid-123',
        })
      );
    });

    it('conserva el mensaje para errores 4xx controlados', () => {
      const mockJson = vi.fn();
      const mockContentType = vi.fn().mockReturnValue({ json: mockJson });
      const mockStatus = vi.fn().mockReturnValue({ contentType: mockContentType });

      const res = { status: mockStatus } as any;
      const req = { originalUrl: '/api/v1/quotations', id: 'req-uuid-456' } as any;
      const err = { status: 422, message: 'Margen no cumple el mínimo' };

      globalErrorHandler(err, req, res, vi.fn());

      expect(mockStatus).toHaveBeenCalledWith(422);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 422,
          detail: 'Margen no cumple el mínimo',
          instance: '/api/v1/quotations',
          requestId: 'req-uuid-456',
        })
      );
    });
  });

  describe('requestIdMiddleware', () => {
    it('asigna un X-Request-Id único y lo inyecta en req.id y cabecera de respuesta', () => {
      const req: any = { headers: {} };
      const setHeader = vi.fn();
      const res: any = { setHeader };
      const next = vi.fn();

      requestIdMiddleware(req, res, next);

      expect(req.id).toBeDefined();
      expect(typeof req.id).toBe('string');
      expect(setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
      expect(next).toHaveBeenCalled();
    });

    it('respeta el X-Request-Id enviado por el cliente si ya existe', () => {
      const req: any = { headers: { 'x-request-id': 'client-provided-trace-id' } };
      const setHeader = vi.fn();
      const res: any = { setHeader };
      const next = vi.fn();

      requestIdMiddleware(req, res, next);

      expect(req.id).toBe('client-provided-trace-id');
      expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'client-provided-trace-id');
    });
  });
});
