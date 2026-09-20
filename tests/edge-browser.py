"""Smoke test an ad-enabled fixture served by Wrangler Pages/workerd, never Google.
Start Wrangler with test-results/seo/ads/dist on 4275 before running this file.
"""
from playwright.sync_api import sync_playwright,expect
import re,json
from pathlib import Path
checks=[]
def ok(name,value):
    assert value,name
    checks.append(name);print('PASS',name)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    context=browser.new_context(locale='en-US')
    context.route(re.compile(r'https://.*(?:googlesyndication|doubleclick|googleadservices|google\.com|gstatic)'),lambda r:r.fulfill(status=200,content_type='text/javascript',body='window.adsbygoogle=window.adsbygoogle||[];'))
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    response=page.goto('http://127.0.0.1:4275/en/image/upscale/?scale=2',wait_until='networkidle')
    ok('Wrangler serves ad-enabled HTML',response.status==200)
    policy=response.headers['content-security-policy'];n=re.search("'nonce-([^']+)'",policy)[1]
    ok('strict CSP response',"'strict-dynamic'" in policy)
    # JSON-LD inserted later by the app is inert; check executable scripts only.
    ok('script nonces match response',page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(n=>n.nonce)')==[n]*page.locator('script[src]').count())
    ok('nonce HTML not cached',response.headers.get('cache-control')=='no-store')
    ok('two manual content slots',page.locator('.ad-slot').count()==2 and page.locator('#workspace .ad-slot').count()==0)
    page.locator('[data-action=sample]').click();expect(page.locator('#workspace')).to_have_attribute('aria-busy','false')
    page.locator('[data-action=intent-run]').click();expect(page.locator('#workspace')).to_have_attribute('aria-busy','false')
    ok('editor executes under workerd CSP','1440 × 1120' in page.locator('#stageBadge').inner_text())
    page.locator('#languageSelect').select_option('ja');expect(page.locator('#workspace')).to_have_attribute('aria-busy','false')
    ok('language preserves result under workerd','1440 × 1120' in page.locator('#stageBadge').inner_text())
    after=page.reload(wait_until='networkidle')
    ok('new response new nonce',after.headers['content-security-policy']!=policy)
    ok('JS asset delivered',context.request.get('http://127.0.0.1:4275/src/app.js').status==200)
    ok('ads.txt delivered',context.request.get('http://127.0.0.1:4275/ads.txt').text().startswith('google.com, pub-'))
    result=page.goto('http://127.0.0.1:4275/ja/privacy/',wait_until='networkidle')
    ok('policy document on workerd',result.status==200 and page.locator('html').get_attribute('lang')=='ja')
    result=page.goto('http://127.0.0.1:4275/missing-document/',wait_until='networkidle')
    ok('real Pages 404',result.status==404)
    ok('no uncaught exceptions',not errors)
    browser.close()
Path('test-results/edge-results.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2),encoding='utf-8')
print('PASS TOTAL',len(checks))
