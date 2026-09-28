"""Focused local UI and independent ZIP re-open gate for Bitmap Font Maker 2."""
import io
import base64
import hashlib
import json
import re
import struct
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image
from fontTools.ttLib import TTFont
from playwright.sync_api import sync_playwright
from font_hangul_visual import hand_kit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 't7-browser'
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4707'
NODE_EXPORT = """import fs from 'node:fs';import {parseBdf} from './src/game/font-bdf.js';import {projectFromBdf,renderFontProject} from './src/game/font-project.js';import {fntText,fntXml,fntBinary} from './src/game/bmfont.js';import {writePixelTtf} from './src/game/font-ttf.js';const project=projectFromBdf(parseBdf(fs.readFileSync(process.argv[1],'utf8')));const atlas=renderFontProject(project);const b=x=>Buffer.from(x).toString('base64');process.stdout.write(JSON.stringify({project,font:atlas.font,atlas:b(atlas.data),text:fntText(atlas.font),xml:fntXml(atlas.font),binary:b(fntBinary(atlas.font)),ttf:b(writePixelTtf(project))}));"""
NODE_SHEET = """import fs from 'node:fs';import {projectFromGrid,renderFontProject} from './src/game/font-project.js';const input=JSON.parse(fs.readFileSync(0,'utf8'));const source=Buffer.from(input.data,'base64');const project=projectFromGrid(source,input.width,input.height,{cellW:8,cellH:12,chars:input.chars,baseline:9});const atlas=renderFontProject(project);process.stdout.write(JSON.stringify({project,font:atlas.font,atlas:Buffer.from(atlas.data).toString('base64')}));"""


def binary_records(raw):
    assert raw[:4] == b'BMF\x03'
    pos = 4
    blocks = {}
    while pos < len(raw):
        ident, length = struct.unpack_from('<BI', raw, pos)
        pos += 5
        assert pos + length <= len(raw)
        blocks[ident] = raw[pos:pos + length]
        pos += length
    assert pos == len(raw)
    assert len(blocks[4]) % 20 == 0 and len(blocks[5]) % 10 == 0
    chars = [struct.unpack_from('<IHHHHhhhBB', blocks[4], i)
             for i in range(0, len(blocks[4]), 20)]
    kernings = [struct.unpack_from('<IIh', blocks[5], i)
                for i in range(0, len(blocks[5]), 10)]
    return chars, kernings


def verify_zip(path, expected_count=192):
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        assert {'font.png', 'font.fnt', 'font.xml', 'font-binary.fnt',
                'font.json', 'font-project.json', 'font.ttf'} <= names, names
        project = json.loads(archive.read('font-project.json'))
        font = json.loads(archive.read('font.json'))
        image = Image.open(io.BytesIO(archive.read('font.png'))).convert('RGBA')
        assert image.size == (font['width'], font['height'])
        xml = ET.fromstring(archive.read('font.xml'))
        xml_chars = {int(node.attrib['id']): node.attrib for node in xml.findall('./chars/char')}
        assert len(xml_chars) == len(font['glyphs']) == len(project['glyphs']) == expected_count
        binary_chars, binary_kernings = binary_records(archive.read('font-binary.fnt'))
        by_cp = {g['codepoint']: g for g in project['glyphs']}
        for index, metric in enumerate(font['glyphs']):
            cp = metric['codepoint']
            original = by_cp[cp]
            expected = (cp, metric['x'], metric['y'], metric['w'], metric['h'],
                        metric['xOffset'], metric['yOffset'], metric['xAdvance'], 0, 15)
            assert binary_chars[index] == expected, (cp, binary_chars[index], expected)
            xc = xml_chars[cp]
            assert tuple(int(xc[key]) for key in
                         ('id', 'x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance', 'page', 'chnl')) == expected
            crop = image.crop((metric['x'], metric['y'], metric['x'] + metric['w'], metric['y'] + metric['h']))
            assert [1 if pixel[3] else 0 for pixel in crop.get_flattened_data()] == original['pixels'], cp
        assert len(binary_kernings) == len(font['kernings'])
        text = archive.read('font.fnt').decode('utf-8')
        assert int(re.search(r'chars count=(\d+)', text).group(1)) == expected_count
        assert len(re.findall(r'^char id=', text, re.M)) == expected_count
        ttf = TTFont(io.BytesIO(archive.read('font.ttf')))
        assert ttf.sfntVersion == '\x00\x01\x00\x00'
        assert set(ttf.getBestCmap()) == set(by_cp)
        ttf.close()
    return project


