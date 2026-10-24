import { describe, it, expect } from 'vitest';
import { ok, err, DomainError } from '../../src/shared-kernel/Result.ts';

describe('Result & DomainError Unit Tests', () => {
  it('ok crea un resultado exitoso', () => {
    const res = ok({ id: 1, name: 'Cotización' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.value).toEqual({ id: 1, name: 'Cotización' });
    }
  });

  it('err crea un resultado de error', () => {
    const error = new Error('Fallo de validación');
    const res = err(error);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe(error);
    }
  });

  it('DomainError crea un error con código y detalles enriquecidos', () => {
    const domErr = new DomainError('MARGIN_INSUFFICIENT', 'Margen por debajo del mínimo', {
      required: 25,
      actual: 21.5,
    });

    expect(domErr).toBeInstanceOf(Error);
    expect(domErr.name).toBe('DomainError');
    expect(domErr.code).toBe('MARGIN_INSUFFICIENT');
    expect(domErr.message).toBe('Margen por debajo del mínimo');
    expect(domErr.details).toEqual({ required: 25, actual: 21.5 });
  });

  it('DomainError funciona sin detalles opcionales', () => {
    const domErr = new DomainError('NOT_FOUND', 'Entidad no encontrada');
    expect(domErr.code).toBe('NOT_FOUND');
    expect(domErr.details).toBeUndefined();
  });
});
