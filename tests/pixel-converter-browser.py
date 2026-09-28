"""T1 converter path in the existing Studio Pixel workspace, using a CC0 fixture.

PORT=4701 node tools/serve.mjs; TEST_URL=http://127.0.0.1:4701 python tests/pixel-converter-browser.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,sys

ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
SHOTS=Path(os.environ.get('PIXEL_CONVERTER_SHOTS',ROOT/'test-results'/'pixel-converter'))
SHOTS.mkdir(parents=True,exist_ok=True)
FIX=ROOT/'tests'/'fixtures'/'pixel'/'old_hero__nn_x7.png'
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
checks=[];errors=[];outside=[]
def check(name,value):
    assert value,name
    checks.append(name);print('PASS',name,flush=True)
def ready(p):p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"',timeout=30000)
def state(p,s):p.wait_for_function('s=>document.querySelector("[data-px=cleanup]")?.dataset.state===s',arg=s,timeout=60000)
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    for locale in ['en','ko','ja']:
        ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
        p=ctx.new_page()
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('request',lambda r:outside.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('blob:') and not r.url.startswith('data:') else None)
        p.goto(BASE+f'/{locale}/game/studio/?ws=pixel&mode=convert')
        ready(p)
        p.set_input_files('input[type=file][multiple]',str(FIX))
        p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0',timeout=20000)
        p.evaluate("()=>window.nerulioStudio.runCommand('pixel.cleanup')")
        p.locator('[data-px="clean-intent"]').wait_for()
        check(f'{locale}: URL opens photo conversion in Pixel Studio',p.locator('[data-px="clean-intent"]').input_value()=='convert')
        p.locator('[data-px="clean-targetWidth"]').fill('24')
        p.locator('[data-px="clean-targetWidth"]').dispatch_event('change')
        p.locator('[data-px="clean-targetHeight"]').fill('24')
        p.locator('[data-px="clean-targetHeight"]').dispatch_event('change')
        p.locator('[data-px="clean-measure"]').click();state(p,'measured')
        if p.locator('.px-clean-opts').get_attribute('open') is None:p.locator('.px-clean-opts summary').click()
        p.locator('[data-px="clean-sampleMethod"]').select_option('median')
        p.locator('[data-px="clean-paletteAlgorithm"]').select_option('wu')
        p.locator('[data-px="clean-palettePreset"]').select_option('pico8')
        p.locator('[data-px="clean-dither"]').select_option('atkinson')
        p.locator('[data-px="clean-ditherStrength"]').fill('60')
        p.locator('[data-px="clean-ditherStrength"]').dispatch_event('change')
        check(f'{locale}: settings serialize without the file',all(x in p.url for x in ['mode=convert','cw=24','ch=24','sampler=median','palette=pico8']) and str(FIX) not in p.url)
        p.locator('[data-px="clean-preview"]').click();state(p,'done')
        dims=p.evaluate('()=>{const r=window.__pixel.cleanupUI.state().result;return r.frames.map(f=>[f.width,f.height]);}')
        check(f'{locale}: preview is 24×24 with one shared fixed palette',dims==[[24,24]] and p.locator('[data-px="clean-palette"] span').count()<=16)
        if locale=='en':p.screenshot(path=str(SHOTS/'converter-1440.png'))
        before=p.evaluate('()=>window.nerulioStudio.doc.assets.length')
        p.locator('[data-px="clean-apply"]').click()
        p.wait_for_function('n=>window.nerulioStudio.doc.assets.length===n+1',arg=before,timeout=20000)
        check(f'{locale}: apply adds a new sprite and keeps source',p.evaluate('()=>window.nerulioStudio.doc.assets.map(a=>a.name)')[-1].endswith('_pixel') and p.evaluate('()=>window.nerulioStudio.doc.assets.length')==before+1)
        ctx.close()
    ctx=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
    p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)))
    p.goto(BASE+'/ko/game/studio/?ws=pixel&mode=convert');ready(p)
    p.set_input_files('input[type=file][multiple]',str(FIX));p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0',timeout=20000)
    p.evaluate("()=>window.nerulioStudio.runCommand('pixel.cleanup')")
    check('390px: converter controls fit without page overflow',p.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1'))
    p.screenshot(path=str(SHOTS/'converter-390.png'))
    ctx.close();browser.close()
check('no page errors',not errors)
check('processing sent no outside request',not outside)
print(f'{len(checks)} checks passed, 0 skipped')
