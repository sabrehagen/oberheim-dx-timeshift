#!/usr/bin/env node
// Copies the hardware agent's 3D board export into the web app and extracts
// component anchors (reference, position, pads, nets) from the KiCad PCB so
// that the 3D labels point at the right spots on the real layout.
//
//   hardware/exports/board.glb            -> webapp/public/models/board.glb
//   hardware/kicad/timeshift/*.kicad_pcb  -> webapp/public/models/anchors.json
//   (always)                              -> webapp/public/models/manifest.json
//
// If the files are missing the app falls back to the procedural board in
// src/boardModel.ts. This script never writes outside webapp/public/models.
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webapp = resolve(here, '..');
const repo = resolve(webapp, '..');
const outDir = join(webapp, 'public', 'models');
mkdirSync(outDir, { recursive: true });

const srcGlb = join(repo, 'hardware', 'exports', 'board.glb');
const dstGlb = join(outDir, 'board.glb');
const dstAnchors = join(outDir, 'anchors.json');
const kicadDir = join(repo, 'hardware', 'kicad', 'timeshift');

const manifest = { generatedAt: new Date().toISOString(), glb: false, anchors: false, glbBytes: 0, kicadPcb: null };

// ---- 1. GLB ---------------------------------------------------------------
if (existsSync(srcGlb) && statSync(srcGlb).size > 0) {
  copyFileSync(srcGlb, dstGlb);
  manifest.glb = true;
  manifest.glbBytes = statSync(dstGlb).size;
  console.log(`[sync-model] copied ${relative(repo, srcGlb)} -> ${relative(repo, dstGlb)} (${manifest.glbBytes} bytes)`);
} else {
  if (existsSync(dstGlb)) rmSync(dstGlb);
  console.log('[sync-model] hardware/exports/board.glb not found: the app will use the procedural board model');
}

// ---- 2. KiCad PCB -> anchors.json ----------------------------------------
function tokenize(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '(' || c === ')') { out.push(c); i++; continue; }
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') { i++; continue; }
    if (c === '"') {
      let s = '';
      i++;
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) { s += text[i + 1]; i += 2; continue; }
        s += text[i++];
      }
      i++;
      out.push({ str: s });
      continue;
    }
    let s = '';
    while (i < n && !' \n\r\t()"'.includes(text[i])) s += text[i++];
    out.push(s);
  }
  return out;
}
function parse(tokens) {
  let pos = 0;
  function node() {
    const t = tokens[pos++];
    if (t === '(') {
      const list = [];
      while (tokens[pos] !== ')' && pos < tokens.length) list.push(node());
      pos++;
      return list;
    }
    return typeof t === 'object' ? t.str : t;
  }
  return node();
}
const head = (l) => (Array.isArray(l) ? l[0] : undefined);
const kids = (l, name) => (Array.isArray(l) ? l.filter((c) => head(c) === name) : []);
const kid = (l, name) => kids(l, name)[0];
const num = (v) => Number.parseFloat(v);

function findPcb() {
  if (!existsSync(kicadDir)) return null;
  const files = readdirSync(kicadDir).filter((f) => f.endsWith('.kicad_pcb'));
  return files.length ? join(kicadDir, files[0]) : null;
}

