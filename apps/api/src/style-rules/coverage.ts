import {
  CONTRAST_LEVEL_IDS,
  OCCASION_IDS,
  SLOT_TYPE_IDS,
  STYLE_IDS,
  UNDERTONE_AFFINITY_IDS,
  type Category,
  type ContrastLevel,
  type Occasion,
  type SlotType,
  type Style,
  type UndertoneAffinity,
} from '@styleme/contracts';
import type { StyleLibrary } from './loader';
import { COORDINATION_ASPECTS, RULE_AREAS, type CoordinationAspect, type RuleArea } from './schemas';

// Coverage report of the approved library (FR-STY-11). It drives content planning and the C1 and
// C2 release gates (ImplementationPlan.md §5.2): it lists every empty or thin cell.

/** A cell with fewer records than this (but at least one) is reported as thin. */
export const THIN_BELOW = 2;

const REPORT_DEPARTMENTS = ['women', 'men'] as const;
type ReportDepartment = (typeof REPORT_DEPARTMENTS)[number];

export interface CoverageReport {
  counts: StyleLibrary['counts'];
  palettesByUndertoneAndContrast: Record<UndertoneAffinity, Record<ContrastLevel, number>>;
  templatesByCell: Record<ReportDepartment, Record<Occasion, Record<Style, number>>>;
  categoriesBySlot: Record<SlotType, Category[]>;
  rulesByArea: Record<RuleArea, number>;
  rulesByCoordinationAspect: Record<CoordinationAspect, number>;
  gaps: { empty: string[]; thin: string[] };
}

function grid<K extends string, V>(keys: readonly K[], make: () => V): Record<K, V> {
  return Object.fromEntries(keys.map((k) => [k, make()])) as Record<K, V>;
}

export function buildCoverageReport(library: StyleLibrary): CoverageReport {
  const palettesByUndertoneAndContrast = grid(UNDERTONE_AFFINITY_IDS, () => grid(CONTRAST_LEVEL_IDS, () => 0));
  for (const palette of library.palettes) {
    const contrasts = new Set(palette.combinations.map((c) => c.contrastLevel));
    for (const undertone of new Set(palette.undertoneAffinity)) {
      for (const contrast of contrasts) palettesByUndertoneAndContrast[undertone][contrast]++;
    }
  }

  // A department-"any" template serves both departments, so it counts in both.
  const templatesByCell = grid(REPORT_DEPARTMENTS, () => grid(OCCASION_IDS, () => grid(STYLE_IDS, () => 0)));
  for (const template of library.templates) {
    const departments = template.department === 'any' ? REPORT_DEPARTMENTS : [template.department];
    for (const department of departments) {
      for (const occasion of new Set(template.occasions)) {
        for (const style of new Set(template.styles)) templatesByCell[department][occasion][style]++;
      }
    }
  }

  const slotCategories = grid(SLOT_TYPE_IDS, () => new Set<Category>());
  for (const template of library.templates) {
    for (const slot of template.slots) for (const c of slot.categoryOptions) slotCategories[slot.slot].add(c);
  }
  const categoriesBySlot = grid(SLOT_TYPE_IDS, () => [] as Category[]);
  for (const slot of SLOT_TYPE_IDS) categoriesBySlot[slot] = [...slotCategories[slot]].sort();

  const rulesByArea = grid(RULE_AREAS, () => 0);
  const rulesByCoordinationAspect = grid(COORDINATION_ASPECTS, () => 0);
  for (const rule of [...library.stylingRules, ...library.fabricRules]) {
    for (const area of new Set(rule.areas)) rulesByArea[area]++;
  }
  for (const rule of library.stylingRules) {
    for (const aspect of new Set(rule.coordinationAspects)) rulesByCoordinationAspect[aspect]++;
  }

  const empty: string[] = [];
  const thin: string[] = [];
  const check = (label: string, count: number) => {
    if (count === 0) empty.push(label);
    else if (count < THIN_BELOW) thin.push(`${label} (${count})`);
  };
  for (const u of UNDERTONE_AFFINITY_IDS) {
    for (const c of CONTRAST_LEVEL_IDS)
      check(`palettes: undertone ${u} × contrast ${c}`, palettesByUndertoneAndContrast[u][c]);
  }
  for (const d of REPORT_DEPARTMENTS) {
    for (const o of OCCASION_IDS) {
      for (const s of STYLE_IDS) check(`templates: ${d} × ${o} × ${s}`, templatesByCell[d][o][s]);
    }
  }
  for (const slot of SLOT_TYPE_IDS) check(`categories for slot ${slot}`, categoriesBySlot[slot].length);
  for (const area of RULE_AREAS) check(`rules: area ${area}`, rulesByArea[area]);
  for (const aspect of COORDINATION_ASPECTS) check(`rules: coordination ${aspect}`, rulesByCoordinationAspect[aspect]);

  return {
    counts: library.counts,
    palettesByUndertoneAndContrast,
    templatesByCell,
    categoriesBySlot,
    rulesByArea,
    rulesByCoordinationAspect,
    gaps: { empty, thin },
  };
}

