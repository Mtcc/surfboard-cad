/**
 * SimulationLoop.js — Main physics update loop
 *
 * Runs every frame. Reads input, computes forces, updates board state.
 * This module is purely computational — no rendering, no DOM, no Three.js.
 * The renderer reads boardState and positions meshes accordingly.
 */

import { getWaveFaceAt } from './WavePhysics.js';
import { computeStanceEffects } from './SurferPhysics.js';
import { calculateBoardWaveMatch } from './Scoring.js';

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD STATE — complete simulation state, updated every frame
// ═══════════════════════════════════════════════════════════════════════════════

export function createBoardState() {
  return {
    // position on the wave face
    position: { x: 0, y: 0, z: 0 },
    wavePosition: { face: 0.5, line: 0.5 }, // normalized position on wave

    // velocity
    velocity: { x: 0, y: 0, z: 0 },
    speed: 0,

    // rotation
    heading: 0,          // degrees — direction along the wave
    leanAngle: 0,        // degrees — rail-to-rail tilt
    trimAngle: 0,        // degrees — nose up/down from stance

    // stance
    stancePosition: 0.5, // 0 = nose, 1 = tail

    // state flags
    isPlaning: false,
    isInBarrel: false,
    isAerial: false,
    isWipedOut: false,
    rideActive: false,

    // metrics
    rideTimeS: 0,
    maxSpeedMS: 0,
    turnCount: 0,
    maneuvers: [],
    styleScore: 0,

    // heading history for style scoring (last N frames)
    _headingHistory: [],
    // last turn direction for counting full directional changes
    _lastTurnDir: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE SCORING — smooth arcs score higher than jerky input
// ═══════════════════════════════════════════════════════════════════════════════

function updateStyleScore(state) {
  const history = state._headingHistory;
  if (history.length < 10) return 0.5; // not enough data

  // calculate jerkiness: variance in heading change rate
  const deltas = [];
  for (let i = 1; i < history.length; i++) {
    deltas.push(history[i] - history[i - 1]);
  }

  // variance of deltas — lower = smoother = better style
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, d) => a + Math.pow(d - mean, 2), 0) / deltas.length;

  // normalize: 0 variance = perfect flow (1.0), high variance = jerky (0.0)
  return Math.max(0, Math.min(1, 1 - variance * 0.1));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHYSICS UPDATE — called every frame
// ═══════════════════════════════════════════════════════════════════════════════

const RHO_WATER = 1025; // kg/m^3

/**
 * main physics update
 *
 * @param {number} dt - time since last frame (seconds)
 * @param {object} boardState - mutable state from createBoardState()
 * @param {object} input - {leftArrow, rightArrow, upArrow, downArrow, space}
 * @param {object} boardPhysics - from computeBoardPhysics()
 * @param {object} surferBoard - from computeSurferBoardInteraction()
 * @param {object} spotProfile - wave spot data (faceSteepness, waveHeight, etc.)
 * @param {object} bathymetry - from BathymetryProfiles
 */
export function updatePhysics(dt, boardState, input, boardPhysics, surferBoard, spotProfile, bathymetry) {
  if (boardState.isWipedOut || !boardState.rideActive) return;

  // clamp dt to avoid physics explosions on frame drops
  const clampedDt = Math.min(dt, 0.05); // max 50ms step

  // 1. get wave face properties at current position
  const wave = getWaveFaceAt(boardState.wavePosition, spotProfile, bathymetry);

  // 2. update stance from input
  if (input.upArrow) {
    boardState.stancePosition = Math.max(0, boardState.stancePosition - clampedDt * 0.8);
  }
  if (input.downArrow) {
    boardState.stancePosition = Math.min(1, boardState.stancePosition + clampedDt * 0.8);
  }
  const stance = computeStanceEffects(boardState.stancePosition, boardPhysics, boardState.speed);

  // 3. GRAVITY — wave face pulls surfer down the face
  const gravityForce = wave.gravityAlongFace * clampedDt;

  // 4. WAVE PUSH — wave actively pushes surfer toward shore
  // stronger in the power zone
  const wavePushForce = wave.powerZone * wave.speed * 0.3 * clampedDt;

  // 5. DRAG — board resists forward motion
  // F_drag = 0.5 * Cd * rho * A * v^2
  // wetted area approximation: width * 3cm immersion depth
  const wettedArea = boardPhysics.widthM * 0.03;
  const dragForce = 0.5 * boardPhysics.dragCoefficient * RHO_WATER *
    wettedArea * Math.pow(boardState.speed, 2) * clampedDt;

  // 6. SPEED UPDATE
  let speedDelta = gravityForce + wavePushForce - dragForce;
  speedDelta *= stance.speedMultiplier;
  boardState.speed = Math.max(0, boardState.speed + speedDelta);
  boardState.speed = Math.min(boardState.speed, boardPhysics.maxSpeedMS);

  // planing state
  boardState.isPlaning = boardState.speed >= boardPhysics.planingSpeedMS;

  // 7. TURNING from left/right input
  if (input.leftArrow || input.rightArrow) {
    const turnInput = input.rightArrow ? 1 : -1; // right = up the wave, left = down

    // turn rate depends on speed, board properties, and stance
    const effectiveTurnRate = surferBoard.effectiveTurnRate * stance.turnMultiplier;

    // speed affects turn responsiveness — too slow = sluggish turns
    const speedFactor = Math.min(1, boardState.speed / (boardPhysics.planingSpeedMS * 0.8));

    // heading resistance: gravity makes steep down-face angles hard to sustain,
    // and the wave lip makes steep up-face angles harder.
    // this keeps heading in a realistic ±60 degree range for normal surfing.
    const headingResistance = Math.pow(Math.abs(boardState.heading) / 90, 2);
    const resistedRate = effectiveTurnRate * (1 - headingResistance * 0.6);

    const turnDelta = turnInput * Math.max(0, resistedRate) * speedFactor * clampedDt;
    boardState.heading += turnDelta;

    // lean into the turn — lean angle scales with speed
    // you need centripetal force (= speed) to sustain high lean angles
    // at low speed you can only lean a little, at top speed you can rail it
    const targetLean = turnInput * Math.min(
      boardState.speed * 8,               // ~20deg at 2.5m/s, ~40deg at 5m/s, ~64deg at 8m/s
      boardPhysics.maxLeanAngleDeg,
    );
    boardState.leanAngle += (targetLean - boardState.leanAngle) * clampedDt * 4;

    // rail grip check — if lean exceeds max, board slides out
    if (Math.abs(boardState.leanAngle) > boardPhysics.maxLeanAngleDeg) {
      const excess = Math.abs(boardState.leanAngle) - boardPhysics.maxLeanAngleDeg;
      if (excess > 15) {
        boardState.isWipedOut = true;
        boardState.maneuvers.push('wipeout_slide');
        return;
      }
      // tail slide — reduces speed but recoverable
      boardState.speed *= 0.95;
    }

    // count turns: a "turn" is a full directional change (switching from left to right or vice versa)
    const currentDir = Math.sign(turnDelta);
    if (currentDir !== 0 && currentDir !== boardState._lastTurnDir && boardState._lastTurnDir !== 0) {
      boardState.turnCount++;
    }
    if (currentDir !== 0) boardState._lastTurnDir = currentDir;
  } else {
    // return to neutral lean when not turning
    boardState.leanAngle *= (1 - clampedDt * 3);
  }

  // 8. TRIM from stance
  boardState.trimAngle = stance.trimAngleDeg;

  // 9. POSITION UPDATE on wave face
  // the surfer moves along the wave line and up/down the face.
  // heading 0 = along the wave (trimming), positive = up the face, negative = down.
  const headingRad = boardState.heading * Math.PI / 180;
  const lineSpeed = boardState.speed * Math.cos(headingRad);
  const faceSpeed = boardState.speed * Math.sin(headingRad);

  // normalize movement by face height to get wave-relative position.
  // the wave is MOVING under the surfer — in the wave's reference frame,
  // the surfer's position changes slowly even when angled on the face.
  // the scale factor accounts for this relative motion.
  // without it, a 2m face at 5m/s would be traversed in 0.4s.
  // with 15x scale, it takes ~6s — matching real ride dynamics (5-30s rides).
  const faceScale = Math.max(wave.faceHeight, 0.5) * 25;

  boardState.wavePosition.line += lineSpeed * clampedDt / faceScale;
  boardState.wavePosition.face += faceSpeed * clampedDt / faceScale;

  // restoring force: the wave naturally holds the surfer at a trim line.
  // wave push (rising water) + gravity (pulling down) create an equilibrium.
  // in the pocket (powerZone~1), the equilibrium is higher (face~0.5).
  // on the shoulder (powerZone~0), it's lower (face~0.3).
  // this force gently pulls the surfer back toward equilibrium when they drift.
  const equilibrium = 0.3 + wave.powerZone * 0.2;
  const restoring = (equilibrium - boardState.wavePosition.face) * 0.5 * clampedDt;
  boardState.wavePosition.face += restoring;

  // clamp face position (0 = bottom, 1 = lip)
  boardState.wavePosition.face = Math.max(0, Math.min(1, boardState.wavePosition.face));

  // 10. WAVE POSITION CHECKS

  // too high — went over the lip
  if (boardState.wavePosition.face > 0.95) {
    if (boardState.speed > boardPhysics.maxSpeedMS * 0.7 && boardPhysics.aerialScore > 0.5) {
      boardState.isAerial = true;
      boardState.maneuvers.push('aerial');
    } else {
      boardState.isWipedOut = true;
      boardState.maneuvers.push('over_the_falls');
      return;
    }
  }

  // too low — outran the wave onto flat water
  if (boardState.wavePosition.face < 0.05) {
    boardState.rideActive = false;
    return;
  }

  // barrel detection
  boardState.isInBarrel = wave.insideBarrel &&
    boardState.wavePosition.face > 0.5 &&
    boardState.wavePosition.face < 0.85;

  if (boardState.isInBarrel && !boardState.maneuvers.includes('barrel')) {
    boardState.maneuvers.push('barrel');
  }

  // nose dive check — too much front foot + steep face = pearl
  if (stance.noseDiveRisk > 0.8 && wave.steepness > 40) {
    boardState.isWipedOut = true;
    boardState.maneuvers.push('pearl');
    return;
  }

  // 11. BOARD-WAVE MATCH — degrades performance when wrong board for the wave
  const match = calculateBoardWaveMatch(boardPhysics, wave);
  if (match.score < 0.3) {
    boardState.speed *= 0.98; // gradual slowdown
  }

  // 12. AERIAL LANDING
  if (boardState.isAerial) {
    // simplified: aerial lasts a fixed short time then lands
    // if face position comes back below 0.9 the surfer re-enters
    if (boardState.wavePosition.face < 0.9) {
      boardState.isAerial = false;
      boardState.speed *= 0.7; // speed loss on landing
    }
  }

  // 13. METRICS
  boardState.rideTimeS += clampedDt;
  boardState.maxSpeedMS = Math.max(boardState.maxSpeedMS, boardState.speed);

  // heading history for style scoring (keep last 60 frames)
  boardState._headingHistory.push(boardState.heading);
  if (boardState._headingHistory.length > 60) {
    boardState._headingHistory.shift();
  }
  boardState.styleScore = updateStyleScore(boardState);
}

/**
 * start a new ride — resets state and initiates paddling/takeoff
 */
export function startRide(boardState, boardPhysics, surferBoard) {
  Object.assign(boardState, createBoardState());

  // initial paddle speed based on paddle power + surfer
  const paddleSpeed = surferBoard.effectivePaddle * 2.5; // m/s — fast paddler ~2.5 m/s
  boardState.speed = paddleSpeed;
  boardState.rideActive = true;
  boardState.wavePosition = { face: 0.4, line: 0.5 }; // start mid-face, mid-line
}
