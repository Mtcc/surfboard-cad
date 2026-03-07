/**
 * InfoPanel - Right sidebar: Chat AI, Templates, Measurements, Export
 */

import { useState } from 'react';
import { TEMPLATE_LIST } from '../data/templates';
import { calculateVolume } from '../geometry/surfboardGeometry';
import ChatPanel from './ChatPanel';

// Guild Factor lookup: target volume = weight(kg) * GF
const GUILD_FACTORS = {
  beginner:     { lo: 0.60, hi: 0.70, label: 'Beginner' },
  intermediate: { lo: 0.44, hi: 0.52, label: 'Intermediate' },
  advanced:     { lo: 0.38, hi: 0.44, label: 'Advanced' },
  pro:          { lo: 0.34, hi: 0.38, label: 'Pro / Expert' },
};

function GuildFactorWidget({ volume }) {
  const [weightLbs, setWeightLbs] = useState(175);
  const [skill, setSkill] = useState('intermediate');

  const weightKg = weightLbs * 0.4536;
  const gf = GUILD_FACTORS[skill];
  const targetLo = weightKg * gf.lo;
  const targetHi = weightKg * gf.hi;
  const inRange = volume >= targetLo && volume <= targetHi;
  const tooLow  = volume < targetLo;

  return (
    <div style={{
      background: 'rgba(68,136,204,0.07)',
      border: '1px solid rgba(68,136,204,0.22)',
      borderRadius: 10, padding: '11px 13px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4488cc', marginBottom: 9 }}>
        Volume Fit (Guild Factor)
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Weight (lbs)</div>
          <input
            type="number"
            value={weightLbs}
            min={80} max={300} step={5}
            onChange={e => setWeightLbs(Number(e.target.value))}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 5, color: '#fff', padding: '4px 7px',
              fontSize: 12, fontFamily: 'monospace',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Skill</div>
          <select
            value={skill}
            onChange={e => setSkill(e.target.value)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)', borderRadius: 5,
              color: '#fff', padding: '4px 7px', fontSize: 11, fontFamily: 'inherit',
            }}
          >
            {Object.entries(GUILD_FACTORS).map(([k, v]) => (
              <option key={k} value={k} style={{ background: '#0d1520' }}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          Target: <strong style={{ color: '#fff' }}>{targetLo.toFixed(1)}–{targetHi.toFixed(1)}L</strong>
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: inRange ? '#4adba2' : tooLow ? '#ff9933' : '#f0c040',
        }}>
          {inRange ? 'Good fit' : tooLow ? 'Too low (add volume)' : 'A bit high (more advanced)'}
        </span>
      </div>

      {/* Bar */}
      <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'visible' }}>
        {/* Target range band */}
        {(() => {
          const barMax = Math.max(targetHi * 1.3, volume * 1.15, 60);
          const lo = Math.min(targetLo / barMax, 1);
          const hi = Math.min(targetHi / barMax, 1);
          const cur = Math.min(volume / barMax, 1);
          return (
            <>
              <div style={{
                position: 'absolute', top: 0, height: '100%',
                left: `${lo * 100}%`, width: `${(hi - lo) * 100}%`,
                background: 'rgba(74,219,162,0.35)', borderRadius: 3,
              }} />
              <div style={{
                position: 'absolute', top: -3, width: 2, height: 12,
                left: `calc(${cur * 100}% - 1px)`,
                background: inRange ? '#4adba2' : tooLow ? '#ff9933' : '#f0c040',
                borderRadius: 1,
              }} />
            </>
          );
        })()}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)' }}>{weightKg.toFixed(0)}kg × {gf.lo.toFixed(2)}</span>
        <span style={{ fontSize: 9.5, color: '#4488cc' }}>Current: {volume.toFixed(1)}L</span>
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)' }}>GF {gf.hi.toFixed(2)}</span>
      </div>
    </div>
  );
}

function formatLength(ft, extra) {
  return `${ft}'${(extra || 0)}"`;
}

function MeasurementRow({ label, value, unit, highlight }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <span style={{
        fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace',
        color: highlight ? '#4adba2' : 'rgba(255,255,255,0.88)',
      }}>
        {value}{unit && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  );
}

