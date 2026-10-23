import Link from 'next/link';
import type { MyColoursMissing } from '@styleme/contracts';
import { Badge } from '@/components/ui/badge';

/** Why a user has no colours yet (D-133), shared by My Colour Palette and My colours. */
export const MISSING_COLOURS: Record<MyColoursMissing, { title: string; body: string; link: boolean }> = {
  skin_tone: {
    title: 'Add your skin tone to see your colours',
    body: 'Choose your skin tone in My Profile (or add a face photo) and we will show the 100+ colours suggested for your skin tone and undertone.',
    link: true,
  },
  undertone: {
    title: 'Add your undertone to see your colours',
    body: 'Choose warm, cool, neutral or olive in My Profile (or add a face photo) and we will show the colours suggested for it.',
    link: true,
  },
  signals_off: {
    title: 'Your skin tone isn’t being used',
    body: 'You have switched off using your skin tone and undertone. Switch it back on in My Profile to see your colours.',
    link: true,
  },
  not_published: {
    title: 'Your colours aren’t published yet',
    body: 'Our styling team is still reviewing the colours for your skin tone and undertone. They will appear here once approved.',
    link: false,
  },
};

export interface WhyMyColoursProps {
  /** The user's own category label (e.g. "Monk 6 · Warm"), or null when it is missing. */
  categoryLabel: string | null;
  missing: MyColoursMissing | null;
  saved: { liked: number; avoided: number };
}

/**
 * "Why am I seeing these?" for My Colour Palette (#105): the colours, coordinating colours and combinations all
 * come from the user's own skin tone and undertone in My Profile, plus the colours they like and avoid.
 */
export function WhyMyColours({ categoryLabel, missing, saved }: WhyMyColoursProps) {
  const gap = categoryLabel ? null : MISSING_COLOURS[missing ?? 'not_published'];
  return (
    <section
      aria-labelledby="why-my-colours-heading"
      className="space-y-3 rounded-xl border border-border bg-surface-muted/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="why-my-colours-heading" className="font-display text-base font-semibold text-primary">
          Why am I seeing these?
        </h2>
        {gap ? (
          <Badge className="border-border bg-surface-muted font-medium text-muted-foreground">
            Not personalised yet
          </Badge>
        ) : (
          <Badge className="border-plum/30 bg-plum/10 font-medium text-plum">Personalised for you</Badge>
        )}
      </div>
      <div className="space-y-2 text-xs text-muted-foreground">
        {gap ? (
          <p>{gap.body}</p>
        ) : (
          <>
            <p>
              Your colours are chosen for <span className="font-medium text-foreground">{categoryLabel}</span>: the skin
              tone and undertone in My Profile. Coordinating colours and combinations are built only from these colours.
            </p>
            <p>
              {saved.liked > 0
                ? `The ${saved.liked === 1 ? 'colour' : `${saved.liked} colours`} you like come${saved.liked === 1 ? 's' : ''} first`
                : 'Colours you like come first'}
              {saved.avoided > 0
                ? `, and the ${saved.avoided === 1 ? 'colour' : `${saved.avoided} colours`} you avoid ${saved.avoided === 1 ? 'is' : 'are'} left out.`
                : ', and colours you avoid are left out.'}
            </p>
          </>
        )}
        {(!gap || gap.link) && (
          <Link
            href="/profile"
            className="inline-flex items-center text-xs font-medium text-plum underline-offset-4 hover:underline"
          >
            {gap ? 'Go to My Profile' : 'Change in My Profile'}
          </Link>
        )}
      </div>
    </section>
  );
}
