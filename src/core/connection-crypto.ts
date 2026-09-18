import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(value: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('A 32-byte CONNECTION_ENCRYPTION_KEY is required');
  return Buffer.from(value, 'hex');
}

export function encryptTokens(tokens: object, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(v => v.toString('base64')).join('.');
}

export function decryptTokens<T>(value: string, secret: string): T {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted credentials');
  const [iv, tag, data] = parts.map(v => Buffer.from(v, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key(secret), iv!);
  cipher.setAuthTag(tag!);
  return JSON.parse(Buffer.concat([cipher.update(data!), cipher.final()]).toString('utf8')) as T;
}
