/**
 * BathymetryProfiles.js — Ocean floor contours for each surf spot
 *
 * Each profile defines:
 *   contour: depth points from deep water to shore [{distance, depth}]
 *   bottomSlope: average slope angle (affects breaking type via Iribarren number)
 *   bottomType: reef | sand | cobblestone | sand_cobble (affects friction/turbulence)
 *   tidalRange: meters between low and high tide
 *
 * Sources: NOAA bathymetric charts, Surfer's Journal spot guides,
 * USACE Coastal Engineering Manual for slope/breaking relationships
 */

export const BATHYMETRY_PROFILES = {
  pipeline: {
    // steep reef ledge — deep to shallow very quickly
    contour: [
      { distance: 500, depth: 30 },
      { distance: 200, depth: 15 },
      { distance: 100, depth: 5 },
      { distance: 75, depth: 3 },     // outer reef — waves start feeling bottom
      { distance: 50, depth: 1.5 },   // reef shelf — waves jack up fast
      { distance: 40, depth: 1.0 },   // breaking zone — barely covers reef
      { distance: 30, depth: 0.8 },   // inside — dry reef at low tide
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.12,      // steep — produces plunging/barreling waves
    bottomType: 'reef',
    tidalRange: 0.6,        // meters
  },

  malibu: {
    // gradual cobblestone point — long peeling walls
    contour: [
      { distance: 800, depth: 20 },
      { distance: 400, depth: 10 },
      { distance: 200, depth: 5 },
      { distance: 100, depth: 3 },
      { distance: 50, depth: 2 },
      { distance: 25, depth: 1 },
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.02,      // very gradual — produces spilling waves
    bottomType: 'sand_cobble',
    tidalRange: 1.5,
  },

  teahupoo: {
    // extreme reef shelf — deep water to ankle-deep in meters
    contour: [
      { distance: 300, depth: 25 },
      { distance: 150, depth: 12 },
      { distance: 80, depth: 4 },
      { distance: 50, depth: 1.5 },
      { distance: 40, depth: 0.5 },   // the notorious shelf
      { distance: 35, depth: 0.3 },   // barely submerged reef
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.15,      // extreme — mutant plunging barrels
    bottomType: 'reef',
    tidalRange: 0.3,
  },

  trestles: {
    // cobblestone point break — moderate slope
    contour: [
      { distance: 500, depth: 18 },
      { distance: 250, depth: 8 },
      { distance: 100, depth: 3.5 },
      { distance: 60, depth: 2 },
      { distance: 30, depth: 1 },
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.05,
    bottomType: 'cobblestone',
    tidalRange: 1.2,
  },

  waikiki: {
    // extremely gradual reef — gentle spilling waves
    contour: [
      { distance: 1000, depth: 25 },
      { distance: 500, depth: 12 },
      { distance: 300, depth: 6 },
      { distance: 200, depth: 4 },
      { distance: 100, depth: 2.5 },
      { distance: 50, depth: 1.5 },
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.01,
    bottomType: 'reef',
    tidalRange: 0.5,
  },

  hossegor: {
    // french beach break — sandbar-dependent
    contour: [
      { distance: 400, depth: 20 },
      { distance: 200, depth: 8 },
      { distance: 80, depth: 3 },
      { distance: 40, depth: 1.5 },
      { distance: 20, depth: 0.8 },
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.08,
    bottomType: 'sand',
    tidalRange: 3.5,         // huge tidal range in france
  },

  cloudbreak: {
    // fijian reef pass — long barreling left
    contour: [
      { distance: 600, depth: 35 },
      { distance: 300, depth: 15 },
      { distance: 100, depth: 5 },
      { distance: 60, depth: 2 },
      { distance: 40, depth: 1.2 },
      { distance: 30, depth: 0.8 },
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.10,
    bottomType: 'reef',
    tidalRange: 1.0,
  },

  rincon: {
    // cobblestone point — queen of the coast
    contour: [
      { distance: 600, depth: 18 },
      { distance: 300, depth: 8 },
      { distance: 150, depth: 4 },
      { distance: 80, depth: 2.5 },
      { distance: 40, depth: 1.2 },
      { distance: 0, depth: 0 },
    ],
    bottomSlope: 0.03,
    bottomType: 'cobblestone',
    tidalRange: 1.5,
  },
};

/**
 * get bathymetry profile for a spot, with fallback to generic
 */
export function getBathymetry(spotKey) {
  return BATHYMETRY_PROFILES[spotKey] || BATHYMETRY_PROFILES.trestles;
}
