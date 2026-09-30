# Music Slot — How to Swap the Track

## Quick Swap (3 Steps)

1. **Replace the file** — Drop your new MP3 into this folder as `song.mp3`:
   ```bash
   cp /path/to/your-track.mp3 /home/vibex/halimah-birthday/assets/music/song.mp3
   ```

2. **Verify size** — Keep it under 8 MB:
   ```bash
   ls -lh /home/vibex/halimah-birthday/assets/music/song.mp3
   ```

3. **Test in browser** — Open `index.html`, tap "tap to begin", confirm music plays and pause button works.

That's it. No code changes needed — the `<audio>` element in `index.html` points to `assets/music/song.mp3`.

## Audio Policy

- **Muted by default**: Music only plays after the user taps "tap to begin" (user-gesture handler).
- **No autoplay**: The `<audio>` element has `preload="none"` and no `autoplay` attribute.
- **Pause control**: A floating pause/resume button appears after first tap (bottom-right corner).
- **Graceful fallback**: If the audio file is missing or fails to load, the page opens normally with zero console errors. The pause button shows a "Music unavailable" tooltip.
- **No remote streams**: Audio is served from a local file only — no hotlinked URLs that can die.
- **No behavior tracking**: No analytics or storage of user listening behavior.

## Current Default Track

The current `song.mp3` is a **TEMPORARY PLACEHOLDER** — a short synthesized sine-wave tone generated with ffmpeg. It is clearly not a real song. **Replace it before the final deploy.**

### Regenerate the placeholder (if needed)

```bash
ffmpeg -y -f lavfi -i "sine=frequency=261.63:duration=30" \
  -f lavfi -i "sine=frequency=329.63:duration=30" \
  -filter_complex "[0:a]volume=0.3[a0];[1:a]volume=0.2[a1];[a0][a1]amix=inputs=2:duration=longest,afade=t=in:st=0:d=3,afade=t=out:st=27:d=3" \
  -codec:a libmp3lame -q:a 6 \
  assets/music/song.mp3
```

## Accepted Formats

- **MP3** (recommended): universal browser support, small file size.
- **OGG**: good alternative, slightly smaller, but no Safari support.
- **WAV/AIFF**: too large — avoid for web.

## File Location

The single slot file is:
```
assets/music/song.mp3
```

Referenced in `index.html` as:
```html
<audio id="bgm" src="assets/music/song.mp3" loop preload="none"></audio>
```
