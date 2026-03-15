/**
 * Surfboard Geometry Engine v5 — NURBS Surface Architecture
 *
 * Uses NURBS surfaces for smooth, artifact-free mesh generation.
 * Reference curves per board type define the outline. Cross-section
 * control points are evaluated at each station and form a NURBS surface.
 *
 * Coordinate system (Three.js Y-up, board lying flat):
 *   X = length axis  (nose = -L/2, tail = +L/2)
 *   Y = height axis  (bottom at rocker height, deck = rocker + thickness)
 *   Z = width axis   (centerline = 0, right rail = +Z, left = -Z)
 */

import * as THREE from 'three';
import { NURBSSurface } from 'three/addons/curves/NURBSSurface.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

export function inchesToMeters(i) { return i * 0.0254; }

// ═══════════════════════════════════════════════════════════════════════════════
// REFERENCE OUTLINE CURVES
// {t, w}: t = 0 (nose) to 1 (tail), w = 0 (center) to 1 (max width)
// ═══════════════════════════════════════════════════════════════════════════════

const REFERENCE_OUTLINES = {
  // Fish: PARALLEL rails behind wide point - key fish characteristic
  // Wide point at/near center, then stays wide all the way to swallow wings
  // Only tapers in last ~3" for the wing tips
  fish: [
    {t:0.000, w:0.08}, {t:0.015, w:0.22}, {t:0.03, w:0.36}, {t:0.05, w:0.50},
    {t:0.07, w:0.60}, {t:0.09, w:0.68}, {t:0.12, w:0.78}, {t:0.16, w:0.86},
    {t:0.20, w:0.92}, {t:0.26, w:0.96}, {t:0.32, w:0.99}, {t:0.40, w:1.00},
    {t:0.50, w:1.00}, {t:0.58, w:0.99}, {t:0.65, w:0.98}, {t:0.72, w:0.96},
    {t:0.78, w:0.93}, {t:0.82, w:0.90}, {t:0.86, w:0.86}, {t:0.90, w:0.80},
    {t:0.93, w:0.72}, {t:0.96, w:0.58}, {t:0.98, w:0.42}, {t:1.000, w:0.30},
  ],
  performanceShortboard: [
    {t:0.000, w:0.02}, {t:0.015, w:0.06}, {t:0.03, w:0.14}, {t:0.05, w:0.24},
    {t:0.07, w:0.32}, {t:0.09, w:0.40}, {t:0.12, w:0.50}, {t:0.16, w:0.60},
    {t:0.20, w:0.70}, {t:0.26, w:0.80}, {t:0.32, w:0.87}, {t:0.40, w:0.94},
    {t:0.48, w:0.98}, {t:0.54, w:1.00}, {t:0.60, w:0.99}, {t:0.66, w:0.96},
    {t:0.72, w:0.91}, {t:0.78, w:0.84}, {t:0.83, w:0.75}, {t:0.88, w:0.63},
    {t:0.92, w:0.50}, {t:0.95, w:0.37}, {t:0.98, w:0.24}, {t:1.000, w:0.14},
  ],
  groveler: [
    {t:0.000, w:0.02}, {t:0.015, w:0.10}, {t:0.03, w:0.20}, {t:0.05, w:0.32},
    {t:0.07, w:0.41}, {t:0.09, w:0.50}, {t:0.12, w:0.60}, {t:0.16, w:0.70},
    {t:0.20, w:0.78}, {t:0.26, w:0.86}, {t:0.32, w:0.92}, {t:0.38, w:0.96},
    {t:0.44, w:0.99}, {t:0.50, w:1.00}, {t:0.56, w:1.00}, {t:0.62, w:0.98},
    {t:0.68, w:0.94}, {t:0.74, w:0.88}, {t:0.80, w:0.80}, {t:0.85, w:0.70},
    {t:0.90, w:0.58}, {t:0.94, w:0.44}, {t:0.97, w:0.32}, {t:1.000, w:0.20},
  ],
  midLength: [
    {t:0.000, w:0.02}, {t:0.015, w:0.08}, {t:0.03, w:0.17}, {t:0.05, w:0.27},
    {t:0.07, w:0.35}, {t:0.09, w:0.43}, {t:0.12, w:0.53}, {t:0.16, w:0.64},
    {t:0.20, w:0.73}, {t:0.26, w:0.83}, {t:0.32, w:0.90}, {t:0.40, w:0.96},
    {t:0.48, w:0.99}, {t:0.50, w:1.00}, {t:0.55, w:1.00}, {t:0.62, w:0.97},
    {t:0.68, w:0.93}, {t:0.74, w:0.87}, {t:0.80, w:0.78}, {t:0.85, w:0.66},
    {t:0.90, w:0.52}, {t:0.94, w:0.36}, {t:0.97, w:0.22}, {t:1.000, w:0.06},
  ],
  longboard: [
    {t:0.000, w:0.04}, {t:0.015, w:0.12}, {t:0.03, w:0.23}, {t:0.05, w:0.34},
    {t:0.07, w:0.43}, {t:0.09, w:0.52}, {t:0.12, w:0.62}, {t:0.16, w:0.72},
    {t:0.20, w:0.80}, {t:0.26, w:0.88}, {t:0.32, w:0.93}, {t:0.40, w:0.97},
    {t:0.46, w:0.99}, {t:0.50, w:1.00}, {t:0.55, w:1.00}, {t:0.60, w:0.99},
    {t:0.66, w:0.96}, {t:0.72, w:0.91}, {t:0.78, w:0.84}, {t:0.83, w:0.74},
    {t:0.88, w:0.62}, {t:0.92, w:0.48}, {t:0.95, w:0.34}, {t:0.98, w:0.18},
    {t:1.000, w:0.06},
  ],
  gun: [
    {t:0.000, w:0.04}, {t:0.015, w:0.08}, {t:0.03, w:0.14}, {t:0.05, w:0.20},
    {t:0.07, w:0.20}, {t:0.09, w:0.26}, {t:0.12, w:0.34}, {t:0.16, w:0.44},
    {t:0.20, w:0.52}, {t:0.26, w:0.63}, {t:0.32, w:0.73}, {t:0.40, w:0.84},
    {t:0.48, w:0.92}, {t:0.55, w:0.97}, {t:0.60, w:1.00}, {t:0.65, w:0.99},
    {t:0.70, w:0.95}, {t:0.76, w:0.87}, {t:0.82, w:0.74}, {t:0.87, w:0.58},
    {t:0.91, w:0.42}, {t:0.94, w:0.28}, {t:0.97, w:0.14}, {t:1.000, w:0.00},
  ],
};

