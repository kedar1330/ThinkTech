import type { ClothingPreference } from '@styleme/contracts';
import { DESIGN_FEATURES, type DesignFeatureSeed, isBackDesign } from './catalogue';

// Design-feature illustrations (D-132), generated in code (rights source `code_generated`, D-65). Every image
// shares one 200 × 240 canvas per Clothing Preference: a faceless dress form (the base figure), a bodice with
// one neckline, and one pair of sleeves. Cards combine the three with the feature in gold; the transparent
// layers let the visual customizer stack any neckline with any sleeve. `scripts/design-catalogue.ts` writes
// the files to the web app's `public/illustrations/design/` and records them in `illustrations`.

type Pt = readonly [number, number];

const SKIN = '#efdcc9';
const _SKIN_LINE = '#cfae92';
const CLOTH = '#fbf6ec';
const LINE = '#8a6a42';
const GOLD = '#e2c07a';
const GOLD_LINE = '#9c7631';
const SHIRT = '#ffffff';

interface Figure {
  shoulder: Pt;
  underarm: Pt;
  bust: Pt;
  waist: Pt;
  hip: Pt;
  bottom: Pt;
  armTop: Pt;
  elbow: Pt;
  wrist: Pt;
  neckHalf: number;
  armHalf: number;
}

const FIGURES: Record<ClothingPreference, Figure> = {
  women: {
    shoulder: [64, 72],
    underarm: [69, 99],
    bust: [66, 114],
    waist: [75, 152],
    hip: [68, 198],
    bottom: [70, 240],
    armTop: [58, 84],
    elbow: [53, 142],
    wrist: [49, 198],
    neckHalf: 7,
    armHalf: 5.5,
  },
  men: {
    shoulder: [57, 73],
    underarm: [64, 99],
    bust: [62, 114],
    waist: [67, 152],
    hip: [67, 198],
    bottom: [68, 240],
    armTop: [51, 86],
    elbow: [46, 142],
    wrist: [43, 198],
    neckHalf: 8,
    armHalf: 6.5,
  },
};

const r = (n: number) => Math.round(n * 10) / 10;
const p = ([x, y]: Pt) => `${r(x)} ${r(y)}`;
const mirror = ([x, y]: Pt): Pt => [200 - x, y];
const MIRROR = 'matrix(-1 0 0 1 200 0)';

/** A smooth path through the points (Catmull-Rom as cubic Béziers), continuing from the first point. */
function smooth(points: Pt[]): string {
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${p(c1)}, ${p(c2)}, ${p(p2)}`;
  }
  return d;
}

function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">${body}</svg>`;
}

// --- Base figure ---------------------------------------------------------------------------------------

function arm(f: Figure): string {
  const h = f.armHalf;
  const d =
    `M ${p(f.shoulder)} L ${p([f.armTop[0] - h, f.armTop[1]])}` +
    smooth([
      [f.armTop[0] - h, f.armTop[1]],
      [f.elbow[0] - h, f.elbow[1]],
      [f.wrist[0] - h + 1, f.wrist[1]],
    ]) +
    ` L ${p([f.wrist[0] + h - 1, f.wrist[1]])}` +
    smooth([[f.wrist[0] + h - 1, f.wrist[1]], [f.elbow[0] + h, f.elbow[1]], f.underarm]) +
    ' Z';
  return (
    `<path d="${d}" fill="none" stroke="#c4b5a5" stroke-width="1.2" stroke-dasharray="3.5 3.5"/>` +
    `<ellipse cx="${f.wrist[0]}" cy="${f.wrist[1] + 8}" rx="${h}" ry="9" fill="none" stroke="#c4b5a5" stroke-width="1.2" stroke-dasharray="3.5 3.5"/>`
  );
}

function sideDown(f: Figure): Pt[] {
  return [f.underarm, f.bust, f.waist, f.hip, f.bottom];
}

