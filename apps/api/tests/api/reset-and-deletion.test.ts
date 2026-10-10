import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_MESSAGES } from '@styleme/contracts';
import { replayTombstones } from '../../src/services/account-deletion';
import { hmacSha256, sha256 } from '../../src/utils/crypto';
import {
  BASE_CONFIG,
  PASSWORD,
  RecordingEmailSender,
  bearer,
  login,
  registerUser,
  startTestEnv,
  type TestEnv,
} from '../helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});
beforeEach(async () => {
  await env.reset();
  vi.restoreAllMocks();
});

async function userId(email: string) {
  return (await env.db.models.User.findOne({ email }).lean())!._id;
}

const NEW_PASSWORD = 'my chosen new password';

describe('password reset', () => {
  it('T-40: admin-issued code — user sets the password; all sessions revoked; code and password never logged', async () => {
    const { app, authService } = env.makeApp();
    await registerUser(app, env, 'qi@example.com');
    const token = await login(app, 'qi@example.com');
    const admin = await registerUser(app, env, 'admin@example.com');
    await env.db.models.User.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } });

    const code = await authService.issueResetToken(
      await userId('qi@example.com'),
      'admin_issued',
      await userId(admin.email),
    );
    expect(code.length).toBeGreaterThanOrEqual(22); // ≥ 128 bits, base64url
    const stored = await env.db.models.PasswordResetToken.findOne().lean();
    expect(stored?.tokenHash).toBe(sha256(code));
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(stored!.expiresAt.getTime() - stored!.createdAt.getTime()).toBe(60 * 60 * 1000);

    const res = await request(app)
      .post('/v1/auth/password-reset/confirm')
      .send({ token: code, newPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ reset: true });
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(401);
    await login(app, 'qi@example.com', NEW_PASSWORD);

    const logs = env.logLines.join('\n');
    expect(logs).toContain('password_reset_token_issued');
    expect(logs).not.toContain(code);
    expect(logs).not.toContain(NEW_PASSWORD);
  });

  it('T-41: unknown, used, expired and superseded tokens get one generic error; then RATE_LIMITED', async () => {
    const { app, authService } = env.makeApp();
    await registerUser(app, env, 'ra@example.com');
    const id = await userId('ra@example.com');
    const confirm = (token: string) =>
      request(app).post('/v1/auth/password-reset/confirm').send({ token, newPassword: NEW_PASSWORD });

    const superseded = await authService.issueResetToken(id, 'admin_issued');
    const used = await authService.issueResetToken(id, 'admin_issued');
    expect((await confirm(used)).status).toBe(200);
    const expired = await authService.issueResetToken(id, 'admin_issued');
    await env.db.models.PasswordResetToken.updateOne(
      { tokenHash: sha256(expired) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const responses = [];
    for (const token of ['x'.repeat(43), used, expired, superseded]) responses.push(await confirm(token));
    for (const res of responses) {
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({ code: 'INVALID_REQUEST', message: AUTH_MESSAGES.resetTokenInvalid });
    }
    // 10 per hour per IP: 5 used so far.
    for (let i = 0; i < 5; i += 1) expect((await confirm('y'.repeat(43))).status).toBe(400);
    expect((await confirm('y'.repeat(43))).status).toBe(429);
  });

  it('T-41: two concurrent redemptions of one token — exactly one succeeds', async () => {
    const { app, authService } = env.makeApp();
    await registerUser(app, env, 'sa@example.com');
    const token = await authService.issueResetToken(await userId('sa@example.com'), 'admin_issued');
    const [a, b] = await Promise.all([
      request(app).post('/v1/auth/password-reset/confirm').send({ token, newPassword: NEW_PASSWORD }),
      request(app).post('/v1/auth/password-reset/confirm').send({ token, newPassword: 'a different password' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });

  it('T-42: reset request disabled during the beta → FORBIDDEN with the beta message', async () => {
    const { app } = env.makeApp();
    const res = await request(app).post('/v1/auth/password-reset/request').send({ email: 'anyone@example.com' });
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: AUTH_MESSAGES.resetEmailDisabled });
  });

  it('T-42: reset request enabled → identical 202 for known and unknown emails; one email, token in the URL fragment', async () => {
    const sender = new RecordingEmailSender();
    const { app } = env.makeApp({ PASSWORD_RESET_EMAIL_ENABLED: true }, sender);
    await registerUser(app, env, 'tu@example.com');
    await registerUser(app, env, 'inactive@example.com');
    await env.db.models.User.updateOne({ email: 'inactive@example.com' }, { $set: { isActive: false } });

    const known = await request(app).post('/v1/auth/password-reset/request').send({ email: 'tu@example.com' });
    const unknown = await request(app).post('/v1/auth/password-reset/request').send({ email: 'ghost@example.com' });
    const inactive = await request(app).post('/v1/auth/password-reset/request').send({ email: 'inactive@example.com' });
    for (const res of [known, unknown, inactive]) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ success: true, data: { accepted: true } });
    }
    await vi.waitFor(() => expect(sender.sent).toHaveLength(1));
    const [mail] = sender.sent;
    expect(mail!.to).toBe('tu@example.com');
    expect(mail!.link.startsWith(`${BASE_CONFIG.WEB_ORIGIN}/reset-password#token=`)).toBe(true);
    expect(mail!.link).not.toContain('?');

    const token = mail!.link.split('#token=')[1]!;
    const stored = await env.db.models.PasswordResetToken.findOne({ tokenHash: sha256(token) }).lean();
    expect(stored!.purpose).toBe('self_service');
    expect(stored!.expiresAt.getTime() - stored!.createdAt.getTime()).toBe(30 * 60 * 1000);
    expect(env.logLines.join('\n')).not.toContain(token);

    // 3 per hour per email.
    for (let i = 0; i < 2; i += 1) {
      expect(
        (await request(app).post('/v1/auth/password-reset/request').send({ email: 'tu@example.com' })).status,
      ).toBe(202);
    }
    expect((await request(app).post('/v1/auth/password-reset/request').send({ email: 'tu@example.com' })).status).toBe(
      429,
    );
  });
});

