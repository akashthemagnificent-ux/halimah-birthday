#!/usr/bin/env node
/**
 * Verbatim chapter-text diff harness (work-plan todo 1).
 *
 * Purpose: make "every word of the story survived the rebuild" a machine-checked
 * fact instead of a promise. It extracts six text fields per chapter from the
 * live #story markup, and either
 *   - compares them against the deck (content/chapters.md), and
 *   - compares them against a pre-rebuild baseline snapshot.
 *
 * Six compared fields per chapter (EXACT, per plan todo 1):
 *   1. quote     - blockquote.story__quote textContent
 *   2. title     - h3.story__title
 *   3. voiceover - p.story__voiceover
 *   4. source    - p.story__source
 *   5. date      - time.story__date text + datetime attribute
 *   6. kicker    - p.story__kicker number (the .story__num span)
 *
 * Normalization applied to BOTH sides, in this order:
 *   1. remove every subtree whose start tag carries aria-hidden="true"
 *   2. replace all remaining tags with a single space (keeps block boundaries)
 *   3. decode HTML entities
 *   4. collapse every whitespace run to one space
 *   5. trim
 *
 * Step 1 is load-bearing: it is what keeps the aria-hidden pull-quote repeats
 * (p.story__pull) and the kicker " / 14" counter out of the diff by
 * construction, so a presentation-only rebuild stays green by design.
 * Step 5 is what makes dropping the two empty <p></p> textContent-neutral.
 *
 * Node stdlib only. No dependencies, no network.
 *
 * Usage:
 *   node audits/diff-story-text.mjs
 *       Validate the live tree. Writes the baseline snapshot if none exists,
 *       otherwise compares the live tree against it. Exit 0 = verbatim.
 *
 *   node audits/diff-story-text.mjs --write-baseline
 *       Force (re)write the baseline snapshot from the live tree.
 *
 *   node audits/diff-story-text.mjs --html <path>
 *       Read chapter markup from <path> instead of index.html. Used by the
 *       tamper test so a scratch copy can be corrupted without ever touching
 *       the real file.
 *
 *   node audits/diff-story-text.mjs --deck <path>
 *       Read the source deck from <path> instead of content/chapters.md.
 *
 *   node audits/diff-story-text.mjs --baseline <path>
 *       Snapshot path (default .omo/evidence/.../baseline-chapter-text.json).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = '/home/vibex/halimah-birthday';
const DEFAULT_HTML = `${BASE}/index.html`;
const DEFAULT_DECK = `${BASE}/content/chapters.md`;
const DEFAULT_BASELINE =
  '/home/vibex/.omo/evidence/halimah-story-rebuild/baseline-chapter-text.json';

const FIELDS = ['quote', 'title', 'voiceover', 'source', 'date', 'kicker'];

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {
    html: DEFAULT_HTML,
    deck: DEFAULT_DECK,
    baseline: DEFAULT_BASELINE,
    writeBaseline: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--html') out.html = argv[++i];
    else if (a === '--deck') out.deck = argv[++i];
    else if (a === '--baseline') out.baseline = argv[++i];
    else if (a === '--write-baseline') out.writeBaseline = true;
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// HTML entity decoding
// ---------------------------------------------------------------------------
const NAMED_ENTITIES = new Map(
  Object.entries({
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: '\u00a0',
    ndash: '\u2013',
    mdash: '\u2014',
    hellip: '\u2026',
    lsquo: '\u2018',
    rsquo: '\u2019',
    ldquo: '\u201c',
    rdquo: '\u201d',
    middot: '\u00b7',
    bull: '\u2022',
    copy: '\u00a9',
    reg: '\u00ae',
    trade: '\u2122',
    deg: '\u00b0',
    times: '\u00d7',
    laquo: '\u00ab',
    raquo: '\u00bb',
    eacute: '\u00e9',
    egrave: '\u00e8',
    agrave: '\u00e0',
    ccedil: '\u00e7',
    ntilde: '\u00f1',
    uuml: '\u00fc',
    ouml: '\u00f6',
    auml: '\u00e4',
    szlig: '\u00df',
  }),
);

function fromCodePoint(cp) {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return null;
  if (cp >= 0xd800 && cp <= 0xdfff) return null; // lone surrogate
  return String.fromCodePoint(cp);
}

function decodeEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === '#') {
      const cp =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      const decoded = fromCodePoint(cp);
      return decoded === null ? whole : decoded;
    }
    const named = NAMED_ENTITIES.get(body);
    return named === undefined ? whole : named;
  });
}

// ---------------------------------------------------------------------------
// aria-hidden subtree removal
// ---------------------------------------------------------------------------
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*?)(\/?)>/g;

const ARIA_HIDDEN_RE = /\baria-hidden\s*=\s*("|')true\1/i;

function stripAriaHidden(html) {
  let out = '';
  let skipTag = null;
  let skipDepth = 0;
  let last = 0;
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(html)) !== null) {
    const [whole, slash, rawName, attrs, selfClose] = m;
    const name = rawName.toLowerCase();

    if (skipTag !== null) {
      if (name === skipTag) {
        if (slash === '/') {
          skipDepth -= 1;
          if (skipDepth === 0) {
            skipTag = null;
            last = TAG_RE.lastIndex; // drop everything up to and including the closer
          }
        } else if (selfClose !== '/' && !VOID_TAGS.has(name)) {
          skipDepth += 1; // nested same-name element inside the hidden subtree
        }
      }
      continue;
    }

    if (slash === '/' || selfClose === '/' || VOID_TAGS.has(name)) {
      out += html.slice(last, TAG_RE.lastIndex);
      last = TAG_RE.lastIndex;
      continue;
    }

    if (ARIA_HIDDEN_RE.test(attrs)) {
      out += html.slice(last, m.index); // keep the text before the hidden element
      last = m.index;
      skipTag = name;
      skipDepth = 1;
      continue;
    }

    out += html.slice(last, TAG_RE.lastIndex);
    last = TAG_RE.lastIndex;
  }
  if (skipTag !== null) {
    // Unbalanced hidden element: everything after the opener is hidden too.
    return out;
  }
  out += html.slice(last);
  return out;
}

// ---------------------------------------------------------------------------
// text extraction + normalization
// ---------------------------------------------------------------------------
function toText(htmlFragment) {
  const withoutHidden = stripAriaHidden(htmlFragment);
  const withoutTags = withoutHidden.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

/* Provenance citations were dropped from the site copy by owner decree; the
   source field still compares as the human label ("from our chats"), with
   any dms-*.txt:n citation removed identically on every side. */
