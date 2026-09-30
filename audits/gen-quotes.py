#!/usr/bin/env python3
"""Generate sections/quotes.html + inline index.html quote-wall markup (todo 8).

Every card line is pulled byte-exact from the DM exports: the script reads
each cited source line, takes the message portion (optionally excerpting to
the punchline, exactly as content/lore.md does), and HTML-escapes it.
Nothing is hand-typed, so nothing can drift from the source.

Card = her line only. The one his-line (the threat) is the room headline.
Fails loudly on any mismatch: missing line, empty message, date wobble.
"""
import re, html, sys, os

BASE = '/home/vibex/halimah-birthday'
DM_DIR = '/mnt/c/Users/COMPUTER WORLD/Downloads/halimah dms'
MONTHS = {'01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May',
          '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct',
          '11': 'Nov', '12': 'Dec'}

# (dm file, line number, excerpt shown on the card or None for full message)
CARDS = [
    ("halimah dms-1.txt", 11, None),
    ("halimah dms-1.txt", 34, None),
    ("halimah dms-1.txt", 45, None),
    ("halimah dms-1.txt", 50, "Hope u like hash browns \U0001F979\U0001F979"),
    ("halimah dms-1.txt", 52, None),
    ("halimah dms-1.txt", 933, None),
    ("halimah dms-1.txt", 935, None),
    ("halimah dms-1.txt", 937, None),
    ("halimah dms-1.txt", 1423, "IM GONNA MAKE U PLAY DTI WITH ME \U0001F970\U0001F970"),
    ("halimah dms-2.txt", 1038, None),
    ("halimah dms-2.txt", 1608, "Okay bet"),
    ("halimah dms-2.txt", 2362, None),
    ("halimah dms-3.txt", 850, None),
    ("halimah dms-3.txt", 957, "Goodboy"),
    ("halimah dms-3.txt", 1090, None),
    ("halimah dms-3.txt", 1098, None),
    ("halimah dms-3.txt", 2443, None),
    ("halimah dms-5.txt", 1031, "Is this drawing good"),
    ("halimah dms-5.txt", 2330, None),
    ("halimah dms-5.txt", 2336, None),
    ("halimah dms-5.txt", 2338, None),
    ("halimah dms-7.txt", 860, None),
    ("halimah dms-8.txt", 1020, None),
    ("halimah dms-8.txt", 1839, None),
    ("halimah dms-9.txt", 435, None),
    ("halimah dms-9.txt", 436, None),
    ("halimah dms-10.txt", 211, None),  # excerpted below via reply-strip
    ("halimah dms-11.txt", 704, None),
    ("halimah dms-11.txt", 980, None),
    ("halimah dms-11.txt", 982, None),
    ("halimah dms-11.txt", 2830, "ILL CONTINUE WATCHING TOKYO GHOUL"),
    ("halimah dms-13.txt", 1142, None),
    ("halimah dms-13.txt", 1145, None),
    ("halimah dms-14.txt", 923, None),
]

THREAT_REF = ("halimah dms-2.txt", 1037)

_dm_cache = {}
def dm_line(fname, num):
    if fname not in _dm_cache:
        with open(os.path.join(DM_DIR, fname), encoding='utf-8') as f:
            _dm_cache[fname] = f.read().split('\n')
    lines = _dm_cache[fname]
    assert 1 <= num <= len(lines), f'{fname}:{num} out of range ({len(lines)} lines)'
    return lines[num - 1]

RAW_RE = re.compile(r'^\[([^\]]+)\]\s*([^:]+):\s?(.*)$', re.S)
REPLY_RE = re.compile(r'^\(replying to ".*?"\)\s*(.*)$', re.S)

def parse_raw(raw, ref):
    m = RAW_RE.match(raw)
    assert m, f'{ref}: unparseable source line: {raw[:120]!r}'
    ts, speaker, msg = m.group(1), m.group(2).strip(), m.group(3)
    date = ts[:10]  # YYYY-MM-DD (UTC stamp; wall shows calendar date)
    return ts, speaker, msg, date

def disp_date(iso):
    y, mo, d = iso.split('-')
    return f'{d} {MONTHS[mo]} {y}'

def excerpt_of(msg, ref):
    """Strip reply-prefix and attachment markers to the punchline."""
    m = REPLY_RE.match(msg)
    text = m.group(1) if m else msg
    text = re.sub(r'\s*\[reactions:[^\]]*\]\s*', '', text).strip()
    text = re.sub(r'\s*\[attachment:[^\]]*\]\s*', '', text).strip()
    assert text, f'{ref}: empty message after strip: {msg[:120]!r}'
    return text

