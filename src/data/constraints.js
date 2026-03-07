/**
 * Real-world surfboard parameter constraints
 * Based on actual shaper specifications and industry standards.
 *
 * Each board type defines:
 *   - lengthIn range
 *   - widthIn formula (as fraction of lengthIn)
 *   - widePointPct: wide-point position as fraction of length from nose
 *   - noseWidthRatio: nose width as fraction of widePointWidthIn
 *   - tailWidthRatio: tail width as fraction of widePointWidthIn
 *   - per-parameter { min, ideal:[lo,hi], max } bounds
 *
 * Validation levels:
 *   'ok'      = within ideal range (green dot)
 *   'warn'    = outside ideal but technically valid (yellow dot)
 *   'error'   = physically impossible or unrideable (red dot, slider clamped)
 */

export const BOARD_CONSTRAINTS = {
  performanceShortboard: {
    label: 'Performance Shortboard',
    lengthIn:         { min: 60,   ideal: [66,  78],  max: 84   },
    widthIn:          { min: 17,   ideal: [18,  20],  max: 21   },
    widePointPct:     { min: 0.48, ideal: [0.50,0.60],max: 0.65 }, // % of length from nose (BEHIND center)
    noseWidthRatio:   { min: 0.48, ideal: [0.52,0.60],max: 0.65 }, // ratio to max width
    tailWidthRatio:   { min: 0.65, ideal: [0.68,0.80],max: 0.85 },
    noseRockerIn:     { min: 3.5,  ideal: [4.5, 5.5], max: 7.0  },
    tailRockerIn:     { min: 1.5,  ideal: [2.0, 2.5], max: 3.5  },
    thicknessIn:      { min: 2.0,  ideal: [2.25,2.75],max: 3.0  },
    swallowDepthIn:   null, // not applicable
    volumeL:          { min: 22,   ideal: [24,  36],  max: 45   },
  },

  groveler: {
    label: 'Shortboard Groveler',
    lengthIn:         { min: 56,   ideal: [62,  74],  max: 80   },
    widthIn:          { min: 18.5, ideal: [19.5,21.5],max: 23   },
    widePointPct:     { min: 0.38, ideal: [0.42,0.55],max: 0.62 },
    noseWidthRatio:   { min: 0.50, ideal: [0.54,0.62],max: 0.68 },
    tailWidthRatio:   { min: 0.66, ideal: [0.70,0.78],max: 0.84 },
    noseRockerIn:     { min: 2.5,  ideal: [3.5, 4.5], max: 5.5  },
    tailRockerIn:     { min: 1.0,  ideal: [1.5, 2.0], max: 2.75 },
    thicknessIn:      { min: 2.25, ideal: [2.4, 2.9], max: 3.25 },
    swallowDepthIn:   null,
    volumeL:          { min: 26,   ideal: [28,  42],  max: 52   },
  },

  fish: {
    label: 'Fish',
    lengthIn:         { min: 56,   ideal: [60,  74],  max: 80   },
    widthIn:          { min: 19,   ideal: [20,  23],  max: 25   },
    widePointPct:     { min: 0.38, ideal: [0.44,0.52],max: 0.58 }, // near center (2" forward to at center)
    noseWidthRatio:   { min: 0.57, ideal: [0.60,0.70],max: 0.78 }, // wide nose but not at max width
    tailWidthRatio:   { min: 0.68, ideal: [0.72,0.80],max: 0.86 },
    noseRockerIn:     { min: 2.0,  ideal: [3.0, 4.0], max: 5.0  },
    tailRockerIn:     { min: 0.5,  ideal: [1.0, 1.75],max: 2.5  },
    thicknessIn:      { min: 2.0,  ideal: [2.25,2.75],max: 3.0  },
    swallowDepthIn:   { min: 1.5,  ideal: [2.0, 3.5], max: 4.5  },
    volumeL:          { min: 24,   ideal: [28,  42],  max: 52   },
  },

  midLength: {
    label: 'Mid-Length',
    lengthIn:         { min: 72,   ideal: [76,  96],  max: 108  },
    widthIn:          { min: 19,   ideal: [20.5,22.5],max: 24   },
    widePointPct:     { min: 0.44, ideal: [0.48,0.54],max: 0.60 }, // Near center
    noseWidthRatio:   { min: 0.56, ideal: [0.60,0.70],max: 0.78 },
    tailWidthRatio:   { min: 0.64, ideal: [0.68,0.78],max: 0.84 },
    noseRockerIn:     { min: 2.5,  ideal: [3.5, 5.0], max: 6.0  },
    tailRockerIn:     { min: 1.25, ideal: [1.75,2.25],max: 3.0  },
    thicknessIn:      { min: 2.375,ideal: [2.625,3.0],max: 3.375 },
    swallowDepthIn:   null,
    volumeL:          { min: 35,   ideal: [38,  55],  max: 68   },
  },

  longboard: {
    label: 'Longboard',
    lengthIn:         { min: 90,   ideal: [96,  132], max: 144  },
    widthIn:          { min: 21,   ideal: [22,  24],  max: 26   },
    widePointPct:     { min: 0.40, ideal: [0.44,0.54],max: 0.60 },
    noseWidthRatio:   { min: 0.68, ideal: [0.74,0.84],max: 0.90 }, // Wide nose for noseriding
    tailWidthRatio:   { min: 0.60, ideal: [0.64,0.74],max: 0.80 },
    noseRockerIn:     { min: 1.5,  ideal: [2.5, 4.5], max: 6.0  },
    tailRockerIn:     { min: 1.0,  ideal: [1.5, 2.5], max: 3.5  },
    thicknessIn:      { min: 2.5,  ideal: [2.75,3.25],max: 3.75 },
    swallowDepthIn:   null,
    volumeL:          { min: 55,   ideal: [60,  95],  max: 110  },
  },

  gun: {
    label: 'Gun / Step-Up',
    lengthIn:         { min: 72,   ideal: [76,  108], max: 120  },
    widthIn:          { min: 17,   ideal: [18,  20],  max: 21.5 },
    widePointPct:     { min: 0.52, ideal: [0.56,0.65],max: 0.70 }, // BEHIND center
    noseWidthRatio:   { min: 0.55, ideal: [0.58,0.68],max: 0.75 },
    tailWidthRatio:   { min: 0.58, ideal: [0.62,0.72],max: 0.80 },
    noseRockerIn:     { min: 4.0,  ideal: [5.0, 6.5], max: 8.0  },
    tailRockerIn:     { min: 1.5,  ideal: [2.0, 2.75],max: 3.5  },
    thicknessIn:      { min: 2.25, ideal: [2.5, 3.0], max: 3.375},
    swallowDepthIn:   null,
    volumeL:          { min: 28,   ideal: [30,  50],  max: 60   },
  },
};

