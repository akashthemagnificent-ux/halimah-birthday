// Task-9 acceptance: 4 gag cards, each with gag lines + affection closer;
// no photoreal spider assets; tokens-only CSS; 44px targets; reduced-motion.
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';

const base = '/home/vibex/halimah-birthday';
const idx = readFileSync(`${base}/index.html`, 'utf8');
const css = readFileSync(`${base}/sections/gags.css`, 'utf8');
const js = readFileSync(`${base}/sections/gags.js`, 'utf8');

const cards = [...idx.matchAll(/<article class="gags__card"[\s\S]*?<\/article>/g)].map((m) => m[0]);
assert.strictEqual(cards.length, 4, `expected 4 gag cards, got ${cards.length}`);

for (const key of ['buddy', 'goodboy', 'hashbrown', 'spider']) {
  const card = cards.find((c) => c.includes(`data-gags-card="${key}"`));
  assert.ok(card, `missing card ${key}`);
  assert.match(card, /<blockquote[^>]*>[\s\S]+?<\/blockquote>/, `${key}: missing gag <blockquote>`);
  assert.match(card, /dms-\d+\.txt:\d+/, `${key}: missing DM source citation`);
  assert.match(card, /gags__closer[^>]*>[\s\S]*?affection closer[\s\S]*?\S[\s\S]*?<\/p>/, `${key}: missing affection closer`);
}

// No photoreal spider assets anywhere near the room.
const gagsScope = idx.slice(idx.indexOf('id="gags"'), idx.indexOf('id="scratch"'));
assert.ok(!/\.(jpg|jpeg|png|webp|gif|avif)\b/i.test(gagsScope), 'photo asset referenced in gags scope');
const sectionFiles = readdirSync(`${base}/sections`).filter((f) => f.startsWith('gag'));
assert.deepStrictEqual(sectionFiles.sort(), ['gags.css', 'gags.html', 'gags.js'].sort(), `unexpected gag files: ${sectionFiles}`);
const spiderImgs = readdirSync(`${base}/assets`, { recursive: true }).filter((f) => /spider/i.test(String(f)));
assert.strictEqual(spiderImgs.length, 0, `spider asset committed: ${spiderImgs}`);
assert.ok(/<svg[^>]*data-testid="gag-spider-svg"/.test(gagsScope), 'cute spider SVG missing');

// Design-system discipline: no hardcoded colors; 44px target; reduced motion.
assert.ok(!/#[0-9a-fA-F]{3,8}/.test(css), 'hardcoded hex in gags.css (use tokens)');
assert.ok(/\.gags__spider-btn[\s\S]*?min-height:\s*var\(--tap-min\)/.test(css), 'boop button missing --tap-min');
assert.ok(/prefers-reduced-motion/.test(css), 'gags.css missing reduced-motion gate');
assert.ok(/prefersReducedMotion/.test(js), 'gags.js missing reduced-motion guard');
assert.ok(/IntersectionObserver/.test(js), 'gags.js missing lazy reveal');

// Wiring + placeholder removal.
assert.ok(idx.includes('sections/gags.css'), 'gags.css not wired');
assert.ok(idx.includes('sections/gags.js'), 'gags.js not wired');
assert.ok(!idx.includes('TODO: gag locker'), 'gags placeholder still present');

console.log('PASS task-9: 4 cards each with gag lines + affection closer; SVG-only spider; tokens clean');
