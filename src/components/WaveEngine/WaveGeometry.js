/**
 * WaveGeometry.js — Geometry builders for WavePreview (Surf Mode)
 *
 * These provide the wave/whitewater geometry that WavePreview.jsx imports.
 * Uses simple parametric geometry (no GLSL).
 * The new WaveEngine uses GLB loading instead.
 */

import * as THREE from 'three';

/**
 * build a breaking wave geometry from spot profile parameters
 * creates a parametric surface that approximates a wave face
 */
export function buildBreakingWaveGeometry(spot, waveHeight) {
  const length = spot.shoulderLength || 30;
  const segX = 40;
  const segZ = 60;

  const geo = new THREE.BufferGeometry();
  const vertices = [];
  const colors = [];
  const indices = [];

  const waterColor = new THREE.Color(spot.waterColor);
  const deepColor = new THREE.Color(spot.waterColor).multiplyScalar(0.3);
  const foamColor = new THREE.Color(0xe0f0f0);

  for (let iz = 0; iz <= segZ; iz++) {
    const z = (iz / segZ - 0.5) * length;
    // wave tapers at shoulders
    const shoulder = 1 - Math.pow(Math.abs(iz / segZ - 0.5) * 2, 2);

    for (let ix = 0; ix <= segX; ix++) {
      const t = ix / segX; // 0 = trough, 1 = crest
      const x = (t - 0.5) * waveHeight * 3;

      // wave profile: gradual rise to crest, then curls over
      let y;
      if (t < 0.7) {
        // face — rises smoothly
        y = Math.pow(t / 0.7, 1.5) * waveHeight * shoulder;
      } else {
        // lip curl
        const curlT = (t - 0.7) / 0.3;
        y = waveHeight * shoulder * (1 - curlT * 0.3 * (1 - spot.barrelDepth));
        // x offset for curl (moves face forward at top)
      }

      vertices.push(x, y, z);

      // vertex color
      const heightFrac = y / waveHeight;
      const c = new THREE.Color();
      if (heightFrac < 0.3) c.lerpColors(deepColor, waterColor, heightFrac / 0.3);
      else if (heightFrac < 0.8) c.copy(waterColor);
      else c.lerpColors(waterColor, foamColor, (heightFrac - 0.8) / 0.2);

      colors.push(c.r, c.g, c.b);
    }
  }

  // indices
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * (segX + 1) + ix;
      const b = a + 1;
      const c = a + segX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

/**
 * build whitewater geometry behind the wave crest
 */
export function buildWhitewaterGeometry(spot, waveHeight) {
  const length = spot.shoulderLength || 30;
  const width = waveHeight * 2;

  const geo = new THREE.PlaneGeometry(width, length, 20, 40);
  geo.rotateX(-Math.PI / 2);
  geo.translate(waveHeight * 1.2, 0.1, 0);

  return geo;
}

/**
 * build barrel tube interior geometry (or null if wave doesn't barrel)
 */
export function buildBarrelTubeGeometry(spot, waveHeight) {
  if (spot.barrelDepth < 0.3) return null;

  const radius = waveHeight * 0.3 * spot.barrelDepth;
  const length = (spot.shoulderLength || 30) * 0.3;

  const geo = new THREE.CylinderGeometry(radius, radius * 0.8, length, 16, 1, true);
  geo.rotateX(Math.PI / 2);
  geo.translate(-waveHeight * 0.2, waveHeight * 0.7, 0);

  return geo;
}

// simple vertex/fragment shaders for ocean and whitewater
// these are minimal — the new WaveEngine uses MeshStandardMaterial instead

export const oceanVertexShader = `
  uniform float uTime;
  uniform float uChop;
  varying vec3 vWorldPosition;
  varying float vHeight;

  void main() {
    vec3 pos = position;
    float wave1 = sin(pos.x * 0.05 + uTime * 0.8) * uChop * 0.5;
    float wave2 = sin(pos.z * 0.03 + uTime * 0.5) * uChop * 0.3;
    pos.y += wave1 + wave2;

    vHeight = pos.y;
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const oceanFragmentShader = `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyColor;
  varying vec3 vWorldPosition;
  varying float vHeight;

  void main() {
    float depthFactor = smoothstep(-2.0, 1.0, vHeight);
    vec3 color = mix(uDeepColor, uShallowColor, depthFactor);

    // fake fresnel
    float dist = length(vWorldPosition.xz) * 0.005;
    color = mix(color, uSkyColor * 0.3, clamp(dist, 0.0, 0.15));

    gl_FragColor = vec4(color, 0.92);
  }
`;

export const whitewaterVertexShader = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    pos.y += sin(pos.x * 2.0 + uTime * 3.0) * 0.05;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const whitewaterFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    float foam = smoothstep(0.3, 0.0, vUv.x) * uIntensity;
    float noise = fract(sin(dot(vUv + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    foam *= 0.7 + noise * 0.3;
    gl_FragColor = vec4(1.0, 1.0, 1.0, foam * 0.8);
  }
`;
