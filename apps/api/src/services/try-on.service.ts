import { createHash } from 'node:crypto';
import { Types, mongo } from 'mongoose';
import type { Logger } from 'pino';
import {
  TRY_ON_KEEP_HOURS,
  TRY_ON_MAX_GARMENTS,
  type LookSlot,
  type ProductListing,
  type StartTryOnRequest,
  type TryOn3dStatus,
  type TryOnJob,
  type TryOnModel,
  type TryOnOverview,
  type TryOnStage,
} from '@styleme/contracts';
import {
  TryOnProviderError,
  modelMeshUrl,
  tryOnImageUrl,
  type GarmentCategory,
  type QueuedRequest,
  type QueueResult,
  type TryOnRenderer,
} from '../integrations/tryon/fal-client';
import type { Models, TryOnJobDoc } from '../models/index';
import { AppError } from '../utils/errors';
import { detectImageType } from './photo.service';
import type { PriceRangeService } from './price-range.service';

// 3D Virtual Try-On (#106, D-137). The user's newest full-body photo (stored for try-on in My Profile, D-135)
// and the Google Shopping thumbnail of a similar item from Shop My Look go to fal.ai: FASHN dresses the photo,
// one garment at a time for a whole look, then TRELLIS turns the dressed photo into a GLB model. Nothing else
// about the user is sent. Work is queued at fal and advanced when the web app polls (no background jobs);
// the picture and model are stored with the try-on and deleted after TRY_ON_KEEP_HOURS. When the 3D step fails
// the picture is still shown. Photos, pictures, models, URLs and replies are never logged.

const UNAVAILABLE = 'Virtual Try-On is not available right now.';
const FAILED = 'We couldn’t finish your try-on just now. Please try again in a minute.';
const NEEDS_PHOTO =
  'Add a full-body photo in My Profile → 3D Virtual Try-On first. Your photo is what the outfit is tried on.';
const DUMMY_NOT_READY =
  'Try-on on the dummy model isn’t available yet. To try this on, choose “Upload your photo” in My Profile → 3D Virtual Try-On.';
const NO_PICTURES = 'None of the similar items for this look has a picture to try on yet.';

/** The dressed picture and the GLB model are stored in one document, under MongoDB's 16 MB limit. */
export const TRY_ON_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const TRY_ON_MODEL_MAX_BYTES = 10 * 1024 * 1024;
/** How long one poll may hold the try-on before another request may advance it. */
const LOCK_MS = 60_000;

/** Garments are layered bottom-up: a one-piece or bottom first, then the top, then a layer over it. */
const LAYER_ORDER: Record<string, { order: number; category: GarmentCategory }> = {
  one_piece: { order: 0, category: 'one-pieces' },
  bottom: { order: 1, category: 'bottoms' },
  top: { order: 2, category: 'tops' },
  layer: { order: 3, category: 'tops' },
};

export type StoredGarment = ProductListing & { slotId: string; imageUrl: string; category: GarmentCategory };
type StoredJob = TryOnJobDoc & { _id: Types.ObjectId; createdAt: Date };

function bufferOf(raw: unknown): Buffer | null {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof mongo.Binary) return Buffer.from(raw.buffer);
  return null;
}

/** A GLB file starts with the ASCII magic `glTF`. */
export const isGlb = (bytes: Buffer) => bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'glTF';

function toJob(doc: StoredJob): TryOnJob {
  const garments = doc.garments as StoredGarment[];
  const stage = doc.stage as TryOnStage;
  return {
    id: String(doc._id),
    outfitId: String(doc.outfitId),
    slotId: doc.slotId ?? null,
    stage,
    step: Math.min(doc.step + 1, garments.length),
    totalSteps: garments.length,
    garments: garments.map(({ slotId, store, title, price, link, imageUrl }) => ({
      slotId,
      store,
      title,
      price,
      link: link ?? null,
      imageUrl,
    })),
    imageReady: stage === 'model_3d' || stage === 'done',
    model3d: doc.model3dStatus as TryOn3dStatus,
    message: doc.message ?? null,
    createdAt: doc.createdAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
  };
}

