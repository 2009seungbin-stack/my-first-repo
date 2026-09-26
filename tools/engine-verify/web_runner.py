"""Phaser 3, Phaser 4 and PixiJS 8 side of the engine-verify harness.

The engine libraries are the real npm packages pinned in tools/engine-verify/web/package.json
(install once: `npm ci --prefix tools/engine-verify/web`). For each run a temporary folder is
served on 127.0.0.1:<port> (default 4441) holding harness.html, the engine's own dist file and the
unpacked bundle; Chromium (Playwright) opens it, the engine loads the bundle with its standard
loader, draws every frame, and the page hands back what the engine understood plus one canvas.
"""
from __future__ import annotations
import base64, functools, http.server, io, json, shutil, threading
from pathlib import Path
from PIL import Image
from ev_common import HERE, unpremultiply

WEB = HERE / 'web'
LIBS = {
    'phaser3': WEB / 'node_modules' / 'phaser3' / 'dist' / 'phaser.min.js',
    'phaser4': WEB / 'node_modules' / 'phaser' / 'dist' / 'phaser.min.js',
    'pixi8': WEB / 'node_modules' / 'pixi.js' / 'dist' / 'pixi.min.js',
    'spine': WEB / 'node_modules' / '@esotericsoftware' / 'spine-canvas' / 'dist' / 'iife' / 'spine-canvas.js',
    'css': WEB / 'harness.html',  # no engine library: the browser itself draws the stylesheet
}


def engines_available() -> dict:
    out = {}
    for name, lib in LIBS.items():
        # the package's own package.json sits above dist/; spine-canvas keeps its build one level
        # deeper (dist/iife) and has a version-less {"type": ...} package.json inside dist/
        out[name] = None
        if name == 'css':
            out[name] = 'Chromium (Playwright)' if lib.exists() else None
            continue
        for p in lib.parents if lib.exists() else ():
            f = p / 'package.json'
            if f.exists() and 'version' in (meta := json.loads(f.read_text(encoding='utf-8'))):
                out[name] = meta['version']
                break
    return out


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Server:
    def __init__(self, root: Path, port: int):
        self.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(_Quiet, directory=str(root)))
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *a):
        self.httpd.shutdown()
        self.httpd.server_close()


def loader_for(item: dict, engine: str) -> str | None:
    kind = item['kind']
    if kind in ('texturepacker-hash', 'texturepacker-array', 'nerulio-envelope', 'nerulio-sprite-godot', 'nerulio-godot-json', 'unity-json', 'nerulio-sprite-unity'):
        # A user with a JSON file and a PNG reaches for the atlas loader; Nerulio's own envelopes are
        # tried the same way so the table shows what happens when they do.
        return 'atlas-json'
    if kind == 'spine-atlas':
        return 'spine' if engine == 'spine' else None
    if kind == 'css-sprites':
        return 'css' if engine == 'css' else None
    if engine in ('spine', 'css'):
        return None
    if kind == 'phaser-multiatlas':
        return 'multiatlas' if engine.startswith('phaser') else None  # Pixi links pages with meta.related_multi_packs instead
    if kind in ('aseprite-hash', 'aseprite-array'):
        return 'aseprite' if engine.startswith('phaser') else 'atlas-json'
    if kind == 'starling-xml':
        return 'atlas-xml' if engine.startswith('phaser') else None  # Pixi 8 has no Starling loader
    if kind == 'bmfont-xml' or (kind in ('bmfont-text', 'bmfont-binary') and engine == 'pixi8'):
        return 'bmfont'  # Phaser's BitmapFont parser reads the XML flavour of BMFont only
    return None


