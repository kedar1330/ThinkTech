import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** A URL-safe random token from a CSPRNG. 32 bytes = 256 bits (≥ 128 required, D-83). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256(key: string, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
