'use client';

import { useId, type ReactNode } from 'react';
import type { DesignFeatureItem, GarmentKind } from '@styleme/contracts';
import { ACCENT, CLOTH, CLOTH_SHADOW, LINE, LINE_MUTED, MANNEQUIN_DASH } from './designPalette';

// Pictures for the Outfit Categories options that have no generated illustration (#163): lengths drawn on
// the right garment, and closures, fabrics, hemlines, layering, occasions, patterns, pockets, silhouettes,
// stretch and transparency, each with its own sketch so the options can be told apart at a glance.
// Returns null for anything it doesn't draw, so `FeatureThumbnailSvg` can handle it.

const VIEW = '0 0 160 180';

/** Heights on the full figure (viewBox units): shoulder 34, waist 70, hip 86, floor 172. */
const Y = {
  shoulder: 34,
  waist: 70,
  hip: 86,
  crotch: 94,
  midThigh: 108,
  aboveKnee: 117,
  knee: 124,
  midi: 136,
  calf: 145,
  ankle: 162,
  full: 167,
  floor: 172,
};

interface Props {
  feature: Pick<DesignFeatureItem, 'featureId' | 'category'>;
  hClass: string;
  /** The garment being designed, for lengths and silhouettes. */
  garmentKind?: GarmentKind;
  isSkirt?: boolean;
  isLehenga?: boolean;
}

function Frame({ children, name }: { children: ReactNode; name: string }) {
  return (
    <svg viewBox={VIEW} className="h-full w-auto" aria-hidden="true" fill="none" data-thumbnail={name}>
      {children}
    </svg>
  );
}

/** Dashed figure guide: head, shoulders and legs down to the floor. */
const FigureGuide = ({ to = Y.floor }: { to?: number }) => (
  <g stroke={MANNEQUIN_DASH} strokeWidth="1" strokeDasharray="3 3">
    <circle cx="80" cy="16" r="9" />
    <path d={`M 76 25 L 76 31 M 84 25 L 84 31 M 58 ${Y.shoulder} Q 80 30 102 ${Y.shoulder}`} />
    <path d={`M 66 ${Y.crotch} L 64 ${to} M 94 ${Y.crotch} L 96 ${to}`} />
    <line x1="48" y1={Y.floor} x2="112" y2={Y.floor} />
  </g>
);

/** Gold hem marker with arrow tips across the garment at `y`. */
const Hem = ({ y }: { y: number }) => (
  <g data-hem={y}>
    <line x1="40" y1={y} x2="120" y2={y} stroke={ACCENT} strokeWidth="2" />
    <polygon points={`40,${y} 35,${y - 3} 35,${y + 3}`} fill={ACCENT} />
    <polygon points={`120,${y} 125,${y - 3} 125,${y + 3}`} fill={ACCENT} />
  </g>
);

const bodice = (hem: number) =>
  `M 60 ${Y.shoulder + 2} L 48 46 L 53 54 L 60 50 L 60 ${hem} L 100 ${hem} L 100 50 L 107 54 L 112 46 L 100 ${Y.shoulder + 2} Q 80 42 60 ${Y.shoulder + 2} Z`;

const trousers = (hem: number, wide: boolean) => {
  const out = wide ? 18 : 8;
  return `M 62 ${Y.waist} L 98 ${Y.waist} L ${98 + out} ${hem} L 83 ${hem} L 80 ${Y.crotch + 4} L 77 ${hem} L ${62 - out} ${hem} Z`;
};

const skirt = (top: number, hem: number, flare = 14) =>
  `M 62 ${top} L 98 ${top} L ${98 + flare} ${hem} L ${62 - flare} ${hem} Z`;

const dress = (hem: number, flare = 16) =>
  `M 62 ${Y.shoulder + 2} Q 80 42 98 ${Y.shoulder + 2} L 100 ${Y.waist} L ${100 + flare} ${hem} L ${60 - flare} ${hem} L 60 ${Y.waist} Z`;

// --- Lengths -------------------------------------------------------------------------------------------

const TOP_HEMS: Record<string, number> = { cropped: 60, waist_length: Y.waist, hip_length: Y.hip, tunic: 102 };
const LEG_HEMS: Record<string, number> = {
  shorts: Y.midThigh,
  mid_thigh: Y.midThigh + 2,
  above_knee: Y.aboveKnee,
  knee: Y.knee,
  midi: Y.midi,
  calf: Y.calf,
  cropped: 152,
  ankle: Y.ankle,
  full_length: Y.full,
  floor: Y.floor - 1,
  adjustable: Y.calf,
};

/** The hem height of a length option on a garment kind (exported for tests). */
export function lengthHem(slug: string, kind: GarmentKind | undefined): number {
  if (kind === 'top' || kind === 'layer') return TOP_HEMS[slug] ?? LEG_HEMS[slug] ?? Y.hip;
  return LEG_HEMS[slug] ?? TOP_HEMS[slug] ?? Y.knee;
}

function Length({ slug, kind, isSkirt }: { slug: string; kind?: GarmentKind; isSkirt?: boolean }) {
  const hem = lengthHem(slug, kind);
  const top = kind === 'top' || kind === 'layer';
  const legs = kind === 'bottom' && !isSkirt;
  const path = top ? bodice(hem) : legs ? trousers(hem, true) : kind === 'bottom' ? skirt(Y.waist, hem) : dress(hem);
  return (
    <Frame name={`length-${slug}`}>
      <FigureGuide />
      <path d={path} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
      {slug === 'adjustable' ? (
        <g>
          <line x1="40" y1={Y.knee} x2="120" y2={Y.knee} stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="40" y1={Y.ankle} x2="120" y2={Y.ankle} stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
          <path
            d={`M 128 ${Y.knee} L 128 ${Y.ankle} M 124 ${Y.knee + 5} L 128 ${Y.knee} L 132 ${Y.knee + 5} M 124 ${Y.ankle - 5} L 128 ${Y.ankle} L 132 ${Y.ankle - 5}`}
            stroke={ACCENT}
            strokeWidth="1.5"
          />
        </g>
      ) : (
        <Hem y={hem} />
      )}
    </Frame>
  );
}

// --- Swatch tiles: patterns, fabrics, transparency --------------------------------------------------------

const TILE = { x: 30, y: 26, w: 100, h: 128 };

