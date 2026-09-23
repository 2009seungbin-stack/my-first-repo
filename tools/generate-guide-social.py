"""Social cards for the guides (src/guides.js): assets/social/<locale>-guide-<slug>.png for every
guide and <locale>-guides.png for the /guides/ index, 1200x630, in the dark game-home palette.

Reuses the fonts of tools/generate-social.py. Titles come from src/guides.js, so the card and the
page cannot drift apart. Usage: python tools/generate-guide-social.py [--force]
Existing files are kept unless --force is given.
"""
import importlib.util, json, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('generate_social', ROOT / 'tools' / 'generate-social.py')
social = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(social)
font, FONTS, LIGHT, OUT = social.font, social.FONTS, social.LIGHT, social.OUT
BG, INK, MUTED, ACCENT = (19, 21, 24, 255), (238, 240, 243, 255), (158, 165, 175, 255), (76, 194, 255, 255)
KICKER = {'ko': '게임 개발 가이드', 'en': 'GAME DEV GUIDE', 'ja': 'ゲーム開発ガイド'}


def copy():
    script = ("import {GUIDES,GUIDE_ENGINES} from './src/guides.js';import {COPY} from './tools/guides-build.mjs';"
              "console.log(JSON.stringify({guides:GUIDES.map(g=>({slug:g.slug,title:g.title,engines:g.engines.map(e=>GUIDE_ENGINES[e]||e)})),"
              "index:Object.fromEntries(['ko','en','ja'].map(l=>[l,COPY[l].guides]))}));")
    out = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def lines_of(draw, text, fnt, width, locale):
    """Greedy wrap: Latin and Korean words stay whole, Japanese may break between characters."""
    tokens = re.findall(r'\S+\s*', text) if locale != 'ja' else re.findall(r"[A-Za-z0-9.'’/+\-]+\s*|\S\s*|\s+", text)
    out, line = [], ''
    for tok in tokens:
        if not line or draw.textlength(line + tok, font=fnt) <= width or tok.strip() in {'·', '—', '・', '、', '。', ')', '）', ':', '：'}:
            line += tok
        else:
            out.append(line.rstrip()); line = tok
    if line:
        out.append(line.rstrip())
    return out


def card(locale, title, meta, kicker=True):
    im = Image.new('RGBA', (1200, 630), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((60, 65, 131, 72), fill=ACCENT)
    if kicker: d.text((60, 128), KICKER[locale], font=font(FONTS[locale], 26, True), fill=ACCENT, anchor='ls')
    size = 62
    while True:
        fnt = font(FONTS[locale], size, True)
        lines = lines_of(d, title, fnt, 1080, locale)
        if len(lines) <= 3 or size <= 38:
            break
        size -= 4
    y = 222
    for line in lines[:3]:
        d.text((60, y), line, font=fnt, fill=INK, anchor='ls'); y += round(size * 1.28)
    if meta:
        d.text((60, 512), meta, font=font(LIGHT[locale], 26, False), fill=MUTED, anchor='ls')
    d.text((60, 575), 'Nerulio', font=font(FONTS['en'], 34, True), fill=ACCENT, anchor='ls')
    return im.convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


if __name__ == '__main__':
    force = '--force' in sys.argv
    data = copy()
    jobs = [(f'{l}-guides.png', l, data['index'][l], 'Godot · Unity · Phaser · PixiJS · Defold · LÖVE · GameMaker') for l in ['ko', 'en', 'ja']]
    jobs += [(f"{l}-guide-{g['slug']}.png", l, g['title'][l], ' · '.join(g['engines'])) for g in data['guides'] for l in ['ko', 'en', 'ja']]
    for name, locale, title, meta in jobs:
        index = name.endswith('-guides.png')
        path = OUT / name
        if path.exists() and not force:
            print('kept', name); continue
        card(locale, title, meta, kicker=not index).save(path, optimize=True)
        print('wrote', name)
