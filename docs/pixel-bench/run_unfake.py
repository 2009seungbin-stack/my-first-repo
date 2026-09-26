"""Run unfake.js (jenissimo/unfake.js, commit b2bee10) headless on every case.

The pixel pipeline (lib/pixel.js + the prebuilt unfake-core WASM worker shipped in browser-tool/vendor)
needs browser APIs (createImageBitmap, OffscreenCanvas, Worker), so we serve WORK/ over a local HTTP
server and drive a tiny harness page (_unfake_harness/index.html) with Playwright Chromium headless.

Variants (python run_unfake.py [variant] [DATA_DIR]):
  unfake      = the browser tool's default settings (js/app.js `settings`): maxColors 16, detect 'edge' +
                'tiled', downscale 'dominant', domMeanThreshold 0.15, cleanup morph+jaggy ON, alpha
                binarisation at 128, snapGrid ON, auto pixel size. This is what a user of the itch.io tool gets.
  unfake-lib  = processImage() library defaults: maxColors 32, detect 'edge'/'tiled', 'dominant', cleanup OFF,
                alpha 128, snapGrid ON.
Writes out/<variant>/<id>.png + .json.
"""
import base64, functools, http.server, json, os, sys, threading, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
# tool clones, harness pages and outputs live outside the repo (PIXEL_BENCH_WORK)
WORK = os.environ.get('PIXEL_BENCH_WORK', 'C:/Users/2009s/nerulio-handoff/scratch/p2/competitors')
VARIANT = sys.argv[1] if len(sys.argv) > 1 else 'unfake'
DATA = sys.argv[2] if len(sys.argv) > 2 else r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-pixel'
OUT = os.path.join(WORK, 'out', VARIANT)
OPTS = {
    'unfake': dict(maxColors=16, autoColorCount=False, snapGrid=True, detectMethod='edge', edgeDetectMethod='tiled',
                   downscaleMethod='dominant', domMeanThreshold=0.15, manualScale=None,
                   cleanup=dict(morph=True, jaggy=True), alphaThreshold=128),
    'unfake-lib': dict(),
    # UI defaults but "Grid detection" set to 'auto-tiled' (runs-based WASM detect_auto first): one dropdown change
    'unfake-auto': dict(maxColors=16, autoColorCount=False, snapGrid=True, detectMethod='auto', edgeDetectMethod='tiled',
                        downscaleMethod='dominant', domMeanThreshold=0.15, manualScale=None,
                        cleanup=dict(morph=True, jaggy=True), alphaThreshold=128),
}[VARIANT]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    os.makedirs(OUT, exist_ok=True)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=WORK))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    cases = json.load(open(os.path.join(DATA, 'cases.json')))['cases']
    only = os.environ.get('ONLY')
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.text))
        pg.goto(f'http://127.0.0.1:{port}/_unfake_harness/index.html')
        pg.wait_for_function('window.harnessReady === true', timeout=30000)
        for c in cases:
            if only and only not in c['id']:
                continue
            logs.clear()
            raw = open(os.path.join(DATA, c['path']), 'rb').read()
            mime = 'image/jpeg' if c['path'].endswith('.jpg') else 'image/png'
            meta = dict(tool='unfake.js', commit='b2bee10c1c3b211a2532baca9088857b19480dca', variant=VARIANT, settings=OPTS or 'library defaults',
                        input=[c['width'], c['height']])
            t0 = time.perf_counter()
            try:
                r = pg.evaluate('([b, n, m, o]) => window.runUnfake(b, n, m, o)',
                                [base64.b64encode(raw).decode(), os.path.basename(c['path']), mime, OPTS])
                png = base64.b64decode(r['png'])
                open(os.path.join(OUT, c['id'] + '.png'), 'wb').write(png)
                man = r['manifest']
                meta['time_ms'] = round(r['time_ms'], 1)
                meta['wall_ms'] = round((time.perf_counter() - t0) * 1000, 1)
                meta['output'] = man['final_size']
                sc = man['processing_steps']['scale_detection']['detected_scale']
                meta['detected_scale'] = sc
                meta['manifest'] = man
                meta['core_wasm_used'] = any('unfake-core' in l for l in logs)
                meta['error'] = None
            except Exception as e:  # noqa
                meta['time_ms'] = round((time.perf_counter() - t0) * 1000, 1)
                meta['error'] = str(e).splitlines()[0][:500]
            meta['log_tail'] = logs[-6:]
            json.dump(meta, open(os.path.join(OUT, c['id'] + '.json'), 'w'), indent=1)
            print(c['id'], meta.get('output'), meta.get('detected_scale'), meta['time_ms'], meta['error'] or '')
        b.close()
    srv.shutdown()


if __name__ == '__main__':
    main()
