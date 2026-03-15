/**
 * WaveScene.js — Procedural wave + KSPS-style camera
 *
 * The wave is a continuous surface (displaced plane) — no edges visible.
 * The wave forms by animating heightFactor from 0 (flat) to 1 (full wave).
 * Camera stays at water level. The surfer is small, the wave is massive.
 *
 * Phases: lineup → paddle → dropin → surfing → ended
 */

import * as THREE from 'three';
// painted canvas backgrounds instead of Sky shader
import { generateSurfboardGeometry } from '../../geometry/surfboardGeometry.js';
import {
  createWaveFace, createBarrelLip, setWaveHeightFactor,
  getWaveYAtX, getWaveSlopeAtX,
} from './ProceduralWave.js';
import { WAVE_SPOTS } from './WaveSpotProfiles.js';
import {
  computeBoardPhysics, computeSurferBoardInteraction, DEFAULT_SURFER,
  createBoardState, startRide, updatePhysics,
  createInputState, bindControls,
  calculateBoardWaveMatch, calculateRideScore, getBathymetry,
} from '../../physics/index.js';
import { THEMES } from './themes.js';
import { createSurfer, updateSurferPose, createSprayTrail } from './Surfer.js';

// ═══════════════════════════════════════════════════════════════════════════════

function smoothstepT(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function createOceanPlane() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x004e64, roughness: 0.3, metalness: 0.2 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.08;
  mesh.receiveShadow = true;
  return mesh;
}

// ═══════════════════════════════════════════════════════════════════════════════

export class WaveSceneManager {
  constructor(container) {
    this.container = container;
    this.disposed = false;

    const W = container.clientWidth;
    const H = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 500);
    this.clock = new THREE.Clock();

    // wave meshes
    this.waveFaceMesh = null;
    this.barrelMesh = null;
    this.surfboardMesh = null;
    this.currentSpotId = 'pipeline';
    this.frameId = null;

    // wave state
    this.waveHeight = 7;    // current spot's max wave height (meters)
    this.heightFactor = 0;  // 0 = flat, 1 = full wave

    // phase
    this.phase = 'lineup';
    this.phaseTimer = 0;

    // board position during surfing
    this.boardX = 0;       // cross-wave (on the face)
    this.boardZ = 0;       // along the wave line
    this._heading = 0;     // carve heading in degrees (0 = along wave, + = toward crest)
    this._headingVel = 0;  // heading change rate (smoothed)
    this._boardYaw = 0;    // visual yaw (smooth blend of travel direction)
    this._turnHoldTime = 0; // how long turn key has been held (for progressive tightening)

    // physics
    this.boardPhysics = null;
    this.surferBoard = null;
    this.boardState = null;
    this.inputState = createInputState();
    this.cleanupControls = null;
    this.boardMatch = null;
    this.rideScore = null;

    // theme system
    this.currentTheme = 'day';
    this.sunLight = null;
    this.hemiLight = null;
    this.fillLight = null;
    this.backLight = null;

    // surfer + spray
    this.surferModel = null;
    this.sprayTrail = null;

    // star field (night mode)
    this.starField = null;

    this.onPhaseChange = null;
    this.onRideEnd = null;

