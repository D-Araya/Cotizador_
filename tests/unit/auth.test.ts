import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  createStaffToken,
  verifyStaffToken,
  generateMagicLinkToken,
  hashMagicToken,
} from '../../src/server/auth.js';

describe('Auth Unit Tests (src/server/auth.ts)', () => {
  describe('hashPassword & verifyPassword', () => {
    it('genera un hash scrypt seguro de 128 caracteres hex y un salt único', () => {
      const { hash, salt } = hashPassword('MiClaveSegura2026!');
      expect(hash).toBeDefined();
      expect(hash.length).toBe(128); // 64 bytes hex
      expect(salt).toBeDefined();
      expect(salt.length).toBe(32); // 16 bytes hex
    });

    it('verifica exitosamente la contraseña correcta contra su hash y salt', () => {
      const password = 'SuperNavalPassword#123';
      const { hash, salt } = hashPassword(password);
      const isValid = verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);
    });

    it('rechaza contraseñas incorrectas', () => {
      const { hash, salt } = hashPassword('PasswordCorrecta');
      const isValid = verifyPassword('PasswordIncorrecta', hash, salt);
      expect(isValid).toBe(false);
    });

    it('devuelve false de forma segura si la contraseña, hash o salt son vacíos o nulos', () => {
      const { hash, salt } = hashPassword('Test');
      expect(verifyPassword('', hash, salt)).toBe(false);
      expect(verifyPassword('Test', '', salt)).toBe(false);
      expect(verifyPassword('Test', hash, '')).toBe(false);
      expect(verifyPassword(null as any, hash, salt)).toBe(false);
    });

    it('produce sales distintos para la misma contraseña en llamadas sucesivas', () => {
      const res1 = hashPassword('PasswordIdentica');
      const res2 = hashPassword('PasswordIdentica');
      expect(res1.salt).not.toBe(res2.salt);
      expect(res1.hash).not.toBe(res2.hash);
      expect(verifyPassword('PasswordIdentica', res1.hash, res1.salt)).toBe(true);
      expect(verifyPassword('PasswordIdentica', res2.hash, res2.salt)).toBe(true);
    });
  });

  describe('createStaffToken & verifyStaffToken', () => {
    const mockStaff = {
      id: 'usr-admin-01',
      email: 'admin@mlingenieria.cl',
      role: 'ADMIN' as const,
      name: 'Victoria Villegas',
    };

    it('genera un token HMAC-SHA256 con formato de dos partes <payload>.<firma>', () => {
      const token = createStaffToken(mockStaff);
      expect(token).toBeDefined();
      const parts = token.split('.');
      expect(parts.length).toBe(2);
      expect(parts[0].length).toBeGreaterThan(10);
      expect(parts[1].length).toBeGreaterThan(10);
    });

    it('valida exitosamente un token recién emitido y decodifica su payload', () => {
      const token = createStaffToken(mockStaff);
      const payload = verifyStaffToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(mockStaff.id);
      expect(payload?.email).toBe(mockStaff.email);
      expect(payload?.role).toBe('ADMIN');
      expect(payload?.name).toBe(mockStaff.name);
      expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rechaza un token con la firma alterada', () => {
      const token = createStaffToken(mockStaff);
      const [payload, signature] = token.split('.');
      const tamperedSignature = signature.substring(0, signature.length - 2) + 'xx';
      const tamperedToken = `${payload}.${tamperedSignature}`;

      expect(verifyStaffToken(tamperedToken)).toBeNull();
    });

    it('rechaza un token con el payload alterado', () => {
      const token = createStaffToken(mockStaff);
      const [, signature] = token.split('.');
      const fakePayload = Buffer.from(
        JSON.stringify({ userId: 'hacker', role: 'ADMIN', exp: 9999999999 })
      ).toString('base64url');
      const tamperedToken = `${fakePayload}.${signature}`;

      expect(verifyStaffToken(tamperedToken)).toBeNull();
    });

    it('rechaza tokens con formato inválido o nulo', () => {
      expect(verifyStaffToken('')).toBeNull();
      expect(verifyStaffToken('token_sin_punto')).toBeNull();
      expect(verifyStaffToken('a.b.c')).toBeNull();
      expect(verifyStaffToken(null as any)).toBeNull();
      expect(verifyStaffToken(12345 as any)).toBeNull();
    });

    it('rechaza un token expirado', () => {
      const expiredPayload = {
        userId: 'usr-admin-01',
        email: 'admin@mlingenieria.cl',
        role: 'ADMIN' as const,
        name: 'Victoria Villegas',
        exp: Math.floor(Date.now() / 1000) - 100, // 100 segundos en el pasado
      };
      const payloadStr = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
      const sessionSecret = process.env.SESSION_SECRET || 'ml_naval_dev_session_secret_key_secure_2026';
      const signature = crypto.createHmac('sha256', sessionSecret).update(payloadStr).digest('base64url');
      const expiredToken = `${payloadStr}.${signature}`;

      expect(verifyStaffToken(expiredToken)).toBeNull();
    });
  });

  describe('generateMagicLinkToken & hashMagicToken', () => {
    it('genera un token aleatorio con expiración a 30 días y hash SHA-256 consistente', () => {
      const { rawToken, tokenHash, expiresAt } = generateMagicLinkToken();

      expect(rawToken).toBeDefined();
      expect(rawToken.length).toBeGreaterThan(30);
      expect(tokenHash).toBeDefined();
      expect(tokenHash.length).toBe(64); // SHA-256 en hex

      // El hash debe ser determinista
      expect(hashMagicToken(rawToken)).toBe(tokenHash);

      // Expiración calculada a ~30 días
      const diffDays = (new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThanOrEqual(30.1);
    });

    it('dos llamadas a generateMagicLinkToken producen tokens y hashes únicos', () => {
      const res1 = generateMagicLinkToken();
      const res2 = generateMagicLinkToken();
      expect(res1.rawToken).not.toBe(res2.rawToken);
      expect(res1.tokenHash).not.toBe(res2.tokenHash);
    });
  });
});
