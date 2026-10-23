import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DESIGN_NOTICE_VERSION, type ChatConversation, type ChatOverviewResponse } from '@styleme/contracts';
import { USER_OWNED_COLLECTIONS } from '../../src/models/index';
import { loadStyleLibrary } from '../../src/style-rules';
import { FakeDesignAnalysis, FakeImageGenerator } from '../fixtures/design-studio';
import { FakeAssistant } from '../fixtures/style-assistant';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import {
  bearer,
  login,
  logTextForPrivacyChecks,
  registerUser,
  startTestEnv,
  type AppOptions,
  type TestEnv,
} from '../helpers';

// Style Assistant (D-136): question → plan (Gemini fake, or keywords) → the feature runs for the user → reply
// (Gemini fake, or fixed wording) with the feature's results as cards, stored in the user's conversation.

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

const styleLibrary = loadStyleLibrary(buildEngineFixtureLibrary(), { allowFixtures: true });

async function signedIn(email: string, options: AppOptions = {}, overrides = {}) {
  const { app, mail } = env.makeApp(overrides, { styleLibrary, ...options });
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women', heightCm: 162 }).expect(200);
  return { app, mail, token };
}

async function ask(app: Express, token: string, message: string, conversationId?: string) {
  const res = await request(app)
    .post('/v1/chat')
    .set(bearer(token))
    .send({ message, ...(conversationId ? { conversationId } : {}) });
  return { res, conversation: res.body.data?.conversation as ChatConversation };
}

const last = (c: ChatConversation) => c.messages[c.messages.length - 1]!;