export class TryOnService {
  constructor(
    private readonly models: Models,
    private readonly renderer: TryOnRenderer | null,
    private readonly products: PriceRangeService,
    private readonly timeouts: { requestMs: number; stepMs: number },
    private readonly logger: Logger,
    /** Whether the cartoon avatar can be dressed (D-138), for the overview. */
    private readonly drapeAvailable = false,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async overview(userId: Types.ObjectId): Promise<TryOnOverview> {
    const [profile, photo] = await Promise.all([
      this.models.Profile.findOne({ userId }, { tryOnModel: 1 }).lean(),
      this.models.UserPhoto.exists({ userId, kind: 'body' }),
    ]);
    return {
      available: this.renderer !== null,
      drapeAvailable: this.drapeAvailable,
      tryOnModel: this.modelChoice(profile?.tryOnModel, photo !== null),
      hasPhoto: photo !== null,
    };
  }

  /** Starts a try-on, or returns the same try-on made earlier (same photo, models and garments) if it is kept. */
  async start(userId: Types.ObjectId, request: StartTryOnRequest): Promise<TryOnJob> {
    const renderer = this.renderer;
    if (!renderer) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    const [profile, photo] = await Promise.all([
      this.models.Profile.findOne({ userId }, { tryOnModel: 1 }).lean(),
      this.models.UserPhoto.findOne({ userId, kind: 'body' }).sort({ uploadedAt: -1 }).select('+data').lean(),
    ]);
    if (this.modelChoice(profile?.tryOnModel, photo !== null) === 'dummy_model') {
      throw new AppError('CONFLICT', photo ? DUMMY_NOT_READY : NEEDS_PHOTO);
    }
    const bytes = bufferOf(photo?.data);
    if (!photo || !bytes?.length) throw new AppError('CONFLICT', NEEDS_PHOTO);

    const outfitId = new Types.ObjectId(request.outfitId);
    const garments = await this.garmentsFor(userId, outfitId, request);
    const cacheKey = createHash('sha256')
      .update(
        [
          String(photo._id),
          renderer.tryOnModel,
          renderer.model3d,
          ...garments.map((g) => `${g.category}|${g.imageUrl}`),
        ].join('\n'),
      )
      .digest('hex');
    const kept = await this.models.TryOnJob.findOne({
      userId,
      cacheKey,
      stage: { $ne: 'failed' },
      expiresAt: { $gt: this.now() },
    }).lean<StoredJob>();
    if (kept) return toJob(kept);

    const person = `data:${photo.contentType};base64,${bytes.toString('base64')}`;
    const first = garments[0]!;
    const queued = await this.call((signal) =>
      renderer.submitTryOn({ person, garmentImageUrl: first.imageUrl, category: first.category }, signal),
    ).catch((err: unknown) => {
      const cause = err instanceof TryOnProviderError ? err.cause : 'provider_error';
      const status = err instanceof TryOnProviderError ? err.status : undefined;
      const details = err instanceof TryOnProviderError ? err.details : undefined;
      this.logger.warn({ event: 'try_on_failed', stage: 'try_on', cause, status, details, provider: renderer.name });
      if (cause === 'unauthorized') {
        const msg =
          details && /exhausted balance/i.test(details)
            ? 'Virtual Try-On credit balance is exhausted on fal.ai. Please top up your balance at fal.ai/dashboard/billing or set FAL_KEY=mock in apps/api/.env to test.'
            : 'Virtual Try-On API key is unauthorized or invalid. Please verify your FAL_KEY in apps/api/.env or set FAL_KEY=mock to test.';
        throw new AppError('AI_UNAVAILABLE', msg);
      }
      throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', FAILED);
    });

    const now = this.now();
    const doc = await this.models.TryOnJob.create({
      userId,
      outfitId,
      slotId: request.slotId ?? null,
      photoId: photo._id,
      cacheKey,
      garments,
      stage: 'try_on',
      step: 0,
      stageStartedAt: now,
      request: queued,
      provider: renderer.name,
      tryOnModel: renderer.tryOnModel,
      model3dModel: renderer.model3d,
      noticeVersion: request.notice,
      expiresAt: new Date(now.getTime() + TRY_ON_KEEP_HOURS * 60 * 60 * 1000),
    });
    return toJob(doc.toObject() as StoredJob);
  }

  /** The try-on, advanced one step if its current step at fal has finished. */
  async get(userId: Types.ObjectId, id: string): Promise<TryOnJob> {
    const job = await this.find(userId, id);
    if ((job.stage !== 'try_on' && job.stage !== 'model_3d') || !this.renderer) return toJob(job);
    return toJob(await this.advance(job));
  }

  /** The dressed picture, or the GLB model, as stored. */
  async file(
    userId: Types.ObjectId,
    id: string,
    which: 'image' | 'model',
  ): Promise<{ data: Buffer; contentType: string }> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const field = which === 'image' ? 'image' : 'model3d';
    const doc = await this.models.TryOnJob.findOne({ _id: id, userId }).select(`+${field}`).lean();
    const stored = doc?.[field] as { data?: unknown; contentType?: string } | null | undefined;
    const data = bufferOf(stored?.data);
    if (!data?.length || !stored?.contentType) throw new AppError('NOT_FOUND');
    return { data, contentType: stored.contentType };
  }

