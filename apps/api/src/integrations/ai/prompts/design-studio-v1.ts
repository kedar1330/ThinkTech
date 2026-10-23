import { DESIGN_UNUSABLE_REASONS } from '@styleme/contracts';

// Design Studio prompt (D-134). One Gemini call turns the user's sketch, picture, description or look +
// change request into (1) a garment-only prompt for the image model and (2) a tailor's specification.
// The brief holds garment details only; the user's profile, photos and measurements are never part of it.

export const DESIGN_PROMPT_VERSION = 'design-studio-v1';

export function buildDesignPrompt(brief: string, hasImage: boolean): string {
  return `You are a senior fashion technical designer for StyleMe, a styling app for Indian, fusion and western wear.
A user wants a garment made by their own tailor. ${
    hasImage
      ? 'The attached image is their hand-drawn sketch or a picture of a garment. Read every design detail from it.'
      : 'There is no image; work from the brief alone.'
  }

BRIEF FROM STYLEME
${brief}

YOUR TASK
1. Work out the finished design: garment type, silhouette, neckline, sleeves, length, closure, fabric, colours, pattern and embellishment.
   When the brief gives an original look and a change, keep everything from the original look exactly as it is and change only what the user asked for.
   Fill gaps with choices a tailor would expect for this garment; never contradict the user.
2. Write "imagePrompt": one English paragraph under 900 characters for a text-to-image model. Describe the garment precisely
   (type, silhouette, neckline, sleeves, length, fabric and its texture, colour names, pattern, embellishment), shown on a faceless
   tailor's dress form (mannequin) in a clean studio, front view, the whole garment visible, soft even lighting, plain light background,
   photorealistic fabric. No people, no faces, no skin, no text, no logos, no brand names.
3. Write "tailorSpec" so a tailor can cut and stitch it. Yardage is an estimate for a standard adult size M with the fabric width stated,
   as a range in metres; say that the tailor confirms it with the wearer's measurements. Never ask for or mention anyone's measurements, body or appearance.

RULES
- Describe clothing only. Never describe a person, face, body shape, skin, age or identity, even if one appears in the image.
- If the image is a photograph in which a real person's face is clearly visible, return {"usable": false, "reason": "shows_person"}.
- If there is no garment to design from, return {"usable": false, "reason": "not_a_garment"}.
- If the input is too vague or unreadable to design from, return {"usable": false, "reason": "unclear"}.
- Never name real brands, designers, shops or prices.

Return ONLY JSON, with no markdown, in exactly one of these shapes:
{"usable": false, "reason": one of ${JSON.stringify(DESIGN_UNUSABLE_REASONS)}}
{"usable": true,
 "title": "short name for the design, at most 60 characters",
 "summary": "two sentences describing the finished design",
 "imagePrompt": "…",
 "tailorSpec": {
   "garment": "…", "silhouette": "…", "neckline": "…", "sleeves": "…", "length": "…", "closure": "…",
   "fabric": {"primary": "…", "alternatives": ["…"], "lining": "…"},
   "yardage": {"estimate": "e.g. 2.5–3 m of 44-inch fabric", "basis": "…"},
   "cutting": ["step", "…"], "stitching": ["step", "…"], "finishing": ["…"], "embellishment": ["…"], "tailorNotes": ["…"]
 }}`;
}
