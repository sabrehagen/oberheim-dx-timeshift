/**
 * 2D "inset" animations drawn on a canvas over the 3D view: timing diagrams, the mux,
 * the queue, the ribbon mapping, etc. Every drawing is a pure function of the stage-local
 * time `lt` (seconds) so scrubbing the timeline is deterministic. The same timing helpers
 * drive the matching 3D effects (snare glow, Nano LED, path switching).
 */
import { BUILD_STEPS, HEADER_TO_DIP, MAX_STEP } from './boardModel';
import { clamp01 } from './util';

export type InsetKind =
  | 'beats' | 'timing' | 'block' | 'capture' | 'mux' | 'clock' | 'pot' | 'power' | 'queue'
  | 'build' | 'model' | 'ribbon' | 'drill' | 'tap' | 'test' | 'bypass';

export const INSET_W = 440;
export const INSET_H = 236;

const C = {
  bg: 'rgba(12, 15, 22, 0.92)',
  grid: 'rgba(255,255,255,0.07)',
  text: '#e8ecf4',
  dim: '#8b93a7',
  faint: '#4a5266',
  rst: '#ffa23a',
  ffa: '#35d0ff',
  ffb: '#5cf29a',
  clk: '#7aa2ff',
  pot: '#c58bff',
  red: '#ff5a5a',
  pwr: '#ff4d4d',
  gnd: '#9aa3b5',
  sel: '#f6e05e',
  pink: '#ff6bd5',
  tbc: '#ffb020',
  ok: '#5cf29a',
};

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
const MONO = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, size: number, weight = 400, mono = false): void {
  ctx.font = `${weight} ${size}px ${mono ? MONO : FONT}`;
}
/** Part references in texts are written as {R4} (= the part that is R4 in the procedural model). */
let refOf: (procRef: string) => string = (r) => r;
export function setRefResolver(f: (procRef: string) => string): void {
  refOf = f;
}
export function fmtRefs(s: string): string {
  return s.includes('{') ? s.replace(/\{([A-Z]+\d+)\}/g, (_m, r: string) => refOf(r)) : s;
}

function text(ctx: Ctx, s0: string, x: number, y: number, color = C.text, size = 11, weight = 400, align: CanvasTextAlign = 'left', mono = false): void {
  const s = fmtRefs(s0);
  font(ctx, size, weight, mono);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
function title(ctx: Ctx, s: string, sub?: string): void {
  text(ctx, s, 14, 16, C.text, 13, 700);
  if (sub) text(ctx, sub, INSET_W - 14, 16, C.dim, 10.5, 400, 'right');
}
function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w = 1.5): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, stroke: string, fill = 'rgba(255,255,255,0.04)', r = 6, lw = 1.2): void {
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}
function dot(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
/** Digital waveform: level(u) in 0..1 for u in 0..1. Draws up to `upto` brightly, the rest faint. */
function wave(ctx: Ctx, x0: number, y: number, w: number, h: number, level: (u: number) => number, color: string, upto = 1, n = 360): void {
  const draw = (from: number, to: number, col: string, lw: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    let prev = -1;
    for (let i = Math.round(from * n); i <= Math.round(to * n); i++) {
      const u = i / n;
      const v = level(u);
      const px = x0 + u * w;
      const py = y + h - v * h;
      if (prev < 0) ctx.moveTo(px, py);
      else {
        if (Math.abs(v - prev) > 0.5) ctx.lineTo(px, y + h - prev * h);
        ctx.lineTo(px, py);
      }
      prev = v;
    }
    ctx.stroke();
  };
  draw(0, 1, C.faint, 1.2);
  if (upto > 0) draw(0, Math.min(1, upto), color, 2);
}
function warnTriangle(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 1.1, y + s * 0.8);
  ctx.lineTo(x - s * 1.1, y + s * 0.8);
  ctx.closePath();
  ctx.fill();
  text(ctx, '!', x, y + 1.5, '#1a1300', s * 1.2, 800, 'center');
}
const flash = (dtSince: number, len = 0.35): number => (dtSince >= 0 && dtSince < len ? 1 - dtSince / len : 0);

// ---------------------------------------------------------------------------
// Timing helpers shared with the 3D scene
// ---------------------------------------------------------------------------

/** "How the Z80 triggers the snare": one hit every TIMING_CYCLE seconds. */
export const TIMING_CYCLE = 4;
const T_W1 = 0.16;
const T_W2 = 0.34;
const T_W3 = 0.5;
export function timingSnare(lt: number): number {
  const u = (lt % TIMING_CYCLE) / TIMING_CYCLE;
  return u >= T_W3 ? Math.exp(-(u - T_W3) * TIMING_CYCLE * 2.2) : 0;
}

/** Capture stage: a hit every 1.6 s. Returns LED flash 0..1. */
export const CAPTURE_PERIOD = 1.6;
export function captureLed(lt: number): number {
  const ph = lt % CAPTURE_PERIOD;
  return flash(ph - 0.3, 0.25);
}

/** Mux stage: S low for 4 s, high for 4 s. */
export function muxSel(lt: number): number {
  return lt % 8 < 4 ? 0 : 1;
}

/** Replay stage: 4-beat bar, snare on beats 2 and 4, delayed by half a beat. */
export const Q_BEAT = 1.5;
export const Q_BAR = Q_BEAT * 4;
export const Q_DELAY = 0.5;
const Q_HITS = [1, 3];
const Q_LEVELS = ['LOUD', 'MED'];
export function queueEvents(lt: number): { capture: number; replay: number } {
  let capture = 0;
  let replay = 0;
  for (let bar = -1; bar <= Math.floor(lt / Q_BAR) + 1; bar++) {
    for (const b of Q_HITS) {
      const tc = bar * Q_BAR + b * Q_BEAT;
      capture = Math.max(capture, flash(lt - tc, 0.18));
      replay = Math.max(replay, flash(lt - tc - Q_DELAY * Q_BEAT, 0.6));
    }
  }
  return { capture, replay };
}

/** Test stage: BYPASS for the first 12 s (LED steady), then DELAY (LED flashes per hit). */
export const TEST_SPLIT = 12;
export function testLed(lt: number): number {
  if (lt < TEST_SPLIT) return 1;
  const ph = (lt - TEST_SPLIT) % 1.0;
  return flash(ph, 0.12) > 0 ? 1 : 0;
}

