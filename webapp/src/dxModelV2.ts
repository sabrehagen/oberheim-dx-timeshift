/**
 * DX model v2 (default, `?dx=v2`): a faithful, recognisable Oberheim DX (1983), built
 * entirely in code: geometry plus canvas textures drawn at start-up. No third-party model
 * files, fonts or images, so there is nothing to license. The layout was measured on the
 * reference photos in docs/reference/photos (see docs/reference/INDEX.md for their licences):
 *   - top panel:   wikimedia_Oberheim_DX.jpg (perspective-corrected), electrongate_dx_front_1a.jpg
 *   - rear panel:  electrongate_dx_back_1a.jpg
 *   - main board:  wikimedia_Oberheim-DX_processor_board.jpg (part positions converted with P() below)
 *
 * Size: 457 × 300 × 127 mm (W × D × H), from the specifications page of the DX Owner's Manual
 * 2nd edition ("45.7 cm L × 30.0 cm W × 12.7 cm"). The wedge heights are estimated from the
 * photos: the lid is 120 mm high at the rear edge and 50 mm at the front, the hinge (top of
 * the rear panel) is at 104 mm, and the wooden end cheeks stand 4 mm proud of the lid.
 *
 * World units are millimetres. +x = the player's right, +z = front, -z = rear panel, +y = up.
 * Static parts are merged per material (see mergeInto) to keep the draw calls low; parts the
 * walkthrough highlights (U701, R791, Q709, the clock jacks, ...) stay separate objects.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MAT, boxOnFloor, textCanvas } from './util';
import type { Registry } from './registry';

export const DX = {
  W: 457,
  D: 300,
  H: 127,
  /** wooden end cheek thickness */
  cheekT: 16,
  /** inner half width (between the cheeks) */
  inner: 212.5,
  /** top of the rear panel = hinge line */
  rearH: 104,
  /** top of the lid at its rear edge */
  lidRearY: 120,
  /** top of the lid at the front */
  frontH: 50,
  boardY: 8, // main board underside
  boardT: 1.6,
  get boardTop(): number {
    return this.boardY + this.boardT;
  },
  rearZ: -150,
  frontZ: 150,
  /** how far the lid swings open (degrees): the panel ends up about vertical */
  lidOpenDeg: 104,
};

const LID_W = 423;
const SLOPE = Math.atan2(DX.lidRearY - DX.frontH, DX.D);
const LID_L = Math.hypot(DX.D, DX.lidRearY - DX.frontH);

/** Rear-panel items, listed left → right as seen from BEHIND the machine (findings e1/e5). */
export const TUNING_POTS = ['PERC', 'CYMBAL', 'TOMS', 'HI-HAT', 'SNARE', 'BASS'];
export const JACKS = ['IN', 'OUT', 'TRIGGER', 'START', 'NEXT', 'LEFT', 'MONO', 'RIGHT', 'CLICK', 'PERC', 'CYMBAL', 'TOMS', 'HI-HAT', 'SNARE', 'BASS'];
const JACK_IDS = ['clockIn', 'clockOut', 'trigger', 'start', 'next', 'mixLeft', 'mixMono', 'mixRight', 'click', 'perc.out', 'cymbal.out', 'toms.out', 'hihat.out', 'snare.out', 'bass.out'];
/** Rear photo pixel (3× enlargement of electrongate_dx_back_1a.jpg) → world x / y. */
const rx = (px: number): number => -DX.inner + (1535 - px) * 0.291;
const ry = (py: number): number => 21 + (345 - py) * 0.291;
const POT_PX = [1140, 1215, 1290, 1365, 1440, 1510];
// Seen from behind, the viewer's right is world -x. BASS (rightmost) is the most negative x.
export const potX = (i: number): number => rx(POT_PX[i]);
export const jackX = (i: number): number => 92 - i * 17.5;
export const POT_Y = 63;
export const JACK_Y = 21;
/** Candidate SNARE DELAY hole: directly below the SNARE tuning pot (findings e6). */
export const DELAY_POT = { x: potX(TUNING_POTS.indexOf('SNARE')), y: 47 };

/** Board photo pixel (1600 px wide version of the Wikimedia processor-board photo) → world x / z. */
const P = (px: number, py: number): [number, number] => [(px - 807) * 0.272, -148.5 + (py - 172) * 0.293];
const [u701x, u701z] = P(728, 418);
const [r791x, r791z] = P(1113, 942);
export const U701_POS = { x: u701x, z: u701z };
export const R791_POS = { x: r791x, z: r791z };

export interface BuiltDX {
  root: THREE.Group;
  lidPivot: THREE.Group;
  u701Chip: THREE.Group;
  delayPotParts: { outside: THREE.Group; inside: THREE.Group; legend: THREE.Mesh; hole: THREE.Mesh };
  snareRing: THREE.Mesh;
  snareGlow: THREE.Mesh;
  dxPaths: { id: string; color: number; lines: THREE.Vector3[][] }[];
  u701Pin(n: number): THREE.Vector3;
}

// ------------------------------------------------------------------ materials & helpers
const std = (color: number, roughness = 0.6, metalness = 0.05, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const M = {
  paint: std(0x111113, 0.68, 0.3), // black crackle-painted steel
  inner: std(0x202024, 0.8, 0.25),
  key: std(0x141416, 0.48, 0.04),
  keyWhite: std(0xe8e4d8, 0.45, 0.02),
  keyRed: std(0xc31d17, 0.42, 0.02),
  red: std(0xb0161a, 0.4, 0.02),
  chip: std(0x18181a, 0.5, 0.05),
  socket: std(0x0d0d0f, 0.65, 0.02),
  pin: std(0xc9ccd2, 0.32, 0.85),
  metal: std(0xbfc2c8, 0.3, 0.85),
  steel: std(0x8e9298, 0.42, 0.8),
  dark: std(0x2a2b2f, 0.45, 0.6),
  hole: std(0x030303, 1, 0),
  pcb: std(0x1b6a52, 0.55, 0.05),
  pcbLid: std(0x2a5c3c, 0.6, 0.05),
  white: std(0xe6e2d6, 0.6, 0.02),
  blue: std(0x2f5fb8, 0.45, 0.05),
  ribbon: std(0x9cc4e8, 0.6, 0.02),
  yellow: std(0xe0b52a, 0.5, 0.05),
  capGrey: std(0xb8bcc0, 0.4, 0.3),
  capBlue: std(0x2a4f9a, 0.4, 0.1),
  resBeige: std(0xc9b089, 0.55, 0.02),
  resBlue: std(0x5b8fc9, 0.5, 0.02),
  ceramicOrange: std(0xd0703a, 0.5, 0.02),
  filmRed: std(0xa5442c, 0.5, 0.02),
  copper: std(0xb8743a, 0.4, 0.6),
  tapeYellow: std(0xd8b04a, 0.6, 0.02),
  led: std(0x7a0d08, 0.3, 0.0, { emissive: 0xff2a14, emissiveIntensity: 0.55 }),
};

const SANS = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif';
const SERIF = 'Georgia, "DejaVu Serif", "Liberation Serif", serif';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}
/** Box whose origin is the centre of its bottom face. */
const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh => {
  const b = boxOnFloor(w, h, d, mat);
  b.position.set(x, y, z);
  parent?.add(b);
  return b;
};
/** Cylinder along an axis ('x' | 'y' | 'z'), centred at (x, y, z). */
function cyl(r: number, len: number, mat: THREE.Material, axis: 'x' | 'y' | 'z', x: number, y: number, z: number, parent?: THREE.Object3D, seg = 16, r2 = r): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}

/**
 * Replace every mesh below `group` by one merged mesh per material. Plain materials that
 * differ only in colour share one vertex-coloured material (one draw call); textured or
 * transparent materials are merged per material.
 */
function mergeInto(group: THREE.Object3D): void {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.keep) meshes.push(m);
  });
  const buckets = new Map<string, { mat: THREE.MeshStandardMaterial; vc: boolean; geos: THREE.BufferGeometry[] }>();
  const rel = new THREE.Matrix4();
  for (const m of meshes) {
    const mat = m.material as THREE.MeshStandardMaterial;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.clearGroups();
    rel.multiplyMatrices(inv, m.matrixWorld);
    g.applyMatrix4(rel);
    const plain = !mat.map && !mat.emissiveMap && !mat.transparent;
    const key = plain
      ? `vc|${mat.roughness.toFixed(2)}|${mat.metalness.toFixed(2)}|${mat.emissive.getHexString()}|${mat.emissiveIntensity}|${mat.side}`
      : mat.uuid;
    if (plain) {
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set([mat.color.r, mat.color.g, mat.color.b], i * 3);
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    let b = buckets.get(key);
    if (!b) {
      b = { mat, vc: plain, geos: [] };
      buckets.set(key, b);
    }
    b.geos.push(g);
    m.parent?.remove(m);
  }
  // drop now-empty helper groups
  const empty: THREE.Object3D[] = [];
  group.traverse((o) => {
    if (o !== group && !(o as THREE.Mesh).isMesh && o.children.length === 0 && !o.userData.keep) empty.push(o);
  });
  for (const o of empty) o.parent?.remove(o);
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false);
    if (!geo) continue;
    const mat = b.vc
      ? new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: b.mat.roughness,
          metalness: b.mat.metalness,
          emissive: b.mat.emissive,
          emissiveIntensity: b.mat.emissiveIntensity,
          side: b.mat.side,
        })
      : b.mat;
    const out = new THREE.Mesh(geo, mat);
    group.add(out);
  }
}

