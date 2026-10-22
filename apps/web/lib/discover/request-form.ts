import { recommendationRequestSchema, type RecommendationRequest } from '@styleme/contracts';

// Turns the Discover My Style request form into a POST /v1/recommendations body (FR-LOOK-01). Empty
// optional choices are left out, so the API applies its defaults.

export interface RequestFormFields {
  occasion?: string;
  style?: string;
  wearType?: string[];
  paletteMode?: string;
  /** Hidden fields set when the request is built around a designed garment (D-132). */
  designGarment?: string;
  designOutfit?: string;
}

export type RequestFormResult =
  { ok: true; body: RecommendationRequest } | { ok: false; fieldErrors: Record<string, string> };

export function requestFormToRequest(fields: RequestFormFields): RequestFormResult {
  const parsed = recommendationRequestSchema.safeParse({
    occasion: fields.occasion || undefined,
    style: fields.style || undefined,
    wearType: fields.wearType?.length ? fields.wearType : undefined,
    paletteMode: fields.paletteMode || undefined,
    design:
      fields.designGarment && fields.designOutfit
        ? { garmentType: fields.designGarment, outfitCategory: fields.designOutfit }
        : undefined,
  });
  if (parsed.success) return { ok: true, body: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    fieldErrors[key] ??=
      key === 'occasion' && !fields.occasion ? 'Choose an occasion.' : 'Please choose from the options shown.';
  }
  return { ok: false, fieldErrors };
}
