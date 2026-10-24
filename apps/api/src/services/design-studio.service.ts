import { createHash } from 'node:crypto';
import { Types, mongo } from 'mongoose';
import type { Logger } from 'pino';
import { z } from 'zod';
import {
  DESIGN_IMAGE_MAX_BYTES,
  DESIGN_LIMIT_PER_USER,
  DESIGN_UNUSABLE_MESSAGES,
  DESIGN_UNUSABLE_REASONS,
  FABRIC_IDS,
  GARMENT_LENGTH_IDS,
  NECKLINE_IDS,
  SILHOUETTE_IDS,
  SLEEVE_LENGTH_IDS,
  tailorSpecSchema,
  type Category,
  type ColorFamily,
  type ColorId,
  type Design,
  type DesignImageProvider,
  type DesignImageStatus,
  type DesignSource,
  type DesignStudioResponse,
  type DesignSummary,
  type Fabric,
  type GarmentLength,
  type LookSlot,
  type Neckline,
  type Silhouette,
  type SleeveLength,
  type SlotType,
  type TailorSpec,
} from '@styleme/contracts';
import { DESIGN_PROMPT_VERSION } from '../integrations/ai/prompts/design-studio-v1';
import type { DesignAnalysisProvider, DesignImageInput } from '../integrations/ai/design-client';
import { VisionProviderError } from '../integrations/ai/vision-client';
import { ImageProviderError, type ImageGenerator } from '../integrations/image/image-client';
import type { DesignDoc, Models } from '../models/index';
import { AppError } from '../utils/errors';
import { detectImageType } from './photo.service';

// Design Studio (D-134). A design starts from a sketch the user drew, a sketch or garment picture they
// uploaded, a description, or one of their looks plus the change they want. Gemini reads it and writes a
// garment-only image prompt and a tailor spec; the image generators (Pollinations, then Cloudflare) draw
// the design from that prompt alone. When every generator fails the design is still saved with its spec
// and the picture can be retried. Descriptions, prompts, sketches and pictures are never logged.

const UNAVAILABLE = 'Design Studio is not available right now.';
const FAILED = 'We couldn’t create your design just now. Please try again in a minute.';
const PICTURE_FAILED = 'We couldn’t draw the picture just now. Your tailor spec is saved; try again in a minute.';

/** Every image prompt ends with this, whatever Gemini wrote, so the services draw clothes and never people. */
const PROMPT_GUARD =
  'Shown on a faceless tailor’s dress form, front view, whole garment visible, plain light studio background, soft even lighting, photorealistic fabric texture. No people, no faces, no text, no logos.';

const clip = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, max));
const list = (max: number) =>
  z
    .array(z.unknown())
    .default([])
    .transform((items) =>
      items
        .filter((i): i is string => typeof i === 'string' && i.trim() !== '')
        .map((i) => i.trim().slice(0, 300))
        .slice(0, max),
    );
const text = clip(300);

/** Lenient reading of Gemini's reply; the result is then checked against the strict contract. */
const usableReplySchema = z.object({
  usable: z.literal(true),
  title: clip(60),
  summary: clip(600),
  imagePrompt: clip(1200),
  tailorSpec: z.object({
    garment: text,
    silhouette: text,
    neckline: text,
    sleeves: text,
    length: text,
    closure: text,
    fabric: z.object({ primary: text, alternatives: list(4), lining: text.catch('None') }),
    yardage: z.object({ estimate: text, basis: text }),
    cutting: list(10),
    stitching: list(12),
    finishing: list(8),
    embellishment: list(8),
    tailorNotes: list(8),
  }),
});
const unusableReplySchema = z.object({ usable: z.literal(false), reason: z.string().optional() });

type StoredDesign = DesignDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

function toSummary(doc: StoredDesign & { hasSourceImage?: boolean }): DesignSummary {
  return {
    id: String(doc._id),
    title: doc.title,
    source: doc.source as DesignSource,
    imageStatus: doc.imageStatus as DesignImageStatus,
    hasSourceImage: Boolean(doc.hasSourceImage),
    createdAt: doc.createdAt.toISOString(),
  };
}

