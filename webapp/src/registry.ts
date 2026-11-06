import * as THREE from 'three';

/** A named point in the scene that labels and camera targets can refer to. */
export interface Anchor {
  parent: THREE.Object3D;
  local: THREE.Vector3;
}

interface MatState {
  mat: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  emissiveIntensity: number;
  opacity: number;
  transparent: boolean;
}

interface ObjEntry {
  obj: THREE.Object3D;
  mats: MatState[];
  halo?: THREE.Mesh;
  lastHi: number;
  lastFade: number;
}

const HI_COLOR = new THREE.Color(0x35d0ff);

/**
 * Registry of every addressable object (for highlight / fade) and every anchor
 * (for labels, signal paths and camera targets). Object ids double as anchor ids.
 */
export class Registry {
  readonly objects = new Map<string, ObjEntry>();
  readonly anchors = new Map<string, Anchor>();
  private tmp = new THREE.Vector3();

  /**
   * Register an object. Its materials are cloned so highlight / fade affect only it.
   * An anchor with the same id is created at the top-centre of its bounding box,
   * unless `anchorLocal` is given.
   */
  addObject(id: string, obj: THREE.Object3D, anchorLocal?: THREE.Vector3): void {
    obj.name = id;
    const mats: MatState[] = [];
    const cloned = new Map<THREE.Material, THREE.Material>();
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.noRegistryMat) return;
      const swap = (mat: THREE.Material): THREE.Material => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
        let c = cloned.get(mat);
        if (!c) {
          const cm = mat.clone();
          c = cm;
          cloned.set(mat, cm);
          mats.push({ mat: cm, emissive: cm.emissive.clone(), emissiveIntensity: cm.emissiveIntensity, opacity: cm.opacity, transparent: cm.transparent });
        }
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
    this.objects.set(id, { obj, mats, lastHi: 0, lastFade: 0 });
    if (!this.anchors.has(id)) {
      let local = anchorLocal;
      if (!local) {
        obj.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(obj);
        const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
        if (box.isEmpty()) local = new THREE.Vector3();
        else {
          const c = box.getCenter(new THREE.Vector3());
          c.y = box.max.y;
          local = c.applyMatrix4(inv);
        }
      }
      this.anchors.set(id, { parent: obj, local });
    }
  }

  /**
   * Attach a second object to an existing id (e.g. the KiCad GLB model of a part that also
   * exists procedurally): its materials are cloned and then highlighted / faded together.
   */
  attach(id: string, obj: THREE.Object3D): boolean {
    const e = this.objects.get(id);
    if (!e) return false;
    const cloned = new Map<THREE.Material, THREE.Material>();
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.noRegistryMat) return;
      const swap = (mat: THREE.Material): THREE.Material => {
        if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
        let c = cloned.get(mat);
        if (!c) {
          const cm = mat.clone();
          c = cm;
          cloned.set(mat, cm);
          e.mats.push({ mat: cm, emissive: cm.emissive.clone(), emissiveIntensity: cm.emissiveIntensity, opacity: cm.opacity, transparent: cm.transparent });
        }
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    });
    e.lastHi = -1;
    return true;
  }

  addAnchor(id: string, parent: THREE.Object3D, local: THREE.Vector3): void {
    this.anchors.set(id, { parent, local: local.clone() });
  }

  /** Attach a translucent box used to highlight objects that have no own materials (GLB mode). */
  setHalo(id: string, halo: THREE.Mesh): void {
    const e = this.objects.get(id);
    if (e) e.halo = halo;
  }

  world(id: string, out = new THREE.Vector3()): THREE.Vector3 | null {
    const a = this.anchors.get(id);
    if (!a) return null;
    a.parent.updateWorldMatrix(true, false);
    return out.copy(a.local).applyMatrix4(a.parent.matrixWorld);
  }

  has(id: string): boolean {
    return this.anchors.has(id);
  }

  /**
   * Apply highlight (0..1, pulsing glow) and fade (0..1, 1 = nearly invisible) for one frame.
   * `useHalo` = draw the halo box instead of emissive (used when the real part is inside a GLB).
   */
  applyVisual(id: string, hi: number, fade: number, pulse: number, useHalo: boolean): void {
    const e = this.objects.get(id);
    if (!e) return;
    if (hi === e.lastHi && fade === e.lastFade && hi === 0) return;
    e.lastHi = hi;
    e.lastFade = fade;
    const glow = hi * (0.55 + 0.45 * pulse);
    for (const s of e.mats) {
      if (useHalo && e.halo) {
        s.mat.emissive.copy(s.emissive);
        s.mat.emissiveIntensity = s.emissiveIntensity;
      } else {
        s.mat.emissive.copy(s.emissive).lerp(HI_COLOR, Math.min(1, glow * 0.6));
        s.mat.emissiveIntensity = s.emissiveIntensity + glow * 0.45;
      }
      const op = s.opacity * (1 - 0.85 * fade);
      const tr = s.transparent || fade > 0.001;
      if (tr !== s.mat.transparent) {
        s.mat.transparent = tr;
        s.mat.needsUpdate = true;
      }
      s.mat.opacity = op;
      s.mat.depthWrite = fade < 0.5;
    }
    if (e.halo) {
      e.halo.visible = useHalo && glow > 0.01;
      (e.halo.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.3 * glow;
    }
  }

  ids(): string[] {
    return [...this.objects.keys()];
  }

  tmpVec(): THREE.Vector3 {
    return this.tmp;
  }
}
