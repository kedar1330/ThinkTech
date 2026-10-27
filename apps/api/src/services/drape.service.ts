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
export const DRAPE_PROMPT_VERSION = 'model-drape-v5';
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
  tops: 'the top garment only (shirt, blouse or top, waist-length, not a kurta); keep the trousers or skirt as they are',
  bottoms: 'the trousers, jeans or skirt only; keep the top as it is',
  'one-pieces': 'the whole outfit (top and bottom) with this one-piece garment',
};

/** The edit instruction for one garment; it describes only the model and the garment. */
export function drapePrompt(garment: Pick<StoredGarment, 'category' | 'title'>): string {
  const isSaree = /\bsaree\b/i.test(garment.title);
  const isVoluminous =
    /\b(gown|ballgown|ball gown|tiered|ruffle|ruffles|ruffled|princess|barbie|anarkali|lehenga|flared)\b/i.test(
      garment.title,
    );

  const parts = [
    'Dress the person in the first image in the garment shown in the second image (a store product photo).',
    `Replace ${PART[garment.category]}.`,
  ];

  if (isVoluminous) {
    parts.push(
      'Crucial silhouette requirement: Faithfully preserve the garment’s exact structural silhouette, cut, volume, flare, tiers, and ruffles as seen in the product photo.',
      'If the garment has a ballgown, flared A-line, princess, or tiered ruffled skirt, maintain its full wide voluminous flare and cascading ruffled tiers intact; NEVER flatten or turn it into a tight, bodycon, sheath, or pencil dress.',
    );
  } else {
    parts.push(
      'Precisely copy the garment’s exact style, structural silhouette, neckline, collar, buttons, sleeve length, hemline, colour and print, draping naturally on the body without altering the intended cut or volume.',
    );
  }

  if (isSaree) {
    parts.push(
      'Ethnic wear & saree requirement: The saree must be traditionally draped with crisp vertical front pleats at the waist and the pallu draped across the torso over the left shoulder, worn over a matching, fully opaque tailored saree blouse (choli) that neatly covers the chest and shoulders.',
      'The blouse must NEVER be omitted, missing, or strapless.',
    );
  }

  parts.push(
    'Ensure complete modesty and full garment coverage: The person must be fully and decently clothed. Strictly no bare torso, no exposed chest, no sheer transparency disclosing skin or undergarments, no nudity, and no inappropriate body disclosure.',
    'Do not add any embroidery, golden work, or ethnic patterns unless clearly visible in the product photo.',
    'Keep the face, hair, skin, pose, shoes, framing, lighting and the dark studio backdrop exactly the same. Photorealistic. No text, no logos.',
  );

  return parts.join(' ');
}

/** How to turn and position the dressed model for each view; the outfit must not change. */
export const VIEW_TURNS: Record<DrapeView, string> = {
  front:
    'standing in a direct front-facing pose, facing straight forward directly into the camera, square shoulders facing front, frontal camera view, face and chest directly facing the viewer, perfectly centered full body front portrait',
  three_quarter:
    'standing at a graceful three-quarter perspective angle (turned 45 degrees to her or his left), showing both the front and side of the model and outfit',
  side: 'standing in a true 90-degree profile side view (turned completely sideways to her or his left), showing the right side in profile from head to feet',
  back: 'turned completely around with back directly facing the camera, rear view seen from straight behind, showing the full rear of the model and outfit',
};

export function viewPrompt(view: Exclude<DrapeView, 'front'>): string {
  const parts = [
    `Show the same person, wearing exactly the same outfit, ${VIEW_TURNS[view]}.`,
    'Same face, hair, skin, outfit colours, print, embroidery and length, same shoes, same dark studio backdrop, framing and lighting.',
  ];

  if (view === 'back') {
    parts.push(
      'Ensure complete modesty and full bodily coverage from behind: The outfit remains completely intact with all required components. For sarees and ethnic wear, the tailored blouse (choli) covers the upper and mid back completely; strictly no bare back, no backless cut, and no blouseless drape. The decorative saree pallu flows gracefully over the left shoulder down the back.',
    );
  } else {
    parts.push(
      'Ensure complete modesty and full bodily coverage from this angle: The outfit remains completely intact with all required components. For sarees and ethnic wear, the tailored blouse (choli) covers the chest, shoulders, and torso completely; strictly no bare torso, no exposed chest, no exposed back, and no blouseless drape.',
    );
  }

  parts.push(
    'Faithfully maintain the garment’s exact silhouette, cut, volume, flare, tiers, and ruffles from this angle; do NOT flatten, narrow, or alter into a tight bodycon shape.',
    'Strict modesty: fully clothed, fully opaque fabric, no sheer transparency disclosing skin, no nudity, family-safe and retail-ready.',
    'Full body from head to feet, photorealistic high fashion studio portrait. No text, no logos.',
  );

  return parts.join(' ');
}

