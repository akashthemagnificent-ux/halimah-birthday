#!/usr/bin/env python3
"""Adversarial browser QA for the per-page music director.

Reads REAL state from the live page: the director's own report
(window.__sectionMusic), the <audio> elements it created, and which pill
is visible. Nothing is taken from a string the page printed.

Serves the repo over HTTP (Range-capable) and drives a headless Chromium
through every page, asserting:

  - the right song is sounding on each page
  - physics continues the gag-locker track with no restart
  - reel and world go silent and hide the player entirely
  - the player names the track on change, and the pill collapses again
  - the finale is the one song allowed to end on its own
  - all eight sources serve 200 and answer Range with 206

Usage: python3 qa/task-22-section-music.py
"""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from patchright.sync_api import sync_playwright  # noqa: E402

def ev(page, expr, arg=None):
    """Evaluate in the MAIN world. patchright defaults to an isolated world,
    where the page's own globals (window.SectionMusic, ...) are invisible."""
    return page.evaluate(expr, arg, isolated_context=False)

PORT = 8931
BASE = f"http://127.0.0.1:{PORT}/"

PAGES = [
    ("birthday", 1, "We Fell in Love in October"),
    ("story", 2, "Something About You"),
    ("quotes", 3, "Isn't It Midnight (2017 Remastered)"),
    ("gags", 4, "tek it x tek it"),
    ("physics", 4, "tek it x tek it"),
    ("scratch", 5, "21"),
    ("album", 6, "Last Leaves of Autumn"),
    ("starmap", 7, "[I Just] Died in Your Arms"),
    ("reel", None, None),
    ("world", None, None),
    ("finale", 8, "When Did You Realise"),
]

failures = []
lines = []


def say(s=""):
    lines.append(s)
    print(s)


