import crypto from 'node:crypto';

// Secretos para firmas HMAC y tokens
const SESSION_SECRET = process.env.SESSION_SECRET || 'ml_naval_dev_session_secret_key_secure_2026';

export interface StaffTokenPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'SALES_REP';
  name: string;
  exp: number; // timestamp en segundos
}

/**
 * Genera hash seguro scrypt para contraseñas de personal
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, generatedSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: generatedSalt,
  };
}

/**
 * Verifica una contraseña contra su hash scrypt
 */
export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!password || !storedHash || !salt) return false;
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (keyBuffer.length !== storedBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Emite un token HMAC-SHA256 para el personal (Válido por 24 horas)
 */
export function createStaffToken(user: { id: string; email: string; role: 'ADMIN' | 'SALES_REP'; name: string }): string {
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 horas
  const payload: StaffTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verifica el token HMAC-SHA256 del personal
 */
export function verifyStaffToken(token: string): StaffTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8')) as StaffTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expirado
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Genera un enlace mágico para contactos de clientes:
 * Token aleatorio de 32 bytes (crypto.randomBytes, base64url), guardado como hash SHA-256,
 * con expiración de 30 días y revocable por el personal.
 */
export function generateMagicLinkToken(): { rawToken: string; tokenHash: string; expiresAt: string } {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashMagicToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 días
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Calcula el hash SHA-256 de un token de enlace mágico
 */
export function hashMagicToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Genera un token público para cotización:
 * crypto.randomBytes(24).toString('base64url') con expiración igual a la vigencia más 30 días.
 */
export function generatePublicQuotationToken(validUntil?: string): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(24).toString('base64url');
  let baseDate = Date.now();
  if (validUntil) {
    const parsed = new Date(validUntil).getTime();
    if (!isNaN(parsed)) baseDate = parsed;
  }
  const expiresAt = new Date(baseDate + 30 * 24 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt };
}
