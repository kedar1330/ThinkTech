import { MONK_RANGE_MAX_SPAN, updateAppearanceRequestSchema, type UpdateAppearanceRequest } from '@styleme/contracts';

// Turns the appearance form into a PUT /v1/appearance body. An empty choice clears that signal.

export interface AppearanceFormFields {
  monkFrom?: string;
  monkTo?: string;
  undertone?: string;
  bodyProportions?: string;
  useInRecommendations?: string;
}

export type AppearanceFormResult = { ok: true; body: UpdateAppearanceRequest } | { ok: false; error: string };

export function appearanceFormToRequest(fields: AppearanceFormFields): AppearanceFormResult {
  const from = fields.monkFrom ? Number(fields.monkFrom) : null;
  const to = fields.monkTo ? Number(fields.monkTo) : null;

  let monkRange: string | null = null;
  if (from !== null || to !== null) {
    // One end chosen means a single tone; a reversed range is put in order.
    const a = from ?? to!;
    const b = to ?? from!;
    const [low, high] = a <= b ? [a, b] : [b, a];
    if (high - low > MONK_RANGE_MAX_SPAN) {
      return { ok: false, error: `Choose a skin-tone range of at most ${MONK_RANGE_MAX_SPAN + 1} neighbouring tones.` };
    }
    monkRange = `${low}-${high}`;
  }

  const parsed = updateAppearanceRequestSchema.safeParse({
    skinTone: { value: monkRange === null ? null : { monkRange } },
    undertone: { value: fields.undertone || null },
    bodyProportions: { value: fields.bodyProportions || null },
    useInRecommendations: fields.useInRecommendations === 'on',
  });
  if (!parsed.success) return { ok: false, error: 'Please choose from the options shown.' };
  return { ok: true, body: parsed.data };
}

/** Clears every signal; the toggle is left as it is. */
export const CLEAR_ALL_SIGNALS: UpdateAppearanceRequest = {
  skinTone: { value: null },
  undertone: { value: null },
  bodyProportions: { value: null },
};
