import { describe, expect, it } from 'vitest';
import { runEvaluation } from '../../src/services/engine';
import { edgeCaseProfiles } from '../fixtures/profiles';
import { library } from '../unit/engine/helpers';
import {
  REVIEW_COLUMNS,
  formatRelevance,
  parseReviewCsv,
  relevanceRate,
  reviewRows,
  toCsv,
  type ReviewRow,
} from '../../scripts/evaluation-review';

// Founder relevance review tooling (#54, D-52): export, marks, rate.

const entries = runEvaluation(edgeCaseProfiles().slice(0, 4), library);
const VERSION = library.contentVersion;
const rows = reviewRows(entries, VERSION);
const looks = entries.reduce((n, e) => n + e.looks.length, 0);

const mark = (pattern: (i: number) => 'yes' | 'no' | ''): ReviewRow[] =>
  rows.map((row, i) => ({ ...row, relevant: pattern(i) }));

describe('review export', () => {
  it('has one row per look, in profile then ranking order, naming profiles by ID only', () => {
    expect(rows).toHaveLength(looks);
    expect(rows[0]).toMatchObject({
      contentVersion: VERSION,
      profileId: entries[0]!.profileId,
      look: '1',
      relevant: '',
    });
    expect(rows[0]!.items).toMatch(/^[A-Z][^:]+: .+/);
    expect(rows[0]!.explanation).toBe(entries[0]!.looks[0]!.explanation);
    expect(Object.keys(rows[0]!)).toEqual([...REVIEW_COLUMNS]);
  });

  it('round-trips through CSV, including commas, quotes and line breaks', () => {
    const tricky: ReviewRow = { ...rows[0]!, explanation: 'Warm, "festive" colours\nfor evening', relevant: 'yes' };
    expect(parseReviewCsv(toCsv([tricky, ...rows.slice(1)]))).toEqual([tricky, ...rows.slice(1)]);
  });

  it('accepts marks in any case and a byte-order mark from spreadsheet apps', () => {
    const csv = '\uFEFF' + toCsv([{ ...rows[0]!, relevant: 'YES' }]);
    expect(parseReviewCsv(csv)[0]!.relevant).toBe('yes');
  });
});

describe('review import', () => {
  it('rejects a different header, a wrong column count and an unknown mark', () => {
    expect(() => parseReviewCsv('profileId,relevant\r\nA,yes\r\n')).toThrow(/header must be/);
    expect(() => parseReviewCsv(`${REVIEW_COLUMNS.join(',')}\r\na,b\r\n`)).toThrow(/Row 2: expected 9 columns/);
    expect(() => parseReviewCsv(toCsv([{ ...rows[0]!, relevant: 'maybe' }]))).toThrow(/Row 2: "relevant"/);
  });

  it('rejects marks made on another content version', () => {
    const stale = mark(() => 'yes').map((r) => ({ ...r, contentVersion: 'old0000000000000' }));
    expect(() => relevanceRate(stale, entries, VERSION)).toThrow(/content version old0000000000000/);
  });
});

describe('relevance rate (target ≥ 80 %, D-52)', () => {
  it('measures a complete review against the target', () => {
    const allButOne = relevanceRate(
      mark((i) => (i === 0 ? 'no' : 'yes')),
      entries,
      VERSION,
    );
    expect(allButOne).toMatchObject({ looks, relevant: looks - 1, notRelevant: 1, unmarked: 0, complete: true });
    expect(allButOne.rate).toBeCloseTo((looks - 1) / looks);
    expect(allButOne.meetsTarget).toBe((looks - 1) / looks >= 0.8);

    const half = relevanceRate(
      mark((i) => (i % 2 ? 'no' : 'yes')),
      entries,
      VERSION,
    );
    expect(half.meetsTarget).toBe(false);
    expect(formatRelevance(half)).toContain('below the ≥ 80 % target (D-52)');
  });

  it('does not assess the target while looks are unmarked', () => {
    const partial = relevanceRate(
      mark((i) => (i === 0 ? 'yes' : '')),
      entries,
      VERSION,
    );
    expect(partial).toMatchObject({ relevant: 1, unmarked: looks - 1, complete: false, meetsTarget: null, rate: 1 });
    expect(formatRelevance(partial)).toContain(`review incomplete: ${looks - 1} of ${looks} looks unmarked`);

    const none = relevanceRate([], entries, VERSION);
    expect(none).toMatchObject({ rate: null, complete: false, meetsTarget: null, unmarked: looks });
  });
});
