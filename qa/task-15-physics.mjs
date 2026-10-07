#!/usr/bin/env node
/* Task 15 QA: physics orbit on plain file:// + http — current API.
   Asserts: mode 'orbit', 9 manifest chips, wall-clock stepping (sim period
   8-16s at real-time ratio), radial label ring non-overlap, flick + drag. */
/* Uses playwright-core (the only node playwright on this machine) against the
   ms-playwright chromium binary — `playwright` itself is not installed. */
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WANT = JSON.parse(readFileSync(join(root, 'content', 'physics-names.json'), 'utf8'))
  .hearts.map((h) => h.name);

const results = [];
const ck = (name, ok, detail = '') => {
  results.push([ok ? 'PASS' : 'FAIL', name, detail]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
};

const settle = async (pg) => {
  for (let a = 0; a < 4; a += 1) {
    await pg.evaluate(() => document.getElementById('physics').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await pg.waitForTimeout(350);
    const r = await pg.evaluate(() => {
      const q2 = document.querySelector('.physics__stage').getBoundingClientRect();
      return { y: q2.y, h: q2.height };
    });
    if (r.y >= 0 && r.y + r.h <= 900) return r;
  }
  throw new Error('stage never fit in viewport');
};

const run = async (url) => {
  const pwBase = (process.env.HOME || '') + '/.cache/ms-playwright';
  const rev = readdirSync(pwBase).filter((d) => d.startsWith('chromium-')).pop();
  const exe = [`${pwBase}/${rev}/chrome-linux64/chrome`, `${pwBase}/${rev}/chrome-linux/chrome`]
    .find((p) => existsSync(p));
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(url, { waitUntil: 'load' });
  await pg.evaluate(() => document.getElementById('begin-button').click());
  await pg.waitForFunction(() => window.__physics !== undefined, null, { timeout: 20000 });
  await settle(pg);
  await pg.locator('[data-physics-play]').click();
  await settle(pg);
  await pg.waitForFunction(() => window.__physics.mode === 'orbit', null, { timeout: 15000 });
  await pg.waitForTimeout(2500);

  const st = await pg.evaluate(() => ({
    mode: window.__physics.mode,
    names: window.__physics.names,
    hearts: window.__physics.heartCount,
    chips: [...document.querySelectorAll('[data-physics-name]')].map((c) => c.textContent),
    m: window.__physics.metrics(),
    staticHidden: document.querySelector('[data-physics-static]').hidden,
    status: document.querySelector('[data-physics-status]').textContent,
  }));
  ck(`${url} mode orbit`, st.mode === 'orbit', st.mode);
  ck(`${url} 9 manifest names`, JSON.stringify(st.names) === JSON.stringify(WANT), JSON.stringify(st.names));
  ck(`${url} chips rendered from manifest`, JSON.stringify(st.chips) === JSON.stringify(WANT));
  ck(`${url} heartCount 9`, st.hearts === 9, st.hearts);
  ck(`${url} static row hidden after wake`, st.staticHidden === true);
  ck(`${url} stage >=600x410`, st.m.stageW >= 600 && st.m.stageH >= 410, JSON.stringify(st.m));
  ck(`${url} label text >=12px`, st.m.labelTextPx >= 12, st.m.labelTextPx);
  ck(`${url} status count-driven`, st.status.includes('nine hearts'), st.status);

  // period in sim-seconds + wall-clock ratio
  const s1 = await pg.evaluate(() => window.__physics.snapshot());
  const m1 = await pg.evaluate(() => window.__physics.metrics());
  await pg.waitForTimeout(6000);
  const s2 = await pg.evaluate(() => window.__physics.snapshot());
  const m2 = await pg.evaluate(() => window.__physics.metrics());
  const a1 = Math.atan2(s1[0].y, s1[0].x), a2 = Math.atan2(s2[0].y, s2[0].x);
  let da = a2 - a1;
  if (da <= -Math.PI) da += 2 * Math.PI;
  if (da > Math.PI) da -= 2 * Math.PI;
  const dSim = m2.simS - m1.simS;
  const period = da !== 0 ? Math.abs((2 * Math.PI) / da * dSim) : Infinity;
  ck(`${url} orbit period 8-18s (sim time)`, period >= 8 && period <= 18, `${period.toFixed(1)}s`);
  const ratio = dSim / 6;
  ck(`${url} sim runs at wall-clock speed`, ratio >= 0.8 && ratio <= 1.25, `ratio=${ratio.toFixed(2)}`);

  // labels non-overlapping + in viewport
  const rects = await pg.evaluate(() =>
    [...Array(window.__physics.heartCount)].map((_, i) => window.__physics.labelRect(i)));
  const ov = [];
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i], c = rects[j];
      if (!a || !c) continue;
      const gapx = Math.abs(a.x - c.x) - (a.w + c.w) / 2;
      const gapy = Math.abs(a.y - c.y) - (a.h + c.h) / 2;
      if (gapx < 4 && gapy < 4) ov.push(`${i}x${j}(${Math.min(gapx, gapy).toFixed(1)})`);
    }
  }
  ck(`${url} 9 labels pairwise non-overlapping`, ov.length === 0, ov.join(','));
  const mNow = await pg.evaluate(() => window.__physics.metrics());
  ck(`${url} formation chain: gap dev <=3deg`, mNow.gapDev <= 3, mNow.gapDev);

  // flick
  const scr = await pg.evaluate(() => window.__physics.heartScreen(0));
  const v0 = await pg.evaluate(() => window.__physics.snapshot()[0].v);
  await pg.mouse.click(scr.x, scr.y);
  await pg.waitForTimeout(80); // before frictionAir decays the 0.35 impulse
  const vMax = await pg.evaluate(() => Math.max(...window.__physics.snapshot().map((s) => s.v)));
  ck(`${url} flick energizes a heart`, vMax > v0 + 0.08, `${v0} -> ${vMax}`);

  ck(`${url} zero page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close();
};

const failures = () => results.filter((r) => r[0] === 'FAIL');

await run('file://' + join(root, 'index.html'));
await run('http://127.0.0.1:9033/index.html?preview=1').catch((e) => {
  results.push(['FAIL', 'http suite ran', String(e).slice(0, 200)]);
});

const f = failures();
console.log(`RESULT: ${f.length === 0 ? 'PASS' : `FAIL (${f.length})`}`);
process.exit(f.length === 0 ? 0 : 1);
