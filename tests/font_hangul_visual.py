"""Draw two original 15px component examples and render them with the production composer.

The contact sheet is an inspection aid, not a repertoire or legibility certification.
"""
import json
import base64
import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/t7-research/hangul-component-demo.png'
COMPOSE = """import fs from 'node:fs';import {composeHangulMask} from './src/game/font-hangul-compose.js';const kit=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify([composeHangulMask(0xac00,kit),composeHangulMask(0xac01,kit)]));"""
PROJECT = """import fs from 'node:fs';import {parseBdf} from './src/game/font-bdf.js';import {projectFromBdf,applyHangulComposition,renderFontProject} from './src/game/font-project.js';import {writePixelTtf} from './src/game/font-ttf.js';const p=projectFromBdf(parseBdf(fs.readFileSync('tests/fixtures/font-maker/sq.bdf','utf8')));p.hangulTemplates=JSON.parse(fs.readFileSync(0,'utf8'));for(const c of [0xac00,0xac01])applyHangulComposition(p,c);const a=renderFontProject(p);console.log(JSON.stringify({glyphs:p.glyphs.filter(g=>g.codepoint===0xac00||g.codepoint===0xac01),ascent:p.ascent,atlas:{width:a.width,height:a.height,count:a.font.glyphs.length},ttf:Buffer.from(writePixelTtf(p)).toString('base64')}));"""


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
    round_trip = subprocess.run(['node', '--input-type=module', '-e', PROJECT], cwd=ROOT,
                                input=json.dumps(kit), text=True, encoding='utf-8',
                                capture_output=True, check=True)
    exported = json.loads(round_trip.stdout)
    assert exported['atlas']['count'] == 194
    font = TTFont(io.BytesIO(base64.b64decode(exported['ttf'])))
    cmap = font.getBestCmap()
    for source in exported['glyphs']:
        outline = font['glyf'][cmap[source['codepoint']]]
        coordinates, endpoints, _ = outline.getCoordinates(font['glyf'])
        actual = set()
        first = 0
        for end in endpoints:
            rect = coordinates[first:end + 1]
            first = end + 1
            assert len(rect) == 4
            actual.add((min(x for x, _ in rect) // 64,
                        exported['ascent'] - max(y for _, y in rect) // 64))
        expected = {(x, y) for y in range(15) for x in range(15)
                    if source['pixels'][y * 15 + x]}
        assert actual == expected, source['codepoint']
    font.close()
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
    print(f'{OUT}: 2 generated glyphs, 0 mask collisions; v2 atlas has 194 glyphs and TTF outlines reopen; inspect visually')


if __name__ == '__main__':
    main()
