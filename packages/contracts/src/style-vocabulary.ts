import { z } from 'zod';

// Shared style vocabulary (D-09): the allowed values used by the profile, self-reported signals and
// the style knowledge base. Defined once here so every module uses the same IDs.
//
// Rules for changing these lists:
// - IDs are stable. Never rename or remove an ID that may be stored; add a new one instead.
// - Values are stored as plain strings, so adding an ID needs no database migration.
// - Occasion, style, category and colour lists are styling content and need founder approval (D-62).

interface VocabularyItem {
  readonly id: string;
  readonly label: string;
}

type Ids<T extends readonly VocabularyItem[]> = T[number]['id'];

function ids<T extends readonly VocabularyItem[]>(items: T): [Ids<T>, ...Ids<T>[]] {
  return items.map((item) => item.id) as [Ids<T>, ...Ids<T>[]];
}

// --- Department (FR-PROF-02) -------------------------------------------------------------------

export const DEPARTMENTS = [
  { id: 'women', label: 'Women' },
  { id: 'men', label: 'Men' },
  { id: 'any', label: 'Show me everything' },
] as const;
export const DEPARTMENT_IDS = ids(DEPARTMENTS);
export const departmentSchema = z.enum(DEPARTMENT_IDS);
export type Department = z.infer<typeof departmentSchema>;

// --- Occasions and styles (founder approval, D-62) -----------------------------------------------

export const OCCASIONS = [
  { id: 'everyday', label: 'Everyday' },
  { id: 'work', label: 'Work' },
  { id: 'festive', label: 'Festive' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'party', label: 'Party' },
  { id: 'date', label: 'Date' },
  { id: 'travel', label: 'Travel' },
  { id: 'formal', label: 'Formal event' },
] as const;
export const OCCASION_IDS = ids(OCCASIONS);
export const occasionSchema = z.enum(OCCASION_IDS);
export type Occasion = z.infer<typeof occasionSchema>;

export const STYLES = [
  { id: 'classic', label: 'Classic' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'casual', label: 'Casual' },
  { id: 'smart_casual', label: 'Smart casual' },
  { id: 'traditional', label: 'Traditional' },
  { id: 'fusion', label: 'Fusion' },
  { id: 'streetwear', label: 'Streetwear' },
  { id: 'boho', label: 'Boho' },
] as const;
export const STYLE_IDS = ids(STYLES);
export const styleSchema = z.enum(STYLE_IDS);
export type Style = z.infer<typeof styleSchema>;

// --- Slots, category groups and categories (FRD §4.8, D-54, D-82) --------------------------------

// A slot's type. Several template slots may share a type (e.g. two accessories); each has its own slotId.
export const SLOT_TYPES = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'one_piece', label: 'One piece' },
  { id: 'layer', label: 'Layer' },
  { id: 'footwear', label: 'Footwear' },
  { id: 'accessory', label: 'Accessory' },
] as const;
export const SLOT_TYPE_IDS = ids(SLOT_TYPES);
export const slotTypeSchema = z.enum(SLOT_TYPE_IDS);
export type SlotType = z.infer<typeof slotTypeSchema>;

// Category groups carry the size system. IDs match the keys of `profiles.sizes` (DATABASE.md §3.2).
// `sized: false` means the group has no size (FR-SIZE-04 shows no size note for it).
export const CATEGORY_GROUPS = [
  { id: 'tops', label: 'Tops', sized: true, sizeSystem: 'Letter XS–3XL; shirts may also use collar size' },
  { id: 'bottoms', label: 'Bottoms', sized: true, sizeSystem: 'Waist in inches (e.g. 26–44); optional length' },
  {
    id: 'ethnicTops',
    label: 'Ethnic tops',
    sized: true,
    sizeSystem: 'Letter XS–3XL, or numeric where the retailer uses it',
  },
  { id: 'ethnicSets', label: 'Ethnic sets', sized: true, sizeSystem: 'Letter or waist size; often semi-stitched' },
  { id: 'freeSize', label: 'Free size', sized: false, sizeSystem: 'No size' },
  { id: 'shoes', label: 'Shoes', sized: true, sizeSystem: 'UK/India size' },
  { id: 'dresses', label: 'Dresses', sized: true, sizeSystem: 'Letter XS–3XL' },
] as const;
export const CATEGORY_GROUP_IDS = ids(CATEGORY_GROUPS);
export const categoryGroupSchema = z.enum(CATEGORY_GROUP_IDS);
export type CategoryGroup = z.infer<typeof categoryGroupSchema>;