export { REFERENCE_OUTLINES };

export function lerpRefCurve(curve, t) {
  if (t <= curve[0].t) return curve[0].w;
  if (t >= curve[curve.length - 1].t) return curve[curve.length - 1].w;
  for (let i = 0; i < curve.length - 1; i++) {
    if (t >= curve[i].t && t <= curve[i + 1].t) {
      const f = (t - curve[i].t) / (curve[i + 1].t - curve[i].t);
      return curve[i].w + f * (curve[i + 1].w - curve[i].w);
    }
  }
  return 0;
}

function smoothArray(arr, passes) {
  const w = [0.1, 0.2, 0.4, 0.2, 0.1];
  let a = [...arr];
  for (let p = 0; p < passes; p++) {
    const out = [...a];
    for (let i = 2; i < a.length - 2; i++)
      out[i] = w[0]*a[i-2] + w[1]*a[i-1] + w[2]*a[i] + w[3]*a[i+1] + w[4]*a[i+2];
    a = out;
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOSE SHAPE MODIFIERS — affect the first ~10% of outline
// ═══════════════════════════════════════════════════════════════════════════════
const NOSE_SHAPES = {
  // tipWidth = fraction of nose width at tip (0 = point, higher = wider)
  // curveExp = how the width builds from tip (lower = gradual/smooth, higher = abrupt)

  round: {
    tipWidth: 0.12,   // wide, smooth semi-circular tip
    curveExp: 1.5,    // gradual curve for stability
  },
  pointedRound: {
    tipWidth: 0.06,   // slightly tapered front end
    curveExp: 1.8,    // balanced curve
  },
  pointed: {
    tipWidth: 0.02,   // sleek, streamlined tip
    curveExp: 2.4,    // sharper taper for precision
  },
  asymmetrical: {
    tipWidth: 0.05,
    curveExp: 2.0,
    asymm: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAIL SHAPE CURVES — bezier-style control points for each tail type
// Each shape is an array of {x, w} where:
//   x = inches from tail tip (0 = tip, 12 = reference station)
//   w = width as fraction of 12" station width (0 = centerline, 1 = full width)
// Points are interpolated with smooth curves to create the outline
// ═══════════════════════════════════════════════════════════════════════════════
const TAIL_CURVES = {
  // Pin: smooth taper to narrow point over last 8-12"
  // Tip is 0.5-1" wide (at 15" tail width = ~0.03-0.07 fraction)
  // For true pin: near-point. For rounded pin: slight 0.5" radius at very tip
  pin: [
    { x: 0, w: 0.04 },   // very narrow tip (~0.6" at 15" tail)
    { x: 0.5, w: 0.08 }, // slight rounding
    { x: 1, w: 0.14 },   // still narrow
    { x: 2, w: 0.28 },   // building out
    { x: 3, w: 0.42 },   // smooth taper
    { x: 5, w: 0.62 },
    { x: 8, w: 0.82 },
    { x: 12, w: 1.00 },
  ],

  // Round: smooth egg-shaped end, 3-4" wide at tip with 1.5-2" radius
  // NO flat face — rails curve together and meet smoothly
  round: [
    { x: 0, w: 0.22 },   // rounded tip (~3.3" at 15" tail)
    { x: 0.5, w: 0.32 }, // quick curve out
    { x: 1, w: 0.42 },
    { x: 2, w: 0.58 },
    { x: 3, w: 0.70 },
    { x: 5, w: 0.84 },
    { x: 8, w: 0.94 },
    { x: 12, w: 1.00 },
  ],

  // Round pin: most common all-rounder, between round and pin
  // Tip is 2-3" wide with ~1" radius
  roundPin: [
    { x: 0, w: 0.15 },   // rounded narrow tip (~2.25" at 15" tail)
    { x: 0.5, w: 0.22 },
    { x: 1, w: 0.30 },
    { x: 2, w: 0.45 },
    { x: 3, w: 0.58 },
    { x: 5, w: 0.75 },
    { x: 8, w: 0.90 },
    { x: 12, w: 1.00 },
  ],

  // Squash: most common tail. Maintains width until last 1-2", flat end with 1-1.5" corner radius
  // The end is perpendicular to stringer with rounded corners
  squash: [
    { x: 0, w: 0.82 },   // wide flat back (~12.3" at 15" tail)
    { x: 0.3, w: 0.84 }, // corner radius starts
    { x: 0.7, w: 0.87 }, // corner rounding
    { x: 1, w: 0.90 },   // corner transition complete
    { x: 1.5, w: 0.93 },
    { x: 2, w: 0.95 },
    { x: 3, w: 0.97 },
    { x: 6, w: 0.99 },
    { x: 12, w: 1.00 },
  ],

  // Square: very wide, minimal corner rounding
  square: [
    { x: 0, w: 0.90 },   // almost full width
    { x: 0.2, w: 0.91 }, // tiny corner
    { x: 0.5, w: 0.93 },
    { x: 1, w: 0.95 },
    { x: 2, w: 0.97 },
    { x: 6, w: 0.99 },
    { x: 12, w: 1.00 },
  ],

  // Rounded square: between squash and square
  roundedSquare: [
    { x: 0, w: 0.85 },
    { x: 0.3, w: 0.87 },
    { x: 0.7, w: 0.90 },
    { x: 1, w: 0.92 },
    { x: 2, w: 0.95 },
    { x: 3, w: 0.97 },
    { x: 6, w: 0.99 },
    { x: 12, w: 1.00 },
  ],

  // Swallow: wings with center notch (notch cut via CSG in 3D)
  // Body maintains width from reference outline until wings start
  // w values >1.0 mean "wider than tailWidth12" to preserve body width
  // Wing tips are pinned narrow
  swallow: [
    { x: 0, w: 0.32 },   // pinned wing tip (~2.3" at 14.5" tail)
    { x: 0.5, w: 0.48 }, // wing building
    { x: 1, w: 0.62 },   // wing opening
    { x: 1.5, w: 0.76 }, // mid-wing
    { x: 2, w: 0.88 },   // upper wing
    { x: 3, w: 1.05 },   // body zone - match/exceed body outline
    { x: 6, w: 1.18 },   // parallel rails zone - stays wide
    { x: 12, w: 1.30 },  // matches body outline width at 12"
  ],

  // Fish: classic twin-fin - parallel rails, pinned wing tips
  // Fish boards maintain body width until the swallow wings
  // w values >1.0 preserve body width relative to tailWidth12
  fish: [
    { x: 0, w: 0.30 },   // pinned wing tip (~2.2" at 14.5" tail)
    { x: 0.5, w: 0.45 }, // wing building
    { x: 1, w: 0.58 },   // wing opening
    { x: 1.5, w: 0.72 }, // mid-wing
    { x: 2, w: 0.85 },   // upper wing
    { x: 3, w: 1.02 },   // body zone - match body outline
    { x: 6, w: 1.16 },   // parallel rails - stays wide
    { x: 12, w: 1.30 },  // matches body outline at 12" from tail
  ],

  // Diamond: angular taper to narrow point
  diamond: [
    { x: 0, w: 0.08 },   // narrow point
    { x: 1, w: 0.30 },   // quick angle out
    { x: 2, w: 0.50 },   // linear-ish
    { x: 3, w: 0.65 },
    { x: 6, w: 0.85 },
    { x: 12, w: 1.00 },
  ],

  // Bat: bump out then taper
  bat: [
    { x: 0, w: 0.45 },   // narrower tip
    { x: 1, w: 0.65 },   // building to wing
    { x: 2, w: 0.85 },   // wing peak
    { x: 2.5, w: 0.88 }, // wing holds
    { x: 3, w: 0.86 },   // slight tuck after wing
    { x: 6, w: 0.94 },
    { x: 12, w: 1.00 },
  ],

  // Winged swallow: pinned tips with wing bumps before the swallow notch
  // Wing bump creates a small protrusion then tucks back before the pins
  wingedSwallow: [
    { x: 0, w: 0.26 },   // pinned wing tip
    { x: 0.5, w: 0.40 },
    { x: 1, w: 0.55 },
    { x: 1.5, w: 0.70 },
    { x: 2, w: 0.88 },   // wing bump peak
    { x: 2.5, w: 0.92 }, // wing holds
    { x: 3, w: 0.95 },   // slight tuck after wing
    { x: 6, w: 1.12 },   // body zone
    { x: 12, w: 1.25 },  // matches body outline
  ],

  // Winged squash: wings before squash back
  wingedSquash: [
    { x: 0, w: 0.68 },
    { x: 0.5, w: 0.72 },
    { x: 1, w: 0.78 },
    { x: 2, w: 0.90 },   // wing
    { x: 2.5, w: 0.92 }, // wing peak
    { x: 3, w: 0.90 },
    { x: 6, w: 0.96 },
    { x: 12, w: 1.00 },
  ],

  // Winged round: round with wing bumps
  wingedRound: [
    { x: 0, w: 0.20 },   // rounded tip
    { x: 0.5, w: 0.30 },
    { x: 1, w: 0.42 },
    { x: 2, w: 0.70 },   // wing bump starts
    { x: 2.5, w: 0.76 }, // wing peak
    { x: 3, w: 0.74 },   // slight tuck
    { x: 5, w: 0.86 },
    { x: 8, w: 0.95 },
    { x: 12, w: 1.00 },
  ],

  // Rounded diamond
  roundedDiamond: [
    { x: 0, w: 0.15 },
    { x: 1, w: 0.38 },
    { x: 2, w: 0.55 },
    { x: 3, w: 0.70 },
    { x: 6, w: 0.88 },
    { x: 12, w: 1.00 },
  ],
};

// Metadata for 3D surface generation
const TAIL_SHAPES = {
  pin:           { notch: false, wide: false, cornerRadius: 1.0 },
  round:         { notch: false, wide: false, cornerRadius: 1.0 },
  roundPin:      { notch: false, wide: false, cornerRadius: 1.0 },
  square:        { notch: false, wide: true,  cornerRadius: 0.1 },
  squash:        { notch: false, wide: true,  cornerRadius: 0.5 },
  roundedSquare: { notch: false, wide: true,  cornerRadius: 0.3 },
  swallow:       { notch: true,  wide: false, cornerRadius: 0.8 },
  fish:          { notch: true,  wide: false, cornerRadius: 0.9 },
  diamond:       { notch: false, wide: false, cornerRadius: 0.0 },
  bat:           { notch: false, wide: false, cornerRadius: 0.2 },
  wingedSwallow: { notch: true,  wide: false, cornerRadius: 0.7 },
  wingedSquash:  { notch: false, wide: true,  cornerRadius: 0.4 },
  wingedRound:   { notch: false, wide: false, cornerRadius: 1.0 },
  roundedDiamond:{ notch: false, wide: false, cornerRadius: 0.5 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// OUTLINE — Station-based width control (like Shape3D)
// Uses width values at 0, 1, 3, 6, 12, 18, 24" from nose and tail
// ═══════════════════════════════════════════════════════════════════════════════

// Interpolate through station control points using Catmull-Rom
function stationSpline(stations, x) {
  // stations = [{x, w}, ...] sorted by x
  if (stations.length === 0) return 0;
  if (stations.length === 1) return stations[0].w;
  if (x <= stations[0].x) return stations[0].w;
  if (x >= stations[stations.length - 1].x) return stations[stations.length - 1].w;

  // Find segment
  let seg = 0;
  for (let i = 0; i < stations.length - 1; i++) {
    if (x >= stations[i].x && x <= stations[i + 1].x) {
      seg = i;
      break;
    }
  }

  const x0 = stations[seg].x;
  const x1 = stations[seg + 1].x;
  const t = (x - x0) / (x1 - x0);

  // Catmull-Rom spline
  const p0 = stations[Math.max(0, seg - 1)].w;
  const p1 = stations[seg].w;
  const p2 = stations[seg + 1].w;
  const p3 = stations[Math.min(stations.length - 1, seg + 2)].w;

  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export function generateOutline(params) {
  const {
    lengthIn: L,
    widePointWidthIn,
    widePointIn,
    noseShape = 'round',
    tailShape = 'squash',
    boardType = 'midLength'
  } = params;

  const halfMaxWidth = widePointWidthIn / 2;
  const curve = REFERENCE_OUTLINES[boardType] || REFERENCE_OUTLINES.midLength;
  const noseConfig = NOSE_SHAPES[noseShape] || NOSE_SHAPES.round;
  const tailCurve = TAIL_CURVES[tailShape] || TAIL_CURVES.squash;
  const widePoint = widePointIn || L * 0.5;

  // Station positions from nose/tail
  const STATIONS = [1, 3, 6, 12, 18, 24];

  // Build nose station control points
  // Default widths use reference curve if not specified
  const noseStations = STATIONS.map(s => {
    const key = `noseWidth${s}`;
    const refW = lerpRefCurve(curve, s / L) * widePointWidthIn;
    const w = params[key] !== undefined ? params[key] : refW;
    return { x: s, w: w / 2 }; // half-width
  });

  // Build tail station control points (only for stations beyond tail curve zone)
  const tailStations = STATIONS.filter(s => s > 12).map(s => {
    const key = `tailWidth${s}`;
    const refW = lerpRefCurve(curve, (L - s) / L) * widePointWidthIn;
    const w = params[key] !== undefined ? params[key] : refW;
    return { x: L - s, w: w / 2 }; // half-width
  }).reverse(); // sort by x ascending

  // Get tail width at 12" (the primary tail width param) - this scales the tail curve
  const tailWidth12 = params.tailWidthIn !== undefined ? params.tailWidthIn / 2 :
    lerpRefCurve(curve, (L - 12) / L) * halfMaxWidth;

  // Add tip points and wide point (tail tip now comes from curve)
  const tailTipWidth = tailCurve[0].w * tailWidth12;
  const allStations = [
    { x: 0, w: halfMaxWidth * noseConfig.tipWidth * 0.5 }, // nose tip
    ...noseStations,
    { x: widePoint, w: halfMaxWidth }, // wide point
    ...tailStations,
    { x: L, w: tailTipWidth }, // tail tip from curve definition
  ].sort((a, b) => a.x - b.x);

  // Remove duplicates (keep first)
  const uniqueStations = [];
  for (const s of allStations) {
    if (uniqueStations.length === 0 || Math.abs(s.x - uniqueStations[uniqueStations.length - 1].x) > 0.5) {
      uniqueStations.push(s);
    }
  }

  const SAMPLES = 200;
  let widths = [];

  for (let i = 0; i <= SAMPLES; i++) {
    const xIn = (i / SAMPLES) * L;
    let hw = stationSpline(uniqueStations, xIn);

    // ── NOSE TIP (first 2") — apply nose shape curve ──────────────────────
    if (xIn < 2) {
      const tipProgress = xIn / 2;
      const hw2 = stationSpline(uniqueStations, 2);
      const hwTip = hw2 * noseConfig.tipWidth;
      hw = hwTip + (hw2 - hwTip) * Math.pow(tipProgress, noseConfig.curveExp);
    }

    // ── TAIL (last 12") — use tail curve definition ───────────────────────
    const xFromTail = L - xIn;
    if (xFromTail <= 12) {
      // Interpolate the tail curve at this position
      const tailHW = stationSpline(tailCurve, xFromTail) * tailWidth12;

      // Blend from body outline to tail curve between 12" and 8" from tail
      if (xFromTail > 8) {
        const blendT = (xFromTail - 8) / 4; // 0 at 8", 1 at 12"
        hw = tailHW + (hw - tailHW) * blendT;
      } else {
        // Full tail curve control in last 8"
        hw = tailHW;
      }
    }

    widths.push(Math.max(0, hw));
  }

  // Smooth and clamp
  widths = smoothArray(widths, 2);
  widths = widths.map(w => Math.min(Math.max(0, w), halfMaxWidth));

  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    pts.push({ x: (i / SAMPLES) * L, halfWidth: widths[i] });
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROCKER — continuous or staged curve with flip/kick points
// ═══════════════════════════════════════════════════════════════════════════════
export function generateRocker(params) {
  const { lengthIn: L, noseRockerIn, tailRockerIn, entryRocker, exitRocker, rockerType } = params;
  const SAMPLES = 200;
  const mid = L / 2;
  const pts = [];

  // Entry/exit curve affects flip/kick point position (as fraction of half-length)
  // Flat = flip/kick starts later (closer to tip), Aggressive = starts earlier (more of the board curves)
  const noseFlipFrac = { flat: 0.35, moderate: 0.50, aggressive: 0.65 }[entryRocker] ?? 0.50;
  const tailKickFrac = { flat: 0.35, moderate: 0.50, aggressive: 0.65 }[exitRocker] ?? 0.50;

  // Curve exponent - how sharply the rocker accelerates
  const noseExp = { flat: 2.8, moderate: 2.2, aggressive: 1.8 }[entryRocker] ?? 2.2;
  const tailExp = { flat: 2.8, moderate: 2.2, aggressive: 1.8 }[exitRocker] ?? 2.2;

  const isStaged = rockerType === 'staged';

  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * L;
    let z = 0;

    if (isStaged) {
      // Staged rocker: flat middle, accelerated flip at nose, kick at tail
      const noseFlipStart = mid * (1 - noseFlipFrac); // where flip begins (from nose)
      const tailKickStart = mid + (mid * (1 - tailKickFrac)); // where kick begins (from nose)

      if (x < noseFlipStart) {
        // Nose flip zone - accelerated curve
        const t = (noseFlipStart - x) / noseFlipStart;
        z = noseRockerIn * Math.pow(t, noseExp);
      } else if (x > tailKickStart) {
        // Tail kick zone - accelerated curve
        const t = (x - tailKickStart) / (L - tailKickStart);
        z = tailRockerIn * Math.pow(t, tailExp);
      }
      // else: flat middle section, z stays 0
    } else {
      // Continuous rocker: smooth curve throughout
      // Flip/kick fractions affect where the curve is steepest
      if (x <= mid) {
        const t = (mid - x) / mid;
        // Blend between flat center and curved nose based on flip fraction
        const blendStart = 1 - noseFlipFrac;
        if (t > blendStart) {
          const localT = (t - blendStart) / noseFlipFrac;
          z = noseRockerIn * Math.pow(localT, noseExp);
        } else {
          // Gentle curve in the "flatter" zone
          z = noseRockerIn * Math.pow(t, noseExp + 1.5) * 0.3;
        }
      } else {
        const t = (x - mid) / (L - mid);
        const blendStart = 1 - tailKickFrac;
        if (t > blendStart) {
          const localT = (t - blendStart) / tailKickFrac;
          z = tailRockerIn * Math.pow(localT, tailExp);
        } else {
          z = tailRockerIn * Math.pow(t, tailExp + 1.5) * 0.3;
        }
      }
    }

    pts.push({ x, z });
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THICKNESS
// ═══════════════════════════════════════════════════════════════════════════════

function catmullRom(t, p0, p1, p2, p3) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2*p1 + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3);
}

function evalSpline(ctrlPts, x) {
  const n = ctrlPts.length;
  if (n === 0) return 0;
  if (n === 1) return ctrlPts[0].v;
  if (x <= ctrlPts[0].x) return ctrlPts[0].v;
  if (x >= ctrlPts[n - 1].x) return ctrlPts[n - 1].v;
  let seg = n - 2;
  for (let i = 0; i < n - 1; i++) {
    if (x < ctrlPts[i + 1].x) { seg = i; break; }
  }
  const x0 = ctrlPts[seg].x, x1 = ctrlPts[seg + 1].x;
  const localT = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
  return catmullRom(localT,
    ctrlPts[Math.max(0, seg - 1)].v, ctrlPts[seg].v,
    ctrlPts[seg + 1].v, ctrlPts[Math.min(n - 1, seg + 2)].v);
}

export function generateThickness(params) {
  const { lengthIn: L, noseThicknessIn, centerThicknessIn, tailThicknessIn, widePointIn } = params;
  const spine = [
    { x: 0,            v: 0.04 },
    { x: 12,           v: noseThicknessIn },
    { x: widePointIn || L * 0.5, v: centerThicknessIn },
    { x: L - 12,       v: tailThicknessIn },
    { x: L,            v: 0.06 },
  ];
  const SAMPLES = 200;
  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * L;
    pts.push({ x, thickness: Math.max(0.04, evalSpline(spine, x)) });
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOLUME
// ═══════════════════════════════════════════════════════════════════════════════
export function calculateVolume(params) {
  const outline = generateOutline(params);
  const thick = generateThickness(params);
  let vol = 0;
  for (let i = 0; i < outline.length - 1; i++) {
    const dx = outline[i + 1].x - outline[i].x;
    vol += (outline[i].halfWidth * 2) * thick[i].thickness * dx;
  }
  return (vol * 0.80) / 61.024;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOT VECTOR — clamped uniform B-spline
// ═══════════════════════════════════════════════════════════════════════════════
function generateUniformKnots(numPoints, degree) {
  const knots = [];
  const n = numPoints + degree + 1;
  for (let i = 0; i < n; i++) {
    if (i <= degree) knots.push(0);
    else if (i >= n - degree - 1) knots.push(1);
    else knots.push((i - degree) / (numPoints - degree));
  }
  return knots;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GEOMETRY BUILDER — NURBS Surface
// ═══════════════════════════════════════════════════════════════════════════════
export function generateSurfboardGeometry(params) {
  const outline = generateOutline(params);
  const rockerPts = generateRocker(params);
  const thickPts = generateThickness(params);
  const L = params.lengthIn;
  const Lm = inchesToMeters(L);
  const tailShape = params.tailShape || 'squash';
  const railType = params.railType || '50/50';
  const deckDome = params.deckDome || 'low';

  // ── Interpolation helpers ──────────────────────────────────────────────
  function interpOutlineHW(t) {
    const clamped = Math.max(0, Math.min(1, t));
    const idx = clamped * 200;
    const lo = Math.floor(Math.min(idx, 199));
    const hi = lo + 1;
    const f = idx - lo;
    return outline[lo].halfWidth * (1 - f) + outline[hi].halfWidth * f;
  }

  function interpRocker(xIn) {
    const f = Math.max(0, Math.min(1, xIn / L));
    const idx = f * (rockerPts.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, rockerPts.length - 1);
    return rockerPts[lo].z + (idx - lo) * (rockerPts[hi].z - rockerPts[lo].z);
  }

  function interpThick(xIn) {
    const f = Math.max(0, Math.min(1, xIn / L));
    const idx = f * (thickPts.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, thickPts.length - 1);
    return thickPts[lo].thickness + (idx - lo) * (thickPts[hi].thickness - thickPts[lo].thickness);
  }

  // ── Tail shape flags — needed before tValues to control station count ──
  const tailMeta = TAIL_SHAPES[tailShape] || { notch: false, wide: false };
  const isNotchedTail = tailMeta.notch;
  const isWideTail = tailMeta.wide;

  // ── Station t values — dense near tips, sparse in middle ───────────────
  // notched tails: extra station at 0.995 confines notch blend to last ~0.33"
  const tValues = isNotchedTail
    ? [0.0, 0.01, 0.03, 0.06, 0.10, 0.18, 0.28, 0.40, 0.50, 0.60, 0.72, 0.82, 0.90, 0.94, 0.97, 0.99, 0.995, 1.0]
    : [0.0, 0.01, 0.03, 0.06, 0.10, 0.18, 0.28, 0.40, 0.50, 0.60, 0.72, 0.82, 0.90, 0.94, 0.97, 0.99, 1.0];

  // ── Rail configs — blended along length ────────────────────────────────
  const RAIL_CONFIGS = {
    soft:    { apexFrac: 0.55, botCurve: 0.04, deckRailFrac: 0.82 },
    '50/50': { apexFrac: 0.48, botCurve: 0.06, deckRailFrac: 0.76 },
    down:    { apexFrac: 0.40, botCurve: 0.10, deckRailFrac: 0.66 },
    pinched: { apexFrac: 0.32, botCurve: 0.16, deckRailFrac: 0.56 },
    tucked:  { apexFrac: 0.26, botCurve: 0.22, deckRailFrac: 0.50 },
  };

  const bodyRail = RAIL_CONFIGS[railType] || RAIL_CONFIGS['50/50'];
  const noseRail = { apexFrac: 0.50, botCurve: 0.03, deckRailFrac: 0.80 };
  const tailRail = { apexFrac: 0.30, botCurve: 0.18, deckRailFrac: 0.55 };

  function lerpRail(a, b, f) {
    return {
      apexFrac:     a.apexFrac     + f * (b.apexFrac     - a.apexFrac),
      botCurve:     a.botCurve     + f * (b.botCurve     - a.botCurve),
      deckRailFrac: a.deckRailFrac + f * (b.deckRailFrac - a.deckRailFrac),
    };
  }

  function blendRail(t) {
    if (t < 0.20) return lerpRail(noseRail, bodyRail, t / 0.20);
    if (t > 0.70) return lerpRail(bodyRail, tailRail, (t - 0.70) / 0.30);
    return bodyRail;
  }

  // ── Build 13-point cross-section at a station ──────────────────────────
  // V direction: bottom center → right rail → deck center → left rail → close
  function buildCrossSection(xM, hwM, rYM, thM, domeH, rail) {
    const apexY = rYM + thM * rail.apexFrac;
    return [
      new THREE.Vector4(xM, rYM,                            0,            1), // 0: bottom center
      new THREE.Vector4(xM, rYM,                            hwM * 0.5,    1), // 1: bottom mid-right
      new THREE.Vector4(xM, rYM + thM * rail.botCurve,      hwM * 0.85,   1), // 2: bottom near rail
      new THREE.Vector4(xM, apexY,                          hwM,          1), // 3: rail apex right
      new THREE.Vector4(xM, rYM + thM * rail.deckRailFrac,  hwM * 0.7,    1), // 4: deck rail right
      new THREE.Vector4(xM, rYM + thM,                      hwM * 0.3,    1), // 5: deck shoulder right
      new THREE.Vector4(xM, rYM + thM + domeH,              0,            1), // 6: deck center
      new THREE.Vector4(xM, rYM + thM,                      -hwM * 0.3,   1), // 7: deck shoulder left
      new THREE.Vector4(xM, rYM + thM * rail.deckRailFrac,  -hwM * 0.7,   1), // 8: deck rail left
      new THREE.Vector4(xM, apexY,                          -hwM,         1), // 9: rail apex left
      new THREE.Vector4(xM, rYM + thM * rail.botCurve,      -hwM * 0.85,  1), // 10: bottom near rail left
      new THREE.Vector4(xM, rYM,                            -hwM * 0.5,   1), // 11: bottom mid-left
      new THREE.Vector4(xM, rYM,                            0,            1), // 12: bottom center (close)
    ];
  }

  // ── Build control point grid [U stations × V cross-section] ────────────
  const controlPoints = [];

  for (let si = 0; si < tValues.length; si++) {
    const t = tValues[si];
    const xIn = t * L;
    const hw  = interpOutlineHW(t);
    const rY  = interpRocker(xIn);
    const th  = interpThick(xIn);

    const xM   = inchesToMeters(xIn) - Lm / 2;
    const hwM  = inchesToMeters(hw);
    const rYM  = inchesToMeters(rY);
    const thM  = inchesToMeters(th);
    // ~1.5mm dome — completely invisible from top
    const domeH = inchesToMeters(0.06);
    // taper thickness to paper-thin at tips (skip for wide tails)
    const tipTaper = t < 0.05 ? t / 0.05
                   : (t > 0.95 && !isNotchedTail && !isWideTail) ? (1 - t) / 0.05
                   : 1.0;
    const effThM = thM * Math.pow(tipTaper, 0.7);
    const rail  = blendRail(t);

    const isNoseTip = (si === 0);
    const isTailTip = (si === tValues.length - 1);

    let row;

    if (isNoseTip) {
      // nose closure — all points converge
      const tipY = rYM + effThM * 0.4;
      row = Array.from({ length: 13 }, () => new THREE.Vector4(xM, tipY, 0, 1));

    } else if (isTailTip && !isWideTail) {
      // pin/round/diamond/swallow — all converge to clean rounded closure
      // For swallow/fish, the notch will be CUT via CSG after mesh generation
      const tipY = rYM + effThM * 0.4;
      row = Array.from({ length: 13 }, () => new THREE.Vector4(xM, tipY, 0, 1));

    } else if (isTailTip && isWideTail) {
      // squash/square tail — flat back edge with rounded or sharp corners
      const tailConfig = TAIL_SHAPES[tailShape] || TAIL_SHAPES.squash;
      const cornerR = tailConfig.cornerRadius ?? 0.6;
      const apexY = rYM + effThM * rail.apexFrac;

      // Corner rounding: 1.0 = fully rounded (like a half-pipe), 0.0 = sharp square
      // For squash, we want a blend - flat across most of the back, curves at corners
      const flatFrac = 1 - cornerR; // how much of the width is flat
      const flatHW = hwM * flatFrac * 0.7;

      row = [
        // bottom center to right corner
        new THREE.Vector4(xM, rYM,                            0,            1), // 0: bottom center
        new THREE.Vector4(xM, rYM,                            flatHW,       1), // 1: bottom flat R
        new THREE.Vector4(xM, rYM + effThM * rail.botCurve * cornerR, hwM * 0.85, 1), // 2: corner curve R
        new THREE.Vector4(xM, apexY,                          hwM,          1), // 3: rail apex R
        new THREE.Vector4(xM, rYM + effThM * rail.deckRailFrac, hwM * 0.85, 1), // 4: deck corner R
        new THREE.Vector4(xM, rYM + effThM,                   flatHW,       1), // 5: deck flat R
        new THREE.Vector4(xM, rYM + effThM + domeH,           0,            1), // 6: deck center
        new THREE.Vector4(xM, rYM + effThM,                  -flatHW,       1), // 7: deck flat L
        new THREE.Vector4(xM, rYM + effThM * rail.deckRailFrac, -hwM * 0.85, 1), // 8: deck corner L
        new THREE.Vector4(xM, apexY,                         -hwM,          1), // 9: rail apex L
        new THREE.Vector4(xM, rYM + effThM * rail.botCurve * cornerR, -hwM * 0.85, 1), // 10: corner curve L
        new THREE.Vector4(xM, rYM,                           -flatHW,       1), // 11: bottom flat L
        new THREE.Vector4(xM, rYM,                            0,            1), // 12: close
      ];

    } else {
      // normal cross-section (body stations)
      row = buildCrossSection(xM, hwM, rYM, effThM, domeH, rail);
    }

    controlPoints.push(row);
  }

  // ── NURBS surface ──────────────────────────────────────────────────────
  const degU = 3, degV = 3;
  const knotsU = generateUniformKnots(tValues.length, degU);
  const knotsV = generateUniformKnots(13, degV);

  const surface = new NURBSSurface(degU, degV, knotsU, knotsV, controlPoints);

  // tessellate: 150 segments along length, 48 around cross-section
  const geometry = new ParametricGeometry(
    (u, v, target) => surface.getPoint(u, v, target),
    150, 48,
  );

  geometry.computeVertexNormals();

  // debug
  const maxHW = Math.max(...outline.map(p => p.halfWidth));
  console.info(
    `[SurfCAD] NURBS ${params.boardType}: ${L}" × ${params.widePointWidthIn}" × ${params.thicknessIn}"` +
    ` | Max: ${(maxHW * 2).toFixed(1)}" | ${tValues.length} stations`,
  );

  return geometry;
}
