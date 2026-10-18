import { z } from 'zod';

// One shared save system for every feature (Saved Outfits, FRD §4.22, DATABASE.md §3.10, D-116), plus
// explicit feedback (D-115) and product reports (FRD §4.20). Specified 2026-10-18; no endpoint uses these yet.

// --- Saved items ---------------------------------------------------------------------------------------

/** What was saved. Each type is shown with its own label; palettes are never treated as outfits. */
export const SAVED_ITEM_TYPES = [
  { id: 'clothing_style', label: 'Style' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'design', label: 'Custom design' },
  { id: 'shopping_look', label: 'Shopping look' },
  { id: 'product', label: 'Product' },
  { id: 'tryon_look', label: 'Try-on look' },
  { id: 'palette', label: 'Palette' },
] as const;
export const SAVED_ITEM_TYPE_IDS = SAVED_ITEM_TYPES.map((t) => t.id) as [
  (typeof SAVED_ITEM_TYPES)[number]['id'],
  ...(typeof SAVED_ITEM_TYPES)[number]['id'][],
];
export const savedItemTypeSchema = z.enum(SAVED_ITEM_TYPE_IDS);
export type SavedItemType = z.infer<typeof savedItemTypeSchema>;

/** The feature the item was saved from; kept so the item can reopen its source (FR-SAVE-17). */
export const STYLEME_FEATURES = [
  'discover_my_style',
  'my_colour_palette',
  'outfit_categories',
  'shop_my_look',
  'virtual_try_on',
  'design_studio',
  'style_assistant',
  'saved_outfits',
] as const;
export const featureSchema = z.enum(STYLEME_FEATURES);
export type Feature = z.infer<typeof featureSchema>;

/**
 * What a saved item points at. Shared records are referenced by their stable ID, never copied
 * (D-116); `tryon_config` has no separate record — its configuration lives on the saved item.
 */
export const SAVED_REF_KINDS = [
  'clothing_style', // CST-xxx
  'outfit_template', // OUT-xxx
  'look', // outfits._id
  'catalogue_palette', // PAL-xxx
  'custom_palette', // customPalettes._id
  'product', // products._id
  'design', // designs._id (Design Studio, D-76)
  'tryon_config',
] as const;
export const savedRefKindSchema = z.enum(SAVED_REF_KINDS);
export type SavedRefKind = z.infer<typeof savedRefKindSchema>;

export const SAVED_SORTS = ['recently_saved', 'recently_updated', 'name_asc'] as const;
export const savedSortSchema = z.enum(SAVED_SORTS);

/** Defaults; changeable without migration. */
export const SAVED_LIMITS = {
  nameMax: 80,
  notesMax: 500,
  itemsPerUser: 1000,
  collectionsPerUser: 50,
  collectionNameMax: 40,
  collectionsPerItem: 20,
} as const;

export const savedItemNameSchema = z.string().trim().min(1).max(SAVED_LIMITS.nameMax);
export const savedItemNotesSchema = z.string().trim().max(SAVED_LIMITS.notesMax);
export const collectionNameSchema = z.string().trim().min(1).max(SAVED_LIMITS.collectionNameMax);

// --- Explicit feedback (D-115) -------------------------------------------------------------------------

export const USER_FEEDBACK_TARGET_TYPES = [
  'clothing_style',
  'catalogue_palette',
  'outfit_template',
  'product',
  'saved_item',
] as const;
export const userFeedbackTargetTypeSchema = z.enum(USER_FEEDBACK_TARGET_TYPES);

export const USER_FEEDBACK_VALUES = ['like', 'not_for_me'] as const;
export const userFeedbackValueSchema = z.enum(USER_FEEDBACK_VALUES);

/** Optional reasons; fixed list, no free text. Each feature shows only the reasons relevant to it. */
export const USER_FEEDBACK_REASONS = [
  { id: 'fit', label: 'Fit', features: ['outfit_categories', 'discover_my_style', 'shop_my_look'] },
  { id: 'comfort', label: 'Comfort', features: ['outfit_categories', 'discover_my_style'] },
  {
    id: 'style',
    label: 'Not my style',
    features: ['outfit_categories', 'discover_my_style', 'shop_my_look', 'my_colour_palette'],
  },
  { id: 'occasion', label: 'Wrong occasion', features: ['outfit_categories', 'discover_my_style'] },
  { id: 'colour', label: 'Colour', features: ['shop_my_look'] },
  { id: 'price', label: 'Price', features: ['shop_my_look'] },
  { id: 'too_bright', label: 'Too bright', features: ['my_colour_palette'] },
  { id: 'dislike_colours', label: 'I dislike these colours', features: ['my_colour_palette'] },
] as const;
export const USER_FEEDBACK_REASON_IDS = USER_FEEDBACK_REASONS.map((r) => r.id) as [
  (typeof USER_FEEDBACK_REASONS)[number]['id'],
  ...(typeof USER_FEEDBACK_REASONS)[number]['id'][],
];
export const userFeedbackReasonSchema = z.enum(USER_FEEDBACK_REASON_IDS);

// --- Product reports (Shop My Look Q110) ------------------------------------------------------------------

export const PRODUCT_REPORT_ISSUES = [
  'broken_link',
  'wrong_price',
  'wrong_image',
  'unavailable_size',
  'other',
] as const;
export const productReportIssueSchema = z.enum(PRODUCT_REPORT_ISSUES);
export const PRODUCT_REPORT_STATUSES = ['open', 'confirmed', 'dismissed'] as const;
