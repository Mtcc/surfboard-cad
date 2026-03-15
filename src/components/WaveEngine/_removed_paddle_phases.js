/**
 * REMOVED PADDLE/LINEUP PHASES — saved for future use
 *
 * These were the lineup idle animation, paddle sequence (wave approaching,
 * surfer turning to check, turning back, paddling), and the swell/jacking
 * UI phases. Can be re-integrated into WaveScene.js and WaveEngine.jsx.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// WaveScene.js — _resetToLineup (original version with wave far away)
// ═══════════════════════════════════════════════════════════════════════════════

/*
_resetToLineup() {
  this._setPhase('lineup');
  this.rideScore = null;
  this.heightFactor = 0;
  this.boardX = 0;
  this.boardZ = 0;
  if (this.cleanupControls) { this.cleanupControls(); this.cleanupControls = null; }

  // wave at FULL HEIGHT, far away — already formed, will approach
  if (this.waveFaceMesh) {
    setWaveHeightFactor(this.waveFaceMesh.geometry, 1);
    this.waveFaceMesh.visible = true;
    this.waveFaceMesh.position.x = -60; // far out to sea
  }
  if (this.barrelMesh) {
    this.barrelMesh.visible = true;
    this.barrelMesh.position.x = -60;
  }
  this.heightFactor = 1;

  // board on flat water, facing shore
  if (this.surfboardMesh) {
    this.surfboardMesh.visible = true;
    this.surfboardMesh.position.set(0, 0.05, 0);
    this.surfboardMesh.rotation.set(0, 0, 0);
  }

  // camera: shore side, water level, looking toward ocean
  this.camera.position.set(6, 1.2, 4);
  this.camera.lookAt(-10, 0.5, 0);
}
*/

// ═══════════════════════════════════════════════════════════════════════════════
// WaveScene.js — startPaddle (original version that triggered paddle phase)
// ═══════════════════════════════════════════════════════════════════════════════

/*
startPaddle() {
  if (this.phase !== 'lineup' || !this.surfboardMesh) return;
  // wave starts far out, board is at x=0 on flat water
  if (this.waveFaceMesh) this.waveFaceMesh.position.x = -60;
  if (this.barrelMesh) this.barrelMesh.position.x = -60;
  this._setPhase('paddle');
}
*/

// ═══════════════════════════════════════════════════════════════════════════════
// WaveScene.js — _phaseLineup (idle bobbing animation)
// ═══════════════════════════════════════════════════════════════════════════════

/*
_phaseLineup(time) {
  if (this.surfboardMesh) {
    this.surfboardMesh.position.y = 0.05 + Math.sin(time * 2) * 0.05;
    this.surfboardMesh.rotation.z = Math.sin(time * 1.3) * 0.02;
  }
  this.camera.position.y = 1.2 + Math.sin(time * 0.5) * 0.08;
}
*/

// ═══════════════════════════════════════════════════════════════════════════════
// WaveScene.js — _phasePaddle (wave approaches, surfer turns and paddles)
// ═══════════════════════════════════════════════════════════════════════════════

/*
_phasePaddle() {
  const dur = 5;
  const t = Math.min(1, this.phaseTimer / dur);

  // wave is ALREADY at full height — it SLIDES toward the surfer
  // starts at x=-60, arrives at x=0 when the face reaches the board
  // the face zone is x=[-3, 3] in the wave mesh, so when mesh.x = 3,
  // the face leading edge (mesh.x + (-3)) = 0 = board position
  const waveStartX = -60;
  const waveArriveX = 3; // face leading edge arrives at board x=0
  const eased = t < 0.3 ? 0 : smoothstepT((t - 0.3) / 0.7); // nothing for first 0.3, then slide in
  const waveX = waveStartX + (waveArriveX - waveStartX) * eased;

  if (this.waveFaceMesh) this.waveFaceMesh.position.x = waveX;
  if (this.barrelMesh) this.barrelMesh.position.x = waveX;
  this._syncFoamToWave();

  // board stays on FLAT WATER the entire time — Y = 0.05, no wave surface tracking
  if (this.surfboardMesh) {
    this.surfboardMesh.position.y = 0.05;

    // KSPS turn: check the wave, turn back, paddle
    if (t < 0.3) {
      // sitting, waiting — facing shore
      this.surfboardMesh.rotation.y = 0;
    } else if (t < 0.45) {
      // turn to look at the approaching wave
      this.surfboardMesh.rotation.y = smoothstepT((t - 0.3) / 0.15) * Math.PI;
    } else if (t < 0.6) {
      // turn back toward shore
      this.surfboardMesh.rotation.y = Math.PI * (1 - smoothstepT((t - 0.45) / 0.15));
    } else {
      // paddle hard toward shore — slight forward movement
      this.surfboardMesh.rotation.y = 0;
      this.surfboardMesh.position.x += 0.5 * (1 / 60); // gentle forward drift
      // paddle rocking
      this.surfboardMesh.rotation.x = Math.sin(this.phaseTimer * 8) * 0.04;
    }
  }

  // camera: shore side, water level, looking toward ocean
  // surfer in the lower foreground, wave wall growing in the background
  if (this.surfboardMesh) {
    const bp = this.surfboardMesh.position;
    const camTarget = new THREE.Vector3(
      bp.x + 5,
      Math.max(1.0, 1.2),
      bp.z + 3,
    );
    this.camera.position.lerp(camTarget, 0.03);
    this.camera.lookAt(bp.x - 10, 1, bp.z);
  }

  if (this.phaseTimer >= dur) this._setPhase('dropin');
}
*/

// ═══════════════════════════════════════════════════════════════════════════════
// WaveScene.js — animation switch (original with lineup + paddle cases)
// ═══════════════════════════════════════════════════════════════════════════════

/*
switch (this.phase) {
  case 'lineup':  this._phaseLineup(time); break;
  case 'paddle':  this._phasePaddle(dt); break;
  case 'dropin':  this._phaseDropIn(dt); break;
  case 'surfing': this._phaseSurfing(dt); break;
  case 'ended':   this._phaseEnded(); break;
}
*/

// ═══════════════════════════════════════════════════════════════════════════════
// WaveEngine.jsx — SPACE handler (original: lineup → paddle with 'swell' phase)
// ═══════════════════════════════════════════════════════════════════════════════

/*
// SPACE: lineup → paddle, ended → lineup
useEffect(() => {
  const onKey = (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    const mgr = sceneRef.current;
    if (!mgr) return;
    if (mgr.phase === 'lineup') {
      mgr.startPaddle();
      setPhase('swell');
    } else if (mgr.phase === 'ended') {
      mgr._resetToLineup();
      setPhase('lineup');
      setRideScore(null);
      setLiveStats(null);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
*/

// ═══════════════════════════════════════════════════════════════════════════════
// WaveEngine.jsx — Swell + Jacking UI overlays
// ═══════════════════════════════════════════════════════════════════════════════

/*
{phase === 'swell' && (
  <div style={{
    position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
    fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
    textShadow: '0 2px 6px rgba(0,0,0,0.5)',
  }}>
    Set approaching...
  </div>
)}

{phase === 'jacking' && (
  <div style={{
    position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
    fontSize: 20, fontWeight: 700, color: '#ffd166',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  }}>
    Paddle! Paddle! Paddle!
  </div>
)}
*/
