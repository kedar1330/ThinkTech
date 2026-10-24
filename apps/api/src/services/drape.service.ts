import { createHash } from 'node:crypto';
import { Types, mongo } from 'mongoose';
import type { Logger } from 'pino';
import {
  TRY_ON_KEEP_HOURS,
  TRY_ON_NOTICE_VERSION,
  type AvatarDepartment,
  type DrapeView,
  type StartDrapeRequest,
  type TryOnDrape,
} from '@styleme/contracts';
import type { ImageEditor } from '../integrations/image/image-edit-client';
import { ImageProviderError, type ImageGenerator } from '../integrations/image/image-client';
import type { Models, TryOnDrapeDoc } from '../models/index';
import { AppError } from '../utils/errors';
import { detectImageType } from './photo.service';
import type { StoredGarment, TryOnService } from './try-on.service';

// Model drape (D-138, D-139). A realistic synthetic model (an AI-generated person, not a real one), one per
// Clothing Preference, is generated once from a fixed prompt by the Design Studio image services (nothing about
// any user) and shared. To dress it, the model picture and each item's Google Shopping thumbnail go to
// Pollinations' image editing (free models), one garment at a time, each on the last result, layered bottom-up.
// The three-quarter, side and back views are drawn from the dressed front on request (`view`). Only listings the
// store search returned are used. Results are kept for TRY_ON_KEEP_HOURS and reused for the same model and items.
// No consent is needed: no personal data is sent. Pictures, prompts and replies are never logged.

/** Bumped when the prompts change; a stored model made with older prompts is drawn again. */
export const DRAPE_PROMPT_VERSION = 'model-drape-v2';
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

const UNAVAILABLE = 'The try-on model isn’t available right now.';
const FAILED = 'We couldn’t dress the model just now. Please try again in a minute.';
const VIEW_FAILED = 'We couldn’t draw this view just now. Please try again in a minute.';

/** A studio turntable look; the plain white base outfit makes every garment visibly replace it. */
const AVATAR_PROMPTS: Record<AvatarDepartment, string> = {
  women:
    'Photorealistic full body 3D render of a young Indian woman standing straight and facing the camera, hands on hips, long straight dark hair, gentle smile, wearing a plain fitted white t-shirt and plain white slim trousers, white heels, dark purple-grey studio backdrop with a soft floor shadow, soft studio lighting, whole body visible from head to feet, product turntable style, no text, no logos',
  men: 'Photorealistic full body 3D render of a young Indian man standing straight and facing the camera, arms relaxed at his sides, short dark hair, gentle smile, wearing a plain fitted white t-shirt and plain white straight trousers, white sneakers, dark purple-grey studio backdrop with a soft floor shadow, soft studio lighting, whole body visible from head to feet, product turntable style, no text, no logos',
};

const PART: Record<StoredGarment['category'], string> = {
  tops: 'the top (shirt or kurta) only; keep the trousers or skirt as they are',
  bottoms: 'the trousers, jeans or skirt only; keep the top as it is',
  'one-pieces': 'the whole outfit (top and bottom) with this one-piece garment',
};

/** The edit instruction for one garment; it describes only the model and the garment. */
export function drapePrompt(garment: Pick<StoredGarment, 'category' | 'title'>): string {
  return [
    'Dress the person in the first image in the garment shown in the second image (a store product photo).',
    `Replace ${PART[garment.category]}.`,
    'Copy the garment’s colour, print, embroidery, neckline, sleeves and length, fitted naturally to the body.',
    'Keep the face, hair, skin, pose, shoes, framing, lighting and the dark studio backdrop exactly the same. Photorealistic. No text, no logos.',
  ].join(' ');
}

/** How to turn the dressed model for each view; the outfit must not change. */
const VIEW_TURNS: Record<Exclude<DrapeView, 'front'>, string> = {
  three_quarter:
    'turned about 45 degrees to her or his left, a three-quarter view showing the front and the right side',
  side: 'turned 90 degrees to her or his left so we see the right side in profile',
  back: 'turned around so we see the person from directly behind (back view)',
};

export function viewPrompt(view: Exclude<DrapeView, 'front'>): string {
  return [
    `Show the same person, wearing exactly the same outfit, ${VIEW_TURNS[view]}.`,
    'Same face, hair, skin, outfit colours, print, embroidery and length, same shoes, same dark studio backdrop, framing and lighting.',
    'Full body from head to feet, photorealistic. No text, no logos.',
  ].join(' ');
}

