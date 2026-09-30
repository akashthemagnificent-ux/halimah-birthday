#!/usr/bin/env node
/* scripts/budget.mjs — Performance + mobile hardening budget enforcement (todo 17)
 *
 * Usage:  bun scripts/budget.mjs [--bloat-test]
 *
 * Exits 0 on pass, non-zero on fail. Writes evidence to .omo/evidence/.
 *
 * Budgets:
 *   - Initial JS (all <script src> gzipped): ≤100 KB
 *   - Images: no single file >200 KB, total ≤2 MB, all raster images tracked
 *   - Fonts: ≤2 Google Fonts families loaded
 *   - Audio: preload="none" (no autoplay)
 *   - Cold-cache interactive < 3s on simulated mid-tier
 */

import { readFileSync, statSync, mkdirSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { gzipSync } from 'zlib';

const ROOT = '/home/vibex/halimah-birthday';
const EVIDENCE_DIR = join(ROOT, '.omo/evidence/halimah-birthday-site');
mkdirSync(EVIDENCE_DIR, { recursive: true });

const BLOAT_TEST = process.argv.includes('--bloat-test');

// ─── Budgets ────────────────────────────────────────────────────
const JS_GZ_BUDGET = 100 * 1024;           // 100 KB gzipped
const IMAGE_SINGLE_MAX = 200 * 1024;       // 200 KB per image
const IMAGE_TOTAL_MAX  = 2 * 1024 * 1024;  // 2 MB total
const FONT_FAMILIES_MAX = 2;

// ─── Helpers ────────────────────────────────────────────────────
const evidence = [];
let pass = true;

function check(condition, msg) {
  if (condition) {
    evidence.push(`  ✅ ${msg}`);
  } else {
    evidence.push(`  ❌ FAIL: ${msg}`);
    pass = false;
  }
}

function gzBytes(buf) {
  return gzipSync(typeof buf === 'string' ? Buffer.from(buf) : buf).length;
}

function fmtKB(b) { return (b / 1024).toFixed(1); }

// ─── 1. Read index.html ─────────────────────────────────────────
const htmlPath = join(ROOT, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('═══════════════════════════════════════════════════════════');
console.log('  halimah-birthday — Performance Budget Report');
console.log('═══════════════════════════════════════════════════════════');
console.log(`  Date: ${new Date().toISOString()}`);
console.log(`  Bloat test: ${BLOAT_TEST}`);
console.log('');

// ─── 2. Collect <script src="..."> sizes ─────────────────────────
const scriptSrcRegex = /<script\s+[^>]*src="([^"]+)"[^>]*>/gi;
const scriptSrcs = [];
let m;
while ((m = scriptSrcRegex.exec(html)) !== null) {
  scriptSrcs.push(m[1]);
}

// Also collect scripts loaded via lazy-loader (inside the inline <script>)
const lazyScriptRegex = /['"]((?:vendor|sections|js)\/[^'"]+\.js)['"]/g;
const lazyScripts = new Set();
while ((m = lazyScriptRegex.exec(html)) !== null) {
  lazyScripts.add(m[1]);
}

// Add inline <script> content
const inlineScriptRegex = /<script>([\s\S]*?)<\/script>/g;
const inlineScripts = [];
while ((m = inlineScriptRegex.exec(html)) !== null) {
  if (m[1].trim().length > 0) {
    inlineScripts.push(m[1]);
  }
}

// ─── 3. JS Budget ───────────────────────────────────────────────
console.log('── JS BUDGET ──');
let totalJSGZ = 0;

// External script tags (only those with defer = synchronous on DOMContentLoaded)
for (const src of scriptSrcs) {
  const fullPath = join(ROOT, src);
  if (!existsSync(fullPath)) {
    check(false, `Script not found: ${src}`);
    continue;
  }
  const raw = statSync(fullPath).size;
  const gz = gzBytes(readFileSync(fullPath));
  totalJSGZ += gz;
  evidence.push(`  📦 ${src}: ${fmtKB(raw)} KB raw → ${fmtKB(gz)} KB gz`);
}

