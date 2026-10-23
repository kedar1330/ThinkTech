import Link from 'next/link';
import type { BodyType, Look } from '@styleme/contracts';
import { garmentSlots, slotLabel } from '@/lib/outfits/look-text';

// The look on a figure like the user's (#120), as the approved 2D illustrative try-on (D-119): a drawn
// figure whose shoulders, waist and hips follow the body type in My Profile, with the look's garments
// layered on it in the look's colours. It is drawn here, in the browser: no photo, no AI, and nothing about
// the user's body leaves StyleMe (AI rule 16).

export const FIGURE_LABEL = 'Illustrative 2D preview — not an exact representation of fit or drape';

type Department = 'women' | 'men';

/** Half-widths (in figure units) at the shoulders, waist and hips. */
interface Shape {
  s: number;
  w: number;
  h: number;
}

const SHAPES: Record<Department, Partial<Record<BodyType, Shape>> & { default: Shape }> = {
  women: {
    default: { s: 42, w: 31, h: 44 },
    hourglass: { s: 44, w: 28, h: 46 },
    top_hourglass: { s: 48, w: 30, h: 42 },
    bottom_hourglass: { s: 40, w: 29, h: 49 },
    pear: { s: 36, w: 30, h: 52 },
    spoon: { s: 37, w: 30, h: 54 },
    rectangle: { s: 40, w: 37, h: 41 },
    inverted_triangle: { s: 52, w: 34, h: 38 },
    oval: { s: 42, w: 46, h: 44 },
    diamond: { s: 36, w: 44, h: 42 },
  },
  men: {
    default: { s: 48, w: 40, h: 42 },
    rectangle: { s: 46, w: 41, h: 42 },
    triangle: { s: 40, w: 43, h: 47 },
    inverted_triangle: { s: 56, w: 38, h: 40 },
    trapezoid: { s: 52, w: 40, h: 42 },
    oval: { s: 46, w: 51, h: 46 },
  },
};

const SKIN = '#E6CFBC';
const LINE = '#3F3431';
const CX = 100;
const Y = { shoulder: 96, waist: 168, hip: 208, knee: 300, ankle: 404 };

/** Long tops reach the knee; the rest end below the hip. */
const LONG_TOPS = new Set(['kurta', 'kurti']);

const shapeOf = (department: Department, bodyType: BodyType | null) =>
  (bodyType && SHAPES[department][bodyType]) || SHAPES[department].default;

/** Torso outline from the shoulders through the waist to `bottom`, flaring out to `flare` there. */
function torso({ s, w, h }: Shape, bottom: number, flare: number): string {
  const hipY = Math.min(Y.hip, bottom);
  return [
    `M ${CX - s} ${Y.shoulder}`,
    `C ${CX - s} ${Y.shoulder + 34}, ${CX - w} ${Y.waist - 30}, ${CX - w} ${Y.waist}`,
    `C ${CX - w} ${Y.waist + 20}, ${CX - h} ${hipY - 18}, ${CX - h} ${hipY}`,
    `L ${CX - flare} ${bottom}`,
    `L ${CX + flare} ${bottom}`,
    `L ${CX + h} ${hipY}`,
    `C ${CX + h} ${hipY - 18}, ${CX + w} ${Y.waist + 20}, ${CX + w} ${Y.waist}`,
    `C ${CX + w} ${Y.waist - 30}, ${CX + s} ${Y.shoulder + 34}, ${CX + s} ${Y.shoulder}`,
    'Z',
  ].join(' ');
}

/** Two legs (or trouser legs) from `top` to the ankles. */
function legs({ w, h }: Shape, top: number): string {
  const inner = 5;
  return [
    `M ${CX - h} ${Y.hip} L ${CX - inner} ${Y.hip} L ${CX - inner - 2} ${Y.ankle} L ${CX - h + 14} ${Y.ankle} Z`,
    `M ${CX + inner} ${Y.hip} L ${CX + h} ${Y.hip} L ${CX + h - 14} ${Y.ankle} L ${CX + inner + 2} ${Y.ankle} Z`,
    `M ${CX - w} ${top} L ${CX + w} ${top} L ${CX + h} ${Y.hip} L ${CX - h} ${Y.hip} Z`,
  ].join(' ');
}