  async remove(userId: Types.ObjectId, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const { deletedCount } = await this.models.TryOnJob.deleteOne({ _id: id, userId });
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
  }

  /** The profile's choice; without one, the photo decides (as My Profile shows it, D-135). */
  private modelChoice(stored: string | null | undefined, hasPhoto: boolean): TryOnModel {
    if (stored === 'custom_photo' || stored === 'dummy_model') return stored;
    return hasPhoto ? 'custom_photo' : 'dummy_model';
  }

  private async find(userId: Types.ObjectId, id: string): Promise<StoredJob> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const doc = await this.models.TryOnJob.findOne({ _id: id, userId }).lean<StoredJob>();
    if (!doc) throw new AppError('NOT_FOUND');
    return doc;
  }

  /**
   * The garments to try on, from the listings Shop My Look returned (never a made-up product): the named item
   * for one garment, else that garment's saved item or its first item with a picture; for the whole look, the
   * same for each garment, layered bottom-up.
   */
  async garmentsFor(
    userId: Types.ObjectId,
    outfitId: Types.ObjectId,
    request: StartTryOnRequest,
  ): Promise<StoredGarment[]> {
    const look = await this.models.Outfit.findOne({ _id: outfitId, userId }, { slots: 1 }).lean<{
      slots: LookSlot[];
    }>();
    if (!look) throw new AppError('NOT_FOUND');
    const [{ slots }, picks] = await Promise.all([
      this.products.products(userId, outfitId),
      this.products.picks(userId, outfitId),
    ]);
    const norm = (id: string) => id.replace(/[-_]/g, '').toLowerCase();
    const kindOf = new Map<string, string>();
    for (const s of look.slots) {
      kindOf.set(s.slotId, s.slot);
      kindOf.set(norm(s.slotId), s.slot);
      if (s.slot === 'one_piece') {
        kindOf.set('outfit', 'one_piece');
        kindOf.set('onepiece', 'one_piece');
        kindOf.set('one-piece', 'one_piece');
        kindOf.set('one_piece', 'one_piece');
      }
    }

    const choose = (slotId: string): StoredGarment | null => {
      const slotKind = kindOf.get(slotId) ?? kindOf.get(norm(slotId));
      const layer = LAYER_ORDER[slotKind ?? ''];
      if (!layer) return null;
      // Matches for the look first, then other styles of the same garment (#133); both can be tried on.
      const found = slots.find(
        (s) =>
          s.slotId === slotId ||
          norm(s.slotId) === norm(slotId) ||
          (norm(slotId) === 'outfit' && (norm(s.slotId) === 'onepiece' || s.slotId === 'one-piece')) ||
          (norm(s.slotId) === 'outfit' && (norm(slotId) === 'onepiece' || slotId === 'one-piece')),
      );
      const listings: ProductListing[] = [...(found?.listings ?? []), ...(found?.alternatives ?? [])];
      const item = request.items
        ? request.items.find((i) => i.slotId === slotId || norm(i.slotId) === norm(slotId))
        : request.slotId === slotId || (request.slotId && norm(request.slotId) === norm(slotId))
          ? request.item
          : undefined;
      const pick = picks.find((p) => p.slotId === slotId || norm(p.slotId) === norm(slotId));
      const isOriginal = item
        ? item.title?.startsWith('Original ') || item.price === 0
        : !request.item && (!pick || pick.title?.startsWith('Original ') || pick.price === 0);

      const listing = item
        ? listings.find((l) => l.store === item.store && l.title === item.title && l.price === item.price)
        : (listings.find(
            (l) => pick && l.store === pick.store && l.title === pick.title && l.price === pick.price && l.imageUrl,
          ) ?? listings.find((l) => l.imageUrl));

      if (listing?.imageUrl) {
        return { ...listing, imageUrl: listing.imageUrl, slotId, category: layer.category };
      }

      if (isOriginal) {
        const lookSlot = look.slots.find((s) => s.slotId === slotId || norm(s.slotId) === norm(slotId));
        const slotCategory = lookSlot?.lookSpec?.category ?? slotKind;
        const title = item?.title ?? (slotCategory ? `Original ${slotCategory}` : 'Original Outfit');
        return {
          slotId,
          store: item?.store ?? 'meesho',
          title,
          price: item?.price ?? 0,
          link: null,
          imageUrl: `/api/outfits/${outfitId}/image`,
          category: layer.category,
        };
      }

      return null;
    };

    if (request.slotId) {
      const slotKind = kindOf.get(request.slotId) ?? kindOf.get(norm(request.slotId));
      if (!slotKind || !LAYER_ORDER[slotKind]) {
        throw new AppError('INVALID_REQUEST', 'That part of the look can’t be tried on.');
      }
      const garment = choose(request.slotId);
      if (!garment) {
        throw new AppError(
          'NOT_FOUND',
          request.item
            ? 'That item is no longer in the search results, or has no picture. Please pick another.'
            : NO_PICTURES,
        );
      }
      return [garment];
    }
    if (request.items) {
      // The outfit put together on the 3D mannequin: exactly those items, each one the search returned.
      const garments: StoredGarment[] = [];
      for (const item of request.items) {
        if (!item) continue;
        const slotId = item.slotId;
        const slotKind = kindOf.get(slotId) ?? kindOf.get(norm(slotId));
        if (!slotKind || !LAYER_ORDER[slotKind]) {
          throw new AppError('INVALID_REQUEST', 'That part of the look can’t be tried on.');
        }
        const garment = choose(slotId);
        if (!garment) {
          throw new AppError(
            'NOT_FOUND',
            'One of your items is no longer in the search results, or has no picture. Please pick another.',
          );
        }
        garments.push(garment);
      }
      return garments.sort(
        (a, b) =>
          LAYER_ORDER[kindOf.get(a.slotId) ?? kindOf.get(norm(a.slotId))!]!.order -
          LAYER_ORDER[kindOf.get(b.slotId) ?? kindOf.get(norm(b.slotId))!]!.order,
      );
    }
    const garments = slots
      .map((s) => choose(s.slotId))
      .filter((g): g is StoredGarment => g !== null)
      .sort(
        (a, b) =>
          LAYER_ORDER[kindOf.get(a.slotId) ?? kindOf.get(norm(a.slotId))!]!.order -
          LAYER_ORDER[kindOf.get(b.slotId) ?? kindOf.get(norm(b.slotId))!]!.order,
      )
      .slice(0, TRY_ON_MAX_GARMENTS);
    if (garments.length === 0) throw new AppError('CONFLICT', NO_PICTURES);
    return garments;
  }

  /** Moves the try-on on when fal has finished its current step; returns it as it is now. */
  private async advance(job: StoredJob): Promise<StoredJob> {
    const renderer = this.renderer!;
    const now = this.now();
    const leased = await this.models.TryOnJob.findOneAndUpdate(
      {
        _id: job._id,
        stage: job.stage,
        step: job.step,
        $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
      },
      { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
      { returnDocument: 'after' },
    )
      .select('+resultUrl')
      .lean<StoredJob & { resultUrl?: string | null }>();
    // Another request is advancing it right now.
    if (!leased) return job;

    const stage = leased.stage as 'try_on' | 'model_3d';
    const update: Record<string, unknown> = { lockedUntil: null };
    try {
      if (now.getTime() - leased.stageStartedAt.getTime() > this.timeouts.stepMs) {
        throw new TryOnProviderError('timeout');
      }
      const state = await this.poll(stage, leased.request as QueuedRequest);
      if (state.done && stage === 'try_on') Object.assign(update, await this.afterTryOn(leased, state.output));
      if (state.done && stage === 'model_3d') Object.assign(update, await this.after3d(state.output));
    } catch (err) {
      const cause = err instanceof TryOnProviderError ? err.cause : 'provider_error';
      const status = err instanceof TryOnProviderError ? err.status : undefined;
      const details = err instanceof TryOnProviderError ? err.details : undefined;
      this.logger.warn({ event: 'try_on_failed', stage, cause, status, details, provider: renderer.name });
      let message = FAILED;
      if (cause === 'unauthorized') {
        message =
          details && /exhausted balance/i.test(details)
            ? 'Virtual Try-On credit balance is exhausted on fal.ai. Please top up your balance at fal.ai/dashboard/billing or set FAL_KEY=mock in apps/api/.env to test.'
            : 'Virtual Try-On API key is unauthorized or invalid. Please verify your FAL_KEY in apps/api/.env or set FAL_KEY=mock to test.';
      }
      Object.assign(
        update,
        stage === 'try_on'
          ? { stage: 'failed', message, request: null, resultUrl: null }
          : { stage: 'done', model3dStatus: 'failed', request: null, resultUrl: null },
      );
    }
    const doc = await this.models.TryOnJob.findOneAndUpdate(
      { _id: job._id },
      { $set: update },
      { returnDocument: 'after' },
    ).lean<StoredJob>();
    if (!doc) throw new AppError('NOT_FOUND');
    return doc;
  }

  /**
   * Polls fal. A timeout or rate limit while polling is not a failure: the step is still running there, and
   * the next poll asks again (the step timeout ends it if it never finishes).
   */
  private async poll(stage: 'try_on' | 'model_3d', request: QueuedRequest): Promise<QueueResult> {
    try {
      return await this.call((signal) => this.renderer!.poll(request, signal));
    } catch (err) {
      if (err instanceof TryOnProviderError && (err.cause === 'timeout' || err.cause === 'rate_limited')) {
        return { done: false };
      }
      throw err;
    }
  }

  /** A garment is on: put on the next one, or store the picture and start the 3D model. */
  private async afterTryOn(
    job: StoredJob & { resultUrl?: string | null },
    output: unknown,
  ): Promise<Record<string, unknown>> {
    const renderer = this.renderer!;
    const url = tryOnImageUrl(output);
    const garments = job.garments as StoredGarment[];
    const next = garments[job.step + 1];
    if (next) {
      const queued = await this.call((signal) =>
        renderer.submitTryOn({ person: url, garmentImageUrl: next.imageUrl, category: next.category }, signal),
      );
      return { step: job.step + 1, request: queued, resultUrl: url, stageStartedAt: this.now() };
    }

    const picture = await this.call((signal) => renderer.download(url, TRY_ON_IMAGE_MAX_BYTES, signal));
    const contentType = detectImageType(picture.bytes);
    if (!contentType) throw new TryOnProviderError('invalid_output');
    const image = { data: picture.bytes, contentType };
    try {
      const queued = await this.call((signal) => renderer.submit3d(url, signal));
      return { stage: 'model_3d', image, request: queued, resultUrl: url, stageStartedAt: this.now() };
    } catch (err) {
      // The picture is ready even if the 3D model can't be started.
      const cause = err instanceof TryOnProviderError ? err.cause : 'provider_error';
      this.logger.warn({ event: 'try_on_failed', stage: 'model_3d', cause, provider: renderer.name });
      return { stage: 'done', image, model3dStatus: 'failed', request: null, resultUrl: null };
    }
  }

  /** The 3D model is built: store it and end the try-on. */
  private async after3d(output: unknown): Promise<Record<string, unknown>> {
    const url = modelMeshUrl(output);
    const file = await this.call((signal) => this.renderer!.download(url, TRY_ON_MODEL_MAX_BYTES, signal));
    if (!isGlb(file.bytes)) throw new TryOnProviderError('invalid_output');
    return {
      stage: 'done',
      model3d: { data: file.bytes, contentType: 'model/gltf-binary' },
      model3dStatus: 'ready',
      request: null,
      resultUrl: null,
    };
  }

  /** One fal call with its own timeout. */
  private async call<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeouts.requestMs);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }
}
