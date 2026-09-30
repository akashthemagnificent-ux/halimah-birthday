#!/usr/bin/env bash
# Task 20 cleanup receipt: prove the sweep left no processes, servers, or
# stray files behind, and record what was actually cleaned.
#
#   bash scripts/task-20-cleanup.sh
#
# Evidence: ../.omo/evidence/halimah-birthday-site/task-20-cleanup.log
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
EV="$ROOT/.omo/evidence/halimah-birthday-site"
LOG="$EV/task-20-cleanup.log"
mkdir -p "$EV"
: > "$LOG"
say() { printf '%s\n' "$*" | tee -a "$LOG"; }

say "TASK 20 — CLEANUP RECEIPT"
say "checked: $(date -Is)"

# 1. No headless browser left running.
LEFT=$(pgrep -fc 'chrome-headless-shell|chromium_headless_shell' 2>/dev/null || echo 0)
say ""
say "[1] browser processes still alive: $LEFT"
if [ "$LEFT" -gt 0 ]; then
  say "    (these belong to an in-flight run; re-check after the sweep finishes)"
  say "VERDICT: PENDING"
  exit 1
fi
say "    none — every Playwright browser exited"

# 2. No static server left listening on the QA ports.
LISTEN=$( (command -v ss >/dev/null && ss -ltnp 2>/dev/null | grep -E ':(3[0-9]{4}|[0-9]{4,5})' | grep -E 'node|bun' || true) )
say ""
say "[2] lingering node/bun listeners:"
if [ -n "$LISTEN" ]; then say "$LISTEN"; say "VERDICT: RED"; exit 1; fi
say "    none"

# 3. No stray temp artifacts inside the shipped site tree.
STRAY=$(find "$ROOT" -path "$ROOT/.omo" -prune -o \
  \( -name '*.tmp' -o -name '*.bak' -o -name '*.orig' -o -name '*.out' \
     -o -name 'nohup.out' -o -name '*.log' \) -print 2>/dev/null | grep -v '/\.omo/' || true)
say ""
say "[3] stray files in the site tree:"
if [ -n "$STRAY" ]; then say "$STRAY"; say "VERDICT: RED"; exit 1; fi
say "    none"

# 4. The owner's photo folder is still empty and the song still in place
#    (the sweep must never leave test fixtures behind).
say ""
say "[4] owner-input state (must be untouched by the sweep):"
PHOTOS=$(find assets/photos -maxdepth 1 -name 'photo-*.jpg' 2>/dev/null | wc -l)
say "    assets/photos/photo-*.jpg count: $PHOTOS (expected 0)"
[ "$PHOTOS" -eq 0 ] || { say "VERDICT: RED — test photos left behind"; exit 1; }
if [ -f assets/music/song.mp3 ]; then
  say "    assets/music/song.mp3: present ($(stat -c%s assets/music/song.mp3) bytes)"
else
  say "    assets/music/song.mp3: MISSING"; say "VERDICT: RED"; exit 1
fi

# 5. The evidence artifacts the sweep promised to produce all exist.
say ""
say "[5] task-20 evidence artifacts:"
MISSING=0
for f in task-20-sweep.log task-20-375.png task-20-768.png task-20-1280.png \
         task-20-1920.png task-20-reduced-motion.png task-20-links.log; do
  if [ -s "$EV/$f" ]; then
    say "    ok      $f ($(stat -c%s "$EV/$f") bytes)"
  else
    say "    MISSING $f"; MISSING=$((MISSING + 1))
  fi
done
[ "$MISSING" -eq 0 ] || { say "VERDICT: RED — $MISSING evidence file(s) missing"; exit 1; }

say ""
say "VERDICT: CLEAN"
exit 0
