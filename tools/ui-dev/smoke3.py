import sys,os,json,time
from playwright.sync_api import sync_playwright
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4521')
OUT=r'C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad\p5\studio-ui\shots'
FONT=sys.argv[1] if len(sys.argv)>1 else r'C:\Users\2009s\nerulio-asset-corpus\fonts\galmuri\Galmuri11.ttf'
L10N=r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-ui\l10n\mindustry\bundle_ko.properties'
modes=(sys.argv[2] if len(sys.argv)>2 else 'mono,msdf').split(',')
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);pg=ctx.new_page()
    errs=[]
    pg.on('console',lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERROR '+str(e)))
    pg.goto(BASE+'/ko/game/studio/?ws=ui&uimode=font')
    pg.wait_for_selector('html[data-studio-started="1"]',state='attached',timeout=20000)
    inp='input[type=file][multiple]'
    pg.set_input_files(inp,[FONT]);pg.wait_for_selector('[data-font="result"]',timeout=60000)
    pg.set_input_files(inp,[L10N]);time.sleep(1)
    def wait_result(tag):
        t=time.time();pg.wait_for_function('()=>!document.querySelector(\'[data-font="busy"]\')&&document.querySelector(\'[data-font="result"]\')',timeout=180000);time.sleep(.5)
        return time.time()-t
    wait_result('l10n')
    print('charset',pg.locator('[data-font="charset-stats"]').inner_text())
    ps=pg.locator('[data-font="pixel-grid"]')
    if ps.count(): print('pixel grid:',ps.inner_text().replace('\n',' | '))
    for m in modes:
        if m=='mono' and pg.locator('[data-action="use-pixel-size"]').count() and pg.locator('[data-action="use-pixel-size"]').is_enabled():
            pg.click('[data-action="use-pixel-size"]')
        else:
            pg.select_option('select[data-font="mode"]',m)
        time.sleep(.4);dt=wait_result(m)
        print(m,'%.1fs'%dt,pg.locator('[data-font="result"]').inner_text())
        pg.screenshot(path=f'{OUT}\\ko-{m}-1440.png')
        with pg.expect_download(timeout=120000) as d: pg.click('[data-font="export"]')
        path=OUT+f'\\ko-{m}.zip';d.value.save_as(path);print('zip',path)
    print(json.dumps(errs[:10],indent=1,ensure_ascii=False))
    b.close()
