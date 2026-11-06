import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { World } from './world';
import { Engine } from './engine';
import { Inset, fmtRefs, setRefResolver } from './insets';
import type { Stage } from './stages';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const viewport = $<HTMLDivElement>('viewport');
const glHost = $<HTMLDivElement>('gl');
const cssHost = $<HTMLDivElement>('css2d');
const loading = $<HTMLDivElement>('loading');

function fmt(t: number): string {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function start(): Promise<void> {
  if (!webglAvailable()) {
    loading.classList.add('error');
    loading.lastElementChild!.textContent = 'This walkthrough needs WebGL. Please try a current desktop or mobile browser.';
    return;
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  glHost.appendChild(renderer.domElement);

  const css = new CSS2DRenderer({ element: cssHost });

  const camera = new THREE.PerspectiveCamera(40, 1, 1, 6000);
  camera.position.set(600, 450, 800);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.dampingFactor = 0.08;
  controls.minDistance = 25;
  controls.maxDistance = 2600;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.zoomSpeed = 0.9;

  const world = new World(renderer);
  const badge = $<HTMLDivElement>('model-badge');
  const showBadge = (): void => {
    badge.textContent =
      world.info.mode === 'glb' ? 'Board: KiCad 3D model' : world.info.anchors === 'kicad' ? 'Board: procedural parts on the KiCad layout' : 'Board: procedural model';
    badge.title = `${world.info.note}. Label positions: ${world.info.anchors === 'kicad' ? 'KiCad PCB footprints' : 'procedural layout'}.`;
  };
  await world.buildBoard(import.meta.env.BASE_URL, showBadge);

  // Texts name parts by their procedural reference ({R4}); show the KiCad reference when the real layout is loaded.
  setRefResolver((r) => world.refOf(`ts.${r}`) ?? r);

  const insetEl = $<HTMLDivElement>('inset');
  const inset = new Inset(insetEl);
  const engine = new Engine(world, camera, controls, inset, viewport);

  // ------------------------------------------------------------ resize & inset docking
  const dock = $<HTMLDivElement>('inset-dock');
  const resize = (): void => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    css.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    const narrow = window.innerWidth <= 760;
    if (narrow && insetEl.parentElement !== dock) dock.appendChild(insetEl);
    if (!narrow && insetEl.parentElement !== viewport) viewport.insertBefore(insetEl, $('btn-return'));
  };
  new ResizeObserver(resize).observe(viewport);
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ UI
  const btnPlay = $<HTMLButtonElement>('btn-play');
  const scrub = $<HTMLInputElement>('scrub');
  const time = $<HTMLDivElement>('time');
  const markers = $<HTMLDivElement>('markers');
  const toc = $<HTMLDivElement>('toc');
  const btnToc = $<HTMLButtonElement>('btn-toc');
  const btnLabels = $<HTMLButtonElement>('btn-labels');
  const btnReturn = $<HTMLButtonElement>('btn-return');
  const speed = $<HTMLSelectElement>('speed');
  const panel = $<HTMLElement>('panel');
  showBadge();

  const markerEls: HTMLDivElement[] = [];
  engine.stages.forEach((s, i) => {
    const m = document.createElement('div');
    m.className = 'm';
    m.style.left = `${(engine.starts[i] / engine.total) * 100}%`;
    m.dataset.title = `${i + 1}. ${s.title}`;
    m.addEventListener('click', () => engine.goto(i));
    markers.appendChild(m);
    markerEls.push(m);
  });

  // table of contents
  let lastChapter = '';
  engine.stages.forEach((s, i) => {
    if (s.chapter !== lastChapter) {
      const h = document.createElement('h3');
      h.textContent = s.chapter;
      toc.appendChild(h);
      lastChapter = s.chapter;
    }
    const b = document.createElement('button');
    b.innerHTML = `<span class="n">${i + 1}</span><span></span>`;
    (b.lastElementChild as HTMLSpanElement).textContent = s.title;
    b.addEventListener('click', () => {
      engine.goto(i);
      setToc(false);
    });
    toc.appendChild(b);
  });
  const setToc = (open: boolean): void => {
    toc.classList.toggle('hidden', !open);
    btnToc.setAttribute('aria-expanded', String(open));
  };
  btnToc.addEventListener('click', () => setToc(toc.classList.contains('hidden')));

  const renderPanel = (i: number, s: Stage): void => {
    $('p-chapter').textContent = s.chapter;
    $('p-count').textContent = `${i + 1} / ${engine.stages.length}`;
    $('p-title').textContent = s.title;
    const body = $('p-body');
    body.replaceChildren(
      ...s.body.map((t) => {
        const p = document.createElement('p');
        p.textContent = fmtRefs(t);
        return p;
      }),
    );
    const mk = (cls: string, head: string, items: string[]): HTMLElement[] =>
      items.map((t) => {
        const d = document.createElement('div');
        d.className = `callout ${cls}`;
        const b = document.createElement('b');
        b.textContent = head;
        d.appendChild(b);
        d.appendChild(document.createTextNode(fmtRefs(t)));
        return d;
      });
    $('p-warn').replaceChildren(...mk('warn', 'SAFETY', s.warn ?? []));
    $('p-tbc').replaceChildren(...mk('tbc', 'TO BE CONFIRMED', s.tbc ?? []));
    ($('p-prev') as HTMLButtonElement).disabled = i === 0;
    ($('p-next') as HTMLButtonElement).textContent = i === engine.stages.length - 1 ? 'Start again ↺' : 'Next →';
    panel.scrollTop = 0;
    markerEls.forEach((m, k) => {
      m.classList.toggle('cur', k === i);
      m.classList.toggle('done', k < i);
    });
    toc.querySelectorAll('button').forEach((b, k) => b.classList.toggle('cur', k === i));
    const url = new URL(window.location.href);
    url.searchParams.set('stage', s.id);
    url.searchParams.delete('p');
    history.replaceState(null, '', url);
  };

  let scrubbing = false;
  engine.events = {
    onStage: renderPanel,
    onTick: (t) => {
      if (!scrubbing) scrub.value = String(Math.round((t / engine.total) * 1000));
      scrub.style.setProperty('--fill', `${(t / engine.total) * 100}%`);
      time.textContent = `${fmt(t / engine.speed)} / ${fmt(engine.total / engine.speed)}`;
    },
    onPlayState: (p) => {
      btnPlay.classList.toggle('playing', p);
      btnPlay.setAttribute('aria-label', p ? 'Pause' : 'Play');
    },
    onFreeOrbit: (f) => btnReturn.classList.toggle('hidden', !f),
  };

  scrub.addEventListener('input', () => {
    scrubbing = true;
    engine.seek((Number(scrub.value) / 1000) * engine.total);
  });
  scrub.addEventListener('change', () => {
    scrubbing = false;
  });
  btnPlay.addEventListener('click', () => engine.toggle());
  $('btn-next').addEventListener('click', () => engine.next());
  $('btn-prev').addEventListener('click', () => engine.prev());
  $('p-next').addEventListener('click', () => (engine.index === engine.stages.length - 1 ? engine.goto(0) : engine.next()));
  $('p-prev').addEventListener('click', () => engine.goto(engine.index - 1));
  btnReturn.addEventListener('click', () => engine.returnToStage());
  speed.addEventListener('change', () => engine.setSpeed(Number(speed.value)));
  const setLabels = (on: boolean): void => {
    engine.labels.setEnabled(on);
    btnLabels.classList.toggle('on', on);
    btnLabels.setAttribute('aria-pressed', String(on));
  };
  btnLabels.addEventListener('click', () => setLabels(!engine.labels.enabled));
  const toggleFs = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  $('btn-fs').addEventListener('click', toggleFs);

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key !== ' ') return;
    }
    // A focused button would also "click" on space/enter: drop focus so only our shortcut runs.
    if (tag === 'BUTTON' && e.key === ' ') (e.target as HTMLElement).blur();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        engine.toggle();
        break;
      case 'ArrowRight':
        e.preventDefault();
        engine.next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        engine.prev();
        break;
      case 'Home':
        engine.goto(0);
        break;
      case 'End':
        engine.goto(engine.stages.length - 1);
        break;
      case 'l':
      case 'L':
        setLabels(!engine.labels.enabled);
        break;
      case 'f':
      case 'F':
        toggleFs();
        break;
      case 'r':
      case 'R':
        engine.returnToStage();
        break;
      case 't':
      case 'T':
        setToc(toc.classList.contains('hidden'));
        break;
      case 'Escape':
        setToc(false);
        break;
      default:
        break;
    }
  });

  // ------------------------------------------------------------ deep links
  const q = new URLSearchParams(window.location.search);
  const stageParam = q.get('stage');
  let startIdx = 0;
  if (stageParam) {
    const byId = engine.stages.findIndex((s) => s.id === stageParam);
    startIdx = byId >= 0 ? byId : Math.max(0, Math.min(engine.stages.length - 1, Number(stageParam) - 1 || 0));
  }
  const startP = Math.max(0, Math.min(1, Number(q.get('p') ?? 0) || 0));
  if (q.get('labels') === '0') setLabels(false);
  if (q.get('speed')) {
    engine.setSpeed(Number(q.get('speed')) || 2);
    speed.value = String(engine.speed);
  }
  engine.goto(startIdx, startP);
  const autoplay = q.get('play') === '1';

  // ------------------------------------------------------------ loop
  const frame = (now: number): void => {
    engine.update(now);
    renderer.render(world.scene, camera);
    css.render(world.scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  loading.classList.add('done');
  if (autoplay) engine.play();

  // Hooks for automated screenshots / debugging.
  (window as unknown as { __dx: unknown }).__dx = {
    engine,
    world,
    renderer,
    goto: (id: string | number, p = 0) => {
      const i = typeof id === 'number' ? id : engine.stages.findIndex((s) => s.id === id);
      engine.pause();
      engine.goto(i, p);
    },
    ready: true,
  };
  setTimeout(() => $('hint').classList.add('hidden'), 9000);
}

start().catch((err: unknown) => {
  console.error(err);
  loading.classList.add('error');
  loading.lastElementChild!.textContent = `Could not start the 3D view: ${err instanceof Error ? err.message : String(err)}`;
});
