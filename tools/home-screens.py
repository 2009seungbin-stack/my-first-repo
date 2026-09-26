"""Product shots for the home page (assets/home/shot-*.webp).

Drives the real Studio at /game/studio/ with committed CC0 art and saves crisp captures
(device scale 2) for the home hero and its workflow sections:
  - hero:  Sprite workspace, GrafxKid's "Classic Hero" sheet (OpenGameArt, CC0) cut into
           5 tagged animations, one frame with pivot, hurt box and hit box, the preview window open.
  - pack:  Pack & Export with the same frames packed for Godot 4.
  - tile:  Tile workspace, the cave autotile-47 sheet (OpenGameArt, CC0) and a test map
           painted with the Godot 4 terrain rule.
  - pixel: Pixel workspace, the six ninja run frames by DezrasDragons (OpenGameArt, CC0,
           tests/fixtures/pixel) with frame 3 open and onion skin on.
  - labs:  4:3 crops of the Lab screenshots in assets/studio (no browser needed).
Licences: assets/home/art/LICENSE.md and tests/fixtures/tile/SOURCES.md.
Needs a running server: TEST_URL (default http://127.0.0.1:4173).
Usage: python tools/home-screens.py [--only hero,pack,tile,pixel,labs] [--locales en,ko,ja]
"""
import io, os, re, sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = ROOT / 'assets' / 'home'
HERO = ROOT / 'assets' / 'home' / 'art' / 'classic-hero.png'
CAVE = ROOT / 'tests' / 'fixtures' / 'tile' / 'cave-autotile47.png'
ONLY = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
LOCALES = sys.argv[sys.argv.index('--locales') + 1].split(',') if '--locales' in sys.argv else ['en', 'ko', 'ja']
TAGS = ['idle', 'walk', 'jump', 'swim', 'shoot']
W, H = 1280, 760
FRAME = int(os.environ.get('HERO_FRAME', '25'))


def want(name):
    return ONLY is None or name in ONLY


def save(png, name, widths, crop=None):
    """Writes <name>-<w>.webp for each width from a 2x capture (optionally cropped, in CSS px)."""
    im = Image.open(io.BytesIO(png)).convert('RGB')
    if crop:
        x, y, w, h = crop
        im = im.crop((x * 2, y * 2, (x + w) * 2, (y + h) * 2))
    for w in widths:
        out = im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        path = OUT / f'{name}-{w}.webp'
        out.save(path, 'WEBP', quality=80, method=6)
        print('wrote', path.name, out.size, path.stat().st_size)


def js(p, body, arg=None):
    return p.evaluate('async(arg)=>{const S=window.nerulioStudio;' + body + '}', arg)


def quiet(p):
    p.wait_for_timeout(350)
    p.evaluate('()=>document.querySelectorAll(".st-toast,.st-toasts>*").forEach(e=>e.remove())')
    p.mouse.move(4, 300); p.wait_for_timeout(200)


def canvas_at(p, ix, iy):
    return js(p, 'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+arg[0]*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+arg[1]*v.view.scale)*r.height/v.H};', [ix, iy])


def drag(p, a, b):
    s0, s1 = canvas_at(p, *a), canvas_at(p, *b)
    p.mouse.move(s0['x'], s0['y']); p.mouse.down(); p.mouse.move(s1['x'], s1['y'], steps=6); p.mouse.up(); p.wait_for_timeout(120)


def studio(browser, locale, ws, size=(W, H)):
    ctx = browser.new_context(viewport={'width': size[0], 'height': size[1]}, device_scale_factor=2, locale={'en': 'en-US', 'ko': 'ko-KR', 'ja': 'ja-JP'}[locale])
    p = ctx.new_page()
    p.goto(f'{BASE}/{locale}/game/studio/?ws={ws}')
    p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=30000)
    return p


def sprite_project(p):
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(HERO)])
    p.wait_for_selector('[data-sp="plan-count"]', timeout=30000)
    p.click('[data-sp="import-apply"]')
    p.wait_for_function('()=>window.nerulioStudio.doc.assets[0]?.frames.length===26', timeout=30000)
    for i, name in enumerate(TAGS):
        p.locator('.sp-tag').nth(i).click(); p.wait_for_timeout(120)
        p.fill('[data-sp="tag-name"]', name); p.keyboard.press('Enter'); p.wait_for_timeout(120)


