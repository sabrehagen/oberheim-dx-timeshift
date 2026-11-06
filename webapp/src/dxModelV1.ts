/**
 * DX model v1 (the original stylised stand-in), kept selectable with `?dx=v1`.
 * The faithful rebuild is dxModelV2.ts; dxModel.ts picks one of the two.
 *
 * Stylised Oberheim DX (1983): wedge chassis about 560 × 360 mm, hinged lid with the
 * pads and sliders, rear panel with the six DRUM TUNING pots and the jacks, and the
 * single "DX Processor Board" (drawing 1721A) inside with the U701 socket.
 *
 * World units are millimetres. +z = front of the machine, -z = rear panel, +y = up.
 * Positions of parts on the main board follow docs/research/dx-findings.md §a
 * (layout drawing) in a simplified way; they are not to scale part-by-part.
 */
import * as THREE from 'three';
import { MAT, boxOnFloor, cylOnFloor, deg, textCanvas } from './util';
import type { Registry } from './registry';

export const DX = {
  W: 560,
  D: 360,
  rearH: 115,
  frontH: 45,
  boardY: 8, // main board underside
  boardT: 1.6,
  get boardTop(): number {
    return this.boardY + this.boardT;
  },
  rearZ: -180,
  /** how far the lid swings open (degrees) */
  lidOpenDeg: 80,
};

/** Rear-panel items, listed left → right as seen from BEHIND the machine (findings e1/e5). */
export const TUNING_POTS = ['PERC', 'CYMBAL', 'TOMS', 'HI-HAT', 'SNARE', 'BASS'];
export const JACKS = ['CLOCK IN', 'CLOCK OUT', 'TRIGGER IN', 'START', 'NEXT', 'MIX L/MONO', 'MIX R', 'CLICK', 'PERC', 'CYMBAL', 'TOMS', 'HI-HAT', 'SNARE', 'BASS'];
// Seen from behind, the viewer's right is world -x. BASS (rightmost) is the most negative x.
export const potX = (i: number): number => -245 + (TUNING_POTS.length - 1 - i) * 22;
export const jackX = (i: number): number => -245 + (JACKS.length - 1 - i) * 19;
export const POT_Y = 94;
export const DELAY_POT = { x: potX(TUNING_POTS.indexOf('SNARE')), y: 68 };
export const JACK_Y = 24;

export const U701_POS = { x: 28, z: 5 };
export const R791_POS = { x: 170, z: 112 };

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

const VOICES = ['BASS', 'SNARE', 'HIHAT', 'TOMS', 'PERC', 'CYMBAL'];
const voiceX = (i: number): number => -232 + i * 44;