// Garment categories. `departments` lists where the category is offered (department `any` sees all);
// `stage` is the stage the category joins (Dresses joins in Stage 2, D-57).
export const CATEGORIES = [
  { id: 't_shirt', label: 'T-shirt', group: 'tops', slotType: 'top', departments: ['women', 'men'], stage: 1 },
  { id: 'shirt', label: 'Shirt', group: 'tops', slotType: 'top', departments: ['women', 'men'], stage: 1 },
  { id: 'jeans', label: 'Jeans', group: 'bottoms', slotType: 'bottom', departments: ['women', 'men'], stage: 1 },
  { id: 'trousers', label: 'Trousers', group: 'bottoms', slotType: 'bottom', departments: ['women', 'men'], stage: 1 },
  { id: 'kurta', label: 'Kurta', group: 'ethnicTops', slotType: 'top', departments: ['women', 'men'], stage: 1 },
  { id: 'kurti', label: 'Kurti', group: 'ethnicTops', slotType: 'top', departments: ['women'], stage: 1 },
  { id: 'lehenga', label: 'Lehenga', group: 'ethnicSets', slotType: 'one_piece', departments: ['women'], stage: 1 },
  { id: 'saree', label: 'Saree', group: 'freeSize', slotType: 'one_piece', departments: ['women'], stage: 1 },
  { id: 'shoes', label: 'Shoes', group: 'shoes', slotType: 'footwear', departments: ['women', 'men'], stage: 1 },
  {
    id: 'accessory',
    label: 'Accessory',
    group: 'freeSize',
    slotType: 'accessory',
    departments: ['women', 'men'],
    stage: 1,
  },
  { id: 'dress', label: 'Dress', group: 'dresses', slotType: 'one_piece', departments: ['women'], stage: 2 },
] as const satisfies readonly (VocabularyItem & {
  group: CategoryGroup;
  slotType: SlotType;
  departments: readonly Exclude<Department, 'any'>[];
  stage: 1 | 2;
})[];
export const CATEGORY_IDS = ids(CATEGORIES);
export const categorySchema = z.enum(CATEGORY_IDS);
export type Category = z.infer<typeof categorySchema>;

// --- Colours (founder approval, D-62) ------------------------------------------------------------

export const COLOR_FAMILIES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'brown', label: 'Brown' },
  { id: 'red', label: 'Red' },
  { id: 'pink', label: 'Pink' },
  { id: 'orange', label: 'Orange' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'purple', label: 'Purple' },
  { id: 'metallic', label: 'Metallic' },
] as const;
export const COLOR_FAMILY_IDS = ids(COLOR_FAMILIES);
export const colorFamilySchema = z.enum(COLOR_FAMILY_IDS);
export type ColorFamily = z.infer<typeof colorFamilySchema>;

