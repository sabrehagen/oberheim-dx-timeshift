/**
 * Flexible geometry that connects the TimeShift board (which moves between the
 * "lifted" exploded view and its installed position) to the DX: the 16-way ribbon
 * with its DIP-16 IDC plug, the 3-wire pot lead and the clock tap lead.
 * Geometry is rebuilt only when an endpoint moves.
 */
import * as THREE from 'three';
import { MAT, boxOnFloor } from './util';
import { pulseMaterial, ribbonMaterial } from './signalMaterial';

class SubCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private base: THREE.Curve<THREE.Vector3>, private upto: number) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.base.getPoint(t * this.upto, target);
  }
}

function key(pts: THREE.Vector3[], extra: number): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`).join('|') + `|${extra.toFixed(3)}`;
}

/** A single insulated wire with an optional glowing pulse overlay. */
export class Wire {
  readonly mesh: THREE.Mesh;
  readonly pulse: THREE.Mesh;
  readonly pulseMat: THREE.ShaderMaterial;
  private lastKey = '';
  constructor(private radius: number, material: THREE.Material, pulseColor: number) {
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.pulseMat = pulseMaterial({ color: pulseColor, length: 100, speed: 60, spacing: 40 });
    this.pulse = new THREE.Mesh(new THREE.BufferGeometry(), this.pulseMat);
    this.pulse.renderOrder = 5;
  }
  update(points: THREE.Vector3[], grow: number): void {
    const k = key(points, grow);
    if (k === this.lastKey) return;
    this.lastKey = k;
    this.mesh.visible = grow > 0.002;
    if (!this.mesh.visible) return;
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const sub = new SubCurve(curve, Math.max(0.01, grow));
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.TubeGeometry(sub, 80, this.radius, 8, false);
    this.pulse.geometry.dispose();
    this.pulse.geometry = new THREE.TubeGeometry(sub, 80, this.radius * 1.35, 6, false);
    this.pulseMat.uniforms.uLength.value = curve.getLength() * grow;
  }
}

/** Flat 16-way ribbon: conductor 1 is red. uv.x runs along the cable, uv.y across it. */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private lastKey = '';
  readonly width = 16 * 1.27;
  constructor() {
    this.material = ribbonMaterial();
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false;
  }
  /**
   * @param pts centre-line control points (J1 end first)
   * @param w0 direction conductor 1 → 16 at the J1 end
   * @param w1 direction conductor 1 → 16 at the plug end
   */
  update(pts: THREE.Vector3[], w0: THREE.Vector3, w1: THREE.Vector3): void {
    const k = key([...pts, w0, w1], 0);
    if (k === this.lastKey) return;
    this.lastKey = k;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const N = 90;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const tangent = new THREE.Vector3();
    const w = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = curve.getPointAt(t);
      curve.getTangentAt(t, tangent);
      const s = t * t * (3 - 2 * t);
      w.copy(w0).multiplyScalar(1 - s).addScaledVector(w1, s);
      w.addScaledVector(tangent, -w.dot(tangent)).normalize();
      const half = this.width / 2;
      pos.push(p.x - w.x * half, p.y - w.y * half, p.z - w.z * half, p.x + w.x * half, p.y + w.y * half, p.z + w.z * half);
      uv.push(t, 0, t, 1);
      if (i < N) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    this.material.uniforms.uLength.value = curve.getLength();
  }
}

/** DIP-16 IDC plug (the far end of the ribbon that goes into the U701 socket). */
export function buildDipPlug(): THREE.Group {
  const g = new THREE.Group();
  const body = boxOnFloor(22, 7, 10.5, new THREE.MeshStandardMaterial({ color: 0x5a5d66, roughness: 0.5 }));
  body.position.y = 3.2;
  g.add(body);
  const cover = boxOnFloor(22, 2, 8, new THREE.MeshStandardMaterial({ color: 0x3d4048, roughness: 0.5 }));
  cover.position.y = 10.2;
  g.add(cover);
  const pg = new THREE.BoxGeometry(0.5, 4, 0.3);
  for (let i = 0; i < 8; i++) {
    for (const z of [3.81, -3.81]) {
      const p = new THREE.Mesh(pg, MAT.metal);
      p.position.set(-8.89 + i * 2.54, 1.6, z);
      g.add(p);
    }
  }
  // pin-1 dot
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 12), MAT.white);
  dot.position.set(-9.4, 12.3, 2.8);
  g.add(dot);
  return g;
}

/** Spring-hook mini-grabber at the end of the clock lead. */
export function buildGrabber(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 22, 14), new THREE.MeshStandardMaterial({ color, roughness: 0.45 }));
  body.position.y = 14;
  g.add(body);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.35, 6, 12, Math.PI * 1.4), MAT.metal);
  hook.position.y = 2.2;
  g.add(hook);
  const stem = boxOnFloor(0.6, 3, 0.6, MAT.metal);
  stem.position.y = 2.5;
  g.add(stem);
  return g;
}
