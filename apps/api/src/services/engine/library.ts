import {
  WEAR_TYPE_IDS,
  type Category,
  type Department,
  type Occasion,
  type Style,
  type WearType,
} from '@styleme/contracts';
import type { FabricRule, Palette, StylingRule, Template } from '../../style-rules/schemas';

export type Rule = StylingRule | FabricRule;

/**
 * The only way the engine reads styling records (D-110). Today `style-rules/loader.ts` implements it
 * from the approved JSON library (and tests pass fixture libraries); later the published MongoDB
 * catalogue (TD-FS-CAT-02) implements the same interface without changing the engine.
 */
export interface StyleLibrary {
  /** Changes whenever any record or record version changes. */
  readonly contentVersion: string;
  readonly palettes: readonly Palette[];
  getPalette(id: string): Palette | undefined;
  /** For naming saved looks (D-116); a template retired since the look was made returns undefined. */
  getTemplate(id: string): Template | undefined;
  getRule(id: string): Rule | undefined;
  /** Templates for an occasion, optional style and department (`any` sees all; others also see `any`). */
  findTemplates(query: { occasion: Occasion; style?: Style; department: Department }): Template[];
  palettesForOccasion(occasion: Occasion): readonly Palette[];
  /** Rules naming the category plus rules that apply to every category. */
  rulesForCategory(category: Category): Rule[];
}

/**
 * A template's wear type (D-96). Stand-in until #63 Part 1 adds the `wearType` field: the C0 drafts
 * carry it as a `wear-indian` / `wear-fusion` / `wear-western` tag. When the field lands, only this
 * function changes. `null` means the template doesn't say, so a wear-type filter excludes it.
 */
export function templateWearType(template: Template): WearType | null {
  for (const tag of template.tags) {
    const value = tag.startsWith('wear-') ? tag.slice('wear-'.length) : null;
    if (value && (WEAR_TYPE_IDS as readonly string[]).includes(value)) return value as WearType;
  }
  return null;
}
