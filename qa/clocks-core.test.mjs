// Unit tests for sections/clocks-core.js — pure date math, no browser.
// Run: node --test qa/clocks-core.test.mjs
//
// The file is a classic browser script, not a Node module: it assigns a
// global and only exports for CommonJS when `module` exists. This repo
// has no package.json of its own, so Node inherits `"type": "module"`
// from /root and would parse it as ESM — where `module` is undefined and
// the exports silently vanish. Load it the way the browser does instead:
// evaluate it as a classic script in a sandbox and read the global.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../sections/clocks-core.js', import.meta.url), 'utf8');
// Same realm as the tests: a vm context would give Dates and plain
// objects from another realm, and deepEqual/instanceof compare
// prototypes, so every structural assertion would fail for no real reason.
const holder = { exports: {} };
new Function('module', 'exports', source)(holder, holder.exports);
const M = holder.exports;
delete globalThis.ClocksMath; // the UMD assigns a global too; don't leak it

const TOGETHER = { id: 'together', mode: 'elapsed',
  anchor: { y: 2026, m: 8, d: 26 }, lap: 'day' };
const BIRTHDAY = { id: 'birthday', mode: 'annual',
  anchor: { y: 2026, m: 10, d: 19 }, lap: 'hour' };
const ANNIV = { id: 'anniversary', mode: 'until',
  anchor: { y: 2026, m: 8, d: 26 }, target: { y: 2027, m: 8, d: 26 }, lap: 'minute' };

test('decompose splits into days, hours, minutes, seconds', () => {
  assert.deepEqual(M.decompose(258652000),
    { days: 2, hours: 23, minutes: 50, seconds: 52 });
});

test('decompose never returns a negative', () => {
  assert.deepEqual(M.decompose(-5000),
    { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('instantFor resolves London midnight in BST as 23:00Z the day before', () => {
  const d = M.instantFor(2026, 10, 19, M.TZ);
  assert.equal(d.toISOString(), '2026-10-18T23:00:00.000Z');
});

test('instantFor resolves London midnight in GMT as 00:00Z', () => {
  const d = M.instantFor(2027, 1, 15, M.TZ);
  assert.equal(d.toISOString(), '2027-01-15T00:00:00.000Z');
});

test('instantFor handles 29 February in a leap year', () => {
  // February in London is GMT (UTC+0), so local midnight is 00:00Z.
  const d = M.instantFor(2028, 2, 29, M.TZ);
  assert.equal(d.toISOString(), '2028-02-29T00:00:00.000Z');
});

test('instantFor does not crash on 29 February in a non-leap year', () => {
  const d = M.instantFor(2027, 2, 29, M.TZ);
  assert.ok(d instanceof Date);
  assert.ok(Number.isFinite(d.getTime()));
});

test('elapsed counts up from the anchor', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const s = M.milestoneState(TOGETHER, now, M.TZ);
  assert.equal(s.direction, 'up');
  assert.equal(s.parts.days, 55);
});

test('annual targets this year before the date', () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const s = M.milestoneState(BIRTHDAY, now, M.TZ);
  assert.equal(s.direction, 'down');
  assert.equal(s.parts.days, 17);
});

test('annual rolls to the following year the instant the date passes', () => {
  const before = M.milestoneState(BIRTHDAY,
    Date.parse('2027-10-18T12:00:00Z'), M.TZ);   // 13:00 London, the 18th
  const after = M.milestoneState(BIRTHDAY,
    Date.parse('2027-10-19T23:00:01Z'), M.TZ);   // 00:00:01 London, the 20th
  assert.equal(before.parts.days, 0, 'still counting down to the 19th');
  assert.equal(after.parts.days, 364, 'now targeting 2028');
});

test('annual steps one day per calendar day across the DST fall-back', () => {
  // Both instants target 2027-10-19 London; the two-day gap must
  // read as exactly two days, not 2 days +/- an hour.
  const a = M.milestoneState(BIRTHDAY, Date.parse('2026-10-24T12:00:00Z'), M.TZ);
  const b = M.milestoneState(BIRTHDAY, Date.parse('2026-10-26T12:00:00Z'), M.TZ);
  assert.equal(a.parts.days - b.parts.days, 2);
});

test('until counts down before the target', () => {
  const s = M.milestoneState(ANNIV, Date.parse('2027-08-01T12:00:00Z'), M.TZ);
  assert.equal(s.direction, 'down');
  assert.ok(s.ms > 0);
});

test('until flips to counting up the moment the target passes', () => {
  const s = M.milestoneState(ANNIV, Date.parse('2027-08-26T12:00:00Z'), M.TZ);
  assert.equal(s.direction, 'up');
  assert.ok(s.ms > 0, 'elapsed time since, not a negative countdown');
  assert.ok(s.ms < 86400000);
});

test('until renders zero for an instant, never a negative', () => {
  const at = M.instantFor(2027, 8, 26, M.TZ).getTime();
  const s = M.milestoneState(ANNIV, at, M.TZ);
  assert.equal(s.ms, 0);
  assert.equal(s.parts.days, 0);
});

test('lapProgress stays within [0, 1)', () => {
  for (const lap of ['day', 'hour', 'minute']) {
    const p = M.lapProgress(Date.parse('2026-10-20T13:37:41Z'), M.TZ, lap);
    assert.ok(p >= 0 && p < 1, lap + ' out of range: ' + p);
  }
});

test('lapProgress for minute equals the second of the minute over 60', () => {
  const now = Date.parse('2026-10-20T13:37:41Z'); // 14:37:41 London
  assert.ok(Math.abs(M.lapProgress(now, M.TZ, 'minute') - 41 / 60) < 1e-9);
});

test('formatAria reads as a sentence', () => {
  assert.equal(M.formatAria({ days: 55, hours: 7, minutes: 42, seconds: 19 }),
    '55 days, 7 hours, 42 minutes and 19 seconds');
});

test('formatAria uses singular units', () => {
  assert.equal(M.formatAria({ days: 1, hours: 1, minutes: 1, seconds: 1 }),
    '1 day, 1 hour, 1 minute and 1 second');
});
