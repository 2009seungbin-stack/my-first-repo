"""Reproduce a same-photo browser comparison of three public converters.

Run with local Nerulio on TEST_URL (default 4701). Competitor sites can change;
any missing output is a failure, never silently scored zero. Outputs stay ignored.
"""
import base64
import hashlib
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'test-results/pixel-converter/competitors'
OUT.mkdir(parents=True, exist_ok=True)
source = Image.open(ROOT/'tests/fixtures/pixel-converter/flower-landscape.jpg').convert('RGB')
photo = OUT/'flower-1024.png'
source.resize((1024, 768), Image.Resampling.LANCZOS).save(photo)
local = os.environ.get('TEST_URL', 'http://127.0.0.1:4701').rstrip('/')

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()

    page = browser.new_page(accept_downloads=True)
    page.goto(local+'/en/game/studio/?ws=pixel&mode=convert')
    page.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"')
    page.set_input_files('input[type=file][multiple]', str(photo))
    page.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0')
    page.evaluate("()=>window.nerulioStudio.runCommand('pixel.cleanup')")
    for key, value in [('targetWidth', '32'), ('targetHeight', '24')]:
        control = page.locator(f'[data-px="clean-{key}"]')
        control.fill(value)
        control.dispatch_event('change')
    page.locator('[data-px="clean-measure"]').click()
    page.wait_for_function('()=>document.querySelector("[data-px=cleanup]")?.dataset.state==="measured"')
    assert page.locator('[data-px="clean-sampleMethod"]').input_value() == 'box'
    assert page.locator('[data-px="clean-paletteAlgorithm"]').input_value() == 'wu'
    page.locator('[data-px="clean-preview"]').click()
    page.wait_for_function('()=>document.querySelector("[data-px=cleanup]")?.dataset.state==="done"')
    png = page.evaluate('''()=>{const f=window.__pixel.cleanupUI.state().result.frames[0],c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.data),f.width,f.height),0,0);return c.toDataURL('image/png').split(',')[1]}''')
    (OUT/'nerulio.png').write_bytes(base64.b64decode(png))
    page.close()

    page = browser.new_page(accept_downloads=True)
    page.goto('https://imagepixel.net/')
    page.locator('input[type=file]').first.set_input_files(str(photo))
    page.get_by_text('32×24 grid').wait_for(timeout=30000)
    assert page.locator('select').first.input_value() == '16'
    with page.expect_download(timeout=30000) as download:
        page.get_by_role('button', name='Download PNG').click()
    download.value.save_as(OUT/'imagepixel.png')
    page.close()

    page = browser.new_page(accept_downloads=True)
    page.goto('https://pixelartvillage.org/')
    page.locator('input[type=file]').first.set_input_files(str(photo))
    page.locator('#pixel-size-slider').fill('32')
    page.locator('#auto-palette').check()
    page.locator('#palette-size').wait_for(timeout=30000)
    assert page.locator('#palette-size').input_value() == '16'
    # This site updates the canvas asynchronously after the palette switch.
    page.wait_for_timeout(3000)
    page.get_by_role('button', name='Pixel size', exact=True).click()
    with page.expect_download(timeout=30000) as download:
        page.get_by_role('button', name='Download Pixel Art Image').last.click()
    download.value.save_as(OUT/'pixelartvillage.png')
    page.close()

    page = browser.new_page(accept_downloads=True)
    page.goto('https://imageto8bit.com/')
    page.locator('#fileInput').set_input_files(str(photo))
    page.get_by_text('Ready. Download').wait_for(timeout=30000)
    page.locator('#blockSize').fill('16')
    page.locator('#paletteSelect').select_option('PICO-8')
    with page.expect_download(timeout=30000) as download:
        page.get_by_role('button', name='Download PNG').click()
    download.value.save_as(OUT/'imageto8bit.png')
    page.close()
    browser.close()

names = ['nerulio', 'imagepixel', 'pixelartvillage', 'imageto8bit']
reference = np.asarray(Image.open(photo).convert('RGB').resize((32, 24), Image.Resampling.BOX), dtype=np.float32)
rows = []
sheet = Image.new('RGB', (4*266, 222), 'white')
draw = ImageDraw.Draw(sheet)
for index, name in enumerate(names):
    path = OUT/(name+'.png')
    image = Image.open(path).convert('RGB')  # independent decoder
    normalized = image if image.size == (32, 24) else image.resize((32, 24), Image.Resampling.BOX)
    actual = np.asarray(normalized, dtype=np.float32)
    rows.append({'tool': name, 'native_size': list(image.size),
                 'unique_colors': len(np.unique(np.asarray(image).reshape(-1, 3), axis=0)),
                 'rgb_rmse_box_32x24': round(float(np.sqrt(np.mean((actual-reference)**2))), 2),
                 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    sheet.paste(normalized.resize((256, 192), Image.Resampling.NEAREST), (index*266, 22))
    draw.text((index*266+3, 3), name, fill='black')
sheet.save(OUT/'contact-sheet.png')
(OUT/'measurements.json').write_text(json.dumps(rows, indent=2), encoding='utf-8')
print(json.dumps(rows, indent=2))
