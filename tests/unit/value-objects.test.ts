import { describe, it, expect } from 'vitest';
import { Money, Percentage, Quantity } from '../../src/shared-kernel/value-objects.ts';

describe('Value Objects Unit Tests', () => {
  describe('Money Value Object', () => {
    it('crea instancias válidas con moneda por defecto CLP', () => {
      const m = new Money(150.5);
      expect(m.amount).toBe(150.5);
      expect(m.currency).toBe('CLP');
      expect(m.toString()).toBe('CLP 150.50');
    });

    it('permite especificar moneda personalizada en mayúsculas', () => {
      const m = new Money(2500, 'usd');
      expect(m.amount).toBe(2500);
      expect(m.currency).toBe('USD');
      expect(m.toString()).toBe('USD 2500.00');
    });

    it('redondea a 2 decimales half-up', () => {
      const m = new Money(100.555);
      expect(m.amount).toBe(100.56);
    });

    it('acepta monto cero', () => {
      const m = new Money(0);
      expect(m.amount).toBe(0);
      expect(m.toString()).toBe('CLP 0.00');
    });

    it('rechaza montos negativos', () => {
      expect(() => new Money(-50)).toThrow('El monto no puede ser negativo');
    });

    it('rechaza entradas que no son números válidos o son NaN', () => {
      expect(() => new Money('invalid')).toThrow('El monto debe ser un número válido');
      expect(() => new Money(NaN)).toThrow('El monto debe ser un número válido');
    });
  });

  describe('Percentage Value Object', () => {
    it('crea porcentaje válido en el rango [0, 100]', () => {
      const p1 = new Percentage(25.5);
      expect(p1.value).toBe(25.5);
      expect(p1.toString()).toBe('25.50%');

      const p0 = new Percentage(0);
      expect(p0.value).toBe(0);
      expect(p0.toString()).toBe('0.00%');

      const p100 = new Percentage(100);
      expect(p100.value).toBe(100);
      expect(p100.toString()).toBe('100.00%');
    });

    it('rechaza porcentajes menores a 0 o mayores a 100', () => {
      expect(() => new Percentage(-0.01)).toThrow('El porcentaje debe estar entre 0 y 100');
      expect(() => new Percentage(100.01)).toThrow('El porcentaje debe estar entre 0 y 100');
    });

    it('rechaza entradas no numéricas o NaN', () => {
      expect(() => new Percentage('not-a-number')).toThrow('El porcentaje debe ser un número válido');
      expect(() => new Percentage(NaN)).toThrow('El porcentaje debe ser un número válido');
    });
  });

  describe('Quantity Value Object', () => {
    it('exige unidad no vacía y tipo texto', () => {
      expect(() => new Quantity(5, '')).toThrow('La unidad de medida es requerida y debe ser texto');
      expect(() => new Quantity(5, null as any)).toThrow('La unidad de medida es requerida y debe ser texto');
    });

    it('exige cantidad entera para unidades físicas discretas (UND, CAJA, PZA, PAQ)', () => {
      expect(() => new Quantity(1.5, 'UND')).toThrow('La unidad UND requiere una cantidad entera sin decimales');
      expect(() => new Quantity(2.5, 'caja')).toThrow('La unidad CAJA requiere una cantidad entera sin decimales');
      expect(() => new Quantity(3.2, 'PZA')).toThrow('La unidad PZA requiere una cantidad entera sin decimales');
      expect(() => new Quantity(0.5, 'PAQ')).toThrow('La unidad PAQ requiere una cantidad entera sin decimales');

      const qUnd = new Quantity(5, 'UND');
      expect(qUnd.value).toBe(5);
      expect(qUnd.unit).toBe('UND');
    });

    it('permite cantidades fraccionarias para servicios u otras unidades continuas (HORA, GLOBAL, KG, M)', () => {
      const qHora = new Quantity(2.5, 'hora');
      expect(qHora.value).toBe(2.5);
      expect(qHora.unit).toBe('HORA');

      const qKg = new Quantity(10.75, 'KG');
      expect(qKg.value).toBe(10.75);

      const qGlobal = new Quantity(0.5, 'GLOBAL');
      expect(qGlobal.value).toBe(0.5);
    });

    it('rechaza cantidades menores o iguales a cero', () => {
      expect(() => new Quantity(0, 'HORA')).toThrow('La cantidad debe ser mayor que cero');
      expect(() => new Quantity(-5, 'UND')).toThrow('La cantidad debe ser mayor que cero');
    });

    it('rechaza valores no numéricos o NaN', () => {
      expect(() => new Quantity('abc', 'UND')).toThrow('La cantidad debe ser un número válido');
      expect(() => new Quantity(NaN, 'UND')).toThrow('La cantidad debe ser un número válido');
    });
  });
});
