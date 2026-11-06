#!/usr/bin/env node
// Renders screenshots of several stages with headless Chromium (software WebGL).
//
//   pnpm build && pnpm screenshots            # serves dist/ itself on a free port
//   pnpm screenshots -- --url http://localhost:5173/   # use a running dev/preview server
//   pnpm screenshots -- --dx v2                         # only one DX model (default: both, v2 then v1)
//   pnpm screenshots -- --draw-calls                    # also print the DX draw-call count per model
//
// Files are prefixed with the DX model: v2-01-welcome.png, v1-01-welcome.png, ... The README hero
// image (front three-quarter view of the closed DX, framed like the Wikimedia photo) is written
// as 00-dx-hero.png for v2 and v1-00-dx-hero.png for v1.
//
// Needs the browser once: pnpm exec playwright install chromium
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const webapp = resolve(here, '..');
const out = join(webapp, 'screenshots');
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const dxArg = args.includes('--dx') ? args[args.indexOf('--dx') + 1] : null;
const versions = dxArg ? dxArg.split(',') : ['v2', 'v1'];
const drawCalls = args.includes('--draw-calls');

const SHOTS = [
  ['00-dx-hero', 'hero', 0, 'desktop'],
  // [file, stage id, progress, viewport]
  ['01-welcome', 'welcome', 0.55, 'desktop'],
  ['02-beat', 'beat', 0.6, 'desktop'],
  ['03-inside', 'inside', 0.75, 'desktop'],
  ['04-trigger', 'trigger', 0.62, 'desktop'],
  ['05-overview', 'overview', 0.85, 'desktop'],
  ['06-capture', 'capture', 0.6, 'desktop'],
  ['07-mux', 'mux', 0.2, 'desktop'],
  ['08-clock', 'clock', 0.9, 'desktop'],
  ['10-power', 'power', 0.7, 'desktop'],
  ['11-replay', 'replay', 0.62, 'desktop'],
  ['12-build', 'build', 0.55, 'desktop'],
  ['13-install-model', 'install-model', 0.6, 'desktop'],
  ['14-install-socket', 'install-socket', 0.9, 'desktop'],
  ['15-install-pot', 'install-pot', 0.97, 'desktop'],
  ['16-install-clock', 'install-clock', 0.95, 'desktop'],
  ['17-test', 'test', 0.75, 'desktop'],
  ['18-done', 'done', 0.95, 'desktop'],
  ['m-05-overview', 'overview', 0.85, 'mobile'],
  ['m-11-replay', 'replay', 0.3, 'mobile'],
];
const only = args.filter((a) => !a.startsWith('--') && a !== urlArg && a !== dxArg);

const VIEWPORTS = {
  desktop: { width: 1440, height: 860, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

let server = null;
let base = urlArg;
if (!base) {
  server = await preview({ root: webapp, preview: { port: 0, host: '127.0.0.1', strictPort: false }, logLevel: 'warn' });
  base = server.resolvedUrls?.local?.[0];
  if (!base) throw new Error('vite preview did not report a URL');
}
console.log(`[screenshots] ${base}`);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
try {
  for (const ver of versions) {
    for (const [file, stage, p, vp] of SHOTS) {
      if (only.length && !only.some((o) => file.includes(o))) continue;
      const name = file === '00-dx-hero' && ver === 'v2' ? file : `${ver}-${file}`;
      const page = await browser.newPage({ viewport: { width: VIEWPORTS[vp].width, height: VIEWPORTS[vp].height }, ...VIEWPORTS[vp] });
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${name}] ${m.type()}: ${m.text()}`);
      });
      page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
      const hero = stage === 'hero';
      // The hero uses the "beat" stage (lid closed, TimeShift board hidden) with a free camera.
      const st = hero ? 'beat' : stage;
      await page.goto(`${base}?stage=${st}&p=${p}&dx=${ver}${hero ? '&labels=0' : ''}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__dx?.ready === true && window.__dx.world.modelSettled, null, { timeout: 120000 });
      await page.evaluate(([s, pp]) => window.__dx.goto(s, pp), [st, p]);
      if (hero) {
        await page.waitForTimeout(1800);
        await page.evaluate(() => {
          for (const id of ['inset', 'model-badge', 'hint', 'btn-return']) {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          }
          window.__dx.view([-30, 620, 350], [0, 50, 20]);
        });
      }
      await page.waitForTimeout(2600);
      const path = join(out, `${name}.png`);
      if (hero) await page.locator('#viewport').screenshot({ path, timeout: 120000 });
      else await page.screenshot({ path, timeout: 120000 });
      console.log(`[screenshots] ${path}`);
      if (drawCalls && file === '00-dx-hero') {
        const n = await page.evaluate(() => {
          const { world, renderer } = window.__dx;
          let calls = 0;
          world.dx.root.traverseVisible((o) => {
            if (o.isMesh) calls += Array.isArray(o.material) ? o.material.length : 1;
          });
          return { dx: calls, frame: renderer.info.render.calls };
        });
        console.log(`[screenshots] ${ver}: DX meshes (draw calls) = ${n.dx}, whole frame = ${n.frame}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  if (server) await new Promise((r) => server.httpServer.close(r));
}
if (errors.length) {
  console.log('\n[screenshots] browser console errors / warnings:');
  for (const e of [...new Set(errors)]) console.log(`  ${e}`);
}
