import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD_RULES, passwordRuleResults, searchCities } from '@styleme/contracts';
import { decodeTokenClaims } from '../lib/api/server';
import { DRAFT_TTL_MS, parseDraft, serializeDraft } from '../lib/auth/draft';
import {
  authorizationUrl,
  encodeOAuthCookie,
  googleConfigured,
  newOAuthState,
  parseOAuthCookie,
  statesMatch,
} from '../lib/auth/google';
import { pathForStep } from '../lib/auth/session';
import { FEATURES, featureHref } from '../lib/features';

describe('registration draft (24 hours, no secrets)', () => {
  const draft = {
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    city: 'pune',
    phone: '98765 43210',
    marketingOptIn: true,
    rememberMe: false,
  };

  it('round-trips the allowed fields only — never passwords or consent', () => {
    const raw = serializeDraft({
      ...draft,
      password: 'Secret-123!',
      confirmPassword: 'Secret-123!',
      acceptTerms: true,
    } as never);
    expect(raw).not.toContain('Secret-123!');
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('acceptTerms');
    expect(parseDraft(raw)).toEqual(draft);
  });

  it('expires after 24 hours and ignores corrupt or future-dated data', () => {
    const now = Date.now();
    const raw = serializeDraft(draft, now);
    expect(parseDraft(raw, now + DRAFT_TTL_MS - 1000)).toEqual(draft);
    expect(parseDraft(raw, now + DRAFT_TTL_MS + 1)).toBeNull();
    expect(parseDraft(raw, now - 60_000)).toBeNull();
    expect(parseDraft('{not json', now)).toBeNull();
    expect(parseDraft(null, now)).toBeNull();
  });
});

describe('password checklist (D-87)', () => {
  it('reports each rule separately and has no strength score', () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual(['length', 'upper', 'lower', 'number', 'special']);
    expect(passwordRuleResults('').every((r) => !r.met)).toBe(true);
    expect(passwordRuleResults('abc').find((r) => r.id === 'lower')?.met).toBe(true);
    expect(passwordRuleResults('Correct-Horse-9').every((r) => r.met)).toBe(true);
    expect(Object.keys(passwordRuleResults('x')[0]!)).toEqual(['id', 'label', 'met']);
  });
});

describe('city search', () => {
  it('finds cities by name prefix and by state', () => {
    expect(searchCities('beng')[0]?.name).toBe('Bengaluru');
    expect(searchCities('kerala').length).toBeGreaterThan(0);
    expect(searchCities('zzzz')).toEqual([]);
  });
});

describe('Google OAuth on the web server (D-88)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.AUTH_URL = 'https://styleme.example';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('builds an authorization URL with PKCE (S256), state and nonce — and no client secret', () => {
    const state = newOAuthState('signup', { remember: true, terms: true, marketing: false });
    const url = new URL(authorizationUrl(state));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(state.verifier).digest('base64url'),
    );
    expect(url.searchParams.get('state')).toBe(state.state);
    expect(url.searchParams.get('nonce')).toBe(state.nonce);
    expect(url.searchParams.get('redirect_uri')).toBe('https://styleme.example/api/oauth/google/callback');
    expect(url.toString()).not.toContain('test-secret');
    expect(url.toString()).not.toContain(state.verifier);
  });

  it('state values are random, compared in constant time, and the cookie round-trips', () => {
    const a = newOAuthState('login', { remember: false, terms: false, marketing: false });
    const b = newOAuthState('login', { remember: false, terms: false, marketing: false });
    expect(a.state).not.toBe(b.state);
    expect(statesMatch(a.state, a.state)).toBe(true);
    expect(statesMatch(a.state, b.state)).toBe(false);
    expect(statesMatch(a.state, null)).toBe(false);
    expect(parseOAuthCookie(encodeOAuthCookie(a))).toEqual(a);
    expect(parseOAuthCookie('garbage')).toBeNull();
    expect(parseOAuthCookie(undefined)).toBeNull();
  });

  it('is reported as unavailable unless client ID, secret and URL are all configured', () => {
    expect(googleConfigured()).toBe(true);
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(googleConfigured()).toBe(false);
  });
});

describe('sessions and onboarding routing', () => {
  it('reads the Remember Me claim to size the cookie', () => {
    const token = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
    expect(decodeTokenClaims(token({ sub: 'u', exp: 1, rm: true }))?.rm).toBe(true);
    expect(decodeTokenClaims(token({ sub: 'u', exp: 1 }))?.rm).toBe(false);
    expect(decodeTokenClaims('nonsense')).toBeNull();
  });

  it('sends each onboarding step to its page and finished users to Personalized Home', () => {
    expect(pathForStep('set_password')).toBe('/onboarding/password');
    expect(pathForStep('style_profile')).toBe('/onboarding/style-profile');
    expect(pathForStep('appearance')).toBe('/onboarding/appearance');
    expect(pathForStep('complete')).toBe('/home');
  });
});

describe('dashboard sections', () => {
  it('lists the eight sections; only implemented ones link to a live page', () => {
    expect(FEATURES.map((f) => f.label)).toEqual([
      'Discover My Style',
      'My Colour Palette',
      'Outfit Categories',
      'Shop My Look',
      'Virtual Try-On',
      'Design Studio',
      'Style Assistant',
      'Saved Outfits',
    ]);
    const available = FEATURES.filter((f) => f.href);
    expect(available.map((f) => f.slug)).toEqual(['discover-my-style']);
    for (const f of FEATURES.filter((x) => !x.href)) expect(featureHref(f)).toBe(`/features/${f.slug}`);
  });
});
