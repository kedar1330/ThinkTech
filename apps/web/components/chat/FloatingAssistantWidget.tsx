'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Loader2, Maximize2, MessageCirclePlus, SendHorizontal, Sparkles, X } from 'lucide-react';
import { CHAT_MESSAGE_MAX, type ChatCard, type ChatConversation } from '@styleme/contracts';
import { createAssistantDesignAction, sendAssistantMessageAction } from '@/app/actions/assistant';
import { Button } from '@/components/ui/button';
import { lookTitle } from '@/lib/outfits/look-text';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'What should I wear to a sangeet?',
  'Which colours suit my skin tone?',
  'Design an Indo-western kurta with embroidery',
  'Show my saved outfits',
  'Virtual Try-On preview',
];

export function FloatingAssistantWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [input, setInput] = useState('');
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [conversation?.messages.length, pendingText, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Close floating widget if user is directly on the dedicated /assistant page
  if (pathname === '/assistant') {
    return null;
  }

  function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || isPending) return;

    setError(null);
    setPendingText(text);
    setInput('');

    startTransition(async () => {
      const result = await sendAssistantMessageAction(text, conversation?.id);
      setPendingText(null);
      if (result.conversation) {
        setConversation(result.conversation);
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
        setInput(text);
      }
    });
  }

  function handleCreateDesign(description: string) {
    if (!conversation) return;
    setError(null);
    startTransition(async () => {
      const result = await createAssistantDesignAction(conversation.id, description, true);
      if (result.conversation) {
        setConversation(result.conversation);
      } else {
        setError(result.error ?? 'Failed to create design');
      }
    });
  }

  const messages = conversation?.messages ?? [];

  return (
    <>
      {/* Floating Chat Panel (Meta AI style popup) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Style Assistant Chat"
          className="fixed bottom-24 right-4 sm:right-6 z-50 flex h-[560px] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] sm:w-[400px] flex-col overflow-hidden rounded-2xl border border-plum/20 bg-surface/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-border/80 bg-surface/90 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {/* StyleMe circular emblem with warm gold ring */}
              <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#c8a45c] via-[#f7e7b4] to-[#9a762e] p-[1.5px] shadow-xs">
                <div className="relative size-full overflow-hidden rounded-full bg-[#4a1f45]">
                  <Image
                    src="/images/styleme-emblem.png"
                    alt="Style Assistant"
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-surface bg-emerald-500"
                  title="Online"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-foreground">Style Assistant</h3>
                  <span className="size-1.5 rounded-full bg-emerald-500" title="Online" />
                </div>
                <p className="text-[10px] text-muted-foreground">Powered by StyleMe AI</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {conversation && (
                <Button
                  size="icon"
                  variant="ghost"
                  title="New chat"
                  onClick={() => setConversation(null)}
                  className="size-8 text-muted-foreground hover:text-foreground"
                >
                  <MessageCirclePlus className="size-4" />
                </Button>
              )}
              <Link
                href={conversation ? `/assistant?c=${conversation.id}` : '/assistant'}
                title="Expand to full screen"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              >
                <Maximize2 className="size-4" />
              </Link>
              <Button
                size="icon"
                variant="ghost"
                title="Close assistant"
                onClick={() => setIsOpen(false)}
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>
          </header>

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {messages.length === 0 && !pendingText ? (
              <div className="flex h-full flex-col justify-between py-2">
                <div className="space-y-2 text-center pt-4">
                  <div className="mx-auto relative flex size-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#c8a45c] via-[#f7e7b4] to-[#9a762e] p-[2px] shadow-sm">
                    <div className="relative size-full overflow-hidden rounded-full bg-[#4a1f45]">
                      <Image
                        src="/images/styleme-emblem.png"
                        alt="StyleMe"
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <h4 className="font-display text-base font-semibold text-foreground">Ask your stylist</h4>
                  <p className="text-xs text-muted-foreground px-4">
                    Get instant styling advice for weddings, festivals, work, or colours tailored to you.
                  </p>
                </div>

                <div className="space-y-1.5 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                    Try asking:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSend(s)}
                        className="rounded-lg border border-border/80 bg-surface-muted/60 p-2 text-left text-xs font-medium text-foreground transition hover:border-plum/40 hover:bg-surface-muted"
                      >
                        {s} →
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex flex-col gap-1 max-w-[85%]',
                      m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2 text-xs leading-relaxed',
                        m.role === 'user'
                          ? 'bg-plum text-white rounded-tr-xs shadow-xs'
                          : 'bg-surface-muted text-foreground border border-border/60 rounded-tl-xs',
                      )}
                    >
                      {m.text}
                    </div>

                    {/* Cards */}
                    {m.cards?.length > 0 && (
                      <div className="w-full space-y-2 pt-1">
                        {m.cards.map((card, i) => (
                          <MiniCard key={i} card={card} onCreateDesign={handleCreateDesign} />
                        ))}
                      </div>
                    )}

                    {/* Links */}
                    {m.links?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {m.links.map((link) => (
                          <Link
                            key={link.href + link.label}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full border border-plum/30 bg-surface px-2.5 py-0.5 text-[11px] font-medium text-plum hover:bg-plum/5"
                          >
                            {link.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Optimistic pending user text */}
                {pendingText && (
                  <div className="flex flex-col gap-1 max-w-[85%] ml-auto items-end">
                    <div className="rounded-2xl px-3.5 py-2 text-xs leading-relaxed bg-plum text-white rounded-tr-xs opacity-80">
                      {pendingText}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mr-auto pt-1">
                      <Loader2 className="size-3 animate-spin text-plum" />
                      <span>Styling advice incoming...</span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="border-t border-destructive/20 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
              {error}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="border-t border-border/80 bg-surface p-2.5"
          >
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface-muted/60 px-3 py-1.5 focus-within:border-plum/60 focus-within:bg-surface focus-within:ring-1 focus-within:ring-plum/20 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                maxLength={CHAT_MESSAGE_MAX}
                disabled={isPending}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your stylist..."
                className="w-full border-0 border-none bg-transparent px-0 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none ring-0 shadow-none focus:border-none focus:outline-none focus:ring-0 focus:shadow-none"
              />
              <button
                type="submit"
                disabled={isPending || !input.trim()}
                aria-label="Send message"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-plum text-white transition disabled:opacity-30 hover:bg-plum-dark"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Action Button (StyleMe Emblem circular launcher) */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label="Toggle Style Assistant"
          className="group relative flex size-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#c8a45c] via-[#f7e7b4] to-[#9a762e] p-[2.5px] shadow-[0_6px_25px_rgba(74,31,69,0.38)] transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_30px_rgba(74,31,69,0.55)] active:scale-95 focus:outline-hidden"
        >
          {/* Outer gentle gold-plum pulsing glow when closed */}
          {!isOpen && (
            <span
              aria-hidden
              className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#c8a45c] via-[#f3e8d2] to-[#7a3b6f] opacity-40 blur-xs animate-pulse"
            />
          )}

          {/* Inner Emblem Circle */}
          <div className="relative flex size-full items-center justify-center overflow-hidden rounded-full bg-[#4a1f45] text-white">
            {isOpen ? (
              <ChevronDown className="size-6 text-[#f7e7b4] transition-transform duration-200" />
            ) : (
              <>
                <Image
                  src="/images/styleme-emblem.png"
                  alt="Style Assistant"
                  fill
                  sizes="56px"
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                  priority
                />
                {/* Gold AI Sparkle Badge */}
                <div
                  aria-hidden
                  className="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full border border-[#f7e7b4]/80 bg-[#4a1f45] shadow-xs"
                >
                  <Sparkles className="size-2.5 text-[#f7e7b4]" />
                </div>
              </>
            )}
          </div>

          {/* Label Tooltip */}
          <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground shadow-md opacity-0 transition group-hover:opacity-100">
            {isOpen ? 'Close Assistant' : 'Style Assistant'}
          </span>
        </button>
      </div>
    </>
  );
}

function MiniCard({ card, onCreateDesign }: { card: ChatCard; onCreateDesign: (desc: string) => void }) {
  switch (card.kind) {
    case 'looks':
      return (
        <div className="space-y-1.5 rounded-xl border border-border bg-surface p-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Matched Looks ({card.looks.length})
          </p>
          <div className="divide-y divide-border/60">
            {card.looks.slice(0, 3).map((look) => (
              <div key={look.id} className="py-1 flex items-center justify-between text-xs">
                <Link
                  href={`/saved/${look.id}`}
                  className="font-medium text-plum truncate max-w-[200px] hover:underline"
                >
                  {lookTitle(look)}
                </Link>
                <Link
                  href={`/saved/${look.id}`}
                  className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      );
    case 'colours':
      return (
        <div className="rounded-xl border border-border bg-surface p-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Your Top Colours</p>
          <div className="flex flex-wrap gap-1.5">
            {card.colours.slice(0, 6).map((c) => (
              <span
                key={c.hex + c.name}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px]"
              >
                <span className="size-3 rounded-full border border-foreground/20" style={{ backgroundColor: c.hex }} />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      );
    case 'palettes':
      return (
        <div className="rounded-xl border border-border bg-surface p-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Suggested Palettes</p>
          <div className="space-y-1">
            {card.palettes.slice(0, 2).map((p) => (
              <Link
                key={p.id}
                href={`/palette/${p.id}`}
                className="block rounded-lg border border-border/80 bg-surface-muted/40 p-2 hover:border-plum"
              >
                <div className="flex h-4 overflow-hidden rounded-xs mb-1">
                  {p.colours.map((c) => (
                    <span key={c.hex + c.name} className="flex-1" style={{ backgroundColor: c.hex }} />
                  ))}
                </div>
                <div className="text-[11px] font-medium text-foreground">{p.name}</div>
              </Link>
            ))}
          </div>
        </div>
      );
    case 'design_offer':
      return (
        <div className="rounded-xl border border-border bg-surface p-2.5 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Design Studio</p>
          <p className="text-xs text-foreground italic">&ldquo;{card.description}&rdquo;</p>
          <Button size="sm" onClick={() => onCreateDesign(card.description)} className="w-full text-xs">
            Create this design
          </Button>
        </div>
      );
    default:
      return null;
  }
}
