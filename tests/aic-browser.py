"""AI 창작 커뮤니티 browser check (2026-10-11, AI-COMMUNITY-CONTRACT.md): starts tools/platform/dev-server.mjs
(seed data + the sample boards, AI demo posts with images and recipes) and checks the community pages at 1440
and 390 px in Chromium: no page errors, no console errors, no horizontal scroll, the curved connectors of the
feed and of replies, images that load, touch targets on phones; then the flows: write with the consent and the
AI fields, a recipe handed over from the workbench (?from=make), the prompt copy button, ZIP 받기, the try
counter. Screenshots go to test-results/aic-*.png.   python tests/aic-browser.py   (AIC_PORT, default 4702)"""
import json, os, re, subprocess, sys, time, urllib.request, zipfile, io
from playwright.sync_api import sync_playwright

PORT = int(os.environ.get('AIC_PORT', '4702'))
B = f'http://localhost:{PORT}'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'test-results'); os.makedirs(OUT, exist_ok=True)
PAGES = [('home', '/'), ('board', '/ko/community/sticker/'), ('post', '/ko/community/sticker/1'), ('recipes', '/ko/community/recipes/'),
         ('trends', '/ko/community/trends/'), ('write', '/ko/community/pfp/write'), ('policy', '/ko/community/policy'), ('en-home', '/en/'),
         ('archived', '/ko/community/games/'), ('pixel-post', '/ko/community/pixel/1')]
checks = []

def ok(name, cond=True, detail=''):
    if not cond: raise AssertionError(f'{name} {detail}')
    checks.append(name); print('PASS', name, flush=True)

def wait_up(proc):
    for _ in range(240):
        try:
            urllib.request.urlopen(B + '/', timeout=2); return
        except Exception:
            if proc.poll() is not None: raise SystemExit('dev server exited: ' + proc.stdout.read())
            time.sleep(0.5)
    raise SystemExit('dev server did not start')

def launch(p):
    exe = os.environ.get('CHROMIUM') or ('/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else None)
    return p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()

def watch(pg, errors):
    pg.on('console', lambda m: errors.append(f'{pg.url}: {m.text}') if m.type == 'error' and 'status of 404' not in m.text else None)
    pg.on('pageerror', lambda e: errors.append(f'{pg.url}: {e}'))

def pages_at(b, width, height, errors):
    c = b.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, locale='ko-KR'); pg = c.new_page(); watch(pg, errors)
    tag = 'm' if width < 600 else 'd'
    for name, path in PAGES:
        pg.goto(B + path); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(250)
        sw = pg.evaluate('document.documentElement.scrollWidth')
        ok(f'{width}px {path}: no horizontal scroll', sw <= width, f'({sw})')
        broken = pg.evaluate('[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&!i.closest("[hidden]")).map(i=>i.src)')
        ok(f'{width}px {path}: every image loads', not broken, str(broken))
        pg.screenshot(path=os.path.join(OUT, f'aic-{name}-{tag}.png'), full_page=True)
    # The curved elbow connectors (contract §1): feed items and replies.
    pg.goto(B + '/'); pg.wait_for_timeout(200)
    feed = pg.evaluate("""()=>{const li=document.querySelector('.feed>li');const s=getComputedStyle(li,'::before');return {r:s.borderBottomLeftRadius,w:s.borderLeftWidth,b:s.borderBottomWidth,c:document.querySelectorAll('.feed>li').length}}""")
    ok(f'{width}px home: feed items joined by curved elbow connectors', feed['r'] == '14px' and feed['w'] in ('1px', '1.5px') and feed['b'] in ('1px', '1.5px') and feed['c'] >= 6, str(feed))
    pg.goto(B + '/ko/community/sticker/1'); pg.wait_for_timeout(200)
    rep = pg.evaluate("""()=>{const li=document.querySelector('.cl .kids>li');if(!li)return null;const s=getComputedStyle(li,'::before');return {r:s.borderBottomLeftRadius,w:s.borderLeftWidth}}""")
    ok(f'{width}px post: replies hang on a curved connector', rep and rep['r'] == '12px' and rep['w'] == '1px', str(rep))
    # Lines, not surfaces: chips are outlined (no fill).
    chip = pg.evaluate("""()=>{const s=getComputedStyle(document.querySelector('.ph1tags .mh'));return {bg:s.backgroundColor,bw:s.borderTopWidth,r:s.borderTopLeftRadius}}""")
    ok(f'{width}px post: 말머리 chip outlined, radius 4', chip['bg'] in ('rgba(0, 0, 0, 0)', 'transparent') and chip['bw'] == '1px' and chip['r'] == '4px', str(chip))
    if width < 600:
        bar = pg.locator('.mbar')
        ok('390px recipe post: the bottom bar with ↑ and 내 사진으로 해보기', bar.is_visible() and bar.locator('a.btn.p').bounding_box()['height'] >= 44)
        for sel in ['.mbar .mup', '.rch .btn', '.fa .up', '.frc .btn.sm', '.pchips a', '.specrow a']:
            pg.goto(B + ('/ko/community/sticker/1' if sel.startswith(('.mbar', '.rch')) else '/ko/community/sticker/' if sel.startswith('.specrow') else '/')); pg.wait_for_timeout(150)
            hs = pg.evaluate(f"[...document.querySelectorAll('{sel}')].filter(e=>e.offsetParent).map(e=>Math.round(e.getBoundingClientRect().height))")
            ok(f'390px {sel}: touch targets ≥ 44px', hs and min(hs) >= 44, str(hs))
    c.close()

