// task-19 acceptance: OWNER-SLOTS.md inventory matches the live site.
// Usage: node audits/task-19-acceptance.mjs
// Exit 0 when every documented slot exists live, every live marker is
// documented, and every missing-input fallback is still wired.
import fs from 'node:fs';

const base = '/home/vibex/halimah-birthday';
const read = (p) => fs.readFileSync(base + '/' + p, 'utf8');

const html = read('index.html');
const doc = read('OWNER-SLOTS.md');
const photosReadme = read('assets/photos/README.md');
const musicReadme = read('assets/music/README.md');
const albumJs = read('sections/album.js');
const finaleCss = read('sections/finale.css');

let fails = 0;
const check = (label, cond, detail = '') => {
  if (!cond) fails++;
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
};

// --- 1. photo slots: doc lists 6, markup probes 6, README lists 6 ---
const docPhotos = [...doc.matchAll(/`photo-(\d)\.jpg`/g)].map((m) => m[1]).sort();
check('doc lists 6 photo slots', docPhotos.join(',') === '1,2,3,4,5,6', 'found ' + docPhotos.join(','));
const liveProbes = [...html.matchAll(/data-photo="assets\/photos\/photo-(\d)\.jpg"/g)].map((m) => m[1]).sort();
check('markup probes 6 photo slots', liveProbes.join(',') === '1,2,3,4,5,6', 'found ' + liveProbes.join(','));
const readmePhotos = [...photosReadme.matchAll(/`photo-(\d)\.jpg`/g)].map((m) => m[1]).sort();
check('photos README lists 6 slots', readmePhotos.join(',') === '1,2,3,4,5,6', 'found ' + readmePhotos.join(','));

// --- 2. song slot ---
check('doc names song.mp3', doc.includes('`assets/music/song.mp3`'));
check('markup points at song.mp3', html.includes('assets/music/song.mp3'));
check('music README documents swap', musicReadme.includes('song.mp3'));

// --- 3. letter slots: 3 [OWNER:] markers, ids match between doc and markup ---
const liveMarkers = [...html.matchAll(/data-owner-slot="([a-z-]+)">\[OWNER:/g)].map((m) => m[1]).sort();
check('markup has 3 owner slots', liveMarkers.join(',') === 'ps,signature,spider-line', 'found ' + liveMarkers.join(','));
for (const id of ['spider-line', 'signature', 'ps']) {
  check(`doc documents slot ${id}`, doc.includes('`' + id + '`'), id);
}
const liveMarkerCount = (html.match(/\[OWNER:/g) || []).length;
check('live marker count is exactly 3', liveMarkerCount === 3, 'live ' + liveMarkerCount);
check('doc explains the [OWNER:] convention', doc.includes('[OWNER:]'));

// --- 4. turning-17 decision: declined by default, guardrail intact ---
check('no turning-17 line on page', !/turning\s*17/i.test(html) && !/turns\s*17/i.test(html));
const auditSrc = read('audits/quote-audit.mjs');
check('quote audit still forbids turning-17', /turning\\s\*17/i.test(auditSrc));
check('doc records the 17 decision', /turning-17 decision/i.test(doc));

// --- 5. missing-input fallbacks still wired ---
check('album probes before swapping (no broken icons)', albumJs.includes('probePhoto') && albumJs.includes('onerror'));
check('placeholders exist for all 6 pages', (html.match(/PLACEHOLDER/g) || []).length >= 6);
const beginJs = read('js/begin.js');
check('music failure handled gracefully', html.includes('Music unavailable') || beginJs.includes('Music unavailable'));
check('print hides owner slots', /\.finale__slot[\s\S]{0,200}display:\s*none/.test(finaleCss.split('@media print')[1] || ''));

// --- 6. defaults documented, not invented ---
check('doc states photo default', /placeholder/i.test(doc));
check('doc states song default', /placeholder tone/i.test(doc));
check('doc states letter reads complete', /reads complete/i.test(doc));

console.log(fails === 0 ? 'ACCEPTANCE: ALL PASS' : 'ACCEPTANCE: ' + fails + ' FAILURES');
process.exit(fails ? 1 : 0);
