"""Production public routing over local fixture data; never contacts production D1."""
import os
import subprocess
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get('PUBLIC_SITE_PORT', '8799'))
BASE = f'http://localhost:{PORT}'
OUT = ROOT / 'test-results' / 'public-site'
OUT.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, PUBLIC_SITE='on')
proc = subprocess.Popen(['node', 'tools/platform/dev-server.mjs', str(PORT)], cwd=ROOT, env=env,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try:
            urllib.request.urlopen(BASE + '/', timeout=2).close()
            break
        except Exception:
            if proc.poll() is not None:
                raise RuntimeError('Public fixture server exited')
            time.sleep(.3)
    else:
        raise RuntimeError('Public fixture server did not start')
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel='chrome')
        errors, requests = [], []
        for width, height in [(1440, 1000), (390, 844)]:
            ctx = browser.new_context(viewport={'width': width, 'height': height})
            pg = ctx.new_page()
            pg.on('pageerror', lambda error: errors.append(str(error)))
            pg.on('request', lambda req: requests.append(req.url) if '/api/v2/' in req.url else None)
            for path in ['/', '/en/', '/ko/news/', '/ko/ai/digest/', '/ko/ai/', '/ko/ai/claude/',
                         '/ko/hardware/performance/', '/ko/bracket/', '/ko/radar/']:
                assert pg.goto(BASE + path).status == 200, path
                assert pg.locator('a[href*="/community/"]').count() == 0, path
                assert pg.locator('[data-island="account"], [data-island="follow"], [data-island="bench-form"]').count() == 0, path
                assert pg.evaluate('document.documentElement.scrollWidth <= innerWidth + 2'), (width, path)
                if path == '/':
                    assert pg.locator('[data-home-news] li').count() > 0
                    assert pg.locator('[data-home-digest]').count() == 1
                    assert '아직 게시된 해설이 없습니다' in pg.locator('[data-home-digest]').inner_text()
                    before = pg.evaluate('document.documentElement.dataset.theme')
                    pg.locator('[data-theme-toggle]').click()
                    assert pg.evaluate('document.documentElement.dataset.theme') != before
                    if width == 390:
                        pg.locator('[data-drawer-open]').click()
                        assert pg.locator('body').evaluate('(el)=>el.classList.contains("drawer")')
                        pg.keyboard.press('Escape')
                        assert not pg.locator('body').evaluate('(el)=>el.classList.contains("drawer")')
                    pg.screenshot(path=str(OUT / f'home-{width}.png'), full_page=True)
                if path == '/ko/bracket/':
                    pg.wait_for_selector('[data-bk-enable]:not([disabled])')
            assert pg.request.get(BASE + '/ko/community/free/1').status == 410
            assert pg.request.post(BASE + '/api/v2/posts', data='{}').status == 410
            ctx.close()
        browser.close()
        assert not errors, errors
        assert all(url.split('/api/v2/')[1].split('?')[0] == 'hit' for url in requests), requests
        print('Public routing browser checks passed: desktop/mobile, news, draft isolation, navigation, tools and closure.')
finally:
    proc.terminate()
    proc.wait(timeout=15)
