"""Optional OFL-font stress check: real Hangul pixels through the bounded TTF writer.

Run with a separately downloaded Mulmaru TTF path. The font is not bundled.
This checks selected glyph masks and output limits. The 2,350-glyph atlas check
does not claim that an engine or physical phone can load it.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
REPERTOIRE = "import {ksX1001Hangul} from './src/game/font-hangul.js';console.log(JSON.stringify(ksX1001Hangul()))"
WRITE = """import fs from 'node:fs';import {renderFontProject} from './src/game/font-project.js';import {writePixelTtf} from './src/game/font-ttf.js';const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const a=renderFontProject(p);fs.writeFileSync(process.argv[2],writePixelTtf(p));console.log(JSON.stringify({width:a.width,height:a.height,glyphs:a.font.glyphs.length}));"""
ATLAS = """import fs from 'node:fs';import {renderFontProject} from './src/game/font-project.js';const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const limits=process.argv[2]==='compact'?{maxSide:2048,maxPixels:4194304}:{};const a=renderFontProject(p,limits);if(process.argv[3])fs.writeFileSync(process.argv[3],a.data);console.log(JSON.stringify({width:a.width,height:a.height,glyphs:a.font.glyphs.length}));"""


def sample_project(font_path, codes):
    font = ImageFont.truetype(str(font_path), 16)
    source = TTFont(font_path)
    supported = source.getBestCmap()
    glyphs = []
    for code in codes:
        assert code in supported, f'U+{code:04X} absent from source cmap'
        left, top, right, bottom = font.getbbox(chr(code), anchor='ls')
        assert 0 <= left + 2 <= right + 2 <= 24 and 0 <= 18 + top <= 18 + bottom <= 24, (code, left, top, right, bottom)
        image = Image.new('L', (24, 24))
        ImageDraw.Draw(image).text((2, 18), chr(code), font=font, fill=255, anchor='ls')
        glyphs.append({'codepoint': code, 'w': 24, 'h': 24, 'xOffset': -2,
                       'yOffset': 0, 'xAdvance': max(1, round(font.getlength(chr(code)))),
                       'pixels': [int(pixel > 127) for pixel in image.get_flattened_data()]})
    source.close()
    return {'format': 'nerulio-bitmap-font-project-v2', 'face': 'Local Hangul QA',
            'ascent': 18, 'descent': 6, 'lineHeight': 24,
            'glyphs': glyphs, 'kernings': []}


def reopen(path, project):
    font = TTFont(path)
    mapping = font.getBestCmap()
    assert set(mapping) == {g['codepoint'] for g in project['glyphs']}
    for source in project['glyphs']:
        outline = font['glyf'][mapping[source['codepoint']]]
        ink = set()
        if outline.numberOfContours:
            points, endpoints, _ = outline.getCoordinates(font['glyf'])
            first = 0
            for end in endpoints:
                contour = points[first:end + 1]
                first = end + 1
                assert len(contour) == 4
                xs = {x for x, _ in contour}
                ys = {y for _, y in contour}
                assert len(xs) == 2 and len(ys) == 2
                ink.add((min(xs) // 64, 18 - max(ys) // 64))
        expected = {(x - 2, y) for y in range(24) for x in range(24)
                    if source['pixels'][y * 24 + x]}
        assert ink == expected, f"U+{source['codepoint']:04X} outline differs"
    font.close()


def main(font_path):
    assert font_path.is_file(), font_path
    repertoire = json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e', REPERTOIRE], cwd=ROOT, text=True))
    with tempfile.TemporaryDirectory() as directory:
        tmp = Path(directory)
        for count in (128, 256, 512, 2350, 11172):
            codes = (list(range(0xAC00, 0xD7A4)) if count == 11172 else
                     [repertoire[round(i * (len(repertoire) - 1) / (count - 1))]
                      for i in range(count)])
            project = sample_project(font_path, codes)
            source = tmp / f'{count}.json'
            target = tmp / f'{count}.ttf'
            source.write_text(json.dumps(project), encoding='utf-8')
            if count > 512:
                raw_atlas = tmp / f'{count}.rgba'
                atlas = json.loads(subprocess.check_output(
                    ['node', '--input-type=module', '-e', ATLAS, str(source), 'desktop', str(raw_atlas)],
                    cwd=ROOT, text=True))
                image = Image.frombytes('RGBA', (atlas['width'], atlas['height']), raw_atlas.read_bytes())
                columns = atlas['width'] // 24
                for i, glyph in enumerate(project['glyphs']):
                    x, y = (i % columns) * 24, (i // columns) * 24
                    pixels = image.crop((x, y, x + 24, y + 24)).getchannel('A').get_flattened_data()
                    assert [int(pixel > 0) for pixel in pixels] == glyph['pixels'], glyph['codepoint']
                compact = subprocess.run(['node', '--input-type=module', '-e', ATLAS, str(source), 'compact'],
                                         cwd=ROOT, text=True, encoding='utf-8', capture_output=True)
                compact_result = (json.loads(compact.stdout) if compact.returncode == 0 else
                                  'blocked by 2048px side / 4194304 pixel guard')
                print(json.dumps({'glyphs': count, 'filledPixels': sum(sum(g['pixels']) for g in project['glyphs']),
                                  'status': 'atlas-only', 'atlas': atlas,
                                  'rawRgbaMiB': round(atlas['width'] * atlas['height'] * 4 / 1048576, 2),
                                  'compactGuard': compact_result},
                                 ensure_ascii=False))
                continue
            run = subprocess.run(['node', '--input-type=module', '-e', WRITE, str(source), str(target)],
                                 cwd=ROOT, text=True, encoding='utf-8', capture_output=True)
            filled = sum(sum(g['pixels']) for g in project['glyphs'])
            if run.returncode:
                errors = [line.strip() for line in run.stderr.splitlines() if 'Error:' in line]
                atlas = json.loads(subprocess.check_output(
                    ['node', '--input-type=module', '-e', ATLAS, str(source)], cwd=ROOT, text=True))
                print(json.dumps({'glyphs': count, 'filledPixels': filled, 'status': 'blocked',
                                  'atlas': atlas,
                                  'reason': errors[-1] if errors else run.stderr.strip()}, ensure_ascii=False))
                continue
            reopen(target, project)
            print(json.dumps({'glyphs': count, 'filledPixels': filled, 'status': 'reopened',
                              'atlas': json.loads(run.stdout), 'ttfBytes': target.stat().st_size},
                             ensure_ascii=False))


if __name__ == '__main__':
    main(Path(sys.argv[1]))
