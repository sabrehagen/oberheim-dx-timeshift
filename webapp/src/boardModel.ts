/**
 * Procedural model of the DX TimeShift rev A board (brief §3.5).
 *
 * Coordinates are board-local millimetres: origin = centre of the board outline,
 * +x = right, +z = towards the J1 ("DX PLUG") edge, +y = up out of the component side.
 * This matches KiCad's top view (+x right, +y down), so KiCad positions from
 * public/models/anchors.json can be used directly (kicad y -> local z).
 *
 * Every part has an `id` (used for highlight / labels / camera targets) and a `ref`
 * (KiCad reference designator). Every pin gets an anchor `<id>.<pin>`.
 */
import * as THREE from 'three';
import { MAT, boxOnFloor, cylOnFloor, deg, textCanvas } from './util';
import type { Registry } from './registry';

/** As-built rev A outline (used when no KiCad PCB is available). */
export const BOARD_W = 84;
export const BOARD_H = 63;
export const BOARD_T = 1.6;

/** Ribbon / DIP IDC plug mapping (brief §3.5): HEADER_TO_DIP[headerPin - 1] = DIP pin. */
export const HEADER_TO_DIP = [1, 16, 2, 15, 3, 14, 4, 13, 5, 12, 6, 11, 7, 10, 8, 9];
export const DIP_TO_HEADER: Record<number, number> = Object.fromEntries(HEADER_TO_DIP.map((d, i) => [d, i + 1]));

/** U701 (MC14174B) pin functions, DX board 1721A (findings b1). */
export const U701_PINS: Record<number, string> = {
  1: 'CLR (+5 V)', 2: 'Q1 RST1 (bass)', 3: 'D1 = D0', 4: 'D2 = D1', 5: 'Q2 FFA1 (bass)', 6: 'D3 = D2',
  7: 'Q3 FFB1 (bass)', 8: 'GND', 9: 'CLK = GEN0*', 10: 'Q4 FFB2 (snare)', 11: 'D4 = D5', 12: 'Q5 FFA2 (snare)',
  13: 'D5 = D4', 14: 'D6 = D3', 15: 'Q6 RST2 (snare)', 16: '+5 V',
};

