"""End-to-end test of the Nerulio service layer on the real Pages runtime.

For each scenario this builds dist/ with SERVICE_API=on into a temporary directory, applies
migrations/ to an isolated *local* D1 (miniflare sqlite under that directory), and serves it
with `wrangler pages dev` (workerd). Production D1 and real billing are never contacted.
Google OAuth is not exercised here (tests/service.test.mjs covers it with a mocked token
endpoint); signed-in users are created directly in the local database. GitHub and Discord sign-in run
the whole redirect flow against a local mock provider (scenario "social"; OAUTH_TEST_ORIGIN is honoured
only on local development builds).

Requires: Node + npx (downloads wrangler), Python Playwright + Chromium.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64, hashlib, hmac, io, json, os, re, shutil, signal, socket, subprocess, sys, tempfile, time, urllib.parse, urllib.request, uuid
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
WRANGLER=['npx','--yes','wrangler@4.135.0']
SECRET='e2e-session-secret-not-for-production-0123456789'
WEBHOOK='e2e-webhook-secret'
AD_CLIENT='ca-pub-3141592653589793'# synthetic fixture; requests to Google are aborted
checks=[];errors=[]
def ok(name,condition=True,detail=''):
    if not condition:raise AssertionError(f'{name} {detail}')
    checks.append(name);print('PASS',name,flush=True)
def free_port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def shell(cmd,cwd,**kw):
    return subprocess.run(cmd,cwd=cwd,shell=os.name=='nt',capture_output=True,text=True,encoding='utf-8',errors='replace',**kw)
def ticket_keys():
    r=subprocess.run(['node','tools/ticket-keys.mjs','--json'],cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    if r.returncode:raise RuntimeError(r.stderr)
    return json.loads(r.stdout)
class Stack:
    """One isolated deployment: build + local D1 + wrangler pages dev. Every stack signs its answers
    (TICKET_PRIVATE_KEY in the Worker, TICKET_PUBLIC_KEY in the pages), as production should."""
    def __init__(self,name,build_env,vars,port=None,toml=()):
        self.dir=Path(tempfile.mkdtemp(prefix=f'nerulio-{name}-'));self.port=port or int(os.environ.get('SERVICE_PORT','0')) or free_port();self.url=f'http://127.0.0.1:{self.port}'
        keys=ticket_keys();vars={'TICKET_PRIVATE_KEY':keys['privateKey'],**vars};build_env={'TICKET_PUBLIC_KEY':keys['publicKey'],**build_env}
        env={k:v for k,v in os.environ.items() if not k.startswith(('ADSENSE_','CF_PAGES','SITE_','SERVICE_','PRO_PRICE','FREE_DAILY','TICKET_'))}
        env.update(build_env);env['SERVICE_API']='on'
        r=subprocess.run(['node','-e',"import('./tools/build.mjs').then(m=>m.build({outDir:process.argv[1],env:process.env}))",str(self.dir/'dist')],cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
        if r.returncode:raise RuntimeError(r.stderr)
        lines=[f'{k} = {json.dumps(v)}' for k,v in {'SESSION_SECRET':SECRET,'NERULIO_ENV':'development',**vars}.items()]
        (self.dir/'wrangler.toml').write_text('\n'.join([
            'name = "nerulio-e2e"','pages_build_output_dir = "./dist"','compatibility_date = "2026-09-18"','',
            '[[d1_databases]]','binding = "DB"','database_name = "nerulio-e2e"','database_id = "00000000-0000-4000-8000-000000000001"',
            f'migrations_dir = {json.dumps((ROOT/"migrations").as_posix())}','',*toml,'[vars]',*lines,'']),encoding='utf-8')
        r=shell([*WRANGLER,'d1','migrations','apply','nerulio-e2e','--local'],self.dir)
        if r.returncode:raise RuntimeError(r.stdout+r.stderr)
        self.log=open(self.dir/'wrangler.log','w',encoding='utf-8')
        flags={'creationflags':subprocess.CREATE_NEW_PROCESS_GROUP} if os.name=='nt' else {'start_new_session':True}
        self.proc=subprocess.Popen([*WRANGLER,'pages','dev','--port',str(self.port),'--ip','127.0.0.1'],cwd=self.dir,stdout=self.log,stderr=subprocess.STDOUT,shell=os.name=='nt',**flags)
        for _ in range(240):
            try:
                if json.load(urllib.request.urlopen(self.url+'/api/v1/health',timeout=2)).get('database'):return
            except Exception:time.sleep(.5)
        raise RuntimeError('wrangler pages dev did not start:\n'+(self.dir/'wrangler.log').read_text(encoding='utf-8')[-4000:])
    def sql(self,command):
        r=shell([*WRANGLER,'d1','execute','nerulio-e2e','--local','--json','--command',command],self.dir)
        if r.returncode:raise RuntimeError(r.stdout+r.stderr)
        return json.loads(r.stdout[r.stdout.index('['):])[0]['results']
    def close(self):
        if os.name=='nt':subprocess.run(['taskkill','/T','/F','/PID',str(self.proc.pid)],capture_output=True)
        else:os.killpg(self.proc.pid,signal.SIGTERM)
        try:self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:pass
        self.log.close();shutil.rmtree(self.dir,ignore_errors=True)
def b64url(raw):return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
def create_user(stack,subject):
    uid=b64url(os.urandom(16));token=b64url(os.urandom(32));now=int(time.time()*1000)
    stack.sql(f"INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES('{uid}','{subject}@example.test','E2E','google','{subject}',{now});"
              f"INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES('{hashlib.sha256(token.encode()).hexdigest()}','{uid}',{now},{now+864e5:.0f});")
    return uid,token
def sandbox_webhook(stack,user_id,status='active',days=30,event=None):
    body=json.dumps({'id':event or 'evt-'+uuid.uuid4().hex,'type':'subscription.updated','occurredAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
        'data':{'subscriptionId':'sub-'+user_id,'customerId':'cus-'+user_id,'userId':user_id,'plan':'pro','status':status,
                'currentPeriodEnd':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()+days*86400)),'cancelAtPeriodEnd':False}}).encode()
    t=str(int(time.time()))
    sig=hmac.new(WEBHOOK.encode(),(t+'.').encode()+body,hashlib.sha256).hexdigest()
    req=urllib.request.Request(stack.url+'/api/v1/billing/webhook',data=body,method='POST',headers={'Content-Type':'application/json','Nerulio-Sandbox-Signature':f't={t},v1={sig}'})
    try:return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:return {'status':e.code,**json.load(e)}
def instrument(page,log):
    def on_request(r):
        if r.url.startswith(page.context._nerulio_base) or 'googlesyndication' in r.url:
            log.append({'url':r.url,'method':r.method,'body':r.post_data or '','type':r.headers.get('content-type','')})
    page.on('request',on_request)
    page.on('pageerror',lambda e:errors.append(str(e)))
# Single-task pages (src/task) meter one job each time files are added; the classic editor meters each Run.
READY="()=>{const b=document.querySelector('#taskDownload');return !document.querySelector('#taskFiles .file')||(b&&!b.disabled)}"
def is_task(page):return page.locator('body.task-page').count()>0
def idle(page):
    if is_task(page):page.wait_for_function(READY,timeout=120000);return
    page.locator('#workspace[aria-busy="false"]').wait_for(timeout=60000)
def api_calls(log,path):return [r for r in log if '/api/v1/'+path in r['url']]
SECRET_FILENAME='secret-passport-scan-7731.png'
def png_bytes():
    from PIL import Image
    im=Image.new('RGB',(96,64),(40,120,200))
    for x in range(96):im.putpixel((x,x%64),(250,250,250))
    buf=io.BytesIO();im.save(buf,'PNG');return buf.getvalue()
def open_tool(context,stack,path,log,wait_me=True):
    page=context.new_page();instrument(page,log)
    page.goto(stack.url+path,wait_until='domcontentloaded')
    if wait_me:page.wait_for_function('()=>document.getElementById("accountLink")&&!document.getElementById("accountLink").hidden',timeout=30000)
    return page
def add_file(page):page.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"',timeout=30000);page.locator('#fileInput').set_input_files(files=[{'name':SECRET_FILENAME,'mimeType':'image/png','buffer':png_bytes()}])
def load_file(page):
    if is_task(page):return # adding the file is the metered run there; see run_intent
    page.locator('#fileInput').set_input_files(files=[{'name':SECRET_FILENAME,'mimeType':'image/png','buffer':png_bytes()}]);idle(page)
def attempt(page):
    # Starts one metered run without waiting for it (it may be refused).
    if is_task(page):add_file(page);return
    page.locator('[data-action="undo"]:visible').first.click();idle(page)
    page.locator('[data-action="intent-run"]').click()
def run_intent(page):
    if is_task(page):
        before=page.locator('#taskFiles .file').count();add_file(page)
        page.wait_for_function('n=>document.querySelectorAll("#taskFiles .file").length>n',arg=before,timeout=30000);idle(page);return
    # A finished result turns the primary button into Download; undo returns to the source.
    if page.locator('[data-action="intent-download"]').count():page.locator('[data-action="undo"]:visible').first.click();idle(page)
    page.locator('[data-action="intent-run"]').click();page.wait_for_timeout(150);idle(page)
def has_source(page):return page.locator('#taskFiles .file' if is_task(page) else '.canvas-wrap canvas').count()>0
def download_ok(page):
    with page.expect_download(timeout=30000) as d:page.locator('#taskDownload' if is_task(page) else '[data-action="intent-download"]').click()
    path=d.value.path();return Path(path).stat().st_size>0

def scenario_free(browser):
    stack=Stack('free',{'SITE_URL':'https://nerulio.test','PRO_PRICE_AMOUNT':'4.99','PRO_PRICE_CURRENCY':'USD'},
                {'FREE_DAILY_JOBS':'2','BILLING_PROVIDER':'sandbox','BILLING_WEBHOOK_SECRET':WEBHOOK})
    try:
        context=browser.new_context(accept_downloads=True);context._nerulio_base=stack.url;log=[]
        page=open_tool(context,stack,'/en/image/upscale/?mode=smooth',log)
        ok('anonymous header shows Sign in',page.locator('#accountLink').inner_text()=='Sign in')
        anon=[c for c in context.cookies() if c['name']=='nerulio_anon']
        ok('anonymous cookie is HttpOnly + Lax',len(anon)==1 and anon[0]['httpOnly'] and anon[0]['sameSite']=='Lax')
        ok('one /me per page load',len(api_calls(log,'me'))==1)
        load_file(page)
        run_intent(page);ok('Free heavy job 1 produces a real result',download_ok(page))
        auth=api_calls(log,'jobs/authorize')
        ok('authorize sent once for one run',len(auth)==1)
        body=json.loads(auth[0]['body'])
        ok('authorize payload is only operationId + toolId',sorted(body)==['operationId','toolId'] and body['toolId']=='upscale',auth[0]['body'])
        ok('authorize payload is tiny JSON',auth[0]['type'].startswith('application/json') and len(auth[0]['body'])<120)
        run_intent(page);ok('Free heavy job 2 (limit 2) runs',download_ok(page))
        ok('remaining indicator shown near the limit',page.locator('#serviceToast').count()==1)
        attempt(page)
        page.locator('#upgradeDialog').wait_for(timeout=15000)
        ok('limit reached opens the upgrade modal',page.locator('#upgradeDialog [data-upgrade]').get_attribute('target')=='_blank')
        ok('modal says work is kept',page.locator('#upgradeDialog .keep-work').is_visible())
        page.locator('#upgradeDialog [data-later]').click();page.wait_for_timeout(200)
        ok('modal closes without navigating','/en/image/upscale/' in page.url and page.locator('#upgradeDialog').count()==0)
        ok('current file and settings survive the refusal',has_source(page) and page.locator('#taskFiles .file').count()==2 and page.locator('#upScale [aria-pressed="true"]').inner_text()=='2×')
        ok('denied run was the only extra authorize',len(api_calls(log,'jobs/authorize'))==3)
        # Light tools never call the API and keep working after the limit. Crop is a single-task
        # page (src/task/crop.js), so the helpers take their is_task branch: adding the file is
        # the run and #taskDownload is the save. What is proved is unchanged.
        crop=open_tool(context,stack,'/en/image/crop/',log);before=len(api_calls(log,'jobs/authorize'))
        load_file(crop);run_intent(crop)
        ok('crop works with Free quota exhausted',download_ok(crop))
        ok('crop made no authorize request',len(api_calls(log,'jobs/authorize'))==before)
        # Privacy: nothing that leaves the page resembles file data.
        for r in log:
            ok_body=SECRET_FILENAME not in r['body'] and SECRET_FILENAME not in r['url'] and 'base64' not in r['body'] and 'data:image' not in r['body'] and len(r['body'])<300
            if not ok_body:raise AssertionError('file-like data in request '+r['url'])
        ok('no request carries the file name, bytes or base64',True)
        ok('only GET /me and POST /jobs/authorize reached the API',{(r['method'],r['url'].split('/api/v1/')[1].split('?')[0]) for r in log if '/api/v1/' in r['url']}<={('GET','me'),('POST','jobs/authorize')})
        # Account page reflects server state.
        acct=context.new_page();instrument(acct,log);acct.goto(stack.url+'/en/account/',wait_until='networkidle')
        ok('account page shows 2 / 2 for the anonymous identity',acct.locator('[data-usage]').inner_text().strip()=='2 / 2')
        ok('account page is noindex',acct.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow')
        context.close()

        # Pro: signed-in user, subscription activated only by a signed webhook.
        uid,token=create_user(stack,'pro-e2e')
        context=browser.new_context(accept_downloads=True);context._nerulio_base=stack.url;log=[]
        context.add_cookies([{'name':'nerulio_session','value':token,'url':stack.url,'httpOnly':True,'sameSite':'Lax'}])
        pricing=context.new_page();instrument(pricing,log);pricing.goto(stack.url+'/en/pricing/',wait_until='networkidle')
        ok('pricing shows configured price',pricing.locator('[data-price]').inner_text()=='$4.99 / month')
        pricing.locator('[data-checkout]').click();pricing.wait_for_url('**/account/**',timeout=15000);pricing.wait_for_load_state('networkidle')
        ok('sandbox checkout goes to account with a sandbox notice',pricing.locator('#accountStatus').inner_text()!='' )
        me=pricing.evaluate('fetch("/api/v1/me").then(r=>r.json())')
        ok('checkout redirect alone does NOT grant Pro',me['plan']=='free')
        bad=urllib.request.Request(stack.url+'/api/v1/billing/webhook',data=b'{}',method='POST',headers={'Content-Type':'application/json','Nerulio-Sandbox-Signature':'t=1,v1=00'})
        try:urllib.request.urlopen(bad);ok('unsigned webhook rejected',False)
        except urllib.error.HTTPError as e:ok('unsigned webhook rejected',e.code==401)
        first=sandbox_webhook(stack,uid,event='evt-e2e-1');dup=sandbox_webhook(stack,uid,event='evt-e2e-1')
        ok('signed webhook processed once, duplicate ignored',first.get('duplicate') is False and dup.get('duplicate') is True)
        page=open_tool(context,stack,'/en/image/upscale/?mode=smooth',log)
        ok('Pro badge in header',page.locator('#accountLink').inner_text()=='Pro')
        load_file(page)
        for i in range(4):run_intent(page)
        ok('Pro runs beyond the Free limit and produces output',download_ok(page))
        ok('Pro heavy jobs call no authorize endpoint',len(api_calls(log,'jobs/authorize'))==0)
        # Expired subscription → Free again.
        sandbox_webhook(stack,uid,status='canceled',days=-1)
        page.reload(wait_until='domcontentloaded');page.wait_for_function('()=>!document.getElementById("accountLink").hidden')
        ok('canceled subscription returns to Free',page.locator('#accountLink').inner_text()=='Account')
        context.close()

        # Unreachable from the first request (blocked /api, offline): light tools work; heavy tools
        # pause at once — fail-closed: a page that never reached the service holds no allowance.
        context=browser.new_context(accept_downloads=True);context._nerulio_base=stack.url;log=[]
        context.route('**/api/v1/**',lambda route:route.abort())
        page=open_tool(context,stack,'/en/image/crop/',log,wait_me=False);page.wait_for_timeout(1500)
        ok('header link hidden when service is down',page.locator('#accountLink').is_hidden())
        load_file(page);run_intent(page);ok('crop works during an API outage',download_ok(page))
        up=open_tool(context,stack,'/en/image/upscale/?mode=smooth',log,wait_me=False);load_file(up)
        attempt(up);up.locator('#serviceToast').wait_for(timeout=15000)
        ok('never-reachable service: heavy tools pause at once with a message (no local allowance)','paused' in up.locator('#serviceToast').inner_text())
        context.close()
        # The service goes away AFTER the first job of the day: today's signed offline tokens (never
        # more than what is left: 1 of 2 here) are usable, then heavy tools pause; back online they
        # are charged. A fresh identity gets no tokens before its first counted job.
        context=browser.new_context(accept_downloads=True);context._nerulio_base=stack.url;log=[];net={'down':False}
        context.route('**/api/v1/**',lambda route:route.abort() if net['down'] else route.continue_())
        up=open_tool(context,stack,'/en/image/upscale/?mode=smooth',log);load_file(up)
        ok('a fresh identity holds no offline tokens',up.evaluate("JSON.parse(localStorage.getItem('nerulio.grace.v2')||'{\"tokens\":{\"heavy\":[]}}').tokens.heavy.length")==0)
        run_intent(up)
        up.wait_for_function("()=>JSON.parse(localStorage.getItem('nerulio.grace.v2')||'{}').tokens?.heavy?.length>0",timeout=15000)
        tokens=up.evaluate("JSON.parse(localStorage.getItem('nerulio.grace.v2')).tokens.heavy.length")
        ok('after one counted job the page fetches signed offline tokens for what is left today (no reload)',tokens==1,tokens)
        net['down']=True
        run_intent(up)
        ok('the signed offline heavy job during an outage produces output',download_ok(up))
        attempt(up);up.locator('#serviceToast').wait_for(timeout=15000);up.wait_for_function('()=>/paused/i.test(document.getElementById("serviceToast").textContent)',timeout=15000)
        ok('after the signed tokens, heavy tools pause with a message',True)
        net['down']=False
        up.reload(wait_until='domcontentloaded');up.wait_for_function('()=>document.getElementById("accountLink")&&!document.getElementById("accountLink").hidden',timeout=30000)
        up.wait_for_function('()=>!JSON.parse(localStorage.getItem("nerulio.grace.v2")).pending.length',timeout=15000)
        ok('back online, the offline job is reported and charged exactly once',me_now(up)['usage']['used']==2)
        context.close()
    finally:stack.close()

def scenario_ads(browser):
    stack=Stack('ads',{'SITE_URL':'https://nerulio.test','ADSENSE_CLIENT':AD_CLIENT,'ADSENSE_SLOT_CONTENT_1':'1234567890','ADSENSE_SLOT_CONTENT_2':'9876543210','ADSENSE_CMP_READY':'true'},{'FREE_DAILY_JOBS':'5'})
    try:
        routes=json.loads((stack.dir/'dist'/'_routes.json').read_text())
        ok('ad build keeps static assets off the Worker',all(p in routes['exclude'] for p in ['/src/*','/assets/*','/verify/*']))
        for plan in ['free','free-blocked','pro']:
            context=browser.new_context(accept_downloads=True);context._nerulio_base=stack.url;log=[];ad_requests=[]
            # 'free' serves a stub in place of Google's script; the others abort it (ad blocker / outage).
            stub=lambda route:(ad_requests.append(route.request.url),route.fulfill(status=200,content_type='text/javascript',body='/* stub */'))
            block=lambda route:(ad_requests.append(route.request.url),route.abort())
            context.route(re.compile('googlesyndication'),stub if plan=='free' else block)
            if plan=='pro':
                uid,token=create_user(stack,'ads-pro');stack.sql(f"INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES('manual','m-{uid}','{uid}','pro','active',{int(time.time()*1000)+864e5:.0f},0,1)")
                context.add_cookies([{'name':'nerulio_session','value':token,'url':stack.url,'httpOnly':True,'sameSite':'Lax'}])
            page=context.new_page();instrument(page,log)
            response=page.goto(stack.url+'/en/image/crop/',wait_until='networkidle');page.wait_for_timeout(800)
            csp=response.headers.get('content-security-policy','')
            ok(f'{plan}: HTML served with per-response nonce CSP',"'strict-dynamic'" in csp and 'nonce-' in csp)
            html=response.text()
            ok(f'{plan}: served HTML has no AdSense tag, only the entitlement-aware loader','adsbygoogle.js' not in html and 'src/ads.js' in html)
            if plan=='free':
                ok('free: AdSense requested after /me',len(ad_requests)>=1)
                ok('free: two ad slots mounted outside the editor',page.locator('.ad-slot').count()==2 and page.locator('#workspace .ad-slot').count()==0)
            elif plan=='free-blocked':
                ok('blocked: AdSense was attempted',len(ad_requests)>=1)
                ok('blocked: failed ad script leaves no empty slots',page.locator('.ad-slot').count()==0)
            else:
                ok('pro: zero AdSense network requests',len(ad_requests)==0)
                ok('pro: no ad DOM, no placeholder',page.locator('.ad-slot,ins.adsbygoogle,script[src*="adsbygoogle"]').count()==0)
                gap=page.evaluate('()=>[...document.querySelectorAll("#siteContent aside")].length')
                ok('pro: no empty ad containers (no layout gap)',gap==0)
            load_file(page);run_intent(page)
            ok(f'{plan}: blocked ad script never breaks the tool',download_ok(page))
            context.close()
    finally:stack.close()

# ------------------------------------------------------------------ Studio (/game/studio/)
STUDIO_SHEET=ROOT/'tests'/'fixtures'/'kenney'/'tiny-dungeon-tilemap.png'
STUDIO_SHEET2=ROOT/'tests'/'fixtures'/'kenney'/'pixel-platformer-characters.png'
SHOTS=Path(os.environ.get('SHOTS',OUT/'studio-monetization'));SHOTS.mkdir(parents=True,exist_ok=True)
AD_STUB="""(function(){const fill=()=>setTimeout(()=>{for(const i of document.querySelectorAll('ins.adsbygoogle:not([data-ad-status])')){i.dataset.adStatus='filled';const d=document.createElement('div');d.style.cssText='width:'+i.style.width+';height:'+i.style.height+';background:linear-gradient(160deg,#f1ead8,#d9cfb4);color:#5a5140;font:600 13px system-ui;display:grid;place-items:center';d.textContent='Test ad';i.append(d);}},300);const q=Array.isArray(window.adsbygoogle)?window.adsbygoogle:[];window.adsbygoogle={loaded:true,push:fill};q.forEach(fill);})();"""
STUDIO_STARTED='()=>document.documentElement.dataset.studioStarted==="1"'
EXPORT_READY='()=>{const b=document.querySelector("[data-export-main]");return b&&!b.disabled}'
def open_studio(context,stack,log,ws='pack',loc='en'):
    page=context.new_page();instrument(page,log)
    page.goto(stack.url+f'/{loc}/game/studio/?ws={ws}',wait_until='domcontentloaded')
    page.wait_for_function(STUDIO_STARTED,timeout=60000)
    return page
def studio_import(page,sheet=STUDIO_SHEET,count=1):
    page.set_input_files('input[type=file][multiple]:not([webkitdirectory])',[str(sheet)])
    page.wait_for_function('n=>window.nerulioStudio.doc.assets.length===n',arg=count,timeout=60000)
    page.wait_for_selector('[data-pack="efficiency"]',state='attached',timeout=120000)
    page.wait_for_function(EXPORT_READY,timeout=120000)
def studio_export(page):
    with page.expect_download(timeout=60000) as d:page.click('[data-export-main]')
    size=Path(d.value.path()).stat().st_size
    page.wait_for_function(EXPORT_READY,timeout=60000)
    return size>0 and d.value.suggested_filename.endswith('.zip')
def meter_note(page):
    loc=page.locator('[data-export-main] + .st-meter-left')
    return loc.inner_text().strip() if loc.count() else ''
def canvas_width(page):return page.evaluate('document.querySelector(".st-canvas-wrap").getBoundingClientRect().width')
def me_now(page):return page.evaluate('fetch("/api/v1/me").then(r=>r.json())')
def scenario_studio(browser):
    stack=Stack('studio',{'SITE_URL':'https://nerulio.test','ADSENSE_CLIENT':AD_CLIENT,'ADSENSE_SLOT_STUDIO':'1234567890','ADSENSE_CMP_READY':'true','PRO_PRICE_AMOUNT':'4.99','PRO_PRICE_CURRENCY':'USD','FREE_DAILY_STUDIO_EXPORTS':'2'},
                {'FREE_DAILY_JOBS':'5','FREE_DAILY_STUDIO_EXPORTS':'2'})
    try:
        # Free: labelled ad column, 2 engine exports, then the Studio's own limit dialog.
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);context._nerulio_base=stack.url;log=[];ads=[]
        context.route(re.compile('googlesyndication'),lambda route:(ads.append(route.request.url),route.fulfill(status=200,content_type='text/javascript',body=AD_STUB)))
        page=open_studio(context,stack,log)
        ok('studio free: /me decided Free before the editor was built',page.evaluate('window.nerulioMonetization.decision.reason')=='free')
        ok('studio free: one labelled ad unit, Google script requested once',page.locator('.st-ad ins.adsbygoogle').count()==1 and len(ads)==1 and page.locator('.st-ad-label').inner_text().strip().lower()=='advertisement',ads)
        pro_link=page.locator('.st-ad [data-pro-link]')
        ok('studio free: "Remove ads - Nerulio Pro" opens pricing in a new tab',pro_link.get_attribute('target')=='_blank' and pro_link.get_attribute('href').endswith('/en/pricing/'))
        free_width=canvas_width(page)
        studio_import(page)
        ok('studio free: remaining count shown beside Export only because it is low (2 left)',meter_note(page)=='Free Studio exports left today: 2',meter_note(page))
        ok('studio free: Studio export 1 downloads a bundle',studio_export(page))
        auth=api_calls(log,'jobs/authorize');body=json.loads(auth[-1]['body'])
        ok('studio authorize payload is only operationId + toolId',sorted(body)==['operationId','toolId'] and body['toolId']=='studio-pack-export',auth[-1]['body'])
        page.wait_for_function('()=>/: 1$/.test(document.querySelector("[data-export-main] + .st-meter-left")?.textContent||"")',timeout=5000)
        ok('studio free: Studio export 2 (limit 2) downloads',studio_export(page))
        page.wait_for_function('()=>document.querySelector("[data-export-main] + .st-meter-left")?.classList.contains("is-out")',timeout=5000)
        downloads=[];page.on('download',lambda d:downloads.append(d.suggested_filename))
        page.click('[data-export-main]');page.locator('#studioLimitDialog').wait_for(timeout=15000)
        ok('studio: the limit dialog appears exactly at the configured count',len(api_calls(log,'jobs/authorize'))==3)
        text=page.locator('#studioLimitDialog [data-limit-body]').inner_text()
        ok('studio: the dialog states 2 of 2, the UTC reset and the time left','2 of 2' in text and '00:00 UTC' in text,text)
        ok('studio: the dialog says the work is kept and shows Pro with the configured price',page.locator('#studioLimitDialog .st-limit-safe').is_visible() and '$4.99' in page.locator('#studioLimitDialog .st-limit-pro').inner_text())
        page.screenshot(path=str(SHOTS/'studio-limit-dialog-1440.png'))
        page.wait_for_timeout(1500)
        ok('studio: the refused export produced no download',not [n for n in downloads if n.endswith('.zip')],downloads)
        with page.expect_download(timeout=30000) as d:page.click('#studioLimitDialog [data-value="save"]')
        ok('studio: "Save project" in the dialog writes the .nerulio file',d.value.suggested_filename.endswith('.nerulio') and Path(d.value.path()).stat().st_size>0)
        ok('studio: the project and the editor are untouched by the refusal',page.evaluate('window.nerulioStudio.doc.assets.length')==1 and page.locator('#studioLimitDialog').count()==0 and page.evaluate('window.nerulioStudio.workspace')=='pack')
        before=len(api_calls(log,'jobs/authorize'))
        studio_import(page,STUDIO_SHEET2,2)
        page.wait_for_function('()=>{const a=window.nerulioStudio.autosave;return !a.pending&&!a.saving&&a.lastAt>0}',timeout=15000)
        ok('studio: after the limit, import/pack/autosave keep working and call no API',len(api_calls(log,'jobs/authorize'))==before)
        me=me_now(page)
        ok('studio: Studio exports did not use the file tools\' heavy-job counter',me['usage']['used']==0 and me['studioUsage']['used']==2,me)
        page.screenshot(path=str(SHOTS/'studio-free-after-limit-1440.png'))
        acct=context.new_page();instrument(acct,log);acct.goto(stack.url+'/en/account/',wait_until='networkidle')
        ok('studio: the account page shows Studio exports 2 / 2 next to heavy jobs',acct.locator('[data-studio-usage]').inner_text().strip()=='2 / 2' and acct.locator('[data-usage]').inner_text().strip()=='0 / 5')
        pricing=context.new_page();instrument(pricing,log);pricing.goto(stack.url+'/en/pricing/',wait_until='networkidle')
        ok('studio: pricing lists the configured Studio export limit and Pro as unlimited','2 Studio engine exports per day' in pricing.locator('[data-plan="free"]').inner_text() and 'Unlimited Studio engine exports' in pricing.locator('[data-plan="pro"]').inner_text())
        pricing.screenshot(path=str(SHOTS/'pricing-1440.png'),full_page=True);acct.close();pricing.close()
        # Reset rule: counters are keyed by UTC day. Moving today's row to a past day is exactly
        # what 00:00 UTC does; the next export is allowed again and counts from 1.
        stack.sql("UPDATE daily_usage SET day='2000-01-01' WHERE subject_id LIKE '%#studio'")
        page.reload(wait_until='domcontentloaded')
        page.locator('.st-recover').wait_for(timeout=30000);page.click('.st-recover [data-value="restore"]')
        page.wait_for_function('()=>window.nerulioStudio.doc.assets.length===2',timeout=30000)
        ok('studio: the autosaved project comes back after a reload',True)
        page.wait_for_function(EXPORT_READY,timeout=120000)
        ok('studio: after the UTC day changes the export is allowed again',studio_export(page))
        ok('studio: the new day counts from 1',me_now(page)['studioUsage']['used']==1)
        context.close()

        # Pro: no Google request, no ad DOM, the canvas has the column's width back, unlimited exports.
        uid,token=create_user(stack,'studio-pro');stack.sql(f"INSERT INTO subscriptions(provider,external_subscription_id,user_id,plan,status,current_period_end,cancel_at_period_end,updated_at) VALUES('manual','m-{uid}','{uid}','pro','active',{int(time.time()*1000)+864e5:.0f},0,1)")
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);context._nerulio_base=stack.url;log=[];ads=[]
        context.add_cookies([{'name':'nerulio_session','value':token,'url':stack.url,'httpOnly':True,'sameSite':'Lax'}])
        context.route(re.compile('googlesyndication'),lambda route:(ads.append(route.request.url),route.abort()))
        page=open_studio(context,stack,log);page.wait_for_timeout(1200)
        ok('studio pro: zero Google requests',len(ads)==0 and not [r for r in log if 'googlesyndication' in r['url']])
        ok('studio pro: no ad column, no ad DOM, no placeholder',page.locator('.st-ad,ins.adsbygoogle,script[src*="adsbygoogle"]').count()==0 and page.evaluate('!document.querySelector(".studio.has-ad")'))
        pro_width=canvas_width(page)
        ok('studio pro: the canvas is wider by exactly the ad column (200 px)',abs(pro_width-free_width-200)<1,(pro_width,free_width))
        studio_import(page)
        for i in range(3):ok(f'studio pro: export {i+1} beyond the Free limit',studio_export(page))
        ok('studio pro: no remaining note and no authorize call',meter_note(page)=='' and len(api_calls(log,'jobs/authorize'))==0)
        page.screenshot(path=str(SHOTS/'studio-pro-1440.png'))
        context.close()

        # Unreachable from the start: no ads (plan unknown), the editor works, engine exports pause
        # at once (fail-closed: no allowance without a reachable service), the project stays.
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);context._nerulio_base=stack.url;log=[];ads=[]
        context.route('**/api/v1/**',lambda route:route.abort())
        context.route(re.compile('googlesyndication'),lambda route:(ads.append(route.request.url),route.abort()))
        page=open_studio(context,stack,log)
        ok('studio outage: no ad and no Google request while the plan is unknown',page.locator('.st-ad').count()==0 and len(ads)==0 and page.evaluate('window.nerulioMonetization.decision.reason')=='unreachable')
        studio_import(page)
        downloads=[];page.on('download',lambda d:downloads.append(d.suggested_filename))
        page.click('[data-export-main]');page.wait_for_function('()=>{const t=document.querySelector(".st-toast");return t&&!t.hidden&&/paused/i.test(t.textContent)}',timeout=15000)
        page.wait_for_timeout(800)
        ok('studio outage: engine exports pause at once with a message; no bundle; the project stays',not downloads and page.evaluate('window.nerulioStudio.doc.assets.length')==1)
        context.close()
        # The service goes away after the first export: the signed offline export (1 of 2 left)
        # works, then exports pause.
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);context._nerulio_base=stack.url;log=[];net={'down':False}
        context.route('**/api/v1/**',lambda route:route.abort() if net['down'] else route.continue_())
        context.route(re.compile('googlesyndication'),lambda route:route.fulfill(status=200,content_type='text/javascript',body=AD_STUB))
        page=open_studio(context,stack,log);studio_import(page)
        ok('studio: first export online',studio_export(page))
        page.wait_for_function("()=>JSON.parse(localStorage.getItem('nerulio.grace.v2')||'{}').tokens?.studio?.length===1",timeout=15000)
        net['down']=True
        ok('studio outage after /me: signed offline export',studio_export(page))
        page.click('[data-export-main]');page.wait_for_function('()=>{const t=document.querySelector(".st-toast");return t&&!t.hidden&&/paused/i.test(t.textContent)}',timeout=15000)
        ok('studio outage after /me: then exports pause; the project stays',page.evaluate('window.nerulioStudio.doc.assets.length')==1)
        context.close()
    finally:stack.close()

# ------------------------------------------------------------------ free sign-in after N anonymous exports
PORT=int(os.environ.get('SERVICE_PORT','0')) or None
SIGNIN_TITLE={'en':'Keep exporting — sign in for free','ko':'무료 로그인하고 계속 내보내기','ja':'無料ログインで書き出しを続ける'}
def scenario_signin(browser):
    stack=Stack('signin',{'SITE_URL':'https://nerulio.test','PRO_PRICE_MONTHLY_AMOUNT':'4.99','PRO_PRICE_YEARLY_AMOUNT':'40','PRO_PRICE_CURRENCY':'USD'},
                {'BILLING_PROVIDER':'sandbox','BILLING_WEBHOOK_SECRET':WEBHOOK,'BILLING_PRICE_ID':'pri_monthly_499','BILLING_PRICE_ID_YEARLY':'pri_yearly_4000'},port=PORT)
    try:
        for loc in ['en','ko','ja']:
            context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);context._nerulio_base=stack.url;log=[]
            page=open_studio(context,stack,log,loc=loc);studio_import(page)
            ok(f'{loc}: no remaining note on first use',meter_note(page)=='')
            for i in range(3):ok(f'{loc}: anonymous engine export {i+1} of 3',studio_export(page))
            ok(f'{loc}: a quiet note says a free sign-in unlocks more',page.locator('[data-export-main] + .st-meter-left').count()==1)
            downloads=[];page.on('download',lambda d:downloads.append(d.suggested_filename))
            page.click('[data-export-main]');page.locator('#studioSignInDialog').wait_for(timeout=15000)
            ok(f'{loc}: the 4th anonymous export asks for a FREE sign-in (not a limit wall)',page.locator('#studioSignInDialog').inner_text().find(SIGNIN_TITLE[loc])>=0 and page.locator('#studioLimitDialog').count()==0)
            page.screenshot(path=str(SHOTS/f'studio-signin-{loc}.png'))
            if loc=='en':
                assets=page.evaluate('window.nerulioStudio.doc.assets.map(a=>a.name)')
                with context.expect_page() as popup:page.click('#studioSignInDialog [data-value="signin"]')
                tab=popup.value;tab.wait_for_load_state('domcontentloaded')
                ok('sign-in opens the provider chooser in a NEW tab; the Studio tab stays put','/game/studio/' in page.url and '/en/account/?from=studio' in tab.url,tab.url)
                ok('the refused export produced no bundle',not [n for n in downloads if n.endswith('.zip')])
                # Google OAuth is not configured locally (the start endpoint answers 503; Google is never
                # contacted). Complete sign-in the way the callback would: a session for a new account on
                # this browser, with today's anonymous count carried over.
                anon=[c for c in context.cookies() if c['name']=='nerulio_anon'][0]['value'].split('.')[0]
                uid,token=create_user(stack,'signin-e2e')
                stack.sql(f"INSERT INTO daily_usage(subject_id,day,used) SELECT 'u:{uid}#studio',day,used FROM daily_usage WHERE subject_id='a:{anon}#studio'")
                context.add_cookies([{'name':'nerulio_session','value':token,'url':stack.url,'httpOnly':True,'sameSite':'Lax'}])
                tab.goto(stack.url+'/en/account/?login=ok&from=studio',wait_until='networkidle')
                ok('the account tab says: go back to the Studio, the project is still open','Studio tab' in tab.locator('#accountStatus').inner_text())
                tab.screenshot(path=str(SHOTS/'account-back-to-studio-en.png'))
                page.bring_to_front();page.evaluate("window.dispatchEvent(new Event('focus'))")
                page.wait_for_function('()=>{const t=document.querySelector(".st-toast");return t&&!t.hidden&&/Signed in/.test(t.textContent)}',timeout=15000)
                ok('the Studio notices the sign-in without a reload',True)
                ok('sign-in did not lose or change the project',page.evaluate('window.nerulioStudio.doc.assets.map(a=>a.name)')==assets and page.evaluate('window.nerulioStudio.workspace')=='pack')
                ok('after sign-in the export goes through',studio_export(page))
                me=me_now(page)
                ok('the account continues from the carried-over count: 4 of 10',me['loggedIn'] and me['studioUsage']['used']==4 and me['studioUsage']['limit']==10,me.get('studioUsage'))
                tab.close()
            else:
                page.click('#studioSignInDialog [data-value="close"]');page.wait_for_timeout(200)
                ok(f'{loc}: closing the prompt keeps the project',page.evaluate('window.nerulioStudio.doc.assets.length')==1 and page.locator('#studioSignInDialog').count()==0)
            context.close()
            # Outage message (never reachable) in this language.
            context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);context._nerulio_base=stack.url;log=[]
            context.route('**/api/v1/**',lambda route:route.abort())
            page=open_studio(context,stack,log,loc=loc);studio_import(page)
            page.click('[data-export-main]');page.wait_for_function('()=>{const t=document.querySelector(".st-toast");return t&&!t.hidden&&t.textContent.includes(".nerulio")}',timeout=15000)
            page.screenshot(path=str(SHOTS/f'studio-outage-{loc}.png'))
            ok(f'{loc}: outage message shown, project kept',page.evaluate('window.nerulioStudio.doc.assets.length')==1)
            context.close()
        # Pricing shows both intervals from config, the saving computed.
        context=browser.new_context(viewport={'width':1280,'height':900});context._nerulio_base=stack.url
        for loc in ['en','ko','ja']:
            pg=context.new_page();pg.goto(stack.url+f'/{loc}/pricing/',wait_until='networkidle')
            ok(f'{loc}: pricing shows monthly and yearly with the computed saving','33' in pg.locator('[data-price-yearly]').inner_text() and '4.99' in pg.locator('[data-price]').inner_text())
            pg.screenshot(path=str(SHOTS/f'pricing-{loc}.png'),full_page=True);pg.close()
        context.close()
    finally:stack.close()

# ------------------------------------------------------------------ GitHub / Discord sign-in (mock provider)
class MockProvider:
    """GitHub and Discord as the Worker sees them through OAUTH_TEST_ORIGIN (/<host>/<path>). Authorize
    redirects straight back (or with error=access_denied when told to deny); the token endpoints check the
    client secret, the redirect URI and the PKCE verifier, and each code works once."""
    def __init__(self):
        import http.server, threading
        self.codes={};self.deny=set();self.tokens=[];mock=self
        self.users={'github':{'id':4242,'login':'e2e-octo','name':'E2E Octo'},
                    'discord':{'id':'515151515151','username':'e2e_nelly','global_name':'E2E Nelly','email':'nelly@example.test','verified':True}}
        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self,*a):pass
            def send(self,code,body=None,headers=()):
                data=json.dumps(body).encode() if body is not None else b''
                self.send_response(code)
                for k,v in headers:self.send_header(k,v)
                if body is not None:self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            def do_GET(self):
                u=urllib.parse.urlparse(self.path);q=dict(urllib.parse.parse_qsl(u.query))
                provider={'/github.com/login/oauth/authorize':'github','/discord.com/oauth2/authorize':'discord'}.get(u.path)
                if provider:
                    back=q['redirect_uri']
                    if provider in mock.deny:return self.send(302,headers=[('Location',back+'?'+urllib.parse.urlencode({'error':'access_denied','state':q['state']}))])
                    code=provider+'-'+uuid.uuid4().hex
                    mock.codes[code]={'provider':provider,'challenge':q['code_challenge'],'method':q.get('code_challenge_method'),'redirect':back,'scope':q['scope']}
                    return self.send(302,headers=[('Location',back+'?'+urllib.parse.urlencode({'code':code,'state':q['state']}))])
                if not self.headers.get('Authorization','').startswith('Bearer mock-token-'):return self.send(401,{'message':'Bad credentials'})
                if u.path=='/api.github.com/user':return self.send(200,mock.users['github'])
                if u.path=='/api.github.com/user/emails':return self.send(200,[{'email':'octo@example.test','primary':True,'verified':True,'visibility':'private'}])
                if u.path=='/discord.com/api/v10/users/@me':return self.send(200,mock.users['discord'])
                self.send(404,{'message':'Not Found'})
            def do_POST(self):
                body=dict(urllib.parse.parse_qsl(self.rfile.read(int(self.headers.get('Content-Length','0'))).decode()))
                provider={'/github.com/login/oauth/access_token':'github','/discord.com/api/oauth2/token':'discord'}.get(urllib.parse.urlparse(self.path).path)
                grant=mock.codes.pop(body.get('code',''),None)
                secret={'github':'e2e-github-secret','discord':'e2e-discord-secret'}.get(provider)
                verifier=body.get('code_verifier','')
                good=bool(grant) and grant['provider']==provider and grant['method']=='S256' and body.get('client_secret')==secret and body.get('redirect_uri')==grant['redirect'] and b64url(hashlib.sha256(verifier.encode()).digest())==grant['challenge']
                if not good:return self.send(200 if provider=='github' else 400,{'error':'bad_verification_code' if provider=='github' else 'invalid_grant'})
                mock.tokens.append(provider);self.send(200,{'access_token':'mock-token-'+uuid.uuid4().hex,'token_type':'bearer','scope':grant['scope']})
        self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);self.url=f'http://127.0.0.1:{self.server.server_address[1]}'
        threading.Thread(target=self.server.serve_forever,daemon=True).start()
    def close(self):self.server.shutdown()

def scenario_social(browser):
    """PLATFORM + SERVICE_API build (like the preview): a member signs in with GitHub and another with Discord
    through the real redirect flow and each posts a comment; a denied consent shows a Korean message with a
    working retry; the GitHub member links and unlinks Discord on the account page."""
    mock=MockProvider()
    # SITE_URL is this local origin: writes purge the edge-cached pages under the site origin.
    port=PORT or free_port();origin=f'http://127.0.0.1:{port}'
    stack=Stack('social',{'SITE_URL':origin,'PLATFORM':'on'},
                {'SITE_URL':origin,'GITHUB_OAUTH_CLIENT_ID':'e2e-github-client','GITHUB_OAUTH_CLIENT_SECRET':'e2e-github-secret','DISCORD_OAUTH_CLIENT_ID':'e2e-discord-client',
                 'DISCORD_OAUTH_CLIENT_SECRET':'e2e-discord-secret','OAUTH_TEST_ORIGIN':mock.url},port=port)
    try:
        now=int(time.time()*1000)
        names=json.dumps({'ko':'E2E 챗','en':'E2E Chat'},ensure_ascii=False).replace("'","''")
        stack.sql(f"INSERT INTO entities(id,vertical,type,slug,names,descriptions,created_at,updated_at) VALUES('service:e2e-chat','ai','service','e2e-chat','{names}','{{}}',{now},{now});"
                  f"INSERT INTO discussions(id,entity_id,post_no,kind,title,body_md,locale,author_id,created_at,updated_at,last_activity_at) VALUES('e2e-post','service:e2e-chat',1,'question','E2E 질문','로그인 테스트','ko','system:radar-bot',{now},{now},{now});")
        health=json.load(urllib.request.urlopen(stack.url+'/api/v1/health',timeout=20))
        ok('social: health lists GitHub and Discord, Google dormant',health['github'] and health['discord'] and not health['google'] and health['providers']==['github','discord'],health)
        post=stack.url+'/ko/ai/e2e-chat/1'
        # --- GitHub, from the comment box of a post
        context=browser.new_context(viewport={'width':1280,'height':900});context._nerulio_base=stack.url;log=[]
        page=context.new_page();instrument(page,log)
        page.goto(post,wait_until='networkidle')
        page.fill('#comment-form textarea','로그인 전 댓글');page.click('#comment-form button[type="submit"]')
        sheet=page.locator('dialog#n2-signin');sheet.wait_for(state='visible',timeout=10000)
        ok('social: a signed-out comment opens the sign-in sheet: passkey first, then the configured providers only',sheet.locator('.sib').count()==3 and sheet.locator('.sib').first.get_attribute('data-provider')=='passkey' and sheet.locator('.sib-github').inner_text().strip()=='GitHub로 계속하기' and sheet.locator('.sib-discord').inner_text().strip()=='Discord로 계속하기' and sheet.locator('.sib-google').count()==0)
        page.screenshot(path=str(SHOTS/'signin-sheet-ko.png'))
        with page.expect_navigation(url=re.compile(r'/ko/ai/e2e-chat/1$'),timeout=30000):sheet.locator('.sib-github').click()
        page.wait_for_function('()=>{const a=document.querySelector(".hd [data-island=account] a");return a&&a.getAttribute("href").endsWith("/community/me")}',timeout=15000)
        ok('social: GitHub sign-in returns to the post, signed in with an automatic nickname',page.url==post and page.locator('.hd [data-island="account"]').inner_text().startswith('user-'),page.url)
        ok('social: the comment typed before signing in is still in the box',page.locator('#comment-form textarea').input_value()=='로그인 전 댓글')
        page.fill('#comment-form textarea','GitHub로 로그인해서 남긴 댓글');page.click('#comment-form button[type="submit"]')
        page.wait_for_function('()=>document.querySelector(".cl")&&document.querySelector(".cl").textContent.includes("GitHub로 로그인해서 남긴 댓글")',timeout=15000)
        ok('social: the GitHub member posted a comment',True)
        gh=stack.sql("SELECT u.id,u.provider_subject,u.email,i.handle FROM users u JOIN user_identities i ON i.user_id=u.id WHERE i.provider='github'")
        ok('social: GitHub account keyed by the numeric id with the verified primary e-mail',len(gh)==1 and gh[0]['provider_subject']=='4242' and gh[0]['email']=='octo@example.test' and gh[0]['handle']=='e2e-octo' and 'github' in mock.tokens,gh)
        page.goto(stack.url+'/ko/community/me',wait_until='networkidle');page.locator('form[data-nickname]:not([hidden])').wait_for(timeout=10000)
        ok('social: 내 정보 pre-fills the GitHub handle as the nickname (saved only when the member saves)',page.locator('form[data-nickname] input').input_value()=='e2e-octo' and page.locator('[data-suggested]').is_visible())
        # --- linking Discord from the account page
        page.goto(stack.url+'/ko/account/',wait_until='networkidle')
        page.locator('[data-identities] [data-linked-provider="github"]').wait_for(timeout=15000)
        ok('social: 연결된 로그인 shows GitHub (not removable while it is the only one) and a Discord link button',page.locator('[data-unlink="github"]').is_disabled() and page.locator('[data-link-provider="discord"] .sib-discord').inner_text().strip()=='Discord 연결하기')
        page.screenshot(path=str(SHOTS/'account-linked-ko.png'),full_page=True)
        with page.expect_navigation(url=re.compile(r'/ko/account/'),timeout=30000):page.locator('[data-link-provider="discord"] a').click()
        page.locator('[data-identities] [data-linked-provider="discord"]').wait_for(timeout=15000)
        ok('social: Discord linked to the same account, with a confirmation','Discord를 연결했어요' in page.locator('#accountStatus').inner_text() and len(stack.sql(f"SELECT 1 FROM user_identities WHERE user_id='{gh[0]['id']}'"))==2)
        page.on('dialog',lambda d:d.accept())
        page.click('[data-unlink="discord"]');page.locator('[data-identities] [data-link-provider="discord"]').wait_for(timeout=15000)
        ok('social: Discord unlinked again; GitHub remains',len(stack.sql(f"SELECT 1 FROM user_identities WHERE user_id='{gh[0]['id']}'"))==1)
        context.close()
        # --- Discord, from the community front page box, on a phone
        context=browser.new_context(viewport={'width':390,'height':900});context._nerulio_base=stack.url;log=[]
        page=context.new_page();instrument(page,log)
        page.goto(stack.url+'/ko/community/',wait_until='networkidle')
        box=page.locator('.box.login')
        ok('social: the front page sign-in box shows the branded buttons',box.locator('.sib-github').count()==1 and box.locator('.sib-discord').count()==1 and box.locator('.sib-google').count()==0)
        w=page.evaluate('document.documentElement.scrollWidth');ok('social: no sideways scroll at 390px',w<=390,w)
        page.screenshot(path=str(SHOTS/'community-signin-box-ko.png'),full_page=True)
        with page.expect_navigation(url=re.compile(r'/ko/community/$'),timeout=30000):box.locator('.sib-discord').click()
        page.wait_for_function('()=>document.querySelector(".box.login")&&document.querySelector(".box.login").textContent.includes("내 구독 채널")',timeout=15000)
        ok('social: Discord sign-in returns to the community front, signed in',True)
        page.goto(post,wait_until='networkidle')
        page.fill('#comment-form textarea','Discord로 로그인해서 남긴 댓글');page.click('#comment-form button[type="submit"]')
        page.wait_for_function('()=>document.querySelector(".cl")&&document.querySelector(".cl").textContent.includes("Discord로 로그인해서 남긴 댓글")',timeout=15000)
        dc=stack.sql("SELECT provider_subject,email FROM users WHERE provider='discord'")
        ok('social: the Discord member posted a comment from a separate account keyed by the snowflake',len(dc)==1 and dc[0]['provider_subject']=='515151515151' and dc[0]['email']=='nelly@example.test',dc)
        ok('social: two members, two comments',len(stack.sql("SELECT 1 FROM comments WHERE discussion_id='e2e-post'"))==2)
        context.close()
        # --- denied consent: a Korean message and a retry that works
        mock.deny.add('github')
        context=browser.new_context(viewport={'width':1280,'height':900});context._nerulio_base=stack.url
        page=context.new_page();page.goto(stack.url+'/ko/account/?return=%2Fko%2Fai%2Fe2e-chat%2F1',wait_until='networkidle')
        with page.expect_navigation(url=re.compile(r'/ko/account/'),timeout=30000):page.locator('.sibs .sib-github').click()
        err=page.locator('.service-error');err.wait_for(timeout=15000)
        ok('social: denied consent → a clear Korean message with 다시 시도','GitHub 로그인을 취소했어요' in err.inner_text() and err.locator('[data-retry]').inner_text()=='다시 시도',err.inner_text())
        page.screenshot(path=str(SHOTS/'signin-denied-ko.png'))
        mock.deny.clear()
        with page.expect_navigation(url=re.compile(r'/ko/ai/e2e-chat/1$'),timeout=30000):err.locator('[data-retry]').click()
        page.wait_for_function('()=>{const a=document.querySelector(".hd [data-island=account] a");return a&&a.getAttribute("href").endsWith("/community/me")}',timeout=15000)
        ok('social: the retry signs in and comes back to the original page',page.url==post)
        context.close()
    finally:
        stack.close();mock.close()

# ------------------------------------------------------------------ member passkeys (고정닉)
def scenario_passkey(browser):
    """PLATFORM build on the real Pages runtime with Cloudflare's always-pass Turnstile testing keys and Chromium's
    virtual authenticator: a reader signs up with a nickname and a passkey from the sign-in sheet (Turnstile, then
    navigator.credentials.create), comments under the fixed nickname, signs out, signs in with 지문으로 로그인, and
    sees the device on the account page. WebAuthn needs a domain RP id, so this stack is served as localhost."""
    port=PORT or free_port();origin=f'http://localhost:{port}'
    stack=Stack('passkey',{'SITE_URL':origin,'PLATFORM':'on'},
                {'SITE_URL':origin,'TURNSTILE_SITE_KEY':'1x00000000000000000000AA','TURNSTILE_SECRET_KEY':'1x0000000000000000000000000000000AA'},port=port)
    try:
        now=int(time.time()*1000)
        names=json.dumps({'ko':'E2E 챗','en':'E2E Chat'},ensure_ascii=False).replace("'","''")
        stack.sql(f"INSERT INTO entities(id,vertical,type,slug,names,descriptions,created_at,updated_at) VALUES('service:e2e-chat','ai','service','e2e-chat','{names}','{{}}',{now},{now});"
                  f"INSERT INTO discussions(id,entity_id,post_no,kind,title,body_md,locale,author_id,created_at,updated_at,last_activity_at) VALUES('e2e-post','service:e2e-chat',1,'question','E2E 질문','패스키 테스트','ko','system:radar-bot',{now},{now},{now});")
        health=json.load(urllib.request.urlopen(origin+'/api/v1/health',timeout=20))
        ok('passkey: health offers passkey sign-up and sign-in (Turnstile configured)',health['passkey']=={'signin':True,'signup':True} and health['turnstile'],health)
        post=origin+'/ko/ai/e2e-chat/1'
        context=browser.new_context(viewport={'width':390,'height':900});context._nerulio_base=origin;log=[]
        page=context.new_page();instrument(page,log)
        cdp=context.new_cdp_session(page);cdp.send('WebAuthn.enable')
        auth=cdp.send('WebAuthn.addVirtualAuthenticator',{'options':{'protocol':'ctap2','transport':'internal','hasResidentKey':True,'hasUserVerification':True,'isUserVerified':True,'automaticPresenceSimulation':True}})['authenticatorId']
        page.goto(post,wait_until='networkidle')
        page.locator('.hd [data-island="account"] a[data-signin]').click()
        sheet=page.locator('dialog#n2-signin');sheet.wait_for(state='visible',timeout=10000)
        ok('passkey: with no OAuth provider configured the sheet still opens, 지문으로 로그인 first',sheet.locator('.sib').count()==1 and sheet.locator('.sib-passkey').inner_text().strip()=='지문으로 로그인')
        sheet.locator('details.pk-new summary').click()
        ok('passkey: the sign-up form warns that losing every device loses the account','기기를 모두 잃어버리면' in sheet.locator('.pk-form').inner_text())
        page.screenshot(path=str(SHOTS/'passkey-sheet-ko.png'))
        sheet.locator('.pk-form input[name="displayName"]').fill('지문테스터')
        with page.expect_navigation(timeout=60000):sheet.locator('.pk-form button[type="submit"]').click()
        page.wait_for_function('()=>{const a=document.querySelector(".hd [data-island=account] a");return a&&a.textContent.trim()==="지문테스터"}',timeout=20000)
        ok('passkey: Turnstile (testing key) + virtual authenticator → signed up and signed in with the fixed nickname',True)
        creds=cdp.send('WebAuthn.getCredentials',{'authenticatorId':auth})['credentials']
        rows=stack.sql("SELECT u.provider,p.display_name,p.role,(SELECT COUNT(*) FROM member_credentials) AS creds,(SELECT COUNT(*) FROM admin_credentials) AS admins FROM users u JOIN user_profiles p ON p.user_id=u.id WHERE u.provider='passkey'")
        ok('passkey: a resident credential on the authenticator; one member account, no admin credential',len(creds)==1 and creds[0]['isResidentCredential'] and rows==[{'provider':'passkey','display_name':'지문테스터','role':'user','creds':1,'admins':0}],rows)
        ok('passkey: the Turnstile token went to sign-up options',any('/api/v1/auth/passkey/register/options' in r['url'] and 'turnstileToken' in r['body'] for r in log))
        page.fill('#comment-form textarea','지문으로 가입해서 남긴 댓글');page.click('#comment-form button[type="submit"]')
        page.wait_for_function('()=>document.querySelector(".cl")&&document.querySelector(".cl").textContent.includes("지문으로 가입해서 남긴 댓글")',timeout=15000)
        ok('passkey: the comment shows the fixed nickname','지문테스터' in page.locator('.cl .co').last.inner_text())
        page.goto(origin+'/ko/community/me',wait_until='networkidle');page.locator('[data-logout]:not([hidden])').wait_for(timeout=10000)
        with page.expect_navigation(timeout=30000):page.click('[data-logout]')
        page.goto(post,wait_until='networkidle')
        ok('passkey: signed out',page.locator('.hd [data-island="account"] a[data-signin]').count()==1)
        page.locator('.hd [data-island="account"] a[data-signin]').click();sheet.wait_for(state='visible',timeout=10000)
        with page.expect_navigation(timeout=60000):sheet.locator('.sib-passkey').click()
        page.wait_for_function('()=>{const a=document.querySelector(".hd [data-island=account] a");return a&&a.textContent.trim()==="지문테스터"}',timeout=20000)
        ok('passkey: 지문으로 로그인 (discoverable credential) signs the member back in',True)
        page.goto(origin+'/ko/account/',wait_until='networkidle')
        page.locator('[data-identities] [data-passkey-device]').wait_for(timeout=15000)
        ok('passkey: the account page lists the device (not removable: the only way in) and offers 이 기기 추가',page.locator('[data-remove-passkey]').is_disabled() and page.locator('[data-passkey-add]').count()==1 and '잃어버리면' in page.locator('[data-passkey-warn]').inner_text())
        page.screenshot(path=str(SHOTS/'passkey-account-ko.png'),full_page=True)
        w=page.evaluate('document.documentElement.scrollWidth');ok('passkey: no sideways scroll at 390px',w<=390,w)
        context.close()
        # A fresh browser on the Japanese account page: passkey sign-in and the sign-up form come first.
        context=browser.new_context(viewport={'width':1280,'height':900});context._nerulio_base=origin
        page=context.new_page();page.goto(origin+'/ja/account/',wait_until='networkidle');page.locator('[data-passkey]').wait_for(timeout=15000)
        ok('passkey: the Japanese account page offers passkey sign-in (ja label) and the sign-up form',page.locator('[data-passkey-signin]').inner_text().strip()=='パスキーでログイン' and page.locator('form[data-passkey-signup] input').count()==1)
        context.close()
    finally:
        stack.close()

# ------------------------------------------------------------------ visitor/bot statistics (server/traffic.js)
def scenario_traffic(browser):
    """PLATFORM + TRAFFIC_HTML build on the real Pages runtime: HTML, robots.txt and sitemaps go through the
    Worker (and are passed through unchanged), assets stay static, and a visible page sends one beacon."""
    stack=Stack('traffic',{'SITE_URL':'https://nerulio.test','PLATFORM':'on'},{},toml=['[[analytics_engine_datasets]]','binding = "TRAFFIC"','dataset = "nerulio_traffic"',''])
    try:
        routes=json.loads((stack.dir/'dist'/'_routes.json').read_text())
        ok('traffic: HTML routed through the Worker, assets excluded',routes['include']==['/*'] and all(p in routes['exclude'] for p in ['/src/*','/assets/*','/favicon.ico']) and '/robots.txt' not in routes['exclude'])
        robots=urllib.request.urlopen(urllib.request.Request(stack.url+'/robots.txt',headers={'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'}),timeout=20)
        ok('traffic: robots.txt served through the Worker unchanged',robots.status==200 and robots.read().decode().startswith('User-agent: *'))
        sm=urllib.request.urlopen(urllib.request.Request(stack.url+'/sitemap.xml',headers={'User-Agent':'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)'}),timeout=20)
        ok('traffic: sitemap served through the Worker',sm.status==200 and b'<sitemapindex' in sm.read())
        js=urllib.request.urlopen(stack.url+'/src/hit.js',timeout=20)
        ok('traffic: beacon script is a static asset','javascript' in js.headers.get('content-type','') and b'sendBeacon' in js.read())
        try:
            urllib.request.urlopen(urllib.request.Request(stack.url+'/api/v2/hit',data=b'{"p":"/ko/"}',method='POST',headers={'Content-Type':'text/plain','Origin':'https://evil.test','Sec-Fetch-Site':'cross-site'}),timeout=20);cross=200
        except urllib.error.HTTPError as e:cross=e.code
        ok('traffic: cross-site hits are refused',cross==403)
        context=browser.new_context();context._nerulio_base=stack.url;log=[]
        page=context.new_page();instrument(page,log)
        with page.expect_response(lambda r:r.url.endswith('/api/v2/hit'),timeout=15000) as hit:
            response=page.goto(stack.url+'/ko/image/crop/',wait_until='domcontentloaded')
        ok('traffic: page HTML served through the Worker',response.status==200 and '/src/hit.js' in response.text())
        ok('traffic: one beacon per visible pageview, answered 204',hit.value.status==204)
        page.wait_for_timeout(1500)
        beacons=[r for r in log if r['url'].endswith('/api/v2/hit')]
        body=json.loads(beacons[0]['body']) if beacons else {}
        ok('traffic: exactly one beacon with path, source, device, language only',len(beacons)==1 and set(body)=={'p','r','d','l','e','w'} and body['p']=='/ko/image/crop/' and body['r']=='direct')
        context.close()
    finally:stack.close()

with sync_playwright() as p:
    browser=p.chromium.launch()
    try:
        only=os.environ.get('SERVICE_SCENARIOS','free,ads,studio,signin,social,passkey,traffic').split(',')
        if 'free' in only:scenario_free(browser)
        if 'ads' in only:scenario_ads(browser)
        if 'studio' in only:scenario_studio(browser)
        if 'signin' in only:scenario_signin(browser)
        if 'social' in only:scenario_social(browser)
        if 'passkey' in only:scenario_passkey(browser)
        if 'traffic' in only:scenario_traffic(browser)
    finally:browser.close()
if errors:raise AssertionError('page errors: '+'; '.join(errors[:5]))
(OUT/'service-browser-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
print(f'SERVICE E2E PASSED {len(checks)} checks',flush=True)
