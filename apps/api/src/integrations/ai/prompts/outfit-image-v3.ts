import { createHash } from 'node:crypto';
import type { LookSlot } from '@styleme/contracts';
import { joinList, occasionLabel, styleLabel } from '../../../services/engine/text';

// Outfit image prompt, version 2. Built only from the look itself: each slot's generic search phrase
// (colour, fabric, cut, neckline, sleeve, garment), the occasion, the requested style and the clothing
// department. Version 2 can name each piece's colour from the user's My Colour Palette instead (the palette
// colour closest to the look's colour): colour names only. Never the user's body type, skin tone, undertone,
// height, measurements or photos (AI rule 16: Pollinations is not an approved provider for appearance
// signals). Changing the wording = a new version.

export const OUTFIT_IMAGE_PROMPT_VERSION = 'outfit-image-v2';
export const OUTFIT_IMAGE_SIZE = { width: 768, height: 1024 } as const;

/** Garments only, top to bottom, so the description reads like the outfit. Shoes and accessories are left out. */
const SLOT_ORDER = ['layer', 'one_piece', 'top', 'bottom'];

export interface OutfitImagePromptInput {
  slots: readonly LookSlot[];
  occasion: string;
  style?: string | null;
  /** The look's clothing department (`women`, `men` or `any`), never anything about the user's body. */
  department?: string | null;
  /** Slot ID → the palette colour name to show that piece in, replacing the look's colour word. */
  colours?: ReadonlyMap<string, string>;
}

/** The slot's phrase with its leading colour word replaced by `colour`, when the phrase starts with it. */
function inColour(slot: LookSlot, colour: string | undefined): string {
  const current = slot.swatches[0]?.name.toLowerCase();
  if (!colour || !current || !slot.searchPhrase.startsWith(current)) return slot.searchPhrase;
  return `${colour.toLowerCase()}${slot.searchPhrase.slice(current.length)}`;
}

export function buildOutfitImagePrompt({
  slots,
  occasion,
  style,
  department,
  colours,
}: OutfitImagePromptInput): string {
  const figure = department === 'women' ? 'a woman' : department === 'men' ? 'a man' : 'a fashion model';
  const pieces = slots
    .filter((s) => SLOT_ORDER.includes(s.slot))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
    .map((s) => inColour(s, colours?.get(s.slotId)));
  const kind = [occasionLabel(occasion).toLowerCase(), style ? styleLabel(style).toLowerCase() : null]
    .filter(Boolean)
    .join(' ');
  return [
    `Full-length fashion lookbook photograph of ${figure} wearing a ${kind} outfit: ${joinList(pieces)}.`,
    'Standing upright facing the camera, whole body visible from head to shoes, natural relaxed pose.',
    'Plain light grey studio background, soft even lighting, realistic fabric texture and true colours.',
    'One person only. No text, no logos, no watermark, no brand names.',
  ].join(' ');
}

/** A stable seed per prompt, so the same look always asks for the same picture. */
export function seedFor(prompt: string): number {
  return createHash('sha256').update(prompt).digest().readUInt32BE(0) & 0x7fffffff;
}