/** Arduino Nano pin name -> KiCad Module:Arduino_Nano pad number. */
export function nanoPad(name: string): string {
  const d = /^D(\d+)$/.exec(name);
  if (d) {
    const n = Number(d[1]);
    if (n >= 2 && n <= 12) return String(n + 3);
    if (n === 13) return '16';
    if (n === 1) return '1';
    if (n === 0) return '2';
  }
  const a = /^A(\d)$/.exec(name);
  if (a) return String(19 + Number(a[1]));
  if (name === '5V') return '27';
  if (name === 'GND') return '4';
  if (name === 'VIN') return '30';
  return name;
}
// Physical order along the two Nano rows, starting at the USB end.
const NANO_ROW_D = ['D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'GND', 'RST', 'RX0', 'TX1'];
const NANO_ROW_A = ['D13', '3V3', 'AREF', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RST2', 'GND2', 'VIN'];

export type PartKind =
  | 'dip' | 'socket' | 'nano' | 'nanoHeaders' | 'boxHeader' | 'jst' | 'jumper' | 'resistor' | 'ceramic'
  | 'electrolytic' | 'testpoint' | 'hole';

export interface KicadMatch {
  prefix: string;
  nets?: RegExp[];
  value?: RegExp;
  near?: string; // ref of the IC this part should be closest to
  /** exact KiCad reference (preferred when it exists; distance alone picks the wrong cap on rev A) */
  ref?: string;
}

export interface PartSpec {
  id: string;
  ref: string;
  name: string;
  kind: PartKind;
  x: number;
  z: number;
  rot?: number; // degrees, KiCad sense (CCW in top view)
  pins?: number;
  marking?: string;
  value?: string;
  /** Assembly order (1 = first). 0 = not part of the build sequence. */
  step: number;
  match?: KicadMatch;
  color?: number;
}

export const PARTS: PartSpec[] = [
  { id: 'ts.H1', ref: 'H1', name: 'Mounting hole M3', kind: 'hole', x: -38.5, z: -28, step: 0 },
  { id: 'ts.H2', ref: 'H2', name: 'Mounting hole M3', kind: 'hole', x: 38.5, z: -28, step: 0 },
  { id: 'ts.H3', ref: 'H3', name: 'Mounting hole M3', kind: 'hole', x: -38.5, z: 28, step: 0 },
  { id: 'ts.H4', ref: 'H4', name: 'Mounting hole M3', kind: 'hole', x: 38.5, z: 28, step: 0 },
  // Resistors (lowest parts first)
  { id: 'ts.R1', ref: 'R1', name: 'R1 1 kΩ (RST2 protect)', kind: 'resistor', x: -21, z: -11, rot: 90, value: '1k', step: 1, match: { prefix: 'R', nets: [/RST2_IN/] } },
  { id: 'ts.R2', ref: 'R2', name: 'R2 1 kΩ (FFA2 protect)', kind: 'resistor', x: -18.2, z: -11, rot: 90, value: '1k', step: 1, match: { prefix: 'R', nets: [/FFA2_IN/] } },
  { id: 'ts.R3', ref: 'R3', name: 'R3 1 kΩ (FFB2 protect)', kind: 'resistor', x: -15.4, z: -11, rot: 90, value: '1k', step: 1, match: { prefix: 'R', nets: [/FFB2_IN/] } },
  { id: 'ts.R4', ref: 'R4', name: 'R4 10 kΩ MUX_SEL pull-down', kind: 'resistor', x: -12.6, z: -11, rot: 90, value: '10k', step: 1, match: { prefix: 'R', nets: [/MUX_SEL/] } },
  { id: 'ts.R5', ref: 'R5', name: 'R_CLK1 10 kΩ series', kind: 'resistor', x: 1.5, z: -11, rot: 90, value: '10k', step: 1, match: { prefix: 'R', value: /^10\s*k/i, nets: [/CLK/i] } },
  { id: 'ts.R6', ref: 'R6', name: 'R_CLK2 100 kΩ pull-down', kind: 'resistor', x: 4.3, z: -11, rot: 90, value: '100k', step: 1, match: { prefix: 'R', value: /^100\s*k/i } },
  { id: 'ts.R7', ref: 'R7', name: 'R7 1 kΩ pot filter', kind: 'resistor', x: 10, z: -11, rot: 90, value: '1k', step: 1, match: { prefix: 'R', nets: [/POT/i] } },
  // Small capacitors
  { id: 'ts.C5', ref: 'C5', name: 'C5 1 nF clock filter', kind: 'ceramic', x: 7.1, z: -11, rot: 90, value: '1n', step: 2, match: { prefix: 'C', value: /^1\s*n/i } },
  { id: 'ts.C6', ref: 'C6', name: 'C6 100 nF pot filter', kind: 'ceramic', x: 12.8, z: -11, rot: 90, value: '100n', step: 2, match: { prefix: 'C', nets: [/POT/i] } },
  { id: 'ts.C2', ref: 'C2', name: 'C2 100 nF (U1)', kind: 'ceramic', x: -2.2, z: 3.5, rot: 90, value: '100n', step: 2, match: { prefix: 'C', value: /^100\s*n/i, ref: 'C2', near: 'U1' } },
  { id: 'ts.C3', ref: 'C3', name: 'C3 100 nF (U3)', kind: 'ceramic', x: 21.5, z: 3.5, rot: 90, value: '100n', step: 2, match: { prefix: 'C', value: /^100\s*n/i, ref: 'C3', near: 'U3' } },
  { id: 'ts.C4', ref: 'C4', name: 'C4 100 nF (U4)', kind: 'ceramic', x: 21.5, z: 13.5, rot: 90, value: '100n', step: 2, match: { prefix: 'C', value: /^100\s*n/i, ref: 'C4', near: 'U4' } },
  { id: 'ts.C7', ref: 'C7', name: 'C7 100 nF (Nano)', kind: 'ceramic', x: 21.5, z: -15, rot: 0, value: '100n', step: 2, match: { prefix: 'C', value: /^100\s*n/i, ref: 'C5', near: 'U2' } },
  // ICs and the U701 socket
  { id: 'ts.U1', ref: 'U1', name: 'U1 DIP-16 socket for the original U701 chip', kind: 'socket', x: -14.5, z: 3.5, pins: 16, step: 3 },
  { id: 'ts.U3', ref: 'U3', name: 'U3 74HC157 quad 2:1 mux', kind: 'dip', x: 9.5, z: 3.5, pins: 16, marking: '74HC157', step: 3 },
  { id: 'ts.U4', ref: 'U4', name: 'U4 74HC14 Schmitt inverter', kind: 'dip', x: 9.5, z: 13.5, pins: 14, marking: '74HC14', step: 3 },
  // Test points, jumper, connectors
  { id: 'ts.TP1', ref: 'TP1', name: 'TP1 TP_REPLAY', kind: 'testpoint', x: 1.5, z: 18.7, step: 4, color: 0xd8443a },
  { id: 'ts.TP2', ref: 'TP2', name: 'TP2 RST2 chip side', kind: 'testpoint', x: 5.5, z: 18.7, step: 4, color: 0xe0b52a },
  { id: 'ts.TP3', ref: 'TP3', name: 'TP3 RST2 plug side', kind: 'testpoint', x: 9.5, z: 18.7, step: 4, color: 0xe0b52a },
  { id: 'ts.TP4', ref: 'TP4', name: 'TP4 GND', kind: 'testpoint', x: 13.5, z: 18.7, step: 4, color: 0x222222 },
  { id: 'ts.TP5', ref: 'TP5', name: 'TP5 CLK_IN', kind: 'testpoint', x: 17.5, z: 18.7, step: 4, color: 0x3a7bd5 },
  { id: 'ts.JP1', ref: 'JP1', name: 'JP1 PPQN jumper (open = 96, 1-2 = 48, 3-4 = 24)', kind: 'jumper', x: 26, z: 5, step: 5 },
  { id: 'ts.J2', ref: 'J2', name: 'J2 POT (JST-XH 3)', kind: 'jst', x: 25.5, z: -8.5, pins: 3, step: 6 },
  { id: 'ts.J3', ref: 'J3', name: 'J3 CLK (JST-XH 2)', kind: 'jst', x: 25.5, z: -1.5, pins: 2, step: 6 },
  { id: 'ts.J1', ref: 'J1', name: 'J1 DX PLUG (2×8 box header)', kind: 'boxHeader', x: -14.5, z: 14, pins: 16, step: 7 },
  { id: 'ts.C1', ref: 'C1', name: 'C1 10 µF bulk', kind: 'electrolytic', x: 26.5, z: 12, rot: 0, value: '10u', step: 8, match: { prefix: 'C', value: /^10\s*u/i } },
  { id: 'ts.NanoHdr', ref: 'U2', name: '2 × 1×15 female headers', kind: 'nanoHeaders', x: -4.5, z: -11, step: 9 },
  { id: 'ts.U2', ref: 'U2', name: 'U2 Arduino Nano (ATmega328P, 5 V)', kind: 'nano', x: -4.5, z: -11, step: 10, match: { prefix: 'U', value: /nano/i } },
];
export const MAX_STEP = Math.max(...PARTS.map((p) => p.step));

export const BUILD_STEPS: { step: number; text: string }[] = [
  { step: 1, text: 'Resistors R1–R7 (flat, lowest first)' },
  { step: 2, text: 'Small capacitors C2–C7' },
  { step: 3, text: 'U1 socket (notch!), U3 74HC157, U4 74HC14' },
  { step: 4, text: 'Test points TP1–TP5' },
  { step: 5, text: 'JP1 PPQN jumper header' },
  { step: 6, text: 'J2 POT and J3 CLK (JST-XH)' },
  { step: 7, text: 'J1 box header (key notch)' },
  { step: 8, text: 'C1 10 µF (mind the + lead)' },
  { step: 9, text: 'Nano female headers' },
  { step: 10, text: 'Plug in the Nano (USB to the edge)' },
];

// ---------------------------------------------------------------------------
// Pin geometry (local to the part, before rotation)
// ---------------------------------------------------------------------------

function localPin(spec: PartSpec, pin: string): [number, number] | null {
  switch (spec.kind) {
    case 'dip':
    case 'socket': {
      const n = spec.pins ?? 16;
      const p = Number(pin);
      if (!(p >= 1 && p <= n)) return null;
      const half = n / 2;
      if (p <= half) return [-(half - 1) * 1.27 + (p - 1) * 2.54, 3.81];
      return [(half - 1) * 1.27 - (p - half - 1) * 2.54, -3.81];
    }
    case 'nano':
    case 'nanoHeaders': {
      let i = NANO_ROW_D.indexOf(pin);
      if (i >= 0) return [-17.78 + i * 2.54, -7.62];
      i = NANO_ROW_A.indexOf(pin === 'GND' ? 'GND' : pin);
      if (i >= 0) return [-17.78 + i * 2.54, 7.62];
      return null;
    }
    case 'boxHeader': {
      // `pin` is the DIP pin number it ends up on (brief: label header pins by DIP pin).
      const h = DIP_TO_HEADER[Number(pin)];
      if (!h) return null;
      const col = Math.floor((h - 1) / 2);
      const row = (h - 1) % 2;
      return [-8.89 + col * 2.54, row === 0 ? 1.27 : -1.27];
    }
    case 'jst': {
      const n = spec.pins ?? 2;
      const p = Number(pin);
      if (!(p >= 1 && p <= n)) return null;
      return [-(n - 1) * 1.25 + (p - 1) * 2.5, 0];
    }
    case 'jumper': {
      const p = Number(pin);
      if (!(p >= 1 && p <= 4)) return null;
      return [-1.27 + Math.floor((p - 1) / 2) * 2.54, (p - 1) % 2 === 0 ? 1.27 : -1.27];
    }
    case 'resistor':
      return pin === '1' ? [-3.81, 0] : pin === '2' ? [3.81, 0] : null;
    case 'ceramic':
      return pin === '1' ? [-1.27, 0] : pin === '2' ? [1.27, 0] : null;
    case 'electrolytic':
      return pin === '1' ? [-1.25, 0] : pin === '2' ? [1.25, 0] : null;
    case 'testpoint':
    case 'hole':
      return [0, 0];
  }
}

/** KiCad pad number for one of our pin names. */
function kicadPadFor(spec: PartSpec, pin: string): string {
  if (spec.kind === 'nano' || spec.kind === 'nanoHeaders') return nanoPad(pin);
  if (spec.kind === 'boxHeader') return String(DIP_TO_HEADER[Number(pin)] ?? pin);
  return pin;
}

// ---------------------------------------------------------------------------
// KiCad override (public/models/anchors.json written by scripts/sync-model.mjs)
// ---------------------------------------------------------------------------

export interface KicadPad { num: string; x: number; y: number; net: string | null }
export interface KicadFootprint { ref: string; value: string; lib: string; x: number; y: number; rot: number; layer: string; pads: KicadPad[] }
export interface AnchorsJson {
  source: string;
  board: { width: number; height: number; thickness: number };
  origin?: { x: number; y: number };
  footprints: KicadFootprint[];
}

export interface Placement {
  x: number;
  z: number;
  rot: number;
  /** pad number -> [x, z] board-local, only when the part came from KiCad */
  pads?: Map<string, [number, number]>;
  /** KiCad reference designator the part was matched to */
  kicadRef?: string;
  /** pad number -> net name (KiCad) */
  padNets?: Map<string, string | null>;
  /** KiCad footprint library id, e.g. Package_DIP:DIP-16_W7.62mm_Socket */
  kicadLib?: string;
}

export interface BoardLayout {
  width: number;
  height: number;
  thickness: number;
  fromKicad: boolean;
  source: string;
  place: Map<string, Placement>;
  unmatched: string[];
}

export function proceduralLayout(): BoardLayout {
  const place = new Map<string, Placement>();
  for (const p of PARTS) place.set(p.id, { x: p.x, z: p.z, rot: p.rot ?? 0 });
  return { width: BOARD_W, height: BOARD_H, thickness: BOARD_T, fromKicad: false, source: 'procedural (src/boardModel.ts)', place, unmatched: [] };
}

function padPair(fp: KicadFootprint, a: string, b: string): [KicadPad, KicadPad] | null {
  const pa = fp.pads.find((p) => p.num === a);
  const pb = fp.pads.find((p) => p.num === b);
  return pa && pb ? [pa, pb] : null;
}

function placementFromFootprint(spec: PartSpec, fp: KicadFootprint): Placement {
  const pads = new Map<string, [number, number]>();
  const padNets = new Map<string, string | null>();
  for (const p of fp.pads) {
    if (!pads.has(p.num)) pads.set(p.num, [p.x, p.y]);
    if (!padNets.has(p.num)) padNets.set(p.num, p.net);
  }
  const numeric = fp.pads.filter((p) => /^\d+$/.test(p.num));
  const cx = numeric.length ? numeric.reduce((s, p) => s + p.x, 0) / numeric.length : fp.x;
  const cz = numeric.length ? numeric.reduce((s, p) => s + p.y, 0) / numeric.length : fp.y;
  // Orientation: the direction of our local +x axis expressed by two known pads.
  let pair: [KicadPad, KicadPad] | null = null;
  switch (spec.kind) {
    case 'dip':
    case 'socket':
      pair = padPair(fp, '1', String((spec.pins ?? 16) / 2));
      break;
    case 'nano':
    case 'nanoHeaders':
      pair = padPair(fp, '15', '1');
      break;
    case 'boxHeader':
      pair = padPair(fp, '1', '15');
      break;
    case 'jumper':
      pair = padPair(fp, '1', '3');
      break;
    case 'jst':
      pair = padPair(fp, '1', String(spec.pins ?? 2));
      break;
    case 'resistor':
    case 'ceramic':
    case 'electrolytic':
      pair = padPair(fp, '1', '2');
      break;
    default:
      break;
  }
  let rot = -fp.rot;
  if (pair) rot = (Math.atan2(-(pair[1].y - pair[0].y), pair[1].x - pair[0].x) * 180) / Math.PI;
  const single = spec.kind === 'testpoint' || spec.kind === 'hole';
  return { x: single ? fp.x : cx, z: single ? fp.y : cz, rot, pads, padNets, kicadRef: fp.ref, kicadLib: fp.lib };
}

/** Resolve every procedural part against the KiCad footprints (by nets / value / ref). */
export function kicadLayout(a: AnchorsJson): BoardLayout {
  const layout = proceduralLayout();
  layout.width = a.board.width;
  layout.height = a.board.height;
  layout.thickness = a.board.thickness || BOARD_T;
  layout.fromKicad = true;
  layout.source = a.source;
  const used = new Set<string>();
  const byRef = new Map(a.footprints.map((f) => [f.ref, f]));
  const netMatch = (fp: KicadFootprint, res: RegExp[]) => res.every((re) => fp.pads.some((p) => p.net !== null && re.test(p.net)));
  // Parts with match rules first (specific before 'near'), then plain refs.
  const ordered = [...PARTS].sort((p, q) => Number(Boolean(p.match?.near)) - Number(Boolean(q.match?.near)));
  for (const spec of ordered) {
    let fp: KicadFootprint | undefined;
    const m = spec.match;
    if (m) {
      let cands = a.footprints.filter((f) => !used.has(f.ref) && f.ref.startsWith(m.prefix) && /^[A-Z]+\d+$/.test(f.ref));
      if (m.nets) cands = cands.filter((f) => netMatch(f, m.nets ?? []));
      if (m.value) cands = cands.filter((f) => (m.value as RegExp).test(f.value) || (m.value as RegExp).test(f.lib));
      // An exact KiCad reference wins when that footprint exists and fits the other rules.
      const exact = m.ref ? cands.find((f) => f.ref === m.ref) : undefined;
      if (exact) cands = [exact];
      else if (m.near) {
        const ic = byRef.get(m.near);
        if (ic) cands.sort((f, g) => Math.hypot(f.x - ic.x, f.y - ic.y) - Math.hypot(g.x - ic.x, g.y - ic.y));
      }
      fp = cands[0];
    }
    if (!fp && !(spec.kind === 'nanoHeaders')) {
      const r = byRef.get(spec.ref);
      if (r && !used.has(r.ref)) fp = r;
    }
    if (spec.kind === 'nanoHeaders') fp = byRef.get('U2') ?? a.footprints.find((f) => /nano/i.test(f.lib + f.value));
    if (!fp) {
      layout.unmatched.push(spec.id);
      continue;
    }
    if (spec.kind !== 'nanoHeaders') used.add(fp.ref);
    layout.place.set(spec.id, placementFromFootprint(spec, fp));
  }
  return layout;
}

// ---------------------------------------------------------------------------
// Signal nets (drawn as glowing paths, animated in the stages)
// ---------------------------------------------------------------------------

export interface NetDef {
  id: string;
  label: string;
  color: number;
  legs: [string, string][];
  speed?: number;
}

const passthrough: [string, string][] = [1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 14].map((k) => [`ts.U1.${k}`, `ts.J1.${k}`]);

export const NETS: NetDef[] = [
  {
    id: 'capture', label: 'Capture: U1 → 1 kΩ → Nano D2/D4/D5', color: 0x35d0ff,
    legs: [['ts.U1.15', 'ts.R1.2'], ['ts.R1.1', 'ts.U2.D2'], ['ts.U1.12', 'ts.R2.2'], ['ts.R2.1', 'ts.U2.D4'], ['ts.U1.10', 'ts.R3.2'], ['ts.R3.1', 'ts.U2.D5']],
  },
  { id: 'bypass', label: 'Mux A inputs (bypass)', color: 0x5cf29a, legs: [['ts.U1.15', 'ts.U3.2'], ['ts.U1.12', 'ts.U3.5'], ['ts.U1.10', 'ts.U3.11']] },
  { id: 'delayed', label: 'Mux B inputs (delayed, from Nano)', color: 0xffa23a, legs: [['ts.U2.D6', 'ts.U3.3'], ['ts.U2.D7', 'ts.U3.6'], ['ts.U2.D8', 'ts.U3.10']] },
  { id: 'out', label: 'Mux Y outputs → J1 pins 15/12/10', color: 0xff6bd5, legs: [['ts.U3.4', 'ts.J1.15'], ['ts.U3.7', 'ts.J1.12'], ['ts.U3.9', 'ts.J1.10']] },
  { id: 'sel', label: 'MUX_SEL (D9 → S, 10 kΩ pull-down)', color: 0xf6e05e, legs: [['ts.U2.D9', 'ts.U3.1'], ['ts.U3.1', 'ts.R4.1']] },
  {
    id: 'clock', label: 'Clock: J3 → 10 kΩ → 74HC14 ×2 → D3', color: 0x7aa2ff,
    legs: [['ts.J3.1', 'ts.R5.2'], ['ts.R5.1', 'ts.U4.1'], ['ts.R6.2', 'ts.U4.1'], ['ts.C5.2', 'ts.U4.1'], ['ts.U4.2', 'ts.U4.3'], ['ts.U4.4', 'ts.U2.D3']],
  },
  { id: 'pot', label: 'Pot: J2 wiper → 1 kΩ + 100 nF → A0', color: 0xc58bff, legs: [['ts.J2.2', 'ts.R7.2'], ['ts.R7.1', 'ts.U2.A0'], ['ts.C6.2', 'ts.U2.A0']] },
  {
    id: 'power', label: '+5 V from U701 socket pin 16', color: 0xff4d4d, speed: 25,
    legs: [['ts.J1.16', 'ts.C1.1'], ['ts.J1.16', 'ts.U1.16'], ['ts.J1.16', 'ts.U3.16'], ['ts.J1.16', 'ts.U4.14'], ['ts.J1.16', 'ts.U2.5V'], ['ts.U2.5V', 'ts.J2.3']],
  },
  {
    id: 'gnd', label: 'GND from U701 socket pin 8', color: 0x9aa3b5, speed: 25,
    legs: [['ts.J1.8', 'ts.C1.2'], ['ts.J1.8', 'ts.U1.8'], ['ts.J1.8', 'ts.U3.8'], ['ts.J1.8', 'ts.U4.7'], ['ts.J1.8', 'ts.TP4.1']],
  },
  { id: 'through', label: '13 pins straight through U1 → J1', color: 0x8892a6, legs: passthrough, speed: 30 },
];

// ---------------------------------------------------------------------------
// 3D construction
// ---------------------------------------------------------------------------

export interface BuiltBoard {
  root: THREE.Group;
  substrate: THREE.Mesh;
  parts: Map<string, THREE.Group>;
  chip: THREE.Group; // original U701 chip sitting in U1
  nanoLed: THREE.Mesh;
  layout: BoardLayout;
  /** board-local pin position, y = board top */
  pin(id: string): THREE.Vector3 | null;
  /** KiCad net of a pin (null without a KiCad layout) */
  net(id: string): string | null;
  partTopY: Map<string, number>;
}

function dipBody(pins: number, marking: string | undefined, mat = MAT.chip): THREE.Group {
  const g = new THREE.Group();
  const len = (pins / 2) * 2.54 - 0.6;
  const body = boxOnFloor(len, 3.2, 6.35, mat);
  body.position.y = 0.7;
  g.add(body);
  // pin-1 notch
  const notch = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 14), MAT.socket);
  notch.position.set(-len / 2 + 0.2, 3.95, 0);
  g.add(notch);
  // legs
  const legGeo = new THREE.BoxGeometry(0.5, 3.4, 0.35);
  const half = pins / 2;
  for (let i = 0; i < half; i++) {
    for (const side of [1, -1]) {
      const leg = new THREE.Mesh(legGeo, MAT.metal);
      leg.position.set(-(half - 1) * 1.27 + i * 2.54, 1.5, side * 3.4);
      g.add(leg);
    }
  }
  if (marking) {
    const tex = textCanvas(512, 128, (ctx) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#d8d8dc';
      ctx.font = 'bold 54px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marking, 256, 64);
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.9, 4.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    label.rotation.x = -Math.PI / 2;
    label.position.y = 3.92;
    g.add(label);
  }
  return g;
}

function socketBody(pins: number): THREE.Group {
  const g = new THREE.Group();
  const len = (pins / 2) * 2.54 + 1.2;
  const rail = (z: number) => {
    const r = boxOnFloor(len, 3.2, 2.5, MAT.socket);
    r.position.z = z;
    g.add(r);
  };
  rail(3.81);
  rail(-3.81);
  for (const x of [-len / 2 + 0.9, len / 2 - 0.9]) {
    const e = boxOnFloor(1.8, 3.2, 5.2, MAT.socket);
    e.position.x = x;
    g.add(e);
  }
  const half = pins / 2;
  const cg = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 8);
  for (let i = 0; i < half; i++) {
    for (const side of [1, -1]) {
      const c = new THREE.Mesh(cg, MAT.gold);
      c.position.set(-(half - 1) * 1.27 + i * 2.54, 3.25, side * 3.81);
      g.add(c);
    }
  }
  return g;
}

