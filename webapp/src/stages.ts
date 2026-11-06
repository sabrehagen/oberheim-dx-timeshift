/**
 * The walkthrough, as data. Each stage says where the camera goes, what is highlighted,
 * which signals glow, which labels appear in the 3D scene and what the side panel says.
 *
 * Facts and pin numbers come from PROJECT_BRIEF.md §3 and docs/research/dx-findings.md.
 * Anything the brief marks TO BE CONFIRMED is labelled that way here too (`tbc: true`).
 */
import type { Vec3 } from './util';
import { clamp01 } from './util';
import { BUILD_STEPS, PARTS } from './boardModel';
import {
  buildAt, captureLed, muxSel, queueEvents, testLed, timingSnare, TEST_SPLIT, type InsetKind,
} from './insets';
import type { ScalarKey } from './state';

export type Dir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface LabelDef {
  anchor: string;
  text: string;
  sub?: string;
  dir?: Dir;
  len?: number;
  tbc?: boolean;
  warn?: boolean;
  /** visible window as stage progress [from, to] */
  at?: [number, number];
}

export interface CamKey {
  at: number;
  /** anchor id or world point */
  target: string | Vec3;
  /** camera position relative to the target (world mm) */
  offset: Vec3;
}

export type Scalars = Partial<Record<ScalarKey, number>>;

export interface Stage {
  id: string;
  chapter: string;
  title: string;
  /** Side-panel paragraphs (plain text). */
  body: string[];
  /** Open questions shown in the panel with a TO BE CONFIRMED badge. */
  tbc?: string[];
  /** Safety warnings shown in the panel. */
  warn?: string[];
  /** Seconds at 1× speed. */
  duration: number;
  cam: CamKey[];
  state: Scalars | ((p: number, lt: number) => Scalars);
  highlight?: string[] | ((p: number, lt: number) => string[]);
  fade?: string[];
  /** board-part lift in mm (explode) */
  explode?: Record<string, number>;
  paths?: string[] | ((p: number, lt: number) => string[]);
  labels?: LabelDef[];
  dynLabels?: (p: number, lt: number) => LabelDef[];
  inset?: InsetKind;
  snare?: (lt: number, p: number) => number;
  led?: (lt: number, p: number) => number;
  ribbonGlow?: number[] | ((lt: number) => number[]);
  ribbonPulse?: (lt: number) => number;
  cablePulse?: { pot?: boolean | ((p: number) => boolean); clk?: boolean | ((p: number) => boolean) };
  /** use the procedural board even when the KiCad GLB is loaded (build animation) */
  buildMode?: boolean;
}

/** Smooth 0→1 ramp between progress a and b. */
export const ramp = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a));

// Common scene setups -------------------------------------------------------
const STOCK: Scalars = { board: 0, boardHidden: 1, chip: 0, plug: 1, ribbon: 0, potLead: 0, clockLead: 0, hole: 0, pot: 0, build: 99 };
const BENCH: Scalars = { board: 0, boardHidden: 0, chip: 1, plug: 0, ribbon: 0, potLead: 0, clockLead: 0, hole: 0, pot: 0, lid: 1, build: 99 };
const INSTALLED: Scalars = { board: 1, boardHidden: 0, chip: 1, plug: 0, ribbon: 1, potLead: 1, clockLead: 1, hole: 1, pot: 1, lid: 1, build: 99 };

/** Board parts other than the substrate, used to dim everything that is not highlighted. */
const DIM_TS = ['ts.U*', 'ts.R*', 'ts.C*', 'ts.J*', 'ts.TP*', 'ts.NanoHdr', 'ts.chip'];

const partsAtStep = (step: number): string[] => PARTS.filter((p) => p.step === step).map((p) => p.id);

