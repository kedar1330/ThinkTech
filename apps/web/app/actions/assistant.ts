'use server';

import { revalidatePath } from 'next/cache';
import {
  DESIGN_NOTICE_VERSION,
  chatDesignRequestSchema,
  chatMessageRequestSchema,
  type ChatConversation,
  type ChatReplyResponse,
} from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, redirectIfSignedOut, sameOrigin, tokenOrLogin } from '@/lib/actions';

// Style Assistant (D-136). The chat sends each question through these actions to the API (the browser never
// calls the API), which runs the feature that answers it and stores the conversation.

export type AssistantActionResult = { error?: string; conversation?: ChatConversation };

const SOMETHING_WRONG = 'Something went wrong. Please try again.';
const MESSAGES: Partial<Record<string, string>> = {
  RATE_LIMITED: 'You have asked a lot in a short time. Please wait a minute and try again.',
  PROVIDER_NOT_CONFIGURED: 'Design Studio is not available right now.',
  NOT_FOUND: 'That conversation is no longer available. Start a new one.',
};

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) return SOMETHING_WRONG;
  // These messages are written for users.
  if (['DESIGN_UNUSABLE', 'CONFLICT', 'INVALID_REQUEST', 'AI_UNAVAILABLE'].includes(err.code)) return err.message;
  return MESSAGES[err.code] ?? SOMETHING_WRONG;
}

export async function sendAssistantMessageAction(
  message: string,
  conversationId?: string,
): Promise<AssistantActionResult> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  const parsed = chatMessageRequestSchema.safeParse({ message, ...(conversationId ? { conversationId } : {}) });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check your question.' };
  const token = await tokenOrLogin();
  try {
    const { conversation } = await apiRequest<ChatReplyResponse>('/v1/chat', {
      method: 'POST',
      token,
      body: parsed.data,
    });
    revalidatePath('/assistant');
    return { conversation };
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
}

/** Makes the design the assistant offered, once the user has agreed to the Design Studio notice. */
export async function createAssistantDesignAction(
  conversationId: string,
  description: string,
  agreed: boolean,
): Promise<AssistantActionResult> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (!agreed) return { error: 'Please agree to the Design Studio notice first.' };
  const parsed = chatDesignRequestSchema.safeParse({ conversationId, description, notice: DESIGN_NOTICE_VERSION });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the description.' };
  const token = await tokenOrLogin();
  try {
    const { conversation } = await apiRequest<ChatReplyResponse>('/v1/chat/design', {
      method: 'POST',
      token,
      body: parsed.data,
    });
    revalidatePath('/design-studio');
    return { conversation };
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
}

export async function deleteConversationAction(conversationId?: string): Promise<{ error?: string }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (conversationId !== undefined && !/^[a-f0-9]{24}$/.test(conversationId)) return { error: 'Please try again.' };
  const token = await tokenOrLogin();
  try {
    await apiRequest(conversationId ? `/v1/chat/conversations/${conversationId}` : '/v1/chat/conversations', {
      method: 'DELETE',
      token,
    });
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
  revalidatePath('/assistant');
  return {};
}