/** Build stage: build value (0..MAX_STEP) for stage progress p. */
export function buildAt(p: number): number {
  return clamp01((p - 0.04) / 0.86) * MAX_STEP;
}

// ---------------------------------------------------------------------------
// Inset drawings
// ---------------------------------------------------------------------------

function drawBeats(ctx: Ctx, lt: number): void {
  title(ctx, '1 beat = 96 clock ticks', 'delay is a fraction of a beat, not ms');
  const x0 = 120;
  const x1 = 424;
  const span = 720; // ms shown
  const X = (ms: number) => x0 + (ms / span) * (x1 - x0);
  const sweep = (lt % 4.5) / 4.5;
  const now = sweep * span;
  const rows: { y: number; bpm: number; label: string; fixed?: boolean }[] = [
    { y: 58, bpm: 120, label: '120 BPM' },
    { y: 118, bpm: 90, label: '90 BPM' },
    { y: 178, bpm: 90, label: 'plain timer', fixed: true },
  ];
  for (const r of rows) {
    const beatMs = 60000 / r.bpm;
    text(ctx, r.label, 14, r.y, r.fixed ? C.red : C.text, 12, 700);
    text(ctx, r.fixed ? 'fixed 250 ms' : `beat = ${Math.round(beatMs)} ms`, 14, r.y + 15, C.dim, 10);
    // beat span
    ctx.fillStyle = 'rgba(122,162,255,0.10)';
    ctx.fillRect(X(0), r.y - 12, X(beatMs) - X(0), 24);
    // ticks
    for (let k = 0; k <= 96; k++) {
      const ms = (k * beatMs) / 96;
      const big = k % 24 === 0;
      line(ctx, X(ms), r.y + 12, X(ms), r.y + (big ? 2 : 7), big ? C.clk : 'rgba(122,162,255,0.45)', big ? 1.4 : 0.8);
    }
    // original hit
    const hitOn = now >= 0 ? flash(now / 1000, 0.3) : 0;
    dot(ctx, X(0), r.y - 4, 5 + hitOn * 3, '#ffffff');
    // delayed hit
    const dMs = r.fixed ? 250 : beatMs / 2;
    const passed = now >= dMs;
    const glow = passed ? flash((now - dMs) / 1000, 0.4) : 0;
    dot(ctx, X(dMs), r.y - 4, 5 + glow * 4, r.fixed ? C.red : C.rst);
    const t = r.fixed ? `= ${(250 / beatMs).toFixed(3)} beat  (wrong)` : `½ beat = 48 ticks = ${Math.round(dMs)} ms`;
    text(ctx, t, X(dMs) + 9, r.y - 4, r.fixed ? C.red : C.rst, 10.5, 600);
  }
  // playhead
  line(ctx, X(now), 38, X(now), 196, 'rgba(255,255,255,0.55)', 1);
  text(ctx, 'white = DX snare   orange = TimeShift snare (knob at 50 %)', 14, 216, C.dim, 10);
}

function drawTiming(ctx: Ctx, lt: number): void {
  title(ctx, 'One snare hit, as the Z80 writes it', 'time axis not to scale');
  const u = (lt % TIMING_CYCLE) / TIMING_CYCLE;
  const x0 = 118;
  const w = 306;
  const rows = [
    { name: 'GEN0* (pin 9)', color: C.gnd },
    { name: 'FFA2/FFB2', color: C.ffa },
    { name: 'RST2 (pin 15)', color: C.rst },
    { name: '4040 counter', color: C.dim },
    { name: 'snare sound', color: C.pink },
  ];
  const y0 = 40;
  const dy = 33;
  rows.forEach((r, i) => text(ctx, r.name, 14, y0 + i * dy + 9, r.color, 11, 600));
  const pulse = (c: number) => (x: number) => (Math.abs(x - c) < 0.012 ? 0 : 1);
  wave(ctx, x0, y0, w, 18, (x) => Math.min(pulse(T_W1)(x), pulse(T_W2)(x), pulse(T_W3)(x)), C.gnd, u);
  // bus
  const yb = y0 + dy;
  ctx.strokeStyle = C.faint;
  ctx.lineWidth = 1.2;
  const bx = x0 + T_W1 * w;
  for (const [a, b] of [[x0, bx - 5], [bx + 5, x0 + w]] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(a, yb);
    ctx.lineTo(b, yb);
    ctx.moveTo(a, yb + 18);
    ctx.lineTo(b, yb + 18);
    ctx.stroke();
  }
  line(ctx, bx - 5, yb, bx + 5, yb + 18, C.faint, 1.2);
  line(ctx, bx - 5, yb + 18, bx + 5, yb, C.faint, 1.2);
  if (u > T_W1) {
    ctx.strokeStyle = C.ffa;
    ctx.lineWidth = 2;
    const e = x0 + Math.min(u, 1) * w;
    ctx.beginPath();
    ctx.moveTo(bx + 5, yb);
    ctx.lineTo(e, yb);
    ctx.moveTo(bx + 5, yb + 18);
    ctx.lineTo(e, yb + 18);
    ctx.stroke();
    text(ctx, 'new level, held', bx + 12, yb + 9, C.ffa, 10);
  } else text(ctx, 'old level', x0 + 6, yb + 9, C.dim, 10);
  // RST2
  wave(ctx, x0, y0 + 2 * dy, w, 18, (x) => (x >= T_W2 && x < T_W3 ? 1 : 0), C.rst, u);
  text(ctx, '≈ 9 µs … 0.2 ms', x0 + ((T_W2 + T_W3) / 2) * w, y0 + 2 * dy - 6, C.rst, 9.5, 600, 'center');
  // counter state
  const yc = y0 + 3 * dy + 9;
  text(ctx, 'stopped', x0 + 4, yc, u > 0 ? C.dim : C.faint, 10);
  text(ctx, 'held at 0', x0 + T_W2 * w + 4, yc, u > T_W2 ? C.text : C.faint, 10);
  text(ctx, 'counting →', x0 + T_W3 * w + 6, yc, u > T_W3 ? C.ffb : C.faint, 10, 600);
  // sound envelope
  const ys = y0 + 4 * dy;
  ctx.strokeStyle = C.faint;
  ctx.lineWidth = 1;
  line(ctx, x0, ys + 9, x0 + w, ys + 9, C.faint, 1);
  if (u > T_W3) {
    ctx.strokeStyle = C.pink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const end = Math.min(u, 1);
    for (let x = T_W3; x <= end; x += 0.002) {
      const env = Math.exp(-(x - T_W3) * 6);
      const s = Math.sin((x - T_W3) * 520) * env * 10;
      const px = x0 + x * w;
      if (x === T_W3) ctx.moveTo(px, ys + 9 - s);
      else ctx.lineTo(px, ys + 9 - s);
    }
    ctx.stroke();
  }
  // markers
  for (const [m, l] of [[T_W1, 'write 1'], [T_W2, 'write 2'], [T_W3, 'write 3']] as [number, string][]) {
    text(ctx, l, x0 + m * w, 34, u >= m ? C.text : C.faint, 9.5, 600, 'center');
  }
  const cx = x0 + u * w;
  line(ctx, cx, 30, cx, 214, 'rgba(255,255,255,0.4)', 1);
  const f = flash((u - T_W3) * TIMING_CYCLE, 0.9);
  if (f > 0) text(ctx, 'SOUND STARTS (RST2 falls)', x0 + T_W3 * w + 4, ys - 6, `rgba(255,107,213,${0.4 + 0.6 * f})`, 10.5, 700);
  text(ctx, 'Pulse width and level code: TO BE CONFIRMED with a logic analyser (Q2)', 14, 222, C.tbc, 9.5, 600);
}

