import type { PhotoContentType } from '@styleme/contracts';
import { buildDesignPrompt } from './prompts/design-studio-v1';
import { VisionProviderError } from './vision-client';

// Design Studio analysis provider (D-134). The service talks to the `DesignAnalysisProvider` interface only;
// tests inject a fake through AppDeps, so CI needs no key. Gemini receives the user's sketch or garment
// picture (when there is one) and a garment-only brief: no name, email, ID, photos or profile data.
// Nothing from the request or reply is logged.

export interface DesignImageInput {
  bytes: Buffer;
  contentType: PhotoContentType;
}

export interface DesignAnalysisProvider {
  readonly name: string;
  readonly model: string;
  /** Returns the provider's parsed JSON reply, unvalidated; the service validates it. */
  deconstruct(input: { brief: string; image: DesignImageInput | null }, signal: AbortSignal): Promise<unknown>;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Gemini `generateContent`, with the sketch inline when there is one. */
export function geminiDesignProvider(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): DesignAnalysisProvider {
  return {
    name: 'gemini',
    model,
    async deconstruct({ brief, image }, signal) {
      const parts: object[] = [];
      if (image) parts.push({ inlineData: { mimeType: image.contentType, data: image.bytes.toString('base64') } });
      parts.push({ text: buildDesignPrompt(brief, image !== null) });

      const tryCall = async (targetModel: string) => {
        const attemptController = new AbortController();
        const timeoutId = setTimeout(() => attemptController.abort(), 18000);
        const onParentAbort = () => attemptController.abort();
        signal.addEventListener('abort', onParentAbort, { once: true });

        try {
          return await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(targetModel)}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ role: 'user', parts }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
            }),
            signal: attemptController.signal,
          });
        } finally {
          clearTimeout(timeoutId);
          signal.removeEventListener('abort', onParentAbort);
        }
      };

      const candidateModels = [
        ...(model !== 'gemini-3.8-flash' ? [model] : []),
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite-preview',
        ...(model === 'gemini-3.8-flash' ? [model] : []),
      ].filter((m, idx, arr) => arr.indexOf(m) === idx);

      let res: Response | undefined;
      for (const targetModel of candidateModels) {
        if (signal.aborted) throw new VisionProviderError('timeout');
        try {
          res = await tryCall(targetModel);
          if (res.ok) break;
          // Fallback if the model is unavailable, rate limited, or not found
          if (![404, 429, 500, 502, 503, 504].includes(res.status)) break;
        } catch {
          if (signal.aborted) throw new VisionProviderError('timeout');
        }
      }

      if (!res) throw new VisionProviderError(signal.aborted ? 'timeout' : 'provider_error');
      if (res.status === 429) throw new VisionProviderError('rate_limited');
      if (!res.ok) throw new VisionProviderError('provider_error', `status ${res.status}`);
      try {
        const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const parts = body.candidates?.[0]?.content?.parts ?? [];
        const textPart =
          parts.find((p) => typeof p.text === 'string' && p.text.includes('{')) ??
          parts.find((p) => typeof p.text === 'string');
        const text = textPart?.text;
        if (typeof text !== 'string') throw new Error('no text');
        const json = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
        return JSON.parse(json) as unknown;
      } catch {
        throw new VisionProviderError(signal.aborted ? 'timeout' : 'invalid_output');
      }
    },
  };
}
