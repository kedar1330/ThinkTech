import type { Metadata } from 'next';
import type { ChatConversation, ChatOverviewResponse } from '@styleme/contracts';
import { AssistantChat } from '@/components/chat/AssistantChat';
import { ApiError, apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Style Assistant' };

/**
 * Style Assistant (D-136): ask in plain language; the assistant runs the feature that answers (Discover My Style,
 * My Colour Palette, Design Studio, Saved Outfits, Shop My Look) and shows the results here. `?c=<id>` opens a
 * conversation.
 */
export default async function AssistantPage({ searchParams }: { searchParams?: Promise<{ c?: string }> }) {
  const query = searchParams ? await searchParams : {};
  const { accessToken } = await requireOnboarded();
  const overview = await apiRequest<ChatOverviewResponse>('/v1/chat', { token: accessToken });

  let conversation: ChatConversation | undefined;
  if (query.c && /^[a-f0-9]{24}$/.test(query.c)) {
    try {
      conversation = await apiRequest<ChatConversation>(`/v1/chat/conversations/${query.c}`, { token: accessToken });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-plum">Style Assistant</p>
        <h1 className="font-display text-4xl text-primary">Ask your stylist</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Tell me the occasion, a colour question or the outfit you imagine. I use your profile and StyleMe’s styling
          rules to find looks, colours and palettes, design garments for your tailor and help you shop.
        </p>
      </header>
      <AssistantChat key={conversation?.id ?? 'new'} overview={overview} initial={conversation} />
    </div>
  );
}
