"""Screenshots of the real Studio for the game landing pages (assets/studio/*.webp).

Drives /game/studio/ with committed CC0 fixtures (OpenGameArt samurai sheet, cave autotile-47,
ninja frames — licences in tests/fixtures) and writes each shot as 1440×900 WebP plus a 780 px
wide variant for phones. The Lab landings (Pixel, Texture, UI, Tile Lab, classic Sprite Lab) get a
shot of their Lab, reached the way a visitor reaches it: the landing page's own file picker hands
committed CC0 fixtures (ninja frames, ambientCG Bricks076C / Ground054, Kenney UI Pack and Tiny
Dungeon, samurai sheet) to <route>/app/ or the classic Lab. Needs a running server: TEST_URL
(default http://127.0.0.1:4173).
Usage: python tools/studio-screens.py [--out assets/studio] [--only pixel-lab,ui-lab,...]
"""
import io, os, re, sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else ROOT / 'assets' / 'studio'
FX = ROOT / 'tests' / 'fixtures'
SAMURAI = FX / 'game' / 'corpus' / 'sprites' / 'samurai.png'
NINJA = sorted((FX / 'game' / 'corpus' / 'ninja').glob('run_*.png'))
CAVE = FX / 'tile' / 'cave-autotile47.png'
GS = FX / 'game-seo'
DUNGEON = FX / 'kenney' / 'tiny-dungeon-tilemap.png'
ONLY = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
STUDIO_SHOTS = {'sprite-sheet', 'sprite-frame', 'pack', 'tile-check', 'tile-map'}
# Shots for the page families (src/game-seo-families.js), from committed CC0 fixtures.
GIF = FX / 'sprite' / 'trooper_run.gif'
ASE = FX / 'aseprite' / 'indexed-features.aseprite'
TORCH = FX / 'game' / 'corpus' / 'torch'
TEX = FX / 'texture'
A2 = FX / 'tile' / 'coolschool-A2.png'
FAMILY_SHOTS = {'sprite-gif', 'sprite-aseprite', 'sprite-atlas', 'texture-lit', 'texture-check', 'tile-missing', 'tile-generator', 'tile-collision', 'pack-formats'}
# Shots of the Pixel workspace pages (src/game-seo-pixel.js), from the committed CC0 fixtures in
# tests/fixtures/pixel (GrafxKid "Classic Hero", DezrasDragons ninja, batterypuck's generated image; LICENSE.md there).
PX = FX / 'pixel'
PIXEL_SHOTS = {'pixel-edit', 'pixel-anim', 'pixel-palette', 'pixel-cleanup', 'pixel-generated', 'pixel-outline'}


def want(*names):
    return ONLY is None or any(n in ONLY for n in names)


def save(png, name):
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.open(io.BytesIO(png)).convert('RGB')
    im.save(OUT / f'{name}.webp', 'WEBP', quality=82, method=6)
    small = im.resize((780, round(im.height * 780 / im.width)), Image.LANCZOS)
    small.save(OUT / f'{name}-780.webp', 'WEBP', quality=84, method=6)
    print('wrote', name, (OUT / f'{name}.webp').stat().st_size, (OUT / f'{name}-780.webp').stat().st_size)


def js(p, body, arg=None):
    return p.evaluate('async(arg)=>{const S=window.nerulioStudio;' + body + '}', arg)


def studio(ctx, ws):
    p = ctx.new_page()
    p.goto(f'{BASE}/en/game/studio/?ws={ws}')
    p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=30000)
    return p


def quiet(p):
    """Waits for toasts to disappear so the shot shows the workspace only."""
    p.wait_for_timeout(300)
    p.evaluate('()=>document.querySelectorAll(".st-toast,.st-toasts>*").forEach(e=>e.remove())')
    p.mouse.move(2, 2); p.wait_for_timeout(200)


def canvas_at(p, ix, iy):
    return js(p, 'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+arg[0]*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+arg[1]*v.view.scale)*r.height/v.H};', [ix, iy])


def drag(p, a, b):
    s0, s1 = canvas_at(p, *a), canvas_at(p, *b)
    p.mouse.move(s0['x'], s0['y']); p.mouse.down(); p.mouse.move(s1['x'], s1['y'], steps=5); p.mouse.up(); p.wait_for_timeout(120)


