import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneySpoken } from '../../src/shared-kernel/formatMoney.ts';

describe('formatMoney utility', () => {
  it('formatea moneda CLP sin decimales al peso chileno con separador de miles', () => {
    expect(formatMoney(1500000, 'CLP')).toBe('$ 1.500.000');
    expect(formatMoney(28000.4, 'CLP')).toBe('$ 28.000');
    expect(formatMoney(0, 'CLP')).toBe('$ 0');
    expect(formatMoney(null, 'CLP')).toBe('$ 0');
    expect(formatMoney(undefined, 'CLP')).toBe('$ 0');
  });

  it('formatea montos en formato verbal extendido', () => {
    expect(formatMoneySpoken(1500000, 'CLP')).toBe('1.500.000 pesos chilenos');
  });

  it('P3.m: formatea montos en moneda UF con decimales', () => {
    expect(formatMoney(120.5, 'UF')).toContain('UF 120,50');
    expect(formatMoneySpoken(120.5, 'UF')).toContain('120,50 Unidades de Fomento');
  });
});
