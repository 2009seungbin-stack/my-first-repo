"""Localized Nerulio Studio/Lab screenshots for the guides -> assets/guides/<name>-<locale>.webp.

Real UI, real CC0 art (tests/fixtures, plus the coolschool A4 ceiling block from the corpus), driven
like the browser suites. Start a server you own first, then:
  TEST_URL=http://127.0.0.1:<port> python tools/guides-shots.py [name ...] [--locales=ko,en,ja]
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageFilter
import io, os, sys
W = Path(__file__).resolve().parents[1]
OUT = W / 'assets' / 'guides'; OUT.mkdir(parents=True, exist_ok=True)
RAW = W / 'test-results' / 'guide-shots'; RAW.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173')
FX = W / 'tests' / 'fixtures'
SAMURAI = FX / 'game' / 'corpus' / 'sprites' / 'samurai.png'        # CC0 sebshady
CAVE = FX / 'tile' / 'cave-autotile47.png'                          # CC0 "second"
A2 = RAW / 'coolschool-ceiling-A2.png'  # CC0 NettySvit (OpenGameArt "Cool School"): the A2-format ceiling block of coolschool_A4.png
CORPUS = Path(os.environ.get('NERULIO_CORPUS', r'C:\Users\2009s\nerulio-asset-corpus'))
if (CORPUS / 'tiles' / 'oga-coolschool' / 'coolschool_A4.png').exists():
    Image.open(CORPUS / 'tiles' / 'oga-coolschool' / 'coolschool_A4.png').crop((0, 0, 96, 144)).save(A2)
KENNEY = FX / 'kenney' / 'pixel-platformer-characters.png'          # CC0 Kenney
DUNGEON = FX / 'kenney' / 'tiny-dungeon-tilemap.png'                # CC0 Kenney
FONT = FX / 'game' / 'corpus' / 'fonts' / 'bellanger-font.png'      # CC0 Clint Bellanger
args = [a for a in sys.argv[1:] if not a.startswith('--')]
LOCALES = next((a.split('=')[1].split(',') for a in sys.argv[1:] if a.startswith('--locales=')), ['ko', 'en', 'ja'])
VIEW = {'width': 1280, 'height': 800}
errors = []


def save(p, name, locale, clip=None):
    try: p.wait_for_function('()=>![...document.querySelectorAll(".st-toast,.toast")].some(t=>!t.hidden&&getComputedStyle(t).display!=="none")', timeout=9000)
    except Exception: print('toast still visible', name, locale)
    p.wait_for_timeout(200)
    png = RAW / f'{name}-{locale}.png'
    p.screenshot(path=str(png), clip=clip)
    im = Image.open(png).convert('RGB')
    dest = OUT / f'{name}-{locale}.webp'
    im.save(dest, 'WEBP', quality=80, method=6)
    print('wrote', dest.name, dest.stat().st_size, flush=True)


def js(p, body, arg=None): return p.evaluate('async(arg)=>{const S=window.nerulioStudio;' + body + '}', arg)


def studio(ctx, ws, locale):
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(f'{BASE}/{locale}/game/studio/?ws={ws}')
    p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=30000)
    p.wait_for_timeout(500)
    return p


def import_files(p, paths, n=1):
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(x) for x in paths])
    p.wait_for_function('(n)=>window.nerulioStudio.doc.assets.length>=n', arg=n, timeout=60000); p.wait_for_timeout(400)


def canvas_at(p, ix, iy):
    return js(p, 'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+arg[0]*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+arg[1]*v.view.scale)*r.height/v.H};', [ix, iy])


def samurai_applied(p):
    import_files(p, [SAMURAI])
    p.wait_for_function('()=>{const b=document.querySelector("[data-sp=import-apply]");return b&&!b.disabled}', timeout=120000)
    p.click('[data-sp="import-apply"]')
    p.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===60', timeout=60000); p.wait_for_timeout(500)


def shot_sprite_import(ctx, locale):
    p = studio(ctx, 'sprite', locale)
    import_files(p, [SAMURAI])
    p.wait_for_selector('[data-sp="plan-count"]', timeout=60000); p.wait_for_timeout(800)
    save(p, 'studio-sprite-import', locale)


def shot_sprite_timeline(ctx, locale):
    p = studio(ctx, 'sprite', locale)
    samurai_applied(p)
    p.locator('.sp-fh[data-i="8"]').click(); p.wait_for_timeout(200)
    p.keyboard.press('F7'); p.wait_for_timeout(400)          # floating preview
    save(p, 'studio-sprite-timeline', locale)


def shot_sprite_boxes(ctx, locale):
    p = studio(ctx, 'sprite', locale)
    samurai_applied(p)
    p.locator('.sp-fh[data-i="13"]').click(); p.wait_for_timeout(200)
    p.keyboard.press('p'); pt = canvas_at(p, 24, 44); p.mouse.click(pt['x'], pt['y']); p.wait_for_timeout(100)
    p.keyboard.press('b')
    p.select_option('[data-sp="box-type"]', 'hurt')
    a, b = canvas_at(p, 14, 12), canvas_at(p, 32, 45)
    p.mouse.move(a['x'], a['y']); p.mouse.down(); p.mouse.move(b['x'], b['y'], steps=6); p.mouse.up(); p.wait_for_timeout(150)
    p.select_option('[data-sp="box-type"]', 'hit')
    a, b = canvas_at(p, 30, 18), canvas_at(p, 47, 30)
    p.mouse.move(a['x'], a['y']); p.mouse.down(); p.mouse.move(b['x'], b['y'], steps=6); p.mouse.up(); p.wait_for_timeout(150)
    p.fill('[data-sp="max-vertices"]', '10'); p.press('[data-sp="max-vertices"]', 'Enter')
    p.click('[data-sp="auto-collision"]'); p.wait_for_timeout(700)
    p.keyboard.press('v'); p.wait_for_timeout(200)
    save(p, 'studio-sprite-boxes', locale)


def packed(p, timeout=120000):
    p.wait_for_selector('[data-pack="efficiency"]', state='attached', timeout=timeout)
    p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=timeout); p.wait_for_timeout(400)


def shot_pack(ctx, locale):
    p = studio(ctx, 'sprite', locale)
    samurai_applied(p)
    p.click('.st-ws-tab[data-ws="pack"]'); packed(p)
    for key, value in [('extrude', '1'), ('shapePadding', '2')]:
        loc = p.locator(f'[data-pack="{key}"]')
        if loc.count() and loc.is_visible():
            loc.fill(value); loc.dispatch_event('change'); p.wait_for_timeout(300); packed(p)
    p.mouse.move(500, 300); p.keyboard.press('2'); p.wait_for_timeout(400)
    save(p, 'studio-pack-atlas', locale)
    tgt = p.locator('.pk-target[data-target="godot4"]')
    if tgt.count():
        tgt.scroll_into_view_if_needed(); tgt.click(); p.wait_for_timeout(400)
    ex = p.locator('#panel-pack-export')
    ex.scroll_into_view_if_needed(); p.wait_for_timeout(300)
    save(p, 'studio-pack-export', locale)


def tile_ready(p, n):
    p.wait_for_function('(n)=>{const S=window.nerulioStudio,s=S.doc.settings.tile||{};const t=Object.values(s.tilesets||{}).find(x=>x.assetId===S.activeAssetId);return t&&Object.keys(t.tiles).length===n}', arg=n, timeout=30000)


def shot_tile(ctx, locale):
    p = studio(ctx, 'tile', locale)
    p.set_input_files('input[type=file][multiple]', [str(CAVE)])
    p.wait_for_selector('[data-grid-sug="0"]', timeout=30000)
    p.click('[data-action="tile-apply-grid"]'); tile_ready(p, 0)
    p.wait_for_selector('[data-cand]', timeout=30000)
    p.locator('[data-cand]').first.click(); p.wait_for_selector('[data-tile="preview"]')
    p.click('[data-action="tile-apply-preview"]'); tile_ready(p, 47)
    p.wait_for_selector('[data-verdict]', timeout=20000); p.wait_for_timeout(600)
    save(p, 'studio-tile-layout', locale)
    p.click('[data-action="tile-new-map"]')
    p.wait_for_function('()=>document.querySelector(".studio").dataset.tileMode==="map"', timeout=10000); p.wait_for_timeout(900)
    save(p, 'studio-tile-map', locale)


def shot_tile_generator(ctx, locale):
    p = studio(ctx, 'tile', locale)
    p.set_input_files('input[type=file][multiple]', [str(A2)]); p.wait_for_selector('[data-grid-sug]', timeout=30000)
    for k, v in {'w': 48, 'h': 48, 'ox': 0, 'oy': 0, 'sx': 0, 'sy': 0}.items():
        p.fill(f'[data-tile-grid="{k}"]', str(v)); p.locator(f'[data-tile-grid="{k}"]').dispatch_event('change')
    p.click('[data-action="tile-apply-grid"]'); tile_ready(p, 0)
    p.wait_for_selector('[data-cand="rpgmaker-a2"]', timeout=30000)
    p.click('[data-cand="rpgmaker-a2"]'); p.wait_for_timeout(600)
    el = p.locator('[data-tile-panel="tile-gen"]'); el.scroll_into_view_if_needed()
    p.click('[data-action="tile-generate"]'); p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>=2', timeout=30000)
    tile_ready(p, 47); p.wait_for_timeout(900)
    el = p.locator('[data-tile-panel="tile-gen"]'); el.scroll_into_view_if_needed(); p.wait_for_timeout(300)
    save(p, 'studio-tile-generator', locale)


def fake_pixel_art():
    src = Image.open(KENNEY).convert('RGBA').crop((0, 0, 96, 24))
    big = src.resize((int(96 * 7.3), int(24 * 7.3)), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.8))
    bg = Image.new('RGBA', big.size, (0, 0, 0, 0)); bg.alpha_composite(big)
    b = io.BytesIO(); bg.save(b, 'PNG'); return b.getvalue()


def lab(ctx, path, locale):
    p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(f'{BASE}/{locale}/{path}/', wait_until='networkidle'); return p


def png_bytes(path): return Path(path).read_bytes()


def shot_pixel_cleanup(ctx, locale):
    p = lab(ctx, 'game/pixel-perfect-checker', locale)
    p.locator('#fileInput').set_input_files(files=[{'name': 'fake-pixel-art.png', 'mimeType': 'image/png', 'buffer': fake_pixel_art()}])
    p.locator('#plabCanvas').wait_for(timeout=60000); p.wait_for_timeout(1200)
    save(p, 'lab-pixel-cleanup', locale)


def shot_pixel_palette(ctx, locale):
    p = lab(ctx, 'game/palette-swap-ramp', locale)
    src = Image.open(KENNEY).convert('RGBA').crop((0, 0, 96, 24)); b = io.BytesIO(); src.save(b, 'PNG')
    p.locator('#fileInput').set_input_files(files=[{'name': 'kenney-characters.png', 'mimeType': 'image/png', 'buffer': b.getvalue()}])
    p.locator('#plabCanvas').wait_for(timeout=60000); p.wait_for_timeout(800)
    p.locator('[data-action="plab-recolor"][data-value="hue"]').click(); p.wait_for_timeout(600)
    hue = p.locator('#plabRecolorBody input[type=number]').first
    hue.fill('140'); hue.dispatch_event('change'); p.wait_for_timeout(1200)
    save(p, 'lab-pixel-palette', locale)


def shot_texture_normal(ctx, locale):
    p = lab(ctx, 'game/texture-lab', locale)
    sheet = Image.open(DUNGEON).convert('RGBA'); src = Image.new('RGBA', (64, 64))
    for r in range(4):
        for c in range(4): src.paste(sheet.crop((c * 17, r * 17, c * 17 + 16, r * 17 + 16)), (c * 16, r * 16))
    src = src.resize((128, 128), Image.NEAREST); b = io.BytesIO(); src.save(b, 'PNG')
    p.locator('#fileInput').set_input_files(files=[{'name': 'dungeon-wall.png', 'mimeType': 'image/png', 'buffer': b.getvalue()}])
    p.wait_for_timeout(1500)
    p.locator('[data-action="tex-stage"][data-stage="normal"]').first.click()
    p.locator('#texNormalOut').wait_for(timeout=60000); p.wait_for_timeout(1200)
    save(p, 'lab-texture-normal', locale)


def shot_tile_padding(ctx, locale):
    p = lab(ctx, 'atlas-padding', locale)
    p.locator('#fileInput').set_input_files(files=[str(DUNGEON)]); p.wait_for_timeout(2500)
    p.set_viewport_size({'width': 1280, 'height': 2000}); p.wait_for_timeout(800)
    top = p.locator('.lab-stages, .tl-stages').first.bounding_box()['y'] - 12
    ex = p.locator('input[data-opt="extrude"], input[name="extrude"], #tl-extrude, [data-key="extrude"]').first
    bottom = (ex.bounding_box()['y'] + 90) if ex.count() else top + 1040
    print('extrude field found' if ex.count() else 'extrude field NOT found')
    save(p, 'lab-tile-padding', locale, clip={'x': 0, 'y': top, 'width': 1280, 'height': bottom - top})


def ui_panel():
    s, bd = 48, 12
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    for y in range(s):
        for x in range(s):
            d = min(x, y, s - 1 - x, s - 1 - y)
            if d == 0: c = (20, 24, 38, 255)
            elif d < 3: c = (236, 196, 92, 255)
            elif d < 5: c = (160, 110, 40, 255)
            else: c = (58, 70, 110, 255)
            im.putpixel((x, y), c)
    for (x, y) in [(0, 0), (s - 1, 0), (0, s - 1), (s - 1, s - 1)]: im.putpixel((x, y), (0, 0, 0, 0))
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()


def shot_ui_nine(ctx, locale):
    p = lab(ctx, 'game/9-slice-editor', locale)
    p.locator('#fileInput').set_input_files(files=[{'name': 'panel.png', 'mimeType': 'image/png', 'buffer': ui_panel()}]); p.wait_for_timeout(1500)
    p.locator('[data-action="ui-accept"]').first.click(); p.wait_for_timeout(800)
    p.mouse.wheel(0, 260); p.wait_for_timeout(600)
    save(p, 'lab-ui-nine-slice', locale)


def shot_ui_font(ctx, locale):
    p = lab(ctx, 'bitmap-font-maker', locale)
    p.locator('#fileInput').set_input_files(files=[str(FONT)])
    p.locator('#rc-chars').wait_for(timeout=60000); p.wait_for_timeout(1500)
    save(p, 'lab-ui-font', locale)


SHOTS = {'studio-sprite-import': shot_sprite_import, 'studio-sprite-timeline': shot_sprite_timeline, 'studio-sprite-boxes': shot_sprite_boxes,
         'studio-pack': shot_pack, 'studio-tile': shot_tile, 'studio-tile-generator': shot_tile_generator,
         'lab-pixel-cleanup': shot_pixel_cleanup, 'lab-pixel-palette': shot_pixel_palette, 'lab-texture-normal': shot_texture_normal,
         'lab-tile-padding': shot_tile_padding, 'lab-ui-nine-slice': shot_ui_nine, 'lab-ui-font': shot_ui_font}
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for name, fn in SHOTS.items():
        if args and name not in args: continue
        for locale in LOCALES:
            ctx = browser.new_context(viewport=VIEW, locale={'ko': 'ko-KR', 'en': 'en-US', 'ja': 'ja-JP'}[locale])
            try: fn(ctx, locale)
            except Exception as e: print('FAIL', name, locale, str(e)[:300], flush=True)
            finally: ctx.close()
    browser.close()
print('page errors:', errors[:5])