const pcbPath = findPcb();
if (pcbPath) {
  try {
    const tree = parse(tokenize(readFileSync(pcbPath, 'utf8')));
    // Board outline (Edge.Cuts) bounding box.
    const pts = [];
    const collectEdge = (items, ox = 0, oy = 0) => {
      for (const g of items) {
        if (!Array.isArray(g)) continue;
        const h = head(g);
        if (!/^(gr|fp)_(line|rect|arc|circle|poly)$/.test(h)) continue;
        const layer = kid(g, 'layer');
        if (!layer || layer[1] !== 'Edge.Cuts') continue;
        for (const k of ['start', 'end', 'mid', 'center']) {
          const p = kid(g, k);
          if (p) pts.push([num(p[1]) + ox, num(p[2]) + oy]);
        }
        const poly = kid(g, 'pts');
        if (poly) for (const xy of kids(poly, 'xy')) pts.push([num(xy[1]) + ox, num(xy[2]) + oy]);
      }
    };
    collectEdge(tree);
    let thickness = 1.6;
    const general = kid(tree, 'general');
    if (general && kid(general, 'thickness')) thickness = num(kid(general, 'thickness')[1]);

    const footprints = [];
    for (const fp of kids(tree, 'footprint')) {
      const at = kid(fp, 'at') ?? ['at', '0', '0'];
      const fx = num(at[1]);
      const fy = num(at[2]);
      const rot = at[3] !== undefined ? num(at[3]) : 0;
      const layer = kid(fp, 'layer')?.[1] ?? 'F.Cu';
      const props = {};
      for (const p of kids(fp, 'property')) props[p[1]] = p[2];
      // KiCad 6 style (fp_text reference "U1")
      for (const t of kids(fp, 'fp_text')) if (t[1] === 'reference' || t[1] === 'value') props[t[1] === 'reference' ? 'Reference' : 'Value'] ??= t[2];
      const r = (rot * Math.PI) / 180;
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      const pads = [];
      for (const pad of kids(fp, 'pad')) {
        const pat = kid(pad, 'at');
        if (!pat) continue;
        const px = num(pat[1]);
        const py = num(pat[2]);
        const netNode = kid(pad, 'net');
        let net = null;
        if (netNode) net = String(netNode[netNode.length - 1]).replace(/^\//, '');
        pads.push({
          num: String(pad[1]),
          x: +(fx + px * cos + py * sin).toFixed(3),
          y: +(fy - px * sin + py * cos).toFixed(3),
          net,
        });
      }
      footprints.push({ ref: props.Reference ?? '?', value: props.Value ?? '', lib: String(fp[1] ?? ''), x: fx, y: fy, rot, layer, pads });
      collectEdge(fp.filter(Array.isArray), fx, fy);
    }
    if (pts.length === 0) throw new Error('no Edge.Cuts outline found');
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const centred = footprints.map((f) => ({
      ...f,
      x: +(f.x - cx).toFixed(3),
      y: +(f.y - cy).toFixed(3),
      pads: f.pads.map((p) => ({ ...p, x: +(p.x - cx).toFixed(3), y: +(p.y - cy).toFixed(3) })),
    }));
    const anchors = {
      source: relative(repo, pcbPath),
      units: 'mm',
      note: 'Board-centred coordinates (origin = centre of the Edge.Cuts bounding box), KiCad axes: +x right, +y down (towards the bottom of the PCB drawing).',
      board: { width: +(maxX - minX).toFixed(3), height: +(maxY - minY).toFixed(3), thickness },
      // KiCad coordinates of the board centre. KiCad's GLB export uses absolute KiCad
      // coordinates (metres, x = KiCad x, z = KiCad y), so the app subtracts this.
      origin: { x: +cx.toFixed(3), y: +cy.toFixed(3) },
      footprints: centred,
    };
    writeFileSync(dstAnchors, JSON.stringify(anchors, null, 1));
    manifest.anchors = true;
    manifest.kicadPcb = anchors.source;
    console.log(`[sync-model] ${centred.length} footprints from ${anchors.source} -> public/models/anchors.json (board ${anchors.board.width} x ${anchors.board.height} mm)`);
  } catch (err) {
    console.warn(`[sync-model] could not parse ${pcbPath}: ${err.message}. Using procedural anchors.`);
    if (existsSync(dstAnchors)) rmSync(dstAnchors);
  }
} else {
  if (existsSync(dstAnchors)) rmSync(dstAnchors);
  console.log('[sync-model] no KiCad PCB found: labels use the procedural coordinates from src/boardModel.ts');
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
