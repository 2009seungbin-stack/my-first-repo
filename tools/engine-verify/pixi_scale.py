"""Does a Nerulio Studio @2x scale-variant PixiJS export render at the right size in real PixiJS 8?

What it does
  1. Studio side (Playwright, Chromium): opens <STUDIO_URL>/en/game/studio/?ws=sprite, imports the six
     CC0 ninja frames (tests/fixtures/game/corpus/ninja/run_*.png), opens Pack & Export, ticks the
     @2x scale variant and clicks "PixiJS 8". The downloaded ZIP (one JSON + PNG per variant) is
     saved and unpacked. This is done twice: with the default pack settings and with the PixiJS
     preset (rotation allowed), so a rotated @2x frame is covered when the packer rotates one.
  2. File side (Python/PIL): for every frame, the @2x atlas region must be the @1x region with each
     pixel repeated as an exact 2x2 block (nearest), and the @2x frame/sourceSize/spriteSourceSize
     numbers must be exactly twice the @1x ones.
  3. Engine side: the unpacked ZIP and the pinned pixi.min.js (tools/engine-verify/web/package.json)
     are served on 127.0.0.1:<PORT> (4492). A page loads the @1x and the @2x JSON with PixiJS's own
     `Assets.load(url)` - exactly what a user does - and reports, per variant: the PixiJS version,
     sheet.resolution, textures[name].width/height (PixiJS units), texture.source.resolution,
     texture.frame, texture.orig, the `animations` keys and lengths. It then draws every frame of
     the first animation of each variant as Sprites (default anchor = exported pivot, scale 1) at
     the same positions into a WebGL canvas whose renderer resolution is 2 (a "retina" screen:
     1 PixiJS unit = 2 device px), nearest filtering, and reads the canvas back. Checks:
       - @1x and @2x report the same texture width/height/orig, anchor and Sprite bounds;
       - every @2x frame holds 2x the texels in the same units (frame.width x source.resolution);
         the atlas PAGE is not exactly 2x because padding stays in pixels - that is expected;
       - the drawn opaque area is the same size in device pixels;
       - the @2x drawing is pixel-identical to the @1x drawing (at renderer resolution 2 the @1x
         texels become 2x2 device-pixel blocks; the @2x texels are already those blocks, 1:1);
       - each drawn frame equals its source PNG upscaled 2x nearest (opaque pixels).
  4. Negative control: a copy of the @2x JSON with meta.scale set to "1" (same PNG, other folder)
     is loaded the same way; PixiJS must then report a texture twice as large and draw it twice
     as large - proving the checks above can fail.
  Results go to tools/engine-verify/results/pixi-scale-2026-09-24.json (override with OUT=path).

How to run (from the repository root)
  npm ci --prefix tools/engine-verify/web          # once: the pinned pixi.js 8
  STUDIO_URL=http://127.0.0.1:4491 python tools/engine-verify/pixi_scale.py
  STUDIO_URL is a running Nerulio dev server (node tools/serve.mjs) - default http://127.0.0.1:4491.
  PORT (default 4492) is the static server this script starts for the PixiJS page; it must be free.
  Exit code 0 = every positive check passed and the negative control failed as it must.
"""
from __future__ import annotations
import base64, functools, http.server, io, json, os, shutil, sys, tempfile, threading, time, zipfile
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
STUDIO = os.environ.get('STUDIO_URL', 'http://127.0.0.1:4491').rstrip('/')
PORT = int(os.environ.get('PORT', '4492'))
OUT = Path(os.environ.get('OUT', HERE / 'results' / 'pixi-scale-2026-09-24.json'))
PIXI = HERE / 'web' / 'node_modules' / 'pixi.js' / 'dist' / 'pixi.min.js'
NINJA = sorted((ROOT / 'tests' / 'fixtures' / 'game' / 'corpus' / 'ninja').glob('run_*.png'))
TMP = Path(tempfile.mkdtemp(prefix='pixi-scale-'))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
checks: list[dict] = []


def check(name, cond, detail=None, expect=True):
    """expect=False marks a negative-control check: it passes when the condition is False."""
    passed = bool(cond) == expect
    checks.append({'check': name, 'result': 'PASS' if passed else 'FAIL', 'negative_control': not expect, 'detail': detail})
    print(('PASS ' if passed else 'FAIL ') + ('[neg] ' if not expect else '') + name + (f'  {detail}' if detail is not None and not passed else ''), flush=True)
    return passed


