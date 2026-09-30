#!/usr/bin/env python3
"""Generate sections/story.html + inline index.html story markup from content/chapters.md.

Every quoted line is copied verbatim (HTML-escaped only). Chapter count must
equal deck count (14). Fails loudly on any mismatch.
"""
import re, html, sys, os

BASE = '/home/vibex/halimah-birthday'
DECK = os.path.join(BASE, 'content/chapters.md')
MONTHS = {'Jan':'01','Feb':'02','Mar':'03','Apr':'04','May':'05','Jun':'06',
          'Jul':'07','Aug':'08','Sep':'09','Oct':'10','Nov':'11','Dec':'12'}

text = open(DECK).read()
parts = re.split(r'^##\s+', text, flags=re.M)[1:]
chapters = [p for p in parts if not p.strip().lower().startswith('notes')]
assert len(chapters) == 14, f'deck chapter count changed: {len(chapters)}'

def parse(p):
    lines = p.split('\n')
    head = lines[0].strip()
    num, _, title = head.partition(',')
    num = num.strip(); title = title.strip()
    m = re.search(r'\*\*Date:\*\*\s*(.+)', p)
    date_disp = m.group(1).strip() if m else ''
    dm = re.match(r'(\d{2}) (\w{3}) (\d{4})', date_disp)
    iso = f"{dm.group(3)}-{MONTHS[dm.group(2)]}-{dm.group(1)}" if dm else ''
    s = re.search(r'\*\*Source:\*\*\s*`(.+?)`', p)
    src = s.group(1) if s else ''
    quotes = [q[2:] if q.startswith('> ') else q[1:] for q in re.findall(r'^>.*', p, flags=re.M)]
    assert quotes, f'chapter {num} has no quoted lines'
    v = re.search(r'^\*(.+)\*\s*$', p, flags=re.M)
    voice = v.group(1).strip() if v else ''
    assert voice, f'chapter {num} missing voiceover'
    assert date_disp and iso and src, f'chapter {num} missing date/src'
    return dict(num=num, title=title, date_disp=date_disp, iso=iso,
                src=src, quotes=quotes, voice=voice)

parsed = [parse(p) for p in chapters]

def chapter_html(c, i, total):
    qs = '\n'.join(f'      <p>{html.escape(q)}</p>' for q in c['quotes'])
    return f'''<article class="story__chapter" data-chapter="{i}" id="chapter-{i}" tabindex="0" aria-label="Chapter {c['num']}: {html.escape(c['title'])}">
  <div class="story__chapter-inner">
    <p class="story__kicker"><span class="story__num">{html.escape(c['num'])}</span><span class="story__of" aria-hidden="true"> / {total:02d}</span></p>
    <h3 class="story__title">{html.escape(c['title'])}</h3>
    <time class="story__date" datetime="{c['iso']}">{html.escape(c['date_disp'])}</time>
    <blockquote class="story__quote">
{qs}
    </blockquote>
    <p class="story__voiceover">{html.escape(c['voice'])}</p>
    <p class="story__source">from our chats &#183; {html.escape(c['src'])}</p>
  </div>
</article>'''

articles = '\n'.join(chapter_html(c, i+1, len(parsed)) for i, c in enumerate(parsed))

progress_items = '\n'.join(
    f'    <span class="story__progress-item" data-num="{c["num"]}" data-target="chapter-{i+1}" aria-hidden="true"></span>'
    for i, c in enumerate(parsed))

fragment = f'''<div class="story__content">
  <p class="story__eyebrow">our story &#183; fourteen chapters</p>
  <h2 class="story__headline">how we got here</h2>
  <div class="story__track" data-story-track>
{articles}
  </div>
  <nav class="story__progress" data-story-progress aria-hidden="true" aria-label="Story progress">
    <div class="story__progress-list">
{progress_items}
    </div>
  </nav>
</div>'''

story_path = os.path.join(BASE, 'sections/story.html')
open(story_path, 'w').write(fragment + '\n')
print(f'wrote {story_path} ({len(parsed)} chapters)')

idx_path = os.path.join(BASE, 'index.html')
idx = open(idx_path).read()
old = '''<section id="story" class="section section--story" aria-label="Our story">
  <div class="story__content">
    <p class="section__placeholder">TODO: story chapters</p>
  </div>
</section>'''
assert old in idx, 'story anchor placeholder not found'
idx = idx.replace(old, f'''<section id="story" class="section section--story" aria-label="Our story" data-theme="cinematic">
{fragment}
</section>''')
if 'sections/story.css' not in idx:
    idx = idx.replace('<link rel="stylesheet" href="sections/starmap.css" />',
                      '<link rel="stylesheet" href="sections/starmap.css" />\n<link rel="stylesheet" href="sections/story.css" />')
if 'sections/story.js' not in idx:
    idx = idx.replace('<script src="sections/starmap.js" defer></script>',
                      '<script src="vendor/gsap.min.js" defer></script>\n<script src="vendor/ScrollTrigger.min.js" defer></script>\n<script src="sections/starmap.js" defer></script>\n<script src="sections/story.js" defer></script>')
open(idx_path, 'w').write(idx)
print('wired story anchor into index.html')
