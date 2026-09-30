import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const base = '/home/vibex/halimah-birthday';
const idx = readFileSync(`${base}/index.html`, 'utf8');
const deck = readFileSync(`${base}/content/chapters.md`, 'utf8');

const deckCount = deck
  .split(/^## /m)
  .slice(1)
  .filter((p) => !p.trimStart().toLowerCase().startsWith('notes')).length;

const chapters = [...idx.matchAll(/<article class="story__chapter"[\s\S]*?<\/article>/g)].map((m) => m[0]);

assert.strictEqual(deckCount, 14, `deck must hold 14 chapters, got ${deckCount}`);
assert.strictEqual(chapters.length, deckCount, `rendered ${chapters.length} != deck ${deckCount}`);

chapters.forEach((c, i) => {
  assert.match(c, /<time[^>]*datetime="\d{4}-\d{2}-\d{2}"[^>]*>/, `chapter ${i + 1} missing <time datetime>`);
  assert.match(c, /<blockquote class="story__quote">[\s\S]+?<\/blockquote>/, `chapter ${i + 1} missing <blockquote>`);
  assert.match(c, /story__voiceover/, `chapter ${i + 1} missing voiceover`);
  assert.match(c, /story__date/, `chapter ${i + 1} missing date stamp class`);
});

assert.ok(idx.includes('sections/story.css'), 'story.css not wired');
assert.ok(idx.includes('sections/story.js'), 'story.js not wired');
assert.ok(idx.includes('vendor/gsap.min.js'), 'gsap not vendored/wired');
assert.ok(idx.includes('vendor/ScrollTrigger.min.js'), 'ScrollTrigger not wired');
assert.ok(!idx.includes('TODO: story chapters'), 'story placeholder still present');

// GSAP is enhancement-only: no inline critical styles hiding chapters,
// no document.write; chapters are plain HTML readable with JS blocked.
assert.ok(!/story__chapter[^>]*style="[^"]*display:\s*none/.test(idx), 'chapters hidden without JS');
assert.ok(!idx.includes('document.write'), 'document.write present');

console.log(`PASS task-7: ${chapters.length}/${deckCount} chapters, each with <time> + <blockquote> + voiceover`);
