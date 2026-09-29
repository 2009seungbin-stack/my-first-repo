"""Compose an original CC0 test comic from Pavel Kutejnikov's CC0 manga backgrounds.

The upstream archive is intentionally not vendored. It is available at
https://opengameart.org/content/manga-style-background (manga_bg.7z).
Expected extracted inputs: manga_bg_01.png, manga_bg_04.png, manga_bg_08.png.
The committed output is itself released CC0 by the Nerulio T8 implementation author.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'test-results' / 't8' / 'manga-bg-src'
OUT = Path(__file__).parent / 'comic-page.png'
W, H = 800, 3000
PAGE = Image.new('RGB', (W, H), '#f5f3ed')
D = ImageDraw.Draw(PAGE)
FONT = 'C:/Windows/Fonts/arial.ttf'
TITLE = ImageFont.truetype(FONT, 27)
D.text((31, 18), 'THE LAST SIGNAL  /  EPISODE TEST', font=TITLE, fill='#161616')

def panel(name, y, dialogue, bubble_x, actor_x, sfx=None):
    art = Image.open(SRC / name).convert('RGB')
    art = ImageOps.fit(art, (752, 850), method=Image.Resampling.LANCZOS, centering=(.5, .5))
    PAGE.paste(art, (24, y))
    dr = ImageDraw.Draw(PAGE)
    dr.rectangle((21, y-3, 779, y+853), outline='#111', width=6)
    # Original ink silhouette, deliberately simple and distinct from upstream art.
    ax, ay = actor_x, y+610
    dr.ellipse((ax-31, ay-72, ax+31, ay-10), fill='#090909')
    dr.polygon([(ax-44, ay-8), (ax+41, ay-8), (ax+64, ay+217), (ax-70, ay+217)], fill='#090909')
    dr.line((ax-53, ay+30, ax-98, ay+157), fill='#090909', width=19)
    dr.line((ax+45, ay+26, ax+88, ay+165), fill='#090909', width=19)
    x = bubble_x
    dr.rounded_rectangle((x, y+55, x+460, y+190), radius=60, fill='white', outline='#111', width=5)
    dr.polygon([(x+250, y+181), (x+340, y+180), (ax, ay-74)], fill='white')
    dr.line([(x+250, y+182), (ax, ay-74), (x+340, y+180)], fill='#111', width=4)
    dr.text((x+34, y+102), dialogue, font=ImageFont.truetype(FONT, 33), fill='#111')
    if sfx:
        dr.text((520, y+440), sfx, font=ImageFont.truetype(FONT, 61), fill='white', stroke_width=4, stroke_fill='#111')

panel('manga_bg_01.png', 70, 'The signal is gone.', 42, 625)
panel('manga_bg_04.png', 1060, 'Look above.', 285, 153, 'KLANG')
panel('manga_bg_08.png', 2050, "It's still here.", 45, 580)
PAGE.save(OUT, optimize=True)
print(OUT)