type StoredDrape = TryOnDrapeDoc & { _id: Types.ObjectId; createdAt: Date };

function bufferOf(raw: unknown): Buffer | null {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof mongo.Binary) return Buffer.from(raw.buffer);
  return null;
}

const dataUri = (bytes: Buffer, contentType: string) => `data:${contentType};base64,${bytes.toString('base64')}`;

function toDrape(doc: StoredDrape): TryOnDrape {
  return {
    id: String(doc._id),
    outfitId: String(doc.outfitId),
    department: doc.department as AvatarDepartment,
    garments: (doc.garments as StoredGarment[]).map(({ slotId, store, title, price, link, imageUrl }) => ({
      slotId,
      store,
      title,
      price,
      link: link ?? null,
      imageUrl,
    })),
    views: (doc.viewsReady?.length ? doc.viewsReady : ['front']) as DrapeView[],
    createdAt: doc.createdAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
  };
}

export class DrapeService {
  constructor(
    private readonly models: Models,
    private readonly editor: ImageEditor | null,
    private readonly generators: readonly ImageGenerator[],
    private readonly tryOn: TryOnService,
    private readonly timeouts: { editMs: number; imageMs: number },
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get available(): boolean {
    return this.editor !== null && this.generators.length > 0;
  }

  /** The undressed model for a Clothing Preference, generated on first use (or when the prompts change), then shared. */
  async avatar(department: AvatarDepartment): Promise<{ data: Buffer; contentType: string }> {
    const stored = await this.models.TryOnAvatar.findOne({ department }).select('+image').lean();
    const data = bufferOf(stored?.image?.data);
    if (data?.length && stored?.image?.contentType && stored.promptVersion === DRAPE_PROMPT_VERSION) {
      return { data, contentType: stored.image.contentType };
    }
    if (this.generators.length === 0) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);

    for (const generator of this.generators) {
      try {
        const picture = await this.within(this.timeouts.imageMs, (signal) =>
          generator.generate(AVATAR_PROMPTS[department], signal),
        );
        const contentType = detectImageType(picture.bytes);
        if (!contentType || picture.bytes.length > IMAGE_MAX_BYTES) throw new ImageProviderError('invalid_output');
        await this.models.TryOnAvatar.updateOne(
          { department },
          {
            $set: {
              image: { data: picture.bytes, contentType },
              provider: generator.name,
              model: generator.model,
              promptVersion: DRAPE_PROMPT_VERSION,
            },
          },
          { upsert: true },
        );
        return { data: picture.bytes, contentType };
      } catch (err) {
        this.warn('avatar', generator.name, err);
      }
    }
    throw new AppError('AI_UNAVAILABLE', UNAVAILABLE);
  }

  /** Dresses the avatar in the outfit's items, or returns the same dressed avatar made earlier if it is kept. */
  async start(userId: Types.ObjectId, request: StartDrapeRequest): Promise<TryOnDrape> {
    const editor = this.editor;
    if (!editor || this.generators.length === 0) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    const outfitId = new Types.ObjectId(request.outfitId);
    const garments = await this.tryOn.garmentsFor(userId, outfitId, {
      outfitId: request.outfitId,
      items: request.items,
      notice: TRY_ON_NOTICE_VERSION,
    });
    const avatar = await this.avatar(request.department);
    const cacheKey = createHash('sha256')
      .update(
        [
          request.department,
          createHash('sha256').update(avatar.data).digest('hex'),
          editor.models.join(','),
          DRAPE_PROMPT_VERSION,
          ...garments.map((g) => `${g.category}|${g.imageUrl}`),
        ].join('\n'),
      )
      .digest('hex');
    const kept = await this.models.TryOnDrape.findOne({
      userId,
      cacheKey,
      expiresAt: { $gt: this.now() },
    }).lean<StoredDrape>();
    if (kept) return toDrape(kept);

    // One garment at a time, each on the last result: one edit per garment keeps the avatar unchanged.
    let current = dataUri(avatar.data, avatar.contentType);
    let picture: { bytes: Buffer; contentType: string; model: string } | null = null;
    for (const garment of garments) {
      try {
        const edited = await this.within(this.timeouts.editMs, (signal) =>
          editor.edit({ prompt: drapePrompt(garment), images: [current, garment.imageUrl] }, signal),
        );
        const contentType = detectImageType(edited.bytes);
        if (!contentType || edited.bytes.length > IMAGE_MAX_BYTES) throw new ImageProviderError('invalid_output');
        picture = { bytes: edited.bytes, contentType, model: edited.model };
        current = dataUri(edited.bytes, contentType);
      } catch (err) {
        this.warn('drape', editor.name, err);
        const cause = err instanceof ImageProviderError ? err.cause : 'provider_error';
        throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', FAILED);
      }
    }

    const now = this.now();
    const doc = await this.models.TryOnDrape.create({
      userId,
      outfitId,
      department: request.department,
      cacheKey,
      garments,
      image: { data: picture!.bytes, contentType: picture!.contentType },
      provider: editor.name,
      model: picture!.model,
      promptVersion: DRAPE_PROMPT_VERSION,
      expiresAt: new Date(now.getTime() + TRY_ON_KEEP_HOURS * 60 * 60 * 1000),
    });
    return toDrape(doc.toObject() as StoredDrape);
  }

