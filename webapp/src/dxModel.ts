/**
 * Selects which Oberheim DX model the app builds. Both expose the same API, anchor ids and
 * sub-objects, so stages, cables and labels work with either:
 *
 *   v2 (default): dxModelV2.ts, a faithful procedural model built from the reference photos.
 *   v1:           dxModelV1.ts, the original stylised model, kept selectable for comparison.
 *
 * The choice comes from the URL (`?dx=v1` or `?dx=v2`) and is fixed for the page's lifetime;
 * the header toggle reloads the page with the other value (see main.ts).
 */
import type * as THREE from 'three';
import type { Registry } from './registry';
import * as V1 from './dxModelV1';
import * as V2 from './dxModelV2';

export type DxVersion = 'v1' | 'v2';

export const DX_VERSIONS: Record<DxVersion, { label: string; name: string }> = {
  v1: { label: 'v1 (stylised)', name: 'the original stylised model' },
  v2: { label: 'v2 (faithful)', name: 'procedural model built from reference photos' },
};

function readVersion(): DxVersion {
  try {
    return new URLSearchParams(window.location.search).get('dx') === 'v1' ? 'v1' : 'v2';
  } catch {
    return 'v2';
  }
}

/** The DX model this page uses. */
export const DX_VERSION: DxVersion = readVersion();

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

/** Dimensions world.ts relies on (millimetres). */
export interface DxDims {
  readonly boardTop: number;
  readonly rearZ: number;
  readonly lidOpenDeg: number;
}

const v1 = DX_VERSION === 'v1';

export const DX: DxDims = v1 ? V1.DX : V2.DX;
export const U701_POS: { x: number; z: number } = v1 ? V1.U701_POS : V2.U701_POS;
export const R791_POS: { x: number; z: number } = v1 ? V1.R791_POS : V2.R791_POS;
export const DELAY_POT: { x: number; y: number } = v1 ? V1.DELAY_POT : V2.DELAY_POT;
export const TUNING_POTS: string[] = v1 ? V1.TUNING_POTS : V2.TUNING_POTS;
export const JACKS: string[] = v1 ? V1.JACKS : V2.JACKS;
export const POT_Y: number = v1 ? V1.POT_Y : V2.POT_Y;
export const JACK_Y: number = v1 ? V1.JACK_Y : V2.JACK_Y;
export const potX: (i: number) => number = v1 ? V1.potX : V2.potX;
export const jackX: (i: number) => number = v1 ? V1.jackX : V2.jackX;

export function buildDX(reg: Registry): BuiltDX {
  return v1 ? V1.buildDXV1(reg) : V2.buildDXV2(reg);
}