/** Faceless dress form: head, neck, arms and torso, as an atelier sketch dashed outline (Option A). */
export function baseFigureSvg(department: ClothingPreference): string {
  const f = FIGURES[department];
  const nh = f.neckHalf;
  const left = sideDown(f);
  const right = [...left].reverse().map(mirror);
  const torso =
    `M ${p([100 - nh, 60])} Q ${p([100 - nh - 4, 70])} ${p(f.shoulder)} Q ${p([f.shoulder[0] + 2, 88])} ${p(f.underarm)}` +
    smooth(left) +
    ` L ${p(mirror(f.bottom))}` +
    smooth(right) +
    ` Q ${p(mirror([f.shoulder[0] + 2, 88]))} ${p(mirror(f.shoulder))} Q ${p([100 + nh + 4, 70])} ${p([100 + nh, 60])} Z`;
  return svg(
    [
      arm(f),
      `<g transform="${MIRROR}">${arm(f)}</g>`,
      `<path d="${torso}" fill="none" stroke="#c4b5a5" stroke-width="1.2" stroke-dasharray="3.5 3.5"/>`,
      `<rect x="${100 - nh}" y="38" width="${2 * nh}" height="26" rx="3" fill="none" stroke="#c4b5a5" stroke-width="1.2" stroke-dasharray="3.5 3.5"/>`,
      `<ellipse cx="100" cy="27" rx="14" ry="17" fill="none" stroke="#c4b5a5" stroke-width="1.2" stroke-dasharray="3.5 3.5"/>`,
      `<path d="M ${100 - nh} 63 Q 100 68 ${100 + nh} 63" fill="none" stroke="#c4b5a5" stroke-width="0.8" stroke-dasharray="3.5 3.5"/>`,
    ].join(''),
  );
}

// --- Bodice with a neckline -----------------------------------------------------------------------------

interface NecklineShape {
  /** Where the top edge starts on the left, and the path commands from there to its right end. */
  start: Pt;
  top: string;
  end: Pt;
  /** True when the edge starts and ends at the shoulder points, so the armholes are drawn. */
  shoulders: boolean;
  /** Without shoulders: the way back from the left underarm to `start` (default a straight line). */
  back?: string;
  /** Collars, plackets, lapels … drawn over the bodice. */
  extras?: string;
  /** The edge to outline in gold on the neckline's own card. */
  focus: string;
}

/** A standard neckline between the two neck points, from the shoulder seams. */
function between(f: Figure, nl: Pt, edge: string, extras = ''): NecklineShape {
  const top = ` L ${p(nl)}${edge} L ${p(mirror(f.shoulder))}`;
  return { start: f.shoulder, top, end: mirror(f.shoulder), shoulders: true, extras, focus: `M ${p(nl)}${edge}` };
}

const dot = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.4" fill="${LINE}"/>`;
const shape = (d: string, fill = CLOTH, extra = '') =>
  `<path d="${d}" fill="${fill}" stroke="${LINE}" stroke-width="1.1" stroke-linejoin="round"${extra}/>`;
const line = (d: string, width = 0.9) =>
  `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="${width}" stroke-linecap="round"/>`;
const placket = (from: number, to: number, buttons: number[]) =>
  line(`M 100 ${from} L 100 ${to}`) + buttons.map((y) => dot(102.5, y)).join('');
const flaps = (l: Pt[], fill = CLOTH) =>
  shape(`M ${l.map(p).join(' L ')} Z`, fill) + shape(`M ${l.map(mirror).map(p).join(' L ')} Z`, fill);
const standBand = (top: number) => shape(`M 91 64 L 91 ${top} Q 100 ${top - 2} 109 ${top} L 109 64 Q 100 66 91 64 Z`);

function lapels(kind: 'notched' | 'peak' | 'shawl'): string {
  const inner = shape('M 90 63 L 100 128 L 110 63 Q 100 68 90 63 Z', SHIRT);
  const tie = line('M 100 66 L 100 124', 0.7);
  const left: Record<typeof kind, Pt[]> = {
    notched: [
      [90, 62],
      [84, 74],
      [79, 73],
      [76, 82],
      [99, 130],
      [93, 70],
    ],
    peak: [
      [90, 62],
      [85, 74],
      [72, 70],
      [76, 84],
      [99, 130],
      [93, 70],
    ],
    shawl: [],
  };
  if (kind === 'shawl') {
    const d = 'M 90 62 C 80 74, 78 100, 99 130 L 93 70 Z';
    return inner + tie + shape(d, GOLD) + `<g transform="${MIRROR}">${shape(d, GOLD)}</g>`;
  }
  return inner + tie + flaps(left[kind], GOLD);
}

