"""Landing pages run their real tool with their preset (served by tools/regression.py on :4173)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io,json,os
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173');checks=[];errors=[]
def ok(name,cond):
    assert cond,name
    checks.append(name);print('PASS',name,flush=True)
def png(w,h,alpha):
    im=Image.new('RGBA' if alpha else 'RGB',(w,h),(30,120,220,180) if alpha else (30,120,220))
    for x in range(0,w,7):im.putpixel((x,(x*3)%h),(250,240,10,255) if alpha else (250,240,10))
    b=io.BytesIO();im.save(b,'PNG');return b.getvalue()
def idle(p):p.locator('#workspace[aria-busy="false"]').wait_for(timeout=60000)
CASES=[('/ko/image/png-to-jpg/','JPEG',None,None,True),('/en/image/resize/youtube-thumbnail/','PNG',(1280,720),None,True),
       ('/ja/image/compress-to-100kb/',None,None,100*1024,False),('/en/image/resize/instagram-story/','PNG',(1080,1920),None,True)]
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    for path,fmt,dims,maxbytes,alpha in CASES:
        page=browser.new_page(accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+path,wait_until='networkidle')
        ok(f'{path} self canonical',page.locator('link[rel=canonical]').get_attribute('href').endswith(path))
        ok(f'{path} indexable',page.locator('meta[name=robots]').count()==0)
        page.locator('#fileInput').set_input_files(files=[{'name':'input.png','mimeType':'image/png','buffer':png(1600,1000,alpha)}]);idle(page)
        page.locator('[data-action="intent-run"]').click();page.wait_for_timeout(200);idle(page)
        with page.expect_download() as d:page.locator('[data-action="intent-download"]').click()
        f=d.value.path();im=Image.open(f)
        if fmt:ok(f'{path} output format {fmt}',im.format==fmt)
        if dims:ok(f'{path} exact dimensions {dims}',im.size==dims)
        if maxbytes:ok(f'{path} under target size',os.path.getsize(f)<=maxbytes)
        page.locator('#languageSelect').select_option('ko');idle(page)
        ok(f'{path} language switch keeps the landing URL',page.url.endswith('/ko/'+path.split('/',2)[2]))
        ok(f'{path} language switch keeps landing canonical',page.locator('link[rel=canonical]').get_attribute('href').endswith('/ko/'+path.split('/',2)[2]))
        page.close()
    base=browser.new_page();base.goto(BASE+'/en/image/compress/',wait_until='networkidle')
    ok('base tool links to its task pages',base.locator('.landing-links a[href="en/image/compress-to-100kb/"]').count()==1)
    browser.close()
assert not errors,errors
(OUT/'landings-browser-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
print('LANDINGS BROWSER PASSED',len(checks))
