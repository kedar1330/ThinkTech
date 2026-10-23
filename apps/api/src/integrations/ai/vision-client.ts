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
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Gemini `generateContent` with the photo inline (D-129). */
export function geminiVisionProvider(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): PhotoAnalysisProvider {
  async function generate(photo: PhotoInput, prompt: string, signal: AbortSignal): Promise<unknown> {
    let res: Response;
    try {
      res = await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
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
      throw new VisionProviderError(signal.aborted ? 'timeout' : 'provider_error');
    }
    if (res.status === 429) throw new VisionProviderError('rate_limited');
    if (!res.ok) {
      let details: string | undefined;
      try {
        const errJson = (await res.json()) as { error?: { message?: string } };
        details = errJson?.error?.message;
      } catch {
        // ignore
      }
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
  };
}
