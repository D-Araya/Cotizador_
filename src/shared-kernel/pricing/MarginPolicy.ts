import Decimal from 'decimal.js';

export interface LinePricingInput {
  cost: number | string;
  price?: number | string;
  marginPct?: number | string;
  quantity: number | string;
}

export interface LinePricingResult {
  cost: number;
  price: number;
  marginPct: number;
  subtotal: number;
  costTotal: number;
  profit: number;
}

export interface QuotationTotalsResult {
  totalCost: number;
  totalSale: number;
  profit: number;
  marginPct: number;
  minMarginPct: number;
  meetsMinimum: boolean;
  shortfall: number; // Faltante en precio de venta para alcanzar el mínimo
  hardMinMarginPct?: number;
  meetsHardFloor?: boolean;
  canRequestException?: boolean;
}

export class MarginPolicy {
  /**
   * Recalcula precio a partir del costo y del margen objetivo deseado.
   * Fórmula: precio = costo / (1 - margen/100)
   * Redondeado SIEMPRE hacia arriba al céntimo (ceil) para asegurar que el redondeo
   * nunca deje el margen por debajo del objetivo.
   */
  public static calculatePriceFromMargin(cost: number | string, marginPct: number | string): number {
    const dCost = new Decimal(cost);
    const dMargin = new Decimal(marginPct);

    if (dCost.isNegative()) {
      throw new Error('El costo no puede ser negativo');
    }
    if (dMargin.greaterThanOrEqualTo(100) || dMargin.isNegative()) {
      throw new Error('El margen debe estar entre 0% y menos del 100%');
    }

    const oneMinusMargin = new Decimal(1).minus(dMargin.dividedBy(100));
    const rawPrice = dCost.dividedBy(oneMinusMargin);

    // Redondeo hacia arriba al céntimo (ROUND_UP)
    const price = rawPrice.toDecimalPlaces(2, Decimal.ROUND_UP);
    return price.toNumber();
  }

  /**
   * Recalcula el margen a partir del costo y el precio.
   * Fórmula: margen % = (precio - costo) / precio * 100
   * Redondeado a 2 decimales (half-up)
   */
  public static calculateMarginFromPrice(cost: number | string, price: number | string): number {
    const dCost = new Decimal(cost);
    const dPrice = new Decimal(price);

    if (dCost.isNegative()) {
      throw new Error('El costo no puede ser negativo');
    }
    if (dPrice.isNegative()) {
      throw new Error('El precio no puede ser negativo');
    }
    if (dCost.isZero() && dPrice.isZero()) {
      return 0;
    }
    if (dPrice.lessThan(dCost)) {
      throw new Error('El precio de venta no puede ser menor que el costo');
    }
    if (dPrice.isZero()) {
      return 0;
    }

    const margin = dPrice.minus(dCost).dividedBy(dPrice).times(100);
    return margin.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }

  /**
   * Procesa los valores de una línea: si el usuario ingresó margen se calcula precio,
   * si ingresó precio se calcula margen.
   */
  public static computeLine(input: {
    cost: number | string;
    price?: number | string;
    marginPct?: number | string;
    quantity: number | string;
    mode?: 'PRICE' | 'MARGIN';
  }): LinePricingResult {
    const cost = new Decimal(input.cost);
    const qty = new Decimal(input.quantity);

    if (cost.isNegative()) {
      throw new Error('El costo no puede ser negativo');
    }
    if (qty.lessThanOrEqualTo(0)) {
      throw new Error('La cantidad debe ser mayor que cero');
    }

    let finalPrice: Decimal;
    let finalMargin: Decimal;

    if (input.mode === 'MARGIN' && input.marginPct !== undefined) {
      const p = this.calculatePriceFromMargin(cost.toNumber(), input.marginPct);
      finalPrice = new Decimal(p);
      finalMargin = new Decimal(this.calculateMarginFromPrice(cost.toNumber(), p));
    } else if (input.price !== undefined) {
      finalPrice = new Decimal(input.price);
      if (finalPrice.lessThan(cost)) {
        throw new Error('El precio no puede ser inferior al costo');
      }
      finalMargin = new Decimal(this.calculateMarginFromPrice(cost.toNumber(), finalPrice.toNumber()));
    } else if (input.marginPct !== undefined) {
      const p = this.calculatePriceFromMargin(cost.toNumber(), input.marginPct);
      finalPrice = new Decimal(p);
      finalMargin = new Decimal(this.calculateMarginFromPrice(cost.toNumber(), p));
    } else {
      finalPrice = cost;
      finalMargin = new Decimal(0);
    }

    const subtotal = finalPrice.times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const costTotal = cost.times(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const profit = subtotal.minus(costTotal);

    return {
      cost: cost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      price: finalPrice.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      marginPct: finalMargin.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      subtotal: subtotal.toNumber(),
      costTotal: costTotal.toNumber(),
      profit: profit.toNumber(),
    };
  }

  /**
   * Calcula los totales y el margen consolidado de la cotización.
   * Regla de validación: margen % >= minMarginPct
   * Faltante = costo total / (1 - minimo/100) - venta total (redondeado hacia arriba al céntimo)
   */
  public static calculateQuotationTotals(
    lines: Array<{ cost: number | string; price: number | string; quantity: number | string }>,
    minMarginPct: number | string = 25,
    hardMinMarginPct?: number | string
  ): QuotationTotalsResult {
    const dMinMargin = new Decimal(minMarginPct);
    const dHardMargin = hardMinMarginPct !== undefined && hardMinMarginPct !== null && hardMinMarginPct !== ''
      ? new Decimal(hardMinMarginPct)
      : null;
    let totalCost = new Decimal(0);
    let totalSale = new Decimal(0);

    for (const line of lines) {
      const c = new Decimal(line.cost);
      const p = new Decimal(line.price);
      const q = new Decimal(line.quantity);

      totalCost = totalCost.plus(c.times(q));
      totalSale = totalSale.plus(p.times(q));
    }

    totalCost = totalCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    totalSale = totalSale.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const profit = totalSale.minus(totalCost);

    let marginPct = new Decimal(0);
    if (totalSale.greaterThan(0)) {
      marginPct = profit.dividedBy(totalSale).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    const meetsMinimum = marginPct.greaterThanOrEqualTo(dMinMargin);
    const meetsHardFloor = dHardMargin ? marginPct.greaterThanOrEqualTo(dHardMargin) : true;
    const canRequestException = !meetsMinimum && meetsHardFloor;

    let shortfall = new Decimal(0);
    if (!meetsMinimum && dMinMargin.lessThan(100)) {
      // faltante = costo total / (1 - mínimo/100) - venta total
      const requiredSale = totalCost.dividedBy(new Decimal(1).minus(dMinMargin.dividedBy(100)));
      const rawShortfall = requiredSale.minus(totalSale);
      if (rawShortfall.greaterThan(0)) {
        shortfall = rawShortfall.toDecimalPlaces(2, Decimal.ROUND_UP);
      }
    }

    return {
      totalCost: totalCost.toNumber(),
      totalSale: totalSale.toNumber(),
      profit: profit.toNumber(),
      marginPct: marginPct.toNumber(),
      minMarginPct: dMinMargin.toNumber(),
      meetsMinimum,
      shortfall: shortfall.toNumber(),
      hardMinMarginPct: dHardMargin ? dHardMargin.toNumber() : undefined,
      meetsHardFloor,
      canRequestException,
    };
  }
}
