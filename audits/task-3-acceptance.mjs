/* Task 3 acceptance: lazy IntersectionObserver load + fallback caption
   + the verbatim line from dms-8.txt:2801 + anniversary copy.
   Fails loudly (non-zero exit) on any violation. */
import fs from 'fs';
import path from 'path';

const ROOT = '/home/vibex/halimah-birthday';
const INDEX = path.join(ROOT, 'index.html');
const JS = path.join(ROOT, 'sections/starmap.js');
const CSS = path.join(ROOT, 'sections/starmap.css');
const SRC = '/mnt/c/Users/COMPUTER WORLD/Downloads/halimah dms/halimah dms-8.txt';

const VERBATIM = 'YES A MILLION TIMES YES';
const HIS_TIME = '26/08/2026 06:12PM';
const HER_TIME = '26/08/2026 01:42PM';

const index = fs.readFileSync(INDEX, 'utf8');
const js = fs.readFileSync(JS, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
const srcLine2801 = fs.readFileSync(SRC, 'utf8').split('\n')[2800];

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('========================================');
console.log('TASK 3 ACCEPTANCE — starmap / anniversary room');
console.log('========================================');

console.log('\n--- lazy load via IntersectionObserver ---');
check('starmap.js constructs an IntersectionObserver',
  /new IntersectionObserver\s*\(/.test(js));
check('observer observes the #starmap section',
  /observer\.observe\(section\)/.test(js) && /getElementById\(SECTION_ID\)/.test(js));
check('observer disconnects after first intersect (loads once)',
  /observer\.disconnect\(\)/.test(js));
check('mount happens only from the observer callback',
  /if \(!entry\.isIntersecting\) continue;/.test(js));
check('observer is registered with a viewport threshold/rootMargin',
  /rootMargin|threshold/.test(js));
const hasDeferredScriptTag = /<script src="sections\/starmap\.js" defer><\/script>/.test(index);
const hasLazyManifestEntry = /['"]sections\/starmap\.js['"]/.test(index);
check('index.html loads starmap.js (deferred tag or lazy-manifest)',
  hasDeferredScriptTag || hasLazyManifestEntry,
  hasDeferredScriptTag ? 'deferred <script> tag' : hasLazyManifestEntry ? 'lazy-manifest registration' : 'not found');
check('no eager canvas paint on load (boot only observes)',
  !/mount\(section\);\s*\n\s*\}\);\s*\n\s*\}/.test(js.split("if (!('IntersectionObserver' in window))")[1]?.split('const observer')[0] ?? ''));

console.log('\n--- static fallback caption ---');
check('fallback element present in HTML', /data-starmap-fallback/.test(index));
check('fallback sits inside the #starmap section',
  /id="starmap"[\s\S]*?data-starmap-fallback[\s\S]*?<\/section>/.test(index));
check('fallback has visible text content (not empty)',
  /data-starmap-fallback[\s\S]{0,400}?the sky is out there tonight/.test(index));
check('fallback hidden only after a real draw', /fallback\.hidden = true/.test(js) && /canvas\.classList\.add\('is-drawn'\)/.test(js));
check('fallback CSS defaults to visible', /\.starmap__fallback\s*\{[\s\S]*?display:\s*flex/.test(css));
check('canvas is decorative (aria-hidden)', /aria-hidden="true"/.test(index));

console.log('\n--- verbatim line (dms-8.txt:2801) ---');
check(`index.html contains verbatim "${VERBATIM}"`, index.includes(VERBATIM));
check(`source line 2801 contains "${VERBATIM}"`, srcLine2801.includes(VERBATIM));
check('index.html line is exactly the verbatim phrase (no rewording)',
  index.includes(`<p class="starmap__verbatim">${VERBATIM}</p>`));
check('exact substring taken from the cited source line',
  srcLine2801.slice(srcLine2801.indexOf(VERBATIM)).startsWith(VERBATIM));

console.log('\n--- anniversary copy ---');
check(`his time "${HIS_TIME}" present`, index.includes(HIS_TIME));
check(`her time "${HER_TIME}" present`, index.includes(HER_TIME));
check('his time is labelled "Mine"', new RegExp(`${HIS_TIME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,200}?>Mine<`).test(index));
check('her time is labelled "Yours"', new RegExp(`${HER_TIME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,200}?>Yours<`).test(index));

console.log('\n--- reduced motion ---');
check('JS reads prefers-reduced-motion', /prefers-reduced-motion: reduce/.test(js));
check('reduced motion takes the static render path', /if \(prefersReducedMotion\(\)\)\s*\{\s*\n\s*renderStatic/.test(js));
const mountBody = js.split('function mount(section) {')[1].split('function boot()')[0];
const reducedBranch = mountBody.split('if (prefersReducedMotion()) {')[1]?.split('return;')[0] ?? '';
check('reduced motion stops the twinkle loop (startSky unreachable after early return)',
  reducedBranch.length > 0 && !reducedBranch.includes('startSky') && mountBody.includes('startSky'),
  'early return precedes startSky');
check('CSS honors prefers-reduced-motion', /@media \(prefers-reduced-motion: reduce\)/.test(css));

console.log('\n--- forbidden: no invented coordinates/city, no heavy lib ---');
const jsCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const forbiddenGeography = [
  'latitude', 'longitude', 'lat:', 'lon:', 'declination', 'right ascension',
  'altitude', 'azimuth', 'Birmingham', 'London', 'Manchester', 'Kolkata',
  'India', 'city', 'coordinates',
];
const foundGeo = forbiddenGeography.filter((term) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(jsCode));
check('no invented coordinates or city in starmap.js code', foundGeo.length === 0, foundGeo.join(', '));

const scriptTags = [...index.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
const externalScripts = scriptTags.filter((s) => /^https?:|^\/\//.test(s));
check('no external script in the page (nothing heavy in critical path)',
  externalScripts.length === 0, externalScripts.join(', '));
check('starmap.js is in the page (deferred or lazy-manifest)',
  scriptTags.includes('sections/starmap.js') || /['"]sections\/starmap\.js['"]/.test(index),
  scriptTags.join(', '));
check('no d3 / three / celestial import anywhere in the section',
  !/\bd3\b|three\.js|d3-celestial|import\s+.*from/i.test(js));
check('hand-rolled canvas is roughly ~100 lines of drawing logic',
  js.split('\n').filter((l) => l.trim() && !l.trim().startsWith('/*') && !l.trim().startsWith('*') && !l.trim().startsWith('//')).length < 200,
  `${js.split('\n').length} total lines`);

console.log('\n========================================');
console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
console.log('========================================');
process.exit(failures === 0 ? 0 : 1);
