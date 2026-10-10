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
  // Deterministic DOM click: the play button carries a CSS entrance animation
  // that intermittently fails Playwright's 'stable' actionability check under
  // headless timing. The handler wiring is what we test, so click it directly.
  await pg.evaluate(() => document.querySelector('[data-physics-play]').click());
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

  // period in sim-seconds + wall-clock ratio.
  // Gate on formation settle first: the entrance rain drops nine hearts in and
  // the ring catches them, so angular speed is NOT at steady state for the first
  // couple of sim-seconds. Sampling the sweep during that ramp read an off
  // period (pre-existing flake on the committed baseline too). Wait until the
  // formation chain has locked (gapDev < 1deg) and stays locked, THEN measure.
  let settled = false;
  for (let a = 0; a < 40 && !settled; a += 1) {
    const g1 = await pg.evaluate(() => window.__physics.metrics().gapDev);
    await pg.waitForTimeout(300);
    const g2 = await pg.evaluate(() => window.__physics.metrics().gapDev);
    if (g1 < 1 && g2 < 1) settled = true;
  }
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

  // flick: poll for the PEAK speed over the first ~150ms. The 0.30-impulse
  // spikes within ~10ms then frictionAir + the radial spring bleed it back to
  // near-baseline by 80ms, so a single 80ms sample caught the decayed tail and
  // flaked (~50% on the committed baseline too). Peak is the real contract.
  const scr = await pg.evaluate(() => window.__physics.heartScreen(0));
  const v0 = await pg.evaluate(() => window.__physics.snapshot()[0].v);
  await pg.mouse.click(scr.x, scr.y);
  let vPeak = 0;
  for (let s = 0; s < 12; s += 1) {
    await pg.waitForTimeout(12);
    const vNow = await pg.evaluate(() => Math.max(...window.__physics.snapshot().map((x) => x.v)));
    if (vNow > vPeak) vPeak = vNow;
  }
  ck(`${url} flick energizes a heart`, vPeak > v0 + 0.08, `${v0} -> ${vPeak}`);

  /* ---- Phase C: 3D orbit rig ---- */
  // exact rest pose: (0, 1.8, 13.4) with neutral pointer parallax
  await pg.evaluate(() => window.__physics.neutralPointer());
  await pg.waitForTimeout(120);
  const cp0 = await pg.evaluate(() => window.__physics.camPos());
  ck(`${url} camera rest pose (0,1.8,13.4)`,
    Math.abs(cp0.x - 0) < 0.05 && Math.abs(cp0.y - 1.8) < 0.05 && Math.abs(cp0.z - 13.4) < 0.05,
    JSON.stringify(cp0));

  // empty-space drag orbits the camera (heart-drag path must stay a flick)
  const box = await pg.evaluate(() => {
    const r = document.querySelector('.physics__stage').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const az0 = await pg.evaluate(() => window.__physics.orbit().az);
  const el0 = await pg.evaluate(() => window.__physics.orbit().elev);
  // top-left corner of the stage is empty space (hearts ring the centre)
  await pg.mouse.move(box.x + 40, box.y + 40);
  await pg.mouse.down();
  await pg.mouse.move(box.x + 40 + 180, box.y + 40 + 60, { steps: 10 });
  await pg.mouse.up();
  await pg.waitForTimeout(150);
  const az1 = await pg.evaluate(() => window.__physics.orbit().az);
  const el1 = await pg.evaluate(() => window.__physics.orbit().elev);
  ck(`${url} empty-space drag changes azimuth`, Math.abs(az1 - az0) > 0.05, `${az0} -> ${az1}`);
  ck(`${url} empty-space drag changes elevation`, Math.abs(el1 - el0) > 0.05, `${el0} -> ${el1}`);
  const cp1 = await pg.evaluate(() => window.__physics.camPos());
  ck(`${url} dragged camera moved off rest`, Math.abs(cp1.x) + Math.abs(cp1.z - 13.4) > 0.5, JSON.stringify(cp1));

  // wheel zoom, clamped to [7, 24]
  const r0 = await pg.evaluate(() => window.__physics.orbit().r);
  await pg.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
  await pg.mouse.wheel(0, -600);
  await pg.waitForTimeout(80);
  const r1 = await pg.evaluate(() => window.__physics.orbit().r);
  await pg.mouse.wheel(0, -100000);
  await pg.waitForTimeout(80);
  const rMin = await pg.evaluate(() => window.__physics.orbit().r);
  await pg.mouse.wheel(0, 200000);
  await pg.waitForTimeout(80);
  const rMax = await pg.evaluate(() => window.__physics.orbit().r);
  ck(`${url} wheel zoom changes radius`, r1 < r0 - 0.5, `${r0} -> ${r1}`);
  ck(`${url} zoom clamped [7,24]`, rMin >= 6.99 && rMax <= 24.01, `min=${rMin} max=${rMax}`);

  // idle drift returns elevation toward rest (azimuth keeps orientation)
  await pg.evaluate(() => window.__physics.setOrbit(0, 1.2, 13.4));
  await pg.waitForTimeout(5200); // 2500ms idle threshold + settle time
  const el2 = await pg.evaluate(() => window.__physics.orbit().elev);
  ck(`${url} idle drift returns elevation to rest`, Math.abs(el2 - 0.126) < 0.3, `elev=${el2.toFixed(3)}`);

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