function Tile({ name, children, fill = CLOTH }: { name: string; children?: ReactNode; fill?: string }) {
  const clip = useId().replace(/:/g, '');
  return (
    <Frame name={name}>
      <defs>
        <clipPath id={clip}>
          <rect x={TILE.x} y={TILE.y} width={TILE.w} height={TILE.h} rx="10" />
        </clipPath>
      </defs>
      <rect x={TILE.x} y={TILE.y} width={TILE.w} height={TILE.h} rx="10" fill={fill} />
      <g clipPath={`url(#${clip})`}>{children}</g>
      <rect x={TILE.x} y={TILE.y} width={TILE.w} height={TILE.h} rx="10" stroke={LINE} strokeWidth="1.3" />
    </Frame>
  );
}

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

const flower = (cx: number, cy: number, r: number, key: string | number) => (
  <g key={key}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse
        key={a}
        cx={cx + r * Math.cos((a * Math.PI) / 180)}
        cy={cy + r * Math.sin((a * Math.PI) / 180)}
        rx={r * 0.7}
        ry={r * 0.45}
        transform={`rotate(${a} ${cx + r * Math.cos((a * Math.PI) / 180)} ${cy + r * Math.sin((a * Math.PI) / 180)})`}
        fill={ACCENT}
        stroke={LINE}
        strokeWidth="0.6"
      />
    ))}
    <circle cx={cx} cy={cy} r={r * 0.4} fill={LINE_MUTED} />
  </g>
);

const paisley = (x: number, y: number, s: number, key: string | number) => (
  <path
    key={key}
    d={`M ${x} ${y} c ${-8 * s} ${-2 * s} ${-12 * s} ${-12 * s} ${-4 * s} ${-16 * s} c ${6 * s} ${-3 * s} ${12 * s} ${2 * s} ${10 * s} ${8 * s} c ${-1 * s} ${4 * s} ${-3 * s} ${6 * s} ${-6 * s} ${8 * s} Z`}
    fill={ACCENT}
    stroke={LINE}
    strokeWidth="0.7"
  />
);

function Pattern({ slug }: { slug: string }) {
  const name = `pattern-${slug}`;
  switch (slug) {
    case 'solid':
      return <Tile name={name} fill={ACCENT} />;
    case 'striped':
      return (
        <Tile name={name}>
          {range(34, 128, 16).map((x) => (
            <rect key={x} x={x} y={TILE.y} width="7" height={TILE.h} fill={ACCENT} />
          ))}
        </Tile>
      );
    case 'checked':
      return (
        <Tile name={name}>
          {range(26, 154, 20).map((y) => (
            <rect key={`h${y}`} x={TILE.x} y={y} width={TILE.w} height="9" fill={ACCENT} opacity="0.55" />
          ))}
          {range(30, 130, 20).map((x) => (
            <rect key={`v${x}`} x={x} y={TILE.y} width="9" height={TILE.h} fill={ACCENT} opacity="0.55" />
          ))}
        </Tile>
      );
    case 'embroidered':
      return (
        <Tile name={name}>
          <path
            d="M 40 140 C 60 110 50 80 80 70 C 110 60 100 40 120 34"
            stroke={LINE}
            strokeWidth="1.4"
            strokeDasharray="2 2"
          />
          {[
            [56, 112],
            [72, 76],
            [100, 58],
          ].map(([x, y], i) => flower(x!, y!, 6, i))}
          <path d="M 46 128 l -6 -6 M 64 96 l 8 -4 M 92 66 l 6 6" stroke={LINE} strokeWidth="1.2" />
        </Tile>
      );
    case 'printed':
      return (
        <Tile name={name}>
          {range(38, 122, 21).flatMap((x, i) =>
            range(36, 144, 24).map((y, j) => (
              <rect
                key={`${x}-${y}`}
                x={x + (j % 2) * 10}
                y={y}
                width="8"
                height="8"
                rx={(i + j) % 2 ? 4 : 1}
                fill={(i + j) % 3 === 0 ? LINE_MUTED : ACCENT}
                transform={`rotate(${(i * 25 + j * 40) % 90} ${x + 4} ${y + 4})`}
              />
            )),
          )}
        </Tile>
      );
    case 'floral':
      return (
        <Tile name={name}>
          {[
            [52, 50],
            [100, 64],
            [64, 100],
            [108, 120],
            [48, 140],
          ].map(([x, y], i) => flower(x!, y!, 7, i))}
        </Tile>
      );
    case 'geometric':
      return (
        <Tile name={name}>
          {range(30, 130, 20).flatMap((x) =>
            range(26, 154, 24).map((y) => (
              <path
                key={`${x}-${y}`}
                d={`M ${x + 10} ${y} L ${x + 20} ${y + 12} L ${x + 10} ${y + 24} L ${x} ${y + 12} Z`}
                fill={ACCENT}
                stroke={LINE}
                strokeWidth="0.6"
              />
            )),
          )}
        </Tile>
      );
    case 'abstract':
      return (
        <Tile name={name}>
          <path d="M 30 60 C 60 40 70 90 100 70 S 130 90 130 60 L 130 26 L 30 26 Z" fill={ACCENT} opacity="0.7" />
          <path d="M 30 150 C 50 120 80 140 90 110 S 120 120 130 100" stroke={LINE} strokeWidth="2" />
          <circle cx="70" cy="118" r="12" fill={LINE_MUTED} opacity="0.5" />
        </Tile>
      );
    case 'polka_dot':
      return (
        <Tile name={name}>
          {range(40, 122, 20).flatMap((x, i) =>
            range(38, 148, 20).map((y) => (
              <circle key={`${x}-${y}`} cx={x + (i % 2 ? 0 : 10)} cy={y} r="4.5" fill={ACCENT} />
            )),
          )}
        </Tile>
      );
    case 'paisley':
      return (
        <Tile name={name}>
          {[
            [62, 64, 1.4],
            [108, 92, 1.2],
            [60, 132, 1.3],
            [112, 150, 1],
          ].map(([x, y, s], i) => paisley(x!, y!, s!, i))}
        </Tile>
      );
    case 'animal_print':
      return (
        <Tile name={name} fill="#efd9ae">
          {range(38, 122, 22).flatMap((x, i) =>
            range(36, 148, 22).map((y) => (
              <path
                key={`${x}-${y}`}
                d={`M ${x + (i % 2) * 8} ${y} q 6 -6 10 1 q 2 7 -5 8 q -7 1 -5 -9 Z`}
                fill="none"
                stroke={LINE}
                strokeWidth="2.2"
              />
            )),
          )}
        </Tile>
      );
    case 'traditional_motifs':
      return (
        <Tile name={name}>
          {[
            [56, 56],
            [104, 56],
            [80, 98],
            [56, 140],
            [104, 140],
          ].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="12" stroke={LINE} strokeWidth="0.8" />
              {flower(x!, y!, 5, `m${i}`)}
            </g>
          ))}
        </Tile>
      );
    case 'block_print':
      return (
        <Tile name={name}>
          {range(36, 116, 26).flatMap((x) =>
            range(32, 136, 26).map((y) => (
              <g key={`${x}-${y}`}>
                <rect x={x} y={y} width="18" height="18" fill={ACCENT} opacity="0.75" />
                <circle cx={x + 9} cy={y + 9} r="4" fill={CLOTH} />
              </g>
            )),
          )}
        </Tile>
      );
    case 'sequin':
      return (
        <Tile name={name} fill={CLOTH_SHADOW}>
          {range(36, 126, 11).flatMap((x, i) =>
            range(32, 150, 11).map((y) => (
              <g key={`${x}-${y}`}>
                <circle cx={x + (i % 2 ? 5 : 0)} cy={y} r="4.6" fill={ACCENT} stroke={LINE} strokeWidth="0.4" />
                <circle cx={x + (i % 2 ? 5 : 0) - 1.4} cy={y - 1.4} r="1.2" fill="#ffffff" />
              </g>
            )),
          )}
        </Tile>
      );
    case 'jacquard':
      return (
        <Tile name={name} fill={CLOTH_SHADOW}>
          {range(30, 130, 25).flatMap((x) =>
            range(26, 154, 32).map((y) => (
              <g key={`${x}-${y}`} stroke={LINE_MUTED} strokeWidth="0.9">
                <path
                  d={`M ${x + 12.5} ${y + 2} C ${x + 22} ${y + 10} ${x + 22} ${y + 22} ${x + 12.5} ${y + 30} C ${x + 3} ${y + 22} ${x + 3} ${y + 10} ${x + 12.5} ${y + 2} Z`}
                />
                <path d={`M ${x + 12.5} ${y + 9} L ${x + 12.5} ${y + 23}`} />
              </g>
            )),
          )}
        </Tile>
      );
    case 'tie_dye':
      return (
        <Tile name={name}>
          {[46, 38, 30, 22, 14, 7].map((r, i) => (
            <circle key={r} cx="80" cy="90" r={r * 1.6} fill={i % 2 ? CLOTH : ACCENT} opacity={i % 2 ? 1 : 0.6} />
          ))}
        </Tile>
      );
    case 'color_blocked':
      return (
        <Tile name={name}>
          <rect x={TILE.x} y={TILE.y} width="50" height="64" fill={ACCENT} />
          <rect x="80" y="90" width="50" height="64" fill={LINE_MUTED} opacity="0.6" />
          <rect x="30" y="90" width="50" height="64" fill={CLOTH_SHADOW} />
        </Tile>
      );
    case 'textured':
      return (
        <Tile name={name} fill={CLOTH_SHADOW}>
          {range(34, 126, 7).flatMap((x, i) =>
            range(30, 150, 7).map((y, j) => (
              <circle
                key={`${x}-${y}`}
                cx={x + (j % 2 ? 3 : 0)}
                cy={y}
                r={(i + j) % 3 === 0 ? 1.6 : 1}
                fill={LINE_MUTED}
              />
            )),
          )}
        </Tile>
      );
    default:
      return null;
  }
}

