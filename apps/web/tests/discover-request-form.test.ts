import { describe, expect, it } from 'vitest';
import { requestFormToRequest } from '../lib/discover/request-form';

describe('Discover request form → POST /v1/recommendations body', () => {
  it('sends only the occasion when nothing else is chosen, with the default palette mode', () => {
    expect(requestFormToRequest({ occasion: 'work', style: '', wearType: [], paletteMode: '' })).toEqual({
      ok: true,
      body: { occasion: 'work', paletteMode: 'suggested' },
    });
  });

  it('includes every optional choice', () => {
    expect(
      requestFormToRequest({
        occasion: 'festive',
        style: 'fusion',
        wearType: ['indian', 'fusion'],
        paletteMode: 'explore',
      }),
    ).toEqual({
      ok: true,
      body: { occasion: 'festive', style: 'fusion', wearType: ['indian', 'fusion'], paletteMode: 'explore' },
    });
  });

  it('requires an occasion', () => {
    expect(requestFormToRequest({})).toEqual({ ok: false, fieldErrors: { occasion: 'Choose an occasion.' } });
  });

  it('rejects values outside the vocabulary, per field', () => {
    expect(
      requestFormToRequest({ occasion: 'picnic', style: 'gothic', wearType: ['indian', 'indian'], paletteMode: 'x' }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        occasion: 'Please choose from the options shown.',
        style: 'Please choose from the options shown.',
        wearType: 'Please choose from the options shown.',
        paletteMode: 'Please choose from the options shown.',
      },
    });
  });
});