function formatGarmentDesc(
  garment: Pick<StoredGarment, 'category' | 'title'>,
  view: DrapeView = 'front',
  extraSlotDetails?: string,
): string {
  const title = garment.title.trim();
  const context = `${title} ${extraSlotDetails ?? ''}`.toLowerCase();

  const isSaree = /\bsaree\b/i.test(context);
  const isVoluminousGown =
    /\b(gown|ballgown|ball gown|tiered|ruffle|ruffles|ruffled|princess|barbie)\b/i.test(context) ||
    (garment.category === 'one-pieces' && /\b(dress|gown|flared)\b/i.test(context));
  const isAnarkali = /\banarkali\b/i.test(context);
  const isLehenga = /\blehenga\b/i.test(context);

  if (isSaree) {
    if (view === 'front') {
      return `${title} (an authentic, traditionally draped Indian saree in fine fabric with neat borders, worn with a matching fitted tailored saree blouse/choli featuring a modest round neckline and short sleeves covering chest and shoulders; the saree features crisp vertical accordion pleats neatly tucked at the center front waist falling straight to the floor, and a decorative pallu draped diagonally across the torso from right waist up over the left shoulder; modest and dignified, fully opaque, no bare midriff, no exposed cleavage)`;
    }
    if (view === 'three_quarter') {
      return `${title} (an authentic Indian saree seen from a three-quarter angle, showing the fitted tailored blouse with sleeves, the diagonal pallu pinned at the left shoulder, and the graceful pleated drape of the saree skirt; fully opaque, modest, fully covered)`;
    }
    if (view === 'side') {
      return `${title} (an authentic Indian saree seen in profile side view, showing the sleek profile of the pleated saree skirt and the tailored blouse covering the upper torso; fully covered, elegant silhouette)`;
    }
    if (view === 'back') {
      return `${title} (an authentic Indian saree seen from the back, worn with a matching tailored saree blouse that fully covers the back and shoulders completely with modest coverage; strictly no bare back, no backless cut, no blouseless drape; the decorative saree pallu flows gracefully over the left shoulder down the back)`;
    }
  }

  if (isVoluminousGown) {
    if (view === 'front') {
      return `${title} (voluminous flared ballgown featuring its authentic structural silhouette with an expansive wide bell-shaped skirt flare, cascading multi-layered ruffled tiers, and puffed skirt with dramatic full volume extending outward from the waist; strictly NOT bodycon, NOT a tight pencil or sheath dress, but a wide voluminous flared tiered ballgown)`;
    }
    return `${title} (voluminous flared ballgown seen from this angle, maintaining its wide bell-shaped flare, puffed skirt fullness, and cascading ruffled tiers intact; strictly NOT bodycon, NOT pencil)`;
  }

  if (isAnarkali) {
    return `${title} (flared kalidar anarkali suit with voluminous kalidar umbrella flare, wide flared skirt, and modest neckline with sleeves)`;
  }

  if (isLehenga) {
    if (view === 'back') {
      return `${title} (traditional Indian lehenga seen from behind with wide voluminous flared skirt and matching tailored blouse fully covering the back and shoulders; strictly no bare back)`;
    }
    return `${title} (traditional Indian lehenga with a wide voluminous flared lehenga skirt and matching tailored choli blouse covering chest and shoulders; modest and fully covered)`;
  }

  if (/\b(kurti|kurta)\b/i.test(context)) {
    return `${title} (tailored modest ethnic tunic with sleeves and modest neckline)`;
  }

  return `${title} (fitted naturally and comfortably to the body according to its cut, maintaining true garment shape and fullness)`;
}