/**
 * Detect which board type a set of params most closely matches.
 * Used to pick the right constraint set.
 */
export function detectBoardType(params) {
  const L = params.lengthFt * 12 + (params.lengthIn_extra || 0);

  // Use stored boardType if present
  if (params.boardType && BOARD_CONSTRAINTS[params.boardType]) {
    return params.boardType;
  }

  // Heuristic detection
  const wpPct = params.widePointIn / L;

  if (L >= 90) return 'longboard';
  if (L >= 72 && params.widthIn <= 20.5 && wpPct >= 0.52) return 'gun';
  if (L >= 72) return 'midLength';
  // Fish: short, wide, with WP in retro range (≤25%) OR wide-nose near-center range
  if (wpPct <= 0.25 && params.widthIn >= 19) return 'fish';
  if (params.widthIn >= 20 && L <= 74 && params.noseWidthIn >= 13.5 && wpPct <= 0.55) return 'fish';
  if (params.widthIn >= 19.5 && L <= 74) return 'groveler';
  return 'performanceShortboard';
}

/**
 * Validate a single parameter for a given board type.
 * Returns { status: 'ok'|'warn'|'error', message: string }
 */
export function validateParam(boardType, paramKey, value, params) {
  const C = BOARD_CONSTRAINTS[boardType];
  if (!C) return { status: 'ok', message: '' };

  const L = params.lengthFt * 12 + (params.lengthIn_extra || 0);

  // Derived params that need special handling
  if (paramKey === 'widePointIn') {
    const pct = value / L;
    const bounds = C.widePointPct;
    if (!bounds) return { status: 'ok', message: '' };
    if (pct < bounds.min || pct > bounds.max) {
      const idealLo = (bounds.ideal[0] * L).toFixed(0);
      const idealHi = (bounds.ideal[1] * L).toFixed(0);
      return {
        status: 'error',
        message: `Wide point should be ${idealLo}–${idealHi}" from nose for a ${C.label}.`,
      };
    }
    if (pct < bounds.ideal[0] || pct > bounds.ideal[1]) {
      return { status: 'warn', message: `Unusual wide point position for ${C.label}.` };
    }
    return { status: 'ok', message: '' };
  }

  if (paramKey === 'noseWidthIn') {
    const ratio = value / params.widePointWidthIn;
    const bounds = C.noseWidthRatio;
    if (!bounds) return { status: 'ok', message: '' };
    if (ratio < bounds.min || ratio > bounds.max) {
      const idealLo = (bounds.ideal[0] * params.widePointWidthIn).toFixed(1);
      const idealHi = (bounds.ideal[1] * params.widePointWidthIn).toFixed(1);
      return {
        status: 'error',
        message: `Nose width should be ${idealLo}–${idealHi}" for this width. Current ratio ${(ratio*100).toFixed(0)}% (ideal ${(bounds.ideal[0]*100).toFixed(0)}–${(bounds.ideal[1]*100).toFixed(0)}%).`,
      };
    }
    if (ratio < bounds.ideal[0] || ratio > bounds.ideal[1]) {
      return { status: 'warn', message: `Slightly unusual nose-to-width ratio.` };
    }
    return { status: 'ok', message: '' };
  }

  if (paramKey === 'tailWidthIn') {
    const ratio = value / params.widePointWidthIn;
    const bounds = C.tailWidthRatio;
    if (!bounds) return { status: 'ok', message: '' };
    if (ratio < bounds.min || ratio > bounds.max) {
      const idealLo = (bounds.ideal[0] * params.widePointWidthIn).toFixed(1);
      const idealHi = (bounds.ideal[1] * params.widePointWidthIn).toFixed(1);
      return {
        status: 'error',
        message: `Tail width should be ${idealLo}–${idealHi}" for this width.`,
      };
    }
    if (ratio < bounds.ideal[0] || ratio > bounds.ideal[1]) {
      return { status: 'warn', message: `Slightly unusual tail-to-width ratio.` };
    }
    return { status: 'ok', message: '' };
  }

  // Simple numeric bounds
  const boundsMap = {
    widthIn:       C.widthIn,
    noseRockerIn:  C.noseRockerIn,
    tailRockerIn:  C.tailRockerIn,
    thicknessIn:   C.thicknessIn,
    swallowDepthIn:C.swallowDepthIn,
  };

  const bounds = boundsMap[paramKey];
  if (!bounds) return { status: 'ok', message: '' };

  if (value < bounds.min || value > bounds.max) {
    return {
      status: 'error',
      message: `${paramKey} should be ${bounds.ideal[0]}–${bounds.ideal[1]} for a ${C.label}.`,
    };
  }
  if (value < bounds.ideal[0] || value > bounds.ideal[1]) {
    return {
      status: 'warn',
      message: `${bounds.ideal[0]}–${bounds.ideal[1]} is ideal for a ${C.label}.`,
    };
  }
  return { status: 'ok', message: '' };
}

