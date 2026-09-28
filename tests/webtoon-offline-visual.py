"""Optional independent SVG raster and comic-art visual oracle (requires CairoSVG).

This is deliberately separate from browser output verification. It renders the pure JS
effect SVGs through CairoSVG, composites them on the CC0 test comic with Pillow,
then writes and independently reopens an offline ZIP at 800 and 390 px display scales.
"""
import hashlib
import io
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

import cairosvg
from PIL import Image, ImageChops, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 't8' / 'offline-visual'
OUT.mkdir(parents=True, exist_ok=True)
COMIC = Image.open(ROOT / 'tests' / 'fixtures' / 'webtoon' / 'comic-page.png').convert('RGBA')
JS = """import {speedLines,speechBalloon,screentone} from './src/webtoon/effects.js';
console.log(JSON.stringify({speed:speedLines({width:800,height:1000,count:95,inner:.25,cx:.65,cy:.16,seed:74}),
balloon:speechBalloon({width:400,height:180,text:'STILL HERE!',shape:'shout',fontSize:32}),
tone:screentone({width:800,height:1000,ppi:300,lpi:60,density:.1,angle:45})}));"""
vectors = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', JS], cwd=ROOT).decode('utf-8'))
members = {}
for kind, svg in vectors.items():
    root = ET.fromstring(svg)
    assert root.tag == '{http://www.w3.org/2000/svg}svg'
    raster = cairosvg.svg2png(bytestring=svg.encode('utf-8'))
    overlay = Image.open(io.BytesIO(raster)).convert('RGBA')
    assert overlay.size == {'speed': (800, 1000), 'balloon': (400, 180), 'tone': (800, 1000)}[kind]
    assert overlay.getextrema()[3][0] == 0
    composite = COMIC.copy()
    # Demonstrate the masking a creator would do in their editor: the generator
    # exports a transparent overlay, not a claim that it auto-detects panel edges.
    if kind in ('speed', 'tone'):
        mask = Image.new('L', overlay.size, 0)
        ImageDraw.Draw(mask).rectangle((24, 62, 775, 929 if kind == 'speed' else 909), fill=255)
        overlay.putalpha(ImageChops.multiply(overlay.getchannel('A'), mask))
    composite.alpha_composite(overlay, {'speed': (0, 1000), 'balloon': (350, 2150), 'tone': (0, 2000)}[kind])
    merged = io.BytesIO()
    composite.convert('RGB').save(merged, format='PNG', optimize=True)
    members[f'{kind}.svg'] = svg.encode('utf-8')
    members[f'{kind}.png'] = raster
    members[f'comic-{kind}.png'] = merged.getvalue()
    # The production display scale is 800 px; this copy is a 390 px mobile readout.
    mobile = ImageOps.contain(composite.convert('RGB'), (390, 1500))
    mobile.save(OUT / f'comic-{kind}-390.png')
    (OUT / f'comic-{kind}-800.png').write_bytes(merged.getvalue())

path = OUT / 'cc0-comic-effects-offline.zip'
with ZipFile(path, 'w') as z:
    for name, data in members.items():
        z.writestr(name, data)
with ZipFile(path) as z:
    assert set(z.namelist()) == set(members)
    for name in z.namelist():
        payload = z.read(name)
        assert hashlib.sha256(payload).digest() == hashlib.sha256(members[name]).digest()
        if name.endswith('.png'):
            im = Image.open(io.BytesIO(payload))
            im.load()
            assert im.width > 0 and im.height > 0
        else:
            assert ET.fromstring(payload).tag.endswith('svg')
print('T8 offline CC0 comic SVG/CairoSVG/Pillow/ZIP oracle: PASS', len(members), 'members', path.stat().st_size, 'bytes')
