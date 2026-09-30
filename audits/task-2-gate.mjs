import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const js = readFileSync(join(root, 'js', 'begin.js'), 'utf8');
const chapters = readFileSync(join(root, 'content', 'chapters.md'), 'utf8');

const results = [];
const check = (name, fn) => {
  try { fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
};

// 1. Countdown target: Europe/London midnight on 2026-10-19 must be declared.
check('countdown target string Europe/London present in begin.js', () => {
  assert.match(js, /TARGET_TIME_ZONE\s*=\s*'Europe\/London'/);
  assert.match(js, /TARGET_YEAR\s*=\s*2026/);
  assert.match(js, /TARGET_MONTH\s*=\s*10/);
  assert.match(js, /TARGET_DAY\s*=\s*19/);
});

check('locked copy in index.html is spoiler-free and names no one', () => {
  const locked = html.slice(0, html.indexOf('<div id="content-region">'));
  const forbidden = [
    'Halimah', 'Zai', 'zai', 'wifey', 'princess', 'hubby', 'Ash',
    '26 Aug', '26/08', 'YES A MILLION TIMES YES', 'Kakegurui',
    'I LOVE YOU', 'hashbrown', 'buddy', 'good boy', 'spider',
  ];
  const hits = forbidden.filter((f) => locked.toLowerCase().includes(f.toLowerCase()));
  assert.deepEqual(hits, [], `locked head leaks: ${hits.join(', ')}`);
});

check('title and OG tags carry no names or story', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  const forbidden = ['Halimah', 'Zai', 'zai', 'wifey', 'princess', 'hubby', '26 Aug'];
  const hits = forbidden.filter((f) => head.toLowerCase().includes(f.toLowerCase()));
  assert.deepEqual(hits, [], `head leaks: ${hits.join(', ')}`);
});

