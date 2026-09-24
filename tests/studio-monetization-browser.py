"""Studio monetization in Chromium (docs/ADS.md "Studio ad column", docs/PRICING-MODEL.md).

Builds two static deployments into temporary dist/ directories and serves each with
tools/serve.mjs --dist on its own free port (never 4173/4174, never Google):
  * plain     — no ad configuration: the Studio has no ad DOM, no Google request and does not
                even load the monetization modules;
  * ads       — ADSENSE_CLIENT + ADSENSE_SLOT_STUDIO + ADSENSE_CMP_READY, no accounts (every
                visitor is Free). Google's script is intercepted and replaced by a stub that
                fills the unit after a delay, or aborted to act as an ad blocker.
Checks: labelled column at 1440/1920 (160×600 / 300×600), none at 390/768/1024, one unit, no
refresh, no interactive control within 20 px of the unit (24 px for export/save/open/download
controls) across the Viewer, Pack & Export, Tile and Texture workspaces, menus and dialog
backdrops never cover it, the canvas never moves when the ad loads/fails (layout-shift entries
and canvas box), and a blocked ad script leaves the editor fully working (real Kenney CC0 sheet
imported, packed and exported). Free-vs-Pro, the limit dialog and outages need the account
Worker + D1 and live in tests/service-browser.py (scenario_studio).

Standalone: python tests/studio-monetization-browser.py  (SHOTS=<dir> for screenshots)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os,shutil,socket,subprocess,sys,tempfile,time,urllib.request,zipfile
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
SHOTS=Path(os.environ.get('SHOTS',OUT/'studio-monetization'));SHOTS.mkdir(parents=True,exist_ok=True)
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
FIX=ROOT/'tests'/'fixtures'/'kenney'
AD_CLIENT='ca-pub-3141592653589793'# synthetic; requests to Google are intercepted
checks=[];errors=[]
def ok(name,cond,detail=''):
    if not cond:raise AssertionError(f'{name} {detail}')
    checks.append(name);print('PASS',name,flush=True)
def free_port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
class Deployment:
    def __init__(self,name,env):
        self.dir=Path(tempfile.mkdtemp(prefix=f'nerulio-mon-{name}-'));dist=self.dir/'dist'
        clean={k:v for k,v in os.environ.items() if not k.startswith(('ADSENSE_','CF_PAGES','SITE_','SERVICE_','PRO_PRICE','FREE_DAILY','PORT','BASE_PATH','DIST_DIR'))}
        r=subprocess.run(['node','-e',"import('./tools/build.mjs').then(m=>m.build({outDir:process.argv[1],env:process.env}))",str(dist)],cwd=ROOT,env={**clean,'SITE_URL':'https://nerulio.test',**env},capture_output=True,text=True,encoding='utf-8',errors='replace')
        if r.returncode:raise RuntimeError(r.stderr)
        self.port=free_port();self.url=f'http://127.0.0.1:{self.port}'
        self.log=open(self.dir/'server.log','w')
        self.proc=subprocess.Popen(['node','tools/serve.mjs','--dist'],cwd=ROOT,env={**clean,'PORT':str(self.port),'DIST_DIR':str(dist)},stdout=self.log,stderr=self.log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        for _ in range(200):
            try:urllib.request.urlopen(self.url+'/en/game/studio/',timeout=1);return
            except OSError:time.sleep(.1)
        raise RuntimeError(f'{name} server did not start')
    def close(self):
        self.proc.terminate()
        try:self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:self.proc.kill()
        self.log.close();shutil.rmtree(self.dir,ignore_errors=True)
# Stub for Google's script: fills every queued unit after 600 ms with a same-size block, the
# way a real creative arrives late. It never refreshes.
STUB="""(function(){const fill=()=>setTimeout(()=>{for(const i of document.querySelectorAll('ins.adsbygoogle:not([data-ad-status])')){i.dataset.adStatus='filled';i.dataset.stubFills=String(+(i.dataset.stubFills||0)+1);const d=document.createElement('div');d.className='stub-creative';d.style.cssText='width:'+i.style.width+';height:'+i.style.height+';background:linear-gradient(160deg,#f1ead8,#d9cfb4);color:#5a5140;font:600 13px system-ui;display:grid;place-items:center;text-align:center';d.textContent='Test ad '+parseInt(i.style.width)+'×'+parseInt(i.style.height);i.append(d);}},600);
const q=Array.isArray(window.adsbygoogle)?window.adsbygoogle:[];window.adsbygoogle={loaded:true,push:fill};q.forEach(fill);})();"""
UNFILLED="""(function(){const go=()=>setTimeout(()=>{for(const i of document.querySelectorAll('ins.adsbygoogle'))i.dataset.adStatus='unfilled';},300);const q=Array.isArray(window.adsbygoogle)?window.adsbygoogle:[];window.adsbygoogle={loaded:true,push:go};q.forEach(go);})();"""
INIT="""window.__shifts=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__shifts.push({v:e.value,input:e.hadRecentInput,t:e.startTime,src:(e.sources||[]).map(s=>s.node&&s.node.className&&String(s.node.className).slice(0,40))});}).observe({type:'layout-shift',buffered:true});}catch{}
window.__canvasBoxes=[];new MutationObserver((_,mo)=>{const w=document.querySelector('.st-canvas-wrap');if(!w)return;mo.disconnect();new ResizeObserver(()=>{const r=w.getBoundingClientRect();window.__canvasBoxes.push([Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]);}).observe(w);}).observe(document,{childList:true,subtree:true});"""
def started(p):p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"',timeout=30000)
def open_studio(ctx,dep,locale='en',ws=None,google='stub',log=None):
    p=ctx.new_page();p.add_init_script(INIT)
    p.on('pageerror',lambda e:errors.append(str(e)))
    reqs=[] if log is None else log
    p.on('request',lambda r:reqs.append(r.url))
    body={'stub':STUB,'unfilled':UNFILLED}.get(google)
    p.route('**/*googlesyndication*/**',(lambda route:route.fulfill(status=200,content_type='text/javascript',body=body)) if body else (lambda route:route.abort()))
    p.goto(f'{dep.url}/{locale}/game/studio/'+(f'?ws={ws}' if ws else ''));started(p)
    return p,reqs
def google(reqs):return [u for u in reqs if 'googlesyndication' in u or 'doubleclick' in u]
def state(p):return p.evaluate('()=>{const m=window.nerulioMonetization;return m?{decision:m.decision,mounted:!!m.ad?.mounted,size:m.ad?.size||null,script:m.ad?.script||null}:null}')
def boxes(p):
    return p.evaluate('''()=>{const col=document.querySelector('.st-ad');const slot=col?.querySelector('.st-ad-slot');if(!slot)return null;const u=slot.getBoundingClientRect(),c=col.getBoundingClientRect();
      const sel='button,a[href],input:not([type=hidden]),select,textarea,summary,[role=tab],[role=option],[role=menuitem],[tabindex]:not([tabindex="-1"]),.st-split,.cv-stage';
      const items=[...document.querySelectorAll(sel)].filter(e=>!col.contains(e)&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden]')).map(e=>{const r=e.getBoundingClientRect();
        const t=((e.getAttribute('aria-label')||e.textContent||'')+' '+(e.dataset.action||'')+' '+(e.dataset.export||'')+' '+(e.hasAttribute('data-export-main')?'export':'')).trim().slice(0,60);
        return {tag:e.tagName,cls:String(e.className).slice(0,40),text:t,left:r.left,top:r.top,right:r.right,bottom:r.bottom}}).filter(o=>o.right>o.left&&o.bottom>o.top);
      return {unit:{left:u.left,top:u.top,right:u.right,bottom:u.bottom,width:u.width,height:u.height},column:{left:c.left,right:c.right,width:c.width,top:c.top,bottom:c.bottom},items,vw:innerWidth};}''')
def dist(a,b):
    dx=max(0,b['left']-a['right'],a['left']-b['right']);dy=max(0,b['top']-a['bottom'],a['top']-b['bottom']);return (dx*dx+dy*dy)**.5
IMPORTANT=('export','save','open','download','import','내보내기','저장')
def check_clearance(p,label):
    b=boxes(p);ok(f'{label}: ad unit present',b is not None)
    near=[(round(dist(b['unit'],i),1),i['tag'],i['cls'],i['text']) for i in b['items'] if dist(b['unit'],i)<20]
    ok(f'{label}: no interactive control within 20 px of the ad unit ({len(b["items"])} controls measured)',not near,near[:5])
    imp=[(round(dist(b['unit'],i),1),i['text']) for i in b['items'] if i['tag'] in ('BUTTON','A','INPUT','SELECT') and any(k in i['text'].lower() for k in IMPORTANT) and dist(b['unit'],i)<24]
    ok(f'{label}: export/save/open controls keep 24 px from the unit',not imp,imp[:5])
    ok(f'{label}: the unit sits inside its own column at the right edge',b['column']['right']>=b['vw']-1 and b['unit']['left']>=b['column']['left']+19)
    return b
def import_sheet(p):
    p.set_input_files('input[type=file][multiple]:not([webkitdirectory])',[str(FIX/'tiny-dungeon-tilemap.png')])
    p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0',timeout=60000);p.wait_for_timeout(300)
def packed(p):
    p.wait_for_selector('[data-pack="efficiency"]',state='attached',timeout=120000)
    p.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")',timeout=120000);p.wait_for_timeout(150)
def export_pack(p):
    p.wait_for_function('()=>{const b=document.querySelector("[data-export-main]");return b&&!b.disabled}',timeout=120000)
    with p.expect_download(timeout=120000) as d:p.click('[data-export-main]')
    path=d.value.path();return zipfile.ZipFile(path).namelist()
def no_shift(p,label):
    p.wait_for_timeout(900)
    shifts=p.evaluate('window.__shifts');cls=sum(s['v'] for s in shifts if not s['input'])
    ok(f'{label}: cumulative layout shift ≈ 0 while the ad loads (CLS {cls:.4f})',cls<0.01,shifts)
    boxes_=p.evaluate('window.__canvasBoxes');distinct=sorted({tuple(b) for b in boxes_})
    ok(f'{label}: the canvas box never changed after its first layout',len(distinct)==1,distinct)
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    plain=Deployment('plain',{});ads=Deployment('ads',{'ADSENSE_CLIENT':AD_CLIENT,'ADSENSE_SLOT_STUDIO':'1234567890','ADSENSE_CMP_READY':'true'})
    try:
        # ---------------------------------------------------------------- ads disabled
        for w,h in [(1440,900),(1920,1080)]:
            ctx=browser.new_context(viewport={'width':w,'height':h});p,reqs=open_studio(ctx,plain);p.wait_for_timeout(800)
            ok(f'plain {w}: no ad DOM',p.locator('.st-ad,ins.adsbygoogle').count()==0)
            # meter.js + strings.js are the workspaces' tiny static imports; nothing of the ad or account layer loads
            extra=[u for u in reqs if ('/monetize/' in u and not u.endswith(('/meter.js','/strings.js'))) or 'entitlement.js' in u or 'service-content.js' in u]
            ok(f'plain {w}: no Google request, no ad/account module loaded',not google(reqs) and not extra,extra)
            ok(f'plain {w}: studio unchanged (no has-ad, no diagnostics object)',p.evaluate('()=>!document.querySelector(".studio.has-ad")&&window.nerulioMonetization===undefined'))
            ctx.close()
        # ---------------------------------------------------------------- ads enabled, desktop
        for (w,h),unit,col in [((1440,900),(160,600),200),((1920,1080),(300,600),340),((1280,720),(160,600),200)]:
            ctx=browser.new_context(viewport={'width':w,'height':h},accept_downloads=True);p,reqs=open_studio(ctx,ads)
            p.wait_for_selector('ins.adsbygoogle[data-ad-status="filled"]',timeout=10000)
            s=state(p);ok(f'ads {w}×{h}: decision is ads (no accounts on this build)',s['decision']['ads'] and s['mounted'],s)
            ok(f'ads {w}×{h}: exactly one fixed {unit[0]}×{unit[1]} unit',p.locator('ins.adsbygoogle').count()==1 and s['size']['width']==unit[0] and s['size']['height']==unit[1])
            ok(f'ads {w}×{h}: column is {col}px wide',abs(p.evaluate('document.querySelector(".st-ad").getBoundingClientRect().width')-col)<0.5)
            ok(f'ads {w}×{h}: labelled "Advertisement" above the unit',p.locator('.st-ad-label').inner_text().strip().lower()=='advertisement')
            ok(f'ads {w}×{h}: one Google script request',len([u for u in google(reqs) if 'adsbygoogle.js' in u])==1,google(reqs))
            no_shift(p,f'ads {w}×{h}')
            check_clearance(p,f'ads {w}×{h} empty studio')
            if w==1440:
                p.screenshot(path=str(SHOTS/'studio-ads-1440-empty.png'))
                import_sheet(p);p.wait_for_timeout(400);check_clearance(p,'ads 1440 viewer with a sheet')
                p.click('.st-ws-tab[data-ws="pack"]');packed(p);check_clearance(p,'ads 1440 Pack & Export')
                p.screenshot(path=str(SHOTS/'studio-ads-1440-pack.png'))
                names=export_pack(p);ok('ads 1440: Pack & Export works with the ad column (Godot bundle)',any(n.endswith('.png') for n in names),names)
                for ws in ['tile','texture']:
                    p.click(f'.st-ws-tab[data-ws="{ws}"]');p.wait_for_timeout(1500);check_clearance(p,f'ads 1440 {ws} workspace')
                p.screenshot(path=str(SHOTS/'studio-ads-1440-texture.png'))
                # editor UI never covers the ad: menus are kept left of the column, backdrops stop at it
                col_left=p.evaluate('document.querySelector(".st-ad").getBoundingClientRect().left')
                p.evaluate('()=>window.nerulioStudio.menus.openAt([{label:"A long menu item label for the test"},{label:"Second"}],innerWidth-20,80)');p.wait_for_timeout(100)
                right=p.evaluate('Math.max(...[...document.querySelectorAll(".st-menu")].map(m=>m.getBoundingClientRect().right))')
                ok('ads 1440: a menu opened at the right edge stays left of the ad column',right<=col_left-3,(right,col_left))
                p.keyboard.press('Escape');p.evaluate('()=>window.nerulioStudio.menus.close()')
                p.keyboard.press('Control+k');p.wait_for_selector('dialog[open]')
                ok('ads 1440: dialog backdrop stops at the column; the ad is not inside any dialog',p.evaluate('()=>{const d=document.querySelector("dialog[open]");return getComputedStyle(d,"::backdrop").right==="200px"&&!d.querySelector(".st-ad,ins.adsbygoogle")}'))
                p.keyboard.press('Escape')
                w0=p.evaluate('document.querySelector(".st-canvas-wrap").getBoundingClientRect().width')
                p.evaluate('()=>window.nerulioStudio.runCommand("view.rightDock")');p.wait_for_timeout(200)
                w1=p.evaluate('document.querySelector(".st-canvas-wrap").getBoundingClientRect().width')
                ok('ads 1440: closing the right dock keeps the column at the right edge and gives the canvas the dock width',w1>w0+250 and p.evaluate('Math.round(document.querySelector(".st-ad").getBoundingClientRect().right)')==1440,(w0,w1))
                check_clearance(p,'ads 1440 right dock closed')
                p.evaluate('()=>window.nerulioStudio.runCommand("view.rightDock")');p.wait_for_timeout(200)
                ok('ads 1440: no refresh — the unit was filled exactly once',p.evaluate('document.querySelector("ins.adsbygoogle").dataset.stubFills')=='1')
            if w==1920:p.screenshot(path=str(SHOTS/'studio-ads-1920-empty.png'))
            ctx.close()
        # ---------------------------------------------------------------- locale label
        ctx=browser.new_context(viewport={'width':1440,'height':900});p,_=open_studio(ctx,ads,locale='ko')
        ok('ads ko: label is 광고',p.locator('.st-ad-label').inner_text().strip()=='광고')
        p.evaluate('()=>window.nerulioStudio.runCommand("help.lang.ja")');p.wait_for_timeout(200)
        ok('ads: label follows a language switch (広告)',p.locator('.st-ad-label').inner_text().strip()=='広告')
        ctx.close()
        # ---------------------------------------------------------------- narrow screens: no ads at all
        for w,h in [(390,844),(768,1024),(1024,768),(1440,650)]:
            ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<500,has_touch=w<500);p,reqs=open_studio(ctx,ads);p.wait_for_timeout(900)
            ok(f'ads {w}×{h}: no ad DOM and no Google request',p.locator('.st-ad,ins.adsbygoogle').count()==0 and not google(reqs),google(reqs))
            if w==390:p.screenshot(path=str(SHOTS/'studio-ads-390.png'))
            ctx.close()
        # a window made large later gets the column once (user-initiated resize, not a load shift)
        ctx=browser.new_context(viewport={'width':1024,'height':768});p,reqs=open_studio(ctx,ads);p.wait_for_timeout(300)
        p.set_viewport_size({'width':1440,'height':900});p.wait_for_selector('.st-ad ins.adsbygoogle',timeout=5000);p.wait_for_timeout(900)
        p.set_viewport_size({'width':1600,'height':900});p.wait_for_timeout(600)
        ok('ads resize: mounted once on growing past 1280 px and never re-requested',p.locator('ins.adsbygoogle').count()==1 and len([u for u in google(reqs) if 'adsbygoogle.js' in u])==1)
        p.set_viewport_size({'width':1100,'height':900});p.wait_for_timeout(300)
        ok('ads resize: shrinking below 1280 px hides the column and the canvas takes the space',p.evaluate('getComputedStyle(document.querySelector(".st-ad")).display')=='none')
        ctx.close()
        # ---------------------------------------------------------------- blocked / unfilled
        ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);p,reqs=open_studio(ctx,ads,google='block')
        p.wait_for_function('()=>window.nerulioMonetization?.ad?.script==="failed"',timeout=10000)
        ok('blocked: the column keeps its size and shows the quiet house line',p.locator('.st-ad-house').is_visible() and abs(p.evaluate('document.querySelector(".st-ad").getBoundingClientRect().width')-200)<0.5)
        no_shift(p,'blocked')
        import_sheet(p);p.click('.st-ws-tab[data-ws="pack"]');packed(p)
        names=export_pack(p);ok('blocked: the editor still imports, packs and exports a real sheet',any(n.endswith('.png') for n in names),names)
        p.screenshot(path=str(SHOTS/'studio-ads-1440-blocked.png'))
        ctx.close()
        ctx=browser.new_context(viewport={'width':1440,'height':900});p,reqs=open_studio(ctx,ads,google='unfilled')
        p.wait_for_selector('ins.adsbygoogle[data-ad-status="unfilled"]',state='attached',timeout=10000);p.wait_for_timeout(200)
        ok('unfilled: unit hidden by Google\'s documented selector, house line shown, same column width',p.evaluate('getComputedStyle(document.querySelector("ins.adsbygoogle")).display')=='none' and p.locator('.st-ad-house').is_visible())
        no_shift(p,'unfilled')
        ctx.close()
    finally:
        plain.close();ads.close();browser.close()
if errors:raise AssertionError('page errors: '+'; '.join(errors[:5]))
(OUT/'studio-monetization-browser-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
print(f'STUDIO MONETIZATION BROWSER PASSED {len(checks)} checks',flush=True)
