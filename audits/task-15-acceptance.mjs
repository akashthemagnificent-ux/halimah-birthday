/* Task 15 acceptance: physics playground — lazy-load + weight budget (<150KB)
   or static fallback; names rendered from the lore pack (no hardcode drift).
   Fails loudly (non-zero exit) on any violation.

   Checks:
   1. vendor/matter.min.js present and raw bytes < 150KB.
   2. matter-js is NOT referenced by a <script>/<link> in index.html (lazy:
      not render-blocking, not in the critical path). It is fetched at runtime
      by sections/physics.js only after a user tap.
   3. sections/physics.js: 150KB budget constant + a runtime byte-size check
      before executing the lib, reduced-motion -> static branch, and it reads
      names from content/physics-names.json (the single source of truth).
   4. content/physics-names.json holds exactly the canonical name set; every
      'attested' name appears (case-insensitive word match) in its cited local
      source file; 'plan'-sourced names carry a plan citation and no false claim
      of local attestation.
   5. No hardcoded pet-name drift: none of the canonical names appear in the
      section markup/JS or in the physics region of index.html (they must be
      rendered from the JSON at runtime). */
import fs from 'fs';
import path from 'path';

const ROOT = '/home/vibex/halimah-birthday';
const INDEX = path.join(ROOT, 'index.html');
const LIB = path.join(ROOT, 'vendor/matter.min.js');
const JS = path.join(ROOT, 'sections/physics.js');
const HTML = path.join(ROOT, 'sections/physics.html');
const CSS = path.join(ROOT, 'sections/physics.css');
const NAMES = path.join(ROOT, 'content/physics-names.json');

const BUDGET_BYTES = 150 * 1024;
const CANONICAL = ['Zai', 'Halimah', 'princess', 'Ash', 'hubby'];

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

// 1. Library presence + budget.
const libOk = fs.existsSync(LIB);
const libBytes = libOk ? fs.statSync(LIB).size : Infinity;
check('matter.min.js vendored locally', libOk);
check('matter.min.js raw bytes < 150KB budget', libBytes < BUDGET_BYTES, `${libBytes} B`);

// 2. Lazy: not referenced by a blocking tag in index.html.
const index = fs.readFileSync(INDEX, 'utf8');
check(
  'index.html does not load matter.min.js via <script>/<link> (lazy, not critical path)',
  !/<(script|link)[^>]*matter\.min\.js/i.test(index)
);
check('index.html links sections/physics.css', index.includes('sections/physics.css'));
// Section JS (including physics.js) is loaded by the site's IntersectionObserver
// lazy-loader manifest, NOT a static <script> tag — so it is off the critical path.
check(
  'physics.js is registered in the LAZY_SECTIONS manifest (loader-lazy)',
  /['"]physics['"]\s*:\s*\[[^\]]*sections\/physics\.js/.test(index)
);
check('index.html contains the physics section anchor', index.includes('id="physics"'));

// 3. Runtime budget guard + reduced-motion fallback in the section JS.
const js = fs.readFileSync(JS, 'utf8');
check('physics.js declares a 150KB budget constant', /BUDGET_BYTES\s*=\s*150\s*\*\s*1024/.test(js));
check('physics.js size-checks the lib before executing it', /arrayBuffer\(\)/.test(js) && /byteLength\s*>=\s*BUDGET_BYTES/.test(js));
check('physics.js honors prefers-reduced-motion', /prefers-reduced-motion/.test(js) && /initStatic/.test(js));
check('physics.js reads names from content/physics-names.json', js.includes('content/physics-names.json'));

// 4. Names data: exact canonical set; attestations real; plan-sourced honest.
const namesRaw = fs.readFileSync(NAMES, 'utf8');
const data = JSON.parse(namesRaw);
const hearts = data.hearts || [];
const names = hearts.map((h) => h.name);
check(
  'physics-names.json holds exactly the canonical name set',
  names.length === CANONICAL.length && CANONICAL.every((n) => names.includes(n)),
  JSON.stringify(names)
);

for (const h of hearts) {
  if (h.source === 'attested') {
    // The citation names at least one local content file; the name must occur
    // there as a whole word (case-insensitive).
    const cited = h.citation || '';
    const localFiles = Array.from(new Set(
      (cited.match(/(?:content|sections)\/[A-Za-z0-9_.-]+|index\.html/g) || [])
    ));
    let found = false;
    for (const rel of localFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const text = fs.readFileSync(abs, 'utf8');
      // Match the name itself, or its declared attested form (e.g. the short
      // name 'Ash' is attested through the full name 'Akash').
      const forms = [h.name, h.attest_as].filter(Boolean);
      if (forms.some((f) => new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))) {
        found = true;
        break;
      }
    }
    check(`attested name "${h.name}" found in a cited local source`, found, localFiles.join(','));
  } else if (h.source === 'plan') {
    check(`plan-sourced name "${h.name}" cites the plan and does not claim local attestation`,
      /plans\/halimah-birthday-site\.md/.test(h.citation || '') && /not vendored/i.test(h.citation || ''));
  } else {
    check(`name "${h.name}" has a recognized source`, false, `source=${h.source}`);
  }
}

// 5. No hardcoded-name drift in the section sources or the index physics region.
const physicsStart = index.indexOf('<!-- 5b. physics');
const physicsEnd = index.indexOf('<!-- 6. scratch');
const indexPhysics = physicsStart >= 0 && physicsEnd > physicsStart
  ? index.slice(physicsStart, physicsEnd)
  : '';
const frag = fs.readFileSync(HTML, 'utf8');
const css = fs.readFileSync(CSS, 'utf8');
for (const n of CANONICAL) {
  const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  check(`name "${n}" is NOT hardcoded in physics.js`, !re.test(js));
  check(`name "${n}" is NOT hardcoded in physics.html`, !re.test(frag));
  check(`name "${n}" is NOT hardcoded in the index physics region`, !indexPhysics || !re.test(indexPhysics));
}
// Also guard: none of the canonical names appear anywhere in the section CSS.
check('no canonical name hardcoded in physics.css', !CANONICAL.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(css)));

console.log('');
console.log(failures === 0 ? 'RESULT: PASS (0 failures)' : `RESULT: FAIL (${failures} failures)`);
process.exit(failures === 0 ? 0 : 1);