const arm = (side: -1 | 1, { s }: Shape, end: number) => {
  const x = CX + side * s;
  return `M ${x} ${Y.shoulder} L ${x + side * 12} ${Y.shoulder + 8} L ${x + side * 16} ${end} L ${x + side * 4} ${end} Z`;
};

const BODY_TYPE_TEXT = (bodyType: BodyType) => bodyType.replace(/_/g, ' ');

export function BodyTypeFigure({
  look,
  department,
  bodyType,
}: {
  look: Pick<Look, 'slots'>;
  department: Department | null;
  bodyType: BodyType | null;
}) {
  const dept: Department = department ?? 'women';
  const shape = shapeOf(dept, bodyType && SHAPES[dept][bodyType] ? bodyType : null);
  const known = Boolean(bodyType && SHAPES[dept][bodyType]);
  const garments = garmentSlots(look);
  const colour = (kind: string) => garments.find((g) => g.slot === kind)?.swatches[0]?.hex;
  const onePiece = garments.find((g) => g.slot === 'one_piece');
  const top = garments.find((g) => g.slot === 'top' || g.slot === 'layer');
  const bottom = garments.find((g) => g.slot === 'bottom');
  const topEnd = top && LONG_TOPS.has(top.lookSpec.category) ? Y.knee : Y.hip + 14;

  const wearing = garments.map((g) => `${g.swatches[0]?.name ?? ''} ${slotLabel(g.slot)}`.trim().toLowerCase());
  const label = `Illustrative ${dept === 'men' ? 'man' : 'woman'}${
    known ? ` with a ${BODY_TYPE_TEXT(bodyType!)} body type` : ''
  } wearing ${wearing.join(' and ') || 'the look'}`;

  return (
    <figure className="space-y-1.5" data-testid="body-type-figure">
      <div className="mx-auto aspect-[1/2] w-full max-w-[11rem] rounded-xl border border-border bg-surface-muted p-2">
        <svg viewBox="0 0 200 420" role="img" aria-label={label} className="h-full w-full">
          {/* Figure */}
          <circle cx={CX} cy={48} r={21} fill={SKIN} stroke={LINE} strokeWidth={1.5} />
          <rect x={CX - 7} y={66} width={14} height={Y.shoulder - 64} fill={SKIN} />
          <path d={arm(-1, shape, 250)} fill={SKIN} stroke={LINE} strokeWidth={1.2} />
          <path d={arm(1, shape, 250)} fill={SKIN} stroke={LINE} strokeWidth={1.2} />
          <path d={legs(shape, Y.waist)} fill={SKIN} stroke={LINE} strokeWidth={1.2} />
          <path d={torso(shape, Y.hip, shape.h)} fill={SKIN} stroke={LINE} strokeWidth={1.2} />

          {/* Garments, in a fixed layer order: bottom, then top or one-piece */}
          {bottom && (
            <path
              d={legs(shape, Y.waist)}
              fill={colour('bottom')}
              stroke={LINE}
              strokeWidth={1.2}
              data-garment="bottom"
            />
          )}
          {onePiece && (
            <path
              d={torso(
                shape,
                ['saree', 'lehenga'].includes(onePiece.lookSpec.category) ? Y.ankle : Y.knee + 30,
                shape.h + 22,
              )}
              fill={colour('one_piece')}
              stroke={LINE}
              strokeWidth={1.2}
              data-garment="one_piece"
            />
          )}
          {top && !onePiece && (
            <>
              <path
                d={torso(shape, topEnd, topEnd > Y.hip + 20 ? shape.h + 10 : shape.h + 2)}
                fill={top.swatches[0]?.hex}
                stroke={LINE}
                strokeWidth={1.2}
                data-garment={top.slot}
              />
              <path d={arm(-1, shape, 170)} fill={top.swatches[0]?.hex} stroke={LINE} strokeWidth={1.2} />
              <path d={arm(1, shape, 170)} fill={top.swatches[0]?.hex} stroke={LINE} strokeWidth={1.2} />
            </>
          )}
        </svg>
      </div>
      <figcaption className="space-y-0.5 text-center text-xs text-muted-foreground">
        <span className="block">{FIGURE_LABEL}</span>
        {!known && (
          <span className="block">
            Add your body type in{' '}
            <Link href="/profile" className="text-plum underline underline-offset-2">
              My Profile
            </Link>{' '}
            to see it on a figure like yours.
          </span>
        )}
      </figcaption>
    </figure>
  );
}
