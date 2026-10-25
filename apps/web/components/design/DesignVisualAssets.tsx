'use client';

import React from 'react';
import type { DesignFeatureItem, GarmentKind } from '@styleme/contracts';

import { ACCENT, CLOTH, CLOTH_SHADOW, LINE, LINE_MUTED, MANNEQUIN_DASH } from './designPalette';
import { OptionThumbnail } from './OptionThumbnails';

interface FeatureThumbnailSvgProps {
  feature: DesignFeatureItem;
  compact?: boolean;
  isBottom?: boolean;
  isLehenga?: boolean;
  isSkirt?: boolean;
  /** The garment being designed, so lengths and silhouettes are drawn on the right garment (#163). */
  garmentKind?: GarmentKind;
}

/**
 * Visual Dummy Sketch for design features that don't have a static bitmap/layer.
 * Renders precise, high-fashion atelier line art for trouser cuts, waist rises,
 * collars, blouse back necklines, draping, pleats, and fits.
 */
export function FeatureThumbnailSvg({
  feature,
  compact = false,
  isBottom = false,
  isLehenga = false,
  isSkirt = false,
  garmentKind,
}: FeatureThumbnailSvgProps) {
  const fid = feature.featureId;
  const cat = feature.category;
  const hClass = compact ? 'h-24' : 'h-36 sm:h-40';

  // Lengths, closures, fabrics, hemlines, layering, occasions, patterns, pockets, silhouettes, stretch and
  // transparency have their own pictures (#163).
  const option = OptionThumbnail({ feature, hClass, garmentKind, isSkirt, isLehenga });
  if (option) return option;

  const viewBox = '0 0 160 180';

  // 1. TROUSER LEG SHAPES & CUTS
  if (cat === 'leg_shape' || fid.startsWith('leg_shape_')) {
    let legPath: string;

    if (fid.includes('straight')) {
      // Parallel straight cut from hip to hem
      legPath = `
        M 48 35 L 48 160 L 76 160 L 78 85 L 80 85 L 82 85 L 84 160 L 112 160 L 112 35 Z
      `;
    } else if (fid.includes('wide')) {
      // Dramatic wide palazzo flare
      legPath = `
        M 54 35 L 34 160 L 78 160 L 80 85 L 82 160 L 126 160 L 106 35 Z
      `;
    } else if (fid.includes('flared')) {
      // Fitted at knee, widening to bell hem
      legPath = `
        M 52 35 Q 56 75 62 105 Q 58 135 42 160 L 76 160 Q 72 135 73 105 L 80 85 L 87 105 Q 88 135 84 160 L 118 160 Q 102 135 98 105 Q 104 75 108 35 Z
      `;
    } else if (fid.includes('skinny')) {
      // Snug tapered skinny leg
      legPath = `
        M 50 35 Q 56 85 64 120 L 66 160 L 76 160 L 75 120 L 80 85 L 85 120 L 84 160 L 94 160 L 96 120 Q 104 85 110 35 Z
      `;
    } else if (fid.includes('tapered')) {
      // Roomy hip tapering crisply to narrow ankle
      legPath = `
        M 44 35 Q 46 80 58 120 L 62 160 L 77 160 L 76 115 L 80 85 L 84 115 L 83 160 L 98 160 L 102 120 Q 114 80 116 35 Z
      `;
    } else {
      // Slim cut (default)
      legPath = `
        M 49 35 Q 52 85 60 120 L 63 160 L 77 160 L 76 120 L 80 85 L 84 120 L 83 160 L 97 160 L 100 120 Q 108 85 111 35 Z
      `;
    }

    return (
      <svg
        viewBox={viewBox}
        className={`w-auto ${hClass} transition-transform hover:scale-105`}
        aria-hidden="true"
        fill="none"
      >
        {/* Subtle mannequin hip guide */}
        <path
          d="M 40 25 Q 80 28 120 25 M 80 20 L 80 40"
          stroke={MANNEQUIN_DASH}
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        {/* Trouser garment */}
        <path d={legPath} fill={CLOTH} stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />
        {/* Waistband & fly */}
        <path d="M 48 45 Q 80 47 112 45" stroke={LINE} strokeWidth="1" />
        <path d="M 80 45 L 80 72" stroke={LINE_MUTED} strokeWidth="0.9" />
        <circle cx="80" cy="40" r="1.5" fill={LINE} />
        {/* Crease lines */}
        <path d="M 64 52 L 64 152 M 96 52 L 96 152" stroke={LINE_MUTED} strokeWidth="0.75" strokeDasharray="3 3" />
      </svg>
    );
  }

  // 2. WAISTLINE & WAISTBAND (High rise, Mid rise, Low rise, Elastic, Drawstring)
  if (cat === 'waistline' || cat === 'waistband' || fid.startsWith('waistline_') || fid.startsWith('waistband_')) {
    const isHigh = fid.includes('high');
    const isLow = fid.includes('low');
    const isElastic = fid.includes('elastic');
    const isDrawstring = fid.includes('drawstring');

    const waistTopY = isHigh ? 38 : isLow ? 72 : 54;
    const waistBotY = waistTopY + 14;

    return (
      <svg viewBox={viewBox} className={`w-auto ${hClass}`} aria-hidden="true" fill="none">
        {/* Body silhouette guide */}
        <path
          d="M 44 28 Q 50 60 46 110 L 46 160 M 116 28 Q 110 60 114 110 L 114 160"
          stroke={MANNEQUIN_DASH}
          strokeWidth="1.1"
          strokeDasharray="3 3"
        />
        {/* Navel indicator */}
        <circle cx="80" cy="54" r="1.8" fill={MANNEQUIN_DASH} />
        {/* Trouser top & waistband */}
        <path
          d={`M 46 ${waistTopY} Q 80 ${waistTopY + 3} 114 ${waistTopY} L 114 150 L 46 150 Z`}
          fill={CLOTH}
          stroke={LINE}
          strokeWidth="1.3"
        />
        {/* Waistband band */}
        <path
          d={`M 46 ${waistBotY} Q 80 ${waistBotY + 3} 114 ${waistBotY}`}
          stroke={LINE}
          strokeWidth="1.1"
          fill={CLOTH_SHADOW}
        />
        {/* Button & fly */}
        <circle cx="80" cy={(waistTopY + waistBotY) / 2} r="1.8" fill={LINE} />
        <path d={`M 80 ${waistBotY} L 80 ${waistBotY + 35}`} stroke={LINE} strokeWidth="1" />

        {/* Elastic gather lines or drawstring bow */}
        {isElastic && (
          <path
            d={`M 48 ${waistTopY + 4} Q 54 ${waistTopY + 8} 60 ${waistTopY + 4} Q 66 ${waistTopY + 8} 72 ${waistTopY + 4} M 88 ${waistTopY + 4} Q 94 ${waistTopY + 8} 100 ${waistTopY + 4} Q 106 ${waistTopY + 8} 112 ${waistTopY + 4}`}
            stroke={LINE_MUTED}
            strokeWidth="0.8"
          />
        )}
        {isDrawstring && (
          <g transform={`translate(80, ${waistTopY + 7})`}>
            <circle cx="-5" cy="0" r="1" fill={LINE} />
            <circle cx="5" cy="0" r="1" fill={LINE} />
            <path d="M -4 0 Q -10 -5 -12 2 Q -8 8 0 0 Q 8 8 12 2 Q 10 -5 4 0" stroke={LINE} strokeWidth="1.1" />
            <path d="M -1 1 L -5 18 M 1 1 L 5 18" stroke={LINE} strokeWidth="1" />
          </g>
        )}
      </svg>
    );
  }

  // 3. BLOUSE BACK NECK DESIGNS
  if (fid.includes('back') || fid.includes('backless') || fid.includes('keyhole') || fid.includes('sheer_illusion')) {
    const isDeepU = fid.includes('deep_u') || fid.includes('deep_u_back');
    const isBackless = fid.includes('backless') || fid.includes('dori');
    const isKeyhole = fid.includes('keyhole');
    const isSheer = fid.includes('sheer');
    const isSquare = fid.includes('square');
    const isInvertedV = fid.includes('inverted_v');

    let cutPath: string;
    if (isDeepU) {
      cutPath = 'M 60 50 Q 80 125 100 50';
    } else if (isBackless) {
      cutPath = 'M 54 52 Q 80 142 106 52';
    } else if (isKeyhole) {
      cutPath = 'M 80 62 C 68 76 68 96 80 106 C 92 96 92 76 80 62 Z';
    } else if (isSquare) {
      cutPath = 'M 62 50 L 62 110 L 98 110 L 98 50';
    } else if (isInvertedV) {
      cutPath = 'M 58 50 L 80 120 L 102 50';
    } else {
      cutPath = 'M 62 50 Q 80 100 98 50';
    }

    return (
      <svg viewBox={viewBox} className={`w-auto ${hClass}`} aria-hidden="true" fill="none">
        {/* Back neck shoulders & spine guide */}
        <path
          d="M 50 35 Q 80 42 110 35 M 80 32 L 80 150"
          stroke={MANNEQUIN_DASH}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {/* Blouse bodice back */}
        <path d="M 46 55 L 56 46 L 104 46 L 114 55 L 112 125 L 48 125 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
        {/* Back cut-out */}
        <path d={cutPath} fill={isSheer ? '#f5eee3' : '#faf6ef'} stroke={LINE} strokeWidth="1.3" />

        {/* Tie-up Dori and Tassels (Latkans) */}
        {isBackless && (
          <g>
            <path d="M 56 50 Q 80 64 104 50" stroke={LINE} strokeWidth="1" />
            <path d="M 80 57 L 74 88 M 80 57 L 86 92" stroke={LINE} strokeWidth="0.9" />
            <polygon points="71,88 77,88 74,96" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
            <polygon points="83,92 89,92 86,100" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
            <path d="M 52 122 Q 80 126 108 122" stroke={LINE} strokeWidth="1" />
          </g>
        )}

        {isKeyhole && <circle cx="80" cy="54" r="1.5" fill={LINE} />}

        {isSheer && (
          <g stroke={LINE_MUTED} strokeWidth="0.5" strokeDasharray="1.5 1.5">
            <line x1="68" y1="65" x2="92" y2="65" />
            <line x1="66" y1="80" x2="94" y2="80" />
            <line x1="70" y1="95" x2="90" y2="95" />
            <circle cx="80" cy="70" r="1" fill={LINE} />
            <circle cx="80" cy="85" r="1" fill={LINE} />
            <circle cx="80" cy="100" r="1" fill={LINE} />
          </g>
        )}
      </svg>
    );
  }

  // 4. COLLARS (Shirt, Mandarin, Peter Pan, Spread, Notched)
  if (cat === 'collar' || fid.startsWith('collar_')) {
    const isMandarin = fid.includes('mandarin');
    const isPeterPan = fid.includes('peter_pan');
    const isSpread = fid.includes('spread');
    const isNotched = fid.includes('notched');

    return (
      <svg viewBox={viewBox} className={`w-auto ${hClass}`} aria-hidden="true" fill="none">
        {/* Shoulders */}
        <path d="M 40 70 L 65 52 L 95 52 L 120 70 L 115 130 L 45 130 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.2" />

        {isMandarin ? (
          // Standing Nehru / Mandarin band
          <g>
            <path
              d="M 68 50 Q 80 54 92 50 L 92 40 Q 80 44 68 40 Z"
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <line x1="80" y1="52" x2="80" y2="120" stroke={LINE} strokeWidth="1" />
            <circle cx="80" cy="62" r="1.5" fill={LINE} />
            <circle cx="80" cy="76" r="1.5" fill={LINE} />
            <circle cx="80" cy="90" r="1.5" fill={LINE} />
          </g>
        ) : isPeterPan ? (
          // Rounded Peter Pan collars
          <g>
            <path
              d="M 80 52 C 70 52 60 56 60 66 C 60 76 74 74 79 56 Z"
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <path
              d="M 80 52 C 90 52 100 56 100 66 C 100 76 86 74 81 56 Z"
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <line x1="80" y1="56" x2="80" y2="120" stroke={LINE} strokeWidth="1" />
          </g>
        ) : isNotched ? (
          // Notched lapel
          <g>
            <path
              d="M 66 48 L 56 72 L 68 76 L 62 100 L 80 100 L 80 52 Z"
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <path
              d="M 94 48 L 104 72 L 92 76 L 98 100 L 80 100 L 80 52 Z"
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <line x1="80" y1="100" x2="80" y2="125" stroke={LINE} strokeWidth="1" />
          </g>
        ) : (
          // Standard / spread shirt collar
          <g>
            <path
              d={isSpread ? 'M 66 46 L 52 68 L 76 60 L 80 52 Z' : 'M 66 46 L 58 76 L 78 62 L 80 52 Z'}
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <path
              d={isSpread ? 'M 94 46 L 108 68 L 84 60 L 80 52 Z' : 'M 94 46 L 102 76 L 82 62 L 80 52 Z'}
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <line x1="80" y1="54" x2="80" y2="120" stroke={LINE} strokeWidth="1" />
            <circle cx="80" cy="72" r="1.5" fill={LINE} />
            <circle cx="80" cy="90" r="1.5" fill={LINE} />
          </g>
        )}
      </svg>
    );
  }

  // 5. FIT & SILHOUETTE (Context-aware for bottoms, lehengas, and tops)
  if (
    cat === 'fit' ||
    fid.startsWith('fit_') ||
    ((cat === 'silhouette' || fid.startsWith('silhouette_')) && isLehenga)
  ) {
    if (isBottom) {
      // Trouser thumbnail representation (matching Image 1 & 5)
      const isFlared = fid.includes('flared') || fid.includes('a_line');
      const isWide = fid.includes('relaxed') || fid.includes('oversized') || fid.includes('wide');
      const isSkinny = fid.includes('slim') || fid.includes('skinny') || fid.includes('bodycon');

      let tPath: string;
      if (isFlared) {
        // Bell-bottom flared hem
        tPath =
          'M 54 35 Q 58 75 62 105 Q 58 135 42 160 L 74 160 Q 72 135 73 105 L 80 85 L 87 105 Q 88 135 86 160 L 118 160 Q 102 135 98 105 Q 102 75 106 35 Z';
      } else if (isWide) {
        // Wide palazzo leg
        tPath = 'M 54 35 L 36 160 L 76 160 L 80 85 L 84 160 L 124 160 L 106 35 Z';
      } else if (isSkinny) {
        // Tapered skinny leg
        tPath =
          'M 52 35 Q 58 85 64 120 L 66 160 L 76 160 L 76 120 L 80 85 L 84 120 L 84 160 L 94 160 L 96 120 Q 102 85 108 35 Z';
      } else {
        // Straight / Tailored / Regular
        tPath = 'M 50 35 L 50 160 L 74 160 L 77 85 L 80 85 L 83 85 L 86 160 L 110 160 L 110 35 Z';
      }

      return (
        <svg
          viewBox={viewBox}
          className={`w-auto ${hClass} transition-transform hover:scale-105`}
          aria-hidden="true"
          fill="none"
        >
          <path
            d="M 44 26 Q 80 29 116 26 M 80 22 L 80 40"
            stroke={MANNEQUIN_DASH}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <path d={tPath} fill={CLOTH} stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M 50 45 Q 80 47 110 45" stroke={LINE} strokeWidth="1" />
          <line x1="80" y1="45" x2="80" y2="70" stroke={LINE_MUTED} strokeWidth="0.9" />
          <circle cx="80" cy="40" r="1.5" fill={LINE} />
          {(fid.includes('tailored') || fid.includes('straight') || fid.includes('regular')) && (
            <path d="M 62 52 L 62 152 M 98 52 L 98 152" stroke={LINE_MUTED} strokeWidth="0.75" strokeDasharray="3 3" />
          )}
        </svg>
      );
    }

    if (isLehenga || isSkirt) {
      // Skirt / Lehenga Skirt thumbnail representation
      const isSlim = fid.includes('slim') || fid.includes('mermaid');
      const isRelaxed = fid.includes('relaxed');
      const isOversized = fid.includes('oversized') || fid.includes('flared') || fid.includes('umbrella');

      let sPath: string;
      if (isSlim) {
        // Option A: Mermaid / Fish-cut (hugs hips, flares at knee)
        sPath = 'M 62 38 Q 80 41 98 38 Q 96 80 92 110 Q 104 135 120 160 L 40 160 Q 56 135 68 110 Q 64 80 62 38 Z';
      } else if (isOversized) {
        // Option D: Maximum Volume Umbrella Full Flare
        sPath = 'M 62 38 Q 80 41 98 38 L 138 160 Q 80 168 22 160 Z';
      } else if (isRelaxed) {
        // Option C: Relaxed Flowing Kalis
        sPath = 'M 62 38 Q 80 41 98 38 L 126 160 Q 80 165 34 160 Z';
      } else {
        // Option B: Regular A-Line standard volume
        sPath = 'M 62 38 Q 80 41 98 38 L 118 160 Q 80 164 42 160 Z';
      }

      return (
        <svg
          viewBox={viewBox}
          className={`w-auto ${hClass} transition-transform hover:scale-105`}
          aria-hidden="true"
          fill="none"
        >
          <path d="M 54 30 Q 80 33 106 30" stroke={MANNEQUIN_DASH} strokeWidth="1" strokeDasharray="2 2" />
          <path d={sPath} fill={CLOTH} stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M 62 46 Q 80 49 98 46" stroke={LINE} strokeWidth="1.2" fill={CLOTH_SHADOW} />
          {/* Kalis panel lines */}
          <line x1="72" y1="46" x2="62" y2="158" stroke={LINE_MUTED} strokeWidth="0.8" />
          <line x1="80" y1="46" x2="80" y2="160" stroke={LINE_MUTED} strokeWidth="0.8" />
          <line x1="88" y1="46" x2="98" y2="158" stroke={LINE_MUTED} strokeWidth="0.8" />
          {/* Zari hem border */}
          <path
            d="M 38 153 Q 80 157 122 153 L 124 160 Q 80 164 36 160 Z"
            fill={ACCENT}
            stroke={LINE}
            strokeWidth="0.8"
          />
        </svg>
      );
    }

    // Default: Bodice / Garment fit for tops
    const isSlim = fid.includes('slim');
    const isRelaxed = fid.includes('relaxed') || fid.includes('oversized');
    const isALine = fid.includes('a_line') || fid.includes('flared');
    const isTailored = fid.includes('tailored');

    const waistW = isSlim ? 24 : isRelaxed ? 38 : 30;
    const hemW = isALine ? 48 : isRelaxed ? 40 : isSlim ? 26 : 32;

    return (
      <svg
        viewBox={viewBox}
        className={`w-auto ${hClass} transition-transform hover:scale-105`}
        aria-hidden="true"
        fill="none"
      >
        {/* Mannequin guide */}
        <path
          d="M 52 35 Q 80 38 108 35 M 80 32 L 80 145"
          stroke={MANNEQUIN_DASH}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {/* Bodice / Garment */}
        <path
          d={`M 50 45 L ${80 - waistW} 85 L ${80 - hemW} 135 L ${80 + hemW} 135 L ${80 + waistW} 85 L 110 45 Z`}
          fill={CLOTH}
          stroke={LINE}
          strokeWidth="1.3"
        />
        <path d="M 68 45 Q 80 58 92 45" stroke={LINE} strokeWidth="1.1" />

        {/* Tailored darts or relaxed drape folds */}
        {isTailored && (
          <g stroke={LINE_MUTED} strokeWidth="0.8">
            <line x1="72" y1="75" x2="72" y2="98" />
            <line x1="88" y1="75" x2="88" y2="98" />
          </g>
        )}
        {isRelaxed && (
          <g stroke={LINE_MUTED} strokeWidth="0.8">
            <path d="M 64 80 Q 72 105 70 135" />
            <path d="M 96 80 Q 88 105 90 135" />
          </g>
        )}
      </svg>
    );
  }

  // 7. PLEATS & TROUSER HEM
  if (cat === 'pleats' || cat === 'bottom_hem' || fid.startsWith('pleats_') || fid.startsWith('bottom_hem_')) {
    const isDouble = fid.includes('double');
    const isSingle = fid.includes('single');
    const isCuffed = fid.includes('cuffed') || fid.includes('turn_up');

    return (
      <svg viewBox={viewBox} className={`w-auto ${hClass}`} aria-hidden="true" fill="none">
        <path d="M 44 40 L 48 145 L 112 145 L 116 40 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
        <path d="M 44 54 L 116 54" stroke={LINE} strokeWidth="1" />

        {isSingle && (
          <g stroke={LINE} strokeWidth="1.1">
            <line x1="64" y1="54" x2="64" y2="140" />
            <line x1="96" y1="54" x2="96" y2="140" />
          </g>
        )}
        {isDouble && (
          <g stroke={LINE} strokeWidth="0.9">
            <line x1="60" y1="54" x2="60" y2="135" />
            <line x1="68" y1="54" x2="68" y2="135" />
            <line x1="92" y1="54" x2="92" y2="135" />
            <line x1="100" y1="54" x2="100" y2="135" />
          </g>
        )}
        {isCuffed && <rect x="47" y="132" width="66" height="13" fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1.1" />}
      </svg>
    );
  }

  // DEFAULT / FALLBACK: Atelier dummy icon (no option should reach this; tests check, #163)
  return (
    <svg viewBox={viewBox} className={`w-auto ${hClass}`} aria-hidden="true" fill="none" data-thumbnail="placeholder">
      <rect x="42" y="32" width="76" height="106" rx="12" fill={CLOTH} stroke={LINE} strokeWidth="1.2" />
      <circle cx="80" cy="70" r="16" stroke={LINE_MUTED} strokeWidth="1" strokeDasharray="3 3" />
      <path d="M 68 105 Q 80 115 92 105" stroke={LINE} strokeWidth="1.2" />
    </svg>
  );
}

// --- LOWER BODY VISUAL CUSTOMER MANNEQUIN -------------------------------------------------------------

interface LowerBodyMannequinProps {
  selected: Record<string, string>;
  department?: string;
  garmentId?: string;
}

/**
 * Atelier Sketch Mannequin for Lower Body Garments (Trousers, Jeans, Palazzo, Skirt).
 * Allows users to visually try on cuts, waist rises, pleats, length, and fit.
 */
export function LowerBodyMannequin({ selected, garmentId }: LowerBodyMannequinProps) {
  // Extract user choices
  const legShape = selected.leg_shape ?? '';
  const waistline = selected.waistline ?? '';
  const waistband = selected.waistband ?? '';
  const fit = selected.fit ?? '';
  const length = selected.length ?? '';
  const pleats = selected.pleats ?? '';
  const bottomHem = selected.bottom_hem ?? '';
  const pockets = selected.pockets ?? '';
  const pattern = selected.pattern ?? '';

  const isSkirt = garmentId === 'skirt';

  // Fit and silhouette classification
  const isFlared = legShape.includes('flared') || fit.includes('flared') || fit.includes('a_line');

  const isWide =
    legShape.includes('wide') || legShape.includes('palazzo') || fit.includes('relaxed') || fit.includes('oversized');

  const isSkinny =
    legShape.includes('skinny') || fit.includes('skinny') || fit.includes('bodycon') || fit.includes('slim');

  const isTapered = legShape.includes('tapered') || fit.includes('tapered');

  const isCargo = pockets.includes('cargo') || fit.includes('cargo') || pockets.includes('patch');

  const isCropped = length.includes('cropped') || length.includes('above_ankle') || length.includes('midi');

  // 1. Calculate Waistline Y
  let waistY = 38;
  if (waistline.includes('high') || waistline.includes('empire')) {
    waistY = 24; // High rise above navel
  } else if (waistline.includes('low')) {
    waistY = 52; // Low rise on hips
  }

  // 2. Calculate Hem Y
  let hemY = 215; // Ankle / Standard
  if (isCropped) {
    hemY = 175; // Cropped calf/midi
  } else if (length.includes('floor') || length.includes('full_length')) {
    hemY = 232; // Floor-length
  }

  // 3. Build Trouser Silhouette Path
  let trouserPath: string;
  const crotchY = 96;

  if (isFlared) {
    trouserPath = `
      M 74 ${waistY}
      Q 66 68 68 96
      Q 73 130 74 140
      L 42 ${hemY}
      L 86 ${hemY}
      Q 86 148 90 140
      L 98 ${crotchY}
      L 106 140
      Q 110 148 114 ${hemY}
      L 158 ${hemY}
      L 126 140
      Q 127 130 132 96
      Q 134 68 126 ${waistY}
      Z
    `;
  } else if (isWide) {
    trouserPath = `
      M 74 ${waistY}
      Q 64 68 58 96
      L 38 ${hemY}
      L 88 ${hemY}
      L 98 ${crotchY}
      L 112 ${hemY}
      L 162 ${hemY}
      L 142 96
      Q 136 68 126 ${waistY}
      Z
    `;
  } else if (isSkinny) {
    trouserPath = `
      M 74 ${waistY}
      Q 68 68 70 96
      Q 74 145 77 150
      L 78 ${hemY}
      L 90 ${hemY}
      L 92 150
      L 98 ${crotchY}
      L 106 150
      L 110 ${hemY}
      L 122 ${hemY}
      L 123 150
      Q 126 145 130 96
      Q 132 68 126 ${waistY}
      Z
    `;
  } else if (isTapered) {
    trouserPath = `
      M 74 ${waistY}
      Q 63 68 65 96
      Q 70 145 74 148
      L 76 ${hemY}
      L 88 ${hemY}
      L 92 148
      L 98 ${crotchY}
      L 106 148
      L 112 ${hemY}
      L 124 ${hemY}
      Q 130 145 135 96
      Q 137 68 126 ${waistY}
      Z
    `;
  } else {
    trouserPath = `
      M 74 ${waistY}
      Q 66 68 67 96
      L 66 ${hemY}
      L 88 ${hemY}
      L 96 ${crotchY}
      L 104 ${crotchY}
      L 112 ${hemY}
      L 134 ${hemY}
      L 133 96
      Q 134 68 126 ${waistY}
      Z
    `;
  }

  // 4. Build Skirt Silhouette Path
  let skirtPath: string;
  if (isSkinny) {
    // Pencil / Slim silhouette
    skirtPath = `
      M 74 ${waistY}
      Q 66 68 66 96
      Q 68 140 72 ${hemY}
      Q 100 ${hemY + 4} 128 ${hemY}
      Q 132 140 134 96
      Q 134 68 126 ${waistY}
      Z
    `;
  } else if (isFlared || isWide) {
    // Dramatic Flared / Full Swing Skirt
    skirtPath = `
      M 74 ${waistY}
      Q 62 68 50 96
      Q 40 140 30 ${hemY}
      Q 100 ${hemY + 10} 170 ${hemY}
      Q 160 140 150 96
      Q 138 68 126 ${waistY}
      Z
    `;
  } else {
    // Classic A-Line Skirt
    skirtPath = `
      M 74 ${waistY}
      Q 64 68 58 96
      L 46 ${hemY}
      Q 100 ${hemY + 6} 154 ${hemY}
      L 142 96
      Q 136 68 126 ${waistY}
      Z
    `;
  }

  const hasTrouserCut = Boolean(legShape || waistline || fit || pleats);
  const hasSkirtCut = Boolean(fit || waistline || waistband || length || pleats);

  return (
    <div className="relative aspect-[200/240] w-full overflow-hidden rounded-2xl border border-[#ecdac7] bg-[#faf6ef] shadow-inner">
      <svg
        viewBox="0 0 200 240"
        className="size-full"
        aria-label="Lower body visual try on"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* --- MANNEQUIN BASE (Atelier dashed sketch outline) --- */}
        <g stroke={MANNEQUIN_DASH} strokeWidth="1.2" strokeDasharray="3.5 3.5" fill="none">
          {/* Waist & Navel */}
          <path d="M 74 38 Q 100 42 126 38" />
          <circle cx="100" cy="34" r="1.5" fill={MANNEQUIN_DASH} stroke="none" />

          {isSkirt ? (
            // Legs peeking out below skirt hem only (No crotch or upper trouser lines)
            hemY < 225 && (
              <>
                <path d={`M 74 ${Math.max(hemY, 150)} Q 72 185 74 215 L 72 232 L 94 232 L 92 215 L 94 185`} />
                <path d={`M 126 ${Math.max(hemY, 150)} Q 128 185 126 215 L 128 232 L 106 232 L 108 215 L 106 185`} />
              </>
            )
          ) : (
            // Full Trouser Mannequin Legs
            <>
              <path d="M 74 38 Q 64 70 66 96 Q 69 145 72 185 L 74 215 L 72 232 L 94 232 L 92 215 L 94 185 L 96 145 L 98 96" />
              <path d="M 126 38 Q 136 70 134 96 Q 131 145 128 185 L 126 215 L 128 232 L 106 232 L 108 215 L 106 185 L 104 145 L 102 96" />
              <circle cx="83" cy="148" r="4" strokeWidth="0.8" />
              <circle cx="117" cy="148" r="4" strokeWidth="0.8" />
            </>
          )}
        </g>

        {/* --- DYNAMIC SKIRT TRY-ON LAYER --- */}
        {isSkirt ? (
          <g>
            {/* Skirt Garment Body */}
            <path d={skirtPath} fill={CLOTH} stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />

            {/* Skirt Waistband */}
            <path
              d={`M 74 ${waistY} Q 100 ${waistY + 4} 126 ${waistY} L 126 ${waistY + 8} Q 100 ${waistY + 12} 74 ${waistY + 8} Z`}
              fill={CLOTH_SHADOW}
              stroke={LINE}
              strokeWidth="1.2"
            />
            <circle cx="100" cy={waistY + 4} r="1.5" fill={LINE} />

            {/* Pleats & Gathers */}
            {(pleats.includes('pleated') ||
              pleats.includes('box') ||
              pleats.includes('knife') ||
              pleats.includes('single') ||
              pleats.includes('double')) && (
              <g stroke={LINE_MUTED} strokeWidth="0.85">
                <line x1="82" y1={waistY + 8} x2="65" y2={hemY} />
                <line x1="90" y1={waistY + 8} x2="82" y2={hemY + 3} />
                <line x1="100" y1={waistY + 8} x2="100" y2={hemY + 5} />
                <line x1="110" y1={waistY + 8} x2="118" y2={hemY + 3} />
                <line x1="118" y1={waistY + 8} x2="135" y2={hemY} />
              </g>
            )}

            {/* Pencil Skirt Back Vent / Slit */}
            {isSkinny && <line x1="100" y1={hemY - 24} x2="100" y2={hemY + 3} stroke={LINE} strokeWidth="1.2" />}

            {/* Side pockets */}
            {pockets.includes('side') && (
              <g stroke={LINE} strokeWidth="0.9">
                <path d={`M 66 ${waistY + 12} Q 60 ${waistY + 24} 64 ${waistY + 36}`} />
                <path d={`M 134 ${waistY + 12} Q 140 ${waistY + 24} 136 ${waistY + 36}`} />
              </g>
            )}

            {/* Hemline Stitch / Accent Border */}
            <path
              d={
                isSkinny
                  ? `M 72 ${hemY} Q 100 ${hemY + 4} 128 ${hemY}`
                  : isFlared || isWide
                    ? `M 30 ${hemY} Q 100 ${hemY + 10} 170 ${hemY}`
                    : `M 46 ${hemY} Q 100 ${hemY + 6} 154 ${hemY}`
              }
              stroke={ACCENT}
              strokeWidth="1.6"
              fill="none"
            />
          </g>
        ) : (
          /* --- DYNAMIC TROUSER TRY-ON LAYER --- */
          hasTrouserCut && (
            <g>
              {/* Trouser Garment Body */}
              <path d={trouserPath} fill={CLOTH} stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />

              {/* Waistband */}
              <path
                d={`M 74 ${waistY + 8} Q 100 ${waistY + 11} 126 ${waistY + 8}`}
                stroke={LINE}
                strokeWidth="1.1"
                fill={CLOTH_SHADOW}
              />
              {/* Front fly line */}
              <path d={`M 100 ${waistY + 8} L 100 ${waistY + 36}`} stroke={LINE} strokeWidth="0.9" />

              {/* Button */}
              <circle cx="100" cy={waistY + 4} r="1.6" fill={LINE} />

              {/* Creases / Pleats */}
              {(pleats.includes('single') || pleats.includes('double') || !pleats) && (
                <g stroke={LINE_MUTED} strokeWidth="0.8" strokeDasharray="3 3">
                  <line x1="77" y1={waistY + 14} x2="77" y2={hemY - 8} />
                  <line x1="123" y1={waistY + 14} x2="123" y2={hemY - 8} />
                  {pleats.includes('double') && (
                    <>
                      <line x1="82" y1={waistY + 12} x2="82" y2={hemY - 25} />
                      <line x1="118" y1={waistY + 12} x2="118" y2={hemY - 25} />
                    </>
                  )}
                </g>
              )}

              {/* Cuffed / Turn-up Hem */}
              {(bottomHem.includes('cuffed') || bottomHem.includes('turn_up')) && (
                <g fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1.1">
                  <rect x="64" y={hemY - 8} width="25" height="8" />
                  <rect x="111" y={hemY - 8} width="25" height="8" />
                </g>
              )}

              {/* Elastic / Drawstring Waistband */}
              {waistband.includes('elastic') && (
                <path
                  d={`M 76 ${waistY + 3} Q 82 ${waistY + 6} 88 ${waistY + 3} M 112 ${waistY + 3} Q 118 ${waistY + 6} 124 ${waistY + 3}`}
                  stroke={LINE_MUTED}
                  strokeWidth="0.8"
                />
              )}
              {waistband.includes('drawstring') && (
                <g transform={`translate(100, ${waistY + 4})`}>
                  <path d="M -3 0 Q -7 -4 -8 1 Q -5 5 0 0 Q 5 5 8 1 Q 7 -4 3 0" stroke={LINE} strokeWidth="1" />
                  <line x1="-2" y1="1" x2="-4" y2="12" stroke={LINE} strokeWidth="0.9" />
                  <line x1="2" y1="1" x2="4" y2="12" stroke={LINE} strokeWidth="0.9" />
                </g>
              )}

              {/* Cargo / Utility Thigh Pockets (Option C in Image 5) */}
              {isCargo && (
                <g fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1">
                  {/* Left cargo pocket */}
                  <rect x="48" y="110" width="18" height="24" rx="2" />
                  <path d="M 47 110 L 57 116 L 67 110 Z" fill={CLOTH} />
                  <line x1="57" y1="116" x2="57" y2="134" stroke={LINE_MUTED} strokeWidth="0.8" />
                  <circle cx="57" cy="113.5" r="1.1" fill={LINE} />

                  {/* Right cargo pocket */}
                  <rect x="134" y="110" width="18" height="24" rx="2" />
                  <path d="M 133 110 L 143 116 L 153 110 Z" fill={CLOTH} />
                  <line x1="143" y1="116" x2="143" y2="134" stroke={LINE_MUTED} strokeWidth="0.8" />
                  <circle cx="143" cy="113.5" r="1.1" fill={LINE} />
                </g>
              )}

              {/* Cropped / Turn-up Cuffs (Option D in Image 5) */}
              {isCropped && (
                <g fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1.1">
                  <rect x="64" y="167" width="25" height="8" rx="1" />
                  <rect x="111" y="167" width="25" height="8" rx="1" />
                </g>
              )}

              {/* Pattern: Stripes on Trousers */}
              {pattern.includes('striped') && (
                <g stroke={LINE} strokeWidth="0.5" opacity="0.25">
                  <line x1="72" y1={waistY + 12} x2="72" y2={hemY - 4} />
                  <line x1="82" y1={waistY + 12} x2="82" y2={hemY - 4} />
                  <line x1="118" y1={waistY + 12} x2="118" y2={hemY - 4} />
                  <line x1="128" y1={waistY + 12} x2="128" y2={hemY - 4} />
                </g>
              )}
            </g>
          )
        )}
      </svg>

      {/* Central Option A prompt if no cut picked yet */}
      {isSkirt && !hasSkirtCut && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <span className="mb-1 text-2xl font-light leading-none text-[#8a6a42]">+</span>
          <span className="font-serif text-xs font-medium tracking-wide text-[#7a5a36]">
            Pick your skirt silhouette
          </span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">A-line, flared, pencil, or pleated</span>
        </div>
      )}
      {!isSkirt && !hasTrouserCut && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <span className="mb-1 text-2xl font-light leading-none text-[#8a6a42]">+</span>
          <span className="font-serif text-xs font-medium tracking-wide text-[#7a5a36]">Pick your trouser cut</span>
          <span className="mt-0.5 text-[10px] text-muted-foreground">Straight, wide leg, flared or slim</span>
        </div>
      )}
    </div>
  );
}

