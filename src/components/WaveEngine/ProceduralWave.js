/**
 * ProceduralWave.js — Generates wave face + barrel geometry
 *
 * The wave is a single continuous surface: flat ocean that rises into
 * a steep face with a curling lip. No edges visible — extends beyond
 * the viewport in all directions.
 *
 * The height can be animated (0 = flat ocean, 1 = full breaking wave)
 * to show the wave forming from a swell line.
 *
 * Cross-section profile (x = cross-wave, y = height):
 *   flat ocean → gradual rise → steep face → crest → lip curl drop-off
 */

import * as THREE from 'three';
import { THEMES } from './themes.js';

// smooth interpolation — cubic hermite
function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// face boundaries — tighter = steeper face (KSPS-style wall)
const FACE_MIN_X = -3;   // bottom of the face (trough)
const FACE_MAX_X = 2;    // top of the face (crest) — 5m wide for steeper look
const TRANSITION_X = -8; // where flat ocean starts rising

/**
 * wave cross-section profile — steeper KSPS-style face
 * @param {number} x — cross-wave position (negative = ocean, positive = shore)
 * @param {number} H — max wave height in meters
 * @returns {number} y height at this x position
 */
function waveProfile(x, H) {
  // flat ocean
  if (x < TRANSITION_X) return 0;

  // transition zone: gentle rise from flat ocean to base of face
  if (x < FACE_MIN_X) {
    const t = (x - TRANSITION_X) / (FACE_MIN_X - TRANSITION_X);
    return H * 0.03 * smoothstep(t);
  }

  // the face: concave S-curve from trough to crest
  // use a steeper curve (power function) for that KSPS wall look
  if (x < FACE_MAX_X) {
    const t = (x - FACE_MIN_X) / (FACE_MAX_X - FACE_MIN_X);
    // concave curve — slow at bottom, steep in the middle, rounds at crest
    const curved = t < 0.4
      ? 0.5 * Math.pow(t / 0.4, 1.5) // gradual at trough
      : 0.5 + 0.5 * smoothstep((t - 0.4) / 0.6); // steep through mid/upper face
    return H * curved;
  }

  // past the crest: quick drop to ocean level (back of wave)
  if (x < FACE_MAX_X + 1.5) {
    const t = (x - FACE_MAX_X) / 1.5;
    return H * Math.max(0, 1 - t * t * 3);
  }

  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE FACE GEOMETRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * create the wave face as a displaced plane
 * @param {number} H — max wave height (meters)
 * @param {number} width — cross-wave extent (meters)
 * @param {number} length — along-wave extent (meters)
 * @param {string} themeId — color theme id
 */
export function createWaveFace(H, width = 200, length = 300, themeId = 'day') {
  const theme = THEMES[themeId] || THEMES.day;

  const segX = 80;
  const segZ = 120;

  // build geometry manually so we control the layout
  const vertices = new Float32Array((segX + 1) * (segZ + 1) * 3);
  const vertColors = new Float32Array((segX + 1) * (segZ + 1) * 3);
  const uvs = new Float32Array((segX + 1) * (segZ + 1) * 2);
  const indices = [];

  // precompute the "full height" Y values for animation (pre-ripple)
  const fullY = new Float32Array((segX + 1) * (segZ + 1));

  // 5-stop gradient from theme: trough → lower face → mid face → upper face → crest
  const c1 = new THREE.Color(theme.waveTrough);
  const c2 = new THREE.Color(theme.waveLower);
  const c3 = new THREE.Color(theme.waveMid);
  const c4 = new THREE.Color(theme.waveUpper);
  const c5 = new THREE.Color(theme.waveCrest);
  const cOcean = new THREE.Color(theme.waveOcean);
  const temp = new THREE.Color();

  let idx = 0;
  for (let iz = 0; iz <= segZ; iz++) {
    const z = (iz / segZ - 0.5) * length;
    for (let ix = 0; ix <= segX; ix++) {
      const x = (ix / segX - 0.5) * width;
      let y = waveProfile(x, H);

      vertices[idx * 3] = x;
      vertices[idx * 3 + 1] = y;
      vertices[idx * 3 + 2] = z;

      // store pre-ripple Y for animation
      fullY[idx] = y;

      // horizontal ripple texture on the face (dark streaks like KSPS)
      const onFace = x > TRANSITION_X && x < FACE_MAX_X + 0.5;
      if (onFace && y > 0.1) {
        const ripple = Math.sin(z * 2.0) * 0.06 + Math.sin(z * 5.5) * 0.025 + Math.sin(z * 13.0) * 0.008;
        y += ripple * (y / H); // stronger ripple higher on the face
        vertices[idx * 3 + 1] = y;
      }

      uvs[idx * 2] = ix / segX;
      uvs[idx * 2 + 1] = iz / segZ;

      // vertex color: 5-stop gradient on the face, ocean color elsewhere
      if (x > FACE_MAX_X + 0.5 || x < TRANSITION_X) {
        temp.copy(cOcean);
      } else {
        const ht = H > 0 ? fullY[idx] / H : 0;
        if (ht < 0.15) temp.lerpColors(c1, c2, ht / 0.15);
        else if (ht < 0.4) temp.lerpColors(c2, c3, (ht - 0.15) / 0.25);
        else if (ht < 0.7) temp.lerpColors(c3, c4, (ht - 0.4) / 0.3);
        else temp.lerpColors(c4, c5, (ht - 0.7) / 0.3);
      }

      vertColors[idx * 3] = temp.r;
      vertColors[idx * 3 + 1] = temp.g;
      vertColors[idx * 3 + 2] = temp.b;

      idx++;
    }
  }

  // triangle indices
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * (segX + 1) + ix;
      const b = a + 1;
      const c = a + (segX + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(vertColors, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // store fullY for height animation + theme for later reads
  geo.userData.fullY = fullY;
  geo.userData.waveHeight = H;
  geo.userData.themeId = themeId;

  return geo;
}

/**
 * animate the wave height (0 = flat ocean, 1 = full wave)
 * this modifies vertices in-place — call each frame during formation
 */
export function setWaveHeightFactor(geo, factor) {
  const positions = geo.attributes.position;
  const fullY = geo.userData.fullY;
  if (!fullY) return;

  const f = Math.max(0, Math.min(1, factor));
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, fullY[i] * f);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BARREL LIP GEOMETRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * create the barrel lip — a curved surface arcing from the crest
 * forward and down, forming the tube
 */
export function createBarrelLip(H, barrelRadius, length = 300, themeId = 'day') {
  if (!barrelRadius || barrelRadius <= 0) return null;

  const theme = THEMES[themeId] || THEMES.day;

  const arcSegs = 16;
  const zSegs = 80;
  const arcAngle = Math.PI * 0.65; // how far the lip curls (0.65 = nice barrel)

  const crestX = FACE_MAX_X;  // where the crest is in the face profile
  const crestY = H;

  const verts = [];
  const vertColors = [];
  const indices = [];

  const lipOuter = new THREE.Color(theme.barrelOuter);
  const lipInner = new THREE.Color(theme.barrelInner);
  const temp = new THREE.Color();

  for (let iz = 0; iz <= zSegs; iz++) {
    const z = (iz / zSegs - 0.5) * length;
    for (let ia = 0; ia <= arcSegs; ia++) {
      const angle = (ia / arcSegs) * arcAngle;

      // arc from crest, curving forward (-x) and down (-y)
      const x = crestX - barrelRadius * Math.sin(angle);
      const y = crestY - barrelRadius * (1 - Math.cos(angle));

      verts.push(x, y, z);

      // color: bright at the lip, darker inside the barrel
      const ct = ia / arcSegs;
      temp.lerpColors(lipOuter, lipInner, ct);
      vertColors.push(temp.r, temp.g, temp.b);
    }
  }

  for (let iz = 0; iz < zSegs; iz++) {
    for (let ia = 0; ia < arcSegs; ia++) {
      const a = iz * (arcSegs + 1) + ia;
      const b = a + 1;
      const c = a + (arcSegs + 1);
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(vertColors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  geo.userData.waveHeight = H;
  geo.userData.themeId = themeId;
  return geo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: get wave Y at a world position (for board placement)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * get the wave surface height at a given x position
 * @param {number} x — world x position
 * @param {number} H — current wave height (after animation factor)
 */
export function getWaveYAtX(x, H) {
  return waveProfile(x, H);
}

/**
 * get the wave face slope at x (for board tilt)
 * returns angle in radians
 */
export function getWaveSlopeAtX(x, H) {
  const dx = 0.1;
  const y1 = waveProfile(x - dx, H);
  const y2 = waveProfile(x + dx, H);
  return Math.atan2(y2 - y1, dx * 2);
}
