/**
 * Formateador de dinero canónico para toda la aplicación (M&L Ingeniería Naval SpA).
 * Usado por los tres paneles (Interno, Portal del Cliente, Vista Pública) y síntesis de voz.
 */

export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = 'CLP'
): string {
  const num =
    typeof amount === 'number'
      ? isNaN(amount)
        ? 0
        : amount
      : typeof amount === 'string'
      ? Number(amount) || 0
      : 0;

  const curr = (currency || 'CLP').trim().toUpperCase();

  if (curr === 'UF') {
    return `UF ${num.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }

  const rounded = Math.round(num);

  if (curr === 'CLP' || curr === '$') {
    return `$ ${rounded.toLocaleString('es-CL')}`;
  }

  return `${curr} ${rounded.toLocaleString('es-CL')}`;
}

/**
 * Versión en texto hablado para asistentes de voz (TTS).
 */
export function formatMoneySpoken(
  amount: number | string | null | undefined,
  currency: string = 'CLP'
): string {
  const num =
    typeof amount === 'number'
      ? isNaN(amount)
        ? 0
        : amount
      : typeof amount === 'string'
      ? Number(amount) || 0
      : 0;

  const curr = (currency || 'CLP').trim().toUpperCase();

  if (curr === 'UF') {
    return `${num.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Unidades de Fomento`;
  }

  const rounded = Math.round(num);

  if (curr === 'CLP' || curr === '$') {
    return `${rounded.toLocaleString('es-CL')} pesos chilenos`;
  }

  return `${rounded.toLocaleString('es-CL')} ${curr}`;
}
