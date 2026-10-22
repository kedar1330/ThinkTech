import {
  DEFAULT_FIGURE_CLOTHING,
  MEASUREMENT_ORDER,
  UNDERTONE_ILLUSTRATION_IDS,
  bodyMeasurement,
  measurementIllustrationId,
  measurementIllustrationPath,
  undertoneIllustrationPath,
  type BodyMeasurementId,
  type ClothingPreference,
} from '@styleme/contracts';
import type { Models } from '../models/index';

// My Profile illustrations (D-129), generated in code (rights source `code_generated`, D-65): a figure in
// a plain white shirt and plain white pants (D-113) with a yellow measuring tape where each measurement is
// taken, and a hand for each undertone. `scripts/profile-illustrations.ts` writes the SVG files to the web
// app's `public/illustrations/profile/` and records them in the `illustrations` collection.

const SKIN = '#c89b7b';
const SKIN_SHADE = '#b08466';
const HAIR = '#3b2a22';
const CLOTH = '#ffffff';
const CLOTH_LINE = '#c9d3d6';
const TAPE = '#f2c230';
const TAPE_EDGE = '#b8891b';

interface Figure {
  shoulderHalf: number;
  waistHalf: number;
  hipHalf: number;
}

const FIGURES: Record<ClothingPreference, Figure> = {
  women: { shoulderHalf: 36, waistHalf: 24, hipHalf: 31 },
  men: { shoulderHalf: 42, waistHalf: 29, hipHalf: 30 },
};

function figure(department: ClothingPreference): string {
  const f = FIGURES[department];
  const cx = 100;
  const sl = cx - f.shoulderHalf;
  const sr = cx + f.shoulderHalf;
  // Long hair sits behind the head; both figures get a fringe over the top of the head.
  const hairBack =
    department === 'women'
      ? `<path d="M80 40 Q78 14 100 13 Q122 14 120 40 L124 76 Q110 72 108 58 L92 58 Q90 72 76 76 Z" fill="${HAIR}"/>`
      : '';
  const fringe = `<path d="M83 33 Q83 15 100 15 Q117 15 117 33 Q110 23 100 23 Q90 23 83 33 Z" fill="${HAIR}"/>`;
  return [
    // Arms (skin), behind the shirt.
    `<path d="M${sl + 4} 74 L${sl - 10} 120 L${sl - 14} 168 L${sl - 6} 170 L${sl + 2} 122 L${sl + 12} 92 Z" fill="${SKIN}"/>`,
    `<path d="M${sr - 4} 74 L${sr + 10} 120 L${sr + 14} 168 L${sr + 6} 170 L${sr - 2} 122 L${sr - 12} 92 Z" fill="${SKIN}"/>`,
    `<ellipse cx="${sl - 10}" cy="174" rx="6" ry="8" fill="${SKIN}"/>`,
    `<ellipse cx="${sr + 10}" cy="174" rx="6" ry="8" fill="${SKIN}"/>`,
    // Hair, neck and head.
    hairBack,
    `<rect x="93" y="50" width="14" height="20" rx="4" fill="${SKIN_SHADE}"/>`,
    `<ellipse cx="100" cy="36" rx="17" ry="20" fill="${SKIN}"/>`,
    fringe,
    // Pants.
    `<path d="M${cx - f.waistHalf - 2} 146 L${cx + f.waistHalf + 2} 146 L${cx + f.hipHalf} 172 L${cx + 24} 280 L${cx + 4} 280 L${cx} 190 L${cx - 4} 280 L${cx - 24} 280 L${cx - f.hipHalf} 172 Z" fill="${CLOTH}" stroke="${CLOTH_LINE}" stroke-width="1.5" stroke-linejoin="round"/>`,
    `<line x1="${cx}" y1="150" x2="${cx}" y2="188" stroke="${CLOTH_LINE}" stroke-width="1"/>`,
    // Feet.
    `<ellipse cx="${cx - 14}" cy="284" rx="11" ry="4" fill="${SKIN_SHADE}"/>`,
    `<ellipse cx="${cx + 14}" cy="284" rx="11" ry="4" fill="${SKIN_SHADE}"/>`,
    // Short-sleeved shirt.
    `<path d="M92 64 Q100 72 108 64 L${sr} 72 L${sr + 14} 106 L${sr - 4} 112 L${sr - 8} 98 L${cx + f.waistHalf} 128 L${cx + f.waistHalf + 4} 152 L${cx - f.waistHalf - 4} 152 L${cx - f.waistHalf} 128 L${sl + 8} 98 L${sl + 4} 112 L${sl - 14} 106 L${sl} 72 Z" fill="${CLOTH}" stroke="${CLOTH_LINE}" stroke-width="1.5" stroke-linejoin="round"/>`,
  ].join('');
}