function necklineShape(slug: string, f: Figure): NecklineShape | null {
  const U = f.underarm;
  const UR = mirror(U);
  switch (slug) {
    case 'crew_neck':
      return between(f, [91, 63], ' Q 100 76 109 63');
    case 'round_neck':
      return between(f, [89, 64], ' C 90 82, 110 82, 111 64');
    case 'scoop_neck':
      return between(f, [84, 66], ' C 86 96, 114 96, 116 66');
    case 'u_neck':
      return between(f, [88, 65], ' C 88 112, 112 112, 112 65');
    case 'v_neck':
      return between(f, [89, 64], ' L 100 94 L 111 64');
    case 'deep_v_neck':
      return between(f, [88, 64], ' L 100 122 L 112 64');
    case 'square_neck':
      return between(f, [84, 66], ' L 84 92 L 116 92 L 116 66');
    case 'sweetheart':
      return between(f, [82, 70], ' C 82 100, 97 102, 100 90 C 103 102, 118 100, 118 70');
    case 'boat_neck':
      return between(f, [74, 70], ' Q 100 80 126 70');
    case 'cowl':
      return between(
        f,
        [84, 65],
        ' C 86 98, 114 98, 116 65',
        line('M 88 76 Q 100 92 112 76') + line('M 86 70 Q 100 84 114 70', 0.7),
      );
    case 'keyhole':
      return between(
        f,
        [91, 63],
        ' Q 100 74 109 63',
        shape('M 100 72 C 94 80, 95 92, 100 94 C 105 92, 106 80, 100 72 Z', SKIN) + dot(100, 69),
      );
    case 'asymmetric':
      return between(f, [88, 64], ' L 110 92 L 118 68');
    case 'queen_anne':
      return between(f, [92, 57], ' L 87 78 C 89 98, 98 100, 100 90 C 102 100, 111 98, 113 78 L 108 57');
    case 'notched':
      return between(f, [89, 64], ' Q 92 76 97 77 L 100 86 L 103 77 Q 108 76 111 64');
    case 'high_neck':
      return between(f, [91, 62], ' L 91 50 Q 100 48 109 50 L 109 62');
    case 'mock_neck':
      return between(f, [91, 62], ' L 91 53 Q 100 51 109 53 L 109 62', line('M 91 62 Q 100 64 109 62'));
    case 'turtleneck':
      return between(
        f,
        [90, 62],
        ' L 90 45 Q 100 43 110 45 L 110 62',
        line('M 90 51 Q 100 53 110 51') + line('M 90 56 Q 100 58 110 56', 0.7),
      );
    case 'collar':
      return between(
        f,
        [91, 63],
        ' Q 100 76 109 63',
        flaps([
          [91, 62],
          [100, 73],
          [86, 80],
          [83, 66],
        ]),
      );
    case 'mandarin_collar':
      return between(
        f,
        [91, 63],
        ' Q 100 70 109 63',
        standBand(55) + line('M 100 55 L 100 66') + placket(66, 86, [72, 80]),
      );
    case 'band_collar':
      return between(f, [91, 63], ' Q 100 70 109 63', standBand(57) + placket(66, 100, [60, 74, 88]));
    case 'henley':
      return between(
        f,
        [91, 63],
        ' Q 100 76 109 63',
        shape('M 97 69 L 97 94 L 103 94 L 103 69', CLOTH) + dot(100, 76) + dot(100, 84),
      );
    case 'polo_collar':
      return between(
        f,
        [91, 63],
        ' Q 100 74 109 63',
        flaps([
          [91, 61],
          [99, 70],
          [86, 80],
          [83, 64],
        ]) +
          shape('M 97 70 L 97 90 L 103 90 L 103 70', CLOTH) +
          dot(100, 77) +
          dot(100, 85),
      );
    case 'spread_collar':
      return between(
        f,
        [91, 63],
        ' Q 100 70 109 63',
        standBand(56) +
          flaps([
            [92, 58],
            [100, 67],
            [80, 74],
            [84, 61],
          ]) +
          placket(67, 230, [80, 104, 128, 152, 176, 200]),
      );
    case 'button_down_collar':
      return between(
        f,
        [91, 63],
        ' Q 100 70 109 63',
        standBand(56) +
          flaps([
            [92, 58],
            [100, 67],
            [90, 84],
            [85, 62],
          ]) +
          dot(90, 81) +
          dot(110, 81) +
          placket(67, 230, [80, 104, 128, 152, 176, 200]),
      );
    case 'cutaway_collar':
      return between(
        f,
        [91, 63],
        ' Q 100 70 109 63',
        standBand(56) +
          flaps([
            [92, 58],
            [100, 66],
            [77, 68],
            [83, 59],
          ]) +
          placket(67, 230, [80, 104, 128, 152, 176, 200]),
      );
    case 'cuban_collar':
      return between(
        f,
        [88, 64],
        ' L 100 98 L 112 64',
        flaps([
          [90, 62],
          [74, 74],
          [86, 88],
          [100, 98],
          [93, 72],
        ]) + placket(98, 230, [110, 140, 170, 200]),
      );
    case 'camp_collar':
      return between(
        f,
        [88, 64],
        ' L 100 96 L 112 64',
        flaps([
          [90, 61],
          [80, 68],
          [76, 78],
          [88, 86],
          [100, 96],
          [93, 71],
        ]) + placket(96, 230, [110, 140, 170, 200]),
      );
    case 'notched_lapel':
    case 'peak_lapel':
    case 'shawl_collar': {
      const kind = slug === 'shawl_collar' ? 'shawl' : slug === 'notched_lapel' ? 'notched' : 'peak';
      return between(f, [90, 63], ' L 100 128 L 110 63', lapels(kind) + dot(97, 150) + dot(97, 172));
    }
    case 'hooded':
      return between(
        f,
        [91, 63],
        ' Q 100 74 109 63',
        shape('M 76 72 Q 76 50 100 52 Q 124 50 124 72 Q 112 62 100 64 Q 88 62 76 72 Z') +
          line('M 95 66 L 94 92') +
          line('M 105 66 L 106 92'),
      );
    case 'angrakha':
      return between(
        f,
        [89, 64],
        ' L 107 100 L 111 64',
        line('M 107 100 C 96 112, 84 118, 70 124', 1.1) + line('M 70 124 l -6 6 M 70 124 l -2 9', 1),
      );
    case 'strapless': {
      const top = ` C 80 92, 92 102, 100 98 C 108 102, 120 92, ${p(UR)}`;
      return { start: U, top, end: UR, shoulders: false, focus: `M ${p(U)}${top}` };
    }
    case 'off_shoulder': {
      const s: Pt = [f.armTop[0] - f.armHalf - 2, 88];
      const top = ` Q 100 98 ${p(mirror(s))} L ${p(mirror([s[0] + 1, 102]))} L ${p(UR)}`;
      return {
        start: s,
        top,
        end: UR,
        shoulders: false,
        back: ` L ${p([s[0] + 1, 102])} L ${p(s)}`,
        focus: `M ${p(s)} Q 100 98 ${p(mirror(s))}`,
      };
    }
    case 'one_shoulder': {
      const top = ` L 92 63 L ${p(UR)}`;
      return {
        start: f.shoulder,
        top,
        end: UR,
        shoulders: false,
        back: ` Q ${p([f.shoulder[0] + 7, 88])} ${p(f.shoulder)}`,
        focus: `M 92 63 L ${p(UR)}`,
      };
    }
    case 'halter': {
      const top = ` C 76 88, 88 70, 93 61 L 107 61 C 112 70, 124 88, ${p(UR)}`;
      return {
        start: U,
        top,
        end: UR,
        shoulders: false,
        extras: shape('M 92 61 L 92 54 Q 100 52 108 54 L 108 61 Z'),
        focus: `M ${p(U)}${top}`,
      };
    }
    default:
      return null;
  }
}

