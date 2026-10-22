import type { Metadata } from 'next';
import Link from 'next/link';
import { ProsePage } from '@/components/site/ProsePage';
import { BRAND_IMAGES, LOOKBOOK_IMAGES } from '@/lib/brand/images';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About" title="Styling, explained">
      <p>
        StyleMe helps you discover the style that is you. We start with what matters for how clothes look and feel on
        you — sizes that differ by category, the fit you like, colours you love or avoid, the coverage you&rsquo;re
        comfortable with — and build from there.
      </p>
      <p>
        Every question we ask says why it is asked and how it is used. Optional appearance signals are gentle hints,
        never rules, and never decide your size. You can change or delete anything at any time.
      </p>
      <h2>Where we are</h2>
      <p>
        StyleMe is in a closed beta. Today you can create an account, build your style profile and add optional
        appearance signals. Outfit suggestions, colour palettes, Shop My Look, virtual try-on, the design studio and the
        style assistant are on the way and are clearly marked &ldquo;Coming soon&rdquo;.
      </p>
      <h2>Image credits</h2>
      <p>Photography from Unsplash, used under the Unsplash License, and outfit photos supplied by the StyleMe team:</p>
      <ul>
        {[...Object.values(BRAND_IMAGES), ...LOOKBOOK_IMAGES].map((img) => (
          <li key={img.src}>
            {img.alt} — {img.credit}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/register" className="font-medium text-plum underline">
          Get started
        </Link>
      </p>
    </ProsePage>
  );
}
