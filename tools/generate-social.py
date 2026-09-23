"""Social cards (assets/social/<locale>-<id>.png, 1200x630) for tool intents.

Every intent needs one per locale (tests/growth.test.mjs checks the dimensions and that the
document references it). Titles come from src/messages.js, so the card and the page cannot
drift apart. Usage: python tools/generate-social.py ui-lab 9-slice-editor ...
Existing files are never overwritten unless --force is given.
"""
import json, re, subprocess, sys
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


GAME_BG, GAME_INK, GAME_MUTED, GAME_ACCENT = (15, 17, 22, 255), (233, 236, 242, 255), (143, 153, 171, 255), (76, 194, 255, 255)
STATUS_COLOR = {'verified': (62, 207, 142, 255), 'built': (177, 140, 255, 255), 'decoded': (86, 199, 193, 255), 'partial': (232, 195, 90, 255), 'unverified': (255, 159, 67, 255)}
GAME_SUB = {'ko': '게임 에셋 스튜디오 · 브라우저에서 처리', 'en': 'Game asset studio · runs in your browser', 'ja': 'ゲームアセットスタジオ · ブラウザで処理'}


def game_pages():
    """Every game landing (src/game-seo.js) with its card stem, titles, screenshot and engine rows."""
    script = ("import {GAME_INTENT_PAGES,GAME_KEYWORD_PAGES,HUB,SHOTS,SPRITE_EXPORTS,TILE_EXPORTS,STATUS} from './src/game-seo.js';"
              "const rows=ws=>(ws==='tile'?TILE_EXPORTS:SPRITE_EXPORTS).map(r=>({name:r.name,status:r.status,label:STATUS[r.status]}));"
              "const out=[{stem:'game',shot:SHOTS['sprite-frame'].file,title:{ko:HUB.ko.title,en:HUB.en.title,ja:HUB.ja.title},rows:rows('sprite')}];"
              "for(const [id,p] of Object.entries(GAME_INTENT_PAGES))out.push({stem:id,shot:SHOTS[p.shot].file,title:{ko:p.copy.ko.title,en:p.copy.en.title,ja:p.copy.ja.title},rows:rows(p.ws),hl:p.highlight||[]});"
              "for(const [k,p] of Object.entries(GAME_KEYWORD_PAGES))out.push({stem:k.replaceAll('/','-'),shot:SHOTS[p.shot].file,title:{ko:p.copy.ko.title,en:p.copy.en.title,ja:p.copy.ja.title},rows:rows(p.ws)});"
              "console.log(JSON.stringify(out));")
    out = subprocess.run(['node', '--input-type=module', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)


def wrap(d, text, f, width, locale='en'):
    """Greedy line wrap; CJK text may break between any two characters."""
    lines, line = [], ''
    # Latin words stay whole; CJK characters break anywhere; separators never start a line.
    tokens = re.findall(r'\S+\s*', text) if locale == 'ko' else re.findall(r"[A-Za-z0-9.'’/+\-]+\s*|\S\s*|\s+", text)
    for tok in tokens:
        if d.textlength(line + tok, font=f) <= width or not line or tok.strip() in {'·', '—', '・', '、', '）', ')', '→'}:
            line += tok
        else:
            lines.append(line.rstrip()); line = tok
    if line:
        lines.append(line.rstrip())
    return lines


def game_card(locale, page):
    """Dark card: title and verified engines on the left, a crop of the real Studio on the right."""
    im = Image.new('RGBA', (1200, 630), GAME_BG)
    shot = Image.open(ROOT / 'assets' / 'studio' / f'{page["shot"]}.webp').convert('RGBA')
    shot = shot.crop((40, 30, 1140, 880)).resize((550, 425), Image.LANCZOS)
    im.paste(shot, (620, 105))
    d = ImageDraw.Draw(im)
    d.rectangle((619, 104, 1170, 530), outline=(52, 60, 79, 255), width=1)
    for i, c in enumerate([GAME_ACCENT, (255, 77, 94, 255), (255, 210, 63, 255), (62, 207, 142, 255)]):
        x, y = 60 + (i % 2) * 17, 60 + (i // 2) * 17
        d.rectangle((x, y, x + 13, y + 13), fill=c)
    size = 50
    while True:
        f = font(FONTS[locale], size, True)
        lines = wrap(d, page['title'][locale], f, 520, locale)
        if len(lines) <= 4 or size <= 34:
            break
        size -= 4
    y = 150
    for line in lines[:4]:
        d.text((60, y), line, font=f, fill=GAME_INK, anchor='ls'); y += round(size * 1.22)
    d.text((60, y + 18), GAME_SUB[locale], font=font(LIGHT[locale], 22, False), fill=GAME_MUTED, anchor='ls')
    chip = font(FONTS['en'], 17, True); x, cy = 60, 470
    rows = sorted(page['rows'], key=lambda r: (r['name'] not in page.get('hl', []), r['status'] != 'verified'))
    for r in rows[:6]:
        w = d.textlength(r['name'], font=chip) + 26
        if x + w > 590:
            x, cy = 60, cy + 40
            if cy > 520:
                break
        d.rounded_rectangle((x, cy - 24, x + w, cy + 6), radius=7, fill=(24, 28, 38, 255), outline=(39, 45, 59, 255))
        d.rectangle((x, cy - 24, x + 3, cy + 6), fill=STATUS_COLOR[r['status']])
        d.text((x + 14, cy - 3), r['name'], font=chip, fill=GAME_INK, anchor='ls'); x += w + 8
    d.text((60, 590), 'Nerulio', font=font(FONTS['en'], 30, True), fill=GAME_ACCENT, anchor='ls')
    # Screenshots quantize well; keeps each card small in the repository.
    return im.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


if __name__ == '__main__' and '--game' in sys.argv:
    # python tools/generate-social.py --game [--force]: one dark card per game landing and locale.
    force = '--force' in sys.argv
    for page in game_pages():
        for locale in ['ko', 'en', 'ja']:
            path = OUT / f'{locale}-{page["stem"]}.png'
            if path.exists() and not force:
                print('kept', path.name); continue
            game_card(locale, page).save(path, optimize=True)
            print('wrote', path.name, path.stat().st_size)
    raise SystemExit(0)

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
