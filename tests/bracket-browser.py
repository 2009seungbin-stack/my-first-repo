"""대진표 만들기 in a real browser: draw, tap winners, random picks, the seating panel (first opponents and
every seat, five taps and Alt+Shift+R), share links with and without a seating, byes, phone/desktop
overflow, dark mode, and QA PNGs."""
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
NAMES = ['민수', '지영', '현우', '서연', '도윤', '하은', '준호', '수아', '태민', '예린', '시우', '지호', '유나', '건우', '채원', '은우']
SETTLED = "document.querySelectorAll('.bk-s.spin').length===0 && !document.querySelector('[data-bk-redraw]').disabled"


def champion(pg):
    return pg.locator('.bk-s.champ').inner_text().strip()


def leaves(pg):
    return [x.strip() for x in pg.locator('.bk-s[data-r="0"]').all_inner_texts()]


def meetings(seats):
    """Name pair → the round where they can meet (the highest bit where their seats differ)."""
    at = {n: i for i, n in enumerate(seats) if n and n != '부전승'}
    return {(a, b): (i ^ j).bit_length() - 1 for a, i in at.items() for b, j in at.items() if a < b}


def draw(pg, button='[data-bk-draw]'):
    pg.locator(button).click()
    pg.wait_for_function(SETTLED)


def auto(pg):
    pg.locator('[data-bk-auto]').click()
    pg.wait_for_function("document.querySelector('.bk-s.champ:not(.wait)') && !document.querySelector('[data-bk-redraw]').disabled", timeout=60000)


def open_seating(pg, mode_label):
    for _ in range(5):
        pg.locator('h1[data-bk-t]').click()
    pg.wait_for_selector('dialog.bk-ed[open]')
    pg.locator('.bk-ed-mode label', has_text=mode_label).click()