function toDesign(doc: StoredDesign & { hasSourceImage?: boolean }): Design {
  return {
    ...toSummary(doc),
    description: doc.description ?? '',
    summary: doc.summary,
    lookId: doc.lookId ? String(doc.lookId) : null,
    tailorSpec: doc.tailorSpec as TailorSpec,
    imageProvider: (doc.imageProvider ?? null) as DesignImageProvider | null,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Whether a stored sketch exists, without reading its bytes. */
const HAS_SOURCE_IMAGE = { hasSourceImage: { $ne: [{ $ifNull: ['$sourceImage', null] }, null] } };

function bufferOf(raw: unknown): Buffer | null {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof mongo.Binary) return Buffer.from(raw.buffer);
  return null;
}

const label = (value: string | undefined) => (value ? value.replace(/_/g, ' ') : undefined);

/** A garment-only description of one piece of a look: category, colours and cut, nothing about the user. */
export function describeSlot(slot: LookSlot): string {
  const spec = slot.lookSpec;
  const details = [
    spec.fabric && `fabric: ${label(spec.fabric)}`,
    spec.fit && `fit: ${label(spec.fit)}`,
    spec.silhouette && `silhouette: ${label(spec.silhouette)}`,
    spec.neckline && `neckline: ${label(spec.neckline)}`,
    spec.sleeve && `sleeves: ${label(spec.sleeve)}`,
    spec.length && `length: ${label(spec.length)}`,
    spec.pattern && `pattern: ${label(spec.pattern)}`,
  ].filter(Boolean);
  const colours = slot.swatches.map((s) => s.name).join(' / ');
  return `${label(slot.slot)}: ${label(spec.category)} in ${colours}${details.length ? ` (${details.join(', ')})` : ''}`;
}

export interface CreateDesignInput {
  source: DesignSource;
  description: string;
  image?: { contentType: string; base64: string };
  lookId?: string;
  slotId?: string;
  notice: string;
}

export class DesignStudioService {
  constructor(
    private readonly models: Models,
    private readonly analysis: DesignAnalysisProvider | null,
    private readonly generators: readonly ImageGenerator[],
    private readonly timeouts: { analysisMs: number; imageMs: number },
    private readonly logger: Logger,
  ) {}

  async overview(userId: Types.ObjectId): Promise<DesignStudioResponse> {
    const docs = await this.models.Design.aggregate<StoredDesign & { hasSourceImage: boolean }>([
      { $match: { userId } },
      { $sort: { createdAt: -1 } },
      { $project: { title: 1, source: 1, imageStatus: 1, createdAt: 1, ...HAS_SOURCE_IMAGE } },
    ]);
    return {
      available: this.analysis !== null,
      imagesAvailable: this.generators.length > 0,
      designs: docs.map(toSummary),
      limit: DESIGN_LIMIT_PER_USER,
    };
  }

  async get(userId: Types.ObjectId, id: string): Promise<Design> {
    const doc = await this.find(userId, id);
    doc.lookId = await this.ensureOutfitForDesign(userId, doc);
    return toDesign(doc);
  }

  /** The generated picture, or the user's own sketch, as stored. */
  async image(
    userId: Types.ObjectId,
    id: string,
    which: 'design' | 'source',
  ): Promise<{ data: Buffer; contentType: string }> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const field = which === 'design' ? 'image' : 'sourceImage';
    const doc = await this.models.Design.findOne({ _id: id, userId }).select(`+${field}`).lean();
    const stored = doc?.[field] as { data?: unknown; contentType?: string } | null | undefined;
    const data = bufferOf(stored?.data);
    if (!data?.length || !stored?.contentType) throw new AppError('NOT_FOUND');
    return { data, contentType: stored.contentType };
  }

  async remove(userId: Types.ObjectId, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const doc = await this.models.Design.findOne({ _id: id, userId }).lean();
    if (!doc) throw new AppError('NOT_FOUND');
    const { deletedCount } = await this.models.Design.deleteOne({ _id: id, userId });
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
    if (doc.lookId) {
      await this.models.Outfit.deleteOne({ _id: doc.lookId, userId, combinationSignature: `design-${id}` });
      await this.models.OutfitImage.deleteOne({ outfitId: doc.lookId, userId });
      const identityKey = createHash('sha256')
        .update(`outfit|look|${String(doc.lookId)}`)
        .digest('hex');
      await this.models.SavedItem.deleteOne({ userId, identityKey });
    }
  }

  async create(userId: Types.ObjectId, input: CreateDesignInput): Promise<Design> {
    if (!this.analysis) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    if ((await this.models.Design.countDocuments({ userId })) >= DESIGN_LIMIT_PER_USER) {
      throw new AppError('CONFLICT', `You have ${DESIGN_LIMIT_PER_USER} designs. Delete one to make a new design.`);
    }

    const image = input.image ? this.decodeImage(input.image.base64) : null;
    const brief = await this.brief(userId, input);
    const reply = await this.callAnalysis(brief, image);
    const parsed = this.parseReply(reply);

    const imagePrompt = `${parsed.imagePrompt} ${PROMPT_GUARD}`;
    const picture = await this.draw(imagePrompt);
    const doc = await this.models.Design.create({
      userId,
      source: input.source,
      description: input.description,
      lookId: input.lookId ? new Types.ObjectId(input.lookId) : null,
      slotId: input.slotId ?? null,
      sourceImage: image ? { data: image.bytes, contentType: image.contentType } : null,
      image: picture ? { data: picture.bytes, contentType: picture.contentType } : null,
      imageStatus: picture ? 'ready' : 'failed',
      imageProvider: picture?.provider ?? null,
      imagePrompt,
      title: parsed.title,
      summary: parsed.summary,
      tailorSpec: parsed.tailorSpec,
      analysisModel: this.analysis.model,
      promptVersion: DESIGN_PROMPT_VERSION,
      noticeVersion: input.notice,
    });
    const stored = { ...(doc.toObject() as StoredDesign), hasSourceImage: image !== null };
    const lookId = await this.ensureOutfitForDesign(
      userId,
      stored,
      picture ? { bytes: picture.bytes, contentType: picture.contentType, provider: picture.provider } : null,
    );
    stored.lookId = lookId;
    return toDesign(stored);
  }

  /** Draws the picture again from the stored prompt (after a failure, or for a new variation). */
  async render(userId: Types.ObjectId, id: string): Promise<Design> {
    if (this.generators.length === 0) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const doc = await this.models.Design.findOne({ _id: id, userId }).select('+imagePrompt').lean();
    if (!doc) throw new AppError('NOT_FOUND');
    const picture = await this.draw(doc.imagePrompt);
    if (!picture) throw new AppError('AI_UNAVAILABLE', PICTURE_FAILED);
    await this.models.Design.updateOne(
      { _id: doc._id, userId },
      {
        $set: {
          image: { data: picture.bytes, contentType: picture.contentType },
          imageStatus: 'ready',
          imageProvider: picture.provider,
        },
      },
    );
    if (doc.lookId) {
      await this.models.OutfitImage.updateOne(
        { outfitId: doc.lookId },
        {
          $set: {
            userId,
            outfitId: doc.lookId,
            data: picture.bytes,
            contentType: picture.contentType,
            bytes: picture.bytes.length,
            provider: picture.provider,
            model: 'pollinations',
            promptVersion: 'outfit-image-v1',
            expiresAt: null,
          },
        },
        { upsert: true },
      );
    }
    return this.get(userId, id);
  }

  /** Ensures an Outfit (and associated OutfitImage / SavedItem) exists for a design so it can be shopped and tried on. */
  async ensureOutfitForDesign(
    userId: Types.ObjectId,
    design: StoredDesign,
    imageOverride?: { bytes: Buffer; contentType: string; provider?: string } | null,
  ): Promise<Types.ObjectId> {
    const spec = design.tailorSpec as TailorSpec | undefined;
    const garmentName = (spec?.garment || design.title || 'outfit').toLowerCase();
    const isOnePiece = /dress|saree|sari|lehenga|anarkali|jumpsuit|gown|maxi|robe|suit|romper/i.test(garmentName);
    const isBottom = /pant|trouser|skirt|jean|palazzo|short|churidar|salwar|dhoti/i.test(garmentName);
    const isLayer = /jacket|blazer|shrug|coat|cardigan|dupatta|cape/i.test(garmentName);

    const primarySlotType = isOnePiece ? 'one_piece' : isBottom ? 'bottom' : isLayer ? 'layer' : 'top';
    const primarySlotId = isOnePiece ? 'one-piece' : isBottom ? 'bottom' : isLayer ? 'layer' : 'top';
    const primaryCategory = isOnePiece
      ? garmentName.includes('saree') || garmentName.includes('sari')
        ? 'saree'
        : garmentName.includes('lehenga')
          ? 'lehenga'
          : 'dress'
      : isBottom
        ? garmentName.includes('jean')
          ? 'jeans'
          : 'trousers'
        : isLayer
          ? 'shirt'
          : garmentName.includes('kurti')
            ? 'kurti'
            : garmentName.includes('kurta')
              ? 'kurta'
              : garmentName.includes('t-shirt') || garmentName.includes('tee')
                ? 't_shirt'
                : 'shirt';

    const textToScan =
      `${design.title} ${spec?.garment || ''} ${spec?.fabric?.primary || ''} ${spec?.embellishment?.join(' ') || ''} ${design.description || ''}`.toLowerCase();
    let colorId: ColorId = 'black';
    let colorFamily: ColorFamily = 'neutral';
    let colorHex = '#1A1A1A';
    let colorName = 'Black';
    let colorQuery = '';

    if (/navy/i.test(textToScan)) {
      colorId = 'navy';
      colorFamily = 'blue';
      colorHex = '#1F2A44';
      colorName = 'Navy';
      colorQuery = 'navy';
    } else if (/blue|ocean|sky/i.test(textToScan)) {
      colorId = 'sky_blue';
      colorFamily = 'blue';
      colorHex = '#87CEEB';
      colorName = 'Sky Blue';
      colorQuery = 'blue';
    } else if (/pink|rose|blush|magenta/i.test(textToScan)) {
      colorId = 'rose_pink';
      colorFamily = 'pink';
      colorHex = '#E75480';
      colorName = 'Rose Pink';
      colorQuery = 'pink';
    } else if (/maroon|wine/i.test(textToScan)) {
      colorId = 'maroon';
      colorFamily = 'red';
      colorHex = '#800020';
      colorName = 'Maroon';
      colorQuery = 'maroon';
    } else if (/red|ruby/i.test(textToScan)) {
      colorId = 'red';
      colorFamily = 'red';
      colorHex = '#C8102E';
      colorName = 'Red';
      colorQuery = 'red';
    } else if (/green|mint|sage|emerald/i.test(textToScan)) {
      colorId = /mint/i.test(textToScan) ? 'mint' : 'emerald';
      colorFamily = 'green';
      colorHex = colorId === 'mint' ? '#A8E6CF' : '#046A38';
      colorName = colorId === 'mint' ? 'Mint' : 'Emerald';
      colorQuery = 'green';
    } else if (/yellow|mustard|gold/i.test(textToScan)) {
      colorId = 'gold';
      colorFamily = 'metallic';
      colorHex = '#C9A227';
      colorName = 'Gold';
      colorQuery = 'gold';
    } else if (/purple|plum|lavender/i.test(textToScan)) {
      colorId = 'plum';
      colorFamily = 'purple';
      colorHex = '#6E2C5E';
      colorName = 'Plum';
      colorQuery = 'plum';
    } else if (/white|ivory|cream/i.test(textToScan)) {
      colorId = 'white';
      colorFamily = 'neutral';
      colorHex = '#FFFFFF';
      colorName = 'White';
      colorQuery = 'white';
    }

    const fabricMatch = (FABRIC_IDS as readonly string[]).find((f) => spec?.fabric?.primary?.toLowerCase().includes(f));
    const silhouetteMatch = (SILHOUETTE_IDS as readonly string[]).find((s) =>
      spec?.silhouette?.toLowerCase().includes(s),
    );
    const necklineMatch = (NECKLINE_IDS as readonly string[]).find((n) => spec?.neckline?.toLowerCase().includes(n));
    const sleeveMatch = (SLEEVE_LENGTH_IDS as readonly string[]).find((s) => spec?.sleeves?.toLowerCase().includes(s));
    const lengthMatch = (GARMENT_LENGTH_IDS as readonly string[]).find((l) => spec?.length?.toLowerCase().includes(l));

    const rawGarment = (spec?.garment || design.title || (isOnePiece ? 'dress' : 'shirt'))
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
    const garmentKeywords = rawGarment
      .split(/\s+/)
      .filter((w) => !['outfit', 'piece', 'set', 'ensemble', 'and', 'with', 'for'].includes(w))
      .slice(-3)
      .join(' ');
    const catTerm = primaryCategory === 't_shirt' ? 't-shirt' : primaryCategory;
    const baseGarment = garmentKeywords.includes(catTerm) ? garmentKeywords : `${garmentKeywords} ${catTerm}`;
    const primarySearchPhrase = [colorQuery, baseGarment].filter(Boolean).join(' ').trim();

    const primarySlot: LookSlot = {
      slotId: primarySlotId,
      slot: primarySlotType as SlotType,
      lookSpec: {
        category: primaryCategory as Category,
        colorFamily,
        colorId,
        ...(fabricMatch ? { fabric: fabricMatch as Fabric } : {}),
        ...(silhouetteMatch
          ? { silhouette: silhouetteMatch as Silhouette }
          : isOnePiece
            ? { silhouette: 'a_line' as const }
            : {}),
        ...(necklineMatch ? { neckline: necklineMatch as Neckline } : {}),
        ...(sleeveMatch ? { sleeve: sleeveMatch as SleeveLength } : {}),
        ...(lengthMatch ? { length: lengthMatch as GarmentLength } : isOnePiece ? { length: 'midi' as const } : {}),
      },
      swatches: [{ colorId, name: colorName, hex: colorHex }],
      searchPhrase: primarySearchPhrase,
      sizeNote: 'Tailored or standard fit',
      alternatives: [],
    };

    const slots: LookSlot[] = [primarySlot];
    if (primarySlotType === 'top') {
      slots.push({
        slotId: 'bottom',
        slot: 'bottom',
        lookSpec: {
          category: 'trousers',
          colorFamily: 'neutral',
          colorId: 'white',
          silhouette: 'straight',
          length: 'ankle',
          fabric: 'cotton',
        },
        swatches: [{ colorId: 'white', name: 'White', hex: '#FFFFFF' }],
        searchPhrase: 'trousers pants',
        sizeNote: 'Standard fit',
        alternatives: [],
      });
    } else if (primarySlotType === 'bottom') {
      slots.unshift({
        slotId: 'top',
        slot: 'top',
        lookSpec: {
          category: 'shirt',
          colorFamily: 'neutral',
          colorId: 'white',
          silhouette: 'straight',
          neckline: 'round',
          sleeve: 'short',
          length: 'waist',
          fabric: 'cotton',
        },
        swatches: [{ colorId: 'white', name: 'White', hex: '#FFFFFF' }],
        searchPhrase: 'cotton shirt top',
        sizeNote: 'Standard fit',
        alternatives: [],
      });
    }

    if (design.lookId) {
      const existing = await this.models.Outfit.findOne({ _id: design.lookId, userId });
      if (existing) {
        const needsRepair =
          existing.templateId === 'tmpl-design-studio' ||
          existing.slots.some(
            (s: { slotId?: string; lookSpec?: { category?: string; colorId?: string }; searchPhrase?: string }) =>
              Boolean(
                s.slotId?.includes('_') ||
                s.lookSpec?.category === 'dresses' ||
                s.lookSpec?.category === 'bottoms' ||
                s.lookSpec?.category === 'tops' ||
                s.lookSpec?.colorId?.includes('-') ||
                (s.searchPhrase && s.searchPhrase.length > 40),
              ),
          );
        if (needsRepair) {
          await this.models.Outfit.updateOne({ _id: existing._id }, { $set: { slots } });
        }
        return existing._id;
      }
    }

    const profile = await this.models.Profile.findOne({ userId }, { department: 1 }).lean();
    const department = profile?.department === 'men' ? 'men' : 'women';

    const outfit = await this.models.Outfit.create({
      userId,
      recommendationId: new Types.ObjectId(),
      status: 'saved',
      templateId: 'tmpl-design-studio',
      paletteId: 'pal-custom',
      slots,
      explanation: design.summary || `Design studio creation: ${design.title}`,
      explanationRefs: { ruleIds: [], attributes: [] },
      combinationSignature: `design-${design._id}`,
      contentVersion: 'v1',
      request: { occasion: 'everyday' },
      inputsUsed: { department },
      defaultsApplied: [],
      conflicts: [],
      warnings: [],
      source: 'discover_my_style',
      expiresAt: null,
    });

    let imgBytes: Buffer | null = imageOverride?.bytes ?? null;
    let imgContentType: string | null = imageOverride?.contentType ?? null;
    let imgProvider: string | null = imageOverride?.provider ?? null;

    if (!imgBytes) {
      const designWithImg = await this.models.Design.findOne({ _id: design._id, userId }).select('+image').lean();
      const storedImg = designWithImg?.image as { data?: unknown; contentType?: string } | null | undefined;
      const data = bufferOf(storedImg?.data);
      if (data?.length && storedImg?.contentType) {
        imgBytes = data;
        imgContentType = storedImg.contentType;
        imgProvider = designWithImg?.imageProvider ?? 'pollinations';
      }
    }

    if (imgBytes && imgContentType) {
      await this.models.OutfitImage.updateOne(
        { outfitId: outfit._id },
        {
          $set: {
            userId,
            outfitId: outfit._id,
            data: imgBytes,
            contentType: imgContentType,
            bytes: imgBytes.length,
            provider: imgProvider || 'pollinations',
            model: 'pollinations',
            promptVersion: 'outfit-image-v1',
            expiresAt: null,
          },
        },
        { upsert: true },
      );
    }

    const identityKey = createHash('sha256')
      .update(`outfit|look|${String(outfit._id)}`)
      .digest('hex');
    await this.models.SavedItem.updateOne(
      { userId, identityKey },
      {
        $setOnInsert: {
          userId,
          identityKey,
          kind: 'look',
          title: design.title,
          source: 'discover_my_style',
          outfitId: outfit._id,
        },
      },
      { upsert: true },
    );

    await this.models.Design.updateOne({ _id: design._id, userId }, { $set: { lookId: outfit._id } });
    design.lookId = outfit._id;
    return outfit._id;
  }

  private async find(userId: Types.ObjectId, id: string): Promise<StoredDesign & { hasSourceImage: boolean }> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const [doc] = await this.models.Design.aggregate<StoredDesign & { hasSourceImage: boolean }>([
      { $match: { _id: new Types.ObjectId(id), userId } },
      { $addFields: HAS_SOURCE_IMAGE },
      { $project: { sourceImage: 0, image: 0, imagePrompt: 0 } },
    ]);
    if (!doc) throw new AppError('NOT_FOUND');
    return doc;
  }

  private decodeImage(base64: string): DesignImageInput {
    const bytes = Buffer.from(base64, 'base64');
    const contentType = detectImageType(bytes);
    if (bytes.length === 0 || bytes.length > DESIGN_IMAGE_MAX_BYTES || !contentType) {
      throw new AppError('INVALID_REQUEST', 'Choose a JPEG, PNG or WebP image under 4 MB.');
    }
    return { bytes, contentType };
  }

  /** The text Gemini works from: the user's words and, for a look, the look's garments. Nothing from the profile. */
  private async brief(userId: Types.ObjectId, input: CreateDesignInput): Promise<string> {
    const idea = input.description || '(no description given)';
    if (input.source !== 'look') {
      const kind =
        input.source === 'description'
          ? 'a description'
          : input.source === 'sketch'
            ? 'a sketch they drew'
            : 'an uploaded sketch or garment picture';
      return `The user started from ${kind}.\nTheir description: ${idea}`;
    }
    const look = await this.models.Outfit.findOne({ _id: input.lookId, userId }, { slots: 1 }).lean<{
      slots: LookSlot[];
    }>();
    if (!look)
      throw new AppError('NOT_FOUND', 'This look is no longer available. Pick another look, or describe your idea.');
    if (input.slotId && !look.slots.some((s) => s.slotId === input.slotId)) throw new AppError('INVALID_REQUEST');
    const pieces = look.slots
      .map((s) => `- ${describeSlot(s)}${s.slotId === input.slotId ? '  ← the piece to change' : ''}`)
      .join('\n');
    const scope = input.slotId
      ? 'Design the marked piece with the change applied; keep the other pieces exactly as they are so it still matches them.'
      : 'Design the whole look with the change applied.';
    return `The user picked this look from their StyleMe recommendations:\n${pieces}\n${scope}\nThe change they want: ${idea}`;
  }

  private async callAnalysis(brief: string, image: DesignImageInput | null): Promise<unknown> {
    const provider = this.analysis!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeouts.analysisMs);
    try {
      return await provider.deconstruct({ brief, image }, controller.signal);
    } catch (err) {
      const cause = err instanceof VisionProviderError ? err.cause : 'provider_error';
      this.logger.warn({ event: 'design_analysis_failed', cause, provider: provider.name, model: provider.model });
      throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', FAILED);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseReply(reply: unknown): z.infer<typeof usableReplySchema> & { tailorSpec: TailorSpec } {
    const unusable = unusableReplySchema.safeParse(reply);
    if (unusable.success) {
      const reason = DESIGN_UNUSABLE_REASONS.find((r) => r === unusable.data.reason) ?? 'unclear';
      throw new AppError('DESIGN_UNUSABLE', DESIGN_UNUSABLE_MESSAGES[reason]);
    }
    const usable = usableReplySchema.safeParse(reply);
    const spec = usable.success ? tailorSpecSchema.safeParse(usable.data.tailorSpec) : null;
    if (!usable.success || !spec?.success) {
      // Only the failure is logged, never the reply (it describes the user's design).
      this.logger.warn({ event: 'design_analysis_failed', cause: 'invalid_output' });
      throw new AppError('AI_UNAVAILABLE', FAILED);
    }
    return { ...usable.data, tailorSpec: spec.data };
  }

  /** Tries each generator in order; null when none could draw a valid image. */
  private async draw(prompt: string): Promise<(DesignImageInput & { provider: DesignImageProvider }) | null> {
    for (const generator of this.generators) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeouts.imageMs);
      try {
        const result = await generator.generate(prompt, controller.signal);
        const contentType = detectImageType(result.bytes);
        if (!contentType || result.bytes.length > DESIGN_IMAGE_MAX_BYTES * 2)
          throw new ImageProviderError('invalid_output');
        return { bytes: result.bytes, contentType, provider: generator.name };
      } catch (err) {
        const cause = err instanceof ImageProviderError ? err.cause : 'provider_error';
        const status = err instanceof ImageProviderError ? err.status : undefined;
        this.logger.warn({
          event: 'design_image_failed',
          provider: generator.name,
          model: generator.model,
          cause,
          status,
        });
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  }
}
