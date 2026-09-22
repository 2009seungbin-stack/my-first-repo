"""Derived evaluation assets for tools/eval-game-engines.mjs, built only from CC0 packs.

The real packs (Kenney, OpenGameArt CC0, ambientCG) are downloaded by hand into the corpus
folder listed in its SOURCES.md; this script never downloads anything. It composes the cases the
packs do not contain on their own — a colour-keyed sheet with a margin and spacing, a 4096² sheet
with detached sparks, resampled upscales — from those real pixels, so every case has a ground
truth that is known by construction.

    python tools/eval-game-assets.py [corpus-dir]

corpus-dir defaults to %USERPROFILE%/nerulio-asset-corpus/_adhoc/nerulio-trust-fixes.
"""
import os, sys, json
from pathlib import Path
from PIL import Image

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'nerulio-asset-corpus' / '_adhoc' / 'nerulio-trust-fixes')
X, OUT = ROOT / 'x', ROOT / 'derived'
OUT.mkdir(exist_ok=True)
truth = {}


def keyed(src, cell, cols, rows, colour, margin, spacing, name):
    """Re-lays a packed grid sheet on a solid key colour with a margin and spacing."""
    im = Image.open(src).convert('RGBA')
    w, h = margin * 2 + cols * cell[0] + (cols - 1) * spacing, margin * 2 + rows * cell[1] + (rows - 1) * spacing
    out = Image.new('RGBA', (w, h), colour + (255,))
    frames = 0
    for r in range(rows):
        for c in range(cols):
            tile = im.crop((c * cell[0], r * cell[1], (c + 1) * cell[0], (r + 1) * cell[1]))
            if tile.getbbox() is None:
                continue
            frames += 1
            bg = Image.new('RGBA', cell, colour + (255,))
            bg.alpha_composite(tile)
            out.paste(bg, (margin + c * (cell[0] + spacing), margin + r * (cell[1] + spacing)))
    out.convert('RGB').save(OUT / name)
    truth[name] = {'cell': list(cell), 'margin': margin, 'spacing': spacing, 'key': list(colour), 'frames': frames}


keyed(X / 'pixel-platformer/Tilemap/tilemap-characters_packed.png', (24, 24), 9, 3, (255, 0, 255), 2, 1, 'pp_chars_magenta_m2_s1.png')
keyed(X / 'tiny-dungeon/Tilemap/tilemap_packed.png', (16, 16), 12, 11, (0, 255, 255), 3, 2, 'td_cyan_m3_s2.png')
keyed(X / 'pixel-shmup/Tilemap/ships_packed.png', (32, 32), 4, 6, (34, 32, 52), 0, 0, 'shmup_dark_m0_s0.png')

# 4096² sheet of real character frames with 16px spacing; every 7th frame gets a detached 2×2
# spark in the cell's top-left corner (where the Kenney poses never reach), like a hit FX.
sheet = Image.open(X / 'platformer-characters/PNG/Player/player_tilesheet.png').convert('RGBA')
poses = [sheet.crop((c * 80, r * 110, c * 80 + 80, r * 110 + 110)) for r in range(3) for c in range(9)]
poses = [p for p in poses if p.getbbox()]
big = Image.new('RGBA', (4096, 4096), (0, 0, 0, 0))
cols, rows, n, sparks = (4096 + 16) // 96, (4096 + 16) // 126, 0, 0
for r in range(rows):
    for c in range(cols):
        x, y = c * 96, r * 126
        big.alpha_composite(poses[n % len(poses)], (x, y))
        if n % 7 == 0:
            for dx in range(2):
                for dy in range(2):
                    big.putpixel((x + dx, y + dy), (255, 214, 90, 255))
            sparks += 1
        n += 1
big.save(OUT / 'big_4096_players.png')
truth['big_4096_players.png'] = {'frames': n, 'sparks': sparks, 'sparkPixels': sparks * 4}

# Upscales of real pixel art: exact integer, integer-but-smoothed, and non-integer.
art = Image.open(X / 'tiny-dungeon/Tilemap/tilemap_packed.png').convert('RGBA').crop((0, 112, 96, 176))
art.save(OUT / 'td_1x.png')
art.resize((art.width * 3, art.height * 3), Image.NEAREST).save(OUT / 'td_x3_nearest.png')
art.resize((art.width * 4, art.height * 4), Image.BILINEAR).save(OUT / 'td_x4_bilinear.png')
art.resize((round(art.width * 3.78), round(art.height * 3.78)), Image.BILINEAR).save(OUT / 'td_x3.78_bilinear.png')
art.resize((round(art.width * 2.5), round(art.height * 2.5)), Image.NEAREST).save(OUT / 'td_x2.5_nearest.png')
art.resize((art.width * 4, art.height * 4), Image.NEAREST).resize((round(art.width * 4 * 121 / 128), round(art.height * 4 * 121 / 128)), Image.BILINEAR).save(OUT / 'td_x4_then_bilinear.png')
truth.update({
    'td_1x.png': {'scale': 1, 'smoothed': False, 'integer': True},
    'td_x3_nearest.png': {'scale': 3, 'smoothed': False, 'integer': True},
    'td_x4_bilinear.png': {'scale': 4, 'smoothed': True, 'integer': True},
    'td_x3.78_bilinear.png': {'scale': 3.78, 'smoothed': True, 'integer': False},
    'td_x2.5_nearest.png': {'scale': 2.5, 'smoothed': False, 'integer': False},
    'td_x4_then_bilinear.png': {'scale': round(4 * 121 / 128, 3), 'smoothed': True, 'integer': False},
})
json.dump(truth, open(OUT / 'truth.json', 'w'), indent=1)
print('wrote', len(truth), 'derived assets to', OUT)
