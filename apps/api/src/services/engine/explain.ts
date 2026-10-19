import { CONTRAST_LEVELS, UNDERTONES } from '@styleme/contracts';
import { findJudgementalLanguage } from '../../style-rules/inclusive-language';
import type { Palette, Template } from '../../style-rules/schemas';
import type { StyleLibrary } from './library';
import type { PreferenceConflict } from './preferences';
import type { Match } from './slots';
import { colorLabel, fabricLabel, fitLabel, joinList, label, occasionLabel, silhouetteLabel, styleLabel } from './text';

// "Why this works" (FR-LOOK-05, -12, -19). Every sentence comes from a structured reference that is
// returned in `explanationRefs`: the template, palette and occasion, matched preferences and signals,
// and the rationale of the approved rules that supported the look. Nothing else is claimed. Each
// sentence passes the inclusive-language check or is left out.

/** Rules quoted per look; the strongest contributions first. */
export const MAX_EXPLAINED_RULES = 3;

export interface Explanation {
  explanation: string;
  explanationRefs: { ruleIds: string[]; attributes: Match[] };
}

interface ExplainInput {
  template: Template;
  palette: Palette;
  occasion: string;
  matched: readonly Match[];
  supporting: ReadonlyMap<string, number>;
  conflicts: readonly PreferenceConflict[];
  library: StyleLibrary;
}

const unique = (values: string[]) => [...new Set(values)];

export function explain(input: ExplainInput): Explanation {
  const sentences: { text: string; ruleId?: string; attributes: Match[] }[] = [];
  const values = (attribute: string) =>
    unique(input.matched.filter((m) => m.attribute === attribute).map((m) => m.value));
  const say = (text: string, attributes: Match[], ruleId?: string) => sentences.push({ text, attributes, ruleId });

  say(
    `${input.template.name}, in colours from the ${input.palette.name} palette, for ${occasionLabel(input.occasion).toLowerCase()}.`,
    [
      { attribute: 'template', value: input.template.id },
      { attribute: 'palette', value: input.palette.id },
      { attribute: 'occasion', value: input.occasion },
    ],
  );

  const sentence = (attribute: string, text: (list: string) => string, toLabel: (id: string) => string) => {
    const found = values(attribute);
    if (found.length === 0) return;
    say(
      text(joinList(found.map((v) => toLabel(v).toLowerCase()))),
      found.map((value) => ({ attribute, value })),
    );
  };
  sentence('likedColor', (l) => `It uses ${l} from your liked colours.`, colorLabel);
  sentence('likedFabric', (l) => `It uses ${l} from your liked fabrics.`, fabricLabel);
  sentence('preferredSilhouette', (l) => `It follows your preferred ${l} silhouette.`, silhouetteLabel);
  sentence('preferredFit', (l) => `It uses your preferred ${l} fit.`, fitLabel);
  sentence('preferredStyle', (l) => `It matches your ${l} style.`, styleLabel);
  sentence(
    'contrastPreference',
    (l) => `Its ${l}-contrast colour pairing matches your contrast preference.`,
    (id) => label(CONTRAST_LEVELS, id),
  );
  if (values('coverage').length > 0) {
    say(
      'It keeps to your coverage preferences.',
      values('coverage').map((value) => ({ attribute: 'coverage', value })),
    );
  }
  sentence(
    'undertone',
    (l) => `The palette is one suggested for a ${l} undertone, from the details you shared.`,
    (id) => label(UNDERTONES, id),
  );
  if (values('skinTone').length > 0) {
    say(
      'The palette is one suggested for the skin tone range you shared.',
      values('skinTone').map((value) => ({ attribute: 'skinTone', value })),
    );
  }

  const strongest = [...input.supporting.entries()]
    .sort(([a, wa], [b, wb]) => wb - wa || a.localeCompare(b))
    .slice(0, MAX_EXPLAINED_RULES);
  for (const [ruleId] of strongest) {
    const rule = input.library.getRule(ruleId);
    if (rule) say(rule.rationale, [], ruleId);
  }

  for (const conflict of input.conflicts) {
    const attributes = [{ attribute: `conflict.${conflict.field}`, value: conflict.value }];
    if (conflict.field === 'colors') {
      say(
        `${colorLabel(conflict.value)} is in both your liked and disliked colours, so it is left out until you choose.`,
        attributes,
      );
    } else if (conflict.field === 'fabrics') {
      say(
        `${fabricLabel(conflict.value)} is in both your liked and avoided fabrics, so it is left out until you choose.`,
        attributes,
      );
    }
  }

  const kept = sentences.filter((s) => findJudgementalLanguage(s.text).length === 0);
  // Record names and rationales are linted for the same phrases, so this only guards the contract.
  if (kept.length === 0) kept.push({ text: 'A look built from approved styling records.', attributes: [] });
  return {
    explanation: kept.map((s) => s.text).join(' '),
    explanationRefs: {
      ruleIds: unique(kept.flatMap((s) => (s.ruleId ? [s.ruleId] : []))),
      attributes: kept.flatMap((s) => s.attributes),
    },
  };
}