// ------------------------------------------------------------------ text atlas (chip markings, EPROM stickers, key legends)
class Atlas {
  readonly size = 2048;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly mat: THREE.MeshStandardMaterial;
  private x = 0;
  private y = 0;
  private rowH = 0;
  private cache = new Map<string, [number, number, number, number]>();
  constructor() {
    const c = document.createElement('canvas');
    c.width = this.size;
    c.height = this.size;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    ctx.fillStyle = '#18181a';
    ctx.fillRect(0, 0, this.size, this.size);
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.5, metalness: 0.05 });
  }
  region(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): [number, number, number, number] {
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (this.x + w > this.size) {
      this.x = 0;
      this.y += this.rowH;
      this.rowH = 0;
    }
    if (this.y + h > this.size) return this.cache.values().next().value ?? [0, 0, w, h];
    const r: [number, number, number, number] = [this.x, this.y, w, h];
    this.ctx.save();
    this.ctx.translate(this.x, this.y);
    this.ctx.beginPath();
    this.ctx.rect(0, 0, w, h);
    this.ctx.clip();
    draw(this.ctx, w, h);
    this.ctx.restore();
    this.x += w;
    this.rowH = Math.max(this.rowH, h);
    this.cache.set(key, r);
    return r;
  }
  /** Horizontal quad (facing +y) of size w × d whose texture is the given region; text reads along +x. */
  quad(w: number, d: number, r: [number, number, number, number]): THREE.BufferGeometry {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, (r[0] + u * r[2]) / this.size, 1 - (r[1] + (1 - v) * r[3]) / this.size);
    }
    g.rotateX(-Math.PI / 2);
    return g;
  }
  marking(text: string, notch = true): [number, number, number, number] {
    return this.region(`m:${text}:${notch}`, 512, 128, (ctx, w, h) => {
      ctx.fillStyle = '#18181a';
      ctx.fillRect(0, 0, w, h);
      if (notch) {
        ctx.fillStyle = '#0c0c0d';
        ctx.beginPath();
        ctx.arc(0, h / 2, 26, -Math.PI / 2, Math.PI / 2);
        ctx.fill();
      }
      ctx.fillStyle = '#c9c9cc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = text.split('\n');
      const fs = lines.length > 1 ? 40 : 50;
      ctx.font = `bold ${fs}px ${SANS}`;
      lines.forEach((l, i) => {
        const tw = ctx.measureText(l).width;
        ctx.save();
        ctx.translate(w / 2 + 14, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1);
        ctx.scale(Math.min(1, (w - 90) / tw), 1);
        ctx.fillText(l, 0, 0);
        ctx.restore();
      });
    });
  }
  sticker(text: string): [number, number, number, number] {
    return this.region(`s:${text}`, 256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f1efe6';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9b2d2a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = text.split('\n');
      const fs = lines.length > 1 ? 40 : 48;
      ctx.font = `italic bold ${fs}px ${SANS}`;
      lines.forEach((l, i) => {
        const tw = ctx.measureText(l).width;
        ctx.save();
        ctx.translate(w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.05);
        ctx.scale(Math.min(1, (w - 16) / tw), 1);
        ctx.fillText(l, 0, 0);
        ctx.restore();
      });
    });
  }
  legend(text: string): [number, number, number, number] {
    return this.region(`k:${text}`, 128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#141416';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f2f2f2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold 64px ${SANS}`;
      ctx.fillText(text, w / 2, h / 2 + 4);
    });
  }
}

// ------------------------------------------------------------------ parts
interface DipOpts {
  mark?: string;
  sticker?: string;
  socket?: boolean;
  window?: boolean;
}
/** DIP package, long axis along local x, pin 1 at -x (notch end). Origin = board surface. */
function dip(atlas: Atlas, pins: number, o: DipOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const len = (pins / 2) * 2.54 + 0.6;
  const w = pins >= 24 ? 13.6 : 6.4;
  let base = 0.7;
  if (o.socket) {
    box(len + 1.4, 3, w + 1.6, M.socket, 0, 0, 0, g);
    base = 3.1;
  }
  box(len, 3.4, w, M.chip, 0, base, 0, g);
  const pg = new THREE.BoxGeometry(0.5, base + 1.6, 0.35);
  pg.translate(0, (base + 1.6) / 2, 0);
  const half = pins / 2;
  for (let i = 0; i < half; i++) {
    const x = -((half - 1) * 2.54) / 2 + i * 2.54;
    for (const s of [1, -1]) mesh(pg, M.pin, x, 0, s * (w / 2 + 0.15), g);
  }
  const top = base + 3.42;
  if (o.sticker) {
    const q = mesh(atlas.quad(Math.min(len * 0.6, 22), w * 0.8, atlas.sticker(o.sticker)), atlas.mat, len * 0.06, top, 0, g);
    q.position.y = top + 0.05;
  } else if (o.mark) {
    mesh(atlas.quad(len * 0.92, w * 0.62, atlas.marking(o.mark)), atlas.mat, 0, top, 0, g);
  }
  if (o.window) cyl(2.6, 0.3, M.steel, 'y', len * 0.08, top + 0.1, 0, g, 16);
  return g;
}

function dipPinLocal(n: number, pins = 16): [number, number] {
  const half = pins / 2;
  if (n <= half) return [-(half - 1) * 1.27 + (n - 1) * 2.54, 3.81];
  return [(half - 1) * 1.27 - (n - half - 1) * 2.54, -3.81];
}

/** Axial resistor lying flat, along local x; leads 10.16 mm apart. */
function resistor(mat: THREE.Material, parent?: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  cyl(1.15, 6.2, mat, 'x', 0, 1.6, 0, g, 10);
  for (const s of [-1, 1]) {
    cyl(0.28, 2.0, M.pin, 'x', s * 4.1, 1.6, 0, g, 5);
    cyl(0.28, 1.7, M.pin, 'y', s * 5.08, 0.85, 0, g, 5);
  }
  parent?.add(g);
  return g;
}

function wood(): THREE.CanvasTexture {
  const tex = textCanvas(1024, 512, (ctx) => {
    const grd = ctx.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#5e2f1b');
    grd.addColorStop(0.5, '#6a3720');
    grd.addColorStop(1, '#552a18');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 1024, 512);
    const rnd = mulberry32(7);
    for (let i = 0; i < 340; i++) {
      const y = rnd() * 512;
      const amp = 2 + rnd() * 6;
      const ph = rnd() * 6.28;
      ctx.strokeStyle = rnd() < 0.6 ? `rgba(40,16,8,${0.15 + rnd() * 0.3})` : `rgba(150,85,50,${0.08 + rnd() * 0.15})`;
      ctx.lineWidth = 0.6 + rnd() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= 1024; x += 16) {
        const yy = y + Math.sin(x / 140 + ph) * amp + Math.sin(x / 37 + ph * 2) * amp * 0.25;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 300, 1 / 140);
  return tex;
}

function speckle(ctx: CanvasRenderingContext2D, W: number, H: number, n: number, seed: number): void {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const v = rnd() < 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.035 + rnd() * 0.05})`;
    ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

interface TxtOpts {
  bold?: boolean;
  italic?: boolean;
  align?: CanvasTextAlign;
  color?: string;
  bg?: string;
  cond?: number;
  font?: string;
}
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, o: TxtOpts = {}): number {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(o.cond ?? 0.86, 1);
  ctx.font = `${o.italic ? 'italic ' : ''}${o.bold === false ? '' : 'bold '}${size}px ${o.font ?? SANS}`;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(s).width;
  if (o.bg) {
    const x0 = o.align === 'left' ? 0 : o.align === 'right' ? -w : -w / 2;
    ctx.fillStyle = o.bg;
    ctx.fillRect(x0 - size * 0.45, -size * 0.66, w + size * 0.9, size * 1.32);
  }
  ctx.fillStyle = o.color ?? '#f2f2f2';
  ctx.fillText(s, 0, size * 0.04);
  ctx.restore();
  return w * (o.cond ?? 0.86);
}

/** Outlined, slanted "DX" logo (white outline, black inside). */
function dxLogo(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, line: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, -0.32, 1, 0, 0);
  ctx.scale(1.18, 1);
  ctx.font = `900 ${h * 1.32}px "Arial Black", ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#f4f4f4';
  ctx.lineWidth = line * 2.4;
  ctx.strokeText('DX', 0, 0);
  ctx.fillStyle = '#111113';
  ctx.fillText('DX', 0, 0);
  ctx.restore();
}

/** Stylised round emblem next to the Oberheim wordmark. */
function emblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = '#f2f2f2';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111113';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.1, r * 0.48, Math.PI * 0.2, Math.PI * 1.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r * 0.28, y + r * 0.15, r * 0.3, Math.PI * 1.1, Math.PI * 2.6);
  ctx.stroke();
  ctx.fillStyle = '#111113';
  ctx.beginPath();
  ctx.arc(x - r * 0.15, y - r * 0.2, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ top panel layout (mm on the sloped panel)
// s = across from the panel's left edge (0..423), t = down the slope from the rear edge (0..LID_L).
const SLIDERS = ['BASS', 'SNARE', 'HI-HAT', 'TOMS', 'CYMBAL', 'PERC', 'METRONOME', 'VOLUME'];
const sliderS = (i: number): number => 23.9 + i * 42.15;
const SLIDER_CAP_T = [117, 113, 119, 124, 117, 112, 118, 111];
const SLOT_T: [number, number] = [106, 183.5];
const PAD_COLS = ['BASS', 'SNARE', 'HI-HAT', 'TOMS', 'CYMBAL', 'PERC'];
const PAD_LABELS = [
  ['SOFT', 'MEDIUM', 'LOUD'],
  ['SOFT', 'MEDIUM', 'LOUD'],
  ['CLOSED', 'ACCENT', 'OPEN'],
  ['HI', 'MID', 'LOW'],
  ['SOFT', 'MEDIUM', 'LOUD'],
  ['SHAKER 1', 'SHAKER 2', 'CLAPS'],
];
const padS = (c: number): number => 24.8 + c * 40.7;
const padT = (r: number): number => 213.6 + r * 27.8;
const PAD = 20.5;
const FN = { s: [276.8, 296, 315.2], t: 211.7, labels: ['TEMPO', 'SIGNATURE', 'QUANTIZE'] };
const PLAY = { s: 295.3, t: 254 };
const CAS_S = [348.4, 367.75, 387.1, 406.45];
const CAS_T = [239.7, 268.5];
const CAS_LABELS = [
  ['SWING', 'SONG', 'EDIT', 'STEP'],
  ['RECORD', 'ERASE', 'COPY', 'LENGTH'],
];
const KEY_S = [360, 378.7, 397.4];
const KEY_T = [136.8, 158.2, 179.6, 201];
const KEY_LEGENDS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '<', '0', '>'];
const DISPLAY = { s0: 350.7, s1: 407.5, t0: 90.6, t1: 108.2 };
const POWER = { s: 398.6, t: 6.5 };
const STRIPES = { t0: 67.7, t1: 286.8, n: 32 };

