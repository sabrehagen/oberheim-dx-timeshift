/**
 * Loads the KiCad 3D export (public/models/board.glb, copied there at build time by
 * scripts/sync-model.mjs) and fits it into the board-local frame used by boardModel.ts.
 *
 * KiCad's `kicad-cli pcb export glb` writes metres, +y up, x = KiCad x and z = KiCad y,
 * in absolute KiCad coordinates. Board-local = (KiCad - origin) in millimetres, so we
 * scale by 1000 and subtract the board centre (anchors.json `origin`, or the centre of
 * the PCB mesh if anchors.json is missing).
 *
 * The raw export is heavy for a browser (thousands of primitives, one draw call each) and
 * the component models often arrive without colours. So after loading we
 *   1. merge every part (and every board layer) into one mesh per material, and
 *   2. give colourless primitives a colour from the part kind (pins -> metal, body -> kind).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AnchorsJson, PartKind } from './boardModel';

export interface LoadedGlb {
  root: THREE.Group;
  /** KiCad reference -> top-level nodes of that part (a part can have several, e.g. U2) */
  byRef: Map<string, THREE.Object3D[]>;
  /** board-local bounding boxes of every mesh, used to find what the GLB covers */
  meshBoxes: THREE.Box3[];
  /** model units per mm (1/1000 for a KiCad export in metres) */
  unitPerMm: number;
  drawCalls: number;
}

export interface PartLook {
  kind: PartKind;
  color?: number;
}

const REF_RE = /(?:^|[^A-Za-z0-9])([A-Z]{1,3}\d{1,3})(?=$|[^A-Za-z0-9])/;

const BODY: Partial<Record<PartKind, number>> = {
  dip: 0x17171a,
  socket: 0x111114,
  boxHeader: 0x18181b,
  jst: 0xece6d6,
  jumper: 0x151517,
  resistor: 0x5f9fd6,
  ceramic: 0xd9a441,
  electrolytic: 0x25285c,
  nanoHeaders: 0x111114,
  nano: 0x1d4f9c,
};
const metalGold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.9, roughness: 0.3 });
const metalTin = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 0.85, roughness: 0.3 });
const bodyCache = new Map<number, THREE.MeshStandardMaterial>();
const bodyMat = (c: number): THREE.MeshStandardMaterial => {
  let m = bodyCache.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05 });
    bodyCache.set(c, m);
  }
  return m;
};

/** True for glTF primitives that came without a material (GLTFLoader's unnamed default). */
const isDefaultMat = (m: THREE.Material): boolean => m.name === '' && m instanceof THREE.MeshStandardMaterial && m.metalness === 1 && m.roughness === 1;

/** Board layer materials from KiCad: make the solder mask read as a green PCB. */
function tuneLayerMaterial(mat: THREE.Material, meshName: string): THREE.Material {
  if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
  const n = meshName.toLowerCase();
  const c = mat.color;
  const mask = n.includes('soldermask') || (mat.transparent && c.g > c.r * 1.5 && c.g > c.b);
  const silk = n.includes('silkscreen') || (mat.transparent && c.r > 0.8 && c.g > 0.8 && c.b > 0.8);
  const body = n.includes('_pcb') || (!mat.transparent && Math.abs(c.r - 0.3) < 0.02 && Math.abs(c.g - 0.3) < 0.02 && mat.metalness === 0);
  const m = mat.clone();
  if (mask) {
    m.color.set(0x1d7a44);
    m.opacity = 0.9;
    m.transparent = true;
    m.depthWrite = false;
    m.roughness = 0.45;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -1;
  } else if (silk) {
    m.color.set(0xf4f4f0);
    m.transparent = false;
    m.opacity = 1;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
  } else if (body) {
    m.color.set(0x174f2e);
  }
  return m;
}

