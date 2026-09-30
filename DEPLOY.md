# Deploy — Halimah Birthday Site

## Quick deploy (Netlify Drop)

Netlify Drop lets you deploy a static folder by dragging it — no account, no CLI, no config file needed.

### Step-by-step

1. Open **https://app.netlify.com/drop** in your browser.
2. In your file manager, navigate to `halimah-birthday/`.
3. **Drag the entire `halimah-birthday/` folder** onto the Netlify Drop zone.
4. Wait for the upload to finish. Netlify assigns a random URL like `https://adjective-noun-12345.netlify.app/`.
5. Copy that URL — this is your **secret link**. No one else knows it.
6. (Optional) Rename the subdomain to something less guessable via Site settings → Change site name.

### Suggested unguessable URL path

After deploying, use Netlify's **Pretty URLs** (enabled by default) and set your page at the root. To add a decoy path, create a `_redirects` file:

```
/surprise  /  200
/secret    /  302
/hey       /  302
```

Then share only the root URL. The paths above are decoys — anyone guessing them gets redirected, not the site.

**Recommended 12-char path:** The Netlify-assigned subdomain (e.g. `sunny-cloud-7kx9f`) is already unguessable. Do NOT use a custom domain with a predictable name like `halimah-birthday.netlify.app`.

## Post-deploy verification

After drag-and-drop deploy, verify these in order:

### 1. noindex confirmation

```bash
curl -s https://YOUR-SITE.netlify.app/ | grep -o 'noindex'
# Expected output: noindex
```

Also check the HTTP headers:

```bash
curl -sI https://YOUR-SITE.netlify.app/ | grep -i 'x-robots'
# Netlify serves noindex by default for sites without a custom domain
```

### 2. OG tag scrape — zero personal names

```bash
curl -s https://YOUR-SITE.netlify.app/ | grep -oP 'og:title.*?content="[^"]*"'
curl -s https://YOUR-SITE.netlify.app/ | grep -oP 'og:description.*?content="[^"]*"'
# Expected: "a surprise, open 19 Oct" and "tap to begin"
# Must NOT contain any person's name
```

### 3. Cold-load locked state (before 19 October)

Open the site on a phone or emulator. Before 19 October:
- You see "one tap and it starts" / "begin" button.
- After tapping begin, a countdown appears: "not yet — come back on 19 October".
- The DOM inside `#content-region` is **empty** (nodes detached into a DocumentFragment).
- **view-source** shows no story text, no quotes, no names.

### 4. Post-unlock state (19 October onward)

- Tap "begin" → content unlocks, confetti fires, music plays.
- All 14 story chapters, rooms, and finale letter render.

## Surprise preservation rules

| Rule | Why |
|------|-----|
| **No custom domain** with her name | Predictable URL = leaked surprise |
| **noindex meta** already in `index.html` | Search engines never index the page |
| **OG tags** say "a surprise" — no names | Link previews don't spoil it |
| **Locked state** detaches DOM nodes | View-source shows nothing before unlock |
| **No password theater** | Secrecy = unguessable URL, not a fake lock |

## If you need real auth later

Netlify + Cloudflare Access can add email-based gating:
https://developers.cloudflare.com/pages/functions/plugins/cloudflare-access/

This is NOT needed now — the surprise relies on URL obscurity.

## File structure

```
halimah-birthday/
├── index.html          ← entry point, noindex + OG tags
├── tokens.css          ← design tokens
├── js/
│   ├── begin.js        ← tap-to-begin + countdown gate
│   ├── motion.js       ← confetti + GSAP
│   ├── story.js        ← scroll chapters
│   ├── quotes.js       ← quote wall
│   ├── gags.js         ← gag locker
│   ├── scratch.js      ← scratch-off panel
│   ├── album.js        ← photo album
│   ├── physics.js      ← floating hearts
│   ├── world.js        ← her-world strip
│   └── finale.js       ← love letter + keepsakes
├── sections/           ← per-section CSS
├── vendor/             ← GSAP, Howler, confetti, page-flip, matter-js
├── assets/
│   ├── music/          ← drop song.mp3 here
│   ├── photos/         ← drop photos here
│   └── keepsakes/      ← star-map card SVG
├── content/            ← copy decks (chapters.md, lore.md)
├── audits/             ← quote audit script
└── DEPLOY.md           ← this file
```

## Music swap

1. Drop your file at `assets/music/song.mp3`
2. Keep the filename `song.mp3`
3. No code changes needed — the `<audio>` tag and Howler config already point to this path