function panelTexture(): THREE.CanvasTexture {
  const W = 4096;
  const H = 3072;
  const tex = textCanvas(W, H, (ctx) => {
    ctx.fillStyle = '#121214';
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, W, H, 60000, 3);
    ctx.save();
    ctx.scale(W / LID_W, H / LID_L);
    const blue = '#3f86dc';
    const line = (t: number, th = 1.05): void => {
      ctx.fillStyle = blue;
      ctx.fillRect(0, t - th / 2, LID_W, th);
    };
    // top double rule
    line(13.9, 0.9);
    line(19.3, 0.9);
    // pinstripes
    for (let i = 0; i < STRIPES.n; i++) line(STRIPES.t0 + ((STRIPES.t1 - STRIPES.t0) * i) / (STRIPES.n - 1));
    // power-switch recess
    ctx.fillStyle = '#060607';
    ctx.fillRect(POWER.s - 10.5, POWER.t - 6, 21, 12);
    // DX logo
    dxLogo(ctx, 10, 60.5, 38, 1.0);
    // slider slots + labels
    SLIDERS.forEach((n, i) => {
      const s = sliderS(i);
      ctx.fillStyle = '#050505';
      ctx.fillRect(s - 1.4, SLOT_T[0], 2.8, SLOT_T[1] - SLOT_T[0]);
      txt(ctx, n, s, 191.7, 4.1, { bg: '#121214' });
    });
    // display bezel
    ctx.fillStyle = '#070707';
    ctx.fillRect(DISPLAY.s0 - 2, DISPLAY.t0 - 2, DISPLAY.s1 - DISPLAY.s0 + 4, DISPLAY.t1 - DISPLAY.t0 + 4);
    // keypad well
    ctx.fillStyle = '#09090a';
    ctx.fillRect(KEY_S[0] - 10.5, KEY_T[0] - 12, KEY_S[2] - KEY_S[0] + 21, KEY_T[3] - KEY_T[0] + 24);
    // pad labels
    PAD_COLS.forEach((_, c) => {
      PAD_LABELS[c].forEach((l, r) => {
        ctx.fillStyle = '#121214';
        ctx.fillRect(padS(c) - PAD / 2 - 1, padT(r) + PAD / 2 + 0.6, PAD + 2, 5.6);
        txt(ctx, l, padS(c), padT(r) + 13.7, 3.3);
      });
    });
    // function keys
    ctx.fillStyle = '#121214';
    ctx.fillRect(FN.s[0] - 10, FN.t + 9.8, FN.s[2] - FN.s[0] + 20, 5.6);
    FN.labels.forEach((l, i) => txt(ctx, l, FN.s[i], FN.t + 15.4, 2.5, { cond: 0.78 }));
    txt(ctx, 'PLAY/STOP', PLAY.s, PLAY.t + 15.1, 2.9, { bg: '#121214' });
    // cassette block
    ctx.fillStyle = '#121214';
    ctx.fillRect(CAS_S[0] - 10, 215.5, CAS_S[3] - CAS_S[0] + 20, 14);
    txt(ctx, 'CASSETTE', 384.5, 219.6, 4.0);
    txt(ctx, 'CHECK', CAS_S[1], 226.3, 2.7);
    txt(ctx, 'PLAY', CAS_S[2], 226.3, 2.7);
    txt(ctx, 'RECORD', CAS_S[3], 226.3, 2.7);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(CAS_S[1] + 4.6, 226.1, 8.5, 0.35);
    ctx.fillRect(CAS_S[2] + 3.6, 226.1, 8.4, 0.35);
    CAS_LABELS.forEach((row, r) => {
      ctx.fillStyle = '#121214';
      ctx.fillRect(CAS_S[0] - 10, CAS_T[r] + 10.1, CAS_S[3] - CAS_S[0] + 20, 5.8);
      row.forEach((l, i) => txt(ctx, l, CAS_S[i], CAS_T[r] + 15.4, 2.9));
    });
    // bottom band + Oberheim wordmark
    emblem(ctx, 326.5, 298.6, 4.6);
    txt(ctx, 'Oberheim', 334, 299, 10.5, { font: SERIF, align: 'left', cond: 0.9 });
    ctx.restore();
  });
  tex.anisotropy = 8;
  return tex;
}

function displayTexture(): THREE.CanvasTexture {
  const segs: Record<string, string> = {
    '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', ' ': '',
  };
  return textCanvas(1024, 320, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1024, 320);
    const digits = ['0', '1', ' ', '1', '2', '0'];
    const dw = 104;
    const dh = 200;
    const th = 18;
    digits.forEach((d, i) => {
      const x = 70 + i * 146 + (i >= 2 ? 30 : 0);
      const y = 60;
      const on = segs[d];
      const rects: Record<string, [number, number, number, number]> = {
        a: [x + th, y, dw - 2 * th, th],
        b: [x + dw - th, y + th, th, dh / 2 - th * 1.5],
        c: [x + dw - th, y + dh / 2 + th / 2, th, dh / 2 - th * 1.5],
        d: [x + th, y + dh - th, dw - 2 * th, th],
        e: [x, y + dh / 2 + th / 2, th, dh / 2 - th * 1.5],
        f: [x, y + th, th, dh / 2 - th * 1.5],
        g: [x + th, y + dh / 2 - th / 2, dw - 2 * th, th],
      };
      for (const [k, r] of Object.entries(rects)) {
        ctx.save();
        ctx.transform(1, 0, -0.1, 1, 30, 0);
        const lit = on.includes(k);
        ctx.fillStyle = lit ? '#ff3a24' : '#2a0604';
        if (lit) {
          ctx.shadowColor = '#ff2a10';
          ctx.shadowBlur = 16;
        }
        ctx.fillRect(r[0], r[1], r[2], r[3]);
        ctx.restore();
      }
    });
  });
}

// ------------------------------------------------------------------ rear panel texture
const REAR_W = 2 * DX.inner;
function rearTexture(): THREE.CanvasTexture {
  const W = 4096;
  const H = 1024;
  return textCanvas(W, H, (ctx) => {
    ctx.fillStyle = '#141416';
    ctx.fillRect(0, 0, W, H);
    speckle(ctx, W, H, 20000, 11);
    ctx.save();
    ctx.scale(W / REAR_W, H / DX.rearH);
    // canvas x grows towards world -x (the panel is seen from behind)
    const X = (wx: number): number => DX.inner - wx;
    const Y = (wy: number): number => DX.rearH - wy;
    const T = (s: string, wx: number, wy: number, size: number, o: TxtOpts = {}): number => txt(ctx, s, X(wx), Y(wy), size, o);
    const hole = (wx: number, wy: number, r: number): void => {
      ctx.fillStyle = '#040404';
      ctx.beginPath();
      ctx.arc(X(wx), Y(wy), r, 0, Math.PI * 2);
      ctx.fill();
    };
    const rule = (wx0: number, wx1: number, wy: number): void => {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(X(wx0), Y(wy) - 0.2, wx0 - wx1, 0.4);
    };
    T('PROGRAMMABLE DIGITAL DRUM MACHINE', 31.9, 86.5, 6.2, { cond: 0.82 });
    T('DRUM TUNING', (potX(0) + potX(5)) / 2, 82.5, 4.2, { italic: true });
    TUNING_POTS.forEach((n, i) => T(n, potX(i), 74, 2.8));
    JACKS.forEach((n, i) => T(n, jackX(i), 28.8, 2.6));
    T('CLOCK', (jackX(0) + jackX(1)) / 2, 13.2, 2.6);
    T('INPUT', jackX(2), 13.2, 2.6);
    T('FOOTSWITCHES', (jackX(3) + jackX(4)) / 2, 13.2, 2.6);
    rule(jackX(5) + 4, jackX(6) - 6, 13.2);
    T('MIX', jackX(6), 13.2, 2.6, { bg: '#141416' });
    rule(jackX(8) + 4, jackX(14) - 4, 13.2);
    T('OUTPUTS', (jackX(11) + jackX(12)) / 2, 13.2, 2.6, { bg: '#141416' });
    // cassette interface
    const casIn = rx(975);
    const casOut = rx(1040);
    T('TO', casIn, 79, 2.4);
    T('CASS.', casIn, 75.8, 2.4);
    T('INPUT', casIn, 72.6, 2.4);
    T('TO', casOut, 79, 2.4);
    T('CASS.', casOut, 75.8, 2.4);
    T('OUTPUT', casOut, 72.6, 2.4);
    T('ENABLE', rx(905), 74, 2.4);
    T('ON', rx(905), 70.8, 2.4);
    rule(rx(890), rx(1060), 53.5);
    T('CASSETTE', rx(960), 53.5, 2.4, { bg: '#141416' });
    T('INTERFACE', rx(960), 50.2, 2.4);
    T('MEM. PROTECT', rx(780), 74, 2.4);
    T('ON', rx(800), 70.8, 2.4);
    hole(casIn, 63.5, 5.2);
    hole(casOut, 63.5, 5.2);
    // maker
    emblem(ctx, X(rx(635)), Y(69.5), 5.4);
    T('OBERHEIM ELECTRONICS INC.', rx(515), 71.5, 2.5, { bold: false });
    T('LOS ANGELES, CA 90064', rx(515), 67.8, 2.5, { bold: false });
    // model plate
    const px0 = X(rx(385));
    const px1 = X(rx(730));
    ctx.fillStyle = '#d9d6cc';
    ctx.fillRect(px0, Y(58), px1 - px0, 22.5);
    ctx.fillStyle = '#efece3';
    ctx.fillRect(px0 + 1, Y(57), (px1 - px0) * 0.58, 9);
    ctx.fillRect(px0 + (px1 - px0) * 0.6, Y(57), (px1 - px0) * 0.38, 9);
    txt(ctx, 'MODEL DX', px0 + (px1 - px0) * 0.29, Y(52.5), 5, { color: '#222' });
    txt(ctx, 'Nº', px0 + (px1 - px0) * 0.66, Y(52.5), 4.4, { color: '#222' });
    txt(ctx, '95-130 VAC OR 190-260 VAC  50-60 HZ  19 WATTS', px0 + (px1 - px0) / 2, Y(44.6), 2.1, { color: '#222', cond: 0.8 });
    ctx.fillStyle = '#222';
    ctx.fillRect(px0 + 1, Y(42), px1 - px0 - 2, 4.5);
    txt(ctx, 'OBERHEIM ELECTRONICS, INC.   LOS ANGELES, CA 90064', px0 + (px1 - px0) / 2, Y(39.7), 2.0, { color: '#d9d6cc', cond: 0.8 });
    // warning sticker
    const wx0 = X(rx(130));
    const wx1 = X(rx(415));
    ctx.fillStyle = '#e9e6dc';
    ctx.fillRect(wx0, Y(27), wx1 - wx0, 13.5);
    ctx.fillStyle = '#5a5a5a';
    for (let i = 0; i < 5; i++) ctx.fillRect(wx0 + 2, Y(24.8 - i * 2.2), (wx1 - wx0) * (i === 4 ? 0.5 : 0.9), 0.7);
    // rear DX logo
    dxLogo(ctx, X(-176), Y(18), 13, 0.45);
    // holes
    TUNING_POTS.forEach((_, i) => hole(potX(i), POT_Y, 4.2));
    JACKS.forEach((_, i) => hole(jackX(i), JACK_Y, 6.4));
    ctx.fillStyle = '#040404';
    ctx.fillRect(X(rx(905)) - 2.2, Y(65.5), 4.4, 9);
    ctx.fillRect(X(rx(780)) - 2.2, Y(66.5), 4.4, 9);
    ctx.restore();
  });
}

