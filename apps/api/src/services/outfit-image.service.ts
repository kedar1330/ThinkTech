import { Types, mongo } from 'mongoose';
import type { Logger } from 'pino';
import type { LookImageStatus, LookInputs, LookSlot, RecommendationRequest } from '@styleme/contracts';
import { ImageProviderError, type OutfitImageProvider } from '../integrations/ai/image-client';
import {
  OUTFIT_IMAGE_PROMPT_VERSION,
  OUTFIT_IMAGE_SIZE,
  buildOutfitImagePrompt,
  seedFor,
} from '../integrations/ai/prompts/outfit-image-v2';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';
import type { ColourLibraryService } from './colour-library.service';
import { closestOf } from './engine';

// AI outfit images on looks. A look's image is generated the first time its owner views it, from the look
// (garments, occasion, style, department; see the prompt's notes on AI rule 16) shown in colours from the
// user's My Colour Palette (D-133): each piece in the palette colour closest to the look's colour. The
// palette is the colours they liked; without any, the top colours of their own palette less the ones they
// avoid; without a palette, the look's own colours. The image is stored in `outfitImages` with the look's
// lifetime: it expires with a suggested look and stays once the look is saved (OutfitsService). Every read
// is scoped by `userId`. Prompts, image bytes and replies are never logged.

/** How many of the user's top-ranked palette colours are used when they haven't liked any. */
const TOP_PALETTE_COLOURS = 24;

const FAILED = 'We couldn’t create this outfit image just now. Please try again later.';

interface StoredLook {
  _id: Types.ObjectId;
  slots: LookSlot[];
  request: RecommendationRequest;
  inputsUsed: LookInputs;
  expiresAt?: Date | null;
}

const bufferOf = (raw: unknown): Buffer | null =>
  Buffer.isBuffer(raw) ? raw : raw instanceof mongo.Binary ? Buffer.from(raw.buffer) : null;

export class OutfitImageService {
  constructor(
    private readonly models: Models,
    private readonly provider: OutfitImageProvider | null,
    private readonly timeoutMs: number,
    private readonly logger: Logger,
    private readonly colours?: ColourLibraryService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The colours to dress the image in: liked ones, else the top of the user's own palette less avoided ones. */
  private async palette(userId: Types.ObjectId): Promise<Array<{ name: string; hex: string }>> {
    if (!this.colours) return [];
    const { liked, avoided } = await this.colours.getPreferences(userId);
    if (liked.length > 0) return liked;
    const mine = await this.colours.mine(userId);
    const skip = new Set(avoided.map((c) => c.colourId));
    return mine.colours.filter((c) => !skip.has(c.colourId)).slice(0, TOP_PALETTE_COLOURS);
  }

  /** Slot ID → the palette colour closest to the slot's colour (none when the user has no palette). */
  private async slotColours(userId: Types.ObjectId, slots: readonly LookSlot[]): Promise<Map<string, string>> {
    const palette = await this.palette(userId);
    const colours = new Map<string, string>();
    for (const slot of slots) {
      const hex = slot.swatches[0]?.hex;
      const match = hex ? closestOf(hex, palette) : null;
      if (match) colours.set(slot.slotId, match.name);
    }
    return colours;
  }

  /** Whether new images can be generated (the flag is on and a provider is configured). */
  get enabled(): boolean {
    return this.provider !== null;
  }

  /** `ready` when an image is stored, `on_request` when one will be made on first view, else null. */
  async statusFor(userId: Types.ObjectId, outfitIds: Types.ObjectId[]): Promise<Map<string, LookImageStatus>> {
    const stored = await this.models.OutfitImage.find({ userId, outfitId: { $in: outfitIds } })
      .select('outfitId')
      .lean();
    const ready = new Set(stored.map((d) => String(d.outfitId)));
    const result = new Map<string, LookImageStatus>();
    for (const id of outfitIds.map(String)) {
      if (ready.has(id)) result.set(id, 'ready');
      else if (this.enabled) result.set(id, 'on_request');
    }
    return result;
  }

  /** The image of one of the user's own looks, generated and stored first if it doesn't exist yet. */
  async image(userId: Types.ObjectId, outfitId: Types.ObjectId): Promise<{ data: Buffer; contentType: string }> {
    const look = await this.models.Outfit.findOne({
      _id: outfitId,
      userId,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: this.now() } }],
    }).lean<StoredLook>();
    if (!look) throw new AppError('NOT_FOUND');

    const stored = await this.read(userId, outfitId);
    if (stored) return stored;
    if (!this.provider) throw new AppError('NOT_FOUND');

    const prompt = buildOutfitImagePrompt({
      slots: look.slots,
      occasion: look.request.occasion,
      style: look.request.style ?? null,
      department: look.inputsUsed?.department ?? null,
      colours: await this.slotColours(userId, look.slots),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let image;
    try {
      image = await this.provider.generate({ prompt, ...OUTFIT_IMAGE_SIZE, seed: seedFor(prompt) }, controller.signal);
    } catch (err) {
      const cause = err instanceof ImageProviderError ? err.cause : 'provider_error';
      this.logger.warn({
        event: 'outfit_image_failed',
        cause,
        provider: this.provider.name,
        model: this.provider.model,
      });
      throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', FAILED);
    } finally {
      clearTimeout(timer);
    }

    try {
      await this.models.OutfitImage.create({
        userId,
        outfitId,
        data: image.bytes,
        contentType: image.contentType,
        bytes: image.bytes.length,
        provider: this.provider.name,
        model: this.provider.model,
        promptVersion: OUTFIT_IMAGE_PROMPT_VERSION,
        expiresAt: look.expiresAt ?? null,
      });
    } catch (err) {
      // Two first views at once: the other request stored its image first, and that one is kept.
      if ((err as { code?: number }).code !== 11000) throw err;
      return (await this.read(userId, outfitId)) ?? { data: image.bytes, contentType: image.contentType };
    }
    this.logger.info({ event: 'outfit_image_created', provider: this.provider.name, model: this.provider.model });
    return { data: image.bytes, contentType: image.contentType };
  }

  private async read(userId: Types.ObjectId, outfitId: Types.ObjectId) {
    const doc = await this.models.OutfitImage.findOne({ userId, outfitId }).select('data contentType').lean();
    const data = bufferOf(doc?.data);
    return doc && data?.length ? { data, contentType: doc.contentType } : null;
  }
}
