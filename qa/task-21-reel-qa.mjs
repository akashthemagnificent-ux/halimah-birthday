// qa/task-21-reel-qa.mjs - e2e smoke for the birthday video reel.
// Usage: env NODE_PATH=/home/vibex/node_modules node qa/task-21-reel-qa.mjs [happy|reduced|nojs]
// Conventions copied from qa/task-12-qa.mjs: local static server,
// sha256 build hash, poll-not-sleep under swiftshader, cleanup receipt.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { globSync } from 'node:fs';

const pw = await (async () => {
  const pick = (m) => (m && m.chromium ? m : m && m.default ? m.default : null);
  try { return pick(await import('playwright')); } catch {}
  try { return pick(await import('playwright-core')); } catch {}
  const hits = globSync('/home/vibex/.npm/_npx/*/node_modules/playwright/index.js');
  for (const hit of hits) {
    try { const m = pick(await import(pathToFileURL(hit).href)); if (m) return m; } catch {}
  }
  const hits2 = globSync('/home/vibex/.cache/ms-playwright/chromium-*/chrome-linux64/chrome');
  throw new Error('no playwright module found');
})();
const { chromium } = pw;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site';
mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] || 'happy';

let pass = 0, fail = 0;
const say = (m) => console.log(m);
const assert = (cond, label, detail = '') => {
  if (cond) { pass++; say(`[PASS] ${label}${detail ? ' — ' + detail : ''}`); }
  else { fail++; say(`[FAIL] ${label}${detail ? ' — ' + detail : ''}`); }
};