// --- BLOUSE BACK VIEW MANNEQUIN ------------------------------------------------------------------------

interface BlouseBackMannequinProps {
  selected: Record<string, string>;
  department?: string;
}

export function BlouseBackMannequin({ selected }: BlouseBackMannequinProps) {
  const neckId = selected.neckline ?? '';
  const isBackless = neckId.includes('backless') || neckId.includes('dori');
  const isDeepU = neckId.includes('deep_u');
  const isKeyhole = neckId.includes('keyhole');
  const isSheer = neckId.includes('sheer');
  const isSquare = neckId.includes('square');
  const isInvertedV = neckId.includes('inverted_v');

  let cutPath = 'M 72 56 Q 100 115 128 56';
  if (isDeepU) cutPath = 'M 68 56 Q 100 135 132 56';
  if (isBackless) cutPath = 'M 62 56 Q 100 152 138 56';
  if (isSquare) cutPath = 'M 72 56 L 72 125 L 128 125 L 128 56';
  if (isInvertedV) cutPath = 'M 68 56 L 100 142 L 132 56';
  if (isKeyhole) cutPath = 'M 100 70 C 86 86 86 112 100 125 C 114 112 114 86 100 70 Z';

  return (
    <div className="relative aspect-[200/240] w-full overflow-hidden rounded-2xl border border-[#ecdac7] bg-[#faf6ef] shadow-inner">
      <svg
        viewBox="0 0 200 240"
        className="size-full"
        aria-label="Blouse back view try on"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Atelier dashed sketch mannequin back */}
        <g stroke={MANNEQUIN_DASH} strokeWidth="1.2" strokeDasharray="3.5 3.5" fill="none">
          <ellipse cx="100" cy="27" rx="14" ry="17" />
          <path d="M 93 38 L 93 54 M 107 38 L 107 54" />
          <path d="M 100 54 L 100 190" strokeWidth="0.8" />
          <path d="M 64 72 Q 100 68 136 72" />
          <path d="M 64 72 Q 69 99 75 152 L 68 198" />
          <path d="M 136 72 Q 131 99 125 152 L 132 198" />
        </g>

        {/* Blouse Bodice Back */}
        <path d="M 60 76 L 72 56 L 128 56 L 140 76 L 132 152 L 68 152 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.3" />

        {/* Back cut-out */}
        <path d={cutPath} fill={isSheer ? '#f5eee3' : '#faf6ef'} stroke={LINE} strokeWidth="1.3" />

        {/* Tie-up Dori and Latkans */}
        {isBackless && (
          <g>
            <path d="M 72 58 Q 100 72 128 58" stroke={LINE} strokeWidth="1.2" />
            <path d="M 100 65 L 94 98 M 100 65 L 106 102" stroke={LINE} strokeWidth="1" />
            <polygon points="90,98 98,98 94,108" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
            <polygon points="102,102 110,102 106,112" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
            <path d="M 68 150 Q 100 154 132 150" stroke={LINE} strokeWidth="1.2" />
          </g>
        )}

        {isKeyhole && <circle cx="100" cy="62" r="1.8" fill={LINE} />}

        {isSheer && (
          <g stroke={LINE_MUTED} strokeWidth="0.6" strokeDasharray="2 2">
            <line x1="82" y1="80" x2="118" y2="80" />
            <line x1="80" y1="96" x2="120" y2="96" />
            <line x1="82" y1="112" x2="118" y2="112" />
            <circle cx="100" cy="85" r="1.2" fill={LINE} />
            <circle cx="100" cy="100" r="1.2" fill={LINE} />
            <circle cx="100" cy="115" r="1.2" fill={LINE} />
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute bottom-2 inset-x-0 text-center">
        <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm border border-border">
          Back View
        </span>
      </div>
    </div>
  );
}

// --- LEHENGA ENSEMBLE VISUAL CUSTOMIZER (BLOUSE + SKIRT + DUPATTA) -----------------------------

export interface LehengaEnsembleMannequinProps {
  selected: Record<string, string>;
  department?: string;
  view?: 'ensemble' | 'choli' | 'skirt';
}

/**
 * Fashion Atelier illustration for Lehenga Choli ensembles (matching reference images 2, 3, and 4).
 * Supports 3 views:
 * - 'ensemble': Full ensemble showing Choli Blouse, midriff, embellished Lehenga Skirt, and Dupatta drape.
 * - 'choli': Focused zoomed view on the Choli / Blouse (neckline, collar, sleeves, bodice fit).
 * - 'skirt': Focused zoomed view on the Lehenga Skirt (A-Line, Full Flare, Mermaid, Kalis, Waistband & Latkans).
 */
export function LehengaEnsembleMannequin({ selected, view = 'ensemble' }: LehengaEnsembleMannequinProps) {
  const neckId = selected.neckline ?? '';
  const sleeveId = selected.sleeve ?? '';
  const fitId = selected.fit ?? '';
  const silId = selected.silhouette ?? '';
  const drapeId = selected.draping ?? '';

  // Fit & flare classification for the lehenga skirt
  const isMermaid = fitId.includes('slim') || silId.includes('mermaid') || silId.includes('sheath');
  const isUmbrella =
    fitId.includes('oversized') || silId.includes('flared') || fitId.includes('flared') || silId.includes('umbrella');
  const isRelaxed = fitId.includes('relaxed') || silId.includes('layered') || silId.includes('draped');

  // Choli fit classification
  const isCholiSlim = fitId.includes('slim') || fitId.includes('bodycon') || fitId.includes('tailored');
  const isCholiOversized = fitId.includes('oversized');
  const isCholiRelaxed = fitId.includes('relaxed');

  // Skirt path for Full Ensemble view (y: 116 to 232)
  let ensembleSkirtPath: string;
  if (isMermaid) {
    // Option A: Mermaid / Fish-cut (hugs hips down to knee, flares out to hem)
    ensembleSkirtPath = `
      M 72 120
      Q 68 152 73 175
      Q 64 205 46 232
      L 154 232
      Q 136 205 127 175
      Q 132 152 128 120
      Z
    `;
  } else if (isUmbrella) {
    // Option D: Maximum Volume Umbrella Full Flare / Ghera
    ensembleSkirtPath = `
      M 72 120
      L 22 232
      Q 100 242 178 232
      L 128 120
      Z
    `;
  } else if (isRelaxed) {
    // Option C: Relaxed Flowing Kalis
    ensembleSkirtPath = `
      M 72 120
      L 38 232
      Q 100 239 162 232
      L 128 120
      Z
    `;
  } else {
    // Option B: Regular A-Line standard volume
    ensembleSkirtPath = `
      M 72 120
      L 46 232
      Q 100 238 154 232
      L 128 120
      Z
    `;
  }

  // Skirt path for Skirt Zoomed view (y: 42 to 228)
  let skirtZoomedPath: string;
  if (isMermaid) {
    skirtZoomedPath = `
      M 64 48
      Q 58 100 66 145
      Q 50 190 32 228
      L 168 228
      Q 150 190 134 145
      Q 142 100 136 48
      Z
    `;
  } else if (isUmbrella) {
    skirtZoomedPath = `
      M 64 48
      L 14 228
      Q 100 242 186 228
      L 136 48
      Z
    `;
  } else if (isRelaxed) {
    skirtZoomedPath = `
      M 64 48
      L 24 228
      Q 100 239 176 228
      L 136 48
      Z
    `;
  } else {
    skirtZoomedPath = `
      M 64 48
      L 34 228
      Q 100 238 166 228
      L 136 48
      Z
    `;
  }

  return (
    <div className="relative aspect-[200/240] w-full overflow-hidden rounded-2xl border border-[#ecdac7] bg-[#faf6ef] shadow-inner">
      <svg
        viewBox="0 0 200 240"
        className="size-full"
        aria-label="Lehenga ensemble visual try on"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* --- VIEW 1: FULL ENSEMBLE (Option A/B/C/D from Image 3) --- */}
        {view === 'ensemble' && (
          <g>
            {/* Mannequin Dashed Skeleton Base */}
            <g stroke={MANNEQUIN_DASH} strokeWidth="1.1" strokeDasharray="3 3" fill="none">
              <ellipse cx="100" cy="24" rx="11" ry="14" />
              <path d="M 95 38 L 95 48 M 105 38 L 105 48" />
              <path d="M 64 52 L 136 52" />
              {/* Exposed Arms */}
              <path d="M 64 52 Q 54 85 52 130 M 136 52 Q 146 85 148 130" />
            </g>

            {/* --- 1. CHOLI / BLOUSE GARMENT --- */}
            <g>
              {/* Choli Main Bodice Cloth */}
              <path
                d={
                  isCholiSlim
                    ? 'M 64 52 L 72 98 Q 100 101 128 98 L 136 52 Q 100 58 64 52 Z'
                    : isCholiOversized
                      ? 'M 64 52 Q 58 75 60 98 Q 100 105 140 98 Q 142 75 136 52 Z'
                      : 'M 64 52 L 70 98 Q 100 102 130 98 L 136 52 Q 100 58 64 52 Z'
                }
                fill={CLOTH}
                stroke={LINE}
                strokeWidth="1.3"
                strokeLinejoin="round"
              />

              {/* Choli Neckline Cutout */}
              {neckId.includes('sweetheart') ? (
                <g>
                  <path
                    d="M 85 52 C 87 62 91 58 95 62 Q 98 65 100 73 Q 102 65 105 62 C 109 58 113 62 115 52 L 115 48 Q 100 50 85 48 Z"
                    fill="#faf6ef"
                    stroke="none"
                  />
                  <path
                    d="M 85 52 C 87 62 91 58 95 62 Q 98 65 100 73 Q 102 65 105 62 C 109 58 113 62 115 52"
                    fill="none"
                    stroke={LINE}
                    strokeWidth="1.2"
                  />
                  <path
                    d="M 85 52 C 87 62 91 58 95 62 Q 98 65 100 73 Q 102 65 105 62 C 109 58 113 62 115 52"
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="1.3"
                  />
                </g>
              ) : neckId.includes('deep_v') || neckId.includes('v_neck') ? (
                <g>
                  <path d="M 85 52 L 100 76 L 115 52 L 115 48 Q 100 50 85 48 Z" fill="#faf6ef" stroke="none" />
                  <path d="M 85 52 L 100 76 L 115 52" fill="none" stroke={LINE} strokeWidth="1.2" />
                  <path d="M 85 52 L 100 76 L 115 52" fill="none" stroke={ACCENT} strokeWidth="1.3" />
                </g>
              ) : neckId.includes('square') ? (
                <g>
                  <path d="M 84 52 L 84 68 L 116 68 L 116 52 L 116 48 Q 100 50 84 48 Z" fill="#faf6ef" stroke="none" />
                  <path d="M 84 52 L 84 68 L 116 68 L 116 52" fill="none" stroke={LINE} strokeWidth="1.2" />
                  <path d="M 85 52 L 85 67 L 115 67 L 115 52" fill="none" stroke={ACCENT} strokeWidth="1.3" />
                </g>
              ) : neckId.includes('boat') ? (
                <g>
                  <path d="M 76 50 Q 100 57 124 50 L 124 46 Q 100 48 76 46 Z" fill="#faf6ef" stroke="none" />
                  <path d="M 76 50 Q 100 57 124 50" fill="none" stroke={LINE} strokeWidth="1.2" />
                  <path d="M 76 50 Q 100 57 124 50" fill="none" stroke={ACCENT} strokeWidth="1.3" />
                </g>
              ) : neckId.includes('halter') ? (
                <g>
                  <path d="M 94 38 L 84 52 L 116 52 L 106 38 Z" fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1.2" />
                  <path d="M 84 52 L 100 68 L 116 52" stroke={ACCENT} strokeWidth="1.3" fill="none" />
                </g>
              ) : neckId.includes('mandarin') || neckId.includes('high_neck') ? (
                <g>
                  <path
                    d="M 92 44 L 92 52 Q 100 54 108 52 L 108 44 Q 100 42 92 44 Z"
                    fill={CLOTH_SHADOW}
                    stroke={LINE}
                    strokeWidth="1.2"
                  />
                  <line x1="100" y1="44" x2="100" y2="60" stroke={LINE} strokeWidth="1" />
                  <path d="M 92 44 Q 100 42 108 44" stroke={ACCENT} strokeWidth="1.4" fill="none" />
                </g>
              ) : (
                <g>
                  <path d="M 85 52 Q 100 68 115 52 L 115 48 Q 100 50 85 48 Z" fill="#faf6ef" stroke="none" />
                  <path d="M 85 52 Q 100 68 115 52" fill="none" stroke={LINE} strokeWidth="1.2" />
                  <path d="M 85 52 Q 100 68 115 52" fill="none" stroke={ACCENT} strokeWidth="1.3" />
                </g>
              )}

              {/* Choli Sleeves */}
              {sleeveId.includes('sleeveless') ? (
                <g stroke={LINE} strokeWidth="1.1">
                  <path d="M 64 52 Q 62 70 65 84" />
                  <path d="M 136 52 Q 138 70 135 84" />
                </g>
              ) : sleeveId.includes('puff') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 C 48 48 46 68 54 78 L 68 76 C 62 65 64 55 64 52 Z" />
                  <path
                    d="M 58 56 Q 54 66 60 76 M 62 54 Q 60 66 64 76"
                    stroke={LINE_MUTED}
                    strokeWidth="0.75"
                    fill="none"
                  />
                  <line x1="54" y1="78" x2="68" y2="76" stroke={ACCENT} strokeWidth="1.6" />
                  <path d="M 136 52 C 152 48 154 68 146 78 L 132 76 C 138 65 136 55 136 52 Z" />
                  <path
                    d="M 142 56 Q 146 66 140 76 M 138 54 Q 140 66 136 76"
                    stroke={LINE_MUTED}
                    strokeWidth="0.75"
                    fill="none"
                  />
                  <line x1="146" y1="78" x2="132" y2="76" stroke={ACCENT} strokeWidth="1.6" />
                </g>
              ) : sleeveId.includes('leg_of_mutton') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 C 46 50 44 68 52 82 L 52 145 L 58 145 L 68 76 C 63 65 64 54 64 52 Z" />
                  <path d="M 52 145 L 58 145" stroke={ACCENT} strokeWidth="1.8" />
                  <path d="M 54 60 Q 50 70 56 80" stroke={LINE_MUTED} strokeWidth="0.75" fill="none" />
                  <path d="M 136 52 C 154 50 156 68 148 82 L 148 145 L 142 145 L 132 76 C 137 65 136 54 136 52 Z" />
                  <path d="M 148 145 L 142 145" stroke={ACCENT} strokeWidth="1.8" />
                  <path d="M 146 60 Q 150 70 144 80" stroke={LINE_MUTED} strokeWidth="0.75" fill="none" />
                </g>
              ) : sleeveId.includes('bishop') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 L 56 95 Q 44 125 50 145 L 58 145 Q 64 125 68 95 Z" />
                  <line x1="50" y1="145" x2="58" y2="145" stroke={ACCENT} strokeWidth="1.8" />
                  <path d="M 136 52 L 144 95 Q 156 125 150 145 L 142 145 Q 136 125 132 95 Z" />
                  <line x1="150" y1="145" x2="142" y2="145" stroke={ACCENT} strokeWidth="1.8" />
                </g>
              ) : sleeveId.includes('bell') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 L 56 95 L 42 118 L 62 120 L 68 95 Z" />
                  <path d="M 136 52 L 144 95 L 158 118 L 138 120 L 132 95 Z" />
                  <line x1="42" y1="118" x2="62" y2="120" stroke={ACCENT} strokeWidth="1.6" />
                  <line x1="158" y1="118" x2="138" y2="120" stroke={ACCENT} strokeWidth="1.6" />
                </g>
              ) : sleeveId.includes('full') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 L 54 100 L 52 146 L 60 146 L 67 100 Z" />
                  <path d="M 136 52 L 146 100 L 148 146 L 140 146 L 133 100 Z" />
                  <path
                    d="M 53 125 Q 56 127 59 125 M 52 135 Q 56 137 60 135"
                    stroke={LINE_MUTED}
                    strokeWidth="0.8"
                    fill="none"
                  />
                  <path
                    d="M 147 125 Q 144 127 141 125 M 148 135 Q 144 137 140 135"
                    stroke={LINE_MUTED}
                    strokeWidth="0.8"
                    fill="none"
                  />
                  <line x1="52" y1="146" x2="60" y2="146" stroke={ACCENT} strokeWidth="1.8" />
                  <line x1="148" y1="146" x2="140" y2="146" stroke={ACCENT} strokeWidth="1.8" />
                </g>
              ) : sleeveId.includes('elbow') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 L 55 96 L 67 98 Z" />
                  <path d="M 136 52 L 145 96 L 133 98 Z" />
                  <line x1="55" y1="96" x2="67" y2="98" stroke={ACCENT} strokeWidth="1.8" />
                  <line x1="145" y1="96" x2="133" y2="98" stroke={ACCENT} strokeWidth="1.8" />
                </g>
              ) : sleeveId.includes('three_quarter') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 L 54 116 L 65 118 Z" />
                  <path d="M 136 52 L 146 116 L 135 118 Z" />
                  <line x1="54" y1="116" x2="65" y2="118" stroke={ACCENT} strokeWidth="1.8" />
                  <line x1="146" y1="116" x2="135" y2="118" stroke={ACCENT} strokeWidth="1.8" />
                </g>
              ) : sleeveId.includes('cap') ? (
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 L 60 66 L 68 67 Z" />
                  <path d="M 136 52 L 140 66 L 132 67 Z" />
                </g>
              ) : (
                // Short sleeves (standard)
                <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                  <path d="M 64 52 L 58 76 L 68 78 Z" />
                  <path d="M 136 52 L 142 76 L 132 78 Z" />
                  <line x1="58" y1="76" x2="68" y2="78" stroke={ACCENT} strokeWidth="1.2" />
                  <line x1="142" y1="76" x2="132" y2="78" stroke={ACCENT} strokeWidth="1.2" />
                </g>
              )}

              {/* Golden Zari Embroidery on Choli Bodice & Hem */}
              <path d="M 70 94 Q 100 97 130 94" stroke={ACCENT} strokeWidth="1.5" />
              <path d="M 70 98 Q 100 101 130 98" stroke={LINE} strokeWidth="1" />

              {/* Choli Fit Lines */}
              {isCholiSlim && (
                <g stroke={LINE_MUTED} strokeWidth="0.8">
                  <path d="M 82 72 Q 86 85 86 96" />
                  <path d="M 118 72 Q 114 85 114 96" />
                </g>
              )}
              {isCholiRelaxed && (
                <g stroke={LINE_MUTED} strokeWidth="0.8">
                  <path d="M 80 62 Q 95 78 115 88" />
                  <path d="M 74 78 Q 90 88 108 95" />
                </g>
              )}
              {isCholiOversized && (
                <g stroke={LINE_MUTED} strokeWidth="0.8">
                  <line x1="80" y1="92" x2="80" y2="98" />
                  <line x1="90" y1="93" x2="90" y2="98" />
                  <line x1="100" y1="94" x2="100" y2="98" />
                  <line x1="110" y1="93" x2="110" y2="98" />
                  <line x1="120" y1="92" x2="120" y2="98" />
                </g>
              )}
            </g>

            {/* --- 2. AUTHENTIC MIDRIFF & NAVEL --- */}
            <circle cx="100" cy="108" r="1.5" fill={LINE_MUTED} />

            {/* --- 3. LEHENGA SKIRT GARMENT --- */}
            <g>
              {/* Skirt Body */}
              <path d={ensembleSkirtPath} fill={CLOTH} stroke={LINE} strokeWidth="1.3" strokeLinejoin="round" />

              {/* Embellished Waistband Belt */}
              <path
                d="M 72 116 Q 100 120 128 116 L 128 124 Q 100 128 72 124 Z"
                fill={ACCENT}
                stroke={LINE}
                strokeWidth="1.2"
              />
              <path d="M 72 120 Q 100 124 128 120" stroke={LINE_MUTED} strokeWidth="0.8" strokeDasharray="2 2" />

              {/* Hanging Dori Ties & Decorative Latkans (Tassels) */}
              <g>
                <path d="M 78 124 Q 74 135 76 152" stroke={LINE} strokeWidth="1" fill="none" />
                <path d="M 78 124 Q 82 135 80 148" stroke={LINE} strokeWidth="0.9" fill="none" />
                {/* Latkan 1 */}
                <polygon points="73,152 79,152 76,160" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
                <circle cx="76" cy="151" r="1.3" fill={LINE} />
                {/* Latkan 2 */}
                <polygon points="77,148 83,148 80,156" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
                <circle cx="80" cy="147" r="1.3" fill={LINE} />
              </g>

              {/* Kalis (Radiating Skirt Panel Seams) */}
              <g stroke={LINE_MUTED} strokeWidth="0.75" strokeDasharray="none" opacity="0.85">
                {isMermaid ? (
                  <>
                    <path d="M 84 124 Q 82 165 72 232" />
                    <path d="M 94 124 Q 93 165 92 232" />
                    <path d="M 106 124 Q 107 165 108 232" />
                    <path d="M 116 124 Q 118 165 128 232" />
                  </>
                ) : isUmbrella ? (
                  <>
                    <line x1="80" y1="124" x2="52" y2="234" />
                    <line x1="88" y1="124" x2="74" y2="236" />
                    <line x1="96" y1="124" x2="94" y2="238" />
                    <line x1="104" y1="124" x2="106" y2="238" />
                    <line x1="112" y1="124" x2="126" y2="236" />
                    <line x1="120" y1="124" x2="148" y2="234" />
                  </>
                ) : (
                  <>
                    <line x1="82" y1="124" x2="68" y2="233" />
                    <line x1="92" y1="124" x2="88" y2="235" />
                    <line x1="102" y1="124" x2="104" y2="235" />
                    <line x1="112" y1="124" x2="124" y2="233" />
                    <line x1="120" y1="124" x2="140" y2="232" />
                  </>
                )}
              </g>

              {/* Rich Zari Embroidery Hem Border */}
              <g>
                <path
                  d={
                    isUmbrella
                      ? 'M 24 224 Q 100 234 176 224 L 178 232 Q 100 242 22 232 Z'
                      : 'M 48 224 Q 100 230 152 224 L 154 232 Q 100 238 46 232 Z'
                  }
                  fill={ACCENT}
                  stroke={LINE}
                  strokeWidth="1.1"
                />
                <path
                  d={
                    isUmbrella
                      ? 'M 28 228 Q 36 225 44 228 Q 52 225 60 228 Q 68 225 76 228 Q 84 225 92 228 Q 100 225 108 228 Q 116 225 124 228 Q 132 225 140 228 Q 148 225 156 228 Q 164 225 172 228'
                      : 'M 52 228 Q 60 225 68 228 Q 76 225 84 228 Q 92 225 100 228 Q 108 225 116 228 Q 124 225 132 228 Q 140 225 148 228'
                  }
                  stroke={LINE}
                  strokeWidth="0.8"
                  fill="none"
                />
              </g>
            </g>

            {/* --- 4. DUPATTA DRAPE (Dynamic based on selected draping style) --- */}
            {drapeId.includes('straight') ? (
              // Straight Open Drape
              <g>
                <path
                  d="M 64 52 L 40 145 L 36 215 L 68 215 L 74 145 L 72 52 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.2"
                  opacity="0.9"
                />
                <path d="M 64 52 L 40 145 L 36 215" stroke={ACCENT} strokeWidth="2.4" />
                <path d="M 66 52 L 42 145 L 38 215" stroke={LINE} strokeWidth="0.8" />
                <path d="M 72 52 L 74 145 L 68 215" stroke={ACCENT} strokeWidth="2.4" />
                <path d="M 36 215 L 68 215" stroke={ACCENT} strokeWidth="2.4" />
                <line x1="52" y1="90" x2="52" y2="180" stroke={LINE_MUTED} strokeWidth="0.75" strokeDasharray="3 3" />
                <line x1="60" y1="100" x2="60" y2="190" stroke={LINE_MUTED} strokeWidth="0.75" strokeDasharray="3 3" />
              </g>
            ) : drapeId.includes('gathered') ? (
              // Gathered Cowl Drape
              <g>
                <path
                  d="M 64 52 Q 95 90 128 115 L 126 122 Q 90 98 62 56 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.1"
                  opacity="0.92"
                />
                <path d="M 64 52 Q 96 82 128 110" stroke={ACCENT} strokeWidth="1.6" />
                <path d="M 62 58 Q 94 92 126 116" stroke={LINE_MUTED} strokeWidth="0.8" />
                <path d="M 60 66 Q 90 102 122 122" stroke={LINE_MUTED} strokeWidth="0.8" />
                <path
                  d="M 124 116 Q 132 145 130 175 L 138 172 Q 138 140 128 112 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1"
                />
                <path d="M 130 175 L 138 172" stroke={ACCENT} strokeWidth="1.6" />
              </g>
            ) : drapeId.includes('wrap') || drapeId.includes('front_pallu') ? (
              // Front Pallu / Gujarati Wrap Drape
              <g>
                <path
                  d="M 136 52 Q 105 85 72 118 L 68 110 Q 102 75 128 52 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.2"
                  opacity="0.92"
                />
                <path d="M 136 52 Q 105 85 72 118" stroke={ACCENT} strokeWidth="2.5" />
                <path d="M 134 50 Q 103 83 70 116" stroke={LINE} strokeWidth="0.8" />
                <path d="M 130 52 Q 100 80 74 105" stroke={LINE_MUTED} strokeWidth="0.8" />
                <path d="M 124 52 Q 95 76 76 96" stroke={LINE_MUTED} strokeWidth="0.8" />
              </g>
            ) : drapeId.includes('belted') ? (
              // Belted Drape
              <g>
                <path
                  d="M 64 52 Q 62 82 74 120 L 86 120 Q 72 82 76 52 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.1"
                  opacity="0.92"
                />
                <path d="M 68 52 Q 66 82 78 120" stroke={LINE_MUTED} strokeWidth="0.75" />
                <path d="M 72 52 Q 70 82 82 120" stroke={LINE_MUTED} strokeWidth="0.75" />
                <path d="M 64 52 Q 62 82 74 120" stroke={ACCENT} strokeWidth="1.4" />
                {/* Embellished Kamarbandh / Waist Belt cinching the dupatta firmly */}
                <path
                  d="M 68 118 Q 100 123 132 118 L 132 124 Q 100 129 68 124 Z"
                  fill={ACCENT}
                  stroke={LINE}
                  strokeWidth="1.3"
                />
                <circle cx="100" cy="121" r="2.2" fill={LINE} />
                <circle cx="94" cy="121" r="1.2" fill="#fff" />
                <circle cx="106" cy="121" r="1.2" fill="#fff" />
                <path
                  d="M 74 124 Q 72 150 70 175 L 82 172 Q 82 148 84 124 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1"
                />
                <path d="M 70 175 L 82 172" stroke={ACCENT} strokeWidth="1.6" />
              </g>
            ) : drapeId.includes('cape') ? (
              // Royal Cape Drape
              <g>
                <path
                  d="M 64 52 Q 46 80 44 140 L 56 138 Q 58 85 70 52 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.1"
                  opacity="0.9"
                />
                <path d="M 44 140 L 56 138" stroke={ACCENT} strokeWidth="1.8" />
                <path d="M 44 140 Q 46 80 64 52" stroke={ACCENT} strokeWidth="1.6" />
                <path
                  d="M 136 52 Q 154 80 156 140 L 144 138 Q 142 85 130 52 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.1"
                  opacity="0.9"
                />
                <path d="M 156 140 L 144 138" stroke={ACCENT} strokeWidth="1.8" />
                <path d="M 156 140 Q 154 80 136 52" stroke={ACCENT} strokeWidth="1.6" />
                <path d="M 68 52 Q 100 58 132 52" stroke={ACCENT} strokeWidth="1.5" fill="none" />
              </g>
            ) : (
              // Classic Pleated Drape
              <g>
                <path
                  d="M 64 52 Q 60 80 76 122 L 86 122 Q 72 80 75 52 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.1"
                  opacity="0.92"
                />
                <path d="M 68 52 Q 64 80 80 122" stroke={LINE_MUTED} strokeWidth="0.75" />
                <path d="M 72 52 Q 68 80 84 122" stroke={LINE_MUTED} strokeWidth="0.75" />
                <path d="M 64 52 Q 60 80 76 122" stroke={ACCENT} strokeWidth="1.4" />
              </g>
            )}
          </g>
        )}

        {/* --- VIEW 2: LEHENGA SKIRT (Option A/B/C/D from Image 4) --- */}
        {view === 'skirt' && (
          <g>
            {/* Mannequin Hip Guide */}
            <path
              d="M 60 38 Q 100 42 140 38"
              stroke={MANNEQUIN_DASH}
              strokeWidth="1.1"
              strokeDasharray="3 3"
              fill="none"
            />
            <circle cx="100" cy="36" r="1.5" fill={MANNEQUIN_DASH} />

            {/* Skirt Body */}
            <path d={skirtZoomedPath} fill={CLOTH} stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" />

            {/* Detailed High Waistband */}
            <path d="M 64 42 Q 100 46 136 42 L 136 54 Q 100 58 64 54 Z" fill={ACCENT} stroke={LINE} strokeWidth="1.3" />
            <path d="M 64 48 Q 100 52 136 48" stroke={LINE} strokeWidth="0.8" strokeDasharray="2 2" />

            {/* Hanging Latkans & Dori Ties */}
            <g>
              <path d="M 72 54 Q 68 75 70 102" stroke={LINE} strokeWidth="1.1" fill="none" />
              <path d="M 72 54 Q 78 75 76 96" stroke={LINE} strokeWidth="0.9" fill="none" />
              <polygon points="66,102 74,102 70,114" fill={ACCENT} stroke={LINE} strokeWidth="0.7" />
              <circle cx="70" cy="100" r="1.5" fill={LINE} />
              <polygon points="72,96 80,96 76,108" fill={ACCENT} stroke={LINE} strokeWidth="0.7" />
              <circle cx="76" cy="94" r="1.5" fill={LINE} />
            </g>

            {/* Kalis Panels */}
            <g stroke={LINE_MUTED} strokeWidth="0.85">
              {isMermaid ? (
                <>
                  <path d="M 80 54 Q 76 135 60 228" />
                  <path d="M 92 54 Q 90 135 88 228" />
                  <path d="M 108 54 Q 110 135 112 228" />
                  <path d="M 120 54 Q 124 135 140 228" />
                </>
              ) : isUmbrella ? (
                <>
                  <line x1="74" y1="54" x2="34" y2="230" />
                  <line x1="84" y1="54" x2="62" y2="234" />
                  <line x1="94" y1="54" x2="88" y2="237" />
                  <line x1="106" y1="54" x2="112" y2="237" />
                  <line x1="116" y1="54" x2="138" y2="234" />
                  <line x1="126" y1="54" x2="166" y2="230" />
                </>
              ) : (
                <>
                  <line x1="76" y1="54" x2="55" y2="230" />
                  <line x1="88" y1="54" x2="82" y2="234" />
                  <line x1="100" y1="54" x2="100" y2="235" />
                  <line x1="112" y1="54" x2="118" y2="234" />
                  <line x1="124" y1="54" x2="145" y2="230" />
                </>
              )}
            </g>

            {/* Wide Intricate Hem Border */}
            <g>
              <path
                d={
                  isUmbrella
                    ? 'M 16 216 Q 100 230 184 216 L 186 228 Q 100 242 14 228 Z'
                    : 'M 36 216 Q 100 226 164 216 L 166 228 Q 100 238 34 228 Z'
                }
                fill={ACCENT}
                stroke={LINE}
                strokeWidth="1.2"
              />
              <line
                x1={isUmbrella ? 16 : 36}
                y1={220}
                x2={isUmbrella ? 184 : 164}
                y2={220}
                stroke={LINE}
                strokeWidth="0.8"
                strokeDasharray="3 2"
              />
            </g>
          </g>
        )}

        {/* --- VIEW 3: CHOLI / BLOUSE ZOOMED (Option A/B from Image 2) --- */}
        {view === 'choli' && (
          <g transform="translate(0, 10)">
            {/* Torso & Neck Skeleton */}
            <ellipse
              cx="100"
              cy="30"
              rx="14"
              ry="17"
              stroke={MANNEQUIN_DASH}
              strokeWidth="1.2"
              strokeDasharray="3 3"
              fill="none"
            />
            <path d="M 92 45 L 92 60 M 108 45 L 108 60" stroke={MANNEQUIN_DASH} strokeWidth="1" strokeDasharray="3 3" />

            {/* Choli Bodice Main */}
            <path
              d={
                isCholiSlim
                  ? 'M 54 62 L 66 148 Q 100 152 134 148 L 146 62 Q 100 70 54 62 Z'
                  : 'M 54 62 L 62 148 Q 100 154 138 148 L 146 62 Q 100 70 54 62 Z'
              }
              fill={CLOTH}
              stroke={LINE}
              strokeWidth="1.4"
            />

            {/* Neckline */}
            {neckId.includes('sweetheart') ? (
              <g>
                <path
                  d="M 78 62 C 82 76 88 70 93 75 Q 97 78 100 90 Q 103 78 107 75 C 112 70 118 76 122 62 L 122 54 Q 100 58 78 54 Z"
                  fill="#faf6ef"
                  stroke="none"
                />
                <path
                  d="M 78 62 C 82 76 88 70 93 75 Q 97 78 100 90 Q 103 78 107 75 C 112 70 118 76 122 62"
                  fill="none"
                  stroke={LINE}
                  strokeWidth="1.4"
                />
                <path
                  d="M 80 62 C 83 74 88 68 93 73 Q 97 76 100 87 Q 103 76 107 73 C 112 68 117 74 120 62"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="1.4"
                />
              </g>
            ) : neckId.includes('deep_v') || neckId.includes('v_neck') ? (
              <g>
                <path d="M 78 62 L 100 102 L 122 62 L 122 54 Q 100 58 78 54 Z" fill="#faf6ef" stroke="none" />
                <path d="M 78 62 L 100 102 L 122 62" fill="none" stroke={LINE} strokeWidth="1.4" />
                <path d="M 80 62 L 100 99 L 120 62" fill="none" stroke={ACCENT} strokeWidth="1.4" />
              </g>
            ) : neckId.includes('square') ? (
              <g>
                <path d="M 78 62 L 78 92 L 122 92 L 122 62 L 122 54 Q 100 58 78 54 Z" fill="#faf6ef" stroke="none" />
                <path d="M 78 62 L 78 92 L 122 92 L 122 62" fill="none" stroke={LINE} strokeWidth="1.4" />
                <path d="M 80 62 L 80 90 L 120 90 L 120 62" fill="none" stroke={ACCENT} strokeWidth="1.4" />
              </g>
            ) : neckId.includes('boat') ? (
              <g>
                <path d="M 66 62 Q 100 72 134 62 L 134 54 Q 100 58 66 54 Z" fill="#faf6ef" stroke="none" />
                <path d="M 66 62 Q 100 72 134 62" fill="none" stroke={LINE} strokeWidth="1.4" />
                <path d="M 68 62 Q 100 70 132 62" fill="none" stroke={ACCENT} strokeWidth="1.4" />
              </g>
            ) : neckId.includes('halter') ? (
              <g>
                <path d="M 54 62 L 72 105 L 128 105 L 146 62 Z" fill="#faf6ef" stroke="none" />
                <path d="M 54 62 Q 62 90 72 105 M 146 62 Q 138 90 128 105" stroke={LINE} strokeWidth="1.2" />
                <path d="M 90 48 L 86 62 L 114 62 L 110 48 Z" fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1.3" />
                <path d="M 86 62 L 100 84 L 114 62" stroke={ACCENT} strokeWidth="1.4" fill="none" />
              </g>
            ) : neckId.includes('mandarin') || neckId.includes('high_neck') ? (
              <g>
                <path
                  d="M 88 52 L 88 64 Q 100 67 112 64 L 112 52 Q 100 49 88 52 Z"
                  fill={CLOTH_SHADOW}
                  stroke={LINE}
                  strokeWidth="1.4"
                />
                <line x1="100" y1="52" x2="100" y2="76" stroke={LINE} strokeWidth="1.1" />
                <path d="M 88 52 Q 100 49 112 52" stroke={ACCENT} strokeWidth="1.5" />
              </g>
            ) : (
              <g>
                <path d="M 78 62 Q 100 88 122 62 L 122 54 Q 100 58 78 54 Z" fill="#faf6ef" stroke="none" />
                <path d="M 78 62 Q 100 88 122 62" fill="none" stroke={LINE} strokeWidth="1.4" />
                <path d="M 80 62 Q 100 86 120 62" fill="none" stroke={ACCENT} strokeWidth="1.4" />
              </g>
            )}

            {/* Sleeves */}
            {sleeveId.includes('sleeveless') ? (
              <g stroke={LINE} strokeWidth="1.2">
                <path d="M 54 62 Q 52 90 56 120" />
                <path d="M 146 62 Q 148 90 144 120" />
              </g>
            ) : sleeveId.includes('puff') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.3">
                <path d="M 54 62 C 30 56 26 86 38 108 L 60 104 C 50 88 52 72 54 62 Z" />
                <path
                  d="M 44 68 Q 38 85 48 105 M 50 65 Q 46 85 54 104"
                  stroke={LINE_MUTED}
                  strokeWidth="0.9"
                  fill="none"
                />
                <line x1="38" y1="108" x2="60" y2="104" stroke={ACCENT} strokeWidth="2.2" />
                <path d="M 146 62 C 170 56 174 86 162 108 L 140 104 C 150 88 148 72 146 62 Z" />
                <path
                  d="M 156 68 Q 162 85 152 105 M 150 65 Q 154 85 146 104"
                  stroke={LINE_MUTED}
                  strokeWidth="0.9"
                  fill="none"
                />
                <line x1="162" y1="108" x2="140" y2="104" stroke={ACCENT} strokeWidth="2.2" />
              </g>
            ) : sleeveId.includes('leg_of_mutton') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.3">
                <path d="M 54 62 C 28 56 26 84 38 108 L 44 195 L 34 195 L 26 108 C 22 84 40 60 54 62 Z" />
                <line x1="34" y1="195" x2="44" y2="195" stroke={ACCENT} strokeWidth="2" />
                <path d="M 146 62 C 172 56 174 84 162 108 L 156 195 L 166 195 L 174 108 C 178 84 160 60 146 62 Z" />
                <line x1="156" y1="195" x2="166" y2="195" stroke={ACCENT} strokeWidth="2" />
              </g>
            ) : sleeveId.includes('bishop') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.3">
                <path d="M 54 62 L 40 125 Q 22 170 34 195 L 46 195 Q 52 170 60 125 Z" />
                <line x1="34" y1="195" x2="46" y2="195" stroke={ACCENT} strokeWidth="2.2" />
                <path d="M 146 62 L 160 125 Q 178 170 166 195 L 154 195 Q 148 170 140 125 Z" />
                <line x1="166" y1="195" x2="154" y2="195" stroke={ACCENT} strokeWidth="2.2" />
              </g>
            ) : sleeveId.includes('bell') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                <path d="M 54 62 L 42 125 L 24 165 L 52 168 L 60 125 Z" />
                <path d="M 146 62 L 158 125 L 176 165 L 148 168 L 140 125 Z" />
                <line x1="24" y1="165" x2="52" y2="168" stroke={ACCENT} strokeWidth="2" />
                <line x1="176" y1="165" x2="148" y2="168" stroke={ACCENT} strokeWidth="2" />
              </g>
            ) : sleeveId.includes('full') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.3">
                <path d="M 54 62 L 40 125 L 36 195 L 48 195 L 60 125 Z" />
                <path d="M 146 62 L 160 125 L 164 195 L 152 195 L 140 125 Z" />
                <path
                  d="M 37 165 Q 43 167 47 165 M 36 178 Q 42 180 47 178"
                  stroke={LINE_MUTED}
                  strokeWidth="0.9"
                  fill="none"
                />
                <path
                  d="M 163 165 Q 157 167 153 165 M 164 178 Q 158 180 153 178"
                  stroke={LINE_MUTED}
                  strokeWidth="0.9"
                  fill="none"
                />
                <line x1="36" y1="195" x2="48" y2="195" stroke={ACCENT} strokeWidth="2.4" />
                <line x1="164" y1="195" x2="152" y2="195" stroke={ACCENT} strokeWidth="2.4" />
              </g>
            ) : sleeveId.includes('elbow') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                <path d="M 54 62 L 42 125 L 58 128 Z" />
                <path d="M 146 62 L 158 125 L 142 128 Z" />
                <line x1="42" y1="125" x2="58" y2="128" stroke={ACCENT} strokeWidth="2.2" />
                <line x1="158" y1="125" x2="142" y2="128" stroke={ACCENT} strokeWidth="2.2" />
              </g>
            ) : sleeveId.includes('three_quarter') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                <path d="M 54 62 L 39 155 L 54 157 Z" />
                <path d="M 146 62 L 161 155 L 146 157 Z" />
                <line x1="39" y1="155" x2="54" y2="157" stroke={ACCENT} strokeWidth="2.2" />
                <line x1="161" y1="155" x2="146" y2="157" stroke={ACCENT} strokeWidth="2.2" />
              </g>
            ) : sleeveId.includes('cap') ? (
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                <path d="M 54 62 L 48 82 L 58 84 Z" />
                <path d="M 146 62 L 152 82 L 142 84 Z" />
              </g>
            ) : (
              // Short sleeves (standard)
              <g fill={CLOTH} stroke={LINE} strokeWidth="1.2">
                <path d="M 54 62 L 44 112 L 60 115 Z" />
                <path d="M 146 62 L 156 112 L 140 115 Z" />
                <line x1="44" y1="112" x2="60" y2="115" stroke={ACCENT} strokeWidth="1.5" />
                <line x1="156" y1="112" x2="140" y2="115" stroke={ACCENT} strokeWidth="1.5" />
              </g>
            )}

            {/* Princess Seams and Golden Embroidery */}
            <path d="M 82 92 Q 86 118 86 148" stroke={LINE_MUTED} strokeWidth="1" />
            <path d="M 118 92 Q 114 118 114 148" stroke={LINE_MUTED} strokeWidth="1" />
            <path
              d="M 64 142 Q 100 147 136 142 L 134 148 Q 100 153 66 148 Z"
              fill={ACCENT}
              stroke={LINE}
              strokeWidth="1"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