/** Markdown rendering, for the CI job summary. */
export function formatCoverageReport(report: CoverageReport): string {
  const lines: string[] = ['# Style knowledge base coverage (FR-STY-11)', ''];
  const c = report.counts;
  lines.push(
    `Approved records: ${c.palettes} palettes · ${c.templates} templates · ${c.stylingRules} styling rules · ${c.fabricRules} fabric rules`,
    '',
  );

  lines.push('## Palettes per undertone affinity × contrast level', '');
  lines.push(
    `| Undertone | ${CONTRAST_LEVEL_IDS.join(' | ')} |`,
    `|---|${CONTRAST_LEVEL_IDS.map(() => '---:').join('|')}|`,
  );
  for (const u of UNDERTONE_AFFINITY_IDS) {
    lines.push(`| ${u} | ${CONTRAST_LEVEL_IDS.map((k) => report.palettesByUndertoneAndContrast[u][k]).join(' | ')} |`);
  }
  lines.push('');

  for (const d of REPORT_DEPARTMENTS) {
    lines.push(`## Templates per occasion × style — ${d} (department "any" counts in both)`, '');
    lines.push(`| Occasion | ${STYLE_IDS.join(' | ')} |`, `|---|${STYLE_IDS.map(() => '---:').join('|')}|`);
    for (const o of OCCASION_IDS) {
      lines.push(`| ${o} | ${STYLE_IDS.map((s) => report.templatesByCell[d][o][s]).join(' | ')} |`);
    }
    lines.push('');
  }

  lines.push('## Categories per slot', '');
  for (const slot of SLOT_TYPE_IDS) lines.push(`- **${slot}:** ${report.categoriesBySlot[slot].join(', ') || '—'}`);
  lines.push('');

  lines.push('## Rule coverage per FR-STY-09 area', '');
  for (const area of RULE_AREAS) lines.push(`- ${area}: ${report.rulesByArea[area]}`);
  lines.push('', 'Coordination aspects:', '');
  for (const aspect of COORDINATION_ASPECTS) lines.push(`- ${aspect}: ${report.rulesByCoordinationAspect[aspect]}`);
  lines.push('');

  lines.push(
    `## Gaps`,
    '',
    `Empty cells: ${report.gaps.empty.length} · thin cells (< ${THIN_BELOW}): ${report.gaps.thin.length}`,
    '',
  );
  if (report.gaps.empty.length > 0) {
    lines.push(
      '<details><summary>Empty cells</summary>',
      '',
      ...report.gaps.empty.map((g) => `- ${g}`),
      '',
      '</details>',
      '',
    );
  }
  if (report.gaps.thin.length > 0) {
    lines.push(
      '<details><summary>Thin cells</summary>',
      '',
      ...report.gaps.thin.map((g) => `- ${g}`),
      '',
      '</details>',
      '',
    );
  }
  return lines.join('\n');
}