function Fabric({ slug }: { slug: string }) {
  const sheen = useId().replace(/:/g, '');
  const name = `fabric-${slug}`;
  switch (slug) {
    case 'cotton':
      return (
        <Tile name={name}>
          {range(30, 154, 6).map((y) => (
            <line key={`h${y}`} x1="30" y1={y} x2="130" y2={y} stroke={LINE_MUTED} strokeWidth="0.5" opacity="0.6" />
          ))}
          {range(30, 130, 6).map((x) => (
            <line key={`v${x}`} x1={x} y1="26" x2={x} y2="154" stroke={LINE_MUTED} strokeWidth="0.5" opacity="0.6" />
          ))}
        </Tile>
      );
    case 'linen':
      return (
        <Tile name={name} fill="#f1e7d2">
          {range(30, 154, 5).map((y, i) => (
            <path
              key={y}
              d={`M 30 ${y} q 25 ${i % 3 ? 1.5 : -1.5} 50 0 t 50 0`}
              stroke={LINE_MUTED}
              strokeWidth={i % 4 === 0 ? 1.3 : 0.6}
            />
          ))}
        </Tile>
      );
    case 'silk':
      return (
        <Tile name={name}>
          <defs>
            <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={ACCENT} />
              <stop offset="0.45" stopColor="#fff6dd" />
              <stop offset="1" stopColor={ACCENT} />
            </linearGradient>
          </defs>
          <rect x={TILE.x} y={TILE.y} width={TILE.w} height={TILE.h} fill={`url(#${sheen})`} />
          <path
            d="M 40 30 C 70 80 60 120 90 154 M 80 26 C 100 70 92 110 120 154"
            stroke="#ffffff"
            strokeWidth="2"
            opacity="0.7"
          />
        </Tile>
      );
    case 'denim':
      return (
        <Tile name={name} fill="#6c7fa6">
          {range(-100, 130, 5).map((x) => (
            <line key={x} x1={x} y1="154" x2={x + 128} y2="26" stroke="#9fb0cf" strokeWidth="1" />
          ))}
          <path d="M 30 70 L 130 70" stroke={ACCENT} strokeWidth="1.4" strokeDasharray="4 3" />
        </Tile>
      );
    case 'wool':
      return (
        <Tile name={name} fill={CLOTH_SHADOW}>
          {range(30, 130, 12).flatMap((x, i) =>
            range(26, 154, 10).map((y) => (
              <path
                key={`${x}-${y}`}
                d={i % 2 ? `M ${x} ${y} L ${x + 12} ${y + 10}` : `M ${x} ${y + 10} L ${x + 12} ${y}`}
                stroke={LINE_MUTED}
                strokeWidth="1.6"
              />
            )),
          )}
        </Tile>
      );
    case 'knit':
      return (
        <Tile name={name}>
          {range(32, 122, 12).flatMap((x) =>
            range(28, 146, 10).map((y) => (
              <path
                key={`${x}-${y}`}
                d={`M ${x} ${y} L ${x + 6} ${y + 9} L ${x + 12} ${y}`}
                stroke={LINE_MUTED}
                strokeWidth="1.3"
              />
            )),
          )}
        </Tile>
      );
    case 'rayon':
      return (
        <Tile name={name}>
          {range(36, 126, 14).map((x, i) => (
            <path
              key={x}
              d={`M ${x} 26 C ${x + 10} 70 ${x - 8} 110 ${x + 6} 154`}
              stroke={i % 2 ? LINE_MUTED : ACCENT}
              strokeWidth="2.2"
              opacity="0.8"
            />
          ))}
        </Tile>
      );
    case 'georgette':
      return (
        <Tile name={name}>
          {range(32, 150, 6).map((y, i) => (
            <path
              key={y}
              d={range(30, 126, 6)
                .map((x, j) => `${j ? 'L' : 'M'} ${x} ${y + ((i + j) % 2 ? 1.6 : -1.6)}`)
                .join(' ')}
              stroke={LINE_MUTED}
              strokeWidth="0.6"
            />
          ))}
        </Tile>
      );
    case 'chiffon':
      return (
        <Tile name={name}>
          <rect x="30" y="26" width="64" height="128" fill={ACCENT} opacity="0.35" />
          <rect x="66" y="26" width="64" height="128" fill={ACCENT} opacity="0.35" />
          <path
            d="M 40 40 C 60 80 50 120 70 150 M 100 34 C 90 80 110 120 96 150"
            stroke={LINE_MUTED}
            strokeWidth="1"
            opacity="0.7"
          />
        </Tile>
      );
    default:
      return null;
  }
}

