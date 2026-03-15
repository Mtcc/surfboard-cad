/**
 * WavePreview — Interactive Surfing Game Mode
 *
 * Control your custom board on realistic waves rendered by WaveEngine.
 * Board physics are determined by your actual design parameters.
 */

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { generateSurfboardGeometry, inchesToMeters } from '../geometry/surfboardGeometry';
import { SPOT_PROFILES } from './WaveEngine/spotProfiles';
import {
  buildBreakingWaveGeometry,
  buildWhitewaterGeometry,
  buildBarrelTubeGeometry,
  oceanVertexShader,
  oceanFragmentShader,
  whitewaterVertexShader,
  whitewaterFragmentShader,
} from './WaveEngine/WaveGeometry';

const ftToM = (ft) => ft * 0.3048;

// ═══════════════════════════════════════════════════════════════════════════════
// BOARD PHYSICS CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

function calculateBoardPhysics(params) {
  const length = params.lengthIn || 72;
  const width = params.widthIn || 20;
  const thickness = params.thicknessIn || 2.5;
  const tailWidth = params.tailWidthIn || 15;
  const noseRocker = params.noseRockerIn || 4;
  const tailRocker = params.tailRockerIn || 2;
  const volume = length * width * thickness * 0.6 / 1000;
  const tailShape = params.tailShape || 'squash';
  const railType = params.railType || '50/50';

  const isLongboard = length >= 84;
  const isMidLength = length >= 78 && length < 84;
  const isShortboard = length < 78;

  let turnRate = 1.0 + (84 - length) / 25;
  turnRate *= 1.0 + (18 - tailWidth) / 25;
  turnRate *= 1.0 + tailRocker / 6;
  const tailMods = { pin: 0.7, round: 0.85, squash: 1.1, swallow: 1.15, fish: 1.05, diamond: 0.9 };
  turnRate *= tailMods[tailShape] || 1.0;

  let baseSpeed = 0.8 + (width - 18) / 20;
  baseSpeed *= 1.0 + (5 - noseRocker) / 10;
  baseSpeed *= 0.8 + volume / 35;

  let acceleration = 0.5 + (width - 18) / 25;
  acceleration *= 1.0 + (5 - (noseRocker + tailRocker) / 2) / 8;

  let stability = 0.5 + width / 25;
  stability *= 0.7 + thickness / 3;
  stability *= 0.8 + volume / 40;

  const railMods = { 'soft': 0.7, '50/50': 0.85, 'down': 1.0, 'pinched': 1.1, 'tucked': 1.2 };
  const railHold = (railMods[railType] || 0.85) * (1 + tailRocker / 10);

  const pivotPoint = isLongboard ? 0.4 : isShortboard ? 0.75 : 0.6;
  const maxTurnAngle = 45 + railHold * 20;
  const noseRideAbility = isLongboard ? (1.0 - noseRocker / 8) * (width / 22) : 0;

  return {
    turnRate: Math.max(0.3, Math.min(2.0, turnRate)),
    baseSpeed: Math.max(0.4, Math.min(1.5, baseSpeed)),
    acceleration: Math.max(0.2, Math.min(1.2, acceleration)),
    stability: Math.max(0.3, Math.min(1.5, stability)),
    railHold: Math.max(0.5, Math.min(1.5, railHold)),
    pivotPoint, maxTurnAngle, noseRideAbility,
    isLongboard, isMidLength, isShortboard, volume, length,
  };
}

function calculateWaveMatch(params, spotKey) {
  const spot = SPOT_PROFILES[spotKey];
  if (!spot) return 50;

  const boardType = params.boardType || 'performanceShortboard';
  const physics = calculateBoardPhysics(params);
  let score = 50;

  if (spot.idealBoardTypes.includes(boardType)) score += 25;
  if (spot.idealBoardTypes.includes('shortboard') && physics.isShortboard) score += 10;
  if (spot.idealBoardTypes.includes('longboard') && physics.isLongboard) score += 10;

  const waveSize = (spot.waveHeight[0] + spot.waveHeight[1]) / 2;
  if (waveSize < 4 && physics.volume > 30) score += 10;
  if (waveSize > 8 && physics.railHold > 1.0) score += 15;
  if (spot.faceSteepness > 60 && physics.turnRate > 1.2) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPRAY PARTICLES
// ═══════════════════════════════════════════════════════════════════════════════

function createSpraySystem(count = 150) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const lifetimes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 1] = -100;
    lifetimes[i] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.userData = { velocities, lifetimes, nextIndex: 0, count };
  return geometry;
}