const hash = createHash('sha256');
for (const f of ['index.html', 'sections/reel.css', 'sections/reel.js']) {
  hash.update(await readFile(join(root, f)));
}
say('# build sha256(index+reel.css+reel.js) = ' + hash.digest('hex').slice(0, 16));
say('# mode = ' + mode);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon'
};
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  try {
    const body = await readFile(join(root, normalize(p).replace(/^(\.\.[/\\])+/, '')));
    res.writeHead(200, { 'content-type': MIME[extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const clockScript = `(() => { const R = Date; const T = R.parse('2026-10-19T00:00:05+01:00'); function F(...a){ return a.length===0 ? new R(T) : new R(...a);} F.now=()=>T; F.parse=R.parse; F.UTC=R.UTC; F.prototype=R.prototype; window.Date=F; })();`;
const target = mode === 'file' ? 'file:///home/vibex/halimah-birthday/index.html' : base;

let browser;
try {
  browser = await chromium.launch();
  const ctxOpts = {
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=user-gesture-required'] }
  };
  if (mode === 'reduced') ctxOpts.reducedMotion = 'reduce';
  if (mode === 'nojs') ctxOpts.javaScriptEnabled = false;
  const ctx = await browser.newContext(ctxOpts);
  if (mode !== 'nojs') await ctx.addInitScript(clockScript);
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => {
    const err = (r.failure() && r.failure().errorText) || '';
    /* media range requests abort by design when the single decoder pauses/swaps */
    if (/ERR_ABORTED/.test(err) && /\.mp4(\?|$)/.test(r.url())) return;
    failed.push(r.url() + ' (' + err + ')');
  });

  await page.goto(target, { waitUntil: 'commit', timeout: 120000 }).catch((e) => say('# goto: ' + e.message.split('\n')[0]));
  try { await page.waitForLoadState('domcontentloaded', { timeout: 120000 }); } catch {}
  await page.waitForTimeout(4000);
  try { await page.click('#begin-button', { timeout: 6000 }); say('# begin dismissed'); }
  catch { say('# begin overlay already clear'); }

  if (mode === 'nojs') {
    const st = await page.evaluate(() => {
      const track = document.querySelector('[data-reel-track]');
      const fb = document.querySelector('.reel__fallback');
      const links = document.querySelectorAll('.reel__fallback-list a').length;
      return {
        trackDisplay: track ? getComputedStyle(track).display : 'missing',
        fallbackDisplay: fb ? getComputedStyle(fb).display : 'missing',
        links
      };
    });
    say('# nojs: ' + JSON.stringify(st));
    assert(st.trackDisplay === 'none', 'track hidden without JS');
    assert(st.fallbackDisplay !== 'none', 'fallback links visible without JS');
    assert(st.links === 5, 'five fallback links', `links=${st.links}`);
  } else {
    // scroll helper: instant
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    // wait for reel init
    try {
      await page.waitForFunction(() => document.documentElement.classList.contains('js-reel'), null, { timeout: 60000 });
      say('# js-reel class present');
    } catch { say('# js-reel class never appeared'); }
    assert(await page.evaluate(() => document.documentElement.classList.contains('js-reel')), 'reel.js opted in');

    const geo = await page.evaluate(() => {
      const track = document.querySelector('[data-reel-track]');
      const r = track.getBoundingClientRect();
      return { top: r.top + window.scrollY, h: track.offsetHeight, vw: window.innerWidth, w: Math.round(r.width), vh: window.innerHeight };
    });
    const chapterH = geo.h / 5;
    say('# track: ' + JSON.stringify({ ...geo, chapterH: Math.round(chapterH) }));
    assert(Math.abs(geo.h - 5 * chapterH) < 4, 'track sized for five chapters');
    /* regression: base .section is a column flex with align-items:center, so a
       section that never sets display:block shrinks the track to fit-content —
       the stage holds only absolutely-positioned children, collapsing to 0px
       wide and rendering a blank black canvas. */
    assert(geo.w > geo.vw * 0.9, 'track spans the viewport (not collapsed by flex)', `w=${geo.w} vw=${geo.vw}`);
    const stageBox = await page.evaluate(() => {
      const s = document.querySelector('[data-reel-stage]');
      const r = s.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(document.querySelector('#reel')).display };
    });
    say('# stage: ' + JSON.stringify(stageBox));
    assert(stageBox.w > 1000 && stageBox.h > 400, 'stage paints a full-size box', JSON.stringify(stageBox));
    assert(stageBox.display === 'block', '#reel overrides the base flex layout', `display=${stageBox.display}`);

    // one real click = user activation (she will have tapped begin first)
    await page.mouse.click(20, 20);
    await page.waitForTimeout(400);

    // walk each gift at hold zone (p=0.45); file mode spot-checks 1 and 5
    const walkList = mode === 'file' ? [0, 4] : [0, 1, 2, 3, 4];
    const seen = [];
    let playingConflicts = 0;
    for (const i of walkList) {
      const target = geo.top + chapterH * i + chapterH * 0.45;
      const walkOnce = async () => {
      await page.evaluate((y) => window.scrollTo(0, y), target);
      // poll for index + decoded frame
      const state = await page.evaluate(async (expect) => {
        const fg = document.querySelector('[data-reel-fg]');
        const idx = document.querySelector('[data-reel-index]');
        const t0 = performance.now();
        while (performance.now() - t0 < 22000) {
          const videos = Array.from(document.querySelectorAll('video'));
          const playing = videos.filter((v) => !v.paused && v.readyState >= 2);
          const idxTxt = idx ? idx.textContent.trim() : '?';
          const decoded = fg && fg.videoWidth > 0;
          const playingOk = fg && !fg.paused && fg.readyState >= 2;
          if (idxTxt === expect && decoded && playingOk) {
            return { idx: idxTxt, videoWidth: fg.videoWidth, videoHeight: fg.videoHeight, playingCount: playing.length, dur: fg.duration, err: fg.error ? fg.error.code : 0 };
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        const videos = Array.from(document.querySelectorAll('video'));
        return {
          idx: idx ? idx.textContent.trim() : '?',
          videoWidth: fg ? fg.videoWidth : -1,
          videoHeight: fg ? fg.videoHeight : -1,
          playingCount: videos.filter((v) => !v.paused && v.readyState >= 2).length,
          paused: fg ? fg.paused : null,
          readyState: fg ? fg.readyState : -1,
          err: fg && fg.error ? fg.error.code : 0,
          timedOut: true
        };
      }, String(i + 1).padStart(2, '0'));
      return state;
      };
      let state = await walkOnce();
      if (state.timedOut) {
        // starved-loader retry: leave the chapter and re-approach it
        say(`# gift ${i + 1}: first pass starved, re-approaching`);
        await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, target - chapterH * 0.5));
        await page.waitForTimeout(1500);
        state = await walkOnce();
      }
      say(`# gift ${i + 1}: ` + JSON.stringify(state));
      seen.push(state.idx);
      assert(state.idx === String(i + 1).padStart(2, '0'), `gift ${i + 1} becomes active`, `idx=${state.idx}`);
      assert(state.videoWidth > 0, `gift ${i + 1} decodes frames`, `${state.videoWidth}x${state.videoHeight} err=${state.err}`);
      assert(!state.timedOut, `gift ${i + 1} playing in hold zone`, state.timedOut ? `paused=${state.paused} ready=${state.readyState}` : '');
      assert(state.playingCount <= 1, `only one video playing at gift ${i + 1}`, `playing=${state.playingCount}`);
      if (state.playingCount > 1) playingConflicts++;
      /* breather: let any shader-compile jank drain before the next swap */
      await page.waitForTimeout(900);
    }

    // boundary flash/veil: scroll to chapter 0 end (p~0.93)
    await page.evaluate((y) => window.scrollTo(0, y), geo.top + chapterH * 0.93);
    await page.waitForTimeout(1600);
    const flashState = await page.evaluate(() => {
      const flash = document.querySelector('[data-reel-flash]');
      const veil = document.querySelector('[data-reel-veil]');
      return {
        flashOpacity: flash ? parseFloat(getComputedStyle(flash).opacity) : -1,
        veilOpacity: veil ? parseFloat(getComputedStyle(veil).opacity) : -1
      };
    });
    say('# boundary: ' + JSON.stringify(flashState));
    if (mode === 'file') {
      say('# boundary choreography asserted in server modes (file mode spot-checks playback only)');
    } else if (mode === 'reduced') {
      assert(flashState.flashOpacity === 0, 'reduced motion suppresses the beam');
      assert(flashState.veilOpacity > 0.4, 'reduced motion still crossfades via veil', `veil=${flashState.veilOpacity}`);
    } else {
      assert(flashState.flashOpacity > 0.3 || flashState.veilOpacity > 0.5, 'flash or veil active at chapter end', JSON.stringify(flashState));
    }

    // scroll up restores previous gift cleanly
    await page.evaluate((y) => window.scrollTo(0, y), geo.top + chapterH * 3 + chapterH * 0.45);
    await page.waitForTimeout(1400);
    const upIdx = await page.evaluate(() => document.querySelector('[data-reel-index]')?.textContent.trim());
    assert(upIdx === '04', 'scroll up restores earlier gift', `idx=${upIdx}`);

    // sound: edits play with audio by default (trusted click above granted
    // activation); the stage carries no on-page controls any more
    const snd = await page.evaluate(() => {
      const fg = document.querySelector('[data-reel-fg]');
      return {
        muted: fg ? fg.muted : null,
        paused: fg ? fg.paused : null,
        hasSoundBtn: !!document.querySelector('[data-reel-sound]'),
        hasCaption: !!document.querySelector('[data-reel-caption]')
      };
    });
    say('# sound: ' + JSON.stringify(snd));
    assert(snd.muted === false && snd.paused === false, 'sound on by default (unmuted, playing)', JSON.stringify(snd));
    assert(!snd.hasSoundBtn && !snd.hasCaption, 'minimal canvas (no toggle, no caption)', JSON.stringify(snd));

    // console errors: allow known photo-probe noise; on file:// the
    // "Failed to load resource" line carries no URL (attribution lives
    // in requestfailed, filtered precisely below).
    const unexplained = errors.filter((e) => {
      if (/assets\/baby\//.test(e) || /physics-names\.json/.test(e)) return false;
      if (mode === 'file' && /Failed to load resource/.test(e)) return false;
      return true;
    });
    const unexplainedFails = failed.filter((u) => !/assets\/baby\//.test(u) && !/physics-names\.json/.test(u));
    if (failed.length) say('# requestfailed urls: ' + failed.slice(0, 8).join(' | '));
    say(`# resource errors: ${errors.length} console line(s); ${failed.length} requestfailed; unexplained: ${unexplained.length + unexplainedFails.length}`);
    assert(unexplained.length === 0 && unexplainedFails.length === 0, 'zero unexplained console/resource errors', (unexplained[0] || unexplainedFails[0] || '').slice(0, 160));

    // light evidence shot (non-fatal; swiftshader compositing may stall)
    await page.evaluate((y) => window.scrollTo(0, y), geo.top + chapterH * 1 + chapterH * 0.45);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, `task-21-reel-${mode}.png`), timeout: 30000 })
      .then(() => say(`# screenshot -> ${OUT}/task-21-reel-${mode}.png`))
      .catch((e) => say('# screenshot failed (non-fatal): ' + e.message.split('\n')[0]));
  }

  say(fail === 0 ? `SMOKE: ALL CHECKS PASSED (${pass})` : `SMOKE: ${fail} CHECK(S) FAILED (${pass} passed)`);
  writeFileSync(join(OUT, 'task-21-reel-last.json'), JSON.stringify({ mode, pass, fail, at: new Date().toISOString() }, null, 2));
} finally {
  try { if (browser) await browser.close(); } catch {}
  await new Promise((r) => server.close(r));
  say('# cleanup: browser closed, server closed');
}
process.exit(fail ? 1 : 0);
