/**
 * SurferPhysics.js — Surfer body, stance, weight distribution
 *
 * Models how the surfer's body interacts with the board.
 * Weight, height, stance width, skill level, and real-time
 * stance position all affect board behavior.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT SURFER PROFILE
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_SURFER = {
  weightKg: 75,
  heightCm: 178,
  stanceWidthCm: 50,      // wider = more stable, less agile
  skillLevel: 0.7,        // 0-1: affects how efficiently they use the board
  footedness: 'regular',  // 'regular' (left foot forward) or 'goofy'
};

// ═══════════════════════════════════════════════════════════════════════════════
// SURFER-BOARD INTERACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * volume-to-weight ratio match assessment
 * performance surfers: 0.33-0.38 L/kg
 * recreational: 0.45-0.60 L/kg
 * beginners: 0.65-0.85 L/kg
 */
function calculateVolumeMatch(ratio, skillLevel) {
  // ideal range shifts with skill — pros ride less volume
  const idealMin = 0.30 + (1 - skillLevel) * 0.25; // pro: 0.30, beginner: 0.55
  const idealMax = 0.45 + (1 - skillLevel) * 0.30; // pro: 0.45, beginner: 0.75

  if (ratio >= idealMin && ratio <= idealMax) return 1.0;
  if (ratio < idealMin) return Math.max(0, ratio / idealMin);
  return Math.max(0, 1 - (ratio - idealMax) * 3);
}

/**
 * compute interaction between surfer profile and board physics
 * returns combined properties used by the simulation loop
 */
export function computeSurferBoardInteraction(surfer, boardPhysics) {
  const volWeightRatio = boardPhysics.volumeL / surfer.weightKg;

  return {
    volWeightRatio,
    volumeMatch: calculateVolumeMatch(volWeightRatio, surfer.skillLevel),

    // effective paddle power — more volume relative to weight = easier paddle
    effectivePaddle: boardPhysics.paddlePower * (1 + (volWeightRatio - 0.4) * 2),

    // effective stability — stance width adds stability
    effectiveStability: boardPhysics.stability * (0.8 + surfer.stanceWidthCm / 250),

    // effective turn rate — skill and weight affect how much torque the surfer generates
    // heavier surfers generate more torque but are harder to change direction
    effectiveTurnRate: boardPhysics.turnRateDegS * surfer.skillLevel *
      (1 + (surfer.weightKg - 75) * 0.003),

    // center of gravity height when crouched (~45% of standing height)
    cogHeight: (surfer.heightCm / 100) * 0.45,

    // duck dive threshold: generally volume < weight * 0.5
    canDuckDive: boardPhysics.volumeL < surfer.weightKg * 0.5,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANCE MECHANICS (real-time during riding)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * compute how the surfer's stance position affects board behavior
 *
 * stancePosition: 0 = full front foot, 0.5 = centered, 1 = full back foot
 *
 * front foot (0):
 *   - drives board, increases speed
 *   - engages front rail
 *   - more nose rocker activation
 *   - on longboards: walking to the nose
 *
 * back foot (1):
 *   - pivots tail, enables sharp turns
 *   - activates tail rocker
 *   - stalls the board (reduces speed)
 *   - on longboards: walking back for control
 */
export function computeStanceEffects(stancePosition, boardPhysics, speed) {
  return {
    // front foot = faster, back foot = slower
    speedMultiplier: 1.0 + (0.5 - stancePosition) * 0.3,

    // back foot = faster turns
    turnMultiplier: 1.0 + (stancePosition - 0.5) * 0.6,

    // nose dive risk: too far forward + steep wave + more speed = pearl
    // offset by nose rocker (more rocker = more protection)
    noseDiveRisk: Math.max(0, (0.5 - stancePosition) * 2) *
      (1 - boardPhysics.noseRockerM * 10) *
      Math.min(1, speed / 4), // faster = more dangerous

    // tail slide risk: too far back + hard turn = fins lose grip
    tailSlideRisk: Math.max(0, (stancePosition - 0.7)) * (1 - boardPhysics.railGrip),

    // trim angle (degrees) — nose up/down from weight distribution
    trimAngleDeg: (stancePosition - 0.5) * 8,

    // effective waterline length changes with stance
    // back foot pressure shortens effective waterline = tighter turns
    effectiveLength: boardPhysics.lengthM * (1 - (stancePosition - 0.5) * 0.3),
  };
}