def lab(browser, route, files, ready):
    """Landing page -> its own file picker -> the Lab behind it, with the files loaded."""
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1, locale='en-US')
    p = ctx.new_page()
    p.goto(BASE + route)
    p.wait_for_function('()=>document.documentElement.dataset.glReady==="1"', timeout=30000)
    with p.expect_navigation(url=re.compile(r'/(app|classic)/'), timeout=30000):
        p.set_input_files('#glFiles', [str(f) for f in files])
    p.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"', timeout=60000)
    p.wait_for_selector(ready, timeout=60000); p.wait_for_timeout(1200)
    return p


def lab_quiet(p):
    p.evaluate('()=>document.querySelectorAll(".toast,.toasts>*,[role=alert].toast").forEach(e=>e.remove())')
    p.mouse.move(2, 2); p.wait_for_timeout(200)


def lab_shots(browser):
    # Pixel Lab: six ninja frames share one extracted palette; the Palette stage lists each colour with its share of the pixels.
    if want('pixel-lab'):
        p = lab(browser, '/en/game/pixel-lab/', NINJA, '#plabCanvas')
        p.locator('[data-action="plab-stage"][data-stage="palette"]').click()
        p.wait_for_function('()=>document.querySelectorAll(".plab-swatch").length>=2', timeout=30000); lab_quiet(p)
        save(p.screenshot(), 'pixel-lab'); p.context.close()
    # Texture Lab: the ambientCG height map turned into a normal map, with the OpenGL/DirectX table.
    if want('texture-lab'):
        p = lab(browser, '/en/normal-map-generator/', [GS / 'bricks076c_height.png'], '#texNormalOut')
        p.wait_for_selector('[data-action="tex-normal-set"][data-value="opengl"][aria-pressed="true"]', timeout=30000); lab_quiet(p)
        save(p.screenshot(), 'texture-lab'); p.context.close()
    # UI Lab: the Kenney panel with 12 px borders (its real corner size), the guides and the live previews.
    if want('ui-lab'):
        p = lab(browser, '/en/game/9-slice-editor/', [GS / 'kenney-blue-panel.png'], '#nsCanvas')
        for side in ['left', 'right', 'top', 'bottom']:
            p.fill('#ns-' + side, '12')
        p.wait_for_timeout(600)
        # The 8 px suggestion (a run of identical lines) is not the panel's corner size; dismiss it.
        if p.get_by_role('button', name='Dismiss').count():
            p.get_by_role('button', name='Dismiss').click(); p.wait_for_timeout(300)
        p.evaluate('()=>{document.activeElement?.blur();scrollTo(0,200)}'); lab_quiet(p)
        save(p.screenshot(), 'ui-lab'); p.context.close()
    # Tile Lab seam check: the tileable ambientCG ground repeated 2x2, both wrap edges measured.
    if want('tile-seams'):
        p = lab(browser, '/en/game/seamless-tile-checker/', [GS / 'ground054_color.png'], '#tlSeamSummary')
        p.wait_for_function('()=>/without a visible seam/.test(document.querySelector("#tlSeamSummary")?.innerText||"")', timeout=30000); lab_quiet(p)
        save(p.screenshot(), 'tile-seams'); p.context.close()
    # Tile Lab slicer: the Kenney Tiny Dungeon tilemap with the measured 16 px / 1 px grid ranked first.
    if want('tile-slice'):
        p = lab(browser, '/en/tile-grid-slicer/', [DUNGEON], '.tl-cand')
        p.wait_for_function('()=>/16.16/.test(document.querySelector(".tl-cand")?.innerText||"")', timeout=30000); lab_quiet(p)
        save(p.screenshot(), 'tile-slice'); p.context.close()
    # Classic Sprite Lab: the samurai sheet with all 60 frames outlined before export.
    if want('sprite-lab'):
        p = lab(browser, '/en/game/sprite-sheet-to-png-frames/', [SAMURAI], '.slicer-box')
        p.wait_for_function('()=>document.querySelectorAll(".slicer-box").length===60', timeout=60000); lab_quiet(p)
        save(p.screenshot(), 'sprite-lab'); p.context.close()


