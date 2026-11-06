/**
 * Builds the complete 3D world (DX chassis, TimeShift board, cables, signal paths)
 * and applies a SceneState to it every frame.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Registry } from './registry';
import { buildDX, DX, U701_POS, type BuiltDX } from './dxModel';
import {
  buildBoard, kicadLayout, proceduralLayout, netPolylines, fixLeg, NETS, PARTS, DIP_TO_HEADER,
  type AnchorsJson, type BoardLayout, type BuiltBoard,
} from './boardModel';
import { Ribbon, Wire, buildDipPlug, buildGrabber } from './cables';
import { buildPathGroup, setPathOpacity, type PathGroup } from './signals';
import { setRibbonMask, sharedTime } from './signalMaterial';
import { loadBoardGlb, glbCovers, type LoadedGlb } from './glbBoard';
import type { SceneState } from './state';
import { MAT, clamp01, easeInOut, easeOut, lerp } from './util';

/** Height of the installed board's underside: 18 mm standoffs on the main board. */
const STANDOFF = 18;
/** Gap between the installed board's J1 edge and U701 (room for the ribbon to bend). */
const RIBBON_ROOM = 40;
/** Bench: floating well above the open DX (an "exploded" view). */
export const BENCH_POS = new THREE.Vector3(-55, 230, 45);
const HIDDEN_LIFT = 420;

