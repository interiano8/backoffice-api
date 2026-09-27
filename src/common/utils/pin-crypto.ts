import * as crypto from 'crypto';

const PIN_AES_KEY = '~F9Q0Fmer?y0ritm';
const AES_PREFIX = 'aes:';

function getKeyIv(): { key: Buffer; iv: Buffer } {
  const key = Buffer.from(PIN_AES_KEY, 'utf8');
  return { key, iv: key };
}

export function encryptPin(pin: string): string {
  if (!pin) return '';
  const { key, iv } = getKeyIv();
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  cipher.setAutoPadding(true);
  let encrypted = cipher.update(pin, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return AES_PREFIX + encrypted;
}

export function decryptPin(stored: string): string {
  if (!stored || !stored.startsWith(AES_PREFIX)) return stored || '';
  const base64 = stored.substring(AES_PREFIX.length);
  const { key, iv } = getKeyIv();
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(base64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function isEncryptedPin(value: string): boolean {
  return value?.startsWith(AES_PREFIX) ?? false;
}
