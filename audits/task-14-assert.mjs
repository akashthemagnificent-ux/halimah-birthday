// Static acceptance for todo 14 (motion system: confetti + GSAP discipline).
// Usage: node audits/task-14-assert.mjs  (exit 0 = all green, exit 1 = red)
// Checks the plan acceptance: animation init behind gesture or
// IntersectionObserver, kill-switch present, single confetti module with
// exactly one fireworks entry, no motion before gesture, no infinite loops,
// replay button present, duplicate begin ids resolved.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

let failures = 0;
const check = (cond, label, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);
  if (!cond) failures++;
};

const html = read('index.html');
const motion = read('js/motion.js');
const begin = read('js/begin.js');
const finale = read('sections/finale.js');
const story = read('sections/story.js');

// 1. Single confetti module: window.confetti( appears only in js/motion.js
//    (vendor/ is the third-party library itself, not a second system).
const libCallers = [];
for (const rel of ['js/begin.js', 'js/motion.js', 'sections/finale.js', 'sections/story.js',
  'sections/album.js', 'sections/quotes.js', 'sections/gags.js', 'sections/physics.js',
  'sections/scratch.js', 'sections/starmap.js', 'sections/world.js']) {
  const t = read(rel);
  if (/window\.confetti\s*\(/.test(t)) libCallers.push(rel);
}
check(libCallers.length === 1 && libCallers[0] === 'js/motion.js',
  'single confetti module: window.confetti( only in js/motion.js',
  `callers=[${libCallers.join(', ')}]`);

// 2. Exactly one fireworks entry (one function definition).
const fireworkDefs = [];
for (const rel of ['js/motion.js', 'js/begin.js', 'sections/finale.js']) {
  const t = read(rel);
  const n = (t.match(/function fireworks\s*\(/g) || []).length;
  if (n) fireworkDefs.push(rel + ' x' + n);
}
check(fireworkDefs.length === 1 && fireworkDefs[0] === 'js/motion.js x1',
  'exactly one fireworks entry', `defs=[${fireworkDefs.join(', ')}]`);

// 3. All animation init behind gesture or IntersectionObserver.
//    begin.js arms audio+confetti only inside a click handler; story.js gates
//    GSAP on Motion.hasGsap(); starmap/scratch/physics gate on reduced-motion
//    + IntersectionObserver / tap.
check(/beginButton\.addEventListener\('click'/.test(begin) && !/^[^/]*window\.confetti/m.test(begin),
  'begin gate: confetti only via Motion inside the click path');
check(/Motion\.hasGsap\(\)/.test(story) && /prefersReducedMotion\(\)/.test(story),
  'story: GSAP only via Motion.hasGsap() with reduced-motion bail');
for (const rel of ['sections/starmap.js', 'sections/scratch.js', 'sections/physics.js']) {
  const t = read(rel);
  check(/prefersReducedMotion\(\)/.test(t),
    `${rel}: reduced-motion gate present`);
}
check(/new IntersectionObserver/.test(read('sections/starmap.js')) &&
      /new IntersectionObserver/.test(read('index.html')),
  'lazy arming: IntersectionObserver gates section + vendor loads');

// 4. Global kill-switch present in the motion module.
check(/function motionAllowed/.test(motion) && /prefers-reduced-motion: reduce/.test(motion) &&
      /function hasGsap/.test(motion) && /if\s*\(!motionAllowed\(\)\)\s*return false/.test(motion),
  'global kill-switch present (motionAllowed + hasGsap + reduced query)');

// 5. No motion before gesture: boot() wires replay only; no confetti,
//    setInterval, or rAF at module top level / in boot.
const bootBody = (motion.match(/function boot\(\)\s*\{[\s\S]*?\n  \}/) || [''])[0];
check(!/window\.confetti/.test(bootBody) && !/setInterval|requestAnimationFrame/.test(bootBody),
  'no motion before gesture: boot() only wires the opt-in replay');
check(!/setInterval/.test(motion) && !/requestAnimationFrame/.test(motion),
  'no timers or rAF loops anywhere in motion.js');

// 6. No infinite loops: bounded volleys only (exactly two setTimeout calls).
const timeouts = (motion.match(/window\.setTimeout/g) || []).length;
check(timeouts === 2 && !/while\s*\(\s*true/.test(motion) && !/for\s*\(\s*;;/.test(motion),
  'no infinite loops in motion.js', `setTimeout calls=${timeouts}`);

// 7. Confetti opt-in replay button in the finale keepsakes.
check(/data-motion-replay/.test(html) && /replay the confetti/.test(html),
  'confetti replay button exists in finale keepsakes');

// 8. Dedupe: exactly one id="begin-overlay" and one id="begin-button"
//    (whitespace-boundary match so data-testid does not false-positive).
for (const id of ['begin-overlay', 'begin-button']) {
  const n = (html.match(new RegExp(`\\sid="${id}"`, 'g')) || []).length;
  check(n === 1, `dedupe: one id="${id}"`, `count=${n}`);
}

// 9. Gesture wiring intact: Howl constructed + play() in the click path.
check(/new window\.Howl/.test(begin) && /howl\.play\(\)/.test(begin),
  'gesture wiring intact: Howl constructed and played in the click path');

console.log(failures === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