// ------------------------------------------------------------------ main-board layout
interface ChipSpec {
  ref: string;
  x: number;
  z: number;
  pins: number;
  /** long axis along z (vertical in the photo) */
  v: boolean;
  mark?: string;
  sticker?: string;
  socket?: boolean;
  window?: boolean;
  id?: string;
  snare?: boolean;
}
const VOICE_COLS: { name: string; n: number; px: number; sticker: string }[] = [
  { name: 'BASS', n: 1, px: 130, sticker: 'DX\nBASS' },
  { name: 'SNARE', n: 2, px: 245, sticker: 'DX SNARE\n64' },
  { name: 'HIHAT', n: 3, px: 357, sticker: 'DX HAT\n1A' },
  { name: 'TOMS', n: 4, px: 468, sticker: 'DX\nTOM' },
  { name: 'PERC', n: 6, px: 580, sticker: 'TAMBOURINE\nRIMSHOT' },
];
const SNARE_X = P(VOICE_COLS[1].px, 0)[0];

function boardChips(): ChipSpec[] {
  const out: ChipSpec[] = [];
  const c = (ref: string, px: number, py: number, pins: number, v: boolean, extra: Partial<ChipSpec> = {}): void => {
    const [x, z] = P(px, py);
    out.push({ ref, x, z, pins, v, ...extra });
  };
  for (const col of VOICE_COLS) {
    const s = col.n === 2;
    const r = (k: number): string => `U${col.n}0${k}`;
    c(r(1), col.px, 492, 14, true, { mark: 'CD4011BE', snare: s });
    c(r(4), col.px, 560, 14, true, { mark: 'CD4013BE', snare: s, socket: s });
    c(r(7), col.px, 628, 16, true, { mark: 'CD4040BE', snare: s, socket: s });
    c(r(6), col.px, 772, 28, true, { sticker: col.sticker, socket: true, snare: s });
    c(r(3), col.px - 18, 905, 16, true, { mark: 'AM6070', snare: s });
    c(r(8), col.px + 20, 905, 14, true, { mark: 'CD4013BE', snare: s, socket: s });
    c(r(9), col.px + 2, 966, 8, false, { mark: 'NE555', snare: s });
  }
  // cymbal section (bottom left)
  [290, 360, 430, 505].forEach((px, i) =>
    c(`U50${i + 1}`, px, 1062, 28, true, i === 3 ? { window: true, socket: true, mark: 'MBM2764' } : { sticker: `DX CYM\n${i + 1}.0`, socket: true }),
  );
  c('U505', 120, 1015, 14, false, { mark: 'CD4013BE' });
  c('U506', 120, 1060, 14, false, { mark: 'CD4040BE' });
  c('U507', 120, 1105, 14, false, { mark: 'CD4011BE' });
  c('U508', 190, 1105, 16, false, { mark: 'AM6070' });
  c('U509', 565, 1062, 16, true, { mark: 'CD4040BE' });
  c('U510', 625, 1040, 14, true, { mark: 'CD4013BE' });
  c('U511', 685, 1062, 14, true, { mark: 'TL082CP' });
  // CPU, memory, timing
  c('U704', 885, 425, 20, true, { mark: 'DM74LS244N', id: 'dx.u704' });
  c('U713', 989, 500, 28, false, { sticker: 'DX\n1.4 A', socket: true, id: 'dx.u713' });
  c('U714', 989, 568, 28, false, { sticker: 'DX\n1.4 B', socket: true, id: 'dx.u714' });
  [655, 720, 785, 850].forEach((py, i) => c(`U71${5 + i}`, 980, py, 24, false, { mark: 'HM6116P-4', socket: true, id: `dx.ram${i + 1}` }));
  c('U719', 975, 930, 20, false, { mark: 'DM74LS374N' });
  c('U709', 770, 845, 16, false, { mark: 'DM74LS42N', id: 'dx.u709' });
  c('U710', 770, 890, 16, false, { mark: 'MC14174BCP', id: 'dx.u710' });
  c('U711', 770, 935, 16, false, { mark: 'CD40103BE', id: 'dx.u711' });
  c('U705', 843, 520, 8, false, { mark: 'TL082CP' });
  c('U706', 810, 748, 14, false, { mark: 'CD4013BCN' });
  c('U720', 1140, 445, 14, false, { mark: 'HD74LS00P' });
  c('U721', 1145, 640, 14, false, { mark: 'DM74LS74N' });
  c('U723', 1150, 700, 14, false, { mark: 'CD4011BE' });
  c('U724', 1150, 760, 14, false, { mark: 'CD4071BE' });
  c('U725', 1150, 820, 16, false, { mark: 'CD4093BE' });
  c('U726', 1158, 937, 14, false, { mark: 'SN74LS393N' });
  c('U727', 1070, 300, 16, false, { mark: 'MC14174BCP' });
  return out;
}

