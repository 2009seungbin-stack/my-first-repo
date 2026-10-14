"""대진표 만들기 in a real browser: draw, tap winners, random picks, the hidden rig (five taps and
Alt+Shift+R), rigged and plain share links, byes, phone/desktop overflow, dark mode, and QA PNGs."""
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
NAMES = ['민수', '지영', '현우', '서연', '도윤', '하은', '준호', '수아', '태민', '예린', '시우', '지호', '유나', '건우', '채원', '은우']


def champion(pg):
    return pg.locator('.bk-s.champ').inner_text().strip()


def draw(pg):
    pg.locator('[data-bk-draw]').click()
    pg.wait_for_function("document.querySelectorAll('.bk-s.spin').length===0 && !document.querySelector('[data-bk-redraw]').disabled")


def auto(pg):
    pg.locator('[data-bk-auto]').click()
    pg.wait_for_function("document.querySelector('.bk-s.champ:not(.wait)') && !document.querySelector('[data-bk-redraw]').disabled", timeout=60000)


def rig(pg, fates, pairs=()):
    for _ in range(5):
        pg.locator('h1[data-bk-secret]').click()
    pg.wait_for_selector('[data-bk-rig][open]')
    for name, label in fates:
        pg.locator(f'select[data-kind=fate][data-name="{name}"]').select_option(label=label)
    for a, b in pairs:
        pg.locator(f'select[data-kind=pair][data-name="{a}"]').select_option(b)