function drawBlock(ctx: Ctx, lt: number): void {
  title(ctx, 'What the board does', 'signal flow');
  const bxs: [string, string, number, number, number, number, string][] = [
    ['U1 + original', 'U701 chip', 14, 46, 92, 40, C.ffa],
    ['Nano', 'capture → queue → replay', 150, 46, 132, 40, C.rst],
    ['U3 74HC157', 'A = bypass, B = delayed', 150, 128, 132, 40, C.pink],
    ['J1 → ribbon', '→ U701 socket → snare', 318, 128, 108, 40, C.text],
    ['CLOCK tap', 'R791 → U4 → D3', 318, 46, 108, 40, C.clk],
  ];
  for (const [a, b, x, y, w, h, col] of bxs) {
    box(ctx, x, y, w, h, col);
    text(ctx, a, x + w / 2, y + 14, col, 11.5, 700, 'center');
    text(ctx, b, x + w / 2, y + 29, C.dim, 9.5, 400, 'center');
  }
  const arrows: [number, number, number, number, string][] = [
    [106, 66, 150, 66, C.ffa], // chip -> nano
    [60, 86, 60, 148, C.ffb], // chip down
    [60, 148, 150, 148, C.ffb], // -> mux A
    [216, 86, 216, 128, C.rst], // nano -> mux B
    [282, 148, 318, 148, C.pink], // mux -> J1
    [318, 66, 282, 66, C.clk], // clock -> nano
  ];
  const t = lt * 0.8;
  for (const [x0, y0, x1, y1, col] of arrows) {
    line(ctx, x0, y0, x1, y1, col, 1.6);
    const ph = t % 1;
    dot(ctx, x0 + (x1 - x0) * ph, y0 + (y1 - y0) * ph, 2.6, col);
  }
  text(ctx, 'pins 10/12/15', 112, 58, C.dim, 9);
  text(ctx, 'A (direct)', 70, 118, C.ffb, 9.5, 600);
  text(ctx, 'B (D6/D7/D8)', 222, 108, C.rst, 9.5, 600);
  text(ctx, 'pot → J2 → A0 · S = D9 (10 kΩ pull-down = bypass)', 14, 196, C.dim, 10);
  text(ctx, '13 other pins: straight through U1 → J1', 14, 214, C.dim, 10);
}

function drawCapture(ctx: Ctx, lt: number): void {
  title(ctx, 'Capture: INT0 on the RST2 rising edge', 'one hit every 1.6 s');
  const x0 = 104;
  const w = 320;
  const winS = 4.8;
  const t0 = lt - winS * 0.75;
  const hitTimes: number[] = [];
  for (let k = Math.floor(t0 / CAPTURE_PERIOD) - 1; k <= Math.floor(lt / CAPTURE_PERIOD) + 1; k++) hitTimes.push(k * CAPTURE_PERIOD + 0.3);
  const inPulse = (tt: number) => hitTimes.some((h) => tt >= h && tt < h + 0.06);
  const flagOn = (tt: number) => hitTimes.some((h) => tt >= h && tt < h + 0.22);
  const tx = (tt: number) => x0 + ((tt - t0) / winS) * w;
  const rows: [string, string, (tt: number) => boolean][] = [
    ['RST2_IN (D2)', C.rst, inPulse],
    ['INT0 flag', C.sel, flagOn],
  ];
  rows.forEach(([name, col, f], i) => {
    const y = 42 + i * 34;
    text(ctx, name, 14, y + 9, col, 11, 600);
    wave(ctx, x0, y, w, 16, (u) => (f(t0 + u * winS) ? 1 : 0), col, clamp01((lt - t0) / winS));
  });
  const nowX = tx(lt);
  line(ctx, nowX, 36, nowX, 106, 'rgba(255,255,255,0.45)', 1);
  // ring buffer
  const levels: [string, number, number][] = [['LOUD', 1, 1], ['MED', 0, 1], ['SOFT', 0, 0]];
  const n = Math.floor((lt - 0.3) / CAPTURE_PERIOD);
  text(ctx, 'ISR reads FFA2 (D4) + FFB2 (D5) in one instruction and pushes:', 14, 122, C.dim, 10);
  const cur = n >= 0 ? levels[n % 3] : null;
  if (cur) {
    const f = flash(lt - 0.3 - n * CAPTURE_PERIOD, 0.9);
    box(ctx, 14, 132, 412, 24, `rgba(53,208,255,${0.35 + 0.6 * f})`, 'rgba(53,208,255,0.06)');
    text(ctx, `{ A = ${cur[1]}, B = ${cur[2]} (${cur[0]}), t = micros(), tick = ${1200 + n * 77} }`, 22, 144, C.ffa, 10.5, 600, 'left', true);
  }
  text(ctx, 'queue (32 places):', 14, 172, C.dim, 10);
  const used = n < 0 ? 0 : Math.min(32, (n % 4) + 1);
  for (let i = 0; i < 32; i++) {
    const x = 112 + i * 9.6;
    const filled = i < used;
    ctx.fillStyle = filled ? C.ffa : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, 165, 7.6, 14);
  }
  text(ctx, 'Level code (soft/med/loud): INFERRED, TO BE CONFIRMED (b3)', 14, 198, C.tbc, 9.5, 600);
  text(ctx, 'R1–R3 (1 kΩ) protect U1 pins 15/12/10 and the Nano', 14, 216, C.dim, 10);
}