function nanoBody(): { g: THREE.Group; led: THREE.Mesh } {
  const g = new THREE.Group();
  const y0 = 8.5 + 0.2; // sits on the female headers
  const pcb = boxOnFloor(43.2, 1.6, 18, MAT.nanoBlue);
  pcb.position.y = y0;
  g.add(pcb);
  const mcu = boxOnFloor(7, 1.2, 7, MAT.chip);
  mcu.position.set(4, y0 + 1.6, 0);
  mcu.rotation.y = Math.PI / 4;
  g.add(mcu);
  const usb = boxOnFloor(9, 4, 7.6, MAT.metal);
  usb.position.set(-19.5, y0 + 1.6, 0);
  g.add(usb);
  const ftdi = boxOnFloor(5, 1, 5, MAT.chip);
  ftdi.position.set(-9, y0 + 1.6, 0);
  g.add(ftdi);
  const xtal = boxOnFloor(3.5, 1.2, 2, MAT.metal);
  xtal.position.set(-2, y0 + 1.6, 4);
  g.add(xtal);
  const btn = boxOnFloor(4, 1.5, 3, MAT.white);
  btn.position.set(12, y0 + 1.6, 0);
  g.add(btn);
  const led = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.9), new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff7a00, emissiveIntensity: 0.3 }));
  led.userData.noRegistryMat = true;
  led.position.set(-12, y0 + 2, -4.5);
  g.add(led);
  const pinGeo = new THREE.BoxGeometry(0.64, 2.6, 0.64);
  for (const z of [-7.62, 7.62]) {
    for (let i = 0; i < 15; i++) {
      const p = new THREE.Mesh(pinGeo, MAT.metal);
      p.position.set(-17.78 + i * 2.54, y0 + 1.2, z);
      g.add(p);
    }
  }
  const tex = textCanvas(512, 96, (ctx) => {
    ctx.fillStyle = '#1d4f9c';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ARDUINO NANO', 256, 50);
  });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.1), new THREE.MeshStandardMaterial({ map: tex }));
  lbl.rotation.x = -Math.PI / 2;
  lbl.position.set(6, y0 + 1.62, -4.5);
  g.add(lbl);
  return { g, led };
}