/** The bodice outline for a neckline: top edge, armholes when it has shoulders, side seams and hem. */
function bodicePath(f: Figure, n: NecklineShape): string {
  const left = sideDown(f);
  const UR = mirror(f.underarm);
  const atUnderarm = n.end[0] === UR[0] && n.end[1] === UR[1];
  const rightDown = n.shoulders ? ` Q ${p(mirror([f.shoulder[0] + 7, 88]))} ${p(UR)}` : atUnderarm ? '' : ` L ${p(UR)}`;
  const leftUp = n.shoulders
    ? ` Q ${p([f.shoulder[0] + 7, 88])} ${p(f.shoulder)}`
    : (n.back ?? (n.start[0] === f.underarm[0] && n.start[1] === f.underarm[1] ? '' : ` L ${p(n.start)}`));
  return (
    `M ${p(n.start)}${n.top}${rightDown}${smooth(left.map(mirror))}` +
    ` L ${p(f.bottom)}${smooth([...left].reverse())}${leftUp} Z`
  );
}

function bodice(department: ClothingPreference, slug: string, focus: boolean): string {
  const f = FIGURES[department];
  const n = necklineShape(slug, f) ?? necklineShape(department === 'women' ? 'round_neck' : 'crew_neck', f)!;
  const outline = `<path d="${bodicePath(f, n)}" fill="${CLOTH}" stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const highlight = focus
    ? `<path d="${n.focus}" fill="none" stroke="${GOLD}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>` +
      `<path d="${n.focus}" fill="none" stroke="${GOLD_LINE}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  return outline + (n.extras ?? '') + highlight;
}

// --- Sleeves --------------------------------------------------------------------------------------------

interface SleeveSpec {
  /** Where the hem sits along the arm, from the shoulder (0) to the wrist (1). */
  length: number;
  /** Half-width of the sleeve at a point along the arm. */
  width: (t: number) => number;
  /** Start below the shoulder (off-shoulder band, drop shoulder seam). */
  from?: number;
  /** The inner edge meets the body lower than the underarm (dolman, kimono). */
  joinAt?: Pt;
  raglan?: boolean;
  wavyHem?: boolean;
  cuff?: number;
  extras?: (f: Figure, at: (t: number) => Pt) => string;
}

const bulge = (base: number, extra: number, centre: number, spread: number) => (t: number) =>
  base + extra * Math.exp(-(((t - centre) / spread) ** 2));

const SLEEVES: Record<string, SleeveSpec> = {
  cap: { length: 0.12, width: () => 8 },
  short: { length: 0.3, width: () => 8 },
  elbow_length: { length: 0.5, width: () => 7.5 },
  three_quarter: { length: 0.72, width: () => 7.2 },
  full_length: { length: 1, width: () => 7 },
  puff: { length: 0.28, width: bulge(7.5, 6, 0.13, 0.12), cuff: 0.04 },
  bishop: { length: 1, width: (t) => (t > 0.93 ? 6.2 : 7.5 + 7 * (t / 0.93) ** 2), cuff: 0.07 },
  bell: { length: 0.75, width: (t) => (t < 0.38 ? 7.5 : 7.5 + 10 * ((t - 0.38) / 0.37) ** 1.6) },
  flutter: { length: 0.26, width: (t) => 8 + 6 * (t / 0.26), wavyHem: true },
  raglan: { length: 1, width: () => 7.5, raglan: true },
  dolman: { length: 1, width: (t) => Math.max(6.5, 22 * (1 - t)), joinAt: [0, 150] },
  lantern: { length: 0.75, width: bulge(7, 7, 0.42, 0.16) },
  balloon: { length: 1, width: (t) => (t > 0.94 ? 6.2 : bulge(7.5, 8, 0.55, 0.25)(t)), cuff: 0.06 },
  leg_of_mutton: { length: 1, width: (t) => (t < 0.5 ? 7 + 9 * Math.exp(-(((t - 0.12) / 0.18) ** 2)) : 7) },
  cold_shoulder: {
    length: 0.42,
    width: () => 8,
    extras: (f) =>
      `<ellipse cx="${f.shoulder[0] - 2}" cy="${f.shoulder[1] + 10}" rx="4.5" ry="7.5" fill="${SKIN}" stroke="${GOLD_LINE}" stroke-width="1"/>`,
  },
  off_shoulder: { length: 0.32, width: () => 8.5, from: 0.1 },
  kimono: { length: 0.5, width: () => 14, joinAt: [0, 120] },
  cuffed: { length: 1, width: () => 7.5, cuff: 0.08 },
  roll_up: { length: 0.5, width: () => 8, cuff: 0.07 },
  drop_shoulder: {
    length: 0.36,
    width: () => 10,
    extras: (_f, at) => {
      const [x, y] = at(0.12);
      return line(`M ${r(x - 10)} ${r(y)} Q ${r(x)} ${r(y + 3)} ${r(x + 10)} ${r(y)}`, 1);
    },
  },
};

/** The left sleeve outline; the right one is the same path mirrored. */
function sleevePath(f: Figure, s: SleeveSpec): { d: string; at: (t: number) => Pt } {
  const at = (t: number): Pt => {
    const [a, b, u] = t <= 0.5 ? [f.armTop, f.elbow, t / 0.5] : [f.elbow, f.wrist, (t - 0.5) / 0.5];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  };
  const from = s.from ?? 0;
  const steps = 14;
  const ts = Array.from({ length: steps + 1 }, (_, i) => from + ((s.length - from) * i) / steps);
  const outer = ts.map((t): Pt => [at(t)[0] - s.width(t), at(t)[1]]);
  // The inner edge stops where it meets the body: at the underarm, or lower for cut-in-one sleeves.
  const join: Pt = s.joinAt ? [f.underarm[0] + (s.joinAt[1] - f.underarm[1]) * 0.12, s.joinAt[1]] : f.underarm;
  const inner = ts
    .map((t): Pt => [at(t)[0] + s.width(t), at(t)[1]])
    .filter(([, y]) => y > join[1] + 2)
    .reverse();
  const hemOuter = outer[outer.length - 1]!;
  const hemInner = inner[0] ?? hemOuter;
  let hem = ` L ${p(hemInner)}`;
  if (s.wavyHem) {
    const n = 4;
    hem = '';
    for (let i = 1; i <= n; i++) {
      const x = hemOuter[0] + ((hemInner[0] - hemOuter[0]) * i) / n;
      const y = hemOuter[1] + ((hemInner[1] - hemOuter[1]) * i) / n;
      const cx = hemOuter[0] + ((hemInner[0] - hemOuter[0]) * (i - 0.5)) / n;
      hem += ` Q ${r(cx)} ${r(y + 5)} ${r(x)} ${r(y)}`;
    }
  }
  const pts = s.from ? outer : [f.shoulder, ...outer];
  const raglanStart: Pt = [91, 64];
  const head = s.raglan ? `M ${p(raglanStart)} L ${p(f.shoulder)}` : `M ${p(pts[0]!)}`;
  const back = inner.length > 1 ? smooth(inner) : '';
  const close = s.from
    ? ` L ${p([at(from)[0] + s.width(from), at(from)[1]])} Z`
    : s.raglan
      ? ` L ${p(join)} L ${p(raglanStart)} Z`
      : ` L ${p(join)} Q ${p([f.shoulder[0] + 7, 88])} ${p(f.shoulder)} Z`;
  return { d: `${head}${smooth(pts)}${hem}${back}${close}`, at };
}

function sleeves(department: ClothingPreference, slug: string, fill: string): string {
  const f = FIGURES[department];
  if (slug === 'spaghetti_strap') {
    const strap = `<path d="M 82 96 L 76 71" fill="none" stroke="${GOLD_LINE}" stroke-width="2.4" stroke-linecap="round"/>`;
    return strap + `<g transform="${MIRROR}">${strap}</g>`;
  }
  const spec = SLEEVES[slug];
  if (!spec) return '';
  const { d, at } = sleevePath(f, spec);
  const stroke = fill === GOLD ? GOLD_LINE : LINE;
  let one = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round"/>`;
  if (spec.cuff) {
    const t = spec.length - spec.cuff;
    const [x, y] = at(t);
    const w = spec.width(t) + 0.5;
    one += line(`M ${r(x - w)} ${r(y)} L ${r(x + w)} ${r(y)}`, 1);
  }
  if (spec.extras) one += spec.extras(f, at);
  return one + `<g transform="${MIRROR}">${one}</g>`;
}

