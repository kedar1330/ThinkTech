import { CATEGORIES, type Category, type Department } from '@styleme/contracts';
import { findJudgementalLanguage } from './inclusive-language';
import {
  RECORD_SCHEMAS,
  type AppliesTo,
  type AttributeRef,
  type FabricRule,
  type Palette,
  type RawLibrary,
  type RecordType,
  type StyleRecord,
  type StylingRule,
  type Template,
} from './schemas';

// Style-rule linter (FR-STY-03, AI.md §4). Runs in CI (scripts/style-rules.ts) and at startup
// (loader.ts). Any issue fails the lint: only approved, linter-clean records reach the runtime set.

export type LintCode =
  | 'INVALID_SCHEMA'
  | 'DUPLICATE_ID'
  | 'DUPLICATE_RECORD'
  | 'DUPLICATE_SLOT_ID'
  | 'UNKNOWN_REFERENCE'
  | 'CATEGORY_MISMATCH'
  | 'CONTRADICTION'
  | 'JUDGEMENTAL_LANGUAGE'
  | 'NOT_APPROVED'
  | 'FIXTURE_RECORD';

export interface LintIssue {
  code: LintCode;
  recordId: string;
  message: string;
}

export interface RecordSet {
  palettes: Palette[];
  stylingRules: StylingRule[];
  fabricRules: FabricRule[];
  templates: Template[];
}

export interface LintResult {
  issues: LintIssue[];
  /** Approved records only: the set the runtime may load once `issues` is empty. */
  approved: RecordSet;
  /** Every schema-valid record, whatever its status (used by the coverage report and tooling). */
  valid: RecordSet;
}

export interface LintOptions {
  /** Allow `isFixture` records (test fixture libraries only). */
  allowFixtures?: boolean;
}

const RAW_KEYS: Record<RecordType, keyof RawLibrary> = {
  palette: 'palettes',
  stylingRule: 'stylingRules',
  fabricRule: 'fabricRules',
  template: 'templates',
};

type Rule = StylingRule | FabricRule;

export function lintLibrary(raw: RawLibrary, options: LintOptions = {}): LintResult {
  const issues: LintIssue[] = [];
  const report = (code: LintCode, recordId: string, message: string) => issues.push({ code, recordId, message });
  const valid: RecordSet = { palettes: [], stylingRules: [], fabricRules: [], templates: [] };

  // 1. Schema validation.
  for (const type of Object.keys(RAW_KEYS) as RecordType[]) {
    const key = RAW_KEYS[type];
    raw[key].forEach((item, index) => {
      const parsed = RECORD_SCHEMAS[type].safeParse(item);
      if (!parsed.success) {
        const id = rawId(item) ?? `${key}[${index}]`;
        for (const issue of parsed.error.issues) {
          report('INVALID_SCHEMA', id, `${issue.path.join('.') || '(record)'}: ${issue.message}`);
        }
        return;
      }
      (valid[key] as StyleRecord[]).push(parsed.data);
    });
  }

  const all: StyleRecord[] = [...valid.palettes, ...valid.stylingRules, ...valid.fabricRules, ...valid.templates];

  // 2. Duplicate IDs (across all types).
  const seen = new Set<string>();
  for (const record of all) {
    if (seen.has(record.id)) report('DUPLICATE_ID', record.id, 'ID is used by more than one record');
    seen.add(record.id);
  }

  // 3. Review status and fixtures. Retired records stay in the files for history but are skipped.
  for (const record of all) {
    if (record.reviewStatus === 'draft' || record.reviewStatus === 'reviewed') {
      report('NOT_APPROVED', record.id, `reviewStatus is "${record.reviewStatus}"; only approved records may ship`);
    }
    if (record.isFixture && !options.allowFixtures) {
      report('FIXTURE_RECORD', record.id, 'fixture records must not be in the shipped library');
    }
  }
  const active = (records: StyleRecord[]) => records.filter((r) => r.reviewStatus !== 'retired');
  const live: RecordSet = {
    palettes: active(valid.palettes) as Palette[],
    stylingRules: active(valid.stylingRules) as StylingRule[],
    fabricRules: active(valid.fabricRules) as FabricRule[],
    templates: active(valid.templates) as Template[],
  };
  const liveRecords: StyleRecord[] = [...live.palettes, ...live.stylingRules, ...live.fabricRules, ...live.templates];
  const status = new Map(liveRecords.map((r) => [r.id, r.reviewStatus]));

  // A reference must resolve to a live record of the expected kind; an approved record may only
  // reference approved records, so the runtime set is closed.
  const checkRef = (from: StyleRecord, to: string, prefix: string) => {
    const target = status.get(to);
    if (!to.startsWith(prefix) || target === undefined) {
      report('UNKNOWN_REFERENCE', from.id, `references unknown record ${to}`);
    } else if (from.reviewStatus === 'approved' && target !== 'approved') {
      report('UNKNOWN_REFERENCE', from.id, `references ${to}, which is not approved`);
    }
  };

  // 4. Text: judgemental language in any user-facing text.
  for (const record of liveRecords) {
    const texts = [record.rationale, record.limitations, 'name' in record ? record.name : ''];
    for (const phrase of texts.flatMap(findJudgementalLanguage)) {
      report('JUDGEMENTAL_LANGUAGE', record.id, `judgemental phrase "${phrase}"; describe the effect instead`);
    }
  }

  // 5. Palettes: combinations use only the palette's own colours.
  for (const palette of live.palettes) {
    const own = new Set<string>([...palette.neutrals, ...palette.accents]);
    for (const combination of palette.combinations) {
      for (const color of combination.colors) {
        if (!own.has(color))
          report('UNKNOWN_REFERENCE', palette.id, `combination colour "${color}" is not in neutrals or accents`);
      }
    }
  }

  // 6. Templates: slot identity, categories, references.
  for (const template of live.templates) {
    const slotIds = new Set<string>();
    for (const slot of template.slots) {
      if (slotIds.has(slot.slotId))
        report('DUPLICATE_SLOT_ID', template.id, `slotId "${slot.slotId}" is used twice (D-82)`);
      slotIds.add(slot.slotId);
      for (const category of slot.categoryOptions) {
        const problem = categoryProblem(category, slot.slot, template.department);
        if (problem) report('CATEGORY_MISMATCH', template.id, `slot "${slot.slotId}": ${problem}`);
      }
    }
    for (const paletteId of template.compatiblePalettes) checkRef(template, paletteId, 'PAL-');
    for (const ruleId of template.ruleRefs) checkRef(template, ruleId, ruleId.startsWith('FAB-') ? 'FAB-' : 'STY-');
  }

  // 7. Rules: references and contradictions.
  const rules: Rule[] = [...live.stylingRules, ...live.fabricRules];
  for (const rule of rules) {
    for (const other of rule.conflictsWith) checkRef(rule, other, other.startsWith('FAB-') ? 'FAB-' : 'STY-');
    const own = overlap(rule.effect.prefer, rule.effect.deprioritise);
    if (own) report('CONTRADICTION', rule.id, `both prefers and deprioritises ${own}`);
  }
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]!;
      const b = rules[j]!;
      // A declared conflict is resolved by precedence and weights in the generator (FR-LOOK-08).
      if (a.conflictsWith.includes(b.id) || b.conflictsWith.includes(a.id)) continue;
      if (!contextsOverlap(a.appliesTo, b.appliesTo)) continue;
      const clash = overlap(a.effect.prefer, b.effect.deprioritise) ?? overlap(b.effect.prefer, a.effect.deprioritise);
      if (clash) {
        report(
          'CONTRADICTION',
          a.id,
          `contradicts ${b.id} on ${clash} in an overlapping context; narrow appliesTo or declare conflictsWith`,
        );
      }
    }
  }

  // 8. Duplicate content: two records of a type that differ only in ID and review metadata.
  for (const [key, records] of Object.entries(live) as [keyof RecordSet, StyleRecord[]][]) {
    const fingerprints = new Map<string, string>();
    for (const record of records) {
      const fingerprint = contentFingerprint(record);
      const first = fingerprints.get(fingerprint);
      if (first) report('DUPLICATE_RECORD', record.id, `duplicates ${first} (${key})`);
      else fingerprints.set(fingerprint, record.id);
    }
  }

  const approved = (records: StyleRecord[]) => records.filter((r) => r.reviewStatus === 'approved');
  return {
    issues,
    valid,
    approved: {
      palettes: approved(valid.palettes) as Palette[],
      stylingRules: approved(valid.stylingRules) as StylingRule[],
      fabricRules: approved(valid.fabricRules) as FabricRule[],
      templates: approved(valid.templates) as Template[],
    },
  };
}

