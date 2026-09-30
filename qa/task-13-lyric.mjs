// Failure QA for todo 13 (her-world strip): prove the lyric-guard trips.
// Injects a simulated unattributed lyric blob (>40 chars, NOT registered
// original copy, NOT a cited DM line) into a copy of the world section and
// runs the same guard the acceptance script uses. Expected outcome: the
// guard FAILS on the injected tree (exit path logs FAIL), so this script
// exits 0 — the guard did its job. A synthetic stand-in is used on purpose:
// no real commercial lyric is reproduced anywhere.
//
// Evidence: .omo/evidence/halimah-birthday-site/task-13-lyric.log
// Adversarial coverage: stale_state (build hash logged from disk bytes);
// misleading-success-output (guard reads the injected string, not a stub).
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

const ROOT = '/home/vibex/halimah-birthday';
const INDEX = path.join(ROOT, 'index.html');
const OUT = '/home/vibex/.omo/evidence/halimah-birthday-site/task-13-lyric.log';

const log = [];
const say = (s = '') => { log.push(s); console.log(s); };

const index = fs.readFileSync(INDEX, 'utf8');
say('# task-13 lyric-guard failure QA');
say(`# build hash index.html=${createHash('sha256').update(index).digest('hex').slice(0, 16)} (bytes read from disk this run)`);

const worldSeg = index.slice(index.indexOf('id="world"'), index.indexOf('<!-- 10. finale'));

// Simulated injected commercial-lyric blob: 60+ chars, unattributed.
const INJECTED = 'simulated injected lyric blob that must trip the forty character guard line';
say(`# injected blob (${INJECTED.length} chars): "${INJECTED}"`);

const tampered = worldSeg.replace(
  '<p class="world__closer">',
  `<p class="world__note">${INJECTED}</p><p class="world__closer">`
);

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
const stripped = tampered
  .replace(/<blockquote class="world__dm[^"]*"[^>]*>[\s\S]*?<\/blockquote>/g, ' ')
  .replace(/<p class="world__source">[\s\S]*?<\/p>/g, ' ');
const longSpans = [...stripped.matchAll(/>([^<>]{41,})</g)].map((m) => m[1].trim()).filter((s) => s.length > 40);
const unattributed = longSpans.filter((s) => !ORIGINAL_COPY.some((o) => s.includes(o)));

const guardFailed = unattributed.length > 0;
say(`# long spans found: ${longSpans.length}, unattributed: ${unattributed.length}`);
say(`# guard verdict on tampered tree: ${guardFailed ? 'FAIL (expected — injected lyric caught)' : 'PASS (UNEXPECTED — guard missed the injection!)'}`);
say(guardFailed ? 'RESULT: GUARD CORRECTLY REJECTED THE INJECTED LYRIC' : 'RESULT: GUARD BYPASSED — FIX REQUIRED');

fs.writeFileSync(OUT, log.join('\n') + '\n');
console.log(`# log written: ${OUT}`);
process.exit(guardFailed ? 0 : 1);