function drawMux(ctx: Ctx, lt: number): void {
  const s = muxSel(lt);
  title(ctx, 'U3 74HC157: one select pin, three switches', s ? 'S = HIGH → B' : 'S = LOW → A');
  const chans = [
    ['1: RST2', 'U1-15', 'D6', 'J1-15'],
    ['2: FFA2', 'U1-12', 'D7', 'J1-12'],
    ['3: FFB2', 'U1-10', 'D8', 'J1-10'],
  ];
  const ph = lt % 4;
  const swing = clamp01(ph / 0.35);
  const ang = s ? -0.35 + 0.7 * swing : 0.35 - 0.7 * swing;
  const arm = s ? 0.35 : -0.35;
  const a = ph < 0.35 ? ang : arm;
  box(ctx, 150, 34, 150, 158, C.pink, 'rgba(255,107,213,0.05)');
  text(ctx, 'U3 74HC157', 225, 46, C.pink, 11, 700, 'center');
  chans.forEach(([name, ain, bin, out], i) => {
    const y = 72 + i * 42;
    text(ctx, name, 225, y - 12, C.dim, 9.5, 600, 'center');
    // inputs
    const ay = y - 8;
    const by = y + 8;
    line(ctx, 60, ay, 196, ay, s ? C.faint : C.ffb, 1.6);
    line(ctx, 60, by, 196, by, s ? C.rst : C.faint, 1.6);
    text(ctx, `${ain} A`, 14, ay, s ? C.dim : C.ffb, 10, 600);
    text(ctx, `${bin} B`, 14, by, s ? C.rst : C.dim, 10, 600);
    // switch arm pivot at (250, y)
    const px = 250;
    dot(ctx, 200, ay, 2.5, C.text);
    dot(ctx, 200, by, 2.5, C.text);
    dot(ctx, px, y, 3, C.text);
    line(ctx, px, y, px - 50 * Math.cos(a), y + 50 * Math.sin(a) * 0.32, C.text, 2);
    line(ctx, px, y, 380, y, C.pink, 1.6);
    text(ctx, `Y → ${out}`, 384, y, C.pink, 10, 600);
    // travelling dot
    const t = (lt * 0.9 + i * 0.2) % 1;
    const fromY = s ? by : ay;
    if (t < 0.5) dot(ctx, 60 + (196 - 60) * (t / 0.5), fromY, 2.6, s ? C.rst : C.ffb);
    else dot(ctx, 250 + (380 - 250) * ((t - 0.5) / 0.5), y, 2.6, C.pink);
  });
  // S line
  line(ctx, 225, 192, 225, 206, C.sel, 1.6);
  text(ctx, s ? 'S (pin 1) = HIGH: Nano D9 raised → B = delayed copy' : 'S (pin 1) = LOW: {R4} 10 kΩ pull-down → A = bypass (stock DX)', 14, 214, C.sel, 10.5, 600);
  text(ctx, 'ch. 4 unused: 4A, 4B to GND · /E (pin 15) = GND', 14, 228, C.dim, 9.5);
}

function drawClock(ctx: Ctx, lt: number): void {
  title(ctx, 'Clock conditioning: R791 → J3 → U4 → D3', '96 ticks per beat');
  const x0 = 128;
  const w = 296;
  const period = 1; // one tick per unit
  const win = 3.2;
  const t0 = lt * 0.7;
  const hi = (t: number) => {
    const ph = ((t % period) + period) % period;
    return ph < 0.18 ? 1 : 0;
  };
  const smooth = (t: number) => {
    const ph = ((t % period) + period) % period;
    if (ph < 0.18) return 1 - Math.exp(-ph / 0.03);
    const top = 1 - Math.exp(-0.18 / 0.03);
    return top * Math.exp(-(ph - 0.18) / 0.03);
  };
  const raw = (t: number) => {
    const s = smooth(t);
    return clamp01(s + Math.sin(t * 157) * 0.035 + Math.sin(t * 71) * 0.025);
  };
  const rows: [string, string, string, (t: number) => number][] = [
    ['R791 / CLOCK OUT', 'idles low, rising edge = tick', C.clk, raw],
    ['after {R5} 10 kΩ, {C5} 1 nF', 'slightly rounded', C.clk, smooth],
    ['U4 gate 1 (inverted)', 'clean, upside down', C.dim, (t) => 1 - hi(t)],
    ['U4 gate 2 → D3 (INT1)', 'clean, rising edge = tick', C.ffb, hi],
  ];
  rows.forEach(([name, sub, col, f], i) => {
    const y = 38 + i * 42;
    text(ctx, name, 14, y + 6, col, 10.5, 700);
    text(ctx, sub, 14, y + 20, C.dim, 9);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let k = 0; k <= 300; k++) {
      const u = k / 300;
      const v = f(t0 + u * win);
      const px = x0 + u * w;
      const py = y + 24 - v * 22;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  });
  // rising-edge markers
  for (let k = Math.ceil(t0); k < t0 + win; k++) {
    const px = x0 + ((k - t0) / win) * w;
    line(ctx, px, 34, px, 206, 'rgba(92,242,154,0.25)', 1);
    text(ctx, 'tick', px + 3, 212, C.ffb, 9, 600);
  }
  text(ctx, '120 BPM → one tick every 5.21 ms · pulse ≈ 0.85 ms (TBC, Q5)', 14, 226, C.tbc, 9.5, 600);
}