# ---------------------------------------------------------------- 1. Studio export
def studio_export(browser, preset: str | None) -> Path:
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    p = ctx.new_page()
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(f'{STUDIO}/en/game/studio/?ws=sprite')
    p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=60000)
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(x) for x in NINJA])
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0', timeout=60000)
    p.wait_for_timeout(300)

    def packed():
        p.wait_for_selector('[data-pack="efficiency"]', state='attached', timeout=120000)
        p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=120000)
        p.wait_for_timeout(200)

    p.click('.st-ws-tab[data-ws="pack"]'); packed()
    if preset:
        p.locator('[data-pack="preset"]').select_option(preset); p.wait_for_timeout(250); packed()
    if not p.locator('[data-scale="2"]').is_visible():
        p.locator('.pk-adv > summary').click(); p.wait_for_timeout(200)
    p.check('[data-scale="2"]'); p.wait_for_timeout(250); packed()
    p.wait_for_function('()=>{const b=document.querySelector("[data-export=pixi]");return b&&!b.disabled}', timeout=120000)
    with p.expect_download(timeout=120000) as d:
        p.click('[data-export="pixi"]')
    dest = TMP / f'studio-{preset or "default"}-{d.value.suggested_filename}'
    d.value.save_as(str(dest))
    ctx.close()
    if errs:
        print('page errors:', errs)
    return dest


# ---------------------------------------------------------------- 2. file-level check
def frame_region(sheet: Image.Image, fr: dict) -> Image.Image:
    f = fr['frame']
    w, h = (f['h'], f['w']) if fr.get('rotated') else (f['w'], f['h'])
    return sheet.crop((f['x'], f['y'], f['x'] + w, f['y'] + h))


def file_checks(label, j1, j2, png1: Image.Image, png2: Image.Image):
    names = sorted(j1['frames'])
    same_names = names == sorted(j2['frames'])
    check(f'{label}: @1x and @2x JSON list the same frames', same_names, [names, sorted(j2['frames'])])
    geo_bad, px_bad, rotated = [], [], 0
    for n in names:
        a, b = j1['frames'][n], j2['frames'].get(n, {})
        rotated += bool(a.get('rotated'))
        for k in ('frame', 'spriteSourceSize', 'sourceSize'):
            if k == 'frame':  # the frame x/y are atlas positions and may differ; sizes must double
                ok = b.get(k, {}).get('w') == 2 * a[k]['w'] and b.get(k, {}).get('h') == 2 * a[k]['h']
            else:
                ok = all(b.get(k, {}).get(q) == 2 * v for q, v in a[k].items())
            if not ok:
                geo_bad.append((n, k, a[k], b.get(k)))
        if a.get('rotated') != b.get('rotated'):
            geo_bad.append((n, 'rotated', a.get('rotated'), b.get('rotated')))
        r1, r2 = frame_region(png1, a), frame_region(png2, b)
        if r1.resize((r1.width * 2, r1.height * 2), Image.NEAREST).tobytes() != r2.tobytes():
            px_bad.append(n)
    check(f'{label}: @2x frame, spriteSourceSize and sourceSize are exactly 2x the @1x numbers', not geo_bad, geo_bad)
    check(f'{label}: every @2x atlas region is the @1x region as exact 2x2 pixel blocks (nearest)', not px_bad, px_bad)
    return {'frames': len(names), 'rotated_frames': rotated, 'geometry_mismatches': geo_bad, 'pixel_mismatches': px_bad}


