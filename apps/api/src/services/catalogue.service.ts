import type {
  CatalogueCategoriesQuery,
  ClothingStylesQuery,
  CatalogueDepartment,
} from '@styleme/contracts';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';

export interface StyleFilterOptions {
  department?: CatalogueDepartment;
  categoryId?: string;
  categoryKey?: string;
  bodyShape?: string;
  goal?: string;
  attribute?: string;
  value?: string;
  fit?: string;
  occasion?: string;
  wearType?: string;
  fabric?: string;
  q?: string;
  sort?: 'best_match' | 'name' | 'recently_added';
  page?: number;
  limit?: number;
}

const STARTER_CATEGORIES = [
  {
    key: 'women-ethnic',
    name: 'Indian Ethnic',
    description: 'Traditional and festive Indian wear silhouettes tailored for comfort and occasion.',
    level: 'group',
    department: 'women',
    sortOrder: 1,
    wearTypes: ['indian'],
    garmentTypes: ['kurti', 'kurta', 'saree', 'lehenga'],
    attributeIds: ['neckline', 'silhouette', 'sleeve_length', 'fabric', 'length'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'women-kurtis',
    name: 'Kurtis & Kurtas',
    description: 'Everyday to occasion-ready kurtis and long tunics in modern and traditional cuts.',
    level: 'category',
    department: 'women',
    sortOrder: 1,
    wearTypes: ['indian'],
    garmentTypes: ['kurti', 'kurta'],
    attributeIds: ['neckline', 'silhouette', 'length', 'sleeve_length', 'fabric'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'women-sarees',
    name: 'Sarees & Blouses',
    description: 'Classic and contemporary drape silhouettes with pairing styles.',
    level: 'category',
    department: 'women',
    sortOrder: 2,
    wearTypes: ['indian'],
    garmentTypes: ['saree'],
    attributeIds: ['fabric', 'drape', 'sleeve_length', 'neckline'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'women-western',
    name: 'Western Wear',
    description: 'Chic tailored shirts, contemporary dresses, and structured trousers.',
    level: 'group',
    department: 'women',
    sortOrder: 2,
    wearTypes: ['western'],
    garmentTypes: ['shirt', 't_shirt', 'dress', 'trousers', 'jeans'],
    attributeIds: ['neckline', 'fit', 'silhouette', 'fabric', 'length'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'women-tops',
    name: 'Tops & Shirts',
    description: 'Tailored button-downs, peplum flares, and everyday work blouses.',
    level: 'category',
    department: 'women',
    sortOrder: 1,
    wearTypes: ['western'],
    garmentTypes: ['shirt', 't_shirt'],
    attributeIds: ['neckline', 'fit', 'silhouette', 'sleeve_length'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'women-dresses',
    name: 'Dresses',
    description: 'A-line, wrap, and fit-and-flare dresses suited for multiple occasions.',
    level: 'category',
    department: 'women',
    sortOrder: 2,
    wearTypes: ['western'],
    garmentTypes: ['dress'],
    attributeIds: ['silhouette', 'length', 'neckline', 'fabric'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'women-bottoms',
    name: 'Trousers & Pants',
    description: 'High-waisted, wide-leg, and tapered trousers engineered for balance.',
    level: 'category',
    department: 'women',
    sortOrder: 3,
    wearTypes: ['western'],
    garmentTypes: ['trousers', 'jeans'],
    attributeIds: ['silhouette', 'rise', 'leg_shape', 'fit'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'women-fusion',
    name: 'Indo-Western Fusion',
    description: 'Contemporary co-ord sets, asymmetric tunics, and modern layered silhouettes.',
    level: 'group',
    department: 'women',
    sortOrder: 3,
    wearTypes: ['fusion'],
    garmentTypes: ['kurti', 'trousers'],
    attributeIds: ['silhouette', 'length', 'neckline', 'layering'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'men-ethnic',
    name: 'Indian Ethnic',
    description: 'Mandarin collar kurtas, bandhgala jackets, and festive menswear ensembles.',
    level: 'group',
    department: 'men',
    sortOrder: 1,
    wearTypes: ['indian'],
    garmentTypes: ['kurta'],
    attributeIds: ['neckline', 'fit', 'fabric', 'length'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'men-kurtas',
    name: 'Kurtas & Sets',
    description: 'Short and knee-length kurtas crafted in breathable cottons and silks.',
    level: 'category',
    department: 'men',
    sortOrder: 1,
    wearTypes: ['indian'],
    garmentTypes: ['kurta'],
    attributeIds: ['neckline', 'fit', 'fabric', 'length'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'men-western',
    name: 'Western Wear',
    description: 'Classic Oxford shirts, relaxed polos, and tapered chinos.',
    level: 'group',
    department: 'men',
    sortOrder: 2,
    wearTypes: ['western'],
    garmentTypes: ['shirt', 't_shirt', 'trousers', 'jeans'],
    attributeIds: ['fit', 'collar', 'fabric', 'silhouette'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'men-shirts',
    name: 'Shirts & Polos',
    description: 'Work, smart-casual and weekend button-downs in durable weaves.',
    level: 'category',
    department: 'men',
    sortOrder: 1,
    wearTypes: ['western'],
    garmentTypes: ['shirt', 't_shirt'],
    attributeIds: ['collar', 'fit', 'fabric'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    key: 'men-bottoms',
    name: 'Trousers & Chinos',
    description: 'Clean-cut straight and slim trousers with comfortable stretch.',
    level: 'category',
    department: 'men',
    sortOrder: 2,
    wearTypes: ['western'],
    garmentTypes: ['trousers', 'jeans'],
    attributeIds: ['silhouette', 'fit', 'fabric'],
    status: 'published',
    review: { status: 'approved' },
  },
];

const STARTER_STYLES = [
  {
    styleId: 'CST-101',
    slug: 'a-line-v-neck-kurti',
    name: 'A-Line Kurti with V-Neck',
    description: 'A flowing A-line silhouette with a slender V-neckline that creates vertical ease and balance.',
    department: 'women',
    categoryKey: 'women-kurtis',
    definingAttribute: { attributeId: 'neckline', valueId: 'v_neck' },
    attributes: [
      { attributeId: 'silhouette', valueId: 'a_line' },
      { attributeId: 'length', valueId: 'knee' },
      { attributeId: 'sleeve_length', valueId: 'three_quarter' },
      { attributeId: 'fabric', valueId: 'cotton' },
    ],
    wearTypes: ['indian'],
    occasions: ['work', 'everyday', 'festive'],
    styles: ['classic', 'smart_casual'],
    stylingGoals: ['balanced_silhouette', 'taller_silhouette'],
    bodyShapes: ['pear', 'hourglass', 'rectangle', 'apple'],
    suitabilityRuleIds: ['STY-001', 'STY-003'],
    explanation: {
      summary: 'The V-neck draws focus upward while the gentle A-line flare drapes smoothly over the hips.',
      benefits: ['Balances hip width with soft flare', 'V-neckline creates an elongating vertical effect'],
      tradeOffs: ['Provides a relaxed drape rather than body-hugging waist accentuation'],
      stylingTips: ['Pair with straight-leg cotton pants or palazzos and oxidised silver earrings'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-102', 'CST-103'],
    alternativeStyleIds: ['CST-102'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-102',
    slug: 'straight-cut-boat-neck-kurta',
    name: 'Straight Cut Kurta with Boat Neck',
    description: 'Crisp vertical lines paired with a broad horizontal neckline that balances slender shoulders.',
    department: 'women',
    categoryKey: 'women-kurtis',
    definingAttribute: { attributeId: 'neckline', valueId: 'boat' },
    attributes: [
      { attributeId: 'silhouette', valueId: 'straight' },
      { attributeId: 'length', valueId: 'calf' },
      { attributeId: 'sleeve_length', valueId: 'three_quarter' },
      { attributeId: 'fabric', valueId: 'linen' },
    ],
    wearTypes: ['indian'],
    occasions: ['work', 'everyday'],
    styles: ['minimal', 'classic'],
    stylingGoals: ['longer_line', 'add_structure'],
    bodyShapes: ['pear', 'hourglass', 'rectangle'],
    suitabilityRuleIds: ['STY-002'],
    explanation: {
      summary: 'Boat neckline gently broadens the collar line, creating harmony for pear and straight frames.',
      benefits: ['Accentuates shoulder width for balanced proportions', 'Straight hem creates streamlined vertical line'],
      tradeOffs: ['May emphasize already broad shoulders on inverted triangle silhouettes'],
      stylingTips: ['Wear with cropped cigar pants and comfortable pointed flats'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-101'],
    alternativeStyleIds: ['CST-101'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-103',
    slug: 'anarkali-flare-sweetheart-suit',
    name: 'Anarkali Flared Suit with Sweetheart Neck',
    description: 'Regal voluminous flares cinched gracefully under the bust with an ornate sweetheart neckline.',
    department: 'women',
    categoryKey: 'women-kurtis',
    definingAttribute: { attributeId: 'neckline', valueId: 'sweetheart' },
    attributes: [
      { attributeId: 'silhouette', valueId: 'flared' },
      { attributeId: 'length', valueId: 'ankle' },
      { attributeId: 'sleeve_length', valueId: 'full' },
      { attributeId: 'fabric', valueId: 'silk' },
    ],
    wearTypes: ['indian'],
    occasions: ['festive', 'wedding', 'party'],
    styles: ['traditional'],
    stylingGoals: ['define_waist', 'relaxed_comfort'],
    bodyShapes: ['apple', 'hourglass', 'pear'],
    suitabilityRuleIds: ['STY-004'],
    explanation: {
      summary: 'Accentuates upper torso and decolletage while providing effortless flow and comfort below the bust.',
      benefits: ['Highlights decolletage elegantly', 'Generous volume allows total freedom of movement'],
      tradeOffs: ['Rich flare may feel heavy for casual or daytime work settings'],
      stylingTips: ['Style with a gossamer organza dupatta and statement chandbalis'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-101'],
    alternativeStyleIds: ['CST-101'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-104',
    slug: 'silk-saree-elbow-blouse',
    name: 'Classic Silk Saree with Elbow-Length Blouse',
    description: 'Timeless drape that sculpts effortlessly across every shape with balanced sleeve proportions.',
    department: 'women',
    categoryKey: 'women-sarees',
    definingAttribute: { attributeId: 'sleeve_length', valueId: 'elbow' },
    attributes: [
      { attributeId: 'fabric', valueId: 'silk' },
      { attributeId: 'neckline', valueId: 'round' },
    ],
    wearTypes: ['indian'],
    occasions: ['festive', 'wedding', 'formal'],
    styles: ['traditional', 'classic'],
    stylingGoals: ['balanced_silhouette', 'highlight_features'],
    bodyShapes: ['hourglass', 'pear', 'apple', 'rectangle', 'inverted_triangle'],
    suitabilityRuleIds: ['STY-005'],
    explanation: {
      summary: 'The universal elegance of a saree drape highlights natural curves with grace and authority.',
      benefits: ['Sculpted fit customizable to every frame', 'Elbow sleeves provide refined poise'],
      tradeOffs: ['Requires careful pleating and pinning for longevity'],
      stylingTips: ['Neatly pin pleats on the shoulder with heritage gold or kundan jewelry'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-103'],
    alternativeStyleIds: ['CST-103'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-105',
    slug: 'wrap-peplum-top',
    name: 'Wrap Top with Peplum Flare',
    description: 'A feminine wrap design that cinches at the natural waist and flares softly over the hip.',
    department: 'women',
    categoryKey: 'women-tops',
    definingAttribute: { attributeId: 'silhouette', valueId: 'wrap' },
    attributes: [
      { attributeId: 'neckline', valueId: 'v_neck' },
      { attributeId: 'fit', valueId: 'regular' },
      { attributeId: 'length', valueId: 'hip' },
    ],
    wearTypes: ['western'],
    occasions: ['work', 'date', 'party'],
    styles: ['smart_casual', 'classic'],
    stylingGoals: ['define_waist', 'balanced_silhouette'],
    bodyShapes: ['hourglass', 'pear', 'apple', 'inverted_triangle'],
    suitabilityRuleIds: ['STY-006'],
    explanation: {
      summary: 'Adjustable wrap tie shapes the waist comfortably while peplum flare balances the shoulders.',
      benefits: ['Customizable waist cinch', 'V-neckline naturally lengthens the neck'],
      tradeOffs: ['Wrap neckline may require a discreet camisole for conservative work environments'],
      stylingTips: ['Tuck into or wear over high-waisted cigarette trousers or a pencil skirt'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-106'],
    alternativeStyleIds: ['CST-106'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-106',
    slug: 'tailored-poplin-shirt',
    name: 'Structured Poplin Button-Down Shirt',
    description: 'Crisp collar and tailored seams creating a sharp, commanding silhouette for professional wear.',
    department: 'women',
    categoryKey: 'women-tops',
    definingAttribute: { attributeId: 'fit', valueId: 'tailored' },
    attributes: [
      { attributeId: 'neckline', valueId: 'collared' },
      { attributeId: 'fabric', valueId: 'cotton' },
      { attributeId: 'sleeve_length', valueId: 'full' },
    ],
    wearTypes: ['western'],
    occasions: ['work', 'formal'],
    styles: ['classic', 'minimal'],
    stylingGoals: ['add_structure', 'longer_line'],
    bodyShapes: ['hourglass', 'rectangle', 'inverted_triangle'],
    suitabilityRuleIds: ['STY-007'],
    explanation: {
      summary: 'The structured yoke and vertical placket impart architectural poise and authority.',
      benefits: ['Crisp clean lines frame the face', 'Versatile layering piece under blazers'],
      tradeOffs: ['Needs accurate bust sizing to prevent button gaping'],
      stylingTips: ['Pair tucked into wide-leg pleated trousers with a minimalist leather belt'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-105'],
    alternativeStyleIds: ['CST-105'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-107',
    slug: 'high-waist-wide-leg-trousers',
    name: 'High-Waisted Wide-Leg Trousers',
    description: 'Elongating full-length cut with comfortable drape through the hips and thighs.',
    department: 'women',
    categoryKey: 'women-bottoms',
    definingAttribute: { attributeId: 'silhouette', valueId: 'wide_leg' },
    attributes: [
      { attributeId: 'length', valueId: 'floor' },
      { attributeId: 'fit', valueId: 'relaxed' },
      { attributeId: 'fabric', valueId: 'crepe' },
    ],
    wearTypes: ['western'],
    occasions: ['work', 'party', 'casual'],
    styles: ['smart_casual', 'classic'],
    stylingGoals: ['longer_line', 'taller_silhouette'],
    bodyShapes: ['hourglass', 'inverted_triangle', 'rectangle', 'pear'],
    suitabilityRuleIds: ['STY-008'],
    explanation: {
      summary: 'The uninterrupted vertical sweep from high waist to shoe hem creates the illusion of long legs.',
      benefits: ['Maximises vertical line and height', 'Ultra-comfortable fluid drape'],
      tradeOffs: ['Length must be tailored precisely to chosen footwear'],
      stylingTips: ['Pair with a fitted or tucked-in top to spotlight the high waistline'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-106'],
    alternativeStyleIds: ['CST-106'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-201',
    slug: 'mandarin-collar-short-kurta',
    name: 'Mandarin Collar Short Kurta',
    description: 'Crisp standing collar with modern hip-length cut in breathable textured weave.',
    department: 'men',
    categoryKey: 'men-kurtas',
    definingAttribute: { attributeId: 'neckline', valueId: 'mandarin' },
    attributes: [
      { attributeId: 'fit', valueId: 'regular' },
      { attributeId: 'length', valueId: 'hip' },
      { attributeId: 'fabric', valueId: 'linen' },
      { attributeId: 'sleeve_length', valueId: 'full' },
    ],
    wearTypes: ['indian', 'fusion'],
    occasions: ['casual', 'festive', 'work'],
    styles: ['smart_casual', 'fusion'],
    stylingGoals: ['balanced_silhouette', 'relaxed_comfort'],
    bodyShapes: ['triangle', 'inverted_triangle', 'rectangle', 'oval'],
    suitabilityRuleIds: ['STY-009'],
    explanation: {
      summary: 'The clean bandhgala neckline frames the jawline and neck with sharp, upright poise.',
      benefits: ['Effortlessly bridges Indian festive and casual work settings', 'Clean neckline frames face'],
      tradeOffs: ['Less formal than traditional knee-length sherwani/kurta sets'],
      stylingTips: ['Pair with tapered cotton chinos or slim denim and leather mojris'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-202'],
    alternativeStyleIds: ['CST-202'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-202',
    slug: 'bandhgala-nehru-jacket-set',
    name: 'Structured Bandhgala Nehru Jacket',
    description: 'Sleeveless tailored vest with standing collar that adds crisp structure and refinement.',
    department: 'men',
    categoryKey: 'men-kurtas',
    definingAttribute: { attributeId: 'fit', valueId: 'tailored' },
    attributes: [
      { attributeId: 'fabric', valueId: 'silk' },
      { attributeId: 'neckline', valueId: 'mandarin' },
    ],
    wearTypes: ['indian', 'fusion'],
    occasions: ['festive', 'wedding', 'party'],
    styles: ['traditional', 'classic'],
    stylingGoals: ['add_structure', 'taller_silhouette'],
    bodyShapes: ['inverted_triangle', 'rectangle', 'triangle', 'oval'],
    suitabilityRuleIds: ['STY-010'],
    explanation: {
      summary: 'Adds vertical structure to the torso, squaring the chest and trimming the midsection visual.',
      benefits: ['Instantly elevates a simple kurta or shirt', 'Draws the eye vertically'],
      tradeOffs: ['Adds extra layer warmth in peak summer months'],
      stylingTips: ['Wear layered over a contrasting monochrome kurta with a matching pocket square'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-201'],
    alternativeStyleIds: ['CST-201'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-203',
    slug: 'oxford-cotton-button-down',
    name: 'Tailored Oxford Cotton Button-Down',
    description: 'Classic durable basketweave cotton shirt featuring an iconic roll collar and tailored fit.',
    department: 'men',
    categoryKey: 'men-shirts',
    definingAttribute: { attributeId: 'fit', valueId: 'regular' },
    attributes: [
      { attributeId: 'neckline', valueId: 'collared' },
      { attributeId: 'fabric', valueId: 'cotton' },
      { attributeId: 'sleeve_length', valueId: 'full' },
    ],
    wearTypes: ['western'],
    occasions: ['work', 'casual', 'everyday'],
    styles: ['classic', 'minimal'],
    stylingGoals: ['add_structure', 'balanced_silhouette'],
    bodyShapes: ['inverted_triangle', 'rectangle', 'triangle'],
    suitabilityRuleIds: ['STY-011'],
    explanation: {
      summary: 'Substantial fabric weight drapes crisply across shoulders without clinging.',
      benefits: ['Retains neat structured look throughout long work days', 'Universally versatile'],
      tradeOffs: ['Needs gentle pressing after wash for best crisp look'],
      stylingTips: ['Roll sleeves to mid-forearm and pair with dark indigo denim or beige chinos'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-204'],
    alternativeStyleIds: ['CST-204'],
    status: 'published',
    review: { status: 'approved' },
  },
  {
    styleId: 'CST-204',
    slug: 'slim-tapered-chinos',
    name: 'Slim Tapered Stretch Chinos',
    description: 'Clean mid-rise trousers with comfortable stretch that gently taper to the ankle.',
    department: 'men',
    categoryKey: 'men-bottoms',
    definingAttribute: { attributeId: 'silhouette', valueId: 'tapered' },
    attributes: [
      { attributeId: 'fit', valueId: 'regular' },
      { attributeId: 'length', valueId: 'ankle' },
      { attributeId: 'fabric', valueId: 'cotton' },
    ],
    wearTypes: ['western'],
    occasions: ['work', 'casual', 'travel'],
    styles: ['smart_casual', 'classic'],
    stylingGoals: ['longer_line', 'balanced_silhouette'],
    bodyShapes: ['inverted_triangle', 'rectangle', 'triangle', 'oval'],
    suitabilityRuleIds: ['STY-012'],
    explanation: {
      summary: 'Clean leg taper prevents fabric gathering at ankles while providing all-day flex.',
      benefits: ['Streamlined contemporary leg profile', 'Highly versatile styling across shoe types'],
      tradeOffs: ['Check calf taper comfort when seated for athletic builds'],
      stylingTips: ['Pair with white leather sneakers or penny loafers without socks'],
    },
    illustrations: [],
    relatedStyleIds: ['CST-203'],
    alternativeStyleIds: ['CST-203'],
    status: 'published',
    review: { status: 'approved' },
  },
];

export class CatalogueService {
  private seeded = false;

  constructor(private readonly models: Models) {}

  /** Ensures starter published categories and clothing styles exist in the database. */
  async ensureSeedData(): Promise<void> {
    if (this.seeded) return;
    const count = await this.models.CatalogueCategory.countDocuments();
    if (count === 0) {
      const categoryMap = new Map<string, string>();
      for (const cat of STARTER_CATEGORIES) {
        const doc = (await this.models.CatalogueCategory.create({
          ...cat,
          version: 1,
          publishedAt: new Date(),
        } as Record<string, unknown>)) as unknown as { _id: unknown };
        categoryMap.set(cat.key, String(doc._id));
      }

      for (const style of STARTER_STYLES) {
        const categoryId = categoryMap.get(style.categoryKey) ?? null;
        if (!categoryId) continue;
        await this.models.ClothingStyle.create({
          ...style,
          categoryId,
          version: 1,
          publishedAt: new Date(),
        } as Record<string, unknown>);
      }
    }
    this.seeded = true;
  }

  /**
   * Retrieves catalogue hierarchy (groups, categories, subcategories).
   * Filterable by department (women, men) and level.
   */
  async getCategories(query: CatalogueCategoriesQuery) {
    await this.ensureSeedData();
    const filter: Record<string, unknown> = { status: 'published' };
    if (query.department) filter.department = query.department;
    if (query.level) filter.level = query.level;

    const items = await this.models.CatalogueCategory.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return items;
  }

  /**
   * Browses clothing styles with rich filters: department, category, body shape, goal, occasion, wearType, search text.
   */
  async getStyles(query: ClothingStylesQuery) {
    await this.ensureSeedData();
    const filter: Record<string, unknown> = { status: 'published' };

    if (query.department) {
      filter.department = query.department;
    }

    if (query.categoryId) {
      filter.categoryId = query.categoryId;
    }

    if (query.bodyShape) {
      filter.bodyShapes = query.bodyShape;
    }

    if (query.goal) {
      filter.stylingGoals = query.goal;
    }

    if (query.attribute && query.value) {
      filter['attributes'] = {
        $elemMatch: { attributeId: query.attribute, valueId: query.value },
      };
    }

    if (query.occasion) {
      filter.occasions = query.occasion;
    }

    if (query.wearType) {
      filter.wearTypes = query.wearType;
    }

    if (query.q) {
      const regex = new RegExp(query.q, 'i');
      filter.$or = [{ name: regex }, { description: regex }, { tags: regex }];
    }

    const sortOption: Record<string, 1 | -1> =
      query.sort === 'name' ? { name: 1 } : { publishedAt: -1, _id: 1 };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.models.ClothingStyle.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.models.ClothingStyle.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /** Fetches a single clothing style by its unique styleId or slug. */
  async getStyleById(styleId: string) {
    await this.ensureSeedData();
    const style = await this.models.ClothingStyle.findOne({
      $or: [{ styleId }, { slug: styleId }],
      status: { $in: ['published', 'archived'] },
    }).lean();

    if (!style) {
      throw new AppError('NOT_FOUND', 'Clothing style not found');
    }

    return style;
  }

  /** Compares 2 or more styles side-by-side. */
  async compareStyles(ids: string[]) {
    await this.ensureSeedData();
    const styles = await this.models.ClothingStyle.find({
      $or: [{ styleId: { $in: ids } }, { slug: { $in: ids } }],
      status: { $in: ['published', 'archived'] },
    }).lean();

    return styles;
  }
}
