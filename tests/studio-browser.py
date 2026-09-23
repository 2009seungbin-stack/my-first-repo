"""Nerulio Studio (/game/studio/) end to end in Chromium with real Kenney CC0 game assets.

Covers: app shell (no site chrome, noindex, languages, 390 px), canvas zoom anchoring / pan / keys,
DPR-correct backing store, grid suggestion with confidence and explicit Apply, direct manipulation
of frames with merged undo, command palette and shortcut sheet, autosave + recovery after reload,
.nerulio save → open round trip (byte-exact images), hand-off from Sprite Lab, drop anywhere, and
pan/zoom frame times on a 4096² sheet with 2 000 overlay rects (reported, loosely bounded).

Runs inside tools/regression.py (port 4173). Standalone, against a server you own:
  PORT=4411 node tools/serve.mjs  then  TEST_URL=http://127.0.0.1:4411 python tests/studio-browser.py
Real assets: tests/fixtures/kenney (committed, CC0); the 4096² run also uses
$NERULIO_CORPUS/_adhoc/nerulio-studio-shell/derived/roguelike_tiled_4096.png when present."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import hashlib,io,json,os,sys,tempfile,time,zipfile
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
FIX=ROOT/'tests'/'fixtures'/'kenney'
DUNGEON=FIX/'tiny-dungeon-tilemap.png'          # 203×186, 16 px cells, 1 px gaps, 12×11
CHARS=FIX/'pixel-platformer-characters.png'     # 224×74, 24 px cells, 1 px gaps, 9×3
CORPUS=Path(os.environ.get('NERULIO_CORPUS',r'C:\Users\2009s\nerulio-asset-corpus'))/'_adhoc'/'nerulio-studio-shell'
checks=[];errors=[];perf={}
def ok(name,cond,detail=''):
    if not cond:raise AssertionError(f'{name} {detail}')
    checks.append(name);print('PASS',name,flush=True)
def ready(p):p.wait_for_function('()=>document.documentElement.dataset.studioReady==="1"',timeout=20000)
def js(p,body,arg=None):return p.evaluate('(arg)=>{const S=window.nerulioStudio;'+body+'}',arg)
def settle(p,ms=120):p.wait_for_timeout(ms)
def client(p,ix,iy):
    """CSS page coordinates of image point (ix, iy)."""
    return js(p,'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+arg[0]*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+arg[1]*v.view.scale)*r.height/v.H};',[ix,iy])
def framing(p):
    """Image rect vs canvas viewport in CSS px: {inside, centred, visible_w, visible_h}."""
    return js(p,'''const v=S.view,r=v.stage.getBoundingClientRect(),k=r.width/v.W,im=v.image;
      const x0=r.left+v.view.x*k,y0=r.top+v.view.y*k,x1=x0+im.w*v.view.scale*k,y1=y0+im.h*v.view.scale*k;
      const tol=v.view.scale*k+1;
      return {inside:x0>=r.left-0.5&&y0>=r.top-0.5&&x1<=r.right+0.5&&y1<=r.bottom+0.5,
        centred:Math.abs((x0-r.left)-(r.right-x1))<=tol&&Math.abs((y0-r.top)-(r.bottom-y1))<=tol,
        visible_w:Math.max(0,Math.min(x1,r.right)-Math.max(x0,r.left)),visible_h:Math.max(0,Math.min(y1,r.bottom)-Math.max(y0,r.top)),
        scale:v.view.scale};''')
def fitted(p):f=framing(p);return f['inside'] and f['centred']
def image_at(p,cx,cy):return js(p,'const q=S.view.toImage(arg[0],arg[1]);return {x:q.x,y:q.y};',[cx,cy])
def autosaved(p,since):
    p.wait_for_function('(t)=>{const a=window.nerulioStudio.autosave;return !a.pending&&!a.saving&&a.lastAt>t}',arg=since,timeout=15000)
def doc(p):return js(p,'return JSON.parse(JSON.stringify(S.doc));')
def frames(p):return js(p,'const a=S.doc.assets.find(x=>x.id===S.activeAssetId);return a?a.frames.map(f=>f.sourceRect):[];')
def hist(p):return js(p,'return {n:S.history.entries.length,i:S.history.index};')
def fresh_context(browser,**kw):
    ctx=browser.new_context(viewport=kw.pop('viewport',{'width':1440,'height':900}),device_scale_factor=kw.pop('dsf',1),accept_downloads=True,**kw)
    return ctx
def watch(p,label):
    p.on('pageerror',lambda e:errors.append(f'{label}: {e}'))
    p.on('console',lambda m:m.type=='error' and errors.append(f'{label}: {m.text[:200]}'))
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    ctx=fresh_context(browser);p=ctx.new_page();watch(p,'desktop')
    requests=[];p.on('request',lambda r:requests.append(r.url))
    dialogs=[];p.on('dialog',lambda d:(dialogs.append(d.type),d.accept()))
    # ------------------------------------------------------------ shell
    p.goto(BASE+'/ko/game/studio/');ready(p)
    html=p.content()
    ok('studio is noindex and has no site header, footer, SEO copy or ads','noindex' in p.locator('meta[name=robots]').get_attribute('content') and p.locator('.page-header,#siteContent,footer.site-footer,.adsbygoogle').count()==0)
    ok('korean prefix gives a Korean app shell',p.locator('html').get_attribute('lang')=='ko' and p.locator('.st-menu-trigger').first.inner_text()=='파일')
    ok('full viewport: nothing scrolls',js(p,'return document.scrollingElement.scrollHeight<=innerHeight+1&&document.scrollingElement.scrollWidth<=innerWidth+1;'))
    ok('menu bar, tool bar, canvas, right panels, bottom panel and status bar exist',all(p.locator(s).count()==1 for s in ['.st-menubar','.st-toolbar','.cv-stage','.st-dock-right','.st-dock-bottom','.st-status']))
    coming=p.locator('.st-ws-tab[aria-disabled="true"]').all()
    ok('workspace switcher: Viewer and Sprite ready; every workspace not built yet is listed as coming (disabled, with its phase)',
       p.locator('.st-ws-tab[aria-selected="true"]').get_attribute('data-ws')=='viewer' and p.locator('.st-ws-tab[data-ws="sprite"][aria-disabled]').count()==0
       and all(x.locator('small').inner_text().startswith('P') for x in coming) and p.locator('.st-ws-tab').count()==len(coming)+p.locator('.st-ws-tab:not([aria-disabled])').count())
    if coming:
        coming[0].click(force=True);settle(p)
        ok('a coming workspace cannot be entered (no fake UI)',js(p,'return S.workspace;')=='viewer')
    else:print('SKIP coming workspace check: every workspace is ready')
    p.goto(BASE+'/ja/game/studio/');ready(p)
    ok('japanese prefix gives a Japanese shell',p.locator('.st-menu-trigger').first.inner_text()=='ファイル' and p.locator('html').get_attribute('lang')=='ja')
    p.goto(BASE+'/en/game/studio/');ready(p)
    # ------------------------------------------------------------ import real assets
    p.set_input_files('input[type=file][multiple]',[str(DUNGEON),str(CHARS)])
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===2',timeout=15000)
    p.wait_for_function('()=>!!window.nerulioStudio.view.image')
    ok('two real Kenney sheets imported as assets',[ (a['name'],a['width'],a['height']) for a in doc(p)['assets']]==[('tiny-dungeon-tilemap.png',203,186),('pixel-platformer-characters.png',224,74)])
    ok('assets panel lists both',p.locator('.st-asset').count()==2)
    settle(p,150);ok('1440: after import the image is fitted, centred and fully inside the canvas',fitted(p),str(framing(p)))
    js(p,'S.view.zoomTo(8);S.view.panBy(400,0);')
    p.locator('.st-asset').nth(1).click();p.wait_for_function('()=>window.nerulioStudio.view.image&&window.nerulioStudio.view.image.w===224');settle(p,100)
    ok('1440: switching image fits and centres it again',fitted(p),str(framing(p)))
    p.locator('.st-asset').nth(0).click();p.wait_for_function('()=>window.nerulioStudio.view.image&&window.nerulioStudio.view.image.w===203')
    settle(p,100);ok('1440: switching back fits the first image too',fitted(p),str(framing(p)))
    ren=js(p,'return S.view.rendererKind;');perf['renderer_default']=ren
    ok('image renderer is WebGL2 (Canvas2D only as fallback)',ren=='webgl2',ren)
    v=js(p,'return S.view.view;')
    ok('fit zoom is an integer (never 2.7×)',v['scale'] in (1,2,3,4,5,6,8,10,12,16) and v['scale']==int(v['scale']),str(v))
    ok('status bar shows the zoom and image size',p.locator('.st-slot-zoom').inner_text()==f"{int(v['scale']*100)}%" and '203×186' in p.locator('.st-slot-image').inner_text())
    # ------------------------------------------------------------ zoom anchored at the cursor
    cx,cy=client(p,100.5,90.5)['x'],client(p,100.5,90.5)['y']
    p.mouse.move(cx,cy);before=image_at(p,cx,cy)
    p.mouse.wheel(0,-100);settle(p,80)
    after=image_at(p,cx,cy);v2=js(p,'return S.view.view;')
    ok('wheel zooms one integer step at the cursor',v2['scale']>v['scale'] and v2['scale']==int(v2['scale']))
    ok('the image point under the cursor stays put (< 1 image px)',abs(after['x']-before['x'])<1 and abs(after['y']-before['y'])<1,f'{before} {after}')
    p.keyboard.down('Control');p.mouse.wheel(0,-100);p.keyboard.up('Control');settle(p,80)
    ok('Ctrl+wheel zooms the canvas, not the page',js(p,'return S.view.view.scale;')>v2['scale'] and js(p,'return (visualViewport?.scale||1)===1&&document.scrollingElement.scrollTop===0;'))
    p.keyboard.press('1');settle(p,60)
    ok('1 = 100%',js(p,'return S.view.view.scale;')==1 and p.locator('.st-slot-zoom').inner_text()=='100%')
    p.keyboard.press('4');settle(p,60);ok('4 = 800% (Aseprite number keys)',js(p,'return S.view.view.scale;')==8)
    ok('pixel grid shows at high zoom',js(p,'return S.view.options.pixelGrid;') and js(p,'return S.view.view.scale;')>=8)
    p.keyboard.press('-');settle(p,60);ok('- zooms out one level',js(p,'return S.view.view.scale;')==6)
    p.keyboard.press('+');settle(p,60);ok('+ zooms in one level',js(p,'return S.view.view.scale;')==8)
    p.keyboard.press('0');settle(p,60);ok('0 = fit',js(p,'return S.view.view;')==v)
    # ------------------------------------------------------------ pan: Space+drag, middle drag, trackpad scroll
    p.keyboard.press('2');settle(p,60);v0=js(p,'return S.view.view;')
    st=p.locator('.cv-stage').bounding_box();mx,my=st['x']+st['width']/2,st['y']+st['height']/2
    p.mouse.move(mx,my);p.keyboard.down('Space');p.mouse.down();p.mouse.move(mx+60,my+35,steps=6);p.mouse.up();p.keyboard.up('Space');settle(p,60)
    v1=js(p,'return S.view.view;')
    ok('Space+drag pans by exactly the drag distance',(v1['x']-v0['x'],v1['y']-v0['y'])==(60,35),str((v0,v1)))
    ok('Space did not scroll anything',js(p,'return document.scrollingElement.scrollTop===0&&document.querySelector(".st-body").scrollTop===0;'))
    p.mouse.move(mx,my);p.mouse.down(button='middle');p.mouse.move(mx-40,my-10,steps=4);p.mouse.up(button='middle');settle(p,60)
    v2=js(p,'return S.view.view;');ok('middle-button drag pans',(v2['x']-v1['x'],v2['y']-v1['y'])==(-40,-10))
    p.mouse.wheel(12,7);settle(p,60);v3=js(p,'return S.view.view;')
    ok('two-axis trackpad scroll pans instead of zooming',v3['scale']==v2['scale'] and (v3['x'],v3['y'])==(v2['x']-12,v2['y']-7),str((v2,v3)))
    for dx,dy in [(-100000,-100000),(100000,100000),(-100000,100000)]:
        js(p,'S.view.panBy(arg[0],arg[1]);',[dx,dy]);f=framing(p)
        ok(f'pan is clamped: ≥ 64 px of the image stay visible after panning ({dx},{dy})',f['visible_w']>=63.5 and f['visible_h']>=63.5,str(f))
    p.locator('.st-hud-zoom').dblclick();settle(p,80)
    ok('double-clicking the zoom readout fits',fitted(p) and js(p,'return S.view.view;')==v)
    js(p,'S.view.zoomTo(4);');p.locator('.st-slot-zoom').dblclick();settle(p,80)
    ok('double-clicking the status-bar zoom fits',js(p,'return S.view.view;')==v)
    p.keyboard.press('2');settle(p,40)
    for k in ['PageDown','End','ArrowDown','Space']:p.keyboard.press(k)
    ok('keys never scroll the page',js(p,'return document.scrollingElement.scrollTop===0&&scrollY===0;'))
    # ------------------------------------------------------------ grid suggestion: confidence + explicit Apply
    p.keyboard.press('0');p.locator('.st-sug').first.wait_for(timeout=15000)
    top=p.locator('.st-sug').first.inner_text()
    ok('grid suggestion for Tiny Dungeon is 16×16 with 12×11 cells and a 1 px gap',top.startswith('16×16') and '12×11' in top and 'gap 1' in top,top)
    ok('the suggestion shows its confidence and score',p.locator('.st-sug').first.locator('.st-conf').count()==1 and '%' in p.locator('.st-sug .st-conf').first.inner_text())
    ok('the suggestion is only a preview: not applied, no frames',p.locator('.st-grid-state').get_attribute('data-state')=='preview' and len(frames(p))==0)
    p.locator('.st-why').first.locator('summary').click();ok('"Why?" lists the evidence',p.locator('.st-why').first.locator('li').count()>=4)
    confs=p.locator('.st-sug .st-conf').evaluate_all('ns=>ns.map(n=>n.className)')
    ok('only the top candidate carries a confidence level; the rest are marked as alternatives',len(confs)>=2 and 'is-alt' not in confs[0] and all('is-alt' in c for c in confs[1:]),str(confs))
    p.wait_for_function('()=>/132 with pixels/.test(document.querySelector(".st-grid-count")?.textContent||"")',timeout=10000)
    h0=hist(p)
    js(p,'S.view.zoomTo(8);S.view.panBy(-300,120);')
    p.locator('[data-action="grid-apply"]').click();p.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===132')
    settle(p,100);ok('1440: after Apply the image is fitted, centred and fully inside the canvas',fitted(p),str(framing(p)))
    fr=frames(p)
    ok('Apply cuts 132 frames exactly on the 16 px + 1 px grid',fr[0]=={'x':0,'y':0,'w':16,'h':16} and fr[1]=={'x':17,'y':0,'w':16,'h':16} and fr[12]=={'x':0,'y':17,'w':16,'h':16} and fr[-1]=={'x':187,'y':170,'w':16,'h':16})
    ok('Apply is one undo step',hist(p)['n']==h0['n']+1)
    ok('grid panel now says applied',p.locator('.st-grid-state').get_attribute('data-state')=='applied')
    ok('frames strip shows them',p.locator('.st-chip').count()==132)
    # ------------------------------------------------------------ direct manipulation with merged undo
    p.keyboard.press('3');settle(p,80)  # 400%
    js(p,'S.view.reveal({x:17,y:17,w:16,h:16});')
    c=client(p,25,25);h1=hist(p)
    p.mouse.click(c['x'],c['y']);settle(p,60)
    sel=js(p,'return [...S.view.layers[0].selected];')
    ok('clicking a frame selects it',len(sel)==1 and js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])=={'x':17,'y':17,'w':16,'h':16})
    ok('status bar shows the selection size',p.locator('.st-slot-selection').inner_text().endswith('16×16'))
    p.mouse.move(c['x'],c['y']);p.mouse.down()
    for i in range(1,21):p.mouse.move(c['x']+i*2,c['y']+i,steps=1)  # 40 css px right, 20 down at 400% = 10, 5 px
    p.mouse.up();settle(p,80)
    moved=js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])
    ok('dragging moves the frame on whole pixels',moved=={'x':27,'y':22,'w':16,'h':16},str(moved))
    ok('a whole drag is ONE undo step',hist(p)['n']==h1['n']+1,str((h1,hist(p))))
    p.keyboard.press('Control+z');settle(p,60)
    ok('Ctrl+Z puts it back',js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])=={'x':17,'y':17,'w':16,'h':16})
    p.keyboard.press('Control+Shift+z');settle(p,60)
    ok('Ctrl+Shift+Z redoes',js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])==moved)
    p.keyboard.press('Control+z');p.keyboard.press('Control+y');settle(p,60)
    ok('Ctrl+Y also redoes',js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])==moved)
    se=client(p,moved['x']+16,moved['y']+16);p.mouse.move(se['x'],se['y']);settle(p,40)
    ok('hovering a corner handle shows a resize cursor',js(p,'return S.view.stage.style.cursor;')=='nwse-resize')
    p.mouse.down();p.mouse.move(se['x']+16,se['y']+8,steps=4);p.mouse.up();settle(p,60)
    ok('dragging the corner handle resizes on whole pixels',js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])=={'x':27,'y':22,'w':20,'h':18})
    h2=hist(p)
    for _ in range(3):p.keyboard.press('ArrowRight')
    p.keyboard.press('Shift+ArrowDown');settle(p,60)
    ok('arrow keys nudge 1 px, Shift+arrow 10 px',js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])=={'x':30,'y':32,'w':20,'h':18})
    ok('a burst of nudges merges into one undo step',hist(p)['n']==h2['n']+1)
    c=client(p,40,41);p.mouse.move(c['x'],c['y']);p.mouse.down();p.mouse.move(c['x']+80,c['y']+80,steps=4)
    ok('(drag in progress moves the frame live)',js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect.x;',sel[0])==50)
    p.keyboard.press('Escape');p.mouse.up();settle(p,60)
    ok('Escape during a drag restores the frame and leaves no undo step',js(p,'return S.doc.assets[0].frames.find(f=>f.id===arg).sourceRect;',sel[0])=={'x':30,'y':32,'w':20,'h':18} and hist(p)['n']==h2['n']+1)
    p.keyboard.press('Delete');settle(p,60);ok('Delete removes the selected frame',len(frames(p))==131)
    p.keyboard.press('Control+z');settle(p,60);ok('and undo restores it',len(frames(p))==132)
    # frame tool: draw a new frame on the second sheet (no frames yet)
    p.locator('.st-asset').nth(1).click();p.wait_for_function('()=>window.nerulioStudio.view.image?.w===224')
    p.locator('.cv-stage').focus();p.keyboard.press('m');p.keyboard.press('4');js(p,'S.view.reveal({x:0,y:0,w:30,h:30});');settle(p,60)
    a=client(p,1.2,2.4);b=client(p,24.6,25.8)
    p.mouse.move(a['x'],a['y']);p.mouse.down();p.mouse.move(b['x'],b['y'],steps=5);p.mouse.up();settle(p,60)
    ok('Frame tool (M) draws a new frame snapped to pixels',frames(p)==[{'x':1,'y':2,'w':24,'h':24}],str(frames(p)))
    p.keyboard.press('Control+z');settle(p,60);ok('drawing a frame is undoable',frames(p)==[])
    p.locator('.st-asset').nth(0).click();p.wait_for_function('()=>window.nerulioStudio.view.image?.w===203');p.locator('.cv-stage').focus()
    p.keyboard.press('Control+a')
    ok('Ctrl+A selects all frames',len(js(p,'return [...S.view.layers[0].selected];'))==132)
    p.keyboard.press('Escape');ok('Escape deselects',len(js(p,'return [...S.view.layers[0].selected];'))==0)
    p.keyboard.press('v')
    ok('V and M switch tools (Aseprite keys)',js(p,'return S.tool;')=='select')
    # ------------------------------------------------------------ inputs swallow keys
    p.locator('.st-sug').first.click();w=p.locator('input[data-grid="w"]');w.click();w.fill('');z=js(p,'return S.view.view.scale;')
    p.keyboard.type('20');p.keyboard.press('0');p.keyboard.press('Space')
    ok('typing in a field never fires shortcuts (1–6, 0, Space)',js(p,'return S.view.view.scale;')==z and w.input_value()=='200')
    w.fill('16');w.press('Enter');p.locator('.cv-stage').focus()
    # ------------------------------------------------------------ palette and shortcut sheet
    p.keyboard.press('Control+k');p.locator('.st-palette-input').wait_for()
    p.keyboard.type('fit on');p.keyboard.press('Enter');settle(p,120)
    ok('Ctrl+K palette finds and runs a command',p.locator('dialog[open]').count()==0 and js(p,'return S.view.view;')==v)
    p.keyboard.press('Shift+Slash');p.locator('.st-keysheet').wait_for()
    sheet=p.locator('.st-keysheet').inner_text()
    ok('? opens the shortcut sheet with undo/redo and pointer gestures','Ctrl+Z' in sheet and 'Ctrl+Shift+Z' in sheet and 'Space + drag' in sheet)
    p.keyboard.press('Escape');settle(p,60)
    p.keyboard.press('F10');ok('F10 moves focus into the menu bar',js(p,'return document.activeElement?.classList.contains("st-menu-trigger");'))
    p.keyboard.press('ArrowDown');ok('ArrowDown opens the menu',p.locator('.st-menu').count()==1)
    p.keyboard.press('Escape');ok('Escape closes it',p.locator('.st-menu').count()==0)
    # ------------------------------------------------------------ autosave + recovery
    t0=js(p,'return Date.now();')
    js(p,'S.view.zoomTo(3);S.view.panBy(-37,11);')
    autosaved(p,t0)
    snap=doc(p);active=js(p,'return S.activeAssetId;');vsave=js(p,'return S.view.view;')
    ok('save state reports the autosave',p.locator('.st-save-state').inner_text().startswith('Autosaved'))
    p.reload();ready(p)
    ok('leaving with changes not saved to a file asks first (beforeunload)','beforeunload' in dialogs)
    p.locator('.st-recover').wait_for(timeout=10000)
    ok('reopening offers to restore the last session',p.locator('.st-recover').inner_text().count('2 image')==1 and '132 frames' in p.locator('.st-recover').inner_text())
    p.locator('.st-recover .primary').click();p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===2')
    p.wait_for_function('()=>!!window.nerulioStudio.view.image')
    ok('recovered document is exactly the one autosaved',doc(p)==snap)
    ok('recovered active image and view are the same',js(p,'return S.activeAssetId;')==active and js(p,'return S.view.view;')==vsave,str((vsave,js(p,'return S.view.view;'))))
    ok('images were restored from IndexedDB, not re-imported',js(p,'return S.images.usage().count;')==2)
    # ------------------------------------------------------------ save .nerulio → open, exact round trip
    with p.expect_download() as d:p.keyboard.press('Control+s')
    path=d.value.path();z=zipfile.ZipFile(path)
    names=sorted(z.namelist())
    ok('.nerulio is a zip with project.json and one PNG per image',names[-1]=='project.json' and len([n for n in names if n.startswith('images/')])==2)
    manifest=json.loads(z.read('project.json'))
    ok('project.json holds exactly the live document',manifest['format']=='nerulio-project-file' and manifest['project']==doc(p))
    for n in names:
        if n.startswith('images/'):
            data=z.read(n);ok(f'{n[:19]}… is named by its SHA-256',hashlib.sha256(data).hexdigest()==n[7:-4])
    dungeon_hash=hashlib.sha256(DUNGEON.read_bytes()).hexdigest()
    ok('imported PNG bytes are kept byte for byte',f'images/{dungeon_hash}.png' in names)
    ok('after saving, the state says saved',p.locator('.st-save-state').inner_text()=='Saved to file')
    saved_doc=doc(p)
    js(p,'S.runCommand("file.new");');p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===0')
    p.set_input_files('input[type=file]:not([multiple])',path)
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===2',timeout=15000)
    ok('opening the .nerulio restores the identical document',doc(p)==saved_doc)
    with p.expect_download() as d2:js(p,'S.runCommand("file.save");')
    ok('saving it again gives the same project and images',json.loads(zipfile.ZipFile(d2.value.path()).read('project.json'))['project']==saved_doc and sorted(zipfile.ZipFile(d2.value.path()).namelist())==names)
    # ------------------------------------------------------------ drop anywhere, other formats
    extra=[]
    for f,mime in [(CORPUS/'derived'/'tiny-dungeon-sample.jpg','image/jpeg'),(CORPUS/'derived'/'pixel-platformer-tiles.webp','image/webp'),(CORPUS/'derived'/'pixel-platformer-walk.gif','image/gif')]:
        if f.exists():extra.append({'name':f.name,'type':mime,'b64':__import__('base64').b64encode(f.read_bytes()).decode()})
    if not extra:  # corpus absent: make the other formats from the committed fixture
        for fmt,mime,ext in [('JPEG','image/jpeg','jpg'),('WEBP','image/webp','webp'),('GIF','image/gif','gif')]:
            b=io.BytesIO();Image.open(CHARS).convert('RGB' if fmt=='JPEG' else 'RGBA').save(b,fmt);extra.append({'name':'chars.'+ext,'type':mime,'b64':__import__('base64').b64encode(b.getvalue()).decode()})
    p.evaluate('''async files=>{const dt=new DataTransfer();for(const f of files)dt.items.add(new File([Uint8Array.from(atob(f.b64),c=>c.charCodeAt(0))],f.name,{type:f.type}));
      document.querySelector('.st-status').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}''',extra)
    p.wait_for_function('(n)=>window.nerulioStudio.doc.assets.length===2+n',arg=len(extra),timeout=15000)
    dims=[(a['name'],a['width'],a['height']) for a in doc(p)['assets'][2:]]
    ok('dropping JPG/WebP/GIF anywhere imports them (GIF: first frame)',all(w>0 for _,w,_ in dims) and len(dims)==len(extra),str(dims))
    ok('no file bytes left the browser',all(u.startswith(BASE) or u.startswith('blob:') or u.startswith('data:') for u in requests),str([u for u in requests if not u.startswith(BASE)][:3]))
    ctx.close()
    # ------------------------------------------------------------ hand-off from Sprite Lab
    ctx=fresh_context(browser);p=ctx.new_page();watch(p,'handoff');p.on('dialog',lambda d:d.accept())
    p.goto(BASE+'/en/game/sprite-lab/');p.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"')
    p.set_input_files('#fileInput',str(CHARS))
    p.locator('[data-action="lab-studio"]').wait_for(timeout=20000)
    p.wait_for_function('()=>document.querySelectorAll(".frame-chip:not(.is-more)").length>0',timeout=20000)
    lab_frames=p.evaluate('()=>document.querySelectorAll(".frame-chip:not(.is-more)").length')
    p.locator('[data-action="lab-studio"]').click();p.wait_for_url('**/en/game/studio/',timeout=15000);ready(p)
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===1&&window.nerulioStudio.doc.assets[0].frames.length>0',timeout=15000)
    d=doc(p)['assets'][0]
    ok('Sprite Lab → Open in Studio carries the sheet in memory',d['name']=='pixel-platformer-characters.png' and (d['width'],d['height'])==(224,74))
    ok('…and the frames Sprite Lab had cut',len(d['frames'])==lab_frames,f'{len(d["frames"])} vs {lab_frames}')
    ok('the hand-off is one undoable step',js(p,'return S.history.entries.map(e=>e.label);')[-1].endswith('frames from Sprite Lab'))
    ctx.close()
    # ------------------------------------------------------------ device pixel ratio 2
    ctx=fresh_context(browser,dsf=2);p=ctx.new_page();watch(p,'dpr2')
    p.goto(BASE+'/en/game/studio/');ready(p)
    if p.locator('.st-recover').count():p.locator('.st-recover button[data-value="new"]').click()
    p.set_input_files('input[type=file][multiple]',str(CHARS));p.wait_for_function('()=>!!window.nerulioStudio.view.image')
    box=p.locator('.cv-stage').bounding_box()
    dims=js(p,'const c=document.querySelector(".cv-image");return [c.width,c.height];')
    ok('canvas backing store is in device pixels at DPR 2',abs(dims[0]-round(box['width']*2))<=1 and abs(dims[1]-round(box['height']*2))<=1,str((dims,box)))
    p.keyboard.press('1');settle(p,60)
    ok('100% at DPR 2 = one image pixel per device pixel (crisp)',js(p,'return S.view.view.scale;')==1)
    p.keyboard.press('2');settle(p,60)
    px=p.evaluate('''()=>{const S=window.nerulioStudio,v=S.view,c=document.createElement('canvas');return v.view.x===Math.round(v.view.x)&&v.view.y===Math.round(v.view.y);}''')
    ok('view origin is on a whole device pixel',px)
    ctx.close()
    # ------------------------------------------------------------ 390 px phone layout
    ctx=fresh_context(browser,viewport={'width':390,'height':844},dsf=3,is_mobile=True,has_touch=True);p=ctx.new_page();watch(p,'mobile')
    p.goto(BASE+'/ko/game/studio/');ready(p)
    if p.locator('.st-recover').count():p.locator('.st-recover button[data-value="new"]').click()
    p.set_input_files('input[type=file][multiple]',str(DUNGEON));p.wait_for_function('()=>!!window.nerulioStudio.view.image')
    settle(p,200);ok('390 px: after import the image is fitted, centred and fully inside the canvas',fitted(p),str(framing(p)))
    ok('390 px: compact layout, no horizontal overflow',js(p,'return document.querySelector(".studio").dataset.mode;')=='compact' and js(p,'return document.scrollingElement.scrollWidth<=innerWidth;'))
    ok('390 px: tools stay on screen as a bottom bar',all(0<=b['y']<=844-22 for b in [p.locator('.st-tool').nth(i).bounding_box() for i in range(p.locator('.st-tool').count())]))
    p.locator('.st-top .st-compact-only').last.tap();settle(p,300)
    ok('390 px: panels open as a bottom sheet with tabs',p.locator('.st-sheet.is-open .st-tab').count()>=4)
    p.locator('.st-sheet .st-tab',has_text='그리드').tap();p.locator('.st-sheet .st-sug').first.wait_for(timeout=15000)
    ok('390 px: grid suggestion usable in the sheet',p.locator('.st-sheet [data-action="grid-apply"]').is_visible())
    js(p,'S.view.zoomTo(24);S.view.panBy(500,-300);')
    p.locator('.st-sheet [data-action="grid-apply"]').tap();p.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===132')
    p.locator('.st-sheet-grip').tap();settle(p,300)
    ok('390 px: after Apply the image is fitted, centred and fully inside the canvas',fitted(p),str(framing(p)))
    tb=p.locator('.st-toast').bounding_box();bar=p.locator('.st-toolbar').bounding_box();hudb=p.locator('.st-hud').bounding_box()
    ok('390 px: toast sits above the tool bar and the zoom HUD, not over the top of the canvas',tb is not None and tb['y']+tb['height']<=hudb['y']+1 and tb['y']>844/2,str((tb,bar,hudb)))
    p.wait_for_timeout(2600);ok('390 px: toast dismisses itself',not p.locator('.st-toast').is_visible())
    p.locator('.st-top .st-hamburger').tap();ok('390 px: menus through ☰',p.locator('.st-menu').count()==1 and '파일' in p.locator('.st-menu').inner_text())
    p.keyboard.press('Escape')
    ctx.close()
    # ------------------------------------------------------------ performance: 4096² sheet + 2 000 overlay rects
    big=CORPUS/'derived'/'roguelike_tiled_4096.png'
    if not big.exists():
        big=Path(tempfile.gettempdir())/'studio_tiled_4096.png';src=Image.open(DUNGEON).convert('RGBA');im=Image.new('RGBA',(4096,4096))
        for y in range(0,4096,src.height):
            for x in range(0,4096,src.width):im.paste(src,(x,y))
        im.save(big)
    perf['sheet']=big.name
    for renderer in ['auto','2d']:
        ctx=fresh_context(browser);p=ctx.new_page();watch(p,'perf-'+renderer)
        p.goto(BASE+'/en/game/studio/'+('?renderer=2d' if renderer=='2d' else ''));ready(p)
        if p.locator('.st-recover').count():p.locator('.st-recover button[data-value="new"]').click()
        t=time.time();p.set_input_files('input[type=file][multiple]',str(big));p.wait_for_function('()=>window.nerulioStudio.view.image?.w===4096',timeout=60000)
        load_ms=(time.time()-t)*1000
        p.evaluate('''async()=>{const P=await import('/src/studio/core/project.js'),S=window.nerulioStudio,id=S.activeAssetId,rects=[];
          for(let i=0;i<2000;i++)rects.push({x:(i%64)*64,y:Math.floor(i/64)*64,w:64,h:64});
          S.history.execute({label:'perf',apply:d=>P.setFrames(d,id,P.framesFromCells(P.assetById(d,id),rects))});}''')
        settle(p,300)
        res={'renderer':js(p,'return S.view.rendererKind;'),'import_ms':round(load_ms)}
        js(p,'S.view.fit();');res['fit_pan']=p.evaluate('()=>window.nerulioStudio.view.benchmark({frames:120,mode:"pan"})')
        res['fit_zoom']=p.evaluate('()=>window.nerulioStudio.view.benchmark({frames:60,mode:"zoom"})')
        js(p,'S.view.zoomTo(1);');res['z100_pan']=p.evaluate('()=>window.nerulioStudio.view.benchmark({frames:120,mode:"pan"})')
        js(p,'S.view.zoomTo(8);');res['z800_pan']=p.evaluate('()=>window.nerulioStudio.view.benchmark({frames:120,mode:"pan"})')
        perf[renderer]=res
        worst=max(res[k]['render']['p95'] for k in ['fit_pan','fit_zoom','z100_pan','z800_pan'])
        ok(f'4096² sheet + 2 000 rects: render p95 {worst:.1f} ms ({res["renderer"]}) stays under 100 ms',worst<100,json.dumps(res))
        ctx.close()
    browser.close()
(OUT/'studio-browser-results.json').write_text(json.dumps({'checks':checks,'errors':errors,'perf':perf},indent=1),encoding='utf-8')
print(json.dumps(perf,indent=1))
if errors:
    print('PAGE ERRORS:','\n'.join(errors));sys.exit(1)
print(f'STUDIO BROWSER PASSED {len(checks)} checks')