function Transparency({ slug }: { slug: string }) {
  const opacity = slug === 'opaque' ? 1 : slug === 'semi_sheer' ? 0.6 : slug === 'sheer' ? 0.25 : null;
  if (opacity === null) return null;
  return (
    <Tile name={`transparency-${slug}`} fill="#ffffff">
      {/* Something behind the fabric: how much of it shows through is the point. */}
      {range(34, 126, 14).map((x) => (
        <rect key={x} x={x} y="26" width="6" height="128" fill={LINE_MUTED} />
      ))}
      <rect
        x="44"
        y="40"
        width="72"
        height="100"
        rx="6"
        fill={CLOTH}
        opacity={opacity}
        stroke={LINE}
        strokeWidth="1.2"
      />
    </Tile>
  );
}

// --- Garment details: closures, pockets, hemlines, layering, silhouettes ----------------------------------

const TOP_BODY = bodice(132);

function Closure({ slug }: { slug: string }) {
  const name = `closure-${slug}`;
  const top = (children: ReactNode, back = false) => (
    <Frame name={name}>
      <path d={TOP_BODY} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
      {back && <path d="M 66 38 Q 80 44 94 38" stroke={LINE} strokeWidth="1" />}
      {children}
    </Frame>
  );
  const bottom = (children: ReactNode) => (
    <Frame name={name}>
      <path d={trousers(170, false)} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
      <path
        d={`M 62 ${Y.waist} L 98 ${Y.waist} L 98 ${Y.waist + 10} L 62 ${Y.waist + 10} Z`}
        fill={CLOTH_SHADOW}
        stroke={LINE}
        strokeWidth="1"
      />
      {children}
    </Frame>
  );
  switch (slug) {
    case 'buttons':
      return top(
        <g>
          <line x1="80" y1="44" x2="80" y2="132" stroke={LINE} strokeWidth="1" />
          {range(54, 122, 17).map((y) => (
            <circle key={y} cx="84" cy={y} r="2.6" fill={ACCENT} stroke={LINE} strokeWidth="0.7" />
          ))}
        </g>,
      );
    case 'zipper':
      return top(
        <g>
          <line x1="80" y1="44" x2="80" y2="132" stroke={LINE} strokeWidth="1.2" />
          {range(46, 128, 4).map((y) => (
            <line key={y} x1="77" y1={y} x2="83" y2={y + 2} stroke={LINE_MUTED} strokeWidth="0.8" />
          ))}
          <rect x="76" y="44" width="8" height="10" rx="2" fill={ACCENT} stroke={LINE} strokeWidth="0.8" />
        </g>,
      );
    case 'hooks':
      return top(
        <g>
          <line x1="80" y1="44" x2="80" y2="132" stroke={LINE} strokeWidth="1" />
          {range(56, 124, 16).map((y) => (
            <path key={y} d={`M 76 ${y} q 4 -5 8 0`} stroke={LINE} strokeWidth="1.3" />
          ))}
        </g>,
      );
    case 'back_hooks':
      return top(
        <g>
          <line x1="80" y1="42" x2="80" y2="132" stroke={LINE} strokeWidth="1" />
          {range(52, 100, 12).map((y) => (
            <path key={y} d={`M 76 ${y} q 4 -5 8 0`} stroke={LINE} strokeWidth="1.3" />
          ))}
          <text x="80" y="122" textAnchor="middle" fontSize="9" fill={LINE_MUTED}>
            back
          </text>
        </g>,
        true,
      );
    case 'tie_up':
      return top(
        <g>
          <path d="M 60 50 L 100 120" stroke={LINE} strokeWidth="1.1" />
          <path
            d="M 100 92 q 10 -6 14 2 q -6 6 -14 -2 Z M 100 92 q 10 6 12 14 M 100 92 q 4 10 -2 18"
            fill={ACCENT}
            stroke={LINE}
            strokeWidth="0.9"
          />
        </g>,
      );
    case 'dori_tie_up':
      return top(
        <g>
          <path d="M 64 46 Q 80 112 96 46" fill="#faf6ef" stroke={LINE} strokeWidth="1.1" />
          <path d="M 68 60 Q 80 66 92 60" stroke={LINE} strokeWidth="1" />
          <path d="M 80 63 L 74 96 M 80 63 L 86 100" stroke={LINE} strokeWidth="0.9" />
          <polygon points="71,96 77,96 74,104" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
          <polygon points="83,100 89,100 86,108" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
        </g>,
        true,
      );
    case 'side_zip':
      return top(
        <g>
          <line x1="100" y1="58" x2="100" y2="124" stroke={LINE} strokeWidth="1.2" />
          {range(60, 120, 4).map((y) => (
            <line key={y} x1="97" y1={y} x2="103" y2={y + 2} stroke={LINE_MUTED} strokeWidth="0.8" />
          ))}
          <rect x="96" y="56" width="8" height="10" rx="2" fill={ACCENT} stroke={LINE} strokeWidth="0.8" />
        </g>,
      );
    case 'drawstring':
      return bottom(
        <g>
          <path
            d={`M 76 ${Y.waist + 5} q -2 14 -6 22 M 84 ${Y.waist + 5} q 2 14 6 22`}
            stroke={LINE}
            strokeWidth="1.1"
          />
          <circle cx="70" cy={Y.waist + 28} r="2.4" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
          <circle cx="90" cy={Y.waist + 28} r="2.4" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
        </g>,
      );
    case 'pull_on':
      return bottom(
        <g>
          {range(64, 96, 4).map((x) => (
            <line key={x} x1={x} y1={Y.waist + 1} x2={x} y2={Y.waist + 9} stroke={LINE_MUTED} strokeWidth="0.8" />
          ))}
          <path
            d={`M 46 ${Y.waist + 30} L 46 ${Y.waist - 6} M 42 ${Y.waist - 1} L 46 ${Y.waist - 6} L 50 ${Y.waist - 1} M 114 ${Y.waist + 30} L 114 ${Y.waist - 6} M 110 ${Y.waist - 1} L 114 ${Y.waist - 6} L 118 ${Y.waist - 1}`}
            stroke={ACCENT}
            strokeWidth="1.6"
          />
        </g>,
      );
    default:
      return null;
  }
}

