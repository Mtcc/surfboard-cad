/**
 * Concave zone presets for different board types
 */

// Concave types with colors and descriptions
export const CONCAVE_TYPES = {
  flat:           { color: '#888888', label: 'Flat',           desc: 'No concave — drive, speed' },
  singleConcave:  { color: '#4488cc', label: 'Single',         desc: 'One channel — lift, speed' },
  doubleConcave:  { color: '#44aacc', label: 'Double',         desc: 'Two channels + spine — loose, quick' },
  vee:            { color: '#cc6644', label: 'Vee',            desc: 'Convex — pivot, release' },
  spiral:         { color: '#aa66aa', label: 'Spiral Vee',     desc: 'Single → double → vee transition' },
  channels:       { color: '#44aa66', label: 'Channels',       desc: '4-8 parallel channels — grip, drive' },
  hull:           { color: '#aa8844', label: 'Hull',           desc: 'Displacement — smooth, trim' },
  triPlane:       { color: '#cc8899', label: 'Tri-Plane',      desc: 'Three flat panels — fast, skatey' },
};

// Default zones for different board types
export const DEFAULT_ZONES = {
  performance: [
    { id: 1, type: 'flat',          start: 0,  end: 12, depth: 0,    width: 0.7 },
    { id: 2, type: 'singleConcave', start: 12, end: 55, depth: 0.15, width: 0.75 },
    { id: 3, type: 'doubleConcave', start: 55, end: 82, depth: 0.12, width: 0.8 },
    { id: 4, type: 'vee',           start: 82, end: 100, depth: 0.06, width: 0.5 },
  ],
  groveler: [
    { id: 1, type: 'flat',          start: 0,  end: 15, depth: 0,    width: 0.7 },
    { id: 2, type: 'doubleConcave', start: 15, end: 85, depth: 0.10, width: 0.85 },
    { id: 3, type: 'vee',           start: 85, end: 100, depth: 0.04, width: 0.4 },
  ],
  fish: [
    { id: 1, type: 'flat',          start: 0,  end: 100, depth: 0, width: 0.7 },
  ],
  longboard: [
    { id: 1, type: 'flat',          start: 0,  end: 100, depth: 0, width: 0.7 },
  ],
  gun: [
    { id: 1, type: 'flat',          start: 0,  end: 20, depth: 0,    width: 0.6 },
    { id: 2, type: 'singleConcave', start: 20, end: 50, depth: 0.10, width: 0.7 },
    { id: 3, type: 'vee',           start: 50, end: 100, depth: 0.10, width: 0.5 },
  ],
  midLength: [
    { id: 1, type: 'flat',          start: 0,  end: 20, depth: 0,    width: 0.65 },
    { id: 2, type: 'singleConcave', start: 20, end: 75, depth: 0.08, width: 0.7 },
    { id: 3, type: 'flat',          start: 75, end: 100, depth: 0,   width: 0.6 },
  ],
};
