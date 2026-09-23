import sys,os,json,time
from playwright.sync_api import sync_playwright
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4521')
OUT=r'C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad\p5\studio-ui'
FIX=r'C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a8be6c03441cb4b55\tests\fixtures\ui'
w,hh=(int(sys.argv[1]),int(sys.argv[2])) if len(sys.argv)>2 else (1440,900)
tag=sys.argv[3] if len(sys.argv)>3 else 'smoke'
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={'width':w,'height':hh})
    errs=[]
    pg.on('console',lambda m: errs.append(m.type+': '+m.text) if m.type in('error','warning') else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERROR '+str(e)))
    pg.goto(BASE+'/en/game/studio/?ws=ui')
    pg.wait_for_selector('html[data-studio-started="1"]',state='attached',timeout=20000)
    pg.set_input_files('input[type=file][multiple]',[FIX+r'\kenney\blue_button_rectangle_depth_flat.png'])
    time.sleep(1.5)
    pg.screenshot(path=f'{OUT}\\{tag}-nine-{w}.png')
    # apply suggestion
    btn=pg.locator('[data-action="apply-suggestion"]')
    if btn.count(): btn.first.click(); time.sleep(.8)
    pg.screenshot(path=f'{OUT}\\{tag}-nine-applied-{w}.png')
    print(json.dumps(errs[:20],indent=1))
    b.close()
