"""Prepare independent CC0 BDF glyph expectations for the real engine verifier.

Run after `bitmap-font-maker-browser.py --model-only`. This script does not run engines.
The input ZIP is reopened with zipfile; expected shapes come separately from Pillow's
BDF reader, not the Nerulio model or atlas writer.
"""
import json
import zipfile
from pathlib import Path
from PIL import BdfFontFile, Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 't7-engine'
SOURCE = ROOT / 'tests' / 'fixtures' / 'font-maker' / 'sq.bdf'
ZIP = ROOT / 'test-results' / 't7-browser' / 'sq.bdf-model-export.zip'
GLYPHS = 'AVij?!0é'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bdf = BdfFontFile.BdfFontFile(open(SOURCE, 'rb'))
    expected = {}
    for ch in GLYPHS:
        entry = bdf.glyph[ord(ch)]
        assert entry is not None, ch
        mask = entry[3].convert('L')
        image = Image.new('RGBA', mask.size, (255, 255, 255, 0))
        image.putalpha(mask)
        target = OUT / f'expected-{ord(ch):04x}.png'
        image.save(target)
        expected[ch] = str(target)
    with zipfile.ZipFile(ZIP) as archive:
        for name, descriptor in [('godot-text', 'font.fnt'), ('phaser-xml', 'font.xml')]:
            folder = OUT / name
            folder.mkdir(exist_ok=True)
            (folder / 'font.png').write_bytes(archive.read('font.png'))
            (folder / descriptor).write_bytes(archive.read(descriptor))
            (folder / 'expect.json').write_text(json.dumps({'font': {'chars': expected, 'size': 15,
                                                                  'sample': 'AVij!?'}}, indent=2), encoding='utf-8')
    print('Prepared Godot BMFont text and Phaser XML bundles with eight independent BDF glyph references.')


if __name__ == '__main__':
    main()
