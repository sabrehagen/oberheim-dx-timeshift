import * as THREE from 'three';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeInOut = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

export const deg = (d: number): number => (d * Math.PI) / 180;

/** Text texture for chip markings, silkscreen and panel legends. */
export function textCanvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Axis-aligned box mesh whose origin is at the centre of its bottom face. */
export function boxOnFloor(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[]): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return new THREE.Mesh(g, mat);
}

export function cylOnFloor(r: number, h: number, mat: THREE.Material, seg = 20): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.translate(0, h / 2, 0);
  return new THREE.Mesh(g, mat);
}

export const MAT = {
  pcbGreen: new THREE.MeshStandardMaterial({ color: 0x1c6b3a, roughness: 0.55, metalness: 0.05 }),
  dxBoard: new THREE.MeshStandardMaterial({ color: 0x2f6b45, roughness: 0.7, metalness: 0.0 }),
  chip: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.1 }),
  socket: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.3, metalness: 0.85 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 0.9 }),
  nanoBlue: new THREE.MeshStandardMaterial({ color: 0x1d4f9c, roughness: 0.5 }),
  jstWhite: new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.6 }),
  resistor: new THREE.MeshStandardMaterial({ color: 0x5f9fd6, roughness: 0.5 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.5 }),
  elcap: new THREE.MeshStandardMaterial({ color: 0x25285c, roughness: 0.4, metalness: 0.2 }),
  tpRed: new THREE.MeshStandardMaterial({ color: 0xd8443a, roughness: 0.4 }),
  tpBlack: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }),
  hole: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }),
  chassis: new THREE.MeshStandardMaterial({ color: 0x232327, roughness: 0.65, metalness: 0.35 }),
  chassisInner: new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.8, metalness: 0.2 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.7 }),
  pad: new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.5 }),
  padRed: new THREE.MeshStandardMaterial({ color: 0xb8322b, roughness: 0.5 }),
  slider: new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }),
  potBody: new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.35, metalness: 0.8 }),
  wireRed: new THREE.MeshStandardMaterial({ color: 0xd23b30, roughness: 0.5 }),
  wireBlack: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 }),
  wireYellow: new THREE.MeshStandardMaterial({ color: 0xe0b52a, roughness: 0.5 }),
  wireBlue: new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.5 }),
  bigCap: new THREE.MeshStandardMaterial({ color: 0x2a3b8f, roughness: 0.4, metalness: 0.2 }),
};

export type Vec3 = [number, number, number];
export const v3 = (a: Vec3): THREE.Vector3 => new THREE.Vector3(a[0], a[1], a[2]);