export const STAGES: Stage[] = [
  // ------------------------------------------------------------------ 1
  {
    id: 'welcome',
    chapter: 'Intro',
    title: 'DX TimeShift: let the snare lay back',
    duration: 16,
    body: [
      'This is an Oberheim DX drum machine from 1983. We are going to give it one new knob on the back panel: SNARE DELAY.',
      'Turn the knob up and every snare hit plays a little later, by up to one whole beat. That "lays the groove back". With the knob turned fully down the DX sounds exactly as it did from the factory.',
      'The work is done by a small add-on circuit board, the DX TimeShift (floating above the DX here). It plugs into one chip socket inside the DX. No original circuit board is cut. The only permanent change is one hole in the rear panel.',
      'Press play to watch the whole walkthrough, or step through it with the arrow keys. Drag at any time to look around yourself.',
    ],
    cam: [
      { at: 0, target: 'ts.center', offset: [70, 75, 135] },
      { at: 0.45, target: [-30, 80, 20], offset: [330, 300, 560] },
      { at: 1, target: [-30, 80, 20], offset: [-230, 330, 620] },
    ],
    state: { ...STOCK, boardHidden: 0, chip: 0, lid: 0 },
    highlight: ['ts.board'],
    labels: [
      { anchor: 'ts.center', text: 'DX TimeShift rev A', sub: 'small add-on board, through-hole parts', dir: 'ne', len: 60 },
      { anchor: 'dx.center', text: 'Oberheim DX (1983)', sub: 'about 56 × 36 cm, main board 1721A', dir: 'sw', len: 70, at: [0.4, 1] },
    ],
  },
  // ------------------------------------------------------------------ 2
  {
    id: 'beat',
    chapter: 'Intro',
    title: 'Why "one beat" needs a tempo clock',
    duration: 22,
    body: [
      'A beat is a musical length, not a fixed time. At 120 BPM one beat lasts 500 ms. At 90 BPM it lasts 667 ms.',
      'A simple analog delay (a timer chip and a capacitor) can only wait a fixed number of milliseconds. It would be "half a beat" at one tempo and wrong at every other tempo. Look at the red row in the diagram.',
      'So TimeShift listens to the DX\'s own tempo. The DX sends 96 short pulses, called ticks, for every beat (96 PPQN: pulses per quarter note). The same signal comes out of the CLOCK OUT socket on the back. By timing the gap between ticks the board always knows how long one beat is right now.',
      'Delay = knob position × 96 ticks. Knob at half way = 48 ticks = half a beat, at any tempo. One tick at 120 BPM is 5.2 ms, much finer than anyone can hear.',
    ],
    tbc: [
      'DXa, Stretch DX and MIDI-upgraded DX units can set CLOCK OUT to 24, 48 or 96 ticks per beat (edit parameter 03). The PPQN jumper JP1 on the board must match: no shunt = 96, shunt on JP1 1-2 (D10) = 48, shunt on JP1 3-4 (D11) = 24. A plain DX is fixed at 96.',
    ],
    cam: [
      { at: 0, target: [-130, 58, -180], offset: [-150, 110, -560] },
      { at: 1, target: [-115, 55, -180], offset: [-60, 90, -540] },
    ],
    state: { ...STOCK, lid: 0 },
    highlight: ['dx.jack.clockOut'],
    labels: [
      { anchor: 'dx.jack.clockOut', text: 'CLOCK OUT', sub: '96 ticks per beat (VERIFIED)', dir: 'nw', len: 70 },
      { anchor: 'dx.pot.snare', text: 'SNARE tuning pot', sub: 'second from the right, seen from behind', dir: 'n', len: 45, at: [0.35, 1] },
    ],
    inset: 'beats',
  },
  // ------------------------------------------------------------------ 3
  {
    id: 'inside',
    chapter: 'How the DX works',
    title: 'Meet the DX inside',
    duration: 22,
    warn: ['Switch the DX off and pull out the mains lead before opening it. The power supply inside runs from the mains.'],
    body: [
      'The DX has one big main board, the "DX Processor Board" (drawing 1721A). All six drum voices are built on it: there are no plug-in voice cards.',
      'A Z80 computer chip runs the sequencer. To play a drum it writes a number to a small "latch" chip, which holds the voice\'s control wires in the right state.',
      'The latch for the bass and the snare is U701, a 16-pin MC14174B, near the middle of the board just below the two big 470 µF capacitors. U701 is the only chip TimeShift touches.',
      'In photos of two DX units U701 sits in a socket, so it can be unplugged without soldering. Check this on your own unit before you buy parts.',
    ],
    tbc: ['Is U701 in a socket on your unit? (Q1). If it is soldered in, it must be desoldered and a socket fitted: a permanent (but restorable) change. Tell the owner first.'],
    cam: [
      { at: 0, target: [0, 40, 0], offset: [260, 620, 720] },
      { at: 0.45, target: 'dx.u701', offset: [150, 330, 330] },
      { at: 1, target: 'dx.u701', offset: [-40, 190, 210] },
    ],
    state: (p) => ({ ...STOCK, lid: ramp(p, 0.04, 0.32) }),
    highlight: ['dx.u701'],
    labels: [
      { anchor: 'dx.u701', text: 'U701 · MC14174B', sub: 'bass + snare latch', dir: 'ne', len: 70, at: [0.3, 1] },
      { anchor: 'dx.u701', text: 'Socketed?', sub: 'TO BE CONFIRMED (Q1)', dir: 'sw', len: 60, tbc: true, at: [0.55, 1] },
      { anchor: 'dx.z80', text: 'Z80 CPU (U712)', dir: 'e', len: 50, at: [0.35, 1] },
      { anchor: 'dx.snareVoice', text: 'SNARE voice', sub: 'U201–U209', dir: 'nw', len: 50, at: [0.3, 1] },
      { anchor: 'dx.c701', text: 'C701 / C702 470 µF', dir: 'n', len: 50, at: [0.45, 1] },
    ],
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'trigger',
    chapter: 'How the DX works',
    title: 'How the Z80 triggers the snare',
    duration: 26,
    body: [
      'The Z80 writes a byte to I/O port 10h. U701 copies six of its bits onto six wires and holds them there until the next write. Three wires are for the bass. Three are for the snare: RST2 (pin 15), FFA2 (pin 12) and FFB2 (pin 10).',
      'One snare hit is three writes. Write 1 sets the loudness bits FFA2 and FFB2 (soft, medium or loud). Write 2 raises RST2: this holds the snare\'s sample counter (U207, a 4040) at the start. Write 3 drops RST2 again.',
      'The sound starts when RST2 falls. RST2 is high for only about 9 µs (firmware 1.5) to 0.2 ms (firmware 1.20).',
      'The loudness bits stay held for the whole sound, and the RST2 rising edge also clocks the level flip-flops (U204). So to delay a snare faithfully, TimeShift must delay all three wires together, not just the trigger.',
    ],
    tbc: ['Exact RST2 pulse width and the soft/medium/loud bit code: TO BE CONFIRMED with a logic analyser on U701 pins 9, 10, 12, 15 (Q2).'],
    cam: [
      { at: 0, target: [-62, 10, -45], offset: [60, 420, 260] },
      { at: 0.6, target: [-70, 10, -50], offset: [0, 410, 250] },
      { at: 1, target: [-78, 10, -55], offset: [-70, 400, 250] },
    ],
    state: { ...STOCK, lid: 1 },
    highlight: ['dx.u701', 'dx.snareVoice'],
    paths: ['dxTrigger', 'dxGen0'],
    labels: [
      { anchor: 'dx.u701', text: 'U701 pins 15 / 12 / 10', sub: 'RST2 / FFA2 / FFB2', dir: 'e', len: 60 },
      { anchor: 'dx.u207', text: 'U207 4040 sample counter', sub: 'held at 0 while RST2 is high', dir: 'nw', len: 55, at: [0.15, 1] },
      { anchor: 'dx.u204', text: 'U204 4013 level flip-flops', dir: 'ne', len: 55, at: [0.3, 1] },
      { anchor: 'dx.u206', text: 'U206 snare EPROM', dir: 'n', len: 40, at: [0.45, 1] },
      { anchor: 'dx.u701', text: 'RST2 pulse width', sub: 'TO BE CONFIRMED (Q2)', dir: 'se', len: 60, tbc: true, at: [0.55, 1] },
    ],
    inset: 'timing',
    snare: (lt) => timingSnare(lt),
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'overview',
    chapter: 'How TimeShift works',
    title: 'The TimeShift board',
    duration: 26,
    body: [
      'TimeShift is a small two-layer board, about the size of a credit card, with only through-hole parts, so it can be built with an ordinary soldering iron.',
      'U1 is a socket for the ORIGINAL U701 chip, which moves here from the DX. J1, the "DX PLUG", carries a 16-way ribbon that goes back into the now empty U701 socket on the DX board.',
      '13 of the 16 pins run straight through from U1 to J1. Only the three snare wires (pins 10, 12 and 15) are split in two. On the chip side they go to the Arduino Nano, which listens. On the DX side they are driven by U3, a 74HC157 switch chip.',
      'U4 (74HC14) cleans up the tempo clock. J2 is for the new knob, J3 for the clock lead, JP1 sets the ticks per beat (no shunt = 96, JP1 1-2 = 48, JP1 3-4 = 24). TP1 to TP5 are test points for a meter or an oscilloscope.',
    ],
    cam: [
      { at: 0, target: 'ts.center', offset: [70, 105, 125] },
      { at: 1, target: 'ts.center', offset: [-55, 100, 118] },
    ],
    state: { ...BENCH },
    paths: ['through'],
    labels: [
      { anchor: 'ts.U1', text: 'U1: original U701 chip', dir: 'w', len: 60, at: [0.05, 1] },
      { anchor: 'ts.J1', text: 'J1 DX PLUG', sub: 'ribbon to the U701 socket', dir: 's', len: 40, at: [0.12, 1] },
      { anchor: 'ts.U2', text: 'Arduino Nano', sub: 'on 2 × 15 female headers', dir: 'n', len: 40, at: [0.2, 1] },
      { anchor: 'ts.U3', text: 'U3 74HC157 mux', dir: 'ne', len: 55, at: [0.3, 1] },
      { anchor: 'ts.U4', text: 'U4 74HC14', sub: 'clock clean-up', dir: 'se', len: 50, at: [0.38, 1] },
      { anchor: 'ts.J3', text: 'J2 POT · J3 CLK · JP1 PPQN', sub: 'JP1: open = 96 · 1-2 = 48 · 3-4 = 24', dir: 'e', len: 45, at: [0.46, 1] },
      { anchor: 'ts.TP3', text: 'TP1–TP5 test points', dir: 's', len: 30, at: [0.64, 1] },
    ],
    inset: 'block',
  },
  // ------------------------------------------------------------------ 6
  {
    id: 'capture',
    chapter: 'How TimeShift works',
    title: 'Capture: listening to the original chip',
    duration: 24,
    body: [
      'The original U701 chip now sits in U1 and keeps doing its job: it holds RST2, FFA2 and FFB2 exactly as the Z80 wrote them.',
      'Pin 15 (RST2) goes through a 1 kΩ resistor (R1) to Nano pin D2. D2 is interrupt input INT0, set to react to a rising edge. The Nano remembers the edge in hardware, so even a 9 µs pulse cannot be missed.',
      'In the interrupt the Nano reads pin 12 (FFA2, via R2 to D4) and pin 10 (FFB2, via R3 to D5) in one instruction, and stores the loudness, the time and the tick count in a 32-place queue. The on-board LED flashes for each captured hit.',
      'R1–R3 protect both chips if something goes wrong. These three pins of U1 are NOT wired straight to the plug. (The Nano is lifted and the other parts are dimmed here so the wiring is easier to see.)',
    ],
    cam: [
      { at: 0, target: 'ts.R2', offset: [-20, 75, 95] },
      { at: 1, target: 'ts.R2', offset: [25, 70, 88] },
    ],
    state: { ...BENCH },
    explode: { 'ts.U2': 24 },
    fade: DIM_TS,
    highlight: ['ts.U1', 'ts.chip', 'ts.R1', 'ts.R2', 'ts.R3'],
    paths: ['capture'],
    labels: [
      { anchor: 'ts.U1.15', text: 'U1 pin 15 · RST2', dir: 'sw', len: 50 },
      { anchor: 'ts.R2', text: 'R1–R3 1 kΩ', sub: 'protection', dir: 's', len: 70, at: [0.12, 1] },
      { anchor: 'ts.U2.D2', text: 'D2 = INT0', sub: 'rising edge = snare hit', dir: 'n', len: 70, at: [0.25, 1] },
      { anchor: 'ts.U2.D5', text: 'D4 ← FFA2 · D5 ← FFB2', dir: 'nw', len: 80, at: [0.4, 1] },
    ],
    inset: 'capture',
    led: (lt) => captureLed(lt),
  },
  // ------------------------------------------------------------------ 7
  {
    id: 'mux',
    chapter: 'How TimeShift works',
    title: 'The bypass switch: 74HC157',
    duration: 26,
    body: [
      'U3 is a 74HC157: four electronic two-way switches that flip together. Its select pin S (pin 1) chooses input A or input B for every output Y.',
      'The A inputs come straight from the original chip (bypass). The B inputs come from the Nano outputs D6, D7 and D8 (the delayed copy). The Y outputs go to J1 pins 15, 12 and 10, and through the ribbon to the snare circuit.',
      'A 10 kΩ resistor ({R4}) pulls S low, which selects A. So with the knob at zero, with no Nano, a blank Nano, or a Nano that is still starting up, the DX is completely stock. The switch adds only about 10 ns.',
      'The Nano raises S (pin D9) only when the knob is above 1 %. It changes S only while RST2 is low on both sides, so switching can never create a false hit. Watch the glowing paths swap between A (green) and B (orange).',
    ],
    cam: [
      { at: 0, target: 'ts.U3', offset: [35, 72, 82] },
      { at: 1, target: 'ts.U3', offset: [-10, 70, 86] },
    ],
    state: { ...BENCH },
    fade: DIM_TS,
    highlight: ['ts.U3', 'ts.R4'],
    paths: (_p, lt) => (muxSel(lt) ? ['delayed', 'out', 'sel'] : ['bypass', 'out', 'sel']),
    labels: [
      { anchor: 'ts.U3.1', text: 'S (pin 1) ← D9 MUX_SEL', dir: 'sw', len: 55 },
      { anchor: 'ts.R4', text: '{R4} 10 kΩ pull-down', sub: 'default = A = bypass', dir: 'nw', len: 60, at: [0.15, 1] },
      { anchor: 'ts.U3', text: 'U3 74HC157', sub: 'A = chip, B = Nano', dir: 'ne', len: 50, at: [0.05, 1] },
      { anchor: 'ts.J1', text: 'Y → J1 pins 15 / 12 / 10', dir: 's', len: 40, at: [0.3, 1] },
    ],
    inset: 'mux',
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'clock',
    chapter: 'How TimeShift works',
    title: 'Clock: where the ticks come from',
    duration: 28,
    body: [
      'The tempo ticks are taken inside the DX at resistor R791 (1 kΩ). Its lead on the Q709 side is the same wire as the CLOCK OUT socket: 0 V most of the time, with a short 5 V pulse on every tick. The rising edge is the tick.',
      'The rear jacks are soldered to the underside of the main board, so tapping R791 on top is easier. A small clip-on grabber does it without any soldering.',
      'On TimeShift the clock enters at J3, passes a 10 kΩ series resistor ({R5}) so the DX output is never loaded, then a 100 kΩ pull-down ({R6}) and 1 nF ({C5}) to ground, then two Schmitt-trigger inverters in U4. Two inversions cancel out, so the edge stays rising. The clean signal goes to Nano D3 (INT1).',
      'Alternative tap: R792 on the U710 side. That signal is upside down (a falling edge is the tick).',
    ],
    tbc: ['Does the DX keep sending ticks while the sequencer is stopped? And how wide is each pulse? TO BE CONFIRMED with a scope (Q5). If no tick has ever arrived, the firmware assumes 120 BPM.'],
    cam: [
      { at: 0, target: 'ts.U4', offset: [45, 70, 85] },
      { at: 0.5, target: 'ts.U4', offset: [20, 75, 90] },
      { at: 0.68, target: 'dx.r791', offset: [110, 170, 170] },
      { at: 1, target: 'dx.r791', offset: [70, 120, 120] },
    ],
    state: { ...BENCH, clockLead: 1 },
    fade: DIM_TS,
    highlight: (p) => (p < 0.55 ? ['ts.J3', 'ts.R5', 'ts.R6', 'ts.C5', 'ts.U4'] : ['dx.r791', 'dx.q709']),
    paths: ['clock', 'dxClock'],
    cablePulse: { clk: true },
    explode: { 'ts.U2': 18 },
    labels: [
      { anchor: 'ts.J3', text: 'J3 CLK in', dir: 'e', len: 45, at: [0, 0.55] },
      { anchor: 'ts.R5', text: '{R5} 10 kΩ · {R6} 100 kΩ · {C5} 1 nF', dir: 'n', len: 75, at: [0.06, 0.55] },
      { anchor: 'ts.U4', text: 'U4 74HC14', sub: 'two Schmitt inverters', dir: 'se', len: 50, at: [0.12, 0.55] },
      { anchor: 'ts.U2.D3', text: 'D3 = INT1', dir: 'nw', len: 60, at: [0.2, 0.55] },
      { anchor: 'dx.r791.q', text: 'Tap: R791 lead, Q709 side', sub: '= CLOCK OUT, rising edge = tick', dir: 'ne', len: 60, at: [0.66, 1] },
      { anchor: 'dx.r792', text: 'R792 (alternative, inverted)', dir: 'se', len: 50, at: [0.75, 1] },
      { anchor: 'dx.r791', text: 'Clock while stopped?', sub: 'TO BE CONFIRMED (Q5)', dir: 'w', len: 60, tbc: true, at: [0.8, 1] },
    ],
    inset: 'clock',
  },
  // ------------------------------------------------------------------ 9
  {
    id: 'pot',
    chapter: 'How TimeShift works',
    title: 'The SNARE DELAY knob',
    duration: 24,
    body: [
      'The new knob is a 10 kΩ linear potentiometer. Its two ends go to +5 V and ground, so its middle pin (the wiper) gives anything from 0 to 5 V.',
      'J2 is a 3-pin JST-XH connector: pin 1 = GND (counter-clockwise lug), pin 2 = wiper, pin 3 = +5 V (clockwise lug). Turning clockwise raises the voltage and the delay.',
      'The wiper passes a 1 kΩ resistor ({R7}) with 100 nF ({C6}) to ground, a small filter against noise, then reaches the Nano\'s analog input A0.',
      'The firmware reads it 100 times a second, averages 16 readings and ignores tiny wobbles. 1 % or less means bypass. Above that, delay = knob position × 1 beat.',
    ],
    cam: [
      { at: 0, target: 'ts.J2', offset: [55, 75, 90] },
      { at: 0.55, target: 'ts.R7', offset: [30, 72, 85] },
      { at: 0.72, target: 'dx.delayPot', offset: [-60, 50, -240] },
      { at: 1, target: 'dx.delayPot', offset: [-30, 40, -200] },
    ],
    state: { ...BENCH, pot: 1, hole: 1, potLead: 1 },
    explode: { 'ts.U2': 22 },
    fade: DIM_TS,
    highlight: ['ts.J2', 'ts.R7', 'ts.C6', 'dx.delayPot'],
    paths: ['pot'],
    cablePulse: { pot: true },
    labels: [
      { anchor: 'ts.J2', text: 'J2 POT', sub: '1 GND (CCW) · 2 wiper · 3 +5 V (CW)', dir: 'e', len: 50, at: [0, 0.65] },
      { anchor: 'ts.R7', text: '{R7} 1 kΩ + {C6} 100 nF', sub: 'noise filter', dir: 'n', len: 70, at: [0.12, 0.65] },
      { anchor: 'ts.U2.A0', text: 'A0 (analog in)', dir: 'se', len: 50, at: [0.25, 0.65] },
      { anchor: 'dx.delayPot', text: 'SNARE DELAY', sub: '10 kΩ linear', dir: 'ne', len: 50, at: [0.72, 1] },
    ],
    inset: 'pot',
  },
  // ------------------------------------------------------------------ 10
  {
    id: 'power',
    chapter: 'How TimeShift works',
    title: 'Power, decoupling and the USB warning',
    duration: 26,
    body: [
      'TimeShift takes its power from the U701 socket itself: +5 V from pin 16 and ground from pin 8, through the ribbon. No extra wires. It needs less than 60 mA.',
      'There is no +12 V or −12 V on this socket and TimeShift does not need them. Never connect it to the battery-backed "+5M" memory supply.',
      '{C1} (10 µF) is a small reservoir next to J1. Every chip has its own 100 nF capacitor right beside it ({C2} for U1, {C3} for U3, {C4} for U4, {C7} for the Nano) to soak up fast current spikes.',
      'The Nano\'s 5 V pin is joined to the DX logic supply. Never plug a USB cable into the Nano while it sits in the board and the DX is switched off: the USB port would try to power the whole DX. Flash the Nano out of the board, or only with the DX switched on.',
    ],
    warn: ['UNPLUG NANO BEFORE USB. Program the Nano out of the board, or only with the DX switched ON.'],
    tbc: ['If +5 V at U701 pin 16 is more than 50 mV below the "+5 TEST PAD" with the module running, add a separate 2-wire supply lead (Q7).'],
    cam: [
      { at: 0, target: 'ts.center', offset: [-50, 95, 105] },
      { at: 1, target: 'ts.center', offset: [40, 92, 100] },
    ],
    state: { ...BENCH },
    fade: DIM_TS,
    highlight: ['ts.C1', 'ts.C2', 'ts.C3', 'ts.C4', 'ts.C7', 'ts.U2'],
    paths: ['power', 'gnd'],
    labels: [
      { anchor: 'ts.J1.16', text: 'J1 pin 16 = +5 V', sub: 'pin 8 = GND', dir: 's', len: 45 },
      { anchor: 'ts.C1', text: '{C1} 10 µF', sub: 'mind the + lead', dir: 'e', len: 40, at: [0.12, 1] },
      { anchor: 'ts.C3', text: '100 nF beside each chip', dir: 'ne', len: 55, at: [0.24, 1] },
      { anchor: 'ts.U2', text: 'UNPLUG NANO BEFORE USB', sub: 'flash it out of the board or with the DX ON', dir: 'nw', len: 55, warn: true, at: [0.42, 1] },
    ],
    inset: 'power',
  },
  // ------------------------------------------------------------------ 11
  {
    id: 'replay',
    chapter: 'How TimeShift works',
    title: 'Replay: playing the snare later',
    duration: 28,
    body: [
      'In DELAY mode the Nano keeps checking the oldest hit in its queue. A hit is due when the time since it was captured reaches knob position × 96 ticks × the measured tick time. Change the tempo and the delay follows.',
      'Then it copies the DX\'s own sequence: set the loudness on D7 (FFA2) and D8 (FFB2), wait 2 µs, raise D6 (RST2) for 20 µs, then drop it. U3 passes these through its B inputs to J1, down the ribbon and into the U701 socket, to the snare circuit.',
      'The snare starts on the falling edge of RST2, exactly like a stock hit, only later. The loudness is kept because the level bits are copied too.',
      'Up to 32 hits can wait at once. Hits already waiting when you press STOP still play. Every replay also pulses TP1, so a scope on TP2 (original) and TP1 (replay) shows the delay directly.',
    ],
    cam: [
      { at: 0, target: 'ts.U3', offset: [25, 80, 100] },
      { at: 0.4, target: [-15, 120, 25], offset: [260, 170, 400] },
      { at: 1, target: [-90, 60, -30], offset: [140, 330, 420] },
    ],
    state: { ...BENCH, ribbon: 1, plug: 0 },
    highlight: ['ts.U3', 'ts.U2', 'ts.plug', 'dx.snareVoice'],
    paths: ['delayed', 'out', 'sel', 'dxTrigger'],
    ribbonGlow: [10, 12, 15],
    ribbonPulse: (lt) => 0.4 + queueEvents(lt).replay,
    labels: [
      { anchor: 'ts.U2.D7', text: 'D6 / D7 / D8 → U3 B inputs', dir: 'n', len: 55, at: [0, 0.45] },
      { anchor: 'ts.TP1', text: 'TP1 pulses on each replay', dir: 'se', len: 45, at: [0.1, 0.45] },
      { anchor: 'ts.plug', text: 'DIP plug in the U701 socket', dir: 'ne', len: 60, at: [0.4, 1] },
      { anchor: 'dx.snareVoice', text: 'Snare sounds as RST2 falls', sub: 'same loudness, later', dir: 'nw', len: 55, at: [0.6, 1] },
    ],
    inset: 'queue',
    led: (lt) => queueEvents(lt).capture,
    snare: (lt) => queueEvents(lt).replay,
  },
  // ------------------------------------------------------------------ 12
  {
    id: 'build',
    chapter: 'Build',
    title: 'Build order',
    duration: 34,
    body: [
      'Solder the lowest parts first so the board lies flat on the bench while you work: resistors, small capacitors, the U1 socket and the two logic chips, test points, the PPQN jumper header, the two JST connectors, the J1 box header, the 10 µF capacitor, the Nano headers, and last the Nano itself.',
      'Check orientation three times: the notch of U1, U3 and U4 matches the silkscreen, the key slot of J1 matches its outline, and the long (+) lead of {C1} goes into the + hole.',
      'Do not fit the original U701 chip yet. It moves over during installation.',
      'Make the ribbon: 10 to 15 cm of 16-way cable, a 2×8 IDC socket on one end and a DIP-16 IDC plug on the other, red wire to pin 1 at both ends. Then check it with a meter (next chapters).',
    ],
    cam: [
      { at: 0, target: 'ts.center', offset: [-40, 100, 112] },
      { at: 1, target: 'ts.center', offset: [55, 96, 108] },
    ],
    state: (p) => ({ ...BENCH, chip: 0, build: buildAt(p) }),
    buildMode: true,
    highlight: (p) => {
      const b = buildAt(p);
      const step = Math.min(BUILD_STEPS.length, Math.max(1, Math.ceil(b)));
      return b > 0 ? partsAtStep(step) : [];
    },
    dynLabels: (p) => {
      const b = buildAt(p);
      if (b <= 0) return [];
      const step = Math.min(BUILD_STEPS.length, Math.max(1, Math.ceil(b)));
      const ids = partsAtStep(step);
      const s = BUILD_STEPS[step - 1];
      return ids.length ? [{ anchor: ids[Math.floor(ids.length / 2)], text: `Step ${step}`, sub: s.text, dir: 'n', len: 55 }] : [];
    },
    inset: 'build',
  },
  // ------------------------------------------------------------------ 13
  {
    id: 'install-model',
    chapter: 'Install',
    title: 'Install 1: check the model and find U701',
    duration: 26,
    warn: ['Switch off and unplug the DX. Touch the metal chassis to discharge yourself before you touch any chip.'],
    body: [
      'Open the lid (two screws at the front) and photograph the main board before you change anything.',
      'Read the title printed on the main board: "OBERHEIM DX PROCESSOR BOARD", drawing 1721A. That is the plain DX, and TimeShift rev A fits it.',
      'If your unit has MIDI sockets on the back it is probably a DXa (board 1906). There the snare wires are on U715 pins 7, 5 and 2, not U701. This board does NOT fit a DXa without changes.',
      'Find U701: the first of three 16-pin chips in a row, just below the two big 470 µF capacitors C701/C702. Check that it sits in a socket, and measure how much room there is above it with the lid closed.',
    ],
    tbc: [
      'Q1: is U701 socketed on this unit?',
      'Q3: how much height is free above U701 and above the planned TimeShift spot with the lid closed (modelling-clay test)?',
    ],
    cam: [
      { at: 0, target: 'dx.modelCheck', offset: [60, 230, 210] },
      { at: 0.45, target: 'dx.u701', offset: [80, 170, 170] },
      { at: 0.72, target: 'dx.u701', offset: [-30, 150, 150] },
      { at: 0.82, target: [-60, 40, -180], offset: [-90, 70, -340] },
      { at: 1, target: [-60, 40, -180], offset: [-40, 60, -320] },
    ],
    state: { ...STOCK, lid: 1 },
    highlight: (p) => (p < 0.38 ? [] : p < 0.78 ? ['dx.u701'] : ['dx.jack.clockIn', 'dx.jack.clockOut']),
    labels: [
      { anchor: 'dx.modelCheck', text: 'OBERHEIM DX PROCESSOR BOARD', sub: '1721A = plain DX: fits', dir: 'n', len: 55, at: [0, 0.4] },
      { anchor: 'dx.u701', text: 'U701', sub: 'socketed? TO BE CONFIRMED (Q1)', dir: 'ne', len: 60, tbc: true, at: [0.38, 0.78] },
      { anchor: 'dx.c701', text: 'C701 / C702 470 µF', dir: 'nw', len: 50, at: [0.38, 0.78] },
      { anchor: 'dx.u703', text: 'Room above, lid closed', sub: 'TO BE CONFIRMED (Q3)', dir: 'se', len: 60, tbc: true, at: [0.5, 0.78] },
      { anchor: 'dx.jack.clockIn', text: 'No MIDI jacks = DX', sub: 'MIDI jacks = DXa: does NOT fit', dir: 'n', len: 55, at: [0.82, 1] },
    ],
    inset: 'model',
  },
  // ------------------------------------------------------------------ 14
  {
    id: 'install-socket',
    chapter: 'Install',
    title: 'Install 2: move U701 and plug in the ribbon',
    duration: 32,
    body: [
      'Lever U701 out of its socket a little at each end with a small flat screwdriver, keeping it level so no pins bend.',
      'Push it into U1 on the TimeShift board with its notch (pin 1) at the same end as the notch of U1.',
      'Mount TimeShift where it fits, with J1 facing U701. The suggested spot (TO BE CONFIRMED) is directly in front of U701–U704, on four self-adhesive snap-lock PCB supports (M3 standoffs are the alternative); the 3D view shows a simplified position. Then press the DIP plug of the ribbon into the empty U701 socket: red wire = pin 1, and plug pin 1 at the notch end of the socket.',
      'The ribbon connects header pin n to the DIP pin shown in the diagram. Before the first power-up, check every one of the 16 conductors with a continuity meter (U1 pin to the same plug pin; pins 10, 12 and 15 go through U3, so check those from U3 pins 4, 7 and 9).',
      'Before the first power-on (DX unplugged), check the plug orientation with an ohmmeter: TP4 to U702 pin 8 under 1 Ω, C1 + to U702 pin 16 under 1 Ω, and TP4 to U702 pin 16 must NOT read near 0 Ω. A reversed plug would feed the board backwards from the DX supply. Put a paint-pen dot on the plug at pin 1 so it always goes back the same way.',
    ],
    tbc: [
      'Ribbon pin mapping: TO BE CONFIRMED with a continuity meter before first power-up. This check is mandatory.',
      'Q4: the U701 clock (GEN0*, pin 9) now runs through the ribbon. Check it for clean edges with a scope, and keep the ribbon 15 cm or shorter.',
    ],
    cam: [
      { at: 0, target: 'dx.u701', offset: [90, 150, 160] },
      { at: 0.32, target: [-20, 20, 30], offset: [80, 200, 240] },
      { at: 0.55, target: [-5, 20, 25], offset: [90, 170, 190] },
      { at: 1, target: [-5, 20, 25], offset: [40, 150, 170] },
    ],
    state: (p) => ({ ...INSTALLED, potLead: 0, clockLead: 0, hole: 0, pot: 0, chip: ramp(p, 0.08, 0.4), ribbon: p > 0.44 ? 1 : 0, plug: 1 - ramp(p, 0.55, 0.8) }),
    highlight: (p) => (p < 0.42 ? ['dx.u701', 'ts.U1'] : ['ts.plug', 'dx.u701', 'ts.J1']),
    labels: [
      { anchor: 'dx.u701', text: '1. Lift U701 out', dir: 'ne', len: 55, at: [0, 0.2] },
      { anchor: 'ts.U1', text: '2. Into U1', sub: 'notch to notch', dir: 'nw', len: 55, at: [0.22, 0.5] },
      { anchor: 'ts.plug.pin1', text: '3. Plug into the U701 socket', sub: 'red wire = pin 1 at the notch end', dir: 'ne', len: 60, at: [0.5, 1] },
      { anchor: 'ts.J1', text: 'J1 DX PLUG', dir: 'nw', len: 45, at: [0.5, 1] },
      { anchor: 'ts.TP4', text: 'Before power-on: plug check', sub: 'TP4–U702 pin 8 < 1 Ω, TP4–U702 pin 16 not ≈ 0 Ω', dir: 's', len: 90, warn: true, at: [0.82, 1] },
    ],
    inset: 'ribbon',
  },
  // ------------------------------------------------------------------ 15
  {
    id: 'install-pot',
    chapter: 'Install',
    title: 'Install 3: drill the panel and wire the knob',
    duration: 32,
    body: [
      'Before drilling, look behind the rear panel: the six tuning pots sit on their own small board there. Make sure the spot you choose has at least 25 mm of free depth and 12 mm of free space all round.',
      'Suggested spot: directly below the SNARE tuning pot (second from the right, seen from behind), in the blank band above the jack labels. Cover the inside so no metal chips fall onto the boards.',
      'Fit the 10 kΩ linear pot with its nut on the outside and label it "SNARE DELAY  0 ◄──► 1 BEAT". The DX tuning pots have short bare shafts with no knobs: match that, or use a small knob.',
      'Wire the 3-wire lead to J2: counter-clockwise lug to pin 1 (GND), wiper to pin 2, clockwise lug to pin 3 (+5 V).',
    ],
    tbc: ['Q6: hole position, panel thickness, pot shaft size and the free space behind the panel are all TO BE CONFIRMED before drilling.'],
    cam: [
      { at: 0, target: 'dx.delayHole', offset: [-40, 50, -260] },
      { at: 0.45, target: 'dx.delayHole', offset: [-20, 30, -150] },
      { at: 0.6, target: 'dx.delayPot.inside', offset: [110, 170, 230] },
      { at: 1, target: [-100, 30, -40], offset: [90, 330, 330] },
    ],
    state: (p) => ({ ...INSTALLED, clockLead: 0, hole: ramp(p, 0.08, 0.24), pot: ramp(p, 0.28, 0.46), potLead: ramp(p, 0.6, 0.92) }),
    highlight: (p) => (p < 0.55 ? ['dx.delayPot'] : ['dx.delayPot', 'ts.J2']),
    cablePulse: { pot: (p) => p > 0.93 },
    paths: (p) => (p > 0.93 ? ['pot'] : []),
    labels: [
      { anchor: 'dx.delayHole', text: 'Candidate hole', sub: 'below SNARE pot: TO BE CONFIRMED (Q6)', dir: 'sw', len: 60, tbc: true, at: [0, 0.3] },
      { anchor: 'dx.pot.snare', text: 'SNARE tuning', dir: 'n', len: 40, at: [0, 0.55] },
      { anchor: 'dx.delayPot', text: 'SNARE DELAY 0 ◄──► 1 BEAT', sub: '10 kΩ linear', dir: 'se', len: 55, at: [0.36, 0.58] },
      { anchor: 'dx.tunePCB', text: 'Tuning-pot board', sub: 'behind the panel', dir: 'ne', len: 55, at: [0.6, 1] },
      { anchor: 'ts.J2', text: 'J2: 1 GND (CCW) · 2 wiper · 3 +5 V (CW)', dir: 'se', len: 50, at: [0.8, 1] },
    ],
    inset: 'drill',
  },
  // ------------------------------------------------------------------ 16
  {
    id: 'install-clock',
    chapter: 'Install',
    title: 'Install 4: clip on the clock lead',
    duration: 26,
    body: [
      'Find R791 (1 kΩ) and transistor Q709 near the front right of the main board, next to the backup battery B1.',
      'Clip the blue signal grabber of the J3 lead onto the R791 lead on the Q709 side. That point carries the CLOCK OUT signal. If you prefer, tack-solder the wire to that lead instead.',
      'The black ground wire (J3 pin 2) is OPTIONAL: TimeShift already gets ground through the ribbon. Fit it only if needed, to a DX ground point that reads 0 Ω to U701 pin 8 (or TP4); the Q709 emitter is one candidate. If you do not use it, insulate its end.',
      'Route the lead away from the power-supply corner and tie it down so it cannot be pulled off when the lid closes.',
    ],
    tbc: [
      'Which Q709 leg is the emitter (if you use it as the optional ground point): TO BE CONFIRMED with a meter.',
      'Q5: pulse width and whether ticks continue while stopped: TO BE CONFIRMED with a scope.',
    ],
    cam: [
      { at: 0, target: [60, 30, 80], offset: [160, 230, 260] },
      { at: 0.55, target: 'dx.r791', offset: [90, 130, 140] },
      { at: 1, target: 'dx.r791', offset: [45, 80, 85] },
    ],
    state: (p) => ({ ...INSTALLED, clockLead: ramp(p, 0.12, 0.62) }),
    highlight: ['dx.r791', 'dx.q709', 'ts.J3'],
    paths: (p) => (p > 0.66 ? ['dxClock', 'clock'] : []),
    cablePulse: { clk: (p) => p > 0.66 },
    labels: [
      { anchor: 'ts.J3', text: 'J3 CLK', sub: '1 = clock (blue) · 2 = GND (black, optional)', dir: 'nw', len: 50, at: [0, 0.4] },
      { anchor: 'dx.r791.q', text: 'R791 lead, Q709 side', sub: '= CLOCK OUT node', dir: 'ne', len: 60, at: [0.5, 1] },
      { anchor: 'dx.q709.e', text: 'Optional GND clip', sub: 'Q709 emitter? check 0 Ω to TP4 (TBC); else insulate', dir: 'se', len: 55, tbc: true, at: [0.62, 1] },
      { anchor: 'dx.b1', text: 'B1 backup battery', dir: 'e', len: 40, at: [0.4, 1] },
    ],
    inset: 'tap',
  },
  // ------------------------------------------------------------------ 17
  {
    id: 'test',
    chapter: 'Test',
    title: 'Test and calibrate',
    duration: 32,
    body: [
      'Before power: check the ribbon with a meter (all 16 conductors), check the notches of U1, U3 and U4, and check JP1: no shunt on 1-2 or 3-4 = 96 ticks per beat, the plain DX setting (a shunt parked on one pin only is fine).',
      'Power up with the knob at zero. The Nano LED should be on steady: BYPASS. The DX must sound and behave exactly as before for every drum, including the bass, which shares U701.',
      'Measure +5 V at U701 pin 16 (TimeShift side) and at the "+5 TEST PAD". The difference should be under 50 mV.',
      'Turn the knob to half way and play a pattern. The LED goes out and flashes once per snare, and the snare sounds half a beat late at any tempo. A scope on TP2 (original RST2) and TP1 (replay) shows the delay. TP4 is ground, TP5 the clean clock.',
      'For more detail: switch the DX on first, then plug in USB and open a serial monitor at 115200 baud. It prints one status line per second.',
    ],
    tbc: ['Q7: +5 V drop between the "+5 TEST PAD" and U701 pin 16 must be measured with the module running.'],
    cam: [
      { at: 0, target: 'ts.center', offset: [10, 120, 125] },
      { at: 0.5, target: 'ts.TP3', offset: [-10, 105, 115] },
      { at: 1, target: 'ts.TP3', offset: [-40, 105, 110] },
    ],
    state: { ...INSTALLED },
    highlight: ['ts.TP1', 'ts.TP2', 'ts.TP3', 'ts.TP4', 'ts.TP5'],
    labels: [
      { anchor: 'ts.TP3', text: 'TP1 replay · TP2 RST2 in · TP3 RST2 out', sub: 'TP4 GND · TP5 clean clock', dir: 'se', len: 70 },
      { anchor: 'ts.U2', text: 'LED: steady = BYPASS', sub: 'flash per snare = DELAY', dir: 'nw', len: 55, at: [0.1, 1] },
      { anchor: 'ts.JP1', text: 'JP1 open = 96 PPQN', sub: '1-2 = 48 · 3-4 = 24', dir: 'ne', len: 45, at: [0.2, 1] },
    ],
    inset: 'test',
    led: (lt) => testLed(lt),
    snare: (lt) => (lt < TEST_SPLIT ? 0 : testLed(lt - 0.25) * 0.8),
  },
  // ------------------------------------------------------------------ 18
  {
    id: 'done',
    chapter: 'Test',
    title: 'Done: how it behaves',
    duration: 24,
    body: [
      'Knob at zero: the 74HC157 passes the original chip straight through. The DX is stock, with about 10 ns of extra delay.',
      'Knob turned up: every snare plays later by that fraction of a beat, follows the tempo, and keeps its loudness.',
      'If the Nano is missing, blank, starting up or crashed, the pull-down resistor keeps the switch in bypass and the DX keeps working normally.',
      'To undo the modification: unclip the clock lead, unplug the ribbon, put U701 back into its own socket. Only the hole in the rear panel remains.',
    ],
    cam: [
      { at: 0, target: [-40, 40, 0], offset: [260, 360, 520] },
      { at: 0.55, target: [-120, 60, -150], offset: [-280, 220, -460] },
      { at: 1, target: 'dx.delayPot', offset: [-110, 70, -330] },
    ],
    state: (p) => ({ ...INSTALLED, lid: 1 - ramp(p, 0.08, 0.42) }),
    highlight: ['dx.delayPot'],
    labels: [
      { anchor: 'dx.delayPot', text: 'SNARE DELAY', sub: '0 = stock DX · 1 = one beat late', dir: 'ne', len: 60, at: [0.5, 1] },
    ],
    inset: 'bypass',
  },
];

/** Start time (s) of each stage on the global timeline. */
export function stageStarts(stages: Stage[]): number[] {
  const out: number[] = [];
  let t = 0;
  for (const s of stages) {
    out.push(t);
    t += s.duration;
  }
  return out;
}
