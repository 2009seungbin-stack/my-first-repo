"""Red-team harness (Phase 1, docs/MONETIZATION-SECURITY.md): client-side attacks on the Studio's
export limit, the Pro entitlement and the ad column, against a LOCAL build served by the real
Pages runtime (wrangler pages dev + local D1), the same way tests/service-browser.py runs it.

It records what an attacker gets today (WORKS / PARTIAL / BLOCKED with evidence); it is not a
pass/fail suite. Google's ad script is stubbed; no real third-party service is contacted.
Port 4551 only. Output: test-results/redteam/browser.json and screenshots next to it.
    python tests/redteam/browser-attacks.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib, json, os, re, shutil, signal, subprocess, sys, tempfile, time, urllib.request, base64
try: sys.stdout.reconfigure(encoding='utf-8')  # console codepage may be cp949 on this box
except Exception: pass
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results'/'redteam';OUT.mkdir(parents=True,exist_ok=True)
WRANGLER=['npx','--yes','wrangler@4.135.0']
SECRET='redteam-session-secret-not-for-production-0123456789'
AD_CLIENT='ca-pub-3141592653589793'
PORT=4551
results=[]
def record(i,title,verdict,evidence):
    results.append({'id':i,'title':title,'verdict':verdict,'evidence':evidence})
    print(f'{verdict:<7} {i} {title}\n        {json.dumps(evidence)}',flush=True)
def shell(cmd,cwd,**kw):return subprocess.run(cmd,cwd=cwd,shell=os.name=='nt',capture_output=True,text=True,encoding='utf-8',errors='replace',**kw)
class Stack:
    def __init__(self,build_env,vars):
        self.dir=Path(tempfile.mkdtemp(prefix='nerulio-redteam-'));self.url=f'http://127.0.0.1:{PORT}'
        env={k:v for k,v in os.environ.items() if not k.startswith(('ADSENSE_','CF_PAGES','SITE_','SERVICE_','PRO_PRICE','FREE_DAILY'))}
        env.update(build_env);env['SERVICE_API']='on'
        r=subprocess.run(['node','-e',"import('./tools/build.mjs').then(m=>m.build({outDir:process.argv[1],env:process.env}))",str(self.dir/'dist')],cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
        if r.returncode:raise RuntimeError(r.stderr)
        lines=[f'{k} = {json.dumps(v)}' for k,v in {'SESSION_SECRET':SECRET,'NERULIO_ENV':'development',**vars}.items()]
        (self.dir/'wrangler.toml').write_text('\n'.join(['name = "nerulio-redteam"','pages_build_output_dir = "./dist"','compatibility_date = "2026-09-18"','',
            '[[d1_databases]]','binding = "DB"','database_name = "nerulio-redteam"','database_id = "00000000-0000-4000-8000-000000000451"',
            f'migrations_dir = {json.dumps((ROOT/"migrations").as_posix())}','','[vars]',*lines,'']),encoding='utf-8')
        r=shell([*WRANGLER,'d1','migrations','apply','nerulio-redteam','--local'],self.dir)
        if r.returncode:raise RuntimeError(r.stdout+r.stderr)
        self.log=open(self.dir/'wrangler.log','w',encoding='utf-8')
        flags={'creationflags':subprocess.CREATE_NEW_PROCESS_GROUP} if os.name=='nt' else {'start_new_session':True}
        self.proc=subprocess.Popen([*WRANGLER,'pages','dev','--port',str(PORT),'--ip','127.0.0.1'],cwd=self.dir,stdout=self.log,stderr=subprocess.STDOUT,shell=os.name=='nt',**flags)
        for _ in range(240):
            try:
                if json.load(urllib.request.urlopen(self.url+'/api/v1/health',timeout=2)).get('database'):return
            except Exception:time.sleep(.5)
        raise RuntimeError('wrangler pages dev did not start:\n'+(self.dir/'wrangler.log').read_text(encoding='utf-8')[-4000:])
    def sql(self,command):
        r=shell([*WRANGLER,'d1','execute','nerulio-redteam','--local','--json','--command',command],self.dir)
        if r.returncode:raise RuntimeError(r.stdout+r.stderr)
        return json.loads(r.stdout[r.stdout.index('['):])[0]['results']
    def close(self):
        if os.name=='nt':subprocess.run(['taskkill','/T','/F','/PID',str(self.proc.pid)],capture_output=True)
        else:os.killpg(self.proc.pid,signal.SIGTERM)
        try:self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:pass
        self.log.close();shutil.rmtree(self.dir,ignore_errors=True)
def b64url(raw):return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
def create_pro(stack,subject):
    uid=b64url(os.urandom(16));token=b64url(os.urandom(32));now=int(time.time()*1000)
    stack.sql(f"INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES('{uid}','{subject}@example.test','RT','google','{subject}',{now});"
              f"INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES('{hashlib.sha256(token.encode()).hexdigest()}','{uid}',{now},{now+864e5:.0f});"
              f"INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES('manual','m-{uid}','{uid}','pro','active',{now+864e5:.0f},0,1)")
    return token

SHEET=ROOT/'tests'/'fixtures'/'kenney'/'tiny-dungeon-tilemap.png'
STARTED='()=>document.documentElement.dataset.studioStarted==="1"'
READY='()=>{const b=document.querySelector("[data-export-main]");return b&&!b.disabled}'
AD_STUB="window.adsbygoogle={loaded:true,push(){}};"
def context(browser,stack,log,ads,routes=(),init=None,cookies=None):
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
    ctx.route(re.compile('googlesyndication'),lambda r:(ads.append(r.request.url),r.fulfill(status=200,content_type='text/javascript',body=AD_STUB)))
    for pattern,handler in routes:ctx.route(pattern,handler)
    if init:ctx.add_init_script(init)
    if cookies:ctx.add_cookies(cookies)
    def on_request(r):
        if '/api/v1/' in r.url:log.append({'method':r.method,'path':r.url.split('/api/v1/')[1].split('?')[0],'body':r.post_data or ''})
    ctx.on('request',on_request)
    return ctx
def open_studio(ctx):
    page=ctx.new_page();page.goto(f'http://127.0.0.1:{PORT}/en/game/studio/?ws=pack',wait_until='domcontentloaded')
    page.wait_for_function(STARTED,timeout=60000)
    page.set_input_files('input[type=file][multiple]:not([webkitdirectory])',[str(SHEET)])
    page.wait_for_function('()=>window.nerulioStudio.doc.assets.length===1',timeout=60000)
    page.wait_for_function(READY,timeout=120000)
    return page
def try_export(page,timeout=15000):
    """One click on the main engine export. True = a .zip was downloaded; False = refused."""
    got=[]
    handler=lambda d:got.append(d)
    page.on('download',handler)
    page.click('[data-export-main]')
    t0=time.time()
    while time.time()-t0<timeout/1000:
        if got:break
        if page.locator('#studioLimitDialog').count():break
        if page.evaluate('()=>{const t=document.querySelector(".st-toast");return !!t&&!t.hidden&&/paused|did not complete/i.test(t.textContent)}') and time.time()-t0>2.5:break
        page.wait_for_timeout(150)
    page.remove_listener('download',handler)
    if page.locator('#studioLimitDialog').count():
        page.click('#studioLimitDialog [data-value="close"]');page.wait_for_timeout(200)
    page.wait_for_function(READY,timeout=60000)
    ok=bool(got) and got[0].suggested_filename.endswith('.zip')
    if ok:Path(got[0].path()).stat()
    return ok
def exports(page,n):return [try_export(page) for _ in range(n)]
def authz(log):return [r for r in log if r['path']=='jobs/authorize']

def run(browser,stack):
    LIMIT=2
    # B1: incognito / second browser
    tally=[]
    for i in range(3):
        log=[];ads=[];ctx=context(browser,stack,log,ads);page=open_studio(ctx)
        tally.append(sum(exports(page,LIMIT+1)))
        if i==0:page.screenshot(path=str(OUT/'b1-limit-reached.png'))
        ctx.close()
    record('B1','Incognito / fresh browser profile (new cookie jar) is a new full Studio allowance','WORKS' if sum(tally)>LIMIT else 'BLOCKED',dict(limit=LIMIT,profiles=3,zipsPerProfile=tally,totalZips=sum(tally)))

    # B2: block /api + reset the grace by clearing localStorage
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',lambda r:r.abort())]);page=open_studio(ctx)
    rounds=[]
    for i in range(3):
        rounds.append(sum(exports(page,4)))
        page.evaluate("()=>{for(const k of Object.keys(localStorage))if(k.startsWith('nerulio.grace'))localStorage.removeItem(k)}")
    decision=page.evaluate('window.nerulioMonetization.decision.reason');adcol=page.locator('.st-ad').count()
    ctx.close()
    record('B2','Block /api/v1 (blocker/hosts/offline): 3 temporary exports per browser per day, reset by clearing localStorage; no ad column either','WORKS' if sum(rounds)>3 else 'BLOCKED',
           dict(zipsPerRound=rounds,totalZips=sum(rounds),storageKeyCleared='nerulio.grace.v1.studio',adDecision=decision,adColumns=adcol))

    # B3: rewrite API responses (no code)
    unconf=lambda r:r.fulfill(status=503,content_type='application/json',body=json.dumps({'error':{'code':'SERVICE_NOT_CONFIGURED','message':'x'}}))
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',unconf)]);page=open_studio(ctx)
    z=sum(exports(page,5));ctx.close()
    record('B3','Rewrite every /api/v1 response to 503 SERVICE_NOT_CONFIGURED (Requestly-style rule, no code): unlimited exports','WORKS' if z==5 else 'BLOCKED',dict(zips=z,attempted=5,authorizeRequestsSent=len(authz(log))))
    unknown=lambda r:r.fulfill(status=400,content_type='application/json',body=json.dumps({'error':{'code':'UNKNOWN_TOOL'}})) if r.request.method=='POST' else r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/jobs/authorize',unknown)]);page=open_studio(ctx)
    z=sum(exports(page,5));ctx.close()
    record('B3b','Rewrite only the authorize response to 400 UNKNOWN_TOOL (version-skew path): unlimited exports, real /me still loads','WORKS' if z==5 else 'BLOCKED',dict(zips=z,attempted=5))

    # B4: fetch override (userscript / devtools)
    FETCH="""(()=>{const f=window.fetch;window.fetch=async(u,i)=>{if(String(u).includes('jobs/authorize'))return new Response(JSON.stringify({allowed:true,unlimited:true,plan:'pro'}),{status:200,headers:{'Content-Type':'application/json'}});return f(u,i);};})();"""
    log=[];ads=[];ctx=context(browser,stack,log,ads,init=FETCH);page=open_studio(ctx)
    z=sum(exports(page,5));plan=page.evaluate("import('/src/entitlement.js').then(m=>m.current().me?.plan)");ctx.close()
    record('B4','Userscript overrides window.fetch so authorize answers unlimited: unlimited exports, page believes it is Pro','WORKS' if z==5 else 'BLOCKED',dict(zips=z,attempted=5,clientPlanAfter=plan))

    # B5: forge Pro in /me
    def fake_me(r):
        if r.request.method=='GET' and r.request.url.split('?')[0].endswith('/api/v1/me'):
            r.fulfill(status=200,content_type='application/json',body=json.dumps({'loggedIn':True,'plan':'pro','ads':False,'usage':{'unlimited':True},'studioUsage':{'unlimited':True},'user':{'name':'Mallory','email':''},'billing':{'mode':'off'},'turnstileSiteKey':''}))
        else:r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/me*',fake_me)]);page=open_studio(ctx)
    z=sum(exports(page,5));reason=page.evaluate('window.nerulioMonetization.decision.reason');adcol=page.locator('.st-ad').count()
    page.screenshot(path=str(OUT/'b5-forged-pro.png'));ctx.close()
    record('B5','Rewrite GET /me to a Pro answer: no ad column, no Google request, unlimited exports, zero authorize calls','WORKS' if (z==5 and adcol==0) else 'BLOCKED',dict(zips=z,adDecision=reason,adColumns=adcol,googleRequests=len(ads),authorizeRequestsSent=len(authz(log))))

    # B6: patch the module (DevTools Local Overrides)
    stub="""import {STUDIO_ACTIONS} from '../../quota.js';export const LOW_AT=3;export function bindStudio(){}export async function meter(a){if(!Object.hasOwn(STUDIO_ACTIONS,a))throw Error(a);return true;}"""
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/src/studio/monetize/meter.js*',lambda r:r.fulfill(status=200,content_type='text/javascript',body=stub))]);page=open_studio(ctx)
    z=sum(exports(page,5));ctx.close()
    record('B6','Replace src/studio/monetize/meter.js (Local Overrides / extension): unlimited exports, server never hears of them','WORKS' if z==5 else 'BLOCKED',dict(zips=z,attempted=5,authorizeRequestsSent=len(authz(log))))

    # B7: call the exporters directly from the console
    log=[];ads=[];ctx=context(browser,stack,log,ads);page=ctx.new_page();page.goto(f'http://127.0.0.1:{PORT}/en/game/studio/?ws=tile',wait_until='domcontentloaded');page.wait_for_function(STARTED,timeout=60000)
    before=len(log)
    direct=page.evaluate("""async()=>{
      const E=await import('/src/game/tiles/exports.js'),C=await import('/src/core.js'),T=await import('/src/game/export/targets.js');
      return {tileExporters:Object.keys(E.TARGETS||{}),packTargets:Object.keys(T.TARGETS||{}).length,zipIsFunction:typeof C.zip==='function',
              sampleZipBytes:(await C.zip([{name:'godot/tileset.tres',blob:new Blob(['[gd_resource type=\\"TileSet\\"]'])}],{paths:true})).byteLength};}""")
    ctx.close()
    record('B7','From the console, import unbundled exporter modules and build engine bundles directly (no meter, no API)','WORKS' if direct['zipIsFunction'] else 'BLOCKED',dict(**direct,apiRequestsDuringAttack=len(log)-before))

    # B8: one failed /me pins the page offline
    state={'n':0}
    def first_me_fails(r):
        if r.request.url.split('?')[0].endswith('/api/v1/me') and state['n']==0:state['n']+=1;r.abort();return
        r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',first_me_fails)]);page=open_studio(ctx)
    res=exports(page,4);ctx.close()
    record('B8','One transient /me failure at load: the page never re-checks the server, spends the local grace, then pauses while the service is healthy','PARTIAL' if len(authz(log))==0 else 'BLOCKED',dict(zips=res,authorizeRequestsSent=len(authz(log)),note='robustness/UX defect and an easy trigger for the grace path'))

    # B9: race on the real runtime (workerd D1)
    log=[];ads=[];ctx=context(browser,stack,log,ads);page=open_studio(ctx);exports(page,LIMIT-1)
    race=page.evaluate("""async()=>{const one=()=>fetch('/api/v1/jobs/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId:crypto.randomUUID(),toolId:'studio-pack-export'})}).then(r=>r.json());
      const rs=await Promise.all(Array.from({length:25},one));const me=await fetch('/api/v1/me').then(r=>r.json());return {allowed:rs.filter(r=>r.allowed===true).length,denied:rs.filter(r=>r.error?.code==='DAILY_LIMIT').length,other:rs.filter(r=>!r.allowed&&r.error?.code!=='DAILY_LIMIT').map(r=>r.error?.code),used:me.studioUsage.used};}""")
    ctx.close()
    record('B9','25 parallel authorize requests at 1/2 used, on workerd + local D1','BLOCKED' if (race['allowed']==1 and race['used']==LIMIT) else 'WORKS',race)

    # B10: Pro never requests Google; Free ad column removal
    token=create_pro(stack,'redteam-pro')
    log=[];ads=[];ctx=context(browser,stack,log,ads,cookies=[{'name':'nerulio_session','value':token,'url':stack.url,'httpOnly':True,'sameSite':'Lax'}]);page=open_studio(ctx);page.wait_for_timeout(1500)
    pro={'googleRequests':len(ads),'adDom':page.locator('.st-ad,ins.adsbygoogle,script[src*="adsbygoogle"]').count(),'reason':page.evaluate('window.nerulioMonetization.decision.reason')}
    ctx.close()
    record('B10','Real Pro session: zero Google requests and no ad DOM in the Studio','BLOCKED' if (pro['googleRequests']==0 and pro['adDom']==0) else 'WORKS',pro)
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/me*',lambda r:r.abort())]);page=ctx.new_page();page.goto(f'http://127.0.0.1:{PORT}/en/game/studio/?ws=pack',wait_until='domcontentloaded');page.wait_for_function(STARTED,timeout=60000);page.wait_for_timeout(1500)
    free_block={'adColumns':page.locator('.st-ad').count(),'reason':page.evaluate('window.nerulioMonetization.decision.reason'),'googleRequests':len(ads)}
    ctx.close()
    record('B10b','Free user blocks only GET /api/v1/me (one filter rule): Studio shows no ad column (by design: unknown plan means no ad)','WORKS' if free_block['adColumns']==0 else 'BLOCKED',free_block)

    # B11: source shipped unminified
    dist=[p for p in (stack.dir/'dist'/'src'/'studio'/'monetize').glob('*.js')]
    sample=(stack.dir/'dist'/'src'/'studio'/'monetize'/'meter.js').read_text(encoding='utf-8')
    record('B11','The shipped monetization modules are readable, unbundled ES modules (patch target is obvious)','WORKS' if 'export async function meter' in sample else 'PARTIAL',dict(files=[p.name for p in dist],meterJsBytes=len(sample)))

def main():
    stack=Stack({'SITE_URL':'https://nerulio.test','ADSENSE_CLIENT':AD_CLIENT,'ADSENSE_SLOT_STUDIO':'1234567890','ADSENSE_CMP_READY':'true','FREE_DAILY_STUDIO_EXPORTS':'2'},
                {'FREE_DAILY_JOBS':'5','FREE_DAILY_STUDIO_EXPORTS':'2'})
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch()
            try:run(browser,stack)
            finally:browser.close()
    finally:stack.close()
    (OUT/'browser.json').write_text(json.dumps({'ranAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'results':results},indent=1),encoding='utf-8')
    tally={}
    for r in results:tally[r['verdict']]=tally.get(r['verdict'],0)+1
    print('SUMMARY',json.dumps(tally))
main()