# ---------------------------------------------------------------- 3. PixiJS page
PAGE = r'''<!doctype html><meta charset="utf-8"><title>pixi scale</title>
<body style="margin:0;background:#000"><script src="pixi.min.js"></script><script>
window.run = async (url, W, H) => {
  const sheet = await PIXI.Assets.load(url);
  const names = Object.keys(sheet.textures);
  const animKeys = Object.keys(sheet.animations);
  const first = animKeys.length ? sheet.animations[animKeys[0]][0] : sheet.textures[names[0]];
  const firstName = names.find(n => sheet.textures[n] === first);
  const r = o => ({x: o.x, y: o.y, width: o.width, height: o.height});
  const textures = {};
  for (const n of names) {
    const t = sheet.textures[n];
    textures[n] = {width: t.width, height: t.height, frame: r(t.frame), orig: r(t.orig), trim: t.trim ? r(t.trim) : null,
                   rotate: t.rotate, resolution: t.source.resolution};
  }
  const src = first.source;
  // What a pixel-art project sets (Pixi's default is linear); both variants get the same setting.
  for (const n of names) sheet.textures[n].source.scaleMode = 'nearest';
  const app = new PIXI.Application();
  await app.init({width: W, height: H, resolution: 2, autoDensity: false, antialias: false, preference: 'webgl',
                  backgroundAlpha: 0, preserveDrawingBuffer: true, autoStart: false});
  // Every frame of the first animation in a row, each Sprite at the same place for both variants,
  // scale 1, the texture's own default anchor (the exported pivot) kept - as a user would draw it.
  const seq = animKeys.length ? sheet.animations[animKeys[0]] : names.map(n => sheet.textures[n]);
  const sprites = seq.map((t, i) => {
    const s = new PIXI.Sprite(t);
    s.position.set(30 + 50 * i, 50); s.scale.set(1);
    app.stage.addChild(s);
    return s;
  });
  app.renderer.render(app.stage);
  const sb = sprites.map((s, i) => { const q = s.getBounds(); return {name: names.find(n => sheet.textures[n] === seq[i]),
    x: q.x, y: q.y, width: q.width, height: q.height, anchor: [s.anchor.x, s.anchor.y]}; });
  const b = sb[0];
  const png = app.canvas.toDataURL('image/png');
  const out = {
    pixi: PIXI.VERSION, renderer: app.renderer.name, rendererResolution: app.renderer.resolution,
    canvas: {width: app.canvas.width, height: app.canvas.height},
    sheetResolution: sheet.resolution, meta: sheet.data.meta,
    source: {label: src.label, resolution: src.resolution, pixelWidth: src.pixelWidth, pixelHeight: src.pixelHeight,
             width: src.width, height: src.height, scaleMode: src.scaleMode},
    animations: Object.fromEntries(animKeys.map(k => [k, sheet.animations[k].map(t => names.find(n => sheet.textures[n] === t))])),
    drawn: firstName, spriteBounds: {x: b.x, y: b.y, width: b.width, height: b.height}, sprites: sb,
    textures, png,
  };
  app.destroy(true);
  return out;
};
</script>'''


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def bbox_size(img: Image.Image):
    bb = img.getchannel('A').getbbox()
    return None if bb is None else {'x': bb[0], 'y': bb[1], 'width': bb[2] - bb[0], 'height': bb[3] - bb[1]}


def opaque_equal(drawn: Image.Image, expect: Image.Image, ox: int, oy: int):
    """Compares the fully opaque pixels of `expect` (source frame x2 nearest) with the drawing at (ox, oy)."""
    d, e = drawn.load(), expect.load()
    total = bad = 0
    for y in range(expect.height):
        for x in range(expect.width):
            px = e[x, y]
            if px[3] == 255:
                total += 1
                q = d[ox + x, oy + y]
                if q[3] != 255 or max(abs(q[i] - px[i]) for i in range(3)) > 0:
                    bad += 1
    return total, bad