def seats(pg):
    return [s.input_value() for s in pg.locator('select[data-seat]').all()]


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
            draw(pg)
            assert sorted(leaves(pg)) == sorted(NAMES)
            assert pg.locator('[data-bk-name]').inner_text() == '최애 라면 월드컵'
            pg.screenshot(path=str(output / 'desktop-drawn.png'), full_page=True)

            # Tap winners by hand, change one, undo, random picks to the end.
            first = pg.locator('.bk-s[data-r="0"][data-i="0"]'); second = pg.locator('.bk-s[data-r="0"][data-i="1"]')
            a, c = first.inner_text().strip(), second.inner_text().strip()
            first.click(); assert pg.locator('.bk-s[data-r="1"][data-i="0"]').inner_text().strip() == a
            second.click(); assert pg.locator('.bk-s[data-r="1"][data-i="0"]').inner_text().strip() == c
            pg.locator('[data-bk-undo]').click(); assert pg.locator('.bk-s[data-r="1"][data-i="0"]').inner_text().strip() == a
            pg.locator('[data-bk-next]').click()
            pg.wait_for_function("document.querySelectorAll('.bk-s.won').length>=2 && !document.querySelector('[data-bk-next]').disabled")
            auto(pg)
            assert champion(pg) in NAMES and pg.locator('[data-bk-status]').inner_text().startswith('우승')
            pg.screenshot(path=str(output / 'desktop-champion.png'), full_page=True)

            # First opponents: 민수 meets 서연 and 지영 meets 현우 on every draw.
            open_seating(pg, '첫 상대만')
            pg.locator('select[data-kind=pair][data-name="민수"]').select_option('서연')
            pg.locator('select[data-kind=pair][data-name="지영"]').select_option('현우')
            assert pg.locator('select[data-kind=pair][data-name="서연"]').input_value() == '민수', 'pairs go both ways'
            pg.screenshot(path=str(output / 'desktop-pairs.png'))
            pg.locator('[data-ed=save]').click(); pg.wait_for_selector('dialog.bk-ed:not([open])', state='attached')
            for _ in range(3):
                draw(pg, '[data-bk-redraw]')
                l = leaves(pg)
                assert l.index('민수') ^ 1 == l.index('서연') and l.index('지영') ^ 1 == l.index('현우'), l

            # Every seat: take the current bracket, put 지영 against 은우, save; draws look different,
            # meetings stay.
            open_seating(pg, '전체 배치')
            pg.locator('[data-ed=board]').click()
            assert seats(pg) == leaves(pg), 'the panel starts from the bracket on screen'
            pg.locator('select[data-seat="0"]').select_option('지영')
            pg.locator('select[data-seat="1"]').select_option('은우')
            plan = seats(pg)
            assert plan[0] == '지영' and plan[1] == '은우' and sorted(plan) == sorted(NAMES), plan
            pg.screenshot(path=str(output / 'desktop-seats.png'))
            pg.locator('[data-ed=save]').click(); pg.wait_for_selector('dialog.bk-ed:not([open])', state='attached')
            want, looks = meetings(plan), set()
            for _ in range(4):
                draw(pg, '[data-bk-redraw]')
                l = leaves(pg); looks.add(tuple(l))
                assert meetings(l) == want, l
            assert len(looks) >= 2, 'redraws do not all look the same'
            auto(pg)

            # Only on signal: truly random draws until two quick taps on the trophy, then the seating on
            # every draw; the signal again (Alt+Shift+A) goes back to random; a reload is random.
            open_seating(pg, '전체 배치')
            pg.locator('input[name=cue]').check()
            plan = seats(pg); want = meetings(plan)
            pg.screenshot(path=str(output / 'desktop-cue.png'))
            pg.locator('[data-ed=save]').click(); pg.wait_for_selector('dialog.bk-ed:not([open])', state='attached')
            for _ in range(3):
                draw(pg, '[data-bk-redraw]'); assert meetings(leaves(pg)) != want, 'random before the signal'
            pg.locator('[data-bk-c]').dblclick()
            for _ in range(2):
                draw(pg, '[data-bk-redraw]'); assert meetings(leaves(pg)) == want, 'the seating after the signal'
            pg.keyboard.press('Alt+Shift+KeyA')
            draw(pg, '[data-bk-redraw]'); assert meetings(leaves(pg)) != want, 'random again'
            pg.keyboard.press('Alt+Shift+KeyA')
            draw(pg, '[data-bk-redraw]'); assert meetings(leaves(pg)) == want
            pg.reload(); pg.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            draw(pg, '[data-bk-redraw]'); assert meetings(leaves(pg)) != want, 'a reload is random'
            assert '장난용 기능 안내' in pg.locator('.bk-help').inner_text()
            open_seating(pg, '전체 배치'); pg.locator('input[name=cue]').uncheck(); pg.locator('[data-ed=save]').click()

            # A two-bye match cannot be saved (12 names → 4 byes).
            pg.locator('textarea[name=names]').fill('\n'.join(NAMES[:12]))
            open_seating(pg, '전체 배치')
            s = seats(pg)
            assert s.count('') == 4 and sorted(x for x in s if x) == sorted(NAMES[:12]), s
            bye_match = next(m for m in range(8) if not s[2 * m] or not s[2 * m + 1])
            filled = 2 * bye_match if s[2 * bye_match] else 2 * bye_match + 1
            pg.locator(f'select[data-seat="{filled}"]').select_option('')
            assert 'bad' in pg.locator('[data-ed-msg]').get_attribute('class')
            pg.locator('[data-ed=save]').click(); assert pg.locator('dialog.bk-ed[open]').count() == 1, 'stays open'
            pg.locator('[data-ed=close]').click()
            pg.locator('textarea[name=names]').fill('\n'.join(NAMES))

            # A link with the seating: on another device the draw keeps the meetings.
            open_seating(pg, '전체 배치')
            plan = seats(pg)
            pg.locator('[data-ed=link]').click(); pg.wait_for_selector('[data-bk-toast]:not([hidden])')
            link = pg.evaluate('navigator.clipboard.readText()')
            assert '#b=' in link and '지영' not in link
            pg.keyboard.press('Escape')
            ctx2 = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, bypass_csp=True)
            ph = ctx2.new_page(); ph.on('pageerror', lambda e: errors.append(str(e)))
            ph.goto(link); ph.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            assert '#' not in ph.url, 'the link data leaves the address bar'
            assert ph.input_value('input[name=title]') == '최애 라면 월드컵'
            draw(ph)
            assert meetings(leaves(ph)) == meetings(plan)
            assert ph.evaluate('document.documentElement.scrollWidth') <= 390, 'no page-wide horizontal scroll on a phone'
            ph.screenshot(path=str(output / 'phone-drawn.png'), full_page=True)
            ph.keyboard.press('Alt+Shift+KeyR'); ph.wait_for_selector('dialog.bk-ed[open]')
            assert ph.locator('.bk-ed-mode input[value=fixed]').is_checked()
            assert ph.evaluate('document.documentElement.scrollWidth') <= 390
            ph.screenshot(path=str(output / 'phone-seats.png'))
            ph.locator('.bk-ed-mode label', has_text='랜덤').click(); ph.locator('[data-ed=save]').click()
            auto(ph); assert champion(ph) in NAMES
            ctx2.close()

            # A plain link carries no seating; byes with 11 names; size hints.
            pg.locator('[data-bk-link]').click(); pg.wait_for_selector('[data-bk-toast]:not([hidden])')
            plain = pg.evaluate('navigator.clipboard.readText()')
            p3 = ctx.new_page(); p3.goto(plain); p3.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            p3.keyboard.press('Alt+Shift+KeyR'); p3.wait_for_selector('dialog.bk-ed[open]')
            assert p3.locator('.bk-ed-mode input[value=""]').is_checked(), 'plain links never carry the seating'
            p3.close()
            pg.goto(base + '/ko/bracket/'); pg.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            open_seating(pg, '랜덤'); pg.locator('[data-ed=save]').click()
            pg.locator('textarea[name=names]').fill('\n'.join(NAMES[:11]))
            assert '부전승 5' in pg.locator('[data-bk-count]').inner_text()
            draw(pg)
            assert pg.locator('.bk-s.bye').count() == 5
            pg.locator('textarea[name=names]').fill('\n'.join(NAMES[:7]))
            assert '9명 이상' in pg.locator('[data-bk-count]').inner_text()

            # Reload keeps the board; dark mode; English page.
            pg.reload(); pg.wait_for_function("document.documentElement.dataset.bracketReady==='1'")
            assert pg.locator('.bk-s.bye').count() == 5
            pg.evaluate("document.documentElement.dataset.theme='dark'"); pg.wait_for_timeout(300)
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
