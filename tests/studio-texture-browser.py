"""Studio Texture workspace (P4) in Chromium, with real CC0 assets (tests/fixtures/texture/).

Sprite: the OGA pixel torch sheet → frames cut on the document (as the Sprite workspace does) →
generated normal map, suggestion shown but not stored → lit pixels read back from the WebGL2 canvas
equal the Godot-compatible reference (src/game/normals/lighting.js) → light drag = one undo step →
add/remove light → brush stroke stays in its frame and undoes → slider drag = one undo step →
pixel-art quantisation → animation plays → compare split.
Texture: the ambientCG bricks set → tileable suggestion, wrap test exactly 0 (and not 0 with Clamp)
→ imported DirectX normal map detected as DirectX with high confidence, NOT applied until confirmed,
and then lit exactly like the OpenGL original → Godot ORM channel pack byte-exact → export ZIP
contents (Godot scene, Unity importer, 16-bit height) → .nerulio round trip → autosave recovery →
ko/ja → keyboard → 390 px layout. Screenshots go to SHOTS.

    PORT=4511 node tools/serve.mjs  then  TEST_URL=http://127.0.0.1:4511 python tests/studio-texture-browser.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import io, json, os, sys, zipfile, struct
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
SHOTS=Path(os.environ.get('TEXTURE_SHOTS',ROOT/'test-results'/'studio-texture'));SHOTS.mkdir(parents=True,exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
FIX=ROOT/'tests'/'fixtures'/'texture'
checks=[];errors=[]
def ok(name,cond,detail=''):
    if not cond:raise AssertionError(f'{name} {detail}')
    checks.append(name);print('PASS',name,flush=True)
def js(p,body,arg=None):return p.evaluate('async(arg)=>{const S=window.nerulioStudio,T=window.nerulioTexture;'+body+'}',arg)
def ready(p):p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"',timeout=30000)
def settle(p,ms=150):p.wait_for_timeout(ms)
def wait_gen(p,timeout=20000):p.wait_for_function('()=>{const T=window.nerulioTexture;return T&&T.S.gen&&!T.S.busy}',timeout=timeout);settle(p,120)
def tex_state(p):return js(p,'return JSON.parse(JSON.stringify(S.doc.settings.texture||null));')
def entry(p):return js(p,'return JSON.parse(JSON.stringify(T.entry()));')
def shot(p,name):p.screenshot(path=str(SHOTS/name))
def screen_of(p,ix,iy):
    """Client point of image pixel (ix,iy)'s centre."""
    return js(p,'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+(arg[0]+.5)*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+(arg[1]+.5)*v.view.scale)*r.height/v.H};',[ix,iy])