def main():
    assert PIXI.exists(), f'{PIXI} missing - run: npm ci --prefix tools/engine-verify/web'
    assert len(NINJA) == 6, NINJA
    report = {'date': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'studio_url': STUDIO, 'port': PORT,
              'inputs': [str(x.relative_to(ROOT)).replace('\\', '/') for x in NINJA], 'runs': []}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        report['chromium'] = browser.version
        zips = {cfg: studio_export(browser, None if cfg == 'default' else cfg) for cfg in ('default', 'pixi')}
        www = TMP / 'www'; www.mkdir()
        shutil.copy(PIXI, www / 'pixi.min.js')
        (www / 'index.html').write_text(PAGE, encoding='utf-8')
        httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(_Quiet, directory=str(www)))
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            for cfg, zpath in zips.items():
                label = f'preset={cfg}'
                z = zipfile.ZipFile(zpath)
                d = www / cfg; d.mkdir()
                z.extractall(d)
                jsons = [n for n in z.namelist() if n.endswith('.json')]
                byscale = {json.loads(z.read(n))['meta'].get('scale'): n for n in jsons}
                run = {'config': label, 'zip': zpath.name, 'zip_files': z.namelist(), 'json_by_meta_scale': byscale}
                print(f'--- {label}: {z.namelist()}')
                if not check(f'{label}: the ZIP holds a @1x JSON (meta.scale "1") and a @2x JSON (meta.scale "2")', set(byscale) >= {'1', '2'}, byscale):
                    report['runs'].append(run); continue
                j1, j2 = json.loads(z.read(byscale['1'])), json.loads(z.read(byscale['2']))
                run['meta'] = {'1': j1['meta'], '2': j2['meta']}
                check(f'{label}: the @2x JSON points at its own @2x PNG', '@2x' in j2['meta']['image'] and j2['meta']['image'] != j1['meta']['image'], [j1['meta']['image'], j2['meta']['image']])
                png1 = Image.open(d / Path(byscale['1']).parent / j1['meta']['image']).convert('RGBA')
                png2 = Image.open(d / Path(byscale['2']).parent / j2['meta']['image']).convert('RGBA')
                run['atlas_png'] = {'1': png1.size, '2': png2.size}
                run['file_level'] = file_checks(label, j1, j2, png1, png2)
                # negative control: same @2x PNG, meta.scale "1", in its own folder (own Assets cache key)
                neg = d / 'negative-control'; neg.mkdir()
                shutil.copy(d / Path(byscale['2']).parent / j2['meta']['image'], neg / j2['meta']['image'])
                jn = json.loads(json.dumps(j2)); jn['meta']['scale'] = '1'
                (neg / Path(byscale['2']).name).write_text(json.dumps(jn), encoding='utf-8')
                urls = {'@1x': f'{cfg}/{byscale["1"]}', '@2x': f'{cfg}/{byscale["2"]}', 'negative (@2x JSON, meta.scale "1")': f'{cfg}/negative-control/{Path(byscale["2"]).name}'}
                W, H = 320, 120  # PixiJS units; the canvas is 640x240 device px (renderer resolution 2)
                page = browser.new_page()
                perr = []
                page.on('pageerror', lambda e: perr.append(str(e)))
                page.on('console', lambda m: m.type in ('error', 'warning') and perr.append(m.text[:300]))
                page.goto(f'http://127.0.0.1:{PORT}/index.html')
                res, imgs = {}, {}
                for k, u in urls.items():
                    o = page.evaluate('([u,w,h])=>window.run(u,w,h)', [u, W, H])
                    imgs[k] = Image.open(io.BytesIO(base64.b64decode(o.pop('png').split(',', 1)[1]))).convert('RGBA')
                    imgs[k].save(TMP / f'{cfg}-{k.split()[0].strip("@")}.png')
                    o['drawn_device_px_bbox'] = bbox_size(imgs[k])
                    o['url'] = u
                    res[k] = o
                page.close()
                run['pixi'] = res
                run['page_messages'] = perr
                a, b, n = res['@1x'], res['@2x'], res['negative (@2x JSON, meta.scale "1")']
                name = a['drawn']
                ta, tb, tn = a['textures'][name], b['textures'].get(name), n['textures'].get(name)
                print(f'  PixiJS {a["pixi"]} ({a["renderer"]}), drawn frame {name!r}')
                for k, o in res.items():
                    t = o['textures'][name]
                    print(f'  {k:38} tex {t["width"]}x{t["height"]}  frame {t["frame"]}  source.res {t["resolution"]}  '
                          f'pixelW {o["source"]["pixelWidth"]}  bounds {o["spriteBounds"]["width"]}x{o["spriteBounds"]["height"]}  drawn {o["drawn_device_px_bbox"]}')
                check(f'{label}: PixiJS reads sheet.resolution 1 for @1x and 2 for @2x (from meta.scale)', a['sheetResolution'] == 1 and b['sheetResolution'] == 2, [a['sheetResolution'], b['sheetResolution']])
                check(f'{label}: texture.source.resolution is 1 (@1x) and 2 (@2x)', ta['resolution'] == 1 and tb['resolution'] == 2, [ta['resolution'], tb['resolution']])
                check(f'{label}: every @2x texture has the same width/height/orig in PixiJS units as @1x',
                      all(b['textures'][k]['width'] == v['width'] and b['textures'][k]['height'] == v['height'] and b['textures'][k]['orig'] == v['orig'] for k, v in a['textures'].items()),
                      {k: [(v['width'], v['height']), (b['textures'][k]['width'], b['textures'][k]['height'])] for k, v in a['textures'].items()})
                # texel density: a frame's size in texels is width x source.resolution
                dens = {k: [(v['frame']['width'] * v['resolution'], v['frame']['height'] * v['resolution']),
                            (b['textures'][k]['frame']['width'] * b['textures'][k]['resolution'], b['textures'][k]['frame']['height'] * b['textures'][k]['resolution'])]
                        for k, v in a['textures'].items()}
                check(f'{label}: every @2x frame holds 2x the texels of the @1x frame in the same PixiJS units (2x density)',
                      all(t2 == (2 * t1[0], 2 * t1[1]) for t1, t2 in dens.values()) and all(b['textures'][k]['frame']['width'] == v['frame']['width'] and b['textures'][k]['frame']['height'] == v['frame']['height'] for k, v in a['textures'].items()), dens)
                run['atlas_page_units'] = {'@1x': [a['source']['width'], a['source']['height']], '@2x': [b['source']['width'], b['source']['height']]}
                check(f'{label}: the animations keys and frame order are the same in @1x and @2x', a['animations'] == b['animations'] and len(a['animations']) >= 1, [a['animations'], b['animations']])
                check(f'{label}: the default anchor (pivot) is the same in @1x and @2x', [s['anchor'] for s in a['sprites']] == [s['anchor'] for s in b['sprites']], [[s['anchor'] for s in a['sprites']], [s['anchor'] for s in b['sprites']]])
                check(f'{label}: every @2x Sprite has the same bounds as the @1x one', a['sprites'] == b['sprites'], [a['sprites'], b['sprites']])
                check(f'{label}: something was drawn (the canvas readback is not empty)', a['drawn_device_px_bbox'] is not None and b['drawn_device_px_bbox'] is not None)
                check(f'{label}: the drawn size in device pixels is the same for @1x and @2x', a['drawn_device_px_bbox'] == b['drawn_device_px_bbox'], [a['drawn_device_px_bbox'], b['drawn_device_px_bbox']])
                same = imgs['@1x'].tobytes() == imgs['@2x'].tobytes()
                check(f'{label}: the @2x drawing is pixel-identical to the @1x drawing at renderer resolution 2 (2x2 blocks)', same)
                # each drawn frame against its source PNG x2 nearest, placed at the Sprite's bounds
                comp = []
                for s in b['sprites']:
                    srcimg = Image.open(next(f for f in NINJA if f.stem == Path(s['name']).stem)).convert('RGBA')
                    exp = srcimg.resize((srcimg.width * 2, srcimg.height * 2), Image.NEAREST)
                    tot, bad = opaque_equal(imgs['@2x'], exp, round(s['x'] * 2), round(s['y'] * 2))
                    comp.append({'frame': s['name'], 'source_px': srcimg.size, 'opaque_pixels': tot, 'mismatches': bad})
                run['source_compare'] = comp
                check(f'{label}: each @2x drawing equals its source PNG frame upscaled 2x nearest (opaque pixels)', all(c['opaque_pixels'] > 0 and c['mismatches'] == 0 for c in comp), comp)
                # negative control: all three must fail (reported as PASS [neg] when they do)
                check(f'{label}: negative control reports the same texture size as @1x', tn['width'] == ta['width'] and tn['height'] == ta['height'],
                      [(ta['width'], ta['height']), (tn['width'], tn['height'])], expect=False)
                check(f'{label}: negative control draws at the same size as @1x', n['drawn_device_px_bbox'] == a['drawn_device_px_bbox'],
                      [a['drawn_device_px_bbox'], n['drawn_device_px_bbox']], expect=False)
                check(f'{label}: negative control drawing is pixel-identical to @1x', imgs['negative (@2x JSON, meta.scale "1")'].tobytes() == imgs['@1x'].tobytes(), expect=False)
                run['negative_control_is_double'] = tn['width'] == 2 * ta['width'] and tn['height'] == 2 * ta['height']
                check(f'{label}: negative control texture is exactly 2x the @1x size (what a wrong meta.scale looks like)', run['negative_control_is_double'],
                      [(ta['width'], ta['height']), (tn['width'], tn['height'])])
                report['runs'].append(run)
        finally:
            httpd.shutdown(); httpd.server_close()
            browser.close()
    report['pixi_version'] = next((r['pixi']['@1x']['pixi'] for r in report['runs'] if 'pixi' in r), None)
    report['checks'] = checks
    fails = [c for c in checks if c['result'] == 'FAIL']
    report['verdict'] = 'PASS' if not fails else 'FAIL'
    report['artifacts_dir'] = str(TMP)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=1, default=str), encoding='utf-8')
    print(f'\n{len(checks) - len(fails)}/{len(checks)} checks as expected -> {report["verdict"]}; results: {OUT}; images: {TMP}')
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(main())