function nanoHeaders(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-7.62, 7.62]) {
    const h = boxOnFloor(38.1, 8.5, 2.54, MAT.socket);
    h.position.z = z;
    g.add(h);
  }
  return g;
}

function boxHeader(): THREE.Group {
  const g = new THREE.Group();
  const L = 27.9;
  const W = 8.9;
  const H = 9;
  const t = 1.1;
  const sides: [number, number, number, number, number][] = [
    [L, H, t, 0, W / 2 - t / 2],
    [L, H, t, 0, -W / 2 + t / 2],
    [t, H, W, L / 2 - t / 2, 0],
    [t, H, W, -L / 2 + t / 2, 0],
  ];
  for (const [w, h, d, x, z] of sides) {
    const m = boxOnFloor(w, h, d, MAT.socket);
    m.position.set(x, 0, z);
    g.add(m);
  }
  const floor = boxOnFloor(L - 2, 2.5, W - 2, MAT.socket);
  g.add(floor);
  // key slot on the pin-1 row side (+z)
  const key = boxOnFloor(4.5, 5, 0.6, MAT.hole);
  key.position.set(0, 4.2, W / 2 + 0.05);
  g.add(key);
  const pg = new THREE.BoxGeometry(0.64, 6, 0.64);
  for (let h = 1; h <= 16; h++) {
    const col = Math.floor((h - 1) / 2);
    const row = (h - 1) % 2;
    const p = new THREE.Mesh(pg, MAT.gold);
    p.position.set(-8.89 + col * 2.54, 3, row === 0 ? 1.27 : -1.27);
    g.add(p);
  }
  // pin-1 triangle
  const tri = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.2, 3), MAT.white);
  tri.position.set(-L / 2 + 1.8, H + 0.05, W / 2 - 0.6);
  g.add(tri);
  return g;
}

