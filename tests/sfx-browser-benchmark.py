"""Observed local SFX UI timing sample. TEST_URL=... python tests/sfx-browser-benchmark.py"""
import os
import statistics
import time
from playwright.sync_api import sync_playwright, expect

base=os.environ.get('TEST_URL','http://127.0.0.1:4706').rstrip('/')
with sync_playwright() as p:
    for engine in ('chromium','firefox'):
        browser=getattr(p,engine).launch(headless=True)
        for width in (1440,390):
            runs=[]
            for _ in range(3):
                page=browser.new_page(viewport={'width':width,'height':844})
                start=time.perf_counter()
                page.goto(base+'/en/game/sfx-generator/',wait_until='domcontentloaded')
                expect(page.locator('#metrics')).to_contain_text('Duration')
                first=(time.perf_counter()-start)*1000
                page.locator('[data-preset="explosion"]').click()
                expect(page.locator('#metrics')).to_contain_text('Duration')
                with page.expect_download(timeout=30000) as item:page.locator('#saveAudio').click()
                item.value.delete()
                total=(time.perf_counter()-start)*1000
                runs.append((first,total))
                page.close()
            print(f'{engine} {width}px first-render median={statistics.median(x[0] for x in runs):.1f}ms; page+export median={statistics.median(x[1] for x in runs):.1f}ms')
        browser.close()