  /** One view of a dressed model, for its owner only; a view not drawn yet is not found. */
  async image(
    userId: Types.ObjectId,
    id: string,
    view: DrapeView = 'front',
  ): Promise<{ data: Buffer; contentType: string }> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const doc = await this.models.TryOnDrape.findOne({ _id: id, userId })
      .select(view === 'front' ? '+image' : '+views')
      .lean();
    const stored = (view === 'front' ? doc?.image : doc?.views?.[view]) as
      { data?: unknown; contentType?: string } | null | undefined;
    const data = bufferOf(stored?.data);
    if (!data?.length || !stored?.contentType) throw new AppError('NOT_FOUND');
    return { data, contentType: stored.contentType };
  }

  /**
   * Draws one more angle of a dressed model from its front (D-139) and keeps it; an angle already drawn is
   * returned as it is. Only the dressed front picture is sent.
   */
  async view(userId: Types.ObjectId, id: string, view: Exclude<DrapeView, 'front'>): Promise<TryOnDrape> {
    const editor = this.editor;
    if (!editor) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const doc = await this.models.TryOnDrape.findOne({ _id: id, userId })
      .select('+image')
      .lean<StoredDrape & { image?: { data?: unknown; contentType?: string } }>();
    const front = bufferOf(doc?.image?.data);
    if (!doc || !front?.length || !doc.image?.contentType) throw new AppError('NOT_FOUND');
    if (doc.viewsReady?.includes(view)) return toDrape(doc);

    let picture: { bytes: Buffer; contentType: string };
    try {
      const edited = await this.within(this.timeouts.editMs, (signal) =>
        editor.edit({ prompt: viewPrompt(view), images: [dataUri(front, doc.image!.contentType!)] }, signal),
      );
      const contentType = detectImageType(edited.bytes);
      if (!contentType || edited.bytes.length > IMAGE_MAX_BYTES) throw new ImageProviderError('invalid_output');
      picture = { bytes: edited.bytes, contentType };
    } catch (err) {
      this.warn('view', editor.name, err);
      const cause = err instanceof ImageProviderError ? err.cause : 'provider_error';
      throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', VIEW_FAILED);
    }
    const updated = await this.models.TryOnDrape.findOneAndUpdate(
      { _id: doc._id, userId },
      {
        $set: { [`views.${view}`]: { data: picture.bytes, contentType: picture.contentType } },
        $addToSet: { viewsReady: view },
      },
      { returnDocument: 'after' },
    ).lean<StoredDrape>();
    if (!updated) throw new AppError('NOT_FOUND');
    return toDrape(updated);
  }

  async remove(userId: Types.ObjectId, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const { deletedCount } = await this.models.TryOnDrape.deleteOne({ _id: id, userId });
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
  }

  private async within<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Only the cause is logged, never the picture, prompt or reply. */
  private warn(step: 'avatar' | 'drape' | 'view', provider: string, err: unknown) {
    const cause = err instanceof ImageProviderError ? err.cause : 'provider_error';
    const status = err instanceof ImageProviderError ? err.status : undefined;
    this.logger.warn({ event: 'drape_failed', step, cause, status, provider });
  }
}
