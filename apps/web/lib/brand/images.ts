// Licensed style imagery (Unsplash License — see public/images/CREDITS.md). These are mood images for
// StyleMe's own pages, never presented as products (FR-DATA-06, D-65). Each slot uses a different
// photograph; alt text describes the outfit. `position` is the CSS object-position that keeps the
// outfit in frame when the image is cropped to a smaller aspect ratio.

export interface BrandImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  credit: string;
  page: string;
  position: string;
}

export const BRAND_IMAGES = {
  /** Sign-up, login and verification split screen. */
  auth: {
    src: '/images/auth-lehenga-gold.jpg',
    alt: 'A woman in an embroidered marigold-and-maroon lehenga with a draped dupatta',
    credit: 'Morni Saree / Unsplash',
    page: 'https://unsplash.com/photos/woman-in-ornate-yellow-and-maroon-traditional-indian-attire-unFmQCqV8Ow',
    width: 1600,
    height: 2400,
    position: '50% 15%',
  },
  /** Landing hero, Indian ethnic. */
  heroIndian: {
    src: '/images/hero-lehenga-red.jpg',
    alt: 'A woman in a flowing deep-red lehenga against a stormy sky',
    credit: 'Ardy Arjun / Unsplash',
    page: 'https://unsplash.com/photos/a-woman-in-a-red-dress-scTC9VKQPkk',
    width: 1600,
    height: 2400,
    position: '50% 30%',
  },
  /** Landing hero, modern Western. */
  heroWestern: {
    src: '/images/hero-suit-cream.jpg',
    alt: 'A woman in a cream tailored suit in warm studio light',
    credit: 'Aiony Haust / Unsplash',
    page: 'https://unsplash.com/photos/woman-holding-dried-flower-K0DxxljcRv0',
    width: 1600,
    height: 2400,
    position: '50% 25%',
  },
  /** Personalized Styling section. */
  styling: {
    src: '/images/styling-bandhgala-red.jpg',
    alt: 'A man in a red bandhgala jacket with ivory churidar',
    credit: 'Parvez AzarQaderi / Unsplash',
    page: 'https://unsplash.com/photos/mens-red-long-sleeved-dress-k-ehfxCMamI',
    width: 1600,
    height: 2400,
    position: '50% 20%',
  },
  /** Fashion category: Indian. */
  categoryIndian: {
    src: '/images/category-indian-bridal.jpg',
    alt: 'A woman in a red and gold bridal lehenga with an embroidered dupatta',
    credit: 'Harsh Gupta / Unsplash',
    page: 'https://unsplash.com/photos/a-woman-in-a-red-and-gold-bridal-outfit-2DZmm6QKFQE',
    width: 1600,
    height: 2400,
    position: '50% 20%',
  },
  /** Fashion category: fusion. */
  categoryFusion: {
    src: '/images/category-fusion-coord.jpg',
    alt: 'A woman in a printed ikat-style co-ord set with a mandarin collar',
    credit: 'IMANA / Unsplash',
    page: 'https://unsplash.com/photos/woman-in-patterned-clothing-sitting-near-plants-50WK7vLzNAY',
    width: 1600,
    height: 2400,
    position: '50% 30%',
  },
  /** Fashion category: Western. */
  categoryWestern: {
    src: '/images/category-western-blazer.jpg',
    alt: 'A man in a checked blazer and burgundy tie seated on a red velvet sofa',
    credit: 'Khaled Ghareeb / Unsplash',
    page: 'https://unsplash.com/photos/a-man-in-a-suit-sitting-on-a-red-couch-4gr4BKNkUIc',
    width: 1600,
    height: 2322,
    position: '50% 45%',
  },
} satisfies Record<string, BrandImage>;
