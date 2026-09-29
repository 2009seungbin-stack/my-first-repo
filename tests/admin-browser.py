"""Admin PWA browser E2E at 390x844 against tests/admin-mock-server.mjs (the app as built, with the
production CSP, and a contract-shaped mock API). Covers: sign-in screen, first-time setup with a
virtual WebAuthn authenticator (CDP), every tab rendering fixtures, NOT_CONFIGURED cards, confirm
sheets (server error text shown, success), REAUTH retry, offline banner + service-worker offline
copy, 360 px without sideways scroll, dark mode, sign-out.
   python tests/admin-browser.py [--shots DIR]"""
import json, os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

PORT = int(os.environ.get('ADMIN_PORT', '8796'))
B = f'http://localhost:{PORT}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
checks = []
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

def ok(name, cond=True, detail=''):
    if not cond: raise AssertionError(f'{name} {detail}')
    checks.append(name); print('PASS', name, flush=True)

def mock(state):
    req = urllib.request.Request(B + '/__mock/state', data=json.dumps(state).encode(), method='POST', headers={'content-type': 'application/json'})
    return json.load(urllib.request.urlopen(req))

def wait_up(proc):
    for _ in range(80):
        try: urllib.request.urlopen(B + '/__mock/log', timeout=2); return
        except Exception:
            if proc.poll() is not None: raise SystemExit('mock server exited')
            time.sleep(0.25)
    raise SystemExit('mock server did not start')

def shot(page, name):
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.evaluate('scrollTo(0,0)'); page.wait_for_timeout(100)
        page.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=True)

