import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword, readSession, signSession, validPassword, validUsername, verifyPassword } from './auth';

beforeAll(() => { process.env.SESSION_SECRET = 'x'.repeat(32); });

describe('Akun', () => {
  it('memverifikasi kata sandi hanya bila cocok', () => {
    const stored = hashPassword('rahasia123');
    expect(verifyPassword('rahasia123', stored)).toBe(true);
    expect(verifyPassword('rahasia124', stored)).toBe(false);
    expect(hashPassword('rahasia123')).not.toBe(stored);
  });

  it('menerima sesi bertanda tangan dan menolak yang diubah atau kedaluwarsa', () => {
    const token = signSession('aino_fan', 2000);
    expect(readSession(token, 1000)).toBe('aino_fan');
    expect(readSession(token, 2000)).toBeNull();
    expect(readSession(token.replace('aino_fan', 'lainnya'), 1000)).toBeNull();
    expect(readSession(signSession('aino_fan', 9000).replace('9000', '99999'), 1000)).toBeNull();
    expect(readSession(undefined)).toBeNull();
  });

  it('membatasi format username', () => {
    expect(validUsername('aino_fan')).toBe(true);
    expect(['ab', 'Aino', 'a.b', 'x'.repeat(31)].some(validUsername)).toBe(false);
  });

  it('membatasi panjang kata sandi', () => {
    expect(validPassword('x'.repeat(8))).toBe(true);
    expect(validPassword('x'.repeat(200))).toBe(true);
    expect(['x'.repeat(7), 'x'.repeat(201), ''].some(validPassword)).toBe(false);
  });
});