describe('/v1/chat (D-136)', () => {
  it('every endpoint requires a signed-in user', async () => {
    const { app } = env.makeApp();
    const id = '64b7f0c2a1b2c3d4e5f60718';
    for (const call of [
      request(app).get('/v1/chat'),
      request(app).post('/v1/chat'),
      request(app).post('/v1/chat/design'),
      request(app).get(`/v1/chat/conversations/${id}`),
      request(app).delete(`/v1/chat/conversations/${id}`),
      request(app).delete('/v1/chat/conversations'),
    ]) {
      expect((await call).status).toBe(401);
    }
  });

  it('with Gemini: plans from the words, runs Discover My Style and replies about the looks', async () => {
    const assistant = new FakeAssistant();
    const { app, token } = await signedIn('ai@example.com', { assistant });
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ skinTone: { value: { monkRange: '4-6' } }, undertone: { value: 'warm' } })
      .expect(200);

    const { res, conversation } = await ask(app, token, 'What should I wear to my cousin’s sangeet?');
    expect(res.status).toBe(200);
    expect(conversation.title).toBe('What should I wear to my cousin’s sangeet?');
    expect(conversation.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    const reply = last(conversation);
    expect(reply).toMatchObject({
      intent: 'looks',
      wording: 'ai',
      text: 'Synthetic fixture reply about the looks below.',
    });
    const card = reply.cards[0]!;
    expect(card.kind).toBe('looks');
    if (card.kind === 'looks') expect(card.looks.length).toBeGreaterThan(0);
    expect(reply.links).toContainEqual({ label: 'More options in Discover My Style', href: '/discover/looks' });

    // Gemini got the question only, then the looks' garments and colours: never height or appearance labels.
    expect(assistant.plans[0]).toEqual({ message: 'What should I wear to my cousin’s sangeet?', earlier: [] });
    const sent = JSON.stringify(assistant.replies[0]);
    expect(sent).toContain('wedding occasion');
    for (const value of ['162', 'undertone', 'Undertone', 'skin', '4-6', 'women']) expect(sent).not.toContain(value);
  });

  it('a follow-up continues the conversation and gives Gemini the earlier questions for context', async () => {
    const assistant = new FakeAssistant();
    const { app, token } = await signedIn('follow@example.com', { assistant });
    const first = await ask(app, token, 'Looks for a wedding');
    const second = await ask(app, token, 'Something more Indian', first.conversation.id);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.messages).toHaveLength(4);
    expect(assistant.plans[1]!.earlier).toEqual(['Looks for a wedding']);

    const overview = (await request(app).get('/v1/chat').set(bearer(token))).body.data as ChatOverviewResponse;
    expect(overview).toMatchObject({ aiAvailable: true, designAvailable: false });
    expect(overview.suggestions.length).toBeGreaterThan(0);
    expect(overview.conversations).toEqual([
      expect.objectContaining({ id: first.conversation.id, title: 'Looks for a wedding' }),
    ]);
  });

  it('without Gemini: the keyword matcher plans and fixed wording replies', async () => {
    const { app, token } = await signedIn('fixed@example.com');
    const overview = (await request(app).get('/v1/chat').set(bearer(token))).body.data as ChatOverviewResponse;
    expect(overview.aiAvailable).toBe(false);

    const { conversation } = await ask(app, token, 'Office outfit ideas please');
    expect(last(conversation)).toMatchObject({ intent: 'looks', wording: 'fixed' });
    expect(last(conversation).text).toContain('for work');

    const saved = await ask(app, token, 'Show my saved outfits', conversation.id);
    expect(last(saved.conversation)).toMatchObject({ intent: 'saved', cards: [] });
    expect(last(saved.conversation).text).toContain('haven’t saved any outfits');
  });

  it('when Gemini fails or replies with nonsense, the assistant still answers with fixed wording', async () => {
    const assistant = new FakeAssistant();
    assistant.planReply = { kind: 'fail', cause: 'timeout' };
    assistant.replyReply = { kind: 'reply', body: { nonsense: true } };
    const { app, token } = await signedIn('fail@example.com', { assistant });
    const { res, conversation } = await ask(app, token, 'Which colours suit me? Secret-question-text');
    expect(res.status).toBe(200);
    expect(last(conversation)).toMatchObject({ intent: 'colours', wording: 'fixed' });
    // No skin tone yet, so it points to My Profile instead of inventing colours.
    expect(last(conversation).links).toContainEqual({ label: 'Open My Profile', href: '/profile' });

    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).toContain('assistant_ai_skipped');
    expect(logs).not.toContain('Secret-question-text');
  });

  it('a design: offers it, then makes it in Design Studio once the user agrees to the notice', async () => {
    const assistant = new FakeAssistant();
    assistant.planReply = {
      kind: 'reply',
      body: { intent: 'design', designDescription: 'A teal cotton kurta with elbow-length puff sleeves' },
    };
    const analysis = new FakeDesignAnalysis();
    const { app, token } = await signedIn('design@example.com', {
      assistant,
      designAnalysis: analysis,
      imageGenerators: [new FakeImageGenerator('pollinations')],
    });

    const { conversation } = await ask(app, token, 'Design me a kurta with puff sleeves');
    expect(analysis.calls).toHaveLength(0);
    expect(last(conversation).cards).toEqual([
      { kind: 'design_offer', description: 'A teal cotton kurta with elbow-length puff sleeves' },
    ]);

    const noNotice = await request(app)
      .post('/v1/chat/design')
      .set(bearer(token))
      .send({ conversationId: conversation.id, description: 'A teal cotton kurta with puff sleeves' });
    expect(noNotice.status).toBe(400);

    const made = await request(app).post('/v1/chat/design').set(bearer(token)).send({
      conversationId: conversation.id,
      description: 'A teal cotton kurta with puff sleeves',
      notice: DESIGN_NOTICE_VERSION,
    });
    expect(made.status).toBe(201);
    const reply = last(made.body.data.conversation as ChatConversation);
    expect(reply.cards[0]).toMatchObject({ kind: 'design', design: { title: 'Fixture puff-sleeve kurta' } });
    expect(analysis.calls[0]!.brief).toContain('A teal cotton kurta with puff sleeves');
    expect(analysis.calls[0]!.brief).not.toContain('162');
    expect(await env.db.models.Design.countDocuments()).toBe(1);
  });

  it('says Design Studio is unavailable instead of offering a design when it is off', async () => {
    const { app, token } = await signedIn('nodesign@example.com');
    const { conversation } = await ask(app, token, 'Design a lehenga for my sister');
    expect(last(conversation)).toMatchObject({ intent: 'design', cards: [] });
    expect(last(conversation).text).toContain('Design Studio isn’t available');
  });

  it('shop: shows looks with a link to Shop My Look and never quotes prices', async () => {
    const assistant = new FakeAssistant();
    // No occasion and nothing saved yet, so it suggests everyday looks to shop.
    assistant.planReply = { kind: 'reply', body: { intent: 'shop' } };
    const { app, token } = await signedIn('shop@example.com', { assistant });
    const { conversation } = await ask(app, token, 'Where can I buy an outfit?');
    expect(last(conversation).links).toContainEqual({ label: 'Open Shop My Look', href: '/shop' });
    expect(last(conversation).cards[0]?.kind).toBe('looks');
    expect(JSON.stringify(assistant.replies[0]!.facts)).toContain('does not quote prices');
  });

  it('conversations are private, can be deleted, and go with the account (USER_OWNED_COLLECTIONS)', async () => {
    expect(USER_OWNED_COLLECTIONS).toContain('chatConversations');
    const { app, token, mail } = await signedIn('owner@example.com');
    const { conversation } = await ask(app, token, 'Hello');
    await ask(app, token, 'Help');

    await registerUser(app, env, mail, 'other@example.com');
    const other = await login(app, 'other@example.com');
    expect((await request(app).get(`/v1/chat/conversations/${conversation.id}`).set(bearer(other))).status).toBe(404);
    expect((await ask(app, other, 'Hi', conversation.id)).res.status).toBe(404);
    expect((await request(app).delete(`/v1/chat/conversations/${conversation.id}`).set(bearer(other))).status).toBe(
      404,
    );

    expect((await request(app).delete(`/v1/chat/conversations/${conversation.id}`).set(bearer(token))).status).toBe(
      200,
    );
    expect(await env.db.models.ChatConversation.countDocuments()).toBe(1);

    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('owner@example.com'), confirm: true })
      .expect(200);
    expect(await env.db.models.ChatConversation.countDocuments()).toBe(0);
  });

  it('rejects empty and over-long messages', async () => {
    const { app, token } = await signedIn('valid@example.com');
    expect((await ask(app, token, '   ')).res.status).toBe(400);
    expect((await ask(app, token, 'x'.repeat(501))).res.status).toBe(400);
  });
});
