import { describe, it, expect } from 'vitest';
import { computeTotals } from '../../src/shared-kernel/pricing/computeTotals.js';

describe('computeTotals Canonical Function (PROJECT_RULES.md)', () => {
  it('calcula precios unitarios redondeados hacia arriba al peso con IVA 19%', () => {
    const lines = [
      {
        catalogItemId: 'prod-01',
        cost: 28000,
        marginPct: 30, // 28000 / (1 - 0.3) = 40000
        quantity: 2,
      },
    ];

    const result = computeTotals(lines, 25, 19);

    expect(result.lines[0].unitPrice).toBe(40000);
    expect(result.lines[0].subtotal).toBe(80000);
    expect(result.lines[0].costTotal).toBe(56000);
    expect(result.lines[0].marginPct).toBe(30);

    expect(result.netSubtotal).toBe(80000);
    expect(result.totalCost).toBe(56000);
    expect(result.profit).toBe(24000);
    expect(result.taxRatePct).toBe(19);
    expect(result.taxAmount).toBe(15200); // 80000 * 0.19
    expect(result.grandTotal).toBe(95200);
    expect(result.meetsMinimum).toBe(true);
    expect(result.shortfall).toBe(0);
  });

  it('redondea hacia arriba al peso cuando el precio con margen no es entero', () => {
    // 10000 / (1 - 0.33) = 14925.3731 -> ceil al peso = 14926
    const lines = [
      {
        cost: 10000,
        marginPct: 33,
        quantity: 1,
      },
    ];

    const result = computeTotals(lines, 25, 19);
    expect(result.lines[0].unitPrice).toBe(14926);
    expect(result.meetsMinimum).toBe(true);
  });

  it('detecta cuando el margen consolidado está por debajo del mínimo exigido', () => {
    const lines = [
      {
        cost: 100000,
        price: 110000, // margen: (110000 - 100000) / 110000 = 9.09%
        quantity: 1,
      },
    ];

    const result = computeTotals(lines, 25, 19);
    expect(result.meetsMinimum).toBe(false);
    expect(result.marginPct).toBe(9.09);
    expect(result.shortfall).toBeGreaterThan(0);
  });

  it('P3.l & P3.m: evalúa piso duro y realiza conversión a UF', () => {
    // Costo 80.000, Precio 100.000 -> Margen 20%
    const lines = [
      { cost: 80000, price: 100000, quantity: 1 },
    ];

    // Con mínimo 28% y piso duro 18%:
    const resultBetween = computeTotals(lines, 28, 19, 0, 18, 38500);
    expect(resultBetween.meetsMinimum).toBe(false);
    expect(resultBetween.meetsHardFloor).toBe(true);
    expect(resultBetween.canRequestException).toBe(true);
    expect(resultBetween.ufRate).toBe(38500);
    // Neto 100000 / 38500 = 2.60 UF
    expect(resultBetween.ufNetSubtotal).toBe(2.6);
    // Total 119000 / 38500 = 3.09 UF
    expect(resultBetween.ufGrandTotal).toBe(3.09);

    // Con piso duro 22%: margen 20% cae bajo el piso duro
    const resultBelowHard = computeTotals(lines, 28, 19, 0, 22, 38500);
    expect(resultBelowHard.meetsMinimum).toBe(false);
    expect(resultBelowHard.meetsHardFloor).toBe(false);
    expect(resultBelowHard.canRequestException).toBe(false);
  });
});