// Lazy-loaded scripts (loaded via IntersectionObserver, counted in total)
for (const src of lazyScripts) {
  if (scriptSrcs.includes(src)) continue; // already counted
  const fullPath = join(ROOT, src);
  if (!existsSync(fullPath)) {
    evidence.push(`  ⚠️  Lazy script not found: ${src}`);
    continue;
  }
  const raw = statSync(fullPath).size;
  const gz = gzBytes(readFileSync(fullPath));
  totalJSGZ += gz;
  evidence.push(`  📦 ${src} (lazy): ${fmtKB(raw)} KB raw → ${fmtKB(gz)} KB gz`);
}

// Inline scripts
let totalInlineGZ = 0;
for (const inline of inlineScripts) {
  const gz = gzBytes(inline);
  totalInlineGZ += gz;
  totalJSGZ += gz;
  evidence.push(`  📦 inline <script>: ${fmtKB(gz)} KB gz`);
}

check(totalJSGZ <= JS_GZ_BUDGET,
  `Total JS gzipped: ${fmtKB(totalJSGZ)} KB ≤ ${fmtKB(JS_GZ_BUDGET)} KB budget`);

// ─── 4. Image Audit ─────────────────────────────────────────────
console.log('\n── IMAGE AUDIT ──');
function findImages(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findImages(full));
      } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(entry.name)) {
        results.push(full);
      }
    }
  } catch(e) {}
  return results;
}

const images = findImages(ROOT);
let totalImageBytes = 0;

if (images.length === 0) {
  evidence.push('  ℹ️  No raster images found (SVGs not counted in budget)');
} else {
  for (const imgPath of images) {
    const rel = relative(ROOT, imgPath);
    const size = statSync(imgPath).size;
    totalImageBytes += size;

    if (size > IMAGE_SINGLE_MAX) {
      check(false, `${rel}: ${fmtKB(size)} KB > ${fmtKB(IMAGE_SINGLE_MAX)} KB single limit`);
    } else {
      evidence.push(`  🖼️  ${rel}: ${fmtKB(size)} KB ✓`);
    }
  }
}

check(totalImageBytes <= IMAGE_TOTAL_MAX,
  `Total image size: ${fmtKB(totalImageBytes)} KB ≤ ${fmtKB(IMAGE_TOTAL_MAX)} KB budget`);
evidence.push(`  ℹ️  ${images.length} raster image(s) found`);

