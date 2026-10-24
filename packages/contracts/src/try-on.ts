import { z } from 'zod';
import { objectIdSchema, slotIdSchema } from './common';
import { priceRangeStoreSchema, productListingSchema } from './outfit';
import { tryOnModelSchema } from './profile';

// 3D Virtual Try-On (#106, D-137). The user's full-body try-on photo (My Profile → 3D Virtual Try-On, D-135)
// and the Google Shopping thumbnail of a similar item from Shop My Look go to fal.ai: FASHN dresses the photo
// in the garment (one call per garment, a whole look is layered piece by piece), then TRELLIS turns the
// dressed photo into a 3D model the user can turn through 360°. Only after the user agrees to the try-on
// notice, each time. Results are kept for a day; nothing about the user other than the photo is sent.

/** Version of the try-on notice the user agrees to before each try-on; bump it when the wording changes. */
export const TRY_ON_NOTICE_VERSION = '2026-10-23.1';

/** How long a try-on (its picture and 3D model) is kept before it is deleted automatically. */
export const TRY_ON_KEEP_HOURS = 24;

/** A whole look is tried on at most this many garments deep (one-piece or bottom, then top, then layer). */
export const TRY_ON_MAX_GARMENTS = 3;

/** Shown with every try-on picture. */
export const TRY_ON_IMAGE_LABEL =
  'AI-generated preview of your photo wearing a similar item. Not an exact representation of fit, colour or drape.';

/** Shown with every 3D model: only the front comes from the photo. */
export const TRY_ON_3D_LABEL =
  'AI-generated 3D estimate. The front comes from your try-on picture; the sides and back are the AI’s guess.';

/**
 * Where a try-on is: `try_on` (dressing the photo, garment `step` of `totalSteps`), `model_3d` (the picture is
 * ready, the 3D model is being built), `done`, or `failed` (no picture; `message` says why).
 */
export const TRY_ON_STAGES = ['try_on', 'model_3d', 'done', 'failed'] as const;
export const tryOnStageSchema = z.enum(TRY_ON_STAGES);
export type TryOnStage = z.infer<typeof tryOnStageSchema>;

export const TRY_ON_3D_STATUSES = ['pending', 'ready', 'failed'] as const;
export const tryOn3dStatusSchema = z.enum(TRY_ON_3D_STATUSES);
export type TryOn3dStatus = z.infer<typeof tryOn3dStatusSchema>;

/** One of the listings Shop My Look returned for a garment, named by its store, title and price. */
export const tryOnItemSchema = z
  .object({
    store: priceRangeStoreSchema,
    title: z.string().trim().min(1).max(200),
    price: z.coerce.number().nonnegative(),
  })
  .strict();
export type TryOnItem = z.infer<typeof tryOnItemSchema>;

/** One item of an outfit put together on the 3D mannequin, for the part of the look it is worn for. */
export const tryOnOutfitItemSchema = tryOnItemSchema.extend({ slotId: slotIdSchema }).strict();
export type TryOnOutfitItem = z.infer<typeof tryOnOutfitItemSchema>;

/**
 * `POST /v1/try-on/jobs`: try on one similar item (`slotId` + `item`), the saved or first item for one garment
 * (`slotId` only), the outfit put together on the 3D mannequin (`items`, one per part of the look), or the
 * whole look (none of them). `notice` must equal `TRY_ON_NOTICE_VERSION`.
 */
export const startTryOnRequestSchema = z
  .object({
    outfitId: objectIdSchema,
    slotId: slotIdSchema.optional(),
    item: tryOnItemSchema.optional(),
    items: z.array(tryOnOutfitItemSchema).min(1).max(TRY_ON_MAX_GARMENTS).optional(),
    notice: z.literal(TRY_ON_NOTICE_VERSION),
  })
  .strict()
  .refine((req) => !req.item || req.slotId, { path: ['item'], message: 'An item needs its slotId' })
  .refine((req) => !req.items || (!req.slotId && !req.item), {
    path: ['items'],
    message: 'Send items, or slotId and item, not both',
  })
  .refine((req) => !req.items || new Set(req.items.map((i) => i.slotId)).size === req.items.length, {
    path: ['items'],
    message: 'One item per part of the look',
  });
export type StartTryOnRequest = z.infer<typeof startTryOnRequestSchema>;

