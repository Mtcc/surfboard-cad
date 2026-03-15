/**
 * Viewport3D — Three.js WebGL surfboard visualization
 *
 * Camera modes:
 *   Perspective (3D/Side/Tail/Nose): PerspectiveCamera + free OrbitControls
 *   Orthographic (Top/Bottom):       OrthographicCamera fitted to board size,
 *                                    pan+zoom only — true 1:1 plan proportions.
 *
 * Board coordinate system (Y-up, lying flat, centered at origin):
 *   X = length   (nose = -L/2, tail = +L/2)
 *   Y = height   (bottom at rocker, deck upward)
 *   Z = width    (centerline = 0, rails = ±W/2)
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { generateSurfboardGeometry, inchesToMeters } from '../geometry/surfboardGeometry';
import ConcaveZoneBar from './ConcaveZoneBar';
import { DEFAULT_ZONES } from '../data/concavePresets';

// Tail types that need CSG notch cutting
const NOTCHED_TAILS = ['swallow', 'fish', 'wingedSwallow'];

// Views that use the orthographic camera (true plan views)
const ORTHO_VIEWS = new Set(['top', 'bottom']);

// Perspective camera presets - each optimized for viewing specific features
const VIEW_PRESETS = {
  perspective: { pos: [1.2, 0.9, 0.9],    tgt: [0, 0.04, 0] },  // general 3D
  side:        { pos: [0, 0.08, 1.8],     tgt: [0, 0.05, 0] },  // rocker profile
  tail:        { pos: [1.4, 0.12, 0.35],  tgt: [0, 0.05, 0] },  // tail shape
  nose:        { pos: [-1.4, 0.12, 0.35], tgt: [0, 0.05, 0] },  // nose shape
  rails:       { pos: [0.3, 0.35, 1.0],   tgt: [0, 0.02, 0] },  // rail profile (angled down)
  concave:     { pos: [0.15, -0.8, 0.6],  tgt: [0, 0, 0] },     // bottom contour (underneath)
};

const VIEW_LABELS = {
  perspective: '3D',
  top:     'Top',
  bottom:  'Bottom',
  side:    'Side',
  rails:   'Rails',
  concave: 'Concave',
  tail:    'Tail',
  nose:    'Nose',
};

/**
 * Fit an OrthographicCamera to the board's plan dimensions with padding.
 *
 * Board is in the XZ plane (Y=height axis). Camera looks straight down (or up)
 * the Y axis. With camera.up = (-1,0,0), the nose (at -X) appears at the top
 * of the screen and the board's Z-width fills screen-X — true plan view.
 *
 * @param {THREE.OrthographicCamera} cam
 * @param {object} params  - current board params
 * @param {number} W,H     - viewport pixel dimensions
 */
function sizeOrthoCam(cam, params, W, H) {
  // Always fit board length (nose-to-tail) vertically with 30% padding.
  // Horizontal extent follows the viewport aspect ratio — the board is always
  // centred and fully visible regardless of how wide or narrow the panel is.
  const L  = params.lengthIn || (params.lengthFt * 12 + (params.lengthIn_extra || 0));
  const Lm = inchesToMeters(L);
  const halfH = (Lm * 1.3) / 2;
  const halfW = halfH * (W / H);

  cam.left   = -halfW;
  cam.right  =  halfW;
  cam.top    =  halfH;
  cam.bottom = -halfH;
  cam.zoom   = 1;
  cam.updateProjectionMatrix();
}

function animateCameraTo(camera, controls, targetPos, targetLook, onDone) {
  const startPos = camera.position.clone();
  const endPos   = new THREE.Vector3(...targetPos);
  const startTgt = controls.target.clone();
  const endTgt   = new THREE.Vector3(...targetLook);
  const duration = 480;
  const t0 = performance.now();

  function frame(now) {
    const raw = Math.min((now - t0) / duration, 1);
    const t = raw * raw * (3 - 2 * raw); // smoothstep
    camera.position.lerpVectors(startPos, endPos, t);
    controls.target.lerpVectors(startTgt, endTgt, t);
    controls.update();
    if (raw < 1) requestAnimationFrame(frame);
    else if (onDone) onDone();
  }
  requestAnimationFrame(frame);
}

