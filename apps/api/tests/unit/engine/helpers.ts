import {
  recommendationRequestSchema,
  type LookSpec,
  type ProfileResponse,
  type RecommendationRequest,
} from '@styleme/contracts';
import { generateLooks, type EngineResult, type EngineSignals, type StyleLibrary } from '../../../src/services/engine';
import { loadStyleLibrary, type RawLibrary } from '../../../src/style-rules';
import { buildEngineFixtureLibrary, fixtureStylingRule } from '../../fixtures/style-library';
import { buildProfile } from '../../fixtures/profiles';

// Shared helpers for the named engine tests (T-12 … T-28, T-38; TESTING.md §4–§5). They run the pure
// engine on the synthetic engine fixture library unless a test passes another library.

export const loadFixtures = (raw: RawLibrary = buildEngineFixtureLibrary()) =>
  loadStyleLibrary(raw, { allowFixtures: true });
export const library = loadFixtures();

export function run(
  request: Partial<RecommendationRequest> = {},
  profile: Partial<ProfileResponse> = {},
  signals: EngineSignals | null = null,
  lib: StyleLibrary = library,
): EngineResult {
  return generateLooks({
    request: recommendationRequestSchema.parse({ occasion: 'everyday', ...request }),
    profile: buildProfile(profile),
    signals,
    library: lib,
  });
}

/** Every look specification in a result: each slot and each of its alternatives. */
export const specs = (result: EngineResult): LookSpec[] =>
  result.looks.flatMap((l) => l.slots.flatMap((s) => [s.lookSpec, ...s.alternatives.map((a) => a.lookSpec)]));
export const templateIds = (result: EngineResult) => [...new Set(result.looks.map((l) => l.templateId))].sort();
export const slotSpec = (result: EngineResult, templateId: string, slotId: string) =>
  result.looks
    .filter((l) => l.templateId === templateId)
    .map((l) => l.slots.find((s) => s.slotId === slotId)!.lookSpec);

/** A self-described proportion signal that the fixture rules STY-003 and STY-004 are scoped to. */
export const SIGNAL: EngineSignals = { undertone: null, skinTone: null, bodyProportions: 'hips_wider_than_shoulders' };

/** The engine fixture library with one extra styling rule `STY-009`. */
export function withRule(overrides: Record<string, unknown>) {
  const raw = buildEngineFixtureLibrary();
  raw.stylingRules.push(fixtureStylingRule(9, overrides));
  return loadFixtures(raw);
}