function boardTexture(chips: ChipSpec[]): THREE.CanvasTexture {
  const W = 2048;
  const H = 1680;
  const x0 = -208;
  const z0 = -144;
  const BW = 350;
  const BD = 286;
  return textCanvas(W, H, (ctx) => {
    ctx.fillStyle = '#1c6a52';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.scale(W / BW, H / BD);
    const X = (x: number): number => x - x0;
    const Z = (z: number): number => z - z0;
    // copper traces under the mask
    const rnd = mulberry32(42);
    ctx.strokeStyle = 'rgba(70, 170, 125, 0.55)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      ctx.lineWidth = rnd() < 0.85 ? 0.45 : 1.1;
      let x = rnd() * BW;
      let z = rnd() * BD;
      ctx.beginPath();
      ctx.moveTo(x, z);
      for (let k = 0; k < 3; k++) {
        if ((k + i) % 2) x += (rnd() - 0.5) * 70;
        else z += (rnd() - 0.5) * 60;
        ctx.lineTo(Math.max(1, Math.min(BW - 1, x)), Math.max(1, Math.min(BD - 1, z)));
      }
      ctx.stroke();
    }
    // bus traces along the voice columns
    ctx.strokeStyle = 'rgba(70, 170, 125, 0.6)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 40; i++) {
      const x = X(-205 + i * 4.2);
      ctx.beginPath();
      ctx.moveTo(x, Z(-118));
      ctx.lineTo(x, Z(-64));
      ctx.stroke();
    }
    // ground-plane hatch (front centre)
    ctx.strokeStyle = 'rgba(80, 180, 135, 0.35)';
    ctx.lineWidth = 0.35;
    for (let k = -60; k < 180; k += 2.2) {
      ctx.beginPath();
      ctx.moveTo(X(-12 + k), Z(96));
      ctx.lineTo(X(-12 + k + 46), Z(142));
      ctx.stroke();
    }
    ctx.fillStyle = '#1c6a52';
    ctx.fillRect(X(-8), Z(112), 46, 29);
    // silkscreen
    const ink = '#e9efe9';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.3;
    for (const c of chips) {
      const len = (c.pins / 2) * 2.54 + 2.2;
      const w = (c.pins >= 24 ? 13.6 : 6.4) + 2.6;
      const [a, b] = c.v ? [w, len] : [len, w];
      ctx.strokeRect(X(c.x) - a / 2, Z(c.z) - b / 2, a, b);
      const lx = c.v ? X(c.x) - a / 2 - 1.2 : X(c.x) - a / 2;
      const lz = c.v ? Z(c.z) + b / 2 + 1.8 : Z(c.z) - b / 2 - 1.3;
      txt(ctx, c.ref, lx, lz, 2.0, { color: ink, align: c.v ? 'left' : 'left', cond: 0.85 });
    }
    // U701..U703 outlines (separate objects)
    for (let k = 0; k < 3; k++) {
      ctx.strokeRect(X(U701_POS.x + k * 13.3) - 4.6, Z(U701_POS.z) - 11.5, 9.2, 23);
      txt(ctx, `U70${k + 1}`, X(U701_POS.x + k * 13.3) - 3.5, Z(U701_POS.z) + 14, 2.0, { color: ink, align: 'left' });
    }
    ctx.strokeRect(X(P(1012, 412)[0]) - 27, Z(P(1012, 412)[1]) - 9.5, 54, 19);
    txt(ctx, 'U712', X(P(1012, 412)[0]) - 27, Z(P(1012, 412)[1]) + 11.5, 2.2, { color: ink, align: 'left' });
    const lbl = (s: string, px: number, py: number, size = 2.0, o: TxtOpts = {}): void => {
      const [x, z] = P(px, py);
      txt(ctx, s, X(x), Z(z), size, { color: ink, ...o });
    };
    VOICE_COLS.forEach((c) => lbl(c.name, c.px, 988, 3.4));
    lbl('CYMBAL', 175, 1148, 3.4);
    lbl('C701', 860, 340);
    lbl('C702', 990, 340);
    lbl('C723', 1215, 305);
    lbl('R791', 1100, 975, 1.8);
    lbl('R792', 1143, 1000, 1.8);
    lbl('Q709', 1218, 960, 1.8);
    lbl('R793', 1240, 968, 1.8);
    lbl('D709', 1240, 1022, 1.8);
    lbl('B1', 1225, 905, 2.4);
    lbl('CR701', 1262, 575, 1.8);
    lbl('G', 1128, 340, 2.4);
    lbl('C', 182, 268, 2.4);
    lbl('D', 92, 735, 2.4);
    lbl('+', 1263, 860, 6);
    lbl('+', 860, 382, 4);
    lbl('+', 735, 382, 4);
    // +5 test pad
    const [tpx, tpz] = P(1137, 359);
    ctx.fillStyle = '#d6b45c';
    ctx.beginPath();
    ctx.arc(X(tpx), Z(tpz), 1.7, 0, Math.PI * 2);
    ctx.fill();
    txt(ctx, '+5', X(tpx) - 4, Z(tpz), 2.2, { color: ink });
    // title, warning
    const [tx, tz] = P(800, 1100);
    ['OBERHEIM', 'DX', 'PROCESSOR', 'BOARD'].forEach((l, i) => txt(ctx, l, X(tx), Z(tz) + i * 4, 3.1, { color: ink, align: 'left', bold: false }));
    txt(ctx, '1721A', X(tx) + 50, Z(tz) + 14, 2.4, { color: ink, align: 'left', bold: false });
    const [wx, wz] = P(1125, 1035);
    const warn = ['--WARNING--', 'REMOVING BATTERY, U715, U716,', 'U717, U718, U724, R793, OR D709', 'WILL ERASE PROGRAM MEMORY. SAVE', 'TO CASSETTE FIRST.'];
    warn.forEach((l, i) => txt(ctx, l, X(wx), Z(wz) + i * 3.2, 2.3, { color: ink, align: i === 0 ? 'center' : 'left', bold: false, cond: 0.8 }));
    const [mx, mz] = P(1280, 1150);
    txt(ctx, 'MADE IN USA', X(mx), Z(mz), 1.8, { color: ink });
    // mounting-hole rings
    for (const [hx, hz] of BOARD_SCREWS) {
      ctx.fillStyle = '#c9b16a';
      ctx.beginPath();
      ctx.arc(X(hx), Z(hz), 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}
const BOARD_SCREWS: [number, number][] = [
  [-202, -138],
  [136, -138],
  [-202, 136],
  [136, 136],
  [-62, -40],
  [P(1265, 680)[0], P(1265, 680)[1]],
  [P(630, 1135)[0], P(630, 1135)[1]],
];

// ------------------------------------------------------------------ build
export function buildDXV2(reg: Registry): BuiltDX {
  const root = new THREE.Group();
  root.name = 'dx.root';
  const atlas = new Atlas();

  // =============================================================== exterior (base)
  const ext = new THREE.Group();
  root.add(ext);
  // bottom tray
  box(2 * DX.inner, 1.5, 298, M.inner, 0, 0, 0, ext);
  // rear panel (inside face plain, outside face = textured plane)
  box(2 * DX.inner, DX.rearH, 1.5, M.paint, 0, 0, DX.rearZ + 0.75, ext);
  const rearFace = mesh(new THREE.PlaneGeometry(REAR_W, DX.rearH), new THREE.MeshStandardMaterial({ map: rearTexture(), roughness: 0.62, metalness: 0.3 }), 0, DX.rearH / 2, DX.rearZ - 0.3, ext);
  rearFace.rotation.y = Math.PI;
  // piano hinge along the top of the rear panel
  cyl(2.3, 2 * DX.inner - 4, M.steel, 'x', 0, DX.rearH, DX.rearZ - 1.6, ext, 12);
  // low front flange of the base (behind the lid's front lip)
  box(2 * DX.inner, 6, 1.5, M.paint, 0, 0, DX.frontZ - 2.5, ext);

  // wooden end cheeks: wedge profile, 4 mm proud of the lid
  const woodMat = new THREE.MeshStandardMaterial({ map: wood(), roughness: 0.55, metalness: 0.0 });
  const sh = new THREE.Shape();
  const zr = DX.rearZ - 2;
  const zf = DX.frontZ + 2;
  sh.moveTo(zr, 0);
  sh.lineTo(zf - 3, 0);
  sh.quadraticCurveTo(zf, 0, zf, 3);
  sh.lineTo(zf, DX.frontH + 4 - 7);
  sh.quadraticCurveTo(zf, DX.frontH + 4, zf - 7, DX.frontH + 4 + 1.6);
  sh.lineTo(zr + 6, DX.lidRearY + 4);
  sh.quadraticCurveTo(zr, DX.lidRearY + 4 + 1.4, zr, DX.lidRearY - 2);
  sh.closePath();
  const cheekGeo = new THREE.ExtrudeGeometry(sh, { depth: DX.cheekT - 2.4, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 8 });
  for (const sx of [DX.inner + DX.cheekT - 1.2, -DX.inner - 1.2]) {
    const cheek = new THREE.Mesh(cheekGeo, woodMat);
    cheek.rotation.y = -Math.PI / 2;
    cheek.position.x = sx;
    ext.add(cheek);
  }
  // rubber feet
  for (const fx of [-180, 180]) for (const fz of [-130, 130]) cyl(7, 2, M.socket, 'y', fx, -0.6, fz, ext, 16);

  // rear-panel hardware -----------------------------------------------------------
  const out = DX.rearZ; // outside face
  // tuning pots: body behind the panel, bushing + nut + bare knurled shaft outside
  TUNING_POTS.forEach((n, i) => {
    const x = potX(i);
    cyl(7.4, 7, M.steel, 'z', x, POT_Y, out + 6.5, ext, 20);
    cyl(3.6, 5, M.metal, 'z', x, POT_Y, out - 2.5, ext, 14);
    cyl(5.2, 1.6, M.metal, 'z', x, POT_Y, out - 0.9, ext, 6);
    cyl(3.0, 9, M.metal, 'z', x, POT_Y, out - 8.5, ext, 14);
    cyl(1.0, 0.4, M.dark, 'z', x, POT_Y, out - 13.1, ext, 6);
    reg.addAnchor(`dx.pot.${n.toLowerCase().replace(/[^a-z]/g, '')}`, root, new THREE.Vector3(x, POT_Y, out - 13));
  });
  // jacks other than the two clock jacks (those are separate, highlightable objects)
  /** Board-mounted 1/4" jack: body behind the panel, bushing + nut + hole outside. `baseY` = parent's y. */
  const jackParts = (parent: THREE.Object3D, ox: number, baseY: number, oz: number): void => {
    box(15, 20.5, 22, M.chip, ox, DX.boardTop - baseY, oz + 12.5, parent);
    cyl(4.8, 4, M.metal, 'z', ox, JACK_Y - baseY, oz - 1.5, parent, 18);
    cyl(6.4, 1.8, M.metal, 'z', ox, JACK_Y - baseY, oz - 1.2, parent, 6);
    const h = new THREE.Mesh(new THREE.CircleGeometry(3.2, 18), M.hole);
    h.rotation.y = Math.PI;
    h.position.set(ox, JACK_Y - baseY, oz - 3.55);
    parent.add(h);
  };
  JACKS.forEach((_, i) => {
    if (i < 2) return;
    jackParts(ext, jackX(i), 0, out);
    reg.addAnchor(`dx.jack.${JACK_IDS[i]}`, root, new THREE.Vector3(jackX(i), JACK_Y, out - 4));
  });
  // cassette RCA jacks and slide switches
  for (const px of [975, 1040]) {
    const x = rx(px);
    cyl(4.3, 7, M.metal, 'z', x, 63.5, out - 3.5, ext, 18);
    cyl(1.6, 7.2, M.socket, 'z', x, 63.5, out - 3.6, ext, 10);
    cyl(5.5, 9, M.chip, 'z', x, 63.5, out + 5, ext, 12);
  }
  for (const [px, y] of [[905, 61], [780, 62]] as [number, number][]) {
    box(3.4, 3.4, 3, M.socket, rx(px), y + 1.5, out - 1.5, ext);
    box(3, 10, 6, M.chip, rx(px), y - 5 + 4.5, out + 3, ext);
  }
  // PSU heatsink on the outside (left as seen from behind) + mains cord grommet
  box(72, 58, 3, M.paint, 175, 25, out - 1.5, ext);
  for (let k = 0; k < 15; k++) box(1.4, 58, 11, M.paint, 141 + k * 4.8, 25, out - 3 - 5.5, ext);
  cyl(10.5, 16, M.socket, 'z', 196, 47, out - 19, ext, 8);
  cyl(4.2, 6, M.socket, 'z', 196, 47, out - 29, ext, 12);
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(196, 47, out - 30), new THREE.Vector3(196, 40, out - 55), new THREE.Vector3(200, 6, out - 80), new THREE.Vector3(210, 3, out - 140)]);
  mesh(new THREE.TubeGeometry(cord, 24, 3.2, 8), M.socket, 0, 0, 0, ext);
  // screws
  const screw = (x: number, y: number, z: number, axis: 'y' | 'z', parent: THREE.Object3D, r = 2.4): void => {
    cyl(r, 1.1, M.metal, axis, x, y, z, parent, 12);
  };
  for (const [px, py] of [[165, 97], [740, 97], [1290, 97], [1180, 130], [1480, 130], [1170, 235], [1465, 235], [365, 210]] as [number, number][]) {
    screw(rx(px), ry(py), out - 0.5, 'z', ext);
  }
  root.updateMatrixWorld(true);
  mergeInto(ext);
  reg.addObject('dx.chassis', ext, new THREE.Vector3(0, DX.lidRearY, 0));
  reg.addAnchor('dx.rearPanel', root, new THREE.Vector3(-100, 60, out - 2));

  // clock jacks (highlightable)
  for (let i = 0; i < 2; i++) {
    const j = new THREE.Group();
    jackParts(j, 0, DX.boardTop, 0);
    j.position.set(jackX(i), DX.boardTop, out);
    root.add(j);
    j.updateMatrixWorld(true);
    mergeInto(j);
    reg.addObject(`dx.jack.${JACK_IDS[i]}`, j, new THREE.Vector3(0, JACK_Y - DX.boardTop, -4));
  }

  // =============================================================== lid (whole top panel, hinged at the rear)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, DX.rearH, DX.rearZ);
  root.add(lidPivot);
  const pf = new THREE.Group(); // panel frame: x across, z down the slope, y out of the panel
  pf.position.set(0, DX.lidRearY - DX.rearH, 0);
  pf.rotation.x = SLOPE;
  lidPivot.add(pf);
  const S = (s: number): number => s - LID_W / 2;
  // sheet, flanges, lips
  box(LID_W, 1.5, LID_L, M.paint, 0, -1.5, LID_L / 2, pf);
  const face = mesh(new THREE.PlaneGeometry(LID_W, LID_L), new THREE.MeshStandardMaterial({ map: panelTexture(), roughness: 0.62, metalness: 0.25 }), 0, 0.04, LID_L / 2, pf);
  face.rotation.x = -Math.PI / 2;
  for (const s of [-1, 1]) box(1.2, 16, LID_L - 4, M.inner, s * (LID_W / 2 - 0.6), -16, LID_L / 2, pf);
  box(LID_W, DX.lidRearY - DX.rearH + 0.5, 1.5, M.paint, 0, -0.5, -0.75, lidPivot); // rear lip
  const lipTop = DX.frontH - DX.rearH;
  const lipH = DX.frontH - 4;
  box(LID_W, lipH, 1.5, M.paint, 0, lipTop - lipH, DX.D + 0.75, lidPivot); // front lip
  for (const s of [49, 374]) screw(S(s), lipTop - lipH + 7, DX.D + 1.6, 'z', lidPivot, 2.2);
  for (const px of [160, 740, 1290]) screw(rx(px), 8, -1.8, 'z', lidPivot, 2.3);
  // keys
  const keyGeo = new Map<string, THREE.BufferGeometry>();
  const keyG = (w: number, h: number, d: number): THREE.BufferGeometry => {
    const k = `${w}|${h}|${d}`;
    let g = keyGeo.get(k);
    if (!g) {
      g = new RoundedBoxGeometry(w, h, d, 2, 1.1);
      keyGeo.set(k, g);
    }
    return g;
  };
  const ledGeo = new THREE.SphereGeometry(1.15, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const key = (s: number, t: number, w: number, d: number, h: number, mat: THREE.Material, led = false): void => {
    mesh(keyG(w, h, d), mat, S(s), h / 2 - 0.5, t, pf);
    if (led) mesh(ledGeo, M.led, S(s) - w / 2 + 3.2, h - 0.5, t - d / 2 + 3.4, pf);
  };
  for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) key(padS(c), padT(r), PAD, PAD, 5.5, M.key);
  FN.s.forEach((s) => key(s, FN.t, 18.6, 19, 5.5, M.key, true));
  key(PLAY.s, PLAY.t, 19, 19, 5.5, M.keyWhite, true);
  CAS_T.forEach((t, r) => CAS_S.forEach((s, i) => key(s, t, 18.8, 19, 5.5, r === 1 && i === 0 ? M.keyRed : M.key, true)));
  KEY_S.forEach((s, ci) =>
    KEY_T.forEach((t, ri) => {
      key(s, t, 18, 20.2, 5.5, M.key);
      const lg = mesh(atlas.quad(9, 9, atlas.legend(KEY_LEGENDS[ri * 3 + ci])), atlas.mat, S(s), 5.03, t, pf);
      void lg;
    }),
  );
  // faders: black cap with a brushed-metal top, stem into the slot
  SLIDERS.forEach((_, i) => {
    const s = S(sliderS(i));
    const t = SLIDER_CAP_T[i];
    box(1.6, 3, 4, M.socket, s, 0, t, pf);
    box(13.5, 8.5, 13, M.key, s, 2.5, t, pf);
    box(13.7, 1.4, 10, M.metal, s, 10.7, t + 1, pf);
    box(8, 18, 70, M.chip, s, -21, (SLOT_T[0] + SLOT_T[1]) / 2, pf); // fader body under the panel
  });
  // display window
  const dW = DISPLAY.s1 - DISPLAY.s0;
  const dD = DISPLAY.t1 - DISPLAY.t0;
  const dispMat = new THREE.MeshStandardMaterial({ color: 0x1c0303, emissive: 0xffffff, emissiveMap: displayTexture(), emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.0 });
  const disp = mesh(new THREE.PlaneGeometry(dW, dD), dispMat, S((DISPLAY.s0 + DISPLAY.s1) / 2), 0.25, (DISPLAY.t0 + DISPLAY.t1) / 2, pf);
  disp.rotation.x = -Math.PI / 2;
  // power switch (red rocker in a black housing)
  box(19, 3.2, 10, M.socket, S(POWER.s), -1, POWER.t, pf);
  const rocker = box(13, 3.4, 7, M.red, S(POWER.s), 1.2, POWER.t, pf);
  rocker.rotation.x = -0.18;
  // underside: switch board, slider board, display board, ribbon stubs
  box(400, 1.6, 215, M.pcbLid, 0, -13, 190, pf);
  box(340, 1.6, 86, M.pcbLid, S(170), -11.5, (SLOT_T[0] + SLOT_T[1]) / 2, pf);
  box(68, 1.6, 34, M.pcbLid, S(379), -9, 100, pf);
  box(26, 0.8, 70, M.ribbon, S(30), -15, 70, pf);
  box(26, 0.8, 70, M.ribbon, S(280), -15, 70, pf);
  lidPivot.updateMatrixWorld(true);
  mergeInto(lidPivot);
  reg.addObject('dx.lid', lidPivot, new THREE.Vector3(0, 0, 40));

  // =============================================================== main board
  const chips = boardChips();
  const board = new THREE.Group();
  const bx0 = -208;
  const bz0 = -144;
  const BW = 350;
  const BD = 286;
  box(BW, DX.boardT - 0.05, BD, M.pcb, bx0 + BW / 2, DX.boardY, bz0 + BD / 2, board);
  const top = mesh(new THREE.PlaneGeometry(BW, BD), new THREE.MeshStandardMaterial({ map: boardTexture(chips), roughness: 0.55, metalness: 0.05 }), bx0 + BW / 2, DX.boardTop, bz0 + BD / 2, board);
  top.rotation.x = -Math.PI / 2;
  root.add(board);
  board.updateMatrixWorld(true);
  mergeInto(board);
  reg.addObject('dx.board', board, new THREE.Vector3(0, DX.boardTop, 0));

  const inner = new THREE.Group(); // static interior parts, merged at the end
  root.add(inner);
  const onBoard = (o: THREE.Object3D, x: number, z: number, rotY = 0, parent: THREE.Object3D = inner): THREE.Object3D => {
    o.position.set(x, DX.boardTop, z);
    o.rotation.y = rotY;
    parent.add(o);
    return o;
  };

  // snare voice column = its own object (highlighted in the trigger stages)
  const snareCol = new THREE.Group();
  root.add(snareCol);
  const chipAt = new Map<string, ChipSpec>();
  for (const c of chips) {
    chipAt.set(c.ref, c);
    const d = dip(atlas, c.pins, c);
    onBoard(d, c.x, c.z, c.v ? Math.PI / 2 : 0, c.snare ? snareCol : inner);
    if (c.id) reg.addAnchor(c.id, root, new THREE.Vector3(c.x, DX.boardTop + 6, c.z));
  }
  const at = (ref: string): THREE.Vector3 => {
    const c = chipAt.get(ref);
    return c ? new THREE.Vector3(c.x, DX.boardTop + 6, c.z) : new THREE.Vector3();
  };
  // passives along the snare column belong to it too
  const rnd = mulberry32(1983);
  const passives = (x0: number, x1: number, z0: number, z1: number, n: number, parent: THREE.Object3D): void => {
    for (let i = 0; i < n; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const z = z0 + rnd() * (z1 - z0);
      const k = rnd();
      if (k < 0.62) {
        const r = resistor(rnd() < 0.7 ? M.resBeige : M.resBlue);
        onBoard(r, x, z, rnd() < 0.7 ? Math.PI / 2 : 0, parent);
      } else if (k < 0.78) {
        const m = cyl(2.6, 1.6, rnd() < 0.5 ? M.ceramicOrange : M.capBlue, 'z', 0, 3.2, 0);
        onBoard(m, x, z, 0, parent);
        m.position.y += 3;
      } else if (k < 0.9) {
        onBoard(boxOnFloor(7, 6, 3, rnd() < 0.5 ? M.filmRed : M.ceramicOrange), x, z, rnd() < 0.5 ? Math.PI / 2 : 0, parent);
      } else {
        const e = new THREE.Group();
        cyl(2.6, 6.5, rnd() < 0.6 ? M.capBlue : M.chip, 'y', 0, 3.25, 0, e, 14);
        cyl(2.2, 0.2, M.capGrey, 'y', 0, 6.55, 0, e, 14);
        onBoard(e, x, z, 0, parent);
      }
    }
  };
  for (const col of VOICE_COLS) {
    const [cx] = P(col.px, 0);
    passives(cx - 13, cx + 13, -116, -66, 34, col.n === 2 ? snareCol : inner);
    passives(cx - 13, cx + 13, 48, 76, 6, col.n === 2 ? snareCol : inner);
  }
  passives(-206, -195, -110, 90, 26, inner); // left edge
  passives(-14, 22, -36, 34, 26, inner);
  passives(105, 140, -26, 38, 22, inner);
  passives(-32, -14, 96, 134, 8, inner);
  passives(26, 74, -66, -62, 5, inner);
  snareCol.updateMatrixWorld(true);
  mergeInto(snareCol);
  reg.addObject('dx.snareVoice', snareCol, new THREE.Vector3(SNARE_X, DX.boardTop + 5, -20));
  reg.addAnchor('dx.u206', root, at('U206'));
  reg.addAnchor('dx.u207', root, at('U207'));
  reg.addAnchor('dx.u204', root, at('U204'));
  reg.addAnchor('dx.u209', root, at('U209'));
  for (const col of VOICE_COLS) if (col.n !== 2) reg.addAnchor(`dx.voice.${col.name.toLowerCase()}`, root, new THREE.Vector3(P(col.px, 0)[0], DX.boardTop + 5, -20));
  reg.addAnchor('dx.voice.cymbal', root, new THREE.Vector3(-110, DX.boardTop + 5, 112));

  // C701 / C702: grey axial 470 µF capacitors lying across the board above U701–U704
  const axial = (x: number, z: number, len: number, r: number, mat: THREE.Material, axis: 'x' | 'z'): void => {
    cyl(r, len, mat, axis, x, DX.boardTop + r + 0.4, z, inner, 20);
    for (const s of [-1, 1]) {
      const dx = axis === 'x' ? s * (len / 2 + 1.5) : 0;
      const dz = axis === 'z' ? s * (len / 2 + 1.5) : 0;
      cyl(0.35, 3, M.pin, axis, x + dx, DX.boardTop + r + 0.4, z + dz, inner, 5);
    }
  };
  for (const [px, id] of [[778, 'dx.c701'], [912, 'dx.c702']] as [number, string][]) {
    const [x, z] = P(px, 359);
    axial(x, z, 25, 5.2, M.capGrey, 'x');
    cyl(5.25, 2.2, M.chip, 'x', x + 9, DX.boardTop + 5.6, z, inner, 20);
    reg.addAnchor(id, root, new THREE.Vector3(x, DX.boardTop + 11, z));
  }
  // C723: the big 10 000 µF reservoir can lying along z, with a cable tie
  {
    const [x, z] = P(1243, 374);
    cyl(12, 46, M.capGrey, 'z', x, DX.boardTop + 12.3, z, inner, 28);
    cyl(12.3, 3, M.white, 'z', x, DX.boardTop + 12.3, z - 2, inner, 28);
    cyl(9, 1, M.chip, 'z', x, DX.boardTop + 12.3, z + 23.2, inner, 20);
    reg.addAnchor('dx.c723', root, new THREE.Vector3(x, DX.boardTop + 25, z));
  }
  // voltage regulators on black U-heatsinks (behind C701/C702)
  for (const px of [777, 912]) {
    const [x, z] = P(px, 290);
    box(24, 2, 16, M.paint, x, DX.boardTop, z, inner);
    for (const s of [-1, 1]) box(2, 20, 16, M.paint, x + s * 11, DX.boardTop, z, inner);
    box(10, 15, 4.5, M.chip, x, DX.boardTop + 4, z + 2, inner);
    box(10, 6, 1.2, M.metal, x, DX.boardTop + 18, z - 0.6, inner);
    cyl(2.6, 4, M.metal, 'z', x, DX.boardTop + 14, z - 2, inner, 6);
  }
  // Z80 (registered: the walkthrough labels it)
  {
    const [x, z] = P(1012, 412);
    const z80 = dip(atlas, 40, { mark: 'NEC D780C-1\n8324X5', socket: true });
    onBoard(z80, x, z, 0, root);
    z80.updateMatrixWorld(true);
    mergeInto(z80);
    reg.addObject('dx.z80', z80);
  }
  // crystal oscillator can, bridge rectifier
  {
    const [x, z] = P(1160, 417);
    box(11, 7, 13, M.steel, x, DX.boardTop, z, inner);
    const [bx, bz] = P(1261, 537);
    cyl(5.2, 6, M.chip, 'y', bx, DX.boardTop + 3, bz, inner, 18);
  }
  // connectors: C and G (blue headers with light-blue ribbon stubs to the lid), D (white, tuning harness), others
  for (const [px, py] of [[150, 258], [1065, 325]] as [number, number][]) {
    const [x, z] = P(px, py);
    box(32, 9, 10, M.blue, x, DX.boardTop, z, inner);
    box(26, 22, 0.8, M.ribbon, x, DX.boardTop + 9, z, inner);
  }
  const [hdx, hdz] = P(70, 705);
  box(6, 9, 22, M.white, hdx, DX.boardTop, hdz, inner);
  reg.addAnchor('dx.headerD', root, new THREE.Vector3(hdx, DX.boardTop + 9, hdz));
  for (const [px, py] of [[749, 560], [1300, 740]] as [number, number][]) {
    const [x, z] = P(px, py);
    box(5, 7, 24, M.white, x, DX.boardTop, z, inner);
  }
  // board screws
  for (const [x, z] of BOARD_SCREWS) cyl(2.8, 1.4, M.metal, 'y', x, DX.boardTop + 0.7, z, inner, 14);
  const [tpx, tpz] = P(1137, 359);
  reg.addAnchor('dx.testpad', root, new THREE.Vector3(tpx, DX.boardTop, tpz));

  // board-mounted jacks behind the panel are in `ext` (and the two clock jacks above)

  // transformer and the mains bracket (right of the board, on the chassis floor)
  {
    const [x, z] = P(1440, 560);
    box(46, 52, 64, M.steel, x, 1.5, z, inner); // laminations
    box(54, 40, 36, M.tapeYellow, x, 7, z, inner); // windings
    box(30, 4, 62, M.steel, x, 1.5, z, inner); // clamp
    for (const s of [-1, 1]) box(56, 2, 10, M.steel, x, 1.5, z + s * 34, inner); // feet
    const [mx, mz] = P(1440, 210);
    box(58, 40, 30, M.steel, mx, 1.5, mz, inner);
    box(10, 6, 5, M.chip, mx - 5, 41.5, mz + 4, inner);
    // transformer wires to the board header
    const [hx, hz] = P(1300, 740);
    const wireCols = [M.red, M.yellow, M.ceramicOrange, M.red, M.yellow];
    wireCols.forEach((mat, k) => {
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x - 20 + k * 1.6, 30, z + 20),
        new THREE.Vector3(x - 30, 22 + k, z + 34),
        new THREE.Vector3(hx + 8, 16, hz - 6 + k * 3),
        new THREE.Vector3(hx, DX.boardTop + 9, hz - 8 + k * 4),
      ]);
      mesh(new THREE.TubeGeometry(c, 24, 0.8, 6), mat, 0, 0, 0, inner);
    });
  }

  // tuning-pot PCB behind the rear panel (horizontal) with its white header and the harness to D
  const tune = new THREE.Group();
  box(126, 1.6, 30, M.pcb, -150, POT_Y - 9.2, out + 17, tune);
  box(24, 8, 6, M.white, -152, POT_Y - 7.6, out + 26, tune);
  resistor(M.resBeige, tune).position.set(-118, POT_Y - 7.6, out + 26);
  resistor(M.resBeige, tune).position.set(-180, POT_Y - 7.6, out + 26);
  root.add(tune);
  tune.updateMatrixWorld(true);
  mergeInto(tune);
  reg.addObject('dx.tunePCB', tune);
  const harnessCols = [M.yellow, M.ceramicOrange, M.red, std(0x7b4bb0), M.blue, std(0x2f8a3a), MAT.wireBlack, M.white];
  harnessCols.forEach((mat, k) => {
    const o = (k - 3.5) * 1.5;
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-152 + o, POT_Y - 3.6, out + 26),
      new THREE.Vector3(-158 + o, POT_Y + 4, out + 40),
      new THREE.Vector3(-196 + o * 0.6, 34, -90),
      new THREE.Vector3(-203 + o * 0.4, 22, -30),
      new THREE.Vector3(hdx + o * 0.3, DX.boardTop + 9, hdz),
    ]);
    mesh(new THREE.TubeGeometry(c, 40, 0.75, 6), mat, 0, 0, 0, inner);
  });
  reg.addAnchor('dx.harness', root, new THREE.Vector3(-196, 34, -90));

  // =============================================================== U701 socket + chip, U702, U703
  const u701 = new THREE.Group();
  const sock = new THREE.Group();
  const sL = 8 * 2.54 + 1.2;
  for (const z of [3.81, -3.81]) box(sL, 3.2, 2.5, M.socket, 0, 0, z, sock);
  for (const x of [-sL / 2 + 0.9, sL / 2 - 0.9]) box(1.8, 3.2, 5.2, M.socket, x, 0, 0, sock);
  const holeGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8);
  for (let n = 1; n <= 16; n++) {
    const [px, pz] = dipPinLocal(n);
    mesh(holeGeo, MAT.gold, px, 3.25, pz, sock);
  }
  u701.add(sock);
  const u701Chip = new THREE.Group();
  const chipBody = dip(atlas, 16, { mark: 'MC14174BCP\nFF8321' });
  chipBody.position.y = 2.5;
  u701Chip.add(chipBody);
  u701.add(u701Chip);
  onBoard(u701, U701_POS.x, U701_POS.z, Math.PI / 2, root);
  mergeInto(sock);
  u701Chip.updateMatrixWorld(true);
  mergeInto(u701Chip);
  reg.addObject('dx.u701chip', u701Chip, new THREE.Vector3(0, 7, 0));
  reg.addObject('dx.u701', u701, new THREE.Vector3(0, 7, 0));
  for (let n = 1; n <= 16; n++) {
    const [px, pz] = dipPinLocal(n);
    reg.addAnchor(`dx.u701.${n}`, u701, new THREE.Vector3(px, 3.4, pz));
  }
  for (const k of [2, 3]) {
    const d = dip(atlas, 16, { mark: 'MC14174BCP\nFF8321', socket: true });
    onBoard(d, U701_POS.x + (k - 1) * 13.3, U701_POS.z, Math.PI / 2, root);
    d.updateMatrixWorld(true);
    mergeInto(d);
    reg.addObject(`dx.u70${k}`, d);
  }

  // =============================================================== clock-out node: R788–R791, R792, Q709, R793, D709, B1
  const mkRes = (mat: THREE.Material, x: number, z: number, rotY: number, id?: string): THREE.Group => {
    const g = resistor(mat);
    onBoard(g, x, z, rotY, id ? root : inner);
    if (id) {
      g.updateMatrixWorld(true);
      mergeInto(g);
      reg.addObject(id, g);
    }
    return g;
  };
  for (const px of [1079, 1091, 1102]) {
    const [x, z] = P(px, 942);
    mkRes(M.resBeige, x, z, Math.PI / 2);
  }
  mkRes(M.resBeige, R791_POS.x, R791_POS.z, Math.PI / 2, 'dx.r791');
  // R791 lies along z; its lead towards the front (+z) is the Q709-collector side = CLOCK OUT node (findings d4).
  reg.addAnchor('dx.r791.q', root, new THREE.Vector3(R791_POS.x, DX.boardTop + 2, R791_POS.z + 5.08));
  const [r792x, r792z] = P(1143.5, 979.5);
  mkRes(M.resBeige, r792x, r792z, 0, 'dx.r792');
  const [r793x, r793z] = P(1240, 985);
  mkRes(M.resBeige, r793x, r793z, 0);
  {
    const [dx709, dz709] = P(1240, 1005);
    const d = resistor(std(0xd27a44, 0.3, 0.1));
    onBoard(d, dx709, dz709, 0);
    d.scale.set(1, 0.8, 0.8);
  }
  const [q709x, q709z] = P(1182, 970);
  const q709 = new THREE.Group();
  const qb = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.6, 16, 1, false, 0, Math.PI), MAT.chip);
  qb.position.y = 5.3;
  q709.add(qb);
  const qf = box(4.8, 4.6, 0.05, MAT.chip, 0, 3, 0, q709);
  void qf;
  for (const x of [-1.27, 0, 1.27]) box(0.42, 3.2, 0.42, M.pin, x, 0, 0.6, q709);
  onBoard(q709, q709x, q709z, 0, root);
  q709.updateMatrixWorld(true);
  mergeInto(q709);
  reg.addObject('dx.q709', q709);
  // Emitter leg (Q709 emitter goes to GND, findings d1). Which physical leg it is: TO BE CONFIRMED.
  reg.addAnchor('dx.q709.e', root, new THREE.Vector3(q709x - 1.27, DX.boardTop + 2.6, q709z + 0.6));
  // B1: yellow lithium cell lying along z, with a cable tie
  const [b1x, b1z] = P(1268, 894);
  const b1g = new THREE.Group();
  cyl(8.4, 34, M.yellow, 'z', 0, 8.8, 0, b1g, 24);
  cyl(8.7, 4, M.white, 'z', 0, 8.8, -6, b1g, 24);
  cyl(2.8, 1.2, M.metal, 'z', 0, 8.8, 17.6, b1g, 12);
  onBoard(b1g, b1x, b1z, 0, root);
  b1g.updateMatrixWorld(true);
  mergeInto(b1g);
  reg.addObject('dx.b1', b1g);

  inner.updateMatrixWorld(true);
  mergeInto(inner);

  // =============================================================== the new SNARE DELAY pot (appears during install step 3)
  const outside = new THREE.Group();
  cyl(3, 12, MAT.metal, 'z', 0, 0, -10, outside, 16);
  cyl(6, 2.5, MAT.metal, 'z', 0, 0, -2, outside, 6);
  cyl(6.5, 12, std(0x111114, 0.5), 'z', 0, 0, -12, outside, 24, 7);
  box(1, 1, 6, MAT.white, 0, 4.5, -16, outside);
  outside.position.set(DELAY_POT.x, DELAY_POT.y, DX.rearZ);
  const inside = new THREE.Group();
  cyl(8.5, 9, MAT.potBody, 'z', 0, 0, 8, inside, 24);
  // three solder lugs, pointing down. Seen from the shaft side (behind the DX), the
  // left lug (world +x) is the CCW end.
  for (const lx of [5, 0, -5]) box(1.8, 7, 0.5, MAT.metal, lx, -14, 10, inside);
  inside.position.set(DELAY_POT.x, DELAY_POT.y, DX.rearZ + 2.5);
  const potGroup = new THREE.Group();
  potGroup.add(outside, inside);
  root.add(potGroup);
  reg.addObject('dx.delayPot', potGroup, new THREE.Vector3(DELAY_POT.x, DELAY_POT.y + 8, DX.rearZ - 14));
  reg.addAnchor('dx.delayPot.ccw', root, new THREE.Vector3(DELAY_POT.x + 5, DELAY_POT.y - 13, DX.rearZ + 12.5));
  reg.addAnchor('dx.delayPot.wiper', root, new THREE.Vector3(DELAY_POT.x, DELAY_POT.y - 13, DX.rearZ + 12.5));
  reg.addAnchor('dx.delayPot.cw', root, new THREE.Vector3(DELAY_POT.x - 5, DELAY_POT.y - 13, DX.rearZ + 12.5));
  reg.addAnchor('dx.delayPot.inside', root, new THREE.Vector3(DELAY_POT.x, DELAY_POT.y, DX.rearZ + 12));
  const legendTex = textCanvas(512, 128, (ctx) => {
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = '#f0f0f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 40px ${SANS}`;
    ctx.fillText('SNARE DELAY', 256, 34);
    ctx.font = `bold 34px ${SANS}`;
    ctx.fillText('0 ◄──► 1 BEAT', 256, 92);
  });
  const legend = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), new THREE.MeshBasicMaterial({ map: legendTex, transparent: true }));
  legend.rotation.y = Math.PI;
  legend.position.set(DELAY_POT.x, DELAY_POT.y - 10.5, DX.rearZ - 0.45);
  root.add(legend);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24), MAT.hole);
  hole.rotation.y = Math.PI;
  hole.position.set(DELAY_POT.x, DELAY_POT.y, DX.rearZ - 0.4);
  root.add(hole);
  reg.addAnchor('dx.delayHole', root, new THREE.Vector3(DELAY_POT.x, DELAY_POT.y, DX.rearZ - 0.6));

  // =============================================================== snare "hit" visual
  const u207 = at('U207');
  const snareRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  snareRing.rotation.x = -Math.PI / 2;
  snareRing.position.set(SNARE_X, DX.boardTop + 7, u207.z);
  root.add(snareRing);
  const snareGlow = new THREE.Mesh(
    new THREE.BoxGeometry(30, 2, 150),
    new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  snareGlow.position.set(SNARE_X, DX.boardTop + 1.2, 6);
  root.add(snareGlow);

  // =============================================================== anchors
  reg.addAnchor('dx.rear', root, new THREE.Vector3(-60, 50, DX.rearZ));
  reg.addAnchor('dx.center', root, new THREE.Vector3(0, 88, 0));
  reg.addAnchor('dx.inside', root, new THREE.Vector3(0, DX.boardTop, -20));
  reg.addAnchor('dx.cpuArea', root, new THREE.Vector3(50, DX.boardTop, -50));
  const [mcx, mcz] = P(860, 1110);
  reg.addAnchor('dx.modelCheck', root, new THREE.Vector3(mcx, DX.boardTop, mcz));
  // Camera aim points used by stages.ts (each DX model places them on its own layout).
  const views: [string, number, number, number][] = [
    ['dx.view.rearJacks', -55, 50, DX.rearZ], ['dx.view.rearJacks2', -45, 48, DX.rearZ],
    ['dx.view.trigger1', -78, 10, -52], ['dx.view.trigger2', -86, 10, -48], ['dx.view.trigger3', -94, 10, -44],
    ['dx.view.replay', -105, 50, -45], ['dx.view.clockJacks', 75, 32, DX.rearZ],
    ['dx.view.install1', U701_POS.x - 48, 20, U701_POS.z + 25], ['dx.view.install2', U701_POS.x - 33, 20, U701_POS.z + 20],
    ['dx.view.potLead', -140, 30, -95], ['dx.view.clockLead', 10, 30, 25], ['dx.view.rearOverview', -100, 55, DX.rearZ],
  ];
  for (const [id, x, y, z] of views) reg.addAnchor(id, root, new THREE.Vector3(x, y, z));

  const u701Pin = (n: number): THREE.Vector3 => reg.world(`dx.u701.${n}`) ?? new THREE.Vector3();

  // DX-side traces: U701 pins 15/12/10 to the snare circuit, the clock-out node to the jack, GEN0* to U701
  root.updateMatrixWorld(true);
  const y = DX.boardTop + 0.4;
  const tr = (n: number, xoff: number, end: THREE.Vector3, dz: number): THREE.Vector3[] => {
    const a = u701Pin(n).setY(y);
    const e = new THREE.Vector3(end.x + 4.6, y, end.z + dz);
    return [a, new THREE.Vector3(end.x + xoff, y, a.z), new THREE.Vector3(end.x + xoff, y, e.z), e];
  };
  const u204 = at('U204');
  const jx = jackX(1);
  const dxPaths = [
    { id: 'dxTrigger', color: 0xffa23a, lines: [tr(15, 21, u207, 0), tr(12, 18.5, u204, -1.5), tr(10, 16, u204, 1.5)] },
    {
      id: 'dxClock', color: 0x7aa2ff,
      lines: [[
        new THREE.Vector3(R791_POS.x, y, R791_POS.z + 5.08), new THREE.Vector3(R791_POS.x, y, R791_POS.z + 10), new THREE.Vector3(110, y, R791_POS.z + 10),
        new THREE.Vector3(110, y, -118), new THREE.Vector3(jx, y, -118), new THREE.Vector3(jx, y, DX.rearZ + 24),
      ]],
    },
    {
      id: 'dxGen0', color: 0x9aa3b5,
      lines: [[new THREE.Vector3(at('U704').x - 4, y, -60), new THREE.Vector3(U701_POS.x + 8, y, -60), new THREE.Vector3(U701_POS.x + 8, y, u701Pin(9).z), u701Pin(9).setY(y)]],
    },
  ];

  return { root, lidPivot, u701Chip, delayPotParts: { outside, inside, legend, hole }, snareRing, snareGlow, dxPaths, u701Pin };
}
