"""Nerulio 2.0 browser E2E: starts tools/platform/dev-server.mjs (seed data + sample boards) and drives the
islands in Chromium: follow, write a post, comment and reply, vote, a Korean-patch compat report, no
console errors, no horizontal scroll at phone width.   npm run test:platform"""
import os, re, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

PORT = int(os.environ.get('PLATFORM_PORT', '8791'))
B = f'http://localhost:{PORT}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def wait_up(proc):
    for _ in range(120):
        try:
            urllib.request.urlopen(B + '/ko/community/', timeout=2); return
        except Exception:
            if proc.poll() is not None: raise SystemExit('dev server exited')
            time.sleep(0.5)
    raise SystemExit('dev server did not start')

def launch(p):
    exe = os.environ.get('CHROMIUM') or ('/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None)
    return p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()

def main():
    proc = subprocess.Popen(['node', 'tools/platform/dev-server.mjs', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    errors = []
    try:
        wait_up(proc)
        with sync_playwright() as p:
            b = launch(p)
            pg = b.new_page()
            pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('dialog', lambda d: d.accept())
            pg.goto(B + '/ko/ai/claude/'); pg.wait_for_timeout(600)
            assert pg.locator('[data-island=follow] button').first.inner_text() == '구독'
            pg.goto(B + '/__dev/login?as=e2e&next=/ko/ai/claude/'); pg.wait_for_timeout(600)
            assert pg.locator('.hd [data-island=account]').inner_text().startswith('user-')
            pg.locator('[data-island=follow] button').first.click(); pg.wait_for_timeout(500)
            assert '구독 중' in pg.locator('[data-island=follow] button').first.inner_text()
            pg.goto(B + '/ko/ai/claude/write'); pg.wait_for_timeout(400)
            pg.select_option('select[name=kind]', 'question')
            pg.fill('input[name=title]', 'E2E 질문: 결제 부가세?'); pg.fill('textarea[name=body]', '**굵게** <script>x</script>')
            pg.click('button[type=submit]'); pg.wait_for_url(re.compile(r'/ko/ai/claude/\d+$'))
            assert 'E2E 질문' in pg.locator('h1').inner_text()
            assert pg.locator('.pbody strong').inner_text() == '굵게' and pg.locator('.pbody script').count() == 0
            pg.fill('#comment-form textarea', '첫 댓글'); pg.click('#comment-form button[type=submit]'); pg.wait_for_timeout(1200)
            pg.locator('[data-reply]').first.click(); pg.fill('#comment-form textarea', '답글'); pg.click('#comment-form button[type=submit]'); pg.wait_for_timeout(1200)
            assert pg.locator('.co.re').count() == 1, 'reply is threaded'
            pg.goto(B + '/ko/games/caves-of-qud/'); pg.wait_for_timeout(500)
            pg.locator('[data-island=compat-vote] button').first.click(); pg.wait_for_url(re.compile(r'/ko/games/caves-of-qud/\d+$'), timeout=8000)
            assert '작동' in pg.locator('h1').inner_text()
            m = b.new_page(viewport={'width': 390, 'height': 900})
            for path in ['/ko/community/', '/ko/ai/claude/', '/ko/games/caves-of-qud/', '/ko/hardware/rtx-5070/', '/ko/ai/claude/write']:
                m.goto(B + path); m.wait_for_timeout(300)
                w = m.evaluate('document.documentElement.scrollWidth')
                assert w <= 390, f'{path} scrolls sideways at 390px ({w})'
            b.close()
        assert not errors, errors
        print('platform browser E2E: ok')
    finally:
        proc.terminate()

if __name__ == '__main__':
    main()