// Hex values are for swatches only; they approximate the named colour and are not product colours.
export const COLORS = [
  { id: 'white', label: 'White', family: 'neutral', hex: '#FFFFFF' },
  { id: 'ivory', label: 'Ivory', family: 'neutral', hex: '#F8F4E8' },
  { id: 'cream', label: 'Cream', family: 'neutral', hex: '#F2E8CF' },
  { id: 'beige', label: 'Beige', family: 'neutral', hex: '#D9C3A0' },
  { id: 'taupe', label: 'Taupe', family: 'neutral', hex: '#8B7D6B' },
  { id: 'grey', label: 'Grey', family: 'neutral', hex: '#8C8C8C' },
  { id: 'charcoal', label: 'Charcoal', family: 'neutral', hex: '#36454F' },
  { id: 'black', label: 'Black', family: 'neutral', hex: '#1A1A1A' },
  { id: 'camel', label: 'Camel', family: 'brown', hex: '#B98A57' },
  { id: 'tan', label: 'Tan', family: 'brown', hex: '#C69C6D' },
  { id: 'chocolate', label: 'Chocolate', family: 'brown', hex: '#5B3A29' },
  { id: 'rust', label: 'Rust', family: 'brown', hex: '#B7410E' },
  { id: 'red', label: 'Red', family: 'red', hex: '#C8102E' },
  { id: 'maroon', label: 'Maroon', family: 'red', hex: '#800020' },
  { id: 'blush', label: 'Blush', family: 'pink', hex: '#F4C2C2' },
  { id: 'rose_pink', label: 'Rose pink', family: 'pink', hex: '#E75480' },
  { id: 'fuchsia', label: 'Fuchsia', family: 'pink', hex: '#C2185B' },
  { id: 'peach', label: 'Peach', family: 'orange', hex: '#F6B98D' },
  { id: 'coral', label: 'Coral', family: 'orange', hex: '#F27D72' },
  { id: 'orange', label: 'Orange', family: 'orange', hex: '#E87722' },
  { id: 'mustard', label: 'Mustard', family: 'yellow', hex: '#D4A017' },
  { id: 'pastel_yellow', label: 'Pastel yellow', family: 'yellow', hex: '#F5E28C' },
  { id: 'mint', label: 'Mint', family: 'green', hex: '#A8E6CF' },
  { id: 'sage', label: 'Sage', family: 'green', hex: '#9CAF88' },
  { id: 'olive', label: 'Olive', family: 'green', hex: '#708238' },
  { id: 'emerald', label: 'Emerald', family: 'green', hex: '#046A38' },
  { id: 'bottle_green', label: 'Bottle green', family: 'green', hex: '#0B4D2C' },
  { id: 'sky_blue', label: 'Sky blue', family: 'blue', hex: '#87CEEB' },
  { id: 'powder_blue', label: 'Powder blue', family: 'blue', hex: '#B0C4DE' },
  { id: 'denim_blue', label: 'Denim blue', family: 'blue', hex: '#3B5B8C' },
  { id: 'royal_blue', label: 'Royal blue', family: 'blue', hex: '#2250A0' },
  { id: 'teal', label: 'Teal', family: 'blue', hex: '#007C80' },
  { id: 'navy', label: 'Navy', family: 'blue', hex: '#1F2A44' },
  { id: 'lavender', label: 'Lavender', family: 'purple', hex: '#C7B8E0' },
  { id: 'purple', label: 'Purple', family: 'purple', hex: '#6A3D9A' },
  { id: 'plum', label: 'Plum', family: 'purple', hex: '#6E2C5E' },
  { id: 'gold', label: 'Gold', family: 'metallic', hex: '#C9A227' },
  { id: 'silver', label: 'Silver', family: 'metallic', hex: '#BFC1C2' },
  { id: 'rose_gold', label: 'Rose gold', family: 'metallic', hex: '#B76E79' },
] as const satisfies readonly (VocabularyItem & { family: ColorFamily; hex: string })[];
export const COLOR_IDS = ids(COLORS);
export const colorIdSchema = z.enum(COLOR_IDS);
export type ColorId = z.infer<typeof colorIdSchema>;

// --- Fabrics and garment attributes --------------------------------------------------------------

export const FABRICS = [
  { id: 'cotton', label: 'Cotton' },
  { id: 'linen', label: 'Linen' },
  { id: 'khadi', label: 'Khadi' },
  { id: 'silk', label: 'Silk' },
  { id: 'chanderi', label: 'Chanderi' },
  { id: 'georgette', label: 'Georgette' },
  { id: 'chiffon', label: 'Chiffon' },
  { id: 'crepe', label: 'Crepe' },
  { id: 'rayon', label: 'Rayon' },
  { id: 'satin', label: 'Satin' },
  { id: 'velvet', label: 'Velvet' },
  { id: 'wool', label: 'Wool' },
  { id: 'denim', label: 'Denim' },
  { id: 'jersey_knit', label: 'Jersey knit' },
  { id: 'polyester_blend', label: 'Polyester blend' },
  { id: 'leather', label: 'Leather' },
  { id: 'vegan_leather', label: 'Vegan leather' },
] as const;
export const FABRIC_IDS = ids(FABRICS);
export const fabricSchema = z.enum(FABRIC_IDS);
export type Fabric = z.infer<typeof fabricSchema>;

export const SILHOUETTES = [
  { id: 'fitted', label: 'Fitted' },
  { id: 'straight', label: 'Straight' },
  { id: 'a_line', label: 'A-line' },
  { id: 'flared', label: 'Flared' },
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'tapered', label: 'Tapered' },
  { id: 'wide_leg', label: 'Wide-leg' },
  { id: 'oversized', label: 'Oversized' },
  { id: 'wrap', label: 'Wrap' },
] as const;
export const SILHOUETTE_IDS = ids(SILHOUETTES);
export const silhouetteSchema = z.enum(SILHOUETTE_IDS);
export type Silhouette = z.infer<typeof silhouetteSchema>;