export interface ModelInfo {
  mode: 'glb' | 'procedural';
  anchors: 'kicad' | 'procedural';
  note: string;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly reg = new Registry();
  readonly dx: BuiltDX;
  board!: BuiltBoard;
  readonly boardPose = new THREE.Group();
  readonly ribbon = new Ribbon();
  readonly plug = buildDipPlug();
  readonly potWires: Wire[];
  readonly clkWires: Wire[];
  readonly clkGrabber = buildGrabber(0x3a7bd5);
  readonly gndGrabber = buildGrabber(0x1a1a1a);
  readonly travelChip: THREE.Group;
  readonly paths = new Map<string, PathGroup>();
  readonly standoffs = new THREE.Group();
  glb: LoadedGlb | null = null;
  /** Installed pose: left of U701, turned so the J1 edge faces the U701 socket (computed from the layout). */
  readonly installedPos = new THREE.Vector3(-42, DX.boardTop + STANDOFF, 45);
  installedRot = Math.PI / 2;
  /** Board-local direction from the board out through the J1 edge. */
  readonly j1Out = new THREE.Vector3(0, 0, 1);
  /** Board size relative to the nominal 65 × 40 mm (camera offsets near the board scale with it). */
  boardScale = 1;
  glbActive = false;
  glbHasNano = false;
  /** part id -> GLB nodes of that part */
  private glbParts = new Map<string, { node: THREE.Object3D; baseY: number }[]>();
  /** ids whose GLB model is highlighted directly (no halo box needed) */
  readonly glbAttached = new Set<string>();
  /** procedural chips kept on top of the GLB's empty sockets (KiCad shows only the socket) */
  private chipOnSocket = new Set<string>();
  info: ModelInfo = { mode: 'procedural', anchors: 'procedural', note: '' };
  /** false while the KiCad GLB is still loading in the background */
  modelSettled = true;
  private explode = new Map<string, number>();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene;
    s.background = new THREE.Color(0x0a0c11);
    s.fog = new THREE.Fog(0x0a0c11, 2200, 4200);
    const pmrem = new THREE.PMREMGenerator(renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.55;
    pmrem.dispose();

    s.add(new THREE.HemisphereLight(0xcfd8ff, 0x1a1a22, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(300, 700, 500);
    s.add(key);
    const rim = new THREE.DirectionalLight(0x9fb4ff, 0.7);
    rim.position.set(-500, 300, -600);
    s.add(rim);

    // Floor: a dark disc with a faint grid so the machine sits somewhere.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1600, 64), new THREE.MeshStandardMaterial({ color: 0x0e1016, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    s.add(floor);
    const grid = new THREE.GridHelper(2400, 48, 0x1c2230, 0x141821);
    grid.position.y = -0.3;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    s.add(grid);

    this.dx = buildDX(this.reg);
    s.add(this.dx.root);

    // Hex standoffs for the installed board (visible once it is installed).
    s.add(this.standoffs);

    s.add(this.boardPose);
    s.add(this.ribbon.mesh);
    this.plug.name = 'dx.plug';
    s.add(this.plug);
    this.reg.addObject('ts.plug', this.plug, new THREE.Vector3(0, 12.5, 0));
    this.reg.addAnchor('ts.plug.pin1', this.plug, new THREE.Vector3(-8.89, 12, 3.81));

    this.potWires = [
      new Wire(0.9, MAT.wireBlack, 0xc58bff),
      new Wire(0.9, MAT.wireYellow, 0xc58bff),
      new Wire(0.9, MAT.wireRed, 0xc58bff),
    ];
    this.clkWires = [new Wire(0.9, MAT.wireBlue, 0x7aa2ff), new Wire(0.9, MAT.wireBlack, 0x7aa2ff)];
    for (const w of [...this.potWires, ...this.clkWires]) {
      s.add(w.mesh, w.pulse);
      w.pulse.visible = false;
    }
    s.add(this.clkGrabber, this.gndGrabber);
    this.reg.addObject('ts.clkGrabber', this.clkGrabber, new THREE.Vector3(0, 26, 0));
    this.reg.addObject('ts.gndGrabber', this.gndGrabber, new THREE.Vector3(0, 26, 0));

    // The chip that physically travels from the DX socket to U1 during installation.
    this.travelChip = new THREE.Group();
    const tc = this.dx.u701Chip.clone(true);
    tc.position.set(0, 0, 0);
    this.travelChip.add(tc);
    this.travelChip.visible = false;
    s.add(this.travelChip);

    for (const p of this.dx.dxPaths) {
      const g = buildPathGroup(p.id, p.lines, p.color, 0.9, true, 60);
      this.dx.root.add(g.group);
      this.paths.set(p.id, g);
    }
  }

  /**
   * Builds the TimeShift board (procedural, on the KiCad layout when anchors.json exists).
   * If the build shipped the KiCad GLB, it is loaded in the background and swapped in when
   * ready; `onGlb` is called then.
   */
  async buildBoard(base: string, onGlb?: () => void): Promise<void> {
    let manifest: { glb?: boolean; anchors?: boolean } = {};
    try {
      const r = await fetch(`${base}models/manifest.json`, { cache: 'no-cache' });
      if (r.ok) manifest = await r.json();
    } catch {
      /* no manifest: procedural */
    }
    let anchors: AnchorsJson | null = null;
    if (manifest.anchors) {
      try {
        const r = await fetch(`${base}models/anchors.json`);
        if (r.ok) anchors = await r.json();
      } catch {
        anchors = null;
      }
    }
    const layout = anchors ? kicadLayout(anchors) : proceduralLayout();
    this.board = buildBoard(this.reg, layout);
    this.boardPose.add(this.board.root);
    this.info.anchors = layout.fromKicad ? 'kicad' : 'procedural';
    if (layout.unmatched.length) console.warn('[board] parts not found in KiCad PCB, using procedural positions:', layout.unmatched);

    // Halos (for highlighting parts that live inside the GLB).
    for (const spec of PARTS) {
      const holder = this.board.parts.get(spec.id);
      if (!holder || spec.kind === 'hole') continue;
      const saved = holder.matrix.clone();
      const pos = holder.position.clone();
      const rot = holder.rotation.clone();
      holder.position.set(0, 0, 0);
      holder.rotation.set(0, 0, 0);
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(holder);
      holder.position.copy(pos);
      holder.rotation.copy(rot);
      holder.matrix.copy(saved);
      if (box.isEmpty()) continue;
      const size = box.getSize(new THREE.Vector3()).addScalar(1.2);
      const halo = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshBasicMaterial({ color: 0x35d0ff, transparent: true, opacity: 0.25, depthWrite: false }),
      );
      halo.position.copy(box.getCenter(new THREE.Vector3()));
      halo.visible = false;
      halo.userData.noRegistryMat = true;
      halo.renderOrder = 6;
      holder.add(halo);
      this.reg.setHalo(spec.id, halo);
    }

    // With a KiCad layout, report any drawn connection whose two ends are on different nets.
    if (layout.fromKicad) {
      const bad: string[] = [];
      for (const net of NETS) {
        for (const leg of net.legs) {
          const [a, b] = fixLeg(this.board, leg[0], leg[1]);
          const na = this.board.net(a);
          const nb = this.board.net(b);
          if (na && nb && na !== nb) bad.push(`${net.id}: ${a} (${na}) -> ${b} (${nb})`);
        }
      }
      if (bad.length) console.warn(`[board] ${bad.length} drawn connections do not match the KiCad nets:\n${bad.join('\n')}`);
    }

    // Signal paths on the board (children of the board so they move with it).
    const y = layout.thickness + 0.35;
    for (const net of NETS) {
      const g = buildPathGroup(net.id, netPolylines(this.board, net, y), net.color, 0.5, true, net.speed ?? 30);
      this.board.root.add(g.group);
      this.paths.set(net.id, g);
    }

    // Which edge is J1 on? Turn the installed board so that edge faces U701 (+x).
    const j1 = layout.place.get('ts.J1');
    if (j1) {
      const fx = Math.abs(j1.x) / (layout.width / 2);
      const fz = Math.abs(j1.z) / (layout.height / 2);
      if (fz >= fx) this.j1Out.set(0, 0, Math.sign(j1.z) || 1);
      else this.j1Out.set(Math.sign(j1.x) || 1, 0, 0);
    }
    // R(θ) maps local (x, z) to world (x cosθ + z sinθ, -x sinθ + z cosθ); we want j1Out -> +x.
    this.installedRot = Math.atan2(this.j1Out.z, this.j1Out.x);
    const c0 = Math.cos(this.installedRot);
    const s0 = Math.sin(this.installedRot);
    const halfX = Math.abs((layout.width / 2) * c0) + Math.abs((layout.height / 2) * s0);
    this.installedPos.set(U701_POS.x - RIBBON_ROOM - halfX, DX.boardTop + STANDOFF, 45);
    this.boardScale = Math.min(1.5, Math.max(1, Math.pow((layout.width * layout.height) / (65 * 40), 0.4)));

    // Standoffs under the four mounting holes.
    for (const id of ['ts.H1', 'ts.H2', 'ts.H3', 'ts.H4']) {
      const p = this.board.pin(`${id}.1`) ?? new THREE.Vector3();
      const h = STANDOFF;
      const so = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, h, 6), MAT.metal);
      so.position.set(this.installedPos.x + p.x * c0 + p.z * s0, DX.boardTop + h / 2, this.installedPos.z - p.x * s0 + p.z * c0);
      this.standoffs.add(so);
    }

