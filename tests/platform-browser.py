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

FIX = os.path.join(ROOT, 'tests', 'fixtures', 'anon')

def anon_flow(b, errors):
    """Signed out (유동): write a post with an image and a comment, edit it with the password, three other
    networks report it → hidden, a moderator restores it. Each context stands for another network."""
    def ctx(ip, **kw):
        c = b.new_context(extra_http_headers={'cf-connecting-ip': ip}, **kw); pg = c.new_page()
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'status of 404' not in m.text and 'status of 403' not in m.text else None)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        return c, pg
    ca, a = ctx('203.0.113.7')
    a.goto(B + '/ko/ai/claude/write'); a.wait_for_selector('[data-anon-fields]:not([hidden])', timeout=5000)
    assert a.locator('.needlogin').is_hidden(), 'signed out with anonymous writing on: no sign-in wall'
    assert a.locator('[data-anon-notice]').is_visible() and '봇 확인이 꺼져' in a.locator('[data-anon-notice]').inner_text(), 'no bot check on this deployment: say so'
    assert a.locator('[data-image-picker]').is_visible(), 'image picker (R2 bound)'
    a.fill('input[name=anonName]', '테스트유동'); a.fill('input[name=anonPassword]', 'pw1234')
    a.fill('input[name=title]', 'E2E 익명 글: 사진 첨부'); a.fill('textarea[name=body]', '사진 올려요')
    a.set_input_files('[data-image-input]', os.path.join(FIX, 'gps.jpg'))
    a.wait_for_function('()=>document.querySelector("textarea[name=body]").value.includes("/u/")', timeout=15000)
    assert a.locator('[data-image-list] li').count() == 1 and a.locator('[data-image-list] li.err').count() == 0
    assert re.search(r'!\[이미지\]\(/u/[0-9a-f]{24}/full\.(webp|jpg)\)', a.locator('textarea[name=body]').input_value()), 'the image is in the body'
    a.click('button[type=submit]'); a.wait_for_url(re.compile(r'/ko/ai/claude/\d+$'), timeout=15000)
    post_url = a.url.replace(B, '')
    meta = a.locator('.meta1 .nick.anon').inner_text()
    assert re.match(r'^테스트유동 \([0-9A-Za-z]{4}\)$', meta), meta
    a.wait_for_function('()=>{const i=document.querySelector(".pbody img");return i&&i.complete&&i.naturalWidth>0}', timeout=10000)
    src = a.locator('.pbody img').get_attribute('src')
    r = a.request.get(B + src)
    assert r.status == 200 and r.headers['x-content-type-options'] == 'nosniff' and b'Exif' not in r.body(), 'served on our origin without EXIF'
    # comment, name remembered
    assert a.locator('#comment-form input[name=anonName]').input_value() == '테스트유동', 'nickname remembered in this browser'
    a.fill('#comment-form textarea', '익명 댓글입니다'); a.fill('#comment-form input[name=anonPassword]', 'c0mment')
    a.click('#comment-form button[type=submit]'); a.wait_for_function('()=>document.querySelector(".cl")&&document.querySelector(".cl").textContent.includes("익명 댓글입니다")', timeout=10000)
    assert a.locator('.cl .nick.anon').count() >= 1
    # edit with the password
    a.locator('[data-anon-edit^="discussion:"]').click()
    a.locator('dialog.pw input').fill('pw1234'); a.locator('dialog.pw button[type=submit]').click()
    a.wait_for_selector('article.post input[name=title]', timeout=5000)
    a.fill('article.post input[name=title]', 'E2E 익명 글 (수정됨)'); a.click('article.post button[type=submit]')
    a.wait_for_function('()=>(document.querySelector("h1")?.textContent||"").includes("수정됨")', timeout=10000)
    # a wrong password is refused with a Korean message
    a.locator('[data-anon-delete^="discussion:"]').click()
    a.locator('dialog.pw input').fill('wrong!'); a.locator('dialog.pw button[type=submit]').click()
    a.wait_for_function('()=>document.querySelector("#n2-toast")&&document.querySelector("#n2-toast").textContent.includes("비밀번호가 맞지 않아요")', timeout=5000)
    # three other networks report it → hidden automatically
    for ip in ['198.51.100.10', '192.0.2.20', '198.18.0.30']:
        c, pg = ctx(ip)
        pg.goto(B + post_url); pg.wait_for_timeout(300)
        pg.goto(B + pg.locator('.pact a', has_text='신고').get_attribute('href')); pg.wait_for_selector('form[data-island=flag-form]')
        pg.select_option('select[name=reason]', 'spam'); pg.click('form[data-island=flag-form] button[type=submit]'); pg.wait_for_timeout(900)
        c.close()
    assert a.request.get(B + post_url).status == 404, 'hidden after 3 different reporters'
    assert a.request.get(B + src).status == 404, 'its image is hidden too'
    # a moderator sees it (with the image) and restores it
    cm, m = ctx('192.0.2.200')
    m.goto(B + '/__dev/login?as=mod2&role=moderator&next=/ko/community/mod'); m.wait_for_selector('[data-hidden] .mq', timeout=8000)
    row = m.locator('[data-hidden] .mq', has_text='E2E 익명 글')
    assert row.count() == 1 and row.locator('.mqi img').count() == 1, 'the hidden post and its image in the queue'
    assert row.locator('button', has_text='이 ID 차단 7일').count() == 1
    m.on('dialog', lambda d: d.accept('신고 오인'))
    row.locator('button', has_text='복구').click(); m.wait_for_timeout(1200)
    assert a.request.get(B + post_url).status == 200, 'restored'
    # phone width: the anonymous fields fit
    cp, ph = ctx('203.0.113.99', viewport={'width': 390, 'height': 900})
    ph.goto(B + post_url); ph.wait_for_selector('#comment-form [data-anon-fields]:not([hidden])')
    w = ph.evaluate('document.documentElement.scrollWidth'); assert w <= 390, f'anon comment box scrolls sideways ({w})'
    for c in (ca, cm, cp): c.close()