export default function Viewport3D({ params, activeView, onViewChange, onParamsChange }) {
  const mountRef      = useRef(null);
  const sceneRef      = useRef(null);
  const rendererRef   = useRef(null);
  const cameraRef     = useRef(null);    // currently active camera (persp or ortho)
  const perspCamRef   = useRef(null);   // PerspectiveCamera instance
  const orthoCamRef   = useRef(null);   // OrthographicCamera instance
  const controlsRef   = useRef(null);
  const meshRef       = useRef(null);
  const guidesRef     = useRef(null);       // guide lines group
  const frameRef      = useRef(null);
  const paramsRef     = useRef(params);     // always-current params (avoids stale closures)
  const activeViewRef = useRef(activeView); // always-current view (for resize handler)
  const scaleRef      = useRef(1);          // camera scale factor (board length / baseline)

  // ── Scene initialisation (runs once) ──────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1520);
    scene.fog = new THREE.Fog(0x0d1520, 4, 12);
    sceneRef.current = scene;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Environment map (async — no blocking)
    import('three/addons/environments/RoomEnvironment.js')
      .then(({ RoomEnvironment }) => {
        if (!sceneRef.current) return;
        const pmrem = new THREE.PMREMGenerator(renderer);
        const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
        sceneRef.current.environment = env.texture;
        pmrem.dispose();
      })
      .catch(() => {});

    // ── Perspective camera (default 3D view) ──
    const perspCam = new THREE.PerspectiveCamera(50, W / H, 0.005, 50);
    const p = VIEW_PRESETS.perspective;
    perspCam.position.set(...p.pos);
    perspCam.lookAt(...p.tgt);
    perspCamRef.current = perspCam;
    cameraRef.current   = perspCam; // start with perspective

    // ── Orthographic camera (top/bottom plan views) ──
    // up = (-1,0,0) → nose (−X axis) appears at top of screen
    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
    orthoCam.up.set(-1, 0, 0);
    sizeOrthoCam(orthoCam, paramsRef.current, W, H);
    orthoCamRef.current = orthoCam;

    // ── Orbit controls (shared, camera swapped on view change) ──
    const controls = new OrbitControls(perspCam, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance   = 0.2;
    controls.maxDistance   = 6;
    controls.target.set(...p.tgt);
    controls.update();
    controlsRef.current = controls;

    // ── 3-point lighting rig ──
    const keyLight = new THREE.DirectionalLight(0xfff4e8, 1.8);
    keyLight.position.set(0.6, 2.2, 1.4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near   = 0.1;
    keyLight.shadow.camera.far    = 8;
    keyLight.shadow.camera.left   = -2;
    keyLight.shadow.camera.right  = 2;
    keyLight.shadow.camera.top    = 2;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc8d8ff, 0.55);
    fillLight.position.set(-1.5, 0.8, -0.5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x5599dd, 0.45);
    rimLight.position.set(0.3, -1.0, -1.8);
    scene.add(rimLight);

    scene.add(new THREE.AmbientLight(0x203050, 0.8));

    // Ground plane — shadow receiver, NO grid
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.9, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    // Guide lines group (centerlines + wide point indicator)
    const guides = new THREE.Group();
    guides.name = 'guides';

    // Stringer line (length axis through center) - faint blue
    const stringerMat = new THREE.LineBasicMaterial({ color: 0x4488cc, opacity: 0.3, transparent: true });
    const stringerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-2, 0.001, 0),
      new THREE.Vector3(2, 0.001, 0),
    ]);
    const stringerLine = new THREE.Line(stringerGeo, stringerMat);
    stringerLine.name = 'stringer';
    guides.add(stringerLine);

    // Center width line (at 50% of board) - faint white
    const centerMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.2, transparent: true });
    const centerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.001, -0.4),
      new THREE.Vector3(0, 0.001, 0.4),
    ]);
    const centerLine = new THREE.Line(centerGeo, centerMat);
    centerLine.name = 'centerLine';
    guides.add(centerLine);

    // Wide point line (moves with widePointIn) - brighter cyan
    const wpMat = new THREE.LineBasicMaterial({ color: 0x44ddff, opacity: 0.5, transparent: true });
    const wpGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.002, -0.4),
      new THREE.Vector3(0, 0.002, 0.4),
    ]);
    const wpLine = new THREE.Line(wpGeo, wpMat);
    wpLine.name = 'widePointLine';
    guides.add(wpLine);

    scene.add(guides);
    guidesRef.current = guides;

    // Render loop — reads cameraRef.current so camera swaps take effect immediately
    let running = true;
    function animate() {
      if (!running) return;
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, cameraRef.current);
    }
    animate();

    // Resize — update both cameras
    const onResize = () => {
      const W = el.clientWidth, H = el.clientHeight;
      perspCamRef.current.aspect = W / H;
      perspCamRef.current.updateProjectionMatrix();
      if (ORTHO_VIEWS.has(activeViewRef.current)) {
        sizeOrthoCam(orthoCamRef.current, paramsRef.current, W, H);
      }
      renderer.setSize(W, H);
    };
    window.addEventListener('resize', onResize);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // ── Board mesh rebuild (+ keep paramsRef current) ──────────────────────────
  useEffect(() => {
    paramsRef.current = params;

    // Keep ortho camera fitted when board dimensions change
    if (ORTHO_VIEWS.has(activeViewRef.current) && orthoCamRef.current && rendererRef.current) {
      const size = new THREE.Vector2();
      rendererRef.current.getSize(size);
      sizeOrthoCam(orthoCamRef.current, params, size.x, size.y);
    }

    const scene = sceneRef.current;
    if (!scene) return;

    // Dispose old mesh
    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material)  obj.material.dispose();
      });
      meshRef.current = null;
    }

    // Update camera scale and reposition for current view
    const scale = Math.max(1.0, inchesToMeters(params.lengthIn) / 1.7);
    scaleRef.current = scale;
    if (!ORTHO_VIEWS.has(activeViewRef.current) && perspCamRef.current && controlsRef.current) {
      const preset = VIEW_PRESETS[activeViewRef.current];
      if (preset) {
        animateCameraTo(
          perspCamRef.current, controlsRef.current,
          preset.pos.map(v => v * scale), preset.tgt,
        );
      }
    }

    try {
      let geometry = generateSurfboardGeometry(params);

      // ── CSG: Cut V-notch for swallow/fish tails ──────────────────────────
      const tailShape = params.tailShape || 'squash';
      if (NOTCHED_TAILS.includes(tailShape)) {
        const L = params.lengthIn;
        const Lm = inchesToMeters(L);
        const halfL = Lm / 2;
        const swallowDepth = inchesToMeters(params.swallowDepthIn || 3.5);
        const tailWidth = inchesToMeters(params.tailWidthIn || 15);
        const thickness = inchesToMeters(params.thicknessIn || 2.5);

        // V-notch dimensions
        // Notch opens to ~30% of tail width on each side (60% total spread at tail end)
        const notchHalfWidth = tailWidth * 0.30;
        const wedgeLength = swallowDepth + 0.015; // extend slightly past tail
        const wedgeHeight = thickness + 0.04; // extend through full thickness

        // Create CURVED V-notch shape
        // Real swallow tails have concave inner walls (like cutting with a round gouge)
        // Shapers use the nose outline curve flipped to draw the swallow shape
        const wedgeShape = new THREE.Shape();

        // Draw the notch outline with curved walls
        // Start at the apex (tip of the V, at x=0)
        wedgeShape.moveTo(0, 0);

        // Right wall: curved path from apex to right wing opening
        // Use quadratic curve - control point creates the concave (inward) curve
        // Control point is pulled INWARD (toward centerline) to create concave wall
        wedgeShape.quadraticCurveTo(
          wedgeLength * 0.6, notchHalfWidth * 0.3,  // control point (inward bow)
          wedgeLength, notchHalfWidth               // end at right wing opening
        );

        // Across the tail end (outside the board - will be cut off)
        wedgeShape.lineTo(wedgeLength, -notchHalfWidth);

        // Left wall: curved path back to apex (mirror of right wall)
        wedgeShape.quadraticCurveTo(
          wedgeLength * 0.6, -notchHalfWidth * 0.3, // control point (inward bow)
          0, 0                                       // back to apex
        );

        wedgeShape.closePath();

        const extrudeSettings = {
          depth: wedgeHeight,
          bevelEnabled: false,
        };
        const wedgeGeom = new THREE.ExtrudeGeometry(wedgeShape, extrudeSettings);

        // ExtrudeGeometry extrudes along +Z by default.
        // Rotate so shape is in XZ plane (top view), extruded through Y (height)
        wedgeGeom.rotateX(-Math.PI / 2);

        // Position: apex at (halfL - swallowDepth), centered on Z, below board on Y
        wedgeGeom.translate(
          halfL - swallowDepth,  // X: notch apex position
          -0.02,                 // Y: start below board bottom
          0                      // Z: centered on stringer
        );

        // Create brushes for CSG
        const boardBrush = new Brush(geometry);
        boardBrush.updateMatrixWorld();

        const wedgeBrush = new Brush(wedgeGeom);
        wedgeBrush.updateMatrixWorld();

        // Perform subtraction
        const evaluator = new Evaluator();
        const resultBrush = evaluator.evaluate(boardBrush, wedgeBrush, SUBTRACTION);
        geometry = resultBrush.geometry;
        geometry.computeVertexNormals();
      }

      // Add vertex colors for concave visualization
      const positions = geometry.attributes.position;
      const colors = new Float32Array(positions.count * 3);
      const L = params.lengthIn;
      const Lm = inchesToMeters(L);
      const halfL = Lm / 2;
      const halfW = inchesToMeters(params.widePointWidthIn) / 2;

      // Default zones if none defined
      const defaultZones = [
        { id: 1, type: 'flat', start: 0, end: 12, depth: 0, width: 0.7 },
        { id: 2, type: 'singleConcave', start: 12, end: 55, depth: 0.15, width: 0.75 },
        { id: 3, type: 'doubleConcave', start: 55, end: 82, depth: 0.12, width: 0.8 },
        { id: 4, type: 'vee', start: 82, end: 100, depth: 0.06, width: 0.5 },
      ];
      const zones = params.concaveZones || defaultZones;

      // Calculate depth for a single zone
      const getZoneDepth = (zone, pct, absZ, normalized) => {
        switch (zone.type) {
          case 'flat':
            return 0;
          case 'singleConcave':
            return zone.depth * (1 - normalized * normalized);
          case 'doubleConcave': {
            const spineWidth = 0.15;
            if (absZ < spineWidth) {
              return -zone.depth * 0.3 * (1 - absZ / spineWidth);
            }
            const channelPos = (absZ - spineWidth) / (zone.width - spineWidth);
            return zone.depth * Math.sin(channelPos * Math.PI);
          }
          case 'vee':
            return -zone.depth * (1 - normalized);
          case 'spiral': {
            const zoneProgress = (pct - zone.start) / (zone.end - zone.start);
            if (zoneProgress < 0.4) {
              return zone.depth * (1 - normalized * normalized);
            } else if (zoneProgress < 0.7) {
              const spineWidth = 0.12;
              if (absZ < spineWidth) return -zone.depth * 0.2;
              const channelPos = (absZ - spineWidth) / (zone.width - spineWidth);
              return zone.depth * 0.8 * Math.sin(channelPos * Math.PI);
            } else {
              return -zone.depth * 0.5 * (1 - normalized);
            }
          }
          case 'channels': {
            const channelCount = 3;
            const channelWidth = zone.width / channelCount;
            const channelIdx = Math.floor(absZ / channelWidth);
            if (channelIdx >= channelCount) return 0;
            const inChannel = (absZ % channelWidth) / channelWidth;
            return zone.depth * Math.sin(inChannel * Math.PI);
          }
          case 'hull':
            return -zone.depth * (1 - normalized * normalized);
          case 'triPlane': {
            // Three flat panels meeting at angles
            const panelBreak = 0.35;
            if (absZ < panelBreak) {
              // Center panel - slight concave
              return zone.depth * 0.3;
            }
            // Side panels - angled up toward rails
            const sideProgress = (absZ - panelBreak) / (zone.width - panelBreak);
            return zone.depth * 0.3 - zone.depth * sideProgress * 0.8;
          }
          default:
            return 0;
        }
      };

      // Zone-based concave depth calculation with blending
      const getConcaveDepth = (xFrac, zFrac) => {
        const pct = xFrac * 100;
        const absZ = Math.abs(zFrac);

        // Find the zone at this position
        let zoneIdx = zones.findIndex(z => pct >= z.start && pct < z.end);
        if (zoneIdx === -1) zoneIdx = zones.length - 1;
        const zone = zones[zoneIdx];

        // Check if outside concave width (use max of adjacent zones for blending)
        const maxWidth = Math.max(zone.width, zones[zoneIdx - 1]?.width || 0, zones[zoneIdx + 1]?.width || 0);
        if (absZ > maxWidth) return 0;

        const normalized = zone.width > 0 ? Math.min(1, absZ / zone.width) : 0;

        // Get base depth for this zone
        let depth = getZoneDepth(zone, pct, absZ, normalized);

        // Blend with previous zone
        if (zoneIdx > 0) {
          const prevZone = zones[zoneIdx - 1];
          const blendWidth = (zone.blend || 5) / 100 * (zone.end - zone.start);
          const distFromStart = pct - zone.start;

          if (distFromStart < blendWidth && blendWidth > 0) {
            const blendT = distFromStart / blendWidth;
            const smoothT = blendT * blendT * (3 - 2 * blendT); // smoothstep
            const prevNorm = prevZone.width > 0 ? Math.min(1, absZ / prevZone.width) : 0;
            const prevDepth = getZoneDepth(prevZone, pct, absZ, prevNorm);
            depth = prevDepth + (depth - prevDepth) * smoothT;
          }
        }

        return depth;
      };

      // Vibrant color gradient for depth visualization
      // Deep blue/purple (deep concave) → Cyan → Green → Yellow → Orange → Red (vee/convex)
      const depthToColor = (depth) => {
        // Normalize: -0.15 (vee) = 0, 0 (flat) = 0.4, +0.25 (deep concave) = 1
        const t = Math.max(0, Math.min(1, (depth + 0.15) / 0.40));

        let r, g, b;
        if (t < 0.15) {
          // Deep red/magenta (strong vee)
          r = 1.0;
          g = 0.1;
          b = 0.3;
        } else if (t < 0.35) {
          // Red to orange (vee/flat)
          const s = (t - 0.15) / 0.2;
          r = 1.0;
          g = 0.1 + s * 0.5;
          b = 0.3 - s * 0.2;
        } else if (t < 0.45) {
          // Orange to yellow (near flat)
          const s = (t - 0.35) / 0.1;
          r = 1.0;
          g = 0.6 + s * 0.4;
          b = 0.1;
        } else if (t < 0.55) {
          // Yellow to green (light concave)
          const s = (t - 0.45) / 0.1;
          r = 1.0 - s * 0.8;
          g = 1.0;
          b = 0.1 + s * 0.2;
        } else if (t < 0.7) {
          // Green to cyan (medium concave)
          const s = (t - 0.55) / 0.15;
          r = 0.2 - s * 0.15;
          g = 1.0 - s * 0.1;
          b = 0.3 + s * 0.6;
        } else if (t < 0.85) {
          // Cyan to blue (deeper concave)
          const s = (t - 0.7) / 0.15;
          r = 0.05;
          g = 0.9 - s * 0.5;
          b = 0.9;
        } else {
          // Blue to purple (deepest concave)
          const s = (t - 0.85) / 0.15;
          r = 0.05 + s * 0.4;
          g = 0.4 - s * 0.3;
          b = 0.9 + s * 0.1;
        }
        return [r, g, b];
      };

      // Color each vertex based on concave depth
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        const xFrac = (x + halfL) / Lm; // 0 = nose, 1 = tail
        const zFrac = halfW > 0 ? z / halfW : 0; // -1 to 1

        // Bottom vertices get depth-based colors, deck gets neutral
        const isBottom = y < 0.02;
        const depth = isBottom ? getConcaveDepth(xFrac, zFrac) : 0;
        const [r, g, b] = isBottom ? depthToColor(depth) : [0.92, 0.92, 0.90];

        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }

      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Standard material for normal view
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf5f2ec),
        roughness: 0.08,
        metalness: 0.0,
        envMapIntensity: 0.6,
      });

      // Vertex color material for concave view
      const concaveMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.3,
        metalness: 0.0,
        envMapIntensity: 0.3,
      });

      // Use concave material if already in concave view
      const useConcave = activeViewRef.current === 'concave';
      const mesh = new THREE.Mesh(geometry, useConcave ? concaveMat : mat);
      mesh.castShadow    = true;
      mesh.receiveShadow = false;
      mesh.userData.concaveMaterial = concaveMat;
      mesh.userData.normalMaterial = mat;

      scene.add(mesh);
      meshRef.current = mesh;

      // Update guide lines to match board dimensions
      if (guidesRef.current) {
        const Lm = inchesToMeters(params.lengthIn);
        const Wm = inchesToMeters(params.widePointWidthIn || 21);
        const halfL = Lm / 2;
        const halfW = Wm / 2 + 0.05; // slight padding

        // Update stringer line (full length)
        const stringer = guidesRef.current.getObjectByName('stringer');
        if (stringer) {
          stringer.geometry.setFromPoints([
            new THREE.Vector3(-halfL, 0.001, 0),
            new THREE.Vector3(halfL, 0.001, 0),
          ]);
        }

        // Update center line (at x=0, board midpoint)
        const centerLine = guidesRef.current.getObjectByName('centerLine');
        if (centerLine) {
          centerLine.geometry.setFromPoints([
            new THREE.Vector3(0, 0.001, -halfW),
            new THREE.Vector3(0, 0.001, halfW),
          ]);
        }

        // Update wide point line (at widePointIn from nose)
        const wpLine = guidesRef.current.getObjectByName('widePointLine');
        if (wpLine) {
          const wpX = inchesToMeters(params.widePointIn || params.lengthIn / 2) - halfL;
          wpLine.geometry.setFromPoints([
            new THREE.Vector3(wpX, 0.002, -halfW),
            new THREE.Vector3(wpX, 0.002, halfW),
          ]);
        }
      }
    } catch (err) {
      console.error('Geometry error:', err);
    }
  }, [params]);

  // ── Camera view switching ──────────────────────────────────────────────────
  useEffect(() => {
    activeViewRef.current = activeView;
    const controls = controlsRef.current;
    if (!controls) return;

    // Show guides only in top/bottom views
    if (guidesRef.current) {
      guidesRef.current.visible = ORTHO_VIEWS.has(activeView);
    }

    // Swap material for concave view (show vertex colors)
    if (meshRef.current) {
      const mesh = meshRef.current;
      if (activeView === 'concave' && mesh.userData.concaveMaterial) {
        mesh.material = mesh.userData.concaveMaterial;
      } else if (mesh.userData.normalMaterial) {
        mesh.material = mesh.userData.normalMaterial;
      }
    }

    if (ORTHO_VIEWS.has(activeView)) {
      // ── Orthographic plan view (top/bottom only) ────────────────────────
      const orthoCam = orthoCamRef.current;
      const renderer = rendererRef.current;
      if (!orthoCam || !renderer) return;

      // Fit to current board dimensions
      const size = new THREE.Vector2();
      renderer.getSize(size);
      sizeOrthoCam(orthoCam, paramsRef.current, size.x, size.y);

      // Position straight above (top) or below (bottom)
      const isBottomView = activeView === 'bottom';
      orthoCam.position.set(0, isBottomView ? -3 : 3, 0);
      orthoCam.up.set(-1, 0, 0); // nose (−X) at top of screen
      orthoCam.lookAt(0, 0, 0);
      orthoCam.updateProjectionMatrix();

      // Hand controls to ortho cam; disable rotation (plan view is fixed angle)
      cameraRef.current     = orthoCam;
      controls.object       = orthoCam;
      controls.target.set(0, 0, 0);
      controls.enableRotate = false;
      controls.enableZoom   = true;
      controls.enablePan    = true;
      controls.update();

    } else {
      // ── Perspective view ────────────────────────────────────────────────
      const perspCam = perspCamRef.current;
      if (!perspCam) return;

      cameraRef.current     = perspCam;
      controls.object       = perspCam;
      controls.enableRotate = true;
      controls.enableZoom   = true;
      controls.enablePan    = true;

      const preset = VIEW_PRESETS[activeView];
      if (preset) animateCameraTo(perspCam, controls, preset.pos.map(v => v * scaleRef.current), preset.tgt);
    }
  }, [activeView]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 3D Canvas */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* View switcher */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 4,
        background: 'rgba(10,15,25,0.88)', padding: '6px 10px',
        borderRadius: 10, border: '1px solid rgba(68,136,204,0.25)',
        backdropFilter: 'blur(8px)',
      }}>
        {Object.entries(VIEW_LABELS).map(([view, label]) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
              background: activeView === view
                ? 'linear-gradient(135deg,#2255aa,#4488cc)'
                : 'rgba(255,255,255,0.07)',
              color: activeView === view ? '#fff' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.18s',
              boxShadow: activeView === view ? '0 2px 8px rgba(68,136,204,0.4)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Context hint or Depth legend */}
      {activeView === 'concave' ? (
        <div style={{
          position: 'absolute', top: 12, right: 14,
          background: 'rgba(10,15,25,0.85)',
          borderRadius: 8,
          padding: '8px 12px',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>
            DEPTH
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { color: '#6633cc', label: 'Deep concave', value: '+0.20"' },
              { color: '#0099ff', label: 'Medium', value: '+0.12"' },
              { color: '#00cc88', label: 'Light', value: '+0.06"' },
              { color: '#ffcc00', label: 'Flat', value: '0"' },
              { color: '#ff6622', label: 'Light vee', value: '-0.04"' },
              { color: '#ff2266', label: 'Deep vee', value: '-0.10"' },
            ].map(({ color, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 14, height: 10, borderRadius: 2,
                  background: color,
                }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', flex: 1 }}>{label}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          position: 'absolute', top: 12, right: 14,
          fontSize: 10.5, color: 'rgba(255,255,255,0.22)',
          lineHeight: 1.7, textAlign: 'right',
        }}>
          {ORTHO_VIEWS.has(activeView)
            ? 'Scroll to zoom · Right-drag to pan'
            : 'Drag · Scroll · Right-drag to pan'}
        </div>
      )}

      {/* Concave zone bar - shown in concave view */}
      <ConcaveZoneBar
        zones={params.concaveZones || DEFAULT_ZONES.performance}
        onChange={(newZones) => {
          if (onParamsChange) {
            onParamsChange({ ...params, concaveZones: newZones });
          }
        }}
        visible={activeView === 'concave'}
      />
    </div>
  );
}
