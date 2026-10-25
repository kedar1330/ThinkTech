// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DesignFeatureItem, GarmentKind } from '@styleme/contracts';
import { FeatureThumbnailSvg } from '@/components/design/DesignVisualAssets';
import { lengthHem } from '@/components/design/OptionThumbnails';

// Every Outfit Categories option has its own picture (#163): no option falls back to the generic placeholder,
// options within a category are drawn differently, and lengths are drawn on the right garment.

const OPTIONS: Record<string, string[]> = {
  closure: ['buttons', 'zipper', 'hooks', 'drawstring', 'tie_up', 'pull_on', 'back_hooks', 'side_zip', 'dori_tie_up'],
  fabric: ['cotton', 'linen', 'silk', 'denim', 'wool', 'knit', 'rayon', 'georgette', 'chiffon'],
  hemline: ['straight', 'curved', 'split', 'ribbed', 'high_low', 'asymmetric', 'slit'],
  layering: ['jacket', 'blazer', 'waistcoat', 'overshirt', 'single_layer', 'cape', 'shrug', 'overlay'],
  occasion: ['casual', 'office', 'party', 'wedding', 'festive', 'travel'],
  pattern: [
    'solid',
    'striped',
    'checked',
    'embroidered',
    'printed',
    'floral',
    'geometric',
    'abstract',
    'polka_dot',
    'paisley',
    'animal_print',
    'traditional_motifs',
    'block_print',
    'sequin',
    'jacquard',
    'tie_dye',
    'color_blocked',
    'textured',
  ],
  pockets: ['chest', 'side', 'patch', 'welt', 'cargo', 'none'],
  silhouette: [
    'straight',
    'a_line',
    'fit_and_flare',
    'flared',
    'mermaid',
    'trumpet',
    'sheath',
    'empire',
    'wrap',
    'asymmetric',
    'layered',
    'draped',
  ],
  stretch: ['non_stretch', 'slight_stretch', 'stretch'],
  transparency: ['opaque', 'semi_sheer', 'sheer'],
  length: [
    'cropped',
    'waist_length',
    'hip_length',
    'tunic',
    'mid_thigh',
    'above_knee',
    'knee',
    'midi',
    'calf',
    'ankle',
    'floor',
    'full_length',
    'shorts',
    'adjustable',
  ],
  draping: [
    'straight',
    'wrap',
    'pleated',
    'gathered',
    'nivi',
    'front_pallu',
    'belted',
    'pre_stitched',
    'bengali',
    'maharashtrian',
    'dhoti_saree',
    'mermaid',
    'lehenga_style',
    'retro_mumtaz',
    'cape_pallu',
  ],
  neckline: ['deep_u_back', 'backless_dori', 'keyhole_back', 'sheer_illusion_back', 'square_back', 'inverted_v_back'],
};

const item = (category: string, slug: string): DesignFeatureItem =>
  ({
    featureId: `${category}_${slug}`,
    name: slug,
    description: '',
    category,
    image: null,
    layer: null,
    suitability: null,
    preference: null,
  }) as unknown as DesignFeatureItem;

/** The drawing's markup, without React's generated IDs so drawings compare fairly. */
function draw(category: string, slug: string, garmentKind?: GarmentKind) {
  const { container, unmount } = render(
    <FeatureThumbnailSvg feature={item(category, slug)} garmentKind={garmentKind} />,
  );
  const html = container.innerHTML.replace(/_r_[^"):]*|:r[0-9a-z]+:/g, 'ID');
  const placeholder = container.querySelector('[data-thumbnail="placeholder"]') !== null;
  unmount();
  return { html, placeholder };
}

describe('Outfit Categories option pictures', () => {
  for (const [category, slugs] of Object.entries(OPTIONS)) {
    it(`${category}: every option has its own picture, never the placeholder`, () => {
      const drawings = slugs.map((slug) => ({ slug, ...draw(category, slug, 'one_piece') }));
      for (const d of drawings) expect(d.placeholder, `${category}_${d.slug}`).toBe(false);
      expect(new Set(drawings.map((d) => d.html)).size).toBe(slugs.length);
    });
  }

  it('draws palazzo and trouser lengths as trousers, each with its own hem, and no top lengths on them', () => {
    const legs = ['shorts', 'above_knee', 'knee', 'midi', 'calf', 'cropped', 'ankle', 'full_length', 'floor'];
    const hems = legs.map((slug) => lengthHem(slug, 'bottom'));
    expect(new Set(hems).size).toBe(legs.length);
    expect([...hems].sort((a, b) => a - b)).toEqual(hems);
    const palazzo = draw('length', 'ankle', 'bottom');
    expect(palazzo.html).toContain(`data-hem="${lengthHem('ankle', 'bottom')}"`);
  });

  it('#162 draws every lehenga dupatta drape differently, and differently from the saree drape', () => {
    const slugs = OPTIONS.draping!;
    const lehenga = slugs.map((slug) => {
      const { container, unmount } = render(<FeatureThumbnailSvg feature={item('draping', slug)} isLehenga />);
      const html = container.innerHTML;
      const placeholder = container.querySelector('[data-thumbnail="placeholder"]') !== null;
      unmount();
      return { slug, html, placeholder };
    });
    for (const d of lehenga) {
      expect(d.placeholder, d.slug).toBe(false);
      expect(d.html).toContain(`draping-lehenga-${d.slug}`);
      expect(d.html).not.toBe(draw('draping', d.slug).html);
    }
    expect(new Set(lehenga.map((d) => d.html)).size).toBe(slugs.length);
  });

  it('gives a draping option added later a drape picture, never a blank card', () => {
    const later = draw('draping', 'some_new_drape');
    expect(later.placeholder).toBe(false);
    expect(later.html).toContain('draping-saree-some_new_drape');
  });

  it('draws top lengths on a top: waist above hip above tunic', () => {
    expect(lengthHem('waist_length', 'top')).toBeLessThan(lengthHem('hip_length', 'top'));
    expect(lengthHem('hip_length', 'top')).toBeLessThan(lengthHem('tunic', 'top'));
    expect(draw('length', 'tunic', 'top').html).not.toBe(draw('length', 'tunic', 'bottom').html);
  });
});
