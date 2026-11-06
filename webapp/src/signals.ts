import * as THREE from 'three';
import { pulseMaterial } from './signalMaterial';

export interface PathGroup {
  id: string;
  group: THREE.Group;
  mats: THREE.ShaderMaterial[];
  current: number; // current opacity 0..1 (eased in the engine)
}

/** Builds glowing, animated tubes for a set of polylines (one group per signal). */
export function buildPathGroup(id: string, lines: THREE.Vector3[][], color: number, radius: number, depthTest: boolean, speed = 40): PathGroup {
  const group = new THREE.Group();
  group.name = `path.${id}`;
  const mats: THREE.ShaderMaterial[] = [];
  for (const pts of lines) {
    if (pts.length < 2) continue;
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
    const len = path.getLength();
    if (len < 0.01) continue;
    const segs = Math.max(8, Math.round(len / 1.5));
    const geo = new THREE.TubeGeometry(path, Math.min(segs, 400), radius, 6, false);
    const mat = pulseMaterial({ color, length: len, speed, spacing: Math.max(14, Math.min(40, len / 2)), depthTest });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 10;
    group.add(mesh);
    mats.push(mat);
  }
  group.visible = false;
  return { id, group, mats, current: 0 };
}

export function setPathOpacity(p: PathGroup, v: number): void {
  p.current = v;
  p.group.visible = v > 0.01;
  for (const m of p.mats) m.uniforms.uOpacity.value = v;
}
