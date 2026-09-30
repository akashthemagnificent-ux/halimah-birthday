# OWNER-SLOTS.md, every input only you can supply

This is the full list of slots that need you. Everything else on the
site is finished and wired. Each slot below names the exact file or
marker, what to drop in, and what she sees if you never fill it.
Nothing here breaks the site when left empty. Placeholders stand in,
and every check still passes.

Quick status right now: photos 0 of 6 supplied, song is a placeholder
tone (swap it before deploy), 3 letter edits open, turning-17 declined
by default.

## 1. Album photos, 6 slots

Drop files into `assets/photos/`. Use the exact names below, `.jpg`
format, any reasonable size (under ~500 KB each keeps the page fast).
No code change, no rebuild. The album probes each file at runtime and
swaps it in only after it loads. A missing file leaves the illustrated
placeholder in place, never a broken-image icon. Delete a file any time
to return that page to its placeholder.

| File | Album page | Caption already on the page |
| ---- | ---------- | --------------------------- |
| `photo-1.jpg` | us, the beginning | "where it started, one pfp and i was done for" (kakegurui-pfp era) |
| `photo-2.jpg` | the dare that turned real | "dare me again, i dare you" (04 Jul) |
| `photo-3.jpg` | lullaby night | "you fell asleep first. i stayed." (18 Aug) |
| `photo-4.jpg` | yes, a million times | "YES A MILLION TIMES YES" (26 Aug 2026) |
| `photo-5.jpg` | hashbrown chaos + buddy wars | "certified buddy. good boy (terms apply)." (ongoing lore) |
| `photo-6.jpg` | spider-pic amnesty | "i survived the spider pics. for you. barely." (amnesty granted) |

If missing: placeholder card with the page title plus its caption, all
still flippable and swipeable. The album was acceptance-tested empty
and full, so both states are known good.

Full swap steps live in `assets/photos/README.md`.

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

## 3. Letter slots, 3 inline edits in `index.html`

The finale letter reads complete as shipped, so these are refinements,
not gaps. Each slot sits right after its default line in the markup,
tagged with a `data-owner-slot` attribute. On screen the markers show
as small dashed marginalia. They never print: the print stylesheet
hides them, so the Save-as-PDF keepsake comes out clean whether or not
you fill them.

| Slot id | Where | Default line she reads today | What to do |
| ------- | ----- | ---------------------------- | ---------- |
| `spider-line` | finale letter, spider paragraph | "You make everything beautiful for me, even eight-legged nightmares, even Mondays." | Rewrite it in your own words, or leave it. The marker asks for your version. |
| `signature` | finale signoff | "your Akash, your hashbrown, your good boy" | Sign it your way by editing the name line above the marker. |
| `ps` | after the signoff | (nothing, the paragraph is empty) | Optional. Add one private line here before you send her the link, or leave it out entirely. |

If missing: she reads the defaults (or no P.S.), and the markers stay
as quiet hints only you would notice on screen. Nothing looks broken.

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

Filled-state proof (sample photos dropped in, album still flips):

```bash
for i in 1 2 3 4 5 6; do
  ffmpeg -y -loglevel error -f lavfi -i "color=c=0x2a2118:s=640x480:d=1" -frames:v 1 -update 1 assets/photos/photo-$i.jpg
done
node audits/task-19-acceptance.mjs | tee /home/vibex/.omo/evidence/halimah-birthday-site/task-19-filled.log
rm assets/photos/photo-[1-6].jpg
```
