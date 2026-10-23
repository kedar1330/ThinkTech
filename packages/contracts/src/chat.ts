import { z } from 'zod';
import { objectIdSchema } from './common';
import { DESIGN_DESCRIPTION_MAX, DESIGN_NOTICE_VERSION, type DesignSummary } from './design';
import type { Look } from './outfit';

// Style Assistant (D-136, approved 2026-10-23; stages this part of D-76). The user asks in plain language; the
// assistant works out which StyleMe feature answers it, runs that feature for the user and shows the result
// (looks, colours, palettes, a design, saved looks) in the chat with links into the feature. Gemini reads the
// user's words to choose the feature and writes the reply from the feature's results, never from photos,
// measurements, height or the skin tone, undertone and body type labels. Without Gemini, a keyword matcher
// chooses and fixed wording replies.

/** What a message asks for; each maps to one feature. `general` is a styling question no feature answers. */
export const ASSISTANT_INTENTS = [
  'looks',
  'colours',
  'palettes',
  'design',
  'saved',
  'shop',
  'try_on',
  'profile',
  'general',
  'help',
] as const;
export const assistantIntentSchema = z.enum(ASSISTANT_INTENTS);
export type AssistantIntent = z.infer<typeof assistantIntentSchema>;

export const CHAT_MESSAGE_MAX = 500;
/** Conversations kept per user; the oldest is removed when a new one starts. */
export const CHAT_CONVERSATION_LIMIT = 30;
/** Messages kept per conversation (user and assistant together); the oldest drop off. */
export const CHAT_MESSAGE_LIMIT = 100;

/** `POST /v1/chat`: a new message, in a new conversation when `conversationId` is absent. */
export const chatMessageRequestSchema = z
  .object({
    message: z.string().trim().min(1, 'Type a question').max(CHAT_MESSAGE_MAX),
    conversationId: objectIdSchema.optional(),
  })
  .strict();
export type ChatMessageRequest = z.infer<typeof chatMessageRequestSchema>;

/**
 * `POST /v1/chat/design`: the user agreed to the Design Studio notice for a design the assistant offered, so the
 * assistant makes it. The description is the one the assistant showed, which the user may have edited.
 */
export const chatDesignRequestSchema = z
  .object({
    conversationId: objectIdSchema,
    description: z.string().trim().min(10, 'Describe the outfit in a few words').max(DESIGN_DESCRIPTION_MAX),
    notice: z.literal(DESIGN_NOTICE_VERSION),
  })
  .strict();
export type ChatDesignRequest = z.infer<typeof chatDesignRequestSchema>;

// --- Responses -------------------------------------------------------------------------------------

/** A link into the feature that produced a result, or the next step there. */
export interface ChatLink {
  label: string;
  /** A path in the web app, e.g. `/saved/<id>` or `/design-studio`. */
  href: string;
}

/** What the assistant shows with its words. Looks and designs are snapshots; the links open the live ones. */
export type ChatCard =
  | { kind: 'looks'; looks: Look[] }
  | { kind: 'colours'; colours: Array<{ name: string; hex: string }> }
  | {
      kind: 'palettes';
      palettes: Array<{ id: string; name: string; colours: Array<{ name: string; hex: string }> }>;
    }
  | { kind: 'design'; design: DesignSummary }
  /** A design the assistant can make once the user agrees to the Design Studio notice. */
  | { kind: 'design_offer'; description: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Assistant messages only. */
  intent: AssistantIntent | null;
  cards: ChatCard[];
  links: ChatLink[];
  /** `ai` when Gemini wrote the reply, `fixed` for StyleMe's own wording. User messages are `null`. */
  wording: 'ai' | 'fixed' | null;
  createdAt: string;
}

export interface ChatConversationSummary {
  id: string;
  /** The first question, shortened. */
  title: string;
  updatedAt: string;
}

export interface ChatConversation extends ChatConversationSummary {
  messages: ChatMessage[];
}

/** `GET /v1/chat`: the user's conversations (newest first), suggested questions and what is switched on. */
export interface ChatOverviewResponse {
  /** Gemini reads questions and writes replies; when false the assistant still works with fixed wording. */
  aiAvailable: boolean;
  /** Design Studio can make designs from the chat. */
  designAvailable: boolean;
  suggestions: string[];
  conversations: ChatConversationSummary[];
}

/** `POST /v1/chat` and `POST /v1/chat/design`: the conversation with the new messages appended. */
export interface ChatReplyResponse {
  conversation: ChatConversation;
}

/** Shown as starting points; each one maps to a feature. */
export const CHAT_SUGGESTIONS = [
  'What should I wear to a wedding?',
  'Which colours suit me best?',
  'Show me my colour palettes',
  'Design a kurta with puff sleeves',
  'Show my saved outfits',
  'Help me shop for a work look',
] as const;