describe('account deletion and tombstones', () => {
  it('T-06: deletion writes a minimal tombstone first, then removes all account data; tokens rejected', async () => {
    const { app, authService } = env.makeApp();
    const user = await registerUser(app, env, 'Va@Example.com');
    const token = await login(app, 'va@example.com');
    await authService.issueResetToken(await userId('va@example.com'), 'admin_issued');

    const wrong = await request(app).delete('/v1/account').set(bearer(token)).send({ password: 'not my password' });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('PASSWORD_INCORRECT');
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(200);

    const res = await request(app).delete('/v1/account').set(bearer(token)).send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deleted: true });

    const tombstones = await env.db.models.Tombstone.find().lean();
    expect(tombstones).toHaveLength(1);
    const t = tombstones[0]!;
    expect(Object.keys(t).sort()).toEqual(['__v', '_id', 'deletedAt', 'emailHmac', 'expiresAt', 'source', 'userId']);
    expect(String(t.userId)).toBe(user.id);
    expect(t.emailHmac).toBe(hmacSha256(BASE_CONFIG.TOMBSTONE_HMAC_KEY, 'va@example.com'));
    expect(t.source).toBe('self_service');
    expect(Math.round((t.expiresAt.getTime() - t.deletedAt.getTime()) / 86_400_000)).toBe(37);

    expect(await env.db.models.User.countDocuments()).toBe(0);
    expect(await env.db.models.Session.countDocuments()).toBe(0);
    expect(await env.db.models.PasswordResetToken.countDocuments()).toBe(0);
    expect(await env.db.models.BetaInvite.countDocuments()).toBe(0);
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(401);
    expect(
      (await request(app).post('/v1/auth/login').send({ email: 'va@example.com', password: PASSWORD })).status,
    ).toBe(401);
  });

  it('T-44: tombstone store unavailable → SERVICE_UNAVAILABLE and nothing is deleted', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'wu@example.com');
    const token = await login(app, 'wu@example.com');
    vi.spyOn(env.db.models.Tombstone, 'create').mockRejectedValueOnce(new Error('tombstone store down'));

    const res = await request(app).delete('/v1/account').set(bearer(token)).send({ password: PASSWORD });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(await env.db.models.User.countDocuments({ email: 'wu@example.com' })).toBe(1);
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(200);
  });

  it('T-44: deletion failing partway after the tombstone → reconciliation replay completes it', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'xe@example.com');
    const token = await login(app, 'xe@example.com');
    const realCollection = env.db.main.collection.bind(env.db.main);
    vi.spyOn(env.db.main, 'collection').mockImplementation(((name: string) => {
      if (name === 'users') return { deleteOne: () => Promise.reject(new Error('primary stepped down')) };
      return realCollection(name);
    }) as typeof env.db.main.collection);

    const res = await request(app).delete('/v1/account').set(bearer(token)).send({ password: PASSWORD });
    expect(res.status).toBe(500);
    expect(await env.db.models.Session.countDocuments()).toBe(0); // sessions go first
    expect(await env.db.models.User.countDocuments()).toBe(1);
    vi.restoreAllMocks();

    const report = await replayTombstones(env.db.models, env.db.main, BASE_CONFIG.TOMBSTONE_HMAC_KEY);
    expect(report.ok).toBe(true);
    expect(await env.db.models.User.countDocuments()).toBe(0);
    // Idempotent.
    expect((await replayTombstones(env.db.models, env.db.main, BASE_CONFIG.TOMBSTONE_HMAC_KEY)).ok).toBe(true);
  });

  it('T-43 (service level): replay against a restored copy deletes accounts deleted after the backup', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'ya@example.com');
    await registerUser(app, env, 'keep@example.com');
    const token = await login(app, 'ya@example.com');

    // "Backup": copy the main database into an isolated restore database.
    const restored = env.db.main.useDb('styleme_restored');
    for (const name of ['users', 'betaInvites', 'sessions']) {
      const docs = await env.db.main.collection(name).find().toArray();
      if (docs.length) await restored.collection(name).insertMany(docs);
    }
    // Deleted after the backup was taken.
    expect((await request(app).delete('/v1/account').set(bearer(token)).send({ password: PASSWORD })).status).toBe(200);
    expect(await restored.collection('users').countDocuments({ email: 'ya@example.com' })).toBe(1);

    const report = await replayTombstones(env.db.models, restored, BASE_CONFIG.TOMBSTONE_HMAC_KEY);
    expect(report).toMatchObject({ tombstonesRead: 1, tombstonesProcessed: 1, invitesDeleted: 1, ok: true });
    expect(await restored.collection('users').countDocuments({ email: 'ya@example.com' })).toBe(0);
    expect(await restored.collection('betaInvites').countDocuments({ email: 'ya@example.com' })).toBe(0);
    expect(await restored.collection('users').countDocuments({ email: 'keep@example.com' })).toBe(1);
    expect(JSON.stringify(report)).not.toContain('@');
    await restored.dropDatabase();
  });
});
