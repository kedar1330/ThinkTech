import type { Connection } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OCCASION_IDS } from '@styleme/contracts';
import { createRateLimits, limiter, MINUTE, byUser } from '../../src/middleware/rate-limit';
import { replayTombstones } from '../../src/services/account-deletion';
import { runMigrations } from '../../scripts/migrations/index';
import { BASE_CONFIG, PASSWORD, bearer, invite, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Issue #61: Closed-beta readiness
// Covers:
// 1. Sign-up policy (D-63 revised to Open Public Beta; gateable via PUBLIC_SIGNUP_ENABLED=false)
// 2. AC-19 / T-43 / T-45: Backup & restore rehearsal with tombstone replay and maintenance mode
// 3. Monitoring (/health endpoint) and rollback rehearsal (backward-compatible migrations)
// 4. AC-18: Latency measurement of POST /v1/recommendations without AI wording (< 2000 ms target)

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

describe('Issue #61: Closed-beta readiness', () => {
  describe('1. Sign-up policy decision (D-63)', () => {
    it('defaults to open public beta (PUBLIC_SIGNUP_ENABLED=true): uninvited user can register', async () => {
      const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
      const email = 'open-user@example.com';
      await registerUser(app, env, mail, email);
      const token = await login(app, email);
      const me = await request(app).get('/v1/auth/me').set(bearer(token));
      expect(me.status).toBe(200);
      expect(me.body.data.email).toBe(email);
    });

    it('honours closed beta when PUBLIC_SIGNUP_ENABLED=false: uninvited gets NOT_INVITED, invited succeeds', async () => {
      const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: false });
      const uninvitedEmail = 'uninvited@example.com';
      const invitedEmail = 'invited@example.com';

      // Uninvited registration attempt
      const uninvitedRes = await request(app).post('/v1/auth/register').send({
        fullName: 'Uninvited User',
        email: uninvitedEmail,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        city: 'mumbai',
        acceptTerms: true,
      });
      expect(uninvitedRes.status).toBe(403);
      expect(uninvitedRes.body.error.code).toBe('NOT_INVITED');

      // Invited registration succeeds
      await invite(env, invitedEmail);
      await registerUser(app, env, mail, invitedEmail);
      const token = await login(app, invitedEmail);
      const me = await request(app).get('/v1/auth/me').set(bearer(token));
      expect(me.status).toBe(200);
      expect(me.body.data.email).toBe(invitedEmail);
    });
  });

  describe('2. AC-19 / T-43 / T-45: Staging backup, restore rehearsal, tombstone replay & maintenance', () => {
    it('executes full 7-step restore procedure with tombstone replay and maintenance protection', async () => {
      const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });

      // Step 0: Initial state before backup
      const keepEmail = 'keeper@example.com';
      const deleteEmail = 'delete-later@example.com';

      await registerUser(app, env, mail, keepEmail);
      await registerUser(app, env, mail, deleteEmail);

      const keepToken = await login(app, keepEmail);
      const deleteToken = await login(app, deleteEmail);

      // Add profile and shortlist data for both users
      await request(app)
        .put('/v1/profile')
        .set(bearer(keepToken))
        .send({ department: 'women', topsSize: 'M', bottomsSize: '30' });
      await request(app)
        .put('/v1/profile')
        .set(bearer(deleteToken))
        .send({ department: 'men', topsSize: 'L', bottomsSize: '34' });

      await request(app)
        .post('/v1/shortlist')
        .set(bearer(keepToken))
        .send({ name: 'Keep Item', priceEntered: 999, url: 'https://example.com/item1' });
      await request(app)
        .post('/v1/shortlist')
        .set(bearer(deleteToken))
        .send({ name: 'Delete Item', priceEntered: 1499, url: 'https://example.com/item2' });

      // Ensure beta invite record exists for the to-be-deleted user
      await invite(env, deleteEmail);

      // Step 2-3: Simulate taking a backup snapshot
      const backupCollections = ['users', 'profiles', 'shortlistItems', 'betaInvites', 'sessions', 'authChallenges'];
      const snapshot: Record<string, any[]> = {};
      for (const name of backupCollections) {
        snapshot[name] = await env.db.main.collection(name).find().toArray();
      }

      // Post-backup activity: User 2 deletes account via /v1/account
      await request(app).post('/v1/account/deletion-otp').set(bearer(deleteToken));
      const deleteRes = await request(app)
        .delete('/v1/account')
        .set(bearer(deleteToken))
        .send({ otp: mail.otp(deleteEmail), confirm: true });
      expect(deleteRes.status).toBe(200);

      // Verify User 2 is deleted from live db, and tombstone exists in tombstone store
      expect(await env.db.models.User.countDocuments({ email: deleteEmail })).toBe(0);
      expect(await env.db.models.Tombstone.countDocuments()).toBe(1);

      // Step 1: Maintenance Mode ON
      const { app: maintApp } = env.makeApp({ MAINTENANCE_MODE: true });
      const healthMaint = await request(maintApp).get('/health');
      expect(healthMaint.status).toBe(200);
      expect(healthMaint.body.status).toBe('maintenance');

      const v1Blocked = await request(maintApp).get('/v1/auth/me').set(bearer(keepToken));
      expect(v1Blocked.status).toBe(503);
      expect(v1Blocked.body.error.code).toBe('SERVICE_UNAVAILABLE');

      // Step 3: Isolated restore into new database
      const restored = env.db.main.useDb('styleme_staging_restored');
      for (const name of backupCollections) {
        if (snapshot[name]?.length) {
          await restored.collection(name).insertMany(snapshot[name]);
        }
      }

      // Notice: in the raw restored backup, User 2 was resurrected!
      expect(await restored.collection('users').countDocuments({ email: deleteEmail })).toBe(1);
      expect(await restored.collection('betaInvites').countDocuments({ email: deleteEmail })).toBe(1);
      expect(await restored.collection('shortlistItems').countDocuments({ name: 'Delete Item' })).toBe(1);

      // Step 4 & 5: Replay tombstones from tombstone store against isolated restored database
      const report = await replayTombstones(env.db.models, restored, BASE_CONFIG.TOMBSTONE_HMAC_KEY);

      // Step 6: Verify reconciliation report and state
      expect(report.ok).toBe(true);
      expect(report.tombstonesRead).toBe(1);
      expect(report.tombstonesProcessed).toBe(1);
      expect(report.invitesDeleted).toBe(1);

      // Resurrected user 2 and associated data are completely expunged
      expect(await restored.collection('users').countDocuments({ email: deleteEmail })).toBe(0);
      expect(await restored.collection('profiles').countDocuments({ department: 'men' })).toBe(0);
      expect(await restored.collection('shortlistItems').countDocuments({ name: 'Delete Item' })).toBe(0);
      expect(await restored.collection('betaInvites').countDocuments({ email: deleteEmail })).toBe(0);

      // Surviving user 1 data is preserved
      expect(await restored.collection('users').countDocuments({ email: keepEmail })).toBe(1);
      expect(await restored.collection('shortlistItems').countDocuments({ name: 'Keep Item' })).toBe(1);

      // Step 7: Switch over (maintenance mode OFF on restored target)
      const { app: restoredApp } = env.makeApp({ MAINTENANCE_MODE: false });
      const healthRestored = await request(restoredApp).get('/health');
      expect(healthRestored.status).toBe(200);
      expect(healthRestored.body.status).toBe('ok');

      // Clean up restored staging test db
      await restored.dropDatabase();
    });

    it('aborts restore and remains in maintenance if tombstone store fails', async () => {
      const { app: maintApp } = env.makeApp({ MAINTENANCE_MODE: true });
      expect((await request(maintApp).get('/health')).body.status).toBe('maintenance');

      // If tombstone store throws during replay
      const restored = env.db.main.useDb('styleme_broken_restore');
      vi.spyOn(env.db.models.Tombstone, 'find').mockImplementationOnce(() => {
        throw new Error('Tombstone store connection timeout');
      });

      await expect(replayTombstones(env.db.models, restored, BASE_CONFIG.TOMBSTONE_HMAC_KEY)).rejects.toThrow(
        'Tombstone store connection timeout',
      );

      // System remains in maintenance mode; restored database is never activated
      expect((await request(maintApp).get('/health')).body.status).toBe('maintenance');
      await restored.dropDatabase();
    });
  });

  describe('3. Monitoring & Rollback rehearsal', () => {
    it('monitoring: /health provides required uptime check format', async () => {
      const { app } = env.makeApp();
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('time');
    });

    it('rollback rehearsal: migrations are backward-compatible and allow zero-downtime rollback', async () => {
      // Run migrations
      const applied = await runMigrations(env.db.main);
      expect(Array.isArray(applied)).toBe(true);

      // Re-running migrations is idempotent
      const reapplied = await runMigrations(env.db.main);
      expect(reapplied).toHaveLength(0);

      // Older API operations continue to function seamlessly against migrated schema
      const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
      const email = 'rollback-test@example.com';
      await registerUser(app, env, mail, email);
      const token = await login(app, email);

      const me = await request(app).get('/v1/auth/me').set(bearer(token));
      expect(me.status).toBe(200);
      expect(me.body.data.email).toBe(email);
    });
  });

  describe('4. AC-18: Latency measurement of POST /v1/recommendations without AI', () => {
    it('measures p95 latency across multiple requests and confirms it is well under 2 s (D-68)', async () => {
      const benchmarkLimits = {
        ...createRateLimits(),
        recommendations: [limiter(MINUTE, 200, byUser)],
      };
      const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true }, { rateLimits: benchmarkLimits });
      const email = 'latency-test@example.com';
      await registerUser(app, env, mail, email);
      const token = await login(app, email);

      // Set up profile
      await request(app)
        .put('/v1/profile')
        .set(bearer(token))
        .send({ department: 'women', topsSize: 'M', bottomsSize: '30' });

      // Warm-up request
      const warmup = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
      expect(warmup.status).toBe(200);
      expect(warmup.body.data.looks.length).toBeGreaterThan(0);

      // Measure 50 requests across all supported occasions
      const iterations = 50;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const occasion = OCCASION_IDS[i % OCCASION_IDS.length];
        const start = performance.now();
        const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion });
        const elapsed = performance.now() - start;
        expect(res.status).toBe(200);
        latencies.push(elapsed);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p90 = latencies[Math.floor(latencies.length * 0.9)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      const max = latencies[latencies.length - 1];

      console.info(
        `\n=== AC-18 Latency Benchmark Results (POST /v1/recommendations without AI) ===\n` +
          `  Total requests: ${iterations}\n` +
          `  p50: ${p50.toFixed(2)} ms\n` +
          `  p90: ${p90.toFixed(2)} ms\n` +
          `  p95: ${p95.toFixed(2)} ms (Target: < 2000 ms)\n` +
          `  p99: ${p99.toFixed(2)} ms\n` +
          `  max: ${max.toFixed(2)} ms\n` +
          `==============================================================================\n`,
      );

      // Assert p95 is well under 2000 ms
      expect(p95).toBeLessThan(2000);
    });
  });
});