/**
 * Given a change to one parameter, return suggested values for related parameters.
 * Returns array of { key, value, reason }
 */
export function autoSuggest(boardType, changedKey, newValue, currentParams) {
  const C = BOARD_CONSTRAINTS[boardType];
  if (!C) return [];

  const L = currentParams.lengthFt * 12 + (currentParams.lengthIn_extra || 0);
  const suggestions = [];

  if (changedKey === 'widePointWidthIn' || changedKey === 'widthIn') {
    const w = newValue;
    const noseRatio = (C.noseWidthRatio.ideal[0] + C.noseWidthRatio.ideal[1]) / 2;
    const tailRatio = (C.tailWidthRatio.ideal[0] + C.tailWidthRatio.ideal[1]) / 2;
    suggestions.push({
      key: 'noseWidthIn',
      value: parseFloat((w * noseRatio).toFixed(2)),
      reason: `Matched to ${(noseRatio * 100).toFixed(0)}% of max width`,
    });
    suggestions.push({
      key: 'tailWidthIn',
      value: parseFloat((w * tailRatio).toFixed(2)),
      reason: `Matched to ${(tailRatio * 100).toFixed(0)}% of max width`,
    });
  }

  if ((changedKey === 'lengthFt' || changedKey === 'lengthIn_extra') && C.widePointPct) {
    const wpPct = (C.widePointPct.ideal[0] + C.widePointPct.ideal[1]) / 2;
    suggestions.push({
      key: 'widePointIn',
      value: Math.round(L * wpPct),
      reason: `Wide point at ${(wpPct * 100).toFixed(0)}% of length`,
    });
  }

  return suggestions;
}
