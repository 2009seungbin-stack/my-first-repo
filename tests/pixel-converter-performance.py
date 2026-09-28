"""Measured Chromium Pixel Studio conversion of a CC0 Commons photo, 4K and 390px guard.

Run against a local server; outputs live in test-results/pixel-converter (ignored by Git).
The 4K image is a nearest-exact size derivative of flower-landscape.jpg, not a new photo.
"""
from pathlib import Path
from time import perf_counter
import json, os
from PIL import Image, ImageOps
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'/'pixel-converter';OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'tests'/'fixtures'/'pixel-converter'/'flower-landscape.jpg'
DERIVED=OUT/'flower-landscape-3840x2160.png'
ImageOps.fit(Image.open(SOURCE).convert('RGB'),(3840,2160),method=Image.Resampling.LANCZOS).save(DERIVED)
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
results=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    for width,height,fixture,shape in [(1440,900,DERIVED,(3840,2160)),(390,844,SOURCE,(2560,1920)),(390,844,DERIVED,(3840,2160))]:
        context=browser.new_context(viewport={'width':width,'height':height})
        page=context.new_page()
        page.goto(BASE+'/en/game/studio/?ws=pixel&mode=convert')
        page.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"')
        t=perf_counter()
        page.set_input_files('input[type=file][multiple]',str(fixture))
        page.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0',timeout=60000)
        imported=perf_counter()-t
        page.evaluate("()=>window.nerulioStudio.runCommand('pixel.cleanup')")
        page.locator('[data-px="clean-intent"]').wait_for()
        t=perf_counter()
        page.locator('[data-px="clean-measure"]').click()
        page.wait_for_function('()=>["measured","error"].includes(document.querySelector("[data-px=cleanup]")?.dataset.state)',timeout=60000)
        state=page.locator('[data-px="cleanup"]').get_attribute('data-state')
        if state=='measured':
            page.locator('[data-px="clean-preview"]').wait_for(timeout=60000)
        else:page.locator('[data-px="clean-error"]').wait_for(timeout=60000)
        measured=perf_counter()-t
        record={'viewport':[width,height],'source':list(shape),'import_s':round(imported,3),'measure_s':round(measured,3),'state':state,'device_memory_gb':page.evaluate('()=>navigator.deviceMemory??null'),'heap_bytes':page.evaluate('()=>performance.memory?.usedJSHeapSize??null')}
        if state=='measured':
            page.screenshot(path=str(OUT/f'performance-{width}.png'))
            runs=[]
            for _ in range(10):
                t=perf_counter();page.locator('[data-px="clean-preview"]').click()
                page.wait_for_function('()=>["done","error"].includes(document.querySelector("[data-px=cleanup]")?.dataset.state)',timeout=60000)
                runs.append(round(perf_counter()-t,3))
            record['preview_s_runs']=runs
            record['preview_s_median']=sorted(runs)[len(runs)//2]
            record['preview_state']=page.locator('[data-px="cleanup"]').get_attribute('data-state')
            record['output']=page.evaluate('()=>window.__pixel.cleanupUI.state().result?.frames.map(f=>[f.width,f.height])')
        else:
            page.locator('[data-px="cleanup"][data-state="error"] [data-px="clean-error"]').wait_for(timeout=60000)
            record['error']=page.locator('[data-px="cleanup"]').inner_text()[-300:]
            page.screenshot(path=str(OUT/f'performance-{width}.png'))
        print({k:v for k,v in record.items() if k!='error'},flush=True)
        results.append(record);context.close()
    browser.close()
(OUT/'performance.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
assert all(r['state']=='measured' and r['preview_state']=='done' for r in results[:2])
assert results[2]['state']=='error' and '8' in results[2]['error']
