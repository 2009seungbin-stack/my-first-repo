"""End-to-end test of the Nerulio service layer on the real Pages runtime.

For each scenario this builds dist/ with SERVICE_API=on into a temporary directory, applies
migrations/ to an isolated *local* D1 (miniflare sqlite under that directory), and serves it
with `wrangler pages dev` (workerd). Production D1 and real billing are never contacted.
Google OAuth is not exercised here (tests/service.test.mjs covers it with a mocked token
endpoint); signed-in users are created directly in the local database.

Requires: Node + npx (downloads wrangler), Python Playwright + Chromium.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64, hashlib, hmac, io, json, os, re, shutil, signal, socket, subprocess, sys, tempfile, time, urllib.request, uuid
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
class Stack:
    """One isolated deployment: build + local D1 + wrangler pages dev."""
    def __init__(self,name,build_env,vars):
        self.dir=Path(tempfile.mkdtemp(prefix=f'nerulio-{name}-'));self.port=free_port();self.url=f'http://127.0.0.1:{self.port}'
        env={k:v for k,v in os.environ.items() if not k.startswith(('ADSENSE_','CF_PAGES','SITE_','SERVICE_','PRO_PRICE','FREE_DAILY'))}
        env.update(build_env);env['SERVICE_API']='on'
        r=subprocess.run(['node','-e',"import('./tools/build.mjs').then(m=>m.build({outDir:process.argv[1],env:process.env}))",str(self.dir/'dist')],cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
        if r.returncode:raise RuntimeError(r.stderr)
        lines=[f'{k} = {json.dumps(v)}' for k,v in {'SESSION_SECRET':SECRET,'NERULIO_ENV':'development',**vars}.items()]
        (self.dir/'wrangler.toml').write_text('\n'.join([
            'name = "nerulio-e2e"','pages_build_output_dir = "./dist"','compatibility_date = "2026-09-18"','',
            '[[d1_databases]]','binding = "DB"','database_name = "nerulio-e2e"','database_id = "00000000-0000-4000-8000-000000000001"',
            f'migrations_dir = {json.dumps((ROOT/"migrations").as_posix())}','','[vars]',*lines,'']),encoding='utf-8')
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
        # Light tools never call the API and keep working after the limit.
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

        # Outage: the API is unreachable. Light tools work; heavy tools get a small grace.
        context=browser.new_context(accept_downloads=True);context._nerulio_base=stack.url;log=[]
        context.route('**/api/v1/**',lambda route:route.abort())
        page=open_tool(context,stack,'/en/image/crop/',log,wait_me=False);page.wait_for_timeout(1500)
        ok('header link hidden when service is down',page.locator('#accountLink').is_hidden())
        load_file(page);run_intent(page);ok('crop works during an API outage',download_ok(page))
        up=open_tool(context,stack,'/en/image/upscale/?mode=smooth',log,wait_me=False);load_file(up)
        for i in range(3):run_intent(up)
        ok('3 grace heavy jobs during an outage produce output',download_ok(up))
        attempt(up);up.wait_for_timeout(600);idle(up)
        ok('after grace, heavy tools pause with a message',up.locator('#serviceToast').is_visible())
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

with sync_playwright() as p:
    browser=p.chromium.launch()
    try:
        scenario_free(browser);scenario_ads(browser)
    finally:browser.close()
if errors:raise AssertionError('page errors: '+'; '.join(errors[:5]))
(OUT/'service-browser-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
print(f'SERVICE E2E PASSED {len(checks)} checks',flush=True)
