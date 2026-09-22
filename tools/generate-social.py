"""Social cards (assets/social/<locale>-<id>.png, 1200x630) for tool intents.

Every intent needs one per locale (tests/growth.test.mjs checks the dimensions and that the
document references it). Titles come from src/messages.js, so the card and the page cannot
drift apart. Usage: python tools/generate-social.py ui-lab 9-slice-editor ...
Existing files are never overwritten unless --force is given.
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


if __name__ == '__main__':
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
