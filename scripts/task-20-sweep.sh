#!/usr/bin/env bash
# Task 20 — pre-handoff hardening sweep.
#
# Runs the FULL gate in one pass and writes one all-green log. Any single red
# makes the whole run red: the exit code is the number of failures, and the log
# records every command, its measured output tail, and its exit code.
#
#   bash scripts/task-20-sweep.sh
#
# Evidence: ../.omo/evidence/halimah-birthday-site/task-20-sweep.log
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
EV="$ROOT/.omo/evidence/halimah-birthday-site"
LOG="$EV/task-20-sweep.log"
mkdir -p "$EV"

TOTAL_FAIL=0
INFRA_FAIL=0
: > "$LOG"

hdr() { printf '\n════════════════════════════════════════\n%s\n════════════════════════════════════════\n' "$1" | tee -a "$LOG"; }
sub() { printf -- '--- %s\n' "$1" | tee -a "$LOG"; }

run() {
  local label="$1"; shift
  sub "$label"
  printf '$ %s\n' "$*" | tee -a "$LOG"
  local out rc
  out="$("$@" 2>&1)"; rc=$?
  printf '%s\n' "$out" | tail -n 25 | tee -a "$LOG"
  printf 'EXIT[%s] = %s\n' "$label" "$rc" | tee -a "$LOG"
  if [ "$rc" -ne 0 ]; then
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    printf '  ✗ RED: %s (exit %s)\n' "$label" "$rc" | tee -a "$LOG"
    # Distinguish a real assertion failure from the browser being killed
    # mid-run. A TargetClosedError / OOM kill is a host-capacity problem, not
    # a site defect, and must not be filed as one.
    if printf '%s' "$out" | grep -qE 'TargetClosedError|browser has been closed|out of memory|Out of memory'; then
      INFRA_FAIL=$((INFRA_FAIL + 1))
      printf '    ↳ INFRA, not a site defect: browser process died mid-run (host memory)\n' | tee -a "$LOG"
    fi
  else
    printf '  ✓ GREEN: %s\n' "$label" | tee -a "$LOG"
  fi
  # This box has ~2.9 GB RAM and the browser suites each spawn a headless
  # Chromium. Without a cooldown between them the kernel OOM-kills the browser
  # mid-run and the suite dies with TargetClosedError instead of a real verdict.
  sleep "${COOLDOWN:-4}"
  return 0
}

hdr "TASK 20 — PRE-HANDOFF HARDENING SWEEP"
printf 'started : %s\n' "$(date -Is)" | tee -a "$LOG"
printf 'site    : %s\n' "$ROOT" | tee -a "$LOG"
printf 'bun     : %s\n' "$(bun --version)" | tee -a "$LOG"
# Stale-state guard: the sweep must be evidence for these exact bytes.
printf 'build   : index.html sha256=%s\n' "$(sha256sum index.html | cut -c1-16)" | tee -a "$LOG"
printf 'build   : sections+js sha256=%s\n' "$(find sections js -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) | sort | xargs sha256sum | sha256sum | cut -c1-16)" | tee -a "$LOG"

hdr "1. COPY + BUDGET"
run "quote-audit"        bun audits/quote-audit.mjs
run "budget"             bun run scripts/budget.mjs
run "lore-audit"         bun scripts/audit-lore.js
run "tone-lint"          bun scripts/tone-lint.js

hdr "2. ACCEPTANCE (every task-*-acceptance.mjs must exit 0)"
for f in audits/task-*-acceptance.mjs audits/task-2-gate.mjs audits/task-14-assert.mjs; do
  [ -f "$f" ] || continue
  [ "$(basename "$f")" = "task-19-acceptance.mjs" ] && continue
  run "$(basename "$f" .mjs)" bun "$f"
done

hdr "2b. COPY AUDITS (quote-source and lore re-verification)"
run "task-4-audit"       bun audits/task-4-audit.mjs

hdr "3. BROKEN LINKS + MEDIA"
run "task-20-links"      bun audits/task-20-links.mjs

hdr "4. BROWSER QA"
run "task-2-qa-happy"    bun qa/task-2-qa.mjs happy
run "task-2-qa-locked"   bun qa/task-2-qa.mjs locked
run "task-7-qa"          bun audits/task-7-qa.mjs
run "task-7-probe"       bun audits/task-7-probe.mjs
run "task-7-qa2"         bun audits/task-7-qa2.mjs
run "task-8-qa"          bun qa/task-8-qa.mjs
run "task-9-qa"          bun audits/task-9-qa.mjs
run "task-10-qa"         bun audits/task-10-qa.mjs
run "task-11-qa"         bun audits/task-11-qa.mjs
run "task-12-qa-happy"   bun qa/task-12-qa.mjs happy
run "task-12-qa-nojs"    bun qa/task-12-qa.mjs nojs
run "task-13-world"      bun qa/task-13-world.mjs
run "task-13-lyric"      bun qa/task-13-lyric.mjs
run "task-14-qa"         bun qa/task-14-qa.mjs
run "task-15-physics"    bun qa/task-15-physics.mjs
run "task-15-fallback"   bun qa/task-15-fallback.mjs
run "task-15-reduced"    bun qa/task-15-reduced-motion.mjs

hdr "5. VIEWPORTS + COLD LOAD + REDUCED MOTION"
run "task-20-sweep"      bun qa/task-20-sweep.mjs

hdr "6. OWNER SLOTS (empty-input build must still pass)"
run "task-19-acceptance" bun audits/task-19-acceptance.mjs

hdr "SWEEP VERDICT"
printf 'host memory: %s\n' "$(free -m | awk '/^Mem:/{print $2" MB total, "$7" MB available"}')" | tee -a "$LOG"
if [ "$TOTAL_FAIL" -eq 0 ]; then
  printf 'ALL GREEN — 0 red checks\n' | tee -a "$LOG"
else
  printf 'RED — %s check(s) failed (%s of them host-capacity, not site defects)\n' \
    "$TOTAL_FAIL" "$INFRA_FAIL" | tee -a "$LOG"
fi
printf 'finished: %s\n' "$(date -Is)" | tee -a "$LOG"
printf 'log     : %s\n' "$LOG" | tee -a "$LOG"

exit "$TOTAL_FAIL"