export default function InfoPanel({ params, onChange }) {
  const [activeTab, setActiveTab] = useState('chat');

  const lengthIn = params.lengthFt * 12 + (params.lengthIn_extra || 0);
  const volume = (() => {
    try { return calculateVolume({ ...params, lengthIn }); } catch { return 0; }
  })();

  const tabs = [
    { id: 'chat',         label: 'AI Chat',    icon: '✦' },
    { id: 'templates',    label: 'Templates',  icon: '◈' },
    { id: 'measurements', label: 'Specs',      icon: '◫' },
    { id: 'export',       label: 'Export',     icon: '⬇' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '9px 2px 8px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: activeTab === tab.id ? '#4488cc' : 'rgba(255,255,255,0.35)',
              borderBottom: activeTab === tab.id ? '2px solid #4488cc' : '2px solid transparent',
              marginBottom: -1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {activeTab === 'chat' && (
          <ChatPanel
            params={params}
            onParamChange={onChange}
            apiKey=""
          />
        )}

        {activeTab === 'templates' && (
          <div style={{ overflowY: 'auto', padding: '12px 12px' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12, lineHeight: 1.5 }}>
              Load a starting template and customize from there.
            </p>
            {TEMPLATE_LIST.map(template => (
              <button
                key={template.id}
                onClick={() => onChange({
                  ...template.params,
                  boardType: template.boardType || template.id,
                  lengthIn: template.params.lengthFt * 12 + (template.params.lengthIn_extra || 0),
                })}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 9, padding: '10px 12px', marginBottom: 8,
                  cursor: 'pointer', color: '#fff', transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#4488cc'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 16 }}>{template.emoji}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{template.name}</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.45, marginBottom: 6 }}>
                  {template.description}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    formatLength(template.params.lengthFt, template.params.lengthIn_extra),
                    `${template.params.widthIn}"`,
                    `${template.params.thicknessIn}"`,
                    template.params.tailShape,
                  ].map((v, i) => (
                    <span key={i} style={{ fontSize: 10.5, color: '#4adba2', fontFamily: 'monospace' }}>{v}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'measurements' && (
          <div style={{ overflowY: 'auto', padding: '12px 14px' }}>
            {/* Volume hero */}
            <div style={{
              background: 'rgba(74,219,162,0.09)',
              border: '1px solid rgba(74,219,162,0.28)',
              borderRadius: 10, padding: '12px 14px',
              marginBottom: 16, textAlign: 'center',
            }}>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Estimated Volume
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#4adba2', fontFamily: 'monospace', lineHeight: 1 }}>
                {volume.toFixed(1)}
                <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 4 }}>L</span>
              </div>
            </div>

            <GuildFactorWidget volume={volume} />

            {[
              {
                title: 'Core Dimensions',
                rows: [
                  ['Length', formatLength(params.lengthFt, params.lengthIn_extra), '', true],
                  ['Width', params.widthIn.toFixed(3), '"', true],
                  ['Thickness', params.thicknessIn.toFixed(3), '"', true],
                ],
              },
              {
                title: 'Outline',
                rows: [
                  ['Nose Width (12")', params.noseWidthIn.toFixed(3), '"'],
                  ['Wide Point', `${params.widePointIn}"`, ' from nose'],
                  ['Wide Point Width', params.widePointWidthIn.toFixed(3), '"'],
                  ['Tail Width (12")', params.tailWidthIn.toFixed(3), '"'],
                ],
              },
              {
                title: 'Rocker',
                rows: [
                  ['Nose Rocker', params.noseRockerIn.toFixed(3), '"'],
                  ['Tail Rocker', params.tailRockerIn.toFixed(3), '"'],
                  ['Entry Curve', params.entryRocker],
                  ['Exit Curve', params.exitRocker],
                ],
              },
              {
                title: 'Shape',
                rows: [
                  ['Rails', params.railType],
                  ['Bottom', params.bottomContour],
                  ['Tail Shape', params.tailShape],
                  ['Fin Setup', params.finConfig],
                  ['Deck Dome', params.deckDome],
                ],
              },
            ].map(section => (
              <div key={section.title} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#4488cc', marginBottom: 6,
                }}>
                  {section.title}
                </div>
                {section.rows.map(([label, value, unit, hi]) => (
                  <MeasurementRow key={label} label={label} value={value} unit={unit} highlight={hi} />
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'export' && (
          <div style={{ overflowY: 'auto', padding: '12px 12px' }}>
            <ExportPanel params={{ ...params, lengthIn }} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExportPanel({ params }) {
  const [status, setStatus] = useState('');

  async function doExport(format) {
    setStatus(`Generating ${format.toUpperCase()}...`);
    try {
      const { exportBoard } = await import('../export/exportBoard.js');
      await exportBoard(params, format);
      setStatus(`✓ ${format.toUpperCase()} downloaded`);
    } catch (err) {
      setStatus(`✗ ${err.message}`);
    }
  }

  const options = [
    { id: 'stl',   icon: '📦', label: 'Export STL',    desc: '3D model — CNC preview or scale printing' },
    { id: 'dxf',   icon: '📐', label: 'Export DXF',    desc: '2D outline & rocker — template cutting' },
    { id: 'gcode', icon: '⚙️', label: 'Export G-Code', desc: '3-axis CNC router paths (mm units)' },
    { id: 'json',  icon: '💾', label: 'Save Design',   desc: 'All parameters as JSON' },
  ];

  return (
    <div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 14, lineHeight: 1.5 }}>
        Export your board for manufacturing or archiving.
      </p>
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => doExport(opt.id)}
          style={{
            width: '100%', textAlign: 'left',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 8,
            cursor: 'pointer', color: '#fff',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#4488cc'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span>{opt.icon}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{opt.label}</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{opt.desc}</div>
        </button>
      ))}
      {status && (
        <div style={{
          marginTop: 10, padding: '7px 12px', borderRadius: 7,
          background: status.startsWith('✓') ? 'rgba(74,219,162,0.12)' : 'rgba(255,80,80,0.12)',
          border: `1px solid ${status.startsWith('✓') ? 'rgba(74,219,162,0.35)' : 'rgba(255,80,80,0.35)'}`,
          fontSize: 12, color: status.startsWith('✓') ? '#4adba2' : '#ff6060',
        }}>
          {status}
        </div>
      )}
    </div>
  );
}
