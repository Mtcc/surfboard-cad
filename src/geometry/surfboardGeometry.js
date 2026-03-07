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
  fish: [
    {t:0.000, w:0.08}, {t:0.015, w:0.22}, {t:0.03, w:0.36}, {t:0.05, w:0.50},
    {t:0.07, w:0.60}, {t:0.09, w:0.68}, {t:0.12, w:0.78}, {t:0.16, w:0.86},
    {t:0.20, w:0.92}, {t:0.26, w:0.96}, {t:0.32, w:0.99}, {t:0.40, w:1.00},
    {t:0.50, w:1.00}, {t:0.58, w:0.99}, {t:0.65, w:0.96}, {t:0.72, w:0.92},
    {t:0.78, w:0.87}, {t:0.83, w:0.82}, {t:0.88, w:0.75}, {t:0.92, w:0.66},
    {t:0.95, w:0.56}, {t:0.98, w:0.46}, {t:1.000, w:0.38},
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

function lerpRefCurve(curve, t) {
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
// OUTLINE
// ═══════════════════════════════════════════════════════════════════════════════
export function generateOutline(params) {
  const { lengthIn: L, widePointWidthIn, boardType = 'midLength' } = params;
  const halfWide = widePointWidthIn / 2;
  const curve = REFERENCE_OUTLINES[boardType] || REFERENCE_OUTLINES.midLength;

  const SAMPLES = 200;
  let widths = [];
  for (let i = 0; i <= SAMPLES; i++) {
    widths.push(lerpRefCurve(curve, i / SAMPLES) * halfWide);
  }
  widths = smoothArray(widths, 2);
  widths = widths.map(w => Math.min(Math.max(0, w), halfWide));

  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    pts.push({ x: (i / SAMPLES) * L, halfWidth: widths[i] });
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROCKER — power curve: flat center, smooth acceleration to tips
// ═══════════════════════════════════════════════════════════════════════════════
export function generateRocker(params) {
  const { lengthIn: L, noseRockerIn, tailRockerIn, entryRocker, exitRocker } = params;
  const noseExp = { flat: 3.5, moderate: 2.8, aggressive: 2.2 }[entryRocker] ?? 3.0;
  const tailExp = { flat: 3.5, moderate: 2.8, aggressive: 2.2 }[exitRocker]  ?? 3.0;
  const SAMPLES = 200;
  const mid = L / 2;
  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * L;
    let z;
    if (x <= mid) {
      z = noseRockerIn * Math.pow((mid - x) / mid, noseExp);
    } else {
      z = tailRockerIn * Math.pow((x - mid) / (L - mid), tailExp);
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
  const isSwallowFish = (tailShape === 'swallow' || tailShape === 'fish');
  const isSquash = (tailShape === 'squash');

  // ── Station t values — dense near tips, sparse in middle ───────────────
  // swallow/fish: extra station at 0.995 confines notch blend to last ~0.33"
  const tValues = isSwallowFish
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
                   : (t > 0.95 && !isSwallowFish && !isSquash) ? (1 - t) / 0.05
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

    } else if (isTailTip && !isSwallowFish && !isSquash) {
      // pin/round/diamond — all points converge to clean point
      const tipY = rYM + effThM * 0.4;
      row = Array.from({ length: 13 }, () => new THREE.Vector4(xM, tipY, 0, 1));

    } else if (isTailTip && isSwallowFish) {
      // swallow tail — center V-notch, wings at FULL tail outline width
      const sd    = inchesToMeters(params.swallowDepthIn || 3.5);
      const nxM   = xM - sd;           // notch tip (pulled back sd inches)
      const wHW   = hwM;               // wings at full tail outline width
      const midX  = xM - sd * 0.4;    // transition point x (40% of sd back from tail)
      const apexY = rYM + effThM * rail.apexFrac;
      row = [
        new THREE.Vector4(nxM,   rYM,                              0,           1), // 0: notch bottom center
        new THREE.Vector4(midX,  rYM,                              wHW * 0.4,   1), // 1: bottom transition R
        new THREE.Vector4(xM,    rYM + effThM * rail.botCurve,     wHW * 0.85,  1), // 2: bottom rail R
        new THREE.Vector4(xM,    apexY,                            wHW,          1), // 3: wing tip R
        new THREE.Vector4(xM,    rYM + effThM * rail.deckRailFrac, wHW * 0.7,   1), // 4: deck rail R
        new THREE.Vector4(midX,  rYM + effThM,                     wHW * 0.25,  1), // 5: deck shoulder R
        new THREE.Vector4(nxM,   rYM + effThM + domeH,             0,           1), // 6: notch deck center
        new THREE.Vector4(midX,  rYM + effThM,                    -wHW * 0.25,  1), // 7: deck shoulder L
        new THREE.Vector4(xM,    rYM + effThM * rail.deckRailFrac,-wHW * 0.7,   1), // 8: deck rail L
        new THREE.Vector4(xM,    apexY,                           -wHW,          1), // 9: wing tip L
        new THREE.Vector4(xM,    rYM + effThM * rail.botCurve,    -wHW * 0.85,  1), // 10: bottom rail L
        new THREE.Vector4(midX,  rYM,                             -wHW * 0.4,   1), // 11: bottom transition L
        new THREE.Vector4(nxM,   rYM,                              0,           1), // 12: notch close
      ];

    } else {
      // normal cross-section (body stations + squash tail — stays blunt)
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
