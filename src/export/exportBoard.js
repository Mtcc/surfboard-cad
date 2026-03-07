/**
 * Export module for surfboard designs
 * Supports: STL, DXF, G-code, JSON
 */

import { generateOutline, generateRocker, generateThickness, generateSurfboardGeometry, inchesToMeters } from '../geometry/surfboardGeometry';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text, filename, mimeType = 'text/plain') {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Export STL binary format
 */
function exportSTL(params) {
  const geometry = generateSurfboardGeometry(params);
  geometry.computeVertexNormals();

  const positionAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  const index = geometry.getIndex();

  const triangleCount = index ? index.count / 3 : positionAttr.count / 3;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);

  // Header (80 bytes)
  const header = `Surfboard CAD Export - ${new Date().toISOString()}`;
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 0);
  }

  // Triangle count
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  const getVec3 = (attr, i) => ({
    x: attr.getX(i),
    y: attr.getY(i),
    z: attr.getZ(i),
  });

  for (let t = 0; t < triangleCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    const n = getVec3(normalAttr, i0);
    const v0 = getVec3(positionAttr, i0);
    const v1 = getVec3(positionAttr, i1);
    const v2 = getVec3(positionAttr, i2);

    // Normal
    view.setFloat32(offset, n.x, true); offset += 4;
    view.setFloat32(offset, n.y, true); offset += 4;
    view.setFloat32(offset, n.z, true); offset += 4;

    // V0
    view.setFloat32(offset, v0.x, true); offset += 4;
    view.setFloat32(offset, v0.y, true); offset += 4;
    view.setFloat32(offset, v0.z, true); offset += 4;
    // V1
    view.setFloat32(offset, v1.x, true); offset += 4;
    view.setFloat32(offset, v1.y, true); offset += 4;
    view.setFloat32(offset, v1.z, true); offset += 4;
    // V2
    view.setFloat32(offset, v2.x, true); offset += 4;
    view.setFloat32(offset, v2.y, true); offset += 4;
    view.setFloat32(offset, v2.z, true); offset += 4;

    // Attribute byte count
    view.setUint16(offset, 0, true); offset += 2;
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  downloadBlob(blob, 'surfboard.stl');
}

/**
 * Export DXF with board outline and rocker profile
 */
function exportDXF(params) {
  const outline = generateOutline(params);
  const rocker = generateRocker(params);
  const lengthIn = params.lengthIn;

  let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  // Outline polyline (right side, in inches)
  dxf += `0\nPOLYLINE\n8\nOUTLINE\n66\n1\n70\n0\n`;
  for (const pt of outline) {
    dxf += `0\nVERTEX\n8\nOUTLINE\n10\n${pt.x.toFixed(4)}\n20\n${pt.halfWidth.toFixed(4)}\n30\n0.0\n`;
  }
  // Mirror (left side)
  const reversed = [...outline].reverse();
  for (const pt of reversed) {
    dxf += `0\nVERTEX\n8\nOUTLINE\n10\n${pt.x.toFixed(4)}\n20\n${(-pt.halfWidth).toFixed(4)}\n30\n0.0\n`;
  }
  dxf += `0\nSEQEND\n`;

  // Rocker profile polyline (in separate layer, Z as Y for 2D)
  dxf += `0\nPOLYLINE\n8\nROCKER\n66\n1\n70\n0\n`;
  for (const pt of rocker) {
    dxf += `0\nVERTEX\n8\nROCKER\n10\n${pt.x.toFixed(4)}\n20\n${pt.z.toFixed(4)}\n30\n0.0\n`;
  }
  dxf += `0\nSEQEND\n`;

  // Dimension annotations
  dxf += `0\nTEXT\n8\nDIMENSIONS\n10\n${(lengthIn / 2).toFixed(2)}\n20\n-5\n30\n0\n40\n2\n1\nLength: ${params.lengthFt}'${params.lengthIn_extra || 0}" x ${params.widthIn}" x ${params.thicknessIn}"\n`;

  dxf += `0\nENDSEC\n0\nEOF\n`;

  downloadText(dxf, 'surfboard_template.dxf', 'application/dxf');
}

/**
 * Export G-code for 3-axis CNC router
 * Generates cross-section cutting paths
 */
