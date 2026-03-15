/**
 * ParameterPanel — Left sidebar with all surfboard controls
 * Features: validation indicators (green/yellow/red), auto-suggest,
 * real-world range clamping, collapsible sections.
 */

import { useState, useCallback } from 'react';
import { validateParam, detectBoardType, autoSuggest, BOARD_CONSTRAINTS } from '../data/constraints';
import { REFERENCE_OUTLINES, lerpRefCurve } from '../geometry/surfboardGeometry';

// ─── Status indicator dot ────────────────────────────────────────────────────
const STATUS_COLOR = {
  ok:   '#4adba2',
  warn: '#f0c040',
  error:'#ff5555',
};

function StatusDot({ status, message }) {
  const [hovered, setHovered] = useState(false);
  if (status === 'ok') return null;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 7, height: 7, borderRadius: '50%',
          background: STATUS_COLOR[status],
          marginLeft: 5, cursor: 'help', flexShrink: 0,
          boxShadow: `0 0 6px ${STATUS_COLOR[status]}88`,
        }}
      />
      {hovered && message && (
        <div style={{
          position: 'absolute', bottom: '120%', left: 0,
          background: '#1a2535',
          border: `1px solid ${STATUS_COLOR[status]}55`,
          borderRadius: 6, padding: '6px 9px',
          fontSize: 11, color: 'rgba(255,255,255,0.82)',
          whiteSpace: 'nowrap', zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          maxWidth: 240, lineHeight: 1.45,
          minWidth: 160,
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

// ─── Slider control ──────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, unit, onChange, displayValue, status, statusMsg, disabled }) {
  const display = displayValue !== undefined ? displayValue : `${value}${unit || ''}`;
  const trackColor = status === 'error' ? '#ff555540'
                   : status === 'warn'  ? '#f0c04030'
                   : 'rgba(68,136,204,0.15)';
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: disabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.72)' }}>
            {label}
          </span>
          <StatusDot status={status || 'ok'} message={statusMsg} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
          color: STATUS_COLOR[status] || '#4488cc',
        }}>
          {display}
        </span>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="range"
          min={min} max={max} step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={e => !disabled && onChange(parseFloat(e.target.value))}
          disabled={disabled}
          style={{
            width: '100%',
            accentColor: STATUS_COLOR[status] || '#4488cc',
            opacity: disabled ? 0.4 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        />
      </div>
    </div>
  );
}

// ─── Select control ──────────────────────────────────────────────────────────
function Select({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ marginBottom: 3 }}>
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)' }}>{label}</span>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.14)', borderRadius: 5,
          color: '#fff', padding: '5px 8px', fontSize: 12, fontFamily: 'inherit',
        }}
      >
        {options.map(([val, lbl]) => (
          <option key={val} value={val} style={{ background: '#0d1520' }}>{lbl}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Collapsible section ─────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.09em', color: '#4488cc',
          borderBottom: '1px solid rgba(68,136,204,0.2)',
          paddingBottom: 6, marginBottom: open ? 10 : 0,
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>{title}{badge && <span style={{ marginLeft: 6, color: badge.color, fontSize: 10 }}>{badge.text}</span>}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

// ─── Auto-suggest banner ─────────────────────────────────────────────────────
function SuggestBanner({ suggestions, onApply, onDismiss }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={{
      background: 'rgba(74,219,162,0.08)',
      border: '1px solid rgba(74,219,162,0.25)',
      borderRadius: 7, padding: '8px 10px', marginBottom: 10,
    }}>
      <div style={{ fontSize: 10.5, color: '#4adba2', fontWeight: 700, marginBottom: 5 }}>
        Suggested adjustments:
      </div>
      {suggestions.map((s, i) => (
        <div key={i} style={{
          fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{s.key}: <strong style={{ color: '#4adba2' }}>{s.value}"</strong></span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.reason}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
        <button onClick={onApply} style={{
          padding: '3px 10px', borderRadius: 5, border: 'none',
          background: '#4adba2', color: '#0d1520', fontSize: 11,
          fontWeight: 700, cursor: 'pointer',
        }}>Apply All</button>
        <button onClick={onDismiss} style={{
          padding: '3px 8px', borderRadius: 5,
          border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
          color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer',
        }}>Dismiss</button>
      </div>
    </div>
  );
}

// ─── Board type indicator ─────────────────────────────────────────────────────
function BoardTypeTag({ boardType, constraints }) {
  if (!constraints) return null;
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: '#4488cc',
      background: 'rgba(68,136,204,0.12)',
      border: '1px solid rgba(68,136,204,0.25)',
      borderRadius: 5, padding: '3px 8px', display: 'inline-block',
      marginBottom: 12,
    }}>
      {constraints.label || boardType}
    </div>
  );
}

// Parameter → ideal view mapping
const PARAM_VIEW_MAP = {
  // Rocker params → side view
  noseRockerIn: 'side',
  tailRockerIn: 'side',
  rockerType: 'side',
  entryRocker: 'side',
  exitRocker: 'side',

  // Concave zones → concave view (underneath)
  concaveZones: 'concave',

  // Rail params → rails view (angled)
  railType: 'rails',
  railApex: 'rails',

  // Thickness params → side or rails view
  noseThicknessIn: 'side',
  centerThicknessIn: 'rails',
  tailThicknessIn: 'side',
  deckDome: 'rails',

  // Tail shape → tail view
  tailShape: 'tail',
  swallowDepthIn: 'tail',

  // Nose shape → nose view
  noseShape: 'nose',

  // Outline params → top view
  widePointIn: 'top',
  widePointWidthIn: 'top',
  noseWidth1: 'top',
  noseWidth3: 'top',
  noseWidth6: 'top',
  noseWidth12: 'top',
  noseWidth18: 'top',
  noseWidth24: 'top',
  tailWidth1: 'top',
  tailWidth3: 'top',
  tailWidth6: 'top',
  tailWidth12: 'top',
  tailWidth18: 'top',
  tailWidth24: 'top',
};

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function ParameterPanel({ params, onChange, onViewChange }) {
  const [pendingSuggestions, setPendingSuggestions] = useState([]);

  const L = params.lengthFt * 12 + (params.lengthIn_extra || 0);
  const boardType = detectBoardType(params);
  const C = BOARD_CONSTRAINTS[boardType];

  // Change a param, auto-switch view, and check for suggestions
  const set = useCallback((key, value) => {
    const next = { ...params, [key]: value };
    next.lengthIn = next.lengthFt * 12 + (next.lengthIn_extra || 0);
    if (key === 'thicknessIn') next.centerThicknessIn = value;
    onChange(next);

    // Auto-switch to ideal view for this parameter
    if (onViewChange && PARAM_VIEW_MAP[key]) {
      onViewChange(PARAM_VIEW_MAP[key]);
    }

    // Auto-suggest related param changes
    const suggestions = autoSuggest(boardType, key, value, next);
    if (suggestions.length > 0) setPendingSuggestions(suggestions);
  }, [params, onChange, onViewChange, boardType]);

  // Alias for outline params (no longer needs special handling)
  const setOutline = set;

  const applyAll = () => {
    const next = { ...params };
    pendingSuggestions.forEach(s => { next[s.key] = s.value; });
    next.lengthIn = next.lengthFt * 12 + (next.lengthIn_extra || 0);
    onChange(next);
    setPendingSuggestions([]);
  };

  // Validate a param for this board type
  const v = (key, value) => validateParam(boardType, key, value, params);

  const wvWP = v('widePointIn', params.widePointIn);
  const wvNose = v('noseWidthIn', params.noseWidthIn);
  const wvTail = v('tailWidthIn', params.tailWidthIn);
  const wvWidth = v('widthIn', params.widthIn);
  const wvNR = v('noseRockerIn', params.noseRockerIn);
  const wvTR = v('tailRockerIn', params.tailRockerIn);
  const wvThick = v('thicknessIn', params.thicknessIn);

  // Count warnings/errors for section badges
  const outlineBadge = [wvWP, wvNose, wvTail].some(w => w.status === 'error') ? { text: '●', color: '#ff5555' }
                     : [wvWP, wvNose, wvTail].some(w => w.status === 'warn')  ? { text: '●', color: '#f0c040' }
                     : null;

  const formatLength = (ft, extra) => `${ft}'${extra || 0}"`;

  // Wide point position as percentage display
  const wpPct = L > 0 ? (params.widePointIn / L * 100).toFixed(0) : '–';

  // Ideal wide point range for this board type
  const wpIdealRange = C?.widePointPct
    ? `Ideal: ${(C.widePointPct.ideal[0]*100).toFixed(0)}–${(C.widePointPct.ideal[1]*100).toFixed(0)}% from nose`
    : '';

  return (
    <div style={{
      height: '100%', overflowY: 'auto', padding: '14px 13px',
      boxSizing: 'border-box',
    }}>
      <BoardTypeTag boardType={boardType} constraints={C} />

      <SuggestBanner
        suggestions={pendingSuggestions}
        onApply={applyAll}
        onDismiss={() => setPendingSuggestions([])}
      />

      {/* ── CORE DIMENSIONS ─────────────────────────────────────── */}
      <Section title="Core Dimensions">
        <Slider
          label="Length"
          value={L}
          min={60} max={120} step={0.5}
          displayValue={formatLength(params.lengthFt, params.lengthIn_extra)}
          onChange={v => {
            const ft = Math.floor(v / 12);
            const extra = Math.round((v % 12) * 2) / 2;
            onChange({ ...params, lengthFt: ft, lengthIn_extra: extra, lengthIn: v });
          }}
        />
        <Slider
          label="Width"
          value={params.widthIn}
          min={16} max={26} step={0.01}
          displayValue={`${params.widthIn.toFixed(2)}"`}
          status={wvWidth.status}
          statusMsg={wvWidth.message}
          onChange={v => set('widthIn', v)}
        />
        <Slider
          label="Thickness"
          value={params.thicknessIn}
          min={1.75} max={4} step={0.01}
          displayValue={`${params.thicknessIn.toFixed(2)}"`}
          status={wvThick.status}
          statusMsg={wvThick.message}
          onChange={v => set('thicknessIn', v)}
        />
      </Section>

      {/* ── OUTLINE SHAPE ───────────────────────────────────────── */}
      <Section title="Outline Shape" badge={outlineBadge}>
        <Slider
          label="Wide Point"
          value={params.widePointIn}
          min={8} max={Math.max(L - 14, 20)}
          step={0.01}
          displayValue={`${params.widePointIn.toFixed(2)}" (${wpPct}% from nose)`}
          status={wvWP.status}
          statusMsg={wvWP.message || wpIdealRange}
          onChange={v => setOutline('widePointIn', v)}
        />
        <Slider
          label="Max Width"
          value={params.widePointWidthIn}
          min={16} max={26} step={0.01}
          displayValue={`${params.widePointWidthIn.toFixed(2)}"`}
          onChange={v => setOutline('widePointWidthIn', v)}
        />
      </Section>

      {/* ── OUTLINE STATIONS ────────────────────────────────────── */}
      <Section title="Outline Stations" defaultOpen={false}>
        <div style={{
          fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 8, lineHeight: 1.5,
        }}>
          Width at stations from nose and tail. Defaults from reference curve for this board type.
        </div>

        {/* Nose stations */}
        <div style={{ fontSize: 10, color: '#4488cc', fontWeight: 600, marginBottom: 6, marginTop: 8 }}>
          FROM NOSE
        </div>
        {[1, 3, 6, 12, 18, 24].map(station => {
          const key = `noseWidth${station}`;
          const refCurve = REFERENCE_OUTLINES[boardType] || REFERENCE_OUTLINES.midLength;
          const refVal = lerpRefCurve(refCurve, station / L) * params.widePointWidthIn;
          const val = params[key] ?? refVal;
          return (
            <Slider
              key={key}
              label={`${station}"`}
              value={val}
              min={2} max={params.widePointWidthIn} step={0.01}
              displayValue={`${val.toFixed(2)}"`}
              onChange={v => setOutline(key, v)}
            />
          );
        })}

        {/* Tail stations — 1/3/6" are inside the tail curve zone so only 12/18/24 are shown */}
        <div style={{ fontSize: 10, color: '#44aa88', fontWeight: 600, marginBottom: 6, marginTop: 12 }}>
          FROM TAIL
        </div>
        {[12, 18, 24].map(station => {
          const refCurve = REFERENCE_OUTLINES[boardType] || REFERENCE_OUTLINES.midLength;
          const refVal = lerpRefCurve(refCurve, (L - station) / L) * params.widePointWidthIn;
          // station 12 maps to tailWidthIn (what the geometry reads for tail curve scaling)
          const key = station === 12 ? 'tailWidthIn' : `tailWidth${station}`;
          const val = params[key] ?? refVal;
          return (
            <Slider
              key={key}
              label={`${station}"`}
              value={val}
              min={2} max={params.widePointWidthIn} step={0.01}
              displayValue={`${val.toFixed(2)}"`}
              onChange={v => setOutline(key, v)}
            />
          );
        })}
      </Section>

      {/* ── ROCKER ──────────────────────────────────────────────── */}
      <Section title="Rocker" defaultOpen={false}>
        <div style={{
          fontSize: 10.5, color: 'rgba(255,255,255,0.32)', marginBottom: 9, lineHeight: 1.5,
        }}>
          Rocker = height of nose/tail tip above a flat reference, measured upright.
        </div>
        <Slider
          label="Nose rocker"
          value={params.noseRockerIn}
          min={0.5} max={8} step={0.01}
          displayValue={`${params.noseRockerIn.toFixed(2)}"`}
          status={wvNR.status}
          statusMsg={wvNR.message}
          onChange={v => set('noseRockerIn', v)}
        />
        <Slider
          label="Tail rocker"
          value={params.tailRockerIn}
          min={0.5} max={5} step={0.01}
          displayValue={`${params.tailRockerIn.toFixed(2)}"`}
          status={wvTR.status}
          statusMsg={wvTR.message}
          onChange={v => set('tailRockerIn', v)}
        />
        <Select
          label="Rocker Type"
          value={params.rockerType || 'continuous'}
          options={[['continuous','Continuous — smooth curve, responsive'],['staged','Staged — flat middle, flip & kick']]}
          onChange={v => set('rockerType', v)}
        />
        <Select
          label="Entry Curve"
          value={params.entryRocker}
          options={[['flat','Flat — late flip, speed'],['moderate','Moderate — balanced'],['aggressive','Aggressive — early flip, steep drops']]}
          onChange={v => set('entryRocker', v)}
        />
        <Select
          label="Exit Curve"
          value={params.exitRocker}
          options={[['flat','Flat — late kick, drive'],['moderate','Moderate — balanced'],['aggressive','Aggressive — early kick, pivoty']]}
          onChange={v => set('exitRocker', v)}
        />
      </Section>

      {/* ── FOIL & THICKNESS ────────────────────────────────────── */}
      <Section title="Foil & Thickness" defaultOpen={false}>
        <Slider
          label="Nose Thickness"
          value={params.noseThicknessIn}
          min={0.5} max={2.75} step={0.01}
          displayValue={`${params.noseThicknessIn.toFixed(2)}"`}
          onChange={v => set('noseThicknessIn', v)}
        />
        <Slider
          label="Center Thickness"
          value={params.centerThicknessIn}
          min={1.5} max={4.5} step={0.01}
          displayValue={`${params.centerThicknessIn.toFixed(2)}"`}
          onChange={v => set('centerThicknessIn', v)}
        />
        <Slider
          label="Tail Thickness"
          value={params.tailThicknessIn}
          min={0.5} max={3.25} step={0.01}
          displayValue={`${params.tailThicknessIn.toFixed(2)}"`}
          onChange={v => set('tailThicknessIn', v)}
        />
        <Select
          label="Deck dome"
          value={params.deckDome}
          options={[['flat','Flat'],['low','Low dome'],['medium','Medium dome'],['high','High dome']]}
          onChange={v => set('deckDome', v)}
        />
      </Section>

      {/* ── BOTTOM CONTOUR ──────────────────────────────────────────── */}
      <Section title="Bottom Contour" defaultOpen={false}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 10, lineHeight: 1.5 }}>
          Define concave zones directly in the 3D view. Click the button below to switch to concave view and edit zones.
        </div>
        <button
          onClick={() => onViewChange && onViewChange('concave')}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 6,
            border: '1px solid rgba(68,136,204,0.4)',
            background: 'linear-gradient(135deg, rgba(68,136,204,0.2), rgba(68,136,204,0.1))',
            color: '#4488cc',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>🎨</span>
          Edit Concave Zones in 3D View
        </button>
      </Section>

      {/* ── RAILS ────────────────────────────────────────────────── */}
      <Section title="Rails" defaultOpen={false}>
        <Select
          label="Rail type"
          value={params.railType}
          options={[
            ['soft',   'Soft — forgiving, good for small surf'],
            ['50/50',  '50/50 — balanced, classic'],
            ['down',   'Down — more hold in steep waves'],
            ['pinched','Pinched — big wave performance'],
            ['tucked', 'Tucked under — sharp release, speed'],
          ]}
          onChange={v => set('railType', v)}
        />
        <Select
          label="Rail apex height"
          value={params.railApex}
          options={[['high','High — soft/longboard'],['medium','Medium — all-round'],['low','Low — performance/gun']]}
          onChange={v => set('railApex', v)}
        />
      </Section>

      {/* ── NOSE, TAIL & FINS ─────────────────────────────────────── */}
      <Section title="Nose, Tail & Fins" defaultOpen={false}>
        <Select
          label="Nose shape"
          value={params.noseShape || 'round'}
          options={[
            ['round',       'Round — stable, easy paddle, forgiving'],
            ['pointedRound','Pointed Round — balanced, versatile'],
            ['pointed',     'Pointed — precision, high performance'],
            ['asymmetrical','Asymmetrical — custom, experimental'],
          ]}
          onChange={v => set('noseShape', v)}
        />
        <Select
          label="Tail shape"
          value={params.tailShape}
          options={[
            ['squash',       'Squash — most common, versatile'],
            ['roundPin',     'Round Pin — all-rounder, step-ups'],
            ['round',        'Round — smooth, flowing turns'],
            ['pin',          'Pin — big wave hold'],
            ['square',       'Square — longboard classic'],
            ['roundedSquare','Rounded Square — blend of square & squash'],
            ['swallow',      'Swallow — drive + release in small surf'],
            ['fish',         'Fish Tail — retro twin-fin, wide & loose'],
            ['diamond',      'Diamond — angular, specialty'],
            ['bat',          'Bat — aggressive wings, loose'],
            ['wingedSwallow','Winged Swallow — swallow with wing bumps'],
            ['wingedSquash', 'Winged Squash — squash with wing bumps'],
            ['wingedRound',  'Winged Round — round with wing bumps'],
            ['roundedDiamond','Rounded Diamond — softer diamond'],
          ]}
          onChange={v => set('tailShape', v)}
        />
        {['swallow', 'fish', 'wingedSwallow'].includes(params.tailShape) && (
          <Slider
            label="Swallow Depth"
            value={params.swallowDepthIn || 2}
            min={1} max={5} step={0.01}
            displayValue={`${(params.swallowDepthIn || 2).toFixed(2)}"`}
            status={v('swallowDepthIn', params.swallowDepthIn).status}
            statusMsg={v('swallowDepthIn', params.swallowDepthIn).message}
            onChange={val => set('swallowDepthIn', val)}
          />
        )}
        <Select
          label="Fin configuration"
          value={params.finConfig}
          options={[
            ['single', 'Single fin'],
            ['twin',   'Twin fin'],
            ['thruster','Thruster (3-fin)'],
            ['quad',   'Quad'],
            ['2+1',    '2+1'],
            ['5fin',   '5-Fin'],
          ]}
          onChange={v => set('finConfig', v)}
        />
      </Section>

      {/* ── CONSTRAINT GUIDE ─────────────────────────────────────── */}
      {C && (
        <Section title="Design Guide" defaultOpen={false}>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>
            <div><span style={{ color: 'rgba(255,255,255,0.55)' }}>Board type:</span> {C.label}</div>
            <div><span style={{ color: 'rgba(255,255,255,0.55)' }}>Length range:</span> {Math.floor(C.lengthIn.ideal[0]/12)}'{C.lengthIn.ideal[0]%12}" – {Math.floor(C.lengthIn.ideal[1]/12)}'{C.lengthIn.ideal[1]%12}"</div>
            <div><span style={{ color: 'rgba(255,255,255,0.55)' }}>Width range:</span> {C.widthIn.ideal[0]}–{C.widthIn.ideal[1]}"</div>
            <div><span style={{ color: 'rgba(255,255,255,0.55)' }}>Wide point:</span> {(C.widePointPct.ideal[0]*100).toFixed(0)}–{(C.widePointPct.ideal[1]*100).toFixed(0)}% from nose</div>
            <div><span style={{ color: 'rgba(255,255,255,0.55)' }}>Nose rocker:</span> {C.noseRockerIn.ideal[0]}–{C.noseRockerIn.ideal[1]}"</div>
            <div><span style={{ color: 'rgba(255,255,255,0.55)' }}>Tail rocker:</span> {C.tailRockerIn.ideal[0]}–{C.tailRockerIn.ideal[1]}"</div>
            <div><span style={{ color: 'rgba(255,255,255,0.55)' }}>Volume:</span> {C.volumeL.ideal[0]}–{C.volumeL.ideal[1]}L</div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, display: 'flex', gap: 10 }}>
            <span><span style={{ color: '#4adba2' }}>●</span> Ideal</span>
            <span><span style={{ color: '#f0c040' }}>●</span> Unusual</span>
            <span><span style={{ color: '#ff5555' }}>●</span> Out of range</span>
          </div>
        </Section>
      )}
    </div>
  );
}