// --- Records --------------------------------------------------------------------------------------------

export interface DesignIllustrationRecord {
  assetId: string;
  kind: 'design_feature' | 'design_feature_layer';
  title: string;
  altText: string;
  path: string;
  department: ClothingPreference;
  featureId: string | null;
  layer: 'base' | 'neckline' | 'sleeve' | null;
  zIndex: number | null;
  svg: string;
}

const DEPARTMENT_LABEL: Record<ClothingPreference, string> = { women: 'Women’s Wear', men: 'Men’s Wear' };

/** Asset IDs: ILL-2xxx women, ILL-3xxx men; +0 base, +1nn neckline cards, +3nn sleeve cards, +5nn/+7nn layers. */
function assetId(department: ClothingPreference, offset: number): string {
  return `ILL-${(department === 'women' ? 2000 : 3000) + offset}`;
}

/** The dress form every layer is drawn on. */
export const baseFigureAssetId = (department: ClothingPreference) => assetId(department, 0);

export const designIllustrationPath = (department: ClothingPreference, name: string) =>
  `/illustrations/design/${department}-${name}.svg`;

function illustrated(category: 'neckline' | 'sleeve', department: ClothingPreference): DesignFeatureSeed[] {
  return DESIGN_FEATURES.filter(
    (f) => f.category === category && f.departments.includes(department) && f.selectable !== false,
  );
}

