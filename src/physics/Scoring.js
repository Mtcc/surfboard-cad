/**
 * Scoring.js — Ride scoring, board-wave match analysis, WSL-style scoring
 *
 * The board-wave match function is the educational core of SurfCAD —
 * it tells the user WHY their board works or doesn't work on a given wave.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD-WAVE MATCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * how well does this board match this wave? (0-1)
 *
 * returns { score, penalties[], rating }
 * penalties are human-readable strings explaining WHY the match is bad
 */
export function calculateBoardWaveMatch(boardPhysics, waveFace) {
  let score = 1.0;
  const penalties = [];

  // WAVE SIZE vs BOARD SIZE
  // big wave + small board = can't hold, too fast, dangerous
  if (waveFace.faceHeight > 3.0 && boardPhysics.lengthM < 1.9) {
    const penalty = (waveFace.faceHeight - 3.0) * 0.15;
    score -= penalty;
    penalties.push(`Board too short for ${Math.round(waveFace.faceHeight * 3.28)}ft waves`);
  }

  // small wave + big board = too much board, can't turn, bogs down
  if (waveFace.faceHeight < 1.5 && boardPhysics.lengthM > 2.3) {
    const penalty = (boardPhysics.lengthM - 2.3) * 0.2;
    score -= penalty;
    penalties.push('Board too long for small waves — hard to generate speed');
  }

  // WAVE POWER vs WAVE HOLD
  // powerful hollow wave + weak hold = board slides and spins out
  if (waveFace.steepness > 55 && boardPhysics.waveHold < 0.5) {
    const penalty = (waveFace.steepness - 55) / 100 * (1 - boardPhysics.waveHold);
    score -= penalty;
    penalties.push('Not enough hold for steep waves — tail slides in turns');
  }

  // WEAK WAVE + LOW PADDLE POWER
  // mushy wave + low volume board = can't catch waves
  if (waveFace.powerZone < 0.3 && boardPhysics.paddlePower < 0.4) {
    const penalty = (1 - waveFace.powerZone) * (1 - boardPhysics.paddlePower) * 0.5;
    score -= penalty;
    penalties.push("Can't generate speed — need more volume for weak waves");
  }

  // BARREL + BARREL SCORE
  if (waveFace.insideBarrel && boardPhysics.barrelScore < 0.4) {
    const penalty = (1 - boardPhysics.barrelScore) * 0.3;
    score -= penalty;
    penalties.push('Board struggles in the barrel — too loose or too wide');
  }

  const clampedScore = Math.max(0, Math.min(1, score));

  return {
    score: clampedScore,
    penalties,
    rating: clampedScore > 0.85 ? 'PERFECT MATCH' :
            clampedScore > 0.65 ? 'GOOD MATCH' :
            clampedScore > 0.45 ? 'RIDEABLE' :
            clampedScore > 0.25 ? 'WRONG BOARD' :
            'UNRIDEABLE',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIDE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * wave utilization — how much of the wave face did the surfer use?
 * good surfers use top-to-bottom, pocket-to-shoulder
 */
function calculateWaveUtilization(boardState) {
  // simplified: based on max lean angle reached and ride time
  // longer ride + more vertical travel = better utilization
  const timeScore = Math.min(1, boardState.rideTimeS / 15); // 15s = full utilization
  const verticalScore = Math.min(1, Math.abs(boardState.leanAngle) / 30);
  return (timeScore + verticalScore) / 2;
}

/**
 * power zone usage — did the surfer spend time in the critical section?
 * staying in the pocket = high score
 */
function calculatePowerZoneUsage(boardState) {
  // approximated from line position history — pocket is 0.2-0.4
  const linePos = boardState.wavePosition.line;
  if (linePos >= 0.2 && linePos <= 0.4) return 0.9;
  if (linePos >= 0.1 && linePos <= 0.5) return 0.6;
  return 0.3;
}

/**
 * estimate energy transferred from wave to board (kJ)
 */
function calculateEnergyTransferred(boardState) {
  // KE = 0.5 * m * v^2, integrated over ride time (simplified)
  const avgSpeed = boardState.maxSpeedMS * 0.6; // rough average
  const mass = 80; // approximate surfer + board mass (kg)
  return 0.5 * mass * Math.pow(avgSpeed, 2) * boardState.rideTimeS / 1000;
}

/**
 * WSL-style scoring (0-10 scale)
 * based on: commitment, speed, power, flow, variety
 *
 * 0.0-1.9: poor
 * 2.0-3.9: fair
 * 4.0-5.9: average
 * 6.0-7.9: good
 * 8.0-10.0: excellent
 */
function calculateWSLScore(boardState) {
  const commitment = Math.min(2, boardState.rideTimeS / 5);        // max 2 pts
  const speed = Math.min(2, boardState.maxSpeedMS / 8);             // max 2 pts
  const power = Math.min(2, boardState.turnCount * 0.4);            // max 2 pts
  const flow = boardState.styleScore * 2;                            // max 2 pts
  const variety = Math.min(2, boardState.maneuvers.length * 0.5);   // max 2 pts

  return Math.min(10, commitment + speed + power + flow + variety);
}

/**
 * comprehensive end-of-ride score
 */
export function calculateRideScore(boardState, boardPhysics, waveFace) {
  const MS_TO_MPH = 2.23694;

  return {
    rideLength: boardState.rideTimeS,
    maxSpeed: boardState.maxSpeedMS,
    maxSpeedMPH: boardState.maxSpeedMS * MS_TO_MPH,
    turnCount: boardState.turnCount,
    maneuvers: [...boardState.maneuvers],
    styleScore: boardState.styleScore,
    waveUtilization: calculateWaveUtilization(boardState),
    powerScore: calculatePowerZoneUsage(boardState),
    boardMatch: calculateBoardWaveMatch(boardPhysics, waveFace),
    totalScore: calculateWSLScore(boardState),
    energyKJ: calculateEnergyTransferred(boardState),
  };
}
