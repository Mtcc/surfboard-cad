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
import { generateSurfboardGeometry, inchesToMeters } from '../geometry/surfboardGeometry';

// Views that use the orthographic camera
const ORTHO_VIEWS = new Set(['top', 'bottom']);

// Perspective camera presets
const VIEW_PRESETS = {
  perspective: { pos: [1.2, 0.9, 0.9],   tgt: [0, 0.04, 0] },
  side:        { pos: [0, 0.08, 1.8],     tgt: [0, 0.05, 0] },
  tail:        { pos: [1.4, 0.12, 0.35],  tgt: [0, 0.05, 0] },
  nose:        { pos: [-1.4, 0.12, 0.35], tgt: [0, 0.05, 0] },
};

const VIEW_LABELS = {
  perspective: '3D',
  top:    'Top',
  side:   'Side',
  bottom: 'Bottom',
  tail:   'Tail',
  nose:   'Nose',
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

export default function Viewport3D({ params, activeView, onViewChange }) {
  const mountRef      = useRef(null);
  const sceneRef      = useRef(null);
  const rendererRef   = useRef(null);
  const cameraRef     = useRef(null);    // currently active camera (persp or ortho)
  const perspCamRef   = useRef(null);   // PerspectiveCamera instance
  const orthoCamRef   = useRef(null);   // OrthographicCamera instance
  const controlsRef   = useRef(null);
  const meshRef       = useRef(null);
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
      const geometry = generateSurfboardGeometry(params);

      // Glossy surfboard resin material
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf5f2ec),
        roughness: 0.08,
        metalness: 0.0,
        envMapIntensity: 0.6,
      });

      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow    = true;
      mesh.receiveShadow = false;

      // Faint wireframe overlay — shows surface topology
      mesh.add(new THREE.Mesh(geometry.clone(), new THREE.MeshBasicMaterial({
        color: 0x2255aa, wireframe: true,
        transparent: true, opacity: 0.04, depthWrite: false,
      })));

      // Outline pass (back-face scaled up) — sharpens silhouette
      const outlineMesh = new THREE.Mesh(geometry.clone(), new THREE.MeshBasicMaterial({
        color: 0x2255aa, side: THREE.BackSide,
        transparent: true, opacity: 0.25,
      }));
      outlineMesh.scale.setScalar(1.003);
      mesh.add(outlineMesh);

      scene.add(mesh);
      meshRef.current = mesh;
    } catch (err) {
      console.error('Geometry error:', err);
    }
  }, [params]);

  // ── Camera view switching ──────────────────────────────────────────────────
  useEffect(() => {
    activeViewRef.current = activeView;
    const controls = controlsRef.current;
    if (!controls) return;

    if (ORTHO_VIEWS.has(activeView)) {
      // ── Orthographic plan view ──────────────────────────────────────────
      const orthoCam = orthoCamRef.current;
      const renderer = rendererRef.current;
      if (!orthoCam || !renderer) return;

      // Fit to current board dimensions
      const size = new THREE.Vector2();
      renderer.getSize(size);
      sizeOrthoCam(orthoCam, paramsRef.current, size.x, size.y);

      // Position straight above (top) or below (bottom)
      orthoCam.position.set(0, activeView === 'top' ? 3 : -3, 0);
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
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* View switcher */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 5,
        background: 'rgba(10,15,25,0.88)', padding: '6px 10px',
        borderRadius: 10, border: '1px solid rgba(68,136,204,0.25)',
        backdropFilter: 'blur(8px)',
      }}>
        {Object.entries(VIEW_LABELS).map(([view, label]) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
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

      {/* Context hint */}
      <div style={{
        position: 'absolute', top: 12, right: 14,
        fontSize: 10.5, color: 'rgba(255,255,255,0.22)',
        lineHeight: 1.7, textAlign: 'right',
      }}>
        {ORTHO_VIEWS.has(activeView)
          ? 'Scroll to zoom · Right-drag to pan'
          : 'Drag · Scroll · Right-drag to pan'}
      </div>
    </div>
  );
}