function stripCites(s) {
  return s.replace(/\s*(?:\u00b7\s*)?(?:halimah\s+)?dms[-\w]*\.txt:\s*[\d,\s-]+/gi, '').trim();
}

function innerOf(block, tagRe) {
  const m = block.match(tagRe);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// HTML side: index.html -> { chapter-N: { six fields } }
// ---------------------------------------------------------------------------
function extractArticles(html) {
  const re =
    /<article\b[^>]*\bid="(chapter-\d+)"[^>]*>([\s\S]*?)<\/article>/g;
  const out = {};
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    const block = m[2];

    const quote = innerOf(block, /<blockquote class="story__quote"[^>]*>([\s\S]*?)<\/blockquote>/);
    const title = innerOf(block, /<h3 class="story__title"[^>]*>([\s\S]*?)<\/h3>/);
    const voiceover = innerOf(block, /<p class="story__voiceover"[^>]*>([\s\S]*?)<\/p>/);
    const source = innerOf(block, /<p class="story__source"[^>]*>([\s\S]*?)<\/p>/);
    const timeM = block.match(
      /<time class="story__date"([^>]*)>([\s\S]*?)<\/time>/,
    );
    const kickerM = block.match(
      /<p class="story__kicker"[^>]*>[\s\S]*?<span class="story__num"[^>]*>([\s\S]*?)<\/span>/,
    );

    out[id] = {
      quote: quote === null ? null : toText(quote),
      title: title === null ? null : toText(title),
      voiceover: voiceover === null ? null : toText(voiceover),
      source: source === null ? null : stripCites(toText(source)),
      date:
        timeM === null
          ? null
          : { text: toText(timeM[2]), datetime: (timeM[1].match(/datetime="([^"]*)"/) || [, ''])[1] },
      kicker: kickerM === null ? null : toText(kickerM[1]),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Deck side: content/chapters.md -> { chapter-N: { six fields } }
// mirrors audits/gen-story.py:19-37 parse rules
// ---------------------------------------------------------------------------
const MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function extractDeck(md) {
  const parts = md.split(/^##\s+/m).slice(1);
  const chapters = parts.filter((p) => !p.trimStart().toLowerCase().startsWith('notes'));

  const out = {};
  chapters.forEach((part, i) => {
    const lines = part.split('\n');
    const head = lines[0].trim();
    const num = head.split(',')[0].trim();
    const title = head.slice(head.indexOf(',') + 1).trim();

    const dm = part.match(/\*\*Date:\*\*\s*(.+)/);
    const dateDisp = dm ? dm[1].trim() : '';
    const isoM = dateDisp.match(/^(\d{2}) (\w{3}) (\d{4})$/);
    const iso = isoM ? `${isoM[3]}-${MONTHS[isoM[2]]}-${isoM[1]}` : '';

    const sm = part.match(/\*\*Source:\*\*\s*`(.+?)`/);
    const src = sm ? sm[1] : '';

    // gen-story.py: [q[2:] if q.startswith('> ') else q[1:]]
    const quotes = part
      .split('\n')
      .filter((l) => l.startsWith('>'))
      .map((l) => (l.startsWith('> ') ? l.slice(2) : l.slice(1)));

    const vm = part.match(/^\*(.+)\*\s*$/m);
    const voice = vm ? vm[1].trim() : '';

    out[`chapter-${i + 1}`] = {
      quote: toText(quotes.join('\n')),
      title: toText(title),
      voiceover: toText(voice),
      source: stripCites(toText(`from our chats \u00b7 ${src}`)),
      date: { text: toText(dateDisp), datetime: iso },
      kicker: toText(num),
    };
  });
  return out;
}

// ---------------------------------------------------------------------------
// comparison
// ---------------------------------------------------------------------------
const IDS = Array.from({ length: 14 }, (_, i) => `chapter-${i + 1}`);

function fieldEqual(a, b) {
  if (typeof a === 'object' && a !== null) {
    return Object.keys(a).every((k) => a[k] === b?.[k]);
  }
  return a === b;
}

function diffSets(label, live, expected, errors) {
  for (const id of IDS) {
    const l = live[id];
    const e = expected[id];
    if (!l) {
      errors.push(`${label}: ${id} missing from index.html`);
      continue;
    }
    if (!e) {
      errors.push(`${label}: ${id} missing from ${label.split(' ')[0]} source`);
      continue;
    }
    for (const f of FIELDS) {
      if (!fieldEqual(l[f], e[f])) {
        errors.push(
          `${label}: ${id}.${f}\n    live: ${JSON.stringify(l[f])}\n    ref : ${JSON.stringify(e[f])}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2));
const errors = [];

const live = extractArticles(readFileSync(args.html, 'utf8'));
const deck = extractDeck(readFileSync(args.deck, 'utf8'));

if (Object.keys(live).length !== 14) {
  errors.push(`index.html must render 14 articles, found ${Object.keys(live).length}`);
}

// 1. the rendered markup must still equal the source deck
diffSets('vs deck', live, deck, errors);

// 2. the rendered markup must still equal the pre-rebuild baseline
let baselineExisted = false;
let baseline = null;
if (args.writeBaseline) {
  baseline = live;
} else if (existsSync(args.baseline)) {
  baselineExisted = true;
  baseline = JSON.parse(readFileSync(args.baseline, 'utf8'));
  for (const ch of Object.values(baseline)) {
    if (ch && typeof ch.source === 'string') ch.source = stripCites(ch.source);
  }
  diffSets('vs baseline', live, baseline, errors);
} else {
  baseline = live;
}

const wroteBaseline = !baselineExisted || args.writeBaseline;
if (wroteBaseline) {
  mkdirSync(dirname(args.baseline), { recursive: true });
  writeFileSync(args.baseline, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
}

if (errors.length > 0) {
  console.error(`FAIL diff-story-text: ${errors.length} mismatch(es)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const mode = wroteBaseline ? 'baseline written' : 'baseline compared';
console.log(
  `PASS diff-story-text: 14/14 chapters verbatim ` +
    `(html vs deck = 0 diffs, ${mode})`,
);
console.log(`  html      : ${args.html}`);
console.log(`  deck      : ${args.deck}`);
console.log(`  baseline  : ${args.baseline}${wroteBaseline ? ' (written)' : ''}`);
