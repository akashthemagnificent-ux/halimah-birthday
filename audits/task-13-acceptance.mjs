/* Task 13 acceptance: her world, the archive (full rebuild).
   Enforces the owner contract:
     - content coverage of every objective fact (Isagi Rin, both anime,
       all 11 songs, 4 singers, 3 horror titles, games, autumn, calling)
     - verbatim DM quotes only, traced to lore Room 10
     - no <img>/<audio>/<video>/base64/url() artwork blobs
     - zero hex in world.css (palette is rgb()/token refs)
     - em-dash ban (U+2014 and &mdash;) in world markup/css/js
     - full motion: NO prefers-reduced-motion anywhere (owner decree)
     - component mounts present, scripts ordered gsap -> vendors -> world.js
     - graceful no-JS: reveal only armed under html.js-world
   Exits non-zero on any violation. */
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const ROOT = '/home/vibex/halimah-birthday';
const INDEX = path.join(ROOT, 'index.html');
const FRAG = path.join(ROOT, 'sections/world.html');
const CSS = path.join(ROOT, 'sections/world.css');
const JS = path.join(ROOT, 'sections/world.js');
const LORE = path.join(ROOT, 'content/lore.md');

const index = fs.readFileSync(INDEX, 'utf8');
const frag = fs.readFileSync(FRAG, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
const js = fs.readFileSync(JS, 'utf8');
const lore = fs.readFileSync(LORE, 'utf8');

const START = index.indexOf('<!-- 10. world');
const END = index.indexOf('<!-- 11. finale');
const worldSeg = index.slice(START, END);

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' - ' + detail : ''}`);
}
function lc(s) { return worldSeg.toLowerCase().includes(s.toLowerCase()); }
function segBetween(a, b) {
  const i = worldSeg.indexOf(a);
  const j = worldSeg.indexOf(b);
  return i > -1 && j > i ? worldSeg.slice(i, j) : '';
}

console.log('========================================');
console.log('TASK 13 ACCEPTANCE - her world, the archive');
console.log('========================================');
console.log('# index sha=' + createHash('sha256').update(index).digest('hex').slice(0, 16));
check('world segment located', START > -1 && END > START, `start=${START} end=${END}`);

console.log('\n--- wiring / script order ---');
check('world.css linked', /<link rel="stylesheet" href="sections\/world\.css" \/>/.test(index));
check('world.js plain <script> tag', /<script src="sections\/world\.js"><\/script>/.test(index));
const pos = {};
for (const m of index.matchAll(/<script src="([^"]+)"/g)) pos[m[1]] = m.index;
const gs = pos['vendor/gsap.min.js'];
const wj = pos['sections/world.js'];
check('gsap before world.js', gs != null && wj != null && gs < wj, `gsap=${gs} wj=${wj}`);
for (const v of ['silk-background','masked-heading','holo-card','scroll-stack','glitch-text','pulse-heart','magic-bento']) {
  const p = pos['vendor/' + v + '.js'];
  check(`vendor ${v}.js after gsap, before world.js`, p != null && gs < p && p < wj, `p=${p}`);
}

console.log('\n--- structure / mounts ---');
const fragFirst = frag.split('\n')[0].trim();
check('fragment first line mirrors index', fragFirst.length > 0 && index.includes(fragFirst), fragFirst.slice(0, 60));
check('11 song cards', (worldSeg.match(/<article class="world__song"/g) || []).length === 11);
check('3 horror tickets', (worldSeg.match(/<div class="world__ticket">/g) || []).length === 3);
check('8 bento cells', (worldSeg.match(/<div class="world__cell"/g) || []).length === 8);
for (const m of ['data-world-silk','data-world-heading','data-world-holo','data-world-stack','data-world-bento','data-world-heart'])
  check(`mount ${m}`, worldSeg.includes(m));
for (const m of ['character','music','singers','horror','bento'])
  check(`motif ${m}`, worldSeg.includes(`data-motif="${m}"`));
check('closer block present', worldSeg.includes('world__closer-block'));

console.log('\n--- content coverage (objective facts) ---');
check('fav character: Isagi Rin', lc('Isagi Rin'));
check('anime: Blue Lock', lc('Blue Lock'));
check('anime: Kimi ni Todoke', lc('Kimi ni Todoke'));
const songs = [
  ['Save Your Tears','The Weeknd'], ['Long Way to Go','Cassie'], ['Brooklyn Baby','Lana Del Rey'],
  ['Into It','Chase Atlantic'], ['Heartbeat','Childish Gambino'], ['Fame Is a Gun','Addison Rae'],
  ["Livin' on a Prayer",'Bon Jovi'], ['Come as You Are','Nirvana'], ['Without Me','Eminem'],
  ['bye','Ariana Grande'], ['TBH','PartyNextDoor'],
];
for (const [t, a] of songs) check(`song ${t} - ${a}`, lc(t) && lc(a));
const singersSeg = segBetween('data-motif="singers"', 'data-motif="horror"');
for (const s of ['Ariana Grande','Chase Atlantic','The Weeknd','Nirvana']) check(`singer ${s}`, singersSeg.includes(s));
const horrorSeg = segBetween('data-motif="horror"', 'data-motif="bento"');
for (const h of ['The Shining','The Conjuring','The Exorcist']) check(`horror ${h}`, horrorSeg.includes(h));
check('game: Resident Evil', lc('Resident Evil'));
check('game: Roblox', lc('Roblox'));
check('season: autumn', lc('autumn'));
check('loves calling', lc('loves calling'));
check('anime extra: Tokyo Ghoul', lc('Tokyo Ghoul'));
check('genre: gothic writing', lc('gothic writing'));
check('hobby: badminton', lc('badminton'));
check('hobby: drawing', lc('drawing era') || lc('Is this drawing good'));

console.log('\n--- lyric guard (attributed copy only) ---');
// Every text span >40 chars must be a registered original phrase; DM quotes
// (blockquote) and source attributions are stripped first. An injected
// commercial lyric is neither, so it fails here.
const ORIGINAL_COPY = [
  'loving her means loving her whole world',
  'this archive is the map',
  'the two she&#8217;d rewatch on a loop',
  'crunchy leaves, grey skies, her season',
];
const stripped = worldSeg
  .replace(/<blockquote class="world__dm[^"]*"[^>]*>[\s\S]*?<\/blockquote>/g, ' ')
  .replace(/<p class="world__source">[\s\S]*?<\/p>/g, ' ');
const longSpans = [...stripped.matchAll(/>\s*([^<>]{41,})\s*</g)].map((m) => m[1].trim()).filter((s) => s.length > 40);
const unattributed = longSpans.filter((s) => !ORIGINAL_COPY.some((o) => s.includes(o) || o.includes(s)));
check('no unattributed span > 40 chars (lyric guard)', unattributed.length === 0, unattributed.slice(0, 2).join(' | ').slice(0, 120));

console.log('\n--- no artwork blobs ---');
check('no <img>/<audio>/<video> in world section', !/<(audio|video|img)[\s>]/i.test(worldSeg));
check('no base64 blobs in world files', !/base64/i.test(worldSeg + css + js));
check('no background-image url() in world.css', !/background-image\s*:\s*url/i.test(css));

console.log('\n--- palette / motion contract ---');
const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0]);
check('world.css zero hardcoded hex (rgb()/token only)', hexes.length === 0, hexes.slice(0, 5).join(', '));
check('world.css has NO prefers-reduced-motion (full motion)', !/prefers-reduced-motion/.test(css));
check('world.js has NO prefers-reduced-motion (full motion)', !/prefers-reduced-motion/.test(js));
check('reveal armed only under html.js-world', /html\.js-world/.test(css) && /js-world/.test(js));
check('JS uses IntersectionObserver', /new IntersectionObserver\s*\(/.test(js));
// no-JS: stage/closer must not be opacity:0 unless gated by html.js-world
const stageRules = css.match(/[^{}]*\.world__(?:stage|closer-block)[^{}]*\{[^}]*\}/g) || [];
const bareHidden = stageRules.filter((r) => /opacity:\s*0/.test(r) && !/html\.js-world/.test(r));
check('reveal targets visible without JS (opacity:0 gated by html.js-world)', bareHidden.length === 0, bareHidden[0] ? bareHidden[0].slice(0, 70) : '');
check('reveal restores via .is-in', /html\.js-world \.world__stage\.is-in/.test(css));

console.log('\n--- DM fidelity (Room 10) ---');
const room10 = lore.split('## Room 10:')[1].split('## ')[0];
const dmQuotes = [...worldSeg.matchAll(/<blockquote class="world__dm[^"]*"[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
check('at least 8 DM quotes present', dmQuotes.length >= 8, `found=${dmQuotes.length}`);
for (const q of dmQuotes) {
  const probe = q.replace(/&#\d+;/g, ' ').replace(/&mdash;/g, '\u2014').replace(/\s+/g, ' ').trim().slice(0, 30);
  check(`DM traces to Room 10: "${probe}\u2026"`, room10.includes(probe) || lore.includes(probe));
}

console.log('\n--- em-dash ban ---');
check('world section: no U+2014', !worldSeg.includes('\u2014'));
check('world section: no &mdash;', !worldSeg.includes('&mdash;'));
check('world.css: no em-dash', !css.includes('\u2014') && !css.includes('&mdash;'));
check('world.js: no em-dash', !js.includes('\u2014') && !js.includes('&mdash;'));

console.log('\n========================================');
console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
console.log('========================================');
process.exit(failures === 0 ? 0 : 1);