def main():
    # GitHub and Discord sign-in buttons are shown (placeholder credentials; the round trip is in service-browser.py).
    proc = subprocess.Popen(['node', 'tools/platform/dev-server.mjs', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env={**os.environ, 'DEV_SIGNIN_PROVIDERS': 'github,discord'})
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
            # Signed out: 구독 opens the sign-in sheet (configured providers only) instead of leaving the page.
            pg.locator('[data-island=follow] button').first.click()
            sheet = pg.locator('dialog#n2-signin'); sheet.wait_for(state='visible', timeout=5000)
            assert [sheet.locator('.sib').nth(i).get_attribute('data-provider') for i in range(sheet.locator('.sib').count())] == ['passkey', 'github', 'discord'], '지문으로 로그인 first, then GitHub and Discord, no Google'
            assert sheet.locator('.sib-passkey').inner_text().strip() == '지문으로 로그인' and sheet.locator('details.pk-new summary').inner_text().strip() == '처음이에요 · 지문으로 가입'
            assert sheet.locator('.sib-github').get_attribute('href') == '/api/v1/auth/github/start?return=%2Fko%2Fai%2Fclaude%2F'
            assert sheet.locator('.sib-discord').inner_text().strip() == 'Discord로 계속하기'
            sheet.locator('button.x').click(); pg.wait_for_timeout(200)
            assert not sheet.is_visible(), 'the sheet closes'
            pg.goto(B + '/ko/community/'); pg.wait_for_timeout(400)
            assert pg.locator('.box.login .sib').count() == 2, 'front page box: branded buttons'
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
            pg.locator('[data-edit-comment]').first.click(); pg.wait_for_timeout(500)
            pg.fill('.cedit textarea', '첫 댓글 (수정)'); pg.click('.cedit button[type=submit]'); pg.wait_for_timeout(1200)
            assert '첫 댓글 (수정)' in pg.locator('.cl').inner_text(), 'own comment edited in place'
            pg.goto(B + '/ko/games/caves-of-qud/'); pg.wait_for_timeout(500)
            posts_before = pg.locator('.plist .pr').count()
            for _ in range(2): pg.locator('[data-island=compat-vote] button').first.click(); pg.wait_for_timeout(500)
            assert pg.locator('[data-island=compat-vote] button.on').count() == 1 and pg.locator('.vmore').count() == 1, 'a click is a vote with a link to a detailed report'
            works_n = pg.locator('[data-tally] [data-n=works]').inner_text()
            pg.reload(); pg.wait_for_timeout(700)
            assert pg.locator('.plist .pr').count() == posts_before, 'votes never create posts'
            assert pg.locator('[data-island=compat-vote] button.on').count() == 1, 'my vote stays highlighted after a reload'
            assert pg.locator('[data-tally] [data-n=works]').inner_text() == works_n, 'the live count matched the server'
            pg.locator('[data-island=compat-vote] button').nth(2).click(); pg.wait_for_timeout(500)
            assert 'result=broken' in pg.locator('.vmore').get_attribute('href'), 'the detailed-report link carries my result'
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
            # 정보 제안: a member suggests a value, the moderator accepts it
            pg.goto(B + '/ko/games/caves-of-qud/'); pg.wait_for_timeout(400)
            pg.locator('details.prop summary').click()
            opt = pg.locator('form[data-island=propose] select[name=property] option[data-type=date]').first.get_attribute('value')
            pg.select_option('form[data-island=propose] select[name=property]', opt)
            pg.fill('form[data-island=propose] input[name=value]', '2026-10-20'); pg.fill('form[data-island=propose] input[name=sourceUrl]', 'https://example.com/notice')
            pg.click('form[data-island=propose] button[type=submit]'); pg.wait_for_timeout(700)
            mod.reload(); mod.wait_for_timeout(900)
            assert mod.locator('[data-proposals] .mq').count() == 1, 'the proposal waits for review'
            mod.locator('[data-proposals] .mq button', has_text='반영').click(); mod.wait_for_timeout(1200)
            assert '반영' in mod.locator('[data-log]').inner_text()
            pg.goto(B + '/ko/community/me'); pg.wait_for_selector('[data-follows]:not([hidden]) li', timeout=5000)
            pg.fill('form[data-nickname] input', '밤샘테스터'); pg.click('form[data-nickname] button'); pg.wait_for_timeout(500)
            assert pg.locator('[data-follows] li').count() >= 1, 'followed channels listed'
            assert pg.locator('[data-posts] li a').count() >= 1 and pg.locator('[data-comments] li a').count() >= 1, 'my posts and comments listed'
            pg.goto(B + '/ko/ai/claude/'); pg.wait_for_timeout(600)
            assert pg.locator('.hd [data-island=account]').inner_text() == '밤샘테스터'
            pg.goto(B + '/ko/radar/'); pg.wait_for_timeout(800)
            assert pg.locator('#mine').is_visible(), 'My Radar shows for signed-in readers'
            assert pg.locator('#mine .mr .chn').count() >= 1, 'each item names its channel once'
            pg.locator('.box.mf .bh button').first.click(); pg.wait_for_timeout(200)
            assert pg.locator('.box.mf .bh button[aria-pressed=true]').count() == 1, '내 구독만 filter toggles'
            pg.goto(B + '/ko/community/'); pg.wait_for_timeout(800)
            assert '내 구독 채널' in pg.locator('.box.login').inner_text(), 'the sign-in box becomes the reader\'s channels'
            anon_flow(b, errors)
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
                for path in ['/ko/community/', '/ko/ai/claude/', '/ko/games/caves-of-qud/', '/ko/hardware/rtx-5070/local-llm', '/ko/ai/claude/status', '/ko/radar/',
                             '/ko/hardware/?type=gpu&vs=rtx-4070,rtx-5070', '/ko/ai/?type=model&org=anthropic&sort=cheap', '/ko/search/?q=Claude+%EC%9E%A5%EC%95%A0', '/ko/community/policy', '/ko/games/caves-of-qud/write']:
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
