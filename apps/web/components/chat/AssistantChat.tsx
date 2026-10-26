'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImageOff, Loader2, MessageCirclePlus, SendHorizontal, Sparkles, Trash2 } from 'lucide-react';
import {
  CHAT_MESSAGE_MAX,
  DESIGN_DESCRIPTION_MAX,
  type ChatCard,
  type ChatConversation,
  type ChatMessage,
  type ChatOverviewResponse,
  type Look,
} from '@styleme/contracts';
import {
  createAssistantDesignAction,
  deleteConversationAction,
  sendAssistantMessageAction,
} from '@/app/actions/assistant';
import { OutfitImage } from '@/components/outfits/OutfitImage';
import { SaveLookButton } from '@/components/outfits/SaveLookButton';
import { SwatchList } from '@/components/outfits/SwatchList';
import { Button } from '@/components/ui/button';
import { garmentSlots, lookTitle } from '@/lib/outfits/look-text';
import { cn } from '@/lib/utils';

// Style Assistant chat (D-136): the user asks; the API runs the feature that answers and returns the reply with
// the feature's results as cards (looks, colours, palettes, a design) and links into the feature.

export function AssistantChat({ overview, initial }: { overview: ChatOverviewResponse; initial?: ChatConversation }) {
  const router = useRouter();
  const [conversation, setConversation] = useState<ChatConversation | null>(initial ?? null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages.length, pendingText]);

  function update(next: ChatConversation) {
    setConversation(next);
    if (next.id !== conversation?.id) router.replace(`/assistant?c=${next.id}`, { scroll: false });
    else router.refresh();
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setPendingText(message);
    setInput('');
    startTransition(async () => {
      const result = await sendAssistantMessageAction(message, conversation?.id);
      setPendingText(null);
      if (result.conversation) update(result.conversation);
      else {
        setError(result.error ?? 'Something went wrong. Please try again.');
        setInput(message);
      }
    });
  }

  function remove(id?: string) {
    startTransition(async () => {
      const result = await deleteConversationAction(id);
      if (result.error) setError(result.error);
      else if (!id || id === conversation?.id) router.replace('/assistant');
      else router.refresh();
    });
  }

  const messages = conversation?.messages ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside aria-label="Conversations" className="space-y-3 lg:order-none">
        <Button asChild variant="outline" size="full">
          <Link href="/assistant">
            <MessageCirclePlus aria-hidden /> New chat
          </Link>
        </Button>
        {overview.conversations.length > 0 && (
          <>
            <ul className="max-h-72 space-y-1 overflow-y-auto lg:max-h-[60vh]">
              {overview.conversations.map((c) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <Link
                    href={`/assistant?c=${c.id}`}
                    aria-current={c.id === conversation?.id ? 'page' : undefined}
                    className={cn(
                      'min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm hover:bg-surface-muted',
                      c.id === conversation?.id && 'bg-surface-muted font-medium',
                    )}
                  >
                    {c.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    aria-label={`Delete “${c.title}”`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-destructive"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => remove()}
              disabled={pending}
              className="text-xs text-muted-foreground underline hover:text-destructive"
            >
              Delete all conversations
            </button>
          </>
        )}
      </aside>

      <section aria-label="Chat" className="flex min-h-[60vh] flex-col rounded-2xl border border-border bg-surface">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.length === 0 && !pendingText && (
            <div className="space-y-4 py-6 text-center">
              <Sparkles aria-hidden className="mx-auto size-8 text-accent" />
              <p className="font-display text-2xl text-primary">How can I help you dress today?</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Ask for looks for an occasion, the colours that suit you, a design for your tailor, your saved outfits
                or help shopping a look.
              </p>
              <ul className="flex flex-wrap justify-center gap-2">
                {overview.suggestions.map((s, idx) => (
                  <li key={`${s}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => send(s)}
                      disabled={pending}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-accent/60"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              conversationId={conversation!.id}
              designAvailable={overview.designAvailable}
              onConversation={update}
            />
          ))}
          {pendingText && (
            <>
              <UserBubble text={pendingText} />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden className="size-4 animate-spin" /> Finding the best answer for you…
              </p>
            </>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="space-y-2 border-t border-border p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor="assistant-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              maxLength={CHAT_MESSAGE_MAX}
              rows={1}
              placeholder="Ask about outfits, colours, designs or shopping…"
              className="max-h-40 min-h-11 flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
            <Button type="submit" size="icon" disabled={pending || !input.trim()} aria-label="Send">
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : <SendHorizontal aria-hidden />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {overview.aiAvailable
              ? 'Your questions and StyleMe’s results (looks, colour names, designs) go to Google Gemini to write replies. Your photos, measurements, height, skin tone and body type never do.'
              : 'Replies are written by StyleMe from your profile and its styling rules.'}
          </p>
        </form>
      </section>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {text}
      </p>
    </div>
  );
}

function MessageBubble({
  message,
  conversationId,
  designAvailable,
  onConversation,
}: {
  message: ChatMessage;
  conversationId: string;
  designAvailable: boolean;
  onConversation: (c: ChatConversation) => void;
}) {
  if (message.role === 'user') return <UserBubble text={message.text} />;
  return (
    <div className="space-y-3">
      <div className="max-w-[90%] space-y-1">
        <p className="whitespace-pre-line rounded-2xl rounded-bl-sm bg-surface-muted px-4 py-2.5 text-sm">
          {message.text}
        </p>
        {message.wording === 'ai' && <p className="px-1 text-[11px] text-muted-foreground">Written with AI</p>}
      </div>
      {message.cards.map((card, i) => (
        <Card
          key={i}
          card={card}
          conversationId={conversationId}
          designAvailable={designAvailable}
          onConversation={onConversation}
        />
      ))}
      {message.links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {message.links.map((l) => (
            <li key={l.href + l.label}>
              <Link
                href={l.href}
                className="inline-flex rounded-full border border-plum/30 px-3 py-1 text-sm text-plum hover:bg-plum/5"
              >
                {l.label} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Card({
  card,
  conversationId,
  designAvailable,
  onConversation,
}: {
  card: ChatCard;
  conversationId: string;
  designAvailable: boolean;
  onConversation: (c: ChatConversation) => void;
}) {
  switch (card.kind) {
    case 'looks':
      return (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {card.looks.map((look) => (
            <li key={look.id}>
              <LookTile look={look} />
            </li>
          ))}
        </ul>
      );
    case 'colours':
      // Named chips, like SwatchList: colour is never the only way a colour is told apart.
      return (
        <ul className="flex flex-wrap gap-2">
          {card.colours.map((c) => (
            <li
              key={c.hex + c.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
            >
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-full border border-foreground/20"
                style={{ backgroundColor: c.hex }}
              />
              {c.name}
            </li>
          ))}
        </ul>
      );
    case 'palettes':
      return (
        <ul className="grid gap-3 sm:grid-cols-3">
          {card.palettes.map((p) => (
            <li key={p.id}>
              <Link
                href={`/palette/${p.id}`}
                className="block space-y-2 rounded-xl border border-border bg-background p-3 hover:border-accent/60"
              >
                <span className="flex h-8 overflow-hidden rounded-md">
                  {p.colours.map((c) => (
                    <span key={c.hex + c.name} className="flex-1" style={{ backgroundColor: c.hex }} title={c.name} />
                  ))}
                </span>
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.colours.map((c) => c.name).join(', ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      );
    case 'design':
      return (
        <Link
          href={`/design-studio/${card.design.id}`}
          className="flex max-w-sm gap-3 rounded-xl border border-border bg-background p-3 hover:border-accent/60"
        >
          <span className="relative block aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-lg bg-[#fbf6ec]">
            {card.design.imageStatus === 'ready' ? (
              <Image
                src={`/api/design-studio/${card.design.id}/image`}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <span className="flex h-full items-center justify-center text-muted-foreground">
                <ImageOff aria-hidden className="size-6" />
              </span>
            )}
          </span>
          <span className="space-y-1">
            <span className="block font-medium">{card.design.title}</span>
            <span className="block text-sm text-plum underline">Open the tailor spec</span>
          </span>
        </Link>
      );
    case 'design_offer':
      return designAvailable ? (
        <DesignOffer description={card.description} conversationId={conversationId} onConversation={onConversation} />
      ) : null;
  }
}

function LookTile({ look }: { look: Look }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <Link href={`/saved/${look.id}`} className="font-medium leading-snug text-primary hover:underline">
        {lookTitle(look)}
      </Link>
      {/* The look's AI outfit image, as in Discover My Style: stored, or made on first view. */}
      {look.image && <OutfitImage outfitId={look.id} ready={look.image === 'ready'} />}
      <ul className="space-y-1.5">
        {garmentSlots(look).map((slot) => (
          <li key={slot.slotId}>
            <SwatchList swatches={slot.swatches} />
          </li>
        ))}
      </ul>
      <p className="line-clamp-3 text-xs text-muted-foreground">{look.explanation}</p>
      <div className="mt-auto space-y-2">
        <SaveLookButton outfitId={look.id} saved={look.status === 'saved'} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <Link href={`/shop?outfitId=${look.id}`} className="text-plum underline">
            Shop this look
          </Link>
          <Link href={`/design-studio?look=${look.id}`} className="text-plum underline">
            Change in Design Studio
          </Link>
        </div>
      </div>
    </div>
  );
}

function DesignOffer({
  description: initial,
  conversationId,
  onConversation,
}: {
  description: string;
  conversationId: string;
  onConversation: (c: ChatConversation) => void;
}) {
  const [description, setDescription] = useState(initial);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createAssistantDesignAction(conversationId, description, agreed);
      if (result.conversation) onConversation(result.conversation);
      else setError(result.error ?? 'Something went wrong. Please try again.');
    });
  }

  return (
    <div className="max-w-xl space-y-3 rounded-xl border border-border bg-background p-4">
      <label htmlFor={`offer-${conversationId}`} className="text-sm font-medium">
        Your design
      </label>
      <textarea
        id={`offer-${conversationId}`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={DESIGN_DESCRIPTION_MAX}
        rows={3}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      />
      <p className="text-[11px] text-muted-foreground">Don’t include your measurements or other personal details.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
        <span>
          I agree that StyleMe sends this description to Google Gemini to plan the design, and a text description of the
          garment (nothing about me) to an image service (Pollinations or Cloudflare) to draw it. My designs are kept
          privately in my account until I delete them. See the{' '}
          <Link href="/privacy" className="text-plum underline">
            privacy notice
          </Link>
          .
        </span>
      </label>
      <Button
        type="button"
        variant="accent"
        disabled={pending || !agreed || description.trim().length < 10}
        onClick={submit}
      >
        {pending ? (
          <>
            <Loader2 aria-hidden className="animate-spin" /> Designing… this can take up to a minute
          </>
        ) : (
          'Create this design'
        )}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
