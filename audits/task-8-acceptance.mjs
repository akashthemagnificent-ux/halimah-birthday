import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Task-8 acceptance: threat line verbatim + every card has a date +
// every card line audits verbatim against the DM exports.
const base = '/home/vibex/halimah-birthday';
const idx = readFileSync(`${base}/index.html`, 'utf8');
const DM = '/mnt/c/Users/COMPUTER WORLD/Downloads/halimah dms';

const THREAT = "IF YOU STAY UP ANYMORE I'LL MAKE A FRICKING WEBSITE WITH ALL YOUR QUOTES";
// index.html HTML-escapes the apostrophe
assert.ok(
  idx.includes('IF YOU STAY UP ANYMORE I&#x27;LL MAKE A FRICKING WEBSITE WITH ALL YOUR QUOTES'),
  'threat line not verbatim in index.html quotes headline',
);
assert.ok(
  !/data-threat=/.test(idx),
  'dead citation attribute should stay gone from the quotes headline',
);

// Cards live inside the quotes section only.
const section = idx.match(
  /<section id="quotes"[\s\S]*?<\/section>/
);
assert.ok(section, 'quotes section missing in index.html');
const scope = section[0];
const cards = [...scope.matchAll(/<article class="quote-card[\s\S]*?<\/article>/g)].map((m) => m[0]);
assert.ok(cards.length >= 10, `expected a wall of cards, got ${cards.length}`);

const dmCache = new Map();
const dmLines = (file) => {
  if (!dmCache.has(file)) {
    dmCache.set(file, readFileSync(join(DM, file), 'utf8').split('\n'));
  }
  return dmCache.get(file);
};

const unescape = (s) =>
  s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#183;/g, '·');

let verbatim = 0;
cards.forEach((c, i) => {
  const n = i + 1;
  const time = c.match(/<time class="quote-card__date" datetime="(\d{4}-\d{2}-\d{2})">([^<]+)<\/time>/);
  assert.ok(time, `card ${n} missing <time datetime> date stamp`);
  const src = c.match(/data-source="(halimah dms-\d+\.txt):(\d+)"/);
  assert.ok(src, `card ${n} missing data-source citation`);
  const quote = c.match(/<blockquote class="quote-card__quote">\s*<p>([\s\S]+?)<\/p>/);
  assert.ok(quote, `card ${n} missing <blockquote> quote text`);
  const text = unescape(quote[1]);
  assert.ok(!text.includes('[reactions'), `card ${n} leaks export marker`);
  assert.ok(!text.includes('[attachment'), `card ${n} leaks attachment marker`);

  // Verbatim audit: cited source message must contain the card text exactly.
  const raw = dmLines(src[1])[Number(src[2]) - 1];
  assert.ok(raw !== undefined, `card ${n}: source line ${src[1]}:${src[2]} does not exist`);
  const msg = raw.replace(/^\[[^\]]*\]\s*[^:]+:\s?/, '');
  assert.ok(
    msg.includes(text),
    `card ${n} NOT VERBATIM vs ${src[1]}:${src[2]}\n  card: ${JSON.stringify(text.slice(0, 120))}\n  src:  ${JSON.stringify(msg.slice(0, 120))}`,
  );
  verbatim++;

  // Displayed calendar date must match the source line's UTC date.
  const ts = raw.match(/^\[(\d{4}-\d{2}-\d{2})/);
  assert.ok(ts, `card ${n}: source line has no timestamp`);
  assert.strictEqual(time[1], ts[1], `card ${n} date ${time[1]} != source date ${ts[1]}`);
});

// Threat headline itself must audit verbatim too.
const threatRaw = dmLines('halimah dms-2.txt')[1037 - 1];
assert.ok(
  threatRaw.includes(THREAT),
  `threat line drifted from source:\n  page: ${THREAT}\n  src:  ${threatRaw.slice(0, 160)}`,
);

// Wiring + enhancement-only contract.
assert.ok(idx.includes('sections/quotes.css'), 'quotes.css not wired');
assert.ok(idx.includes('sections/quotes.js'), 'quotes.js not wired');
assert.ok(!idx.includes('TODO: quote wall'), 'quotes placeholder still present');
assert.ok(!/quote-card[^>]*style="[^"]*display:\s*none/.test(scope), 'cards hidden without JS');
assert.ok(!idx.includes('document.write'), 'document.write present');

console.log(`PASS task-8: threat verbatim + ${verbatim}/${cards.length} cards dated + verbatim + wired`);