// --- UPPER BODY DYNAMIC OVERLAY (COLLARS, FIT, LENGTH, HEMLINE, CLOSURE, POCKETS) --------------------

interface UpperBodyOverlayProps {
  selected: Record<string, string>;
  department?: string;
}

/**
 * Renders interactive visual overlays directly onto the upper body mannequin dress form:
 * - Collars: Peter Pan, Shirt collar, Mandarin/Nehru band, Spread, Notched lapel
 * - Fit & Bodice: Visibly reshaped waist cinching, tailored princess darts, relaxed crossover folds, peplum gathers
 * - Length: Cropped / waist length finish, hip length, floor length
 * - Hemline: Curved shirttail, side slits, asymmetric
 * - Closures & Details: Front placket with buttons, zipper, chest pocket, welt pockets, subtle pinstripes
 */
export function UpperBodyOverlay({ selected }: UpperBodyOverlayProps) {
  const neckline = selected.neckline ?? '';
  const collar = selected.collar ?? '';
  const fit = selected.fit ?? '';
  const length = selected.length ?? '';
  const hemline = selected.hemline ?? '';
  const closure = selected.closure ?? '';
  const pockets = selected.pockets ?? '';
  const pattern = selected.pattern ?? '';

  // Non-collared necklines should never have collar wings drawn on top of them
  const hasNonCollaredNeckline =
    neckline.includes('sweetheart') ||
    neckline.includes('boat') ||
    neckline.includes('scoop') ||
    neckline.includes('round') ||
    neckline.includes('halter') ||
    neckline.includes('square') ||
    neckline.includes('cowl') ||
    neckline.includes('queen_anne');

  const effectiveCollar = hasNonCollaredNeckline
    ? ''
    : collar || (neckline.includes('collar') || neckline.includes('mandarin') ? neckline : '');

  if (!effectiveCollar && !fit && !length && !hemline && !closure && !pockets && !pattern) {
    return null;
  }

  const isSlim = fit.includes('slim') || fit.includes('tailored') || fit.includes('bodycon');
  const isRelaxed = fit.includes('relaxed') || fit.includes('oversized');
  const isALine = fit.includes('a_line') || fit.includes('flared');

  const isCropped = length.includes('cropped') || length.includes('waist');
  const isHip = length.includes('hip') || length.includes('tunic');

  const isPeterPan = effectiveCollar.includes('peter_pan');
  const isShirtCollar =
    (effectiveCollar.includes('shirt') && !effectiveCollar.includes('t_shirt')) ||
    effectiveCollar.includes('neckline_collar');
  const isMandarin = effectiveCollar.includes('mandarin');
  const isSpread = effectiveCollar.includes('spread');
  const isNotched = effectiveCollar.includes('notched');

  return (
    <svg
      viewBox="0 0 200 240"
      className="pointer-events-none absolute inset-0 size-full z-10"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Upper body styling overlay"
    >
      {/* Pattern texture overlay */}
      {pattern.includes('striped') && (
        <g stroke={LINE} strokeWidth="0.5" opacity="0.25">
          <line x1="80" y1="80" x2="80" y2={isCropped ? 150 : 210} />
          <line x1="88" y1="80" x2="88" y2={isCropped ? 150 : 210} />
          <line x1="96" y1="80" x2="96" y2={isCropped ? 150 : 210} />
          <line x1="104" y1="80" x2="104" y2={isCropped ? 150 : 210} />
          <line x1="112" y1="80" x2="112" y2={isCropped ? 150 : 210} />
          <line x1="120" y1="80" x2="120" y2={isCropped ? 150 : 210} />
        </g>
      )}
      {pattern.includes('checked') && (
        <g stroke={LINE} strokeWidth="0.5" opacity="0.2">
          <line x1="80" y1="80" x2="80" y2={isCropped ? 150 : 210} />
          <line x1="92" y1="80" x2="92" y2={isCropped ? 150 : 210} />
          <line x1="108" y1="80" x2="108" y2={isCropped ? 150 : 210} />
          <line x1="120" y1="80" x2="120" y2={isCropped ? 150 : 210} />
          <line x1="72" y1="100" x2="128" y2="100" />
          <line x1="72" y1="125" x2="128" y2="125" />
          {!isCropped && (
            <>
              <line x1="72" y1="150" x2="128" y2="150" />
              <line x1="72" y1="175" x2="128" y2="175" />
            </>
          )}
        </g>
      )}

      {/* Fit: Tailored Princess Darts & Waist Suppression (Slim / Tailored) */}
      {isSlim && (
        <g>
          {/* Outer waist pinch masks to visibly cinch the torso */}
          <path d="M 64 125 Q 74 150 74 165 Q 74 180 64 205 L 56 205 L 56 125 Z" fill="#faf6ef" />
          <path d="M 136 125 Q 126 150 126 165 Q 126 180 136 205 L 144 205 L 144 125 Z" fill="#faf6ef" />
          {/* Cinched outer contour lines */}
          <path d="M 66 115 Q 75 152 75 165 Q 75 180 68 205" stroke={LINE} strokeWidth="1.3" fill="none" />
          <path d="M 134 115 Q 125 152 125 165 Q 125 180 132 205" stroke={LINE} strokeWidth="1.3" fill="none" />
          {/* Tailored Princess Darts */}
          <path d="M 83 95 Q 86 130 87 165 Q 87 185 85 208" stroke={LINE} strokeWidth="0.9" fill="none" />
          <path d="M 117 95 Q 114 130 113 165 Q 113 185 115 208" stroke={LINE} strokeWidth="0.9" fill="none" />
        </g>
      )}

      {/* Fit: Relaxed / Oversized Drape Folds & Peplum Volume */}
      {isRelaxed && (
        <g>
          {fit.includes('oversized') ? (
            // Dramatic voluminous gathers & balloon ease (Option D in Image 3)
            <g>
              <path
                d="M 68 110 Q 56 145 60 178 L 75 182 Q 100 186 125 182 L 140 178 Q 144 145 132 110 Z"
                fill={CLOTH}
                stroke={LINE}
                strokeWidth="1.3"
                opacity="0.95"
              />
              <g stroke={LINE_MUTED} strokeWidth="0.9">
                <line x1="76" y1="182" x2="76" y2="168" />
                <line x1="88" y1="184" x2="88" y2="168" />
                <line x1="100" y1="186" x2="100" y2="168" />
                <line x1="112" y1="184" x2="112" y2="168" />
                <line x1="124" y1="182" x2="124" y2="168" />
              </g>
            </g>
          ) : (
            // Easy flowing crossover drape folds (Option C in Image 3)
            <g stroke={LINE} strokeWidth="1" fill="none">
              <path d="M 70 100 Q 85 125 100 138" />
              <path d="M 130 100 Q 115 125 100 138" />
              <path d="M 74 135 Q 100 152 126 135" stroke={LINE_MUTED} strokeWidth="0.8" />
              <path d="M 66 115 Q 63 152 66 195" />
              <path d="M 134 115 Q 137 152 134 195" />
            </g>
          )}
        </g>
      )}

      {/* Fit: A-Line Flare Silhouette */}
      {isALine && (
        <g stroke={LINE} strokeWidth="1.1" fill="none">
          <path d="M 75 152 L 62 225" />
          <path d="M 125 152 L 138 225" />
          <path d="M 62 225 Q 100 230 138 225" />
        </g>
      )}

      {/* Length: Cropped / Waist Length */}
      {isCropped && (
        <g>
          {/* Cover dress form below waist */}
          <path d="M 64 153 L 64 240 L 136 240 L 136 153 Z" fill="#faf6ef" opacity="0.96" />
          {/* Base atelier dashed sketch legs/hips continuation */}
          <path
            d="M 75 152 Q 68 198 70 240 M 125 152 Q 132 198 130 240"
            stroke={MANNEQUIN_DASH}
            strokeWidth="1.2"
            strokeDasharray="3.5 3.5"
            fill="none"
          />
          {/* Cropped finished hem band */}
          <path
            d="M 74 148 Q 100 152 126 148 L 126 154 Q 100 158 74 154 Z"
            fill={CLOTH}
            stroke={LINE}
            strokeWidth="1.3"
          />
        </g>
      )}

      {/* Length: Hip Length */}
      {!isCropped && isHip && (
        <g>
          <path d="M 64 198 L 64 240 L 136 240 L 136 198 Z" fill="#faf6ef" opacity="0.96" />
          <path
            d="M 68 198 L 70 240 M 132 198 L 130 240"
            stroke={MANNEQUIN_DASH}
            strokeWidth="1.2"
            strokeDasharray="3.5 3.5"
            fill="none"
          />
          <path d="M 68 195 Q 100 199 132 195" stroke={LINE} strokeWidth="1.3" fill="none" />
        </g>
      )}

      {/* Hemline: Curved Shirttail */}
      {!isCropped && hemline.includes('curved') && (
        <path d="M 68 188 Q 100 208 132 188" stroke={LINE} strokeWidth="1.3" fill="none" />
      )}

      {/* Hemline: Side Slits */}
      {!isCropped && hemline.includes('slit') && (
        <g stroke={LINE} strokeWidth="1.3">
          <line x1="69" y1="178" x2="69" y2="204" />
          <line x1="131" y1="178" x2="131" y2="204" />
          {/* Bar tacks */}
          <line x1="67" y1="178" x2="71" y2="178" strokeWidth="1.5" />
          <line x1="129" y1="178" x2="133" y2="178" strokeWidth="1.5" />
        </g>
      )}

      {/* Closure: Front Placket with Buttons */}
      {closure.includes('button') && (
        <g>
          <line x1="100" y1="64" x2="100" y2={isCropped ? 150 : 200} stroke={LINE_MUTED} strokeWidth="0.8" />
          {[76, 92, 108, 124, 140, 156, 172, 188]
            .filter((y) => (isCropped ? y < 148 : y < 195))
            .map((y) => (
              <circle key={y} cx="100" cy={y} r="1.4" fill={LINE} />
            ))}
        </g>
      )}

      {/* Closure: Zipper */}
      {closure.includes('zip') && (
        <g stroke={LINE_MUTED} strokeWidth="0.9">
          <line x1="100" y1="64" x2="100" y2={isCropped ? 150 : 200} strokeDasharray="1.5 1.5" />
          <polygon points="98,66 102,66 100,71" fill={ACCENT} stroke={LINE} strokeWidth="0.6" />
        </g>
      )}

      {/* Pockets: Chest Pocket */}
      {pockets.includes('chest') && (
        <g>
          <rect x="76" y="98" width="14" height="17" rx="1.5" fill={CLOTH} stroke={LINE} strokeWidth="1" />
          <line x1="76" y1="102" x2="90" y2="102" stroke={LINE} strokeWidth="0.8" />
        </g>
      )}

      {/* Pockets: Welt Side Pockets */}
      {(pockets.includes('side') || pockets.includes('welt')) && (
        <g stroke={LINE} strokeWidth="1.2">
          <line x1="72" y1="166" x2="84" y2="171" />
          <line x1="128" y1="166" x2="116" y2="171" />
        </g>
      )}

      {/* COLLARS: Peter Pan, Shirt, Mandarin, Spread, Notched */}
      {isPeterPan && (
        <g>
          {/* Left rounded wing */}
          <path
            d="M 100 64 C 91 62 76 65 74 76 C 73 86 89 85 98 72 Z"
            fill={CLOTH}
            stroke={LINE}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Right rounded wing */}
          <path
            d="M 100 64 C 109 62 124 65 126 76 C 127 86 111 85 102 72 Z"
            fill={CLOTH}
            stroke={LINE}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path d="M 93 64 Q 100 68 107 64" stroke={LINE_MUTED} strokeWidth="0.8" fill="none" />
          <circle cx="100" cy="65.5" r="1.6" fill={LINE} />
        </g>
      )}

      {isShirtCollar && (
        <g>
          {/* Stand band */}
          <path d="M 92 64 L 92 57 Q 100 60 108 57 L 108 64 Z" fill={CLOTH_SHADOW} stroke={LINE} strokeWidth="1.1" />
          {/* Left pointed collar wing */}
          <path d="M 92 58 L 76 80 L 98 72 L 100 64 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
          {/* Right pointed collar wing */}
          <path d="M 108 58 L 124 80 L 102 72 L 100 64 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
          <circle cx="100" cy="66" r="1.4" fill={LINE} />
          {/* Placket line if not already drawn by closure */}
          {!closure.includes('button') && (
            <g>
              <line x1="100" y1="67" x2="100" y2="115" stroke={LINE_MUTED} strokeWidth="0.8" />
              <circle cx="100" cy="78" r="1.3" fill={LINE} />
              <circle cx="100" cy="94" r="1.3" fill={LINE} />
              <circle cx="100" cy="110" r="1.3" fill={LINE} />
            </g>
          )}
        </g>
      )}

      {isMandarin && (
        <g>
          <path
            d="M 91 64 L 91 52 Q 100 55 109 52 L 109 64 Q 100 67 91 64 Z"
            fill={CLOTH}
            stroke={LINE}
            strokeWidth="1.3"
          />
          <line x1="100" y1="52" x2="100" y2="64" stroke={LINE} strokeWidth="1" />
          <circle cx="100" cy="57" r="1.5" fill={LINE} />
          {!closure.includes('button') && (
            <line x1="100" y1="64" x2="100" y2="110" stroke={LINE_MUTED} strokeWidth="0.8" />
          )}
        </g>
      )}

      {isSpread && (
        <g>
          <path d="M 92 58 L 72 72 L 96 69 L 100 64 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
          <path d="M 108 58 L 128 72 L 104 69 L 100 64 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.3" />
          <circle cx="100" cy="66" r="1.4" fill={LINE} />
        </g>
      )}

      {isNotched && (
        <g>
          {/* Left notched lapel */}
          <path d="M 92 62 L 78 72 L 82 77 L 76 88 L 100 116 L 100 64 Z" fill={CLOTH} stroke={LINE} strokeWidth="1.2" />
          {/* Right notched lapel */}
          <path
            d="M 108 62 L 122 72 L 118 77 L 124 88 L 100 116 L 100 64 Z"
            fill={CLOTH}
            stroke={LINE}
            strokeWidth="1.2"
          />
        </g>
      )}
    </svg>
  );
}
