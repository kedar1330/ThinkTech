import { buildWordingPrompt, type WordingPayload } from './prompts/v1';

// Wording providers for the optional AI explanation step (FR-LOOK-16, D-67). The service talks to the
// `WordingProvider` interface only; tests inject a fake through AppDeps, so CI needs no key (D-39).

export type WordingFailure = 'timeout' | 'rate_limited' | 'provider_error' | 'invalid_output';

/** A provider failure with a cause that is safe to log (no request or response content). */
export class WordingProviderError extends Error {
  constructor(readonly cause: WordingFailure) {
    super(`AI wording provider failed: ${cause}`);
    this.name = 'WordingProviderError';
  }
}

export interface WordingProvider {
  /** Provider name, stored in `aiCache.provider`. */
  readonly name: string;
  /** Stored as the look's `aiModel` when its text is used. */
  readonly model: string;
  /** Returns the provider's parsed JSON reply, unvalidated; the service validates it. */
  reword(payload: WordingPayload, signal: AbortSignal): Promise<unknown>;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini `generateContent` (D-12: the lowest-cost current model that passes the evaluation set, on a
 * tier whose terms exclude training on content; the model is chosen and recorded when enabling).
 */
export function geminiWordingProvider(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): WordingProvider {
  return {
    name: 'gemini',
    model,
    async reword(payload, signal) {
      let res: Response;
      try {
        res = await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: buildWordingPrompt(payload) }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          }),
          signal,
        });
      } catch {
        throw new WordingProviderError(signal.aborted ? 'timeout' : 'provider_error');
      }
      if (res.status === 429) throw new WordingProviderError('rate_limited');
      if (!res.ok) throw new WordingProviderError('provider_error');
      try {
        const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== 'string') throw new Error('no text');
        return JSON.parse(text) as unknown;
      } catch {
        throw new WordingProviderError(signal.aborted ? 'timeout' : 'invalid_output');
      }
    },
  };
}
