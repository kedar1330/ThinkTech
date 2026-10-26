import type { ClothingPreference, PhotoContentType } from '@styleme/contracts';
import { buildBodyPrompt, buildFacePrompt } from './prompts/photo-analysis-v2';

// Photo-analysis provider (D-129, D-131). The service talks to the `PhotoAnalysisProvider` interface only;
// tests inject a fake through AppDeps, so CI needs no key. The photo is sent to Gemini and nothing else
// about the user, except the height they entered, which goes with the full-body photo only: no name,
// email, ID or other profile data. Nothing from the request or reply is logged.

export type VisionFailure = 'timeout' | 'rate_limited' | 'provider_error' | 'invalid_output';

/** A provider failure with a cause that is safe to log (no request or response content). */
export class VisionProviderError extends Error {
  constructor(
    readonly cause: VisionFailure,
    readonly details?: string,
  ) {
    super(`Photo analysis provider failed: ${cause}${details ? ` (${details})` : ''}`);
    this.name = 'VisionProviderError';
  }
}

export interface PhotoInput {
  bytes: Buffer;
  contentType: PhotoContentType;
}

export interface PhotoAnalysisProvider {
  readonly name: string;
  readonly model: string;
  /** Returns the provider's parsed JSON reply, unvalidated; the service validates it. */
  analyzeFace(photo: PhotoInput, signal: AbortSignal): Promise<unknown>;
  /** `heightCm` is the height from the user's profile, or null when they haven't given one. */
  analyzeBody(
    photo: PhotoInput,
    department: ClothingPreference,
    heightCm: number | null,
    signal: AbortSignal,
  ): Promise<unknown>;
  describeModel?(photo: PhotoInput, signal: AbortSignal): Promise<string | null>;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const VISION_FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

/** Gemini `generateContent` with the photo inline (D-129). */
export function geminiVisionProvider(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): PhotoAnalysisProvider {
  async function generate(photo: PhotoInput, prompt: string, signal: AbortSignal): Promise<unknown> {
    const candidateModels = [model, ...VISION_FALLBACKS].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let res: Response | undefined;
    let details: string | undefined;
    let isRateLimited = false;

    for (const targetModel of candidateModels) {
      if (signal.aborted) throw new VisionProviderError('timeout');
      try {
        res = await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(targetModel)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: photo.contentType, data: photo.bytes.toString('base64') } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json', temperature: 0 },
          }),
          signal,
        });
      } catch {
        if (signal.aborted) throw new VisionProviderError('timeout');
        continue;
      }

      if (res.ok) {
        break;
      }

      if (res.status === 429) isRateLimited = true;

      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        details = errJson?.error?.message;
      } catch {
        // ignore
      }

      if ([429, 500, 502, 503, 504].includes(res.status)) {
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      if (isRateLimited) throw new VisionProviderError('rate_limited');
      throw new VisionProviderError('provider_error', details);
    }
    try {
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') throw new Error('no text');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      return JSON.parse(jsonStr) as unknown;
    } catch {
      throw new VisionProviderError(signal.aborted ? 'timeout' : 'invalid_output');
    }
  }

  return {
    name: 'gemini',
    model,
    analyzeFace: (photo, signal) => generate(photo, buildFacePrompt(), signal),
    analyzeBody: (photo, department, heightCm, signal) =>
      generate(photo, buildBodyPrompt(department, heightCm), signal),
    describeModel: (photo, signal) => describeModelPhoto(photo, apiKey, model, signal, fetchImpl),
  };
}

/** Cleans model description for turntable prompt insertion. */
export function cleanModelDescription(raw: string): string {
  let cleaned = raw
    .replace(/^(A|An)\s+(full-length\s+)?(photo|picture|image|portrait)\s+of\s+/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  cleaned = cleaned.replace(/\.+$/, '').trim();
  return cleaned;
}

/** Describes a person in an uploaded body photo for the 3D Virtual Try-On studio. */
export async function describeModelPhoto(
  photo: PhotoInput,
  apiKey?: string,
  model = 'gemini-3.5-flash-lite',
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;

  const prompt =
    'Describe this person for an image generation prompt in 15-20 words: their apparent gender, ethnicity or skin tone, hair style and color, facial expression (e.g. warm smile), and body build. Do NOT describe any clothing or outfit they are wearing. Output ONLY the concise description text.';

  const candidateModels = [model, ...VISION_FALLBACKS].filter((m, idx, arr) => arr.indexOf(m) === idx);

  for (const targetModel of candidateModels) {
    if (signal?.aborted) return null;
    try {
      const res = await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(targetModel)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: photo.contentType, data: photo.bytes.toString('base64') } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
        signal,
      });

      if (!res.ok) continue;

      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === 'string' && text.trim().length > 0) {
        return cleanModelDescription(text);
      }
    } catch {
      if (signal?.aborted) return null;
      continue;
    }
  }

  return null;
}