function Pockets({ slug }: { slug: string }) {
  const name = `pockets-${slug}`;
  const pants = (children: ReactNode) => (
    <Frame name={name}>
      <path d={trousers(170, false)} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
      {children}
    </Frame>
  );
  switch (slug) {
    case 'chest':
      return (
        <Frame name={name}>
          <path d={TOP_BODY} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
          <rect x="66" y="58" width="13" height="15" rx="1.5" fill={ACCENT} stroke={LINE} strokeWidth="1" />
          <line x1="66" y1="62" x2="79" y2="62" stroke={LINE} strokeWidth="0.8" />
        </Frame>
      );
    case 'patch':
      return (
        <Frame name={name}>
          <path d={TOP_BODY} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
          <rect
            x="63"
            y="100"
            width="15"
            height="17"
            rx="2"
            fill={ACCENT}
            stroke={LINE}
            strokeWidth="1"
            strokeDasharray="2 1.5"
          />
          <rect
            x="83"
            y="100"
            width="15"
            height="17"
            rx="2"
            fill={ACCENT}
            stroke={LINE}
            strokeWidth="1"
            strokeDasharray="2 1.5"
          />
        </Frame>
      );
    case 'side':
      return pants(
        <path
          d={`M 64 ${Y.waist + 2} Q 66 ${Y.waist + 14} 58 ${Y.waist + 22} M 96 ${Y.waist + 2} Q 94 ${Y.waist + 14} 102 ${Y.waist + 22}`}
          stroke={ACCENT}
          strokeWidth="2"
        />,
      );
    case 'welt':
      return pants(
        <g>
          <rect x="66" y={Y.waist + 12} width="11" height="3" fill={ACCENT} stroke={LINE} strokeWidth="0.7" />
          <rect x="84" y={Y.waist + 12} width="11" height="3" fill={ACCENT} stroke={LINE} strokeWidth="0.7" />
          <text x="80" y={Y.waist + 40} textAnchor="middle" fontSize="9" fill={LINE_MUTED}>
            back
          </text>
        </g>,
      );
    case 'cargo':
      return pants(
        <g>
          <rect x="52" y="112" width="14" height="18" rx="1.5" fill={ACCENT} stroke={LINE} strokeWidth="1" />
          <rect x="94" y="112" width="14" height="18" rx="1.5" fill={ACCENT} stroke={LINE} strokeWidth="1" />
          <line x1="52" y1="117" x2="66" y2="117" stroke={LINE} strokeWidth="0.8" />
          <line x1="94" y1="117" x2="108" y2="117" stroke={LINE} strokeWidth="0.8" />
        </g>,
      );
    case 'none':
      return pants(<path d={`M 62 ${Y.waist + 8} L 98 ${Y.waist + 8}`} stroke={LINE} strokeWidth="0.8" />);
    default:
      return null;
  }
}

function Hemline({ slug }: { slug: string }) {
  const hems: Record<string, string> = {
    straight: 'L 104 128 L 56 128',
    curved: 'L 104 120 Q 80 142 56 120',
    high_low: 'L 104 148 Q 80 124 56 148',
    asymmetric: 'L 104 146 L 56 118',
    split: 'L 104 128 L 82 128 L 80 112 L 78 128 L 56 128',
    slit: 'L 104 140 L 96 140 L 96 108 L 94 140 L 56 140',
    ribbed: 'L 104 128 L 56 128',
  };
  const hem = hems[slug];
  if (!hem) return null;
  // The body runs down the right side, along the hem, and back up the left; the hem itself is traced in gold.
  return (
    <Frame name={`hemline-${slug}`}>
      <path
        d={`M 60 36 Q 80 42 100 36 L 112 46 L 107 54 L 102 50 L 104 60 ${hem} L 58 60 L 58 50 L 53 54 L 48 46 Z`}
        fill={CLOTH}
        stroke={LINE}
        strokeWidth="1.3"
      />
      {slug === 'ribbed' && (
        <g>
          <rect x="56" y="118" width="48" height="10" fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1" />
          {range(59, 102, 3).map((x) => (
            <line key={x} x1={x} y1="119" x2={x} y2="127" stroke={LINE_MUTED} strokeWidth="0.7" />
          ))}
        </g>
      )}
      <path d={hem.replace(/^L/, 'M')} stroke={ACCENT} strokeWidth="2.2" fill="none" />
    </Frame>
  );
}

