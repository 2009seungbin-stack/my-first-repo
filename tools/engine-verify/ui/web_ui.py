"""Phaser 3.90 / Phaser 4 / PixiJS 8 / CSS side of the UI verifiers, in Playwright Chromium.

The engine libraries are the real npm packages of tools/engine-verify/web (install once with
`npm ci --prefix tools/engine-verify/web`). For each run a temporary site holding
web/ui_harness.html + ui_harness.js, the engine's dist file and the unpacked bundle (under b/) is
served on 127.0.0.1:<port> ONLY for the duration of the run; when the port is taken the run waits
and retries.
"""
from __future__ import annotations
import base64, io, json, shutil, socket, sys, time
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from web_runner import LIBS, Server  # noqa: E402
import ui_common as U  # noqa: E402

PREMULTIPLIED_READBACK = ('phaser3', 'pixi8')  # measured in docs/ENGINE-VERIFY.md


def _port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def serve_and_run(site: Path, engine: str, port: int, log, wait_s=900, screenshot=False) -> dict:
    t0 = time.time()
    while not _port_free(port):
        if time.time() - t0 > wait_s:
            return {'errors': [f'port {port} stayed busy for {wait_s} s']}
        time.sleep(5)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'])
        try:
            with Server(site, port):
                page = b.new_page(device_scale_factor=1)
                console = []
                page.on('console', lambda m: console.append(f'{m.type}: {m.text}'[:300]))
                page.on('pageerror', lambda e: console.append(f'pageerror: {e}'[:300]))
                page.goto(f'http://127.0.0.1:{port}/ui_harness.html?engine={engine}')
                page.wait_for_function('()=>window.__result', timeout=180000)
                res = page.evaluate('()=>window.__result')
                if res.get('screenshot'):
                    page.set_viewport_size({'width': res['screenshot']['width'], 'height': res['screenshot']['height']})
                    page.wait_for_timeout(300)
                    res['canvas'] = 'data:image/png;base64,' + base64.b64encode(page.screenshot(omit_background=True, full_page=True)).decode()
                page.close()
        finally:
            b.close()
    res['console'] = [c for c in console if not c.startswith(('log:', 'info:', 'debug:'))][:20]
    log.write(f'web {engine}: {json.dumps({k: v for k, v in res.items() if k != "canvas"})[:4000]}\n')
    return res


def make_site(work: Path, engine: str, bundle: Path, plan: dict) -> Path:
    site = work / f'site-{engine}'
    engine = 'css' if engine == 'css-raw' else engine
    if site.exists():
        shutil.rmtree(site)
    (site / 'lib').mkdir(parents=True)
    if engine == 'css':
        (site / 'lib' / 'engine.js').write_text('// the browser is the engine', encoding='utf-8')
    else:
        lib = LIBS[engine]
        if not lib.exists():
            raise FileNotFoundError(f'{engine} is not installed: npm ci --prefix tools/engine-verify/web')
        shutil.copy2(lib, site / 'lib' / 'engine.js')
    shutil.copy2(HERE / 'web' / 'ui_harness.html', site / 'ui_harness.html')
    shutil.copy2(HERE / 'web' / 'ui_harness.js', site / 'ui_harness.js')
    shutil.copytree(bundle, site / 'b', dirs_exist_ok=True)
    (site / 'plan.json').write_text(json.dumps(plan), encoding='utf-8')
    return site


def canvas_of(res: dict, engine: str) -> np.ndarray | None:
    if not res.get('canvas'):
        return None
    im = Image.open(io.BytesIO(base64.b64decode(res['canvas'].split(',', 1)[1]))).convert('RGBA')
    a = np.asarray(im, dtype=np.uint8).copy()
    return U.unpremultiply(a) if engine in PREMULTIPLIED_READBACK else a


def verify(engine: str, bundle: Path, js: Path, data: dict, cases: list, canvas, work: Path, port: int, log) -> dict:
    from verify_ui import judge_paths, crop
    web = bundle / 'web'
    rel = lambda p: 'b/' + p.relative_to(bundle).as_posix()
    atlases = []
    for i, img in enumerate(data['images']):
        stem = Path(img['file']).stem
        j = web / f'{stem}.atlas.json'
        if j.exists():
            atlases.append({'key': stem, 'json': rel(j), 'image': 'b/' + img['file']})
    out = {'engine': engine, 'errors': [], 'rows': []}
    if engine != 'css' and not atlases:
        out['errors'].append('the bundle ships no web/<image>.atlas.json (Phaser scale9Borders / Pixi borders)')
        return out
    if engine == 'css' and not (web / 'nerulio-ui.css').exists():
        out['errors'].append('the bundle ships no web/nerulio-ui.css')
        return out
    pc = []
    for c in cases:
        el = data['elements'][c['element']]
        pc.append({**c, 'key': Path(data['images'][el['image']]['file']).stem})
    # CSS runs twice: the stylesheet as shipped ("css"), and the same classes with border-width and
    # padding forced to 0 ("css-raw"), which isolates border-image's own drawing (a border-box
    # element never gets smaller than its border widths, so the shipped classes cannot squash).
    passes = [(engine, '')] + ([('css-raw', 'border-width:0;padding:0;')] if engine == 'css' else [])
    t0 = time.time()
    images, grew = {}, {}
    out['engine_info'] = {}
    for path, style in passes:
        plan = {'mode': 'nineslice', 'canvas': canvas, 'cases': [{**c, 'style': style} for c in pc], 'atlases': atlases,
                'stylesheets': ['b/web/nerulio-ui.css']}
        site = make_site(work, path, bundle, plan)
        res = serve_and_run(site, engine, port, log)
        out['version'] = res.get('version')
        out['errors'] += res.get('errors', [])
        out['console'] = res.get('console')
        full = canvas_of(res, engine)
        if full is None:
            out['errors'].append(f'{path}: no canvas came back')
            continue
        (work / path).mkdir(exist_ok=True)
        Image.fromarray(full, 'RGBA').save(work / path / '_canvas.png')
        info = res.get('cases', {})
        out['engine_info'][path] = info
        images[path] = {c['id']: crop(full, c['slot']) for c in cases if not (info.get(c['id']) or {}).get('error')}
        for c in cases:
            box = (info.get(c['id']) or {}).get('box')
            if box and (abs(box[0] - c['w']) > 0.01 or abs(box[1] - c['h']) > 0.01):
                grew[(path, c['id'])] = box
    out['seconds'] = round(time.time() - t0, 1)
    out['rows'] = judge_paths(engine, U.PROFILES[engine], js, data, cases, images)
    for r in out['rows']:
        if (r['path'], r['case']) in grew:
            r['note'] = f'the element grew to {grew[(r["path"], r["case"])]} (a border-box is never smaller than its border widths)'
            if r['status'] == 'FAIL':
                r['status'] = 'N/A'
    out['grew'] = {f'{p}:{c}': b for (p, c), b in grew.items()}
    return out
