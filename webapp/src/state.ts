/**
 * The continuous scene state the stage engine produces every frame. Every number
 * blends smoothly between stages; the world applies it to the 3D objects.
 */
import * as THREE from 'three';
import { lerp } from './util';

export interface SceneState {
  camPos: THREE.Vector3;
  camTarget: THREE.Vector3;
  /** 0 = TimeShift board floating above the DX ("bench"), 1 = installed on its standoffs */
  board: number;
  /** 0 = board visible, 1 = board lifted out of view and hidden */
  boardHidden: number;
  /** 0 = lid closed, 1 = lid open */
  lid: number;
  /** 0 = original U701 chip in the DX socket, 1 = chip in the TimeShift U1 socket */
  chip: number;
  /** 0 = DIP plug pushed into the U701 socket, 1 = plug hovering above it */
  plug: number;
  /** 0 = ribbon + plug hidden, 1 = shown */
  ribbon: number;
  /** pot lead growth 0..1 */
  potLead: number;
  /** clock lead growth 0..1 */
  clockLead: number;
  /** 0 = no hole in the rear panel, 1 = hole drilled */
  hole: number;
  /** 0 = SNARE DELAY pot not fitted, 1 = fitted */
  pot: number;
  /** Build progress (0 .. MAX_STEP) or a large number when the board is complete. */
  build: number;
}

export const SCALARS = ['board', 'boardHidden', 'lid', 'chip', 'plug', 'ribbon', 'potLead', 'clockLead', 'hole', 'pot', 'build'] as const;
export type ScalarKey = (typeof SCALARS)[number];

export function makeState(): SceneState {
  return {
    camPos: new THREE.Vector3(500, 500, 900),
    camTarget: new THREE.Vector3(0, 40, 0),
    board: 0,
    boardHidden: 1,
    lid: 0,
    chip: 0,
    plug: 0,
    ribbon: 0,
    potLead: 0,
    clockLead: 0,
    hole: 0,
    pot: 0,
    build: 99,
  };
}

export function copyState(dst: SceneState, src: SceneState): SceneState {
  dst.camPos.copy(src.camPos);
  dst.camTarget.copy(src.camTarget);
  for (const k of SCALARS) dst[k] = src[k];
  return dst;
}

/** dst = mix(a, b, t). Camera position is blended around the target so moves arc instead of cutting through objects. */
export function mixState(dst: SceneState, a: SceneState, b: SceneState, t: number): SceneState {
  const ta = a.camTarget;
  const tb = b.camTarget;
  const oa = a.camPos.clone().sub(ta);
  const ob = b.camPos.clone().sub(tb);
  const ra = oa.length();
  const rb = ob.length();
  const dir = oa.clone().normalize().lerp(ob.clone().normalize(), t);
  if (dir.lengthSq() < 1e-6) dir.copy(ob).normalize();
  dir.normalize();
  // Pull back a little in the middle of long moves so the viewer keeps context.
  const travel = ta.distanceTo(tb);
  const bulge = Math.sin(Math.PI * t) * Math.min(400, travel * 0.35);
  dst.camTarget.copy(ta).lerp(tb, t);
  dst.camPos.copy(dst.camTarget).addScaledVector(dir, lerp(ra, rb, t) + bulge);
  for (const k of SCALARS) {
    if (k === 'build' && (a.build > 50 || b.build > 50)) {
      dst.build = t < 0.5 ? a.build : b.build;
      continue;
    }
    dst[k] = lerp(a[k], b[k], t);
  }
  return dst;
}