// Preferred fit per category group (FR-SIZE-02).
export const FITS = [
  { id: 'slim', label: 'Slim' },
  { id: 'regular', label: 'Regular' },
  { id: 'relaxed', label: 'Relaxed' },
] as const;
export const FIT_IDS = ids(FITS);
export const fitSchema = z.enum(FIT_IDS);
export type Fit = z.infer<typeof fitSchema>;

export const NECKLINES = [
  { id: 'round', label: 'Round' },
  { id: 'v_neck', label: 'V-neck' },
  { id: 'collared', label: 'Collared' },
  { id: 'mandarin', label: 'Mandarin' },
  { id: 'boat', label: 'Boat' },
  { id: 'square', label: 'Square' },
  { id: 'sweetheart', label: 'Sweetheart' },
  { id: 'high_neck', label: 'High neck' },
] as const;
export const NECKLINE_IDS = ids(NECKLINES);
export const necklineSchema = z.enum(NECKLINE_IDS);
export type Neckline = z.infer<typeof necklineSchema>;

export const PATTERNS = [
  { id: 'solid', label: 'Solid' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'checks', label: 'Checks' },
  { id: 'floral', label: 'Floral' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'paisley', label: 'Paisley' },
  { id: 'polka_dots', label: 'Polka dots' },
  { id: 'block_print', label: 'Block print' },
  { id: 'ikat', label: 'Ikat' },
  { id: 'bandhani', label: 'Bandhani' },
  { id: 'embroidered', label: 'Embroidered' },
  { id: 'abstract', label: 'Abstract' },
] as const;
export const PATTERN_IDS = ids(PATTERNS);
export const patternSchema = z.enum(PATTERN_IDS);
export type Pattern = z.infer<typeof patternSchema>;

// Ordered smallest to largest, for print-scale rules.
export const PATTERN_SCALES = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
] as const;
export const PATTERN_SCALE_IDS = ids(PATTERN_SCALES);
export const patternScaleSchema = z.enum(PATTERN_SCALE_IDS);
export type PatternScale = z.infer<typeof patternScaleSchema>;

// --- Coverage and comfort (FR-PROF-02) -----------------------------------------------------------
// Coverage lists are ordered from least to most coverage, so "at least X" is an index comparison.

export const SLEEVE_LENGTHS = [
  { id: 'sleeveless', label: 'Sleeveless' },
  { id: 'cap', label: 'Cap sleeve' },
  { id: 'short', label: 'Short sleeve' },
  { id: 'elbow', label: 'Elbow length' },
  { id: 'three_quarter', label: 'Three-quarter' },
  { id: 'full', label: 'Full sleeve' },
] as const;
export const SLEEVE_LENGTH_IDS = ids(SLEEVE_LENGTHS);
export const sleeveLengthSchema = z.enum(SLEEVE_LENGTH_IDS);
export type SleeveLength = z.infer<typeof sleeveLengthSchema>;

export const GARMENT_LENGTHS = [
  { id: 'cropped', label: 'Cropped' },
  { id: 'waist', label: 'Waist length' },
  { id: 'hip', label: 'Hip length' },
  { id: 'thigh', label: 'Thigh length' },
  { id: 'knee', label: 'Knee length' },
  { id: 'midi', label: 'Midi' },
  { id: 'ankle', label: 'Ankle length' },
  { id: 'floor', label: 'Floor length' },
] as const;
export const GARMENT_LENGTH_IDS = ids(GARMENT_LENGTHS);
export const garmentLengthSchema = z.enum(GARMENT_LENGTH_IDS);
export type GarmentLength = z.infer<typeof garmentLengthSchema>;

export const NECKLINE_DEPTHS = [
  { id: 'deep', label: 'Deep' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'high', label: 'High' },
] as const;
export const NECKLINE_DEPTH_IDS = ids(NECKLINE_DEPTHS);
export const necklineDepthSchema = z.enum(NECKLINE_DEPTH_IDS);
export type NecklineDepth = z.infer<typeof necklineDepthSchema>;

export const COMFORT_OPTIONS = [
  { id: 'stretch', label: 'Stretch' },
  { id: 'loose_fit', label: 'Loose fit' },
  { id: 'lightweight', label: 'Lightweight' },
  { id: 'breathable', label: 'Breathable' },
  { id: 'easy_care', label: 'Easy care' },
  { id: 'flat_footwear', label: 'Flat footwear' },
] as const;
export const COMFORT_OPTION_IDS = ids(COMFORT_OPTIONS);
export const comfortOptionSchema = z.enum(COMFORT_OPTION_IDS);
export type ComfortOption = z.infer<typeof comfortOptionSchema>;