function jst(pins: number): THREE.Group {
  const g = new THREE.Group();
  const L = 2.5 * (pins - 1) + 4.9;
  const body = boxOnFloor(L, 7, 5.75, MAT.jstWhite);
  g.add(body);
  const cavity = boxOnFloor(L - 1.6, 0.4, 4.2, new THREE.MeshStandardMaterial({ color: 0xbab3a0 }));
  cavity.position.y = 6.75;
  g.add(cavity);
  const pg = new THREE.BoxGeometry(0.64, 5.5, 0.64);
  for (let i = 0; i < pins; i++) {
    const p = new THREE.Mesh(pg, MAT.gold);
    p.position.set(-(pins - 1) * 1.25 + i * 2.5, 4, 0);
    g.add(p);
  }
  return g;
}

function jumper(): THREE.Group {
  const g = new THREE.Group();
  const base = boxOnFloor(5.08, 2.5, 5.08, MAT.socket);
  g.add(base);
  const pg = new THREE.BoxGeometry(0.64, 6, 0.64);
  for (let p = 1; p <= 4; p++) {
    const m = new THREE.Mesh(pg, MAT.gold);
    m.position.set(-1.27 + Math.floor((p - 1) / 2) * 2.54, 3.5, (p - 1) % 2 === 0 ? 1.27 : -1.27);
    g.add(m);
  }
  return g;
}

