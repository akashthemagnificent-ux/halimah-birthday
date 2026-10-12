// starmap Galaxy smoke: confirm the WebGL2 Galaxy background mounts on
// file://, the fallback is dropped only after a real draw, and the four
// owner copy edits are present. Usage: node qa/task-21-starmap-galaxy.mjs
import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = '/home/vibex/halimah-birthday';
const url = 'file://' + join(ROOT, 'index.html');

function findChrome() {
  const base = join(homedir(), '.cache/ms-playwright');
  const dirs = readdirSync(base).filter((d) => d.startsWith('chromium-')).sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = join(base, dirs[i], sub);
      if (existsSync(p)) return p;
    }
  }
  throw new Error('no chromium found');
}

const b = await chromium.launch({ executablePath: findChrome(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(url, { waitUntil: 'load' });

// unlock the page (begin gate)
const begin = page.locator('#begin-button, [data-begin], .begin__button').first();
if (await begin.count()) { try { await begin.click({ noWaitAfter: true, timeout: 5000 }); } catch (e) { await page.evaluate(() => { const el = document.querySelector('#begin-button, [data-begin], .begin__button'); if (el) el.click(); }); } }
await page.waitForTimeout(400);

// scroll to starmap
await page.evaluate(() => document.getElementById('starmap')?.scrollIntoView());
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const sec = document.getElementById('starmap');
  const host = sec?.querySelector('[data-starmap-galaxy]');
  const marker = sec?.querySelector('[data-starmap-canvas]');
  const gc = host?.querySelector('.galaxy-canvas');
  const fb = sec?.querySelector('[data-starmap-fallback]');
  const gl = gc?.getContext('webgl2');
  // sample a pixel band to prove the shader actually drew (not a black canvas)
  let lit = 0;
  if (gl && gc.width > 0) {
    const px = new Uint8Array(4 * 64);
    gl.readPixels(0, Math.floor(gc.height / 2), 64, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 12) lit++;
  }
  const txt = sec?.textContent || '';
  return {
    galaxyHost: !!host,
    galaxyCanvas: !!gc,
    canvasW: gc?.width || 0,
    canvasH: gc?.height || 0,
    webgl2: !!gl,
    markerKept: !!marker,
    fallbackHidden: fb ? fb.hidden : null,
    markerDrawn: marker ? marker.classList.contains('is-drawn') : null,
    litPixels: lit,
    hasTitleNew: txt.includes('the night you came into this world'),
    hasTitleOld: txt.includes('the night she was born'),
    hasMine: txt.includes('Mine'),
    hasYours: txt.includes('Yours'),
    hasHis: /\bhis\b/i.test(txt),
    hasHers: /\bhers\b/i.test(txt),
    srcRemoved: !txt.includes('verbatim from our chat'),
    verbatimKept: txt.includes('YES A MILLION TIMES YES'),
  };
});

await page.evaluate(() => document.getElementById('starmap')?.scrollIntoView());
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/starmap-galaxy.png' });
console.log(JSON.stringify(res, null, 2));
console.log('PAGE ERRORS:', errors.length ? errors : 'none');
await b.close();
