/**
 * Text overlays inside the 3D scene: CSS2DRenderer labels anchored to registry anchors,
 * each with a dot on the part, a leader line and a card. Cards are kept on screen by
 * nudging them inside the viewport (sizes are measured once, not every frame).
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Registry } from './registry';
import type { Dir, LabelDef } from './stages';
import { fmtRefs } from './insets';

const ANG: Record<Dir, number> = { e: 0, ne: 45, n: 90, nw: 135, w: 180, sw: 225, s: 270, se: 315 };
const SHIFT: Record<Dir, [number, number]> = {
  e: [0, -0.5], ne: [0, -1], n: [-0.5, -1], nw: [-1, -1], w: [-1, -0.5], sw: [-1, 0], s: [-0.5, 0], se: [0, 0],
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placed {
  l: Live;
  sx: number;
  sy: number;
  x: number;
  y: number;
}

interface Live {
  def: LabelDef;
  obj: CSS2DObject;
  el: HTMLDivElement;
  card: HTMLDivElement;
  lead: HTMLSpanElement;
  w: number;
  h: number;
  ex: number;
  ey: number;
  opacity: number;
}

export class LabelLayer {
  private live: Live[] = [];
  private key = '';
  enabled = true;
  private v = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private reg: Registry) {}

  /** Replace the label set (no-op if unchanged). */
  set(defs: LabelDef[]): void {
    const key = defs.map((d) => `${d.anchor}|${d.text}|${d.sub ?? ''}|${d.dir ?? ''}`).join('#');
    if (key === this.key) return;
    this.key = key;
    for (const l of this.live) {
      this.scene.remove(l.obj);
      l.el.remove();
    }
    this.live = [];
    for (const def of defs) {
      if (!this.reg.has(def.anchor)) {
        console.warn('[labels] unknown anchor', def.anchor);
        continue;
      }
      const dir = def.dir ?? 'ne';
      const len = def.len ?? 50;
      const el = document.createElement('div');
      el.className = `lbl${def.tbc ? ' tbc' : ''}${def.warn ? ' warn' : ''}`;
      const dot = document.createElement('span');
      dot.className = 'lbl-dot';
      el.appendChild(dot);
      const a = (ANG[dir] * Math.PI) / 180;
      const ex = Math.cos(a) * len;
      const ey = -Math.sin(a) * len;
      const lead = document.createElement('span');
      lead.className = 'lbl-lead';
      lead.style.width = `${len}px`;
      lead.style.transform = `rotate(${-ANG[dir]}deg)`;
      el.appendChild(lead);
      const card = document.createElement('div');
      card.className = 'lbl-card';
      const t = document.createElement('div');
      t.className = 'lbl-text';
      t.textContent = fmtRefs(def.text);
      card.appendChild(t);
      if (def.sub) {
        const s = document.createElement('div');
        s.className = 'lbl-sub';
        s.textContent = fmtRefs(def.sub);
        card.appendChild(s);
      }
      if (def.tbc) {
        const b = document.createElement('div');
        b.className = 'lbl-badge';
        b.textContent = 'TO BE CONFIRMED';
        card.appendChild(b);
      }
      el.appendChild(card);
      const obj = new CSS2DObject(el);
      obj.center.set(0, 0);
      this.scene.add(obj);
      el.style.opacity = '0';
      this.live.push({ def, obj, el, card, lead, w: -1, h: -1, ex, ey, opacity: 0 });
    }
  }

  /**
   * Per frame: follow anchors, fade with the time window, keep cards on screen, push
   * overlapping cards apart (and out of `obstacles`, e.g. the inset), redraw the leaders.
   */
  update(p: number, camera: THREE.Camera, viewW: number, viewH: number, dt: number, obstacles: Rect[] = []): void {
    const k = 1 - Math.exp(-dt * 8);
    const vis: Placed[] = [];
    for (const l of this.live) {
      const pos = this.reg.world(l.def.anchor, this.v);
      if (pos) l.obj.position.copy(pos);
      const [a, b] = l.def.at ?? [0, 1];
      const want = this.enabled && p >= a && p <= b ? 1 : 0;
      l.opacity += (want - l.opacity) * k;
      if (Math.abs(l.opacity - want) < 0.01) l.opacity = want;
      l.el.style.opacity = l.opacity.toFixed(3);
      l.el.style.visibility = l.opacity > 0.01 ? 'visible' : 'hidden';
      if (l.opacity <= 0.01) continue;
      if (l.w < 0 || l.w === 0) {
        l.w = l.card.offsetWidth;
        l.h = l.card.offsetHeight;
      }
      const sp = this.v.copy(l.obj.position).project(camera);
      if (sp.z > 1) continue;
      const sx = (sp.x * 0.5 + 0.5) * viewW;
      const sy = (-sp.y * 0.5 + 0.5) * viewH;
      const [fx, fy] = SHIFT[l.def.dir ?? 'ne'];
      vis.push({ l, sx, sy, x: sx + l.ex + fx * l.w, y: sy + l.ey + fy * l.h });
    }
    const m = 8;
    const clampIn = (q: Placed) => {
      q.x = Math.min(Math.max(q.x, m), viewW - m - q.l.w);
      q.y = Math.min(Math.max(q.y, m), viewH - m - q.l.h);
    };
    vis.forEach(clampIn);
    const gap = 4;
    for (let it = 0; it < 8; it++) {
      let moved = false;
      for (let i = 0; i < vis.length; i++) {
        const A = vis[i];
        for (let j = i + 1; j < vis.length; j++) {
          const B = vis[j];
          const ox = Math.min(A.x + A.l.w, B.x + B.l.w) - Math.max(A.x, B.x) + gap;
          const oy = Math.min(A.y + A.l.h, B.y + B.l.h) - Math.max(A.y, B.y) + gap;
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (oy <= ox * 1.6) {
            const up = A.y + A.l.h / 2 < B.y + B.l.h / 2 ? A : B;
            const down = up === A ? B : A;
            up.y -= oy / 2;
            down.y += oy / 2;
          } else {
            const left = A.x + A.l.w / 2 < B.x + B.l.w / 2 ? A : B;
            const right = left === A ? B : A;
            left.x -= ox / 2;
            right.x += ox / 2;
          }
        }
        for (const o of obstacles) {
          const ox = Math.min(A.x + A.l.w, o.x + o.w) - Math.max(A.x, o.x) + gap;
          const oy = Math.min(A.y + A.l.h, o.y + o.h) - Math.max(A.y, o.y) + gap;
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          // leave the obstacle by the shortest way (right or down)
          const toRight = o.x + o.w + gap - A.x;
          const toDown = o.y + o.h + gap - A.y;
          if (toRight < toDown) A.x += toRight;
          else A.y += toDown;
        }
      }
      vis.forEach(clampIn);
      if (!moved) break;
    }
    for (const q of vis) {
      const dx = q.x - q.sx;
      const dy = q.y - q.sy;
      q.l.card.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      // leader from the dot to the nearest point of the card
      const nx = Math.min(Math.max(0, dx), dx + q.l.w);
      const ny = Math.min(Math.max(0, dy), dy + q.l.h);
      const len = Math.hypot(nx, ny);
      const lead = q.l.lead;
      lead.style.width = `${len.toFixed(1)}px`;
      lead.style.transform = `rotate(${Math.atan2(ny, nx).toFixed(4)}rad)`;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }
}