    this._setupSky();
    this._setupLighting();
    this.ocean = createOceanPlane();
    this.scene.add(this.ocean);
  }

  _setupSky() {
    // painted tropical background instead of procedural Sky shader
    this._paintBackground('day');
  }

  _paintBackground(themeId) {
    const W = 2048;
    const H = 1024;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    if (themeId === 'night') {
      // night sky
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#020410');
      g.addColorStop(0.4, '#0a0e20');
      g.addColorStop(0.55, '#101828');
      g.addColorStop(1, '#060e18');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // stars
      for (let i = 0; i < 600; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H * 0.55;
        const sr = Math.random() * 1.5 + 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.6 + 0.2})`;
        ctx.fill();
      }
    } else if (themeId === 'sunset') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2a1535');
      g.addColorStop(0.35, '#6a3060');
      g.addColorStop(0.5, '#d06050');
      g.addColorStop(0.55, '#e8a060');
      g.addColorStop(0.6, '#805090');
      g.addColorStop(1, '#1a1530');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // sun glow
      const sg = ctx.createRadialGradient(W * 0.3, H * 0.52, 10, W * 0.3, H * 0.52, 200);
      sg.addColorStop(0, 'rgba(255,200,100,0.6)');
      sg.addColorStop(1, 'rgba(255,100,50,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
    } else {
      // day: tropical sky + beach + palms (KSPS style)
      // sky gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#5a80c0');     // deeper blue at zenith
      g.addColorStop(0.3, '#8aaad8');   // medium blue
      g.addColorStop(0.45, '#b8cce8');  // light blue near horizon
      g.addColorStop(0.52, '#d0dae8');  // hazy horizon
      g.addColorStop(0.55, '#2a6888');  // ocean at horizon
      g.addColorStop(1, '#1a4a6a');     // deep ocean
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // clouds — scattered white puffs
      for (let i = 0; i < 18; i++) {
        const cx = Math.random() * W;
        const cy = H * 0.1 + Math.random() * H * 0.35;
        const cw = 80 + Math.random() * 200;
        const ch = 30 + Math.random() * 60;
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.5);
        cg.addColorStop(0, `rgba(255,255,255,${0.4 + Math.random() * 0.3})`);
        cg.addColorStop(0.6, 'rgba(255,255,255,0.15)');
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(cx - cw, cy - ch, cw * 2, ch * 2);
      }

      // beach strip (right portion of panorama, at horizon)
      const beachX = W * 0.55;
      ctx.fillStyle = '#e8d8b0';
      ctx.fillRect(beachX, H * 0.50, W - beachX, H * 0.06);
      // beach gradient fade
      const bg = ctx.createLinearGradient(beachX - 80, 0, beachX, 0);
      bg.addColorStop(0, 'rgba(232,216,176,0)');
      bg.addColorStop(1, 'rgba(232,216,176,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(beachX - 80, H * 0.50, 80, H * 0.06);

      // palm trees on the beach
      const palmPositions = [
        [W * 0.62, H * 0.50, 0.8],
        [W * 0.68, H * 0.49, 1.0],
        [W * 0.75, H * 0.50, 0.9],
        [W * 0.82, H * 0.49, 0.7],
        [W * 0.90, H * 0.50, 0.85],
        [W * 0.58, H * 0.50, 0.6],
      ];
      for (const [px, py, ps] of palmPositions) {
        // trunk
        ctx.strokeStyle = '#5a4530';
        ctx.lineWidth = 3 * ps;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 8 * ps, py - 40 * ps, px + 3 * ps, py - 70 * ps);
        ctx.stroke();
        // fronds
        const top = py - 70 * ps;
        for (let f = 0; f < 7; f++) {
          const angle = (f / 7) * Math.PI * 2;
          const fx = px + 3 * ps + Math.cos(angle) * 25 * ps;
          const fy = top + Math.sin(angle) * 12 * ps - 8 * ps;
          ctx.strokeStyle = '#2a6a30';
          ctx.lineWidth = 2.5 * ps;
          ctx.beginPath();
          ctx.moveTo(px + 3 * ps, top);
          ctx.quadraticCurveTo(
            (px + 3 * ps + fx) / 2, fy - 10 * ps,
            fx, fy,
          );
          ctx.stroke();
        }
      }
    }

    const texture = new THREE.CanvasTexture(c);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.background = texture;
    this._bgTexture = texture;
  }

  _setupLighting() {
    // strong sun — lights the wave face
    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 3.0);
    this.sunLight.position.set(10, 15, -8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.setScalar(2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -40;
    this.sunLight.shadow.camera.right = 40;
    this.sunLight.shadow.camera.top = 25;
    this.sunLight.shadow.camera.bottom = -10;
    this.scene.add(this.sunLight);

    // hemisphere fill — sky blue above, ocean blue below
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x006994, 0.8);
    this.scene.add(this.hemiLight);

    // front fill — lights the face from the ocean side so it's never dark
    this.fillLight = new THREE.DirectionalLight(0xaaccff, 1.5);
    this.fillLight.position.set(-10, 8, 0);
    this.scene.add(this.fillLight);

    // backlight — glow through the wave
    this.backLight = new THREE.DirectionalLight(0x44bbcc, 0.8);
    this.backLight.position.set(10, 5, 5);
    this.scene.add(this.backLight);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THEME SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  setTheme(themeId) {
    const theme = THEMES[themeId];
    if (!theme) return;
    this.currentTheme = themeId;

    // repaint background for this theme
    this._paintBackground(themeId);

    // lighting
    if (this.sunLight) {
      this.sunLight.color.set(theme.sunColor);
      this.sunLight.intensity = theme.sunIntensity;
    }
    if (this.hemiLight) {
      this.hemiLight.color.set(theme.hemiSkyColor);
      this.hemiLight.groundColor.set(theme.hemiGroundColor);
      this.hemiLight.intensity = theme.hemiIntensity;
    }
    if (this.fillLight) {
      this.fillLight.color.set(theme.fillColor);
      this.fillLight.intensity = theme.fillIntensity;
    }
    if (this.backLight) {
      this.backLight.color.set(theme.backlightColor);
      this.backLight.intensity = theme.backlightIntensity;
    }

    // renderer exposure
    this.renderer.toneMappingExposure = theme.exposure;

    // ocean plane color
    if (this.ocean?.material) {
      this.ocean.material.color.set(theme.oceanColor);
    }

    // recreate wave geometry with theme colors
    if (this.waveFaceMesh) {
      this.loadWave(this.currentSpotId);
    }

    // star field: 3D stars for night depth (background has stars too but these add parallax)
    if (themeId === 'night') {
      this._createStarField();
    } else {
      this._removeStarField();
    }

    console.info('[WaveEngine] theme set:', theme.name);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAR FIELD (night mode)
  // ═══════════════════════════════════════════════════════════════════════════

  _createStarField() {
    if (this.starField) { this.scene.remove(this.starField); }
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(2000 * 3);
    for (let i = 0; i < 2000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45; // upper hemisphere only
      const r = 200 + Math.random() * 200;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: true });
    this.starField = new THREE.Points(geo, mat);
    this.scene.add(this.starField);
  }

  _removeStarField() {
    if (this.starField) {
      this.scene.remove(this.starField);
      this.starField.geometry.dispose();
      this.starField.material.dispose();
      this.starField = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE CREATION (procedural)
  // ═══════════════════════════════════════════════════════════════════════════

  loadWave(spotId = 'pipeline') {
    const spot = WAVE_SPOTS[spotId];
    if (!spot) return Promise.reject(new Error('Unknown spot: ' + spotId));
    this.currentSpotId = spotId;

    // wave height in meters from spot profile
    this.waveHeight = spot.waveHeightFt * 0.3048;

    // remove old wave meshes
    if (this.waveFaceMesh) { this.scene.remove(this.waveFaceMesh); this.waveFaceMesh.geometry.dispose(); }
    if (this.barrelMesh) { this.scene.remove(this.barrelMesh); this.barrelMesh.geometry.dispose(); }

    // create procedural wave face
    const faceGeo = createWaveFace(this.waveHeight, 200, 300, this.currentTheme);
    const faceMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.4, metalness: 0.05,
      side: THREE.DoubleSide,
    });
    this.waveFaceMesh = new THREE.Mesh(faceGeo, faceMat);
    this.waveFaceMesh.receiveShadow = true;
    this.waveFaceMesh.castShadow = true;
    this.scene.add(this.waveFaceMesh);

    // create barrel lip (for spots with barrels)
    const barrelRadius = spot.breakType === 'Barreling' ? this.waveHeight * 0.35 : this.waveHeight * 0.15;
    const lipGeo = createBarrelLip(this.waveHeight, barrelRadius, 300, this.currentTheme);
    if (lipGeo) {
      const lipMat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.35, metalness: 0.05,
        side: THREE.DoubleSide, transparent: true, opacity: 0.85,
      });
      this.barrelMesh = new THREE.Mesh(lipGeo, lipMat);
      this.scene.add(this.barrelMesh);
    }

    // foam: whitewater plane behind the crest + crest foam strip
    this._createFoam();

    // start at full height (wave slides in from distance, not grows)
    this.heightFactor = 1;
    setWaveHeightFactor(faceGeo, 1);

    this._resetToLineup();
    console.info('[WaveEngine] Created procedural wave |', spot.name, '| height:', this.waveHeight.toFixed(1) + 'm');
    return Promise.resolve();
  }

  _createFoam() {
    // remove old foam
    if (this.foamMesh) { this.scene.remove(this.foamMesh); this.foamMesh.geometry.dispose(); }
    if (this.crestFoamMesh) { this.scene.remove(this.crestFoamMesh); this.crestFoamMesh.geometry.dispose(); }

    const theme = THEMES[this.currentTheme] || THEMES.day;

    // whitewater: wide horizontal plane behind the crest, just above sea level
    const foamTex = this._makeFoamTexture();
    const foamGeo = new THREE.PlaneGeometry(300, 15);
    const foamMat = new THREE.MeshStandardMaterial({
      map: foamTex, transparent: true, opacity: theme.foamOpacity,
      roughness: 0.95, color: theme.foamColor, side: THREE.DoubleSide, depthWrite: false,
    });
    this.foamMesh = new THREE.Mesh(foamGeo, foamMat);
    this.foamMesh.rotation.x = -Math.PI / 2;
    this.foamMesh.position.set(4, 0.1, 0); // behind crest, at water level
    this.scene.add(this.foamMesh);

    // crest foam: thin white strip along the lip
    const crestGeo = new THREE.PlaneGeometry(300, 0.5);
    const crestMat = new THREE.MeshBasicMaterial({
      color: theme.foamColor, transparent: true, opacity: theme.foamOpacity,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.crestFoamMesh = new THREE.Mesh(crestGeo, crestMat);
    this.crestFoamMesh.position.set(2, this.waveHeight + 0.1, 0); // at the crest
    this.crestFoamMesh.rotation.x = -Math.PI / 4; // angled to catch light
    this.scene.add(this.crestFoamMesh);
  }

  _makeFoamTexture(size = 512) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, size, size);
    // scattered white dots and blobs
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * size;
      const y = Math.pow(Math.random(), 1.5) * size;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 3 + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 + 0.3})`;
      ctx.fill();
    }
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.pow(Math.random(), 2) * size;
      ctx.beginPath();
      ctx.arc(x, y, Math.random() * 10 + 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.2 + 0.15})`;
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  _syncFoamToWave() {
    const wx = this.waveFaceMesh ? this.waveFaceMesh.position.x : 0;
    if (this.foamMesh) this.foamMesh.position.x = wx + 4;
    if (this.crestFoamMesh) this.crestFoamMesh.position.x = wx + 2;
    // scroll foam texture for animation
    if (this.foamMesh?.material?.map) {
      this.foamMesh.material.map.offset.x += 0.002;
    }
  }

  switchSpot(spotId) {
    this.loadWave(spotId);
    if (this.boardPhysics) this._computeBoardMatch();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOARD
  // ═══════════════════════════════════════════════════════════════════════════

  setBoard(params, volumeL) {
    if (this.surfboardMesh) {
      this.scene.remove(this.surfboardMesh);
      this.surfboardMesh.geometry?.dispose();
      this.surfboardMesh.material?.dispose();
    }
    try {
      const geo = generateSurfboardGeometry(params);
      const mat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.35, metalness: 0 });
      this.surfboardMesh = new THREE.Mesh(geo, mat);
      this.surfboardMesh.castShadow = true;
      this.scene.add(this.surfboardMesh);

      // create surfer character on the board
      if (this.surferModel) { this.scene.remove(this.surferModel); }
      this.surferModel = createSurfer();
      this.surferModel.scale.setScalar(1.0); // full scale — wave is the dominant visual
      this.scene.add(this.surferModel);

      // create spray trail
      if (this.sprayTrail) { this.scene.remove(this.sprayTrail.mesh); }
      const trail = createSprayTrail();
      this.sprayTrail = trail;
      this.scene.add(trail.mesh);

      this.boardPhysics = computeBoardPhysics(params, volumeL);
      this.surferBoard = computeSurferBoardInteraction(DEFAULT_SURFER, this.boardPhysics);
      this.boardState = createBoardState();
      this._computeBoardMatch();
      this._resetToLineup();
    } catch (err) {
      console.error('[WaveEngine] Board error:', err);
    }
  }

  _computeBoardMatch() {
    if (!this.boardPhysics) return;
    const spot = WAVE_SPOTS[this.currentSpotId];
    this.boardMatch = calculateBoardWaveMatch(this.boardPhysics, {
      faceHeight: this.waveHeight,
      steepness: spot.breakType === 'Barreling' ? 65 : 35,
      powerZone: 0.7,
      insideBarrel: spot.breakType === 'Barreling',
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE MACHINE
  // ═══════════════════════════════════════════════════════════════════════════

  _setPhase(p) {
    this.phase = p;
    this.phaseTimer = 0;
    this.onPhaseChange?.(p);
  }

  _resetToLineup() {
    this._setPhase('lineup');
    this.rideScore = null;
    this.heightFactor = 1;
    this.boardX = -1;  // start mid-face
    this.boardZ = 0;
    this._heading = 0;
    this._headingVel = 0;
    this._boardYaw = 0;
    this._turnHoldTime = 0;
    if (this.cleanupControls) { this.cleanupControls(); this.cleanupControls = null; }

    // wave at full height
    if (this.waveFaceMesh) {
      setWaveHeightFactor(this.waveFaceMesh.geometry, 1);
      this.waveFaceMesh.visible = true;
      this.waveFaceMesh.position.x = 2;
    }
    if (this.barrelMesh) {
      this.barrelMesh.visible = true;
      this.barrelMesh.position.x = 2;
    }

    // board on the wave face
    if (this.surfboardMesh) {
      this.surfboardMesh.visible = true;
      const surfaceY = getWaveYAtX(this.boardX, this.waveHeight);
      this.surfboardMesh.position.set(this.boardX, surfaceY - 0.02, 0);
      this.surfboardMesh.rotation.set(0, 0, 0);
    }

    // surfer on board
    if (this.surferModel) {
      const surfaceY = getWaveYAtX(this.boardX, this.waveHeight);
      this.surferModel.position.set(this.boardX, surfaceY + 0.06, 0);
      this.surferModel.rotation.set(0, 0, 0);
    }

    // camera: KSPS style — low, behind, looking up at the wave wall
    const surfaceY = getWaveYAtX(this.boardX, this.waveHeight);
    this.camera.position.set(this.boardX - 3, surfaceY + 0.8, -3);
    this.camera.lookAt(this.boardX + 2, surfaceY + 3, 2);
  }

  startPaddle() {
    if (this.phase !== 'lineup' || !this.surfboardMesh) return;
    this._setPhase('dropin');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION
  // ═══════════════════════════════════════════════════════════════════════════

  start() { this.clock.start(); this._animate(); }

  _animate = () => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this._animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsedTime();
    this.phaseTimer += dt;

    switch (this.phase) {
      case 'lineup':  break;
      case 'dropin':  this._phaseDropIn(dt); break;
      case 'surfing': this._phaseSurfing(dt); break;
      case 'ended':   this._phaseEnded(); break;
    }

    this.renderer.render(this.scene, this.camera);
  };

  // ── DROP IN: surfer catches the wave (~1.5s) ──────────────────────────
  // board moves onto the face, nose dips down, speed builds.
  // matches KSPS frames g_0510 → g_0530.

  _phaseDropIn() {
    const dur = 1.5;
    const t = Math.min(1, this.phaseTimer / dur);

    if (this.surfboardMesh) {
      // board drops onto the face, nose dips down, turns to ride along wave
      const surfaceY = getWaveYAtX(this.boardX, this.waveHeight);
      const slope = getWaveSlopeAtX(this.boardX, this.waveHeight);

      // sink board INTO the wave face (rail engagement)
      const targetY = surfaceY - 0.03;
      this.surfboardMesh.position.y += (targetY - this.surfboardMesh.position.y) * 0.15;
      this.surfboardMesh.position.x = this.boardX;

      // rotate: nose-down dip easing to face along wave
      const noseDip = -0.25 * (1 - t);
      const yaw = smoothstepT(t) * (Math.PI / 2);
      this.surfboardMesh.rotation.order = 'YXZ';
      this.surfboardMesh.rotation.set(slope + noseDip, yaw, 0);

      // surfer on board
      if (this.surferModel) {
        this.surferModel.position.copy(this.surfboardMesh.position);
        this.surferModel.position.y += 0.06;
        this.surferModel.rotation.copy(this.surfboardMesh.rotation);
      }

      // camera: from above → behind surfer, looking up at wave wall
      const bp = this.surfboardMesh.position;
      const camTarget = new THREE.Vector3(
        bp.x - 3 + t * 0.5,
        Math.max(0.4, bp.y + 2 - t * 1.5),
        bp.z - 2.5,
      );
      this.camera.position.lerp(camTarget, 0.08);
      this.camera.lookAt(
        bp.x + 1.5,
        bp.y + 2,
        bp.z + 3,
      );
    }

    if (this.phaseTimer >= dur) this._startSurfing();
  }

  _startSurfing() {
    if (!this.boardPhysics || !this.surferBoard) return;

    this.boardState = createBoardState();
    startRide(this.boardState, this.boardPhysics, this.surferBoard);
    this.boardX = this.surfboardMesh?.position.x || 0;
    this.boardZ = this.surfboardMesh?.position.z || 0;

    if (this.cleanupControls) this.cleanupControls();
    this.inputState = createInputState();
    this.cleanupControls = bindControls(this.inputState);

    this._setPhase('surfing');
  }

  // ── SURFING: main gameplay ────────────────────────────────────────────
  // board rides the face. Y is determined by the wave profile at board's X.
  // the board can't leave the face — it's clamped to the surface.
  // camera close behind, wave face fills the screen like KSPS.

  _phaseSurfing(dt) {
    if (!this.boardState || !this.boardPhysics || !this.surferBoard) return;

    // ── KSPS-style arcade controls ──────────────────────────────────────
    // left/right = carve direction on the face
    // up/down = front foot / back foot pressure (speed trim)
    const turnInput = (this.inputState.leftArrow ? 1 : 0) - (this.inputState.rightArrow ? 1 : 0);

    const spot = WAVE_SPOTS[this.currentSpotId];

    // run physics for scoring/state tracking
    updatePhysics(dt, this.boardState, this.inputState,
      this.boardPhysics, this.surferBoard,
      {
        faceSteepness: spot.breakType === 'Barreling' ? 65 : 35,
        waveHeight: this.waveHeight,
        lipThrow: spot.breakType === 'Barreling' ? 0.7 : 0.2,
        barrelDepth: spot.breakType === 'Barreling' ? 0.8 : 0.1,
      },
      getBathymetry(this.currentSpotId),
    );

    // animate foam
    this._syncFoamToWave();

    // ── CARVING: ±60° heading, constant speed, instant cutbacks ────────
    // heading directly controls cross-wave angle. ±60° covers the full face.
    // cutback = just switch from +60 to -60. no 270° bullshit.
    const TURN_RATE = 200;      // degrees/sec — snappy
    const MAX_HEADING = 65;     // ±65° is full rail engagement
    const FORWARD_SPEED = 0.5;  // forward along wave (constant, never penalized)
    const CROSS_SPEED = 0.8;    // cross-wave carve speed

    // heading tracks input directly with smooth blend
    const targetHeading = turnInput * MAX_HEADING;
    const headingBlend = 1 - Math.exp(-8 * dt); // fast blend
    this._heading += (targetHeading - this._heading) * headingBlend;

    // also allow direct rate change for feel
    this._heading += turnInput * TURN_RATE * dt * 0.3;
    this._heading = THREE.MathUtils.clamp(this._heading, -MAX_HEADING, MAX_HEADING);

    // when no input, smooth back to straight
    if (turnInput === 0) {
      this._heading *= Math.exp(-3 * dt);
    }

    // ── SPEED: constant forward, no penalty for turning ─────────────────
    const speedInput = (this.inputState.upArrow ? 1 : 0) - (this.inputState.downArrow ? 1 : 0);
    const speedTrim = 1.0 + speedInput * 0.25;
    const carvingBoost = Math.abs(this._heading) > 20 ? 1.1 : 1.0; // on rail = faster
    const speed = this.boardState.speed * speedTrim * carvingBoost;

    const prevX = this.boardX;
    const prevZ = this.boardZ;

    // forward speed is CONSTANT — no cos(heading) penalty
    const headingRad = this._heading * Math.PI / 180;
    this.boardZ += speed * dt * FORWARD_SPEED;
    this.boardX += speed * Math.sin(headingRad) * dt * CROSS_SPEED;

    // clamp to rideable face — bounce off edges instead of ending ride
    const FACE_BOTTOM = -2.8;
    const FACE_TOP = 2.0;
    if (this.boardX < FACE_BOTTOM) {
      this.boardX = FACE_BOTTOM;
      // reverse heading away from trough (force back up the face)
      if (this._heading < 0) this._heading *= -0.5;
    }
    if (this.boardX > FACE_TOP) {
      this.boardX = FACE_TOP;
      // reverse heading away from crest (force back down)
      if (this._heading > 0) this._heading *= -0.5;
    }
    this.boardZ = THREE.MathUtils.clamp(this.boardZ, -140, 140);

    // sync to physics — clamp to safe zone so physics never kills the ride
    // from face position (only time/wipeout physics should end rides)
    this.boardState.wavePosition.face = THREE.MathUtils.clamp((this.boardX + 3) / 5, 0.1, 0.85);
    this.boardState.leanAngle = this._heading * 0.6;

    // board yaw: smooth blend of actual travel direction
    const dx = this.boardX - prevX;
    const dz = this.boardZ - prevZ;
    if (dx * dx + dz * dz > 0.00001) {
      const travelYaw = Math.atan2(dx, dz);
      this._boardYaw += (travelYaw - this._boardYaw) * (1 - Math.exp(-8 * dt));
    }

    if (this.surfboardMesh) {
      this.surfboardMesh.position.x = this.boardX;
      this.surfboardMesh.position.z = this.boardZ;

      // Y = wave surface — board sits IN the wave (rail engaged, not floating)
      const currentH = this.waveHeight;
      const surfaceY = getWaveYAtX(this.boardX, currentH);
      this.surfboardMesh.position.y += (surfaceY - 0.03 - this.surfboardMesh.position.y) * 0.5;

      // rotation: nose follows travel direction, tilted to wave slope, lean into turns
      const slope = getWaveSlopeAtX(this.boardX, currentH);
      const lean = this._heading * Math.PI / 180 * 0.6; // lean proportional to carve angle
      const yaw = this._boardYaw || 0;

      this.surfboardMesh.rotation.order = 'YXZ';
      this.surfboardMesh.rotation.set(slope, yaw, lean);

      // surfer on the board
      if (this.surferModel) {
        this.surferModel.position.copy(this.surfboardMesh.position);
        this.surferModel.position.y += 0.06;
        this.surferModel.rotation.copy(this.surfboardMesh.rotation);

        const normalizedSpeed = Math.min(1, this.boardState.speed / 8);
        updateSurferPose(this.surferModel, lean, turnInput, normalizedSpeed, dt);
      }

      // spray trail
      if (this.sprayTrail) {
        const normalizedSpeed = Math.min(1, this.boardState.speed / 8);
        this.sprayTrail.update(this.surfboardMesh.position, normalizedSpeed, turnInput);
      }

      // ── CAMERA: KSPS style — low behind surfer, wave wall fills screen ──
      const bp = this.surfboardMesh.position;
      const camTarget = new THREE.Vector3(
        bp.x - 2.5,                    // ocean-side, behind
        Math.max(0.3, bp.y + 0.5),     // low, near water level
        bp.z - 3.0,                     // behind the surfer
      );
      this.camera.position.lerp(camTarget, 0.06);
      // look toward the wave face (up and forward)
      this.camera.lookAt(bp.x + 2, bp.y + 2.5, bp.z + 3);

      // end conditions
      if (this.boardState.isWipedOut) {
        const m = this.boardState.maneuvers[this.boardState.maneuvers.length - 1] || '';
        this._endRide(m === 'pearl' ? 'Pearled!' : 'Wiped out!');
        return;
      }
      if (!this.boardState.rideActive) { this._endRide('Lost the wave'); return; }
      if (this.phaseTimer >= spot.rideDurationS) { this._endRide('Ride complete!'); return; }
    }

    this.onPhaseChange?.('surfing');
  }

  // ── ENDED ─────────────────────────────────────────────────────────────

  _endRide(reason) {
    if (this.phase !== 'surfing') return;
    this.boardState.rideActive = false;
    if (this.cleanupControls) { this.cleanupControls(); this.cleanupControls = null; }

    const spot = WAVE_SPOTS[this.currentSpotId];
    this.rideScore = calculateRideScore(this.boardState, this.boardPhysics, {
      steepness: spot.breakType === 'Barreling' ? 65 : 35,
      faceHeight: this.waveHeight, powerZone: 0.5, insideBarrel: false,
    });
    this.rideScore.reason = reason;
    this._setPhase('ended');
    this.onRideEnd?.(this.rideScore);
  }

  _phaseEnded() {
    const camTarget = new THREE.Vector3(3, 2, 8);
    this.camera.position.lerp(camTarget, 0.02);
    this.camera.lookAt(0, 1, 0);
    if (this.phaseTimer >= 5) this._resetToLineup();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════════════

  resize() {
    const W = this.container.clientWidth;
    const H = this.container.clientHeight;
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(W, H);
  }

  dispose() {
    this.disposed = true;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    if (this.cleanupControls) this.cleanupControls();

    // clean up surfer
    if (this.surferModel) {
      this.scene.remove(this.surferModel);
      this.surferModel = null;
    }

    // clean up spray trail
    if (this.sprayTrail) {
      this.scene.remove(this.sprayTrail.mesh);
      this.sprayTrail.mesh.geometry?.dispose();
      this.sprayTrail.mesh.material?.dispose();
      this.sprayTrail = null;
    }

    // clean up star field + background
    this._removeStarField();
    if (this._bgTexture) { this._bgTexture.dispose(); this._bgTexture = null; }

    this.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material?.dispose();
      }
    });
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