function simpleDip(pins: number, marking?: string): THREE.Group {
  const g = new THREE.Group();
  const len = (pins / 2) * 2.54;
  const w = pins >= 24 ? 13.5 : 6.4;
  const body = boxOnFloor(len, 3.4, w, MAT.chip);
  body.position.y = 0.8;
  g.add(body);
  if (marking) {
    const tex = textCanvas(512, 128, (ctx) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#e6e6ea';
      ctx.font = `bold ${pins >= 24 ? 46 : 52}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marking, 256, 64);
    });
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(len * 0.92, Math.min(w * 0.8, len * 0.23)), new THREE.MeshStandardMaterial({ map: tex }));
    lbl.rotation.x = -Math.PI / 2;
    lbl.position.y = 4.25;
    g.add(lbl);
  }
  return g;
}

function dipPinLocal(n: number, pins = 16): [number, number] {
  const half = pins / 2;
  if (n <= half) return [-(half - 1) * 1.27 + (n - 1) * 2.54, 3.81];
  return [(half - 1) * 1.27 - (n - half - 1) * 2.54, -3.81];
}

function frontPanelTexture(): THREE.CanvasTexture {
  const ppm = 3;
  const W = 556 * ppm;
  const H = 367 * ppm;
  return textCanvas(W, H, (ctx) => {
    ctx.fillStyle = '#1b1b1e';
    ctx.fillRect(0, 0, W, H);
    // slider bank (left)
    ctx.fillStyle = '#0b0b0c';
    for (let i = 0; i < 8; i++) ctx.fillRect((22 + i * 17) * ppm, 60 * ppm, 4 * ppm, 120 * ppm);
    ctx.fillStyle = '#c9c9c9';
    ctx.font = `bold ${6 * ppm}px Arial`;
    ctx.fillText('VOLUME', 22 * ppm, 52 * ppm);
    // display
    ctx.fillStyle = '#300';
    ctx.fillRect(190 * ppm, 40 * ppm, 70 * ppm, 26 * ppm);
    ctx.fillStyle = '#ff3b2f';
    ctx.font = `bold ${18 * ppm}px "Courier New", monospace`;
    ctx.fillText('120', 200 * ppm, 60 * ppm);
    // pads
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = r === 0 && c === 1 ? '#d8d8d8' : '#bdbdbd';
        ctx.fillRect((300 + c * 40) * ppm, (120 + r * 46) * ppm, 32 * ppm, 34 * ppm);
      }
    }
    ctx.fillStyle = '#9a9a9a';
    for (let c = 0; c < 8; c++) ctx.fillRect((190 + c * 13) * ppm, (120) * ppm, 10 * ppm, 10 * ppm);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `bold ${16 * ppm}px "Arial Black", Arial`;
    ctx.fillText('OBERHEIM', 22 * ppm, 300 * ppm);
    ctx.font = `bold ${22 * ppm}px "Arial Black", Arial`;
    ctx.fillText('DX', 120 * ppm, 302 * ppm);
    ctx.font = `${6 * ppm}px Arial`;
    ctx.fillStyle = '#9a9a9a';
    const names = ['BASS', 'SNARE', 'HI HAT', 'TOMS', 'PERC', 'CYMBAL'];
    names.forEach((n, c) => ctx.fillText(n, (302 + c * 40) * ppm, 114 * ppm));
  });
}

function rearPanelTexture(): THREE.CanvasTexture {
  const ppm = 4;
  const W = DX.W * ppm;
  const H = DX.rearH * ppm;
  // canvas x grows towards world -x (the panel is seen from behind)
  const X = (wx: number) => (DX.W / 2 - wx) * ppm;
  const Y = (wy: number) => (DX.rearH - wy) * ppm;
  return textCanvas(W, H, (ctx) => {
    ctx.fillStyle = '#1e1e21';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8e8e8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${4.2 * ppm}px Arial`;
    ctx.fillText('DRUM TUNING', X((potX(0) + potX(5)) / 2), Y(POT_Y + 14));
    ctx.font = `bold ${3.1 * ppm}px Arial`;
    TUNING_POTS.forEach((n, i) => ctx.fillText(n, X(potX(i)), Y(POT_Y - 10)));
    ctx.font = `bold ${2.7 * ppm}px Arial`;
    JACKS.forEach((n, i) => ctx.fillText(n, X(jackX(i)), Y(JACK_Y + 13)));
    ctx.font = `bold ${3 * ppm}px Arial`;
    ctx.fillText('DIRECT OUTPUTS', X((jackX(8) + jackX(13)) / 2), Y(JACK_Y - 11));
    ctx.fillText('OBERHEIM DX', X(200), Y(95));
    ctx.font = `${2.6 * ppm}px Arial`;
    ctx.fillText('95-130 VAC OR 190-260 VAC, 50-60 HZ, 19 WATTS', X(200), Y(86));
    // pot / jack holes
    ctx.fillStyle = '#060606';
    TUNING_POTS.forEach((_, i) => {
      ctx.beginPath();
      ctx.arc(X(potX(i)), Y(POT_Y), 4.5 * ppm, 0, Math.PI * 2);
      ctx.fill();
    });
    JACKS.forEach((_, i) => {
      ctx.beginPath();
      ctx.arc(X(jackX(i)), Y(JACK_Y), 6 * ppm, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function boardTexture(): THREE.CanvasTexture {
  const ppm = 4;
  const W = 540 * ppm;
  const H = 330 * ppm;
  const X = (x: number) => (x + 270) * ppm;
  const Z = (z: number) => (z + 172) * ppm;
  return textCanvas(W, H, (ctx) => {
    ctx.fillStyle = '#2f6b45';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120, 190, 130, 0.35)';
    ctx.lineWidth = 0.6 * ppm;
    for (let i = 0; i < 140; i++) {
      const x0 = -260 + ((i * 37) % 520);
      const z0 = -165 + ((i * 53) % 310);
      ctx.beginPath();
      ctx.moveTo(X(x0), Z(z0));
      ctx.lineTo(X(x0 + ((i % 5) - 2) * 18), Z(z0));
      ctx.lineTo(X(x0 + ((i % 5) - 2) * 18), Z(z0 + ((i % 7) - 3) * 14));
      ctx.stroke();
    }
    ctx.fillStyle = '#f0f0ea';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${7 * ppm}px Arial`;
    VOICES.forEach((v, i) => ctx.fillText(v, X(voiceX(i)), Z(-28)));
    ctx.font = `bold ${8 * ppm}px Arial`;
    ctx.fillText('OBERHEIM DX PROCESSOR BOARD', X(40), Z(150));
    ctx.font = `${5 * ppm}px Arial`;
    ctx.fillText('1721A', X(40), Z(140));
    ctx.font = `bold ${3.4 * ppm}px Arial`;
    const refs: [string, number, number][] = [
      ['U701', U701_POS.x, U701_POS.z + 15], ['U702', U701_POS.x + 15, U701_POS.z + 15], ['U703', U701_POS.x + 30, U701_POS.z + 15],
      ['U704', 75, 25], ['U712 Z80', 108, 42], ['U713', 138, 32], ['U714', 158, 32], ['C701', 40, -38], ['C702', 58, -38],
      ['R791', R791_POS.x, R791_POS.z - 5], ['Q709', R791_POS.x + 15, R791_POS.z - 7], ['R792', R791_POS.x, R791_POS.z + 17], ['B1', 222, 128],
      ['D', -262, -80], ['+5 TEST PAD', 140, 140], ['U710', 130, 82],
    ];
    for (const [t, x, z] of refs) ctx.fillText(t, X(x), Z(z));
    // +5 test pad
    ctx.fillStyle = '#d8b25a';
    ctx.beginPath();
    ctx.arc(X(140), Z(132), 2.4 * ppm, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function buildDXV1(reg: Registry): BuiltDX {
  const root = new THREE.Group();
  root.name = 'dx.root';

  // ---------------- chassis ----------------
  const chassis = new THREE.Group();
  const bottom = boxOnFloor(DX.W, 3, DX.D, MAT.chassisInner);
  chassis.add(bottom);
  const sideShape = new THREE.Shape();
  sideShape.moveTo(DX.rearZ, 0);
  sideShape.lineTo(-DX.rearZ, 0);
  sideShape.lineTo(-DX.rearZ, DX.frontH);
  sideShape.lineTo(DX.rearZ, DX.rearH);
  sideShape.closePath();
  const sideGeo = new THREE.ExtrudeGeometry(sideShape, { depth: 8, bevelEnabled: false });
  for (const sx of [DX.W / 2, -DX.W / 2 + 8]) {
    const side = new THREE.Mesh(sideGeo, MAT.wood);
    side.rotation.y = -Math.PI / 2;
    side.position.x = sx;
    chassis.add(side);
  }
  const front = boxOnFloor(DX.W - 16, DX.frontH - 2, 3, MAT.chassis);
  front.position.z = -DX.rearZ - 1.5;
  chassis.add(front);
  root.add(chassis);
  reg.addObject('dx.chassis', chassis, new THREE.Vector3(0, DX.rearH, 0));

  // Rear panel (inside face plain, outside face with legends)
  const rear = new THREE.Group();
  const rearPlate = boxOnFloor(DX.W - 16, DX.rearH, 2.5, MAT.chassis);
  rearPlate.position.z = DX.rearZ + 1.25;
  rear.add(rearPlate);
  const rearFace = new THREE.Mesh(new THREE.PlaneGeometry(DX.W, DX.rearH), new THREE.MeshStandardMaterial({ map: rearPanelTexture(), roughness: 0.6, metalness: 0.3 }));
  rearFace.rotation.y = Math.PI;
  rearFace.position.set(0, DX.rearH / 2, DX.rearZ - 0.05);
  rear.add(rearFace);
  root.add(rear);
  reg.addObject('dx.rearPanel', rear, new THREE.Vector3(-150, 70, DX.rearZ - 2));

  // ---------------- lid (pads + sliders), hinged at the rear top edge ----------------
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, DX.rearH, DX.rearZ);
  const lidLen = Math.hypot(DX.D, DX.rearH - DX.frontH);
  const lidTilt = Math.atan2(DX.rearH - DX.frontH, DX.D);
  const lidBody = new THREE.Group();
  lidBody.rotation.x = lidTilt;
  const lidPlate = new THREE.Mesh(new THREE.BoxGeometry(DX.W - 15, 4, lidLen), [MAT.chassis, MAT.chassis, new THREE.MeshStandardMaterial({ map: frontPanelTexture(), roughness: 0.55, metalness: 0.2 }), MAT.chassisInner, MAT.chassis, MAT.chassis]);
  lidPlate.position.set(0, -2, lidLen / 2);
  lidBody.add(lidPlate);
  // a few slider caps and the underside switch board for depth
  for (let i = 0; i < 8; i++) {
    const cap = boxOnFloor(9, 7, 5, MAT.slider);
    cap.position.set(-DX.W / 2 + 9 + 22 * 1 + i * 17 + 2, 0, 60 + (i * 13) % 70);
    lidBody.add(cap);
  }
  const underBoard = boxOnFloor(DX.W - 60, 1.6, lidLen - 60, MAT.dxBoard);
  underBoard.position.set(0, -12, lidLen / 2);
  lidBody.add(underBoard);
  lidPivot.add(lidBody);
  root.add(lidPivot);
  reg.addObject('dx.lid', lidPivot, new THREE.Vector3(0, 0, 40));

  // ---------------- main board ----------------
  const board = new THREE.Group();
  const bw = 540;
  const bd = 330;
  const bTop = new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.7 });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(bw, DX.boardT, bd), [MAT.dxBoard, MAT.dxBoard, bTop, MAT.dxBoard, MAT.dxBoard, MAT.dxBoard]);
  pcb.position.set(0, DX.boardY + DX.boardT / 2, -172 + bd / 2);
  board.add(pcb);
  root.add(board);
  reg.addObject('dx.board', board, new THREE.Vector3(0, DX.boardTop, 0));
  const onBoard = (o: THREE.Object3D, x: number, z: number, rotY = 0, parent: THREE.Object3D = root): THREE.Object3D => {
    o.position.set(x, DX.boardTop, z);
    o.rotation.y = rotY;
    parent.add(o);
    return o;
  };

  // Voice columns
  VOICES.forEach((v, i) => {
    const col = new THREE.Group();
    const x = voiceX(i);
    const chips: [number, number, number, string?][] = [
      [28, x - 8, -140, v === 'SNARE' ? 'DX SNARE 64' : `DX ${v} 64`],
      [14, x + 12, -140],
      [16, x - 8, -105, v === 'SNARE' ? '4040' : undefined],
      [14, x + 12, -105, v === 'SNARE' ? '4013' : undefined],
      [16, x - 8, -75, v === 'SNARE' ? 'AM6070' : undefined],
      [14, x + 12, -75, v === 'SNARE' ? '4013' : undefined],
      [8, x - 8, -50, v === 'SNARE' ? '555' : undefined],
      [8, x + 12, -50, v === 'SNARE' ? 'TL082' : undefined],
    ];
    for (const [pins, cx, cz, mark] of chips) {
      const d = simpleDip(pins, mark);
      onBoard(d, cx, cz, Math.PI / 2, col);
    }
    root.add(col);
    if (v === 'SNARE') {
      reg.addObject('dx.snareVoice', col, new THREE.Vector3(x, DX.boardTop + 5, -95));
      reg.addAnchor('dx.u206', root, new THREE.Vector3(x - 8, DX.boardTop + 5, -140));
      reg.addAnchor('dx.u207', root, new THREE.Vector3(x - 8, DX.boardTop + 5, -105));
      reg.addAnchor('dx.u204', root, new THREE.Vector3(x + 12, DX.boardTop + 5, -75));
      reg.addAnchor('dx.u209', root, new THREE.Vector3(x - 8, DX.boardTop + 5, -50));
    } else {
      reg.addObject(`dx.voice.${v.toLowerCase()}`, col);
    }
  });

  // C701 / C702 470 µF
  for (const [cx, id] of [[40, 'dx.c701'], [58, 'dx.c702']] as [number, string][]) {
    const c = cylOnFloor(6.5, 22, MAT.bigCap, 24);
    onBoard(c, cx, -25);
    reg.addObject(id, c);
  }

  // U701 socket + original chip, U702, U703
  const u701 = new THREE.Group();
  const sock = new THREE.Group();
  const sL = 8 * 2.54 + 1.2;
  for (const z of [3.81, -3.81]) {
    const r = boxOnFloor(sL, 3.2, 2.5, MAT.socket);
    r.position.z = z;
    sock.add(r);
  }
  for (const x of [-sL / 2 + 0.9, sL / 2 - 0.9]) {
    const e = boxOnFloor(1.8, 3.2, 5.2, MAT.socket);
    e.position.x = x;
    sock.add(e);
  }
  const holeGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8);
  for (let n = 1; n <= 16; n++) {
    const [px, pz] = dipPinLocal(n);
    const h = new THREE.Mesh(holeGeo, MAT.gold);
    h.position.set(px, 3.25, pz);
    sock.add(h);
  }
  u701.add(sock);
  const u701Chip = new THREE.Group();
  const chipBody = simpleDip(16, 'MC14174BCP');
  chipBody.position.y = 2.4;
  u701Chip.add(chipBody);
  u701.add(u701Chip);
  onBoard(u701, U701_POS.x, U701_POS.z, Math.PI / 2);
  reg.addObject('dx.u701', u701, new THREE.Vector3(0, 7, 0));
  reg.addObject('dx.u701chip', u701Chip, new THREE.Vector3(0, 7, 0));
  for (let n = 1; n <= 16; n++) {
    const [px, pz] = dipPinLocal(n);
    reg.addAnchor(`dx.u701.${n}`, u701, new THREE.Vector3(px, 3.4, pz));
  }
  for (const [k, dx] of [[2, 15], [3, 30]] as [number, number][]) {
    const d = simpleDip(16, 'MC14174BCP');
    onBoard(d, U701_POS.x + dx, U701_POS.z, Math.PI / 2);
    reg.addObject(`dx.u70${k}`, d);
  }

  // CPU area
  const cpuParts: [string, number, number, number, string][] = [
    ['dx.u704', 20, 75, 5, '74LS244'],
    ['dx.z80', 40, 106, 12, 'Z80 CPU'],
    ['dx.u713', 28, 138, 12, 'DX A'],
    ['dx.u714', 28, 158, 12, 'DX B'],
    ['dx.ram1', 24, 185, 12, '6116'],
    ['dx.ram2', 24, 205, 12, '6116'],
    ['dx.ram3', 24, 225, 12, '6116'],
    ['dx.ram4', 24, 245, 12, '6116'],
    ['dx.u710', 16, 130, 68, '74C174'],
    ['dx.u711', 16, 155, 68, '40103'],
    ['dx.u709', 16, 75, 45, '74LS42'],
  ];
  for (const [id, pins, x, z, mark] of cpuParts) {
    const d = simpleDip(pins, mark);
    onBoard(d, x, z, Math.PI / 2);
    reg.addObject(id, d);
  }

  // PSU corner: big reservoir cap C723 + regulators
  const c723 = cylOnFloor(17, 45, MAT.bigCap, 32);
  onBoard(c723, 225, -120);
  reg.addObject('dx.c723', c723);
  for (let i = 0; i < 3; i++) {
    const hs = boxOnFloor(18, 24, 4, MAT.metal);
    onBoard(hs, 165 + i * 22, -150);
  }

  // Clock out node: Q709, R791, R792, battery B1
  const q709 = new THREE.Group();
  const qb = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.5, 16, 1, false, 0, Math.PI), MAT.chip);
  qb.position.y = 5;
  q709.add(qb);
  for (const x of [-1.27, 0, 1.27]) {
    const l = boxOnFloor(0.4, 3, 0.4, MAT.metal);
    l.position.x = x;
    q709.add(l);
  }
  onBoard(q709, R791_POS.x + 15, R791_POS.z);
  reg.addObject('dx.q709', q709);
  // Emitter leg (Q709 emitter goes to GND, findings d1). Which physical leg it is: TO BE CONFIRMED.
  reg.addAnchor('dx.q709.e', root, new THREE.Vector3(R791_POS.x + 15 - 1.27, DX.boardTop + 2.6, R791_POS.z));
  const mkRes = (color: number): THREE.Group => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 4, 4, 12), new THREE.MeshStandardMaterial({ color }));
    b.rotation.z = Math.PI / 2;
    b.position.y = 2;
    g.add(b);
    for (const x of [-3.81, 3.81]) {
      const l = boxOnFloor(0.5, 2, 0.5, MAT.metal);
      l.position.x = x;
      g.add(l);
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.5), MAT.metal);
      t.position.set(x * 0.85, 2, 0);
      g.add(t);
    }
    return g;
  };
  const r791 = mkRes(0xc8b38a);
  onBoard(r791, R791_POS.x, R791_POS.z);
  reg.addObject('dx.r791', r791);
  // The lead on the Q709-collector side = CLOCK OUT node (findings d4).
  reg.addAnchor('dx.r791.q', root, new THREE.Vector3(R791_POS.x + 3.81, DX.boardTop + 2, R791_POS.z));
  const r792 = mkRes(0xc8b38a);
  onBoard(r792, R791_POS.x, R791_POS.z + 12);
  reg.addObject('dx.r792', r792);
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 30, 20), new THREE.MeshStandardMaterial({ color: 0x9aa6b0, metalness: 0.7, roughness: 0.3 }));
  b1.rotation.z = Math.PI / 2;
  const b1g = new THREE.Group();
  b1.position.y = 7;
  b1g.add(b1);
  onBoard(b1g, 222, 112);
  reg.addObject('dx.b1', b1g);
  reg.addAnchor('dx.testpad', root, new THREE.Vector3(140, DX.boardTop, 132));

  // Header D (8-way, to the tuning-pot PCB)
  const hd = boxOnFloor(6, 8, 20, MAT.jstWhite);
  onBoard(hd, -262, -60);
  reg.addObject('dx.headerD', hd);

  // Board-mounted jacks through the rear panel
  JACKS.forEach((name, i) => {
    const j = new THREE.Group();
    const body = boxOnFloor(14, 13, 22, MAT.chip);
    body.position.z = 10;
    j.add(body);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 12, 20), MAT.metal);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, JACK_Y - DX.boardTop, -4);
    j.add(sleeve);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 2, 6), MAT.metal);
    nut.rotation.x = Math.PI / 2;
    nut.position.set(0, JACK_Y - DX.boardTop, -9);
    j.add(nut);
    const holeDisk = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20), MAT.hole);
    holeDisk.rotation.y = Math.PI;
    holeDisk.position.set(0, JACK_Y - DX.boardTop, -10.1);
    j.add(holeDisk);
    onBoard(j, jackX(i), DX.rearZ + 8);
    const id = i === 1 ? 'dx.jack.clockOut' : i === 0 ? 'dx.jack.clockIn' : `dx.jack.${name.toLowerCase().replace(/[^a-z]+/g, '')}${i >= 8 ? '.out' : ''}`;
    reg.addObject(id, j, new THREE.Vector3(0, JACK_Y - DX.boardTop, -10));
  });

  // Mains switch / cord on the far side
  const mains = boxOnFloor(30, 22, 10, MAT.chip);
  mains.position.set(230, 60, DX.rearZ - 5);
  root.add(mains);

  // Tuning-pot PCB behind the rear panel + six pots
  const tune = new THREE.Group();
  const tpcb = new THREE.Mesh(new THREE.BoxGeometry(140, 30, 1.6), MAT.dxBoard);
  tpcb.position.set((potX(0) + potX(5)) / 2, POT_Y, DX.rearZ + 14);
  tune.add(tpcb);
  root.add(tune);
  reg.addObject('dx.tunePCB', tune);
  TUNING_POTS.forEach((n, i) => {
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 9, 24), MAT.potBody);
    body.rotation.x = Math.PI / 2;
    body.position.z = 8;
    p.add(body);
    const bush = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 6, 16), MAT.metal);
    bush.rotation.x = Math.PI / 2;
    bush.position.z = -3;
    p.add(bush);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 9, 16), MAT.metal);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -9;
    p.add(shaft);
    p.position.set(potX(i), POT_Y, DX.rearZ);
    root.add(p);
    reg.addObject(`dx.pot.${n.toLowerCase().replace(/[^a-z]/g, '')}`, p, new THREE.Vector3(0, 0, -13));
  });
  // Harness header D -> tuning PCB (8 coloured wires bundled as one tube)
  const harnessCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-262, DX.boardTop + 8, -60),
    new THREE.Vector3(-262, 40, -110),
    new THREE.Vector3(-250, 70, -160),
    new THREE.Vector3(-235, POT_Y - 16, DX.rearZ + 15),
  ]);
  const harness = new THREE.Mesh(new THREE.TubeGeometry(harnessCurve, 40, 2.2, 8), MAT.wireYellow);
  root.add(harness);
  reg.addObject('dx.harness', harness);

  // ---------------- the new SNARE DELAY pot (appears during install step 3) ----------------
  const outside = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 12, 16), MAT.metal);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -10;
  outside.add(shaft);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 2.5, 6), MAT.metal);
  nut.rotation.x = Math.PI / 2;
  nut.position.z = -2;
  outside.add(nut);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 12, 24), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.5 }));
  knob.rotation.x = Math.PI / 2;
  knob.position.z = -12;
  outside.add(knob);
  const pointer = boxOnFloor(1, 1, 6, MAT.white);
  pointer.position.set(0, 4.5, -16);
  outside.add(pointer);
  outside.position.set(DELAY_POT.x, DELAY_POT.y, DX.rearZ);
  const inside = new THREE.Group();
  const potBody = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 9, 24), MAT.potBody);
  potBody.rotation.x = Math.PI / 2;
  potBody.position.z = 8;
  inside.add(potBody);
  // three solder lugs, pointing down. Seen from the shaft side (behind the DX), the
  // left lug (world +x) is the CCW end.
  const lugX = [5, 0, -5];
  for (const lx of lugX) {
    const lug = boxOnFloor(1.8, 7, 0.5, MAT.metal);
    lug.position.set(lx, -14, 10);
    inside.add(lug);
  }
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
    ctx.font = 'bold 40px Arial';
    ctx.fillText('SNARE DELAY', 256, 34);
    ctx.font = 'bold 34px Arial';
    ctx.fillText('0 ◄──► 1 BEAT', 256, 92);
  });
  const legend = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshBasicMaterial({ map: legendTex, transparent: true }));
  legend.rotation.y = Math.PI;
  legend.position.set(DELAY_POT.x, DELAY_POT.y - 13, DX.rearZ - 0.2);
  root.add(legend);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24), MAT.hole);
  hole.rotation.y = Math.PI;
  hole.position.set(DELAY_POT.x, DELAY_POT.y, DX.rearZ - 0.15);
  root.add(hole);
  reg.addAnchor('dx.delayHole', root, new THREE.Vector3(DELAY_POT.x, DELAY_POT.y, DX.rearZ - 0.5));

  // ---------------- snare "hit" visual ----------------
  const sx = voiceX(1);
  const snareRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  snareRing.rotation.x = -Math.PI / 2;
  snareRing.position.set(sx + 2, DX.boardTop + 7, -95);
  root.add(snareRing);
  const snareGlow = new THREE.Mesh(
    new THREE.BoxGeometry(40, 2, 110),
    new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  snareGlow.position.set(sx + 2, DX.boardTop + 1.2, -95);
  root.add(snareGlow);

  // ---------------- anchors ----------------
  reg.addAnchor('dx.rear', root, new THREE.Vector3(-120, 60, DX.rearZ));
  reg.addAnchor('dx.center', root, new THREE.Vector3(0, 40, 0));
  reg.addAnchor('dx.inside', root, new THREE.Vector3(0, DX.boardTop, -20));
  reg.addAnchor('dx.cpuArea', root, new THREE.Vector3(70, DX.boardTop, 10));
  reg.addAnchor('dx.modelCheck', root, new THREE.Vector3(40, DX.boardTop, 150));
  // Camera aim points used by stages.ts (each DX model places them on its own layout).
  const views: [string, number, number, number][] = [
    ['dx.view.rearJacks', -130, 58, -180], ['dx.view.rearJacks2', -115, 55, -180],
    ['dx.view.trigger1', -62, 10, -45], ['dx.view.trigger2', -70, 10, -50], ['dx.view.trigger3', -78, 10, -55],
    ['dx.view.replay', -90, 60, -30], ['dx.view.clockJacks', -60, 40, -180],
    ['dx.view.install1', -20, 20, 30], ['dx.view.install2', -5, 20, 25],
    ['dx.view.potLead', -100, 30, -40], ['dx.view.clockLead', 60, 30, 80], ['dx.view.rearOverview', -120, 60, -150],
  ];
  for (const [id, x, y, z] of views) reg.addAnchor(id, root, new THREE.Vector3(x, y, z));

  const u701Pin = (n: number): THREE.Vector3 => reg.world(`dx.u701.${n}`) ?? new THREE.Vector3();

  // DX-side trace from U701 pins 15/12/10 to the snare circuit (for the trigger stage)
  root.updateMatrixWorld(true);
  const y = DX.boardTop + 0.4;
  const tr = (n: number, dz: number, end: THREE.Vector3): THREE.Vector3[] => {
    const a = u701Pin(n).setY(y);
    return [a, new THREE.Vector3(a.x, y, -36 + dz), new THREE.Vector3(end.x + 22, y, -36 + dz), new THREE.Vector3(end.x + 22, y, end.z), end.clone().setY(y)];
  };
  const u207 = new THREE.Vector3(sx - 8, y, -105);
  const u204 = new THREE.Vector3(sx + 12, y, -75);
  const dxPaths = [
    { id: 'dxTrigger', color: 0xffa23a, lines: [tr(15, 0, u207), tr(12, 2.5, u204), tr(10, 5, u204)] },
    {
      id: 'dxClock', color: 0x7aa2ff,
      lines: [[new THREE.Vector3(R791_POS.x + 3.81, y, R791_POS.z), new THREE.Vector3(R791_POS.x + 8, y, R791_POS.z), new THREE.Vector3(R791_POS.x + 8, y, 60), new THREE.Vector3(jackX(1), y, 60), new THREE.Vector3(jackX(1), y, DX.rearZ + 10)]],
    },
    {
      id: 'dxGen0', color: 0x9aa3b5,
      lines: [[new THREE.Vector3(75, y, 45), new THREE.Vector3(60, y, 45), new THREE.Vector3(60, y, 25), u701Pin(9).setY(y)]],
    },
  ];

  return { root, lidPivot, u701Chip, delayPotParts: { outside, inside, legend, hole }, snareRing, snareGlow, dxPaths, u701Pin };
}

export { deg };
