/**
 * Physics Engine — public API
 *
 * Usage:
 *   import { computeBoardPhysics, createBoardState, updatePhysics, ... } from './physics';
 */

export { waveEnergyDensity, wavePowerPerMeter, totalWavePowerKW, getWaveFaceAt } from './WavePhysics.js';
export { BATHYMETRY_PROFILES, getBathymetry } from './BathymetryProfiles.js';
export { computeBoardPhysics } from './BoardPhysics.js';
export { DEFAULT_SURFER, computeSurferBoardInteraction, computeStanceEffects } from './SurferPhysics.js';
export { createBoardState, updatePhysics, startRide } from './SimulationLoop.js';
export { calculateBoardWaveMatch, calculateRideScore } from './Scoring.js';
export { createInputState, bindControls, getControlDescriptions } from './Controls.js';
