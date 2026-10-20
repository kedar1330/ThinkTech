import { describe, expect, it } from 'vitest';
import { SHORTLIST_LIMITS } from '@styleme/contracts';
import { formatInr } from '../lib/shop/format';
import { shortlistFormToRequest } from '../lib/shop/shortlist-form';

const LINK = 'https://Shop.example/kurta?utm_source=friend#details';

describe('shortlist form → POST /v1/shortlist body (FR-LIST-01, -07)', () => {
  it('sends only the name and price when the optional fields are empty', () => {
    expect(shortlistFormToRequest({ name: ' Juttis ', priceEntered: '1500', url: '  ', note: '' })).toEqual({
      ok: true,
      body: { name: 'Juttis', priceEntered: 1500 },
    });
  });

  it('includes the link exactly as typed and the note', () => {
    expect(
      shortlistFormToRequest({ name: 'Kurta', priceEntered: '1299.5', url: ` ${LINK} `, note: 'Ask about size' }),
    ).toEqual({ ok: true, body: { name: 'Kurta', priceEntered: 1299.5, url: LINK, note: 'Ask about size' } });
  });

  it('reads prices written with ₹, Indian grouping or paise', () => {
    for (const [typed, rupees] of [
      ['₹1,299.50', 1299.5],
      ['1,00,000', 100000],
      ['  450 ', 450],
      ['0.01', 0.01],
      ['10,00,000', SHORTLIST_LIMITS.priceMax],
    ] as const) {
      const result = shortlistFormToRequest({ name: 'Item', priceEntered: typed });
      expect(result, typed).toEqual({ ok: true, body: { name: 'Item', priceEntered: rupees } });
    }
  });

  it('explains each price problem', () => {
    const error = (priceEntered: string) =>
      (shortlistFormToRequest({ name: 'Item', priceEntered }) as { fieldErrors: Record<string, string> }).fieldErrors
        .priceEntered;
    expect(error('')).toBe('Enter the price you saw.');
    expect(error('abc')).toBe('Enter the price in rupees, for example 1299 or 1299.50.');
    expect(error('12.345')).toBe('Enter the price in rupees, for example 1299 or 1299.50.');
    expect(error('-5')).toBe('Enter the price in rupees, for example 1299 or 1299.50.');
    expect(error('0')).toBe('Enter a price above ₹0.');
    expect(error('1000001')).toBe('Enter a price up to ₹10,00,000.');
  });

  it('reports every invalid field with its own message', () => {
    expect(
      shortlistFormToRequest({
        name: '   ',
        priceEntered: '',
        url: 'http://shop.example/kurta',
        note: 'n'.repeat(SHORTLIST_LIMITS.noteMax + 1),
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        name: 'Enter the name of the item.',
        priceEntered: 'Enter the price you saw.',
        url: 'Enter a link that starts with https://',
        note: `Use ${SHORTLIST_LIMITS.noteMax} characters or fewer.`,
      },
    });
  });

  it('rejects javascript: and data: links and over-long names and links', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'shop.example/kurta']) {
      expect(shortlistFormToRequest({ name: 'Item', priceEntered: '100', url })).toEqual({
        ok: false,
        fieldErrors: { url: 'Enter a link that starts with https://' },
      });
    }
    expect(
      shortlistFormToRequest({
        name: 'n'.repeat(SHORTLIST_LIMITS.nameMax + 1),
        priceEntered: '100',
        url: `https://shop.example/${'a'.repeat(SHORTLIST_LIMITS.urlMax)}`,
      }),
    ).toEqual({
      ok: false,
      fieldErrors: {
        name: `Use ${SHORTLIST_LIMITS.nameMax} characters or fewer.`,
        url: 'Use a link of 2,048 characters or fewer.',
      },
    });
  });
});

describe('rupee display', () => {
  it('uses Indian grouping and shows paise only when there are any', () => {
    expect(formatInr(1299.5)).toBe('₹1,299.50');
    expect(formatInr(100000)).toBe('₹1,00,000');
    expect(formatInr(450)).toBe('₹450');
  });
});
