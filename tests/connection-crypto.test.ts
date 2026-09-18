import { describe, expect, it } from 'vitest';
import { encryptTokens, decryptTokens } from '../src/core/connection-crypto.js';

describe('connection token encryption', () => {
  const key = 'ab'.repeat(32);
  it('encrypts tokens with a fresh nonce', () => {
    const tokens = { refresh_token: 'private-refresh', access_token: 'private-access', expiry_date: 123 };
    const encrypted = encryptTokens(tokens, key);
    expect(encrypted).not.toContain('private');
    expect(decryptTokens(encrypted, key)).toEqual(tokens);
    expect(encryptTokens(tokens, key)).not.toBe(encrypted);
  });
  it('rejects tampering, wrong keys and malformed configuration', () => {
    const encrypted = encryptTokens({ refresh_token: 'secret' }, key);
    expect(() => decryptTokens(encrypted, 'cd'.repeat(32))).toThrow();
    const parts = encrypted.split('.'); parts[1] = Buffer.alloc(16).toString('base64');
    expect(() => decryptTokens(parts.join('.'), key)).toThrow();
    expect(() => encryptTokens({}, 'short')).toThrow();
    expect(() => decryptTokens('invalid', key)).toThrow();
  });
});
