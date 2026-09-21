"""Home directory and single-task UI, end to end (served by tools/regression.py on :4173)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io,json,os,zipfile
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173');checks=[];errors=[]
def ok(name,cond,detail=''):
    assert cond,f'{name} {detail}'
    checks.append(name);print('PASS',name,flush=True)
def photo(w,h,seed):
    im=Image.radial_gradient('L').resize((w,h)).convert('RGB');px=im.load()
    for i in range(0,w,5):px[i,(i*seed)%h]=(255,40+seed*20,0)
    noise=Image.effect_noise((w,h),18).convert('RGB');im=Image.blend(im,noise,.25);b=io.BytesIO();im.save(b,'PNG');return b.getvalue()
FILES=[{'name':'holiday photo.png','mimeType':'image/png','buffer':photo(1400,900,3)},{'name':'product.png','mimeType':'image/png','buffer':photo(900,900,5)}]
def ready(p):p.wait_for_function('()=>{const b=document.querySelector("#taskDownload");return b&&!b.disabled}',timeout=120000)
def drop(page,selector,files):
    page.evaluate('''async({selector,files})=>{const dt=new DataTransfer();for(const f of files)dt.items.add(new File([Uint8Array.from(atob(f.b64),c=>c.charCodeAt(0))],f.name,{type:f.type}));
      document.querySelector(selector).dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}''',{'selector':selector,'files':files})
import base64
B64=[{'name':f['name'],'type':f['mimeType'],'b64':base64.b64encode(f['buffer']).decode()} for f in FILES]
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    ctx=browser.new_context(viewport={'width':1366,'height':900},accept_downloads=True);page=ctx.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:m.type=='error' and errors.append(m.text[:200]))
    requests=[];page.on('request',lambda r:requests.append(r.url))
    # --- home ---
    page.goto(BASE+'/ko/',wait_until='networkidle')
    ok('home is a tool directory with categories',page.locator('.directory section').count()==4 and page.locator('.tool-card').count()>=35)
    ok('home has one h1 and no editor shell',page.locator('h1').count()==1 and page.locator('#workspace').count()==0)
    page.fill('#toolQuery','pdf 합치기');page.wait_for_timeout(150)
    ok('search narrows to the matching tool',page.locator('.tool-card:visible').evaluate_all('ns=>ns.map(n=>n.dataset.tool)')==['pdf-merge'])
    page.fill('#toolQuery','zzzz');page.wait_for_timeout(150);ok('search explains an empty result',page.locator('#noResult').is_visible())
    page.fill('#toolQuery','');page.wait_for_timeout(150)
    page.locator('#languageSelect').select_option('en');page.wait_for_timeout(200)
    ok('language switch relabels the directory and URL',page.url.endswith('/en/') and page.locator('.tool-card[data-tool="compress"] b').inner_text()=='Compress image' and page.locator('.tool-card[data-tool="compress"]').get_attribute('href').endswith('/en/image/compress/'))
    drop(page,'body',B64);page.locator('#suggest .chip').first.wait_for()
    ok('dropping images suggests image tools',page.locator('#suggest [data-suggest]').evaluate_all('ns=>ns.map(n=>n.dataset.suggest)')[:3]==['compress','convert','resize'])
    page.locator('#suggest [data-suggest="compress"]').click();page.wait_for_url('**/en/image/compress/');ready(page)
    ok('files travel from home to the tool without re-selecting',page.locator('.file').count()==2)
    ok('no file bytes left the browser',not any('/api/' in u or 'upload' in u for u in requests) and all(u.startswith(BASE) or u.startswith('blob:') for u in requests))
    # --- batch workspace ---
    summary=page.locator('#taskSummary .summary-big').inner_text()
    ok('result is shown big as a percentage',summary.startswith('−') and summary.endswith('%') and int(summary[1:-1])>=50,summary)
    ok('each file shows its own saving',page.locator('.file .pill.good').count()==2)
    ok('one primary action',page.locator('.side .primary').count()==1 and 'ZIP' in page.locator('#taskDownload').inner_text())
    ok('advanced settings are collapsed by default',not page.locator('#optionsAdvanced').evaluate('d=>d.open'))
    ok('before/after comparison is present',page.locator('#cmpBefore').get_attribute('src').startswith('blob:') and page.locator('#cmpAfter').is_visible())
    before=page.locator('#taskSummary .summary-line').inner_text()
    page.locator('[data-level="small"]').click();page.wait_for_timeout(500);ready(page)
    ok('changing the level re-runs without re-adding files',page.locator('.file').count()==2 and page.locator('#taskSummary .summary-line').inner_text()!=before)
    page.locator('#languageSelect').select_option('ja');page.wait_for_timeout(300)
    ok('language switch keeps files and results',page.locator('.file .pill.good').count()==2 and page.url.endswith('/ja/image/compress/') and page.locator('#taskTitle').inner_text()=='画像を圧縮')
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path());names=z.namelist()
    ok('ZIP holds one compressed file per input',len(names)==2 and all(n.endswith(('.webp','.jpg','.png')) for n in names),str(names))
    ok('outputs decode and keep their dimensions',sorted(Image.open(io.BytesIO(z.read(n))).size for n in names)==[(900,900),(1400,900)])
    with page.expect_download() as d:page.locator('[data-action="task-save"]').first.click()
    ok('a single file can be saved on its own',os.path.getsize(d.value.path())>0)
    page.locator('[data-action="task-remove"]').first.click();page.wait_for_timeout(200);ok('a file can be removed',page.locator('.file').count()==1)
    page.locator('[data-action="task-next"][data-tool="convert"]').click();page.wait_for_url('**/ja/image/convert/');ready(page)
    ok('"continue with" carries the result into the next tool',page.locator('.file').count()==1)
    # --- convert ---
    ok('convert shows the target format big',page.locator('#taskSummary .summary-big').inner_text()=='→ PNG')
    page.locator('[data-format="jpeg"]').click();page.wait_for_timeout(500);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    ok('convert really writes a JPG',Image.open(d.value.path()).format=='JPEG' and d.value.suggested_filename.endswith('.jpg'))
    page.goto(BASE+'/en/png-to-webp/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[FILES[1]]);ready(page)
    ok('old alias route presets its format',page.locator('[data-format="webp"]').get_attribute('aria-pressed')=='true' and page.locator('.file .pill').inner_text()=='WebP')
    # --- resize ---
    page.goto(BASE+'/ko/image/resize/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=FILES);ready(page)
    with page.expect_download() as d:page.locator('[data-action="task-save"]').first.click()
    ok('resize defaults to 50% per file',Image.open(d.value.path()).size==(700,450))
    page.locator('[data-mode="size"]').click();page.fill('#resizeW','400');page.wait_for_timeout(600);ready(page)
    ok('width only keeps each ratio',page.locator('.file .pill').all_inner_texts()==['400×257','400×400'],str(page.locator('.file .pill').all_inner_texts()))
    page.goto(BASE+'/en/image/resize/youtube-thumbnail/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[FILES[1]]);ready(page)
    ok('social preset gives exact dimensions big',page.locator('#taskSummary .summary-big').inner_text()=='1280 × 720')
    with page.expect_download() as d:page.locator('#taskDownload').click()
    ok('social preset output is exactly 1280x720',Image.open(d.value.path()).size==(1280,720))
    # --- PDF organiser (merge / split) ---
    def pdf(pages,label):
        ims=[]
        for i in range(pages):
            im=Image.new('RGB',(620,877),'white');px=im.load()
            for x in range(60,560):
                for y in range(100+i*40,110+i*40):px[x,y]=(20,40,160)
            ims.append(im)
        b=io.BytesIO();ims[0].save(b,'PDF',save_all=True,append_images=ims[1:]);return {'name':label+'.pdf','mimeType':'application/pdf','buffer':b.getvalue()}
    count=lambda n:page.wait_for_function('n=>document.querySelectorAll(".pg").length===n',arg=n,timeout=90000)
    page.goto(BASE+'/ko/pdf/merge/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[pdf(3,'b-report'),pdf(2,'a-cover'),FILES[1]]);count(6)
    ok('merge shows every page of every file, images included',page.locator('.pg-src').all_inner_texts()[:6]==['A','A','A','B','B','C'] and page.locator('#pdfSummary .summary-big').inner_text()=='6쪽')
    page.wait_for_function('()=>[...document.querySelectorAll(".pg img")].every(i=>i.src)',timeout=60000);ok('thumbnails render',True)
    page.locator('.pg').nth(1).click();page.locator('.pg').nth(3).click(modifiers=['Control'])
    ok('multi-select with Ctrl',page.locator('.pg.is-selected').count()==2)
    page.locator('[data-action="pdf-delete"]').click();count(4);page.keyboard.press('Control+z');count(6);ok('delete and undo',True)
    page.locator('.pg').nth(5).drag_to(page.locator('.pg').nth(0),target_position={'x':5,'y':60});page.wait_for_timeout(300)
    ok('drag to reorder',page.locator('.pg-src').all_inner_texts()[0]=='C')
    page.locator('[data-action="pdf-sort"]').click();page.wait_for_timeout(200)
    ok('sort files A–Z regroups pages',page.locator('.pg').evaluate_all('ns=>ns.map(n=>n.querySelector(".pg-src").title)')[:2]==['a-cover.pdf','a-cover.pdf'])
    page.locator('.pg').first.locator('[data-action="pg-rotate"]').click();page.wait_for_timeout(200)
    with page.expect_download() as d:page.locator('#pdfRun').click()
    merged=d.value.path()
    ok('merge downloads one PDF and shows the result',d.value.suggested_filename.endswith('-merged.pdf') and os.path.getsize(merged)>1000 and page.locator('#pdfResult').is_visible())
    facts=page.evaluate('''async b64=>{const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js'),d=await L.PDFDocument.load(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));return {pages:d.getPageCount(),rotation:d.getPage(0).getRotation().angle}}''',base64.b64encode(open(merged,'rb').read()).decode())
    ok('merged PDF really has 6 pages and the rotation',facts=={'pages':6,'rotation':90},str(facts))
    page.goto(BASE+'/en/pdf/split/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[pdf(5,'book')]);count(5)
    ok('split defaults to one file per page',page.locator('#pdfRun').inner_text().startswith('Split into 5'))
    page.locator('[data-mode="every"]').click();page.wait_for_timeout(200);ok('every 2 pages → 3 files with visible markers',page.locator('#pdfRun').inner_text().startswith('Split into 3') and page.locator('.pg[data-part]').count()==3)
    page.locator('[data-mode="ranges"]').click();page.fill('#pdfRanges','1-2; 9');page.wait_for_timeout(200);ok('bad ranges block the run with a reason',page.locator('#pdfRun').is_disabled())
    page.fill('#pdfRanges','1-2; 3-5');page.wait_for_timeout(200)
    with page.expect_download() as d:page.locator('#pdfRun').click()
    z=zipfile.ZipFile(d.value.path());ok('split writes one PDF per range',z.namelist()==['book-split-1.pdf','book-split-2.pdf'] and all(z.read(n)[:5]==b'%PDF-' for n in z.namelist()))
    page.locator('[data-mode="selected"]').click();ok('extract needs a selection',page.locator('#pdfRun').is_disabled())
    page.locator('.pg').nth(4).click();
    with page.expect_download() as d:page.locator('#pdfRun').click()
    ok('extract selected pages as one PDF',d.value.suggested_filename=='book-split-1.pdf')
    # --- target size preset from a landing page ---
    page.goto(BASE+'/en/image/compress-to-100kb/',wait_until='networkidle')
    ok('landing preset opens advanced with its target',page.locator('#fileInput').count()==1)
    page.locator('#fileInput').set_input_files(files=[FILES[0]]);ready(page)
    ok('landing target is applied',page.locator('#compressTarget').input_value()=='100' and page.locator('#optionsAdvanced').evaluate('d=>d.open'))
    with page.expect_download() as d:page.locator('#taskDownload').click()
    ok('target size is met',os.path.getsize(d.value.path())<=100*1024)
    page.locator('[data-action="task-clear"]').click();ok('clear returns to the drop zone',page.locator('.dropzone').is_visible())
    txt=page.evaluate('()=>new Promise(r=>{const i=document.querySelector("#fileInput");const dt=new DataTransfer();dt.items.add(new File(["x"],"notes.txt",{type:"text/plain"}));i.files=dt.files;i.dispatchEvent(new Event("change"));setTimeout(()=>r(document.querySelector("#toast").textContent),200)})')
    ok('wrong file type is explained, not ignored',len(txt)>5)
    # --- phone ---
    phone=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page();phone.on('pageerror',lambda e:errors.append(str(e)))
    for path in ['/ko/','/ko/image/compress/']:
        phone.goto(BASE+path,wait_until='networkidle')
        ok(f'no horizontal scroll on a phone {path}',phone.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'))
    phone.locator('[data-action="task-sample"]').click();ready(phone)
    ok('sample produces a real saving on a phone',int(phone.locator('#taskSummary .summary-big').inner_text()[1:-1])>=50)
    ok('no horizontal scroll with results on a phone',phone.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'))
    browser.close()
assert not errors,errors
(OUT/'task-browser-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
print('TASK UI BROWSER PASSED',len(checks))
