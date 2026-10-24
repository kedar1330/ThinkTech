import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AdminDashboardResponse, AdminMeResponse, AdminUsersResponse } from '@styleme/contracts';
import { seedAdmin } from '../../src/services/admin-seed';
import { loadStyleLibrary } from '../../src/style-rules';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { BASE_CONFIG, PASSWORD, bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});
beforeEach(async () => {
  await env.reset();
});

const SECRET = BASE_CONFIG.AUTH_ACCESS_TOKEN_SECRET;
const styleLibrary = loadStyleLibrary(buildEngineFixtureLibrary(), { allowFixtures: true });

async function createAdmin(app: Express, email = 'admin@example.com') {
  await seedAdmin(env.db.models, SECRET, { email, password: PASSWORD, name: 'System Admin' });
  const token = await login(app, email, PASSWORD);
  return { token };
}

describe('/v1/admin (FR-ADM, D-120)', () => {
  it('unauthenticated requests are refused with 401', async () => {
    const { app } = env.makeApp();
    const res = await request(app).get('/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('normal user accounts are forbidden with 403', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'user@example.com');
    const token = await login(app, 'user@example.com');

    const res = await request(app).get('/v1/admin/dashboard').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('admin account can fetch /admin/me and /admin/dashboard', async () => {
    const { app } = env.makeApp({}, { styleLibrary });
    const { token } = await createAdmin(app, 'admin@example.com');

    const meRes = await request(app).get('/v1/admin/me').set(bearer(token));
    expect(meRes.status).toBe(200);
    const me = meRes.body.data as AdminMeResponse;
    expect(me.email).toBe('admin@example.com');
    expect(me.role).toBe('super_admin');
    expect(me.permissions).toContain('dashboard.view');

    const dashRes = await request(app).get('/v1/admin/dashboard').set(bearer(token));
    expect(dashRes.status).toBe(200);
    const dashboard = dashRes.body.data as AdminDashboardResponse;
    expect(dashboard.stats.totalUsers).toBeGreaterThanOrEqual(1);
    expect(dashboard.stats.activeUsers).toBeGreaterThanOrEqual(1);
  });

  it('lists users and allows suspending and reactivating a user', async () => {
    const { app, mail } = env.makeApp({}, { styleLibrary });
    const { token: adminToken } = await createAdmin(app, 'admin2@example.com');

    // Register a normal user
    await registerUser(app, env, mail, 'target@example.com');
    const targetUser = await env.db.models.User.findOne({ email: 'target@example.com' });
    expect(targetUser).not.toBeNull();
    const targetId = String(targetUser!._id);
    const originalTokenVersion = targetUser!.tokenVersion;

    // View users list (FR-ADM-06: passwords, photos, measurements never returned)
    const listRes = await request(app).get('/v1/admin/users').set(bearer(adminToken));
    expect(listRes.status).toBe(200);
    const usersData = listRes.body.data as AdminUsersResponse;
    const found = usersData.users.find((u) => u.email === 'target@example.com');
    expect(found).toBeDefined();
    expect(found?.isActive).toBe(true);

    // Suspend user
    const suspendRes = await request(app)
      .post(`/v1/admin/users/${targetId}/status`)
      .set(bearer(adminToken))
      .send({ isActive: false, reason: 'Testing suspension' });
    expect(suspendRes.status).toBe(200);

    const updated = await env.db.models.User.findById(targetId);
    expect(updated?.isActive).toBe(false);
    expect(updated?.tokenVersion).toBe(originalTokenVersion + 1);

    // Audit log was created
    const auditRes = await request(app).get('/v1/admin/audit-logs').set(bearer(adminToken));
    expect(auditRes.status).toBe(200);
    expect(
      auditRes.body.data.logs.some(
        (l: { action: string; targetId: string }) => l.action === 'USER_SUSPENDED' && l.targetId === targetId,
      ),
    ).toBe(true);

    // Reactivate user
    const reactivateRes = await request(app)
      .post(`/v1/admin/users/${targetId}/status`)
      .set(bearer(adminToken))
      .send({ isActive: true });
    expect(reactivateRes.status).toBe(200);

    const reactivated = await env.db.models.User.findById(targetId);
    expect(reactivated?.isActive).toBe(true);
  });

  it('allows viewing catalogue items and updating status', async () => {
    const { app } = env.makeApp({}, { styleLibrary });
    const { token } = await createAdmin(app, 'admin3@example.com');

    const catRes = await request(app).get('/v1/admin/catalogue').set(bearer(token));
    expect(catRes.status).toBe(200);
    expect(Array.isArray(catRes.body.data.items)).toBe(true);

    const updateRes = await request(app)
      .post('/v1/admin/catalogue/category/test-cat/status')
      .set(bearer(token))
      .send({ status: 'archived' });
    expect(updateRes.status).toBe(200);

    const audit = await env.db.models.AdminAuditLog.findOne({ targetId: 'test-cat' });
    expect(audit).not.toBeNull();
    expect(audit?.action).toBe('ARCHIVED');
  });
});
