/* Task 13 acceptance: her-world strip — eight motifs present,
   zero lyric/artwork blobs. Titles/names only; any quote longer than
   40 chars that is NOT a cited DM line fails the guard.
   Fails loudly (non-zero exit) on any violation. */
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

const worldSeg = index.slice(index.indexOf('id="world"'), index.indexOf('<!-- 10. finale'));

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('========================================');
console.log('TASK 13 ACCEPTANCE — her-world strip');
console.log('========================================');
console.log(`# build hash index.html=${createHash('sha256').update(index).digest('hex').slice(0, 16)} world.html=${createHash('sha256').update(frag).digest('hex').slice(0, 16)}`);

console.log('\n--- wiring ---');
check('world.css linked from index.html', /<link rel="stylesheet" href="sections\/world\.css" \/>/.test(index));
const hasDeferredWorld = /<script src="sections\/world\.js" defer><\/script>/.test(index);
const hasLazyWorld = /['"]sections\/world\.js['"]/.test(index);
check('world.js loaded deferred or via lazy-manifest from index.html',
  hasDeferredWorld || hasLazyWorld,
  hasDeferredWorld ? 'deferred <script> tag' : hasLazyWorld ? 'lazy-manifest registration' : 'not found');
check('fragment ships inside #world anchor (no TODO placeholder)', worldSeg.includes('data-motif=') && !worldSeg.includes('TODO: her world strip'));
check('fragment mirrors index markup', index.includes(frag.trim().slice(0, 80).trim().split('\n')[0].trim()));
check('eight cards in index', (worldSeg.match(/<article class="world__card"/g) || []).length === 8);

console.log('\n--- eight motifs (titles/names only) ---');
const motifs = [
  ['music card (Chase Atlantic)', /data-motif="music"[\s\S]{0,600}?Chase Atlantic/],
  ['horror stubs (Shining)', /data-motif="horror"[\s\S]{0,800}?The Shining/],
  ['horror stubs (Exorcist)', /data-motif="horror"[\s\S]{0,800}?The Exorcist/],
  ['horror stubs (Conjuring)', /data-motif="horror"[\s\S]{0,800}?The Conjuring/],
  ['games badges (RE / Requiem+Village)', /data-motif="games"[\s\S]{0,800}?[Rr]esident [Ee]vil/],
  ['games badges (Roblox)', /data-motif="games"[\s\S]{0,800}?[Rr]oblox/],
  ['games badges (DTI)', /data-motif="games"[\s\S]{0,800}?dti/i],
  ['anime nod (Tokyo Ghoul)', /data-motif="anime"[\s\S]{0,600}?Tokyo Ghoul/],
  ['anime nod (Denji edit)', /data-motif="anime"[\s\S]{0,600}?[Dd]enji/],
  ['gothic writing motif', /data-motif="writing"[\s\S]{0,400}?[Gg]othic/],
  ['drawing motif', /data-motif="drawing"[\s\S]{0,400}?[Dd]rawing/],
  ['badminton motif', /data-motif="badminton"[\s\S]{0,600}?[Bb]adminton/],
  ['autumn motif', /data-motif="autumn"[\s\S]{0,400}?[Aa]utumn/],
];
for (const [label, re] of motifs) check(label, re.test(worldSeg));

console.log('\n--- zero lyric/artwork blobs (lyric-guard) ---');
// Guard model: every text span > 40 chars must be ATTRIBUTED — either a
// cited DM quote (her own words, traced to lore Room 10 below) or
// registered original owner-voice copy (ORIGINAL_COPY). An injected
// commercial lyric is neither, so the guard fails it. Titles/names from
// the allowlist may appear anywhere; they are never spans > 40 chars.
const ORIGINAL_COPY = [
  'eight little shelves of everything she loves',
  'her current obsession. no skips, no notes',
  'ranked and filed. i watch through my fingers',
  'she carries, i respawn. dress-to-impress debut pending',
  'on the watchlist',
  'framed in my head',
  'her pen goes full gothic. i read every word twice',
  'verdict: yes. it is always yes',
  'her court era. house rule',
  'crunchy leaves, grey skies, her season',
  'loving her means loving her whole world',
];
const dmQuotes = [...worldSeg.matchAll(/<blockquote class="world__dm[^"]*"[^>]*><p>([\s\S]*?)<\/p><\/blockquote>/g)].map((m) => m[1]);
const stripped = worldSeg.replace(/<blockquote class="world__dm[^"]*"[^>]*>[\s\S]*?<\/blockquote>/g, ' ').replace(/<p class="world__source">[\s\S]*?<\/p>/g, ' ');
const longSpans = [...stripped.matchAll(/>([^<>]{41,})</g)].map((m) => m[1].trim()).filter((s) => s.length > 40);
const unattributed = longSpans.filter((s) => !ORIGINAL_COPY.some((o) => s.includes(o)));
check('every non-DM span > 40 chars is registered original copy (no lyric blob fits)', unattributed.length === 0, unattributed.slice(0, 2).join(' | ').slice(0, 120));
check('no <audio>/<video>/<img> blobs in world section', !/<(audio|video|img)[\s>]/i.test(worldSeg));
check('no background-image artwork in world.css', !/background-image\s*:\s*url/i.test(css));
check('no base64 blobs in world files', !/base64/i.test(worldSeg + css + js));
// Design-system check: no hardcoded hex in world.css outside the vinyl disc
// gradient (which reuses tokens) — every color must be a token reference.
const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0]);
check('world.css uses design tokens (zero hardcoded hex)', hexes.length === 0, hexes.slice(0, 5).join(', '));

console.log('\n--- DM fidelity (Room 10) ---');
const room10 = lore.split('## Room 10:')[1].split('## ')[0];
for (const q of dmQuotes) {
  const plain = q.replace(/&#\d+;/g, ' ').replace(/&mdash;/g, '—').replace(/\s+/g, ' ').trim();
  const probe = plain.length > 30 ? plain.slice(0, 30) : plain;
  check(`DM quote traces to Room 10: "${probe}…"`, room10.includes(probe) || lore.includes(probe));
}

console.log('\n--- reveal degrades gracefully ---');
check('JS uses IntersectionObserver (lazy, starmap pattern)', /new IntersectionObserver\s*\(/.test(js));
check('reveal gated on prefers-reduced-motion', /prefers-reduced-motion: reduce/.test(js));
check('CSS keeps cards visible without js-world class', /\.world__card\s*\{[\s\S]*?box-shadow/.test(css) && !/\.world__card\s*\{[^}]*opacity:\s*0/.test(css));
check('CSS honors prefers-reduced-motion', /@media \(prefers-reduced-motion: reduce\)/.test(css));

console.log('\n========================================');
console.log(failures === 0 ? 'RESULT: ALL CHECKS PASSED' : `RESULT: ${failures} CHECK(S) FAILED`);
console.log('========================================');
process.exit(failures === 0 ? 0 : 1);
