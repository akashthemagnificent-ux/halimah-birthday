// task-21 acceptance: reel page structure, assets, and playback contract.
// Usage: node audits/task-21-reel-acceptance.mjs
import fs from 'node:fs';

const base = '/home/vibex/halimah-birthday';
const read = (p) => fs.readFileSync(base + '/' + p, 'utf8');
const html = read('index.html');
const css = read('sections/reel.css');
const js = read('sections/reel.js');

let fails = 0;
const check = (label, cond, detail = '') => {
  if (!cond) fails++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
};

// --- 1. placement: between starmap (sky) and world (catalog) ---
const iStarmap = html.indexOf('id="starmap"');
const iReel = html.indexOf('id="reel"');
const iWorld = html.indexOf('id="world"');
check('reel sits between starmap and world', iStarmap > -1 && iReel > iStarmap && iWorld > iReel);

// --- 2. linked ---
check('reel.css linked', html.includes('sections/reel.css'));
check('reel.js wired', html.includes('sections/reel.js'));

// --- 3. assets: 5 videos + 5 posters, audio-bearing mp4s ---
for (let i = 1; i <= 5; i++) {
  check(`gift-${i}.mp4 exists`, fs.existsSync(`${base}/assets/reel/gift-${i}.mp4`));
  check(`gift-${i}-poster.jpg exists`, fs.existsSync(`${base}/assets/reel/gift-${i}-poster.jpg`));
}
check('markup references all five sources', [1,2,3,4,5].every((i) => html.includes(`assets/reel/gift-${i}.mp4`)));

// --- 4. markup architecture ---
for (const hook of ['data-reel-track','data-reel-stage','data-reel-echo','data-reel-fg','data-reel-wash','data-reel-flash','data-reel-veil','data-reel-caption','data-reel-rail','data-reel-sound']) {
  check(`markup hook ${hook}`, html.includes(hook));
}
check('foreground video is playsinline + muted + poster', /<video[^>]*data-reel-fg[^>]*playsinline[^>]*muted[^>]*poster=|<video[^>]*data-reel-fg[^>]*poster=[^>]*playsinline[^>]*muted|<video[^>]*data-reel-fg[^>]*muted[^>]*playsinline/.test(html.replace(/\n/g,' ')));
check('no-JS fallback links present', html.includes('reel__fallback') && [1,2,3,4,5].every((i) => html.includes(`href="assets/reel/gift-${i}.mp4"`)));

// --- 5. CSS contract ---
check('sticky stage', /\.reel__stage\s*\{[^}]*position:\s*sticky/s.test(css));
check('echo is blurred poster layer', /\.reel__echo[\s\S]{0,300}blur\(34px\)/.test(css));
check('flash beam styled', /\.reel__flash[\s\S]{0,300}scaleX\(0\.05\)/.test(css));
check('white veil styled', /\.reel__veil[\s\S]{0,200}opacity:\s*0/.test(css));
check('track hidden without JS', !/html\.js-reel[\s\S]*\.reel__track\s*\{[^}]*display:\s*block/.test(css) === false && /\.reel__track\s*\{[^}]*display:\s*none/s.test(css));
check('fallback hidden with JS', css.includes('html.js-reel .reel__fallback'));
check('reduced-motion drops the flash', /@media \(prefers-reduced-motion[\s\S]*\.reel__flash\s*\{[^}]*display:\s*none/s.test(css));
check('no hex outside print', ![...css.split('@media print')[0].matchAll(/#[0-9a-fA-F]{3,8}/g)].length);
check('no em-dashes in css/js authored copy', !css.includes('—') && !js.includes('—'));

// --- 6. JS playback contract ---
check('js opts in with html.js-reel', js.includes("classList.add('js-reel')"));
check('single decoder (one fg element swapped by src)', js.includes('fg.src = g.src') && !/querySelectorAll\('video'\)/.test(js));
check('active-only play policy', js.includes('playActive') && js.includes('fg.pause()'));
check('metadata preload for next gift only', js.includes("createElement('video')") && js.includes("preload = 'metadata'"));
check('reduced-motion gate', js.includes('prefers-reduced-motion'));
check('no wheel/touch hijack', !/addEventListener\(\s*'wheel'/.test(js) && !/addEventListener\(\s*'touchmove'/.test(js));
check('rAF-throttled scroll', js.includes('requestAnimationFrame') && js.includes("{ passive: true }"));
check('pauses when tab hidden', js.includes('visibilitychange'));
check('sound toggle present', js.includes('data-reel-sound') && js.includes('soundOn'));
check('five gifts in data model', (js.match(/assets\/reel\/gift-\d\.mp4/g) || []).length === 5);
check('echo uses poster (no second video decoder)', js.includes('echo.src = g.poster'));

console.log(fails === 0 ? 'ACCEPTANCE: ALL PASS' : 'ACCEPTANCE: ' + fails + ' FAILURES');
process.exit(fails ? 1 : 0);
