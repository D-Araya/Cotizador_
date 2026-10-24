import Decimal from 'decimal.js';

export class Money {
  private readonly _amount: Decimal;
  public readonly currency: string;

  constructor(amount: number | string, currency = 'CLP') {
    let d: Decimal;
    try {
      d = new Decimal(amount);
    } catch {
      throw new Error('El monto debe ser un número válido');
    }

    if (d.isNaN()) {
      throw new Error('El monto debe ser un número válido');
    }
    if (d.isNegative()) {
      throw new Error('El monto no puede ser negativo');
    }

    this._amount = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    this.currency = (currency || 'CLP').toUpperCase();
  }

  get amount(): number {
    return this._amount.toNumber();
  }

  toString(): string {
    return `${this.currency} ${this._amount.toFixed(2)}`;
  }
}

export class Percentage {
  private readonly _value: Decimal;

  constructor(value: number | string) {
    let d: Decimal;
    try {
      d = new Decimal(value);
    } catch {
      throw new Error('El porcentaje debe ser un número válido');
    }

    if (d.isNaN()) {
      throw new Error('El porcentaje debe ser un número válido');
    }
    if (d.lessThan(0) || d.greaterThan(100)) {
      throw new Error('El porcentaje debe estar entre 0 y 100');
    }
    this._value = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  get value(): number {
    return this._value.toNumber();
  }

  toString(): string {
    return `${this._value.toFixed(2)}%`;
  }
}

export class Quantity {
  private readonly _value: Decimal;
  public readonly unit: string;

  constructor(value: number | string, unit: string) {
    if (!unit || typeof unit !== 'string' || !unit.trim()) {
      throw new Error('La unidad de medida es requerida y debe ser texto');
    }

    let d: Decimal;
    try {
      d = new Decimal(value);
    } catch {
      throw new Error('La cantidad debe ser un número válido');
    }

    if (d.isNaN()) {
      throw new Error('La cantidad debe ser un número válido');
    }
    if (d.lessThanOrEqualTo(0)) {
      throw new Error('La cantidad debe ser mayor que cero');
    }

    const trimmedUnit = unit.trim().toUpperCase();
    const wholeUnits = ['UND', 'CAJA', 'PZA', 'PAQ'];
    if (wholeUnits.includes(trimmedUnit) && !d.isInteger()) {
      throw new Error(`La unidad ${trimmedUnit} requiere una cantidad entera sin decimales`);
    }

    this._value = d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    this.unit = trimmedUnit;
  }

  get value(): number {
    return this._value.toNumber();
  }
}
