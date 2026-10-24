import { describe, it, expect } from 'vitest';
import { validateRut, cleanRut, calculateDv, formatRut } from '../../src/shared-kernel/rut.ts';

describe('Chilean RUT Modulo 11 Validation', () => {
  it('valida correctamente RUTs de empresas y personas en Chile', () => {
    // RUT válido calculado con módulo 11
    expect(validateRut('77.892.410-2')).toBe(true);
    expect(validateRut('77892410-2')).toBe(true);
    expect(validateRut('778924102')).toBe(true);

    // RUTs reales y válidos de prueba
    expect(validateRut('11.111.111-1')).toBe(true);
    expect(validateRut('8.888.888-K')).toBe(true);
    expect(validateRut('8888888-k')).toBe(true);
    expect(validateRut('12.345.678-5')).toBe(true);
    expect(validateRut('77.892.417-K')).toBe(true);
  });

  it('rechaza RUTs con dígito verificador erróneo o formato inválido', () => {
    expect(validateRut('77.892.410-9')).toBe(false);
    expect(validateRut('77.892.410-K')).toBe(false);
    expect(validateRut('11.111.111-2')).toBe(false);
    expect(validateRut('abc')).toBe(false);
    expect(validateRut('')).toBe(false);
    expect(validateRut(null as any)).toBe(false);
  });

  it('calcula correctamente el DV con calculateDv', () => {
    expect(calculateDv('77892410')).toBe('2');
    expect(calculateDv('77892417')).toBe('K');
    expect(calculateDv('11111111')).toBe('1');
    expect(calculateDv('8888888')).toBe('K');
    expect(calculateDv('12345678')).toBe('5');
  });

  it('formatea correctamente el RUT con puntos y guion', () => {
    expect(formatRut('778924102')).toBe('77.892.410-2');
    expect(formatRut('8888888k')).toBe('8.888.888-K');
  });
});
