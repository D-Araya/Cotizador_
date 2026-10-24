import Decimal from 'decimal.js';

export interface QuotationLinePricingInput {
  catalogItemId?: string;
  cost: number | string;
  price?: number | string;
  marginPct?: number | string;
  quantity: number | string;
  discountPct?: number | string;
}

export interface ComputedQuotationLine {
  catalogItemId?: string;
  cost: number;
  originalUnitPrice: number;
  unitPrice: number;
  discountPct: number;
  discountAmount: number;
  marginPct: number;
  quantity: number;
  costTotal: number;
  subtotal: number;
}

export interface ComputedQuotationTotals {
  lines: ComputedQuotationLine[];
  grossNetSubtotal: number;
  discountPct: number;
  discountAmount: number;
  totalSavings: number;
  netSubtotal: number;
  taxRatePct: number;
  taxAmount: number;
  grandTotal: number;
  totalCost: number;
  profit: number;
  marginPct: number;
  rawMarginPct: number;
  minMarginPct: number;
  meetsMinimum: boolean;
  shortfall: number;
  hardMinMarginPct?: number;
  meetsHardFloor?: boolean;
  canRequestException?: boolean;
  ufRate?: number;
  ufNetSubtotal?: number;
  ufGrandTotal?: number;
}

/**
 * Función canónica de cálculo de totales para Cotizaciones en CLP.
 * Única fuente de verdad según docs/PROJECT_RULES.md:
 * - Decimal.js siempre
 * - Margen sobre precio de venta: (precio - costo) / precio * 100
 * - Precio unitario redondeado HACIA ARRIBA al peso (ROUND_UP)
 * - Descuentos por línea y global aplicados rigurosamente sobre el precio de venta
 * - IVA sobre el neto total con redondeo half-up al peso (ROUND_HALF_UP)
 * - El margen se compara con el mínimo SIN redondeo previo
 * - Soporte P3.l: piso duro de margen y excepción
 * - Soporte P3.m: conversión a UF con valor del día
 */
