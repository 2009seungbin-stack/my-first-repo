"""Social cards (assets/social/<locale>-<id>.png, 1200x630) for tool intents.

Every intent needs one per locale (tests/growth.test.mjs checks the dimensions and that the
document references it). Titles come from src/messages.js, so the card and the page cannot
drift apart. Usage: python tools/generate-social.py ui-lab 9-slice-editor ...
Existing files are never overwritten unless --force is given.

Guides (src/guides.js): python tools/generate-social.py --guides [--force] writes
assets/social/<locale>-guide-<slug>.png for every guide and <locale>-guides.png for the index,
in the dark game-home palette with the title wrapped to three lines.
"""
import json, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'social'
BG, INK, MUTED, BLUE = (245, 247, 250, 255), (23, 43, 77, 255), (82, 100, 124, 255), (37, 99, 235, 255)
SUBTITLE = {'ko': '브라우저에서 내 기기로 처리', 'en': 'Processed locally in your browser', 'ja': 'ブラウザでローカル処理'}
FONTS = {'ko': 'malgunbd.ttf', 'en': 'NotoSansKR-VF.ttf', 'ja': 'YuGothB.ttc'}
LIGHT = {'ko': 'malgun.ttf', 'en': 'NotoSansKR-VF.ttf', 'ja': 'YuGothR.ttc'}


def font(name, size, bold):
    path = Path('C:/Windows/Fonts') / name
    f = ImageFont.truetype(str(path), size)
    if name.endswith('-VF.ttf'):
        try:
            f.set_variation_by_name('Bold' if bold else 'Regular')
        except OSError:
            pass
    return f


def titles(ids):
    script = ("import {MESSAGES} from './src/messages.js';"
              "const ids=process.argv.slice(1);"
              "console.log(JSON.stringify(Object.fromEntries(ids.map(id=>[id,MESSAGES[`intent.${id}.title`]]))));")
    out = subprocess.run(['node', '--input-type=module', '-e', script, '--', *ids],
                         cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def card(locale, title):
    im = Image.new('RGBA', (1200, 630), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((60, 65, 131, 72), fill=BLUE)
    d.text((60, 190), title, font=font(FONTS[locale], 56, True), fill=INK, anchor='ls')
    d.text((60, 370), SUBTITLE[locale], font=font(LIGHT[locale], 24, False), fill=MUTED, anchor='ls')
    d.text((60, 542), 'Nerulio', font=font(FONTS['en'], 34, True), fill=BLUE, anchor='ls')
    return im


GUIDE_BG, GUIDE_INK, GUIDE_MUTED, GUIDE_ACCENT = (19, 21, 24, 255), (238, 240, 243, 255), (158, 165, 175, 255), (76, 194, 255, 255)
GUIDE_KICKER = {'ko': '게임 개발 가이드', 'en': 'GAME DEV GUIDE', 'ja': 'ゲーム開発ガイド'}


def guide_copy():
    script = ("import {GUIDES} from './src/guides.js';import {GUIDE_ENGINES} from './src/guides.js';"
              "import {COPY} from './tools/guides-build.mjs';"
              "console.log(JSON.stringify({guides:GUIDES.map(g=>({slug:g.slug,title:g.title,engines:g.engines.map(e=>GUIDE_ENGINES[e]||e)})),index:Object.fromEntries(['ko','en','ja'].map(l=>[l,{title:COPY[l].guides,lead:COPY[l].indexLead}]))}));")
    out = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def wrap(draw, text, fnt, width, lines):
    """Greedy wrap on spaces (Latin, Korean) or per character (Japanese), at most `lines` lines."""
    words = text.split(' ') if ' ' in text else list(text)
    joiner = ' ' if ' ' in text else ''
    out, cur = [], ''
    for w in words:
        cand = (cur + joiner + w) if cur else w
        if draw.textlength(cand, font=fnt) <= width:
            cur = cand
        else:
            out.append(cur)
            cur = w
    out.append(cur)
    if len(out) > lines:
        out = out[:lines]
        while draw.textlength(out[-1] + '…', font=fnt) > width:
            out[-1] = out[-1][:-1]
        out[-1] += '…'
    return out


def guide_card(locale, title, meta):
    im = Image.new('RGBA', (1200, 630), GUIDE_BG)
    d = ImageDraw.Draw(im)
    d.rectangle((60, 65, 131, 72), fill=GUIDE_ACCENT)
    d.text((60, 128), GUIDE_KICKER[locale], font=font(FONTS[locale], 26, True), fill=GUIDE_ACCENT, anchor='ls')
    size = 60
    while size > 40:
        fnt = font(FONTS[locale], size, True)
        lines = wrap(d, title, fnt, 1080, 3)
        if not lines[-1].endswith('…'):
            break
        size -= 4
    y = 215
    for line in lines:
        d.text((60, y), line, font=fnt, fill=GUIDE_INK, anchor='ls')
        y += int(size * 1.28)
    if meta:
        d.text((60, 505), meta, font=font(LIGHT[locale], 26, False), fill=GUIDE_MUTED, anchor='ls')
    d.text((60, 572), 'Nerulio', font=font(FONTS['en'], 34, True), fill=GUIDE_ACCENT, anchor='ls')
    return im.convert('RGB')


def guides(force):
    data = guide_copy()
    jobs = [(f'{l}-guides.png', l, data['index'][l]['title'], 'Godot · Unity · Phaser · PixiJS · Defold · LÖVE · GameMaker') for l in ['ko', 'en', 'ja']]
    for g in data['guides']:
        for l in ['ko', 'en', 'ja']:
            jobs.append((f"{l}-guide-{g['slug']}.png", l, g['title'][l], ' · '.join(g['engines'])))
    for name, locale, title, meta in jobs:
        path = OUT / name
        if path.exists() and not force:
            print('kept', name)
            continue
        guide_card(locale, title, meta).save(path, optimize=True)
        print('wrote', name)


if __name__ == '__main__':
    if '--guides' in sys.argv:
        guides('--force' in sys.argv)
        raise SystemExit(0)
    ids = [a for a in sys.argv[1:] if not a.startswith('-')]
    force = '--force' in sys.argv
    if not ids:
        raise SystemExit(__doc__)
    copy = titles(ids)
    for tool, values in copy.items():
        for locale, title in zip(['ko', 'en', 'ja'], values):
            path = OUT / f'{locale}-{tool}.png'
            if path.exists() and not force:
                print('kept', path.name)
                continue
            card(locale, title).save(path)
            print('wrote', path.name)
