import { buildPlanPrompt, buildReplyPrompt, type PlanPayload, type ReplyPayload } from './prompts/style-assistant-v1';

// Style Assistant provider (D-136). The service talks to the `AssistantProvider` interface only; tests inject a
// fake through AppDeps, so CI needs no key. Gemini receives the user's question, their earlier questions in the
// conversation and, for the reply, the facts StyleMe's features returned: no name, email, ID, photos,
// measurements, height or appearance labels. Nothing from the request or reply is logged.

export type AssistantFailure = 'timeout' | 'rate_limited' | 'provider_error' | 'invalid_output';

/** A provider failure with a cause that is safe to log (no request or response content). */
export class AssistantProviderError extends Error {
  constructor(readonly cause: AssistantFailure) {
    super(`Style Assistant provider failed: ${cause}`);
    this.name = 'AssistantProviderError';
  }
}

export interface AssistantProvider {
  readonly name: string;
  readonly model: string;
  /** Chooses the intent and details; returns the parsed JSON reply, unvalidated. */
  plan(payload: PlanPayload, signal: AbortSignal): Promise<unknown>;
  /** Writes the reply text; returns the parsed JSON reply, unvalidated. */
  reply(payload: ReplyPayload, signal: AbortSignal): Promise<unknown>;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Gemini `generateContent`, text only. */
export function geminiAssistantProvider(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): AssistantProvider {
  async function generate(prompt: string, temperature: number, signal: AbortSignal): Promise<unknown> {
    let res: Response;
    try {
      res = await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature },
        }),
        signal,
      });
    } catch {
      throw new AssistantProviderError(signal.aborted ? 'timeout' : 'provider_error');
    }
    if (res.status === 429) throw new AssistantProviderError('rate_limited');
    if (!res.ok) throw new AssistantProviderError('provider_error');
    try {
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string') throw new Error('no text');
      const json = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
      return JSON.parse(json) as unknown;
    } catch {
      throw new AssistantProviderError(signal.aborted ? 'timeout' : 'invalid_output');
    }
  }

  return {
    name: 'gemini',
    model,
    plan: (payload, signal) => generate(buildPlanPrompt(payload), 0, signal),
    reply: (payload, signal) => generate(buildReplyPrompt(payload), 0.5, signal),
  };
}
