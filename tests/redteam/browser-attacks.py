"""Red-team harness (docs/MONETIZATION-SECURITY.md): client-side attacks on the Studio's export
limit, the Pro entitlement and the ad column, against a LOCAL build served by the real Pages
runtime (wrangler pages dev + local D1), the same rig as tests/service-browser.py.

Verdicts: BLOCKED (stopped or bounded as designed), ACCEPTED (still possible and documented: editing
the page's code, ad blockers), WORKS / PARTIAL (a regression). Exit code 1 on WORKS/PARTIAL.
Google's ad script is stubbed; no third-party service is contacted. Port 4551 by default.
Output: test-results/redteam/browser.json.    python tests/redteam/browser-attacks.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib, json, os, re, shutil, signal, subprocess, sys, tempfile, time, urllib.request, base64
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results'/'redteam';OUT.mkdir(parents=True,exist_ok=True)
WRANGLER=['npx','--yes','wrangler@4.135.0']
SECRET='redteam-session-secret-not-for-production-0123456789'
AD_CLIENT='ca-pub-3141592653589793'
PORT=int(os.environ.get('REDTEAM_PORT','4551'))
CLIENT_IP='203.0.113.9'
results=[]
def record(i,title,verdict,evidence):
    results.append({'id':i,'title':title,'verdict':verdict,'evidence':evidence})
    print(f'{verdict:<8} {i} {title}\n         {json.dumps(evidence)}',flush=True)
def shell(cmd,cwd,**kw):return subprocess.run(cmd,cwd=cwd,shell=os.name=='nt',capture_output=True,text=True,encoding='utf-8',errors='replace',**kw)
def ticket_keys():
    r=subprocess.run(['node','tools/ticket-keys.mjs','--json'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    if r.returncode:raise RuntimeError(r.stderr)
    return json.loads(r.stdout)
class Stack:
    def __init__(self,build_env,vars):
        self.dir=Path(tempfile.mkdtemp(prefix='nerulio-redteam-'));self.url=f'http://127.0.0.1:{PORT}'
        keys=ticket_keys();build_env={'TICKET_PUBLIC_KEY':keys['publicKey'],**build_env};vars={'TICKET_PRIVATE_KEY':keys['privateKey'],**vars}
        env={k:v for k,v in os.environ.items() if not k.startswith(('ADSENSE_','CF_PAGES','SITE_','SERVICE_','PRO_PRICE','FREE_DAILY','TICKET_'))}
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
REFUSED=r'/paused|updated|did not complete|Too many|Sign in|Reload/i'
def context(browser,stack,log,ads,routes=(),init=None,cookies=None,ip=CLIENT_IP):
    # CF-Connecting-IP is set by Cloudflare's edge in production; locally the test supplies it.
    ctx=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True,extra_http_headers={'cf-connecting-ip':ip})
    ctx.route(re.compile('googlesyndication'),lambda r:(ads.append(r.request.url),r.fulfill(status=200,content_type='text/javascript',body=AD_STUB)))
    for pattern,handler in routes:ctx.route(pattern,handler)
    if init:ctx.add_init_script(init)
    if cookies:ctx.add_cookies(cookies)
    def on_request(r):
        if '/api/v1/' in r.url:log.append({'method':r.method,'path':r.url.split('/api/v1/')[1].split('?')[0]})
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
    got=[];handler=lambda d:got.append(d)
    page.on('download',handler);page.click('[data-export-main]');t0=time.time()
    while time.time()-t0<timeout/1000:
        if got:break
        if page.locator('#studioLimitDialog,#studioSignInDialog').count():break
        if time.time()-t0>1.5 and page.evaluate('re=>{const t=document.querySelector(".st-toast");return !!t&&!t.hidden&&new RegExp(re.slice(1,-2),"i").test(t.textContent)}',REFUSED):break
        page.wait_for_timeout(150)
    page.remove_listener('download',handler)
    for sel in ['#studioLimitDialog','#studioSignInDialog']:
        if page.locator(sel).count():page.click(f'{sel} [data-value="close"]');page.wait_for_timeout(200)
    page.wait_for_function(READY,timeout=60000)
    return bool(got) and got[0].suggested_filename.endswith('.zip')
def exports(page,n):return [try_export(page) for _ in range(n)]
def authz(log):return [r for r in log if r['path']=='jobs/authorize']
def tokens(page,kind='studio'):return page.evaluate(f"(JSON.parse(localStorage.getItem('nerulio.grace.v2')||'{{}}').tokens||{{}}).{kind}?.length||0")

def run(browser,stack):
    # B1 --------------------------------------------------------- incognito / fresh profiles
    tally=[];dialogs=[]
    for i in range(3):
        log=[];ads=[];ctx=context(browser,stack,log,ads);page=open_studio(ctx)
        got=[]
        for _ in range(4):
            got.append(try_export(page))
        tally.append(sum(got));dialogs.append(page.evaluate('document.querySelectorAll("#studioSignInDialog").length'))
        ctx.close()
    record('B1','Incognito / fresh profiles on one network: 3 anonymous exports each until the network\'s anonymous share (6 here) is used, then a free sign-in',
           'BLOCKED' if sum(tally)<=6 and tally[-1]==0 else 'WORKS',dict(zipsPerProfile=tally,networkShare=6))
    # B2 --------------------------------------------------------- block /api from the start (+ clear storage)
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',lambda r:r.abort())],ip='198.51.100.20');page=open_studio(ctx)
    rounds=[]
    for i in range(2):
        rounds.append(sum(exports(page,2)));page.evaluate("()=>localStorage.clear()")
    decision=page.evaluate('window.nerulioMonetization.decision.reason');ctx.close()
    record('B2','Block /api/v1 from the start (blocker, hosts file, offline) and clear storage: no engine export at all (fail-closed)','BLOCKED' if sum(rounds)==0 else 'WORKS',
           dict(zipsPerRound=rounds,adDecision=decision))
    # B2b -------------------------------------------------------- toggle the block + clear all site data, repeatedly
    cyc=[]
    for c in range(2):
        net={'down':False}
        toggle=(lambda n:lambda r:r.abort() if n['down'] else r.continue_())(net)
        log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',toggle)],ip='198.51.100.21');page=open_studio(ctx)
        online=try_export(page)
        try:page.wait_for_function("()=>(JSON.parse(localStorage.getItem('nerulio.grace.v2')||'{}').tokens?.studio||[]).length>0",timeout=15000)
        except Exception:pass
        held=tokens(page);net['down']=True
        offline=sum(exports(page,4));cyc.append({'online':online,'tokens':held,'offline':offline});ctx.close()
    record('B2b','Toggle the block between loads and clear ALL site data each cycle: each cycle costs one counted export (network share) and yields at most the signed grace',
           'ACCEPTED' if all(c['offline']<=c['tokens']<=3 for c in cyc) else 'WORKS',dict(cycles=cyc,note='manual, bounded: ≤ (1 + OFFLINE_GRACE_EXPORTS) × the network\'s anonymous share per day'))
    # B3 --------------------------------------------------------- no-code response rewrites
    unconf=lambda r:r.fulfill(status=503,content_type='application/json',body=json.dumps({'error':{'code':'SERVICE_NOT_CONFIGURED','message':'x'}}))
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',unconf)],ip='198.51.100.30');page=open_studio(ctx)
    z=sum(exports(page,3));ctx.close()
    record('B3','Rewrite every /api/v1 answer to 503 SERVICE_NOT_CONFIGURED: not a permission on a service build','BLOCKED' if z==0 else 'WORKS',dict(zips=z,attempted=3))
    unknown=lambda r:r.fulfill(status=400,content_type='application/json',body=json.dumps({'error':{'code':'UNKNOWN_TOOL'}})) if r.request.method=='POST' else r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/jobs/authorize',unknown)],ip='198.51.100.31');page=open_studio(ctx)
    z=sum(exports(page,3));ctx.close()
    record('B3b','Rewrite the authorize answer to 400 UNKNOWN_TOOL ("version skew"): the page asks for a reload instead of exporting','BLOCKED' if z==0 else 'WORKS',dict(zips=z,attempted=3))
    fake=lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'allowed':True,'unlimited':True,'plan':'pro'})) if r.request.method=='POST' else r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/jobs/authorize',fake)],ip='198.51.100.32');page=open_studio(ctx)
    z=sum(exports(page,3));ctx.close()
    record('B3c','Rewrite the authorize answer to {allowed:true, unlimited:true} (response-override extension): unsigned, refused','BLOCKED' if z==0 else 'WORKS',dict(zips=z,attempted=3))
    # B4 --------------------------------------------------------- fetch override (userscript / devtools)
    FETCH="""(()=>{const f=window.fetch;window.fetch=async(u,i)=>{if(String(u).includes('jobs/authorize'))return new Response(JSON.stringify({allowed:true,unlimited:true,plan:'pro',ticket:'eyJ2IjoxfQ.AAAA'}),{status:200,headers:{'Content-Type':'application/json'}});return f(u,i);};})();"""
    log=[];ads=[];ctx=context(browser,stack,log,ads,init=FETCH,ip='198.51.100.33');page=open_studio(ctx)
    z=sum(exports(page,3));ctx.close()
    record('B4','A userscript overrides window.fetch to answer "allowed, unlimited" with a made-up ticket: the signature check refuses it','BLOCKED' if z==0 else 'WORKS',dict(zips=z,attempted=3))
    # B5 --------------------------------------------------------- forge Pro in /me
    def fake_me(r):
        if r.request.method=='GET' and r.request.url.split('?')[0].endswith('/api/v1/me'):
            r.fulfill(status=200,content_type='application/json',body=json.dumps({'loggedIn':True,'plan':'pro','ads':False,'usage':{'unlimited':True},'studioUsage':{'unlimited':True},'billing':{'mode':'off'},'turnstileSiteKey':''}))
        else:r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/me*',fake_me)],ip='198.51.100.34');page=open_studio(ctx)
    z=sum(exports(page,3));reason=page.evaluate('window.nerulioMonetization.decision.reason');adcol=page.locator('.st-ad').count();ctx.close()
    record('B5','Rewrite GET /me to a Pro answer: unsigned, so the page treats the plan as unknown — no exports (the ad column is also not shown; see B10b)','BLOCKED' if z==0 else 'WORKS',
           dict(zips=z,adDecision=reason,adColumns=adcol))
    # B6 --------------------------------------------------------- edit the page's code
    stub="""import {STUDIO_ACTIONS} from '../../quota.js';export const LOW_AT=3;export function bindStudio(){}export async function meter(a){if(!Object.hasOwn(STUDIO_ACTIONS,a))throw Error(a);return true;}"""
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/src/studio/monetize/meter.js*',lambda r:r.fulfill(status=200,content_type='text/javascript',body=stub))],ip='198.51.100.35');page=open_studio(ctx)
    z=sum(exports(page,4));ctx.close()
    record('B6','Replace src/studio/monetize/meter.js (Local Overrides / extension): the page\'s own code no longer asks — cannot be prevented in a local-first web app','ACCEPTED' if z==4 else 'BLOCKED',dict(zips=z,attempted=4,authorizeRequestsSent=len(authz(log))))
    verify_stub="export async function verifyTicket(){return {v:1};}export function newNonce(){return 'x'.repeat(24);}"
    log=[];ads=[];ctx=context(browser,stack,log,ads,init=FETCH,routes=[('**/src/ticket-verify.js*',lambda r:r.fulfill(status=200,content_type='text/javascript',body=verify_stub))],ip='198.51.100.36');page=open_studio(ctx)
    z=sum(exports(page,4));ctx.close()
    record('B6b','Replace the signature check AND fake the answers: works only by editing the page\'s code (same class as B6)','ACCEPTED' if z==4 else 'BLOCKED',dict(zips=z,attempted=4))
    # B7 --------------------------------------------------------- call the exporters directly
    log=[];ads=[];ctx=context(browser,stack,log,ads,ip='198.51.100.37');page=ctx.new_page();page.goto(f'http://127.0.0.1:{PORT}/en/game/studio/?ws=tile',wait_until='domcontentloaded');page.wait_for_function(STARTED,timeout=60000)
    before=len(log)
    direct=page.evaluate("""async()=>{const C=await import('/src/core.js'),T=await import('/src/game/export/targets.js');
      const z=await C.zip([{name:'godot/tileset.tres',blob:new Blob(['[gd_resource]'])}],{paths:true});return {packTargets:Object.keys(T.TARGETS||{}).length,zipBytes:(z.byteLength??z.size??0)};}""")
    ctx.close()
    record('B7','From the console, import the exporter modules and build a bundle directly (no meter, no API) — code-level, accepted','ACCEPTED' if direct['zipBytes']>0 else 'BLOCKED',dict(**direct,apiRequestsDuringAttack=len(log)-before))
    # B8 --------------------------------------------------------- one transient /me failure at load
    state={'n':0}
    def first_me_fails(r):
        if r.request.url.split('?')[0].endswith('/api/v1/me') and state['n']==0:state['n']+=1;r.abort();return
        r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',first_me_fails)],ip='198.51.100.38');page=open_studio(ctx)
    res=exports(page,2);ctx.close()
    record('B8','One transient /me failure at load: the next export re-checks the service and proceeds normally','BLOCKED' if len(authz(log))>=2 and all(res) else 'PARTIAL',dict(zips=res,authorizeRequestsSent=len(authz(log))))
    # B9 --------------------------------------------------------- race on workerd + D1
    log=[];ads=[];ctx=context(browser,stack,log,ads,ip='198.51.100.39');page=open_studio(ctx);exports(page,2)
    race=page.evaluate("""async()=>{const one=()=>fetch('/api/v1/jobs/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId:crypto.randomUUID(),toolId:'studio-pack-export'})}).then(r=>r.json());
      const rs=await Promise.all(Array.from({length:25},one));const me=await fetch('/api/v1/me').then(r=>r.json());return {allowed:rs.filter(r=>r.allowed===true).length,refused:[...new Set(rs.filter(r=>!r.allowed).map(r=>r.error?.code))],used:me.studioUsage.used};}""")
    ctx.close()
    record('B9','25 parallel authorize requests at 2 of 3 anonymous exports (workerd + local D1)','BLOCKED' if race['allowed']==1 and race['used']==3 else 'WORKS',race)
    # B10 -------------------------------------------------------- ads
    token=create_pro(stack,'redteam-pro')
    log=[];ads=[];ctx=context(browser,stack,log,ads,cookies=[{'name':'nerulio_session','value':token,'url':stack.url,'httpOnly':True,'sameSite':'Lax'}],ip='198.51.100.40');page=open_studio(ctx);page.wait_for_timeout(1500)
    pro={'googleRequests':len(ads),'adDom':page.locator('.st-ad,ins.adsbygoogle,script[src*="adsbygoogle"]').count(),'reason':page.evaluate('window.nerulioMonetization.decision.reason'),'zips':sum(exports(page,4))}
    ctx.close()
    record('B10','Real (signed) Pro session: zero Google requests, no ad DOM, unlimited exports','BLOCKED' if pro['googleRequests']==0 and pro['adDom']==0 and pro['zips']==4 else 'WORKS',pro)
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/me*',lambda r:r.abort())],ip='198.51.100.41');page=ctx.new_page();page.goto(f'http://127.0.0.1:{PORT}/en/game/studio/?ws=pack',wait_until='domcontentloaded');page.wait_for_function(STARTED,timeout=60000);page.wait_for_timeout(1500)
    fb={'adColumns':page.locator('.st-ad').count(),'reason':page.evaluate('window.nerulioMonetization.decision.reason')}
    ctx.close()
    record('B10b','Free user blocks GET /api/v1/me: no ad column (unknown plan = no ad) — and no engine exports either; ad blocking is accepted policy','ACCEPTED' if fb['adColumns']==0 else 'BLOCKED',fb)
    # B11 -------------------------------------------------------- readable source
    sample=(stack.dir/'dist'/'src'/'studio'/'monetize'/'meter.js').read_text(encoding='utf-8')
    record('B11','Shipped modules are readable ES modules (bundling would not prevent B6/B7, only slow them)','ACCEPTED' if 'export async function meter' in sample else 'BLOCKED',dict(meterJsBytes=len(sample)))
    # B12 -------------------------------------------------------- block ONLY authorize while /me answers
    net={'block':False}
    def only_authorize(r):
        if net['block'] and r.request.url.split('?')[0].endswith('/jobs/authorize'):r.abort();return
        r.continue_()
    log=[];ads=[];ctx=context(browser,stack,log,ads,routes=[('**/api/v1/**',only_authorize)],ip='198.51.100.42');page=open_studio(ctx)
    first=try_export(page)
    try:page.wait_for_function("()=>(JSON.parse(localStorage.getItem('nerulio.grace.v2')||'{}').tokens?.studio||[]).length>0",timeout=15000)
    except Exception:pass
    held=tokens(page);net['block']=True
    z=sum(exports(page,3));ctx.close()
    record('B12','Block only the authorize call while /me still answers (to spend offline tokens without an outage): not an outage, no grace','BLOCKED' if z==0 and held>0 else 'WORKS',dict(firstOnline=first,tokensHeld=held,zipsWhileBlocked=z))

def main():
    stack=Stack({'SITE_URL':'https://nerulio.test','ADSENSE_CLIENT':AD_CLIENT,'ADSENSE_SLOT_STUDIO':'1234567890','ADSENSE_CMP_READY':'true'},
                {'ANON_NETWORK_STUDIO_EXPORTS':'6'})
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
    sys.exit(1 if any(r['verdict'] in ('WORKS','PARTIAL') for r in results) else 0)
main()