def flows(b, errors):
    c = b.new_context(viewport={'width': 1440, 'height': 1000}, locale='ko-KR', accept_downloads=True)
    c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=B)
    pg = c.new_page(); watch(pg, errors)
    # ZIP 받기: the results in one file, built in the browser.
    pg.goto(B + '/ko/community/sticker/1'); pg.wait_for_timeout(300)
    with pg.expect_download() as d: pg.click('[data-island=zip]')
    z = zipfile.ZipFile(io.BytesIO(open(d.value.path(), 'rb').read()))
    names = z.namelist()
    ok('ZIP 받기: six PNG results', len(names) == 6 and all(n.endswith('.png') for n in names) and z.read(names[0])[:8] == b'\x89PNG\r\n\x1a\n', str(names))
    # Copy the prompt.
    pg.click('[data-copy]'); pg.wait_for_timeout(200)
    ok('prompt copy button', '첨부한 캐릭터로 표정 24개' in pg.evaluate('navigator.clipboard.readText()'))
    # The try counter (the workbench calls it once per run): counted once per network a day.
    t1 = pg.evaluate("fetch('/api/v2/recipes/demo-aic-1/try',{method:'POST'}).then(r=>r.json())")
    t2 = pg.evaluate("fetch('/api/v2/recipes/demo-aic-1/try',{method:'POST'}).then(r=>r.json())")
    ok('POST /recipes/{id}/try counts once', t1['counted'] is True and t2['counted'] is False and t2['tries'] == t1['tries'], f'{t1} {t2}')
    rec = pg.evaluate("fetch('/api/v2/recipes/demo-aic-1').then(r=>r.json())")
    ok('GET /recipes/{id} for the workbench', rec['recipe']['schema'] == 'nerulio.recipe/1' and rec['generator'] == 'gemini' and rec['channel'] == 'sticker')
    # Write with an image: the consent is required, then the post carries "AI 생성" and the ① card.
    pg.goto(B + '/__dev/login?as=aic-writer&next=/ko/community/pfp/write'); pg.wait_for_selector('[data-image-picker]:not([hidden])', timeout=8000)
    pg.fill('input[name=title]', 'E2E 지브리 프사 원형으로'); pg.fill('textarea[name=body]', '프사로 잘랐어요')
    pg.set_input_files('[data-image-input]', os.path.join(ROOT, 'tests', 'fixtures', 'anon', 'lossless.webp'))
    pg.wait_for_function('()=>document.querySelector("textarea[name=body]").value.includes("/u/")', timeout=15000)
    pg.locator('details.wai summary').click()
    pg.select_option('select[name=generator]', 'chatgpt'); pg.fill('textarea[name=prompt]', '이 사진을 지브리풍 수채화로'); pg.check('input[name=ai]')
    pg.click('button[type=submit]'); pg.wait_for_timeout(500)
    ok('write: images without the consent are stopped in the browser', '/write' in pg.url and pg.locator('#n2-toast').is_visible() and '전연령' in pg.locator('#n2-toast').inner_text())
    pg.check('[data-consent]'); pg.click('button[type=submit]'); pg.wait_for_url(re.compile(r'/ko/community/pfp/\d+$'), timeout=15000)
    ok('write: the post shows AI 생성 and ① 만들기 with the prompt', pg.locator('.ph1tags .mh.ai').is_visible() and '이 사진을 지브리풍 수채화로' in pg.locator('.rcard .rprompt').inner_text() and 'ChatGPT' in pg.locator('.rcard').inner_text())
    ok('write: images of an AI post show as a grid, not inline', pg.locator('.rgrid img').count() == 1 and pg.locator('.pbody img').count() == 0)
    # A recipe handed over by the workbench (sessionStorage, ?from=make) goes with the post.
    pg.goto(B + '/ko/community/sticker/write?from=make')
    draft = {'recipe': {'schema': 'nerulio.recipe/1', 'source': {'generator': 'gemini', 'prompt': '표정 6개', 'ai': True}, 'input': {'expect': 'sheet'},
                        'steps': [{'op': 'sheet.split', 'p': {}}, {'op': 'bg.remove', 'p': {}}, {'op': 'fit', 'p': {'preset': 'kakao.static'}}]}, 'title': 'E2E 카톡 이모티콘 6개'}
    pg.evaluate(f"sessionStorage.setItem('nerulio:recipe-draft',JSON.stringify({json.dumps(draft, ensure_ascii=False)}))"); pg.reload(); pg.wait_for_timeout(600)
    ok('write ?from=make: the recipe slot shows the workbench recipe', pg.locator('[data-recipe-draft]').is_visible() and '3단계' in pg.locator('[data-recipe-summary]').inner_text() and pg.locator('input[name=title]').input_value() == 'E2E 카톡 이모티콘 6개')
    pg.fill('textarea[name=body]', '레시피 첨부 테스트'); pg.click('button[type=submit]'); pg.wait_for_url(re.compile(r'/ko/community/sticker/\d+$'), timeout=15000)
    ok('the posted recipe: ② 다듬기 with three numbered steps and 내 이미지로 해보기', pg.locator('.rsteps li').count() == 3 and pg.locator('.rch a.btn.p').get_attribute('href').startswith('/ko/make/?recipe='))
    ok('the draft is cleared after posting', pg.evaluate("sessionStorage.getItem('nerulio:recipe-draft')") is None)
    pg.screenshot(path=os.path.join(OUT, 'aic-posted-recipe-d.png'), full_page=True)
    # Report → one sexual/deepfake report hides at once.
    url = pg.url.replace(B, '')
    o = b.new_context(extra_http_headers={'cf-connecting-ip': '198.51.100.77'}); op = o.new_page(); watch(op, errors)
    op.goto(B + url); op.wait_for_timeout(300)
    op.goto(B + op.locator('.pact a', has_text='신고').get_attribute('href')); op.wait_for_selector('form[data-island=flag-form]')
    op.select_option('select[name=reason]', 'deepfake'); op.click('form[data-island=flag-form] button[type=submit]'); op.wait_for_timeout(900)
    ok('one deepfake report hides the post at once', op.request.get(B + url).status == 404)
    o.close(); c.close()

def main():
    proc = subprocess.Popen(['node', 'tools/platform/dev-server.mjs', str(PORT)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8')
    try:
        wait_up(proc)
        errors = []
        with sync_playwright() as p:
            b = launch(p)
            pages_at(b, 1440, 1000, errors)
            pages_at(b, 390, 844, errors)
            flows(b, errors)
            b.close()
        ok('no page errors or console errors', not errors, json.dumps(errors, ensure_ascii=False))
        print(f'{len(checks)} checks passed; screenshots in test-results/aic-*.png')
    finally:
        proc.terminate()

if __name__ == '__main__':
    main()