const slugOf = (featureId: string, category: string) => featureId.slice(category.length + 1);

/** Every design illustration: the base figures, a card per neckline and sleeve, and their layers. */
export function designIllustrations(): DesignIllustrationRecord[] {
  const out: DesignIllustrationRecord[] = [];
  for (const department of ['women', 'men'] as const) {
    const label = DEPARTMENT_LABEL[department];
    const base = baseFigureSvg(department);
    const baseBody = base.replace(/^<svg[^>]*>|<\/svg>$/g, '');
    out.push({
      assetId: assetId(department, 0),
      kind: 'design_feature_layer',
      title: `Dress form — ${label}`,
      altText: 'Faceless dress form, front view.',
      path: designIllustrationPath(department, 'base'),
      department,
      featureId: null,
      layer: 'base',
      zIndex: 0,
      svg: base,
    });
    const defaultSleeve = department === 'women' ? '' : sleeves(department, 'short', CLOTH);
    illustrated('neckline', department).forEach((feature, i) => {
      // Back designs get their back-view drawing in Outfit Categories, not a front view (#163). The index is
      // kept, so every other neckline keeps its asset ID.
      if (isBackDesign(feature.featureId)) return;
      const slug = slugOf(feature.featureId, 'neckline');
      out.push({
        assetId: assetId(department, 100 + i),
        kind: 'design_feature',
        title: `${feature.name} — ${label}`,
        altText: `Dress form wearing a plain top with a ${feature.name.toLowerCase()}, the neckline outlined in gold.`,
        path: designIllustrationPath(department, `neckline-${slug}`),
        department,
        featureId: feature.featureId,
        layer: null,
        zIndex: null,
        svg: svg(baseBody + defaultSleeve + bodice(department, slug, true)),
      });
      out.push({
        assetId: assetId(department, 500 + i),
        kind: 'design_feature_layer',
        title: `${feature.name} layer — ${label}`,
        altText: `Bodice with a ${feature.name.toLowerCase()}.`,
        path: designIllustrationPath(department, `layer-neckline-${slug}`),
        department,
        featureId: feature.featureId,
        layer: 'neckline',
        zIndex: 1,
        svg: svg(bodice(department, slug, false)),
      });
    });
    illustrated('sleeve', department).forEach((feature, i) => {
      const slug = slugOf(feature.featureId, 'sleeve');
      const neckline =
        slug === 'off_shoulder'
          ? 'off_shoulder'
          : slug === 'spaghetti_strap'
            ? 'strapless'
            : department === 'women'
              ? 'round_neck'
              : 'crew_neck';
      out.push({
        assetId: assetId(department, 300 + i),
        kind: 'design_feature',
        title: `${feature.name} — ${label}`,
        altText:
          slug === 'sleeveless'
            ? 'Dress form wearing a plain sleeveless top.'
            : `Dress form wearing a plain top with ${feature.name.toLowerCase()}s, the sleeves shaded gold.`,
        path: designIllustrationPath(department, `sleeve-${slug}`),
        department,
        featureId: feature.featureId,
        layer: null,
        zIndex: null,
        svg: svg(baseBody + bodice(department, neckline, false) + sleeves(department, slug, GOLD)),
      });
      out.push({
        assetId: assetId(department, 700 + i),
        kind: 'design_feature_layer',
        title: `${feature.name} layer — ${label}`,
        altText: `${feature.name} on both arms.`,
        path: designIllustrationPath(department, `layer-sleeve-${slug}`),
        department,
        featureId: feature.featureId,
        layer: 'sleeve',
        zIndex: 2,
        svg: svg(sleeves(department, slug, CLOTH)),
      });
    });
  }
  return out;
}