def hero(browser, locale):
    p = studio(browser, locale, 'sprite')
    sprite_project(p)
    # A shoot frame, big, with a pivot at the feet, a hurt box on the body and a hit box on the shot.
    p.locator(f'.sp-fh[data-i="{FRAME}"]').click(); p.wait_for_timeout(150)
    js(p, 'S.view.zoomTo(20*S.view.dpr);')
    js(p, 'const v=S.view;v.setView({...v.v,x:Math.round(v.W/2-8*v.v.scale),y:Math.round(v.H/2-8.6*v.v.scale)});')
    p.keyboard.press('p'); pt = canvas_at(p, 8, 16); p.mouse.click(pt['x'], pt['y'])
    p.keyboard.press('b'); p.select_option('[data-sp="box-type"]', 'hurt'); drag(p, (3, 1), (13, 16))
    p.select_option('[data-sp="box-type"]', 'hit'); drag(p, (12, 8), (16, 12))
    p.keyboard.press('v')
    # Onion skin off: at this zoom the tinted neighbours read as noise in a small picture.
    if p.locator('[data-sp="onion"]').get_attribute('aria-pressed') == 'true':
        p.click('[data-sp="onion"]')
    # The preview window plays the tag (a still of it here), docked over the canvas.
    js(p, 'S.runCommand("sprite.preview");'); p.wait_for_timeout(300)
    zoom = p.locator('[data-sp="preview"] select').first
    zoom.select_option(zoom.locator('option').last.get_attribute('value')); p.wait_for_timeout(200)
    quiet(p)
    save(p.screenshot(), f'shot-hero-{locale}', [2560, 1600, 1280])
    # Phone crop: the canvas and the timeline, no side panels.
    save(p.screenshot(), f'shot-hero-crop-{locale}', [1040, 780], crop=(330, 30, 650, 670))
    p.context.close()


SW, SH = 1000, 640  # workflow shots: a smaller window, so the UI reads at half the page width


def pack(browser, locale):
    p = studio(browser, locale, 'sprite', (SW, SH))
    sprite_project(p)
    p.click('.st-ws-tab[data-ws="pack"]')
    p.wait_for_selector('[data-pack="efficiency"]', state='attached', timeout=60000)
    p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")', timeout=60000)
    js(p, 'S.view.fit();'); quiet(p)
    save(p.screenshot(), f'shot-pack-{locale}', [1600, 1040], crop=(40, 30, SW - 40, SH - 30 - 22))
    p.context.close()


def tile(browser, locale):
    p = studio(browser, locale, 'tile', (SW, SH))
    p.set_input_files('input[type=file][multiple]', [str(CAVE)])
    p.wait_for_selector('[data-grid-sug="0"]', timeout=30000)
    p.click('[data-action="tile-apply-grid"]'); p.wait_for_selector('[data-cand]', timeout=30000)
    p.locator('[data-cand]').first.click(); p.click('[data-action="tile-apply-preview"]')
    p.wait_for_selector('[data-verdict="complete"]', timeout=30000)
    p.click('[data-action="tile-new-map"]')
    p.wait_for_function('()=>document.querySelector(".studio").dataset.tileMode==="map"', timeout=10000)
    p.wait_for_selector('[data-verdict="map-ok"]', timeout=10000)
    js(p, 'S.view.fit();'); quiet(p)
    save(p.screenshot(), f'shot-tile-{locale}', [1600, 1040], crop=(40, 30, SW - 40, SH - 30 - 22))
    p.context.close()


def pixel(browser, locale):
    p = studio(browser, locale, 'pixel', (SW, SH))
    frames = sorted((ROOT / 'tests' / 'fixtures' / 'pixel').glob('ninja_run_[0-9].png'))
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])', [str(f) for f in frames])
    p.wait_for_function('()=>window.nerulioStudio.doc.assets[0]?.frames.length===6', timeout=30000)
    p.evaluate('()=>window.__pixel.setCurrent(2,{select:true})'); p.wait_for_timeout(300)
    js(p, 'S.view.zoomTo(20);S.view.reveal({x:0,y:0,w:40,h:29});'); p.wait_for_timeout(200)
    p.keyboard.press('F3'); p.wait_for_timeout(300); p.keyboard.press('b'); quiet(p)
    save(p.screenshot(), f'shot-pixel-{locale}', [1600, 1040], crop=(40, 30, SW - 40, SH - 30 - 22))
    p.context.close()


def labs():
    """Lab cards: 4:3 crops of the Lab screenshots (assets/studio/*-lab.webp, tools/studio-screens.py)."""
    for name, box in [('pixel', (183, 300, 815, 760)), ('texture', (183, 312, 813, 620)), ('ui', (183, 95, 823, 562))]:
        im = Image.open(ROOT / 'assets' / 'studio' / f'{name}-lab.webp').convert('RGB').crop(box)
        r = max(640 / im.width, 480 / im.height)
        im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
        x, y = (im.width - 640) // 2, (im.height - 480) // 2
        im.crop((x, y, x + 640, y + 480)).save(OUT / f'lab-{name}.webp', 'WEBP', quality=80, method=6)
        print('wrote', f'lab-{name}.webp')


if want('labs'):
    labs()
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for locale in LOCALES:
        for name, fn in [('hero', hero), ('pack', pack), ('tile', tile), ('pixel', pixel)]:
            if want(name):
                fn(browser, locale)
    browser.close()
