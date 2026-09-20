"""Real HTTP/CSP checks. Ad mode intercepts Google requests; no test ID reaches Google.
Requires Python Playwright + Pillow and `python -m playwright install chromium`.
Runs isolated builds/servers, restores no files, terminates only its own processes.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import os, subprocess, json, time, urllib.request, hashlib, re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'/'seo'; OUT.mkdir(parents=True,exist_ok=True)
checks=[]; errors=[]
def ok(name,condition):
    assert condition,name
    checks.append(name); print('PASS',name,flush=True)
def idle(page):
    expect(page.locator('#workspace')).to_have_attribute('aria-busy','false',timeout=30000)
def run_mode(browser,mode,index):
    out=OUT/mode/'dist'; port=4270+index
    env=os.environ.copy()
    for key in ['SITE_URL','ADSENSE_CLIENT','ADSENSE_SLOT_CONTENT_1','ADSENSE_SLOT_CONTENT_2','ADSENSE_CMP_READY','CF_PAGES_BRANCH','SITE_ENV','BASE_PATH']:env.pop(key,None)
    if mode!='disabled':env['SITE_URL']='https://fileforge.example.test/'
    if mode in ['ads','preview']:
        env.update(ADSENSE_CLIENT='ca-pub-3141592653589793',ADSENSE_SLOT_CONTENT_1='1234567890',ADSENSE_SLOT_CONTENT_2='9876543210',ADSENSE_CMP_READY='true')
    if mode=='preview':env['CF_PAGES_BRANCH']='seo-preview'
    command="import {build} from './tools/build.mjs'; await build({outDir:process.argv[1]});"
    subprocess.run(['node','--input-type=module','-e',command,str(out)],cwd=ROOT,env=env,check=True)
    env.update(PORT=str(port),DIST_DIR=str(out))
    server=subprocess.Popen(['node','tools/serve.mjs','--dist'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        for _ in range(100):
            try:urllib.request.urlopen(f'http://127.0.0.1:{port}/',timeout=1);break
            except OSError:time.sleep(.1)
        context=browser.new_context(locale='en-US',viewport={'width':1440,'height':1000},accept_downloads=True)
        context.on('page',lambda p:p.on('pageerror',lambda e:errors.append(str(e))))
        requests=[]; context.on('request',lambda r:requests.append(r.url))
        # Synthetic publisher fixture is intercepted BEFORE any navigation.
        if mode=='ads':
            mock='''function fill(){document.querySelectorAll('ins.adsbygoogle:not([data-mock])').forEach(ad=>{ad.dataset.mock='true';const frame=document.createElement('iframe');frame.src='/favicon.svg?ad-fixture='+ad.dataset.adSlot;frame.width='180';frame.height='90';frame.title='Mock ad';ad.append(frame);});}window.adsbygoogle={push:fill};fill();'''
            context.route(re.compile(r'https://.*(?:googlesyndication|doubleclick|googleadservices|google\.com|gstatic)'),lambda r:r.fulfill(status=200,content_type='text/javascript',body=mock))
        page=context.new_page(); base=f'http://127.0.0.1:{port}'
        routes=['/','/en/image/upscale/','/ko/image/remove-bg/','/ja/pdf/merge/','/ko/image/compress/','/en/pixel/']
        for route in routes:
            response=page.goto(base+route,wait_until='networkidle');idle(page)
            ok(mode+' direct '+route,response.status==200)
            lang=route.split('/')[1] if route.split('/')[1] in ['ko','en','ja'] else 'en'
            ok(mode+' locale '+route,page.locator('html').get_attribute('lang')==lang)
            ok(mode+' title and h1 '+route,page.title()==page.locator('h1').inner_text()+' · Nerulio')
            ok(mode+' description '+route,len(page.locator('meta[name="description"]').get_attribute('content'))>10)
            ok(mode+' guide and FAQ '+route,page.locator('.reading-content ol li').count()==3 and page.locator('.faq details').count()==3)
            if mode=='disabled':
                ok('no-domain omits absolute SEO '+route,page.locator('link[rel=canonical]').count()==0 and page.locator('link[hreflang]').count()==0)
            else:
                canonical=page.locator('link[rel=canonical]').get_attribute('href')
                ok(mode+' canonical '+route,canonical=='https://fileforge.example.test'+('/en/' if route=='/' else route))
                ok(mode+' hreflang '+route,page.locator('link[hreflang]').count()==4)
            if mode=='ads':
                ok('two content-only ad slots '+route,page.locator('.ad-slot').count()==2 and page.locator('#workspace .ad-slot').count()==0)
                first=page.locator('.ad-slot').first.bounding_box();editor=page.locator('#workspace').bounding_box()
                ok('ads separated from editor '+route,first['y']>editor['y']+editor['height']+100)
            else:ok(mode+' no ad markup '+route,page.locator('.ad-slot,ins.adsbygoogle,script[src*="adsbygoogle"]').count()==0)
            page.reload(wait_until='networkidle');idle(page);ok(mode+' refresh '+route,page.locator('h1').inner_text()!='')
        if mode!='ads':ok(mode+' initial load has no external requests',all(u.startswith(base) or u.startswith('blob:') for u in requests))
        page.goto(base+'/en/image/upscale/?scale=4&format=png',wait_until='networkidle')
        if mode!='disabled':ok(mode+' query canonical clean','?' not in page.locator('link[rel=canonical]').get_attribute('href'))
        page.locator('[data-action="sample"]').click();idle(page)
        page.locator('[data-action="intent-run"]').click();idle(page)
        with page.expect_download() as d:page.locator('[data-action="intent-download"]').click()
        first=OUT/(mode+'-before.png');d.value.save_as(first)
        ad_nodes=page.locator('.ad-slot').evaluate_all('(nodes)=>{window.savedAds=nodes;return nodes.length}')
        before_ad_requests=len([u for u in requests if 'googlesyndication' in u or 'ad-fixture=' in u])
        for lang in ['ja','ko','en']:
            page.locator('#languageSelect').select_option(lang);idle(page)
            ok(mode+' switch preserves query '+lang,'scale=4' in page.url and 'format=png' in page.url)
            ok(mode+' switch localized guide '+lang,page.locator('html').get_attribute('lang')==lang)
            if mode!='disabled':ok(mode+' switch updates canonical '+lang,f'/{lang}/image/upscale/' in page.locator('link[rel=canonical]').get_attribute('href'))
        with page.expect_download() as d:page.locator('[data-action="intent-download"]').click()
        second=OUT/(mode+'-after.png');d.value.save_as(second)
        ok(mode+' file and result bytes survive languages',hashlib.sha256(first.read_bytes()).digest()==hashlib.sha256(second.read_bytes()).digest())
        ok(mode+' no ad or iframe refresh on locale changes',len([u for u in requests if 'googlesyndication' in u or 'ad-fixture=' in u])==before_ad_requests)
        if ad_nodes:ok('ad nodes preserved',page.locator('.ad-slot').evaluate_all('(nodes)=>nodes.every((n,i)=>n===window.savedAds[i])'))
        page.locator('[data-action="intent-settings"]').click();page.locator('#scaleMode').select_option('pixel');page.locator('#languageSelect').select_option('ja');idle(page)
        ok(mode+' pending edit state retained',page.locator('#scaleMode').input_value()=='pixel')
        for locale in ['ko','en','ja']:
            for width in [320,390]:
                page.set_viewport_size({'width':width,'height':844});page.goto(base+f'/{locale}/image/upscale/',wait_until='networkidle')
                ok(mode+f' {locale} {width}px overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            page.screenshot(path=str(OUT/f'{mode}-{locale}-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1000});page.goto(base+'/en/image/upscale/',wait_until='networkidle');page.screenshot(path=str(OUT/f'{mode}-desktop.png'),full_page=True)
        for locale in ['ko','en','ja']:
            for policy in ['about','privacy','terms','contact']:
                res=page.goto(base+f'/{locale}/{policy}/',wait_until='networkidle')
                ok(mode+' policy '+locale+'/'+policy,res.status==200 and page.locator('html').get_attribute('lang')==locale and page.locator('h1').count()==1)
                ok(mode+' policy no editor '+locale+'/'+policy,page.locator('#workspace').count()==0)
        page.goto(base+'/privacy/',wait_until='networkidle');page.locator('.policy-languages a[lang=ko]').click()
        ok(mode+' policy language switches',page.locator('html').get_attribute('lang')=='ko' and '/ko/privacy/' in page.url)
        res=page.goto(base+'/this-page-does-not-exist/',wait_until='networkidle');ok(mode+' real 404',res.status==404 and '404' in page.locator('h1').inner_text())
        res=page.goto(base+'/ja/pdf/merge?pages=1',wait_until='networkidle');ok(mode+' slash redirect retains query','/ja/pdf/merge/?pages=1' in page.url and res.status==200)
        if mode=='preview':ok('preview response noindex',res.headers.get('x-robots-tag')=='noindex, nofollow')
        context.close()
    finally:
        server.terminate();server.wait(timeout=10)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    for i,mode in enumerate(['disabled','production','ads','preview']):run_mode(browser,mode,i)
    browser.close()
ok('no uncaught exceptions',not errors)
(OUT/'results.json').write_text(json.dumps({'checks':checks,'errors':errors,'ad_testing':'Google requests intercepted, no live ad serving or CMP validation'},ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS TOTAL',len(checks))