function drawPot(ctx: Ctx, lt: number): void {
  title(ctx, 'Knob position → delay', 'delay_ticks = round(f × 96)');
  const f = 0.5 - 0.5 * Math.cos((lt / 10) * Math.PI * 2);
  const cx = 74;
  const cy = 112;
  const r = 46;
  // dial
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();
  ctx.strokeStyle = C.pot;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.75 + f * Math.PI * 1.5);
  ctx.stroke();
  const a = Math.PI * 0.75 + f * Math.PI * 1.5;
  dot(ctx, cx, cy, 24, '#15171d');
  line(ctx, cx, cy, cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, C.text, 3);
  text(ctx, '0', cx - 40, cy + 44, C.dim, 10, 600, 'center');
  text(ctx, '1 BEAT', cx + 40, cy + 44, C.dim, 10, 600, 'center');
  text(ctx, 'SNARE DELAY', cx, cy + 62, C.text, 10.5, 700, 'center');
  const pct = f * 100;
  const bypass = pct <= 1;
  const ticks = Math.round(f * 96);
  const x = 160;
  text(ctx, `wiper = ${(f * 5).toFixed(2)} V   →   A0 = ${Math.round(f * 1023)} of 1023`, x, 48, C.pot, 11, 600);
  text(ctx, `pot = ${pct.toFixed(1)} %`, x, 72, C.text, 13, 700);
  box(ctx, x + 112, 61, 88, 22, bypass ? C.sel : C.rst, bypass ? 'rgba(246,224,94,0.12)' : 'rgba(255,162,58,0.12)', 5);
  text(ctx, bypass ? 'BYPASS (≤ 1 %)' : 'DELAY', x + 156, 72, bypass ? C.sel : C.rst, 11, 700, 'center');
  text(ctx, `delay = ${f.toFixed(2)} beat ≈ ${ticks} ticks`, x, 100, C.text, 11.5, 600);
  text(ctx, `at 120 BPM: ${bypass ? 0 : Math.round(f * 500)} ms`, x, 124, C.dim, 11);
  text(ctx, `at 90 BPM:  ${bypass ? 0 : Math.round(f * 667)} ms`, x, 142, C.dim, 11);
  // bar
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, 160, 260, 10);
  ctx.fillStyle = C.pot;
  ctx.fillRect(x, 160, 260 * f, 10);
  for (let k = 0; k <= 4; k++) line(ctx, x + k * 65, 158, x + k * 65, 174, 'rgba(255,255,255,0.3)', 1);
  text(ctx, 'read 100×/s, 16-sample average + hysteresis (no jitter)', x, 190, C.dim, 9.5);
  text(ctx, 'J2: 1 = GND (CCW) · 2 = wiper · 3 = +5 V (CW)', 14, 214, C.pot, 10, 600);
}

function drawPower(ctx: Ctx, lt: number): void {
  title(ctx, 'Power comes through the U701 socket', '< 60 mA');
  const rows: [string, string][] = [
    ['+5 V', 'U701 pin 16 → J1 → {C1} 10 µF + 100 nF per chip'],
    ['GND', 'U701 pin 8 → J1'],
    ['±12 V', 'not on this socket, not needed'],
    ['+5M', 'battery-backed memory rail: never use'],
  ];
  rows.forEach(([a, b], i) => {
    const y = 44 + i * 20;
    text(ctx, a, 14, y, i === 0 ? C.pwr : i === 1 ? C.gnd : C.dim, 11.5, 700);
    text(ctx, b, 64, y, C.text, 10.5);
  });
  // warning box
  const pulse = 0.55 + 0.45 * Math.sin(lt * 4);
  box(ctx, 14, 128, 412, 76, `rgba(255,90,90,${pulse})`, 'rgba(255,90,90,0.10)', 8, 2);
  warnTriangle(ctx, 40, 156, 13, C.tbc);
  text(ctx, 'UNPLUG NANO BEFORE USB', 64, 150, '#ffdede', 14, 800);
  text(ctx, 'The Nano 5 V pin is the DX logic supply. USB into an installed', 64, 170, C.text, 10);
  text(ctx, 'Nano with the DX off would try to power the whole DX board.', 64, 184, C.text, 10);
  text(ctx, 'Flash it OUT of the board, or only with the DX switched ON.', 64, 198, C.tbc, 10, 700);
  text(ctx, 'Drop between +5 TEST PAD and U701 pin 16 > 50 mV? Add a 2-wire lead (Q7, TBC)', 14, 222, C.tbc, 9.5, 600);
}

function drawQueue(ctx: Ctx, lt: number): void {
  title(ctx, 'Replay: same hits, half a beat later', 'knob at 50 %');
  const x0 = 104;
  const w = 320;
  const t = lt % Q_BAR;
  const bar = Math.floor(lt / Q_BAR);
  const X = (s: number) => x0 + (s / Q_BAR) * w;
  // grid
  for (let b = 0; b <= 4; b++) {
    line(ctx, X(b * Q_BEAT), 36, X(b * Q_BEAT), 160, 'rgba(255,255,255,0.12)', 1);
    if (b < 4) text(ctx, `beat ${b + 1}`, X(b * Q_BEAT) + 4, 40, C.dim, 9);
  }
  text(ctx, 'DX writes', 14, 66, C.text, 11, 700);
  text(ctx, '(U1 RST2)', 14, 80, C.dim, 9.5);
  text(ctx, 'queue', 14, 106, C.ffa, 11, 700);
  text(ctx, 'TimeShift', 14, 138, C.rst, 11, 700);
  text(ctx, '(J1 RST2)', 14, 152, C.dim, 9.5);
  let waiting = 0;
  Q_HITS.forEach((b, i) => {
    const tc = b * Q_BEAT;
    const tr = tc + Q_DELAY * Q_BEAT;
    const lvl = Q_LEVELS[i];
    const cOn = t >= tc;
    const rOn = t >= tr;
    dot(ctx, X(tc), 70, cOn ? 6 : 4, cOn ? '#ffffff' : C.faint);
    text(ctx, lvl, X(tc), 56, cOn ? C.text : C.faint, 9, 600, 'center');
    dot(ctx, X(tr), 142, rOn ? 6 + 3 * flash(t - tr, 0.5) : 4, rOn ? C.rst : C.faint);
    text(ctx, lvl, X(tr), 126, rOn ? C.rst : C.faint, 9, 600, 'center');
    if (cOn && !rOn) {
      waiting++;
      const q = (t - tc) / (tr - tc);
      const bx = X(tc) + (X(tr) - X(tc)) * q;
      box(ctx, bx - 18, 97, 36, 18, C.ffa, 'rgba(53,208,255,0.15)', 4);
      text(ctx, lvl, bx, 106, C.ffa, 9, 700, 'center');
    }
    line(ctx, X(tc), 76, X(tr), 136, 'rgba(255,162,58,0.18)', 1);
  });
  line(ctx, X(t), 34, X(t), 162, 'rgba(255,255,255,0.5)', 1);
  const hits = bar * 2 + Q_HITS.filter((b) => t >= b * Q_BEAT).length;
  const rep = bar * 2 + Q_HITS.filter((b) => t >= (b + Q_DELAY) * Q_BEAT).length;
  text(ctx, `queue=${waiting}  hits=${hits}  replayed=${rep}`, 14, 182, C.text, 10.5, 600, 'left', true);
  text(ctx, 'replay: set D7/D8 levels, wait 2 µs, D6 (RST2) high 20 µs, low', 14, 202, C.dim, 10);
  text(ctx, 'due when elapsed ≥ knob × PPQN × measured tick time', 14, 220, C.dim, 10);
}