# ---- Threat headline: pulled from source, never retyped ----
threat_raw = dm_line(*THREAT_REF)
_, threat_speaker, threat_msg, _ = parse_raw(threat_raw, 'threat')
assert threat_speaker == 'me', f'threat line speaker changed: {threat_speaker!r}'
THREAT = excerpt_of(threat_msg, 'threat')
assert THREAT.startswith('IF YOU STAY UP ANYMORE'), f'threat text drift: {THREAT!r}'

cards = []
for fname, num, fixed in CARDS:
    ref = f'{fname}:{num}'
    raw = dm_line(fname, num)
    ts, speaker, msg, iso = parse_raw(raw, ref)
    assert speaker.strip() != 'me', \
        f'{ref}: card line is his, not hers (speaker={speaker!r}) — wall is her lines only'
    text = fixed if fixed is not None else excerpt_of(msg, ref)
    assert text in msg, f'{ref}: card text not verbatim in source message:\n  card: {text!r}\n  src:  {msg[:200]!r}'
    cards.append(dict(text=text, iso=iso, disp=disp_date(iso), src=ref))

assert len(cards) == len(CARDS), 'card count drift'

def card_html(c, i):
    long_cls = ' quote-card--long' if len(c['text']) > 120 else ''
    return f'''<article class="quote-card{long_cls}" data-quote="{i}" data-source="{html.escape(c['src'])}" style="--d:{i % 8}" tabindex="0" aria-label="Quote {i}: {html.escape(c['text'][:60])}">
  <div class="quote-card__head">
    <span class="quote-card__avatar" aria-hidden="true">Z</span>
    <span class="quote-card__who">
      <span class="quote-card__name">zainab</span>
      <time class="quote-card__date" datetime="{c['iso']}">{html.escape(c['disp'])}</time>
    </span>
  </div>
  <blockquote class="quote-card__quote">
    <p>{html.escape(c['text'])}</p>
  </blockquote>
  <p class="quote-card__source">from our chats &#183; {html.escape(c['src'])}</p>
</article>'''

articles = '\n'.join(card_html(c, i + 1) for i, c in enumerate(cards))

fragment = f'''<div class="quotes__content">
  <p class="quotes__eyebrow">the quote wall &#183; the threat, fulfilled</p>
  <h2 class="quotes__headline" data-threat="halimah dms-2.txt:1037">\u201c<span class="quotes__headline-mark">{html.escape(THREAT)}</span>\u201d</h2>
  <p class="quotes__lede">he kept the screenshots, and then he kept his word. her words deserved a whole website.</p>
  <p class="quotes__count">{len(cards)} certified zainab quotes</p>
  <div class="quotes__wall" data-quotes-wall>
{articles}
  </div>
</div>'''

quotes_path = os.path.join(BASE, 'sections/quotes.html')
with open(quotes_path, 'w', encoding='utf-8') as f:
    f.write(fragment + '\n')
print(f'wrote {quotes_path} ({len(cards)} cards)')

idx_path = os.path.join(BASE, 'index.html')
idx = open(idx_path, encoding='utf-8').read()
new_section = f'''<section id="quotes" class="section section--quotes" aria-label="Quote wall">
{fragment}
</section>'''
old = '''<section id="quotes" class="section section--quotes" aria-label="Quote wall">
  <div class="quotes__content">
    <p class="section__placeholder">TODO: quote wall</p>
  </div>
</section>'''
if old in idx:
    idx = idx.replace(old, new_section)
else:
    cur = re.search(r'<section id="quotes" class="section section--quotes" aria-label="Quote wall">\n.*?\n</section>', idx, re.S)
    assert cur, 'quotes section not found — index.html changed?'
    idx = idx.replace(cur.group(0), new_section)
    print('replaced existing quotes section (idempotent re-run)')
if 'sections/quotes.css' not in idx:
    idx = idx.replace('<link rel="stylesheet" href="sections/album.css" />',
                      '<link rel="stylesheet" href="sections/album.css" />\n<link rel="stylesheet" href="sections/quotes.css" />')
if 'sections/quotes.js' not in idx:
    idx = idx.replace('<script src="sections/album.js" defer></script>',
                      '<script src="sections/album.js" defer></script>\n<script src="sections/quotes.js" defer></script>')
with open(idx_path, 'w', encoding='utf-8') as f:
    f.write(idx)
print('wired quotes anchor into index.html')