function resistor(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 4, 4, 12), MAT.resistor);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.6;
  g.add(body);
  const bands = [0x6b3e1e, 0x111111, 0xd23b30, 0xd8b25a];
  bands.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 12), new THREE.MeshStandardMaterial({ color: c }));
    b.rotation.z = Math.PI / 2;
    b.position.set(-1.8 + i * 1.1 + (i === 3 ? 0.6 : 0), 1.6, 0);
    g.add(b);
  });
  const lead = new THREE.BoxGeometry(0.5, 1.8, 0.5);
  for (const x of [-3.81, 3.81]) {
    const l = new THREE.Mesh(lead, MAT.metal);
    l.position.set(x, 0.9, 0);
    g.add(l);
  }
  const top = new THREE.BoxGeometry(1.2, 0.5, 0.5);
  for (const x of [-3.3, 3.3]) {
    const l = new THREE.Mesh(top, MAT.metal);
    l.position.set(x, 1.6, 0);
    g.add(l);
  }
  return g;
}

function ceramic(): THREE.Group {
  const g = new THREE.Group();
  const body = boxOnFloor(4, 4, 2.4, MAT.ceramic);
  body.position.y = 1;
  g.add(body);
  const lead = new THREE.BoxGeometry(0.5, 1.2, 0.5);
  for (const x of [-1.27, 1.27]) {
    const l = new THREE.Mesh(lead, MAT.metal);
    l.position.set(x, 0.6, 0);
    g.add(l);
  }
  return g;
}

