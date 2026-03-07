/**
 * Surfboard Template Library — Real-world accurate specifications
 *
 * All dimensions based on actual production boards from major shapers.
 * Parameter conventions:
 *   noseWidthIn     = width at 12" from nose tip (industry standard)
 *   widePointIn     = POSITION of widest point (inches from nose)
 *   widePointWidthIn= MAXIMUM board width (at widePointIn)
 *   tailWidthIn     = width at 12" from tail tip
 *
 * Fish note: wide point is only 12" from nose, so noseWidthIn ≈ widePointWidthIn
 */

export const TEMPLATES = {

  // ─── PERFORMANCE SHORTBOARD ────────────────────────────────────────────
  // Reference: JS Monsta Box, Firewire Dominator 2, Lost Puddle Jumper Pro
  performanceShortboard: {
    id: 'performanceShortboard',
    name: 'Performance Shortboard',
    description: 'High-performance for powerful surf. Narrow nose, wide point behind center, tucked rails for quick release.',
    emoji: '⚡',
    boardType: 'performanceShortboard',
    params: {
      lengthFt: 6, lengthIn_extra: 2,   // 6'2" = 74"
      widthIn: 19.5,
      thicknessIn: 2.5,

      // Wide point 54% from nose = 40" (slightly behind center of 37")
      noseWidthIn:      10.75,   // 19.5 × 0.55 = 10.72"
      widePointIn:      40,      // 54% of 74" — modern shortboards run wide point back
      widePointWidthIn: 19.5,
      tailWidthIn:      14.75,   // 19.5 × 0.757 = 14.76"

      noseRockerIn:  4.75,
      tailRockerIn:  2.25,
      entryRocker:   'moderate',
      exitRocker:    'moderate',

      noseThicknessIn:   1.5,
      centerThicknessIn: 2.5,
      tailThicknessIn:   1.875,
      deckDome:          'medium',
      bottomContour:     'singleConcave',

      railType: 'tucked',
      railApex: 'low',

      tailShape:     'squash',
      swallowDepthIn: 0,
      finConfig:     'thruster',
    }
  },

  // ─── SHORTBOARD GROVELER ──────────────────────────────────────────────
  // Reference: Lost Puddle Jumper, Haydenshapes Hypto Krypto, CI Biscuit
  groveler: {
    id: 'groveler',
    name: 'Shortboard Groveler',
    description: 'Small-wave weapon. Extra volume and width in weak surf. Wide squash tail, flat rocker, boxy rails.',
    emoji: '🏄',
    boardType: 'groveler',
    params: {
      lengthFt: 5, lengthIn_extra: 8,   // 5'8" = 68"
      widthIn: 20.75,
      thicknessIn: 2.625,

      // Wide point 44% from nose = 30" (at or just forward of center)
      noseWidthIn:      11.5,    // 20.75 × 0.554 = 11.5"
      widePointIn:      30,      // 44% of 68"
      widePointWidthIn: 20.75,
      tailWidthIn:      15.25,   // 20.75 × 0.735 = 15.25"

      noseRockerIn:  3.75,
      tailRockerIn:  1.75,
      entryRocker:   'flat',
      exitRocker:    'flat',

      noseThicknessIn:   1.625,
      centerThicknessIn: 2.625,
      tailThicknessIn:   2.0,
      deckDome:          'low',
      bottomContour:     'doubleConcave',

      railType: '50/50',
      railApex: 'medium',

      tailShape:     'squash',
      swallowDepthIn: 0,
      finConfig:     'thruster',
    }
  },

  // ─── FISH ──────────────────────────────────────────────────────────────
  // Reference: Lost Puddle Fish, CI Happy, Stretch Quad, Rusty Dwart
  // Modern fish: wide point near center (2" forward). Wide nose, flat rocker,
  // full rails, swallow tail. Classic Steve Lis puts WP further forward.
  fish: {
    id: 'fish',
    name: 'Fish',
    description: 'Modern fish design. Wide body, flat rocker, full nose and tail. Wide point near center gives paddle power and drive in small, mushy surf.',
    emoji: '🐟',
    boardType: 'fish',
    params: {
      lengthFt: 5, lengthIn_extra: 6,   // 5'6" = 66"
      widthIn: 21.0,
      thicknessIn: 2.5,

      // Wide point 2" forward of center: center=33", WP=31" (47% of 66")
      // Nose 12" reference is a separate measurement — 14" is typical for a 21" wide fish
      noseWidthIn:      14.0,   // 21.0 × 0.667 — wide but not at max width
      widePointIn:      31,     // 47% of 66" — just forward of center
      widePointWidthIn: 21.0,
      tailWidthIn:      15.5,   // 21.0 × 0.738 = 15.5"

      // Hallmark flat rocker
      noseRockerIn:  3.25,
      tailRockerIn:  1.25,
      entryRocker:   'flat',
      exitRocker:    'flat',

      // Thick through the tail — fish carry volume
      noseThicknessIn:   2.0,
      centerThicknessIn: 2.5,
      tailThicknessIn:   2.125,
      deckDome:          'flat',
      bottomContour:     'flat',

      // Fuller, softer rails
      railType: '50/50',
      railApex: 'medium',

      // Deep swallow — the visual signature of a fish
      tailShape:     'swallow',
      swallowDepthIn: 3.5,

      // Classic twin fin
      finConfig: 'twin',
    }
  },

  // ─── MID-LENGTH ────────────────────────────────────────────────────────
  // Reference: CI Mid, Steph Gilmore Mid, Torq Mod Fun
  midLength: {
    id: 'midLength',
    name: 'Mid-Length',
    description: 'Versatile all-rounder. Works in a huge range of conditions. Easy to paddle, forgiving, good for intermediate to advanced surfers.',
    emoji: '🏖️',
    boardType: 'midLength',
    params: {
      lengthFt: 7, lengthIn_extra: 2,   // 7'2" = 86"
      widthIn: 21.5,
      thicknessIn: 2.875,

      // Wide point at center (50% of 86" = 43")
      noseWidthIn:      14.0,   // 21.5 × 0.651 = 14.0"
      widePointIn:      43,     // exactly center
      widePointWidthIn: 21.5,
      tailWidthIn:      15.5,   // 21.5 × 0.721 = 15.5"

      noseRockerIn:  4.0,
      tailRockerIn:  2.0,
      entryRocker:   'moderate',
      exitRocker:    'flat',

      noseThicknessIn:   1.875,
      centerThicknessIn: 2.875,
      tailThicknessIn:   2.125,
      deckDome:          'low',
      bottomContour:     'singleConcave',

      railType: '50/50',
      railApex: 'medium',

      tailShape:     'round',
      swallowDepthIn: 0,
      finConfig:     '2+1',
    }
  },

  // ─── LONGBOARD ─────────────────────────────────────────────────────────
  // Reference: Bing Levitator, Thomas Noserider, Walden Magic
  longboard: {
    id: 'longboard',
    name: 'Longboard',
    description: 'Classic noserider. Very wide nose, flat rocker, soft rails. Built for long smooth turns and walking to the nose.',
    emoji: '🌊',
    boardType: 'longboard',
    params: {
      lengthFt: 9, lengthIn_extra: 0,   // 9'0" = 108"
      widthIn: 22.75,
      thicknessIn: 3.0,

      // Wide point slightly forward of center (46% = 49.7" ≈ 50")
      noseWidthIn:      17.5,   // 22.75 × 0.769 = 17.5" — wide nose for noseriding
      widePointIn:      50,     // 46% of 108"
      widePointWidthIn: 22.75,
      tailWidthIn:      15.0,   // 22.75 × 0.659 = 15.0"

      noseRockerIn:  2.5,       // Very flat
      tailRockerIn:  2.0,
      entryRocker:   'flat',
      exitRocker:    'flat',

      noseThicknessIn:   2.25,
      centerThicknessIn: 3.0,
      tailThicknessIn:   2.375,
      deckDome:          'flat',
      bottomContour:     'flat',

      railType: 'soft',
      railApex: 'high',

      tailShape:     'square',
      swallowDepthIn: 0,
      finConfig:     'single',
    }
  },

  // ─── GUN / STEP-UP ─────────────────────────────────────────────────────
  // Reference: Channel Islands Semi-Pro, JS Monsta Squad, Al Merrick Gun
  gun: {
    id: 'gun',
    name: 'Gun / Step-Up',
    description: 'Big wave board for overhead+ surf. Narrow, fast, with lots of nose rocker for steep drops and a pin tail for hold.',
    emoji: '💣',
    boardType: 'gun',
    params: {
      lengthFt: 7, lengthIn_extra: 6,   // 7'6" = 90"
      widthIn: 19.0,
      thicknessIn: 2.625,

      // Wide point 60% behind nose = 54" (well behind center of 45")
      noseWidthIn:      11.75,  // 19.0 × 0.618 = 11.75"
      widePointIn:      54,     // 60% of 90"
      widePointWidthIn: 19.0,
      tailWidthIn:      12.5,   // 19.0 × 0.658 = 12.5" (narrow pin tail)

      noseRockerIn:  5.5,       // Aggressive nose rocker for steep drops
      tailRockerIn:  2.25,
      entryRocker:   'aggressive',
      exitRocker:    'flat',

      noseThicknessIn:   1.5,
      centerThicknessIn: 2.625,
      tailThicknessIn:   1.75,
      deckDome:          'medium',
      bottomContour:     'vee',

      railType: 'pinched',
      railApex: 'low',

      tailShape:     'pin',
      swallowDepthIn: 0,
      finConfig:     'thruster',
    }
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function computeParams(params) {
  return {
    ...params,
    lengthIn: params.lengthFt * 12 + (params.lengthIn_extra || 0),
  };
}
