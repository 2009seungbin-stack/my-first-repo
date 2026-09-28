"""Firefox gate for the indexed photo-to-pixel workflow on a CC0 photograph.

Run with TEST_URL=http://127.0.0.1:4701 python tests/pixel-converter-firefox.py.
"""
from io import BytesIO
from pathlib import Path
import base64
import os
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
PHOTO = ROOT / 'tests/fixtures/pixel-converter/flower-landscape.jpg'
checks = []
errors = []
outside = []

def check(name, value):
    assert value, name
    checks.append(name)
    print('PASS', name, flush=True)

with sync_playwright() as pw:
    browser = pw.firefox.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    page = ctx.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda req: outside.append(req.url) if not req.url.startswith(BASE) and not req.url.startswith(('blob:', 'data:')) else None)
    page.goto(BASE + '/en/game/studio/?ws=pixel&mode=convert')
    page.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"', timeout=30000)
    page.set_input_files('input[type=file][multiple]', str(PHOTO))
    page.wait_for_function('()=>window.nerulioStudio.doc.assets.length===1', timeout=20000)
    page.evaluate("()=>window.nerulioStudio.runCommand('pixel.cleanup')")
    page.locator('[data-px="clean-measure"]').click()
    page.wait_for_function('()=>document.querySelector("[data-px=cleanup]")?.dataset.state==="measured"', timeout=60000)
    if page.locator('.px-clean-opts').get_attribute('open') is None:
        page.locator('.px-clean-opts summary').click()
    check('Firefox default uses area-average cells', page.locator('[data-px="clean-sampleMethod"]').input_value() == 'box')
    check('Firefox default uses Wu palette', page.locator('[data-px="clean-paletteAlgorithm"]').input_value() == 'wu')
    page.locator('[data-px="clean-preview"]').click()
    page.wait_for_function('()=>document.querySelector("[data-px=cleanup]")?.dataset.state==="done"', timeout=60000)
    result = page.evaluate('''()=>{const f=window.__pixel.cleanupUI.state().result.frames[0];const c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.data),f.width,f.height),0,0);return {png:c.toDataURL('image/png').split(',')[1],rgba:Array.from(f.data),w:f.width,h:f.height};}''')
    reopened = Image.open(BytesIO(base64.b64decode(result['png']))).convert('RGBA')
    check('Firefox CC0 conversion PNG independently reopens with exact 32x32 pixels', reopened.size == (32, 32) and reopened.tobytes() == bytes(result['rgba']))
    check('Firefox Studio retains original before Apply', page.evaluate('()=>window.nerulioStudio.doc.assets.length') == 1)
    page.locator('[data-px="clean-apply"]').click()
    page.wait_for_function('()=>window.nerulioStudio.doc.assets.length===2', timeout=20000)
    check('Firefox Apply adds a new sprite and retains original', page.evaluate('()=>window.nerulioStudio.doc.assets.length') == 2)
    check('Firefox photo stays local', not outside)
    check('Firefox has no page errors', not errors)
    ctx.close()
    browser.close()

print(f'PIXEL CONVERTER FIREFOX PASSED {len(checks)} checks', flush=True)
