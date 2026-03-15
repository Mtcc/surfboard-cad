/**
 * Surfer.js — KSPS-style surfer character
 *
 * Simple proportional figure: shirtless, board shorts, crouched surf stance.
 * Animation is minimal — lean the whole body for turns, no puppet joints.
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════════
// materials
// ═══════════════════════════════════════════════════════════════════════════════

const SKIN = 0xc68642;
const HAIR_COLOR = 0x1a0e06;
const SHORTS_COLOR = 0x2255aa;

const _skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8, metalness: 0.05 });
const _shortsMat = new THREE.MeshStandardMaterial({ color: SHORTS_COLOR, roughness: 0.9 });
const _hairMat = new THREE.MeshStandardMaterial({ color: HAIR_COLOR, roughness: 0.95 });

// ═══════════════════════════════════════════════════════════════════════════════
// createSurfer — simple KSPS-style character
// ═══════════════════════════════════════════════════════════════════════════════

export function createSurfer() {
  const root = new THREE.Group();
  root.name = 'surfer';

  // proportions (meters) — roughly 1.75m tall standing, appears ~1.2m crouched
  const headR = 0.10;
  const torsoH = 0.38;
  const torsoW = 0.26;
  const torsoD = 0.15;
  const shortsH = 0.18;
  const armR = 0.035;
  const armLen = 0.45;
  const legR = 0.05;
  const upperLegLen = 0.28;
  const lowerLegLen = 0.30;

  // --- body group (everything above hips — leans for turns) ---
  const body = new THREE.Group();
  body.name = 'body';

  // torso — capsule shape
  const torsoGeo = new THREE.CapsuleGeometry(torsoW * 0.42, torsoH * 0.5, 4, 8);
  torsoGeo.scale(1, 1, torsoD / torsoW);
  const torso = new THREE.Mesh(torsoGeo, _skinMat);
  torso.castShadow = true;
  body.add(torso);

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 8, 6), _skinMat);
  head.position.y = torsoH * 0.48 + headR * 0.7;
  head.castShadow = true;
  body.add(head);

  // hair
  const hairGeo = new THREE.SphereGeometry(headR * 1.08, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const hair = new THREE.Mesh(hairGeo, _hairMat);
  hair.position.copy(head.position);
  hair.position.y += headR * 0.12;
  body.add(hair);

  // shorts
  const shorts = new THREE.Mesh(
    new THREE.BoxGeometry(torsoW * 0.9, shortsH, torsoD * 1.05),
    _shortsMat,
  );
  shorts.position.y = -torsoH * 0.35;
  shorts.castShadow = true;
  body.add(shorts);

  // arms — simple cylinders, pre-posed for surf stance (arms out, slightly bent)
  const armGeo = new THREE.CylinderGeometry(armR, armR * 0.7, armLen, 5);

  const rArm = new THREE.Mesh(armGeo, _skinMat);
  rArm.position.set(torsoW * 0.48, torsoH * 0.15, 0);
  rArm.rotation.set(0.2, 0, -1.1); // angled out and slightly forward
  rArm.castShadow = true;
  body.add(rArm);

  const lArm = new THREE.Mesh(armGeo, _skinMat);
  lArm.position.set(-torsoW * 0.48, torsoH * 0.15, 0);
  lArm.rotation.set(0.2, 0, 1.1);
  lArm.castShadow = true;
  body.add(lArm);

  // --- legs (fixed crouch pose, attached to root not body) ---
  const legGroup = new THREE.Group();
  legGroup.name = 'legs';

  // upper legs — angled forward for crouch
  const uLegGeo = new THREE.CylinderGeometry(legR, legR * 0.85, upperLegLen, 5);

  const rULeg = new THREE.Mesh(uLegGeo, _shortsMat);
  rULeg.position.set(torsoW * 0.2, -upperLegLen * 0.35, 0.04);
  rULeg.rotation.x = 0.5;
  rULeg.castShadow = true;
  legGroup.add(rULeg);

  const lULeg = new THREE.Mesh(uLegGeo, _shortsMat);
  lULeg.position.set(-torsoW * 0.2, -upperLegLen * 0.35, -0.04);
  lULeg.rotation.x = 0.6;
  lULeg.castShadow = true;
  legGroup.add(lULeg);

  // lower legs — angled back (bent knee)
  const lLegGeo = new THREE.CylinderGeometry(legR * 0.8, legR * 0.55, lowerLegLen, 5);

  const rLLeg = new THREE.Mesh(lLegGeo, _skinMat);
  rLLeg.position.set(torsoW * 0.2, -upperLegLen * 0.85, upperLegLen * 0.25);
  rLLeg.rotation.x = -0.6;
  rLLeg.castShadow = true;
  legGroup.add(rLLeg);

  const lLLeg = new THREE.Mesh(lLegGeo, _skinMat);
  lLLeg.position.set(-torsoW * 0.2, -upperLegLen * 0.85, upperLegLen * 0.15);
  lLLeg.rotation.x = -0.7;
  lLLeg.castShadow = true;
  legGroup.add(lLLeg);

  // hip height: position so feet land near y=0
  const hipY = upperLegLen * Math.cos(0.55) + lowerLegLen * Math.cos(0.65) * 0.6;
  legGroup.position.y = hipY;

  // body sits on legs, tilted slightly forward (surf crouch)
  body.position.set(0, hipY + torsoH * 0.1, 0);
  body.rotation.x = -0.2;

  root.add(legGroup);
  root.add(body);

  // store refs for animation
  root.userData._body = body;
  root.userData._rArm = rArm;
  root.userData._lArm = lArm;
  root.userData._leanZ = 0;
  root.userData._crouchX = -0.2;

  return root;
}

// ═══════════════════════════════════════════════════════════════════════════════
// updateSurferPose — minimal: lean whole body for turns
// ═══════════════════════════════════════════════════════════════════════════════

export function updateSurferPose(surferGroup, leanAngle, turnRate, speed, dt = 1 / 60) {
  const body = surferGroup.userData._body;
  const rArm = surferGroup.userData._rArm;
  const lArm = surferGroup.userData._lArm;
  if (!body) return;

  const blend = 1 - Math.exp(-8 * dt);

  // lean body into turns (z rotation)
  const targetLeanZ = leanAngle * 0.4;
  surferGroup.userData._leanZ += (targetLeanZ - surferGroup.userData._leanZ) * blend;
  body.rotation.z = surferGroup.userData._leanZ;

  // crouch more at speed
  const targetCrouchX = -0.2 - speed * 0.15;
  surferGroup.userData._crouchX += (targetCrouchX - surferGroup.userData._crouchX) * blend;
  body.rotation.x = surferGroup.userData._crouchX;

  // arms react to turns — extend outward arm, pull inward arm
  if (rArm && lArm) {
    const turn = Math.max(-1, Math.min(1, turnRate));
    rArm.rotation.z = -1.1 - turn * 0.3;
    lArm.rotation.z = 1.1 - turn * 0.3;
    rArm.rotation.x = 0.2 + turn * 0.15;
    lArm.rotation.x = 0.2 - turn * 0.15;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// createSprayTrail — ribbon geometry behind the board
// ═══════════════════════════════════════════════════════════════════════════════

const TRAIL_LENGTH = 60;

export function createSprayTrail() {
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  const widths = new Float32Array(TRAIL_LENGTH);
  const alphas = new Float32Array(TRAIL_LENGTH);
  let writeIndex = 0;
  let filled = 0;

  const vertCount = TRAIL_LENGTH * 2;
  const posAttr = new Float32Array(vertCount * 3);
  const alphaAttr = new Float32Array(vertCount);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posAttr, 3));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphaAttr, 1));

  const indices = [];
  for (let i = 0; i < TRAIL_LENGTH - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(0.95, 0.97, 1.0, vAlpha * 0.6);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sprayTrail';
  mesh.frustumCulled = false;

  const _dir = new THREE.Vector3();
  const _perp = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  function update(position, speed, turning) {
    const i3 = writeIndex * 3;
    positions[i3] = position.x;
    positions[i3 + 1] = position.y;
    positions[i3 + 2] = position.z;

    const turnIntensity = Math.abs(turning);
    widths[writeIndex] = (0.02 + turnIntensity * 0.25) * speed;
    alphas[writeIndex] = speed * (0.3 + turnIntensity * 0.7);

    writeIndex = (writeIndex + 1) % TRAIL_LENGTH;
    if (filled < TRAIL_LENGTH) filled++;

    const count = filled;
    const startIdx = filled < TRAIL_LENGTH ? 0 : writeIndex;

    for (let s = 0; s < count; s++) {
      const bufIdx = (startIdx + s) % TRAIL_LENGTH;
      const age = s / Math.max(1, count - 1);

      const bx = positions[bufIdx * 3];
      const by = positions[bufIdx * 3 + 1];
      const bz = positions[bufIdx * 3 + 2];

      if (s < count - 1) {
        const nextIdx = (startIdx + s + 1) % TRAIL_LENGTH;
        _dir.set(
          positions[nextIdx * 3] - bx,
          positions[nextIdx * 3 + 1] - by,
          positions[nextIdx * 3 + 2] - bz,
        );
      } else if (s > 0) {
        const prevIdx = (startIdx + s - 1) % TRAIL_LENGTH;
        _dir.set(
          bx - positions[prevIdx * 3],
          by - positions[prevIdx * 3 + 1],
          bz - positions[prevIdx * 3 + 2],
        );
      } else {
        _dir.set(0, 0, 1);
      }

      if (_dir.lengthSq() < 0.0001) _dir.set(0, 0, 1);
      _dir.normalize();
      _perp.crossVectors(_dir, _up).normalize();

      const w = widths[bufIdx] * age;
      const a = alphas[bufIdx] * age * age;

      const vi = s * 2;
      posAttr[vi * 3] = bx - _perp.x * w;
      posAttr[vi * 3 + 1] = by + 0.02;
      posAttr[vi * 3 + 2] = bz - _perp.z * w;
      alphaAttr[vi] = a;

      posAttr[(vi + 1) * 3] = bx + _perp.x * w;
      posAttr[(vi + 1) * 3 + 1] = by + 0.02;
      posAttr[(vi + 1) * 3 + 2] = bz + _perp.z * w;
      alphaAttr[vi + 1] = a;
    }

    for (let s = count; s < TRAIL_LENGTH; s++) {
      const vi = s * 2;
      posAttr[vi * 3] = posAttr[vi * 3 + 1] = posAttr[vi * 3 + 2] = 0;
      posAttr[(vi + 1) * 3] = posAttr[(vi + 1) * 3 + 1] = posAttr[(vi + 1) * 3 + 2] = 0;
      alphaAttr[vi] = 0;
      alphaAttr[vi + 1] = 0;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
  }

  return { mesh, update };
}