/** A horizontal band of tape around the body at `y`, `half` wide each side of `cx`. */
function band(cx: number, y: number, half: number): string {
  return [
    `<path d="M${cx - half} ${y} Q${cx} ${y + 7} ${cx + half} ${y}" fill="none" stroke="${TAPE}" stroke-width="5" stroke-linecap="round"/>`,
    `<path d="M${cx - half} ${y} Q${cx} ${y + 7} ${cx + half} ${y}" fill="none" stroke="${TAPE_EDGE}" stroke-width="1" stroke-dasharray="1 4"/>`,
  ].join('');
}

/** A straight length of tape between two points. */
function length(x1: number, y1: number, x2: number, y2: number): string {
  return [
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TAPE}" stroke-width="5" stroke-linecap="round"/>`,
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TAPE_EDGE}" stroke-width="1" stroke-dasharray="1 4"/>`,
    `<circle cx="${x1}" cy="${y1}" r="3" fill="${TAPE_EDGE}"/>`,
    `<circle cx="${x2}" cy="${y2}" r="3" fill="${TAPE_EDGE}"/>`,
  ].join('');
}

/** A loop of tape around a limb or joint. */
function loop(cx: number, cy: number, rx: number, ry: number): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${TAPE}" stroke-width="4"/>`;
}

function tape(department: ClothingPreference, id: BodyMeasurementId): string {
  const f = FIGURES[department];
  const sl = 100 - f.shoulderHalf;
  const sr = 100 + f.shoulderHalf;
  const bodyHalf = department === 'women' ? 30 : 36;
  switch (id) {
    case 'shoulder':
      return band(100, 76, f.shoulderHalf + 4);
    case 'bust':
    case 'chest':
      return band(100, 94, bodyHalf + 2);
    case 'underbust':
      return band(100, 106, bodyHalf - 2);
    case 'waist':
      return band(100, 128, f.waistHalf + 2);
    case 'highHip':
      return band(100, 152, f.waistHalf + 6);
    case 'hip':
      return band(100, 172, f.hipHalf + 3);
    case 'neck':
      return band(100, 62, 10);
    case 'armhole':
      return loop(sl + 6, 86, 8, 15);
    case 'upperArm':
      return loop(sl - 6, 116, 9, 4);
    case 'wrist':
      return loop(sl - 12, 164, 7, 3);
    case 'thigh':
      return loop(86, 200, 15, 4);
    case 'knee':
      return loop(84, 232, 13, 4);
    case 'calf':
      return loop(83, 254, 12, 4);
    case 'shoulderToWaist':
      return length(90, 68, 90, 128);
    case 'backWidth':
      return length(sl + 10, 88, sr - 10, 88);
    case 'sleeveLength':
      return length(sl, 74, sl - 12, 166);
    case 'waistToHip':
      return length(100 + f.hipHalf + 8, 128, 100 + f.hipHalf + 8, 172);
    case 'inseam':
      return length(97, 192, 90, 278);
    case 'outseam':
      return length(100 - f.waistHalf - 6, 148, 100 - 30, 278);
    case 'riseFront':
      return length(96, 148, 96, 190);
    case 'riseBack':
      return length(104, 148, 104, 190);
    case 'dressLength':
      return length(112, 66, 112, 236);
    case 'jacketLength':
      return length(112, 66, 112, 186);
    case 'shirtLength':
      return length(112, 66, 112, 162);
  }
}

function svg(title: string, body: string, viewBox = '0 0 200 300'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
}

export function measurementSvg(department: ClothingPreference, id: BodyMeasurementId): string {
  const label = bodyMeasurement(id).label;
  const who = department === 'women' ? 'Women’s Wear' : 'Men’s Wear';
  return svg(`How to measure: ${label} (${who})`, figure(department) + tape(department, id));
}

const UNDERTONE_HANDS = {
  warm: { skin: '#e2b27c', vein: '#5f8a4a', label: 'Warm (golden): veins look greenish' },
  cool: { skin: '#eab8ae', vein: '#5a5fae', label: 'Cool (pinkish): veins look blue or purple' },
  neutral: { skin: '#d9b99b', vein: '#6f7c8f', label: 'Neutral: veins look blue-green' },
  olive: { skin: '#b9a477', vein: '#5d6b4a', label: 'Olive: a muted greenish cast' },
} as const;