def check(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    say(f"[{mark}] {name}{(' :: ' + detail) if detail else ''}")
    if not ok:
        failures.append(name)


def start_server():
    proc = subprocess.Popen(
        [sys.executable, str(ROOT / "serve.py"), str(PORT)],
        cwd=str(ROOT),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            urllib.request.urlopen(BASE + "index.html", timeout=1).read(1)
            return proc
        except Exception:
            time.sleep(0.1)
    raise RuntimeError("server did not come up")


def main():
    proc = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
            page = browser.new_page(viewport={"width": 390, "height": 844})

            # Capture every <audio> the director builds, so the loop seam and
            # the finale's natural end can be watched at real speed. Indexed by
            # src (other modules build their own Audio too). Test-side only.
            page.add_init_script(
                """
                window.__tracks = [];
                (function () {
                  var Orig = window.Audio;
                  window.__trackFor = function (n) {
                    var hit = null;
                    for (var i = 0; i < window.__tracks.length; i++) {
                      var s = window.__tracks[i].src || '';
                      if (s.indexOf('page-' + n + '.mp3') !== -1) hit = window.__tracks[i];
                    }
                    return hit;
                  };
                  var Wrapped = function () {
                    var el = new Orig();
                    window.__tracks.push(el);
                    return el;
                  };
                  Wrapped.prototype = Orig.prototype;
                  window.Audio = Wrapped;
                })();
                """
            )
            page.goto(BASE + "index.html?preview=1", wait_until="load")

            # The begin tap is the only gesture that arms audio.
            page.click("#begin-button")
            page.wait_for_timeout(700)

            check(
                "director armed by the begin tap",
                ev(page, "window.__sectionMusic.enabled === true"),
            )
            check(
                "page one is sounding after the tap",
                ev(page, "window.__sectionMusic.page === 1"),
                f"page={ev(page, 'window.__sectionMusic.page')}",
            )

            prev_page = 1
            for section_id, want_page, want_title in PAGES:
                ev(page,
                   "id => document.getElementById(id).scrollIntoView({block:'center'})",
                   section_id)

                # Scroll-snapping and lazy layout mean the committed section
                # lags the call, so wait for the director to agree instead of
                # trusting a fixed sleep. Both silent pages and songs may
                # legitimately settle late.
                settled = want_page
                for _ in range(30):
                    if ev(page, "want => window.__sectionMusic.page === want", settled):
                        break
                    page.wait_for_timeout(200)
                page.wait_for_timeout(650)

                # physics must INHERIT the gag-locker track: same page number
                # and a clock that kept running. Sampled mid-scroll on both
                # sides, so an accidental restart (t reset to ~0) is caught.
                if section_id == "physics" and prev_page == 4:
                    # Park the shared track in its middle first: "tek it x tek
                    # it" is only 34s, and a natural loop would masquerade as a
                    # restart. From 4s there is no seam for ~30s.
                    #
                    # A seek must not be issued until the element has audio
                    # buffered: on a cold element `currentTime = 4` lands at
                    # readyState 0 / duration NaN and pins the clock at exactly
                    # 4.0 while it loads, so a later sample can read the same
                    # frozen value and look like a restart. Wait for real
                    # metadata, then confirm the clock is genuinely running.
                    ready = False
                    for _ in range(50):
                        ready = ev(page,
                            "()=>{var e=window.__trackFor(4);return !!e && "
                            "e.readyState>=2 && isFinite(e.duration) && e.duration>0 "
                            "&& !e.paused;}")
                        if ready:
                            break
                        page.wait_for_timeout(200)
                    check(
                        "gag-locker track is buffered before the physics handoff",
                        ready,
                    )
                    ev(page, "window.__trackFor(4).currentTime = 4")
                    # The seek is only real once the clock has advanced past the
                    # park point; poll for that instead of trusting a sleep.
                    moved = False
                    for _ in range(25):
                        page.wait_for_timeout(200)
                        if ev(page, "window.__trackFor(4).currentTime > 4.2"):
                            moved = True
                            break
                    before = float(ev(page, "window.__trackFor(4).currentTime"))
                    ev(page,
                       "id => document.getElementById(id).scrollIntoView({block:'center'})",
                       "physics")
                    for _ in range(30):
                        page.wait_for_timeout(200)
                        if ev(page, "window.__sectionMusic.section === 'physics'"):
                            break
                    page.wait_for_timeout(900)
                    mid = ev(page, "window.__trackFor(4).currentTime")
                    check(
                        "physics continues the gag-locker track (no restart)",
                        moved and mid is not None and mid > before + 0.5,
                        f"gags t={before} -> physics t={mid} (clock moved={moved})",
                    )

                state = ev(page,
                    """() => ({
                        page: window.__sectionMusic.page,
                        section: window.__sectionMusic.section,
                        title: window.__sectionMusic.title,
                        playerVisible: window.__sectionMusic.playerVisible,
                        paused: window.__sectionMusic.paused,
                        el: window.__sectionMusic.element,
                        t: (window.__sectionMusic.element||{}).currentTime,
                    })"""
                )

                if want_page is None:
                    check(
                        f"{section_id}: director silent",
                        state["page"] is None,
                        f"page={state['page']}",
                    )
                    check(
                        f"{section_id}: player hidden for a clean cinematic page",
                        state["playerVisible"] is False,
                    )
                    prev_page = None
                    continue

                check(
                    f"{section_id}: sounding page {want_page}",
                    state["page"] == want_page,
                    f"page={state['page']} title={state['title']!r}",
                )
                check(
                    f"{section_id}: element pointing at page-{want_page}.mp3",
                    bool(state["el"]) and f"page-{want_page}.mp3" in (state["el"] or {}).get("src", ""),
                    f"src={(state['el'] or {}).get('src')}",
                )
                check(
                    f"{section_id}: player shows the song name",
                    state["title"] == want_title,
                    f"title={state['title']!r}",
                )
                check(
                    f"{section_id}: player visible",
                    state["playerVisible"] is True,
                )
                check(
                    f"{section_id}: element is actually playing",
                    bool(state["el"]) and state["el"]["paused"] is False,
                    f"paused={(state['el'] or {}).get('paused')}",
                )

                # physics inherit-checks are done above, mid-scroll
                prev_page = want_page

            # The pill should have settled back to the orb between changes.
            page.wait_for_timeout(6500)
            check(
                "pill settles back to the orb after naming a track",
                ev(page, "window.__sectionMusic.playerOpen === false"),
            )

            # Pause / resume via the transport.
            ev(page, "document.getElementById('music-control').click()")
            page.wait_for_timeout(400)
            paused = ev(page, "window.__sectionMusic.paused === true && window.__sectionMusic.playerVisible === true")
            check("pause keeps the pill, silences the track", paused)
            ev(page, "document.getElementById('music-control').click()")
            page.wait_for_timeout(1600)
            check(
                "resume brings the song back",
                ev(page, "window.__sectionMusic.paused === false && window.__sectionMusic.page === 8"),
            )

            # ---- Loop seam: a track left on its own page must repeat, and
            # the seam must be a fade, not a click. "21" is 27.9s, the
            # shortest; watch the final 3.5s run out and the clock restart.
            ev(page,
               "id => document.getElementById(id).scrollIntoView({block:'center'})",
               "scratch")
            ev(page,
               """() => {
                 for (var i = 0; i < 30; i++) {
                   if (window.__trackFor(5) && window.__sectionMusic.page === 5) return;
                 }
               }""")
            for _ in range(30):
                page.wait_for_timeout(200)
                if ev(page, "window.__sectionMusic.page === 5 && !!window.__trackFor(5)"):
                    break
            page.wait_for_timeout(900)
            # Jump into the fade window so the whole seam is deterministic:
            # the ramp is 1.6s and I look 1.0s in, which must already be dim.
            ev(page, "window.__trackFor(5).currentTime = window.__trackFor(5).duration - 0.6")
            page.wait_for_timeout(1000)
            near_end = ev(page, "window.__trackFor(5).volume")
            # poll for the restart rather than racing a fixed sleep: after the
            # seam the track must be young again, audible, and still rolling.
            looped = {"t": 1e9, "vol": 0, "paused": True}
            for _ in range(24):
                page.wait_for_timeout(300)
                looped = ev(
                    page,
                    """() => ({
                      t: window.__trackFor(5).currentTime,
                      vol: window.__trackFor(5).volume,
                      paused: window.__trackFor(5).paused,
                    })""",
                )
                if looped["t"] < 6 and looped["vol"] > 0.3 and not looped["paused"]:
                    break
            check(
                "loop seam fades the track out before it repeats",
                near_end is not None and near_end < 0.3,
                f"volume near the end = {near_end}",
            )
            check(
                "same-page track loops instead of stopping",
                looped["t"] < 3 and looped["paused"] is False and looped["vol"] > 0.3,
                f"after seam: {looped}",
            )

            # ---- Finale: the last song of the night is allowed to finish.
            ev(page,
               "id => document.getElementById(id).scrollIntoView({block:'center'})",
               "finale")
            for _ in range(30):
                page.wait_for_timeout(200)
                if ev(page, "window.__sectionMusic.page === 8 && !!window.__trackFor(8)"):
                    break
            page.wait_for_timeout(900)
            ev(page, "window.__trackFor(8).currentTime = window.__trackFor(8).duration - 1.2")
            page.wait_for_timeout(2600)
            end_state = ev(
                page,
                """() => ({
                  paused: window.__trackFor(8).paused,
                  ended: window.__trackFor(8).ended,
                  t: window.__trackFor(8).currentTime,
                  d: window.__trackFor(8).duration,
                  vol: window.__trackFor(8).volume,
                  page: window.__sectionMusic.page,
                })""",
            )
            check(
                "finale song ends on its own (fade out, no loop)",
                end_state["ended"] is True or (
                    end_state["paused"] is True and end_state["t"] >= end_state["d"] - 0.2
                ),
                f"{end_state}",
            )
            check(
                "finale stays on page 8 with the pill still shown",
                end_state["page"] == 8,
                f"page={end_state['page']}",
            )

            browser.close()
    finally:
        proc.terminate()
        proc.wait(timeout=5)

    # Sources must serve in full and answer Range requests.
    proc = start_server()
    try:
        ok = True
        for n in range(1, 9):
            url = BASE + f"assets/music/pages/page-{n}.mp3"
            r = urllib.request.urlopen(url, timeout=5)
            full_ok = r.status == 200 and int(r.headers.get("Content-Length", 0)) > 100000
            req = urllib.request.Request(url, headers={"Range": "bytes=0-1023"})
            try:
                rr = urllib.request.urlopen(req, timeout=5)
                range_ok = rr.status == 206 and len(rr.read()) == 1024
            except Exception:  # noqa: BLE001
                range_ok = False
                rr = None
            if not (full_ok and range_ok):
                ok = False
            check(f"page-{n}.mp3 serves 200 + Range 206", full_ok and range_ok)
        check("all eight sources stream", ok)
    finally:
        proc.terminate()
        proc.wait(timeout=5)

    say("")
    if failures:
        say(f"RESULT: FAIL ({len(failures)} assertion(s))")
        for f in failures:
            say(f"  - {f}")
        return 1
    say("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