function emitSpray(geometry, position, direction, intensity) {
  const { velocities, lifetimes, count } = geometry.userData;
  const positions = geometry.attributes.position.array;
  let idx = geometry.userData.nextIndex;

  const burst = Math.ceil(intensity * 5);
  for (let i = 0; i < burst; i++) {
    positions[idx * 3] = position.x;
    positions[idx * 3 + 1] = position.y;
    positions[idx * 3 + 2] = position.z;

    velocities[idx * 3] = direction.x * 0.1 + (Math.random() - 0.5) * 0.05;
    velocities[idx * 3 + 1] = 0.08 + Math.random() * 0.1;
    velocities[idx * 3 + 2] = direction.z * 0.05 + (Math.random() - 0.5) * 0.03;

    lifetimes[idx] = 1.0;
    idx = (idx + 1) % count;
  }

  geometry.userData.nextIndex = idx;
  geometry.attributes.position.needsUpdate = true;
}

function updateSpray(geometry, deltaTime) {
  const { velocities, lifetimes, count } = geometry.userData;
  const positions = geometry.attributes.position.array;

  for (let i = 0; i < count; i++) {
    if (lifetimes[i] > 0) {
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];
      velocities[i * 3 + 1] -= 0.002;
      lifetimes[i] -= deltaTime * 2;

      if (lifetimes[i] <= 0 || positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = -100;
        lifetimes[i] = 0;
      }
    }
  }
  geometry.attributes.position.needsUpdate = true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRAIL
// ═══════════════════════════════════════════════════════════════════════════════

function createTrailGeometry(maxPoints = 300) {
  const positions = new Float32Array(maxPoints * 3);
  const colors = new Float32Array(maxPoints * 4);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setDrawRange(0, 0);
  geometry.userData = { points: [], maxPoints };
  return geometry;
}

function addTrailPoint(geometry, point) {
  const { points, maxPoints } = geometry.userData;
  points.push({ ...point });
  if (points.length > maxPoints) points.shift();

  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y + 0.02;
    positions[i * 3 + 2] = p.z;

    const alpha = (1 - i / points.length) * 0.6;
    colors[i * 4] = 1;
    colors[i * 4 + 1] = 1;
    colors[i * 4 + 2] = 1;
    colors[i * 4 + 3] = alpha;
  }

  geometry.setDrawRange(0, points.length);
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
}

