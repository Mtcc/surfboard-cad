// color themes for wave engine — day, sunset, night
// inspired by kelly slater's pro surfer visual palette

export const THEMES = {
  day: {
    name: 'Day',
    // wave face colors (5-stop gradient — KSPS style: brightest mid-face, dark at lip)
    waveTrough: '#2a6a90',      // medium blue near foam line (brightened by spray)
    waveLower: '#3a85b0',       // bright steel blue
    waveMid: '#4a90c0',         // brightest — clean blue, dominant face color
    waveUpper: '#2a5a80',       // darker — lip shadow encroaching
    waveCrest: '#1a3050',       // dark navy at the curling lip
    waveOcean: '#2a6585',       // flat ocean teal

    // barrel interior
    barrelOuter: '#5a9ec4',     // bright at lip
    barrelInner: '#1a3d5c',     // dark inside

    // foam
    foamColor: '#ffffff',
    foamOpacity: 0.85,

    // sky
    skyTurbidity: 4,
    skyRayleigh: 1.8,
    sunElevation: 45,          // degrees
    sunAzimuth: 200,

    // lighting
    sunColor: '#fff5e0',
    sunIntensity: 2.5,
    hemiSkyColor: '#87ceeb',
    hemiGroundColor: '#2d6a96',
    hemiIntensity: 0.7,
    fillColor: '#aaccff',
    fillIntensity: 1.2,
    backlightColor: '#44bbcc',
    backlightIntensity: 0.6,
    exposure: 1.1,

    // ocean plane
    oceanColor: '#2d5f85',

    // spray/trail
    sprayColor: '#ffffff',
    sprayOpacity: 0.9,

    // background
    bgColor: '#1a3d5c',
  },

  sunset: {
    name: 'Sunset',
    waveTrough: '#2a2850',
    waveLower: '#4a4075',
    waveMid: '#6e6898',
    waveUpper: '#9088b8',
    waveCrest: '#d4c8e8',
    waveOcean: '#3a3565',

    barrelOuter: '#8878a8',
    barrelInner: '#2a2250',

    foamColor: '#e8d8f0',
    foamOpacity: 0.8,

    skyTurbidity: 8,
    skyRayleigh: 2.5,
    sunElevation: 8,
    sunAzimuth: 220,

    sunColor: '#ffaa60',
    sunIntensity: 2.0,
    hemiSkyColor: '#d4a0c0',
    hemiGroundColor: '#4a3565',
    hemiIntensity: 0.5,
    fillColor: '#ffcc88',
    fillIntensity: 0.8,
    backlightColor: '#ff8844',
    backlightIntensity: 0.4,
    exposure: 0.9,

    oceanColor: '#3a3565',

    sprayColor: '#f0e0e8',
    sprayOpacity: 0.7,

    bgColor: '#1a1535',
  },

  night: {
    name: 'Night',
    waveTrough: '#040810',
    waveLower: '#0a1525',
    waveMid: '#152540',
    waveUpper: '#253555',
    waveCrest: '#405570',
    waveOcean: '#060e18',

    barrelOuter: '#203050',
    barrelInner: '#060a15',

    foamColor: '#8090a0',
    foamOpacity: 0.5,

    skyTurbidity: 0.1,
    skyRayleigh: 0.01,
    sunElevation: -10,
    sunAzimuth: 200,

    sunColor: '#334466',
    sunIntensity: 0.3,
    hemiSkyColor: '#0a1020',
    hemiGroundColor: '#000508',
    hemiIntensity: 0.15,
    fillColor: '#1a2535',
    fillIntensity: 0.2,
    backlightColor: '#2a1540',
    backlightIntensity: 0.3,
    exposure: 0.5,

    oceanColor: '#060e18',

    sprayColor: '#556688',
    sprayOpacity: 0.4,

    bgColor: '#020408',
  },
};

export const THEME_ORDER = ['day', 'sunset', 'night'];
