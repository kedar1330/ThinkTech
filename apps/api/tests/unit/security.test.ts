import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env';
import type { Models } from '../../src/models/index';
import { hashPassword, verifyPassword } from '../../src/services/passwords';
import { SessionService } from '../../src/services/sessions';
import { randomToken, safeEqual, sha256 } from '../../src/utils/crypto';
import { BASE_CONFIG, withoutDotenvFiles } from '../helpers';

const SECRET = BASE_CONFIG.AUTH_ACCESS_TOKEN_SECRET;

describe('reset and session tokens', () => {
  it('randomToken has at least 128 bits and is URL-safe; values differ', () => {
    const a = randomToken();
    expect(Buffer.from(a, 'base64url').length).toBeGreaterThanOrEqual(16);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(randomToken()).not.toBe(a);
  });

  it('sha256 and safeEqual behave as expected', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(safeEqual('same', 'same')).toBe(true);
    expect(safeEqual('same', 'diff')).toBe(false);
    expect(safeEqual('short', 'longer-value')).toBe(false);
  });

  it('verifyToken accepts only HS256 tokens signed with the secret and carrying sub, tv and sid', () => {
    const sessions = new SessionService({} as Models, SECRET);
    const good = jwt.sign({ sub: 'u1', tv: 0, sid: 's1' }, SECRET, { algorithm: 'HS256', expiresIn: 60 });
    expect(sessions.verifyToken(good)).toEqual({ sub: 'u1', tv: 0, sid: 's1' });

    const expired = jwt.sign({ sub: 'u1', tv: 0, sid: 's1', exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
    const wrongSecret = jwt.sign({ sub: 'u1', tv: 0, sid: 's1' }, `${SECRET}-other`);
    const hs512 = jwt.sign({ sub: 'u1', tv: 0, sid: 's1' }, SECRET, { algorithm: 'HS512' });
    const missingSid = jwt.sign({ sub: 'u1', tv: 0 }, SECRET, { algorithm: 'HS256' });
    for (const t of [expired, wrongSecret, hs512, missingSid, 'garbage']) expect(sessions.verifyToken(t)).toBeNull();
  });
});

describe('passwords', () => {
  it('hashes with argon2id and verifies', async () => {
    const hash = await hashPassword('a long passphrase');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'a long passphrase')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('config', () => {
  it('rejects missing or weak secrets and reports names only', () =>
    withoutDotenvFiles(() => {
      expect(() => loadConfig({ APP_ENV: 'local' })).toThrow(/MONGODB_URI/);
      const env = {
        APP_ENV: 'local',
        MONGODB_URI: 'mongodb://x',
        TOMBSTONE_STORE_URI: 'mongodb://y',
        TOMBSTONE_HMAC_KEY: 'too-short',
        AUTH_ACCESS_TOKEN_SECRET: BASE_CONFIG.AUTH_ACCESS_TOKEN_SECRET,
        BFF_SHARED_SECRET: BASE_CONFIG.BFF_SHARED_SECRET,
        WEB_ORIGIN: 'http://localhost:3000',
      };
      expect(() => loadConfig(env)).toThrow(/TOMBSTONE_HMAC_KEY/);
      expect(() => loadConfig(env)).not.toThrow(/too-short/);
      const ok = loadConfig({ ...env, TOMBSTONE_HMAC_KEY: BASE_CONFIG.TOMBSTONE_HMAC_KEY });
      // Public sign-up (with email-code verification) is the default; operators can turn it off.
      expect(ok.PUBLIC_SIGNUP_ENABLED).toBe(true);
      expect(
        loadConfig({ ...env, TOMBSTONE_HMAC_KEY: BASE_CONFIG.TOMBSTONE_HMAC_KEY, PUBLIC_SIGNUP_ENABLED: 'false' })
          .PUBLIC_SIGNUP_ENABLED,
      ).toBe(false);
      expect(ok.GOOGLE_CLIENT_ID).toBeUndefined();
      expect(ok.SMTP_URL).toBeUndefined();
      expect(ok.MAINTENANCE_MODE).toBe(false);
    }));
});