    if (manifest.glb) {
      this.info.note = 'loading the KiCad 3D model…';
      this.modelSettled = false;
      void this.loadGlb(base, anchors, layout).then(() => {
        this.modelSettled = true;
        onGlb?.();
      });
    } else {
      this.info.note = 'procedural model (hardware/exports/board.glb was not present at build time)';
    }
  }

  private async loadGlb(base: string, anchors: AnchorsJson | null, layout: BoardLayout): Promise<void> {
    try {
      const specByRef = new Map<string, (typeof PARTS)[number]>();
      for (const spec of PARTS) {
        const ref = layout.place.get(spec.id)?.kicadRef ?? spec.ref;
        if (spec.kind !== 'nanoHeaders' && !specByRef.has(ref)) specByRef.set(ref, spec);
      }
      const glb = await loadBoardGlb(`${base}models/board.glb`, anchors, (ref) => {
        const spec = specByRef.get(ref);
        return spec ? { kind: spec.kind, color: spec.color } : null;
      });
      this.glb = glb;
      glb.root.visible = false;
      this.board.root.add(glb.root);
      const nano = layout.place.get('ts.U2');
      this.glbHasNano = nano ? glbCovers(glb, nano.x - 15, nano.x + 15, nano.z - 6, nano.z + 6, 11) : false;
      // Map GLB part nodes to our part ids: highlight/fade them directly and let them explode.
      for (const [ref, nodes] of glb.byRef) {
        const spec = specByRef.get(ref);
        if (!spec) continue;
        if (spec.kind === 'nano') {
          // The Nano footprint carries the module and its two header strips: lift only the module.
          const module = nodes.filter((n) => n.children.length > 2);
          const headers = nodes.filter((n) => n.children.length <= 2);
          this.glbParts.set(spec.id, module.map((node) => ({ node, baseY: node.position.y })));
          this.glbParts.set('ts.NanoHdr', headers.map((node) => ({ node, baseY: node.position.y })));
        } else {
          this.glbParts.set(spec.id, nodes.map((node) => ({ node, baseY: node.position.y })));
        }
        for (const n of nodes) if (this.reg.attach(spec.id, n)) this.glbAttached.add(spec.id);
        // KiCad shows an empty socket for socketed logic chips: keep our chip body on top of it.
        const lib = layout.place.get(spec.id)?.kicadLib ?? '';
        if (spec.kind === 'dip' && /socket/i.test(lib)) this.chipOnSocket.add(spec.id);
      }
      this.glbActive = false;
      this.setGlbActive(!this.buildModeNow);
      this.info.mode = 'glb';
      this.info.note = `KiCad 3D export: ${glb.byRef.size} parts, ${glb.drawCalls} draw calls after merging`;
    } catch (err) {
      console.warn('[board] could not load board.glb, using the procedural model', err);
      this.info.note = 'board.glb failed to load: procedural model';
    }
  }

  /** True when a part's highlight must be drawn as a halo box (its real model has no own materials). */
  usesHalo(id: string): boolean {
    return this.glbActive && id.startsWith('ts.') && !this.glbAttached.has(id) && this.board.parts.has(id) && !this.chipOnSocket.has(id);
  }

  /** Reference designator of a board part as printed on the actual board (KiCad), e.g. ts.R4 -> "R5". */
  refOf(id: string): string | null {
    const pl = this.board?.layout.place.get(id);
    if (pl?.kicadRef) return pl.kicadRef;
    return PARTS.find((p) => p.id === id)?.ref ?? null;
  }

  /** Switch between the GLB and the procedural parts (the build animation needs procedural parts). */
  setGlbActive(on: boolean): void {
    if (!this.glb) return;
    if (on === this.glbActive) return;
    this.glbActive = on;
    this.glb.root.visible = on;
    this.board.substrate.visible = !on;
    for (const spec of PARTS) {
      const holder = this.board.parts.get(spec.id);
      if (!holder) continue;
      // KiCad's library has no 3D model for the Arduino Nano module, so keep ours unless the GLB has one.
      const keep = ((spec.kind === 'nano' || spec.kind === 'nanoHeaders') && !this.glbHasNano) || this.chipOnSocket.has(spec.id);
      for (const c of holder.children) if (!c.userData.noRegistryMat) c.visible = !on || keep;
    }
  }
  private buildModeNow = false;

  setExplode(map: Map<string, number>): void {
    this.explode = map;
  }

  /** Position of an anchor in world space. */
  anchor(id: string, out = new THREE.Vector3()): THREE.Vector3 | null {
    return this.reg.world(id, out);
  }

  apply(s: SceneState, timeSec: number, buildMode: boolean): void {
    sharedTime.value = timeSec;
    const dx = this.dx;

    // Lid
    dx.lidPivot.rotation.x = -easeInOut(s.lid) * THREE.MathUtils.degToRad(80);

    // Board pose
    this.buildModeNow = buildMode;
    if (this.glb) this.setGlbActive(!buildMode);
    const hidden = easeInOut(s.boardHidden);
    this.boardPose.position.copy(BENCH_POS).lerp(this.installedPos, s.board);
    this.boardPose.rotation.y = this.installedRot * easeInOut(s.board);
    this.boardPose.position.y += hidden * HIDDEN_LIFT;
    this.boardPose.visible = hidden < 0.98;
    this.standoffs.visible = s.board > 0.6 && hidden < 0.5;

    // Build progression + explode lifts
    for (const spec of PARTS) {
      const holder = this.board.parts.get(spec.id);
      if (!holder) continue;
      let lift = this.explode.get(spec.id) ?? 0;
      let vis = true;
      if (spec.step > 0 && s.build < 50) {
        const q = clamp01(s.build - (spec.step - 1));
        vis = q > 0.001;
        lift += (1 - easeOut(q)) * 28;
      }
      holder.visible = vis;
      // A chip shown on top of a KiCad socket model sits 2.6 mm higher.
      const onSocket = this.glbActive && this.chipOnSocket.has(spec.id) ? 2.6 : 0;
      holder.position.y = this.board.layout.thickness + lift + onSocket;
      const g = this.glbParts.get(spec.id);
      if (g && this.glb) for (const p of g) p.node.position.y = p.baseY + lift * this.glb.unitPerMm;
    }

    this.boardPose.updateMatrixWorld(true);

    // Chip: in the DX socket (0) → travelling → in U1 (1)
    const chipT = clamp01(s.chip);
    const inDx = chipT < 0.001;
    const inTs = chipT > 0.999 && hidden < 0.5;
    dx.u701Chip.visible = inDx;
    this.board.chip.visible = inTs && s.build > 50;
    this.travelChip.visible = !inDx && !inTs;
    if (this.travelChip.visible) {
      const from = dx.u701Chip.getWorldPosition(this.tmpA);
      const fromQ = dx.u701Chip.getWorldQuaternion(new THREE.Quaternion());
      const to = this.board.chip.getWorldPosition(this.tmpB);
      const toQ = this.board.chip.getWorldQuaternion(new THREE.Quaternion());
      const e = easeInOut(chipT);
      this.travelChip.position.copy(from).lerp(to, e);
      this.travelChip.position.y += Math.sin(Math.PI * e) * 60;
      this.travelChip.quaternion.copy(fromQ).slerp(toQ, e);
    }

    // Plug + ribbon
    const ribbonOn = s.ribbon > 0.5 && hidden < 0.5;
    this.plug.visible = ribbonOn;
    this.ribbon.mesh.visible = ribbonOn;
    const sock = dx.root.localToWorld(new THREE.Vector3(U701_POS.x, DX.boardTop + 3.2 - 2, U701_POS.z));
    this.plug.position.copy(sock);
    this.plug.position.y += easeInOut(s.plug) * 45;
    this.plug.rotation.y = Math.PI / 2;
    this.plug.updateMatrixWorld(true);
    if (ribbonOn) {
      const j1 = this.board.parts.get('ts.J1');
      if (j1) {
        const a = j1.localToWorld(new THREE.Vector3(0, 9.2, 0));
        const b = this.plug.localToWorld(new THREE.Vector3(0, 12.2, 0));
        // Leave J1 upwards, swing out over the J1 edge of the board (away from the
        // parts), then drop down to the plug so the ribbon never hides the board.
        const out = this.j1Out.clone().applyQuaternion(this.boardPose.quaternion);
        const drop = Math.max(0, a.y - b.y);
        const p2 = a.clone().addScaledVector(out, 20).add(new THREE.Vector3(0, 12, 0));
        const p3 = a.clone().addScaledVector(out, 34).setY(b.y + 22 + drop * 0.5);
        const p4 = p3.clone().lerp(b, 0.6).setY(b.y + 30);
        const pts = [a, a.clone().add(new THREE.Vector3(0, 9, 0)), p2, p3, p4, b.clone().add(new THREE.Vector3(0, 16, 0)), b];
        const w0 = new THREE.Vector3(1, 0, 0).applyQuaternion(j1.getWorldQuaternion(new THREE.Quaternion()));
        const w1 = new THREE.Vector3(1, 0, 0).applyQuaternion(this.plug.quaternion);
        this.ribbon.update(pts, w0, w1);
      }
    }

    // Rear-panel pot and hole
    const parts = dx.delayPotParts;
    const holeS = easeOut(s.hole);
    parts.hole.visible = holeS > 0.01;
    parts.hole.scale.setScalar(Math.max(0.01, holeS));
    const potS = easeInOut(s.pot);
    parts.outside.visible = potS > 0.01;
    parts.inside.visible = potS > 0.01;
    parts.legend.visible = potS > 0.5;
    (parts.legend.material as THREE.MeshBasicMaterial).opacity = clamp01((potS - 0.5) * 2);
    parts.outside.position.z = DX.rearZ - (1 - potS) * 70;
    parts.inside.position.z = DX.rearZ + 2.5 + (1 - potS) * 60;

    // Pot lead: J2 pins → pot lugs
    const lugs = ['dx.delayPot.ccw', 'dx.delayPot.wiper', 'dx.delayPot.cw'];
    for (let i = 0; i < 3; i++) {
      const w = this.potWires[i];
      const on = s.potLead > 0.002 && hidden < 0.5;
      w.mesh.visible = on;
      if (!on) {
        w.pulse.visible = false;
        continue;
      }
      const a = this.reg.world(lugs[i], new THREE.Vector3());
      const b = this.reg.world(`ts.J2.${i + 1}`, new THREE.Vector3());
      if (!a || !b) continue;
      b.y += 6.5;
      const off = (i - 1) * 1.9;
      const pts = [
        a,
        a.clone().add(new THREE.Vector3(0, -10, 6)),
        new THREE.Vector3(lerp(a.x, b.x, 0.3) + off, Math.max(40, lerp(a.y, b.y, 0.3)), lerp(a.z, b.z, 0.35)),
        new THREE.Vector3(lerp(a.x, b.x, 0.75) + off, Math.max(36, lerp(a.y, b.y, 0.75)), lerp(a.z, b.z, 0.8)),
        b.clone().add(new THREE.Vector3(0, 16, 0)),
        b,
      ];
      w.update(pts, clamp01(s.potLead));
    }

    // Clock lead: J3.1 → R791 (Q709-collector side), J3.2 → Q709 emitter (ground)
    const clkEnds = ['dx.r791.q', 'dx.q709.e'];
    const grabbers = [this.clkGrabber, this.gndGrabber];
    for (let i = 0; i < 2; i++) {
      const w = this.clkWires[i];
      const on = s.clockLead > 0.002 && hidden < 0.5;
      w.mesh.visible = on;
      const g = grabbers[i];
      const a = this.reg.world(`ts.J3.${i + 1}`, new THREE.Vector3());
      const end = this.reg.world(clkEnds[i], new THREE.Vector3());
      if (!on || !a || !end) {
        w.pulse.visible = false;
        g.visible = false;
        continue;
      }
      a.y += 6.5;
      const top = end.clone().setY(end.y + 24);
      const pts = [
        a,
        a.clone().setY(a.y + 18),
        new THREE.Vector3(lerp(a.x, top.x, 0.5), Math.max(40, lerp(a.y, top.y, 0.5)) + i * 3, lerp(a.z, top.z, 0.5)),
        top.clone().setY(top.y + 12),
        top,
      ];
      w.update(pts, clamp01(s.clockLead));
      g.visible = s.clockLead > 0.98;
      g.position.copy(end).setY(end.y - 1.5);
    }
  }

  /** Per-frame visual effects that do not blend (signal paths, glow, LED, ribbon mask). */
  setPaths(target: Set<string>, dt: number): void {
    const k = 1 - Math.exp(-dt * 6);
    for (const [id, p] of this.paths) {
      const want = target.has(id) ? 1 : 0;
      const v = p.current + (want - p.current) * k;
      setPathOpacity(p, Math.abs(v - want) < 0.003 ? want : v);
    }
  }

  setCablePulses(pot: boolean, clk: boolean): void {
    for (const w of this.potWires) w.pulse.visible = pot && w.mesh.visible;
    for (const w of this.clkWires) w.pulse.visible = clk && w.mesh.visible;
  }

  setRibbonGlow(dipPins: number[], pulse: number): void {
    setRibbonMask(this.ribbon.material, dipPins.map((d) => DIP_TO_HEADER[d]));
    this.ribbon.material.uniforms.uPulse.value = pulse;
  }

  setSnare(v: number): void {
    const ring = this.dx.snareRing;
    const glow = this.dx.snareGlow;
    const m = ring.material as THREE.MeshBasicMaterial;
    m.opacity = v * 0.9;
    ring.scale.setScalar(8 + (1 - v) * 40);
    (glow.material as THREE.MeshBasicMaterial).opacity = v * 0.35;
    ring.visible = v > 0.01;
    glow.visible = v > 0.01;
  }

  setLed(v: number): void {
    const m = this.board.nanoLed.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = 0.15 + v * 3.5;
  }
}
