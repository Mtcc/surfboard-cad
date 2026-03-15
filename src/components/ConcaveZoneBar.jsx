/**
 * ConcaveZoneBar — Horizontal zone bar overlay for the 3D viewport
 *
 * Visual bar showing concave zones from nose to tail.
 * Drag zone edges to resize, click to select.
 */

import { useState, useRef, useEffect } from 'react';
import { CONCAVE_TYPES, DEFAULT_ZONES } from '../data/concavePresets';

export default function ConcaveZoneBar({ zones, onChange, visible }) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedBlend, setSelectedBlend] = useState(null); // index of transition being edited
  const [dragging, setDragging] = useState(null);
  const [dragReorder, setDragReorder] = useState(null); // { fromId, overId }
  const barRef = useRef(null);

  // Refs to avoid stale closures in drag handler
  const zonesRef = useRef(zones);
  const onChangeRef = useRef(onChange);

  const zoneList = zones || DEFAULT_ZONES.performance;

  // Keep refs in sync
  useEffect(() => {
    zonesRef.current = zones;
    onChangeRef.current = onChange;
  });

  // Handle edge dragging for resizing zones
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      const bar = barRef.current;
      if (!bar) return;

      const currentZones = zonesRef.current || DEFAULT_ZONES.performance;

      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

      const { zoneId, edge } = dragging;
      const zoneIdx = currentZones.findIndex(z => z.id === zoneId);
      if (zoneIdx === -1) return;

      const zone = currentZones[zoneIdx];
      if (!zone) return;

      const newZones = [...currentZones];

      if (edge === 'start' && zoneIdx > 0) {
        const prevZone = currentZones[zoneIdx - 1];
        const newStart = Math.max(prevZone.start + 3, Math.min(zone.end - 3, Math.round(pct)));
        newZones[zoneIdx] = { ...zone, start: newStart };
        newZones[zoneIdx - 1] = { ...prevZone, end: newStart };
        onChangeRef.current(newZones);
      } else if (edge === 'end' && zoneIdx < currentZones.length - 1) {
        const nextZone = currentZones[zoneIdx + 1];
        const newEnd = Math.max(zone.start + 3, Math.min(nextZone.end - 3, Math.round(pct)));
        newZones[zoneIdx] = { ...zone, end: newEnd };
        newZones[zoneIdx + 1] = { ...nextZone, start: newEnd };
        onChangeRef.current(newZones);
      }
    };

    const handleUp = () => setDragging(null);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]); // Only depend on dragging state now

  const updateZone = (id, updates) => {
    onChange(zoneList.map(z => z.id === id ? { ...z, ...updates } : z));
  };

  // Add a new zone at the end (splits last zone or adds new section)
  const addZone = () => {
    const newId = Math.max(...zoneList.map(z => z.id), 0) + 1;

    // Find a zone to split - prefer selected, then find largest
    let targetZone = selectedZone
      ? zoneList.find(z => z.id === selectedZone)
      : null;

    if (!targetZone) {
      // Find the largest zone
      targetZone = zoneList.reduce((largest, z) =>
        (z.end - z.start) > (largest.end - largest.start) ? z : largest
      , zoneList[0]);
    }

    if (!targetZone) return;

    const zoneSize = targetZone.end - targetZone.start;
    if (zoneSize < 6) return; // Too small to split

    const midPoint = Math.round(targetZone.start + zoneSize / 2);

    const newZones = zoneList.flatMap(z => {
      if (z.id === targetZone.id) {
        return [
          { ...z, end: midPoint },
          {
            id: newId,
            type: 'singleConcave',
            start: midPoint,
            end: targetZone.end,
            depth: 0.12,
            width: 0.75,
            blend: 5,
          },
        ];
      }
      return z;
    });

    onChange(newZones);
    setSelectedZone(newId);
  };

  // Swap two zones' settings (type, depth, width, blend) - keeps positions
  const swapZones = (fromId, toId) => {
    if (fromId === toId) return;

    const fromZone = zoneList.find(z => z.id === fromId);
    const toZone = zoneList.find(z => z.id === toId);
    if (!fromZone || !toZone) return;

    const newZones = zoneList.map(z => {
      if (z.id === fromId) {
        return {
          ...z,
          type: toZone.type,
          depth: toZone.depth,
          width: toZone.width,
          blend: toZone.blend
        };
      }
      if (z.id === toId) {
        return {
          ...z,
          type: fromZone.type,
          depth: fromZone.depth,
          width: fromZone.width,
          blend: fromZone.blend
        };
      }
      return z;
    });

    onChange(newZones);
  };

  // Remove selected zone
  const removeZone = () => {
    if (!selectedZone || zoneList.length <= 1) return;

    const idx = zoneList.findIndex(z => z.id === selectedZone);
    const zone = zoneList[idx];

    const newZones = zoneList.filter(z => z.id !== selectedZone).map((z, i) => {
      // Expand adjacent zone to fill gap
      if (idx > 0 && i === idx - 1) {
        return { ...z, end: zone.end };
      }
      if (idx === 0 && i === 0) {
        return { ...z, start: zone.start };
      }
      return z;
    });

    onChange(newZones);
    setSelectedZone(null);
  };

  const selectedData = zoneList.find(z => z.id === selectedZone);

  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 70,
      left: 40,
      right: 40,
      background: 'rgba(10,15,25,0.92)',
      borderRadius: 12,
      padding: '12px 16px',
      border: '1px solid rgba(68,136,204,0.3)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4488cc', letterSpacing: '0.05em' }}>
            BOTTOM CONTOUR
          </span>
          <button
            onClick={addZone}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              border: '1px solid rgba(74,219,162,0.5)',
              background: 'rgba(74,219,162,0.15)',
              color: '#4adba2',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Add Zone
          </button>
          {selectedZone && zoneList.length > 1 && (
            <button
              onClick={removeZone}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: '1px solid rgba(255,80,80,0.5)',
                background: 'rgba(255,80,80,0.15)',
                color: '#ff5555',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
          <span>NOSE</span>
          <span style={{ width: 40 }} />
          <span>TAIL</span>
        </div>
      </div>

      {/* Zone bar */}
      <div
        ref={barRef}
        style={{
          position: 'relative',
          height: 40,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
          overflow: 'visible',
          cursor: 'pointer',
        }}
      >
        {zoneList.map((zone, idx) => {
          const typeInfo = CONCAVE_TYPES[zone.type] || CONCAVE_TYPES.flat;
          const isSelected = zone.id === selectedZone;
          const isDragOver = dragReorder?.overId === zone.id && dragReorder?.fromId !== zone.id;
          const isDragging = dragReorder?.fromId === zone.id;
          const width = zone.end - zone.start;

          return (
            <div
              key={zone.id}
              draggable={!isSelected}
              onDragStart={(e) => {
                if (isSelected) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.effectAllowed = 'move';
                setDragReorder({ fromId: zone.id, overId: null });
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragReorder && dragReorder.fromId !== zone.id) {
                  setDragReorder({ ...dragReorder, overId: zone.id });
                }
              }}
              onDragLeave={() => {
                if (dragReorder?.overId === zone.id) {
                  setDragReorder({ ...dragReorder, overId: null });
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragReorder?.fromId && dragReorder.fromId !== zone.id) {
                  swapZones(dragReorder.fromId, zone.id);
                }
                setDragReorder(null);
              }}
              onDragEnd={() => setDragReorder(null)}
              onClick={() => { setSelectedZone(zone.id); setSelectedBlend(null); }}
              style={{
                position: 'absolute',
                left: `${zone.start}%`,
                width: `${width}%`,
                height: '100%',
                background: isDragOver
                  ? `linear-gradient(180deg, #ffffff44, #ffffff22)`
                  : `linear-gradient(180deg, ${typeInfo.color}cc, ${typeInfo.color}66)`,
                borderRadius: idx === 0 ? '8px 0 0 8px' : idx === zoneList.length - 1 ? '0 8px 8px 0' : 0,
                borderLeft: idx > 0 ? '2px solid rgba(0,0,0,0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isDragging ? 0.5 : 1,
                cursor: 'grab',
                flexDirection: 'column',
                transition: 'box-shadow 0.15s',
                boxShadow: isDragOver
                  ? 'inset 0 0 0 3px #4adba2, 0 0 20px rgba(74,219,162,0.5)'
                  : isSelected
                    ? `inset 0 0 0 2px #fff, 0 0 20px ${typeInfo.color}66`
                    : 'none',
                border: isDragOver ? '2px dashed #4adba2' : 'none',
              }}
            >
              {/* Label */}
              <span style={{
                fontSize: width > 20 ? 11 : 9,
                fontWeight: 700,
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              }}>
                {typeInfo.label}
              </span>
              {width > 15 && zone.type !== 'flat' && (
                <span style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: 2,
                }}>
                  {zone.depth.toFixed(2)}"
                </span>
              )}

              {/* Drag handles for resizing */}
              {isSelected && idx > 0 && (
                <div
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDragging({ zoneId: zone.id, edge: 'start' });
                  }}
                  style={{
                    position: 'absolute',
                    left: -8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 16,
                    height: 32,
                    background: dragging?.zoneId === zone.id && dragging?.edge === 'start'
                      ? 'linear-gradient(180deg, #4adba2, #3bc889)'
                      : 'linear-gradient(180deg, #fff, #ddd)',
                    borderRadius: 4,
                    cursor: 'ew-resize',
                    boxShadow: dragging?.zoneId === zone.id && dragging?.edge === 'start'
                      ? '0 0 12px rgba(74,219,162,0.8)'
                      : '0 2px 8px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    border: '1px solid rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ width: 2, height: 16, background: '#888', borderRadius: 1 }} />
                </div>
              )}
              {isSelected && idx < zoneList.length - 1 && (
                <div
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDragging({ zoneId: zone.id, edge: 'end' });
                  }}
                  style={{
                    position: 'absolute',
                    right: -8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 16,
                    height: 32,
                    background: dragging?.zoneId === zone.id && dragging?.edge === 'end'
                      ? 'linear-gradient(180deg, #4adba2, #3bc889)'
                      : 'linear-gradient(180deg, #fff, #ddd)',
                    borderRadius: 4,
                    cursor: 'ew-resize',
                    boxShadow: dragging?.zoneId === zone.id && dragging?.edge === 'end'
                      ? '0 0 12px rgba(74,219,162,0.8)'
                      : '0 2px 8px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    border: '1px solid rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ width: 2, height: 16, background: '#888', borderRadius: 1 }} />
                </div>
              )}
            </div>
          );
        })}

        {/* Blend transition indicators between zones */}
        {zoneList.slice(1).map((zone, i) => {
          const prevZone = zoneList[i];
          const blendPct = zone.blend || 5;
          const isSelected = selectedBlend === i;

          return (
            <div
              key={`blend-${zone.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedZone(null);
                setSelectedBlend(isSelected ? null : i);
              }}
              style={{
                position: 'absolute',
                left: `${zone.start}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 20,
                height: 20,
                background: isSelected
                  ? 'linear-gradient(135deg, #aa88cc, #8866aa)'
                  : 'linear-gradient(135deg, #665588, #443366)',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 700,
                color: '#fff',
                boxShadow: isSelected
                  ? '0 0 12px rgba(170,136,204,0.8), inset 0 0 0 2px #fff'
                  : '0 2px 6px rgba(0,0,0,0.4)',
                zIndex: 15,
                border: '2px solid rgba(0,0,0,0.3)',
              }}
              title={`Blend: ${blendPct}% transition between ${CONCAVE_TYPES[prevZone.type]?.label} and ${CONCAVE_TYPES[zone.type]?.label}`}
            >
              {blendPct}
            </div>
          );
        })}

        {/* Percentage markers */}
        {[25, 50, 75].map(p => (
          <div key={p} style={{
            position: 'absolute',
            left: `${p}%`,
            top: -8,
            transform: 'translateX(-50%)',
            fontSize: 8,
            color: 'rgba(255,255,255,0.3)',
          }}>
            {p}%
          </div>
        ))}
      </div>

      {/* Selected zone editor */}
      {selectedData && (
        <div style={{
          marginTop: 12,
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
        }}>
          {/* Type buttons */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>TYPE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(CONCAVE_TYPES).map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => updateZone(selectedZone, { type })}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: selectedData.type === type ? `2px solid ${info.color}` : '1px solid rgba(255,255,255,0.15)',
                    background: selectedData.type === type ? `${info.color}33` : 'transparent',
                    color: selectedData.type === type ? info.color : 'rgba(255,255,255,0.5)',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* Depth slider */}
          {selectedData.type !== 'flat' && (
            <div style={{ width: 140 }}>
              <div style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>DEPTH</span>
                <span style={{ color: CONCAVE_TYPES[selectedData.type]?.color, fontWeight: 700 }}>
                  {selectedData.depth.toFixed(3)}"
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={selectedData.type === 'vee' ? 0.15 : 0.25}
                step={0.005}
                value={selectedData.depth}
                onChange={(e) => updateZone(selectedZone, { depth: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: CONCAVE_TYPES[selectedData.type]?.color }}
              />
            </div>
          )}

          {/* Width slider */}
          {selectedData.type !== 'flat' && (
            <div style={{ width: 90 }}>
              <div style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 6,
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>WIDTH</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                  {(selectedData.width * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0.3}
                max={1.0}
                step={0.05}
                value={selectedData.width}
                onChange={(e) => updateZone(selectedZone, { width: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#888' }}
              />
            </div>
          )}

        </div>
      )}

      {/* Blend transition editor */}
      {selectedBlend !== null && zoneList[selectedBlend + 1] && (
        <div style={{
          marginTop: 12,
          padding: '10px 14px',
          background: 'rgba(170,136,204,0.1)',
          borderRadius: 8,
          border: '1px solid rgba(170,136,204,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 11, color: '#aa88cc', fontWeight: 700 }}>
              TRANSITION
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              {CONCAVE_TYPES[zoneList[selectedBlend].type]?.label}
              <span style={{ margin: '0 6px', color: '#aa88cc' }}>→</span>
              {CONCAVE_TYPES[zoneList[selectedBlend + 1].type]?.label}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>BLEND</span>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={zoneList[selectedBlend + 1].blend || 5}
                onChange={(e) => updateZone(zoneList[selectedBlend + 1].id, { blend: parseInt(e.target.value) })}
                style={{ width: 120, accentColor: '#aa88cc' }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#aa88cc', minWidth: 30 }}>
                {zoneList[selectedBlend + 1].blend || 5}%
              </span>
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
            How far the transition extends into each zone. 0% = hard edge, 25% = smooth gradient.
          </div>
        </div>
      )}

      {!selectedZone && selectedBlend === null && (
        <div style={{
          marginTop: 8,
          fontSize: 10,
          color: 'rgba(255,255,255,0.35)',
          textAlign: 'center',
        }}>
          Click zones to edit · Click circles to adjust transitions · Drag edges to resize
        </div>
      )}
    </div>
  );
}
