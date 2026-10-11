"""다듬기 작업대 browser E2E (/{l}/make/): starts tools/platform/dev-server.mjs and drives src/make/make.js in
Chromium at 1440 and 390 px.
  · preset landings: SSR answer + canonical/hreflang; a picked sheet → files that meet the official spec,
    read back from the downloaded ZIP/PNG (LINE 370×320 even ≤1 MB + main/tab, Kakao 360×360 ≤150 KB,
    Discord 128×128 ≤256 KB, Telegram one side 512)
  · remix (?recipe=…, the recipes API mocked): the author's 6×4 recipe adapts to a 5×4 sheet, per-step
    status, POST /recipes/{id}/try once, before/after slider, the remix post carries recipe/remixOf/ai/consent
  · no page errors, no horizontal overflow at 390 px, touch targets ≥ 44 px on the phone bar
Screenshots → $MAKE_SHOTS (default: tests/make-shots/, git-ignored by name).   python tests/make-browser.py"""
import io, json, os, re, struct, subprocess, sys, tempfile, time, urllib.request, zipfile
from playwright.sync_api import sync_playwright

PORT = int(os.environ.get('MAKE_PORT', '4702'))
B = f'http://localhost:{PORT}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get('MAKE_SHOTS') or os.path.join(ROOT, 'tests', 'make-shots')
os.makedirs(SHOTS, exist_ok=True)
TMP = tempfile.mkdtemp(prefix='make-browser-')

def wait_up(proc):
    for _ in range(120):
        try:
            urllib.request.urlopen(B + '/ko/make/', timeout=2); return
        except Exception:
            if proc.poll() is not None: raise SystemExit('dev server exited')
            time.sleep(0.5)
    raise SystemExit('dev server did not start')

def launch(p):
    exe = os.environ.get('CHROMIUM') or ('/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None)
    return p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()

def sheet(cols, rows, path, cell=150, seed=7):
    """A deterministic AI-style emoji sheet: round faces with dark outlines on an off-white, slightly noisy
    backdrop, irregular spacing, a caption blob under every second face."""
    from PIL import Image, ImageDraw
    import random
    rnd = random.Random(seed)
    W, H = cols * cell, rows * cell
    im = Image.new('RGB', (W * 2, H * 2), (250, 249, 246)); d = ImageDraw.Draw(im)
    for r in range(rows):
        for c in range(cols):
            cx = (c * cell + cell / 2 + (rnd.random() - .5) * cell * .12) * 2; cy = (r * cell + cell * .45 + (rnd.random() - .5) * cell * .1) * 2
            R = cell * (.3 + rnd.random() * .06) * 2
            col = (200 + rnd.randint(0, 50), 120 + rnd.randint(0, 100), 60 + rnd.randint(0, 80))
            d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=col, outline=(30, 26, 24), width=6)
            for ex in (-.35, .35): d.ellipse((cx + R * ex - R * .12, cy - R * .22, cx + R * ex + R * .12, cy + R * .02), fill=(30, 26, 24))
            if (r + c) % 2:
                for k in range(3): d.ellipse((cx - R * .5 + k * R * .5 - 10, cy + R + 22, cx - R * .5 + k * R * .5 + 10, cy + R + 42), fill=(40, 40, 40))
    im = im.resize((W, H), Image.LANCZOS)
    px = im.load()
    for y in range(0, H, 3):
        for x in range(0, W, 3):
            p = px[x, y]
            if p[0] > 240: n = rnd.randint(-3, 3); px[x, y] = (p[0] + n, p[1] + n, p[2] + n)
    im.save(path); return path

