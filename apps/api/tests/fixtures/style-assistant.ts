import {
  AssistantProviderError,
  type AssistantFailure,
  type AssistantProvider,
} from '../../src/integrations/ai/assistant-client';
import type { PlanPayload, ReplyPayload } from '../../src/integrations/ai/prompts/style-assistant-v1';

// Fake Style Assistant provider (D-136; no real provider or key in tests). It records what it receives, so tests
// can check what leaves the API, and replies as told. All content is synthetic.

export type FakeAssistantReply = { kind: 'reply'; body: unknown } | { kind: 'fail'; cause: AssistantFailure };

export class FakeAssistant implements AssistantProvider {
  readonly name = 'fake';
  readonly model = 'fake-assistant-model';
  readonly plans: PlanPayload[] = [];
  readonly replies: ReplyPayload[] = [];
  planReply: FakeAssistantReply = {
    kind: 'reply',
    body: { intent: 'looks', occasion: 'wedding', style: null, wearTypes: ['indian'], designDescription: null },
  };
  replyReply: FakeAssistantReply = { kind: 'reply', body: { reply: 'Synthetic fixture reply about the looks below.' } };

  async plan(payload: PlanPayload): Promise<unknown> {
    this.plans.push(payload);
    if (this.planReply.kind === 'fail') throw new AssistantProviderError(this.planReply.cause);
    return this.planReply.body;
  }

  async reply(payload: ReplyPayload): Promise<unknown> {
    this.replies.push(payload);
    if (this.replyReply.kind === 'fail') throw new AssistantProviderError(this.replyReply.cause);
    return this.replyReply.body;
  }
}
