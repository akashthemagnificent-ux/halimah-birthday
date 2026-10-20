/* The three milestones the clocks page counts. Dates are calendar
   dates in Europe/London (see sections/clocks-core.js).

   mode:
     elapsed — counts up from `anchor` forever
     annual  — counts down to the next occurrence of anchor.m/anchor.d,
               rolling to the following year the moment it passes
     until   — counts down to `target`, then flips to counting up

   lap: how long one full turn of that ring takes. Each ring is a
   dial, so its rotation means something rather than decorating. */
window.MILESTONES = [
  {
    id: 'together',
    label: 'us, so far',
    mode: 'elapsed',
    anchor: { y: 2026, m: 8, d: 26 },
    lap: 'day'
  },
  {
    id: 'birthday',
    label: 'your next birthday',
    mode: 'annual',
    anchor: { y: 2026, m: 10, d: 19 },
    lap: 'hour'
  },
  {
    id: 'anniversary',
    label: 'one year of us',
    mode: 'until',
    anchor: { y: 2026, m: 8, d: 26 },
    target: { y: 2027, m: 8, d: 26 },
    lap: 'minute'
  }
];
