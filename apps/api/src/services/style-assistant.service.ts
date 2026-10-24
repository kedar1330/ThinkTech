import { Types } from 'mongoose';
import type { Logger } from 'pino';
import { z } from 'zod';
import {
  CATEGORIES,
  CHAT_CONVERSATION_LIMIT,
  CHAT_MESSAGE_LIMIT,
  CHAT_SUGGESTIONS,
  COLORS,
  OCCASIONS,
  assistantIntentSchema,
  occasionSchema,
  recommendationRequestSchema,
  styleSchema,
  wearTypeSchema,
  type AssistantIntent,
  type ChatCard,
  type ChatConversation,
  type ChatDesignRequest,
  type ChatLink,
  type ChatMessage,
  type ChatMessageRequest,
  type ChatOverviewResponse,
  type ChatReplyResponse,
  type Look,
  type Occasion,
  type Style,
  type WearType,
} from '@styleme/contracts';
import { AssistantProviderError, type AssistantProvider } from '../integrations/ai/assistant-client';
import type { Models } from '../models';
import { AppError } from '../utils/errors';
import type { ColourLibraryService } from './colour-library.service';
import type { DesignStudioService } from './design-studio.service';
import type { OutfitsService } from './outfits.service';
import type { PaletteService } from './palette.service';
import type { RecommendationsService } from './recommendations.service';

// Style Assistant (D-136). One question → a plan (intent and details) → the StyleMe feature that answers it,
// run for this user → a reply in words, with the feature's results as cards and links into the feature.
// Gemini plans from the user's words and writes the reply from the facts below; without it (no key,
// failure or timeout) a keyword matcher plans and fixed wording replies, so the assistant always answers.
// Facts never include photos, measurements, height or the skin tone, undertone and body type labels.

export interface Plan {
  intent: AssistantIntent;
  occasion: Occasion | null;
  style: Style | null;
  wearTypes: WearType[];
  designDescription: string | null;
}

const planSchema = z.object({
  intent: assistantIntentSchema,
  occasion: occasionSchema.nullish().catch(null),
  style: styleSchema.nullish().catch(null),
  wearTypes: z.array(wearTypeSchema).max(3).nullish().catch([]),
  designDescription: z.string().trim().max(1200).nullish().catch(null),
});
const replySchema = z.object({ reply: z.string().trim().min(1).max(1200) });

// --- Keyword planner (fallback) ---------------------------------------------------------------------

const OCCASION_WORDS: [Occasion, RegExp][] = [
  ['wedding', /\b(wedding|shaadi|shadi|sangeet|mehendi|mehndi|haldi|reception|baraat)\b/],
  ['festive', /\b(festive|festival|diwali|eid|holi|puja|pooja|navratri|garba|onam|pongal|rakhi|karva)\b/],
  ['work', /\b(work|office|meeting|interview|presentation|corporate)\b/],
  ['party', /\b(party|club|clubbing|birthday|cocktail)\b/],
  ['date', /\b(date|dinner|anniversary)\b/],
  ['travel', /\b(travel|trip|vacation|holiday|flight|beach|hills)\b/],
  ['formal', /\b(formal|gala|black tie|ceremony)\b/],
  ['everyday', /\b(everyday|daily|college|casual|weekend|summer|winter|monsoon|rain|brunch)\b/],
];

const WEAR_WORDS: [WearType, RegExp][] = [
  ['fusion', /\b(fusion|indo[- ]?western)\b/],
  ['indian', /\b(indian|ethnic|traditional|desi)\b/],
  ['western', /(?<!indo[- ]?)\bwestern\b/],
];

const STYLE_WORDS: [Style, RegExp][] = [
  ['minimal', /\bminimal(ist)?\b/],
  ['classic', /\bclassic\b/],
  ['smart_casual', /\bsmart[- ]casual\b/],
  ['streetwear', /\bstreet ?wear\b/],
  ['boho', /\bboho(emian)?\b/],
];