function rawId(item: unknown): string | undefined {
  if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') return item.id;
  return undefined;
}

const CATEGORY_BY_ID = new Map<string, (typeof CATEGORIES)[number]>(CATEGORIES.map((c) => [c.id, c]));

function categoryProblem(category: Category, slotType: string, department: Department): string | null {
  const meta = CATEGORY_BY_ID.get(category);
  if (!meta) return `unknown category "${category}"`;
  if (meta.slotType !== slotType) return `category "${category}" is a ${meta.slotType}, not a ${slotType}`;
  if (department !== 'any' && !(meta.departments as readonly string[]).includes(department)) {
    return `category "${category}" is not offered in department "${department}"`;
  }
  return null;
}

const refKey = (ref: AttributeRef) => `${ref.attribute}=${ref.value}`;

function overlap(a: AttributeRef[], b: AttributeRef[]): string | null {
  const keys = new Set(a.map(refKey));
  const hit = b.find((ref) => keys.has(refKey(ref)));
  return hit ? refKey(hit) : null;
}

// Two contexts overlap when every dimension overlaps; an empty list means "any".
function contextsOverlap(a: AppliesTo, b: AppliesTo): boolean {
  const dims = ['categories', 'occasions', 'styles', 'proportions', 'heights'] as const;
  for (const dim of dims) {
    const x = a[dim] as string[];
    const y = b[dim] as string[];
    if (x.length > 0 && y.length > 0 && !x.some((v) => y.includes(v))) return false;
  }
  // Department "any" overlaps every department.
  const da = a.departments;
  const db = b.departments;
  if (da.length > 0 && db.length > 0 && !da.includes('any') && !db.includes('any')) {
    if (!da.some((d) => db.includes(d))) return false;
  }
  return true;
}

const METADATA_FIELDS = new Set(['id', 'version', 'reviewStatus', 'reviewedBy', 'reviewedAt', 'isFixture']);

function contentFingerprint(record: StyleRecord): string {
  return JSON.stringify(record, (key, value: unknown) => {
    if (METADATA_FIELDS.has(key)) return undefined;
    // Order-insensitive arrays of primitives (tags, occasions, colours …) compare as sets.
    if (Array.isArray(value) && value.every((v) => typeof v !== 'object')) return [...value].sort();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y)));
    }
    return value;
  });
}