/** A garment being tried on: the listing as the search returned it, and the part of the look it is for. */
export const tryOnGarmentSchema = productListingSchema.extend({ slotId: slotIdSchema }).strict();
export type TryOnGarment = z.infer<typeof tryOnGarmentSchema>;

/** A try-on. The picture and model are fetched separately, and only by their owner. */
export const tryOnJobSchema = z
  .object({
    id: objectIdSchema,
    outfitId: objectIdSchema,
    slotId: slotIdSchema.nullable(),
    stage: tryOnStageSchema,
    /** The garment being put on now, from 1. */
    step: z.number().int().min(1),
    totalSteps: z.number().int().min(1).max(TRY_ON_MAX_GARMENTS),
    garments: z.array(tryOnGarmentSchema).min(1).max(TRY_ON_MAX_GARMENTS),
    imageReady: z.boolean(),
    model3d: tryOn3dStatusSchema,
    /** Why the try-on failed, written for the user; null otherwise. */
    message: z.string().nullable(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type TryOnJob = z.infer<typeof tryOnJobSchema>;

// --- Model drape (D-138, D-139) -----------------------------------------------------------------------
// A realistic synthetic model (one per Clothing Preference, generated once and shared, not a real person and
// nothing about the user) is dressed in the outfit's real items by an image-editing model on Pollinations: the
// model picture and each item's store thumbnail are sent, one garment at a time. The three-quarter, side and
// back views are then drawn from the dressed front. Free models only.

export const AVATAR_DEPARTMENTS = ['women', 'men'] as const;
export const avatarDepartmentSchema = z.enum(AVATAR_DEPARTMENTS);
export type AvatarDepartment = z.infer<typeof avatarDepartmentSchema>;

/** Shown with every dressed model (D-139). */
export const DRAPE_LABEL =
  'AI-generated preview on a synthetic model, not a real person. Side and back views are AI estimates; fit, colour and detail may differ from the item.';

/**
 * The angles of a dressed model (D-139): the front is made with the drape; the others are drawn from the
 * dressed front, on request, and kept with it.
 */
export const DRAPE_VIEWS = ['front', 'three_quarter', 'side', 'back'] as const;
export const drapeViewSchema = z.enum(DRAPE_VIEWS);
export type DrapeView = z.infer<typeof drapeViewSchema>;
export const DRAPE_VIEW_LABELS: Record<DrapeView, string> = {
  front: 'Front',
  three_quarter: 'Three-quarter',
  side: 'Side',
  back: 'Back',
};

/** `POST /v1/try-on/drapes`: dress the model in the outfit put together in the fitting room. */
export const startDrapeRequestSchema = z
  .object({
    outfitId: objectIdSchema,
    department: avatarDepartmentSchema,
    items: z.array(tryOnOutfitItemSchema).min(1).max(TRY_ON_MAX_GARMENTS),
  })
  .strict()
  .refine((req) => new Set(req.items.map((i) => i.slotId)).size === req.items.length, {
    path: ['items'],
    message: 'One item per part of the look',
  });
export type StartDrapeRequest = z.infer<typeof startDrapeRequestSchema>;

/** A dressed avatar; its picture is fetched separately, by its owner only. */
export const tryOnDrapeSchema = z
  .object({
    id: objectIdSchema,
    outfitId: objectIdSchema,
    department: avatarDepartmentSchema,
    garments: z.array(tryOnGarmentSchema).min(1).max(TRY_ON_MAX_GARMENTS),
    /** The angles already drawn; `front` is always there. */
    views: z.array(drapeViewSchema).min(1),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type TryOnDrape = z.infer<typeof tryOnDrapeSchema>;

/** `GET /v1/try-on`: whether try-on can run for this user. */
export const tryOnOverviewSchema = z
  .object({
    /** The try-on service is configured. */
    available: z.boolean(),
    /** The cartoon avatar can be dressed (D-138). */
    drapeAvailable: z.boolean(),
    /** The model chosen in My Profile (D-135); the dummy model has no try-on yet. */
    tryOnModel: tryOnModelSchema,
    /** A full-body try-on photo is stored. */
    hasPhoto: z.boolean(),
  })
  .strict();
export type TryOnOverview = z.infer<typeof tryOnOverviewSchema>;
