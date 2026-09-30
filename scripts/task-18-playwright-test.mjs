/**
 * task-18 — Playwright local cold-serve verification
 *
 * Starts a local HTTP server, opens the site with Bun.WebView at 375px,
 * and verifies the locked state (before 19 October 2026).
 *
 * Evidence written to: .omo/evidence/halimah-birthday-site/task-18-live.log
 */

import { writeFileSync } from 'fs';
import { spawn } from 'child_process';

process.env.BUN_CHROME_PATH = '/home/vibex/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

const SITE = '/home/vibex/halimah-birthday';
const EVIDENCE = '/home/vibex/.omo/evidence/halimah-birthday-site';
const PORT = 8234;
const URL = `http://localhost:${PORT}`;
const LOG_PATH = `${EVIDENCE}/task-18-live.log`;

const logs = [];
function log(msg) {
  console.log(msg);
  logs.push(msg);
}

function logResult(name, ok, detail) {
  const status = ok ? 'PASS' : 'FAIL';
  log(`[${status}] ${name}: ${detail}`);
}

async function run() {
  log('='.repeat(70));
  log('TASK 18 — Local Cold-Serve Verification');
  log('Date: ' + new Date().toISOString());
  log('Viewport: 375x812 (iPhone 12 Pro)');
  log('='.repeat(70));

  // Determine locked/unlocked state
  const now = new Date();
  const targetDate = new Date('2026-10-19T00:00:00+01:00'); // BST
  const isBefore19Oct = now < targetDate;
  log(`\nCurrent time: ${now.toISOString()}`);
  log(`Target time:  ${targetDate.toISOString()}`);
  log(`State: ${isBefore19Oct ? 'BEFORE 19 Oct → should be LOCKED' : 'AFTER 19 Oct → should be UNLOCKED'}`);

  // Start local server
  log('\n--- Starting local server ---');
  const server = spawn('bun', ['run', `${SITE}/scripts/serve.mjs`], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let serverReady = false;
  server.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Listening') || s.includes('listening') || s.includes('ready')) {
      serverReady = true;
    }
  });
  server.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Listening') || s.includes('listening') || s.includes('ready')) {
      serverReady = true;
    }
  });

  // Wait for server to be ready (up to 10s)
  for (let i = 0; i < 50; i++) {
    if (serverReady) break;
    try {
      const r = await fetch(URL);
      if (r.ok) { serverReady = true; break; }
    } catch {}
    await Bun.sleep(200);
  }

  if (!serverReady) {
    log('[FAIL] Server failed to start within 10s');
    server.kill();
    writeFileSync(LOG_PATH, logs.join('\n') + '\n');
    process.exit(1);
  }
  log('[PASS] Local server started on port ' + PORT);

  try {
    // Use Bun.WebView to load the page at 375px
    const browser = new Bun.WebView({ headless: true, width: 375, height: 812 });

    await browser.navigate(URL);
    await Bun.sleep(2500); // Wait for JS to boot and lock content

    // Take screenshot (Bun.WebView screenshot returns a Blob)
    const screenshotBlob = await browser.screenshot();
    const screenshotArr = await screenshotBlob.arrayBuffer();
    writeFileSync(`${EVIDENCE}/task-18-locked-state.png`, Buffer.from(screenshotArr));
    log('[PASS] Screenshot captured: task-18-locked-state.png');

    // Check DOM state — Bun.WebView.evaluate takes a string, not a function
    const domState = await browser.evaluate(`(() => {
      const region = document.getElementById('content-region');
      const beginOverlay = document.getElementById('begin-overlay');
      const countdownPanel = document.getElementById('countdown-panel');
      const beginButton = document.getElementById('begin-button');
      const dataLocked = document.documentElement.getAttribute('data-locked');
      const dataUnlocked = document.documentElement.getAttribute('data-unlocked');
      const countdownTarget = document.documentElement.getAttribute('data-countdown-target');
      const contentChildren = region ? region.childElementCount : -1;

      const bodyText = document.body.innerText || '';
      const spoilerPhrases = [
        'kakegurui', 'I love you', 'good girl', 'good boy',
        'wifey', 'hubby', 'princess', 'hashbrown',
        'chase atlantic', 'shining'
      ];
      const foundSpoilers = spoilerPhrases.filter(s =>
        bodyText.toLowerCase().includes(s.toLowerCase())
      );

      return JSON.stringify({
        dataLocked,
        dataUnlocked,
        countdownTarget,
        contentChildren,
        beginOverlayHidden: beginOverlay ? beginOverlay.hidden : null,
        countdownPanelHidden: countdownPanel ? countdownPanel.hidden : null,
        beginButtonExists: !!beginButton,
        foundSpoilers,
        bodyTextLength: bodyText.length,
        bodyTextPreview: bodyText.substring(0, 300),
      });
    })()`);

    const state = JSON.parse(domState);

    log('\n--- DOM State ---');
    log(`data-locked on <html>: ${state.dataLocked}`);
    log(`data-unlocked on <html>: ${state.dataUnlocked}`);
    log(`countdown-target: ${state.countdownTarget}`);
    log(`content-region child count: ${state.contentChildren}`);
    log(`begin-overlay hidden: ${state.beginOverlayHidden}`);
    log(`countdown-panel hidden: ${state.countdownPanelHidden}`);
    log(`begin-button exists: ${state.beginButtonExists}`);
    log(`body text length: ${state.bodyTextLength}`);
    log(`body text preview: "${state.bodyTextPreview}"`);
    log(`spoiler phrases found in DOM: [${state.foundSpoilers.join(', ')}]`);

    // Assertions based on expected state
    if (isBefore19Oct) {
      // BEFORE 19 Oct: should be locked
      logResult('locked-data-attr', state.dataLocked === 'true',
        state.dataLocked === 'true'
          ? 'data-locked="true" present on <html>'
          : `data-locked = "${state.dataLocked}" — expected "true"`);

      logResult('content-detached', state.contentChildren === 0,
        state.contentChildren === 0
          ? 'content-region has 0 children (detached into DocumentFragment)'
          : `content-region has ${state.contentChildren} children — should be 0 (leaking story text!)`);

      logResult('no-spoilers-in-dom', state.foundSpoilers.length === 0,
        state.foundSpoilers.length === 0
          ? 'Zero spoiler phrases found in DOM'
          : `FAILED: spoiler phrases found: ${state.foundSpoilers.join(', ')}`);

      logResult('begin-overlay-visible', state.beginOverlayHidden === false,
        state.beginOverlayHidden === false
          ? 'begin overlay is visible (not hidden)'
          : 'begin overlay is hidden — should be visible before unlock');

      logResult('not-unlocked', state.dataUnlocked !== 'true',
        state.dataUnlocked !== 'true'
          ? 'data-unlocked is NOT set (correct for locked state)'
          : 'FAILED: data-unlocked="true" set in locked state');

    } else {
      // AFTER 19 Oct: should be unlocked
      logResult('unlocked-data-attr', state.dataUnlocked === 'true',
        state.dataUnlocked === 'true'
          ? 'data-unlocked="true" present on <html>'
          : `data-unlocked = "${state.dataUnlocked}" — expected "true"`);

      logResult('content-present', state.contentChildren > 0,
        state.contentChildren > 0
          ? `content-region has ${state.contentChildren} children (unlocked)`
          : 'content-region has 0 children — should have content after unlock');

      logResult('no-spoilers-in-dom', state.foundSpoilers.length === 0,
        state.foundSpoilers.length === 0
          ? 'Zero spoiler phrases found in DOM'
          : `Note: spoiler phrases in unlocked DOM: ${state.foundSpoilers.join(', ')}`);
    }

    // Click begin button and verify behavior
    log('\n--- Click "begin" button ---');
    const clicked = await browser.evaluate(`(() => {
      const btn = document.getElementById('begin-button');
      if (btn) { btn.click(); return true; }
      return false;
    })()`);

    if (clicked) {
      await Bun.sleep(1500);
      const afterClickJson = await browser.evaluate(`(() => {
        const overlay = document.getElementById('begin-overlay');
        const countdown = document.getElementById('countdown-panel');
        return JSON.stringify({
          overlayHidden: overlay ? overlay.hidden : null,
          countdownHidden: countdown ? countdown.hidden : null,
          audioState: document.documentElement.getAttribute('data-audio'),
        });
      })()`);

      const afterClick = JSON.parse(afterClickJson);
      log(`After click — overlay hidden: ${afterClick.overlayHidden}`);
      log(`After click — countdown hidden: ${afterClick.countdownHidden}`);
      log(`After click — audio state: ${afterClick.audioState}`);

      if (isBefore19Oct) {
        logResult('countdown-visible-after-click', afterClick.countdownHidden === false,
          afterClick.countdownHidden === false
            ? 'Countdown panel visible after begin click (locked state)'
            : 'Countdown panel hidden after begin click — unexpected before 19 Oct');
      }

      // Take post-click screenshot
      const screenshotAfterBlob = await browser.screenshot();
      const screenshotAfterArr = await screenshotAfterBlob.arrayBuffer();
      writeFileSync(`${EVIDENCE}/task-18-after-click.png`, Buffer.from(screenshotAfterArr));
      log('[PASS] Post-click screenshot: task-18-after-click.png');
    }

    // Final status
    log('\n' + '='.repeat(70));
    log('VERIFICATION COMPLETE');
    log('='.repeat(70));

    try { browser.close(); } catch {}

  } catch (err) {
    log(`[ERROR] ${err.message}`);
  } finally {
    // Kill server
    server.kill('SIGKILL');
    log('\n[CLEANUP] Local server killed');
  }

  // Write evidence
  writeFileSync(LOG_PATH, logs.join('\n') + '\n');
  log(`\nEvidence written to: ${LOG_PATH}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