// --- Contrast --------------------------------------------------------------------------------------

export const CONTRAST_LEVELS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
] as const;
export const CONTRAST_LEVEL_IDS = ids(CONTRAST_LEVELS);
export const contrastLevelSchema = z.enum(CONTRAST_LEVEL_IDS);
export type ContrastLevel = z.infer<typeof contrastLevelSchema>;

// The profile's contrast preference adds "no preference" (DATABASE.md §3.2).
export const CONTRAST_PREFERENCES = [...CONTRAST_LEVELS, { id: 'no_preference', label: 'No preference' }] as const;
export const CONTRAST_PREFERENCE_IDS = ids(CONTRAST_PREFERENCES);
export const contrastPreferenceSchema = z.enum(CONTRAST_PREFERENCE_IDS);
export type ContrastPreference = z.infer<typeof contrastPreferenceSchema>;

// --- Self-reported appearance signals (FR-SIG-01) ------------------------------------------------

export const UNDERTONES = [
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'olive', label: 'Olive' },
  { id: 'not_sure', label: 'Not sure' },
] as const;
export const UNDERTONE_IDS = ids(UNDERTONES);
export const undertoneSchema = z.enum(UNDERTONE_IDS);
export type Undertone = z.infer<typeof undertoneSchema>;

// A palette's undertone affinity (AI.md §4). `any` means the palette isn't aimed at one undertone.
export const UNDERTONE_AFFINITIES = [
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'olive', label: 'Olive' },
  { id: 'any', label: 'Any' },
] as const;
export const UNDERTONE_AFFINITY_IDS = ids(UNDERTONE_AFFINITIES);
export const undertoneAffinitySchema = z.enum(UNDERTONE_AFFINITY_IDS);
export type UndertoneAffinity = z.infer<typeof undertoneAffinitySchema>;

// Monk Skin Tone scale, tones 1 (lightest) to 10 (deepest). Hex values are the published scale
// swatches, shown only so the user can choose; they are never inferred from a photo (FR-SIG-04).
export const MONK_TONES = [
  { tone: 1, hex: '#F6EDE4' },
  { tone: 2, hex: '#F3E7DB' },
  { tone: 3, hex: '#F7EAD0' },
  { tone: 4, hex: '#EADABA' },
  { tone: 5, hex: '#D7BD96' },
  { tone: 6, hex: '#A07E56' },
  { tone: 7, hex: '#825C43' },
  { tone: 8, hex: '#604134' },
  { tone: 9, hex: '#3A312A' },
  { tone: 10, hex: '#292420' },
] as const;

// Widest range a user or palette may give, in tones (e.g. "4-6").
export const MONK_RANGE_MAX_SPAN = 2;

// A Monk range is "a-b" with 1 ≤ a ≤ b ≤ 10 and b − a ≤ MONK_RANGE_MAX_SPAN, e.g. "4-5" or "7-7".
export const monkRangeSchema = z
  .string()
  .regex(/^(10|[1-9])-(10|[1-9])$/)
  .refine((value) => {
    const [from, to] = value.split('-').map(Number) as [number, number];
    return from <= to && to - from <= MONK_RANGE_MAX_SPAN;
  }, 'Expected "a-b" with a ≤ b and a span of at most 2 tones');
export type MonkRange = z.infer<typeof monkRangeSchema>;

// Self-described proportions (FR-SIG-01). Descriptive only; they never set a size (FR-SIZE-03)
// and rules use them only as soft preferences (FR-STY-04).
export const PROPORTION_DESCRIPTORS = [
  { id: 'shoulders_wider_than_hips', label: 'Shoulders wider than hips' },
  { id: 'hips_wider_than_shoulders', label: 'Hips wider than shoulders' },
  { id: 'balanced_defined_waist', label: 'Shoulders and hips similar, defined waist' },
  { id: 'balanced_straight_waist', label: 'Shoulders and hips similar, straighter waist' },
  { id: 'fuller_midsection', label: 'Fuller through the middle' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;
export const PROPORTION_DESCRIPTOR_IDS = ids(PROPORTION_DESCRIPTORS);
export const proportionDescriptorSchema = z.enum(PROPORTION_DESCRIPTOR_IDS);
export type ProportionDescriptor = z.infer<typeof proportionDescriptorSchema>;
