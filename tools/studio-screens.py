"""Screenshots of the real Studio for the game landing pages (assets/studio/*.webp).

Drives /game/studio/ with committed CC0 fixtures (OpenGameArt samurai sheet, cave autotile-47,
ninja frames — licences in tests/fixtures) and writes each shot as 1440×900 WebP plus a 780 px
wide variant for phones. Needs a running server: TEST_URL (default http://127.0.0.1:4173).
Usage: python tools/studio-screens.py [--out assets/studio]
"""
import io, os, sys
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


with sync_playwright() as pw:
    browser = pw.chromium.launch()
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
    browser.close()