def fresh(browser, ws):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    return studio(ctx, ws)


def tile_ready(p, sheet, verdict='[data-verdict="complete"]'):
    p.set_input_files('input[type=file][multiple]', [str(sheet)])
    p.wait_for_selector('[data-grid-sug="0"]', timeout=30000)
    p.click('[data-action="tile-apply-grid"]'); p.wait_for_selector('[data-cand]', timeout=30000)
    p.locator('[data-cand]').first.click(); p.click('[data-action="tile-apply-preview"]')
    p.wait_for_selector(verdict, timeout=30000)


def pxjs(p, body, arg=None):
    return p.evaluate('async(arg)=>{const S=window.nerulioStudio,W=window.__pixel;' + body + '}', arg)


def px_import(p, names):
    n = js(p, 'return S.doc.assets.length;')
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(PX / x) for x in names])
    p.wait_for_function('n=>window.nerulioStudio.doc.assets.length>n', arg=n, timeout=30000); p.wait_for_timeout(600)


def px_zoom(p, z):
    pxjs(p, 'S.view.zoomTo(arg);S.view.reveal({x:0,y:0,w:W.session.rect.w,h:W.session.rect.h});', z); p.wait_for_timeout(250)


def px_drag(p, pts):
    s = [canvas_at(p, x + .5, y + .5) for x, y in pts]
    p.mouse.move(s[0]['x'], s[0]['y']); p.mouse.down()
    for q in s[1:]:
        p.mouse.move(q['x'], q['y'], steps=4)
    p.mouse.up(); p.wait_for_timeout(250)


def px_clean_wait(p, states):
    p.wait_for_function('s=>s.includes(document.querySelector("[data-px=cleanup]").dataset.state)', arg=states, timeout=90000); p.wait_for_timeout(300)


def pixel_shots(browser):
    # Pixel: GrafxKid's hero, a shading layer set to Multiply, the pencil active.
    if want('pixel-edit'):
        p = fresh(browser, 'pixel'); px_import(p, ['old_hero.png']); px_zoom(p, 12)
        p.keyboard.press('Shift+n'); p.wait_for_timeout(300)
        pxjs(p, "W.setColor('fg',[120,110,190,255])"); p.keyboard.press('b')
        px_drag(p, [(20, 30), (21, 31), (22, 32), (23, 33), (24, 34), (25, 35)])
        px_drag(p, [(38, 28), (38, 34), (40, 36)])
        p.select_option('[data-px="layer-blend"]', 'multiply'); p.wait_for_timeout(300)
        p.keyboard.press('b'); quiet(p)
        save(p.screenshot(), 'pixel-edit'); p.context.close()
    # Pixel: the six ninja run frames, frame 3 current, onion skin on.
    if want('pixel-anim'):
        p = fresh(browser, 'pixel'); px_import(p, [f'ninja_run_{i}.png' for i in range(6)])
        pxjs(p, 'W.setCurrent(2,{select:true});'); p.wait_for_timeout(300); px_zoom(p, 14)
        p.keyboard.press('F3'); p.wait_for_timeout(400); p.keyboard.press('b'); quiet(p)
        save(p.screenshot(), 'pixel-anim'); p.context.close()
    # Pixel: the ninja frames converted to indexed colour (exact colours), palette and audit visible.
    if want('pixel-palette'):
        p = fresh(browser, 'pixel'); px_import(p, [f'ninja_run_{i}.png' for i in range(6)])
        js(p, "S.runCommand('pixel.colorMode')"); p.wait_for_selector('dialog [data-px="mode-palette"]')
        p.click('dialog .st-btn.primary'); p.wait_for_timeout(1200); px_zoom(p, 14)
        # Palette and audit side by side: fold the panels above them (a per-page view preference).
        for name in ['Colour', 'Assets', 'Layers', 'Cleanup']:
            t = p.locator('.st-panel-toggle', has_text=name).first
            if t.count() and t.get_attribute('aria-expanded') == 'true':
                t.click(); p.wait_for_timeout(150)
        js(p, "S.runCommand('pixel.audit')"); p.wait_for_timeout(900)
        p.evaluate('()=>document.querySelectorAll(".st-dock-right, .st-dock-right *").forEach(e=>{if(e.scrollTop)e.scrollTop=0})'); p.wait_for_timeout(200)
        quiet(p)
        save(p.screenshot(), 'pixel-palette'); p.context.close()
    # Cleanup: Old Hero resized x4.25 bilinear, measured, background kept, previewed before Apply.
    if want('pixel-cleanup'):
        p = fresh(browser, 'pixel'); px_import(p, ['old_hero__bilinear_x4.25.png'])
        p.click('[data-px="clean-measure"]'); px_clean_wait(p, ['measured', 'error'])
        if p.locator('.px-clean-opts').get_attribute('open') is None:
            p.click('.px-clean-opts summary')
        p.select_option('[data-px="clean-background"]', 'keep'); p.wait_for_timeout(100)
        p.click('[data-px="clean-preview"]'); px_clean_wait(p, ['done', 'error']); quiet(p)
        save(p.screenshot(), 'pixel-cleanup'); p.context.close()
    # Cleanup: an image made by an image generator (CC0), measured and judged unsure.
    if want('pixel-generated'):
        p = fresh(browser, 'pixel'); px_import(p, ['gosoythoth_frame0.png'])
        p.click('[data-px="clean-measure"]'); px_clean_wait(p, ['measured', 'error']); quiet(p)
        save(p.screenshot(), 'pixel-generated'); p.context.close()
    # Outline and drop shadow: Canvas size +1, Outline (foreground), Drop shadow (background).
    if want('pixel-outline'):
        p = fresh(browser, 'pixel'); px_import(p, ['ninja_run_0.png'])
        p.keyboard.press('Control+Alt+c'); p.wait_for_selector('dialog.px-canvas'); p.click('dialog .st-btn.primary'); p.wait_for_timeout(700)
        pxjs(p, "W.setColor('fg',[255,236,39,255]);W.setColor('bg',[29,43,83,255]);")
        js(p, "S.runCommand('pixel.outline')"); p.wait_for_timeout(500)
        js(p, "S.runCommand('pixel.shadow')"); p.wait_for_timeout(500)
        px_zoom(p, 16); quiet(p)
        save(p.screenshot(), 'pixel-outline'); p.context.close()