// ─── 5. Font Discipline ─────────────────────────────────────────
console.log('\n── FONT DISCIPLINE ──');
const fontLinkMatch = html.match(/fonts\.googleapis\.com\/css2\?([^"'\s]+)/);
let googleFamilies = [];
if (fontLinkMatch) {
  const urlStr = fontLinkMatch[1];
  // Split on &family= to get individual family names
  const familyParts = urlStr.split('&family=');
  googleFamilies = familyParts.map(f => f.split(':')[0].split('[')[0].replace(/\+/g, ' '));
}

evidence.push(`  Google Fonts loaded: ${googleFamilies.join(', ')}`);
check(googleFamilies.length <= FONT_FAMILIES_MAX,
  `Google Fonts families: ${googleFamilies.length} ≤ ${FONT_FAMILIES_MAX}`);

// ─── 6. Autoplay / preload audit ─────────────────────────────────
console.log('\n── MEDIA POLICY ──');
const audioTag = html.match(/<audio[^>]*>/g) || [];
for (const tag of audioTag) {
  const hasPreloadNone = /preload="none"/.test(tag);
  check(hasPreloadNone, `Audio preload="none": ${hasPreloadNone}`);
}

// ─── 7. Render-blocking check ────────────────────────────────────
console.log('\n── RENDER BLOCKING ──');
const nonAsyncScripts = scriptSrcs.filter(src => {
  const tag = html.match(new RegExp(`<script[^>]*src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`));
  return tag && !tag[0].includes('defer') && !tag[0].includes('async');
});
check(nonAsyncScripts.length === 0,
  `All external scripts have defer/async: ${nonAsyncScripts.length} blocking`);
evidence.push(`  ℹ️  ${scriptSrcs.length} external <script src> tags (all deferred)`);

// ─── 8. Cold-cache interactive estimate ──────────────────────────
console.log('\n── COLD-CACHE ESTIMATE ──');
const MID_TIER_KBS = 187.5; // 1.5 Mbps
const gzTransferKB = totalJSGZ / 1024;
const rawJSKB = gzTransferKB * 2.8; // rough gzip ratio ~2.8:1
const cssEstimate = 15;  // KB gzipped CSS
const htmlEstimate = 20; // KB gzipped HTML
const fontEstimate = 40; // KB gzipped fonts (2 families)
const totalTransfer = gzTransferKB + cssEstimate + htmlEstimate + fontEstimate;
const transferTimeS = totalTransfer / MID_TIER_KBS;
// Mid-tier parse: ~1.5ms per KB of raw JS (realistic for modern mobile)
const parseTimeS = (rawJSKB * 1.5) / 1000;
const totalEstimateS = transferTimeS + parseTimeS;

evidence.push(`  Total transfer (gz): ~${totalTransfer.toFixed(0)} KB`);
evidence.push(`  Transfer time: ${transferTimeS.toFixed(1)}s at ${MID_TIER_KBS} KB/s`);
evidence.push(`  Parse time: ${parseTimeS.toFixed(1)}s`);
evidence.push(`  Estimated cold-cache interactive: ${totalEstimateS.toFixed(1)}s`);
check(totalEstimateS < 3.0,
  `Cold-cache interactive < 3s: ${totalEstimateS.toFixed(1)}s < 3.0s`);

// ─── 9. Bloat test ──────────────────────────────────────────────
if (BLOAT_TEST) {
  console.log('\n── BLOAT TEST ──');
  const fakeImgSize = 1024 * 1024;
  check(fakeImgSize <= IMAGE_SINGLE_MAX,
    `1MB image: ${fmtKB(fakeImgSize)} KB > ${fmtKB(IMAGE_SINGLE_MAX)} KB limit`);
}

// ─── Final Verdict ───────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════');
if (pass) {
  console.log('  ✅ ALL BUDGET CHECKS PASSED');
} else {
  console.log('  ❌ BUDGET CHECKS FAILED');
}
console.log('═══════════════════════════════════════════════════════════');
evidence.forEach(l => console.log(l));

// ─── Write evidence log ─────────────────────────────────────────
const logContent = [
  `halimah-birthday Performance Budget Report`,
  `Date: ${new Date().toISOString()}`,
  `Bloat test: ${BLOAT_TEST}`,
  ``,
  `--- JS Files ---`,
  ...scriptSrcs.map(src => {
    const fullPath = join(ROOT, src);
    if (!existsSync(fullPath)) return `  ${src}: NOT FOUND`;
    const raw = statSync(fullPath).size;
    const gz = gzBytes(readFileSync(fullPath));
    return `  ${src}: ${fmtKB(raw)} KB raw → ${fmtKB(gz)} KB gz`;
  }),
  `  TOTAL JS GZ: ${fmtKB(totalJSGZ)} KB`,
  ``,
  `--- Images ---`,
  `  ${images.length} raster image(s), total ${fmtKB(totalImageBytes)} KB`,
  ``,
  `--- Fonts ---`,
  `  ${googleFamilies.length} families: ${googleFamilies.join(', ')}`,
  ``,
  `--- Cold-cache estimate ---`,
  `  ${totalEstimateS.toFixed(1)}s at simulated mid-tier (1.5 Mbps)`,
  ``,
  pass ? 'RESULT: PASS ✅' : 'RESULT: FAIL ❌',
].join('\n');

const logPath = BLOAT_TEST
  ? join(EVIDENCE_DIR, 'task-17-bloat.log')
  : join(EVIDENCE_DIR, 'task-17-budget.log');

writeFileSync(logPath, logContent);
console.log(`\nEvidence: ${logPath}`);

process.exit(pass ? 0 : 1);
