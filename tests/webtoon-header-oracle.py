"""Pillow-made independent PNG/JPEG/WebP variants against the predecode sniffer."""
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 't8' / 'header-oracle'
OUT.mkdir(parents=True, exist_ok=True)
base = Image.new('RGBA', (137, 91), (30, 140, 220, 255))
variants = [('png', {}), ('jpeg', {}), ('webp', {'lossless': False}), ('webp', {'lossless': True})]
for i, (fmt, options) in enumerate(variants):
    im = base.convert('RGB') if fmt == 'jpeg' else base
    im.save(OUT / f'still-{i}.{fmt}', format=fmt.upper(), **options)
base.save(OUT / 'animated.webp', format='WEBP', save_all=True, append_images=[Image.new('RGBA', base.size, '#fff')], duration=[100, 100], loop=0)
base.save(OUT / 'animated.png', format='PNG', save_all=True, append_images=[Image.new('RGBA', base.size, '#fff')], duration=[100, 100], loop=0)
script = """import {readFileSync} from 'node:fs';import {sniffImageHeader} from './src/webtoon/headers.js';
console.log(JSON.stringify(process.argv.slice(1).map(p=>{try{return sniffImageHeader(readFileSync(p).subarray(0,65536))}catch(e){return {error:e.message}}})));"""
paths = [str(p) for p in sorted(OUT.glob('*'))]
values = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script, '--', *paths], cwd=ROOT).decode('utf-8'))
for path, result in zip(paths, values):
    if 'animated' in path:
        assert 'Animated' in result['error'], (path, result)
    else:
        assert (result['width'], result['height']) == (137, 91), (path, result)
print('T8 independent Pillow header oracle: PASS', len(paths), 'formats')