function mergeNode(node: THREE.Object3D, look: PartLook | null): number {
  // A glTF node with a single primitive arrives as the Mesh itself: keep it, just fix its material.
  if ((node as THREE.Mesh).isMesh && node.children.length === 0) {
    const mesh = node as THREE.Mesh;
    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (isDefaultMat(src)) mesh.material = bodyMat(look?.color ?? (look ? BODY[look.kind] : undefined) ?? 0x2a2c33);
    else if (!look) mesh.material = tuneLayerMaterial(src, mesh.name);
    if ((mesh.material as THREE.Material).transparent) mesh.renderOrder = 1;
    return 1;
  }
  node.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; geoms: THREE.BufferGeometry[] }>();
  const meshes: THREE.Mesh[] = [];
  node.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && o !== node) meshes.push(m);
  });
  for (const mesh of meshes) {
    const g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    const src = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    let mat: THREE.Material;
    let key: string;
    if (isDefaultMat(src)) {
      // Classify by shape: thin rods are pins / leads, everything else is the body.
      g.computeBoundingBox();
      const s = g.boundingBox!.getSize(new THREE.Vector3());
      const dims = [s.x, s.y, s.z].sort((a, b) => a - b);
      const unit = Math.max(s.x, s.y, s.z) < 1 ? 1000 : 1; // metres or mm
      const thin = dims[0] * unit < 1.05 && dims[1] * unit < 1.05;
      const kind = look?.kind;
      if (thin) {
        mat = kind === 'resistor' || kind === 'ceramic' || kind === 'electrolytic' ? metalTin : metalGold;
        key = mat.uuid;
      } else {
        mat = bodyMat(look?.color ?? (kind ? BODY[kind] : undefined) ?? 0x2a2c33);
        key = mat.uuid;
      }
    } else {
      mat = look ? src : tuneLayerMaterial(src, `${mesh.name} ${(mesh.geometry as THREE.BufferGeometry).name ?? ''} ${node.name}`);
      key = src.uuid;
    }
    let b = buckets.get(key);
    if (!b) {
      b = { mat, geoms: [] };
      buckets.set(key, b);
    }
    b.geoms.push(g.index ? g : g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i)));
  }
  for (const c of [...node.children]) node.remove(c);
  let calls = 0;
  for (const { mat, geoms } of buckets.values()) {
    const merged = mergeGeometries(geoms, false);
    for (const g of geoms) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    if ((mat as THREE.MeshStandardMaterial).transparent) mesh.renderOrder = 1;
    node.add(mesh);
    calls++;
  }
  return calls;
}

export async function loadBoardGlb(url: string, anchors: AnchorsJson | null, lookOf: (ref: string) => PartLook | null): Promise<LoadedGlb> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const raw = new THREE.Box3().setFromObject(model);
  const size = raw.getSize(new THREE.Vector3());
  // Metres (KiCad) or already millimetres?
  const scale = Math.max(size.x, size.z) < 2 ? 1000 : 1;

  // Part nodes are the ones named after a reference designator; the rest are board layers.
  const known = new Set(anchors?.footprints.map((f) => f.ref) ?? []);
  const byRef = new Map<string, THREE.Object3D[]>();
  const tops: THREE.Object3D[] = [];
  const collectTops = (o: THREE.Object3D) => {
    const m = REF_RE.exec(o.name ?? '');
    const isPart = m && (!known.size || known.has(m[1]));
    if (isPart && m) {
      const list = byRef.get(m[1]) ?? [];
      list.push(o);
      byRef.set(m[1], list);
      tops.push(o);
      return;
    }
    // Named nodes (board layers such as copper, mask, silkscreen) are merged as a whole;
    // only unnamed wrapper groups are descended into.
    if ((o as THREE.Mesh).isMesh || (o !== model && o.name)) {
      tops.push(o);
      return;
    }
    for (const c of o.children) collectTops(c);
  };
  collectTops(model);

  // Board centre: anchors.json origin (exact) or the bounding box of the PCB body.
  let cx: number;
  let cz: number;
  let bottomY = raw.min.y;
  if (anchors?.origin) {
    // origin is in millimetres; the model is in metres when scale = 1000.
    cx = anchors.origin.x / scale;
    cz = anchors.origin.y / scale;
  } else {
    let pcb: THREE.Box3 | null = null;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && /pcb|board/i.test(`${m.name} ${(m.geometry as THREE.BufferGeometry).name ?? ''}`)) {
        const b = new THREE.Box3().setFromObject(m);
        pcb = pcb ? pcb.union(b) : b;
      }
    });
    const ref: THREE.Box3 = pcb ?? raw;
    const c = ref.getCenter(new THREE.Vector3());
    cx = c.x;
    cz = c.z;
    bottomY = ref.min.y;
  }
  // The PCB body in KiCad exports starts at y = 0.
  if (scale === 1000) bottomY = 0;

  // Merge + colour (before re-parenting so world matrices are simple).
  let drawCalls = 0;
  for (const t of tops) {
    const m = REF_RE.exec(t.name ?? '');
    const look = m && byRef.has(m[1]) ? lookOf(m[1]) ?? { kind: 'dip' as PartKind } : null;
    drawCalls += mergeNode(t, look);
  }

  const root = new THREE.Group();
  root.name = 'ts.glb';
  model.position.set(-cx * scale, -bottomY * scale, -cz * scale);
  model.scale.setScalar(scale);
  root.add(model);
  root.updateMatrixWorld(true);

  const meshBoxes: THREE.Box3[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry.attributes.position) return;
    meshBoxes.push(new THREE.Box3().setFromObject(m));
  });
  return { root, byRef, meshBoxes, unitPerMm: 1 / scale, drawCalls };
}

/** True when the GLB has geometry taller than `minTop` (mm) over the given board-local rectangle. */
export function glbCovers(glb: LoadedGlb, x0: number, x1: number, z0: number, z1: number, minTop: number): boolean {
  for (const b of glb.meshBoxes) {
    if (b.max.x < x0 || b.min.x > x1 || b.max.z < z0 || b.min.z > z1) continue;
    if (b.max.y >= minTop) return true;
  }
  return false;
}