// 2. Audio init only inside the click handler.
check('Howler is constructed only inside the Begin click handler path', () => {
  const howlIndex = js.indexOf('new window.Howl(');
  assert.ok(howlIndex > -1, 'no Howl construction found');

  const clickIndex = js.indexOf("beginButton.addEventListener('click', startExperience)");
  assert.ok(clickIndex > -1, 'no click listener registered');

  // startMusic must contain the Howl construction and the play call.
  const smStart = js.indexOf('function startMusic');
  const smEnd = js.indexOf('function playViaElement');
  const smBody = js.slice(smStart, smEnd);
  assert.ok(smBody.includes('new window.Howl('), 'startMusic does not construct Howl');
  assert.match(smBody, /howl\.play\(\)/, 'startMusic does not call howl.play()');

  // The Howl constructor must exist in exactly one place (startMusic),
  // and startMusic must itself only be *invoked* from click handlers.
  // (Runtime "was it gesture-initiated" is proven in the Playwright QA; here
  // we assert the structural facts: one construction site, and no call to
  // startMusic/howl from a timer, rAF, or load path.)
  const howlCtor = js.indexOf('new window.Howl(');
  const howlCtorBefore = js.slice(0, howlCtor);
  const howlCtorFn = howlCtorBefore.lastIndexOf('function ');
  assert.ok(
    js.slice(howlCtorFn, howlCtorFn + 40).startsWith('function startMusic'),
    'Howl constructor is not inside startMusic'
  );
  assert.equal(
    js.split('new window.Howl(').length - 1, 1,
    'Howl must be constructed in exactly one place'
  );

  // No invocation of the audio starters from a background source: a
  // setTimeout/setInterval/rAF callback must never call startMusic or
  // howl.play. Scan every function body that is passed to a timer/rAF.
  const bgCallback = /(setTimeout|setInterval|requestAnimationFrame)\s*\(\s*function\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/g;
  let m;
  while ((m = bgCallback.exec(js)) !== null) {
    const body = m[2];
    assert.ok(!/startMusic\(\)/.test(body), 'startMusic called from a timer/rAF callback');
    assert.ok(!/howl\.play\(/.test(body), 'howl.play called from a timer/rAF callback');
    assert.ok(!/new window\.Howl\(/.test(body), 'Howl constructed in a timer/rAF callback');
  }

  // startExperience (the Begin click body) must call startMusic.
  const fnStart = js.indexOf('function startExperience');
  const fnEnd = js.indexOf('function boot');
  const body = js.slice(fnStart, fnEnd);
  assert.ok(body.length > 0, 'could not slice startExperience');
  assert.match(body, /startMusic\(\)/, 'startExperience does not call startMusic');

  // toggleMusic (music-control click) must call howl.play() for resume.
  const tmStart = js.indexOf('function toggleMusic');
  const tmEnd = js.indexOf('function tick');
  const tmBody = js.slice(tmStart, tmEnd);
  assert.match(tmBody, /howl\.play\(\)/, 'toggleMusic does not resume via howl.play()');

  // No auto-start: nothing in boot() or the IIFE tail may call startMusic
  // without a gesture. boot() only wires listeners.
  const bootStart = js.indexOf('function boot');
  const bootEnd = js.indexOf('if (document.readyState');
  const bootBody = js.slice(bootStart, bootEnd);
  assert.ok(
    !/startMusic\(\)/.test(bootBody.replace(/addEventListener[^;]+;/g, '')),
    'boot() calls startMusic outside a listener'
  );
});

// Every dom.<name> read must exist as a key in the dom = { ... } literal.
// A bare or misspelled dom key throws only at click time, which is exactly the
// kind of failure a static audit should catch (it shipped once already).
check('every dom.* reference is a declared key of the dom literal', () => {
  const literalStart = js.indexOf('\n    dom = {');
  assert.ok(literalStart > -1, 'dom literal not found');
  const literalEnd = js.indexOf('};', literalStart);
  const literal = js.slice(literalStart, literalEnd);

  const declared = new Set();
  for (const m of literal.matchAll(/^\s{6}([A-Za-z_][A-Za-z0-9_]*):/gm)) declared.add(m[1]);

  const used = new Set();
  for (const m of js.matchAll(/\bdom\.([A-Za-z_][A-Za-z0-9_]*)/g)) used.add(m[1]);

  const undeclared = [...used].filter((k) => !declared.has(k));
  assert.deepEqual(undeclared, [], `undeclared dom keys: ${undeclared.join(', ')}`);
  assert.ok(declared.size >= 14, `dom literal looks too small (${declared.size} keys)`);
});

// No bare (non-dom.) reference to a boot() local may appear OUTSIDE boot().
// boot()'s locals are only in scope there; using one in a handler throws a
// ReferenceError at click time, which is exactly the bug this guards.
check('handlers do not reference boot()-scoped locals', () => {
  const bootStart = js.indexOf('function boot');
  assert.ok(bootStart > -1, 'boot() not found');
  const outside = js.slice(0, bootStart) + js.slice(js.indexOf('if (document.readyState'));

  const locals = [
    'beginOverlay', 'beginButton', 'countdownPanel', 'countdownValue',
    'countdownLabel', 'playFallback', 'playFallbackReason', 'playFallbackButton',
    'musicControl', 'contentRegion', 'lockedFragment',
  ];
  for (const name of locals) {
    const re = new RegExp('(?<![.\\w])' + name + '\\b(?!\\s*:)', 'g');
    for (const m of outside.matchAll(re)) {
      const lineStart = outside.lastIndexOf('\n', m.index) + 1;
      const line = outside.slice(lineStart, outside.indexOf('\n', m.index));
      // Ignore property accesses and object keys like MESSAGES.playFallback: …
      if (/[.\w]/.test(line[m.index - 1] || '')) continue;
      assert.fail(`bare reference to boot()-local "${name}": ${line.trim()}`);
    }
  }
});

check('no autoplay attribute on the audio element', () => {
  const audioTag = html.match(/<audio[^>]*>/);
  assert.ok(audioTag, 'no <audio> element found');
  assert.ok(!/autoplay/.test(audioTag[0]), 'audio element has autoplay');
  assert.match(audioTag[0], /preload="none"/, 'audio should be preload="none"');
});

// 3. Locked state contains none of the spoiler strings.
//    Reproduce the real gate: the content region is detached at boot.
check('locked DOM contains no story or quote text', () => {
  const spoilerQuotes = (chapters.match(/^> .+$/gm) || []).map((l) => l.slice(2).trim());
  assert.ok(spoilerQuotes.length > 0, 'no quotes parsed from chapters.md');

  const start = html.indexOf('<div id="content-region">');
  const end = html.indexOf('</div><!-- /#content-region -->');
  assert.ok(start > -1 && end > start, 'content region markers not found');

  // After lockContent(), contentRegion has zero children.
  const lockedDom = html.slice(0, start) + '<div id="content-region"></div>' + html.slice(end + '</div><!-- /#content-region -->'.length);

  const lowered = lockedDom.toLowerCase();
  const hits = spoilerQuotes.filter((q) => {
    // Normalise whitespace for comparison against rendered text
    const needle = q.replace(/\s+/g, ' ').slice(0, 60).toLowerCase();
    return needle.length > 8 && lowered.replace(/\s+/g, ' ').includes(needle);
  });
  assert.deepEqual(hits.slice(0, 3), [], `locked DOM leaks ${hits.length} quote(s)`);
});

check('star map copy is inside the gated content region', () => {
  const starmapIdx = html.indexOf('id="starmap"');
  const regionStart = html.indexOf('<div id="content-region">');
  const regionEnd = html.indexOf('</div><!-- /#content-region -->');
  assert.ok(starmapIdx > regionStart && starmapIdx < regionEnd, 'starmap is outside the gate');
});

check('begin overlay markup and controls exist', () => {
  assert.match(html, /id="begin-overlay"/);
  assert.match(html, /id="begin-button"/);
  assert.match(html, /id="countdown-panel"/);
  assert.match(html, /id="countdown-value"/);
  assert.match(html, /id="play-fallback"/);
  assert.match(html, /id="play-fallback-button"/);
  assert.match(html, /id="music-control"/);
  assert.match(html, /id="content-region"/);
});

// Every id must appear on exactly one element. Two workers (this gate and the
// music slot) both edit index.html, so a duplicated id is a real risk here — and
// getElementById would silently bind only the first match.
// NOTE: count ids on *elements* only; a grep for id="x" also matches CSS
// selectors, which is what made this look like a duplicate once.
check('no duplicate element ids in index.html', () => {
  const ids = [...html.matchAll(/<[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 20, `expected a full shell of ids, found ${ids.length}`);

  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  const dups = [...counts.entries()].filter(([, n]) => n > 1);

  assert.deepEqual(dups.map(([id]) => id), [], `duplicate ids: ${JSON.stringify(dups)}`);
  assert.equal(counts.get('begin-overlay'), 1, 'exactly one #begin-overlay');
  assert.equal(counts.get('begin-button'), 1, 'exactly one #begin-button');
  assert.equal(counts.get('begin'), 1, 'exactly one #begin section');
  assert.equal(counts.get('content-region'), 1, 'exactly one #content-region');
  assert.equal(counts.get('countdown-panel'), 1, 'exactly one #countdown-panel');
});

check('vendored libraries are referenced locally', () => {
  assert.match(html, /vendor\/confetti\.browser\.min\.js/);
  assert.match(html, /vendor\/howler\.min\.js/);
  assert.ok(!/https?:\/\/[^"']*confetti/.test(html), 'confetti still hotlinked');
  assert.ok(!/https?:\/\/[^"']*howler/.test(html), 'howler still hotlinked');
});

// Report
let failed = 0;
for (const [status, name, msg] of results) {
  if (status === 'FAIL') failed++;
  console.log(`[${status}] ${name}${msg ? ' :: ' + msg : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);