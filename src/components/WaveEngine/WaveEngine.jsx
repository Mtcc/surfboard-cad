/**
 * WaveEngine.jsx — Wave lifecycle UI
 *
 * Phases: lineup → dropin → surfing → ended
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WaveSceneManager } from './WaveScene.js';
import { WAVE_SPOTS } from './WaveSpotProfiles.js';
import { THEMES, THEME_ORDER } from './themes.js';

const MS_TO_MPH = 2.23694;

export function WaveEngine({ params, volumeL, onClose }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const [currentSpot, setCurrentSpot] = useState('pipeline');
  const [theme, setTheme] = useState('day');
  const [phase, setPhase] = useState('lineup');
  const [rideScore, setRideScore] = useState(null);
  const [boardMatch, setBoardMatch] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // theme toggle
  const handleThemeToggle = useCallback(() => {
    const currentIdx = THEME_ORDER.indexOf(theme);
    const nextIdx = (currentIdx + 1) % THEME_ORDER.length;
    const nextTheme = THEME_ORDER[nextIdx];
    setTheme(nextTheme);
    const mgr = sceneRef.current;
    if (mgr && mgr.setTheme) mgr.setTheme(nextTheme);
  }, [theme]);

  // mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mgr = new WaveSceneManager(el);
    sceneRef.current = mgr;

    mgr.onPhaseChange = (p) => {
      setPhase(p);
      if (p === 'surfing' && mgr.boardState) {
        setLiveStats({
          speed: mgr.boardState.speed * MS_TO_MPH,
          rideTime: mgr.boardState.rideTimeS,
          turnCount: mgr.boardState.turnCount,
          isInBarrel: mgr.boardState.isInBarrel,
          score: mgr.boardState.score || 0,
          specialMeter: mgr.boardState.specialMeter || 0,
        });
      }
      if (p === 'lineup') {
        setRideScore(null);
        setLiveStats(null);
      }
    };

    mgr.onRideEnd = (score) => {
      setRideScore(score);
      setPhase('ended');
    };

    mgr.loadWave('pipeline').then(() => {
      if (params) {
        mgr.setBoard(params, volumeL || 0);
        setBoardMatch(mgr.boardMatch);
      }
      mgr.start();
      if (mgr.setTheme) mgr.setTheme('day');
      setLoading(false);
    }).catch((err) => {
      console.error('[WaveEngine] Load failed:', err);
      setLoading(false);
    });

    const onResize = () => mgr.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      mgr.dispose();
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // board updates
  useEffect(() => {
    const mgr = sceneRef.current;
    if (!mgr || loading || !params) return;
    mgr.setBoard(params, volumeL || 0);
    setBoardMatch(mgr.boardMatch);
  }, [params, volumeL, loading]);

  // spot switch
  const handleSpotChange = useCallback((spotId) => {
    setCurrentSpot(spotId);
    const mgr = sceneRef.current;
    if (!mgr) return;
    if (mgr.waveModel) mgr.switchSpot(spotId);
    else mgr.loadWave(spotId);
    setBoardMatch(mgr.boardMatch);
    setPhase('lineup');
    setRideScore(null);
    setLiveStats(null);
    // re-apply current theme after spot change
    setTheme((t) => {
      if (mgr.setTheme) mgr.setTheme(t);
      return t;
    });
  }, []);

  // SPACE: lineup → dropin, ended → lineup
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      const mgr = sceneRef.current;
      if (!mgr) return;
      if (mgr.phase === 'lineup') {
        mgr.startPaddle();
        setPhase('dropin');
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

  const spot = WAVE_SPOTS[currentSpot];
  const isLongboard = params
    ? (params.lengthFt * 12 + (params.lengthIn_extra || 0)) * 0.0254 > 2.4
    : false;

  const showSpotSelector = phase === 'lineup' || phase === 'ended';
  const showSpotInfo = phase === 'lineup';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: THEMES[theme].bgColor, display: 'flex', flexDirection: 'column',
    }}>
      {/* header */}
      <div style={{
        height: 48, background: 'rgba(0,0,0,0.6)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
      }}>
        <button onClick={onClose} style={btnStyle}>Back</button>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Surf Mode</span>
        <div style={{ flex: 1 }} />
        <button onClick={handleThemeToggle} style={{
          ...btnStyle,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {theme === 'day' ? '☀' : theme === 'sunset' ? '🌅' : '🌙'}
          {THEMES[theme].name}
        </button>
        {showSpotSelector && (
          <select
            value={currentSpot}
            onChange={(e) => handleSpotChange(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6, padding: '6px 12px', color: '#fff', fontSize: 12,
            }}
          >
            {Object.entries(WAVE_SPOTS).map(([id, s]) => (
              <option key={id} value={id} style={{ background: '#1a1a2e' }}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* viewport */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 18,
          }}>
            Loading wave...
          </div>
        )}

        {/* ── LINEUP: spot info + board match + "Press SPACE" ───── */}
        {showSpotInfo && !loading && (
          <div style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            padding: '16px 20px', borderRadius: 10, color: '#fff', maxWidth: 300,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{spot.name}</div>
            <div style={{ fontSize: 12, opacity: 0.5 }}>{spot.region}</div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>{spot.description}</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.4 }}>
              {spot.waveHeightFt}ft face &middot; {spot.breakType}
            </div>
            {boardMatch && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 6,
                background: boardMatch.score > 0.65
                  ? 'rgba(0,200,100,0.2)' : 'rgba(255,100,50,0.2)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  Board Match: {Math.round(boardMatch.score * 100)}%
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{boardMatch.rating}</div>
                {boardMatch.penalties.map((p, i) => (
                  <div key={i} style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{p}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === 'lineup' && !loading && params && (
          <div style={{
            position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 22, fontWeight: 800, color: '#fff',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              animation: 'wePulse 1.5s infinite',
            }}>
              Press SPACE to drop in
            </div>
            <style>{`@keyframes wePulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
          </div>
        )}

        {phase === 'lineup' && !loading && !params && (
          <div style={{
            position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
            textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14,
          }}>
            Design a board first to surf it here
          </div>
        )}

        {/* ── DROPIN: flash ────────────────────────────────────── */}
        {phase === 'dropin' && (
          <div style={{
            position: 'absolute', top: '35%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 56, fontWeight: 900, color: '#fff',
            textShadow: '0 4px 20px rgba(0,0,0,0.7)',
            animation: 'weDropFlash 1.5s ease-out forwards',
          }}>
            DROP IN!
            <style>{`@keyframes weDropFlash { 0% { opacity:1; transform:translate(-50%,-50%) scale(1) } 100% { opacity:0; transform:translate(-50%,-50%) scale(1.4) } }`}</style>
          </div>
        )}

        {/* ── SURFING: KSPS-style HUD ────────────────────────── */}
        {phase === 'surfing' && liveStats && (
          <>
            {/* score bar — top right, KSPS style */}
            <div style={{
              position: 'absolute', top: 16, right: 16,
              background: 'linear-gradient(180deg, rgba(80,100,120,0.8) 0%, rgba(40,55,70,0.9) 100%)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 25, padding: '8px 20px 8px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                fontSize: 28, fontWeight: 900, color: '#4adba2',
                fontFamily: 'monospace', letterSpacing: 2,
                textShadow: '0 0 10px rgba(74,219,162,0.5)',
              }}>
                {Math.round(liveStats.score || 0)}
              </div>
              <div style={{
                width: 100, height: 8, background: 'rgba(0,0,0,0.4)',
                borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, (liveStats.specialMeter || 0) * 100)}%`,
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, #22cc66, #44ff88)',
                }} />
              </div>
            </div>

            {/* wave height + time — bottom right */}
            <div style={{
              position: 'absolute', bottom: 60, right: 20,
              textAlign: 'right',
            }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: '#4adba2',
                fontFamily: 'monospace',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}>
                {liveStats.rideTime.toFixed(1)}s
              </div>
            </div>

            {/* speed — bottom left */}
            <div style={{
              position: 'absolute', bottom: 60, left: 20,
            }}>
              <div style={{
                fontSize: 18, fontWeight: 800, color: '#fff',
                fontFamily: 'monospace',
                textShadow: '0 2px 6px rgba(0,0,0,0.5)',
              }}>
                {liveStats.speed.toFixed(1)} <span style={{ fontSize: 11, opacity: 0.5 }}>mph</span>
              </div>
            </div>

            {/* barrel indicator */}
            {liveStats.isInBarrel && (
              <div style={{
                position: 'absolute', top: '40%', left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 20, fontWeight: 800, color: '#00ccff',
                textShadow: '0 0 15px rgba(0,200,255,0.5)',
                animation: 'wePulse 1s infinite',
              }}>
                IN THE BARREL
              </div>
            )}

            {/* controls hint — bottom center */}
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 6,
              color: '#fff', fontSize: 10, display: 'flex', gap: 12, opacity: 0.35,
            }}>
              <span>&larr;&rarr; Turn</span>
              <span>&uarr;&darr; Weight</span>
            </div>
          </>
        )}

        {/* ── ENDED: score ─────────────────────────────────────── */}
        {phase === 'ended' && rideScore && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'rgba(0,0,0,0.9)', borderRadius: 16,
              padding: '30px 50px', textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                {rideScore.reason}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 20 }}>
                Ride Complete
              </div>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#4adba2', marginBottom: 20 }}>
                {rideScore.totalScore.toFixed(1)}
                <span style={{ fontSize: 20, opacity: 0.5 }}>/10</span>
              </div>
              <div style={{ display: 'flex', gap: 30, marginBottom: 24, justifyContent: 'center' }}>
                <EndStat label="Time" value={`${rideScore.rideLength.toFixed(1)}s`} />
                <EndStat label="Max Speed" value={`${rideScore.maxSpeedMPH.toFixed(1)} mph`} color="#4adba2" />
                <EndStat label="Turns" value={rideScore.turnCount} color="#ffd166" />
                <EndStat label="Style" value={`${Math.round(rideScore.styleScore * 100)}%`} color="#ef476f" />
              </div>
              {rideScore.maneuvers.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>
                  {rideScore.maneuvers.join(', ')}
                </div>
              )}
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>
                Press SPACE for another wave
              </div>
            </div>
          </div>
        )}

        {/* ── SPOT SELECTOR (bottom bar) ───────────────────────── */}
        {showSpotSelector && !loading && (
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 6, background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)', padding: '10px 14px', borderRadius: 10,
            flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {Object.entries(WAVE_SPOTS).map(([id, s]) => (
              <button
                key={id}
                onClick={() => handleSpotChange(id)}
                style={{
                  padding: '6px 14px',
                  background: currentSpot === id ? s.shallowColor : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: currentSpot === id ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12,
                  fontWeight: currentSpot === id ? 600 : 400,
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, padding: '8px 16px',
  color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};

function StatBlock({ label, value, color = '#fff' }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, opacity: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EndStat({ label, value, color = '#fff' }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