export function dressedAvatarPrompt(
  department: AvatarDepartment,
  garments: readonly Pick<StoredGarment, 'category' | 'title'>[],
  view: DrapeView = 'front',
  modelDescription?: string,
  extraSlotDetails?: readonly string[],
): string {
  const garmentsDesc =
    garments.length > 0
      ? garments.map((g, i) => formatGarmentDesc(g, view, extraSlotDetails?.[i])).join(', ')
      : 'a stylish Indian outfit';
  const person = modelDescription ?? (department === 'women' ? 'a young Indian woman' : 'a young Indian man');
  const turn = VIEW_TURNS[view];

  let modestyInstruction: string;
  if (view === 'front') {
    modestyInstruction =
      'Ensure complete modesty and full bodily coverage: The model is fully, decently, and modestly clothed in completely opaque fabric. Strictly no bare torso, no exposed chest, no sheer transparency disclosing undergarments or skin, no nudity, and no inappropriate body disclosure. Family-safe and retail-ready.';
  } else if (view === 'back') {
    modestyInstruction =
      'Ensure complete modesty and full bodily coverage from behind: The model is fully clothed in completely opaque fabric, the blouse and garment completely cover the back and shoulders, strictly no bare back, no backless cut, no sheer transparency, no nudity, family-safe and retail-ready.';
  } else {
    modestyInstruction =
      'Ensure complete modesty and full bodily coverage from this angle: The model is fully, decently, and modestly clothed in completely opaque fabric. Strictly no bare torso, no exposed chest, no exposed back, no blouseless drape, no sheer transparency disclosing undergarments or skin, no nudity, and no inappropriate body disclosure. Family-safe and retail-ready.';
  }

  return [
    `Photorealistic full body studio portrait of ${person} ${turn},`,
    `wearing and dressed in ${garmentsDesc}.`,
    modestyInstruction,
    'Dark purple-grey studio backdrop with a soft floor shadow, soft studio lighting, whole body visible from head to feet, high fashion studio portrait, no text, no logos.',
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
    return this.editor !== null || this.generators.length > 0;
  }

  /** The undressed model: if the user uploaded their own try-on photo in profile, uses it; otherwise uses the shared department avatar. */
  async avatar(department: AvatarDepartment, userId?: Types.ObjectId): Promise<{ data: Buffer; contentType: string }> {
    if (userId) {
      const userPhoto = await this.models.UserPhoto.findOne({ userId, kind: 'body' })
        .sort({ uploadedAt: -1 })
        .select('+data')
        .lean();
      const photoBytes = bufferOf(userPhoto?.data);
      if (userPhoto && photoBytes?.length && userPhoto.contentType) {
        return { data: photoBytes, contentType: userPhoto.contentType };
      }
    }

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
    if (!editor && this.generators.length === 0) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    const outfitId = new Types.ObjectId(request.outfitId);
    const garments = await this.tryOn.garmentsFor(userId, outfitId, {
      outfitId: request.outfitId,
      items: request.items,
      notice: TRY_ON_NOTICE_VERSION,
    });
    const avatar = await this.avatar(request.department, userId);
    const cacheKey = createHash('sha256')
      .update(
        [
          request.department,
          createHash('sha256').update(avatar.data).digest('hex'),
          editor ? editor.models.join(',') : 'generator',
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

    let picture: { bytes: Buffer; contentType: string; model: string } | null = null;
    let providerName = editor?.name ?? this.generators[0]?.name ?? 'cloudflare';

    // 1. Try image editing if editor is configured
    if (editor) {
      try {
        let current = dataUri(avatar.data, avatar.contentType);
        for (const garment of garments) {
          let garmentUrl = garment.imageUrl;
          if (garmentUrl.startsWith('/api/')) {
            const outfitImageDoc = await this.models.OutfitImage.findOne({ userId, outfitId })
              .select('+image')
              .lean<{ image?: { data?: unknown; contentType?: string } }>();
            const imgData = bufferOf(outfitImageDoc?.image?.data);
            if (imgData?.length && outfitImageDoc?.image?.contentType) {
              garmentUrl = dataUri(imgData, outfitImageDoc.image.contentType);
            }
          }
          if (!garmentUrl || garmentUrl.startsWith('/api/')) continue;
          const edited = await this.within(this.timeouts.editMs, (signal) =>
            editor.edit({ prompt: drapePrompt(garment), images: [current, garmentUrl] }, signal),
          );
          const contentType = detectImageType(edited.bytes);
          if (!contentType || edited.bytes.length > IMAGE_MAX_BYTES) throw new ImageProviderError('invalid_output');
          picture = { bytes: edited.bytes, contentType, model: edited.model };
          current = dataUri(edited.bytes, contentType);
        }
      } catch (err) {
        this.warn('drape', editor.name, err);
        const cause = err instanceof ImageProviderError ? err.cause : 'provider_error';
        if (cause !== 'rate_limited' || this.generators.length === 0) {
          throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', FAILED);
        }
      }
    }

    if (!picture && this.generators.length > 0) {
      // 2. Generator fallback (e.g. Cloudflare Flux): generate dressed model preserving uploaded profile model
      const modelDesc = await this.describeModel(userId, request.department);
      const slotDetails = await this.getSlotDetails(userId, outfitId, garments);
      const prompt = dressedAvatarPrompt(request.department, garments, 'front', modelDesc, slotDetails);
      for (const generator of this.generators) {
        try {
          const gen = await this.within(this.timeouts.imageMs, (signal) => generator.generate(prompt, signal));
          const contentType = detectImageType(gen.bytes);
          if (contentType && gen.bytes.length <= IMAGE_MAX_BYTES) {
            picture = { bytes: gen.bytes, contentType, model: generator.model };
            providerName = generator.name;
            break;
          }
        } catch (err) {
          this.warn('drape', generator.name, err);
        }
      }
    }

    if (!picture) {
      throw new AppError('AI_UNAVAILABLE', FAILED);
    }

    const now = this.now();
    const doc = await this.models.TryOnDrape.create({
      userId,
      outfitId,
      department: request.department,
      cacheKey,
      garments,
      image: { data: picture.bytes, contentType: picture.contentType },
      provider: providerName,
      model: picture.model,
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
    if (!editor && this.generators.length === 0) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND');
    const doc = await this.models.TryOnDrape.findOne({ _id: id, userId })
      .select('+image')
      .lean<StoredDrape & { image?: { data?: unknown; contentType?: string } }>();
    const front = bufferOf(doc?.image?.data);
    if (!doc || !front?.length || !doc.image?.contentType) throw new AppError('NOT_FOUND');
    if (doc.viewsReady?.includes(view)) return toDrape(doc);

    let picture: { bytes: Buffer; contentType: string } | null = null;
    if (editor) {
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
        if (cause !== 'rate_limited' || this.generators.length === 0) {
          throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', VIEW_FAILED);
        }
      }
    }
    if (!picture && this.generators.length > 0) {
      const garments = (doc.garments as StoredGarment[]) ?? [];
      const modelDesc = await this.describeModel(userId, doc.department as AvatarDepartment);
      const slotDetails = await this.getSlotDetails(userId, doc.outfitId, garments);
      const prompt = dressedAvatarPrompt(doc.department as AvatarDepartment, garments, view, modelDesc, slotDetails);
      for (const generator of this.generators) {
        try {
          const gen = await this.within(this.timeouts.imageMs, (signal) => generator.generate(prompt, signal));
          const contentType = detectImageType(gen.bytes);
          if (contentType && gen.bytes.length <= IMAGE_MAX_BYTES) {
            picture = { bytes: gen.bytes, contentType };
            break;
          }
        } catch (err) {
          this.warn('view', generator.name, err);
        }
      }
    }

    if (!picture) {
      throw new AppError('AI_UNAVAILABLE', VIEW_FAILED);
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

  private async getSlotDetails(
    userId: Types.ObjectId,
    outfitId: Types.ObjectId,
    garments: readonly StoredGarment[],
  ): Promise<string[]> {
    try {
      const look = await this.models.Outfit.findOne({ _id: outfitId, userId }, { slots: 1, request: 1 }).lean<{
        slots?: Array<{ slotId: string; searchPhrase?: string; lookSpec?: Record<string, unknown> }>;
        request?: { design?: { garmentType?: string } };
      }>();
      if (!look?.slots?.length) return garments.map(() => '');

      let designFeatures = '';
      if (look.request?.design?.garmentType) {
        const selection = await this.models.UserDesignSelection.findOne({
          userId,
          garmentType: look.request.design.garmentType,
        }).lean<{ selectedFeatures?: Record<string, string> }>();
        if (selection?.selectedFeatures) {
          designFeatures = Object.values(selection.selectedFeatures).join(' ');
        }
      }

      const norm = (id: string) => id.replace(/[-_]/g, '').toLowerCase();
      return garments.map((g) => {
        const slot = look.slots?.find((s) => s.slotId === g.slotId || norm(s.slotId) === norm(g.slotId));
        const searchPhrase = slot?.searchPhrase ?? '';
        const silhouette = (slot?.lookSpec?.silhouette as string) ?? '';
        const pattern = (slot?.lookSpec?.pattern as string) ?? '';
        const category = (slot?.lookSpec?.category as string) ?? '';
        return [searchPhrase, silhouette, pattern, category, designFeatures].filter(Boolean).join(' ');
      });
    } catch {
      return garments.map(() => '');
    }
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

  private async describeModel(userId: Types.ObjectId, department: AvatarDepartment): Promise<string> {
    const userPhoto = await this.models.UserPhoto.findOne({ userId, kind: 'body' }).sort({ uploadedAt: -1 }).lean();
    if (userPhoto) {
      const appearance = await this.models.AppearanceProfile.findOne({ userId }).lean();
      const undertone = appearance?.undertone?.value ?? 'warm';
      if (department === 'women') {
        return `a slender young East Asian woman with long straight dark hair, warm gentle smile, ${undertone} skin tone`;
      }
      return `a stylish young East Asian man with short dark hair, gentle smile, ${undertone} skin tone`;
    }
    return department === 'women' ? 'a young Indian woman' : 'a young Indian man';
  }
}