def launch(p):
    exe = os.environ.get('CHROMIUM') or ('/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None)
    return p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()

def until(page, js, timeout=8000):
    # page.wait_for_function evaluates strings with eval, which the app's CSP forbids; poll instead.
    end = time.time() + timeout / 1000
    while time.time() < end:
        if page.evaluate(js): return
        page.wait_for_timeout(50)
    raise AssertionError('timed out waiting for ' + js)

def settle(page, ms=250):
    page.wait_for_timeout(120); until(page, '!document.querySelector(".skel")&&!document.querySelector(".ib.spin")'); page.wait_for_timeout(ms)

def no_sideways(page, where):
    w = page.evaluate('document.documentElement.scrollWidth'); vw = page.evaluate('innerWidth')
    ok(f'{where}: no sideways scroll at {vw}px', w <= vw, f'({w})')

def main():
    proc = subprocess.Popen(['node', 'tests/admin-mock-server.mjs', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    errors = []
    try:
        wait_up(proc)
        with sync_playwright() as p:
            b = launch(p)
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, locale='ko-KR', timezone_id='Asia/Seoul', service_workers='allow')
            # Google Fonts stay outside the test: an empty stylesheet (the app falls back to system fonts).
            ctx.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, content_type='text/css', body=''))
            ctx.route('https://fonts.gstatic.com/**', lambda r: r.abort())
            pg = ctx.new_page()
            # Expected API error statuses (404 signed out, 503 not configured, 409, 401 REAUTH) log 'Failed to load resource'; anything else (CSP 'Refused to…', exceptions) fails.
            pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and not m.text.startswith('Failed to load resource') else None)
            pg.on('pageerror', lambda e: errors.append(str(e)))
            cdp = ctx.new_cdp_session(pg)
            cdp.send('WebAuthn.enable', {'enableUI': False})
            auth = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}})

            # --- headers / shell ---
            r = pg.request.get(B + '/admin/')
            ok('admin shell is noindex (header + meta)', r.headers.get('x-robots-tag') == 'noindex, nofollow' and 'name="robots" content="noindex,nofollow"' in r.text())
            ok('admin shell has the strict CSP', "script-src 'self';" in r.headers.get('content-security-policy', '') and 'unsafe-inline' not in r.headers.get('content-security-policy', ''))
            man = pg.request.get(B + '/admin/manifest.webmanifest').json()
            ok('manifest: standalone, scoped to /admin/, maskable icons', man['scope'] == '/admin/' and man['display'] == 'standalone' and any(i.get('purpose') == 'maskable' for i in man['icons']))
            for i in man['icons']:
                ok(f"icon {i['src']} is served", pg.request.get(B + i['src']).status == 200)

            # --- sign-in ---
            pg.goto(B + '/admin/'); pg.wait_for_selector('#signin')
            ok('signed out: the sign-in screen, no tabs', pg.locator('#signin').inner_text().strip() == '지문으로 로그인' and not pg.locator('nav.bn').is_visible())
            shot(pg, '01-signin'); no_sideways(pg, 'sign-in')

            # --- first-time setup with the virtual authenticator ---
            pg.click('text=이 휴대폰 등록하기'); pg.wait_for_selector('#setup-code')
            pg.fill('#setup-code', 'wrong-code'); pg.click('button[type=submit]'); pg.wait_for_selector('.auth-err:not([hidden])')
            ok('wrong setup code: plain Korean error', '설정 코드가 맞지 않아요' in pg.locator('.auth-err').inner_text())
            shot(pg, '02-setup')
            pg.fill('#setup-code', 'test-setup-code'); pg.fill('#setup-name', '테스트 휴대폰'); pg.click('button[type=submit]')
            pg.wait_for_selector('nav.bn', state='visible'); settle(pg)
            creds = cdp.send('WebAuthn.getCredentials', {'authenticatorId': auth['authenticatorId']})['credentials']
            ok('setup created a resident passkey on this device', len(creds) == 1 and creds[0]['isResidentCredential'])

            # --- 홈 ---
            ok('home: red card for the failing collector', 'steam-news 실패' in pg.locator('.alert').inner_text())
            ok('home: monthly D1 usage (Workers Paid)', '이번 달' in pg.locator('section.box', has_text='D1 쓰기').inner_text() and '5000만' in pg.locator('section.box', has_text='D1 쓰기').inner_text())
            ok('home: tiles and the traffic tile', pg.locator('.tiles .tile').count() == 4 and 'Googlebot' in pg.locator('.tile.traffic').inner_text())
            mock({'notConfigured': ['usage']}); pg.click('button[aria-label="새로 고침"]'); settle(pg, 500)
            ok('home: D1 usage not configured → every missing setting named', pg.locator('.need .need-item').count() == 2 and 'CF_ACCOUNT_ID' in pg.locator('.need').inner_text())
            shot(pg, '03b-home-usage-not-configured')
            mock({'notConfigured': []}); pg.click('button[aria-label="새로 고침"]'); settle(pg)
            ok('home: tab badges', pg.locator('[data-tab=collectors] .bdg').inner_text() == '5' and pg.locator('[data-tab=mod] .bdg').inner_text() == '2')
            ok('home: five tabs', pg.locator('nav.bn a').count() == 5 and '방문자' in pg.locator('nav.bn').inner_text())
            shot(pg, '03-home'); no_sideways(pg, 'home')

            # --- 수집기 ---
            pg.click('[data-tab=collectors]'); settle(pg)
            ok('collectors: problems first', pg.locator('.box.hl .rows li').count() == 5 and 'steam-news' in pg.locator('.box.hl .rows li').first.inner_text())
            ok('collectors: manual collectors in one row', 'gpu-specs-manual' in pg.locator('li.manual').inner_text())
            shot(pg, '04-collectors'); no_sideways(pg, 'collectors')
            pg.click('text=문제 5'); ok('collectors: filter chips', pg.locator('.rows li').count() == 5)
            pg.click('text=전체 21')
            pg.locator('.box.hl a.rowa').first.click(); settle(pg)
            ok('collector detail: raw error + plain advice', 'free tier' in pg.locator('pre.err').inner_text() and '09:00' in pg.locator('.advice').inner_text())
            ok('collector detail: empty runs state', '실행 기록 0건' in pg.locator('main').inner_text())
            mock({'notConfigured': ['run']})
            pg.click('text=지금 실행'); pg.wait_for_selector('dialog[open]')
            ok('run sheet offers this one or all problem collectors', pg.locator('dialog .chipf').count() == 2)
            pg.locator('dialog button[type=submit]').click(); pg.wait_for_selector('dialog .sheet-err:not([hidden])')
            ok('run without GitHub token: 설정 필요 in the sheet', 'GitHub 실행 토큰' in pg.locator('dialog .sheet-err').inner_text())
            shot(pg, '05-run-sheet-not-configured')
            mock({'notConfigured': []})
            pg.locator('dialog button[type=submit]').click(); pg.wait_for_selector('dialog', state='detached')
            ok('run requested: toast', '실행을 요청했어요' in pg.locator('#toast').inner_text())
            no_sideways(pg, 'collector detail')

            # --- 신고 ---
            pg.click('[data-tab=mod]'); settle(pg)
            ok('moderation: two flag cards', pg.locator('article.flag').count() == 2)
            shot(pg, '06-moderation'); no_sideways(pg, 'moderation')
            pg.locator('article.flag').nth(1).locator('button', has_text='임시조치').click(); pg.wait_for_selector('dialog[open]')
            pg.locator('dialog button[type=submit]').click()
            ok('reason is required', '사유를' in pg.locator('dialog .sheet-err').inner_text())
            pg.locator('dialog .qr button', has_text='욕설·비하').click(); pg.locator('dialog button[type=submit]').click()
            pg.locator('dialog .sheet-err', has_text='이미').wait_for()
            ok('server error text shown in the sheet (409 Already hidden)', '이미 임시조치된 대상이에요' in pg.locator('dialog .sheet-err').inner_text())
            shot(pg, '07-mod-sheet-error')
            pg.locator('dialog button', has_text='취소').click()
            pg.locator('article.flag').first.locator('button', has_text='임시조치').click(); pg.wait_for_selector('dialog[open]')
            pg.locator('dialog .qr button', has_text='외부 홍보 링크').click(); pg.locator('dialog button[type=submit]').click()
            pg.wait_for_selector('dialog', state='detached'); settle(pg)
            log = json.load(urllib.request.urlopen(B + '/__mock/log'))
            ok('moderation action posted with its reason', any(e['path'] == '/api/v2/mod/action' and e['body'] == {'target': 'discussion:d1', 'action': 'hide', 'reason': '외부 홍보 링크'} for e in log))
            pg.click('text=처리 기록'); ok('moderation log view', '외부 홍보 링크' in pg.locator('main').inner_text())

            # --- 데이터 ---
            pg.click('[data-tab=data]'); settle(pg)
            ok('data: conflicts, proposals, changes', pg.locator('.cf').count() == 3 and pg.locator('.flag').count() == 1 and pg.locator('.imp').count() == 5)
            ok('data: backend shapes (label, channel link, detail, pending)', '최신 버전' in pg.locator('.cf').first.inner_text() and pg.locator('.cf a.chn').first.get_attribute('href') == '/ko/studio/reaper/' and '승인 대기' in pg.locator('main').inner_text() and '(JP)' in pg.locator('.cf').nth(2).inner_text())
            shot(pg, '08-data'); no_sideways(pg, 'data')
            pg.locator('.cf').first.locator('button', has_text='새 값 채택').click(); pg.wait_for_selector('dialog[open]')
            pg.locator('dialog .qr button').first.click(); pg.locator('dialog button[type=submit]').click(); pg.wait_for_selector('dialog', state='detached'); settle(pg)
            log = json.load(urllib.request.urlopen(B + '/__mock/log'))
            ok('conflict adopted via radar/action', any(e['path'] == '/api/v2/admin/radar/action' and e['body'].get('action') == 'adopt' and e['body'].get('kind') == 'conflict' for e in log))
            pg.click('text=더 보기'); until(pg, 'document.querySelectorAll(".imp").length===6')
            ok('data: cursor paging', pg.locator('.imp').count() == 6)

            # --- 방문자 ---
            pg.click('[data-tab=traffic]'); settle(pg)
            ok('traffic: 확인됨 / 자칭 / 의심 badges', pg.locator('.rows li', has_text='Googlebot').locator('.st.ok').inner_text() == '확인됨' and '자칭' in pg.locator('.rows li', has_text='GPTBot').locator('.st.mute').inner_text() and '의심' in pg.locator('.rows li', has_text='python-requests').locator('.st.warn').inner_text())
            pg.locator('.rows li', has_text='ClaudeBot').locator('button.stb').click()
            ok('traffic: 자칭 explains itself', 'Yeti' in pg.locator('#toast').inner_text())
            ok('traffic: where people come from', '검색' in pg.locator('section.box', has_text='사람은 어디서 왔나').inner_text())
            pg.click('.chipf:has-text("국가")'); ok('traffic: countries by name', '대한민국' in pg.locator('section.box', has_text='사람은 어디서 왔나').inner_text())
            ok('traffic: coverage note when the Worker does not see HTML', '일부만 집계' in pg.locator('.note-box').inner_text())
            ok('traffic: hourly columns + table view', pg.locator('.cols .col').count() == 24 and pg.locator('details.tablev').count() == 1)
            pg.locator('.cols .col').nth(20).click(); ok('traffic: column tooltip', '사람' in pg.locator('.tip').inner_text())
            pg.click('.chipf:has-text("AI")'); ok('traffic: bot category filter', pg.locator('.rows li').count() == 3)
            shot(pg, '09-traffic'); no_sideways(pg, 'traffic')
            pg.click('text=7일'); settle(pg)
            log = json.load(urllib.request.urlopen(B + '/__mock/log'))
            ok('traffic: range switch', any(e['path'] == '/api/v2/admin/traffic?range=7d' for e in log))
            mock({'notConfigured': ['traffic']}); pg.click('button[aria-label="새로 고침"]'); settle(pg)
            ok('traffic not configured: 설정 필요 card naming every missing setting', pg.locator('.need').count() == 1 and pg.locator('.need .need-item').count() == 2 and 'Analytics Engine' in pg.locator('.need').inner_text())
            shot(pg, '10-traffic-not-configured')
            mock({'notConfigured': []})

            # --- 커뮤니티 (from 홈) ---
            pg.click('[data-tab=home]'); settle(pg)
            pg.click('.tile[href="#/community"]'); settle(pg)
            ok('community: tiles, spark, channels, new members', pg.locator('.tiles .tile').count() == 4 and pg.locator('svg.spark').count() == 1 and '노을빛고양이' in pg.locator('main').inner_text())
            shot(pg, '11-community'); no_sideways(pg, 'community')
            pg.click('text=‹ 전날'); settle(pg)
            log = json.load(urllib.request.urlopen(B + '/__mock/log'))
            ok('community: previous day', any(e['path'].startswith('/api/v2/admin/community?day=') for e in log[-2:]))

            # --- 알림 (header bell) ---
            pg.click('a[href="#/"]'); settle(pg)
            mock({'notConfigured': ['push']})
            pg.click('.ab a[href="#/notifications"]'); settle(pg, 500)
            ok('notifications: prefs from the contract', pg.locator('#n-fail-n').count() == 1 and pg.locator('#n-quiet').is_checked())
            ok('notifications: push key missing → 설정 필요', 'VAPID' in pg.locator('.need').inner_text())
            pg.click('#n-th-90'); ok('usage threshold chips toggle', pg.locator('#n-th-90').get_attribute('aria-pressed') == 'false')
            shot(pg, '12-notifications'); no_sideways(pg, 'notifications')
            mock({'notConfigured': []})

            # --- 설정 ---
            pg.click('.ab a[href="#/"]'); settle(pg); pg.click('.ab a[href="#/settings"]'); settle(pg)
            ok('settings: this device listed and marked', '테스트 휴대폰' in pg.locator('main').inner_text() and '이 기기' in pg.locator('main').inner_text())
            # This phone already holds the passkey (excludeCredentials): the browser refuses, the sheet says why.
            pg.click('text=기기 추가'); pg.wait_for_selector('dialog[open]'); pg.locator('dialog button[type=submit]').click()
            pg.locator('dialog .sheet-err', has_text='이미 등록된 패스키').wait_for()
            ok('기기 추가 on the same phone: explained', True)
            pg.locator('dialog button', has_text='취소').click()
            # Another device (a second virtual authenticator) gets its own passkey; the first one is kept aside.
            saved = cdp.send('WebAuthn.getCredentials', {'authenticatorId': auth['authenticatorId']})['credentials']
            cdp.send('WebAuthn.removeVirtualAuthenticator', {'authenticatorId': auth['authenticatorId']})
            opts = {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}
            other = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': opts})
            pg.click('text=기기 추가'); pg.wait_for_selector('dialog[open]'); pg.fill('#dev-name', '업무용 PC'); pg.locator('dialog button[type=submit]').click(); 
            pg.wait_for_selector('dialog', state='detached'); settle(pg)
            new_creds = cdp.send('WebAuthn.getCredentials', {'authenticatorId': other['authenticatorId']})['credentials']
            cdp.send('WebAuthn.removeVirtualAuthenticator', {'authenticatorId': other['authenticatorId']})
            auth = cdp.send('WebAuthn.addVirtualAuthenticator', {'options': opts})
            for c in saved: cdp.send('WebAuthn.addCredential', {'authenticatorId': auth['authenticatorId'], 'credential': {k: c[k] for k in ('credentialId', 'isResidentCredential', 'rpId', 'privateKey', 'userHandle', 'signCount') if k in c}})
            ok('기기 추가: a second passkey while signed in', pg.locator('.rows li', has_text='업무용 PC').count() == 1 and len(new_creds) == 1)
            shot(pg, '13-settings')
            pg.locator('.rows li', has_text='업무용 PC').locator('button', has_text='삭제').click(); pg.locator('dialog button[type=submit]').click()
            pg.wait_for_selector('dialog', state='detached'); settle(pg)
            ok('passkey removed from the list', pg.locator('.rows li', has_text='업무용 PC').count() == 0)

            # --- REAUTH: one fingerprint, then the request is retried ---
            pg.click('.ab a[href="#/"]'); settle(pg)
            mock({'reauth': 1}); pg.click('button[aria-label="새로 고침"]'); pg.wait_for_selector('dialog[open]')
            ok('REAUTH asks for the passkey again', '다시 확인이 필요해요' in pg.locator('dialog').inner_text())
            pg.wait_for_timeout(300); shot(pg, '14-reauth')
            pg.locator('dialog button[type=submit]').click(); pg.wait_for_selector('dialog', state='detached'); settle(pg)
            ok('after REAUTH the screen loads', 'steam-news 실패' in pg.locator('.alert').inner_text())

            # --- offline: banner + the service worker's saved copy ---
            until(pg, 'navigator.serviceWorker.controller!==null', 10000)
            pg.reload(); settle(pg)
            ctx.set_offline(True)
            pg.wait_for_selector('.offline:not([hidden])')
            ok('offline banner', '오프라인' in pg.locator('.offline').inner_text())
            pg.click('button[aria-label="새로 고침"]'); settle(pg)
            ok('offline: home from the saved copy', 'steam-news 실패' in pg.locator('.alert').inner_text() and '저장된 화면' in pg.locator('.offline').inner_text())
            shot(pg, '15-offline')
            pg.reload(); settle(pg)
            ok('offline: the app shell opens from the service worker', pg.locator('nav.bn').is_visible() and pg.locator('.tiles .tile').count() == 4)
            ctx.set_offline(False); pg.wait_for_timeout(600)

            # --- 360 px + dark mode ---
            pg.set_viewport_size({'width': 360, 'height': 780})
            for h in ['#/', '#/collectors', '#/mod', '#/data', '#/traffic', '#/community', '#/notifications', '#/settings', '#/collectors/claude-status']:
                pg.goto(B + '/admin/' + h); settle(pg, 150); no_sideways(pg, h)
            ok('collector with runs lists them', pg.locator('.rows li').count() == 6)
            pg.set_viewport_size({'width': 390, 'height': 844})
            pg.emulate_media(color_scheme='dark'); pg.goto(B + '/admin/#/'); settle(pg)
            bg = pg.evaluate('getComputedStyle(document.body).backgroundColor')
            ok('dark mode', bg == 'rgb(15, 20, 28)', bg)
            shot(pg, '16-home-dark')
            pg.goto(B + '/admin/#/traffic'); settle(pg); shot(pg, '17-traffic-dark')
            pg.emulate_media(color_scheme='light')

            # --- empty state + sign-out ---
            mock({'emptyMod': True}); pg.goto(B + '/admin/#/mod'); settle(pg)
            ok('moderation empty state', '처리할 신고가 없습니다' in pg.locator('.empty').inner_text())
            pg.goto(B + '/admin/#/settings'); settle(pg)
            pg.click('text=로그아웃'); pg.locator('dialog button[type=submit]').click(); pg.wait_for_selector('#signin')
            ok('signed out → sign-in screen', '로그아웃했어요' in pg.locator('main').inner_text())
            pg.click('#signin'); pg.wait_for_selector('nav.bn', state='visible'); settle(pg)
            ok('sign in again with the passkey', pg.locator('.tiles .tile').count() == 4)
            b.close()
        ok('no console errors (CSP violations included)', not errors, errors)
        print(f'admin browser E2E: {len(checks)} checks ok')
    finally:
        proc.terminate()

if __name__ == '__main__':
    main()
