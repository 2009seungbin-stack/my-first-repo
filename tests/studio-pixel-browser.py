"""Studio Pixel workspace (P2) in Chromium, with real CC0 assets (tests/fixtures/pixel/).

New sprite → pencil stroke is ONE undo step (undo/redo exact) → pixel-perfect removes L corners →
Shift+click line → right button paints the background colour → bucket contiguous vs global →
symmetry → marquee: move, drop with Enter (one step), flip in place, copy/paste → layers: new,
multiply blend, merge down keeps the pixels, lock refuses paint → indexed conversion and palette
reorder keep the picture → Lospec asks first and makes no request before consent (fetch mocked,
no real network) → palette audit → cleanup on real upscales: Old Hero ×7 nearest and ×4.25
bilinear back to the exact 1× pixels, a model-generated image is not auto-snapped → Ninja run
frames: painting frame 3 stays in frame 3 → .aseprite export (layers, blend, indexed palette,
locked) checked in the real Aseprite CLI when present → .nerulio round trip → ko/ja → 390 px →
512×512 × 100 frames timing. Screenshots go to PIXEL_SHOTS.

    PORT=4501 node tools/serve.mjs  then  TEST_URL=http://127.0.0.1:4501 python tests/studio-pixel-browser.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, shutil, subprocess, sys, tempfile, time
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
SHOTS=Path(os.environ.get('PIXEL_SHOTS',ROOT/'test-results'/'studio-pixel'));SHOTS.mkdir(parents=True,exist_ok=True)
ASEPRITE=os.environ.get('ASEPRITE',r'C:\Users\2009s\asebuild\b\bin\aseprite.exe')
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
FIX=ROOT/'tests'/'fixtures'/'pixel'
TMP=Path(tempfile.mkdtemp(prefix='nerulio-pixel-'))
checks=[];errors=[];skipped=[];net=[]
def ok(name,cond,detail=''):
    if not cond:raise AssertionError(f'{name} {detail}')
    checks.append(name);print('PASS',name,flush=True)
def skip(name,why):skipped.append(name);print('SKIP',name,'—',why,flush=True)
def js(p,body,arg=None):return p.evaluate('async(arg)=>{const S=window.nerulioStudio,W=window.__pixel;'+body+'}',arg)
def ready(p):p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"',timeout=30000);p.wait_for_timeout(200)
def settle(p,ms=150):p.wait_for_timeout(ms)
def shot(p,name):p.screenshot(path=str(SHOTS/name))
def scr(p,ix,iy):return js(p,'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+(arg[0]+.5)*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+(arg[1]+.5)*v.view.scale)*r.height/v.H};',[ix,iy])
def drag(p,pts,button='left',mods=()):
    for m in mods:p.keyboard.down(m)
    a=scr(p,*pts[0]);p.mouse.move(a['x'],a['y']);p.mouse.down(button=button)
    for q in pts[1:]:
        b=scr(p,*q);p.mouse.move(b['x'],b['y'],steps=4)
    p.mouse.up(button=button)
    for m in mods:p.keyboard.up(m)
    js(p,'await W.commitChain();');settle(p,80)
def click(p,x,y,mods=()):drag(p,[(x,y)],mods=mods)
def hist(p):return js(p,'return S.history.entries.slice(0,S.history.index).map(e=>e.label);')
def px(p,x,y):return js(p,'await W.commitChain();return [...W.session.compose({x:arg[0],y:arg[1],w:1,h:1},{onion:false})];',[x,y])
def alpha(p,x,y):return px(p,x,y)[3]
def frame_rgba(p,i=0,asset=None):
    return js(p,'''const a=arg.asset?S.doc.assets.find(x=>x.name===arg.asset):W.asset(),{rgbaGetter}=await import("/src/studio/sprite/frame-render.js"),{composeFrame,composeCanvas}=await import("/src/studio/sprite/frame-image.js");
     await W.commitChain();const f=a.frames[arg.i],g=await rgbaGetter(S.images,a,f?[f]:[{id:"*"}]);const img=f?composeFrame(a,f,g):composeCanvas(a,{id:"*"},g);return {w:img.width,h:img.height,d:Array.from(img.data)};''',{'i':i,'asset':asset})
def fixture_rgba(p,name):
    return js(p,'''const r=await fetch("/tests/fixtures/pixel/"+arg).then(r=>r.blob()),bm=await createImageBitmap(r,{premultiplyAlpha:"none",colorSpaceConversion:"none"}),c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext("2d");x.drawImage(bm,0,0);return {w:bm.width,h:bm.height,d:Array.from(x.getImageData(0,0,bm.width,bm.height).data)};''',name)
def same_pixels(a,b):
    if a['w']!=b['w'] or a['h']!=b['h']:return -1
    bad=0
    for k in range(0,len(a['d']),4):
        x=a['d'][k:k+4];y=b['d'][k:k+4]
        if x[3]==0 and y[3]==0:continue
        if x!=y:bad+=1
    return bad
def new_sprite(p,w=32,h=32,mode='rgb'):
    js(p,"S.runCommand('pixel.newSprite')");p.wait_for_selector('dialog [data-px="new-w"]')
    p.fill('dialog [data-px="new-w"]',str(w));p.fill('dialog [data-px="new-h"]',str(h));p.select_option('dialog [data-px="new-mode"]',mode)
    p.click('dialog .st-btn.primary');settle(p,500)
def import_files(p,names):
    n=js(p,'return S.doc.assets.length;')
    p.set_input_files('input[type=file][multiple]',[str(FIX/x) for x in names])
    p.wait_for_function('n=>window.nerulioStudio.doc.assets.length>n',arg=n,timeout=20000);settle(p,600)
def wait_clean(p,states,timeout=90000):
    p.wait_for_function('s=>s.includes(document.querySelector("[data-px=cleanup]").dataset.state)',arg=states,timeout=timeout);settle(p,100)
def clean_option(p,sel,value):
    if p.locator('.px-clean-opts').get_attribute('open') is None:p.click('.px-clean-opts summary')
    p.select_option(sel,value);settle(p,50)
def zoom(p,z):js(p,'S.view.zoomTo(arg);S.view.reveal({x:0,y:0,w:W.session.rect.w,h:W.session.rect.h});',z);settle(p,150)

with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--ignore-gpu-blocklist'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:m.type=='error' and errors.append(m.text[:200]))
    p.on('request',lambda r:(not r.url.startswith(BASE) and not r.url.startswith('data:') and not r.url.startswith('blob:')) and net.append(r.url))
    # Lospec is mocked: no request ever leaves the machine in this test
    lospec_calls=[]
    def lospec_route(route):
        lospec_calls.append(route.request.url)
        if 'pico-8' in route.request.url:route.fulfill(status=200,headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/octet-stream'},body=json.dumps({'name':'PICO-8','author':'','colors':['000000','1D2B53','7E2553','008751','AB5236','5F574F','C2C3C7','FFF1E8','FF004D','FFA300','FFEC27','00E436','29ADFF','83769C','FF77A8','FFCCAA']}))
        else:route.fulfill(status=404,headers={'Access-Control-Allow-Origin':'*'},body='')
    ctx.route('https://lospec.com/**',lospec_route)
    p.goto(BASE+'/en/game/studio/?ws=pixel');ready(p)
    tools=['px-pencil','px-eraser','px-bucket','px-picker','px-line','px-rect','px-ellipse','px-marquee','px-lasso','px-wand','px-move']
    ok('?ws=pixel opens the Pixel workspace (no longer "coming"): 11 drawing/selection tools, Colour, Palette, Layers, Cleanup, Audit panels and the timeline',
       js(p,'return S.workspace;')=='pixel' and p.locator('.st-ws-tab[data-ws="pixel"]').get_attribute('aria-disabled') is None
       and all(p.locator(f'[data-tool="{t}"]').count()==1 for t in tools)
       and all(p.locator(f'[data-px="{x}"]').count()>=1 for x in ['color','palette','layers','cleanup','audit']) and p.locator('.sp-tl').count()==1)
    keys=js(p,"return ['tool.px-pencil','tool.px-eraser','tool.px-bucket','tool.px-picker','tool.px-line','tool.px-rect','tool.px-ellipse','tool.px-marquee','tool.px-lasso','tool.px-wand','tool.px-move','pixel.swapColors','pixel.mergeDown','pixel.newLayer','pixel.flipH','pixel.flipV','sprite.play','sprite.onion','sprite.newFrame','sprite.emptyFrame','sprite.deleteFrames'].map(id=>S.keymap.combos(id)[0]||'');")
    ok('Aseprite key map: B E G I L U Shift+U M Q W V, X swap, Ctrl+E merge down, Shift+N new layer, Shift+H/V flip, Enter play, F3 onion, Alt+N / Alt+Shift+N / Alt+C frames',
       keys==['B','E','G','I','L','U','Shift+U','M','Q','W','V','X','Mod+E','Shift+N','Shift+H','Shift+V','Enter','F3','Alt+N','Alt+Shift+N','Alt+C'],str(keys))
    p.keyboard.press('?');p.wait_for_selector('dialog');sheet=p.inner_text('dialog');p.keyboard.press('Escape');settle(p)
    ok('the ? shortcut sheet lists the Pixel commands under their own group',"Pixel" in sheet and 'Merge down' in sheet and 'Swap colours' in sheet)
    ok('the timeline of an empty workspace offers a new sprite',p.locator('[data-px="tl-newSprite"]').count()==1)
    # ------------------------------------------------------------ painting
    new_sprite(p,32,32)
    ok('New sprite: 32×32 RGB, one transparent layer, one frame, DB32 palette, pencil active',
       js(p,'const a=W.asset();return [a.width,a.height,a.layers.length,a.frames.length,a.palette.colors.length,S.tool];')==[32,32,1,1,32,'px-pencil'])
    zoom(p,12)
    h0=len(hist(p));drag(p,[(2,2),(10,2),(10,10)])
    ok('a pencil stroke is ONE undo step and paints the foreground colour',hist(p)[h0:]==['Pencil'] and px(p,5,2)==[0,0,0,255] and px(p,10,7)==[0,0,0,255] and alpha(p,4,4)==0)
    js(p,"S.runCommand('edit.undo')");settle(p,300);u=alpha(p,5,2)
    js(p,"S.runCommand('edit.redo')");settle(p,300)
    ok('undo removes the whole stroke; redo brings it back exactly',u==0 and px(p,5,2)==[0,0,0,255] and px(p,10,10)==[0,0,0,255])
    drag(p,[(2,14),(3,14),(3,15),(4,15),(4,16),(5,16)])
    ok('pixel-perfect (on by default) removes the L corners of a staircase',alpha(p,3,14)==0 and alpha(p,4,15)==0 and alpha(p,3,15)==255 and alpha(p,5,16)==255)
    a=scr(p,5,26);p.keyboard.down('Shift');p.mouse.click(a['x'],a['y']);p.keyboard.up('Shift');js(p,'await W.commitChain();');settle(p)
    ok('Shift+click draws a straight line from the last point (one step)',all(alpha(p,5,y)==255 for y in range(17,27)) and hist(p)[-1]=='Pencil')
    drag(p,[(14,4),(18,4)],button='right')
    ok('the right button paints the background colour (white)',px(p,16,4)==[255,255,255,255])
    js(p,"W.setColor('fg',[200,40,40,255])")
    p.keyboard.press('g');click(p,20,20)
    red=[200,40,40,255]
    ok('bucket (contiguous) fills the enclosed-free area around, not the pixels behind a closed stroke',px(p,20,20)==red and px(p,31,31)==red and px(p,5,2)==[0,0,0,255] and hist(p)[-1]=='Fill')
    js(p,"S.runCommand('edit.undo')");settle(p,200)
    # global fill: replace every black pixel
    js(p,"W.setPref('contiguous',false)");js(p,"W.setColor('fg',[40,90,200,255])");click(p,5,2)
    ok('bucket with Contiguous off recolours every pixel of that colour at once',px(p,5,2)==[40,90,200,255] and px(p,5,20)==[40,90,200,255] and px(p,10,10)==[40,90,200,255] and alpha(p,20,20)==0)
    js(p,"W.setPref('contiguous',true)")
    js(p,"W.setPref('symmetry',{mode:'x',axisX:null,axisY:null})");p.keyboard.press('b');js(p,"W.setColor('fg',[20,160,90,255])")
    drag(p,[(8,29),(11,29)])
    ok('vertical symmetry mirrors the stroke across the centre (x ↔ 31−x) in the same undo step',all(px(p,x,29)==[20,160,90,255] for x in [8,11,20,23]) and hist(p)[-1]=='Pencil')
    js(p,"W.setPref('symmetry',{mode:'none',axisX:null,axisY:null})")
    p.keyboard.press('u');js(p,"W.setPref('shapeFill',true)");js(p,"W.setColor('fg',[250,200,30,255])");drag(p,[(22,10),(27,15)])
    ok('rectangle tool (filled) draws the exact box',all(px(p,x,y)==[250,200,30,255] for x in (22,27) for y in (10,15)) and px(p,24,12)==[250,200,30,255] and alpha(p,28,12)==0)
    js(p,"W.setPref('shapeFill',false)")
    p.keyboard.press('i');click(p,24,12)
    ok('eyedropper takes the colour under the cursor',js(p,'return W.prefs.fg;')==[250,200,30,255])
    shot(p,'01-paint-1440.png')
    # ------------------------------------------------------------ selection
    p.keyboard.press('m');drag(p,[(21,9),(28,16)])
    ok('marquee makes a selection (status shows its size)',js(p,'return !!W.S.selection;') and '8×8' in p.inner_text('.st-slot-selection'))
    n0=len(hist(p));drag(p,[(24,12),(24,20)])
    ok('dragging inside the selection lifts the pixels and moves them (nothing committed while floating)',js(p,'return !!W.S.float;') and hist(p)[n0:]==[] and px(p,24,20)==[250,200,30,255] and alpha(p,24,11)==0)
    p.keyboard.press('Enter');settle(p,300)
    ok('Enter drops the floating pixels: ONE "Move pixels" step',hist(p)[n0:]==['Move pixels'] and not js(p,'return !!W.S.float;'))
    js(p,"S.runCommand('edit.undo')");settle(p,300)
    ok('undo puts the moved pixels back',px(p,24,12)==[250,200,30,255] and alpha(p,24,20)==0)
    p.keyboard.press('Control+d');n0=len(hist(p))
    drag(p,[(21,9),(30,16)]);p.keyboard.press('Shift+h');settle(p,300)
    ok('Shift+H flips the selection in place as one step (the selection stays)',hist(p)[n0:]==['Flip horizontal'] and js(p,'return !!W.S.selection&&!W.S.float;') and px(p,29,12)==[250,200,30,255] and alpha(p,22,12)==0)
    js(p,"S.runCommand('pixel.rotateCW')");settle(p,300)
    ok('rotate 90° is one step too',hist(p)[-1]=='Rotate 90° clockwise')
    p.keyboard.press('Control+c');settle(p,300);p.keyboard.press('Control+v');settle(p,500)
    ok('Ctrl+C / Ctrl+V: the copy pastes as floating pixels at its place and the Move tool is picked',js(p,'return !!W.S.float&&S.tool==="px-move";'))
    drag(p,[(24,12),(24,2)]);p.keyboard.press('Enter');settle(p,300)
    ok('dropping the pasted pixels is one "Paste" step',hist(p)[-1]=='Paste' and px(p,24,2)==[250,200,30,255])
    p.keyboard.press('Control+d')
    p.keyboard.press('w');click(p,0,0)
    ok('magic wand selects the connected transparent area',js(p,'const m=W.S.selection;return !!m&&m[0]===1&&m[2*32+5]===0&&m[31*32+31]===1;'))
    p.keyboard.press('Control+d')
    # ------------------------------------------------------------ layers
    p.keyboard.press('Shift+n');settle(p,300)
    ok('Shift+N adds a layer above and makes it current',js(p,'const a=W.asset();return a.layers.length===2&&a.layers[1].id===W.layerId();'))
    js(p,"W.setColor('fg',[100,150,200,255])");p.keyboard.press('u');js(p,"W.setPref('shapeFill',true)");drag(p,[(0,0),(12,12)]);js(p,"W.setPref('shapeFill',false)")
    p.select_option('[data-px="layer-blend"]','multiply');settle(p,300)
    want=px(p,5,2)
    ok('multiply blend composites like Aseprite (100,150,200 × 40,90,200)',want==[16,53,157,255] and hist(p)[-1]=='Layer blend mode',str(want))
    whole=frame_rgba(p)
    p.keyboard.press('Control+e');settle(p,800)
    ok('Ctrl+E merge down: one layer left, the frame looks exactly the same',js(p,'return W.asset().layers.length;')==1 and same_pixels(frame_rgba(p),whole)==0 and hist(p)[-1]=='Merge down')
    js(p,"S.runCommand('edit.undo')");settle(p,500)
    p.click('.px-layer.is-cur [data-px="lock"]');settle(p,300)
    p.keyboard.press('b');before=px(p,30,30);drag(p,[(29,30),(31,30)])
    ok('a locked layer refuses paint and says why',px(p,30,30)==before and 'locked' in p.inner_text('.st-toast'))
    p.click('.px-layer.is-cur [data-px="lock"]');settle(p,300)
    p.keyboard.press('Control+Alt+c');p.wait_for_selector('dialog.px-canvas');p.click('dialog .st-btn.primary');settle(p,600)
    ok('Ctrl+Alt+C Canvas size: +1 px on every side = 34×34 in one step, pixels move with it',js(p,'const a=W.asset();return [a.width,a.height];')==[34,34] and hist(p)[-1]=='Canvas size 34×34' and px(p,6,3)==[16,53,157,255])
    js(p,"S.runCommand('edit.undo')");settle(p,500)
    ok('undo restores the 32×32 canvas',js(p,'const a=W.asset();return [a.width,a.height];')==[32,32])
    shot(p,'02-layers-1440.png')
    # ------------------------------------------------------------ indexed colour
    new_sprite(p,32,16)
    zoom(p,12)
    for i,c in enumerate([[200,100,50,255],[20,160,90,255],[250,250,20,255]]):
        js(p,"W.setColor('fg',arg)",c);p.keyboard.press('u');js(p,"W.setPref('shapeFill',true)");drag(p,[(1+i*10,1),(8+i*10,12)])
    js(p,"W.setPref('shapeFill',false)");pic=frame_rgba(p)
    js(p,"S.runCommand('pixel.colorMode')");p.wait_for_selector('dialog [data-px="mode-palette"]')
    ok('Colour mode › Indexed offers the exact colours of the picture first',p.eval_on_selector('dialog [data-px="mode-palette"]','e=>e.value')=='exact')
    p.click('dialog .st-btn.primary');settle(p,900)
    ok('conversion to indexed is exact (transparent index 0 + 3 colours) and keeps every pixel',
       js(p,'const a=W.asset();return [a.colorMode,a.palette.colors.length,a.transparentIndex];')==['indexed',4,0] and same_pixels(frame_rgba(p),pic)==0)
    cel_png8=js(p,'''const a=W.asset(),{decodeIndexedPNG}=await import("/src/studio/pixel/png8.js"),r=S.images.get(a.cels[0].blob),d=decodeIndexedPNG(new Uint8Array(await r.blob.arrayBuffer()));return !!d&&d.colors.length===4;''')
    ok('cels of an indexed sprite are stored as indexed PNGs with the sprite palette',cel_png8)
    pal0=js(p,'return W.asset().palette.colors.map(c=>c.join());')
    s1=p.locator('.px-pal-sw[data-i="1"]').bounding_box();s3=p.locator('.px-pal-sw[data-i="3"]').bounding_box()
    p.mouse.move(s1['x']+5,s1['y']+5);p.mouse.down();p.mouse.move(s3['x']+8,s3['y']+5,steps=6);p.mouse.up();settle(p,900)
    pal1=js(p,'return W.asset().palette.colors.map(c=>c.join());')
    ok('dragging a palette entry reorders the palette (one step) and the picture keeps its colours',pal1!=pal0 and sorted(pal1)==sorted(pal0) and hist(p)[-1]=='Reorder palette' and same_pixels(frame_rgba(p),pic)==0)
    k=js(p,'return W.asset().palette.colors.findIndex(c=>c[0]===20&&c[1]===160&&c[2]===90);')
    p.dblclick(f'.px-pal-sw[data-i="{k}"]');p.wait_for_selector('[data-px="edit-hex"]');p.fill('[data-px="edit-hex"]','#3050e0');p.click('dialog .st-btn.primary');settle(p,900)
    ok('double-click a palette colour to edit it: every pixel of that index changes (one step), nothing else does',px(p,12,5)==[48,80,224,255] and px(p,2,5)==[200,100,50,255] and hist(p)[-1]==f'Edit palette colour {k}')
    js(p,"S.runCommand('edit.undo')");settle(p,600)
    js(p,"W.setColor('fg',[255,0,0,255])");p.keyboard.press('b');drag(p,[(30,14),(31,14)])
    ok('in indexed mode the pencil paints the nearest palette colour',px(p,30,14)==[200,100,50,255])
    # ------------------------------------------------------------ Lospec (consent, mocked)
    ok('no request left the machine so far',net==[],str(net[:3]))
    js(p,"S.runCommand('pixel.lospec')");p.wait_for_selector('dialog.px-lospec-consent')
    ok('Lospec asks first, naming the only network use',p.locator('dialog.px-lospec-consent').count()==1 and 'lospec.com' in p.inner_text('dialog') and lospec_calls==[])
    p.click('dialog .st-btn:not(.primary)');settle(p)
    ok('declining makes no request',lospec_calls==[] and p.locator('dialog').count()==0)
    js(p,"S.runCommand('pixel.lospec')");p.wait_for_selector('dialog.px-lospec-consent');p.click('dialog .st-btn.primary');p.wait_for_selector('dialog.px-lospec [data-px="lospec-name"]')
    p.fill('[data-px="lospec-name"]','Pico 8');p.click('[data-px="lospec-go"]');p.wait_for_selector('[data-px="lospec-out"] .px-pal-grid')
    ok('after consent, the typed name becomes one request to lospec.com/palette-list/<slug>.json',lospec_calls==['https://lospec.com/palette-list/pico-8.json'] and '16' in p.inner_text('[data-px="lospec-out"]'),str(lospec_calls))
    p.click('dialog.px-lospec .st-btn.primary');settle(p,1200)
    ok('Replace: the indexed sprite gets transparent + 16 PICO-8 colours; pixels move to the nearest one (one step)',
       js(p,'return W.asset().palette.colors.length;')==17 and hist(p)[-1].startswith('Load palette') and px(p,24,5)==[255,236,39,255],str(px(p,24,5)))
    # ------------------------------------------------------------ audit
    js(p,"S.runCommand('pixel.colorMode')");p.wait_for_selector('dialog');p.click('dialog .st-btn.primary');settle(p,500)
    js(p,"W.setColor('fg',[1,2,3,255])");p.keyboard.press('b');click(p,15,14)
    js(p,"S.runCommand('pixel.audit')");settle(p,800)
    ok('palette audit finds the one off-palette pixel in frame 1',p.locator('.px-audit-row.is-bad').count()==1 and '1 off-palette (1 px)' in p.inner_text('[data-px="audit-list"]'),p.inner_text('[data-px="audit"]'))
    p.click('[data-px="audit-fix"]');settle(p,900)
    ok('"Snap off-palette colours" moves it to the nearest palette colour (one step) and the audit is clean',px(p,15,14)==[0,0,0,255] and p.locator('.px-audit-row.is-bad').count()==0 and hist(p)[-1].startswith('Snap 1'))
    # ------------------------------------------------------------ cleanup on real upscales
    import_files(p,['old_hero__nn_x7.png'])
    ok('one picture imports as one paintable image (no sheet import step)',js(p,'const a=W.asset();return [a.width,a.height,a.frames.length,!!a.import];')==[448,336,0,False])
    p.click('[data-px="clean-measure"]');wait_clean(p,['measured','error'])
    ok('cleanup measures Old Hero ×7 as an exact ×7 block grid, sure, result 64×48 — nothing changed yet',
       'Upscaled ×7' in p.inner_text('[data-px="clean-verdict"]') and p.locator('[data-px="clean-verdict"] .st-conf.is-high').count()==1 and '64×48' in p.inner_text('[data-px="clean-size"]') and js(p,'return S.doc.assets.length;')==3)
    ok('the measured grid is drawn on the canvas',js(p,'return !!W.overlay.grid&&W.overlay.grid.xs.length===65;'))
    clean_option(p,'[data-px="clean-background"]','keep')
    p.click('[data-px="clean-preview"]');wait_clean(p,['done','error'])
    ok('preview shows before/after at whole-number zoom',p.locator('[data-px="clean-before"]').count()==1 and p.locator('[data-px="clean-after"]').get_attribute('width')=='64')
    shot(p,'03-cleanup-1440.png')
    n0=len(hist(p));p.click('[data-px="clean-apply"]');settle(p,1200)
    ok('Apply makes a NEW sprite (one step); the original stays',hist(p)[n0:]==['Cleaned sprite old_hero__nn_x7_1x'] and js(p,'return S.doc.assets.length;')==4)
    ok('Old Hero ×7 nearest → exactly the original 64×48 pixels',same_pixels(frame_rgba(p),fixture_rgba(p,'old_hero.png'))==0)
    import_files(p,['old_hero__bilinear_x4.25.png'])
    p.click('[data-px="clean-measure"]');wait_clean(p,['measured','error'])
    ok('Old Hero ×4.25 bilinear: measured as a smooth resize ≈ ×4.25 with confidence','Smoothly resized ≈ ×4.25' in p.inner_text('[data-px="clean-verdict"]'),p.inner_text('[data-px="clean-verdict"]'))
    clean_option(p,'[data-px="clean-background"]','keep')
    p.click('[data-px="clean-preview"]');wait_clean(p,['done','error']);p.click('[data-px="clean-apply"]');settle(p,1200)
    ok('Old Hero ×4.25 bilinear → exactly the original 64×48 pixels (3072/3072)',same_pixels(frame_rgba(p),fixture_rgba(p,'old_hero.png'))==0)
    import_files(p,['ninja_run__bilinear_x4.25_crop2.png'])
    p.click('[data-px="clean-measure"]');wait_clean(p,['measured','error'])
    ok('a transparent sprite (Ninja, ×4.25 bilinear, cropped 2 px) measures as a smooth resize and says it has no solid background',
       'Smoothly resized' in p.inner_text('[data-px="clean-verdict"]') and 'no solid background' in p.inner_text('[data-px="clean-analysis"]'),p.inner_text('[data-px="cleanup"]')[:300])
    p.click('[data-px="clean-preview"]');wait_clean(p,['done','error']);p.click('[data-px="clean-apply"]');settle(p,1200)
    got=frame_rgba(p);truth=fixture_rgba(p,'ninja_run.png')
    ok('its 1× result has the original size ±1 (40×29) with transparency kept',abs(got['w']-40)<=1 and abs(got['h']-29)<=1 and any(got['d'][k]==0 for k in range(3,len(got['d']),4)),f"{got['w']}x{got['h']}")
    import_files(p,['gosoythoth_frame0.png'])
    p.click('[data-px="clean-measure"]');wait_clean(p,['measured','error'])
    v=p.inner_text('[data-px="clean-verdict"]')
    ok('a model-generated picture is never called "sure": its grid is shown with its confidence, and applied only when the user asks',
       p.locator('[data-px="clean-verdict"] .st-conf.is-high').count()==0 and js(p,'return W.cleanupUI.state().analysis.grid===null;'),v)
    shot(p,'04-cleanup-generated-1440.png')
    # ------------------------------------------------------------ animation: Ninja run frames
    import_files(p,[f'ninja_run_{i}.png' for i in range(6)])
    ok('six numbered frame files arrive as one 6-frame animation',js(p,'const a=W.asset();return [a.frames.length,a.width,a.height,a.tags.length];')==[6,40,29,1])
    js(p,'W.setCurrent(2,{select:true});');settle(p,300);zoom(p,12)
    other=[frame_rgba(p,i) for i in (1,3)]
    js(p,"W.setColor('fg',[255,0,255,255])");p.keyboard.press('b');drag(p,[(1,1),(3,1)])
    ok('painting frame 3 changes frame 3 only (its own cel, one step)',frame_rgba(p,2)['d'][(1*40+2)*4:(1*40+2)*4+4]==[255,0,255,255] and [frame_rgba(p,i) for i in (1,3)]==other and hist(p)[-1]=='Pencil')
    p.keyboard.press('F3');settle(p,400)
    ok('F3 onion skin shows the neighbour frames under the current one',js(p,'return !!W.session.onion;'))
    p.keyboard.press('F3');settle(p)
    p.keyboard.press('Enter');settle(p,700);playing=js(p,'return W.playing();');p.keyboard.press('Enter');settle(p)
    ok('Enter plays and stops the animation',playing and not js(p,'return W.playing();'))
    # ------------------------------------------------------------ .aseprite export → real Aseprite
    new_sprite(p,24,16,'indexed');zoom(p,12)
    js(p,"W.setColor('fg',[172,50,50,255])");drag(p,[(1,1),(10,1)])
    p.keyboard.press('Shift+n');settle(p,300)
    js(p,"W.setColor('fg',[99,155,255,255])");p.keyboard.press('u');js(p,"W.setPref('shapeFill',true)");drag(p,[(4,0),(8,6)]);js(p,"W.setPref('shapeFill',false)")
    p.select_option('[data-px="layer-blend"]','multiply');settle(p,300)
    js(p,"S.runCommand('sprite.newFrame')");settle(p,500)
    js(p,"W.setColor('fg',[106,190,48,255])");p.keyboard.press('b');drag(p,[(15,10),(20,12)])
    p.click('.px-layer.is-cur [data-px="lock"]');settle(p,300)
    with p.expect_download() as d:js(p,"S.runCommand('pixel.exportAseprite')")
    ase=TMP/'pixel.aseprite';d.value.save_as(ase)
    exp=js(p,'const x=window.__pxLastExport;return [x.colorMode,x.layers,x.frames,x.skipped.length];')
    ok('.aseprite export: indexed, 2 layers, 2 frames, nothing skipped',exp==['indexed',2,2,0],str(exp))
    comp=[frame_rgba(p,i) for i in (0,1)]
    if os.path.exists(ASEPRITE):
        lua=TMP/'inspect.lua';lua.write_text('''local s=app.activeSprite
local m={[ColorMode.RGB]="rgb",[ColorMode.INDEXED]="indexed",[ColorMode.GRAY]="gray"}
local out={m[s.colorMode],s.width,s.height,#s.frames,s.transparentColor,#s.palettes[1]}
for _,l in ipairs(s.layers) do local b="?" for k,v in pairs(BlendMode) do if v==l.blendMode and (b=="?" or k=="NORMAL") then b=k end end out[#out+1]=l.name.."|"..b.."|"..tostring(l.isEditable) end
print(table.concat(out,","))''')
        r=subprocess.run([ASEPRITE,'-b',str(ase),'--script',str(lua)],capture_output=True,text=True,timeout=120)
        ok('real Aseprite reads it back: indexed, 24×16, 2 frames, transparent index 0, 33 colours, Layer 2 MULTIPLY and not editable',
           r.stdout.strip()=='indexed,24,16,2,0,33,Layer 1|NORMAL|true,Layer 2|MULTIPLY|false',r.stdout+r.stderr)
        subprocess.run([ASEPRITE,'-b',str(ase),'--color-mode','rgb','--save-as',str(TMP/'ase-{frame}.png')],capture_output=True,timeout=120)
        diffs=[]
        for i in (0,1):
            png=(TMP/f'ase-{i}.png').read_bytes()
            img=js(p,'''const b=new Blob([new Uint8Array(arg)]),bm=await createImageBitmap(b,{premultiplyAlpha:"none",colorSpaceConversion:"none"}),c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext("2d");x.drawImage(bm,0,0);return {w:bm.width,h:bm.height,d:Array.from(x.getImageData(0,0,bm.width,bm.height).data)};''',list(png))
            diffs.append(same_pixels(img,comp[i]))
        ok('Aseprite renders both frames pixel-identical to the Studio (0 px differ)',diffs==[0,0],str(diffs))
    else:skip('real Aseprite CLI check',f'{ASEPRITE} not found')
    # ------------------------------------------------------------ .nerulio round trip
    info=js(p,'const a=W.asset();return JSON.stringify({m:a.colorMode,ti:a.transparentIndex,p:a.palette.colors,l:a.layers.map(l=>[l.name,l.blend,!!l.locked,l.opacity])});')
    with p.expect_download() as d:js(p,"S.runCommand('file.save')")
    nf=TMP/'pixel.nerulio';d.value.save_as(nf)
    js(p,"S.runCommand('file.new')");settle(p,300)
    if p.locator('dialog .st-btn.primary').count():p.click('dialog .st-btn.primary');settle(p,300)
    p.set_input_files('input[type=file][accept*=nerulio]',str(nf));p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0');settle(p,1200)
    js(p,"S.showAsset(S.doc.assets[S.doc.assets.length-1].id)");settle(p,800)
    ok('.nerulio round trip keeps palette, colour mode, transparent index, blend, lock and every pixel',
       js(p,'const a=W.asset();return JSON.stringify({m:a.colorMode,ti:a.transparentIndex,p:a.palette.colors,l:a.layers.map(l=>[l.name,l.blend,!!l.locked,l.opacity])});')==info and [frame_rgba(p,i) for i in (0,1)]==comp)
    ok('no page errors so far',errors==[],str(errors[:3]))
    ctx.close()
    # ------------------------------------------------------------ languages
    for lang,menu,tool in [('ko','픽셀','연필'),('ja','ピクセル','鉛筆')]:
        c2=browser.new_context(viewport={'width':1440,'height':900});q=c2.new_page();q.on('pageerror',lambda e:errors.append(str(e)))
        q.goto(BASE+f'/{lang}/game/studio/?ws=pixel');ready(q)
        js(q,"S.runCommand('pixel.newSprite')");q.wait_for_selector('dialog');q.click('dialog .st-btn.primary');settle(q,500)
        ok(f'{lang}: menu, tool bar and panels are translated',menu in q.inner_text('.st-menubar') and q.inner_text('.px-bar-tool')==tool and q.locator('[data-px="cleanup"]').count()==1)
        if lang=='ko':shot(q,'05-ko-1440.png')
        c2.close()
    # ------------------------------------------------------------ 390 px
    c3=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True);q=c3.new_page();q.on('pageerror',lambda e:errors.append(str(e)))
    q.goto(BASE+'/en/game/studio/?ws=pixel');ready(q)
    q.set_input_files('input[type=file][multiple]',[str(FIX/'old_hero.png')]);q.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0');settle(q,800)
    ok('390 px: no horizontal page scroll; tool options bar and tool strip are on screen',q.evaluate('document.documentElement.scrollWidth')<=390 and q.locator('.px-bar').is_visible() and q.locator('[data-tool="px-pencil"]').is_visible())
    js(q,'S.view.zoomTo(6);S.view.reveal({x:0,y:0,w:24,h:24});');settle(q,200)
    a=scr(q,12,12);q.touchscreen.tap(a['x'],a['y']);js(q,'await W.commitChain();');settle(q,300)
    ok('390 px: a tap paints one pixel as one step',js(q,'return S.history.entries.slice(0,S.history.index).map(e=>e.label).pop();')=='Pencil')
    shot(q,'06-390.png')
    q.click('.st-compact-only:not(.st-hamburger)');settle(q,500)
    ok('390 px: the panels open as a sheet with the Pixel panels as tabs',all(q.locator('.st-sheet .st-tab',has_text=x).count()>=1 for x in ['Colour','Palette','Layers','Cleanup']))
    shot(q,'07-390-panels.png')
    c3.close()
    # ------------------------------------------------------------ 512×512 × 100 frames
    c4=browser.new_context(viewport={'width':1440,'height':900});q=c4.new_page();q.on('pageerror',lambda e:errors.append(str(e)))
    q.goto(BASE+'/en/game/studio/?ws=pixel');ready(q)
    new_sprite(q,512,512)
    for i in range(99):js(q,"S.runCommand('sprite.newFrame')")
    settle(q,500);js(q,'S.view.fit();');settle(q,300)
    a=scr(q,40,40);q.mouse.move(a['x'],a['y']);q.mouse.down();t=time.time()
    for k in range(100):
        b=scr(q,40+k*4,40+(k*9)%400);q.mouse.move(b['x'],b['y'])
    move=(time.time()-t)*10;t=time.time();q.mouse.up();js(q,'await W.commitChain();');commit=(time.time()-t)*1000
    step=js(q,'const s=performance.now();for(let i=0;i<20;i++){W.setCurrent(i*5,{select:true});await new Promise(r=>requestAnimationFrame(r));}return (performance.now()-s)/20;')
    t=time.time();js(q,"S.runCommand('edit.undo')");js(q,'await new Promise(r=>setTimeout(r,50));');undo=(time.time()-t)*1000
    print(f'  512×512×100: {move:.1f} ms per pointer move (incl. driver round trip), commit {commit:.0f} ms, frame switch {step:.0f} ms, undo {undo:.0f} ms')
    ok('512×512 × 100 frames: a stroke stays interactive (< 40 ms per move), commits < 500 ms, frame switch < 100 ms, undo < 1 s',
       js(q,'return W.asset().frames.length;')==100 and move<40 and commit<500 and step<100 and undo<1000)
    c4.close()
    browser.close()
ok('no page errors',errors==[],str(errors[:3]))
shutil.rmtree(TMP,ignore_errors=True)
print(f'\n{len(checks)} checks passed, {len(skipped)} skipped')