def model_only():
    """Exercise real CC0 BDF through the production writers without launching a browser."""
    OUT.mkdir(parents=True, exist_ok=True)
    for source in ('sq.bdf', 'sqb.bdf'):
        result = subprocess.run(['node', '--input-type=module', '-e', NODE_EXPORT,
                                 str(ROOT / 'tests/fixtures/font-maker' / source)],
                                cwd=ROOT, check=True, capture_output=True, text=True, encoding='utf-8')
        data = json.loads(result.stdout)
        image = Image.frombytes('RGBA', (data['font']['width'], data['font']['height']),
                                base64.b64decode(data['atlas']))
        png = io.BytesIO()
        image.save(png, format='PNG')
        target = OUT / f'{source}-model-export.zip'
        with zipfile.ZipFile(target, 'w') as archive:
            for name, value in [('font.png', png.getvalue()), ('font.fnt', data['text'].encode()),
                                ('font.xml', data['xml'].encode()),
                                ('font-binary.fnt', base64.b64decode(data['binary'])),
                                ('font.json', json.dumps(data['font']).encode()),
                                ('font-project.json', json.dumps(data['project']).encode()),
                                ('font.ttf', base64.b64decode(data['ttf']))]:
                archive.writestr(name, value)
        verify_zip(target)
        print(f'PASS: {source} 192 glyphs reopened as PNG, BMFont text/XML/binary, project JSON and TTF')
    source = ROOT / 'tests/fixtures/game/corpus/fonts/bellanger-font.png'
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == 'eac5d8f06c5838733f73db668d4bee2f60ae0f3d32442ef7444eb8c2621c5a43'
    image = Image.open(io.BytesIO(raw)).convert('RGBA')
    chars = ''.join(chr(code) for code in range(32, 127))
    payload = {'width': image.width, 'height': image.height,
               'data': base64.b64encode(image.tobytes()).decode(), 'chars': chars}
    result = subprocess.run(['node', '--input-type=module', '-e', NODE_SHEET], cwd=ROOT,
                            input=json.dumps(payload), check=True, capture_output=True,
                            text=True, encoding='utf-8')
    converted = json.loads(result.stdout)
    atlas = Image.frombytes('RGBA', (converted['font']['width'], converted['font']['height']),
                            base64.b64decode(converted['atlas']))
    assert len(converted['project']['glyphs']) == 95
    for index, metric in enumerate(converted['font']['glyphs']):
        source_cell = image.crop(((index % 16) * 8, (index // 16) * 12,
                                  (index % 16 + 1) * 8, (index // 16 + 1) * 12))
        result_cell = atlas.crop((metric['x'], metric['y'], metric['x'] + 8, metric['y'] + 12))
        assert [p[3] > 8 for p in source_cell.get_flattened_data()] == [p[3] > 8 for p in result_cell.get_flattened_data()], index
    assert source.read_bytes() == raw
    print('PASS: CC0 Bellanger PNG 95-cell sheet copied into editable v2 atlas with all source alpha masks unchanged')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for locale in ('en', 'ko', 'ja'):
            ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True,
                                      has_touch=locale == 'ko', is_mobile=locale == 'ko')
            page = ctx.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'{BASE}/{locale}/bitmap-font-maker/app/', wait_until='networkidle')
            page.locator('#fontBdf').set_input_files(str(ROOT / 'tests/fixtures/font-maker/sq.bdf'))
            page.locator('#fontGlyph option').first.wait_for()
            assert page.locator('#fontGlyph option').count() == 192
            assert page.locator('#fontSummary').inner_text().startswith('192')
            page.locator('#fontPreviewText').fill('AV□')
            assert 'U+25A1' in page.locator('#fontCoverage').inner_text()
            page.screenshot(path=str(OUT / f'font-{locale}-390.png'), full_page=True)
            assert not errors, errors
            if locale == 'ko':
                page.locator('#fontEditCanvas').scroll_into_view_if_needed()
                box = page.locator('#fontEditCanvas').bounding_box()
                page.touchscreen.tap(box['x'] + 5, box['y'] + 5)
                assert page.locator('[data-action="ui-font-undo"]').is_enabled()
            if locale == 'en':
                page.locator('#fontGlyph').select_option('65')
                page.locator('#fontEditCanvas').click(position={'x': 5, 'y': 5})
                assert page.locator('[data-action="ui-font-undo"]').is_enabled()
                page.locator('#fontEditCanvas').focus()
                page.keyboard.press('ArrowRight')
                page.keyboard.press('Space')
                assert page.locator('#fontEditCanvas').evaluate('(element) => document.activeElement === element')
                page.keyboard.press('Control+z')
                assert page.locator('#fontEditCanvas').evaluate('(element) => document.activeElement === element')
                page.locator('[data-action="ui-font-undo"]').click()
                page.locator('[data-action="ui-font-redo"]').click()
                page.locator('#optionsAdvanced').evaluate('(element) => { element.open = true }')
                page.locator('#fontKerningPair').fill('AV')
                page.locator('#fontKerningAmount').fill('-2')
                page.locator('[data-action="ui-font-kerning"]').click()
                with page.expect_download() as got:
                    page.locator('[data-action="ui-export-font"]').click()
                target = OUT / 'font-bdf-export.zip'
                got.value.save_as(target)
                project = verify_zip(target)
                assert project['kernings'] == [{'first': 65, 'second': 86, 'amount': -2}]
                with zipfile.ZipFile(target) as saved:
                    ttf_base64 = base64.b64encode(saved.read('font.ttf')).decode()
                loaded = page.evaluate('''async encoded => {
                    const bytes=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0));
                    const face=new FontFace('Nerulio T7 QA',bytes);await face.load();document.fonts.add(face);
                    const canvas=document.createElement('canvas');canvas.width=80;canvas.height=32;
                    const context=canvas.getContext('2d');context.font='15px "Nerulio T7 QA"';
                    context.fillStyle='black';context.fillText('AV',0,16);
                    return {status:face.status,ink:[...context.getImageData(0,0,80,32).data].filter((_,i)=>i%4===3).some(a=>a>0)};
                }''', ttf_base64)
                assert loaded == {'status': 'loaded', 'ink': True}, loaded
                ctx2 = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
                p2 = ctx2.new_page()
                p2.goto(f'{BASE}/en/bitmap-font-maker/app/', wait_until='networkidle')
                p2.locator('#fontProjectFile').set_input_files(
                    {'name': 'font-project.json', 'mimeType': 'application/json',
                     'buffer': json.dumps(project).encode('utf-8')})
                p2.locator('#fontGlyph option').first.wait_for()
                assert p2.locator('#fontGlyph option').count() == 192
                p2.screenshot(path=str(OUT / 'font-en-1440.png'), full_page=True)
                p2.locator('#hangulComposer').evaluate('(element) => { element.open = true }')
                p2.locator('#fontHangulCanvas').click(position={'x': 5, 'y': 5})
                p2.locator('#fontHangulPart').select_option('vowel')
                p2.locator('#fontHangulCanvas').click(position={'x': 5, 'y': 5})
                assert '1 overlapping' in p2.locator('#fontHangulStatus').inner_text()
                p2.locator('[data-action="ui-font-hangul-apply"]').click()
                assert p2.locator('#fontGlyph option').count() == 193
                p2.locator('[data-action="ui-font-undo"]').click()
                assert p2.locator('#fontGlyph option').count() == 192
                p2.locator('[data-action="ui-font-redo"]').click()
                assert p2.locator('#fontGlyph option').count() == 193
                with p2.expect_download() as got_composed:
                    p2.locator('[data-action="ui-export-font"]').click()
                composed_zip = OUT / 'font-hangul-composed.zip'
                got_composed.value.save_as(composed_zip)
                composed = verify_zip(composed_zip, 193)
                assert composed['hangulTemplates']['leading']['0']['vertical-open'][0] == 1
                assert composed['hangulTemplates']['vowel']['0']['open'][0] == 1
                assert composed['glyphs'][-1]['codepoint'] == 0xac00
                p2.screenshot(path=str(OUT / 'font-hangul-composer-1440.png'), full_page=True)
                ctx2.close()
                ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
                p3 = ctx3.new_page()
                p3.goto(f'{BASE}/en/bitmap-font-maker/app/', wait_until='networkidle')
                visual_project = {**project, 'hangulTemplates': hand_kit()}
                p3.locator('#fontProjectFile').set_input_files(
                    {'name': 'hand-kit.json', 'mimeType': 'application/json',
                     'buffer': json.dumps(visual_project).encode('utf-8')})
                p3.locator('#hangulComposer').evaluate('(element) => { element.open = true }')
                assert '0 overlapping' in p3.locator('#fontHangulStatus').inner_text()
                p3.screenshot(path=str(OUT / 'font-hangul-handkit-390.png'), full_page=True)
                p3.locator('[data-action="ui-font-hangul-apply"]').click()
                with p3.expect_download() as got_handkit:
                    p3.locator('[data-action="ui-export-font"]').click()
                handkit_zip = OUT / 'font-hangul-handkit.zip'
                got_handkit.value.save_as(handkit_zip)
                handkit_project = verify_zip(handkit_zip, 193)
                glyph = next(g for g in handkit_project['glyphs'] if g['codepoint'] == 0xac00)
                kit = hand_kit()
                assert glyph['pixels'] == [int(a or b) for a, b in zip(
                    kit['leading']['0']['vertical-open'], kit['vowel']['0']['open'])]
                ctx3.close()
            ctx.close()
        mulmaru = ROOT / 'test-results/t7-research/mulmaru/unpacked/Mulmaru.ttf'
        if mulmaru.exists():
            ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
            page = ctx.new_page()
            page.goto(f'{BASE}/ko/bitmap-font-maker/app/', wait_until='networkidle')
            page.locator('#fontFile').set_input_files(str(mulmaru))
            page.locator('#rc-chars').fill('가각힣')
            page.locator('#fontSummary').get_by_text('3', exact=True).wait_for()
            page.locator('[data-action="ui-font-new"]').click()
            assert page.locator('#fontGlyph option').count() == 3
            with page.expect_download() as got:
                page.locator('[data-action="ui-export-font"]').click()
            target = OUT / 'mulmaru-ko3-edited.zip'
            got.value.save_as(target)
            with zipfile.ZipFile(target) as saved:
                font = TTFont(io.BytesIO(saved.read('font.ttf')))
                assert set(font.getBestCmap()) == {0xac00, 0xac01, 0xd7a3}
                font.close()
                assert len(json.loads(saved.read('font-project.json'))['glyphs']) == 3
            page.screenshot(path=str(OUT / 'font-ko-mulmaru-390.png'), full_page=True)
            ctx.close()
        browser.close()
    print('PASS: ko/en/ja BDF UI, edit/undo/redo/kerning/coverage, independent PNG/text/XML/binary/TTF re-open, v2 reload; optional OFL Hangul subset')


if __name__ == '__main__':
    model_only() if len(sys.argv) > 1 and sys.argv[1] == '--model-only' else main()
