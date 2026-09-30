/* Task 20 sweep: local link + media integrity scan.
 *
 * Every local src/href/url() referenced by the shipped markup, CSS, and JS
 * must resolve to a file that exists on disk. The six owner photo slots are
 * probed at runtime and 404 by design while assets/photos/ is empty, so they
 * are reported as KNOWN-OPTIONAL, never as a break. Any other unresolved local
 * reference is a red.
 *
 * Also proves the media inventory: no remote URLs, no stray absolute paths.
 *
 * Usage: bun audits/task-20-links.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '..', '.omo', 'evidence', 'halimah-birthday-site', 'task-20-links.log');

const log = [];
const say = (s = '') => { log.push(s); console.log(s); };
let failures = 0;
const assert = (cond, label, detail = '') => {
  if (!cond) failures += 1;
  say(`[${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ' :: ' + detail : ''}`);
};

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = await walk(ROOT);
// Only SHIPPED site files are in scope. The audit/qa/script tooling and the
// vendored libraries legitimately reference the DM source directory and regex
// fragments; they are not part of what the visitor's browser resolves.
const SHIPPED = /^(index\.html|tokens\.css)$/;
const SHIPPED_DIR = /^(js|sections)\//;
const sourceFiles = files.filter((f) => {
  const rel = relative(ROOT, f);
  return !rel.startsWith('vendor/') && (SHIPPED.test(rel) || SHIPPED_DIR.test(rel));
});

// Files that reference assets are parsed for local references.
const ATTR_RE = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
const CSS_URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
const JS_PATH_RE = /["']((?:assets|vendor|content|js|sections)\/[A-Za-z0-9._\/-]+)["']/g;
// The album's six owner photo slots are declared as data-photo, not src.
const PHOTO_SLOT_RE = /data-photo\s*=\s*["']([^"']+)["']/gi;

const refs = new Map(); // ref -> Set(referrers)
const addRef = (ref, file) => {
  if (!refs.has(ref)) refs.set(ref, new Set());
  refs.get(ref).add(relative(ROOT, file));
};

for (const file of sourceFiles) {
  const text = await readFile(file, 'utf8');
  const isHtml = file.endsWith('.html');
  const isCss = file.endsWith('.css');
  for (const m of text.matchAll(ATTR_RE)) addRef(m[1], file);
  if (isCss || isHtml) for (const m of text.matchAll(CSS_URL_RE)) addRef(m[1], file);
  if (file.endsWith('.js') || file.endsWith('.mjs')) {
    for (const m of text.matchAll(JS_PATH_RE)) addRef(m[1], file);
  }
  if (isHtml) for (const m of text.matchAll(PHOTO_SLOT_RE)) addRef(m[1], file);
}

const isExternal = (ref) => /^(https?:)?\/\//.test(ref) || /^(mailto:|tel:|data:|#|javascript:)/i.test(ref);
const isPhotoSlot = (ref) => /^assets\/photos\/photo-\d+\.jpg$/.test(ref);
// Google Fonts is the one sanctioned remote dependency; scripts/budget.mjs
// already caps it at 2 families. Anything else remote is a red.
const isAllowedRemote = (ref) => /fonts\.(googleapis|gstatic)\.com/.test(ref);

let checked = 0, resolved = 0;
const knownOptional = [];
const broken = [];
const external = new Set();
const fragments = new Set();

for (const [ref, referrers] of refs) {
  if (!ref || isExternal(ref)) {
    if (isExternal(ref) && !/^(#|mailto:|tel:|data:|javascript:)/i.test(ref) && !isAllowedRemote(ref)) {
      external.add(ref);
    }
    if (ref.startsWith('#')) fragments.add(ref);
    continue;
  }
  if (isPhotoSlot(ref)) { knownOptional.push(`${ref} <- ${[...referrers].join(', ')}`); continue; }
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) { fragments.add(ref); continue; }
  checked += 1;
  const abs = join(ROOT, clean);
  if (existsSync(abs)) {
    const s = await stat(abs);
    if (s.size === 0) broken.push(`${ref} (exists but is 0 bytes)`);
    else resolved += 1;
  } else {
    broken.push(`${ref} <- ${[...referrers].join(', ')}`);
  }
}

say(`# task-20 local link + media scan`);
say(`# root: ${ROOT}`);
say(`# source files scanned: ${sourceFiles.length}`);
say(`# local refs checked: ${checked}`);
say(`# resolved: ${resolved}`);
say(`# known-optional owner photo slots (404 by design while empty): ${knownOptional.length}`);
for (const k of knownOptional) say(`  - optional: ${k}`);
say(`# external http(s) refs: ${[...external].join(', ') || 'none'}`);
say(`# in-page fragments: ${fragments.size}`);

assert(broken.length === 0, 'every local src/href/url() resolves on disk', broken.join(' | '));
assert(knownOptional.length === 6, 'exactly 6 owner photo slots are the known-optional set', `found ${knownOptional.length}`);
assert(external.size === 0, 'no remote asset URLs besides Google Fonts', [...external].join(' | '));
assert(checked > 0, 'scan actually checked local refs (not a vacuous pass)', `checked=${checked}`);

say(`# RESULT: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
await (await import('node:fs/promises')).writeFile(OUT, log.join('\n') + '\n');
process.exit(failures === 0 ? 0 : 1);
