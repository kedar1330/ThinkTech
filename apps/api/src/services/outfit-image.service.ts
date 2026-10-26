import { Types, mongo } from 'mongoose';
import type { Logger } from 'pino';
import type { ColourId, LookImageStatus, LookInputs, LookSlot, RecommendationRequest } from '@styleme/contracts';
import { DESIGN_FEATURES, GARMENT_TYPES } from '../design/catalogue';
import { ImageProviderError, type OutfitImageProvider } from '../integrations/ai/image-client';
import {
  OUTFIT_IMAGE_PROMPT_VERSION,
  OUTFIT_IMAGE_SIZE,
  buildOutfitImagePrompt,
  seedFor,
  type OutfitImageDesign,
} from '../integrations/ai/prompts/outfit-image-v3';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';
import type { ColourLibraryService } from './colour-library.service';
import { closestOf } from './engine';

// AI outfit images on looks. A look's image is generated the first time its owner views it, from the look
// (garments, occasion, wear type, style, department; see the prompt's notes on AI rule 16) and, for a look
// built around a garment designed in Outfit Categories (D-132), that garment's chosen features, shown in
// colours from the user's My Colour Palette (D-133). Colour resolution (highest priority first):
//   1. Colours the user explicitly picked in Discover My Style (`chosenColours` on the request).
//   2. Coordinating/combination colours from their palette (deterministic colour-theory rules, D-133 §3.14).
//   3. Liked palette colours (the colours they marked as liked in My Colour Palette).
//   4. The top colours of their own palette less the ones they avoid.
//   5. Without a palette, no colour override — the look's own swatches are shown as-is.
// The image is stored in `outfitImages` with the look's lifetime: it expires with a suggested look and
// stays once the look is saved (OutfitsService). Every read is scoped by `userId`. Prompts, image bytes
// and replies are never logged.

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

  /**
   * Resolves the colour palette to dress the outfit image in (highest priority first):
   * 1. customColors — explicit colour names / hexes passed in the request.
   * 2. chosenColourIds — explicit CLR-XXXX colour IDs the user picked in the Discover My Style form.
   * 3. Coordinating / combination colours from their palette (D-133 §3.14).
   * 4. User's full seasonal category palette less avoided colours.
   */
  private async palette(
    userId: Types.ObjectId,
    customColors?: readonly string[],
    chosenColourIds?: readonly ColourId[],
  ): Promise<Array<{ name: string; hex: string }>> {
    if (customColors && customColors.length > 0) {
      if (this.colours) {
        const mine = await this.colours.mine(userId);
        const nameMap = new Map(mine.colours.map((c) => [c.name.toLowerCase(), c.hex]));
        return customColors.map((c) => ({
          name: c,
          hex: nameMap.get(c.toLowerCase()) || (c.startsWith('#') ? c : '#A8432A'),
        }));
      }
      return customColors.map((c) => ({
        name: c,
        hex: c.startsWith('#') ? c : '#A8432A',
      }));
    }

    if (!this.colours) return [];

    if (chosenColourIds && chosenColourIds.length > 0) {
      const prefs = await this.colours.getPreferences(userId);
      const allKnown = [...prefs.liked, ...prefs.avoided];
      const knownIds = new Set(allKnown.map((c) => c.colourId));
      const missingIds = chosenColourIds.filter((id) => !knownIds.has(id));
      const mine = missingIds.length > 0 ? await this.colours.mine(userId) : null;
      const extra = mine ? mine.colours.filter((c) => missingIds.includes(c.colourId as ColourId)) : [];
      const lookup = new Map([...allKnown, ...extra].map((c) => [c.colourId, c]));
      return chosenColourIds.flatMap((id) => {
        const c = lookup.get(id);
        return c ? [{ name: c.name, hex: c.hex }] : [];
      });
    }

    const combs = await this.colours.combinations(userId);
    if (combs.colours.length > 0) {
      return combs.colours.filter((c) => c.preference !== 'avoided').map((c) => ({ name: c.name, hex: c.hex }));
    }

    const { liked, avoided } = await this.colours.getPreferences(userId);
    if (liked.length > 0) return liked;
    const mine = await this.colours.mine(userId);
    const skip = new Set(avoided.map((c) => c.colourId));
    return mine.colours.filter((c) => !skip.has(c.colourId)).slice(0, TOP_PALETTE_COLOURS);
  }

  /** Slot ID → the palette colour closest to the slot's colour (none when the user has no palette). */
  private async slotColours(
    userId: Types.ObjectId,
    slots: readonly LookSlot[],
    customColors?: readonly string[],
    chosenColourIds?: readonly ColourId[],
  ): Promise<Map<string, string>> {
    const palette = await this.palette(userId, customColors, chosenColourIds);
    const colours = new Map<string, string>();
    for (const slot of slots) {
      const hex = slot.swatches[0]?.hex;
      const match = hex ? closestOf(hex, palette) : null;
      if (match) colours.set(slot.slotId, match.name);
      else if (palette.length > 0) colours.set(slot.slotId, palette[0]!.name);
    }
    return colours;
  }

  /** The user's own saved design of the garment the look was built around, with its features' names. */
  private async design(userId: Types.ObjectId, look: StoredLook): Promise<OutfitImageDesign | null> {
    const request = look.request.design;
    if (!request) return null;
    const selection = await this.models.UserDesignSelection.findOne({
      userId,
      garmentType: request.garmentType,
      outfitCategory: request.outfitCategory,
    }).lean();
    const garment = GARMENT_TYPES.find((g) => g.id === request.garmentType);
    if (!selection || !garment) return null;
    const features = Object.values(selection.selectedFeatures ?? {})
      .map((id) => DESIGN_FEATURES.find((f) => f.featureId === id && f.selectable !== false))
      .filter((f) => f !== undefined)
      .map((f) => ({ category: f.category, name: f.name }));
    const mappedCategory = garment.id === 'anarkali' ? 'kurti' : garment.id === 'saree_blouse' ? 'saree' : garment.id;
    return {
      category: mappedCategory,
      garmentName: garment.name,
      garmentType: garment.id,
      garmentKind: garment.kind,
      features,
    };
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

    const wearTypes = look.request.wearType ?? [];
    const prompt = buildOutfitImagePrompt({
      slots: look.slots,
      occasion: look.request.occasion,
      style: look.request.style ?? null,
      wearType: look.request.design?.outfitCategory ?? (wearTypes.length === 1 ? wearTypes[0] : null),
      department: look.inputsUsed?.department ?? null,
      colours: await this.slotColours(userId, look.slots, look.request.customColors, look.request.chosenColours),
      design: await this.design(userId, look),
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
