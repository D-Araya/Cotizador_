import { describe, it, expect } from 'vitest';
import { MarginPolicy } from '../../src/shared-kernel/pricing/MarginPolicy.ts';

describe('MarginPolicy Domain Service', () => {
  describe('calculatePriceFromMargin', () => {
    it('recalcula el precio a partir del costo y margen objetivo redondeando SIEMPRE hacia arriba', () => {
      // Costo 100, margen 25% -> 100 / (1 - 0.25) = 133.3333... -> 133.34
      const price = MarginPolicy.calculatePriceFromMargin(100, 25);
      expect(price).toBe(133.34);

      // Margen resultante con 133.34 debe ser >= 25% (nunca por debajo)
      const margin = MarginPolicy.calculateMarginFromPrice(100, price);
      expect(margin).toBeGreaterThanOrEqual(25.0);
    });

    it('acepta costo cero produciendo precio cero', () => {
      expect(MarginPolicy.calculatePriceFromMargin(0, 25)).toBe(0);
    });

    it('rechaza costos negativos', () => {
      expect(() => MarginPolicy.calculatePriceFromMargin(-10, 25)).toThrow('El costo no puede ser negativo');
    });

    it('rechaza márgenes negativos o mayores o iguales a 100%', () => {
      expect(() => MarginPolicy.calculatePriceFromMargin(100, -5)).toThrow('El margen debe estar entre 0% y menos del 100%');
      expect(() => MarginPolicy.calculatePriceFromMargin(100, 100)).toThrow('El margen debe estar entre 0% y menos del 100%');
      expect(() => MarginPolicy.calculatePriceFromMargin(100, 105)).toThrow('El margen debe estar entre 0% y menos del 100%');
    });

    it('calcula con margen cero retornando el mismo costo', () => {
      expect(MarginPolicy.calculatePriceFromMargin(150, 0)).toBe(150);
    });
  });

  describe('calculateMarginFromPrice', () => {
    it('calcula margen correctamente para precio normal', () => {
      // Costo 80, Precio 100 -> Margen = (100 - 80) / 100 = 20%
      expect(MarginPolicy.calculateMarginFromPrice(80, 100)).toBe(20);
    });

    it('retorna 0 si costo y precio son ambos cero', () => {
      expect(MarginPolicy.calculateMarginFromPrice(0, 0)).toBe(0);
    });

    it('REGLA CORREGIDA: lanza error si precio es menor que el costo (incluso si precio es 0)', () => {
      expect(() => MarginPolicy.calculateMarginFromPrice(50, 0)).toThrow('El precio de venta no puede ser menor que el costo');
      expect(() => MarginPolicy.calculateMarginFromPrice(100, 80)).toThrow('El precio de venta no puede ser menor que el costo');
    });

    it('rechaza costos o precios negativos', () => {
      expect(() => MarginPolicy.calculateMarginFromPrice(-10, 50)).toThrow('El costo no puede ser negativo');
      expect(() => MarginPolicy.calculateMarginFromPrice(50, -10)).toThrow('El precio no puede ser negativo');
    });

    it('retorna 100% de margen si el costo es 0 y el precio es positivo', () => {
      expect(MarginPolicy.calculateMarginFromPrice(0, 50)).toBe(100);
    });
  });

  describe('computeLine', () => {
    it('calcula una línea con modo MARGIN', () => {
      const res = MarginPolicy.computeLine({
        cost: 100,
        marginPct: 25,
        quantity: 2,
        mode: 'MARGIN',
      });
      expect(res.cost).toBe(100);
      expect(res.price).toBe(133.34);
      expect(res.marginPct).toBeGreaterThanOrEqual(25);
      expect(res.subtotal).toBe(266.68);
      expect(res.costTotal).toBe(200);
      expect(res.profit).toBe(66.68);
    });

    it('calcula una línea especificando precio explícito', () => {
      const res = MarginPolicy.computeLine({
        cost: 60,
        price: 100,
        quantity: 3,
      });
      expect(res.cost).toBe(60);
      expect(res.price).toBe(100);
      expect(res.marginPct).toBe(40);
      expect(res.subtotal).toBe(300);
      expect(res.costTotal).toBe(180);
      expect(res.profit).toBe(120);
    });

    it('calcula una línea especificando sólo margen', () => {
      const res = MarginPolicy.computeLine({
        cost: 80,
        marginPct: 20,
        quantity: 1,
      });
      expect(res.price).toBe(100);
      expect(res.marginPct).toBe(20);
      expect(res.subtotal).toBe(100);
    });

    it('utiliza costo como precio si no se especifica ni precio ni margen', () => {
      const res = MarginPolicy.computeLine({
        cost: 120,
        quantity: 1,
      });
      expect(res.price).toBe(120);
      expect(res.marginPct).toBe(0);
      expect(res.profit).toBe(0);
    });

    it('rechaza precio menor que costo en computeLine', () => {
      expect(() => MarginPolicy.computeLine({
        cost: 100,
        price: 80,
        quantity: 1,
      })).toThrow('El precio no puede ser inferior al costo');
    });

    it('rechaza costo negativo o cantidad <= 0 en computeLine', () => {
      expect(() => MarginPolicy.computeLine({
        cost: -10,
        price: 50,
        quantity: 1,
      })).toThrow('El costo no puede ser negativo');

      expect(() => MarginPolicy.computeLine({
        cost: 50,
        price: 100,
        quantity: 0,
      })).toThrow('La cantidad debe ser mayor que cero');

      expect(() => MarginPolicy.computeLine({
        cost: 50,
        price: 100,
        quantity: -2,
      })).toThrow('La cantidad debe ser mayor que cero');
    });
  });

  describe('calculateQuotationTotals', () => {
    it('calcula el faltante exacto: costo 700 y venta 874.02 con mínimo 25% -> faltan 59.32', () => {
      // 700 / (1 - 0.25) = 933.3333333333334
      // 933.3333333333334 - 874.02 = 59.3133333333334 -> redondeo hacia arriba: 59.32
      const lines = [
        { cost: 700, price: 874.02, quantity: 1 },
      ];
      const totals = MarginPolicy.calculateQuotationTotals(lines, 25);
      expect(totals.meetsMinimum).toBe(false);
      expect(totals.shortfall).toBe(59.32);
      expect(totals.totalCost).toBe(700);
      expect(totals.totalSale).toBe(874.02);
    });

    it('una cotización con margen de 24.99% no pasa, pero con 25.00% sí pasa', () => {
      const linesFails = [
        { cost: 75.01, price: 100, quantity: 1 }, // (100 - 75.01)/100 = 24.99%
      ];
      const totalsFails = MarginPolicy.calculateQuotationTotals(linesFails, 25);
      expect(totalsFails.meetsMinimum).toBe(false);

      const linesPasses = [
        { cost: 75.0, price: 100, quantity: 1 }, // 25.00%
      ];
      const totalsPasses = MarginPolicy.calculateQuotationTotals(linesPasses, 25);
      expect(totalsPasses.meetsMinimum).toBe(true);
    });

    it('una línea al 10% compensada por otra al 40% da un consolidado que cumple la regla', () => {
      // Línea 1: Costo 90, Venta 100 -> Margen 10%
      // Línea 2: Costo 60, Venta 100 -> Margen 40%
      // Total Venta = 200, Total Costo = 150, Ganancia = 50 -> Margen = 50/200 = 25%
      const lines = [
        { cost: 90, price: 100, quantity: 1 },
        { cost: 60, price: 100, quantity: 1 },
      ];
      const totals = MarginPolicy.calculateQuotationTotals(lines, 25);
      expect(totals.marginPct).toBe(25);
      expect(totals.meetsMinimum).toBe(true);
      expect(totals.shortfall).toBe(0);
    });

    it('retorna ceros cuando la lista de líneas está vacía', () => {
      const totals = MarginPolicy.calculateQuotationTotals([], 25);
      expect(totals.totalCost).toBe(0);
      expect(totals.totalSale).toBe(0);
      expect(totals.profit).toBe(0);
      expect(totals.marginPct).toBe(0);
      expect(totals.shortfall).toBe(0);
    });
  });
});
