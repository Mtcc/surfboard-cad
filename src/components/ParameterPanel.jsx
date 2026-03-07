/**
 * ParameterPanel — Left sidebar with all surfboard controls
 * Features: validation indicators (green/yellow/red), auto-suggest,
 * real-world range clamping, collapsible sections.
 */

import { useState, useCallback } from 'react';
import { validateParam, detectBoardType, autoSuggest, BOARD_CONSTRAINTS } from '../data/constraints';

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

// ─── Main panel ──────────────────────────────────────────────────────────────
export default function ParameterPanel({ params, onChange }) {
  const [pendingSuggestions, setPendingSuggestions] = useState([]);

  const L = params.lengthFt * 12 + (params.lengthIn_extra || 0);
  const boardType = detectBoardType(params);
  const C = BOARD_CONSTRAINTS[boardType];

  // Change a param and check for auto-suggestions
  const set = useCallback((key, value) => {
    const next = { ...params, [key]: value };
    next.lengthIn = next.lengthFt * 12 + (next.lengthIn_extra || 0);
    if (key === 'thicknessIn') next.centerThicknessIn = value;
    onChange(next);

    // Auto-suggest related param changes
    const suggestions = autoSuggest(boardType, key, value, next);
    if (suggestions.length > 0) setPendingSuggestions(suggestions);
  }, [params, onChange, boardType]);

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
          label="Max Width"
          value={params.widthIn}
          min={16} max={26} step={0.125}
          unit='"'
          status={wvWidth.status}
          statusMsg={wvWidth.message}
          onChange={v => set('widthIn', v)}
        />
        <Slider
          label="Max Thickness"
          value={params.thicknessIn}
          min={1.75} max={4} step={0.0625}
          unit='"'
          status={wvThick.status}
          statusMsg={wvThick.message}
          onChange={v => set('thicknessIn', v)}
        />
      </Section>

      {/* ── OUTLINE SHAPE ───────────────────────────────────────── */}
      <Section title="Outline Shape" badge={outlineBadge}>
        <Slider
          label="Wide Point — position from nose"
          value={params.widePointIn}
          min={8} max={Math.max(L - 14, 20)}
          step={1}
          displayValue={`${params.widePointIn}" (${wpPct}% from nose)`}
          status={wvWP.status}
          statusMsg={wvWP.message || wpIdealRange}
          onChange={v => set('widePointIn', v)}
        />
        <Slider
          label="Wide Point — max width"
          value={params.widePointWidthIn}
          min={16} max={26} step={0.125}
          unit='"'
          onChange={v => set('widePointWidthIn', v)}
        />
        <Slider
          label="Nose Width (at 12\u2033)"
          value={params.noseWidthIn}
          min={8} max={23} step={0.125}
          unit='"'
          status={wvNose.status}
          statusMsg={wvNose.message}
          onChange={v => set('noseWidthIn', v)}
        />
        <Slider
          label="Tail Width (at 12\u2033)"
          value={params.tailWidthIn}
          min={9} max={22} step={0.125}
          unit='"'
          status={wvTail.status}
          statusMsg={wvTail.message}
          onChange={v => set('tailWidthIn', v)}
        />
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
          min={0.5} max={8} step={0.125}
          unit='"'
          status={wvNR.status}
          statusMsg={wvNR.message}
          onChange={v => set('noseRockerIn', v)}
        />
        <Slider
          label="Tail rocker"
          value={params.tailRockerIn}
          min={0.5} max={5} step={0.125}
          unit='"'
          status={wvTR.status}
          statusMsg={wvTR.message}
          onChange={v => set('tailRockerIn', v)}
        />
        <Select
          label="Entry curve (nose)"
          value={params.entryRocker}
          options={[['flat','Flat — speed & trim'],['moderate','Moderate — versatile'],['aggressive','Aggressive — steep drops']]}
          onChange={v => set('entryRocker', v)}
        />
        <Select
          label="Exit curve (tail)"
          value={params.exitRocker}
          options={[['flat','Flat — drive & speed'],['moderate','Moderate — balanced'],['aggressive','Aggressive — pivoty']]}
          onChange={v => set('exitRocker', v)}
        />
      </Section>

      {/* ── FOIL & THICKNESS ────────────────────────────────────── */}
      <Section title="Foil & Thickness" defaultOpen={false}>
        <Slider
          label="Nose thickness (at 12\u2033)"
          value={params.noseThicknessIn}
          min={0.5} max={2.75} step={0.0625}
          unit='"'
          onChange={v => set('noseThicknessIn', v)}
        />
        <Slider
          label="Center thickness"
          value={params.centerThicknessIn}
          min={1.5} max={4.5} step={0.0625}
          unit='"'
          onChange={v => set('centerThicknessIn', v)}
        />
        <Slider
          label="Tail thickness (at 12\u2033)"
          value={params.tailThicknessIn}
          min={0.5} max={3.25} step={0.0625}
          unit='"'
          onChange={v => set('tailThicknessIn', v)}
        />
        <Select
          label="Deck dome"
          value={params.deckDome}
          options={[['flat','Flat'],['low','Low dome'],['medium','Medium dome'],['high','High dome']]}
          onChange={v => set('deckDome', v)}
        />
        <Select
          label="Bottom contour"
          value={params.bottomContour}
          options={[
            ['flat','Flat — drive & speed'],
            ['singleConcave','Single Concave — lift & speed'],
            ['doubleConcave','Double Concave — loose & quick'],
            ['vee','Vee — pivot & control'],
            ['channels','Channels — grip & drive'],
          ]}
          onChange={v => set('bottomContour', v)}
        />
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

      {/* ── TAIL & FINS ──────────────────────────────────────────── */}
      <Section title="Tail & Fins" defaultOpen={false}>
        <Select
          label="Tail shape"
          value={params.tailShape}
          options={[
            ['squash', 'Squash — most versatile'],
            ['round',  'Round — smooth, flowing turns'],
            ['pin',    'Pin — big wave hold'],
            ['swallow','Swallow — drive + pivoty in small surf'],
            ['fish',   'Fish tail — retro, wide & loose'],
            ['square', 'Square — longboard classic'],
            ['diamond','Diamond — specialty'],
          ]}
          onChange={v => set('tailShape', v)}
        />
        {(params.tailShape === 'swallow' || params.tailShape === 'fish') && (
          <Slider
            label="Swallow depth"
            value={params.swallowDepthIn || 2}
            min={1} max={5} step={0.125}
            unit='"'
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