def png_size(b):
    assert b[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    return struct.unpack('>II', b[16:24])

def errors_of(pg, sink):
    pg.on('pageerror', lambda e: sink.append(f'{pg.url}: {e}'))
    pg.on('console', lambda m: sink.append(f'{pg.url}: {m.text}') if m.type == 'error' and 'status of 404' not in m.text else None)

def wait_files(pg, timeout=120000):
    pg.wait_for_function('()=>{const c=document.querySelector("[data-check]");return c&&(c.classList.contains("ok")||c.classList.contains("bad")||/파일|file/.test(c.textContent))}', timeout=timeout)

def download(pg, selector='[data-download]'):
    with pg.expect_download(timeout=120000) as d:
        pg.locator(selector).first.click()
    path = d.value.path()
    return d.value.suggested_filename, open(path, 'rb').read()

def no_overflow(pg, label):
    over = pg.evaluate('document.documentElement.scrollWidth-innerWidth')
    assert over <= 0, f'{label}: horizontal overflow {over}px'

RECIPE_ID = 'rcpE2E6x4line'
def author_recipe():
    """What COMMUNITY's GET /api/v2/recipes/{id} returns: the author had a 6×4 sheet."""
    return {'id': RECIPE_ID, 'title': '나노바나나 피규어로 LINE 스탬프 24개', 'channel': 'sticker', 'no': 41, 'generator': 'gemini', 'prompt': '표정 24개를 6×4 격자에', 'author': '감자칩 (118.235)',
            'recipe': {'schema': 'nerulio.recipe/1', 'title': '나노바나나 피규어로 LINE 스탬프 24개', 'source': {'generator': 'gemini', 'ai': True}, 'input': {'expect': 'sheet'},
                       'steps': [{'op': 'sheet.split', 'v': 1, 'p': {'mode': 'auto', 'cols': 6, 'rows': 4}}, {'op': 'bg.remove', 'v': 1, 'p': {'mode': 'auto'}}, {'op': 'crop', 'v': 1, 'p': {'mode': 'subject', 'margin': .08}},
                                 {'op': 'sticker.border', 'v': 1, 'p': {'width': .016}}, {'op': 'fit', 'v': 1, 'p': {'preset': 'line.sticker'}}, {'op': 'export', 'v': 1, 'p': {'format': 'png', 'maxBytes': 1000000, 'extras': True}}]}}

def main():
    proc = subprocess.Popen(['node', 'tools/platform/dev-server.mjs', str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    errors, results = [], []
    try:
        wait_up(proc)
        s64 = sheet(6, 4, os.path.join(TMP, 'sheet-6x4.png'))
        s54 = sheet(5, 4, os.path.join(TMP, 'sheet-5x4.png'), seed=3)
        one = sheet(1, 1, os.path.join(TMP, 'one.png'), cell=600, seed=11)
        with sync_playwright() as p:
            b = launch(p)
            # ---------------------------------------------------------------- SSR: landings
            ctx = b.new_context(viewport={'width': 1440, 'height': 1000}); pg = ctx.new_page(); errors_of(pg, errors)
            for slug, h1 in [('kakao-emoticon', '카톡 이모티콘'), ('line-sticker', 'LINE 스탬프'), ('discord-emoji', '디스코드 이모지'), ('telegram-sticker', '텔레그램 스티커'), ('round-pfp', '원형 프사'), ('phone-wallpaper', '폰 배경화면'), ('ai-pixel-fix', 'AI 도트 정리')]:
                r = pg.goto(f'{B}/ko/make/{slug}/'); assert r.status == 200, slug
                assert h1 in pg.locator('h1').first.inner_text(), slug
                assert pg.locator('link[rel=canonical]').get_attribute('href').endswith(f'/ko/make/{slug}/')
                assert pg.locator('link[hreflang=en]').get_attribute('href').endswith(f'/en/make/{slug}/')
                assert pg.locator('.mk-answer').inner_text().strip(), 'the answer paragraph'
                assert pg.locator('meta[name=robots]').count() == 0, f'{slug} is indexable'
            pg.goto(f'{B}/en/make/line-sticker/'); assert 'LINE' in pg.locator('h1').first.inner_text() and pg.locator('html').get_attribute('lang') == 'en'
            assert pg.goto(f'{B}/ko/make/no-such-thing/').status == 404
            r = pg.goto(f'{B}/ko/make/?preset=line.sticker&utm=x'); assert pg.url.endswith('/ko/make/?preset=line.sticker'), 'junk params dropped by redirect'
            assert pg.locator('link[rel=canonical]').get_attribute('href').endswith('/ko/make/line-sticker/') and pg.locator('meta[name=robots]').count() == 1
            sm = urllib.request.urlopen(B + '/sitemap-n2-ai.xml').read().decode()
            assert '/ko/make/line-sticker/' in sm and '/en/make/kakao-emoticon/' in sm, 'landings are in the sitemap'
            results.append('SSR landings, canonical/hreflang, sitemap')

            # ---------------------------------------------------------------- LINE: 6×4 sheet → 24 stickers
            pg.goto(f'{B}/ko/make/line-sticker/')
            pg.screenshot(path=os.path.join(SHOTS, 'line-1440-empty.png'), full_page=True)
            pg.set_input_files('[data-file-input]', s64); wait_files(pg)
            assert pg.locator('[data-check].ok').count() == 1, pg.locator('[data-check]').inner_text()
            assert pg.locator('.mk-th').count() == 24, 'one thumbnail per sticker'
            assert pg.locator('.mk-step').count() == 6 and '6×4' not in pg.locator('.mk-step').first.inner_text()
            pg.screenshot(path=os.path.join(SHOTS, 'line-1440.png'), full_page=True)
            name, data = download(pg); assert name.endswith('.zip'), name
            z = zipfile.ZipFile(io.BytesIO(data)); names = sorted(z.namelist())
            stickers = [n for n in names if re.match(r'^\d+\.png$', n)]
            assert len(stickers) == 24 and 'main.png' in names and 'tab.png' in names, names
            for n in stickers:
                b_ = z.read(n); w, h = png_size(b_); assert (w, h) == (370, 320) and w % 2 == 0 and h % 2 == 0 and len(b_) <= 1_000_000, (n, w, h, len(b_))
            assert png_size(z.read('main.png')) == (240, 240) and png_size(z.read('tab.png')) == (96, 74)
            results.append(f'LINE: 24 × 370×320 even ≤1MB + main 240×240 + tab 96×74 (largest {max(len(z.read(n)) for n in stickers)} B)')
            # Step editing: add a motion step → animated APNG; settings open on the right.
            pg.locator('.mk-chip', has_text='움직이게').first.click(); wait_files(pg)
            assert pg.locator('.mk-step.on').inner_text().startswith('') and pg.locator('[data-settings] h2').inner_text() == '움직이게'
            pg.locator('[data-settings] button', has_text='흔들기').click(); wait_files(pg)
            name, data = download(pg); z = zipfile.ZipFile(io.BytesIO(data)); f01 = z.read('01.png')
            assert b'acTL' in f01, 'animated sticker is an APNG'
            results.append('step add/settings: motion → APNG')

            # ---------------------------------------------------------------- Kakao / Discord / Telegram on one picture
            for slug, check in [('kakao-emoticon', lambda w, h, n: (w, h) == (360, 360) and n <= 150_000), ('discord-emoji', lambda w, h, n: (w, h) == (128, 128) and n <= 256_000), ('telegram-sticker', lambda w, h, n: max(w, h) == 512 and min(w, h) <= 512 and n <= 512_000)]:
                pg.goto(f'{B}/ko/make/{slug}/'); pg.set_input_files('[data-file-input]', one); wait_files(pg)
                assert pg.locator('[data-check].ok').count() == 1, (slug, pg.locator('[data-check]').inner_text())
                name, data = download(pg); assert name.endswith('.png'), name
                w, h = png_size(data); assert check(w, h, len(data)), (slug, w, h, len(data))
                results.append(f'{slug}: {w}×{h} {len(data)} B')

            # ---------------------------------------------------------------- remix with a mocked recipe API
            tries, posts, uploads = [], [], []
            def route_api(route):
                url, req = route.request.url, route.request
                if f'/api/v2/recipes/{RECIPE_ID}/try' in url: tries.append(1); return route.fulfill(status=200, json={'ok': True})
                if f'/api/v2/recipes/{RECIPE_ID}' in url: return route.fulfill(status=200, json=author_recipe())
                if url.endswith('/api/v2/uploads') and req.method == 'POST': uploads.append(len(req.post_data_buffer or b'')); return route.fulfill(status=200, json={'id': f'u{len(uploads)}', 'url': f'/u/{"0"*23}{len(uploads)}/full.webp'})
                if '/api/v2/posts' in url and req.method == 'POST': posts.append(json.loads(req.post_data)); return route.fulfill(status=200, json={'url': '/ko/community/sticker/42', 'id': 'newpost'})
                return route.continue_()
            for w, label in [(1440, 'desktop'), (390, 'mobile')]:
                c2 = b.new_context(viewport={'width': w, 'height': 1000 if w > 500 else 844}, has_touch=w < 500, is_mobile=w < 500)
                c2.route('**/api/v2/**', route_api)
                r2 = c2.new_page(); errors_of(r2, errors)
                r2.goto(f'{B}/ko/make/?recipe={RECIPE_ID}')
                assert r2.locator('meta[name=robots]').count() == 1, 'a remix page is noindex'
                r2.wait_for_function('()=>/원글 레시피/.test(document.querySelector(".mk-will")?.textContent||"")')
                r2.screenshot(path=os.path.join(SHOTS, f'remix-{w}-empty.png'), full_page=True)
                n0 = len(tries)
                r2.set_input_files('[data-file-input]', s54); wait_files(r2)
                r2.wait_for_function('()=>!document.querySelector("[data-adapt]").hidden')
                adapt = r2.locator('[data-adapt]').inner_text()
                assert '6×4' in adapt and '5×4' in adapt, adapt
                dots = r2.locator('.mk-dot').all_inner_texts(); assert dots == ['✓'] * 5, dots
                times = r2.locator('[data-time]').all_inner_texts(); assert all(re.search(r'초|—', t) for t in times), times
                assert r2.locator('.mk-th').count() == 20, '5×4 → 20 stickers'
                r2.wait_for_timeout(300); assert len(tries) == n0 + 1, 'POST /recipes/{id}/try once per run'
                assert r2.locator('.mk-stage.cmp').count() == 1 and r2.locator('.mk-slider').count() == 1, 'before/after slider'
                r2.locator('.mk-slider').fill('30')
                assert r2.locator('[data-final]').input_value() == 'line.sticker'
                no_overflow(r2, f'remix {label}')
                if w < 500:
                    for sel in ['.mk-rx-bar .btn', '.mk-adj']:
                        for box in [r2.locator(sel).nth(i).bounding_box() for i in range(r2.locator(sel).count())]:
                            assert box and box['height'] >= 44 and box['width'] >= 44, (sel, box)
                    bar = r2.locator('.mk-rx-bar').bounding_box(); assert bar and bar['y'] + bar['height'] <= 844 + 1, f'sticky bar on screen {bar}'
                r2.screenshot(path=os.path.join(SHOTS, f'remix-{w}.png'), full_page=w > 500)
                # Switch the final spec: Kakao 360×360 for the same stickers.
                r2.select_option('[data-final]', 'kakao.static'); wait_files(r2)
                r2.wait_for_function('()=>/카톡/.test(document.querySelector("[data-check]")?.textContent||"")')
                assert r2.locator('[data-check].ok').count() == 1, r2.locator('[data-check]').inner_text()
                r2.select_option('[data-final]', 'line.sticker'); wait_files(r2)
                # "조정" opens the step's settings in place.
                r2.locator('.mk-adj').nth(3).click(); assert r2.locator('.mk-rx-set').count() == 1
                # Post as a remix.
                if w > 500:
                    r2.locator('.mk-rx-bar .btn.p').click()
                    f = r2.locator('[data-post-form]')
                    f.locator('input[name=title]').fill('E2E 리믹스: 5×4 시트로 해봤어요')
                    if f.locator('input[name=anonPassword]').count(): f.locator('input[name=anonPassword]').fill('pw1234')
                    f.locator('input[name=consent]').check()
                    f.locator('button[type=submit]').click()
                    r2.wait_for_url(re.compile(r'/ko/community/sticker/42$'), timeout=30000)
                    body = posts[-1]
                    assert body['remixOf'] == RECIPE_ID and body['ai'] is True and body['consent'] is True and body['channel'] == 'sticker', body
                    assert body['generator'] == 'gemini' and body['recipe']['schema'] == 'nerulio.recipe/1'
                    split = body['recipe']['steps'][0]; assert split['op'] == 'sheet.split' and (split['p']['cols'], split['p']['rows']) == (5, 4), split
                    assert body['recipe']['result']['count'] == 20 and len(uploads) == 2 and '/u/' in body['body']
                    results.append('remix post: recipe (5×4 recorded) + remixOf + ai + consent + 2 images')
                c2.close()
            results.append('remix 1440 + 390: adapt 6×4→5×4, ✓×5 with times, try once, slider, final spec switch')

            # ---------------------------------------------------------------- phone: workbench
            c3 = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True); m = c3.new_page(); errors_of(m, errors)
            m.goto(f'{B}/ko/make/kakao-emoticon/'); no_overflow(m, 'landing 390')
            m.screenshot(path=os.path.join(SHOTS, 'kakao-390-empty.png'), full_page=True)
            m.set_input_files('[data-file-input]', s64); wait_files(m); no_overflow(m, 'workbench 390')
            for i in range(m.locator('.mk-hd [data-hd-act]').count()):
                bb = m.locator('.mk-hd [data-hd-act]').nth(i).bounding_box(); assert bb['height'] >= 44, bb
            m.screenshot(path=os.path.join(SHOTS, 'kakao-390.png'), full_page=True)
            m.goto(f'{B}/ko/make/'); no_overflow(m, 'make 390')
            c3.close(); b.close()
        bad = [e for e in errors if 'favicon' not in e]
        assert not bad, '\n'.join(bad[:10])
        print('\n'.join(['OK make-browser'] + ['  ' + r for r in results] + [f'  screenshots: {SHOTS}']))
    finally:
        proc.terminate()

if __name__ == '__main__':
    main()
