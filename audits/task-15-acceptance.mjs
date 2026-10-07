/* Task 15 acceptance: physics playground — vendored weight budget (<150KB),
   eager vendor stack (owner override: no lazy gating on a personal site),
   static fallback on failure; names rendered from the lore pack (no hardcode
   drift). Fails loudly (non-zero exit) on any violation.

   Checks:
   1. vendor/matter.min.js present and raw bytes < 150KB.
   2. index.html eagerly loads matter.min.js + sections/physics.js via script
      tags (owner override: vendor stack is on the critical path; the section
      still degrades to the static names row if WebGL/Matter fail at tap time).
   3. sections/physics.js: full-motion owner override + static fallback branch,
      and it reads names from content/physics-names.json (single source of truth).
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
const CANONICAL = ['Zai', 'Halimah', 'princess', 'Ash', 'hubby',
  'Cutiepie', 'sweetheart', 'baby', 'wifey'];

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

// 2. Eager vendor stack (owner override: personal site, no lazy gating).
const index = fs.readFileSync(INDEX, 'utf8');
check(
  'index.html eagerly loads matter.min.js via <script> (owner override)',
  /<script[^>]*src="vendor\/matter\.min\.js"/.test(index)
);
check('index.html links sections/physics.css', index.includes('sections/physics.css'));
check(
  'index.html eagerly loads sections/physics.js via <script>',
  /<script[^>]*src="sections\/physics\.js"/.test(index)
);
check('index.html contains the physics section anchor', index.includes('id="physics"'));

// 3. Section JS contract: full-motion owner override + static fallback + data.
const js = fs.readFileSync(JS, 'utf8');
check(
  'physics.js full-motion owner override (prefersReducedMotion -> false)',
  /function prefersReducedMotion\(\)/.test(js) && /return false/.test(js)
);
check(
  'physics.js keeps the static names fallback branch (initStatic)',
  /initStatic/.test(js) && /WebGL unavailable/.test(js)
);
check('physics.js reads names from content/physics-names.json', js.includes('content/physics-names.json'));
check('physics.js steps the sim from wall-clock time (frame-rate independent)',
  /simAcc/.test(js) && /performance\.now\(\)/.test(js));

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
const physicsEnd = index.indexOf('<!-- 7. scratch');
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
