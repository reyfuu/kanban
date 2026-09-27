import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'hk_session';

export const validUsername = (name: string) => /^[a-z0-9_]{3,30}$/.test(name);
export const validPassword = (password: string) => password.length >= 8 && password.length <= 200;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET belum diatur di server (minimal 32 karakter).', { cause: 'config' });
  return value;
}
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function signSession(username: string, expiresAt: number) {
  const payload = `${username}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the username for a valid, unexpired token, otherwise null. */
export function readSession(token: string | undefined, now = Date.now()) {
  const [username, expiry, signature] = token?.split('.') ?? [];
  if (!username || !expiry || !signature || !validUsername(username) || Number(expiry) <= now) return null;
  const expected = Buffer.from(sign(`${username}.${expiry}`));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? username : null;
}
