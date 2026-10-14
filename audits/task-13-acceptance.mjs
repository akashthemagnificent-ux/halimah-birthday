/* Task 13 acceptance: your world, the archive (media rebuild).
   Enforces the owner contract:
     - second-person copy everywhere in the world section (no third
       person except "him" for the character Rin), removed cards gone
     - Rin frame photo on the holo card, Kimi ni Todoke label removed
       from the stage card
     - media present: 11 song clips + covers, 3 movie posters with
       scramble titles, 4 liquid-glass carousels (anime/autumn/
       matcha/calling), all referenced assets exist on disk
     - verbatim DM quotes only, traced to lore Room 10
     - zero hex in world.css (palette is rgb()/token refs)
     - em-dash ban (U+2014 and &mdash;) in world markup/css/js/vendors
     - full motion: NO prefers-reduced-motion anywhere (owner decree)
     - component mounts present, scripts ordered gsap -> vendors ->
       world.js; removed vendors (holo-card, glitch-text) are gone
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
const flexVendor = fs.readFileSync(path.join(ROOT, 'vendor/flex-carousel.js'), 'utf8');
const scrVendor = fs.readFileSync(path.join(ROOT, 'vendor/scramble-text.js'), 'utf8');

const START = index.indexOf('<!-- 10. world');
const END = index.indexOf('<!-- 11. finale');
const worldSeg = index.slice(START, END);

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' - ' + detail : ''}`);
}
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function lc(s) { return decode(worldSeg).toLowerCase().includes(s.toLowerCase()); }
function segBetween(a, b) {
  const i = worldSeg.indexOf(a);
  const j = worldSeg.indexOf(b);
  return i > -1 && j > i ? worldSeg.slice(i, j) : '';
}
function assetExists(rel) { return fs.existsSync(path.join(ROOT, rel)); }

console.log('========================================');
console.log('TASK 13 ACCEPTANCE - your world, the archive');
console.log('========================================');
console.log('# index sha=' + createHash('sha256').update(index).digest('hex').slice(0, 16));
check('world segment located', START > -1 && END > START, `start=${START} end=${END}`);
const decoded = decode(worldSeg);

console.log('\n--- wiring / script order ---');
check('world.css linked', /<link rel="stylesheet" href="sections\/world\.css" \/>/.test(index));
check('world.js plain <script> tag', /<script src="sections\/world\.js"><\/script>/.test(index));
const pos = {};
for (const m of index.matchAll(/<script src="([^"]+)"/g)) pos[m[1]] = m.index;
const gs = pos['vendor/gsap.min.js'];
const wj = pos['sections/world.js'];
check('gsap before world.js', gs != null && wj != null && gs < wj, `gsap=${gs} wj=${wj}`);
for (const v of ['silk-background', 'masked-heading', 'scroll-stack', 'scramble-text', 'flex-carousel', 'pulse-heart', 'magic-bento']) {
  const p = pos['vendor/' + v + '.js'];
  check(`vendor ${v}.js after gsap, before world.js`, p != null && gs < p && p < wj, `p=${p}`);
  check(`vendor file exists: ${v}.js`, fs.existsSync(path.join(ROOT, 'vendor/' + v + '.js')));
}
for (const v of ['holo-card', 'glitch-text']) {
  check(`removed vendor ${v}.js not referenced`, pos['vendor/' + v + '.js'] == null);
  check(`removed vendor file gone: ${v}.js`, !fs.existsSync(path.join(ROOT, 'vendor/' + v + '.js')));
}
check('no data-glitch anywhere', !index.includes('data-glitch'));

console.log('\n--- structure / mounts ---');
const fragFirst = frag.split('\n')[0].trim();
check('fragment first line mirrors index', fragFirst.length > 0 && index.includes(fragFirst), fragFirst.slice(0, 60));
check('11 song cards', (worldSeg.match(/<article class="world__song"/g) || []).length === 11);
check('3 horror tickets', (worldSeg.match(/<div class="world__ticket">/g) || []).length === 3);
check('4 bento cells (anime/autumn/matcha/calling)', (worldSeg.match(/<div class="world__cell/g) || []).length === 4);
for (const m of ['data-world-silk', 'data-world-heading', 'data-world-holo', 'data-world-stack', 'data-world-bento', 'data-world-heart'])
  check(`mount ${m}`, worldSeg.includes(m));
for (const m of ['character', 'music', 'singers', 'horror', 'bento', 'anime', 'autumn', 'matcha', 'calling'])
  check(`motif ${m}`, worldSeg.includes(`data-motif="${m}"`));
check('closer block present', worldSeg.includes('world__closer-block'));
for (const gone of ['game lobby', 'gothic', 'drawing era', 'badminton', 'tokyo ghoul', 'Resident Evil'])
  check(`removed content absent: ${gone}`, !decoded.toLowerCase().includes(gone.toLowerCase()));

console.log('\n--- first-person copy (owner objective) ---');
const REQUIRED = [
  'your world · the archive', 'know these, know you', 'everything you love, catalogued',
  'your blue lock obsession', 'you pick him every time', 'on repeat · eleven songs',
  'after dark · your top three', 'the rest of you', "the two you'd rewatch",
  'your season', 'you love calling', 'loving you means loving your whole world', 'Your world',
];
for (const p of REQUIRED) check(`first-person present: "${p}"`, decoded.includes(p));
const FORBIDDEN = [
  'everything she loves', 'her world', 'know these, know her', 'she loves calling',
  'her top three', 'her season', 'on a loop', 'the two she', 'loving her means',
  'she is', 'her favorite', 'for her', 'she likes', "she'd rewatch",
];
for (const p of FORBIDDEN) check(`third person absent: "${p}"`, !decoded.toLowerCase().includes(p.toLowerCase()));
const stageSeg = segBetween('data-motif="character"', 'data-motif="music"');
check('stage has no Kimi ni Todoke label', !stageSeg.toLowerCase().includes('kimi ni todoke'));
check('anime cell keeps both anime chips', decoded.includes('Kimi ni Todoke') && decoded.includes('Blue Lock'));

console.log('\n--- content coverage (objective facts) ---');
check('fav character: Isagi Rin', lc('Isagi Rin'));
check('anime: Blue Lock', lc('Blue Lock'));
check('anime: Kimi ni Todoke', lc('Kimi ni Todoke'));
const songs = [
  ['Save Your Tears', 'The Weeknd'], ['Long Way to Go', 'Cassie'], ['Brooklyn Baby', 'Lana Del Rey'],
  ['Into It', 'Chase Atlantic'], ['Heartbeat', 'Childish Gambino'], ['Fame Is a Gun', 'Addison Rae'],
  ["Livin' on a Prayer", 'Bon Jovi'], ['Come as You Are', 'Nirvana'], ['Without Me', 'Eminem'],
  ['bye', 'Ariana Grande'], ['TBH', 'PartyNextDoor'],
];
for (const [t, a] of songs) check(`song ${t} - ${a}`, lc(t) && lc(a));
const singersSeg = segBetween('data-motif="singers"', 'data-motif="horror"');
for (const s of ['Ariana Grande', 'Chase Atlantic', 'The Weeknd', 'Nirvana']) check(`singer ${s}`, singersSeg.includes(s));
for (const h of ['The Shining', 'The Conjuring', 'The Exorcist']) check(`horror ${h}`, lc(h));
check('season: autumn', lc('autumn'));
check('matcha cell present', lc('matcha'));

console.log('\n--- media contract (owner override) ---');
const rinImg = (worldSeg.match(/<img class="world__holo-photo"[^>]*src="([^"]+)"/) || [])[1];
check('Rin frame photo on holo card', rinImg === 'assets/world/rin/frame.jpg', rinImg || 'missing');
check('Rin frame asset exists', rinImg && assetExists(rinImg));
const audioSrcs = [...worldSeg.matchAll(/data-audio="([^"]+)"/g)].map((m) => m[1]);
check('11 song clips referenced', audioSrcs.length === 11, `found=${audioSrcs.length}`);
const covers = [...worldSeg.matchAll(/<img class="world__song-cover"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
check('11 song covers referenced', covers.length === 11, `found=${covers.length}`);
const posters = [...worldSeg.matchAll(/<img class="world__ticket-poster"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
check('3 movie posters referenced', posters.length === 3, `found=${posters.length}`);
check('3 scramble titles', (worldSeg.match(/data-scramble/g) || []).length === 3);
const flexKinds = [...worldSeg.matchAll(/data-world-flex="(\w+)"/g)].map((m) => m[1]);
check('4 carousel mounts with kinds', flexKinds.length === 4 && ['anime', 'autumn', 'matcha', 'calling'].every((k) => flexKinds.includes(k)), flexKinds.join(','));
const allAssets = [...worldSeg.matchAll(/(?:src|data-audio)="(assets\/world\/[^"]+)"/g)].map((m) => m[1]);
check('62 media assets referenced', allAssets.length === 62, `found=${allAssets.length}`);
const missingAssets = allAssets.filter((a) => !assetExists(a));
check('every referenced asset exists on disk', missingAssets.length === 0, missingAssets.slice(0, 3).join(', '));
const mp3s = audioSrcs.filter((s) => s.endsWith('.mp3'));
check('all clips are mp3', mp3s.length === 11);
check('SVG liquid-glass filter defined', worldSeg.includes('id="world-liquid-glass"') && worldSeg.includes('feDisplacementMap'));
check('world.css applies the filter', /url\(#world-liquid-glass\)/.test(css));
check('no base64 blobs in world files', !/base64/i.test(worldSeg + css + js));
check('carousels init after bento rebuild', js.indexOf('upgradeBento(section)') < js.indexOf('upgradeFlex(section)'));
check('song audio bootstrapped', js.includes('initSongAudio') && /crossfade/i.test(js));

console.log('\n--- lyric guard (attributed copy only) ---');
// Every text span >40 chars must be a registered original phrase; DM quotes
// (blockquote) and source attributions are stripped first. An injected
// commercial lyric is neither, so it fails here.
const ORIGINAL_COPY = [
  'loving you means loving your whole world',
  'this archive is the map',
  "the two you'd rewatch",
  'crunchy leaves, grey skies',
  'i watch through my fingers',
  'you pick him every time',
];
const stripped = worldSeg
  .replace(/<blockquote class="world__dm[^"]*"[^>]*>[\s\S]*?<\/blockquote>/g, ' ')
  .replace(/<p class="world__source">[\s\S]*?<\/p>/g, ' ');
const longSpans = [...stripped.matchAll(/>\s*([^<>]{41,})\s*</g)].map((m) => m[1].trim()).filter((s) => s.length > 40);
const unattributed = longSpans.filter((s) => !ORIGINAL_COPY.some((o) => s.includes(o) || o.includes(s)));
check('no unattributed span > 40 chars (lyric guard)', unattributed.length === 0, unattributed.slice(0, 2).join(' | ').slice(0, 120));

console.log('\n--- palette / motion contract ---');
const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0]);
check('world.css zero hardcoded hex (rgb()/token only)', hexes.length === 0, hexes.slice(0, 5).join(', '));
for (const [name, body] of [['world.css', css], ['world.js', js], ['flex-carousel.js', flexVendor], ['scramble-text.js', scrVendor]]) {
  check(`${name} has NO prefers-reduced-motion (full motion)`, !/prefers-reduced-motion/.test(body));
  check(`${name}: no em-dash`, !body.includes('\u2014') && !body.includes('&mdash;'));
}
check('reveal armed only under html.js-world', /html\.js-world/.test(css) && /js-world/.test(js));
check('JS uses IntersectionObserver', /new IntersectionObserver\s*\(/.test(js));
const stageRules = css.match(/[^{}]*\.world__(?:stage|closer-block)[^{}]*\{[^}]*\}/g) || [];
const bareHidden = stageRules.filter((r) => /opacity:\s*0/.test(r) && !/html\.js-world/.test(r));
check('reveal targets visible without JS (opacity:0 gated by html.js-world)', bareHidden.length === 0, bareHidden[0] ? bareHidden[0].slice(0, 70) : '');
check('reveal restores via .is-in', /html\.js-world \.world__stage\.is-in/.test(css));

console.log('\n--- DM fidelity (Room 10) ---');
const room10 = lore.split('## Room 10:')[1].split('## ')[0];
const dmQuotes = [...worldSeg.matchAll(/<blockquote class="world__dm[^"]*"[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
// Kept cards carry exactly 3 DM quotes; the other 5 Room 10 quotes lived on
// cards the owner removed (tokyo ghoul, games, gothic writing, drawing, badminton)
// and must not reappear anywhere in the section.
check('exactly 3 DM quotes (kept cards)', dmQuotes.length === 3, `found=${dmQuotes.length}`);
const REMOVED_QUOTES = [
  'ILL CONTINUE WATCHING TOKYO GHOUL', 'I LIKE RE REQUIEM AND VILLAGE',
  'It was the most dreariest night of October', 'Is this drawing good', 'CHAMMAK CHALLO',
];
for (const rq of REMOVED_QUOTES) check(`removed-card DM absent: ${rq.slice(0, 30)}\u2026`, !decoded.includes(rq));
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