def family_shots(browser):
    # Sprite: an animated GIF imported as frames with its own delays on the timeline, onion skin on.
    if want('sprite-gif'):
        p = fresh(browser, 'sprite')
        p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(GIF)])
        p.wait_for_function('()=>window.nerulioStudio.doc.assets[0]?.frames.length===6', timeout=30000)
        p.locator('.sp-fh[data-i="2"]').click(); p.wait_for_timeout(150)
        p.keyboard.press('F3'); p.wait_for_timeout(250); quiet(p)
        save(p.screenshot(), 'sprite-gif'); p.context.close()
    # Sprite: an .aseprite file with its tags, durations and slices listed as import decisions.
    if want('sprite-aseprite'):
        p = fresh(browser, 'sprite')
        p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(ASE)])
        p.wait_for_function('()=>window.nerulioStudio.doc.assets[0]?.frames.length===4', timeout=30000)
        js(p, 'S.view.zoomTo(28);S.view.reveal({x:0,y:0,w:16,h:12});'); p.wait_for_timeout(300); quiet(p)
        save(p.screenshot(), 'sprite-aseprite'); p.context.close()
    # Sprite: an Aseprite JSON atlas and its sheet (the CC0 torch) opened together.
    if want('sprite-atlas'):
        p = fresh(browser, 'sprite')
        p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(TORCH / 'Torch_Sheet.png'), str(TORCH / 'Torch_Hash.json')])
        p.wait_for_function('()=>window.nerulioStudio.doc.assets.some(a=>a.frames.length>1)', timeout=30000); p.wait_for_timeout(400); quiet(p)
        save(p.screenshot(), 'sprite-atlas'); p.context.close()
    # Texture: the CC0 torch sheet cut into its six 32 px frames in Sprite, then lit in Texture.
    if want('texture-lit'):
        p = fresh(browser, 'sprite')
        p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(TEX / 'torch_sheet.png')])
        p.wait_for_selector('[data-sp="plan-count"]', timeout=30000)
        p.click('[data-sp="import-apply"]'); p.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===6', timeout=30000)
        p.click('.st-ws-tab[data-ws="texture"]')
        p.wait_for_function('()=>{const T=window.nerulioTexture;return T&&T.S.gen&&!T.S.busy}', timeout=30000); p.wait_for_timeout(400)
        js(p, 'S.view.zoomTo(14);S.view.reveal({x:0,y:0,w:32,h:32});'); p.wait_for_timeout(400); quiet(p)
        save(p.screenshot(), 'texture-lit'); p.context.close()
    # Texture: the ambientCG DirectX normal map read as DirectX, with its confidence, before anything is applied.
    if want('texture-check'):
        p = fresh(browser, 'texture')
        p.set_input_files('input[type=file][multiple]', [str(TEX / f) for f in ['bricks_Color.png', 'bricks_NormalDX.png']])
        p.wait_for_function('()=>{const T=window.nerulioTexture;return T&&T.S.gen&&!T.S.busy}', timeout=30000)
        dx = js(p, 'return S.doc.assets.find(a=>a.name==="bricks_NormalDX.png").id;')
        p.select_option('[data-k="normalFrom"]', dx); p.wait_for_selector('[data-tex="convention"]', timeout=30000)
        p.locator('[data-tex="convention"]').scroll_into_view_if_needed(); p.wait_for_timeout(400); quiet(p)
        save(p.screenshot(), 'texture-check'); p.context.close()
    # Tile: one tile removed from the cave set, and a test map where Godot leaves the lone cell empty.
    if want('tile-missing'):
        p = fresh(browser, 'tile'); tile_ready(p, CAVE)
        p.keyboard.press('v'); p.wait_for_timeout(100)
        pt = canvas_at(p, 6 * 64 + 32, 5 * 64 + 32); p.mouse.click(pt['x'], pt['y']); p.wait_for_timeout(150)
        p.keyboard.press('Delete'); p.wait_for_timeout(300)
        p.click('[data-action="tile-new-map"]')
        p.wait_for_function('()=>document.querySelector(".studio").dataset.tileMode==="map"', timeout=10000)
        p.wait_for_selector('[data-verdict]', timeout=10000)
        js(p, 'S.view.zoomTo(1);S.view.reveal({x:22*64,y:13*64,w:64,h:64});'); p.wait_for_timeout(300)
        pt = canvas_at(p, 22 * 64 + 32, 13 * 64 + 32); p.mouse.click(pt['x'], pt['y']); p.wait_for_timeout(500)
        js(p, 'S.view.fit();'); p.wait_for_timeout(300); quiet(p)
        save(p.screenshot(), 'tile-missing'); p.context.close()
    # Tile: a 47-tile set assembled from the RPG Maker A2 block of a CC0 sheet (named by its size).
    if want('tile-generator'):
        p = fresh(browser, 'tile')
        p.set_input_files('input[type=file][multiple]', [str(A2)]); p.wait_for_selector('[data-grid-sug]', timeout=30000)
        for k, v in {'w': 48, 'h': 48, 'ox': 0, 'oy': 0, 'sx': 0, 'sy': 0}.items():
            p.fill(f'[data-tile-grid="{k}"]', str(v)); p.locator(f'[data-tile-grid="{k}"]').dispatch_event('change')
        p.click('[data-action="tile-apply-grid"]'); p.wait_for_selector('[data-action="tile-hint"]', timeout=30000)
        p.click('[data-action="tile-hint"]'); p.wait_for_timeout(300)
        p.click('[data-action="tile-generate"]'); p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>=2', timeout=30000)
        p.wait_for_selector('[data-verdict="generated"],[data-verdict="complete"]', timeout=30000)
        js(p, 'S.view.fit();'); p.wait_for_timeout(400); quiet(p)
        save(p.screenshot(), 'tile-generator'); p.context.close()
    # Tile: collision polygons traced from the alpha of every tile of a CC0 blob-47 set (caeles, 16 px).
    if want('tile-collision'):
        p = fresh(browser, 'tile'); tile_ready(p, FX / 'game' / 'cc0' / 'oga-caeles-blob47-16px.png', verdict='[data-verdict]')
        p.keyboard.press('v'); p.wait_for_timeout(100)
        p.keyboard.press('Control+a'); p.wait_for_timeout(200)
        if p.locator('[data-action="tile-col-outline"]').is_disabled():
            a = canvas_at(p, 8, 8); p.keyboard.down('Control'); p.mouse.click(a['x'], a['y']); p.keyboard.up('Control'); p.wait_for_timeout(200)
        p.click('[data-action="tile-col-outline"]'); p.wait_for_timeout(1500)
        p.locator('label.st-check:has-text("Show shapes of every tile") input').check(); p.wait_for_timeout(300)
        p.keyboard.press('c'); p.wait_for_timeout(300)
        js(p, 'S.view.fit();'); p.wait_for_timeout(400); quiet(p)
        save(p.screenshot(), 'tile-collision'); p.context.close()
    # Pack & Export: every export format with how it was verified.
    if want('pack-formats'):
        p = fresh(browser, 'sprite')
        p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(f) for f in NINJA])
        p.wait_for_function('()=>window.nerulioStudio.doc.assets[0]?.frames.length===6', timeout=30000)
        p.click('.st-ws-tab[data-ws="pack"]'); p.wait_for_selector('[data-pack="efficiency"]', state='attached', timeout=60000)
        p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=60000)
        p.evaluate('()=>{const d=[...document.querySelectorAll("details,summary")].find(e=>/All formats/.test(e.textContent||""));const el=d?.closest("details")||d;if(el&&el.tagName==="DETAILS")el.open=true;(el||document.body).scrollIntoView({block:"start"});}')
        p.wait_for_timeout(500); quiet(p)
        save(p.screenshot(), 'pack-formats'); p.context.close()


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    if want(*FAMILY_SHOTS):
        family_shots(browser)
    if want(*PIXEL_SHOTS):
        pixel_shots(browser)
    if want(*STUDIO_SHOTS):
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        # ---------------------------------------------------------------- Sprite: the sheet and its proposed cut
        p = studio(ctx, 'sprite')
        p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(SAMURAI)])
        p.wait_for_selector('[data-sp="plan-count"]', timeout=30000); quiet(p)
        save(p.screenshot(), 'sprite-sheet')
        # ---------------------------------------------------------------- Sprite: a frame with pivot and boxes
        p.click('[data-sp="import-apply"]'); p.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===60')
        p.locator('.sp-fh[data-i="13"]').click(); p.wait_for_timeout(150)
        p.keyboard.press('p'); pt = canvas_at(p, 24, 44); p.mouse.click(pt['x'], pt['y'])
        p.keyboard.press('b'); p.select_option('[data-sp="box-type"]', 'hurt'); drag(p, (12, 10), (36, 44))
        p.select_option('[data-sp="box-type"]', 'hit'); drag(p, (30, 18), (46, 30))
        p.keyboard.press('v'); quiet(p)
        save(p.screenshot(), 'sprite-frame')
        # ---------------------------------------------------------------- Pack & Export: the packed atlas
        p.click('.st-ws-tab[data-ws="pack"]')
        p.wait_for_selector('[data-pack="efficiency"]', state='attached', timeout=60000)
        p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=60000); quiet(p)
        save(p.screenshot(), 'pack')
        p.close()
        # ---------------------------------------------------------------- Tile: layout applied, check complete
        ctx2 = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
        p = studio(ctx2, 'tile')
        p.set_input_files('input[type=file][multiple]', [str(CAVE)])
        p.wait_for_selector('[data-grid-sug="0"]', timeout=30000)
        p.click('[data-action="tile-apply-grid"]'); p.wait_for_selector('[data-cand]', timeout=30000)
        p.locator('[data-cand]').first.click(); p.click('[data-action="tile-apply-preview"]')
        p.wait_for_selector('[data-verdict="complete"]', timeout=30000); quiet(p)
        save(p.screenshot(), 'tile-check')
        # ---------------------------------------------------------------- Tile: a test map with the Godot rule
        p.click('[data-action="tile-new-map"]')
        p.wait_for_function('()=>document.querySelector(".studio").dataset.tileMode==="map"', timeout=10000)
        p.wait_for_selector('[data-verdict="map-ok"]', timeout=10000)
        js(p, 'S.view.fit();'); quiet(p)
        save(p.screenshot(), 'tile-map')
    lab_shots(browser)
    browser.close()
