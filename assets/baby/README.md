# Baby album photos — shipped

These are the 42 real baby photos that fill "the baby album" (the `#album`
section). They are committed on purpose: the album is a keepsake, not an
empty slot, so there is nothing for the owner to fill here.

## Files

| File | Album page |
| ---- | ---------- |
| `halimah-pic-01.webp` | photo 01 |
| ... | ... |
| `halimah-pic-42.webp` | photo 42 |

Every file is `assets/baby/halimah-pic-NN.webp` (`NN` = 01..42, zero-padded,
`.webp`). The album declares each one as a `data-photo` slot in `index.html`
and probes it before swapping, so a missing or renamed file leaves the
illustrated placeholder in place — never a broken-image icon.

## The two placeholder pages

The book is 44 pages: the 42 photos above, plus a cover and a final page that
stay illustrated placeholders on purpose (the story continues past the last
photo). Those two pages carry no `data-photo`, so they never expect a file.

## Swapping a photo

1. Replace the matching `assets/baby/halimah-pic-NN.webp` (keep the exact
   name and `.webp` extension).
2. Open the album section — the new photo appears in its page.
3. Nothing else to touch; no rebuild.

## Keepsake photos (separate)

`IMG_0658.webp`, `IMG_0994.webp`, `IMG_1077.webp` in this folder are the three
birthday-section keepsakes drawn to the WebGL globe. They are unrelated to the
album. On `file://` the globe's canvas draw is CORS-blocked by design (the
same photos still render as plain `<img>`), which is why the QA logs note a
few CORS messages there.
