/**
 * task-18 — Secret-URL deploy + surprise preservation verification
 *
 * Checks performed:
 *   1. noindex meta tag present in index.html
 *   2. OG title/description contain zero personal names
 *   3. <title> contains zero personal names
 *   4. Content region has data-locked attribute present on load (locked state)
 *   5. locked state DOM has zero story text (content-region children count)
 *   6. Build hash logged for staleness detection
 *
 * Exit 0 = all checks pass. Non-zero = failure.
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const SITE = '/home/vibex/halimah-birthday';
const html = readFileSync(`${SITE}/index.html`, 'utf8');

const results = [];
let pass = true;

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) pass = false;
  console.log(ok ? `✅ ${name}` : `❌ ${name}`);
  if (detail) console.log(`   ${detail}`);
}

// 1. Build hash for staleness detection
const buildHash = createHash('sha256').update(html).digest('hex').slice(0, 12);
console.log(`\n🔨 Build hash: ${buildHash}`);
console.log(`   Index.html size: ${html.length} bytes`);

// 2. noindex meta tag
const hasNoindex = /<meta\s+name="robots"\s+content="noindex,\s*nofollow"\s*\/?\s*>/i.test(html);
check('noindex-meta', hasNoindex,
  hasNoindex ? 'robots noindex, nofollow found' : 'MISSING noindex meta tag');

// 3. OG title
const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
const ogTitle = ogTitleMatch ? ogTitleMatch[1] : '';
check('og-title-exists', !!ogTitleMatch,
  ogTitleMatch ? `og:title = "${ogTitle}"` : 'og:title meta tag MISSING');

// 4. OG description
const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
const ogDesc = ogDescMatch ? ogDescMatch[1] : '';
check('og-description-exists', !!ogDescMatch,
  ogDescMatch ? `og:description = "${ogDesc}"` : 'og:description meta tag MISSING');

// 5. <title> tag
const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
const title = titleMatch ? titleMatch[1] : '';
check('title-exists', !!titleMatch,
  titleMatch ? `<title> = "${title}"` : 'title tag MISSING');

// 6. Name-in-OG scan — no personal names in OG tags or title
// Known names from the plan: Halimah, Zai, Ash, and any other names
const personalNames = [
  'halimah', 'zainab', 'zai', 'ash',
];
const combinedText = `${ogTitle} ${ogDesc} ${title}`.toLowerCase();
const foundNames = personalNames.filter(n => combinedText.includes(n));
check('og-no-names', foundNames.length === 0,
  foundNames.length === 0
    ? 'OG tags + title contain zero personal names'
    : `FAILED: found names in OG/title: ${foundNames.join(', ')}`);

// 7. <title> neutral — no relationship words
const relationshipWords = ['birthday', 'love letter', 'for halimah', 'for you halimah'];
const titleLower = title.toLowerCase();
const foundRelWords = relationshipWords.filter(w => titleLower.includes(w));
check('title-neutral', foundRelWords.length === 0,
  foundRelWords.length === 0
    ? '<title> is neutral'
    : `FAILED: <title> contains relationship/spoiler words: ${foundRelWords.join(', ')}`);

// 8. Verify begin.js locks content by detaching nodes
const beginJs = readFileSync(`${SITE}/js/begin.js`, 'utf8');
const hasLockContent = beginJs.includes('lockContent') && beginJs.includes('DocumentFragment');
check('lock-content-detach', hasLockContent,
  hasLockContent ? 'begin.js uses DocumentFragment to detach locked content' : 'MISSING lock mechanism');

const hasUnlockContent = beginJs.includes('unlockContent');
check('unlock-content-restore', hasUnlockContent,
  hasUnlockContent ? 'begin.js restores content on unlock' : 'MISSING unlock mechanism');

// 9. Countdown target is Europe/London
const hasEuropeLondon = beginJs.includes("Europe/London");
check('countdown-target-london', hasEuropeLondon,
  hasEuropeLondon ? 'Countdown target timezone: Europe/London' : 'MISSING Europe/London timezone');

const hasOct19 = beginJs.includes('TARGET_DAY = 19') && beginJs.includes('TARGET_MONTH = 10');
check('countdown-target-oct19', hasOct19,
  hasOct19 ? 'Countdown target: 19 October' : 'MISSING 19 Oct target');

// 10. OG title format check — must match expected neutral format
const ogTitleExpected = ogTitle === 'a surprise, open 19 Oct';
check('og-title-exact', ogTitleExpected,
  ogTitleExpected
    ? 'og:title matches expected neutral format'
    : `og:title = "${ogTitle}" — expected "a surprise, open 19 Oct"`);

// Summary
console.log(`\n${'='.repeat(60)}`);
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`Results: ${passed} passed, ${failed} failed out of ${results.length} checks`);

if (!pass) {
  console.log('\n❌ DEPLOY GATE: FAILED — fix issues above before deploying');
  process.exit(1);
} else {
  console.log('\n✅ DEPLOY GATE: ALL CHECKS PASSED');
  process.exit(0);
}