function drawBuild(ctx: Ctx, _lt: number, p: number): void {
  const b = buildAt(p);
  title(ctx, 'Assembly order (lowest parts first)', `step ${Math.min(MAX_STEP, Math.max(1, Math.ceil(b)))} of ${MAX_STEP}`);
  BUILD_STEPS.forEach((s, i) => {
    const y = 40 + i * 18.6;
    const done = b >= s.step - 0.001;
    const cur = b > s.step - 1 && b < s.step;
    if (cur) {
      ctx.fillStyle = 'rgba(53,208,255,0.12)';
      ctx.fillRect(10, y - 9, 420, 18);
    }
    box(ctx, 16, y - 6, 12, 12, done ? C.ok : cur ? C.ffa : C.faint, done ? 'rgba(92,242,154,0.25)' : 'transparent', 2, 1.2);
    if (done) {
      ctx.strokeStyle = C.ok;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18.5, y);
      ctx.lineTo(21.5, y + 3);
      ctx.lineTo(26, y - 3.5);
      ctx.stroke();
    }
    text(ctx, `${s.step}. ${s.text}`, 36, y, done ? C.text : cur ? C.ffa : C.dim, 11, cur ? 700 : 500);
  });
}

function drawModel(ctx: Ctx, lt: number): void {
  title(ctx, 'Which DX do you have?', 'pin numbers change!');
  const head = ['Model', 'How to tell', 'Snare latch', 'Fits?'];
  const xs = [14, 96, 260, 356];
  head.forEach((h, i) => text(ctx, h, xs[i], 42, C.dim, 10, 700));
  line(ctx, 12, 52, 428, 52, 'rgba(255,255,255,0.15)', 1);
  const rows: [string, string, string, string, string, string][] = [
    ['DX', 'no MIDI jacks', 'board 1721A', 'U701 15/12/10', 'YES', C.ok],
    ['DXa', 'MIDI IN/OUT on rear', 'board 1906', 'U715 7/5/2', 'NO', C.red],
    ['DX + Stretch', 'extra voice panel', 'or MIDI upgrade', 'U701 (inferred)', 'TBC', C.tbc],
  ];
  const hl = Math.floor(lt / 3) % 3;
  rows.forEach(([m, a, b, latch, fit, col], i) => {
    const y = 72 + i * 44;
    if (i === hl) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(10, y - 14, 420, 40);
    }
    text(ctx, m, xs[0], y, C.text, 12, 700);
    text(ctx, a, xs[1], y, C.text, 10.5);
    text(ctx, b, xs[1], y + 15, C.dim, 10);
    text(ctx, latch, xs[2], y, C.text, 10.5, 600);
    text(ctx, fit, xs[3], y, col, 12, 800);
  });
  text(ctx, 'Read the main-board title and the ROM labels (U713/U714) first (Q0).', 14, 206, C.dim, 10);
  text(ctx, 'U701 socketed? Lid clearance? TO BE CONFIRMED (Q1, Q3)', 14, 224, C.tbc, 10, 600);
}