function Layering({ slug }: { slug: string }) {
  const name = `layering-${slug}`;
  const overlay: Record<string, ReactNode> = {
    single_layer: null,
    jacket: (
      <g>
        <path
          d="M 58 35 L 44 46 L 50 58 L 56 54 L 56 120 L 74 120 L 72 52 L 66 38 Z M 102 35 L 116 46 L 110 58 L 104 54 L 104 120 L 86 120 L 88 52 L 94 38 Z"
          fill={ACCENT}
          stroke={LINE}
          strokeWidth="1.2"
        />
      </g>
    ),
    blazer: (
      <g>
        <path
          d="M 58 35 L 44 46 L 50 58 L 56 54 L 56 126 L 80 126 L 80 92 L 70 50 L 66 38 Z M 102 35 L 116 46 L 110 58 L 104 54 L 104 126 L 80 126 L 80 92 L 90 50 L 94 38 Z"
          fill={ACCENT}
          stroke={LINE}
          strokeWidth="1.2"
        />
        <path d="M 66 38 L 62 56 L 72 60 M 94 38 L 98 56 L 88 60" stroke={LINE} strokeWidth="1" />
        <circle cx="80" cy="104" r="2.6" fill={CLOTH} stroke={LINE} strokeWidth="0.8" />
      </g>
    ),
    waistcoat: (
      <g>
        <path
          d="M 62 38 L 60 118 L 80 124 L 100 118 L 98 38 L 88 38 L 80 76 L 72 38 Z"
          fill={ACCENT}
          stroke={LINE}
          strokeWidth="1.2"
        />
        {[86, 98, 110].map((y) => (
          <circle key={y} cx="80" cy={y} r="2" fill={CLOTH} stroke={LINE} strokeWidth="0.7" />
        ))}
      </g>
    ),
    overshirt: (
      <g>
        <path
          d="M 58 35 L 42 50 L 48 64 L 56 58 L 56 130 L 72 130 L 70 48 Z M 102 35 L 118 50 L 112 64 L 104 58 L 104 130 L 88 130 L 90 48 Z"
          fill={CLOTH_SHADOW}
          stroke={LINE}
          strokeWidth="1.2"
        />
        <path d="M 66 36 L 62 46 L 72 46 M 94 36 L 98 46 L 88 46" stroke={LINE} strokeWidth="1" />
      </g>
    ),
    cape: (
      <path
        d="M 60 34 Q 80 28 100 34 L 126 100 Q 80 112 34 100 Z"
        fill={ACCENT}
        opacity="0.85"
        stroke={LINE}
        strokeWidth="1.2"
      />
    ),
    shrug: (
      <path
        d="M 58 35 L 42 52 L 48 62 L 58 56 L 60 72 L 70 72 L 68 46 L 66 37 Z M 102 35 L 118 52 L 112 62 L 102 56 L 100 72 L 90 72 L 92 46 L 94 37 Z"
        fill={ACCENT}
        stroke={LINE}
        strokeWidth="1.2"
      />
    ),
    overlay: (
      <path
        d="M 58 35 L 44 48 L 50 58 L 56 54 L 50 164 L 110 164 L 104 54 L 110 58 L 116 48 L 102 35 L 92 38 L 92 160 L 68 160 L 68 38 Z"
        fill={ACCENT}
        opacity="0.4"
        stroke={LINE}
        strokeWidth="1"
        strokeDasharray="3 2"
      />
    ),
  };
  if (!(slug in overlay)) return null;
  return (
    <Frame name={name}>
      <FigureGuide />
      <path d={bodice(118)} fill={CLOTH} stroke={LINE} strokeWidth="1.2" />
      {overlay[slug]}
    </Frame>
  );
}

const SILHOUETTES: Record<string, string> = {
  straight: 'M 62 36 Q 80 42 98 36 L 100 70 L 100 160 L 60 160 L 60 70 Z',
  sheath: 'M 62 36 Q 80 42 98 36 L 98 70 L 102 90 L 96 156 L 64 156 L 58 90 L 62 70 Z',
  a_line: 'M 64 36 Q 80 42 96 36 L 98 62 L 120 160 L 40 160 L 62 62 Z',
  fit_and_flare: 'M 62 36 Q 80 42 98 36 L 98 70 L 128 158 L 32 158 L 62 70 Z',
  flared: 'M 62 36 Q 80 42 98 36 L 98 70 Q 118 110 136 160 L 24 160 Q 42 110 62 70 Z',
  mermaid: 'M 62 36 Q 80 42 98 36 L 100 70 L 98 128 L 120 162 L 40 162 L 62 128 L 60 70 Z',
  trumpet: 'M 62 36 Q 80 42 98 36 L 100 70 L 98 112 L 116 160 L 44 160 L 62 112 L 60 70 Z',
  empire: 'M 62 36 Q 80 42 98 36 L 98 54 L 116 160 L 44 160 L 62 54 Z',
  wrap: 'M 62 36 Q 80 42 98 36 L 100 70 L 114 158 L 46 158 L 60 70 Z',
  asymmetric: 'M 62 36 Q 80 42 98 36 L 100 70 L 120 168 L 40 132 L 60 70 Z',
  layered: 'M 62 36 Q 80 42 98 36 L 98 70 L 112 158 L 48 158 L 62 70 Z',
  draped: 'M 62 36 Q 80 42 98 36 L 100 70 L 110 160 L 50 160 L 60 70 Z',
};

function Silhouette({ slug }: { slug: string }) {
  const d = SILHOUETTES[slug];
  if (!d) return null;
  return (
    <Frame name={`silhouette-${slug}`}>
      <FigureGuide />
      <path d={d} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
      {slug === 'empire' && <line x1="62" y1="54" x2="98" y2="54" stroke={ACCENT} strokeWidth="2" />}
      {slug === 'wrap' && <path d="M 62 40 L 100 96 M 100 96 q 8 -2 10 4" stroke={LINE} strokeWidth="1.1" />}
      {slug === 'layered' && (
        <path
          d="M 58 98 L 102 98 L 106 102 L 54 102 Z M 52 128 L 108 128 L 110 132 L 50 132 Z"
          fill={ACCENT}
          stroke={LINE}
          strokeWidth="0.9"
        />
      )}
      {slug === 'draped' && (
        <path
          d="M 64 44 Q 80 60 96 44 M 62 50 Q 80 74 98 50 M 70 100 Q 80 140 76 158"
          stroke={LINE_MUTED}
          strokeWidth="1"
        />
      )}
      {slug === 'asymmetric' && <line x1="40" y1="132" x2="120" y2="168" stroke={ACCENT} strokeWidth="2" />}
    </Frame>
  );
}