/** Deterministic plan from keywords, used when Gemini is not available or fails. */
export function keywordPlan(message: string): Plan {
  const text = message.toLowerCase();
  const occasion = OCCASION_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  const wearTypes = WEAR_WORDS.filter(([, re]) => re.test(text)).map(([id]) => id);
  const style = STYLE_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  const plan = (intent: AssistantIntent): Plan => ({
    intent,
    occasion,
    style,
    wearTypes,
    designDescription: intent === 'design' ? message.trim() : null,
  });

  if (/\b(design|stitch|stitched|tailor|tailored|sketch|customi[sz]e)\b/.test(text)) return plan('design');
  if (/\btry[- ]?(it )?on\b|virtual(ly)? try/.test(text)) return plan('try_on');
  if (/\bsaved\b|\bmy (outfits|looks)\b|\bfavou?rites?\b/.test(text)) return plan('saved');
  if (/\b(shop|shopping|buy|purchase|store|price|cost|amazon|flipkart|meesho|myntra)\b/.test(text)) return plan('shop');
  if (/\bpalettes?\b|\bcombinations?\b|\bcolou?r combos?\b/.test(text)) return plan('palettes');
  if (/\bcolou?rs?\b|\bshades?\b/.test(text)) return plan('colours');
  if (/\b(profile|photo|measurements?|undertone|skin ?tone|body ?type)\b/.test(text)) return plan('profile');
  if (occasion || /\b(wear|outfit|look|dress|attire|style me|suggest|what to put on)\b/.test(text)) {
    return plan('looks');
  }
  if (/^\s*(hi|hello|hey|namaste|help)\b|what can you do/.test(text)) return plan('help');
  return plan('general');
}

// --- Feature results ---------------------------------------------------------------------------------

interface Answer {
  /** Plain sentences for the reply writer; nothing about the user's appearance or body. */
  facts: string[];
  /** StyleMe's own reply, used when Gemini is not available. */
  fixedText: string;
  cards: ChatCard[];
  links: ChatLink[];
}

const label = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((o) => o.id === id)?.label ?? id.replace(/_/g, ' ');

const GARMENT_SLOTS = new Set(['layer', 'one_piece', 'top', 'bottom']);

/** E.g. "Navy kurta · Ivory trousers", from the shared vocabulary. */
export function lookName(look: Pick<Look, 'slots'>): string {
  return look.slots
    .filter((s) => GARMENT_SLOTS.has(s.slot))
    .map((s) => `${label(COLORS, s.lookSpec.colorId)} ${label(CATEGORIES, s.lookSpec.category).toLowerCase()}`)
    .join(' · ');
}

const HELP_TEXT =
  'I can suggest outfits for an occasion, show the colours and palettes that suit you, design a garment for your tailor, show your saved outfits and help you shop a look. What would you like to try?';

const UNAVAILABLE_TEXT = 'Sorry, I couldn’t get that from StyleMe just now. Please try again in a moment.';

export interface StyleAssistantDeps {
  models: Models;
  recommendations: RecommendationsService;
  outfits: OutfitsService;
  palettes: PaletteService;
  colours: ColourLibraryService;
  designStudio: DesignStudioService;
  /** Design Studio is switched on and Gemini is configured for it. */
  designAvailable: boolean;
  /** Null when Gemini is not configured or the assistant's AI is switched off. */
  provider: AssistantProvider | null;
  timeoutMs: number;
  logger: Logger;
}

type StoredMessage = {
  _id: Types.ObjectId;
  role: 'user' | 'assistant';
  text: string;
  intent?: string | null;
  cards?: unknown[];
  links?: ChatLink[];
  wording?: 'ai' | 'fixed' | null;
  createdAt: Date;
};
type StoredConversation = {
  _id: Types.ObjectId;
  title: string;
  messages: StoredMessage[];
  updatedAt: Date;
};

