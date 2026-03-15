/**
 * WavePhysics.js — Wave energy, shoaling, breaking, and face properties
 *
 * All calculations use SI units internally (meters, seconds, kg, joules).
 * Sources cited inline per project convention.
 */

// physical constants
const RHO_SALTWATER = 1025; // kg/m^3 — density of seawater
const G = 9.81;             // m/s^2 — gravitational acceleration

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE ENERGY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * wave energy density (J/m^2)
 * E = (1/8) * rho * g * H^2
 * source: Coastal Engineering Manual, USACE
 */
export function waveEnergyDensity(waveHeightM) {
  return (1 / 8) * RHO_SALTWATER * G * Math.pow(waveHeightM, 2);
}

/**
 * wave power per meter of crest (W/m)
 * P = E * Cg, where Cg = (g * T) / (4 * pi) in deep water
 * source: Holthuijsen, "Waves in Oceanic and Coastal Waters"
 */
export function wavePowerPerMeter(waveHeightM, wavePeriodS) {
  const E = waveEnergyDensity(waveHeightM);
  const Cg = (G * wavePeriodS) / (4 * Math.PI); // deep water group velocity (m/s)
  return E * Cg;
}

/**
 * total wave power over rideable section (kW)
 */
export function totalWavePowerKW(waveHeightM, wavePeriodS, rideableLengthM) {
  return (wavePowerPerMeter(waveHeightM, wavePeriodS) * rideableLengthM) / 1000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE TRANSFORMATION (shoaling + breaking)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * shoaling coefficient — wave height increases as water gets shallower
 * Ks = sqrt(Cg_deep / Cg_shallow)
 * Cg_deep = (g * T) / (4 * pi)
 * Cg_shallow = sqrt(g * d)
 * source: Dean & Dalrymple, "Water Wave Mechanics for Engineers and Scientists"
 */
export function shoalingCoefficient(wavePeriodS, depthM) {
  const CgDeep = (G * wavePeriodS) / (4 * Math.PI);
  const CgShallow = Math.sqrt(G * Math.max(depthM, 0.1)); // clamp to avoid div/0
  return Math.sqrt(CgDeep / CgShallow);
}

/**
 * wave breaking type from Iribarren number
 * xi = tan(alpha) / sqrt(H / L)
 * xi < 0.5: spilling (mushy, crumbly — Waikiki, Malibu)
 * 0.5 < xi < 3.3: plunging (barreling, hollow — Pipeline, Teahupo'o)
 * xi > 3.3: surging (shore break)
 * source: McCowan 1894, Battjes 1974
 */
export function breakingType(bottomSlope, waveHeightM, wavelengthM) {
  const iribarren = bottomSlope / Math.sqrt(waveHeightM / wavelengthM);

  if (iribarren < 0.5) return 'spilling';
  if (iribarren < 3.3) return 'plunging';
  return 'surging';
}

/**
 * iribarren number (useful for downstream calcs)
 */
export function iribarrenNumber(bottomSlope, waveHeightM, wavelengthM) {
  return bottomSlope / Math.sqrt(waveHeightM / wavelengthM);
}

/**
 * breaking wave height — wave breaks when H/d >= 0.78
 * source: McCowan 1894
 */
export function breakingDepth(waveHeightM) {
  return waveHeightM / 0.78; // depth at which wave breaks
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE FACE PROPERTIES AT SURFER POSITION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * interpolate depth from bathymetry contour at a given distance from shore
 */
export function interpolateDepth(distanceFromShoreM, contour) {
  if (!contour || contour.length === 0) return 10;

  // contour is sorted by distance descending (deep water first)
  // find the two bracketing points
  for (let i = 0; i < contour.length - 1; i++) {
    const far = contour[i];
    const near = contour[i + 1];
    if (distanceFromShoreM <= far.distance && distanceFromShoreM >= near.distance) {
      const t = (distanceFromShoreM - near.distance) / (far.distance - near.distance);
      return near.depth + t * (far.depth - near.depth);
    }
  }

  // outside contour range
  if (distanceFromShoreM > contour[0].distance) return contour[0].depth;
  return contour[contour.length - 1].depth;
}

/**
 * local face steepness (degrees) based on position on the wave face
 * steeper in the pocket (near breaking), flatter on the shoulder
 * facePosition: 0 = bottom of face, 1 = lip
 * powerZone: 0-1, how close to the critical/breaking section
 */
export function calculateLocalSteepness(facePosition, baseSteepness, powerZone) {
  // steepness increases higher on the face and closer to the pocket
  const faceMultiplier = 0.6 + facePosition * 0.8; // 0.6x at bottom, 1.4x at lip
  const pocketMultiplier = 0.5 + powerZone * 0.5;  // 0.5x on shoulder, 1.0x in pocket
  return baseSteepness * faceMultiplier * pocketMultiplier;
}

/**
 * local face height (m) — tapers from full height at peak to 0 at shoulder end
 */
export function calculateLocalFaceHeight(linePosition, totalFaceHeightM) {
  // linePosition: 0 = peak/pocket, 1 = end of shoulder
  const taper = Math.max(0, 1 - linePosition * linePosition);
  return totalFaceHeightM * taper;
}

/**
 * power zone factor (0-1)
 * 1.0 in the pocket (steepest part just ahead of the breaking lip)
 * 0.0 on the flat shoulder or in the whitewater
 * linePosition: 0 = behind the break (whitewater), 0.3 = pocket, 1.0 = shoulder
 */
export function calculatePowerZone(linePosition) {
  // bell curve centered at 0.3 (the pocket)
  const dist = Math.abs(linePosition - 0.3);
  return Math.max(0, 1 - dist * 2.5);
}

/**
 * is the lip actively throwing at this position?
 */
export function isLipThrowing(facePosition, linePosition, lipThrow) {
  return facePosition > 0.8 && linePosition < 0.4 && lipThrow > 0.3;
}

/**
 * barrel detection — surfer is inside the tube when:
 * - face position is in the upper half (0.5-0.85)
 * - near the pocket (linePosition < 0.35)
 * - wave has barrel depth
 */
export function isInsideBarrel(facePosition, linePosition, barrelDepth) {
  return barrelDepth > 0.3 &&
    facePosition > 0.5 && facePosition < 0.85 &&
    linePosition < 0.35;
}

/**
 * push direction — the wave pushes the surfer toward shore and along the face
 * returns a normalized direction vector {shoreward, alongFace}
 */
export function calculatePushDirection(facePosition) {
  // higher on the face = more shoreward push
  // lower = more along-face component
  const shoreward = 0.3 + facePosition * 0.5;
  const alongFace = 1 - shoreward;
  return { shoreward, alongFace };
}

/**
 * gravity component along the wave face (m/s^2)
 * steeper face = more gravity pulling surfer down the face
 */
export function gravityAlongFace(steepnessDeg) {
  return G * Math.sin(steepnessDeg * Math.PI / 180);
}

/**
 * shallow water wave speed (m/s)
 * c = sqrt(g * d)
 * source: Airy wave theory
 */
export function shallowWaterSpeed(depthM) {
  return Math.sqrt(G * Math.max(depthM, 0.1));
}

/**
 * composite wave face properties at a given position
 * this is the main function the simulation loop calls each frame
 */
export function getWaveFaceAt(wavePosition, spotProfile, bathymetry) {
  const { face, line } = wavePosition;
  const depth = interpolateDepth(
    bathymetry.contour[Math.floor(bathymetry.contour.length / 2)]?.distance || 50,
    bathymetry.contour,
  );

  const steepness = calculateLocalSteepness(face, spotProfile.faceSteepness, calculatePowerZone(line));
  const faceHeight = calculateLocalFaceHeight(line, spotProfile.waveHeight);
  const powerZone = calculatePowerZone(line);
  const speed = shallowWaterSpeed(depth);
  const lipActive = isLipThrowing(face, line, spotProfile.lipThrow);
  const barrel = isInsideBarrel(face, line, spotProfile.barrelDepth);
  const push = calculatePushDirection(face);
  const gravForce = gravityAlongFace(steepness);

  return {
    steepness,
    faceHeight,
    depth,
    speed,
    powerZone,
    lipActive,
    insideBarrel: barrel,
    pushDirection: push,
    gravityAlongFace: gravForce,
  };
}
