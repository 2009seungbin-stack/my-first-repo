"""Runs phaser/index.html in Playwright Chromium for Phaser 4.2 (node_modules/phaser) and 3.90 (node_modules/phaser3),
serving files through request interception (no local server). Prints what Phaser built and saves a canvas shot."""
import json, pathlib, sys, mimetypes
from playwright.sync_api import sync_playwright
HERE = pathlib.Path(__file__).parent
LIB = pathlib.Path(r'C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-aef499f5f486793c5\tools\engine-verify\web\node_modules')
PAGE = sys.argv[1] if len(sys.argv) > 1 else 'index.html'

def handler_for(phaserdir):
    def handle(route):
        path = route.request.url.split('http://guides.local/', 1)[1].split('?')[0]
        if path.startswith('lib/'):
            f = LIB / path[4:]
        else:
            f = HERE / path
        if not f.exists():
            return route.fulfill(status=404, body='missing ' + path)
        body = f.read_bytes()
        if path == PAGE:
            body = body.replace(b'PHASERDIR', phaserdir.encode())
        ctype = mimetypes.guess_type(str(f))[0] or 'application/octet-stream'
        route.fulfill(status=200, body=body, headers={'content-type': ctype})
    return handle

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader'])
    for phaserdir in ['phaser3', 'phaser']:
        p = b.new_page(viewport={'width': 320, 'height': 180})
        errs = []
        p.on('pageerror', lambda e: errs.append(str(e)))
        p.on('console', lambda m: m.type in ('error', 'warning') and errs.append(m.text[:200]))
        p.route('http://guides.local/**', handler_for(phaserdir))
        p.goto('http://guides.local/' + PAGE)
        p.wait_for_function('() => window.__r && window.__r.phaser', timeout=20000)
        p.wait_for_timeout(300)
        out = p.evaluate('() => { const r = Object.assign({}, window.__r); r.now = window.__r.heroAnim ? window.__r.heroAnim() : null; delete r.heroAnim; return r; }')
        print('==', phaserdir, json.dumps(out))
        if PAGE == 'index.html':
            p.wait_for_timeout(1500)
            print('   after 1.8 s:', json.dumps(p.evaluate('() => window.__r.heroAnim()')))
            p.keyboard.press('Space')
            p.wait_for_timeout(150)
            print('   after SPACE:', json.dumps(p.evaluate('() => window.__r.heroAnim()')))
            p.wait_for_timeout(900)
            print('   after attack:', json.dumps(p.evaluate('() => window.__r.heroAnim()')))
        else:
            p.wait_for_timeout(200)
            print('   extra:', json.dumps(p.evaluate('() => window.__r.extra ? window.__r.extra() : null')))
        p.screenshot(path=str(HERE / f'shot_{PAGE.split(".")[0]}_{phaserdir}.png'))
        print('   errors:', errs)
        p.close()
    b.close()