function electrolytic(): THREE.Group {
  const g = new THREE.Group();
  const can = cylOnFloor(2.5, 11, MAT.elcap, 24);
  can.position.y = 0.4;
  g.add(can);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.52, 10.8, 24, 1, true, Math.PI * 0.85, Math.PI * 0.3), MAT.white);
  stripe.position.set(0, 5.9, 0);
  g.add(stripe);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.1, 24), MAT.metal);
  top.position.y = 11.45;
  g.add(top);
  return g;
}

function testpoint(color: number): THREE.Group {
  const g = new THREE.Group();
  const loop = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.32, 8, 20), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
  loop.position.y = 4;
  g.add(loop);
  const post = boxOnFloor(0.6, 3, 0.6, MAT.metal);
  g.add(post);
  return g;
}

function holeMarker(): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 3, 28), MAT.gold);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(ring);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.6, 28), MAT.hole);
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.04;
  g.add(hole);
  return g;
}

const PART_HEIGHT: Record<PartKind, number> = {
  dip: 4, socket: 3.6, nano: 14.5, nanoHeaders: 8.5, boxHeader: 9, jst: 7, jumper: 9.5, resistor: 2.8, ceramic: 5,
  electrolytic: 11.5, testpoint: 5.6, hole: 0.2,
};

function route(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const midZ = (a.z + b.z) / 2;
  const pts = [a.clone(), new THREE.Vector3(a.x, a.y, midZ), new THREE.Vector3(b.x, a.y, midZ), b.clone()];
  return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.01);
}

const TWO_PIN: PartKind[] = ['resistor', 'ceramic', 'electrolytic'];

/**
 * With a real KiCad layout, a 2-pin part may be fitted the other way round from the
 * procedural model. Swap the pin of a leg end when that makes both ends share a net.
 */
export function fixLeg(board: { net: (id: string) => string | null }, a: string, b: string): [string, string] {
  const na = board.net(a);
  const nb = board.net(b);
  if (!na || !nb || na === nb) return [a, b];
  const flip = (id: string): string | null => {
    const dot = id.lastIndexOf('.');
    const spec = PARTS.find((p) => p.id === id.slice(0, dot));
    if (!spec || !TWO_PIN.includes(spec.kind)) return null;
    const pin = id.slice(dot + 1);
    return pin === '1' ? `${id.slice(0, dot)}.2` : pin === '2' ? `${id.slice(0, dot)}.1` : null;
  };
  const fa = flip(a);
  if (fa && board.net(fa) === nb) return [fa, b];
  const fb = flip(b);
  if (fb && board.net(fb) === na) return [a, fb];
  return [a, b];
}

export function netPolylines(board: BuiltBoard, net: NetDef, y: number): THREE.Vector3[][] {
  const out: THREE.Vector3[][] = [];
  for (const leg of net.legs) {
    const [a, b] = fixLeg(board, leg[0], leg[1]);
    const pa = board.pin(a);
    const pb = board.pin(b);
    if (!pa || !pb) continue;
    pa.y = y;
    pb.y = y;
    out.push(route(pa, pb));
  }
  return out;
}