function drawRibbon(ctx: Ctx, lt: number): void {
  title(ctx, 'Ribbon: J1 header pin → DIP plug pin', 'check every pin with a meter');
  // J1 box header (left, 2 rows x 8 columns, pin 1 top-left) and the DIP-16 plug (right).
  const hx = 28;
  const hy = 66;
  const pitch = 18;
  const hdr = (h: number): [number, number] => {
    const col = Math.floor((h - 1) / 2);
    const row = (h - 1) % 2;
    return [hx + col * pitch, hy + row * 22];
  };
  const dx0 = 286;
  const dip = (d: number): [number, number] => (d <= 8 ? [dx0 + (d - 1) * 18, 112] : [dx0 + (16 - d) * 18, 66]);
  box(ctx, hx - 12, hy - 14, pitch * 7 + 24, 50, C.dim, 'rgba(255,255,255,0.03)', 4);
  text(ctx, 'J1 box header (TimeShift)', hx - 10, hy - 22, C.dim, 9.5, 600);
  box(ctx, dx0 - 12, 52, 18 * 7 + 24, 74, C.dim, 'rgba(255,255,255,0.03)', 4);
  text(ctx, 'DIP-16 plug (U701 socket)', dx0 - 10, 44, C.dim, 9.5, 600);
  ctx.strokeStyle = C.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(dx0 - 12, 89, 7, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  const sweep = (Math.floor(lt / 0.9) % 16) + 1;
  const special: Record<number, string> = { 15: C.rst, 12: C.ffa, 10: C.ffb, 16: C.pwr, 8: C.gnd };
  for (let h = 1; h <= 16; h++) {
    const d = HEADER_TO_DIP[h - 1];
    const [ax, ay] = hdr(h);
    const [bx, by] = dip(d);
    const col = special[d];
    const active = h === sweep;
    ctx.strokeStyle = active ? '#ffffff' : col ?? 'rgba(255,255,255,0.10)';
    ctx.lineWidth = active ? 2 : col ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.bezierCurveTo(ax + 30, 150, bx - 30, 150, bx, by);
    ctx.stroke();
  }
  for (let h = 1; h <= 16; h++) {
    const d = HEADER_TO_DIP[h - 1];
    const [ax, ay] = hdr(h);
    const col = special[d] ?? C.text;
    dot(ctx, ax, ay, 6, h === sweep ? '#ffffff' : '#262b36');
    text(ctx, String(d), ax, ay + 0.5, h === sweep ? '#000' : col, 8.5, 700, 'center');
  }
  for (let d = 1; d <= 16; d++) {
    const [bx, by] = dip(d);
    const col = special[d] ?? C.text;
    const h = HEADER_TO_DIP.indexOf(d) + 1;
    dot(ctx, bx, by, 6, h === sweep ? '#ffffff' : '#262b36');
    text(ctx, String(d), bx, by + 0.5, h === sweep ? '#000' : col, 8.5, 700, 'center');
  }
  const d = HEADER_TO_DIP[sweep - 1];
  text(ctx, `beep: conductor ${sweep} → DIP pin ${d}`, 14, 172, C.text, 10.5, 600, 'left', true);
  text(ctx, 'numbers = DIP pin · red wire = conductor 1 = DIP pin 1', 14, 190, C.dim, 9.5);
  text(ctx, 'orange / blue / green = snare 15 / 12 / 10 (via U3) · red = +5 V (16)', 14, 206, C.dim, 9.5);
  text(ctx, 'Mapping TO BE CONFIRMED with a meter before first power-up (mandatory)', 14, 224, C.tbc, 9.5, 600);
}

function drawDrill(ctx: Ctx, lt: number): void {
  title(ctx, 'Rear panel, seen from behind', 'hole position TBC (Q6)');
  const names = ['PERC', 'CYMBAL', 'TOMS', 'HI-HAT', 'SNARE', 'BASS'];
  const x0 = 120;
  const pitch = 52;
  box(ctx, 14, 34, 412, 150, 'rgba(255,255,255,0.15)', '#1b1c20', 4);
  text(ctx, 'DRUM TUNING', x0 + pitch * 2.5, 48, C.text, 10, 700, 'center');
  names.forEach((n, i) => {
    const x = x0 + i * pitch;
    dot(ctx, x, 74, 9, '#07070a');
    dot(ctx, x, 74, 4, '#9aa0aa');
    text(ctx, n, x, 94, n === 'SNARE' ? C.rst : C.text, 9.5, 700, 'center');
  });
  const hx = x0 + 4 * pitch;
  const hy = 126;
  const blink = 0.5 + 0.5 * Math.sin(lt * 5);
  ctx.strokeStyle = `rgba(255,162,58,${0.4 + 0.6 * blink})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx, hy, 11, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, hx - 18, hy, hx + 18, hy, C.rst, 1);
  line(ctx, hx, hy - 18, hx, hy + 18, C.rst, 1);
  text(ctx, 'new hole', hx - 22, hy, C.rst, 10, 700, 'right');
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(20, 108, 400, 36);
  text(ctx, 'blank band ≈ 20 mm (inferred)', 30, 136, C.dim, 9);
  for (let i = 0; i < 7; i++) dot(ctx, 40 + i * 54, 164, 7, '#07070a');
  text(ctx, 'jacks', 30, 178, C.dim, 9);
  text(ctx, 'Before drilling: ≥ 25 mm free depth and ≥ 12 mm clear radius behind it;', 14, 200, C.text, 10);
  text(ctx, 'the tuning-pot board sits behind the panel. TO BE CONFIRMED (Q6)', 14, 216, C.tbc, 10, 600);
}

function drawTap(ctx: Ctx, lt: number): void {
  title(ctx, 'Where the clock is tapped', 'findings d1/d4');
  // +5 rail
  text(ctx, '+5 V', 40, 44, C.pwr, 10.5, 700, 'center');
  line(ctx, 40, 52, 40, 64, C.pwr, 1.6);
  // R791 box
  box(ctx, 30, 64, 20, 40, C.text, 'transparent', 2);
  text(ctx, 'R791', 56, 84, C.text, 10, 700);
  text(ctx, '1 kΩ', 56, 97, C.dim, 9.5);
  line(ctx, 40, 104, 40, 130, C.clk, 2);
  // node
  dot(ctx, 40, 130, 4, C.clk);
  line(ctx, 40, 130, 190, 130, C.clk, 2);
  text(ctx, 'to CLOCK OUT jack tip', 196, 130, C.clk, 10, 600);
  // Q709
  line(ctx, 40, 130, 40, 150, C.text, 1.6);
  ctx.strokeStyle = C.text;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(52, 166, 18, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, 46, 154, 46, 178, C.text, 2);
  line(ctx, 40, 150, 46, 158, C.text, 1.4);
  line(ctx, 46, 174, 40, 182, C.text, 1.4);
  line(ctx, 40, 182, 40, 200, C.gnd, 1.6);
  text(ctx, 'GND (emitter)', 46, 206, C.gnd, 9.5, 600);
  text(ctx, 'Q709', 76, 166, C.text, 10, 700);
  line(ctx, 46, 166, 110, 166, C.text, 1.4);
  box(ctx, 110, 158, 40, 16, C.text, 'transparent', 2);
  text(ctx, 'R792 4.7k', 130, 186, C.dim, 9.5, 600, 'center');
  line(ctx, 150, 166, 200, 166, C.dim, 1.4);
  text(ctx, '← COUT, U710 pin 2 (inverted)', 204, 166, C.dim, 9.5);
  // grabber marker
  const b = 0.5 + 0.5 * Math.sin(lt * 4);
  ctx.strokeStyle = `rgba(122,162,255,${0.4 + 0.6 * b})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(40, 116, 9, 0, Math.PI * 2);
  ctx.stroke();
  text(ctx, 'TAP HERE: R791 lead, Q709 side', 70, 116, C.clk, 10.5, 700);
  // waveform
  const x0 = 250;
  const w = 170;
  text(ctx, 'signal at the tap', x0, 48, C.dim, 9.5, 600);
  wave(ctx, x0, 58, w, 26, (u) => (((u * 4 + lt * 0.8) % 1) < 0.2 ? 1 : 0), C.clk, 1);
  text(ctx, '0 V idle, 5 V pulse, rising edge = tick', x0, 98, C.dim, 9);
  text(ctx, 'Pulse width / clock while stopped: TBC (Q5)', 14, 224, C.tbc, 9.5, 600);
}

const TEST_LINES_BYPASS = [
  'DX TimeShift rev A - snare delay - Oberheim DX board 1721A (U701)',
  'PPQN jumper JP1 open -> 96 PPQN   (open=96, 1-2=48, 3-4=24)',
  'mode=BYPASS pot=0.0% delay=0.0ms ppqn=96 (JP1 open) bpm=120.0 clock=NONE queue=0 hits=0 replayed=0 dropped=0',
  'mode=BYPASS pot=0.0% delay=0.0ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=0 hits=4 replayed=0 dropped=0',
];
const TEST_LINES_DELAY = [
  'mode=DELAY pot=50.0% delay=250.2ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=1 hits=9 replayed=8 dropped=0',
  'mode=DELAY pot=50.0% delay=250.2ms ppqn=96 (JP1 open) bpm=120.0 clock=RUN queue=0 hits=11 replayed=11 dropped=0',
];

function drawTest(ctx: Ctx, lt: number): void {
  const delay = lt >= TEST_SPLIT;
  title(ctx, 'Serial monitor, 115200 baud', delay ? 'knob at 50 %' : 'knob at 0');
  box(ctx, 12, 30, 416, 128, 'rgba(255,255,255,0.12)', '#07090d', 4);
  const lines = delay ? [...TEST_LINES_BYPASS.slice(2), ...TEST_LINES_DELAY] : TEST_LINES_BYPASS;
  const shown = delay ? Math.min(lines.length, 2 + Math.floor((lt - TEST_SPLIT) / 2.5) + 1) : Math.min(lines.length, Math.floor(lt / 2.2) + 1);
  const vis = lines.slice(0, shown).slice(-5);
  vis.forEach((l, i) => {
    const s = l.length > 66 ? `${l.slice(0, 66)}…` : l;
    text(ctx, s, 20, 46 + i * 22, l.startsWith('mode=DELAY') ? C.rst : l.startsWith('mode=') ? C.ffb : C.dim, 9, 500, 'left', true);
  });
  // LED
  const led = testLed(lt);
  dot(ctx, 30, 182, 9, led ? '#ffb347' : '#3a2a14');
  if (led) dot(ctx, 30, 182, 14, 'rgba(255,179,71,0.25)');
  text(ctx, 'Nano LED (D13):', 48, 182, C.text, 11, 700);
  text(ctx, delay ? 'flashes once per captured snare = DELAY' : 'steady on = BYPASS (stock)', 150, 182, delay ? C.rst : C.ffb, 11, 600);
  text(ctx, 'Scope TP2 (RST2 in) vs TP1 (replay): the gap is the delay. TP4 = GND.', 14, 208, C.dim, 10);
  text(ctx, 'USB only with the DX switched ON (or the Nano out of the board)', 14, 224, C.tbc, 10, 600);
}

function drawBypass(ctx: Ctx, lt: number): void {
  title(ctx, 'How it behaves', 'fail-safe = stock DX');
  const rows: [string, string, string][] = [
    ['Knob at 0 (≤ 1 %)', 'BYPASS: U701 drives the snare directly', C.ffb],
    ['Knob turned up', 'DELAY: snare later by knob × 1 beat', C.rst],
    ['Nano missing / blank / booting', 'BYPASS: {R4} pulls S low', C.ffb],
    ['Clock stopped > 2 s', 'last measured tempo kept', C.clk],
    ['No clock ever seen', '120 BPM assumed', C.clk],
    ['Undo the mod', 'unplug, put U701 back: stock again', C.text],
  ];
  const hl = Math.floor(lt / 2.5) % rows.length;
  rows.forEach(([a, b, col], i) => {
    const y = 44 + i * 29;
    if (i === hl) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(10, y - 12, 420, 24);
    }
    text(ctx, a, 16, y, C.text, 11, 700);
    text(ctx, b, 206, y, col, 10.5, 600);
  });
  text(ctx, 'Only permanent change: one hole in the rear panel.', 14, 224, C.dim, 10);
}

