import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema, slotIdSchema } from './common';

// Stage 1 shortlist and price summary: the user's own entries only (D-77 = B, D-80, FR-LIST, FR-BUD).
// Nothing here is verified by StyleMe. Retailer products and verified prices belong to the product
// layer and are not defined until it is approved.

/** Visible labels (FR-LIST-02); shown without extra clicks wherever these values appear. */
export const USER_ENTERED_LABELS = {
  item: 'Added by you — not verified by StyleMe',
  price: 'Price entered by you — not verified by StyleMe',
  total: 'Total of prices you entered — not verified by StyleMe; not a checkout price',
} as const;

/** Shortlist limits (FR-LIST-07, D-80 defaults). */
export const SHORTLIST_LIMITS = {
  nameMax: 120,
  noteMax: 300,
  urlMax: 2048,
  priceMax: 1_000_000,
  itemsPerUser: 200,
} as const;

const rupees = z.number().positive().max(SHORTLIST_LIMITS.priceMax).multipleOf(0.01);

/** An `https://` link the user typed; never fetched, previewed or modified (FR-LIST-03, -05). */
export const userLinkSchema = z
  .string()
  .trim()
  .max(SHORTLIST_LIMITS.urlMax)
  .pipe(z.url({ protocol: /^https$/, message: 'Enter an https:// link' }));

/** `POST /v1/shortlist`. `outfitId` and `slotId` are sent together or not at all (D-82). */
export const createShortlistItemRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(SHORTLIST_LIMITS.nameMax),
    priceEntered: rupees,
    url: userLinkSchema.optional(),
    note: z.string().trim().max(SHORTLIST_LIMITS.noteMax).optional(),
    outfitId: objectIdSchema.optional(),
    slotId: slotIdSchema.optional(),
  })
  .strict()
  .refine((item) => (item.outfitId === undefined) === (item.slotId === undefined), {
    message: 'Send outfitId and slotId together, or neither',
    path: ['slotId'],
  });
export type CreateShortlistItemRequest = z.infer<typeof createShortlistItemRequestSchema>;

/** `GET /v1/shortlist` query: newest first, paginated, optionally for one look. */
export const shortlistListQuerySchema = paginationQuerySchema.extend({ outfitId: objectIdSchema.optional() });
export type ShortlistListQuery = z.infer<typeof shortlistListQuerySchema>;

/** A shortlist item as returned. No retailer, stock, rating, image or quality field exists (FR-LIST-03). */
export const userShortlistItemSchema = z
  .object({
    id: objectIdSchema,
    name: z.string().min(1).max(SHORTLIST_LIMITS.nameMax),
    priceEntered: rupees,
    currency: z.literal('INR'),
    priceBasis: z.literal('user_entered'),
    verifiedByStyleMe: z.literal(false),
    url: userLinkSchema.nullable(),
    note: z.string().max(SHORTLIST_LIMITS.noteMax).nullable(),
    outfitId: objectIdSchema.nullable(),
    slotId: slotIdSchema.nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .refine((item) => (item.outfitId === null) === (item.slotId === null), {
    message: 'outfitId and slotId are set together or both null',
  });
export type UserShortlistItem = z.infer<typeof userShortlistItemSchema>;

export const BUDGET_STATUSES = ['within_budget', 'over_budget', 'no_budget'] as const;
export const budgetStatusSchema = z.enum(BUDGET_STATUSES);
export type BudgetStatus = z.infer<typeof budgetStatusSchema>;

/**
 * Stage 1 price summary of a saved look (FR-BUD-07): totals of user-entered prices only, computed on
 * read. Within budget only if `itemsTotal <= budget` (FR-BUD-03); complete only when every slot is priced.
 */
export const userPriceSummarySchema = z
  .object({
    priceBasis: z.literal('user_entered'),
    itemsTotal: z.number().nonnegative(),
    pricedSlots: z.number().int().nonnegative(),
    totalSlots: z.number().int().positive(),
    complete: z.boolean(),
    budget: z.number().int().positive().nullable(),
    budgetRemaining: z.number().nullable(),
    status: budgetStatusSchema,
    label: z.literal(USER_ENTERED_LABELS.total),
  })
  .strict()
  .refine((s) => s.pricedSlots <= s.totalSlots, { message: 'pricedSlots exceeds totalSlots' })
  .refine((s) => s.complete === (s.pricedSlots === s.totalSlots), { message: 'complete must match the slot counts' })
  .refine(
    (s) =>
      s.budget === null
        ? s.status === 'no_budget' && s.budgetRemaining === null
        : s.budgetRemaining !== null &&
          Math.abs(s.budgetRemaining - (s.budget - s.itemsTotal)) < 0.005 &&
          s.status === (s.itemsTotal <= s.budget ? 'within_budget' : 'over_budget'),
    { message: 'status and budgetRemaining must match the budget and total' },
  );
export type UserPriceSummary = z.infer<typeof userPriceSummarySchema>;
