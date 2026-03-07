import { useState, useMemo } from 'react';
import Viewport3D from './components/Viewport3D';
import ParameterPanel from './components/ParameterPanel';
import InfoPanel from './components/InfoPanel';
import { TEMPLATES } from './data/templates';
import { calculateVolume } from './geometry/surfboardGeometry';

// Default to performance shortboard
const DEFAULT_PARAMS = {
  ...TEMPLATES.performanceShortboard.params,
  boardType: 'performanceShortboard',
  lengthIn: TEMPLATES.performanceShortboard.params.lengthFt * 12 + TEMPLATES.performanceShortboard.params.lengthIn_extra,
};

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [activeView, setActiveView] = useState('perspective');

  const handleParamChange = (newParams) => {
    const lengthIn = newParams.lengthFt * 12 + (newParams.lengthIn_extra || 0);
    setParams({ ...newParams, lengthIn });
  };

  // Derived measurements for header bar
  const volume = useMemo(() => {
    try {
      return calculateVolume(params);
    } catch {
      return 0;
    }
  }, [params]);

  const lengthLabel = `${params.lengthFt}'${(params.lengthIn_extra || 0).toString()}"`;

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0a0f1a',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        height: 48,
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        flexShrink: 0,
        gap: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏄</span>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>Surfboard CAD</span>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            background: 'rgba(68,136,204,0.25)',
            color: '#4488cc',
            padding: '2px 7px',
            borderRadius: 4,
            letterSpacing: '0.05em',
          }}>BETA</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[
            { label: 'Length', value: lengthLabel },
            { label: 'Width', value: `${params.widthIn}"` },
            { label: 'Thickness', value: `${params.thicknessIn}"` },
            { label: 'Volume', value: `${volume.toFixed(1)}L`, highlight: true },
          ].map(({ label, value, highlight }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'monospace',
                color: highlight ? '#4adba2' : 'rgba(255,255,255,0.9)',
              }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Save / Load */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const json = JSON.stringify(params, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'surfboard_design.json';
              a.click();
            }}
            style={btnStyle}
          >
            Save
          </button>
          <label style={{ ...btnStyle, cursor: 'pointer' }}>
            Load
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = evt => {
                  try {
                    const data = JSON.parse(evt.target.result);
                    const p = data.params || data;
                    handleParamChange(p);
                  } catch {
                    alert('Invalid design file');
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </header>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel - parameters */}
        <div style={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 14px 6px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.3)',
          }}>
            Parameters
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ParameterPanel params={params} onChange={handleParamChange} />
          </div>
        </div>

        {/* Center - 3D viewport */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Viewport3D
            params={params}
            activeView={activeView}
            onViewChange={setActiveView}
          />
        </div>

        {/* Right panel - templates, specs, export */}
        <div style={{
          width: 280,
          flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <InfoPanel params={params} onChange={handleParamChange} />
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '5px 14px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.07)',
  color: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
};
