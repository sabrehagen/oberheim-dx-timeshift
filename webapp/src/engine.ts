/**
 * The stage engine: a global timeline made of the stages in stages.ts. It evaluates
 * the current stage, blends from the previous stage over a short transition, and drives
 * the world, the camera, the labels and the inset. Free orbit pauses playback until
 * "Return to stage view".
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STAGES, stageStarts, type Stage, type CamKey, type LabelDef } from './stages';
import { copyState, makeState, mixState, SCALARS, type SceneState } from './state';
import type { World } from './world';
import { LabelLayer, type Rect } from './labels';
import { Inset } from './insets';
import { easeInOut, lerp, v3 } from './util';

const TRANSITION_MS = 1500;

export interface EngineEvents {
  onStage?: (index: number, stage: Stage) => void;
  onTick?: (t: number) => void;
  onPlayState?: (playing: boolean) => void;
  onFreeOrbit?: (free: boolean) => void;
}

function matchIds(patterns: string[], ids: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of patterns) {
    if (p.endsWith('*')) {
      const pre = p.slice(0, -1);
      for (const id of ids) if (id.startsWith(pre)) out.add(id);
    } else out.add(p);
  }
  return out;
}

export class Engine {
  readonly stages = STAGES;
  readonly starts = stageStarts(STAGES);
  readonly total: number;
  t = 0;
  index = -1;
  playing = false;
  speed = 2;
  free = false;
  private wasPlayingBeforeOrbit = false;
  private from = makeState();
  private target = makeState();
  readonly state = makeState();
  private transStart = -1e9;
  private lastNow = 0;
  private hi = new Map<string, number>();
  private fd = new Map<string, number>();
  private explode = new Map<string, number>();
  readonly labels: LabelLayer;
  private ids: string[];
  private viewShift = new THREE.Vector2();
  events: EngineEvents = {};

  constructor(
    private world: World,
    private camera: THREE.PerspectiveCamera,
    private controls: OrbitControls,
    private inset: Inset,
    private viewport: HTMLElement,
  ) {
    this.total = this.starts[this.starts.length - 1] + STAGES[STAGES.length - 1].duration;
    this.labels = new LabelLayer(world.scene, world.reg);
    this.ids = world.reg.ids();
    controls.addEventListener('start', () => this.enterFree());
  }

  // ---------------------------------------------------------------- control
  play(): void {
    if (this.free) this.returnToStage(false);
    if (this.t >= this.total - 0.01) this.seek(0);
    this.playing = true;
    this.events.onPlayState?.(true);
  }
  pause(): void {
    this.playing = false;
    this.events.onPlayState?.(false);
  }
  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }
  seek(t: number): void {
    this.t = Math.max(0, Math.min(this.total, t));
    this.update(performance.now(), true);
  }
  goto(i: number, progress = 0): void {
    const k = Math.max(0, Math.min(this.stages.length - 1, i));
    if (this.free) this.leaveFree();
    this.t = this.starts[k] + this.stages[k].duration * progress;
    this.update(performance.now(), true);
  }
  next(): void {
    this.goto(this.index + 1);
  }
  prev(): void {
    const lt = this.t - this.starts[this.index];
    this.goto(lt > 2.5 ? this.index : this.index - 1);
  }
  setSpeed(s: number): void {
    this.speed = s;
  }
  stageIndexAt(t: number): number {
    let i = 0;
    while (i + 1 < this.starts.length && t >= this.starts[i + 1]) i++;
    return i;
  }

  private enterFree(): void {
    if (this.free) return;
    this.free = true;
    this.wasPlayingBeforeOrbit = this.playing;
    if (this.playing) {
      this.playing = false;
      this.events.onPlayState?.(false);
    }
    this.controls.enableDamping = true;
    this.events.onFreeOrbit?.(true);
  }
  private leaveFree(): void {
    this.free = false;
    // Blend from wherever the user left the camera.
    copyState(this.from, this.state);
    this.from.camPos.copy(this.camera.position);
    this.from.camTarget.copy(this.controls.target);
    this.transStart = performance.now();
    this.controls.enableDamping = false;
    this.events.onFreeOrbit?.(false);
  }
  returnToStage(resume = true): void {
    if (!this.free) return;
    this.leaveFree();
    if (resume && this.wasPlayingBeforeOrbit) {
      this.playing = true;
      this.events.onPlayState?.(true);
    }
  }

  // ---------------------------------------------------------------- evaluation
  private resolve(target: string | [number, number, number], out: THREE.Vector3): THREE.Vector3 {
    if (typeof target === 'string') return this.world.anchor(target, out) ?? out.set(0, 40, 0);
    return out.set(target[0], target[1], target[2]);
  }

  private evalCamera(keys: CamKey[], p: number, pos: THREE.Vector3, tgt: THREE.Vector3): void {
    let a = keys[0];
    let b = keys[0];
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].at <= p) a = keys[i];
      if (keys[i].at >= p) {
        b = keys[i];
        break;
      }
      b = keys[i];
    }
    const u = a === b ? 0 : easeInOut((p - a.at) / (b.at - a.at));
    const ta = this.resolve(a.target, new THREE.Vector3());
    const tb = this.resolve(b.target, new THREE.Vector3());
    tgt.copy(ta).lerp(tb, u);
    const oa = v3(a.offset);
    const ob = v3(b.offset);
    // Offsets around the TimeShift board were tuned for a 65 × 40 mm board; scale them with the real one.
    if (typeof a.target === 'string' && a.target.startsWith('ts.')) oa.multiplyScalar(this.world.boardScale);
    if (typeof b.target === 'string' && b.target.startsWith('ts.')) ob.multiplyScalar(this.world.boardScale);
    // Interpolate the offset in spherical-ish terms (direction + length) so moves arc.
    const ra = oa.length();
    const rb = ob.length();
    const dir = oa.normalize().lerp(ob.normalize(), u).normalize();
    pos.copy(tgt).addScaledVector(dir, lerp(ra, rb, u) * this.aspectFactor());
  }

  /** Narrow (portrait) views need the camera further back to show the same width. */
  private aspectFactor(): number {
    const a = this.camera.aspect || 1.4;
    const insetIn = this.inset.kind !== null && this.inset.el.parentElement === this.viewport;
    return Math.min(2.4, Math.max(1, Math.pow(1.3 / a, 0.9))) * (insetIn ? 1.1 : 1);
  }

  private evalStage(stage: Stage, lt: number, p: number, out: SceneState): void {
    const base = typeof stage.state === 'function' ? stage.state(p, lt) : stage.state;
    const d = makeState();
    for (const k of SCALARS) out[k] = base[k] ?? d[k];
    this.evalCamera(stage.cam, p, out.camPos, out.camTarget);
  }

  private onStageChange(i: number, immediate: boolean): void {
    const prev = this.index;
    this.index = i;
    const stage = this.stages[i];
    if (prev < 0 || immediate) this.transStart = -1e9;
    else {
      copyState(this.from, this.state);
      this.transStart = performance.now();
    }
    if (this.free) {
      this.free = false;
      this.controls.enableDamping = false;
      this.events.onFreeOrbit?.(false);
      this.from.camPos.copy(this.camera.position);
      this.from.camTarget.copy(this.controls.target);
      this.transStart = performance.now();
    }
    this.inset.set(stage.inset ?? null);
    this.explode = new Map(Object.entries(stage.explode ?? {}));
    this.events.onStage?.(i, stage);
  }

  /** Advance and render one frame's worth of state. */
  update(now: number, seeking = false): void {
    // Read layout once, before this frame writes any styles (avoids forced re-layouts).
    const L = this.measure();
    const dt = Math.min(0.1, Math.max(0, (now - (this.lastNow || now)) / 1000));
    this.lastNow = now;
    if (this.playing && !seeking) {
      this.t += dt * this.speed;
      if (this.t >= this.total) {
        this.t = this.total;
        this.pause();
      }
    }
    const i = Math.min(this.stages.length - 1, this.stageIndexAt(Math.min(this.t, this.total - 1e-6)));
    if (i !== this.index) this.onStageChange(i, seeking && this.index < 0);
    const stage = this.stages[i];
    const lt = this.t - this.starts[i];
    const p = Math.max(0, Math.min(1, lt / stage.duration));

    // 1. scalar + camera target state
    this.evalStage(stage, lt, p, this.target);
    const blendT = (now - this.transStart) / TRANSITION_MS;
    if (blendT < 1) mixState(this.state, this.from, this.target, easeInOut(blendT));
    else copyState(this.state, this.target);

    // 2. world
    this.world.setExplode(this.smoothExplode(dt));
    this.world.apply(this.state, now / 1000, Boolean(stage.buildMode));

    // 3. camera
    if (!this.free) {
      this.camera.position.copy(this.state.camPos);
      this.controls.target.copy(this.state.camTarget);
      this.camera.lookAt(this.state.camTarget);
    } else {
      this.controls.update();
    }

    // 4. highlight / fade
    const hiList = typeof stage.highlight === 'function' ? stage.highlight(p, lt) : stage.highlight ?? [];
    const hiSet = matchIds(hiList, this.ids);
    const fadeSet = matchIds(stage.fade ?? [], this.ids);
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    const k = 1 - Math.exp(-dt * 7);
    for (const id of this.ids) {
      const wantHi = hiSet.has(id) ? 1 : 0;
      const wantFade = !wantHi && fadeSet.has(id) ? 1 : 0;
      let h = this.hi.get(id) ?? 0;
      let f = this.fd.get(id) ?? 0;
      h += (wantHi - h) * k;
      f += (wantFade - f) * k;
      if (Math.abs(h - wantHi) < 0.004) h = wantHi;
      if (Math.abs(f - wantFade) < 0.004) f = wantFade;
      this.hi.set(id, h);
      this.fd.set(id, f);
      this.world.reg.applyVisual(id, h, f, pulse, this.world.usesHalo(id));
    }

    // 5. signals, effects
    const paths = typeof stage.paths === 'function' ? stage.paths(p, lt) : stage.paths ?? [];
    this.world.setPaths(new Set(paths), dt);
    const cp = stage.cablePulse ?? {};
    const potP = typeof cp.pot === 'function' ? cp.pot(p) : Boolean(cp.pot);
    const clkP = typeof cp.clk === 'function' ? cp.clk(p) : Boolean(cp.clk);
    this.world.setCablePulses(potP, clkP);
    const rg = typeof stage.ribbonGlow === 'function' ? stage.ribbonGlow(lt) : stage.ribbonGlow ?? [];
    this.world.setRibbonGlow(rg, stage.ribbonPulse ? stage.ribbonPulse(lt) : 1);
    this.world.setSnare(stage.snare ? stage.snare(lt, p) : 0);
    this.world.setLed(stage.led ? stage.led(lt, p) : this.state.build > 50 ? 1 : 0);

    // 6. labels + inset + view offset
    const labels: LabelDef[] = [...(stage.labels ?? []), ...(stage.dynLabels ? stage.dynLabels(p, lt) : [])];
    this.labels.set(labels);
    this.updateViewOffset(dt, L);
    this.camera.updateMatrixWorld();
    const obstacles: Rect[] = L.insetInView && L.inset ? [L.inset] : [];
    this.labels.update(p, this.camera, L.w, L.h, seeking ? 1 : dt, obstacles);
    this.inset.draw(lt, p, L.inset?.w ?? 0, L.inset?.h ?? 0);
    this.events.onTick?.(this.t);
  }

  private explodeCur = new Map<string, number>();
  private smoothExplode(dt: number): Map<string, number> {
    const k = 1 - Math.exp(-dt * 5);
    const keys = new Set([...this.explode.keys(), ...this.explodeCur.keys()]);
    for (const id of keys) {
      const want = this.explode.get(id) ?? 0;
      let v = this.explodeCur.get(id) ?? 0;
      v += (want - v) * k;
      if (Math.abs(v - want) < 0.05) v = want;
      if (v === 0 && want === 0) this.explodeCur.delete(id);
      else this.explodeCur.set(id, v);
    }
    return this.explodeCur;
  }

  private measure(): { w: number; h: number; inset: Rect | null; insetInView: boolean } {
    const vr = this.viewport.getBoundingClientRect();
    const el = this.inset.el;
    let inset: Rect | null = null;
    if (this.inset.kind && !el.classList.contains('hidden')) {
      const r = el.getBoundingClientRect();
      inset = { x: r.left - vr.left, y: r.top - vr.top, w: r.width, h: r.height };
    }
    return { w: vr.width, h: vr.height, inset, insetInView: el.parentElement === this.viewport };
  }

  /** Shift the rendered image so the stage subject is centred in the area not covered by the inset. */
  private updateViewOffset(dt: number, L: { w: number; h: number; inset: Rect | null; insetInView: boolean }): void {
    const { w, h } = L;
    let sx = 0;
    let sy = 0;
    if (L.inset && L.insetInView) {
      const right = L.inset.x + L.inset.w;
      const bottom = L.inset.y + L.inset.h;
      if (L.inset.w > w * 0.6) sy = bottom / 2;
      else sx = right / 2;
    }
    const k = 1 - Math.exp(-dt * 4);
    this.viewShift.x += (sx * 0.85 - this.viewShift.x) * k;
    this.viewShift.y += (sy * 0.85 - this.viewShift.y) * k;
    if (Math.abs(this.viewShift.x) < 0.5 && Math.abs(this.viewShift.y) < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, -this.viewShift.x, -this.viewShift.y, w, h);
    this.camera.updateProjectionMatrix();
  }
}
