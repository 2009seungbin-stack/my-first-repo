import sys,os,json,time
from playwright.sync_api import sync_playwright
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4521')
OUT=r'C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad\p5\studio-ui\shots'
os.makedirs(OUT,exist_ok=True)
FIX=r'C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55\tests\fixtures\ui'
w,hh=(int(sys.argv[1]),int(sys.argv[2])) if len(sys.argv)>2 else (1440,900)
tag=sys.argv[3] if len(sys.argv)>3 else 'm'
steps=sys.argv[4].split(',') if len(sys.argv)>4 else ['states','atlas','font']
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':w,'height':hh})
    errs=[]
    pg.on('console',lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERROR '+str(e)))
    pg.goto(BASE+'/en/game/studio/?ws=ui')
    pg.wait_for_selector('html[data-studio-started="1"]',state='attached',timeout=20000)
    inp='input[type=file][multiple]'
    pg.set_input_files(inp,[FIX+r'\kenney\buttonLong_blue.png',FIX+r'\kenney\buttonLong_blue_pressed.png'])
    time.sleep(1.5)
    if 'states' in steps:
        pg.click('[data-ui-mode="states"]');time.sleep(.5)
        sug=pg.locator('[data-action="suggested-button"]')
        print('suggested buttons',sug.count())
        if sug.count(): sug.first.click()
        time.sleep(1.2)
        pg.screenshot(path=f'{OUT}\\{tag}-states-{w}.png')
    if 'atlas' in steps:
        pg.set_input_files(inp,[FIX+r'\kenney\uipack_rpg_sheet.png',FIX+r'\kenney\uipack_rpg_sheet.xml'])
        time.sleep(2)
        pg.click('[data-ui-mode="atlas"]');time.sleep(.8)
        pg.screenshot(path=f'{OUT}\\{tag}-atlas-{w}.png')
        print('elements',pg.evaluate('Object.keys(nerulioStudio.doc.settings.ui.elements).length'))
    if 'font' in steps:
        pg.set_input_files(inp,[FIX+r'\fonts\KenneyFuture.ttf'])
        time.sleep(2)
        pg.set_input_files(inp,[FIX+r'\l10n\po\pixelorama.ko_KR.po'])
        time.sleep(4)
        pg.screenshot(path=f'{OUT}\\{tag}-font-{w}.png')
        print('font status',pg.locator('[data-font="result"],[data-font="error"],[data-font="busy"]').all_inner_texts())
    print(json.dumps(errs[:20],indent=1))
    b.close()
