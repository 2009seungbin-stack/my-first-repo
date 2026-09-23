"""Studio Sprite workspace end to end in Chromium with real CC0 game assets.

Covers: import of a real sheet (grid with confidence, preview + Apply, one-click alternatives,
undo), timeline (click / Shift / Ctrl selection, drag-to-tag with inline naming, inline rename and
duration, bulk duration, reorder by drag, duplicate / empty / delete with undo), playback keys and
loop inside a tag, onion skin, the floating preview, pivot / rect / circle / polygon boxes with
scope, keyboard nudge, collision from alpha, mirror (pixels + metadata), canvas alignment and
jitter marks, GIF and APNG import compared with Chromium's own decoder, numbered frame files with
natural sort, .aseprite import (layers, tags, durations, slices) and export back to .aseprite,
Sprite Lab project JSON, Aseprite JSON atlas data, .nerulio save → open round trip, autosave
recovery, ko/ja copy and a 390 px layout.

Runs inside tools/regression.py (port 4173). Standalone, against a server you own:
  PORT=4461 node tools/serve.mjs  then  TEST_URL=http://127.0.0.1:4461 python tests/studio-sprite-browser.py
Assets: committed CC0 fixtures (tests/fixtures/game/corpus, tests/fixtures/aseprite, tests/fixtures/sprite).
SHOTS=<dir> also writes screenshots at 1440×900 and 390×844."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,sys,tempfile,zipfile,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
SHOTS=os.environ.get('SHOTS','')
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
FX=ROOT/'tests'/'fixtures'
SAMURAI=FX/'game'/'corpus'/'sprites'/'samurai.png'          # 288×480, 48 px cells, 6×10, one animation per row
NINJA=sorted((FX/'game'/'corpus'/'ninja').glob('run_*.png'))  # 6 numbered frames, 40×29
TORCH=FX/'game'/'corpus'/'torch'                               # Aseprite JSON hash + sheet
GIF=FX/'sprite'/'trooper_run.gif'                              # 6 frames, 120 ms
APNG=FX/'sprite'/'trooper_run.apng.png'
ASE=FX/'aseprite'/'indexed-features.aseprite'                  # 4 frames, tags in 4 directions, slices
ASEPRITE_EXE=os.environ.get('ASEPRITE_EXE',r'C:\Users\2009s\asebuild\b\bin\aseprite.exe')
checks=[];errors=[]
def ok(name,cond,detail=''):
    if not cond:raise AssertionError(f'{name} {detail}')
    checks.append(name);print('PASS',name,flush=True)
def js(p,body,arg=None):return p.evaluate('async(arg)=>{const S=window.nerulioStudio;'+body+'}',arg)
def ready(p):p.wait_for_function('()=>document.documentElement.dataset.studioReady==="1"',timeout=20000)
def shot(p,name):
    if SHOTS:Path(SHOTS).mkdir(parents=True,exist_ok=True);p.screenshot(path=str(Path(SHOTS)/name))
def asset(p,i=None):return js(p,'const a=arg==null?S.doc.assets.find(x=>x.id===S.activeAssetId):S.doc.assets[arg];return JSON.parse(JSON.stringify(a));',i)
def import_files(p,paths,n):
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])',[str(x) for x in paths])
    p.wait_for_function('(n)=>window.nerulioStudio.doc.assets.length>=n',arg=n,timeout=30000);p.wait_for_timeout(250)
def drop_named(p,items,n):
    """Drops files with chosen names: items = [(path, name)]; builds File objects in the page."""
    payload=[{'name':name,'b64':__import__('base64').b64encode(Path(path).read_bytes()).decode()} for path,name in items]
    p.evaluate('''(files)=>{const dt=new DataTransfer();for(const f of files){const bin=atob(f.b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);dt.items.add(new File([u],f.name,{type:'image/png'}));}
     window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));}''',payload)
    p.wait_for_function('(n)=>window.nerulioStudio.doc.assets.length>=n',arg=n,timeout=30000);p.wait_for_timeout(250)
def fh(p,i):return p.locator(f'.sp-fh[data-i="{i}"]')
def center(loc):b=loc.bounding_box();return b['x']+b['width']/2,b['y']+b['height']/2
def canvas_at(p,ix,iy):
    return js(p,'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+arg[0]*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+arg[1]*v.view.scale)*r.height/v.H};',[ix,iy])
def frame_rgba(p,index):
    return js(p,'const R=await import("/src/studio/sprite/frame-render.js"),a=S.doc.assets.find(x=>x.id===S.activeAssetId),f=a.frames[arg],img=await R.frameRGBA(S.images,a,f);return {w:img.width,h:img.height,d:Array.from(img.data)};',index)
def hist(p):return js(p,'return {n:S.history.entries.length,i:S.history.index,top:S.history.top?.label||""};')
def cur(p):return int(p.locator('.sp-fh.is-cur').get_attribute('data-i'))
def sel(p):return [int(x.get_attribute('data-i')) for x in p.locator('.sp-fh[aria-selected="true"]').all()]
def watch(p,label):
    p.on('pageerror',lambda e:errors.append(f'{label}: {e}'))
    p.on('console',lambda m:m.type=='error' and errors.append(f'{label}: {m.text[:300]}'))
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=ctx.new_page();watch(p,'desktop')
    requests=[];p.on('request',lambda r:requests.append(r.url))
    # ------------------------------------------------------------ shell
    p.goto(BASE+'/en/game/studio/?ws=sprite');ready(p)
    ok('Sprite is a ready workspace (4 still coming) and ?ws=sprite opens it',js(p,'return S.workspace;')=='sprite' and p.locator('.st-ws-tab[data-ws="sprite"]').get_attribute('aria-disabled') is None and p.locator('.st-ws-tab[aria-disabled="true"]').count()==4)
    ok('Sprite panels: timeline at the bottom, import/frame/animation/align on the right',all(p.locator(f'#panel-{x}').count()==1 for x in ['sp-timeline','sp-import','sp-frame','sp-tag','sp-align']))
    ok('Sprite tools in the tool bar with their keys',all(p.locator(f'.st-tool[data-tool="{x}"]').count()==1 for x in ['sp-select','sp-region','sp-pivot','sp-rect','sp-circle','sp-polygon']))
    shot(p,'01-empty-1440.png')
    # ------------------------------------------------------------ sheet import: preview, confidence, Apply
    import_files(p,[SAMURAI],1)
    p.wait_for_selector('[data-sp="plan-count"]',timeout=30000)
    a=asset(p)
    ok('a sheet import cuts nothing until Apply (preview only, said so)',a['frames']==[] and 'Preview only' in p.locator('.sp-imp-lead').inner_text())
    slicing=p.locator('.sp-dec[data-dec="slice"]')
    ok('slicing decision shows the 48×48 grid with a confidence and one-click alternatives',
       '48×48' in slicing.locator('.sp-dec-chosen').inner_text() and slicing.locator('.st-conf').count()==1 and slicing.locator('.sp-alt').count()>=2,slicing.inner_text())
    keydec=p.locator('.sp-dec[data-dec="key"]')
    ok('"No key colour" on a transparent sheet is shown as a sure decision (not a red 0%), with the key offered as an alternative',
       'No key colour' in keydec.locator('.sp-dec-chosen').inner_text() and keydec.locator('.st-conf').get_attribute('data-conf')=='high' and keydec.locator('.sp-alt').count()==1,keydec.inner_text())
    ok('the sheet view shows the plan on the canvas (60 numbered regions)',js(p,'return S.view.layers.find(l=>l.id==="sp-plan").items.length;')==60)
    ok('plan: 60 frames, 10 animations (one per row)',p.locator('[data-sp="plan-count"]').inner_text().startswith('60 frames') and '10' in p.locator('[data-sp="plan-count"]').inner_text())
    shot(p,'02-sheet-plan-1440.png')
    h0=hist(p)
    p.click('[data-sp="import-apply"]');p.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===60')
    a=asset(p)
    ok('Apply: 60 frames of 48×48 in reading order, 10 row tags, 100 ms each, one undo step',len(a['frames'])==60 and len(a['tags'])==10 and all(f['sourceRect']['w']==48 and f['sourceRect']['h']==48 for f in a['frames'])
       and a['frames'][7]['sourceRect']=={'x':48,'y':48,'w':48,'h':48} and all(f['duration']==100 for f in a['frames']) and hist(p)['n']==h0['n']+1)
    ok('after Apply the canvas shows the current frame (48×48 at an integer zoom)',js(p,'return S.view.image.w===48&&S.view.image.h===48&&Number.isInteger(S.view.view.scale);'))
    p.click('.sp-dec[data-dec="animations"] .sp-alt[data-alt="single"]');p.wait_for_timeout(200)
    a=asset(p)
    ok('one-click alternative "One animation" re-applies as one step',len(a['tags'])==1 and len(a['tags'][0]['frameIds'])==60)
    p.keyboard.press('Control+z');p.wait_for_timeout(150)
    ok('undo brings the per-row tags back, and the Import panel says so (no stale choice)',len(asset(p)['tags'])==10 and 'per row' in p.locator('.sp-dec[data-dec="animations"] .sp-dec-chosen').inner_text())
    shot(p,'03-sheet-applied-1440.png')
    # ------------------------------------------------------------ timeline selection
    fh(p,2).click();fh(p,7).click(modifiers=['Shift'])
    ok('click then Shift+click selects the range (6 frames), current = last clicked',sel(p)==[2,3,4,5,6,7] and cur(p)==7)
    fh(p,4).click(modifiers=['Control'])
    ok('Ctrl+click toggles one frame out of the selection',sel(p)==[2,3,5,6,7])
    fh(p,0).click()
    ok('plain click selects one frame',sel(p)==[0] and cur(p)==0)
    # bulk duration for the first row (tag row_1 = frames 0..5)
    fh(p,0).click();fh(p,5).click(modifiers=['Shift'])
    p.fill('[data-sp="duration"]','80');p.press('[data-sp="duration"]','Enter');p.wait_for_timeout(120)
    a=asset(p)
    ok('bulk duration: 80 ms on the 6 selected frames only, one step',[f['duration'] for f in a['frames'][:7]]==[80]*6+[100] and hist(p)['top'].startswith('Duration'))
    # inline duration edit
    fh(p,8).locator('.sp-fh-ms').dblclick();p.wait_for_selector('[data-sp="inline"]')
    p.fill('[data-sp="inline"]','150');p.keyboard.press('Enter');p.wait_for_timeout(120)
    ok('double-click a duration edits it inline (no prompt())',asset(p)['frames'][8]['duration']==150 and p.locator('[data-sp="inline"]').count()==0)
    # inline tag rename by double-click
    bar=p.locator('.sp-tag').first;bar.dblclick();p.wait_for_selector('[data-sp="inline"]')
    p.fill('[data-sp="inline"]','idle');p.keyboard.press('Enter');p.wait_for_timeout(120)
    ok('double-click a tag bar renames it inline',asset(p)['tags'][0]['name']=='idle')
    # rename the next three rows the same way (the head-to-head "4 named animations")
    for k,name in [(1,'walk'),(2,'attack'),(3,'hurt')]:
        p.locator(f'.sp-tag >> nth={k}').dblclick();p.wait_for_selector('[data-sp="inline"]');p.fill('[data-sp="inline"]',name);p.keyboard.press('Enter');p.wait_for_timeout(80)
    ok('four named animations after four inline renames',[t['name'] for t in asset(p)['tags'][:4]]==['idle','walk','attack','hurt'])
    dialogs=[]
    def on_dialog(d):
        dialogs.append(d.type)
        d.accept() if d.type=='beforeunload' else d.dismiss()
    p.on('dialog',on_dialog)
    # create a tag by dragging across the tag lane (frames 12..14 are in row_3 = attack; use a new lane range on row 6)
    x0,y0=center(fh(p,30));x1,_=center(fh(p,33))
    lane=p.locator('.sp-tl-lane').bounding_box()
    # drag in the lane above the frames: an empty spot of lane 2 does not exist, so the new tag lands on its own lane
    p.mouse.move(x0,lane['y']+lane['height']-4);p.mouse.down();p.mouse.move(x1,lane['y']+lane['height']-4,steps=6);p.mouse.up()
    p.wait_for_selector('[data-sp="inline"]');p.keyboard.type('spin');p.keyboard.press('Enter');p.wait_for_timeout(150)
    a=asset(p);spin=[t for t in a['tags'] if t['name']=='spin']
    ok('dragging across the tag lane makes a tag named inline (frames 31–34)',len(spin)==1 and spin[0]['frameIds']==[f['id'] for f in a['frames'][30:34]] and not dialogs)
    # reorder by dragging selected frame numbers
    ids=[f['id'] for f in a['frames']]
    fh(p,10).click();fh(p,11).click(modifiers=['Shift'])
    sx,sy=center(fh(p,10));tx,_=center(fh(p,2))
    p.mouse.move(sx,sy);p.mouse.down();p.mouse.move(sx-20,sy,steps=3);p.mouse.move(tx-4,sy,steps=8);p.mouse.up();p.wait_for_timeout(150)
    b=[f['id'] for f in asset(p)['frames']]
    ok('dragging selected frames reorders them as one step (frames 11–12 now at 3–4)',b[2:4]==ids[10:12] and sorted(b)==sorted(ids) and hist(p)['top'].startswith('Move 2'))
    tg=[t for t in asset(p)['tags'] if t['name']=='walk'][0]
    ok('tags follow their frames after a reorder (walk still lists its 6 frames in timeline order)',len(tg['frameIds'])==6 and tg['frameIds']==[x for x in b if x in tg['frameIds']])
    p.keyboard.press('Control+z');p.wait_for_timeout(100)
    ok('undo restores the frame order',[f['id'] for f in asset(p)['frames']]==ids)
    # duplicate / empty / delete
    fh(p,6).click();n0=len(asset(p)['frames'])
    p.keyboard.press('Alt+n');p.wait_for_timeout(150);a=asset(p)
    ok('Alt+N duplicates the current frame right after it, inside its tag',len(a['frames'])==n0+1 and a['frames'][7]['sourceRect']==a['frames'][6]['sourceRect'] and a['frames'][7]['id'] in [t for t in a['tags'] if t['name']=='walk'][0]['frameIds'])
    p.keyboard.press('Alt+c');p.wait_for_timeout(150)
    ok('Alt+C deletes the selected frame (with an undo toast)',len(asset(p)['frames'])==n0 and 'undo' in p.locator('.st-toast').inner_text().lower())
    p.click('[data-sp="empty-frame"]');p.wait_for_timeout(250);a=asset(p)
    ok('an empty frame is transparent (own cel, not the shared sheet)',len(a['frames'])==n0+1 and max(frame_rgba(p,cur(p))['d'][3::4])==0)
    p.keyboard.press('Control+z');p.wait_for_timeout(120)
    ok('undo removes the empty frame again',len(asset(p)['frames'])==n0)
    # ------------------------------------------------------------ playback
    def playing(p):return p.locator('[data-sp="play"]').get_attribute('aria-pressed')=='true'
    def shown_hash(p):return js(p,'const im=S.view.image,c=new OffscreenCanvas(im.w,im.h),x=c.getContext("2d");x.drawImage(im.src,0,0);const d=x.getImageData(0,0,im.w,im.h).data;let h=0;for(let i=0;i<d.length;i++)h=(h*31+d[i])>>>0;return h+":"+im.w+"x"+im.h;')
    fh(p,0).click();p.locator('.sp-tl-frames').focus()
    p.keyboard.press('Enter');p.wait_for_timeout(450)
    seen=cur(p)
    ok('Enter plays: the current frame advances inside the tag (idle 1–6)',playing(p) and 0<seen<=5,str(seen))
    p.wait_for_timeout(700)
    ok('playback loops inside the tag (never leaves frames 1–6)',0<=cur(p)<=5)
    p.keyboard.press('Enter');p.wait_for_timeout(100)
    ok('Enter again stops',not playing(p))
    fh(p,5).click();p.locator('.st-canvas-host .cv-stage').focus()
    p.keyboard.press('.');p.wait_for_timeout(60)
    ok('"." steps forward and wraps inside the tag (6 → 1)',cur(p)==0)
    p.keyboard.press(',');p.wait_for_timeout(60)
    ok('"," steps back and wraps (1 → 6)',cur(p)==5)
    p.keyboard.press('Home');p.wait_for_timeout(60);h1=cur(p);p.keyboard.press('End');p.wait_for_timeout(60)
    ok('Home / End go to the first / last frame of the tag',h1==0 and cur(p)==5)
    before=shown_hash(p)
    p.keyboard.press('F3');p.wait_for_timeout(300)
    ok('F3 turns onion skin on: neighbours are drawn tinted under the frame',p.locator('[data-sp="onion"]').get_attribute('aria-pressed')=='true' and shown_hash(p)!=before)
    p.keyboard.press('F3');p.wait_for_timeout(300)
    ok('F3 again turns it off (same picture as before)',shown_hash(p)==before)
    p.keyboard.press('F7');p.wait_for_timeout(400)
    pv=js(p,'const c=document.querySelector(".sp-preview-canvas");return {open:!document.querySelector(".sp-preview").hidden,w:c.width,h:c.height};')
    ok('F7 opens the floating preview at an integer zoom (48×48 frame → 96×96 at 2×)',pv['open'] and pv['w']==96 and pv['h']==96,str(pv))
    p.select_option('[data-sp="preview-zoom"]','1');p.wait_for_timeout(250)
    ok('preview 1:1',js(p,'return document.querySelector(".sp-preview-canvas").width;')==48)
    shot(p,'04-preview-1440.png')
    p.keyboard.press('F7')
    # ------------------------------------------------------------ pivot, boxes, scope
    fh(p,1).click();p.wait_for_timeout(100)
    p.keyboard.press('p');pt=canvas_at(p,24.3,40.2);p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(100)
    a=asset(p);f1=a['frames'][1]
    ok('pivot tool: a click sets the pivot on the pixel grid (24, 40) of this frame only',abs(f1['pivotX']*48-24)<1e-9 and abs(f1['pivotY']*48-40)<1e-9 and a['frames'][2]['pivotY']==1)
    p.keyboard.press('b');s0=canvas_at(p,10,10);s1=canvas_at(p,30,40)
    p.mouse.move(s0['x'],s0['y']);p.mouse.down();p.mouse.move(s1['x'],s1['y'],steps=5);p.mouse.up();p.wait_for_timeout(100)
    b=asset(p)['frames'][1]['boxes']
    ok('box tool: a drag makes a 20×30 hit box snapped to pixels on this frame',len(b)==1 and b[0]['type']=='hit' and (b[0]['x'],b[0]['y'],b[0]['w'],b[0]['h'])==(10,10,20,30))
    p.select_option('[data-sp="scope"]','tag');p.select_option('[data-sp="box-type"]','hurt');p.wait_for_timeout(80)
    s0=canvas_at(p,4,20);s1=canvas_at(p,20,44)
    p.mouse.move(s0['x'],s0['y']);p.mouse.down();p.mouse.move(s1['x'],s1['y'],steps=5);p.mouse.up();p.wait_for_timeout(120)
    a=asset(p);tag0=[f for f in a['frames'][:6]]
    hurt=[[x for x in f['boxes'] if x['type']=='hurt'] for f in tag0]
    ok('scope "This tag": one drag puts the same hurt box (same id) on all 6 frames of the tag',all(len(x)==1 for x in hurt) and len({x[0]['id'] for x in hurt})==1 and a['frames'][6]['boxes']==[])
    hid=hurt[0][0]['id'];n_before=hist(p)['n']
    p.keyboard.press('v');m0=canvas_at(p,12,30);m1=canvas_at(p,15,32)
    p.mouse.move(m0['x'],m0['y']);p.mouse.down();p.mouse.move(m1['x'],m1['y'],steps=6);p.mouse.up();p.wait_for_timeout(120)
    a=asset(p);hb=[[x for x in f['boxes'] if x['id']==hid][0] for f in a['frames'][:6]]
    ok('dragging the box moves it on every frame of the scope, as one undo step',all((x['x'],x['y'])==(7,22) for x in hb) and hist(p)['n']==n_before+1)
    p.keyboard.press('ArrowRight');p.keyboard.press('ArrowRight');p.keyboard.press('Shift+ArrowDown');p.wait_for_timeout(100)
    hb=[[x for x in f['boxes'] if x['id']==hid][0] for f in asset(p)['frames'][:6]]
    ok('arrow keys nudge the selected box (1 px, Shift 10 px) across the scope',all((x['x'],x['y'])==(9,32) for x in hb))
    ok('a box reaching past the frame canvas is kept but marked "past the canvas" in the box list',p.locator('.sp-box[data-box="%s"] [data-sp="box-outside"]'%hid).count()==1)
    p.select_option('[data-sp="scope"]','frame');p.select_option('[data-sp="box-type"]','interact')
    p.keyboard.press('c');c0=canvas_at(p,24,24);c1=canvas_at(p,30,24)
    p.mouse.move(c0['x'],c0['y']);p.mouse.down();p.mouse.move(c1['x'],c1['y'],steps=4);p.mouse.up();p.wait_for_timeout(100)
    circ=[x for x in asset(p)['frames'][1]['boxes'] if x['shape']=='circle']
    ok('circle tool: centre + radius snapped to half pixels',len(circ)==1 and (circ[0]['cx'],circ[0]['cy'],circ[0]['r'])==(24,24,6))
    p.keyboard.press('q')
    for (x,y) in [(2,2),(12,2),(8,12)]:
        q=canvas_at(p,x,y);p.mouse.click(q['x'],q['y']);p.wait_for_timeout(40)
    p.keyboard.press('Enter');p.wait_for_timeout(120)
    poly=[x for x in asset(p)['frames'][1]['boxes'] if x['shape']=='polygon']
    ok('polygon tool: clicks + Enter close a polygon box point by point',len(poly)==1 and poly[0]['points']==[[2,2],[12,2],[8,12]])
    p.fill('[data-sp="max-vertices"]','8');p.press('[data-sp="max-vertices"]','Enter')
    p.select_option('[data-sp="scope"]','tag');p.wait_for_timeout(60)
    p.click('[data-sp="auto-collision"]');p.wait_for_timeout(600)
    a=asset(p)
    ok('collision from alpha on the 6 frames of the tag, each polygon ≤ 8 vertices',all(len(f['collision'])>=1 and all(3<=len(poly)<=8 for poly in f['collision']) for f in a['frames'][:6]) and a['frames'][6]['collision']==[])
    p.select_option('[data-sp="scope"]','frame')
    fh(p,1).click();p.keyboard.press('Alt+b');p.wait_for_timeout(120)
    a=asset(p)
    ok('Alt+B copies this frame\'s boxes to the next frame and steps to it',cur(p)==2 and {x['id'] for x in a['frames'][2]['boxes']}>= {x['id'] for x in a['frames'][1]['boxes']})
    # mirror: pixels + pivot + boxes
    fh(p,1).click();pre=frame_rgba(p,1);f_before=asset(p)['frames'][1]
    p.click('[data-sp="flip-frames"]');p.wait_for_timeout(500)
    post=frame_rgba(p,1);f_after=asset(p)['frames'][1]
    W_=pre['w'];flipped=[]
    for y in range(pre['h']):
        for x in range(W_):
            i=(y*W_+(W_-1-x))*4;flipped+=pre['d'][i:i+4]
    rect0=[x for x in f_before['boxes'] if x['shape']=='rect' and x['type']=='hit'][0];rect1=[x for x in f_after['boxes'] if x['id']==rect0['id']][0]
    ok('flip: pixels mirrored exactly, pivot and boxes mirrored with them, other frames untouched',post['d']==flipped and abs(f_after['pivotX']-(1-f_before['pivotX']))<1e-9 and rect1['x']==48-rect0['x']-rect0['w'] and frame_rgba(p,2)!=post)
    ok('flip gave frame 2 its own cel; the shared sheet is unchanged',js(p,'const a=S.doc.assets.find(x=>x.id===S.activeAssetId);return a.cels.filter(c=>c.frameId===a.frames[1].id).length===1&&a.cels.filter(c=>c.frameId==="*").length===1;'))
    # delete a selected box
    p.keyboard.press('v');cc=canvas_at(p,48-24,24);p.mouse.click(cc['x'],cc['y']);p.wait_for_timeout(60)
    nb=len(asset(p)['frames'][1]['boxes']);p.keyboard.press('Delete');p.wait_for_timeout(100)
    ok('Delete removes the selected box (not frames)',len(asset(p)['frames'][1]['boxes'])==nb-1 and len(asset(p)['frames'])==60)
    shot(p,'05-boxes-1440.png')
    # ------------------------------------------------------------ alignment + jitter
    p.select_option('[data-sp="scope"]','tag');fh(p,6).click()
    p.click('[data-sp="align-apply"]');p.wait_for_timeout(500)
    a=asset(p);row=a['frames'][6:12]
    ok('Align frames (tag): one canvas size, art bottom-centred, trimmed rects recorded, nothing rescaled',len({(f['canvasWidth'],f['canvasHeight']) for f in row})==1 and all(f['trimmedRect'] for f in row)
       and all(f['offsetY']+f['trimmedRect']['h']==f['canvasHeight'] for f in row))
    p.click('[data-sp="jitter-measure"]');p.wait_for_timeout(600)
    ok('jitter measured for the tag and marked on the timeline (6 marks) with a report',p.locator('.sp-jit').count()==6 and p.locator('[data-sp="jitter-report"]').count()==1)
    shot(p,'06-align-jitter-1440.png')
    print(f'--- part 2: {len(checks)} checks',flush=True)
    # ------------------------------------------------------------ .nerulio round trip with everything above
    before=asset(p)
    with p.expect_download() as dl:p.keyboard.press('Control+s')
    tmp=Path(tempfile.mkdtemp());saved=tmp/dl.value.suggested_filename;dl.value.save_as(saved)
    with zipfile.ZipFile(saved) as z:
        proj=json.loads(z.read('project.json'))['project'];imgs=[n for n in z.namelist() if n.startswith('images/')]
    ok('.nerulio holds the sprite document (tags, durations, pivots, boxes, collision, own cels) and every image once',
       proj['version']==2 and len(proj['assets'][0]['cels'])==len(before['cels'])==len(imgs) and proj['assets'][0]['frames']==before['frames'] and proj['assets'][0]['tags']==before['tags'])
    p.set_input_files('input[type=file][accept*=".nerulio"]',str(saved));p.wait_for_timeout(1200)
    after=asset(p,0)
    ok('.nerulio opens back to the identical document',after==before)
    ok('the reopened flipped frame shows the same pixels (its own cel came back byte-exact)',frame_rgba(p,1)==post)
    # ------------------------------------------------------------ GIF / APNG compared with Chromium's own decoder
    def decoder_matches(path,mime):
        return js(p,'''const R=await import("/src/studio/sprite/frame-render.js"),a=S.doc.assets.find(x=>x.id===S.activeAssetId);
          const bytes=Uint8Array.from(atob(arg[0]),c=>c.charCodeAt(0)).buffer,dec=new ImageDecoder({data:bytes,type:arg[1]});await dec.tracks.ready;const n=dec.tracks.selectedTrack.frameCount;
          if(n!==a.frames.length)return {ok:false,why:"count "+n+" vs "+a.frames.length};let bad=0,dur=[];
          for(let i=0;i<n;i++){const {image}=await dec.decode({frameIndex:i});const c=new OffscreenCanvas(image.displayWidth,image.displayHeight),x=c.getContext("2d");x.drawImage(image,0,0);
           const want=x.getImageData(0,0,c.width,c.height).data;dur.push([Math.round(image.duration/1000),a.frames[i].duration]);image.close();
           const got=(await R.frameRGBA(S.images,a,a.frames[i])).data;for(let j=0;j<want.length;j+=4){if(want[j+3]===0&&got[j+3]===0)continue;if(want[j]!==got[j]||want[j+1]!==got[j+1]||want[j+2]!==got[j+2]||want[j+3]!==got[j+3])bad++;}}
          return {ok:bad===0&&dur.every(([x,y])=>x===y),bad,dur};''',[__import__('base64').b64encode(Path(path).read_bytes()).decode(),mime])
    import_files(p,[GIF],2)
    a=asset(p)
    ok('GIF: every frame with its delay and a looping tag named after the file',len(a['frames'])==6 and all(f['duration']==120 for f in a['frames']) and a['tags'][0]['name']=='trooper_run' and a['tags'][0]['repeat']==0)
    m=decoder_matches(GIF,'image/gif')
    ok('GIF frames are pixel-identical to Chromium ImageDecoder, same durations',m['ok'],str(m))
    import_files(p,[APNG],3)
    m=decoder_matches(APNG,'image/png')
    ok('APNG frames are pixel-identical to Chromium ImageDecoder, same durations',len(asset(p)['frames'])==6 and m['ok'],str(m))
    ok('GIF/APNG decisions are listed in the Import panel',p.locator('.sp-dec[data-dec="frames"]').count()==1)
    shot(p,'07-gif-1440.png')
    # ------------------------------------------------------------ numbered frame files, natural sort, grouping by name
    names=['walk_10.png','attack 3.png','walk_2.png','attack (1).png','walk_01.png','idle.png']
    drop_named(p,list(zip(NINJA,names)),4)
    a=asset(p)
    ok('dropped frame files: one sprite, frames grouped by name in natural order (walk_01, walk_2, walk_10 …)',
       [f['name'] for f in a['frames']]==['walk_01','walk_2','walk_10','attack (1)','attack 3','idle'] and [(t['name'],len(t['frameIds'])) for t in a['tags']]==[('walk',3),('attack',2),('idle',1)] and 'prompt' not in dialogs)
    ok('the grouping is a decision with a confidence and alternatives (one animation / none)',p.locator('.sp-dec[data-dec="grouping"] .sp-alt').count()==2)
    p.click('.sp-dec[data-dec="grouping"] .sp-alt[data-alt="single"]');p.wait_for_timeout(200)
    ok('one click regroups them into one animation',len(asset(p)['tags'])==1)
    p.keyboard.press('Control+z');p.wait_for_timeout(100)
    import_files(p,NINJA,5)
    a=asset(p)
    ok('run_0 … run_5 (real CC0 ninja frames): 6 frames, tag "run", 40×29',len(a['frames'])==6 and a['tags'][0]['name']=='run' and (a['width'],a['height'])==(40,29))
    # ------------------------------------------------------------ .aseprite in, .aseprite out
    import_files(p,[ASE],6)
    a=asset(p)
    ok('.aseprite: 4 frames with durations, 4 tags with their directions and repeats, layers',len(a['frames'])==4 and len(a['tags'])==4 and {t['direction'] for t in a['tags']}>={'forward','reverse','pingpong'} and len(a['layers'])>=1,str([(t['name'],t['direction'],t['repeat']) for t in a['tags']]))
    ok('.aseprite: slice mappings (pivot / 9-slice) are shown as decisions',p.locator('.sp-dec').count()>=2)
    with p.expect_download() as dl:js(p,'S.runCommand("sprite.exportAseprite");')
    out=tmp/'exported.aseprite';dl.value.save_as(out)
    ok('Export .aseprite downloads a file',out.stat().st_size>100)
    if Path(ASEPRITE_EXE).exists():
        def ase_export(path,tag):
            d=tmp/tag;d.mkdir(exist_ok=True)
            subprocess.run([ASEPRITE_EXE,'-b',str(path),'--list-tags','--format','json-array','--data',str(d/'data.json'),'--save-as',str(d/'{frame}.png')],capture_output=True,timeout=120)
            meta=json.loads((d/'data.json').read_text(encoding='utf-8'))
            return meta,sorted(d.glob('*.png'))
        from PIL import Image
        m1,f1=ase_export(ASE,'orig');m2,f2=ase_export(out,'ours')
        same_px=len(f1)==len(f2) and all(Image.open(x).convert('RGBA').tobytes()==Image.open(y).convert('RGBA').tobytes() or
            all(pa[3]==0 and pb[3]==0 or pa==pb for pa,pb in zip(Image.open(x).convert('RGBA').getdata(),Image.open(y).convert('RGBA').getdata())) for x,y in zip(f1,f2))
        tg=lambda m:[(t['name'],t['from'],t['to'],t['direction'],t.get('repeat')) for t in m['meta']['frameTags']]
        ok('real Aseprite opens the exported file: identical tags, durations and pixels',same_px and tg(m1)==tg(m2) and [f['duration'] for f in m1['frames']]==[f['duration'] for f in m2['frames']],str((tg(m1),tg(m2))))
    else:print('SKIP real Aseprite check (ASEPRITE_EXE not found)')
    # ------------------------------------------------------------ Sprite Lab project JSON + atlas data
    lab={'format':'nerulio-sprite-lab-project','version':1,'sheet':{'name':'samurai.png','width':288,'height':480},'settings':{},
         'frames':[{'id':'a','name':'slash_0','sourceRect':{'x':0,'y':96,'w':48,'h':48},'duration':90},{'id':'b','name':'slash_1','sourceRect':{'x':48,'y':96,'w':48,'h':48},'duration':90},{'id':'c','name':'slash_2','sourceRect':{'x':96,'y':96,'w':48,'h':48},'duration':150}],
         'animations':[{'id':'x','name':'slash','frameIds':['a','b','c'],'fps':12,'direction':'forward','loop':False}]}
    lp=tmp/'samurai.sprite-lab.json';lp.write_text(json.dumps(lab),encoding='utf-8')
    import_files(p,[SAMURAI,lp],7)
    a=asset(p)
    ok('Sprite Lab project JSON dropped with its sheet: frames, durations and the animation (plays once)',[f['name'] for f in a['frames']]==['slash_0','slash_1','slash_2'] and [f['duration'] for f in a['frames']]==[90,90,150] and a['tags'][0]['name']=='slash' and a['tags'][0]['repeat']==1)
    import_files(p,[TORCH/'Torch_Sheet.png',TORCH/'Torch_Hash.json'],8)
    a=asset(p);meta=json.loads((TORCH/'Torch_Hash.json').read_text(encoding='utf-8'))
    ok('Aseprite JSON atlas + its sheet: named frames with the file\'s durations',len(a['frames'])==len(meta['frames']) and [f['duration'] for f in a['frames']]==[v['duration'] for v in meta['frames'].values()])
    # ------------------------------------------------------------ autosave → reload → restore
    p.wait_for_function('()=>{const a=window.nerulioStudio.autosave;return !a.pending&&!a.saving&&a.lastAt>0}',timeout=15000)
    snapshot=js(p,'return JSON.parse(JSON.stringify(S.doc));');count=len(snapshot['assets'])
    p.reload();ready(p);p.wait_for_selector('.st-recover',timeout=15000)
    p.click('.st-recover [data-value="restore"]');p.wait_for_function('(n)=>window.nerulioStudio.doc.assets.length===n',arg=count,timeout=15000)
    ok('autosave: after a reload the whole sprite project comes back identical (assets, tags, boxes, own cels)',js(p,'return JSON.parse(JSON.stringify(S.doc));')==snapshot)
    ok('no network request left the machine while importing and editing',all(u.startswith(BASE) or u.startswith('blob:') or u.startswith('data:') for u in requests),str([u for u in requests if not u.startswith(BASE)][:3]))
    ctx.close()
    # ------------------------------------------------------------ languages
    for loc,word in [('ko','타임라인'),('ja','タイムライン')]:
        c2=browser.new_context(viewport={'width':1440,'height':900});q=c2.new_page();watch(q,loc)
        q.goto(f'{BASE}/{loc}/game/studio/?ws=sprite');ready(q)
        ok(f'{loc}: Sprite copy is translated ({word})',word in q.locator('.st-dock-bottom').inner_text() and q.locator('.st-ws-tab[data-ws="sprite"]').inner_text()!='Sprite')
        q.set_input_files('input[type=file][multiple]:not([webkitdirectory])',str(SAMURAI));q.wait_for_selector('[data-sp="plan-count"]',timeout=30000)
        why=q.locator('.sp-dec[data-dec="slice"] .st-why li').all_text_contents()
        import re
        ok(f'{loc}: the Import "why" reasons are in {loc} too (rebuilt from the measured numbers)',len(why)>=3 and all(re.search('[가-힣぀-ヿ一-鿿]',x) for x in why),str(why[:2]))
        c2.close()
    # ------------------------------------------------------------ 390 px phone
    c3=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True);m=c3.new_page();watch(m,'390')
    m.goto(BASE+'/en/game/studio/?ws=sprite');ready(m)
    m.set_input_files('input[type=file][multiple]:not([webkitdirectory])',str(SAMURAI));m.wait_for_function('()=>window.nerulioStudio.doc.assets.length===1',timeout=30000)
    m.wait_for_timeout(1500)
    m.click('.st-icon-btn.st-compact-only >> nth=1');m.wait_for_timeout(300)
    m.locator('.st-sheet .st-tab',has_text='Import').click();m.wait_for_selector('.st-sheet [data-sp="import-apply"]:not([disabled])',timeout=30000)
    m.locator('.st-sheet [data-sp="import-apply"]').click();m.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===60')
    m.locator('.st-sheet .st-tab',has_text='Timeline').click();m.wait_for_timeout(300)
    ok('390 px: import → Apply → timeline all reachable in the panel sheet, no page scroll',m.locator('.st-sheet .sp-fh').count()==60 and js(m,'return document.scrollingElement.scrollWidth<=innerWidth+1;'))
    m.wait_for_timeout(500)
    def frame_on_screen(q):
        return js(q,'''const v=S.view,st=v.stage.getBoundingClientRect(),k=st.width/v.W,im=v.image,sheet=document.querySelector(".st-sheet"),open=sheet.classList.contains("is-open");
          const top=open?sheet.getBoundingClientRect().top:innerHeight,x0=st.left+v.view.x*k,y0=st.top+v.view.y*k,x1=x0+im.w*v.view.scale*k,y1=y0+im.h*v.view.scale*k;
          const areaTop=st.top,areaBottom=Math.min(st.bottom,top);
          return {inside:x0>=st.left-.5&&x1<=st.right+.5&&y0>=areaTop-.5&&y1<=areaBottom+.5,frame:[x0,y0,x1,y1].map(Math.round),area:[st.left,areaTop,st.right,areaBottom].map(Math.round),sheetH:open?Math.round(sheet.getBoundingClientRect().height):0,w:im.w,h:im.h};''')
    fo=frame_on_screen(m)
    ok('390 px: with the timeline open the whole frame is visible above it (stage = the unobscured area)',fo['inside'] and fo['w']==48,str(fo))
    ok('390 px: the timeline sheet is compact (≈35% of the screen), so the frame keeps most of the room',200<=fo['sheetH']<=0.4*844,str(fo))
    m.locator('.st-sheet .sp-fh[data-i="7"]').click();m.wait_for_timeout(300)
    ok('390 px: scrubbing in the timeline keeps the frame visible',frame_on_screen(m)['inside'])
    shot(m,'20-timeline-390.png')
    m.locator('.st-sheet .st-tab',has_text='Import').click();m.wait_for_timeout(500)
    ok('390 px: a taller panel (Import) shrinks the canvas again and the frame is refitted into it',frame_on_screen(m)['inside'],str(frame_on_screen(m)))
    m.locator('.st-sheet .st-tab',has_text='Timeline').click();m.wait_for_timeout(300)
    m.click('.st-sheet-grip');m.wait_for_timeout(400)
    ok('390 px: closing the sheet gives the canvas back and the frame stays centred and visible',frame_on_screen(m)['inside'] and frame_on_screen(m)['sheetH']==0)
    m.locator('[data-sp="hud-play"]').click();m.wait_for_timeout(500)
    ok('390 px: the canvas HUD play button starts playback by touch (frames advance)',m.locator('[data-sp="hud-play"]').get_attribute('title').startswith('Stop') and m.locator('[data-sp="view-sheet"]').count()==1)
    m.locator('[data-sp="hud-play"]').click();m.wait_for_timeout(100)
    shot(m,'21-frame-390.png')
    c3.close()
    browser.close()
print(f'studio-sprite-browser: {len(checks)} checks passed')
if errors:print('page errors:',errors[:10]);sys.exit(1)