LIT_CHECK='''
const L=await import("/src/game/normals/lighting.js"),e=T.entry(),r=T.region(),pic=T.S.pic,g=T.S.gen,v=S.view,lit=T.lit();
const pts=arg.pts,out=[];
for(const [x,y] of pts){
 const i=((r.y+y)*pic.w+r.x+x)*4;if(pic.rgba[i+3]!==255)continue;
 const alb=[pic.rgba[i]/255,pic.rgba[i+1]/255,pic.rgba[i+2]/255,1];
 const nb=[g.normal[i],arg.flip?255-g.normal[i+1]:g.normal[i+1],g.normal[i+2]];
 const c=L.shade(alb,nb,x+.5,y+.5,e.scene);const want=c.map(q=>Math.min(255,Math.round(q*255)));
 const dx=Math.floor(v.view.x+(x+.5)*v.view.scale),dy=Math.floor(v.view.y+(y+.5)*v.view.scale);
 const got=lit.read(dx,dy).slice(0,3);out.push({x,y,want,got,d:Math.max(...want.map((q,k)=>Math.abs(q-got[k])))});
}
return out;'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--ignore-gpu-blocklist'])
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:m.type=='error' and errors.append(m.text[:200]))
    p.goto(BASE+'/en/game/studio/?ws=texture');ready(p)
    ok('?ws=texture opens the Texture workspace (no longer "coming"); its tools, view switch and panels are there',
       js(p,'return S.workspace;')=='texture' and p.locator('.st-ws-tab[data-ws="texture"]').get_attribute('aria-disabled') is None
       and p.locator('[data-tool="tex-light"]').count()==1 and p.locator('[data-tool="tex-brush"]').count()==1 and p.locator('[data-tex-panel="tex-normal"]').count()==1 and p.locator('[data-tex-panel="tex-export"]').count()==1)
    # ------------------------------------------------------------ sprite with frames
    p.set_input_files('input[type=file][multiple]',[str(FIX/'torch_sheet.png')]);wait_gen(p)
    ok('a sprite gets a generated normal map at once; the "sprite" reading is shown as a suggestion and nothing is stored yet',
       tex_state(p) is None and p.locator('[data-k="kind-sprite"][aria-checked="true"]').count()==1 and p.get_by_text('Suggested: it has transparent pixels').count()==1)
    js(p,'''const P=await import("/src/studio/core/project.js"),{edit}=await import("/src/studio/core/history.js"),a=S.doc.assets[0];
      S.history.execute(edit('Cut frames',d=>P.setFrames(d,a.id,P.framesFromCells(a,[0,1,2,3,4,5].map(i=>({x:(i%3)*32,y:Math.floor(i/3)*32,w:32,h:32}))))));''')
    wait_gen(p);p.wait_for_selector('[data-frame="5"]')
    ok('frames cut in the document are the animation here: 6 frames, the canvas shows frame 1 (32×32)',js(p,'const r=T.region();return [r.w,r.h,T.S.frame];')==[32,32,0] and p.locator('.tx-frame').count()==6)
    js(p,'S.view.zoomTo(12);S.view.reveal({x:0,y:0,w:32,h:32});');settle(p,300)
    res=js(p,LIT_CHECK,{'pts':[[x,y] for y in range(4,30,2) for x in range(10,22,2)],'flip':False})
    ok('lit preview pixels read back from WebGL2 equal the Godot-compatible reference model (≤ 1/255)',len(res)>20 and max(r['d'] for r in res)<=1,str(sorted(res,key=lambda r:-r['d'])[:2]))
    shot(p,'01-torch-lit-1440.png')
    # ------------------------------------------------------------ lights
    before=len(js(p,'return S.history.entries.slice(0,S.history.index);'))
    l0=entry(p)['scene']['lights'][0]
    a=screen_of(p,l0['x'],l0['y']);b=screen_of(p,24,8)
    p.keyboard.press('l');p.mouse.move(a['x'],a['y']);p.mouse.down();
    for k in range(1,6):p.mouse.move(a['x']+(b['x']-a['x'])*k/5,a['y']+(b['y']-a['y'])*k/5)
    p.mouse.up();settle(p)
    l1=entry(p)['scene']['lights'][0]
    ok('dragging a light moves it in frame pixels, as ONE undo step',abs(l1['x']-24.5)<=1 and abs(l1['y']-8.5)<=1 and len(js(p,'return S.history.entries.slice(0,S.history.index);'))==before+1,str(l1))
    res2=js(p,LIT_CHECK,{'pts':[[x,y] for y in range(4,30,3) for x in range(10,22,3)],'flip':False})
    ok('after the move the lit pixels still equal the reference',max(r['d'] for r in res2)<=1)
    p.keyboard.press('Control+z');settle(p)
    ok('undo puts the light back',abs(entry(p)['scene']['lights'][0]['x']-l0['x'])<.01)
    c=screen_of(p,5,26);p.keyboard.down('Shift');p.mouse.click(c['x'],c['y']);p.keyboard.up('Shift');settle(p)
    ok('Shift+click adds a light there',len(entry(p)['scene']['lights'])==2 and abs(entry(p)['scene']['lights'][1]['x']-5.5)<=.5)
    p.keyboard.press('Delete');settle(p)
    ok('Delete removes the selected light',len(entry(p)['scene']['lights'])==1)
    # ------------------------------------------------------------ brush
    n_before=js(p,'return Array.from(T.S.gen.normal);')
    p.keyboard.press('b');s0=screen_of(p,12,12);s1=screen_of(p,20,20)
    p.mouse.move(s0['x'],s0['y']);p.mouse.down()
    for k in range(1,8):p.mouse.move(s0['x']+(s1['x']-s0['x'])*k/7,s0['y']+(s1['y']-s0['y'])*k/7)
    p.mouse.up();wait_gen(p)
    st=entry(p)
    n_after=js(p,'return Array.from(T.S.gen.normal);')
    W=96
    changed_out=[i for i in range(0,len(n_after),4) if n_after[i:i+3]!=n_before[i:i+3] and ((i//4)%W>=32 or (i//4)//W>=32)]
    changed_in=[i for i in range(0,len(n_after),4) if n_after[i:i+3]!=n_before[i:i+3]]
    ok('a height stroke is recorded with its frame clip, changes normals, and only inside frame 1',len(st['strokes'])==1 and st['strokes'][0]['clip']=={'x':0,'y':0,'w':32,'h':32} and len(changed_in)>10 and not changed_out,f'{len(changed_in)} {len(changed_out)}')
    p.keyboard.press('Control+z');wait_gen(p)
    ok('undo removes the stroke and restores the exact normals',js(p,'return Array.from(T.S.gen.normal);')==n_before and not entry(p)['strokes'])
    p.keyboard.press('Control+Shift+z');wait_gen(p);p.keyboard.press('Control+z');wait_gen(p)
    # ------------------------------------------------------------ sliders, pixel art
    before=len(js(p,'return S.history.entries.slice(0,S.history.index);'))
    rng=p.locator('[data-k="normal.strength"]');box=rng.bounding_box()
    p.mouse.move(box['x']+box['width']*.15,box['y']+box['height']/2);p.mouse.down()
    for k in range(1,6):p.mouse.move(box['x']+box['width']*(.15+k*.06),box['y']+box['height']/2)
    p.mouse.up();wait_gen(p)
    ok('dragging a slider is ONE undo step and regenerates the map',len(js(p,'return S.history.entries.slice(0,S.history.index);'))==before+1 and entry(p)['params']['normal']['strength']>1.1,f"{len(js(p,'return S.history.entries.slice(0,S.history.index);'))-before} {entry(p)['params']['normal']['strength']}")
    p.locator('[data-k="pixel.on"]').check();wait_gen(p)
    dirs=js(p,'const n=T.S.gen.normal,m=T.S.gen.mask,s=new Set();for(let p=0;p<m.length;p++)if(m[p])s.add(n[p*4]+","+n[p*4+1]+","+n[p*4+2]);return s.size;')
    ok('pixel-art normals: at most 8 directions × 2 tilts + flat inside the sprite',0<dirs<=17,str(dirs))
    shot(p,'02-torch-pixel-normals-1440.png')
    p.keyboard.press('Control+z');wait_gen(p)
    # ------------------------------------------------------------ playback, compare
    p.keyboard.press('Enter');p.wait_for_timeout(450);f1=js(p,'return T.S.frame;');p.wait_for_timeout(300);f2=js(p,'return T.S.frame;');p.keyboard.press('Enter')
    ok('Enter plays the animation lit (the frame advances) and stops it',f1!=f2 and not js(p,'return T.S.playing;'))
    p.keyboard.press('c');settle(p,250)
    split=js(p,'return T.S.split;')
    left=js(p,'const v=S.view,lit=T.lit(),r=T.region(),pic=T.S.pic;for(let y=4;y<30;y++)for(let x=0;x<arg-1;x++){const i=((r.y+y)*pic.w+r.x+x)*4;if(pic.rgba[i+3]===255){const dx=Math.floor(v.view.x+(x+.5)*v.view.scale),dy=Math.floor(v.view.y+(y+.5)*v.view.scale);return [lit.read(dx,dy).slice(0,3),[pic.rgba[i],pic.rgba[i+1],pic.rgba[i+2]]];}}return null;',split)
    ok('C splits the view: left of the line is the flat (unlit) picture, byte for byte',split==16 and left and left[0]==left[1],str(left))
    shot(p,'03-torch-compare-1440.png');p.keyboard.press('c')
    # ------------------------------------------------------------ texture set
    p.set_input_files('input[type=file][multiple]',[str(FIX/f) for f in ['bricks_Color.png','bricks_NormalGL.png','bricks_NormalDX.png','bricks_Displacement.png','bricks_Roughness.png','bricks_AmbientOcclusion.png']])
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===7');js(p,'await S.showAsset(S.doc.assets.find(a=>a.name==="bricks_Color.png").id);');wait_gen(p)
    ok('an opaque picture is suggested as a tileable texture, with Wrap edges',p.locator('[data-k="kind-texture"][aria-checked="true"]').count()==1 and entry(p)['params']['normal']['edge']=='tile')
    p.wait_for_selector('[data-tex="seam-roll"]',timeout=20000)
    ok('seam check: the wrap test is exactly 0 on the real tileable bricks',p.locator('[data-tex="seam-roll"]').get_attribute('data-border')=='0' and p.get_by_text('Wrap-correct').count()==1)
    p.click('[data-k="normal.edge-clamp"]');wait_gen(p);p.wait_for_function('()=>document.querySelector(\'[data-tex="seam-roll"]\')?.dataset.border!=="0"',timeout=20000)
    ok('with Clamp the same test shows a border error and says to use Wrap',float(p.locator('[data-tex="seam-roll"]').get_attribute('data-border'))>.3 and p.get_by_text('choose Wrap').count()==1)
    p.keyboard.press('Control+z');wait_gen(p)
    p.keyboard.press('t');settle(p,300);shot(p,'04-bricks-tiled-lit-1440.png');p.keyboard.press('t')
    # imported DirectX map
    dx_id=js(p,'return S.doc.assets.find(a=>a.name==="bricks_NormalDX.png").id;')
    p.select_option('[data-k="normalFrom"]',dx_id);wait_gen(p);p.wait_for_selector('[data-tex="convention"]',timeout=20000)
    v=p.locator('[data-tex="convention"]')
    ok('the imported normal map is detected as DirectX with high confidence (and the file name agrees)',v.get_attribute('data-convention')=='directx' and v.get_attribute('data-confidence')=='high' and p.get_by_text('The file name also says DirectX').count()==1)
    ok('the canvas says so too (a warning chip that opens Check)',p.locator('[data-tex="conv-warn"]').count()==1)
    ok('the detection is not applied until confirmed',entry(p)['normalDeclared'] is None and not js(p,'return T.S.gen.imported&&T.entry().normalDeclared==="directx";'))
    shot(p,'05-dx-detected-1440.png')
    p.click('[data-action="tex-declare-directx"]');settle(p,300)
    js(p,'S.view.zoomTo(2);S.view.reveal({x:0,y:0,w:64,h:64});');settle(p,250)
    res=js(p,LIT_CHECK,{'pts':[[x,y] for y in range(3,60,6) for x in range(3,60,6)],'flip':True})
    ok('confirmed as DirectX, it is lit with green flipped — equal to the reference of the OpenGL original',len(res)>50 and max(r['d'] for r in res)<=1)
    gl=js(p,'const R=await import("/src/studio/sprite/frame-render.js"),a=S.doc.assets.find(a=>a.name==="bricks_NormalGL.png");return Array.from((await R.blobRGBA(S.images,a.cels[0].blob)).data.slice(0,4000));')
    dxb=js(p,'return Array.from(T.S.gen.normal.slice(0,4000));')
    ok('…and that DX file is exactly the GL file with green inverted (fixture ground truth)',all(dxb[i]==(255-gl[i] if i%4==1 else gl[i]) for i in range(0,4000) if i%4!=3))
    # channel pack
    p.select_option('[data-k="pack.preset"]','godot-orm');settle(p)
    with p.expect_download() as dl:p.click('[data-action="tex-pack"]')
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===8',timeout=20000)
    packed=js(p,'''const R=await import("/src/studio/sprite/frame-render.js"),by=n=>S.doc.assets.find(a=>a.name===n);const q=await R.blobRGBA(S.images,by("bricks_Color_godot-orm.png").cels[0].blob),ao=await R.blobRGBA(S.images,by("bricks_AmbientOcclusion.png").cels[0].blob),ro=await R.blobRGBA(S.images,by("bricks_Roughness.png").cels[0].blob);
      let bad=0;for(let p=0;p<q.width*q.height;p++){if(q.data[p*4]!==ao.data[p*4]||q.data[p*4+1]!==ro.data[p*4]||q.data[p*4+2]!==0||q.data[p*4+3]!==255)bad++;}return bad;''')
    ok('Godot ORM pack: R = the AO file, G = the roughness file, B = 0, byte for byte',packed==0,str(packed))
    # ------------------------------------------------------------ export
    js(p,'await S.showAsset(S.doc.assets[0].id);');wait_gen(p)
    with p.expect_download() as dl:p.click('[data-action="tex-export"]')
    z=zipfile.ZipFile(io.BytesIO(Path(dl.value.path()).read_bytes()));names=z.namelist()
    need=['godot/torch_sheet.png','godot/torch_sheet_n.png','godot/torch_sheet_lit.tscn','godot/torch_sheet_canvas_texture.tres','unity/Editor/NerulioNormalMapImporter.cs','unity/nerulio-texture.json','generic/torch_sheet_n_dx.png','generic/torch_sheet_height16.png','generic/nerulio-texture.json']
    ok('export ZIP: Godot scene + CanvasTexture, Unity importer + JSON, generic set with both conventions',all(n in names for n in need),str(names))
    ok('the albedo in the ZIP is the imported PNG byte for byte',z.read('godot/torch_sheet.png')==(FIX/'torch_sheet.png').read_bytes())
    hdr=z.read('generic/torch_sheet_height16.png')[16:26]
    ok('the height map is a 16-bit greyscale PNG',hdr[8]==16 and hdr[9]==0)
    tscn=z.read('godot/torch_sheet_lit.tscn').decode()
    ok('the Godot scene animates the 6 frames and places the light where the Studio shows it',tscn.count('Rect2(')>=7 and 'type="PointLight2D"' in tscn and 'normal_texture = ExtResource' in tscn)
    ok('Unity is labelled UNVERIFIED in the panel and the README',p.locator('[data-target="unity"]').locator('xpath=..').get_by_text('UNVERIFIED').count()==1 and 'UNVERIFIED' in z.read('unity/README.md').decode())
    shot(p,'06-export-1440.png')
    # ------------------------------------------------------------ .nerulio round trip + recovery
    js(p,'const L=T.entry();');p.keyboard.press('l')
    a=screen_of(p,3,3);p.keyboard.down('Shift');p.mouse.click(a['x'],a['y']);p.keyboard.up('Shift');settle(p)
    saved=tex_state(p)
    with p.expect_download() as dl:p.keyboard.press('Control+s')
    proj=Path(dl.value.path())
    p.wait_for_function('()=>document.querySelector(".studio").dataset.autosave==="idle"',timeout=15000);settle(p,300)
    p.goto(BASE+'/en/game/studio/?ws=texture')
    p.wait_for_selector('.st-recover',timeout=20000)
    p.click('.st-recover button:has-text("Restore")')
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===8',timeout=20000);wait_gen(p)
    ok('autosave recovery brings the texture settings back (lights, params, declared convention)',tex_state(p)==saved)
    js(p,'await S.runCommand("file.new");');settle(p,500)
    p.set_input_files('input[type=file]:not([multiple])',str(proj))
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===8',timeout=20000);wait_gen(p)
    ok('.nerulio round trip: settings.texture is identical after reopening the file',tex_state(p)==saved)
    # ------------------------------------------------------------ locales, keyboard
    js(p,'S.runCommand("help.lang.ko");');settle(p,300)
    ok('ko: panels and view switch are translated',p.get_by_text('노멀 맵').first.is_visible() and p.locator('[data-tex-view="lit"]').inner_text()=='조명')
    shot(p,'07-ko-1440.png')
    js(p,'S.runCommand("help.lang.ja");');settle(p,300)
    ok('ja: panels are translated',p.locator('[data-tex-view="normal"]').inner_text()=='法線')
    js(p,'S.runCommand("help.lang.en");');settle(p,200)
    p.keyboard.press('Alt+3');settle(p)
    ok('Alt+3 switches to the Normal view; Alt+4 back to Lit',js(p,'return T.prefs.view;')=='normal')
    p.keyboard.press('Alt+4');settle(p)
    # ------------------------------------------------------------ 390 px
    m=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True);q=m.new_page()
    q.on('pageerror',lambda e:errors.append(str(e)))
    q.goto(BASE+'/en/game/studio/?ws=texture');ready(q)
    q.set_input_files('input[type=file][multiple]',[str(FIX/'torch_sheet.png')]);wait_gen(q)
    ok('390 px: the view switch fits, nothing scrolls sideways',q.evaluate('document.documentElement.scrollWidth<=390') and q.locator('[data-tex-view="lit"]').is_visible())
    shot(q,'08-m-lit-390.png')
    q.locator('.st-compact-only[aria-label="Panels"]').click();settle(q,400)
    q.locator('.st-sheet .st-tab',has_text='Normal map').click();settle(q,300)
    shot(q,'09-m-panels-390.png')
    ok('390 px: the panels open in the sheet and the normal-map controls are usable',q.locator('[data-k="normal.strength"]').is_visible())
    m.close()
    ok('no page errors',not errors,str(errors[:5]))
    browser.close()
print(f'{len(checks)} checks passed')
