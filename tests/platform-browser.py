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
            # the author edits the post in place
            pg.locator('[data-island=own-post] [data-edit]').click(); pg.wait_for_timeout(500)
            pg.fill('article.post input[name=title]', 'E2E 질문 (수정됨)'); pg.click('article.post button[type=submit]'); pg.wait_for_timeout(1200)
            assert '수정됨' in pg.locator('h1').inner_text()
            pg.fill('#comment-form textarea', '첫 댓글'); pg.click('#comment-form button[type=submit]'); pg.wait_for_timeout(1200)
            pg.locator('[data-reply]').first.click(); pg.fill('#comment-form textarea', '답글'); pg.click('#comment-form button[type=submit]'); pg.wait_for_timeout(1200)
            assert pg.locator('.co.re').count() == 1, 'reply is threaded'
            pg.goto(B + '/ko/games/caves-of-qud/'); pg.wait_for_timeout(500)
            posts_before = pg.locator('.plist .pr').count()
            for _ in range(2): pg.locator('[data-island=compat-vote] button').first.click(); pg.wait_for_timeout(500)
            assert pg.locator('[data-island=compat-vote] button.on').count() == 1 and pg.locator('.vmore').count() == 1, 'a click is a vote with a link to a detailed report'
            pg.reload(); pg.wait_for_timeout(300)
            assert pg.locator('.plist .pr').count() == posts_before, 'votes never create posts'
            # flag the post, then handle it as a moderator (임시조치 with a reason)
            pg.goto(B + '/ko/games/caves-of-qud/'); pg.wait_for_timeout(300)
            post_url = pg.locator('.plist a.tt').first.get_attribute('href')
            pg.goto(B + post_url); pg.wait_for_timeout(300)
            pg.goto(B + pg.locator('.pact a', has_text='신고').get_attribute('href')); pg.wait_for_timeout(400)
            pg.select_option('select[name=reason]', 'spam'); pg.click('form[data-island=flag-form] button[type=submit]'); pg.wait_for_timeout(600)
            mod = b.new_page(); mod.on('dialog', lambda d: d.accept('도배 확인'))
            mod.goto(B + '/__dev/login?as=mod1&role=moderator&next=/ko/community/mod'); mod.wait_for_timeout(900)
            assert mod.locator('.mq').count() >= 1, 'the flagged post is in the queue'
            mod.locator('.mq button', has_text='임시조치').first.click(); mod.wait_for_timeout(1200)
            assert '도배 확인' in mod.locator('[data-log]').inner_text()
            assert pg.request.get(B + post_url).status == 404, 'hidden posts are gone from the site'
            mod.reload(); mod.wait_for_timeout(900)
            hidden = mod.locator('[data-hidden] .mq')
            assert hidden.count() >= 1, 'the moderator still sees the hidden post'
            hidden.first.locator('button', has_text='복구').click(); mod.wait_for_timeout(1200)
            assert pg.request.get(B + post_url).status == 200, 'restored'
            pg.goto(B + '/ko/community/me'); pg.wait_for_selector('[data-follows]:not([hidden]) li', timeout=5000)
            pg.fill('form[data-nickname] input', '밤샘테스터'); pg.click('form[data-nickname] button'); pg.wait_for_timeout(500)
            assert pg.locator('[data-follows] li').count() >= 1, 'followed channels listed'
            assert pg.locator('[data-posts] li a').count() >= 1 and pg.locator('[data-comments] li a').count() >= 1, 'my posts and comments listed'
            pg.goto(B + '/ko/ai/claude/'); pg.wait_for_timeout(600)
            assert pg.locator('.hd [data-island=account]').inner_text() == '밤샘테스터'
            pg.goto(B + '/ko/radar/'); pg.wait_for_timeout(800)
            assert pg.locator('#mine').is_visible(), 'My Radar shows for signed-in readers'
            assert pg.locator('#mine .mr .chn').count() >= 1, 'each item names its channel once'
            pg.goto(B + '/ko/community/'); pg.wait_for_timeout(800)
            assert '내 구독 채널' in pg.locator('.box.login').inner_text(), 'the sign-in box becomes the reader\'s channels'
            m = b.new_page(viewport={'width': 390, 'height': 900})
            for path in ['/ko/community/', '/ko/ai/claude/', '/ko/games/caves-of-qud/', '/ko/hardware/rtx-5070/', '/ko/ai/claude/write', '/ko/ai/claude/status', '/ko/hardware/rtx-5070/local-llm', '/ko/radar/', '/ko/search/?q=claude', '/ko/ai/claude-opus-5-5/']:
                m.goto(B + path); m.wait_for_timeout(300)
                assert m.locator('.hd .hn a[href$="/radar/"]').is_visible(), f'{path}: Radar is reachable from the mobile header'
                w = m.evaluate('document.documentElement.scrollWidth')
                assert w <= 390, f'{path} scrolls sideways at 390px ({w})'
            # WCAG 2 A/AA with axe-core when available (AXE_CORE=/path/to/axe.min.js); skipped otherwise.
            axe = os.environ.get('AXE_CORE')
            if axe and os.path.exists(axe):
                src = open(axe).read(); ctx = b.new_context(bypass_csp=True); ap = ctx.new_page()
                for path in ['/ko/community/', '/ko/ai/claude/', '/ko/games/caves-of-qud/', '/ko/hardware/rtx-5070/local-llm', '/ko/ai/claude/status', '/ko/radar/']:
                    ap.goto(B + path); ap.wait_for_timeout(300); ap.add_script_tag(content=src)
                    v = ap.evaluate("axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}}).then(r=>r.violations.map(x=>x.id+' '+x.nodes[0].target.join(' ')))")
                    assert not v, f'{path}: {v}'
            b.close()
        assert not errors, errors
        print('platform browser E2E: ok')
    finally:
        proc.terminate()

if __name__ == '__main__':
    main()