def run(folder: Path, item: dict, engine: str, work: Path, port: int, chars=None, browser=None) -> dict:
    """Serve `folder` (the unpacked bundle) and run one engine on one item. Returns the page result
    with slot images written to work/<engine>/."""
    lib = LIBS[engine]
    if not lib.exists():
        return {'errors': [f'{engine} is not installed: npm ci --prefix tools/engine-verify/web'], 'loaded': False}
    loader = loader_for(item, engine)
    site = work / f'site-{engine}'
    if site.exists():
        shutil.rmtree(site)
    (site / 'lib').mkdir(parents=True)
    if engine == 'css':
        (site / 'lib' / 'engine.js').write_text('// the browser is the engine', encoding='utf-8')
    else:
        shutil.copy2(lib, site / 'lib' / 'engine.js')
    shutil.copy2(WEB / 'harness.html', site / 'harness.html')
    shutil.copy2(WEB / 'harness.js', site / 'harness.js')
    shutil.copytree(folder, site / 'b', dirs_exist_ok=True)
    data = item.get('json') or item.get('xml') or item.get('fnt') or item.get('atlas') or item.get('css')
    # Image paths inside atlas data and .fnt files are relative to the data file's own folder.
    image = _bmfont_page(folder / item['fnt']) if loader == 'bmfont' else (item.get('images') or [None])[0]
    image = (Path(data).parent / image).as_posix() if data and image else image
    plan = {'loader': loader, 'files': {'data': f'b/{data}', 'image': f'b/{image}' if image else None, 'imageName': Path(image).name if image else None,
            'html': f'b/{item["html"]}' if item.get('html') else None},
            'chars': chars or []}
    if loader == 'multiatlas':
        plan['files']['path'] = 'b/' + (Path(data).parent.as_posix() + '/' if Path(data).parent.as_posix() != '.' else '')
    # A Phaser animations file shipped beside the atlas (anims.fromJSON). Its frames name the
    # texture key the README tells the user to load the atlas under, so the atlas is loaded with it.
    if item.get('anims') and engine.startswith('phaser'):
        plan['files']['anims'] = f'b/{item["anims"]}'
        try:
            a = json.loads((folder / item['anims']).read_text(encoding='utf-8'))
            plan['textureKey'] = a['anims'][0]['frames'][0]['key']
        except Exception:
            pass
    (site / 'plan.json').write_text(json.dumps(plan), encoding='utf-8')
    if loader is None:
        why = ' (Phaser reads XML BMFont only)' if item['kind'].startswith('bmfont') else ''
        return {'errors': [f'{engine} has no standard loader for {item["kind"]}{why}'], 'loaded': False, 'na': True}
    own = browser is None
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start() if own else None
    try:
        b = browser or pw.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'])
        with Server(site, port):
            page = b.new_page()
            console = []
            page.on('console', lambda m: console.append(f'{m.type}: {m.text}'[:300]))
            page.on('pageerror', lambda e: console.append(f'pageerror: {e}'[:300]))
            page.goto(f'http://127.0.0.1:{port}/harness.html?engine={engine}')
            page.wait_for_function('()=>window.__result', timeout=120000)
            res = page.evaluate('()=>window.__result')
            if res.get('screenshot'):
                # CSS: what the browser painted, read back as a screenshot of the page
                page.set_viewport_size({'width': res['screenshot']['width'], 'height': res['screenshot']['height']})
                page.wait_for_timeout(200)
                res['canvas'] = 'data:image/png;base64,' + base64.b64encode(page.screenshot(omit_background=True, full_page=True)).decode()
            page.close()
        res['console'] = [c for c in console if not c.startswith(('log:', 'info:', 'debug:'))][:20]
    finally:
        if own:
            b.close(); pw.stop()
    res['plan'] = plan
    # Crop every slot out of the one canvas the engine drew.
    dest = work / engine
    dest.mkdir(parents=True, exist_ok=True)
    if res.get('canvas'):
        full = Image.open(io.BytesIO(base64.b64decode(res['canvas'].split(',', 1)[1]))).convert('RGBA')
        if engine in ('phaser3', 'pixi8'):
            # Phaser 3's WebGL snapshot and Pixi 8's extract.canvas hand back premultiplied colour
            # (measured: Phaser 3 reads a (106,151,178,79) texel back as (32,48,55,79); Pixi 8 a
            # (67,48,30,69) one as (18,15,7,69)). The browser composites those buffers correctly,
            # so this is a read-back artefact, not what a player sees: undo it here.
            full = unpremultiply(full)
            res['readback'] = 'unpremultiplied'
        full.save(dest / '_canvas.png')
        targets = res['frames'] if res.get('frames') else [res['glyphs'][c] for c in (chars or [])]
        for i, (slot, target) in enumerate(zip(res.get('slots', []), targets)):
            p = dest / f'slot_{i:04d}.png'
            full.crop((slot['x'], slot['y'], slot['x'] + slot['w'], slot['y'] + slot['h'])).save(p)
            target['png'] = str(p)
        res['canvas'] = str(dest / '_canvas.png')
    return res


def _bmfont_page(fnt: Path) -> str | None:
    import re
    m = re.search(r'file="([^"]+)"', fnt.read_text(encoding='utf-8', errors='replace'))
    return m.group(1) if m else None


def normalise(res: dict) -> dict:
    """Page result -> the engine-neutral report judge.py reads."""
    frames = [{'name': f['name'], 'png': f.get('png'), 'sourceSize': f.get('sourceSize'), 'region': f.get('region'),
               'rotated': f.get('rotated')} for f in res.get('frames', [])]
    by = {f['name']: f for f in frames}
    anims = {}
    for name, a in (res.get('animations') or {}).items():
        anims[name] = {'fps': a.get('fps'), 'loop': a.get('loop'),
                       'frames': [{'name': s['name'], 'png': by.get(s['name'], {}).get('png'), 'durationMs': s.get('durationMs')} for s in a['frames']]}
    return {'frames': frames, 'animations': anims, 'glyphs': res.get('glyphs') or {}, 'font': res.get('font')}
