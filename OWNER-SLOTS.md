# OWNER-SLOTS.md, every input only you can supply

This is the full list of slots that need you. Everything else on the
site is finished and wired. Each slot below names the exact file or
marker, what to drop in, and what she sees if you never fill it.
Nothing here breaks the site when left empty. Placeholders stand in,
and every check still passes.

Quick status right now: album photos are SHIPPED (42 baby photos in
assets/baby/, nothing to fill), song is a placeholder tone (swap it before
deploy), letter slots FILLED (final copy shipped), turning-17 declined by default.

## 1. Album photos — SHIPPED, nothing to fill

The album was rebuilt as **the baby album**: a 44-page page-flip book made of
42 real baby photos (committed in `assets/baby/` as `halimah-pic-01.webp` ..
`halimah-pic-42.webp`), plus a cover and a final page that stay illustrated
placeholders on purpose. There is no empty photo slot here anymore — the photos
are part of the keepsake.

Every photo is declared as a `data-photo` slot in `index.html` and probed at
runtime before it swaps in, so a missing or renamed file leaves the illustrated
placeholder in place, never a broken-image icon. To swap a photo, drop a file
with the exact same name over the old one; no rebuild.

If missing: that page falls back to its placeholder and the book still flips,
swipes, and turns by keyboard. The album is acceptance-tested both full and
emptied, so both states are known good.

Full details live in `assets/baby/README.md`. (The old 6-slot `assets/photos/`
us-album target is retired; that folder is kept only so nothing is deleted.)

## 2. Song, 1 slot

File: `assets/music/song.mp3`. MP3 format, keep it under 8 MB. Three
steps: drop your track in under that exact name, check the size with
`ls -lh`, then open `index.html`, tap "tap to begin", and confirm it
plays and the pause button works. Nothing else to touch. The audio
element already points at that path.

If missing: the page opens normally with zero console errors. The music
button still appears but carries a "Music unavailable" note. She loses
nothing except the soundtrack.

Right now the file in place is a short synthesized placeholder tone,
audibly not a real song. Replace it before you send her the link. Full
swap steps live in `assets/music/README.md`.

## 3. Letter slots, FILLED, nothing to fill

The finale letter reads complete as shipped: the final owner copy is
in the page (the spider paragraph, the "Happy 15th Birthday My Love"
passage, the month-of-work lines, the cutiepie closer, and the full
signature including "Your princess."). The old inline edit slots
(`spider-line`, `signature`, `ps`) are retired; there are no `[OWNER:]`
markers left in the markup. The print stylesheet still hides any
stray `.finale__slot` node just in case, so the Save-as-PDF keepsake
comes out clean.

To edit the words themselves: they live in the finale letter block in
`index.html` between `data-finale-letter` and `</article>`.

## 4. Turning-17 decision, confirm or decline

Default: declined. No age line appears anywhere on the site, and the
quote audit forbids `turning 17` / `turns 17` strings, so an accidental
mention fails the checks instead of shipping.

To confirm (only if you want her age on the page): add one line of your
choosing to the finale letter, then allowlist that exact line in
`audits/quote-audit.mjs` and `audits/task-4-audit.mjs` so the audit
keeps guarding everything else. Unlike every slot above, this one needs
that small code touch, because the guardrail is deliberate.

To decline: do nothing. This file already records the decision.

## 5. What never needs you

The scratch-off secret ships with a fixed default line and is not an
owner fill. Leave it alone.

## 6. Verification

One script checks this whole file against the live site. It asserts
every slot listed here exists in the markup or READMEs, every live
`[OWNER:]` marker and photo probe is documented here, the turning-17
line is absent while declined, and every missing-input fallback is
still wired:

```bash
node audits/task-19-acceptance.mjs
```

Empty-state proof (zero inputs supplied, all checks still green):

```bash
mv assets/music/song.mp3 /tmp/song.mp3.bak
node audits/task-19-acceptance.mjs | tee /home/vibex/.omo/evidence/halimah-birthday-site/task-19-empty.log
node audits/quote-audit.mjs
node scripts/budget.mjs
node audits/task-12-acceptance.mjs
mv /tmp/song.mp3.bak assets/music/song.mp3
```

Filled-state proof (the 42 baby photos are already committed, album flips):

```bash
node audits/task-19-acceptance.mjs | tee /home/vibex/.omo/evidence/halimah-birthday-site/task-19-filled.log
node audits/task-20-links.mjs   # asserts all 42 baby photos resolve on disk
```
