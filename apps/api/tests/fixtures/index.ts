import type { RawLibrary } from '../../src/style-rules';
import {
  buildEngineFixtureLibrary,
  buildFixtureLibrary,
  fixtureFabricRule,
  fixturePalette,
  fixtureStylingRule,
  fixtureTemplate,
} from './style-library';
import { buildProfile, edgeCaseProfiles, evaluationProfile } from './profiles';
import { FakeWordingProvider, faithfulReply, type FakeReply } from './wording';

/**
 * Fixture helpers for tests (issue #52, D-78).
 * Ensures test documents are marked `isFixture: true` so they can be identified,
 * kept separate from real data, and rejected by startup and script guards in production (T-29, T-30).
 */

/** Marks any document or object as a test fixture (`isFixture: true`). */
export function makeFixture<T extends Record<string, unknown>>(data: T): T & { isFixture: true } {
  return { ...data, isFixture: true };
}

/** Marks every document in an array as a test fixture. */
export function makeFixtures<T extends Record<string, unknown>>(items: T[]): Array<T & { isFixture: true }> {
  return items.map(makeFixture);
}

/** Builds a fixture user object with `isFixture: true`. */
export function makeFixtureUser(overrides: Record<string, unknown> = {}) {
  return makeFixture({
    email: `fixture-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    name: 'Fixture User',
    role: 'user' as const,
    isActive: true,
    tokenVersion: 0,
    ...overrides,
  });
}

/** Builds a fixture profile document with `isFixture: true`. */
export function makeFixtureProfile(userId: unknown, overrides: Record<string, unknown> = {}) {
  return makeFixture({
    userId,
    department: 'women' as const,
    likedColors: ['navy'],
    dislikedColors: [],
    ...overrides,
  });
}

/** Builds a fixture outfit document with `isFixture: true`. */
export function makeFixtureOutfit(userId: unknown, overrides: Record<string, unknown> = {}) {
  return makeFixture({
    userId,
    status: 'saved' as const,
    recommendationId: '000000000000000000000001',
    templateId: 'TPL-001',
    paletteId: 'PAL-001',
    slots: [],
    explanation: 'Fixture look explanation',
    explanationRefs: [],
    combinationSignature: 'sig-001',
    contentVersion: '1.0.0',
    request: { occasion: 'everyday' },
    inputsUsed: { department: 'women' },
    ...overrides,
  });
}

/** Builds a fixture shortlist item document with `isFixture: true`. */
export function makeFixtureShortlistItem(userId: unknown, overrides: Record<string, unknown> = {}) {
  return makeFixture({
    userId,
    name: 'Fixture Item',
    category: 'top',
    priceEntered: 1000,
    currency: 'INR' as const,
    priceBasis: 'user_entered' as const,
    ...overrides,
  });
}

/** Builds a fixture beta invite document with `isFixture: true`. */
export function makeFixtureBetaInvite(email: string, overrides: Record<string, unknown> = {}) {
  return makeFixture({
    email,
    invitedAt: new Date(),
    ...overrides,
  });
}

/** A small, valid synthetic fixture library (2 palettes, 2 rules, 1 fabric rule, 3 templates). */
export function smallLibrary(): RawLibrary {
  return {
    palettes: [fixturePalette(1), fixturePalette(2)],
    stylingRules: [fixtureStylingRule(1), fixtureStylingRule(2)],
    fabricRules: [fixtureFabricRule(1)],
    templates: [
      fixtureTemplate(1, { paletteCount: 2, ruleCount: 2 }),
      fixtureTemplate(2, { paletteCount: 2, ruleCount: 2 }),
      fixtureTemplate(3, { paletteCount: 2, ruleCount: 2 }),
    ],
  };
}

/** Scale test fixture library (T-38: 150 palettes, 150 templates). */
export function scaleLibrary(): RawLibrary {
  return buildFixtureLibrary({ palettes: 150, templates: 150 });
}

// Re-export domain fixtures so tests can import everything from tests/fixtures
export {
  fixtureFabricRule,
  fixturePalette,
  fixtureStylingRule,
  fixtureTemplate,
  buildEngineFixtureLibrary,
  buildFixtureLibrary,
  buildProfile,
  edgeCaseProfiles,
  evaluationProfile,
  FakeWordingProvider,
  faithfulReply,
  type FakeReply,
};
