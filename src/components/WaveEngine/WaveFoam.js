/**
 * WaveFoam.js — Foam texture generation + mesh creation
 *
 * All foam is rendered with textured planes (no THREE.Points).
 * Textures are generated procedurally on canvas.
 */

import * as THREE from 'three';

/**
 * procedural foam texture — scattered white dots/blobs on transparent background
 */
export function createFoamTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // small spray dots — dense near the top (y=0), sparse at bottom
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.pow(Math.random(), 1.8) * size; // concentrated near top
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 3 + 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 + 0.2})`;
    ctx.fill();
  }

  // larger foam clumps
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.pow(Math.random(), 2.5) * size;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 12 + 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.25 + 0.1})`;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * create the whitewater foam plane behind the wave crest
 */
export function createWhitewaterFoam(scale) {
  const width = 2 * scale; // match wave width
  const depth = 12;        // foam extends 12 units behind crest

  const geo = new THREE.PlaneGeometry(width * 0.6, depth);
  const mat = new THREE.MeshStandardMaterial({
    map: createFoamTexture(),
    transparent: true,
    opacity: 0.85,
    roughness: 0.95,
    color: 0xeeeeee,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  // position behind crest at water level
  mesh.position.set(0.5 * scale + 6, 0.08, 0);

  return mesh;
}

/**
 * create the crest foam — white strip along the lip
 */
export function createCrestFoam(scale) {
  const width = 2 * scale * 0.5;

  const geo = new THREE.PlaneGeometry(width, 1.0);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  // position at the wave crest top
  // crest is at X ≈ 0.3 in mesh coords, Y ≈ 0.224
  mesh.position.set(0.3 * scale, 0.224 * scale + 0.225 * scale, 0);
  mesh.rotation.x = -Math.PI / 4;

  return mesh;
}

/**
 * update foam positions when spot changes
 */
export function updateFoamForSpot(whitewaterMesh, crestMesh, scale) {
  if (whitewaterMesh) {
    whitewaterMesh.position.set(0.5 * scale + 6, 0.08, 0);
    whitewaterMesh.scale.setScalar(scale / 15);
  }
  if (crestMesh) {
    crestMesh.position.set(0.3 * scale, 0.224 * scale + 0.225 * scale, 0);
    crestMesh.scale.setScalar(scale / 15);
  }
}
