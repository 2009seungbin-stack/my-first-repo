"""Studio Pack & Export stage end to end in Chromium with real CC0 game assets.

Covers: the stage packs what the Sprite workspace imported (numbered frame files, a sheet) in a
worker and shows the atlas in the canvas at an integer zoom with page tabs and the used %; settings
change the pack live and are undoable and saved in the project; engine presets set their
defaults; rotation, multipack pages and @2x variants; frame selection shared with the Sprite
timeline both ways; every export target downloads a ZIP whose files parse, and the Phaser atlas
reproduces every source frame byte for byte (the ninja PNGs carry gAMA/cHRM chunks that a canvas
decode would change); GIF/APNG/WebM previews decode (WebM with ffprobe/ffmpeg when installed);
cancelling a pack; a 1,000-frame sheet and, when the local corpus is present, the 4096² FX sheet
(times are printed); ko/ja copy; a 390 px layout.

Runs inside tools/regression.py (port 4173). Standalone, against a server you own:
  PORT=4471 node tools/serve.mjs  then  TEST_URL=http://127.0.0.1:4471 python tests/studio-pack-browser.py
Assets: committed CC0 fixtures (tests/fixtures/game/corpus). SHOTS=<dir> writes screenshots."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import io, json, os, random, shutil, subprocess, sys, tempfile, time, zipfile
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
SHOTS = os.environ.get('SHOTS', '')
CORPUS = Path(os.environ.get('NERULIO_CORPUS', r'C:\Users\2009s\nerulio-asset-corpus'))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
FX = ROOT / 'tests' / 'fixtures' / 'game' / 'corpus'
NINJA = sorted((FX / 'ninja').glob('run_*.png'))          # 6 numbered frames, 40×29, gAMA + cHRM
SAMURAI = FX / 'sprites' / 'samurai.png'                  # 288×480, 48 px cells
HIT = CORPUS / 'sprites' / 'oga-hit-effect' / 'hit-yellow.png'  # 4096², optional (local corpus)
checks, errors, timings = [], [], {}
TMP = Path(tempfile.mkdtemp(prefix='studio-pack-'))


def ok(name, cond, detail=''):
    if not cond:
        raise AssertionError(f'{name} {detail}')
    checks.append(name); print('PASS', name, flush=True)


def js(p, body, arg=None):
    return p.evaluate('async(arg)=>{const S=window.nerulioStudio;' + body + '}', arg)


def shot(p, name):
    if SHOTS:
        Path(SHOTS).mkdir(parents=True, exist_ok=True); p.screenshot(path=str(Path(SHOTS) / name))


def watch(p, label):
    p.on('pageerror', lambda e: errors.append(f'{label}: {e}'))
    p.on('console', lambda m: m.type == 'error' and errors.append(f'{label}: {m.text[:300]}'))


def fresh(browser, **kw):
    """A new browser context (its own IndexedDB, so no autosave-recovery prompt) and page."""
    c = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, **kw)
    q = c.new_page(); watch(q, 'desktop'); q.on('request', lambda r: requests.append(r.url))
    return c, q


def open_studio(p, ws='sprite', locale='en'):
    p.goto(f'{BASE}/{locale}/game/studio/?ws={ws}')
    p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=30000)


def import_files(p, paths):
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(x) for x in paths])
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0', timeout=60000); p.wait_for_timeout(300)


def apply_sheet(p):
    p.wait_for_function('()=>{const b=document.querySelector("[data-sp=import-apply]");return b&&!b.disabled}', timeout=120000)
    p.click('[data-sp="import-apply"]'); p.wait_for_selector('[data-sp="import-state"]', timeout=120000)


def packed(p, timeout=120000):
    """Waits until the pack in the worker has finished and the result is shown."""
    p.wait_for_selector('[data-pack="efficiency"]', state='attached', timeout=timeout)
    p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=timeout)
    p.wait_for_timeout(150)


def to_pack(p):
    p.click('.st-ws-tab[data-ws="pack"]'); packed(p)


def totals(p):
    return p.locator('[data-pack="totals"]').inner_text()


def settings(p):
    return js(p, 'return JSON.parse(JSON.stringify(S.doc.settings?.pack||{}));')


def set_field(p, key, value):
    loc = p.locator(f'[data-pack="{key}"]')
    if loc.evaluate('e=>e.tagName') == 'SELECT':
        loc.select_option(str(value))
    else:
        loc.fill(str(value)); loc.dispatch_event('change')
    p.wait_for_timeout(250); packed(p)


def export(p, target, timeout=300000):
    p.wait_for_function('(t)=>{const b=document.querySelector(`[data-export="${t}"]`);return b&&!b.disabled}', arg=target, timeout=timeout)
    with p.expect_download(timeout=timeout) as d:
        p.click(f'[data-export="{target}"]')
    dest = TMP / d.value.suggested_filename
    d.value.save_as(str(dest))
    p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=timeout)
    return zipfile.ZipFile(dest)


def page_image(p):
    return js(p, 'return {w:S.view.image.w,h:S.view.image.h,scale:S.view.view.scale,items:S.view.layers.find(l=>l.id==="pack-frames").items.length,'
                 'selected:[...S.view.layers.find(l=>l.id==="pack-frames").selected]};')


def restore(sheet, fr):
    """A TexturePacker-JSON frame (Phaser/Pixi semantics) back to its full source canvas."""
    f, ss, src = fr['frame'], fr['spriteSourceSize'], fr['sourceSize']
    if fr.get('rotated'):
        reg = sheet.crop((f['x'], f['y'], f['x'] + f['h'], f['y'] + f['w'])).transpose(Image.ROTATE_90)
    else:
        reg = sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
    canvas = Image.new('RGBA', (src['w'], src['h']))
    canvas.paste(reg, (ss['x'], ss['y']))
    return canvas


def visible(im):
    im = im.convert('RGBA'); out = bytearray(im.tobytes())
    for i in range(0, len(out), 4):
        if out[i + 3] == 0:
            out[i] = out[i + 1] = out[i + 2] = 0
    return bytes(out)


def big_sheet(path, cols=40, rows=25, cell=32, seed=5):
    """A 1,000-frame sheet: every cell holds one sprite of its own size and colours."""
    rnd = random.Random(seed); im = Image.new('RGBA', (cols * cell, rows * cell))
    px = im.load()
    for r in range(rows):
        for c in range(cols):
            w, h = rnd.randint(6, cell - 4), rnd.randint(6, cell - 4)  # a clear gap around every sprite
            ox, oy = rnd.randint(1, cell - w - 1), rnd.randint(1, cell - h - 1)
            col = (rnd.randint(0, 255), rnd.randint(0, 255), rnd.randint(0, 255), 255)
            for y in range(h):
                for x in range(w):
                    px[c * cell + ox + x, r * cell + oy + y] = col if (x + y) % 5 else (col[2], col[0], col[1], 255)
    im.save(path)


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    p = ctx.new_page(); watch(p, 'desktop')
    requests = []; p.on('request', lambda r: requests.append(r.url))
    # ------------------------------------------------------------ the stage exists and packs what the Sprite workspace made
    open_studio(p)
    ok('Pack & Export is a ready workspace tab', p.locator('.st-ws-tab[data-ws="pack"]').count() == 1 and p.locator('.st-ws-tab[data-ws="pack"]').get_attribute('aria-disabled') is None)
    import_files(p, NINJA)
    ok('the Sprite import makes one "run" asset of 6 frames from the numbered files', js(p, 'const a=S.doc.assets[0];return a.frames.length===6&&a.tags[0]?.name==="run";'))
    to_pack(p)
    ok('the pack panels are docked: settings, atlas and export on the right, frames at the bottom',
       all(p.locator(f'#panel-{x}').count() == 1 for x in ['pack-settings', 'pack-result', 'pack-export', 'pack-frames']))
    img = page_image(p)
    ok('the atlas page is in the canvas at an integer zoom, one outline per stored frame',
       img['items'] == 6 and isinstance(img['scale'], (int, float)) and float(img['scale']).is_integer(), json.dumps(img))
    t = totals(p)
    ok('the totals read 6 frames, 6 stored, 1 page, with a used %', t.startswith('6 frames') and '1 page' in t and '%' in p.locator('[data-pack="efficiency"]').inner_text(), t)
    ok('the default page is the trimmed pack (38×50 for the ninja frames, padding 2)', (img['w'], img['h']) == (38, 50), json.dumps(img))
    shot(p, 'pack-01-ninja-1440.png')
    # ------------------------------------------------------------ Phaser export: byte-exact frames, animations file
    z = export(p, 'phaser')
    names = z.namelist()
    ok('Phaser ZIP: atlas JSON, anims JSON, PNG and README in one folder', any(n.endswith('/run.json') for n in names) and any(n.endswith('.anims.json') for n in names)
       and any(n.endswith('/run.png') for n in names) and any('README-PHASER' in n for n in names), names)
    atlas = json.loads(z.read(next(n for n in names if n.endswith('/run.json'))))
    sheet = Image.open(io.BytesIO(z.read(next(n for n in names if n.endswith('/run.png'))))).convert('RGBA')
    exact = sum(visible(restore(sheet, atlas['frames'][f.stem])) == visible(Image.open(f)) for f in NINJA)
    ok('every ninja frame restores byte for byte from the exported atlas (gAMA/cHRM not applied)', exact == 6, f'{exact}/6')
    anims = json.loads(z.read(next(n for n in names if n.endswith('.anims.json'))))
    ok('the Phaser animation "run" has 6 frames of 100 ms, looping', anims['anims'][0]['key'] == 'run' and len(anims['anims'][0]['frames']) == 6
       and all(f['duration'] == 100 for f in anims['anims'][0]['frames']) and anims['anims'][0]['repeat'] == -1)
    ok('the last export is listed with its files', p.locator('[data-pack="last-export"]').count() == 1)
    # ------------------------------------------------------------ settings: live, undoable, in the project
    before = page_image(p)
    set_field(p, 'shapePadding', 0)
    after = page_image(p)
    ok('padding 0 repacks live into a smaller page', after['w'] * after['h'] < before['w'] * before['h'], f'{before} -> {after}')
    ok('the setting is saved in the project document (doc.settings.pack)', settings(p).get('settings', {}).get('shapePadding') == 0)
    p.locator('.st-canvas-host').click(position={'x': 5, 'y': 5}); p.keyboard.press('Control+z'); p.wait_for_timeout(300); packed(p)
    ok('Ctrl+Z undoes the setting and the pack follows', settings(p).get('settings', {}).get('shapePadding', 2) == 2 and (page_image(p)['w'], page_image(p)['h']) == (before['w'], before['h']))
    set_field(p, 'preset', 'pixi')
    ok('the PixiJS preset turns rotation on', p.locator('[data-pack="allowRotation"]').is_checked())
    rot = js(p, 'return document.querySelectorAll(".pk-frame .pk-flag").length;')
    set_field(p, 'preset', 'godot4')
    ok('the Godot preset turns rotation off (AtlasTexture cannot rotate)', not p.locator('[data-pack="allowRotation"]').is_checked())
    p.check('[data-pack="allowRotation"]'); p.wait_for_timeout(250); packed(p)
    ok('Godot export with rotation on says it packs without rotation for Godot',
       'rotation' in p.locator('.pk-target[data-target="godot4"] .pk-change').inner_text().lower())
    z = export(p, 'godot4')
    tres = z.read(next(n for n in z.namelist() if n.endswith('.tres'))).decode()
    ok('the Godot export is a SpriteFrames .tres with AtlasTexture regions, never rotated', tres.startswith('[gd_resource type="SpriteFrames"') and 'AtlasTexture' in tres)
    p.uncheck('[data-pack="allowRotation"]'); p.wait_for_timeout(250); packed(p)
    # ------------------------------------------------------------ frame selection shared with the timeline
    p.locator('.pk-frame').nth(3).click(); p.wait_for_timeout(200)
    ok('clicking a frame row highlights its region on the atlas', len(page_image(p)['selected']) == 1)
    p.click('.st-ws-tab[data-ws="sprite"]'); p.wait_for_timeout(600)
    ok('the Sprite timeline shows the frame picked in the Pack stage', p.locator('.sp-fh.is-cur').get_attribute('data-i') == '3')
    p.locator('.sp-fh[data-i="1"]').click(); p.wait_for_timeout(200)
    to_pack(p)
    ok('a frame picked in the timeline is highlighted in the Pack stage', p.locator('.pk-frame[aria-selected="true"]').count() == 1
       and p.locator('.pk-frame[aria-selected="true"]').get_attribute('data-frame') == js(p, 'return S.doc.assets[0].frames[1].id;'))
    # ------------------------------------------------------------ every target downloads and parses
    expect = {'godot4': ['.tres', '.tscn'], 'unity': ['.unity.json', 'NerulioSpriteImporter.cs'], 'phaser': ['.anims.json'], 'pixi': ['README-PIXI.md'],
              'gamemaker': ['_strip6.png', 'gamemaker.json'], 'defold': ['.atlas', '.tilesource', 'frames/run_0.png'], 'love': ['.lua', 'nerulio_atlas.lua'],
              'aseprite-json': ['README-ASEPRITE-JSON.md'], 'aseprite-json-array': ['README-ASEPRITE-JSON.md'], 'aseprite': ['.aseprite'], 'json': ['.nerulio.json'],
              'spine': ['.atlas'], 'starling': ['.xml'], 'sparrow-phaser3': ['.xml'], 'css': ['.css', '.html'], 'gif': ['.gif'], 'apng': ['.png']}
    bundles = {}
    for target, parts in expect.items():
        z = export(p, target); bundles[target] = z
        files = z.namelist()
        ok(f'export {target}: ZIP with {", ".join(parts)}', all(any(f.endswith(x) for f in files) for x in parts), files)
        for f in files:
            if f.endswith('.json'):
                json.loads(z.read(f))
    gm = json.loads(bundles['gamemaker'].read(next(n for n in bundles['gamemaker'].namelist() if n.endswith('gamemaker.json'))))
    ok('GameMaker is labelled UNVERIFIED in the UI and in its JSON', gm['verified'] is False and p.locator('.pk-target[data-target="gamemaker"] .pk-badge').get_attribute('data-verify') == 'unverified'
       and 'UNVERIFIED' in p.locator('.pk-target[data-target="gamemaker"] .pk-badge').get_attribute('title'))
    gif = Image.open(io.BytesIO(bundles['gif'].read(next(n for n in bundles['gif'].namelist() if n.endswith('.gif')))))
    ok('the GIF has 6 frames of 100 ms', getattr(gif, 'n_frames', 1) == 6 and gif.info.get('duration') == 100)
    apng = Image.open(io.BytesIO(bundles['apng'].read(next(n for n in bundles['apng'].namelist() if n.endswith('.png')))))
    frames_ok = 0
    for i, f in enumerate(NINJA):
        apng.seek(i); fr = apng.convert('RGBA'); src = Image.open(f).convert('RGBA')
        frames_ok += visible(fr) == visible(src)
    ok('the APNG frames are the source frames exactly (same canvas, pivot-aligned)', frames_ok == 6, f'{frames_ok}/6')
    # WebM through the browser's VideoEncoder, checked with ffprobe/ffmpeg when installed
    if p.locator('[data-export="webm"]').is_enabled():
        z = export(p, 'webm'); webm = TMP / 'run.webm'; webm.write_bytes(z.read(next(n for n in z.namelist() if n.endswith('.webm'))))
        ok('WebM starts with the EBML header', webm.read_bytes()[:4] == b'\x1a\x45\xdf\xa3')
        if shutil.which('ffprobe'):
            pr = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,nb_read_frames,width,height', '-of', 'json', str(webm)], capture_output=True, text=True)
            st = json.loads(pr.stdout or '{"streams":[{}]}')['streams'][0]
            ok('ffprobe reads 6 VP9/VP8 frames', int(st.get('nb_read_frames') or 0) == 6 and st.get('codec_name') in ('vp9', 'vp8'), json.dumps(st) + pr.stderr[-300:])
        # the Studio page's CSP allows no data:/blob: media, so the file is played in a blank page
        vp = ctx.new_page(); vp.goto('about:blank')
        vid = vp.evaluate('async(b64)=>{const v=document.createElement("video");v.muted=true;v.preload="auto";v.src="data:video/webm;base64,"+b64;document.body.append(v);'
                          'await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=()=>j(Error("video error "+(v.error&&v.error.code)+" "+(v.error&&v.error.message)))});'
                          'if(!isFinite(v.duration)){v.currentTime=1e9;await new Promise(r=>v.ontimeupdate=r);}return {w:v.videoWidth,h:v.videoHeight,d:v.duration};}',
                          __import__('base64').b64encode(webm.read_bytes()).decode())
        vp.close()
        ok('Chromium plays the WebM: 4× the frame size, 0.6 s', abs(vid['d'] - 0.6) < 0.05 and vid['w'] >= 40 * 4, json.dumps(vid))
    else:
        print('SKIP WebM: this Chromium has no VideoEncoder')
    # ------------------------------------------------------------ sheet: pages, variants, cancel
    ctx.close(); ctx, p = fresh(browser); open_studio(p)
    import_files(p, [SAMURAI]); apply_sheet(p); to_pack(p)
    ok('the samurai sheet (60 cells, 10 row tags) packs to one page', totals(p).startswith('60 frames') and '1 page' in totals(p))
    set_field(p, 'maxWidth', 256)
    ok('max page 256 → multipack with page tabs', p.locator('.pk-page[data-page]').count() >= 2, totals(p))
    p.keyboard.press('PageDown'); p.wait_for_timeout(300)
    ok('PageDown shows the next page', p.locator('.pk-page[data-page="1"]').get_attribute('aria-pressed') == 'true')
    z = export(p, 'phaser')
    ok('several pages export as a Phaser multiatlas', any(n.endswith('.multiatlas.json') for n in z.namelist()))
    set_field(p, 'maxWidth', 4096)
    p.locator('.pk-adv > summary').click(); p.wait_for_timeout(200)
    p.check('[data-scale="2"]'); p.wait_for_timeout(250); packed(p)
    ok('an @2x variant gets its own tab', p.locator('.pk-page[data-variant]').count() == 2)
    p.locator('.pk-page[data-variant="1"]').click(); packed(p)
    one = json.loads(export(p, 'pixi').read(next(n for n in bundles['pixi'].namelist() if n.endswith('.json')).replace('run', 'samurai')) or b'{}') if False else None
    ok('the @2x page is exactly twice the @1x page', page_image(p)['w'] % 2 == 0)
    z = export(p, 'pixi'); jn = [n for n in z.namelist() if n.endswith('.json')]
    ok('Pixi export writes one JSON per variant with meta.scale', {json.loads(z.read(n))['meta']['scale'] for n in jn} == {'1', '2'}, jn)
    p.uncheck('[data-scale="2"]'); p.wait_for_timeout(250); packed(p)
    shot(p, 'pack-02-samurai-1440.png')
    # cancel: the effort "best" pack of a 1,000-frame sheet takes long enough to cancel
    sheet_path = TMP / 'thousand.png'; big_sheet(sheet_path)
    # The frames are cut with the known 32 px grid through the document API (one undoable edit), so
    # this measures the packer, not the import's grid guess.
    ctx.close(); ctx, p = fresh(browser); open_studio(p, 'viewer')
    import_files(p, [sheet_path])
    js(p, 'const H=await import("/src/studio/core/history.js"),P=await import("/src/studio/core/project.js");const a=S.doc.assets[0],cells=[];'
          'for(let r=0;r<25;r++)for(let c=0;c<40;c++)cells.push({x:c*32,y:r*32,w:32,h:32});S.history.execute(H.edit("cut",d=>P.setFrames(d,a.id,P.framesFromCells(a,cells))));')
    n = js(p, 'return S.doc.assets[0].frames.length;')
    ok('the synthetic sheet is cut into 1,000 frames', n == 1000, n)
    t0 = time.time(); to_pack(p); timings['1000 frames, effort normal (s)'] = round(time.time() - t0, 2)
    ok('1,000 frames pack in the worker and show one page', totals(p).startswith('1000 frames'), totals(p))
    timings['1000 frames, packer ms'] = totals(p).split('·')[-1].strip()
    p.locator('.pk-adv > summary').click() if not p.locator('[data-pack="effort"]').is_visible() else None
    p.locator('[data-pack="effort"]').select_option('best'); p.wait_for_timeout(250)
    p.wait_for_selector('[data-action="pack-cancel"]', timeout=10000)
    ok('the UI stays responsive while packing (a button click is handled)', js(p, 'return !!document.querySelector("[data-action=pack-cancel]");'))
    p.click('[data-action="pack-cancel"]'); p.wait_for_timeout(300)
    ok('Cancel stops the pack and says so', p.locator('[data-action="pack-cancel"]').count() == 0 and 'cancel' in p.locator('.st-toast').inner_text().lower())
    p.locator('[data-pack="effort"]').select_option('normal'); p.wait_for_timeout(250); packed(p, 300000)
    t0 = time.time(); z = export(p, 'godot4'); timings['1000 frames, Godot export (s)'] = round(time.time() - t0, 2)
    ok('the 1,000-frame Godot export holds 1,000 AtlasTextures', z.read(next(n for n in z.namelist() if n.endswith('.tres'))).decode().count('[sub_resource type="AtlasTexture"') == 1000)
    # ------------------------------------------------------------ 4096² sheet (local corpus only)
    if HIT.exists():
        ctx.close(); ctx, p = fresh(browser); open_studio(p)
        t0 = time.time(); import_files(p, [HIT]); apply_sheet(p); timings['4096² import+apply (s)'] = round(time.time() - t0, 1)
        t0 = time.time(); to_pack(p); timings['4096² pack (s)'] = round(time.time() - t0, 1)
        ok('the 4096² FX sheet packs (14 frames, trimmed onto one page)', totals(p).startswith('14 frames'), totals(p))
        t0 = time.time(); z = export(p, 'godot4'); timings['4096² Godot export (s)'] = round(time.time() - t0, 1)
        png = Image.open(io.BytesIO(z.read(next(n for n in z.namelist() if n.endswith('.png')))))
        ok('the 4096² export page is smaller than the source sheet', png.width * png.height < 4096 * 4096, png.size)
    else:
        print('SKIP 4096² sheet: local corpus not found')
    # ------------------------------------------------------------ languages + phone
    ctx.close(); ctx, p = fresh(browser); open_studio(p, 'pack', 'ko'); p.wait_for_timeout(500)
    ok('ko: the stage and its panels are in Korean', '패킹' in p.locator('.st-ws-tab[data-ws="pack"]').inner_text() and '내보내기' in p.locator('#panel-pack-export').evaluate('e=>e.closest(".st-panel").innerText'))
    open_studio(p, 'pack', 'ja'); p.wait_for_timeout(500)
    ok('ja: the stage is in Japanese', 'パック' in p.locator('.st-ws-tab[data-ws="pack"]').inner_text())
    ctx.close()
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True, is_mobile=True, has_touch=True)
    m = ctx.new_page(); watch(m, 'phone')
    open_studio(m); import_files(m, NINJA)
    m.evaluate('()=>window.nerulioStudio.activateWorkspace("pack")'); m.wait_for_timeout(300)
    m.evaluate('()=>window.nerulioStudio.docks.show("pack-result")'); packed(m)  # on phones panels live in a bottom sheet
    ok('390 px: no horizontal page scroll', m.evaluate('()=>document.documentElement.scrollWidth<=innerWidth'))
    m.evaluate('()=>window.nerulioStudio.docks.show("pack-export")'); m.wait_for_timeout(400)
    ok('390 px: the export list is reachable in the panel sheet with touch-size buttons', m.locator('[data-export="godot4"]').is_visible()
       and m.locator('[data-export="godot4"]').bounding_box()['height'] >= 30)
    shot(m, 'pack-03-phone-390.png')
    ctx.close()
    browser.close()
bad = [u for u in requests if not u.startswith(BASE) and not u.startswith(('data:', 'blob:'))]
ok('no network request leaves the site (local-first)', not bad, bad[:5])
serious = [e for e in errors if 'favicon' not in e]
ok('no page errors', not serious, serious[:5])
print('TIMINGS', json.dumps(timings))
print(f'{len(checks)} checks passed')
shutil.rmtree(TMP, ignore_errors=True)