def run():
    base = os.environ.get('BRACKET_BASE')
    proc = None
    output = ROOT / 'test-results/bracket'; output.mkdir(parents=True, exist_ok=True)
    if not base:
        with socket.socket() as s:
            s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
        base = f'http://localhost:{port}'
        log = open(output / 'server.log', 'w', encoding='utf8')
        proc = subprocess.Popen(['node', 'tools/platform/dev-server.mjs', str(port)], cwd=ROOT, stdout=log, stderr=log)
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(base + '/ko/bracket/', timeout=2); break
            except Exception:
                if proc and proc.poll() is not None: raise RuntimeError('dev server exited')
                time.sleep(.25)
        else: raise RuntimeError('dev server did not start')
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN') or None)
            errors = []
            ctx = b.new_context(viewport={'width': 1440, 'height': 900}, bypass_csp=True)
            ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=base)
            pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            pg.goto(base + '/ko/bracket/'); pg.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            assert pg.locator('[data-bk-board]').is_hidden()
            pg.fill('input[name=title]', '최애 라면 월드컵')
            pg.fill('textarea[name=names]', '\n'.join(NAMES))
            assert '16명' in pg.locator('[data-bk-count]').inner_text()
            assert pg.locator('.bk-dot').count() == 0
            draw(pg)
            leaves = [x.strip() for x in pg.locator('.bk-s[data-r="0"]').all_inner_texts()]
            assert sorted(leaves) == sorted(NAMES), leaves
            assert pg.locator('[data-bk-name]').inner_text() == '최애 라면 월드컵'
            pg.screenshot(path=str(output / 'desktop-drawn.png'), full_page=True)

            # Tap winners by hand, change one, undo.
            first = pg.locator('.bk-s[data-r="0"][data-i="0"]'); second = pg.locator('.bk-s[data-r="0"][data-i="1"]')
            a, c = first.inner_text().strip(), second.inner_text().strip()
            first.click(); assert pg.locator('.bk-s[data-r="1"][data-i="0"]').inner_text().strip() == a
            second.click(); assert pg.locator('.bk-s[data-r="1"][data-i="0"]').inner_text().strip() == c
            pg.locator('[data-bk-undo]').click(); assert pg.locator('.bk-s[data-r="1"][data-i="0"]').inner_text().strip() == a
            pg.locator('[data-bk-next]').click()
            pg.wait_for_function("document.querySelectorAll('.bk-s.won').length>=2 && !document.querySelector('[data-bk-next]').disabled")
            auto(pg)
            assert champion(pg) in NAMES
            assert pg.locator('[data-bk-status]').inner_text().startswith('우승')
            pg.screenshot(path=str(output / 'desktop-champion.png'), full_page=True)

            # The hidden rig: 지영 wins, 현우 is runner-up, 민수 meets 서연 in round one.
            rig(pg, [('지영', '우승'), ('현우', '준우승')], [('민수', '서연')])
            assert '이대로 추첨' in pg.locator('[data-bk-rig-msg]').inner_text()
            assert pg.locator('select[data-kind=pair][data-name="서연"]').input_value() == '민수', 'pairs go both ways'
            pg.screenshot(path=str(output / 'desktop-rig.png'))
            pg.locator('[data-bk-rig-ok]').click(); pg.wait_for_selector('[data-bk-rig]:not([open])', state='attached')
            assert pg.locator('.bk-dot').count() == 1, 'the host sees a dot while the rig is on'
            assert '조작' not in pg.locator('main').inner_text().split('자주 묻는 질문')[0]
            for _ in range(3):
                pg.locator('[data-bk-redraw]').click()
                pg.wait_for_function("document.querySelectorAll('.bk-s.spin').length===0 && !document.querySelector('[data-bk-redraw]').disabled")
                leaves = [x.strip() for x in pg.locator('.bk-s[data-r="0"]').all_inner_texts()]
                i, j = leaves.index('민수'), leaves.index('서연'); assert i ^ 1 == j, leaves
                auto(pg)
                assert champion(pg) == '지영', champion(pg)
                finals = [pg.locator(f'.bk-s[data-r="3"][data-i="{k}"]').inner_text().strip() for k in (0, 1)]
                assert sorted(finals) == ['지영', '현우'], finals

            # Impossible: two champions cannot be saved.
            rig(pg, [('민수', '우승')])
            assert 'bad' in pg.locator('[data-bk-rig-msg]').get_attribute('class')
            pg.locator('[data-bk-rig-ok]').click(); assert pg.locator('[data-bk-rig][open]').count() == 1, 'conflicting rig stays open'
            pg.locator('select[data-kind=fate][data-name="민수"]').select_option('')
            # A rigged link: opened elsewhere it looks plain, then the draw follows the rig.
            pg.locator('[data-bk-rig-link]').click(); pg.wait_for_selector('[data-bk-toast]:not([hidden])')
            link = pg.evaluate('navigator.clipboard.readText()')
            assert '#b=' in link and '지영' not in link
            pg.keyboard.press('Escape')

            ctx2 = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, bypass_csp=True)
            ph = ctx2.new_page(); ph.on('pageerror', lambda e: errors.append(str(e)))
            ph.goto(link); ph.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            assert '#' not in ph.url, 'the link data leaves the address bar'
            assert ph.input_value('input[name=title]') == '최애 라면 월드컵'
            assert ph.locator('.bk-dot').count() == 1
            draw(ph)
            assert ph.evaluate('document.documentElement.scrollWidth') <= 390, 'no page-wide horizontal scroll on a phone'
            ph.screenshot(path=str(output / 'phone-drawn.png'), full_page=True)
            auto(ph); assert champion(ph) == '지영'
            ph.screenshot(path=str(output / 'phone-champion.png'), full_page=True)
            # Keyboard opener and clearing the rig.
            ph.keyboard.press('Alt+Shift+KeyR'); ph.wait_for_selector('[data-bk-rig][open]')
            ph.locator('[data-bk-rig-reset]').click(); ph.locator('[data-bk-rig-ok]').click()
            assert ph.locator('.bk-dot').count() == 0
            ctx2.close()

            # A plain link carries no rig; byes with 11 names in a 16 bracket.
            pg.goto(base + '/ko/bracket/'); pg.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            pg.locator('[data-bk-link]').click(); pg.wait_for_selector('[data-bk-toast]:not([hidden])')
            plain = pg.evaluate('navigator.clipboard.readText()')
            pg.locator('textarea[name=names]').fill('\n'.join(NAMES[:11]))
            assert '부전승 5' in pg.locator('[data-bk-count]').inner_text()
            pg.locator('[data-bk-draw]').click(); pg.wait_for_function("document.querySelectorAll('.bk-s.spin').length===0 && !document.querySelector('[data-bk-redraw]').disabled")
            assert pg.locator('.bk-s.bye').count() == 5
            pg.locator('textarea[name=names]').fill('\n'.join(NAMES[:7]))
            assert '9명 이상' in pg.locator('[data-bk-count]').inner_text()
            p3 = ctx.new_page(); p3.goto(plain); p3.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            assert p3.locator('.bk-dot').count() == 0, 'plain links never carry the rig'
            p3.close()

            # Reload keeps the board; dark mode; English page.
            pg.reload(); pg.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            assert pg.locator('.bk-s.bye').count() == 5
            pg.evaluate("document.documentElement.dataset.theme='dark'")
            pg.screenshot(path=str(output / 'desktop-dark.png'), full_page=True)
            pg.goto(base + '/en/bracket/'); pg.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            assert 'Draw bracket' in pg.locator('[data-bk-draw]').inner_text()
            assert not errors, errors
            b.close()
    finally:
        if proc: proc.terminate()
    print('bracket browser: ok')


if __name__ == '__main__':
    run()
