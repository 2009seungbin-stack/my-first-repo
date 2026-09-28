"""Draw two original 15px component examples and render them with the production composer.

The contact sheet is an inspection aid, not a repertoire or legibility certification.
"""
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/t7-research/hangul-component-demo.png'
COMPOSE = """import fs from 'node:fs';import {composeHangulMask} from './src/game/font-hangul-compose.js';const kit=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify([composeHangulMask(0xac00,kit),composeHangulMask(0xac01,kit)]));"""


def hand_kit():
    size = 15
    def mask(points):
        data = [0] * (size * size)
        for x, y in points:
            data[y * size + x] = 1
        return data
    ga_leading = [(x, 3) for x in range(2, 7)] + [(6, y) for y in range(3, 12)]
    ga_vowel = [(10, y) for y in range(2, 13)] + [(x, 6) for x in range(10, 14)]
    gak_leading = [(x, 2) for x in range(2, 7)] + [(6, y) for y in range(2, 9)]
    gak_vowel = [(10, y) for y in range(1, 10)] + [(x, 5) for x in range(10, 14)]
    gak_trailing = [(x, 12) for x in range(3, 11)] + [(10, y) for y in range(12, 15)]
    return {'width': size, 'height': size,
            'leading': {'0': {'vertical-open': mask(ga_leading),
                              'vertical-final': mask(gak_leading)}},
            'vowel': {'0': {'open': mask(ga_vowel), 'final': mask(gak_vowel)}},
            'trailing': {'1': {'vertical': mask(gak_trailing)}}}


def main():
    kit = hand_kit()
    result = subprocess.run(['node', '--input-type=module', '-e', COMPOSE], cwd=ROOT,
                            input=json.dumps(kit), text=True, encoding='utf-8',
                            capture_output=True, check=True)
    made = json.loads(result.stdout)
    assert [item['codepoint'] for item in made] == [0xac00, 0xac01]
    assert all(item['collisions'] == 0 for item in made)
    sheet = Image.new('RGB', (360, 200), '#f6f7fa')
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(made):
        x = 15 + index * 170
        glyph = Image.new('RGB', (15, 15), 'white')
        pixels = glyph.load()
        for y in range(15):
            for column in range(15):
                if item['pixels'][y * 15 + column]:
                    pixels[column, y] = (21, 38, 56)
        sheet.paste(glyph.resize((150, 150), Image.Resampling.NEAREST), (x, 30))
        draw.text((x, 8), f'U+{item["codepoint"]:04X} hand template', fill='#253040')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f'{OUT}: 2 generated glyphs, 0 mask collisions; inspect visually')


if __name__ == '__main__':
    main()
