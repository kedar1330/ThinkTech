import {
  WordingProviderError,
  type WordingFailure,
  type WordingProvider,
} from '../../src/integrations/ai/wording-client';
import type { WordingPayload } from '../../src/integrations/ai/prompts/v1';

// A fake AI wording provider (#55, D-39: no real provider or key in tests). It records every payload
// it receives so tests can check exactly what would leave the API (T-27), and replies as told (T-26).

export type FakeReply =
  | { kind: 'ok' }
  | { kind: 'fail'; cause: WordingFailure }
  | { kind: 'hang' }
  | { kind: 'reply'; body: (payload: WordingPayload) => unknown };

/** A faithful rewording: it uses only the payload's labels and lists every reference. */
export function faithfulReply(payload: WordingPayload) {
  const liked = payload.attributes.filter((a) => a.attribute === 'likedColor').map((a) => a.label.toLowerCase());
  const parts = [
    `This ${payload.template.name.toLowerCase()} uses the ${payload.palette.name} palette for ${payload.occasion.toLowerCase()}.`,
    liked.length > 0 ? `It brings in ${liked.join(' and ')}, which you like.` : '',
    ...payload.rules.map((r) => r.rationale),
  ];
  return { text: parts.filter(Boolean).join(' '), references: [...payload.references] };
}

export class FakeWordingProvider implements WordingProvider {
  readonly name = 'fake';
  readonly model = 'fake-wording-model';
  readonly payloads: WordingPayload[] = [];

  constructor(public reply: FakeReply = { kind: 'ok' }) {}

  async reword(payload: WordingPayload, signal: AbortSignal): Promise<unknown> {
    this.payloads.push(structuredClone(payload));
    switch (this.reply.kind) {
      case 'ok':
        return faithfulReply(payload);
      case 'fail':
        throw new WordingProviderError(this.reply.cause);
      case 'reply':
        return this.reply.body(payload);
      case 'hang':
        // Never answers; the service's timeout must end the wait.
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
  }
}
