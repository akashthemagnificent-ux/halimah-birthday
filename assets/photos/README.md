# Photo slots — album room (todo 11)

Drop owner-supplied photos here. No build step, no code change: the
album probes each file at runtime and swaps it in only after it loads.
If a file is missing, the illustrated PLACEHOLDER page stays — never a
broken-image icon.

## Slots (exact filenames)

| File | Album page | Caption (owner voice, already in markup) |
| ---- | ---------- | ---------------------------------------- |
| `photo-1.jpg` | us, the beginning — kakegurui-pfp era | "where it started — one pfp and i was done for" |
| `photo-2.jpg` | the dare that turned real — 04 Jul | "dare me again, i dare you" |
| `photo-3.jpg` | lullaby night — 18 Aug | "you fell asleep first. i stayed." |
| `photo-4.jpg` | yes, a million times — 26 Aug | "YES A MILLION TIMES YES" |
| `photo-5.jpg` | hashbrown chaos + buddy wars | "certified buddy. good boy (terms apply)." |
| `photo-6.jpg` | spider-pic amnesty | "i survived the spider pics. for you. barely." |

## Swap steps

1. Drop the file with the exact name above (`.jpg`, any reasonable size).
2. Open the album section — the photo appears with its caption.
3. Delete a file to return that page to its placeholder; nothing breaks.

No hotlinked photos: everything loads from this folder. No real photo
is committed until the owner supplies one — placeholders are the default.