export function undertoneSvg(undertone: keyof typeof UNDERTONE_HANDS): string {
  const { skin, vein, label } = UNDERTONE_HANDS[undertone];
  const fingers = [
    [52, 40, 46],
    [70, 26, 56],
    [88, 22, 60],
    [106, 30, 54],
  ]
    .map(([x, y, h]) => `<rect x="${x}" y="${y}" width="16" height="${h}" rx="8" fill="${skin}"/>`)
    .join('');
  return svg(
    `Undertone guide — ${label}`,
    [
      `<rect x="62" y="150" width="56" height="50" rx="10" fill="${skin}"/>`,
      fingers,
      `<path d="M50 70 Q48 120 62 150 L118 150 Q130 120 122 70 Z" fill="${skin}"/>`,
      `<path d="M120 112 Q134 92 146 84 Q154 82 152 92 Q142 108 128 128 Z" fill="${skin}"/>`,
      `<path d="M78 196 Q82 160 86 130 M92 198 Q94 160 96 128 M104 196 Q106 168 110 140" fill="none" stroke="${vein}" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>`,
    ].join(''),
    '0 0 200 210',
  );
}

export interface ProfileIllustrationRecord {
  assetId: string;
  kind: 'measurement_guide' | 'undertone_guide';
  title: string;
  altText: string;
  path: string;
  departments: ClothingPreference[];
  svg: string;
}

/** Every My Profile illustration with its SVG and the `illustrations` record fields. */
export function profileIllustrations(): ProfileIllustrationRecord[] {
  const records: ProfileIllustrationRecord[] = [];
  for (const department of ['women', 'men'] as const) {
    for (const id of [...MEASUREMENT_ORDER[department].body_type, ...MEASUREMENT_ORDER[department].fit]) {
      const m = bodyMeasurement(id);
      records.push({
        assetId: measurementIllustrationId(department, id),
        kind: 'measurement_guide',
        title: `${m.label} — ${department === 'women' ? 'Women’s Wear' : 'Men’s Wear'}`,
        altText: `Figure in a plain white shirt and white pants with a measuring tape showing the ${m.label.toLowerCase()}. ${m.howTo}`,
        path: measurementIllustrationPath(department, id),
        departments: [department],
        svg: measurementSvg(department, id),
      });
    }
  }
  for (const [undertone, assetId] of Object.entries(UNDERTONE_ILLUSTRATION_IDS) as [
    keyof typeof UNDERTONE_HANDS,
    string,
  ][]) {
    records.push({
      assetId,
      kind: 'undertone_guide',
      title: `Undertone — ${undertone}`,
      altText: `Hand illustration. ${UNDERTONE_HANDS[undertone].label}.`,
      path: undertoneIllustrationPath(undertone),
      departments: ['women', 'men'],
      svg: undertoneSvg(undertone),
    });
  }
  return records;
}

/**
 * Upserts every My Profile illustration into `illustrations` (matched by `assetId`; safe to re-run).
 * Code-generated assets (D-65) whose rights are StyleMe's own; published so features can look them up.
 */
export async function seedProfileIllustrations(models: Models): Promise<{ upserted: number }> {
  const now = new Date();
  const records = profileIllustrations();
  for (const r of records) {
    const [width, height] = r.kind === 'measurement_guide' ? [200, 300] : [200, 210];
    await models.Illustration.updateOne(
      { assetId: r.assetId },
      {
        $set: {
          kind: r.kind,
          title: r.title,
          altText: r.altText,
          views: [{ view: 'front', storage: 'static', path: r.path, format: 'svg', width, height }],
          depicts: { departments: r.departments, clothingStyleIds: [], bodyShape: null, skinToneRange: null },
          figureClothing: r.kind === 'measurement_guide' ? DEFAULT_FIGURE_CLOTHING : null,
          rights: {
            source: 'code_generated',
            creator: 'StyleMe',
            licence: 'StyleMe proprietary',
            allowedUsage: ['my_profile'],
            verifiedAt: now,
          },
          status: 'published',
          review: { status: 'approved', approvedBy: null, approvedAt: now },
          publishedAt: now,
        },
      },
      { upsert: true, runValidators: true },
    );
  }
  return { upserted: records.length };
}