function silkscreen(layout: BoardLayout, board: { pin: (id: string) => THREE.Vector3 | null; net: (id: string) => string | null }): THREE.CanvasTexture {
  const ppm = 20;
  const W = Math.round(layout.width * ppm);
  const H = Math.round(layout.height * ppm);
  const X = (x: number) => (x + layout.width / 2) * ppm;
  const Z = (z: number) => (z + layout.height / 2) * ppm;
  return textCanvas(W, H, (ctx) => {
    ctx.fillStyle = '#1c6b3a';
    ctx.fillRect(0, 0, W, H);
    // copper traces (slightly lighter under the solder mask)
    ctx.strokeStyle = 'rgba(80, 170, 105, 0.55)';
    ctx.lineWidth = 0.45 * ppm;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const net of NETS) {
      for (const leg of net.legs) {
        const [a, b] = fixLeg(board, leg[0], leg[1]);
        const pa = board.pin(a);
        const pb = board.pin(b);
        if (!pa || !pb) continue;
        const pts = route(pa, pb);
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))));
        ctx.stroke();
      }
    }
    // pads
    ctx.fillStyle = '#d8b25a';
    for (const spec of PARTS) {
      if (spec.kind === 'hole' || spec.kind === 'nanoHeaders') continue;
      const names = pinNames(spec);
      for (const n of names) {
        const p = board.pin(`${spec.id}.${n}`);
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(X(p.x), Z(p.z), 0.8 * ppm, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // outline + refs
    ctx.strokeStyle = '#f4f4f0';
    ctx.fillStyle = '#f4f4f0';
    ctx.lineWidth = 0.18 * ppm;
    ctx.strokeRect(0.6 * ppm, 0.6 * ppm, W - 1.2 * ppm, H - 1.2 * ppm);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${1.5 * ppm}px Arial, sans-serif`;
    for (const spec of PARTS) {
      if (spec.kind === 'hole' || spec.kind === 'nanoHeaders') continue;
      const pl = layout.place.get(spec.id);
      if (!pl) continue;
      let dz = 0;
      if (spec.kind === 'resistor' || spec.kind === 'ceramic') dz = 5.2;
      if (spec.kind === 'socket' || spec.kind === 'dip') dz = -5.6;
      if (spec.kind === 'boxHeader') dz = -5.8;
      if (spec.kind === 'jst' || spec.kind === 'jumper') dz = -4.1;
      if (spec.kind === 'testpoint') dz = -2.1;
      if (spec.kind === 'nano') continue;
      ctx.fillText(spec.ref === 'U2' ? '' : pl.kicadRef ?? spec.ref, X(pl.x), Z(pl.z + dz));
    }
    ctx.font = `bold ${1.7 * ppm}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('DX TIMESHIFT rev A — SNARE', 3.2 * ppm, 1.9 * ppm);
    ctx.font = `${1.2 * ppm}px Arial, sans-serif`;
    ctx.fillText('fits Oberheim DX board 1721A (U701). NOT for DXa (U715)', 3.2 * ppm, H - 1.6 * ppm);
    // J1 legend + pin-1 marker
    const j1 = layout.place.get('ts.J1');
    if (j1) {
      ctx.font = `bold ${1.2 * ppm}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('DX PLUG', X(j1.x), Z(j1.z) + 5.8 * ppm);
    }
  });
}

export function pinNames(spec: PartSpec): string[] {
  switch (spec.kind) {
    case 'dip':
    case 'socket':
      return Array.from({ length: spec.pins ?? 16 }, (_, i) => String(i + 1));
    case 'boxHeader':
      return Array.from({ length: 16 }, (_, i) => String(i + 1));
    case 'nano':
      return [...NANO_ROW_D, ...NANO_ROW_A];
    case 'jst':
      return Array.from({ length: spec.pins ?? 2 }, (_, i) => String(i + 1));
    case 'jumper':
      return ['1', '2', '3', '4'];
    case 'resistor':
    case 'ceramic':
    case 'electrolytic':
      return ['1', '2'];
    case 'testpoint':
      return ['1'];
    default:
      return [];
  }
}

export function buildBoard(reg: Registry, layout: BoardLayout): BuiltBoard {
  const root = new THREE.Group();
  root.name = 'ts.root';
  const parts = new Map<string, THREE.Group>();
  const partTopY = new Map<string, number>();
  const T = layout.thickness;
  const specById = new Map(PARTS.map((p) => [p.id, p]));

  const pin = (id: string): THREE.Vector3 | null => {
    const dot = id.lastIndexOf('.');
    const partId = id.slice(0, dot);
    const pinName = id.slice(dot + 1);
    const spec = specById.get(partId);
    const pl = layout.place.get(partId);
    if (!spec || !pl) return null;
    if (pl.pads) {
      const pad = pl.pads.get(kicadPadFor(spec, pinName));
      if (pad) return new THREE.Vector3(pad[0], T, pad[1]);
    }
    const lp = localPin(spec, pinName);
    if (!lp) return null;
    const r = deg(pl.rot);
    const x = lp[0] * Math.cos(r) + lp[1] * Math.sin(r);
    const z = -lp[0] * Math.sin(r) + lp[1] * Math.cos(r);
    return new THREE.Vector3(pl.x + x, T, pl.z + z);
  };

  const net = (id: string): string | null => {
    const dot = id.lastIndexOf('.');
    const spec = specById.get(id.slice(0, dot));
    const pl = layout.place.get(id.slice(0, dot));
    if (!spec || !pl?.padNets) return null;
    return pl.padNets.get(kicadPadFor(spec, id.slice(dot + 1))) ?? null;
  };

  // Substrate with silkscreen on top.
  const silk = silkscreen(layout, { pin, net });
  const edgeMat = MAT.pcbGreen;
  const topMat = new THREE.MeshStandardMaterial({ map: silk, roughness: 0.55 });
  const substrate = new THREE.Mesh(new THREE.BoxGeometry(layout.width, T, layout.height), [edgeMat, edgeMat, topMat, edgeMat, edgeMat, edgeMat]);
  substrate.position.y = T / 2;
  root.add(substrate);
  reg.addObject('ts.board', substrate, new THREE.Vector3(0, T / 2, 0));

  let chip: THREE.Group | null = null;
  let nanoLed: THREE.Mesh | null = null;
  for (const spec of PARTS) {
    const pl = layout.place.get(spec.id);
    if (!pl) continue;
    let g: THREE.Group;
    switch (spec.kind) {
      case 'dip': g = dipBody(spec.pins ?? 16, spec.marking); break;
      case 'socket': g = socketBody(spec.pins ?? 16); break;
      case 'nano': { const n = nanoBody(); g = n.g; nanoLed = n.led; break; }
      case 'nanoHeaders': g = nanoHeaders(); break;
      case 'boxHeader': g = boxHeader(); break;
      case 'jst': g = jst(spec.pins ?? 2); break;
      case 'jumper': g = jumper(); break;
      case 'resistor': g = resistor(); break;
      case 'ceramic': g = ceramic(); break;
      case 'electrolytic': g = electrolytic(); break;
      case 'testpoint': g = testpoint(spec.color ?? 0xd8443a); break;
      case 'hole': g = holeMarker(); break;
    }
    const holder = new THREE.Group();
    holder.position.set(pl.x, T, pl.z);
    holder.rotation.y = deg(pl.rot);
    holder.add(g);
    root.add(holder);
    parts.set(spec.id, holder);
    partTopY.set(spec.id, T + PART_HEIGHT[spec.kind]);
    reg.addObject(spec.id, holder, new THREE.Vector3(0, PART_HEIGHT[spec.kind], 0));
    if (spec.kind === 'socket') {
      // The ORIGINAL U701 chip (MC14174B) lives here once installed.
      chip = new THREE.Group();
      const body = dipBody(16, 'MC14174BCP');
      body.position.y = 2.6;
      chip.add(body);
      holder.add(chip);
    }
    for (const n of pinNames(spec)) {
      const p = pin(`${spec.id}.${n}`);
      if (p) reg.addAnchor(`${spec.id}.${n}`, root, p);
    }
  }
  if (!chip || !nanoLed) throw new Error('board model incomplete');
  reg.addObject('ts.chip', chip, new THREE.Vector3(0, 6.6, 0));
  // Board-level anchors
  reg.addAnchor('ts.center', root, new THREE.Vector3(0, T, 0));
  reg.addAnchor('ts.silk', root, new THREE.Vector3(-layout.width / 2 + 14, T, -layout.height / 2 + 1.5));
  return { root, substrate, parts, chip, nanoLed, layout, pin, net, partTopY };
}