function toMessage(m: StoredMessage): ChatMessage {
  return {
    id: String(m._id),
    role: m.role,
    text: m.text,
    intent: (m.intent ?? null) as AssistantIntent | null,
    cards: (m.cards ?? []) as ChatCard[],
    links: (m.links ?? []).map((l) => ({ label: l.label, href: l.href })),
    wording: m.wording ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

function toConversation(doc: StoredConversation): ChatConversation {
  return {
    id: String(doc._id),
    title: doc.title,
    updatedAt: doc.updatedAt.toISOString(),
    messages: doc.messages.map(toMessage),
  };
}

const titleOf = (message: string) => (message.length > 60 ? `${message.slice(0, 57).trimEnd()}…` : message);

export class StyleAssistantService {
  constructor(private readonly deps: StyleAssistantDeps) {}

  async overview(userId: Types.ObjectId): Promise<ChatOverviewResponse> {
    const docs = await this.deps.models.ChatConversation.find({ userId })
      .sort({ updatedAt: -1 })
      .select({ title: 1, updatedAt: 1 })
      .lean();
    return {
      aiAvailable: this.deps.provider !== null,
      designAvailable: this.deps.designAvailable,
      suggestions: [...CHAT_SUGGESTIONS],
      conversations: docs.map((d) => ({ id: String(d._id), title: d.title, updatedAt: d.updatedAt.toISOString() })),
    };
  }

  async get(userId: Types.ObjectId, id: string): Promise<ChatConversation> {
    return toConversation(await this.find(userId, id));
  }

  async remove(userId: Types.ObjectId, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const { deletedCount } = await this.deps.models.ChatConversation.deleteOne({ _id: id, userId });
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
  }

  async removeAll(userId: Types.ObjectId): Promise<void> {
    await this.deps.models.ChatConversation.deleteMany({ userId });
  }

  async send(userId: Types.ObjectId, request: ChatMessageRequest): Promise<ChatReplyResponse> {
    const existing = request.conversationId ? await this.find(userId, request.conversationId) : null;
    const earlier = (existing?.messages ?? [])
      .filter((m) => m.role === 'user')
      .slice(-3)
      .map((m) => m.text);

    const plan = await this.plan(request.message, earlier);
    const answer = await this.answer(userId, plan, request.message);
    const reply = await this.word(request.message, plan.intent, answer);
    this.deps.logger.info({ event: 'assistant_reply', intent: plan.intent, wording: reply.wording });

    const now = new Date();
    const messages = [
      {
        role: 'user' as const,
        text: request.message,
        intent: null,
        cards: [],
        links: [],
        wording: null,
        createdAt: now,
      },
      {
        role: 'assistant' as const,
        text: reply.text,
        intent: plan.intent,
        cards: answer.cards,
        links: answer.links,
        wording: reply.wording,
        createdAt: new Date(now.getTime() + 1),
      },
    ];
    const conversationId = existing?._id ?? (await this.start(userId, request.message));
    return { conversation: await this.append(userId, conversationId, messages) };
  }

  /** Makes the design the assistant offered, after the user agreed to the Design Studio notice. */
  async design(userId: Types.ObjectId, request: ChatDesignRequest): Promise<ChatReplyResponse> {
    const conversation = await this.find(userId, request.conversationId);
    const design = await this.deps.designStudio.create(userId, {
      source: 'description',
      description: request.description,
      notice: request.notice,
    });
    const { id, title, source, imageStatus, hasSourceImage, createdAt, summary } = design;
    const pictureNote =
      imageStatus === 'ready' ? '' : ' The picture couldn’t be drawn this time; you can try again in Design Studio.';
    const text = `Here’s your design, “${title}”. ${summary}${pictureNote} Open it to see the full tailor spec.`;
    const message = {
      role: 'assistant' as const,
      text,
      intent: 'design',
      cards: [{ kind: 'design', design: { id, title, source, imageStatus, hasSourceImage, createdAt } }],
      links: [
        { label: 'Open the tailor spec', href: `/design-studio/${id}` },
        { label: 'All my designs', href: '/design-studio' },
      ],
      wording: 'fixed' as const,
      createdAt: new Date(),
    };
    this.deps.logger.info({ event: 'assistant_design', imageStatus });
    return { conversation: await this.append(userId, conversation._id, [message]) };
  }

  // --- Steps ---------------------------------------------------------------------------------------

  private async plan(message: string, earlier: string[]): Promise<Plan> {
    const provider = this.deps.provider;
    if (provider) {
      const raw = await this.withTimeout('plan', (signal) => provider.plan({ message, earlier }, signal));
      const parsed = planSchema.safeParse(raw);
      if (parsed.success) {
        const { intent, occasion, style, wearTypes, designDescription } = parsed.data;
        return {
          intent,
          occasion: occasion ?? null,
          style: style ?? null,
          wearTypes: [...new Set(wearTypes ?? [])],
          designDescription: intent === 'design' ? designDescription || message : null,
        };
      }
      if (raw !== null) this.deps.logger.warn({ event: 'assistant_ai_skipped', step: 'plan', cause: 'invalid_output' });
    }
    return keywordPlan(message);
  }

  private async word(
    question: string,
    intent: AssistantIntent,
    answer: Answer,
  ): Promise<{ text: string; wording: 'ai' | 'fixed' }> {
    const provider = this.deps.provider;
    if (provider) {
      const raw = await this.withTimeout('reply', (signal) =>
        provider.reply({ question, intent, facts: answer.facts }, signal),
      );
      const parsed = replySchema.safeParse(raw);
      if (parsed.success) return { text: parsed.data.reply, wording: 'ai' };
      if (raw !== null)
        this.deps.logger.warn({ event: 'assistant_ai_skipped', step: 'reply', cause: 'invalid_output' });
    }
    return { text: answer.fixedText, wording: 'fixed' };
  }

  private async withTimeout<T>(step: string, call: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.deps.timeoutMs);
    try {
      return await call(controller.signal);
    } catch (err) {
      const cause = err instanceof AssistantProviderError ? err.cause : controller.signal.aborted ? 'timeout' : 'error';
      this.deps.logger.warn({ event: 'assistant_ai_skipped', step, cause });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async answer(userId: Types.ObjectId, plan: Plan, message: string): Promise<Answer> {
    try {
      switch (plan.intent) {
        case 'looks':
          return await this.looks(userId, plan);
        case 'colours':
          return await this.colours(userId);
        case 'palettes':
          return await this.palettes(userId);
        case 'design':
          return this.designOffer(plan.designDescription ?? message);
        case 'saved':
          return await this.saved(userId);
        case 'shop':
          return await this.shop(userId, plan);
        case 'try_on':
          return {
            facts: ['Virtual Try-On is available in StyleMe at /try-on with mannequin previews and photo drape.'],
            fixedText:
              'You can try on outfits and see 3D mannequin previews in Virtual Try-On. Upload your photo or preview looks on our studio mannequin.',
            cards: [],
            links: [{ label: 'Open Virtual Try-On', href: '/try-on' }],
          };
        case 'profile':
          return {
            facts: ['The user can review and change their photos, measurements and appearance details in My Profile.'],
            fixedText:
              'You can review and change your photos, measurements and appearance details in My Profile. Your looks and colours update from there.',
            cards: [],
            links: [{ label: 'Open My Profile', href: '/profile' }],
          };
        case 'help':
          return { facts: [HELP_TEXT], fixedText: HELP_TEXT, cards: [], links: [] };
        case 'general':
          return {
            facts: [],
            fixedText: `I can’t answer general questions right now. ${HELP_TEXT}`,
            cards: [],
            links: [],
          };
      }
    } catch (err) {
      // A feature failed (not the AI): say so plainly rather than invent an answer (FR-CHAT-04).
      if (err instanceof AppError && err.code !== 'INTERNAL_ERROR') {
        return { facts: [err.message], fixedText: err.message, cards: [], links: [] };
      }
      this.deps.logger.error({ event: 'assistant_feature_failed', intent: plan.intent });
      return { facts: [UNAVAILABLE_TEXT], fixedText: UNAVAILABLE_TEXT, cards: [], links: [] };
    }
  }

  private async recommend(userId: Types.ObjectId, plan: Plan): Promise<Look[]> {
    const request = recommendationRequestSchema.parse({
      occasion: plan.occasion ?? 'everyday',
      ...(plan.style ? { style: plan.style } : {}),
      ...(plan.wearTypes.length ? { wearType: plan.wearTypes } : {}),
    });
    const { data } = await this.deps.recommendations.recommend(userId, request);
    return data.looks;
  }

  private async looks(userId: Types.ObjectId, plan: Plan): Promise<Answer> {
    const occasion = plan.occasion ?? 'everyday';
    const occasionLabel = label(OCCASIONS, occasion).toLowerCase();
    const looks = await this.recommend(userId, plan);
    const links = [{ label: 'More options in Discover My Style', href: '/discover/looks' }];
    if (looks.length === 0) {
      const text = `I couldn’t find a look for ${occasionLabel} that fits all your preferences. Try another occasion, or loosen a preference in My Profile.`;
      return {
        facts: [text],
        fixedText: text,
        cards: [],
        links: [...links, { label: 'My Profile', href: '/profile' }],
      };
    }
    return {
      facts: [
        `StyleMe matched ${looks.length} look${looks.length === 1 ? '' : 's'} for the ${occasionLabel} occasion to the user's profile:`,
        ...looks.map((l, i) => `Look ${i + 1}: ${lookName(l)}`),
        'Each look can be saved, shopped in Shop My Look, or changed in Design Studio.',
      ],
      fixedText: `Here ${looks.length === 1 ? 'is a look' : `are ${looks.length} looks`} for ${occasionLabel}, matched to your profile. Save the ones you like, shop them, or change one in Design Studio.`,
      cards: [{ kind: 'looks', looks }],
      links,
    };
  }

  private async colours(userId: Types.ObjectId): Promise<Answer> {
    const mine = await this.deps.colours.mine(userId);
    if (!mine.category) {
      const reason =
        mine.missing === 'signals_off'
          ? 'Colour suggestions use your appearance details, which are switched off in My Profile.'
          : mine.missing === 'not_published'
            ? 'Colours for your skin tone aren’t ready yet.'
            : 'Add your skin tone and undertone in My Profile (or a face photo) to see the colours that suit you.';
      return {
        facts: [reason],
        fixedText: reason,
        cards: [],
        links: [{ label: 'Open My Profile', href: '/profile' }],
      };
    }
    const top = [...mine.colours]
      .filter((c) => c.preference !== 'avoided')
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8);
    return {
      facts: [
        `StyleMe's colour library ranks these as the user's best colours: ${top.map((c) => c.name).join(', ')}.`,
        `The full list has ${mine.colours.length} colours, where the user can mark colours they like or avoid.`,
      ],
      fixedText: `These are your best colours from your colour library. Open My Colour Palette to see all ${mine.colours.length} and mark the ones you like or avoid.`,
      cards: [{ kind: 'colours', colours: top.map((c) => ({ name: c.name, hex: c.hex })) }],
      links: [{ label: 'All my colours', href: '/palette/colours' }],
    };
  }

  private async palettes(userId: Types.ObjectId): Promise<Answer> {
    const { palettes } = await this.deps.palettes.list(userId, { view: 'suggested' });
    const top = palettes.slice(0, 3);
    if (top.length === 0) {
      const text = 'I couldn’t find palettes for you yet. Add the colours you like in My Profile to get suggestions.';
      return { facts: [text], fixedText: text, cards: [], links: [{ label: 'My Colour Palette', href: '/palette' }] };
    }
    return {
      facts: top.map(
        (p) =>
          `Palette "${p.name}": ${[...p.neutrals, ...p.accents]
            .slice(0, 6)
            .map((s) => s.name)
            .join(', ')}`,
      ),
      fixedText: `Here are ${top.length === 1 ? 'a palette' : `${top.length} palettes`} suggested for you. Open one to see its colour combinations.`,
      cards: [
        {
          kind: 'palettes',
          palettes: top.map((p) => ({
            id: p.id,
            name: p.name,
            colours: [...p.neutrals, ...p.accents].slice(0, 6).map((s) => ({ name: s.name, hex: s.hex })),
          })),
        },
      ],
      links: [{ label: 'All palettes', href: '/palette' }],
    };
  }

  private designOffer(description: string): Answer {
    if (!this.deps.designAvailable) {
      const text = 'Design Studio isn’t available right now, so I can’t make a design. Please try again later.';
      return { facts: [text], fixedText: text, cards: [], links: [] };
    }
    const brief = description.trim().slice(0, 1200);
    return {
      facts: [
        `StyleMe can design this garment in Design Studio: "${brief}".`,
        'The user should check the description and agree to the Design Studio notice below to start.',
      ],
      fixedText:
        'I can design this for you in Design Studio, with a picture and a spec for your tailor. Check the description below, then agree to the notice to start.',
      cards: [{ kind: 'design_offer', description: brief }],
      links: [{ label: 'Open Design Studio', href: '/design-studio' }],
    };
  }

  private async saved(userId: Types.ObjectId): Promise<Answer> {
    const list = await this.deps.outfits.list(userId, { status: 'saved', page: 1, limit: 3 });
    if (list.total === 0) {
      const text = 'You haven’t saved any outfits yet. Ask me for looks for an occasion and save the ones you like.';
      return { facts: [text], fixedText: text, cards: [], links: [] };
    }
    return {
      facts: [
        `The user has ${list.total} saved outfit${list.total === 1 ? '' : 's'}. The latest:`,
        ...list.looks.map((l) => lookName(l)),
      ],
      fixedText: `You have ${list.total} saved outfit${list.total === 1 ? '' : 's'}. Here are the latest.`,
      cards: [{ kind: 'looks', looks: list.looks }],
      links: [{ label: 'All saved outfits', href: '/saved' }],
    };
  }

  private async shop(userId: Types.ObjectId, plan: Plan): Promise<Answer> {
    // A named occasion gets fresh looks; otherwise the latest saved looks, or everyday looks when none are saved.
    let looks: Look[] = [];
    if (!plan.occasion) looks = (await this.deps.outfits.list(userId, { status: 'saved', page: 1, limit: 3 })).looks;
    if (looks.length === 0) looks = await this.recommend(userId, plan);
    if (looks.length === 0) {
      const text = 'I couldn’t find a look to shop yet. Ask me for looks for an occasion first.';
      return { facts: [text], fixedText: text, cards: [], links: [{ label: 'Shop My Look', href: '/shop' }] };
    }
    return {
      facts: [
        'Shop My Look finds store items for each piece of a look and keeps the items the user picks with their prices.',
        'StyleMe does not quote prices in the chat; the user opens a look in Shop My Look to see items.',
        ...looks.map((l, i) => `Look ${i + 1}: ${lookName(l)}`),
      ],
      fixedText:
        'Pick a look below and open it in Shop My Look to find items for each piece and keep track of what you buy.',
      cards: [{ kind: 'looks', looks }],
      links: [{ label: 'Open Shop My Look', href: '/shop' }],
    };
  }

  // --- Storage -------------------------------------------------------------------------------------

  private async find(userId: Types.ObjectId, id: string): Promise<StoredConversation> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const doc = await this.deps.models.ChatConversation.findOne({ _id: id, userId }).lean<StoredConversation>();
    if (!doc) throw new AppError('NOT_FOUND');
    return doc;
  }

  /** A new conversation; the oldest ones beyond the limit are removed. */
  private async start(userId: Types.ObjectId, message: string): Promise<Types.ObjectId> {
    const doc = await this.deps.models.ChatConversation.create({ userId, title: titleOf(message), messages: [] });
    const old = await this.deps.models.ChatConversation.find({ userId })
      .sort({ updatedAt: -1 })
      .skip(CHAT_CONVERSATION_LIMIT)
      .select({ _id: 1 })
      .lean();
    if (old.length) await this.deps.models.ChatConversation.deleteMany({ _id: { $in: old.map((d) => d._id) } });
    return doc._id;
  }

  private async append(
    userId: Types.ObjectId,
    id: Types.ObjectId,
    messages: Array<Omit<StoredMessage, '_id'>>,
  ): Promise<ChatConversation> {
    const doc = await this.deps.models.ChatConversation.findOneAndUpdate(
      { _id: id, userId },
      { $push: { messages: { $each: messages, $slice: -CHAT_MESSAGE_LIMIT } } },
      { returnDocument: 'after' },
    ).lean<StoredConversation>();
    if (!doc) throw new AppError('NOT_FOUND');
    return toConversation(doc);
  }
}
