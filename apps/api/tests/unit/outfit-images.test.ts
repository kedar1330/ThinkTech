import { buildOutfitImagePrompt } from '../../src/integrations/ai/prompts/outfit-image-v2';
import { describe, expect, it } from 'vitest';
import type { LookSpec } from '@styleme/contracts';
import { ImageProviderError, pollinationsImageProvider } from '../../src/integrations/ai/image-client';
import {
  AVOIDED_MAX_DISTANCE,
  LIKED_MAX_DISTANCE,
  matchDesign,
  nearestColour,
  toEngineDesign,
  vocabularyColours,
} from '../../src/services/engine';
import { SYNTHETIC_JPEG } from '../fixtures/vision';

// The Pollinations client (no network: a fake fetch) and the design matching used to rank looks.

function fakeFetch(status: number, contentType: string, body: Buffer | string = SYNTHETIC_JPEG) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { 'content-type': contentType } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const REQUEST = { prompt: 'A navy cotton kurta & white trousers', width: 768, height: 1024, seed: 42 };

describe('pollinationsImageProvider', () => {
  it('sends the prompt in the path, the key in the header, and returns the image', async () => {
    const { impl, calls } = fakeFetch(200, 'image/jpeg');
    const provider = pollinationsImageProvider('sk_test', 'black-forest-labs/flux.1-schnell', impl);
    const image = await provider.generate(REQUEST, new AbortController().signal);
    expect(image.contentType).toBe('image/jpeg');
    expect(image.bytes.equals(SYNTHETIC_JPEG)).toBe(true);

    const url = new URL(calls[0]!.url);
    expect(url.origin).toBe('https://gen.pollinations.ai');
    expect(decodeURIComponent(url.pathname)).toBe(`/image/${REQUEST.prompt}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      model: 'black-forest-labs/flux.1-schnell',
      width: '768',
      height: '1024',
      seed: '42',
      safe: 'true',
    });
    expect(url.search).not.toContain('sk_test');
    expect((calls[0]!.init?.headers as Record<string, string>).authorization).toBe('Bearer sk_test');
  });

  it.each([
    [429, 'image/jpeg', 'rate_limited'],
    [503, 'image/jpeg', 'rate_limited'],
    [402, 'image/jpeg', 'budget_exhausted'],
    [500, 'image/jpeg', 'provider_error'],
    [200, 'image/svg+xml', 'invalid_output'],
    [200, 'text/html', 'invalid_output'],
  ])('maps HTTP %i (%s) to %s', async (status, contentType, cause) => {
    const provider = pollinationsImageProvider('sk_test', 'm', fakeFetch(status, contentType).impl);
    await expect(provider.generate(REQUEST, new AbortController().signal)).rejects.toEqual(
      new ImageProviderError(cause as never),
    );
  });

  it('refuses an empty reply', async () => {
    const provider = pollinationsImageProvider('sk_test', 'm', fakeFetch(200, 'image/png', Buffer.alloc(0)).impl);
    await expect(provider.generate(REQUEST, new AbortController().signal)).rejects.toThrow('invalid_output');
  });
});

describe('palette colours → look colours', () => {
  it('matches a library colour to the nearest vocabulary colour', () => {
    expect(nearestColour('#1F2A44')).toEqual({ colorId: 'navy', distance: 0 });
    expect(nearestColour('#1E2B45').colorId).toBe('navy');
    expect(nearestColour('#82001F').colorId).toBe('maroon');
  });

  it('counts every liked colour, but an avoided one only when it is near-identical', () => {
    expect(vocabularyColours(['#1E2B45', '#1F2A44', '#82001F'], LIKED_MAX_DISTANCE)).toEqual(['navy', 'maroon']);
    expect(vocabularyColours(['#FEFEFE'], AVOIDED_MAX_DISTANCE)).toEqual(['white']);
    // Pure green is far from every vocabulary colour (parrot green is nearest): avoiding it removes nothing.
    expect(vocabularyColours(['#00FF00'], AVOIDED_MAX_DISTANCE)).toEqual([]);
    expect(vocabularyColours(['#00FF00'], LIKED_MAX_DISTANCE)).toEqual(['parrot_green']);
  });
});

describe('design matching', () => {
  const kurti = (extra: Partial<LookSpec> = {}): LookSpec =>
    ({ category: 'kurti', colorFamily: 'neutral', colorId: 'navy', ...extra }) as LookSpec;

  it('maps design features to the look vocabulary by exact ID only', () => {
    expect(
      toEngineDesign('kurti', {
        neckline: 'neckline_v_neck',
        sleeve: 'sleeve_full_length',
        fit: 'fit_relaxed',
        pockets: 'pockets_side',
      }),
    ).toEqual({ category: 'kurti', features: { neckline: 'v_neck', fit: 'relaxed' } });
    expect(toEngineDesign('cape_jacket', { neckline: 'neckline_v_neck' })).toBeNull();
  });

  it('classifies a look as full, partial or none', () => {
    const design = { category: 'kurti' as const, features: { neckline: 'v_neck', sleeve: 'elbow' } };
    expect(matchDesign([kurti({ neckline: 'v_neck', sleeve: 'elbow' })], design)).toEqual({
      level: 'full',
      differs: [],
    });
    expect(matchDesign([kurti({ neckline: 'round', sleeve: 'elbow' })], design)).toEqual({
      level: 'partial',
      differs: ['neckline'],
    });
    expect(matchDesign([{ ...kurti(), category: 'shirt' } as LookSpec], design)).toEqual({
      level: 'none',
      differs: [],
    });
  });
});

describe('buildOutfitImagePrompt with garment & custom colors', () => {

  it('generates an anarkali prompt instead of kurti when anarkali design is selected', () => {
    const prompt = buildOutfitImagePrompt({
      slots: [
        { slotId: 'slot-1', slot: 'top', searchPhrase: 'coral cotton knee-length regular a-line v-neck kurti', swatches: [{ colorId: 'coral', hex: '#FF7F50', name: 'Coral' }], alternatives: [] } as any,
        { slotId: 'slot-2', slot: 'bottom', searchPhrase: 'white silk regular straight trousers', swatches: [{ colorId: 'white', hex: '#FFFFFF', name: 'White' }], alternatives: [] } as any,
      ],
      occasion: 'festive',
      style: null,
      department: 'women',
      designGarment: 'anarkali',
    });
    expect(prompt).toContain('anarkali');
    expect(prompt).toContain('flared anarkali suit with voluminous kalidar umbrella flare');
    expect(prompt).not.toContain('kurti');
  });

  it('uses custom selected colors for pieces when provided', () => {
    const colours = new Map([['slot-1', 'Emerald'], ['slot-2', 'Gold']]);
    const prompt = buildOutfitImagePrompt({
      slots: [
        { slotId: 'slot-1', slot: 'top', searchPhrase: 'coral cotton kurti', swatches: [{ colorId: 'coral', hex: '#FF7F50', name: 'Coral' }], alternatives: [] } as any,
        { slotId: 'slot-2', slot: 'bottom', searchPhrase: 'white trousers', swatches: [{ colorId: 'white', hex: '#FFFFFF', name: 'White' }], alternatives: [] } as any,
      ],
      occasion: 'wedding',
      style: null,
      department: 'women',
      colours,
      customColors: ['Emerald', 'Gold'],
    });
    expect(prompt.toLowerCase()).toContain('emerald');
    expect(prompt.toLowerCase()).toContain('gold');
  });
});
