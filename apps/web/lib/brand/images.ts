// Style imagery for StyleMe's own pages (see public/images/CREDITS.md): Unsplash photographs (Unsplash
// License) and outfit photos supplied by the StyleMe team. These are mood images, never presented as
// products (FR-DATA-06, D-65). Each slot uses a different photograph; alt text describes the outfit.
// `position` is the CSS object-position that keeps the outfit in frame when the image is cropped.

export interface BrandImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  credit: string;
  /** The photo's source page, when it has one. */
  page: string | null;
  position: string;
}

const SUPPLIED = 'Supplied by the StyleMe team';

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
    src: '/images/styling-navy-sweater-chinos.jpg',
    alt: 'A man in a navy V-neck sweater over a white shirt with cream pleated trousers, beside the same pieces laid flat',
    credit: SUPPLIED,
    page: null,
    width: 736,
    height: 1104,
    position: '50% 50%',
  },
  /** Fashion category: Indian. */
  categoryIndian: {
    src: '/images/category-indian-maroon-lehenga.jpg',
    alt: 'A woman in a maroon brocade lehenga with a sheer embroidered dupatta',
    credit: SUPPLIED,
    page: null,
    width: 735,
    height: 1306,
    position: '50% 35%',
  },
  /** Fashion category: fusion. */
  categoryFusion: {
    src: '/images/category-fusion-nehru-jacket.jpg',
    alt: 'A man in a sage-green kurta under an embroidered ivory Nehru jacket with ivory trousers',
    credit: SUPPLIED,
    page: null,
    width: 736,
    height: 1104,
    position: '50% 40%',
  },
  /** Fashion category: Western. */
  categoryWestern: {
    src: '/images/category-western-waistcoat.jpg',
    alt: 'A woman in a brown waistcoat and wide-leg trousers over a blue striped shirt',
    credit: SUPPLIED,
    page: null,
    width: 719,
    height: 1097,
    position: '50% 40%',
  },
} satisfies Record<string, BrandImage>;

/** Landing-page lookbook: outfit inspiration only, never products. */
export const LOOKBOOK_IMAGES: readonly BrandImage[] = [
  {
    src: '/images/lookbook-red-sharara.jpg',
    alt: 'A woman in a red and gold brocade kurta and sharara with a matching dupatta',
    credit: SUPPLIED,
    page: null,
    width: 736,
    height: 1308,
    position: '50% 35%',
  },
  {
    src: '/images/lookbook-navy-slate.jpg',
    alt: 'A man in a navy shirt with slate-grey trousers and white sneakers, beside navy and slate-grey swatches',
    credit: SUPPLIED,
    page: null,
    width: 736,
    height: 1308,
    position: '40% 45%',
  },
  {
    src: '/images/lookbook-floral-kurta-palazzo.jpg',
    alt: 'A woman in a sleeveless floral-print kurta with matching palazzo trousers',
    credit: SUPPLIED,
    page: null,
    width: 706,
    height: 1184,
    position: '50% 35%',
  },
  {
    src: '/images/lookbook-navy-lehenga.jpg',
    alt: 'A woman in a navy lehenga with gold embroidery and a sheer navy dupatta',
    credit: SUPPLIED,
    page: null,
    width: 736,
    height: 1104,
    position: '50% 45%',
  },
  {
    src: '/images/lookbook-rose-shirt-wide-jeans.jpg',
    alt: 'A woman in a rose overshirt over a black tank top with charcoal wide-leg jeans, beside the three pieces',
    credit: SUPPLIED,
    page: null,
    width: 735,
    height: 1046,
    position: '35% 50%',
  },
  {
    src: '/images/lookbook-champagne-anarkali.jpg',
    alt: 'A woman in a flowing champagne anarkali with a scalloped dupatta',
    credit: SUPPLIED,
    page: null,
    width: 900,
    height: 1600,
    position: '50% 40%',
  },
  {
    src: '/images/lookbook-navy-peplum-sharara.jpg',
    alt: 'An embroidered navy peplum kurta over flared sage-blue sharara trousers',
    credit: SUPPLIED,
    page: null,
    width: 900,
    height: 1600,
    position: '50% 30%',
  },
  {
    src: '/images/lookbook-floral-lehenga.jpg',
    alt: 'A woman in an ivory lehenga with a painted floral hem and sheer puff sleeves',
    credit: SUPPLIED,
    page: null,
    width: 900,
    height: 1600,
    position: '50% 35%',
  },
];
