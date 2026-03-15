/**
 * BoardPhysics.js — Board design parameters → physics properties
 *
 * Takes the board's design parameters from the SurfCAD designer
 * and computes physics properties used in the simulation.
 *
 * Input: board params object from App state (same shape as templates.js)
 * Output: physics properties object used by SimulationLoop
 *
 * All internal calculations in SI units (meters, kg, seconds).
 * Board params arrive in inches — converted at the boundary.
 */

const IN_TO_M = 0.0254; // inches to meters

// ═══════════════════════════════════════════════════════════════════════════════
// RAIL TYPE MAPPING
// existing codebase uses: soft, 50/50, down, pinched, tucked
// physics engine normalizes to grip/speed/lean values
// ═══════════════════════════════════════════════════════════════════════════════

const RAIL_GRIP = {
  'soft':    0.35,
  '50/50':   0.40,
  'down':    0.65,
  'pinched': 0.85,
  'tucked':  0.95,
};

const RAIL_SPEED_FACTOR = {
  'soft':    1.0,
  '50/50':   1.0,
  'down':    1.15,
  'pinched': 1.25,
  'tucked':  1.3,
};

const RAIL_MAX_LEAN = {
  'soft':    25,
  '50/50':   30,
  'down':    45,
  'pinched': 55,
  'tucked':  65,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAIL SHAPE MAPPING
// existing codebase uses camelCase: squash, pin, round, roundPin, swallow,
// fish, diamond, bat, wingedSwallow, wingedSquash, wingedRound, roundedDiamond, square, roundedSquare
// ═══════════════════════════════════════════════════════════════════════════════

const TAIL_TURN_FACTOR = {
  'squash':         0.85,
  'roundedSquare':  0.87,
  'square':         0.88,
  'bat':            0.83,
  'wingedSquash':   0.84,
  'swallow':        0.88,
  'fish':           0.88,
  'wingedSwallow':  0.86,
  'diamond':        0.90,
  'roundedDiamond': 0.92,
  'round':          1.0,
  'roundPin':       1.1,
  'wingedRound':    1.0,
  'pin':            1.25,
};

const TAIL_HOLD_FACTOR = {
  'pin':            1.0,
  'roundPin':       0.9,
  'round':          0.75,
  'wingedRound':    0.7,
  'roundedDiamond': 0.65,
  'diamond':        0.6,
  'swallow':        0.55,
  'fish':           0.55,
  'wingedSwallow':  0.52,
  'squash':         0.5,
  'roundedSquare':  0.48,
  'bat':            0.45,
  'wingedSquash':   0.47,
  'square':         0.42,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIN SETUP MAPPING
// existing codebase uses: thruster, twin, single, 2+1, quad
// ═══════════════════════════════════════════════════════════════════════════════

const FIN_TURN_FACTOR = {
  'thruster': 1.0,
  'quad':     0.95,
  'twin':     1.1,
  'single':   0.7,
  '2+1':      0.85,
  'five_fin': 1.0,
};

const FIN_DRIVE = {
  'thruster': 0.75,
  'quad':     0.9,
  'twin':     0.85,
  'single':   0.5,
  '2+1':      0.6,
  'five_fin': 0.8,
};

const FIN_LEAN_BONUS = {
  'thruster': 8,
  'quad':     10,
  'twin':     3,
  'single':   5,
  '2+1':      6,
  'five_fin': 9,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * minimum speed to get the board planing (m/s)
 * surfboards plane at much lower speeds than powerboat hulls due to
 * light weight, flat bottoms, and wave-face assistance.
 * typical planing onset: shortboard ~2-3 m/s, longboard ~1.5-2.5 m/s
 *
 * rocker increases planing speed (water deflection lifts nose)
 * width decreases planing speed (more lift area)
 * source: Savitsky planing hull equations, adapted for surfboard weight class
 */
function calculatePlaningSpeed(lengthM, widthM, totalRockerM) {
  // base: ~2 m/s for a typical shortboard, scaled by aspect ratio
  const base = 1.5 + (lengthM / widthM) * 0.3;

  // rocker penalty: more rocker needs more speed to get flat on the water
  const rockerPenalty = 1 + totalRockerM * 3;

  // wider boards plane earlier
  const widthBonus = 1 - (widthM - 0.5) * 0.5;

  return base * rockerPenalty * Math.max(0.6, widthBonus);
}

/**
 * maximum speed the board can sustain (m/s)
 * surfboards are extreme planing hulls — they exceed displacement hull speed
 * by 4-6x due to dynamic lift on the wave face.
 *
 * hull speed: V = 1.34 * sqrt(LWL_ft) in knots (displacement limit)
 * planing factor: 4.5x for surfboards (empirical, varies with conditions)
 *
 * typical max speeds:
 *   small wave shortboard: 15-20 mph (6.7-8.9 m/s)
 *   overhead surf: 20-30 mph (8.9-13.4 m/s)
 *   big wave gun: 30-45 mph (13.4-20.1 m/s)
 *
 * source: Froude number analysis + empirical surfboard GPS data (Surfline)
 */
function calculateMaxSpeed(lengthM, totalRockerM, railType) {
  const KN_TO_MS = 0.5144;
  // rocker reduces effective waterline length
  const lwlFt = (lengthM * 3.28084) * (1 - totalRockerM * 2);
  const hullSpeed = 1.34 * Math.sqrt(Math.max(lwlFt, 3)) * KN_TO_MS;

  // surfboards vastly exceed hull speed when planing on wave face
  const planingMultiplier = 4.5;
  const railFactor = RAIL_SPEED_FACTOR[railType] || 1.15;
  return hullSpeed * planingMultiplier * railFactor;
}

/**
 * drag coefficient (dimensionless)
 * more surface area, more rocker, rougher bottom = more drag
 *
 * target terminal velocities (on moderate wave face):
 *   shortboard: 12-18 mph (5.4-8 m/s)  → Cd ~ 0.015-0.025
 *   longboard: 10-14 mph (4.5-6.3 m/s) → Cd ~ 0.020-0.030
 *   gun: 18-30 mph (8-13 m/s)           → Cd ~ 0.008-0.015
 *
 * source: approximated from surfboard CFD studies (Lavery et al., Oggiano et al.)
 */
function calculateDrag(lengthM, widthM, totalRockerM, bottomContour) {
  // base drag scaled by wetted area — surfboards are extremely low-drag
  let cd = 0.008 + (lengthM * widthM) * 0.004;

  // rocker adds drag from water deflection, but effect is modest
  cd += totalRockerM * 0.04;

  // bottom contour affects drag
  const contourDrag = {
    'flat': 0,
    'singleConcave': -0.002,  // concaves channel water = less drag
    'doubleConcave': -0.001,
    'vee': 0.002,             // vee deflects water outward = more drag
    'channel': -0.003,        // channels reduce drag most
  }[bottomContour] || 0;

  cd += contourDrag;
  return Math.max(0.005, cd);
}

/**
 * minimum turning radius (meters)
 * shorter board + narrower tail + more tail rocker = tighter turns
 * tail shape shifts the pivot point
 * source: surfboard dynamics analysis, Paine "The Physics of Surfing"
 */
function calculateTurnRadius(lengthM, tailWidthM, tailRockerM, tailShape) {
  const base = lengthM * 1.5;

  // narrower tail = tighter turns (normalized around 0.4m / ~16")
  const tailFactor = tailWidthM / 0.4;

  // more tail rocker = tighter pivot (capped at 40% reduction)
  const rockerFactor = 1 - Math.min(tailRockerM * 15, 0.4);

  const shapeFactor = TAIL_TURN_FACTOR[tailShape] || 1.0;

  return Math.max(0.5, base * tailFactor * rockerFactor * shapeFactor);
}

/**
 * turn rate (degrees/second at reference speed of 1 m/s)
 * inverse of turn radius, modified by fin setup
 */
function calculateTurnRate(lengthM, tailWidthM, tailRockerM, tailShape, finSetup) {
  const radius = calculateTurnRadius(lengthM, tailWidthM, tailRockerM, tailShape);
  const baseRate = 180 / (Math.PI * radius);

  const finFactor = FIN_TURN_FACTOR[finSetup] || 1.0;
  return baseRate * finFactor;
}

/**
 * stability score (0-1)
 * width is primary factor, thickness and volume add secondary stability
 */
function calculateStability(widthM, thicknessM, volumeL) {
  // 0.58m (~23") = max stability from width alone
  const widthScore = Math.min(1, widthM / 0.58);
  // 0.08m (~3.1") = max stability from thickness
  const thickScore = Math.min(1, thicknessM / 0.08);
  // 45L = very stable
  const volScore = Math.min(1, volumeL / 45);

  return widthScore * 0.5 + thickScore * 0.25 + volScore * 0.25;
}

/**
 * paddle power (0-1)
 * determines how easily the surfer catches waves
 * volume is king, then length, width, and rocker all contribute
 */
function calculatePaddlePower(lengthM, widthM, volumeL, totalRockerM) {
  const volScore = Math.min(1, volumeL / 50);
  const lengthScore = Math.min(1, lengthM / 2.74); // 9ft = top score
  const widthScore = Math.min(1, widthM / 0.56);   // 22" = good
  // flat boards glide better (capped at 50% penalty)
  const rockerPenalty = 1 - Math.min(totalRockerM * 8, 0.5);

  return volScore * 0.4 + lengthScore * 0.25 + widthScore * 0.15 + rockerPenalty * 0.2;
}

/**
 * rail grip (0-1) — how well the board grips the wave face
 */
function calculateRailGrip(railType) {
  return RAIL_GRIP[railType] || 0.65;
}

/**
 * max lean angle before sliding out (degrees)
 */
function calculateMaxLean(railType, finSetup) {
  const railMax = RAIL_MAX_LEAN[railType] || 45;
  const finBonus = FIN_LEAN_BONUS[finSetup] || 5;
  return railMax + finBonus;
}

/**
 * wave hold (0-1) — how well the board holds in steep/powerful waves
 * pin tail + hard rails + more rocker + longer = better hold
 */
function calculateWaveHold(lengthM, tailWidthM, tailShape, railType, totalRockerM) {
  const lengthScore = Math.min(1, lengthM / 2.3); // 7'6" = solid hold
  const tailScore = 1 - (tailWidthM / 0.5);
  const shapeFactor = TAIL_HOLD_FACTOR[tailShape] || 0.6;
  const railScore = calculateRailGrip(railType);
  const rockerScore = Math.min(1, totalRockerM * 10);

  return lengthScore * 0.2 + tailScore * 0.2 + shapeFactor * 0.25 + railScore * 0.2 + rockerScore * 0.15;
}

/**
 * drive (0-1) — how well the board converts rail-to-rail transitions into speed
 * narrower tail + tail rocker + fin setup
 */
function calculateDrive(tailWidthM, tailRockerM, finSetup) {
  const tailScore = 1 - (tailWidthM / 0.5) * 0.5;
  const rockerScore = Math.min(1, tailRockerM * 15);
  const finDriveScore = FIN_DRIVE[finSetup] || 0.7;

  return tailScore * 0.3 + rockerScore * 0.3 + finDriveScore * 0.4;
}

/**
 * aerial potential (0-1) — how easily the board launches off the lip
 * shorter + lighter + more tail rocker = more potential
 */
function calculateAerialPotential(lengthM, widthM, volumeL, tailRockerM) {
  const lengthScore = 1 - Math.min(1, lengthM / 2.1);  // under 6'10" ideal
  const volScore = 1 - Math.min(1, volumeL / 35);
  const rockerScore = Math.min(1, tailRockerM * 20);

  return lengthScore * 0.35 + volScore * 0.3 + rockerScore * 0.35;
}

/**
 * barrel score (0-1) — how well the board handles inside the tube
 * shorter + pin/round tail + rail grip + rocker
 */
function calculateBarrelScore(lengthM, tailShape, railType, totalRockerM) {
  const lengthScore = 1 - Math.min(1, (lengthM - 1.5) / 1.5);
  const tailScore = { 'pin': 1, 'roundPin': 0.9, 'round': 0.75, 'squash': 0.5 }[tailShape] || 0.6;
  const gripScore = calculateRailGrip(railType);
  const rockerScore = Math.min(1, totalRockerM * 12);

  return lengthScore * 0.2 + tailScore * 0.3 + gripScore * 0.25 + rockerScore * 0.25;
}

/**
 * nose ride score — only relevant for boards > 8ft / 2.4m
 * wider nose + single fin = better nose riding
 */
function calculateNoseRide(params, lengthM, widthM) {
  if (lengthM <= 2.4) return 0;

  const noseWidthM = (params.noseWidthIn || 14) * IN_TO_M;
  const noseWidthRatio = noseWidthM / widthM; // how wide is the nose relative to max
  const finScore = params.finConfig === 'single' ? 1.0 :
                   params.finConfig === '2+1' ? 0.6 : 0.2;

  return Math.min(1, noseWidthRatio * 0.6 + finScore * 0.4);
}

/**
 * estimate volume in liters from dimensions (fallback if not computed from geometry)
 * uses elliptical cross-section approximation
 */
function estimateVolume(lengthM, widthM, thicknessM) {
  // elliptical cylinder approximation with 0.6 fill factor for surfboard shape
  return lengthM * widthM * thicknessM * Math.PI / 4 * 0.6 * 1000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — compute all physics properties from board params
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * takes board params (as stored in App state / templates) and returns
 * a complete physics properties object for the simulation
 */
export function computeBoardPhysics(params, volumeL) {
  // convert to SI
  const lengthIn = params.lengthFt * 12 + (params.lengthIn_extra || 0);
  const lengthM = lengthIn * IN_TO_M;
  const widthM = (params.widthIn || params.widePointWidthIn) * IN_TO_M;
  const thicknessM = params.thicknessIn * IN_TO_M;
  const noseRockerM = (params.noseRockerIn || 4) * IN_TO_M;
  const tailRockerM = (params.tailRockerIn || 2) * IN_TO_M;
  const totalRockerM = noseRockerM + tailRockerM;
  const tailWidthM = (params.tailWidthIn || params.widthIn * 0.75) * IN_TO_M;

  // volume: prefer computed, fall back to estimate
  const vol = volumeL || estimateVolume(lengthM, widthM, thicknessM);

  const railType = params.railType || '50/50';
  const tailShape = params.tailShape || 'squash';
  const finSetup = params.finConfig || 'thruster';
  const bottomContour = params.bottomContour || 'flat';

  return {
    planingSpeedMS: calculatePlaningSpeed(lengthM, widthM, totalRockerM),
    maxSpeedMS: calculateMaxSpeed(lengthM, totalRockerM, railType),
    dragCoefficient: calculateDrag(lengthM, widthM, totalRockerM, bottomContour),
    minTurnRadiusM: calculateTurnRadius(lengthM, tailWidthM, tailRockerM, tailShape),
    turnRateDegS: calculateTurnRate(lengthM, tailWidthM, tailRockerM, tailShape, finSetup),
    stability: calculateStability(widthM, thicknessM, vol),
    paddlePower: calculatePaddlePower(lengthM, widthM, vol, totalRockerM),
    railGrip: calculateRailGrip(railType),
    maxLeanAngleDeg: calculateMaxLean(railType, finSetup),
    waveHold: calculateWaveHold(lengthM, tailWidthM, tailShape, railType, totalRockerM),
    drive: calculateDrive(tailWidthM, tailRockerM, finSetup),
    aerialScore: calculateAerialPotential(lengthM, widthM, vol, tailRockerM),
    barrelScore: calculateBarrelScore(lengthM, tailShape, railType, totalRockerM),
    noseRideScore: calculateNoseRide(params, lengthM, widthM),

    // buoyancy ratio filled in by SurferPhysics when surfer weight is known
    buoyancyRatio: 0,

    // raw dimensions for direct access
    lengthM,
    widthM,
    thicknessM,
    volumeL: vol,
    noseRockerM,
    tailRockerM,
    tailWidthM,
  };
}