function exportGCode(params) {
  const outline = generateOutline(params);
  const rocker = generateRocker(params);
  const thickness = generateThickness(params);
  const lengthIn = params.lengthIn;

  // CNC parameters
  const feedRate = 150;    // inches/min
  const plungeRate = 50;
  const stepover = 0.5;    // inches between passes
  const safeZ = 2.0;       // safe retract height
  const sliceInterval = 2; // cross-section slices every 2"

  let gcode = '';
  gcode += `; Surfboard CNC Router Program\n`;
  gcode += `; Generated: ${new Date().toISOString()}\n`;
  gcode += `; Board: ${params.lengthFt}'${params.lengthIn_extra || 0}" x ${params.widthIn}" x ${params.thicknessIn}"\n`;
  gcode += `; Volume: ~${(params.volume || 30).toFixed(1)}L\n`;
  gcode += `;\n`;
  gcode += `; === DECK PROFILE ===\n`;
  gcode += `G21 ; Metric mode\n`;
  gcode += `G90 ; Absolute positioning\n`;
  gcode += `G94 ; Feed per minute\n`;
  gcode += `M3 S18000 ; Spindle on\n`;
  gcode += `G0 Z${(safeZ * 25.4).toFixed(2)} ; Safe height\n\n`;

  // Generate cross-section cuts along length
  gcode += `; Cross-section passes (every ${sliceInterval}")\n`;
  for (let x = 0; x <= lengthIn; x += sliceInterval) {
    // Find interpolated values at this x
    const idx = Math.min(Math.floor(x / lengthIn * (outline.length - 1)), outline.length - 1);
    const hw = outline[idx]?.halfWidth || 0;
    const rz = rocker[idx]?.z || 0;
    const th = thickness[idx]?.thickness || params.thicknessIn;

    const xMM = x * 25.4;
    const yMM = hw * 25.4;
    const zMM = (th / 2) * 25.4;
    const rockerMM = rz * 25.4;

    gcode += `; Slice at x=${x.toFixed(1)}"\n`;
    gcode += `G0 Z${(safeZ * 25.4).toFixed(2)}\n`;
    gcode += `G0 X${xMM.toFixed(2)} Y${(-yMM).toFixed(2)}\n`;
    gcode += `G1 Z${(zMM - rockerMM).toFixed(2)} F${plungeRate}\n`;
    gcode += `G1 Y${yMM.toFixed(2)} F${feedRate}\n`;
  }

  // Outline pass
  gcode += `\n; === OUTLINE PASS ===\n`;
  gcode += `G0 Z${(safeZ * 25.4).toFixed(2)}\n`;
  gcode += `G0 X0 Y0\n`;
  gcode += `G1 Z0 F${plungeRate}\n`;

  // Right side outline
  for (const pt of outline) {
    const xMM = pt.x * 25.4;
    const yMM = pt.halfWidth * 25.4;
    gcode += `G1 X${xMM.toFixed(2)} Y${yMM.toFixed(2)} F${feedRate}\n`;
  }
  // Left side outline (reversed)
  for (const pt of [...outline].reverse()) {
    const xMM = pt.x * 25.4;
    const yMM = -pt.halfWidth * 25.4;
    gcode += `G1 X${xMM.toFixed(2)} Y${yMM.toFixed(2)} F${feedRate}\n`;
  }

  gcode += `G0 Z${(safeZ * 25.4).toFixed(2)} ; Retract\n`;
  gcode += `G0 X0 Y0 ; Home\n`;
  gcode += `M5 ; Spindle off\n`;
  gcode += `M30 ; Program end\n`;

  downloadText(gcode, 'surfboard.nc', 'text/plain');
}

/**
 * Export JSON parameters
 */
function exportJSON(params) {
  const data = {
    version: '1.0',
    generated: new Date().toISOString(),
    design: 'Surfboard CAD',
    params: {
      ...params,
      lengthFormatted: `${params.lengthFt}'${params.lengthIn_extra || 0}"`,
    },
  };
  downloadText(JSON.stringify(data, null, 2), 'surfboard_design.json', 'application/json');
}

/**
 * Main export dispatch
 */
export async function exportBoard(params, format) {
  const fullParams = {
    ...params,
    lengthIn: params.lengthFt * 12 + (params.lengthIn_extra || 0),
  };

  switch (format) {
    case 'stl': return exportSTL(fullParams);
    case 'dxf': return exportDXF(fullParams);
    case 'gcode': return exportGCode(fullParams);
    case 'json': return exportJSON(fullParams);
    default: throw new Error(`Unknown format: ${format}`);
  }
}
