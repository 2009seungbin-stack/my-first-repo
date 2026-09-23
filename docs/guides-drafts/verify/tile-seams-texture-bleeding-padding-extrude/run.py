"""Reproduces tile seams in Phaser 3.90 / 4.2 (Chromium, WebGL) with request interception (no server).
Each config renders the same 14x9 Kenney Tiny Dungeon room at a fractional camera zoom/scroll on a
magenta background; any magenta pixel inside the map is a seam. Usage: python run.py -> results.json + cap-*.png"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = Path(__file__).parent
NM = Path(r'C:/Users/2009s/Desktop/SITE/.claude/worktrees/agent-aef499f5f486793c5/tools/engine-verify/web/node_modules')
LIBS = {'phaser3': NM / 'phaser3/dist/phaser.min.js', 'phaser4': NM / 'phaser/dist/phaser.min.js'}
TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png'}

CONFIGS = [
    # name, query
    ('linear-orig', 'pixelArt=0&sheet=orig'),
    ('nearest-orig', 'pixelArt=1&sheet=orig'),
    ('nearest-orig-noround', 'pixelArt=1&sheet=orig&round=0'),
    ('linear-ext', 'pixelArt=0&sheet=ext'),
    ('nearest-ext', 'pixelArt=1&sheet=ext'),
    ('linear-ext2', 'pixelArt=0&sheet=ext2'),
    ('nearest-ext2', 'pixelArt=1&sheet=ext2'),
    ('linear-orig-z05', 'pixelArt=0&sheet=orig&zoom=0.63&sx=1.3&sy=0.7'),
    ('linear-ext-z05', 'pixelArt=0&sheet=ext&zoom=0.63&sx=1.3&sy=0.7'),
    ('linear-orig-int', 'pixelArt=0&sheet=orig&zoom=2&sx=3&sy=5'),
    ('nearest-orig-int', 'pixelArt=1&sheet=orig&zoom=2&sx=3&sy=5'),
    ('nearest-orig-intzoom-fracscroll', 'pixelArt=1&sheet=orig&zoom=2&sx=3.3&sy=5.7&round=0'),
]
GPU_CONFIGS = [
    ('gpu-linear-orig', 'pixelArt=0&sheet=orig&gpu=1'),
    ('gpu-nearest-orig', 'pixelArt=1&sheet=orig&gpu=1'),
]


def seam_pixels(png, rect):
    im = Image.open(png).convert('RGB')
    x0, y0 = max(0, int(rect['x']) + 2), max(0, int(rect['y']) + 2)
    x1, y1 = min(im.width, int(rect['x'] + rect['w']) - 2), min(im.height, int(rect['y'] + rect['h']) - 2)
    im = im.crop((x0, y0, x1, y1))
    n = 0
    for r, g, b in im.getdata():
        if min(r, b) - g > 40:
            n += 1
    return n, im.width * im.height


def main(engines):
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        for eng in engines:
            cfgs = CONFIGS + (GPU_CONFIGS if eng == 'phaser4' else [])
            for name, query in cfgs:
                page = b.new_page(viewport={'width': 480, 'height': 300}, device_scale_factor=1)
                logs = []
                page.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
                page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))

                def handle(route, _req=None, eng=eng):
                    path = route.request.url.split('http://guides.local/', 1)[1].split('?')[0]
                    f = LIBS[eng] if path == 'lib/phaser.min.js' else HERE / path
                    if path.startswith('tiny-dungeon-extruded2'):
                        f = HERE.parent / path
                    if not f.exists():
                        return route.fulfill(status=404, body='missing')
                    route.fulfill(body=f.read_bytes(), content_type=TYPES.get(f.suffix, 'application/octet-stream'))
                page.route('http://guides.local/**', handle)
                page.goto('http://guides.local/index.html?' + query)
                page.wait_for_function('window.DONE === true', timeout=30000)
                page.wait_for_timeout(200)
                res = page.evaluate('window.RESULT')
                png = HERE / f'cap-{eng}-{name}.png'
                page.locator('canvas').screenshot(path=str(png))
                n, total = seam_pixels(png, res['mapRect'])
                res['seamPixels'] = n
                res['console'] = [l for l in logs if 'error' in l.lower() or 'warn' in l.lower()]
                out[f'{eng}/{name}'] = res
                print(eng, res.get('version'), name, 'seam px', n, '/', total, res.get('config', {}).get('layerType'), res['errors'], res['console'][:2])
                page.close()
        b.close()
    (HERE / 'results.json').write_text(json.dumps(out, indent=1))


if __name__ == '__main__':
    main(sys.argv[1:] or ['phaser3', 'phaser4'])