function clearTrail(geometry) {
  geometry.userData.points = [];
  geometry.setDrawRange(0, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STATES
// ═══════════════════════════════════════════════════════════════════════════════

const GAME = { WAITING: 'waiting', PADDLING: 'paddling', SURFING: 'surfing', FINISHED: 'finished' };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function WavePreview({ params, onClose }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const boardRef = useRef(null);
  const waveRef = useRef(null);
  const oceanRef = useRef(null);
  const whitewaterRef = useRef(null);
  const sprayRef = useRef(null);
  const trailRef = useRef(null);
  const frameRef = useRef(null);
  const keysRef = useRef({});
  const uniformsRef = useRef({});

  const gameStateRef = useRef({
    state: GAME.WAITING,
    x: 0, y: 0.5, speed: 0, direction: 0,
    turnVelocity: 0, roll: 0, pitch: 0,
    rideTime: 0, maxSpeed: 0, turnCount: 0, styleScore: 100,
    lastTurnDir: 0, weightPosition: 0.5,
  });

  const [activeSpot, setActiveSpot] = useState('trestles');
  const [stance, setStance] = useState('regular');
  const [gameState, setGameState] = useState(GAME.WAITING);
  const [rideStats, setRideStats] = useState(null);
  const [showControls, setShowControls] = useState(true);

  const boardPhysics = useMemo(() => calculateBoardPhysics(params), [params]);
  const waveMatch = useMemo(() => calculateWaveMatch(params, activeSpot), [params, activeSpot]);

  const activeSpotRef = useRef(activeSpot);
  const stanceRef = useRef(stance);
  const physicsRef = useRef(boardPhysics);

  useEffect(() => { activeSpotRef.current = activeSpot; }, [activeSpot]);
  useEffect(() => { stanceRef.current = stance; }, [stance]);
  useEffect(() => { physicsRef.current = boardPhysics; }, [boardPhysics]);

  // Keyboard
  useEffect(() => {
    const down = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
        keysRef.current[e.code] = true;
      }
    };
    const up = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const resetGame = useCallback(() => {
    const gs = gameStateRef.current;
    Object.assign(gs, {
      state: GAME.WAITING, x: 0, y: 0.5, speed: 0, direction: 0,
      turnVelocity: 0, roll: 0, pitch: 0, rideTime: 0, maxSpeed: 0,
      turnCount: 0, styleScore: 100, lastTurnDir: 0, weightPosition: 0.5,
    });
    setGameState(GAME.WAITING);
    setRideStats(null);
    setShowControls(true);
    if (trailRef.current) clearTrail(trailRef.current.geometry);
  }, []);

  // Initialize scene
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 500);
    // Start camera in position to see the wave wall
    // Wave face is at negative X, so camera should look toward -X
    camera.position.set(5, 4, 0);
    camera.lookAt(-3, 2, 0);

    // Sky
    const sky = new Sky();
    sky.scale.setScalar(400);
    scene.add(sky);
    const sunPos = new THREE.Vector3();
    sunPos.setFromSphericalCoords(1, THREE.MathUtils.degToRad(60), THREE.MathUtils.degToRad(200));
    sky.material.uniforms['sunPosition'].value.copy(sunPos);
    sky.material.uniforms['turbidity'].value = 2;
    sky.material.uniforms['rayleigh'].value = 1;

    // Lighting
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -15;
    scene.add(sun);

    // Backlight through wave
    const backlight = new THREE.DirectionalLight(0x44ddbb, 1.2);
    backlight.position.set(-20, 8, 0);
    scene.add(backlight);

    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x006994, 0.6));
    scene.add(new THREE.AmbientLight(0x334455, 0.4));

    // Get spot config
    const spot = SPOT_PROFILES[activeSpot];
    const waveHeight = Math.max(ftToM((spot.waveHeight[0] + spot.waveHeight[1]) / 2), 2);

    // Ocean - position below wave
    const oceanGeo = new THREE.PlaneGeometry(300, 300, 180, 180);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanUniforms = {
      uTime: { value: 0 },
      uChop: { value: spot.surfaceChop },
      uDeepColor: { value: new THREE.Color(spot.waterColor).multiplyScalar(0.3) },
      uShallowColor: { value: new THREE.Color(spot.waterColor) },
      uSkyColor: { value: new THREE.Color(0x87ceeb) },
    };
    uniformsRef.current.ocean = oceanUniforms;
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: oceanUniforms,
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.y = -0.5;
    scene.add(ocean);
    oceanRef.current = ocean;

    // ═══════════════════════════════════════════════════════════════
    // BREAKING WAVE - THE MAIN ATTRACTION
    // ═══════════════════════════════════════════════════════════════
    const waveGeo = buildBreakingWaveGeometry(spot, waveHeight);

    // Use MeshPhysicalMaterial for reliable rendering
    const waveMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(spot.waterColor),
      metalness: 0,
      roughness: 0.05,
      transmission: 0.15 * spot.waterClarity,
      thickness: waveHeight * 0.5,
      ior: 1.33,
      clearcoat: 0.3,
      clearcoatRoughness: 0.1,
      specularIntensity: 1.0,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide,
      transparent: true,
      vertexColors: true,
    });

    const wave = new THREE.Mesh(waveGeo, waveMat);
    wave.castShadow = true;
    wave.receiveShadow = true;
    // Wave naturally extends along Z axis, face toward -X
    // No rotation needed - geometry is built correctly
    scene.add(wave);
    waveRef.current = wave;

    // Store wave height for board positioning
    waveRef.current.userData.waveHeight = waveHeight;

    // Barrel tube interior
    const tubeGeo = buildBarrelTubeGeometry(spot, waveHeight);
    if (tubeGeo) {
      const tubeMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(spot.waterColor).multiplyScalar(0.5),
        metalness: 0,
        roughness: 0.1,
        transmission: 0.4,
        thickness: 0.3,
        ior: 1.33,
        side: THREE.BackSide,
        transparent: true,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tube);
    }

    // Whitewater foam
    const wwGeo = buildWhitewaterGeometry(spot, waveHeight);
    const wwUniforms = { uTime: { value: 0 }, uIntensity: { value: spot.foamIntensity } };
    uniformsRef.current.whitewater = wwUniforms;
    const wwMat = new THREE.ShaderMaterial({
      uniforms: wwUniforms,
      vertexShader: whitewaterVertexShader,
      fragmentShader: whitewaterFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const whitewater = new THREE.Mesh(wwGeo, wwMat);
    scene.add(whitewater);
    whitewaterRef.current = whitewater;

    // Lip spray particles - along the breaking lip
    const sprayCount = Math.floor(400 * spot.barrelDepth + 100);
    const sprayPositions = new Float32Array(sprayCount * 3);
    for (let i = 0; i < sprayCount; i++) {
      // Spray at the lip
      const z = (Math.random() - 0.5) * spot.shoulderLength * 0.4;
      const throwFactor = (1 - spot.lipCurlRadius) * spot.barrelDepth;
      sprayPositions[i * 3] = waveHeight * (0.1 + throwFactor * 0.5) + Math.random() * waveHeight * 0.3;
      sprayPositions[i * 3 + 1] = waveHeight * (0.75 + Math.random() * 0.35);
      sprayPositions[i * 3 + 2] = z;
    }
    const lipSprayGeo = new THREE.BufferGeometry();
    lipSprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPositions, 3));
    const lipSprayMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lipSpray = new THREE.Points(lipSprayGeo, lipSprayMat);
    scene.add(lipSpray);

    // Spray
    const sprayGeo = createSpraySystem(200);
    const sprayMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spray = new THREE.Points(sprayGeo, sprayMat);
    scene.add(spray);
    sprayRef.current = spray;

    // Trail
    const trailGeo = createTrailGeometry(300);
    const trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);
    trailRef.current = trail;

    // Board
    try {
      const boardGeo = generateSurfboardGeometry(params);
      const boardMat = new THREE.MeshStandardMaterial({ color: 0xf8f4ee, roughness: 0.08 });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.castShadow = true;
      scene.add(board);
      boardRef.current = board;
    } catch (e) {
      console.error('Board error:', e);
    }

    // Env map
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(scene, 0, 0.1, 500).texture;

    // Animation
    let lastTime = 0, trailTimer = 0;

    function animate(currentTime) {
      frameRef.current = requestAnimationFrame(animate);
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      const time = currentTime * 0.001;

      const gs = gameStateRef.current;
      const keys = keysRef.current;
      const physics = physicsRef.current;
      const spot = SPOT_PROFILES[activeSpotRef.current];
      const waveHeight = ftToM((spot.waveHeight[0] + spot.waveHeight[1]) / 2);
      const stanceMult = stanceRef.current === 'goofy' ? -1 : 1;

      // Update uniforms
      if (uniformsRef.current.ocean) uniformsRef.current.ocean.uTime.value = time;
      if (uniformsRef.current.whitewater) uniformsRef.current.whitewater.uTime.value = time;

      // Game logic
      if (gs.state === GAME.WAITING && keys['Space']) {
        gs.state = GAME.PADDLING;
        gs.speed = 0.1;
        setGameState(GAME.PADDLING);
      } else if (gs.state === GAME.PADDLING) {
        gs.speed += physics.acceleration * 0.02 * deltaTime * 60;
        if (gs.speed > 0.4 * physics.baseSpeed) {
          gs.state = GAME.SURFING;
          setGameState(GAME.SURFING);
          setShowControls(false);
        }
      } else if (gs.state === GAME.SURFING) {
        gs.rideTime += deltaTime;

        const turnInput = (keys['ArrowLeft'] ? -1 : 0) + (keys['ArrowRight'] ? 1 : 0);
        const weightInput = (keys['ArrowUp'] ? -1 : 0) + (keys['ArrowDown'] ? 1 : 0);
        const adjTurn = turnInput * stanceMult;

        // Turning
        const targetTurn = adjTurn * physics.turnRate * 2.5;
        gs.turnVelocity += (targetTurn - gs.turnVelocity) * 0.15;
        gs.direction += gs.turnVelocity * deltaTime * 60 * 0.02;
        gs.direction = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, gs.direction));

        if (Math.abs(gs.turnVelocity) > 0.5 && Math.sign(gs.turnVelocity) !== gs.lastTurnDir) {
          gs.turnCount++;
          gs.lastTurnDir = Math.sign(gs.turnVelocity);
        }

        // Weight
        if (physics.isLongboard || physics.isMidLength) {
          gs.weightPosition += weightInput * 0.02;
          gs.weightPosition = Math.max(0.1, Math.min(0.9, gs.weightPosition));
          if (gs.weightPosition < 0.3) gs.speed *= 1 + (0.3 - gs.weightPosition) * 0.02;
        } else {
          if (weightInput < 0) gs.speed += physics.acceleration * 0.015 * deltaTime * 60;
          else if (weightInput > 0) { gs.speed *= 0.98; gs.turnVelocity *= 1.3; }
        }

        // Position
        gs.x += gs.speed * Math.cos(gs.direction) * deltaTime * 60 * 0.3;
        gs.y -= Math.sin(gs.direction) * gs.speed * deltaTime * 60 * 0.02;
        gs.y = Math.max(0.1, Math.min(0.95, gs.y));

        // Speed physics
        const gravityAccel = (0.5 - gs.y) * spot.waveEnergy * 0.02;
        gs.speed += gravityAccel * deltaTime * 60;
        if (gs.y > 0.4 && gs.y < 0.7) gs.speed *= 1 + spot.waveEnergy * 0.005;
        gs.speed *= 0.995;
        const maxSpeed = physics.baseSpeed * (1 + spot.waveEnergy * 0.5);
        gs.speed = Math.max(0.1, Math.min(maxSpeed, gs.speed));
        gs.maxSpeed = Math.max(gs.maxSpeed, gs.speed);

        // Tilt
        gs.roll += (gs.turnVelocity * 0.8 - gs.roll) * 0.15;
        gs.pitch = physics.isLongboard ? (gs.weightPosition - 0.5) * 0.3 : (0.5 - gs.y) * 0.1;

        // Style
        if (Math.abs(gs.turnVelocity) > 1.5) gs.styleScore = Math.max(0, gs.styleScore - 0.1);

        // End conditions
        if (gs.x > spot.shoulderLength * 0.8) endRide('Outran the wave');
        else if (gs.x < -5) endRide('Fell behind');
        else if (gs.y > 0.98) endRide('Over the falls!');
        else if (gs.y < 0.05 && gs.speed < 0.15) endRide('Lost the wave');

        // Spray
        if (Math.abs(gs.turnVelocity) > 0.8 && gs.speed > 0.3 && sprayRef.current && boardRef.current) {
          emitSpray(sprayRef.current.geometry, boardRef.current.position,
            { x: -Math.sign(gs.turnVelocity), z: Math.cos(gs.direction) },
            Math.abs(gs.turnVelocity));
        }

        // Trail
        trailTimer += deltaTime;
        if (trailTimer > 0.05 && trailRef.current && boardRef.current) {
          addTrailPoint(trailRef.current.geometry, boardRef.current.position);
          trailTimer = 0;
        }
      }

      // Update spray
      if (sprayRef.current) updateSpray(sprayRef.current.geometry, deltaTime);

      // Board position - on the wave face
      // Coordinate system:
      // - Z: along the wave (direction of travel)
      // - X: perpendicular to wave (negative = on face, positive = toward shore)
      // - Y: vertical height
      if (boardRef.current && spot) {
        const H = waveRef.current?.userData?.waveHeight || waveHeight;

        // gs.y: position on face (0.1=high/pocket, 0.9=low/trough)
        // gs.x: position along wave (increases as surfer travels)

        // X position on wave face (negative = on face)
        // Higher on face (low gs.y) = more negative X
        const faceDepth = (1 - gs.y) * 0.6; // 0 to 0.6
        const boardX = -H * (0.4 + faceDepth * 0.5);

        // Y height follows face contour
        const boardY = H * (0.1 + (1 - gs.y) * 0.85);

        // Z position along wave
        const boardZ = gs.x * 0.8;

        boardRef.current.position.set(boardX, boardY, boardZ);

        // Board rotation
        // - Pitch: nose down when dropping in, level when trimming
        const dropAngle = (gs.speed > 0.4) ? -0.15 : 0.1;
        // - Yaw: direction of travel along wave
        // - Roll: lean into turns
        const faceAngleRoll = -(1 - gs.y) * 0.3; // slight roll into face

        boardRef.current.rotation.set(
          gs.pitch + dropAngle,      // pitch
          gs.direction + Math.PI/2,  // yaw - board points down the line
          gs.roll + faceAngleRoll    // roll
        );

        // Wobble when slow/unstable
        if (gs.state === GAME.SURFING && gs.speed < 0.3 && physics.stability < 0.8) {
          boardRef.current.rotation.z += Math.sin(time * 10) * (1 - physics.stability) * 0.05;
        }
      }

      // Camera - positioned to show the wave WALL
      if (boardRef.current) {
        const boardPos = boardRef.current.position;
        const H = waveRef.current?.userData?.waveHeight || waveHeight;

        // Camera from shore side, looking at surfer with wave wall behind them
        // This shows the wave face dramatically
        const camTarget = new THREE.Vector3(
          boardPos.x + H * 2.5,     // on shore side (positive X)
          boardPos.y + H * 0.8,     // above surfer eye level
          boardPos.z - H * 1.5      // slightly behind
        );

        camera.position.lerp(camTarget, 0.05);

        // Look at a point that includes the wave face
        // This point is BEHIND the surfer (negative X) where the wave wall is
        const lookTarget = new THREE.Vector3(
          boardPos.x - H * 0.8,     // toward the wave face (negative X)
          boardPos.y,               // at board height
          boardPos.z + H * 1        // slightly ahead
        );

        camera.lookAt(lookTarget);
      }

      renderer.render(scene, camera);
    }

    function endRide(reason) {
      const gs = gameStateRef.current;
      gs.state = GAME.FINISHED;
      setGameState(GAME.FINISHED);
      setRideStats({
        rideTime: gs.rideTime.toFixed(1),
        maxSpeed: (gs.maxSpeed * 20).toFixed(1),
        turnCount: gs.turnCount,
        styleScore: Math.round(gs.styleScore),
        reason,
      });
    }

    animate(0);

    const onResize = () => {
      const W = el.clientWidth, H = el.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      pmrem.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // Update wave on spot change
  useEffect(() => {
    if (!waveRef.current) return;
    const spot = SPOT_PROFILES[activeSpot];
    if (!spot) return;

    const waveHeight = Math.max(ftToM((spot.waveHeight[0] + spot.waveHeight[1]) / 2), 2);

    // Update wave geometry
    const oldGeo = waveRef.current.geometry;
    waveRef.current.geometry = buildBreakingWaveGeometry(spot, waveHeight);
    waveRef.current.userData.waveHeight = waveHeight;
    if (oldGeo) oldGeo.dispose();

    // Update wave material color
    if (waveRef.current.material.color) {
      waveRef.current.material.color.set(spot.waterColor);
    }

    // Update whitewater
    if (whitewaterRef.current) {
      const oldWw = whitewaterRef.current.geometry;
      whitewaterRef.current.geometry = buildWhitewaterGeometry(spot, waveHeight);
      if (oldWw) oldWw.dispose();
      if (uniformsRef.current.whitewater) {
        uniformsRef.current.whitewater.uIntensity.value = spot.foamIntensity;
      }
    }

    // Update ocean
    if (uniformsRef.current.ocean) {
      uniformsRef.current.ocean.uChop.value = spot.surfaceChop;
      uniformsRef.current.ocean.uDeepColor.value.set(spot.waterColor).multiplyScalar(0.3);
      uniformsRef.current.ocean.uShallowColor.value.set(spot.waterColor);
    }

    resetGame();
  }, [activeSpot, resetGame]);

  // Update board
  useEffect(() => {
    if (!boardRef.current) return;
    try {
      const newGeo = generateSurfboardGeometry(params);
      if (boardRef.current.geometry) boardRef.current.geometry.dispose();
      boardRef.current.geometry = newGeo;
    } catch (e) { console.error(e); }
  }, [params]);

  const spot = SPOT_PROFILES[activeSpot];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a1525', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ height: 52, background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
        <button onClick={onClose} style={btnStyle}>Back</button>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {['regular', 'goofy'].map(s => (
            <button key={s} onClick={() => setStance(s)} style={{ ...btnSmall, background: stance === s ? 'rgba(68,136,204,0.4)' : 'rgba(255,255,255,0.08)' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>🏄 Surf Mode</div>
        <div style={{ flex: 1 }} />
        <select value={activeSpot} onChange={(e) => setActiveSpot(e.target.value)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '6px 12px', color: '#fff', fontSize: 12 }}>
          {Object.entries(SPOT_PROFILES).map(([key, s]) => (
            <option key={key} value={key} style={{ background: '#1a1a2e' }}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Main */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

        {/* Wave match */}
        <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>BOARD MATCH</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: waveMatch >= 70 ? '#4adba2' : waveMatch >= 50 ? '#ffd166' : '#ef476f' }}>{waveMatch}%</div>
        </div>

        {/* Live stats */}
        {gameState === GAME.SURFING && (
          <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: '12px 16px', minWidth: 120 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>TIME</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{gameStateRef.current.rideTime.toFixed(1)}s</div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>SPEED</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#4adba2' }}>{(gameStateRef.current.speed * 20).toFixed(0)} mph</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>TURNS</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffd166' }}>{gameStateRef.current.turnCount}</div>
            </div>
          </div>
        )}

        {/* Controls */}
        {showControls && gameState !== GAME.SURFING && (
          <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', borderRadius: 12, padding: '20px 30px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>CONTROLS</div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 12 }}>
              <Key k="←" label={stance === 'regular' ? 'Down wave' : 'Up wave'} />
              <Key k="→" label={stance === 'regular' ? 'Up wave' : 'Down wave'} />
              <Key k="↑" label={boardPhysics.isLongboard ? 'Walk nose' : 'Front foot'} />
              <Key k="↓" label={boardPhysics.isLongboard ? 'Walk tail' : 'Back foot'} />
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {params.lengthFt}'{params.lengthIn_extra}" {params.boardType}
            </div>
          </div>
        )}

        {/* Start */}
        {gameState === GAME.WAITING && (
          <div style={{ position: 'absolute', bottom: 200, left: '50%', transform: 'translateX(-50)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)', animation: 'pulse 1.5s infinite' }}>
              Press SPACE to paddle
            </div>
            <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
          </div>
        )}

        {/* Paddling */}
        {gameState === GAME.PADDLING && (
          <div style={{ position: 'absolute', bottom: 200, left: '50%', transform: 'translateX(-50%)', fontSize: 20, fontWeight: 700, color: '#ffd166' }}>
            Paddling...
          </div>
        )}

        {/* End */}
        {gameState === GAME.FINISHED && rideStats && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.9)', borderRadius: 16, padding: '30px 50px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{rideStats.reason}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 24 }}>Ride Complete</div>
              <div style={{ display: 'flex', gap: 30, marginBottom: 24 }}>
                <Stat label="Time" value={`${rideStats.rideTime}s`} />
                <Stat label="Max Speed" value={`${rideStats.maxSpeed} mph`} color="#4adba2" />
                <Stat label="Turns" value={rideStats.turnCount} color="#ffd166" />
                <Stat label="Style" value={`${rideStats.styleScore}%`} color="#ef476f" />
              </div>
              <button onClick={resetGame} style={{ ...btnStyle, padding: '12px 32px', fontSize: 14, background: 'linear-gradient(135deg, #2255aa, #4488cc)' }}>
                Surf Again
              </button>
            </div>
          </div>
        )}

        {/* Spot info */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {spot.name} — {spot.region} — {spot.waveHeight[0]}-{spot.waveHeight[1]}ft
        </div>
      </div>
    </div>
  );
}

const btnStyle = { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const btnSmall = { ...btnStyle, padding: '6px 12px', fontSize: 11 };

function Key({ k, label }) {
  return (
    <div>
      <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{k}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{label}</div>
    </div>
  );
}

function Stat({ label, value, color = '#fff' }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