const DRAW: Record<InsetKind, (ctx: Ctx, lt: number, p: number) => void> = {
  beats: drawBeats,
  timing: drawTiming,
  block: drawBlock,
  capture: drawCapture,
  mux: drawMux,
  clock: drawClock,
  pot: drawPot,
  power: drawPower,
  queue: drawQueue,
  build: drawBuild,
  model: drawModel,
  ribbon: drawRibbon,
  drill: drawDrill,
  tap: drawTap,
  test: drawTest,
  bypass: drawBypass,
};

export class Inset {
  readonly el: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  kind: InsetKind | null = null;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;

  constructor(el: HTMLDivElement) {
    this.el = el;
    const c = el.querySelector('canvas');
    if (!c) throw new Error('inset canvas missing');
    this.canvas = c;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  set(kind: InsetKind | null): void {
    this.kind = kind;
    this.el.classList.toggle('hidden', !kind);
  }

  /** Draw for stage-local time `lt`; `cssW`/`cssH` = current on-screen size of the inset. */
  draw(lt: number, p: number, cssW: number, cssH: number): void {
    if (!this.kind || cssW <= 0 || cssH <= 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cssW !== this.cssW || cssH !== this.cssH || dpr !== this.dpr) {
      this.cssW = cssW;
      this.cssH = cssH;
      this.dpr = dpr;
      this.canvas.width = Math.max(1, Math.round(cssW * dpr));
      this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.canvas.width / INSET_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, INSET_W, INSET_H);
    DRAW[this.kind](ctx, Math.max(0, lt), p);
  }
}