export function computeTotals(
  lines: QuotationLinePricingInput[],
  minMarginPct: number | string = 25,
  taxRatePct: number | string = 19,
  globalDiscountPct: number | string = 0,
  hardMinMarginPct?: number | string,
  ufRate?: number | string
): ComputedQuotationTotals {
  const dMinMargin = new Decimal(minMarginPct);
  const dTaxRate = new Decimal(taxRatePct);
  const dGlobalDiscount = new Decimal(globalDiscountPct || 0);

  if (dGlobalDiscount.isNegative() || dGlobalDiscount.greaterThanOrEqualTo(100)) {
    throw new Error('El descuento global debe estar entre 0% y menos del 100%');
  }

  let grossNetSubtotal = new Decimal(0);
  let linesNetSubtotal = new Decimal(0);
  let totalCost = new Decimal(0);
  let linesSavings = new Decimal(0);

  const computedLines: ComputedQuotationLine[] = lines.map((line) => {
    const cost = new Decimal(line.cost || 0);
    const qty = new Decimal(line.quantity || 1);
    const lineDiscount = new Decimal(line.discountPct || 0);

    if (lineDiscount.isNegative() || lineDiscount.greaterThanOrEqualTo(100)) {
      throw new Error('El descuento de línea debe estar entre 0% y menos del 100%');
    }

    let baseUnitPrice = new Decimal(0);

    if (line.marginPct !== undefined && line.marginPct !== null && line.marginPct !== '') {
      const margin = new Decimal(line.marginPct);
      if (margin.greaterThanOrEqualTo(100)) {
        throw new Error('El margen no puede ser mayor o igual al 100%');
      }
      if (margin.isNegative()) {
        throw new Error('El margen no puede ser negativo');
      }
      const oneMinusMargin = new Decimal(1).minus(margin.dividedBy(100));
      const rawPrice = cost.dividedBy(oneMinusMargin);
      // Precio unitario redondeado HACIA ARRIBA al peso
      baseUnitPrice = rawPrice.toDecimalPlaces(0, Decimal.ROUND_UP);
    } else if (line.price !== undefined && line.price !== null && line.price !== '') {
      // Precio unitario redondeado HACIA ARRIBA al peso
      baseUnitPrice = new Decimal(line.price).toDecimalPlaces(0, Decimal.ROUND_UP);
    } else {
      baseUnitPrice = cost.toDecimalPlaces(0, Decimal.ROUND_UP);
    }

    // Aplicar descuento por línea si existe
    let effectiveUnitPrice = baseUnitPrice;
    let lineDiscountAmount = new Decimal(0);

    if (lineDiscount.greaterThan(0)) {
      const discountFactor = new Decimal(1).minus(lineDiscount.dividedBy(100));
      effectiveUnitPrice = baseUnitPrice.times(discountFactor).toDecimalPlaces(0, Decimal.ROUND_UP);
      lineDiscountAmount = baseUnitPrice.minus(effectiveUnitPrice).times(qty);
    }

    const lineMargin = effectiveUnitPrice.greaterThan(0)
      ? effectiveUnitPrice.minus(cost).dividedBy(effectiveUnitPrice).times(100)
      : new Decimal(0);

    const subtotal = effectiveUnitPrice.times(qty);
    const costTotal = cost.times(qty);
    const lineGrossSubtotal = baseUnitPrice.times(qty);

    grossNetSubtotal = grossNetSubtotal.plus(lineGrossSubtotal);
    linesNetSubtotal = linesNetSubtotal.plus(subtotal);
    totalCost = totalCost.plus(costTotal);
    linesSavings = linesSavings.plus(lineDiscountAmount);

    return {
      catalogItemId: line.catalogItemId,
      cost: cost.toNumber(),
      originalUnitPrice: baseUnitPrice.toNumber(),
      unitPrice: effectiveUnitPrice.toNumber(),
      discountPct: lineDiscount.toNumber(),
      discountAmount: lineDiscountAmount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      marginPct: lineMargin.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      quantity: qty.toNumber(),
      costTotal: costTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
      subtotal: subtotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
    };
  });

  // Descuento global sobre el subtotal resultante de líneas
  const globalDiscountAmount = linesNetSubtotal
    .times(dGlobalDiscount.dividedBy(100))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const netSubtotal = linesNetSubtotal.minus(globalDiscountAmount);
  const totalSavings = linesSavings.plus(globalDiscountAmount).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const profit = netSubtotal.minus(totalCost);

  const rawMargin = netSubtotal.greaterThan(0)
    ? profit.dividedBy(netSubtotal).times(100)
    : new Decimal(0);

  // El margen se compara con el mínimo SIN redondeo previo
  const meetsMinimum = rawMargin.greaterThanOrEqualTo(dMinMargin);

  // Piso duro P3.l
  const dHardMargin = hardMinMarginPct !== undefined && hardMinMarginPct !== null && hardMinMarginPct !== ''
    ? new Decimal(hardMinMarginPct)
    : null;
  const meetsHardFloor = dHardMargin ? rawMargin.greaterThanOrEqualTo(dHardMargin) : true;
  const canRequestException = !meetsMinimum && meetsHardFloor;

  let shortfall = new Decimal(0);
  if (!meetsMinimum && dMinMargin.lessThan(100)) {
    const requiredSale = totalCost.dividedBy(new Decimal(1).minus(dMinMargin.dividedBy(100)));
    const rawShortfall = requiredSale.minus(netSubtotal);
    if (rawShortfall.greaterThan(0)) {
      shortfall = rawShortfall.toDecimalPlaces(0, Decimal.ROUND_UP);
    }
  }

  // IVA sobre el neto total con redondeo half-up al peso
  const taxAmount = netSubtotal
    .times(dTaxRate.dividedBy(100))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  const grandTotal = netSubtotal.plus(taxAmount);

  // Conversión a UF P3.m
  const dUfRate = ufRate !== undefined && ufRate !== null && ufRate !== '' ? new Decimal(ufRate) : null;
  const ufNetSubtotal = dUfRate && dUfRate.greaterThan(0)
    ? netSubtotal.dividedBy(dUfRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    : undefined;
  const ufGrandTotal = dUfRate && dUfRate.greaterThan(0)
    ? grandTotal.dividedBy(dUfRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    : undefined;

  return {
    lines: computedLines,
    grossNetSubtotal: grossNetSubtotal.toNumber(),
    discountPct: dGlobalDiscount.toNumber(),
    discountAmount: globalDiscountAmount.toNumber(),
    totalSavings: totalSavings.toNumber(),
    netSubtotal: netSubtotal.toNumber(),
    taxRatePct: dTaxRate.toNumber(),
    taxAmount: taxAmount.toNumber(),
    grandTotal: grandTotal.toNumber(),
    totalCost: totalCost.toNumber(),
    profit: profit.toNumber(),
    marginPct: rawMargin.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    rawMarginPct: rawMargin.toNumber(),
    minMarginPct: dMinMargin.toNumber(),
    meetsMinimum,
    shortfall: shortfall.toNumber(),
    hardMinMarginPct: dHardMargin ? dHardMargin.toNumber() : undefined,
    meetsHardFloor,
    canRequestException,
    ufRate: dUfRate ? dUfRate.toNumber() : undefined,
    ufNetSubtotal,
    ufGrandTotal,
  };
}
