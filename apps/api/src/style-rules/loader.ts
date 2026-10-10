import type { Category, Department, Occasion, Style } from '@styleme/contracts';
import fabricRules from './data/fabric-rules.json' with { type: 'json' };
import palettes from './data/palettes.json' with { type: 'json' };
import stylingRules from './data/styling-rules.json' with { type: 'json' };
import templates from './data/templates.json' with { type: 'json' };
import { lintLibrary, type LintIssue } from './linter';
import type { FabricRule, Palette, RawLibrary, StylingRule, Template } from './schemas';

// Loads the style knowledge base once at startup (AI.md §4, FR-STY-10): validates and lints every
// record, keeps only approved ones and builds in-memory indexes, so lookup cost depends on the
// matching subset rather than the library size.

/** The repository's own library: the JSON files in ./data. */
export const SHIPPED_LIBRARY: RawLibrary = { palettes, stylingRules, fabricRules, templates };

export class StyleLibraryError extends Error {
  constructor(readonly issues: LintIssue[]) {
    super(
      `Style knowledge base failed the linter with ${issues.length} issue(s): ` +
        issues
          .slice(0, 5)
          .map((i) => `${i.recordId} ${i.code}`)
          .join('; ') +
        (issues.length > 5 ? '; …' : ''),
    );
    this.name = 'StyleLibraryError';
  }
}

export interface LoadOptions {
  /** Test fixture libraries only. Refused when `appEnv` is production (T-29). */
  allowFixtures?: boolean;
  appEnv?: 'local' | 'staging' | 'production';
}

export type Rule = StylingRule | FabricRule;

export interface TemplateQuery {
  occasion: Occasion;
  style?: Style;
  department: Department;
}

export class StyleLibrary {
  readonly palettes: readonly Palette[];
  readonly stylingRules: readonly StylingRule[];
  readonly fabricRules: readonly FabricRule[];
  readonly templates: readonly Template[];

  private readonly byId = new Map<string, Palette | Rule | Template>();
  private readonly templatesByOccasion = new Map<Occasion, Template[]>();
  private readonly templatesByStyle = new Map<Style, Template[]>();
  private readonly templatesByDepartment = new Map<Department, Template[]>();
  private readonly templatesByCategory = new Map<Category, Template[]>();
  private readonly palettesByOccasion = new Map<Occasion, Palette[]>();
  private readonly rulesByCategory = new Map<Category | '*', Rule[]>();

  constructor(records: {
    palettes: Palette[];
    stylingRules: StylingRule[];
    fabricRules: FabricRule[];
    templates: Template[];
  }) {
    this.palettes = records.palettes;
    this.stylingRules = records.stylingRules;
    this.fabricRules = records.fabricRules;
    this.templates = records.templates;

    for (const record of [...this.palettes, ...this.stylingRules, ...this.fabricRules, ...this.templates]) {
      this.byId.set(record.id, record);
    }
    for (const template of this.templates) {
      for (const occasion of template.occasions) push(this.templatesByOccasion, occasion, template);
      for (const style of template.styles) push(this.templatesByStyle, style, template);
      push(this.templatesByDepartment, template.department, template);
      const categories = new Set(template.slots.flatMap((s) => s.categoryOptions));
      for (const category of categories) push(this.templatesByCategory, category, template);
    }
    for (const palette of this.palettes) {
      for (const occasion of palette.occasions) push(this.palettesByOccasion, occasion, palette);
    }
    for (const rule of [...this.stylingRules, ...this.fabricRules]) {
      const categories = rule.appliesTo.categories;
      if (categories.length === 0) push(this.rulesByCategory, '*', rule);
      for (const category of categories) push(this.rulesByCategory, category, rule);
    }
  }

  get counts() {
    return {
      palettes: this.palettes.length,
      stylingRules: this.stylingRules.length,
      fabricRules: this.fabricRules.length,
      templates: this.templates.length,
    };
  }

  getPalette(id: string): Palette | undefined {
    return this.typed(id, 'PAL-') as Palette | undefined;
  }

  getTemplate(id: string): Template | undefined {
    return this.typed(id, 'OUT-') as Template | undefined;
  }

  getRule(id: string): Rule | undefined {
    return (this.typed(id, 'STY-') ?? this.typed(id, 'FAB-')) as Rule | undefined;
  }

  /** Templates for an occasion, optional style and the user's department (`any` sees all; others also see `any`). */
  findTemplates({ occasion, style, department }: TemplateQuery): Template[] {
    const forOccasion = this.templatesByOccasion.get(occasion) ?? [];
    return forOccasion.filter(
      (t) =>
        (style === undefined || t.styles.includes(style)) &&
        (department === 'any' || t.department === department || t.department === 'any'),
    );
  }

  templatesForStyle(style: Style): readonly Template[] {
    return this.templatesByStyle.get(style) ?? [];
  }

  templatesForDepartment(department: Department): readonly Template[] {
    return this.templatesByDepartment.get(department) ?? [];
  }

  templatesForCategory(category: Category): readonly Template[] {
    return this.templatesByCategory.get(category) ?? [];
  }

  palettesForOccasion(occasion: Occasion): readonly Palette[] {
    return this.palettesByOccasion.get(occasion) ?? [];
  }

  /** Rules for a category: those naming it plus those that apply to every category. */
  rulesForCategory(category: Category): Rule[] {
    return [...(this.rulesByCategory.get(category) ?? []), ...(this.rulesByCategory.get('*') ?? [])];
  }

  private typed(id: string, prefix: string) {
    return id.startsWith(prefix) ? this.byId.get(id) : undefined;
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Validates, lints and indexes a library. Throws StyleLibraryError on any linter issue, so the API
 * refuses to start with an invalid knowledge base, and refuses fixture libraries in production.
 */
export function loadStyleLibrary(raw: RawLibrary = SHIPPED_LIBRARY, options: LoadOptions = {}): StyleLibrary {
  if (options.allowFixtures && options.appEnv === 'production') {
    throw new Error('Fixture style libraries are never loaded in production (T-29)');
  }
  const result = lintLibrary(raw, { allowFixtures: options.allowFixtures });
  if (result.issues.length > 0) throw new StyleLibraryError(result.issues);
  return new StyleLibrary(result.approved);
}
