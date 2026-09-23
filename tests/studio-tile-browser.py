"""Studio Tile workspace (P3) in Chromium, with real CC0 tilesets (tests/fixtures/tile/).

Import → grid suggestion (nothing applied until asked) → layout identification with confidence →
preview → apply (bits equal the GameMaker truth) → check panel (no false ✓) → bit painting with
undo → validation after a mistake → test map with the Godot rule (a missing tile is flagged) →
Tiled rule → bits from pixels on a template (no layout) → generator from an RPG Maker A2 block and
a live source edit that updates the linked set in one undo step → export ZIP contents for every
target → autosave recovery → ko/ja → keyboard → 390 px layout. Screenshots go to SHOTS.

    PORT=4481 node tools/serve.mjs  then  TEST_URL=http://127.0.0.1:4481 python tests/studio-tile-browser.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import io, json, os, sys, zipfile, re
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
SHOTS=Path(os.environ.get('TILE_SHOTS',ROOT/'test-results'/'studio-tile'));SHOTS.mkdir(parents=True,exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
FIX=ROOT/'tests'/'fixtures'/'tile'
CAVE=FIX/'cave-autotile47.png'; GMS=FIX/'gms-47-template.png'; A2=FIX/'coolschool-A2.png'; WANG=FIX/'wang-2corner.png'
# GameMaker Studio 2 47-tile order (corpus manifest truth, cr31 weights N1 NE2 E4 SE8 S16 SW32 W64 NW128)
GM=[[None,127,253,125,247,119,245,117],[223,95,221,93,215,87,213,85],[31,29,23,21,124,116,92,84],[241,209,113,81,199,71,197,69],[17,68,28,20,112,80,193,65],[7,5,16,4,1,64,0,255]]
W=[1,2,4,8,16,32,64,128]
checks=[];errors=[]
def ok(name,cond,detail=''):
    if not cond:raise AssertionError(f'{name} {detail}')
    checks.append(name);print('PASS',name,flush=True)
def js(p,body,arg=None):return p.evaluate('(arg)=>{const S=window.nerulioStudio;'+body+'}',arg)
def ready(p):p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"',timeout=30000)
def tile_state(p):return js(p,'return JSON.parse(JSON.stringify(S.doc.settings.tile||{}));')
def active_ts(p):return js(p,'const s=S.doc.settings.tile||{};return Object.values(s.tilesets||{}).find(t=>t.assetId===S.activeAssetId)||null;')
def mask_of(pat):return sum(W[i] for i in range(8) if pat[i+1]==pat[0])
def shot(p,name):p.screenshot(path=str(SHOTS/name))
def image_point(p,ix,iy):
    return js(p,'const v=S.view,r=v.stage.getBoundingClientRect();return {x:r.left+(v.view.x+arg[0]*v.view.scale)*r.width/v.W,y:r.top+(v.view.y+arg[1]*v.view.scale)*r.height/v.H};',[ix,iy])
def panel(p,pid):
    el=p.locator(f'[data-tile-panel="{pid}"]');el.scroll_into_view_if_needed();return el
def wait_ts_tiles(p,n,timeout=20000):p.wait_for_function('(n)=>{const S=window.nerulioStudio,s=S.doc.settings.tile||{};const t=Object.values(s.tilesets||{}).find(x=>x.assetId===S.activeAssetId);return t&&Object.keys(t.tiles).length===n}',arg=n,timeout=timeout)
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:m.type=='error' and errors.append(m.text[:200]))
    p.goto(BASE+'/en/game/studio/?ws=tile');ready(p)
    ok('?ws=tile opens the Tile workspace; its tools and panels are there',js(p,'return S.workspace;')=='tile' and p.locator('[data-tool="tile-bits"]').count()==1 and p.locator('[data-tile-panel="tile-set"]').count()==1 and p.locator('[data-tile-panel="tile-check"]').count()==1)
    # ------------------------------------------------------------ import + grid
    p.set_input_files('input[type=file][multiple]',[str(CAVE)])
    p.wait_for_selector('[data-grid-sug="0"]',timeout=30000)
    first=p.locator('[data-grid-sug="0"]').inner_text()
    ok('grid suggestion: 64×64 first, with the layout that fits it named',first.startswith('64×64') and 'GameMaker' in first,first)
    ok('nothing is applied before "Use this grid"',not tile_state(p).get('tilesets'))
    shot(p,'01-import-grid-1440.png')
    p.click('[data-action="tile-apply-grid"]');wait_ts_tiles(p,0)
    ts=active_ts(p)
    ok('the tileset is 8×6 tiles of 64 px',ts['grid']['w']==64 and ts['grid']['cols']==8 and ts['grid']['rows']==6)
    # ------------------------------------------------------------ layout identification
    p.wait_for_selector('[data-cand]',timeout=30000)
    cand=p.locator('[data-cand]').first
    ok('the first layout candidate is GameMaker 47, with a confidence and its seam score',cand.get_attribute('data-cand')=='blob47-gamemaker' and re.search(r'seam score \d',cand.inner_text()) and re.search(r'(HIGH|MEDIUM)',cand.inner_text(),re.I),cand.inner_text())
    cand.click();p.wait_for_selector('[data-tile="preview"]')
    ok('a candidate is a preview only: the document is unchanged',len(active_ts(p)['tiles'])==0)
    shot(p,'02-layout-preview-1440.png')
    p.click('[data-action="tile-apply-preview"]');wait_ts_tiles(p,47)
    ts=active_ts(p);wrong=[]
    for r,row in enumerate(GM):
        for c,m in enumerate(row):
            t=ts['tiles'].get(f'{c},{r}')
            if (m is None)!=(t is None) or (t and mask_of(t['pattern'])!=m):wrong.append((c,r))
    ok('after Apply all 47 tiles carry exactly the GameMaker truth bits',not wrong,str(wrong[:5]))
    p.wait_for_selector('[data-verdict="complete"]',timeout=20000)
    ok('check panel: complete only after the art check agrees (measured, not assumed)',p.locator('[data-check="art-ok"]').count()==1)
    shot(p,'03-applied-check-1440.png')
    p.keyboard.press('Control+z');wait_ts_tiles(p,0)
    ok('undo removes the applied bits',len(active_ts(p)['tiles'])==0)
    p.keyboard.press('Control+Shift+z');wait_ts_tiles(p,47)
    ok('redo brings them back',len(active_ts(p)['tiles'])==47)
    # ------------------------------------------------------------ paint a bit on the canvas
    js(p,'S.view.zoomTo(2);S.view.reveal({x:448,y:320,w:64,h:64});')
    p.keyboard.press('b');p.wait_for_timeout(150)
    pt=image_point(p,7*64+32,5*64+8)  # full tile (7,5), top zone
    p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(300)
    t=active_ts(p)['tiles']['7,5']['pattern']
    ok('bit painting: clicking the top zone of the full tile clears its N bit',t[1]==-1 and t[3]==0,str(t))
    p.wait_for_selector('[data-verdict="open"]',timeout=10000)
    ok('the check panel reacts at once: not complete, a combination is missing',p.locator('[data-check="missing"]').first.get_attribute('data-missing')!='0')
    shot(p,'04-bit-painted-1440.png')
    p.keyboard.press('Control+z');p.wait_for_timeout(300)
    ok('one click = one undo step',active_ts(p)['tiles']['7,5']['pattern'][1]==0)
    # remove the isolated tile's bits via selection + Delete (tile 6,5 is mask 0)
    p.keyboard.press('v');p.wait_for_timeout(100)
    pt=image_point(p,6*64+32,5*64+32);p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(150)
    ok('the Tile panel shows the selected tile',p.locator('[data-tile-panel="tile-tile"]').inner_text().find('Tile 6,5')>=0)
    p.keyboard.press('Delete');p.wait_for_timeout(300)
    ok('Delete clears the selected tile',active_ts(p)['tiles'].get('6,5') is None)
    # ------------------------------------------------------------ test map
    p.click('[data-action="tile-new-map"]');p.wait_for_function('()=>document.querySelector(".studio").dataset.tileMode==="map"',timeout=10000)
    ok('a new test map opens in map view with the brush',js(p,'return S.tool;')=='tile-brush')
    js(p,'S.view.zoomTo(1);')
    p.wait_for_timeout(300)
    pt=image_point(p,5*64+32,5*64+32);p.mouse.click(pt['x'],pt['y']);p.wait_for_timeout(500)
    ok('a lone painted cell with no isolated tile is flagged: Godot leaves it empty',p.locator('[data-verdict="map-open"]').get_attribute('data-missing')=='1')
    shot(p,'05-map-missing-1440.png')
    p.keyboard.press('Control+z');p.wait_for_timeout(200);p.keyboard.press('Control+z');p.wait_for_timeout(200);p.keyboard.press('Control+z');p.wait_for_timeout(400)
    ok('undo back to before the Delete restores the isolated tile',active_ts(p)['tiles'].get('6,5') is not None)
    ok('...and undoing the map creation removed the map (map edits are undoable too)',not tile_state(p).get('maps'))
    mode=lambda:js(p,'return document.querySelector(".studio").dataset.tileMode;')
    if mode()=='map':p.keyboard.press('m');p.wait_for_timeout(400)
    ok('M toggles between the test map and the sheet',mode()=='tileset')
    p.click('[data-action="tile-new-map"]');p.wait_for_function('()=>document.querySelector(".studio").dataset.tileMode==="map"',timeout=10000)
    p.click('[data-action="tile-random"]');p.wait_for_selector('[data-verdict="map-ok"]',timeout=10000)
    ok('random terrain on a complete set: every painted cell gets a correct tile (Godot rule)',p.locator('[data-verdict="map-ok"]').count()==1)
    shot(p,'06-map-ok-1440.png')
    p.click('[data-rule="tiled"]');p.wait_for_timeout(600)
    m=js(p,'return Object.values(S.doc.settings.tile.maps)[0];');cells=m['layers'][0]['cells']
    at=lambda x,y:0<=x<m['w'] and 0<=y<m['h'] and cells[y*m['w']+x]!='.'
    lone=sum(1 for y in range(m['h']) for x in range(m['w']) if at(x,y) and not any(at(x+dx,y+dy) for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]))
    v=p.locator('[data-verdict]').first
    ok('Tiled rule: the only gaps are lone cells (Tiled drops the all-zero Wang ID of the isolated tile)',int(v.get_attribute('data-missing') or 0)==lone and int(v.get_attribute('data-wrong') or 0)==0,f'{v.get_attribute("data-missing")} vs {lone}')
    # drag a stroke: one undo step
    p.click('[data-action="tile-clear-map"]');p.wait_for_timeout(300)
    js(p,'S.view.fit();');p.wait_for_timeout(200)
    before=js(p,'return Object.values(S.doc.settings.tile.maps)[0].layers[0].cells;')
    a=image_point(p,64+32,64+32);b=image_point(p,64*8+32,64+32)
    p.keyboard.press('p');p.mouse.move(a['x'],a['y']);p.mouse.down();p.mouse.move(b['x'],b['y'],steps=8);p.mouse.up();p.wait_for_timeout(300)
    after=js(p,'return Object.values(S.doc.settings.tile.maps)[0].layers[0].cells;')
    p.keyboard.press('Control+z');p.wait_for_timeout(300)
    undone=js(p,'return Object.values(S.doc.settings.tile.maps)[0].layers[0].cells;')
    hl=js(p,'return S.history.list().slice(-4).map(x=>x.label+(x.applied?"":" (undone)"));')
    ok('a brush stroke across 8 cells is one undo step',after!=before and undone==before,str((before.count('.'),after.count('.'),undone.count('.'),hl)))
    p.keyboard.press('m');p.wait_for_timeout(400)
    # ------------------------------------------------------------ bits from pixels, no layout (GameMaker template)
    p.set_input_files('input[type=file][multiple]',[str(GMS)]);p.wait_for_selector('[data-action="tile-apply-grid"]:not([disabled])',timeout=30000)
    p.click('[data-action="tile-apply-grid"]');wait_ts_tiles(p,0)
    p.click('[data-action="tile-suggest"]');p.wait_for_selector('[data-tile="preview"]',timeout=30000)
    p.click('[data-action="tile-apply-preview"]');p.wait_for_timeout(500)
    ts=active_ts(p);good=sum(1 for r,row in enumerate(GM) for c,m in enumerate(row) if m is not None and ts['tiles'].get(f'{c},{r}') and mask_of(ts['tiles'][f'{c},{r}']['pattern'])==m)
    ok('bits read from the pixels alone (no layout) equal the truth on the GameMaker template',good==47,f'{good}/47')
    ok('two tilesets are listed in this project',p.locator('.tl-setitem').count()==2)
    # ------------------------------------------------------------ generator from an RPG Maker A2 sheet (by size)
    p.set_input_files('input[type=file][multiple]',[str(A2)]);p.wait_for_selector('[data-grid-sug]',timeout=30000)
    for k,v in {'w':48,'h':48,'ox':0,'oy':0,'sx':0,'sy':0}.items():
        p.fill(f'[data-tile-grid="{k}"]',str(v));p.locator(f'[data-tile-grid="{k}"]').dispatch_event('change')
    p.click('[data-action="tile-apply-grid"]');wait_ts_tiles(p,0)
    p.wait_for_selector('[data-action="tile-hint"]',timeout=30000)
    ok('a seamless A2 floor is not claimed from pixels; its size names RPG Maker A2',p.locator('.tl-cand.is-hint').inner_text().find('RPG Maker A2')>=0)
    p.click('[data-action="tile-hint"]');panel(p,'tile-gen')
    p.click('[data-action="tile-generate"]');p.wait_for_function('()=>window.nerulioStudio.doc.assets.length===4',timeout=30000)
    wait_ts_tiles(p,47)
    st=tile_state(p);gen_id=js(p,'return S.activeAssetId;')
    ok('Generate adds a new 47-tile image linked to its source block',gen_id in st.get('links',{}) and len(active_ts(p)['tiles'])==47)
    blobs=lambda:js(p,'return S.doc.assets.map(a=>a.cels[0].blob);')
    b0=blobs()
    panel(p,'tile-gen');ed=p.locator('[data-tile="source-editor"]');ed.wait_for(timeout=10000);ed.scroll_into_view_if_needed()
    box=ed.bounding_box();p.mouse.click(box['x']+box['width']*0.3,box['y']+box['height']*0.8);p.wait_for_function('(b)=>{const x=window.nerulioStudio.doc.assets.map(a=>a.cels[0].blob);return x[2]!==b[2]&&x[3]!==b[3]}',arg=b0,timeout=20000)
    ok('drawing on the source changes the source AND the generated set (edit one, all update)',True)
    shot(p,'07-generator-1440.png')
    p.keyboard.press('Control+z');p.wait_for_timeout(500)
    ok('one undo restores both images',blobs()==b0)
    # ------------------------------------------------------------ export
    js(p,'S.showAsset(S.doc.assets[0].id);');p.wait_for_timeout(800)
    panel(p,'tile-export')
    with p.expect_download() as d:p.click('[data-action="tile-export"]')
    z=zipfile.ZipFile(io.BytesIO(Path(d.value.path()).read_bytes()));names=z.namelist()
    gj=json.loads(z.read('godot/nerulio-tileset.json'))
    ok('export ZIP has Godot, Tiled, LDtk, Unity and generic folders plus NOTES.txt',all(any(n.startswith(t+'/') for n in names) for t in ['godot','tiled','ldtk','unity','generic']) and 'NOTES.txt' in names,str(names))
    ok('Godot JSON: 47 tiles, corners-and-sides, peering bits per tile (the full tile has 8)',len(gj['tileSet']['tiles'])==47 and gj['tileSet']['terrainSets'][0]['mode']=='match_corners_and_sides' and any(len(t['peering'])==8 for t in gj['tileSet']['tiles']))
    tsx=[n for n in names if n.endswith('.tsx')][0]
    ok('Tiled TSX: one wangset with 46 wang tiles (the isolated tile has an all-zero Wang ID, which Tiled drops) and a sample TMX',z.read(tsx).decode().count('<wangtile ')==46 and 'tiled/sample.tmx' in names)
    ld=json.loads(z.read([n for n in names if n.endswith('.ldtk')][0]))
    ok('LDtk: IntGrid layer with 47 rules and a sample level with placed tiles',len(ld['defs']['layers'][0]['autoRuleGroups'][0]['rules'])==47 and len(ld['levels'][0]['layerInstances'][0]['autoLayerTiles'])>0)
    ok('Unity: rule JSON + the editor script that builds RuleTiles',json.loads(z.read('unity/nerulio-ruletile.json'))['terrains'][0]['rules'].__len__()==47 and 'unity/Editor/NerulioRuleTileImporter.cs' in names)
    ok('NOTES.txt states what each target was verified with (no unverified claim hidden)',re.search(r'godot: VERIFIED',z.read('NOTES.txt').decode()) is not None)
    shot(p,'08-export-1440.png')
    # ------------------------------------------------------------ autosave + recovery
    p.wait_for_function('()=>{const a=window.nerulioStudio.autosave;return !a.pending&&!a.saving&&a.lastAt>0}',timeout=15000)
    snap=tile_state(p)
    p.reload();p.wait_for_function('()=>document.documentElement.dataset.studioReady==="1"',timeout=30000)
    p.locator('.st-recover').wait_for(timeout=10000);p.locator('.st-recover .primary').click()
    p.wait_for_function('()=>Object.keys((window.nerulioStudio.doc.settings.tile||{}).tilesets||{}).length===4',timeout=15000)
    ok('reload + restore brings back every tileset, map and link exactly',tile_state(p)==snap)
    # ------------------------------------------------------------ languages + keyboard
    for loc,tab,title in [('ko','타일','타일셋'),('ja','タイル','タイルセット')]:
        p2=ctx.new_page();p2.goto(BASE+f'/{loc}/game/studio/?ws=tile');p2.wait_for_function('()=>document.documentElement.dataset.studioReady==="1"',timeout=30000);p2.wait_for_timeout(800)
        if p2.locator('.st-recover').count():p2.locator('.st-recover button[data-value="new"]').click()
        ok(f'{loc}: Tile workspace tab and panels are translated',p2.locator('.st-ws-tab[data-ws="tile"]').inner_text().startswith(tab) and p2.locator('.st-panel-head',has_text=title).count()>=1)
        p2.close()
    p.keyboard.press('p');ok('P = terrain brush',js(p,'return S.tool;')=='tile-brush')
    p.keyboard.press('g');ok('G = fill',js(p,'return S.tool;')=='tile-bucket')
    p.keyboard.press('v');ok('V = select tiles',js(p,'return S.tool;')=='tile-select')
    # ------------------------------------------------------------ phone
    m=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True);q=m.new_page()
    q.on('pageerror',lambda e:errors.append('mobile: '+str(e)))
    q.goto(BASE+'/en/game/studio/?ws=tile');ready(q)
    if q.locator('.st-recover').count():q.locator('.st-recover button[data-value="new"]').click()
    q.set_input_files('input[type=file][multiple]',[str(CAVE)]);q.wait_for_timeout(2500)
    ok('390 px: no horizontal scroll, canvas and tool bar visible',q.evaluate('document.scrollingElement.scrollWidth<=innerWidth+1') and q.locator('.cv-stage').is_visible())
    q.screenshot(path=str(SHOTS/'09-phone-390.png'))
    m.close()
    ok('no page errors or console errors',not errors,str(errors[:5]))
    browser.close()
print(f'{len(checks)} checks passed')
