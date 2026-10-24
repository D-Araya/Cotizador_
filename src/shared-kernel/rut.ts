/**
 * Utilidad canónica para validación y formateo de RUT chileno (Módulo 11).
 * Una sola fuente de verdad para cliente y servidor.
 */

/**
 * Limpia un RUT eliminando puntos, guiones y espacios, convirtiendo a mayúsculas.
 */
export function cleanRut(rut: string | null | undefined): string {
  if (!rut || typeof rut !== 'string') return '';
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Calcula el dígito verificador esperado para el cuerpo numérico según Módulo 11.
 */
export function calculateDv(body: string | number): string {
  const strBody = String(body).replace(/\D/g, '');
  if (!strBody) return '';

  let sum = 0;
  let multiplier = 2;

  for (let i = strBody.length - 1; i >= 0; i--) {
    sum += Number(strBody[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Valida un RUT chileno usando el algoritmo Módulo 11.
 * Soporta formatos: '77.892.410-K', '77892410-K', '77892410K', '1-9'.
 */
export function validateRut(rut: string | null | undefined): boolean {
  const cleaned = cleanRut(rut);
  if (cleaned.length < 2) return false;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  if (!/^\d+$/.test(body)) return false;

  const expectedDv = calculateDv(body);
  return dv === expectedDv;
}

/**
 * Formatea un RUT al estándar chileno: XX.XXX.XXX-X
 */
export function formatRut(rut: string | null | undefined): string {
  const cleaned = cleanRut(rut);
  if (!cleaned) return '';
  if (cleaned.length === 1) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Formatear cuerpo con puntos
  let formattedBody = '';
  for (let i = body.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      formattedBody = '.' + formattedBody;
    }
    formattedBody = body[i] + formattedBody;
  }

  return `${formattedBody}-${dv}`;
}
