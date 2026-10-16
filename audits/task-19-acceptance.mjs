// task-19 acceptance: OWNER-SLOTS.md inventory matches the live site.
// Usage: node audits/task-19-acceptance.mjs
// Exit 0 when every documented slot exists live, every live marker is
// documented, and every missing-input fallback is still wired.
import fs from 'node:fs';

const base = '/home/vibex/halimah-birthday';
const read = (p) => fs.readFileSync(base + '/' + p, 'utf8');

const html = read('index.html');
const doc = read('OWNER-SLOTS.md');
const photosReadme = read('assets/baby/README.md');
const musicReadme = read('assets/music/README.md');
const albumJs = read('sections/album.js');
const finaleCss = read('sections/finale.css');

let fails = 0;
const check = (label, cond, detail = '') => {
  if (!cond) fails++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
};

// --- 1. album photos: shipped as 42 baby photos (no empty slot) ---
const liveProbes = [...html.matchAll(/data-photo="assets\/baby\/halimah-pic-(\d\d)\.webp"/g)].map((m) => m[1]);
check('markup declares 42 baby photo slots', liveProbes.length === 42, 'found ' + liveProbes.length);
const docShips = /SHIPPED/i.test(doc) && doc.includes('assets/baby/');
check('doc records the album photos as shipped', docShips);
const readmeShips = photosReadme.includes('halimah-pic-01.webp') && photosReadme.includes('halimah-pic-42.webp');
check('baby README documents the 42-photo range', readmeShips);

// --- 2. song slot ---
check('doc names song.mp3', doc.includes('`assets/music/song.mp3`'));
check('markup points at song.mp3', html.includes('assets/music/song.mp3'));
check('music README documents swap', musicReadme.includes('song.mp3'));

// --- 3. letter slots: FILLED with final owner copy, zero [OWNER:] markers ---
const liveMarkers = [...html.matchAll(/data-owner-slot="([a-z-]+)">\[OWNER:/g)].map((m) => m[1]).sort();
check('letter slots retired (no live markers)', liveMarkers.length === 0, 'found ' + liveMarkers.join(','));
const letterSeg = html.slice(html.indexOf('finale__letter'), html.indexOf('</article>', html.indexOf('finale__letter')));
check('final letter copy shipped (cutiepie + princess)', letterSeg.includes('cutiepie') && letterSeg.includes('Your princess'));
for (const id of ['spider-line', 'signature', 'ps']) {
  check(`doc still names retired slot ${id}`, doc.includes('`' + id + '`'), id);
}
const liveMarkerCount = (html.match(/\[OWNER:/g) || []).length;
check('no [OWNER:] markers anywhere in markup', liveMarkerCount === 0, 'live ' + liveMarkerCount);
check('doc explains the [OWNER:] convention', doc.includes('[OWNER:]'));

// --- 4. turning-17 decision: declined by default, guardrail intact ---
check('no turning-17 line on page', !/turning\s*17/i.test(html) && !/turns\s*17/i.test(html));
const auditSrc = read('audits/quote-audit.mjs');
check('quote audit still forbids turning-17', /turning\\s\*17/i.test(auditSrc));
check('doc records the 17 decision', /turning-17 decision/i.test(doc));

// --- 5. missing-input fallbacks still wired ---
check('album probes before swapping (no broken icons)', albumJs.includes('probePhoto') && albumJs.includes('onerror'));
check('cover + last page stay placeholders', (html.match(/PLACEHOLDER/g) || []).length >= 2 && /album__page--cover/.test(html));
const beginJs = read('js/begin.js');
check('music failure handled gracefully', beginJs.includes('music file not added yet') && beginJs.includes('onplayerror'));
check('print hides owner slots', /\.finale__slot[\s\S]{0,200}display:\s*none/.test(finaleCss.split('@media print')[1] || ''));

// --- 6. defaults documented, not invented ---
check('doc states photo default', /placeholder/i.test(doc));
check('doc states song default', /placeholder tone/i.test(doc));
check('doc states letter reads complete', /reads complete/i.test(doc));

console.log(fails === 0 ? 'ACCEPTANCE: ALL PASS' : 'ACCEPTANCE: ' + fails + ' FAILURES');
process.exit(fails ? 1 : 0);