// --- Occasion and stretch: small scenes --------------------------------------------------------------------

function Occasion({ slug }: { slug: string }) {
  const name = `occasion-${slug}`;
  const scenes: Record<string, ReactNode> = {
    casual: (
      <g>
        <path
          d="M 56 60 L 44 72 L 52 82 L 60 76 L 60 130 L 100 130 L 100 76 L 108 82 L 116 72 L 104 60 Q 80 68 56 60 Z"
          fill={CLOTH}
          stroke={LINE}
          strokeWidth="1.3"
        />
        <circle cx="122" cy="40" r="10" fill={ACCENT} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={122 + 13 * Math.cos((a * Math.PI) / 180)}
            y1={40 + 13 * Math.sin((a * Math.PI) / 180)}
            x2={122 + 18 * Math.cos((a * Math.PI) / 180)}
            y2={40 + 18 * Math.sin((a * Math.PI) / 180)}
            stroke={ACCENT}
            strokeWidth="1.5"
          />
        ))}
      </g>
    ),
    office: (
      <g>
        <rect x="40" y="70" width="80" height="58" rx="5" fill={ACCENT} stroke={LINE} strokeWidth="1.3" />
        <path d="M 66 70 L 66 60 Q 66 56 70 56 L 90 56 Q 94 56 94 60 L 94 70" stroke={LINE} strokeWidth="1.3" />
        <line x1="40" y1="92" x2="120" y2="92" stroke={LINE} strokeWidth="1" />
        <rect x="74" y="88" width="12" height="8" rx="1.5" fill={CLOTH} stroke={LINE} strokeWidth="0.9" />
      </g>
    ),
    party: (
      <g>
        <path d="M 60 50 L 100 50 L 80 90 Z" fill={ACCENT} opacity="0.7" stroke={LINE} strokeWidth="1.3" />
        <path d="M 80 90 L 80 128 M 66 128 L 94 128" stroke={LINE} strokeWidth="1.5" />
        {[
          [44, 46],
          [116, 60],
          [112, 110],
          [48, 104],
        ].map(([x, y], i) => (
          <path
            key={i}
            d={`M ${x} ${y! - 6} L ${x! + 2} ${y! - 2} L ${x! + 6} ${y} L ${x! + 2} ${y! + 2} L ${x} ${y! + 6} L ${x! - 2} ${y! + 2} L ${x! - 6} ${y} L ${x! - 2} ${y! - 2} Z`}
            fill={ACCENT}
          />
        ))}
      </g>
    ),
    wedding: (
      <g>
        <path d="M 40 50 Q 80 30 120 50" stroke={LINE} strokeWidth="1.2" />
        {range(46, 114, 12).map((x, i) => flower(x, 46 - Math.sin(((x - 40) / 80) * Math.PI) * 12 + 10, 4, i))}
        <circle cx="72" cy="104" r="14" stroke={ACCENT} strokeWidth="3" />
        <circle cx="90" cy="104" r="14" stroke={LINE} strokeWidth="3" />
      </g>
    ),
    festive: (
      <g>
        <path d="M 52 108 Q 80 136 108 108 Z" fill={ACCENT} stroke={LINE} strokeWidth="1.3" />
        <path d="M 80 104 C 70 92 74 78 80 66 C 86 78 90 92 80 104 Z" fill="#f4a941" stroke={LINE} strokeWidth="1" />
        <path d="M 80 98 C 76 92 77 84 80 78 C 83 84 84 92 80 98 Z" fill="#fff1c9" />
      </g>
    ),
    travel: (
      <g>
        <rect x="52" y="64" width="56" height="70" rx="6" fill={ACCENT} stroke={LINE} strokeWidth="1.3" />
        <path d="M 70 64 L 70 54 L 90 54 L 90 64" stroke={LINE} strokeWidth="1.3" />
        <line x1="66" y1="74" x2="66" y2="124" stroke={LINE} strokeWidth="1" />
        <line x1="94" y1="74" x2="94" y2="124" stroke={LINE} strokeWidth="1" />
        <circle cx="62" cy="140" r="3" fill={LINE} />
        <circle cx="98" cy="140" r="3" fill={LINE} />
      </g>
    ),
  };
  if (!(slug in scenes)) return null;
  return <Frame name={name}>{scenes[slug]}</Frame>;
}

function Stretch({ slug }: { slug: string }) {
  const spread = slug === 'non_stretch' ? 0 : slug === 'slight_stretch' ? 8 : slug === 'stretch' ? 20 : null;
  if (spread === null) return null;
  return (
    <Frame name={`stretch-${slug}`}>
      <rect
        x={52 - spread}
        y="66"
        width={56 + spread * 2}
        height="48"
        rx="6"
        fill={CLOTH}
        stroke={LINE}
        strokeWidth="1.3"
      />
      {range(60 - spread, 100 + spread, 8).map((x) => (
        <path
          key={x}
          d={spread ? `M ${x} 70 q 4 20 0 40` : `M ${x} 70 L ${x} 110`}
          stroke={LINE_MUTED}
          strokeWidth="0.8"
        />
      ))}
      {spread > 0 ? (
        <path
          d={`M ${44 - spread} 90 L ${30 - spread} 90 M ${36 - spread} 84 L ${30 - spread} 90 L ${36 - spread} 96 M ${116 + spread} 90 L ${130 + spread} 90 M ${124 + spread} 84 L ${130 + spread} 90 L ${124 + spread} 96`}
          stroke={ACCENT}
          strokeWidth="2"
        />
      ) : (
        <path d="M 38 84 L 44 90 L 38 96 M 122 84 L 116 90 L 122 96" stroke={LINE_MUTED} strokeWidth="1.6" />
      )}
    </Frame>
  );
}

// --- Draping: saree drapes, and the dupatta drape on a lehenga (#162) -------------------------------------

