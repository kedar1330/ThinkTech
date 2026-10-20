import { CATEGORIES } from '@styleme/contracts';
import type { EvaluationEntry } from '../src/services/engine';

// Founder relevance review for the evaluation set (#54, TESTING.md §6, D-52). The looks are exported as
// CSV; the founder marks each one `yes` (relevant to the profile and occasion) or `no`; the marks are
// imported back and the relevance rate is measured against the ≥ 80 % target. Rows name profiles by ID
// only (the profile values stay in the profile file). Pure: the CLI (evaluate.ts) does the file I/O.

export const REVIEW_COLUMNS = [
  'contentVersion',
  'profileId',
  'look',
  'templateId',
  'paletteId',
  'combinationSignature',
  'items',
  'explanation',
  'relevant',
] as const;
type Column = (typeof REVIEW_COLUMNS)[number];
export type ReviewRow = Record<Column, string>;

/** The D-52 target: at least 80 % of looks judged relevant. A target to measure, never a claimed result. */
export const RELEVANCE_TARGET = 0.8;

const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** One row per look, in profile order then ranking order, with `relevant` left for the founder. */
export function reviewRows(entries: readonly EvaluationEntry[], contentVersion: string): ReviewRow[] {
  return entries.flatMap((entry) =>
    entry.looks.map((look, i) => ({
      contentVersion,
      profileId: entry.profileId,
      look: String(i + 1),
      templateId: look.templateId,
      paletteId: look.paletteId,
      combinationSignature: look.combinationSignature,
      items: look.slots
        .map((s) => `${categoryLabel(s.lookSpec.category)}: ${s.swatches.map((w) => w.name).join(' + ')}`)
        .join('; '),
      explanation: look.explanation,
      relevant: '',
    })),
  );
}

// --- CSV (RFC 4180: commas, quotes and line breaks inside quoted fields) ------------------------------

const quote = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function toCsv(rows: readonly ReviewRow[]): string {
  return [REVIEW_COLUMNS.join(','), ...rows.map((row) => REVIEW_COLUMNS.map((c) => quote(row[c])).join(','))]
    .join('\r\n')
    .concat('\r\n');
}

function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += ch;
  }
  if (quoted) throw new Error('The review file ends inside a quoted field');
  if (field !== '' || record.length > 0) records.push([...record, field]);
  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** Reads a marked review file. Errors name rows and columns only, never cell contents beyond the mark. */
export function parseReviewCsv(text: string): ReviewRow[] {
  const [header, ...records] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!header || header.join(',') !== REVIEW_COLUMNS.join(','))
    throw new Error(`The header must be: ${REVIEW_COLUMNS.join(',')}`);
  return records.map((cells, i) => {
    if (cells.length !== REVIEW_COLUMNS.length)
      throw new Error(`Row ${i + 2}: expected ${REVIEW_COLUMNS.length} columns, found ${cells.length}`);
    const row = Object.fromEntries(REVIEW_COLUMNS.map((c, j) => [c, cells[j]!.trim()])) as ReviewRow;
    row.relevant = row.relevant.toLowerCase();
    if (!['', 'yes', 'no'].includes(row.relevant)) throw new Error(`Row ${i + 2}: "relevant" must be yes, no or empty`);
    return row;
  });
}

// --- Relevance rate --------------------------------------------------------------------------------

export interface RelevanceResult {
  contentVersion: string;
  /** Looks in the current evaluation. */
  looks: number;
  relevant: number;
  notRelevant: number;
  /** Current looks without a mark (not in the file, or left empty). */
  unmarked: number;
  /** relevant ÷ (relevant + not relevant); `null` until at least one look is marked. */
  rate: number | null;
  /** Every current look is marked. Only then is the rate compared with the target. */
  complete: boolean;
  /** `null` while the review is incomplete. */
  meetsTarget: boolean | null;
}

/**
 * Matches the marks to the current looks by profile and combination signature. Marks made on another
 * content version are rejected: the looks may have changed, so they must be reviewed again.
 */
export function relevanceRate(
  marks: readonly ReviewRow[],
  entries: readonly EvaluationEntry[],
  contentVersion: string,
): RelevanceResult {
  const stale = marks.find((m) => m.contentVersion !== contentVersion);
  if (stale)
    throw new Error(
      `The marks are for content version ${stale.contentVersion}, but the library is ${contentVersion}. ` +
        'Export the looks again and review them.',
    );
  const byLook = new Map(marks.map((m) => [`${m.profileId}\u0000${m.combinationSignature}`, m.relevant]));
  let relevant = 0;
  let notRelevant = 0;
  let looks = 0;
  for (const entry of entries)
    for (const look of entry.looks) {
      looks++;
      const mark = byLook.get(`${entry.profileId}\u0000${look.combinationSignature}`);
      if (mark === 'yes') relevant++;
      else if (mark === 'no') notRelevant++;
    }
  const marked = relevant + notRelevant;
  const rate = marked === 0 ? null : relevant / marked;
  const complete = looks > 0 && marked === looks;
  return {
    contentVersion,
    looks,
    relevant,
    notRelevant,
    unmarked: looks - marked,
    rate,
    complete,
    meetsTarget: complete && rate !== null ? rate >= RELEVANCE_TARGET : null,
  };
}

export function formatRelevance(result: RelevanceResult): string {
  const pct = result.rate === null ? '—' : `${(result.rate * 100).toFixed(1)} %`;
  const verdict = !result.complete
    ? `review incomplete: ${result.unmarked} of ${result.looks} looks unmarked, so the target is not assessed`
    : result.meetsTarget
      ? 'meets the ≥ 80 % target (D-52)'
      : 'below the ≥ 80 % target (D-52)';
  return [
    '## Founder relevance review',
    '',
    `Content version \`${result.contentVersion}\` · ${result.relevant} relevant · ${result.notRelevant} not relevant · ` +
      `${result.unmarked} unmarked · relevance ${pct} · ${verdict}`,
  ].join('\n');
}
