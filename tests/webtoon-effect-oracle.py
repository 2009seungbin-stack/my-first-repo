"""Independent XML parser for generated comic overlays; no browser required."""
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = """import {speedLines,speechBalloon,screentone} from './src/webtoon/effects.js';
console.log(JSON.stringify([
speedLines({width:4096,height:2160,count:260,seed:413}),
speechBalloon({width:800,height:400,shape:'shout',text:'안녕 <script> & こんにちは',fontSize:30}),
screentone({width:800,height:1200,ppi:300,lpi:60,density:.25,angle:45})]));"""
strings = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', SCRIPT], cwd=ROOT).decode('utf-8'))
allowed = {'svg', 'path', 'g', 'rect', 'circle', 'polygon', 'ellipse', 'text', 'defs', 'pattern'}
for i, raw in enumerate(strings):
    root = ET.fromstring(raw)
    assert root.tag == '{http://www.w3.org/2000/svg}svg'
    width, height = int(root.attrib['width']), int(root.attrib['height'])
    assert (width, height) == [(4096, 2160), (800, 400), (800, 1200)][i]
    for node in root.iter():
        assert node.tag.split('}')[-1] in allowed, node.tag
        assert not any(k in node.attrib for k in ['href', 'onclick', 'onload', 'style'])
        assert not any('javascript:' in v or 'http:' in v or 'https:' in v for v in node.attrib.values())
assert '<script>' not in strings[1]
assert '안녕 <script> & こんにちは' in ''.join(ET.fromstring(strings[1]).itertext())
assert 'width="5.000" height="5.000"' in strings[2]
print('T8 independent SVG/XML oracle: PASS 3 overlays')