/** How each drape sits: the pallu (saree) or dupatta (lehenga) path, plus its details. */
const DRAPES: Record<string, { cloth: string; details?: string; dashed?: string; belt?: boolean }> = {
  straight: { cloth: 'M 98 36 L 106 38 L 108 160 L 98 160 Z' },
  wrap: {
    cloth: 'M 60 38 Q 80 50 100 38 L 104 48 Q 80 62 56 48 Z M 58 52 Q 80 70 102 54 L 100 64 Q 80 78 60 62 Z',
  },
  pleated: {
    cloth: 'M 96 36 L 108 38 L 112 150 L 92 150 Z',
    details: 'M 98 40 L 96 148 M 102 40 L 102 148 M 106 40 L 107 148',
  },
  gathered: {
    cloth: 'M 96 36 Q 104 34 108 40 Q 116 90 112 150 L 94 150 Q 92 90 96 36 Z',
    details: 'M 98 44 q 3 4 6 0 q 3 4 6 0 M 98 52 q 3 4 6 0 q 3 4 6 0',
  },
  nivi: {
    cloth: 'M 60 70 L 98 36 L 108 40 L 112 150 L 100 150 L 96 52 L 66 80 Z',
    details: 'M 70 100 L 70 166 M 75 100 L 76 166 M 80 100 L 81 166',
  },
  front_pallu: { cloth: 'M 62 36 L 70 34 L 102 92 L 104 120 L 58 120 L 56 92 Z', details: 'M 60 112 L 102 112' },
  belted: { cloth: 'M 60 70 L 98 36 L 108 40 L 104 86 L 66 80 Z', belt: true },
  bengali: {
    cloth: 'M 60 70 L 98 36 L 108 40 L 110 100 Q 82 114 58 96 Z',
    details: 'M 70 100 L 70 166 M 76 100 L 77 166 M 58 96 L 52 106',
  },
  maharashtrian: {
    cloth: 'M 64 70 L 96 70 L 102 124 L 84 168 L 80 112 L 76 168 L 58 124 Z',
    details: 'M 98 36 L 108 40 L 104 90 L 96 76 Z',
  },
  dhoti_saree: {
    cloth: 'M 62 70 L 98 70 L 106 166 L 84 166 L 80 100 L 76 166 L 54 166 Z',
    details: 'M 64 100 q 8 10 0 22 M 96 100 q -8 10 0 22 M 62 132 q 8 10 0 22 M 98 132 q -8 10 0 22',
  },
  mermaid: {
    cloth: 'M 64 70 L 96 70 L 98 124 L 120 168 L 40 168 L 62 124 Z',
    details: 'M 98 36 L 108 40 L 106 96 L 98 84 Z',
  },
  lehenga_style: {
    cloth: 'M 64 70 L 96 70 L 124 166 L 36 166 Z',
    details: 'M 70 72 L 50 164 M 76 72 L 66 164 M 80 72 L 80 164 M 84 72 L 94 164 M 90 72 L 110 164 M 98 36 L 108 40',
  },
  retro_mumtaz: {
    cloth:
      'M 62 80 L 100 72 L 102 84 L 60 92 Z M 60 104 L 102 96 L 104 108 L 58 116 Z M 58 128 L 104 120 L 106 132 L 56 140 Z',
    details: 'M 98 36 L 104 38 L 104 70',
  },
  cape_pallu: { cloth: 'M 58 36 Q 80 28 102 36 L 114 66 Q 80 78 46 66 Z', details: 'M 52 60 Q 80 70 108 60' },
  pre_stitched: { cloth: 'M 60 70 L 98 36 L 108 40 L 110 140 L 100 140 L 96 56 L 66 80 Z', dashed: 'M 62 80 L 100 80' },
};

function Draping({ slug, isLehenga }: { slug: string; isLehenga?: boolean }) {
  // A drape added later still gets a picture: the classic pallu, never a blank card.
  const drape = DRAPES[slug] ?? DRAPES.nivi!;
  // A lehenga's flared skirt with a choli, or a saree's draped column.
  const skirt = isLehenga ? 'M 64 70 L 96 70 L 124 166 L 36 166 Z' : 'M 64 70 L 96 70 L 102 168 L 58 168 Z';
  return (
    <Frame name={`draping-${isLehenga ? 'lehenga' : 'saree'}-${slug}`}>
      <FigureGuide />
      <path d={skirt} fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
      {isLehenga && <path d="M 40 160 L 120 160" stroke={ACCENT} strokeWidth="2" />}
      <path d={bodice(isLehenga ? 66 : 62)} fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1.2" />
      <path d={drape.cloth} fill={ACCENT} opacity="0.85" stroke={LINE} strokeWidth="1.1" />
      {drape.details && <path d={drape.details} stroke={LINE} strokeWidth="0.9" />}
      {drape.dashed && <path d={drape.dashed} stroke={LINE} strokeWidth="1.1" strokeDasharray="3 2" />}
      {drape.belt && (
        <rect x="60" y="74" width="42" height="6" rx="1.5" fill={LINE_MUTED} stroke={LINE} strokeWidth="0.8" />
      )}
    </Frame>
  );
}

/** The picture for an option without a generated illustration, or null when another drawer handles it. */
export function OptionThumbnail({ feature, hClass, garmentKind, isSkirt, isLehenga }: Props) {
  const slug = feature.featureId.slice(feature.category.length + 1);
  let drawing: ReactNode = null;
  switch (feature.category) {
    case 'length':
      drawing = <Length slug={slug} kind={garmentKind} isSkirt={isSkirt} />;
      break;
    case 'pattern':
      drawing = <Pattern slug={slug} />;
      break;
    case 'fabric':
      drawing = <Fabric slug={slug} />;
      break;
    case 'transparency':
      drawing = <Transparency slug={slug} />;
      break;
    case 'closure':
      drawing = <Closure slug={slug} />;
      break;
    case 'pockets':
      drawing = <Pockets slug={slug} />;
      break;
    case 'hemline':
      drawing = <Hemline slug={slug} />;
      break;
    case 'layering':
      drawing = <Layering slug={slug} />;
      break;
    case 'silhouette':
      // Lehenga silhouettes have their own skirt drawings in FeatureThumbnailSvg.
      drawing = isLehenga ? null : <Silhouette slug={slug} />;
      break;
    case 'occasion':
      drawing = <Occasion slug={slug} />;
      break;
    case 'stretch':
      drawing = <Stretch slug={slug} />;
      break;
    case 'draping':
      drawing = <Draping slug={slug} isLehenga={isLehenga} />;
      break;
  }
  if (!drawing) return null;
  return <span className={`inline-flex justify-center ${hClass}`}>{drawing}</span>;
}
