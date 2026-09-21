"""Home directory and single-task UI, end to end (served by tools/regression.py on :4173)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io,json,os,shutil,subprocess,zipfile
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
    # --- PDF compress / PDF → JPG / JPG → PDF ---
    def photo_pdf():
        ims=[Image.open(io.BytesIO(photo(1200,1600,i+2))).convert('RGB') for i in range(2)];b=io.BytesIO();ims[0].save(b,'PDF',save_all=True,append_images=ims[1:],quality=95);return {'name':'scan.pdf','mimeType':'application/pdf','buffer':b.getvalue()}
    SCAN=photo_pdf()
    page.goto(BASE+'/ko/pdf/compress/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[SCAN]);ready(page)
    saving=int(page.locator('#taskSummary .summary-big').inner_text()[1:-1]);ok('PDF compress shows a real saving',saving>=30,str(saving))
    with page.expect_download() as d:page.locator('#taskDownload').click()
    raw=open(d.value.path(),'rb').read();ok('compressed PDF is a smaller valid PDF',raw[:5]==b'%PDF-' and len(raw)<len(SCAN['buffer']))
    ok('PDF thumbnail shows the first page',page.locator('.file img').get_attribute('src').startswith('blob:'))
    page.goto(BASE+'/en/pdf-to-jpg/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[SCAN]);ready(page)
    ok('PDF → JPG counts the images',page.locator('#taskSummary .summary-big').inner_text()=='2 image(s)')
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path());ok('one JPG per page',len(z.namelist())==2 and all(Image.open(io.BytesIO(z.read(n))).format=='JPEG' for n in z.namelist()),str(z.namelist()))
    page.goto(BASE+'/ja/jpg-to-pdf/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=FILES);count(2)
    page.locator('[data-size="fit"]').click();page.wait_for_timeout(300);count(2);page.locator('[data-margin="0"]').click();page.wait_for_timeout(300);count(2)
    with page.expect_download() as d:page.locator('#pdfRun').click()
    facts=page.evaluate('''async b64=>{const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js'),d=await L.PDFDocument.load(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));const s=d.getPage(0).getSize();return {pages:d.getPageCount(),w:Math.round(s.width),h:Math.round(s.height)}}''',base64.b64encode(open(d.value.path(),'rb').read()).decode())
    ok('JPG → PDF: one page per image at the image size',facts=={'pages':2,'w':1050,'h':675},str(facts))
    # --- PDF editor ---
    page.goto(BASE+'/en/pdf/editor/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[pdf(2,'contract')])
    page.wait_for_function('()=>document.querySelector("#edCanvas")&&document.querySelector("#edCanvas").width>300',timeout=90000)
    ok('editor opens with a toolbar, page rail and one primary action',page.locator('.ed-tool[data-tool]').count()==11 and page.locator('.ed-thumb').count()==2 and page.locator('.ed-side .primary').count()==1)
    box=page.locator('#edPage').bounding_box();X=lambda u:box['x']+box['width']*u;Y=lambda v:box['y']+box['height']*v
    def draw(tool_id,a,b):
        page.click(f'[data-tool="{tool_id}"]');page.mouse.move(X(a[0]),Y(a[1]));page.mouse.down();page.mouse.move(X((a[0]+b[0])/2),Y((a[1]+b[1])/2));page.mouse.move(X(b[0]),Y(b[1]));page.mouse.up()
    page.click('[data-tool="text"]');page.mouse.click(X(.2),Y(.08));page.keyboard.type('Approved by Nerulio');page.keyboard.press('Escape')
    draw('whiteout',(.1,.12),(.5,.16));draw('rect',(.55,.1),(.8,.2));draw('arrow',(.2,.25),(.5,.3))
    ok('text, whiteout, rectangle and arrow are placed',page.locator('#edLayer .ed-text').count()==1 and page.locator('#edSvg rect').count()==2 and page.locator('#edSvg g[data-index]').count()==1)
    page.click('[data-tool="sign"]');page.click('[data-sign-mode="type"]');page.fill('#signName','Kim Seungbin');page.click('[data-sign-ok]');page.locator('#edLayer .ed-img').wait_for()
    ok('typed signature lands on the page, selected and resizable',page.locator('.ed-selection .ed-handle').count()==1)
    page.keyboard.press('Control+z');page.wait_for_timeout(150);gone=page.locator('#edLayer .ed-img').count();page.keyboard.press('Control+y');page.wait_for_timeout(150)
    ok('undo and redo',gone==0 and page.locator('#edLayer .ed-img').count()==1)
    page.locator('#languageSelect').select_option('ko');page.wait_for_timeout(400)
    ok('language switch keeps the edits',page.locator('#edLayer .ed-text').inner_text()=='Approved by Nerulio' and page.locator('[data-tool="text"] em').inner_text()=='글자')
    page.click('[data-action="ed-numbers"]');page.locator('#docFormat').select_option('n/N');page.click('[data-doc-ok]');page.wait_for_timeout(200)
    page.click('[data-action="ed-watermark"]');page.fill('#docText','DRAFT');page.click('[data-doc-ok]');page.wait_for_timeout(200)
    ok('page numbers and watermark land on every page',page.evaluate('()=>1')==1 and page.locator('#edLayer .ed-text').count()==3 and page.locator('.ed-thumb i').count()==2)
    with page.expect_download() as d:page.locator('#edSave').click()
    facts=page.evaluate('''async b64=>{const pdfjs=await import('/assets/vendor/pdfjs-dist-6.3.289/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/assets/vendor/pdfjs-dist-6.3.289/pdf.worker.mjs';const doc=await pdfjs.getDocument({data:Uint8Array.from(atob(b64),c=>c.charCodeAt(0))}).promise,pg=await doc.getPage(1);return {pages:doc.numPages,text:(await pg.getTextContent()).items.map(i=>i.str).join(' ')}}''',base64.b64encode(open(d.value.path(),'rb').read()).decode())
    ok('saved PDF keeps its pages and the new text is real, searchable text',facts['pages']==2 and 'Approved by Nerulio' in facts['text'] and '1 / 2' in facts['text'] and 'DRAFT' in facts['text'],str(facts))
    # --- sprite sheet / atlas maker ---
    def sprite(i):
        im=Image.new('RGBA',(40+i*4,48),(0,0,0,0))
        for x in range(4+i,34+i*4):
            for y in range(3,43):im.putpixel((x,y),(200,40+i*20,60,255))
        b=io.BytesIO();im.save(b,'PNG');return {'name':f'walk_{i}.png','mimeType':'image/png','buffer':b.getvalue()}
    sprites=[sprite(i) for i in range(6)]
    page.goto(BASE+'/en/sprite-sheet-maker/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=sprites);page.locator('#atlasCanvas').wait_for();page.wait_for_timeout(400)
    ok('atlas shows size, frame count and packing efficiency',page.locator('#atlasSummary .summary-line').inner_text().startswith('6 frame(s)') and '%' in page.locator('#atlasSummary').inner_text())
    ok('animation preview and frame strip are present',page.locator('#animCanvas').count()==1 and page.locator('.frame-chip').count()==6)
    with page.expect_download() as d:page.locator('#atlasRun').click()
    z=zipfile.ZipFile(d.value.path());meta=json.loads(z.read('atlas.json'));sheet=Image.open(io.BytesIO(z.read('atlas.png'))).convert('RGBA');wrong=0
    for f in sprites:
        e=meta['frames'][f['name']];r=e['frame'];o=e['spriteSourceSize'];src=Image.open(io.BytesIO(f['buffer']))
        wrong+=sheet.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])).tobytes()!=src.crop((o['x'],o['y'],o['x']+r['w'],o['y']+r['h'])).tobytes()
    ok('every frame cut from the atlas with its JSON equals the trimmed source, pixel for pixel',wrong==0 and meta['frames']['walk_0.png']['trimmed'] is True)
    page.locator('.options-advanced').first.evaluate('d=>d.open=true');page.locator('#atlasFormat').select_option('xml');page.locator('#atlasPot').check();page.wait_for_timeout(300)
    with page.expect_download() as d:page.locator('#atlasRun').click()
    z=zipfile.ZipFile(d.value.path());size=Image.open(io.BytesIO(z.read('atlas.png'))).size
    ok('Starling XML and power-of-two size',b'<SubTexture name="walk_0"' in z.read('atlas.xml') and all(v&(v-1)==0 for v in size),str(size))
    # --- pixel-art converter ---
    page.goto(BASE+'/ko/pixel/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[FILES[1]]);ready(page)
    ok('pixel art defaults to a true 32×32 sprite, shown big',page.locator('#taskSummary .summary-big').inner_text()=='32 × 32')
    page.locator('#pixelSize [data-n="64"]').click();page.locator('#pixelColors [data-colors="4"]').click();page.wait_for_timeout(500);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGBA');ok('64×64 output with at most 4 colours',im.size==(64,64) and len({c[:3] for c in list(im.getdata()) if c[3]})<=4,str(im.size))
    page.locator('.options-advanced').first.evaluate('d=>d.open=true');page.locator('#pixelPalette').select_option('gameboy');page.locator('#pixelScale').select_option('8');page.wait_for_timeout(500);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGBA');gb={(15,56,15),(48,98,48),(139,172,15),(155,188,15)}
    ok('Game Boy palette only, exported 8× with hard pixels',im.size==(512,512) and {c[:3] for c in list(im.getdata()) if c[3]}<=gb and im.getpixel((0,0))==im.getpixel((7,7)))
    ok('result preview is rendered with crisp pixels',page.locator('#cmpAfter.px').count()==1)
    # --- bundle tools (src/task/recipe.js): the result is shown as what is inside the ZIP ---
    page.goto(BASE+'/ko/favicon-generator/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[FILES[1]]);ready(page)
    page.locator('#viewerContents .content img').first.wait_for()
    ok('a favicon bundle lists every file inside it instead of one enlarged preview',page.locator('#viewerContents .content').count()==10 and page.locator('#cmp').is_hidden())
    page.wait_for_function('()=>/^16×16/.test(document.querySelector("#viewerContents [data-dim]").textContent)')
    ok('each listed image shows its real pixel size',page.locator('#viewerContents [data-dim]').nth(5).inner_text().startswith('512×512'))
    with page.expect_download() as d:page.locator('#viewerContents [data-entry="3"]').click()
    ok('one file of the bundle can be saved on its own',d.value.suggested_filename=='apple-touch-icon.png' and Image.open(d.value.path()).size==(180,180))
    page.goto(BASE+'/en/remove-white-background-from-logo/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[FILES[1]]);ready(page)
    ok('a single-image recipe keeps the before/after slider',page.locator('#cmp').is_visible() and page.locator('#viewerContents').is_hidden() and page.locator('[data-option="tolerance"]').is_visible())
    # --- background remover (solid-backdrop mode: no model download in CI) ---
    subject=Image.new('RGB',(200,160),(250,250,250));[subject.putpixel((x,y),(200,30,40)) for x in range(60,140) for y in range(40,120)]
    buf=io.BytesIO();subject.save(buf,'PNG');shot={'name':'product.png','mimeType':'image/png','buffer':buf.getvalue()}
    page.goto(BASE+'/ko/image/remove-bg/?mode=solid',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=[shot]);ready(page)
    def saved():
        ready(page)
        with page.expect_download() as d:page.locator('#taskDownload').click()
        return d.value
    d=saved();im=Image.open(d.path()).convert('RGBA')
    ok('backdrop colour is detected from the border and removed; the subject stays opaque',d.suggested_filename=='product-no-bg.png' and im.getpixel((5,5))[3]==0 and im.getpixel((100,80))==(200,30,40,255))
    ok('a transparent result hides the original behind the compare slider',page.locator('#cmpAfter').evaluate('e=>getComputedStyle(e).backgroundImage')!='none')
    page.locator('#bgFill [data-bg="black"]').click();page.wait_for_timeout(500);im=Image.open(saved().path()).convert('RGBA')
    ok('a new background colour fills what was removed',im.getpixel((5,5))==(0,0,0,255) and im.getpixel((100,80))==(200,30,40,255))
    page.locator('#bgFill [data-bg="none"]').click();page.locator('#optionsAdvanced').evaluate('d=>d.open=true');page.locator('#bgTrim').check();page.fill('#bgPadding','10');page.wait_for_timeout(600);im=Image.open(saved().path())
    ok('crop to subject keeps the subject plus the requested padding',im.size==(100,100))
    page.locator('#bgTrim').uncheck();page.wait_for_timeout(600);ready(page)
    page.locator('[data-action="bg-touch-up"]').click();box=page.locator('#brushCanvas').bounding_box()
    page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5);page.mouse.down();page.mouse.move(box['x']+box['width']*.52,box['y']+box['height']*.5,steps=3);page.mouse.up()
    page.locator('[data-brush="restore"]').click();page.mouse.move(box['x']+box['width']*.05,box['y']+box['height']*.06);page.mouse.down();page.mouse.move(box['x']+box['width']*.07,box['y']+box['height']*.06,steps=3);page.mouse.up()
    page.locator('[data-brush-done]').click();page.wait_for_timeout(400);im=Image.open(saved().path()).convert('RGBA')
    ok('the erase brush removes subject pixels and the restore brush brings the original back',im.getpixel((100,80))[3]==0 and im.getpixel((10,10))==(250,250,250,255) and im.getpixel((100,50))[3]==255)
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
    # --- crop (src/task/crop.js): an interactive box whose numbers are image pixels ---
    def marker(w,h):
        im=Image.new('RGB',(w,h));px=im.load()
        for y in range(h):
            for x in range(w):px[x,y]=((x*7+11)%256,(y*5+3)%256,((x^y)*3)%256)
        b=io.BytesIO();im.save(b,'PNG');return im,{'name':f'marker {w}.png','mimeType':'image/png','buffer':b.getvalue()}
    MARK,MARK_FILE=marker(400,260);MARK2,MARK2_FILE=marker(200,200)
    def crop_area(x,y,w,h):
        page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
        for sel,v in [('#cropW',w),('#cropH',h),('#cropX',x),('#cropY',y)]:page.fill(sel,str(v))
        page.wait_for_timeout(150);ready(page)
    def crop_open(files):
        page.goto(BASE+'/en/image/crop/',wait_until='networkidle')
        page.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"')
        page.locator('#fileInput').set_input_files(files=list(files));ready(page)
    crop_open([MARK_FILE])
    ok('crop opens as a task page: box already placed, 8 handles, Download live, no Run button',
       page.locator('#cropBox').is_visible() and page.locator('.crop-handle').count()==8 and page.locator('.side .primary').count()==1 and page.locator('#taskDownload').is_enabled())
    ok('the result size is the big number',page.locator('#taskSummary .summary-big').inner_text()=='400 × 260')
    crop_area(100,50,213,97)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGB')
    ok('the export is exactly the framed rectangle, in image pixels',
       im.size==(213,97) and im.tobytes()==MARK.crop((100,50,313,147)).tobytes(),str(im.size))
    box=page.locator('#cropFrame').bounding_box()
    page.mouse.move(box['x']+box['width']*.25,box['y']+box['height']*.25);page.mouse.down()
    page.mouse.move(box['x']+box['width']*.75,box['y']+box['height']*.75,steps=8);page.mouse.up();page.wait_for_timeout(200)
    shown=[int(page.locator(s).input_value()) for s in ['#cropX','#cropY','#cropW','#cropH']]
    ok('dragging on the picture reframes it and the numbers follow',abs(shown[0]-100)<=3 and abs(shown[2]-200)<=4,str(shown))
    page.locator('#cropBox').focus();page.keyboard.press('ArrowRight');page.keyboard.press('Shift+ArrowRight');page.wait_for_timeout(120)
    ok('arrow keys nudge 1px and Shift+arrows 10px',int(page.locator('#cropX').input_value())==shown[0]+11)
    crop_open([MARK_FILE])
    page.locator('#cropRatio .chip[data-ratio="1:1"]').click();page.wait_for_timeout(150);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGB')
    ok('a ratio chip gives the largest centred square of that ratio',
       im.size==(260,260) and im.tobytes()==MARK.crop((70,0,330,260)).tobytes(),str(im.size))
    crop_open([MARK_FILE])
    page.locator('[data-action="crop-turn-right"]').click();page.locator('[data-action="crop-flip-h"]').click();page.wait_for_timeout(200);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGB')
    ok('rotate 90° right then flip horizontally is an exact transpose of the source',
       im.size==(260,400) and im.tobytes()==MARK.transpose(Image.Transpose.TRANSPOSE).tobytes(),str(im.size))
    page.locator('[data-action="crop-undo"]').click();page.locator('[data-action="crop-undo"]').click();page.wait_for_timeout(150)
    ok('undo walks back through the transforms',page.locator('#taskSummary .summary-big').inner_text()=='400 × 260')
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    page.locator('#cropAngle').fill('10');page.locator('#cropAngle').dispatch_event('input');page.wait_for_timeout(300);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGBA')
    ok('straighten auto-zooms: same frame size, no empty corner, content actually rotated',
       im.size==(400,260) and im.getpixel((0,0))[3]==255 and im.getpixel((399,259))[3]==255 and im.convert('RGB').tobytes()!=MARK.tobytes())
    crop_open([MARK_FILE])
    page.locator('#cropRatio .chip[data-ratio="1:1"]').click()
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true');page.locator('#cropShape').select_option('circle');page.wait_for_timeout(250);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGBA')
    ok('a circle crop is transparent outside and untouched inside',
       im.size==(260,260) and im.getpixel((1,1))[3]==0 and im.getpixel((130,130))==MARK.getpixel((200,130))+(255,))
    crop_open([MARK_FILE])
    page.locator('#cropPreset').select_option('instagram-story');page.wait_for_timeout(250);ready(page)
    ok('a social preset sets the ratio chip and the exact output size',
       page.locator('#taskSummary .summary-big').inner_text()=='1080 × 1920' and page.locator('#cropRatio .chip[aria-pressed="true"]').get_attribute('data-ratio')=='9:16')
    with page.expect_download() as d:page.locator('#taskDownload').click()
    ok('the preset export is exactly the platform size',Image.open(d.value.path()).size==(1080,1920))
    bordered=Image.new('RGB',(120,90),(255,255,255));[bordered.putpixel((x,y),(10,30,200)) for x in range(30,100) for y in range(20,70)]
    buf=io.BytesIO();bordered.save(buf,'PNG')
    crop_open([{'name':'scan.png','mimeType':'image/png','buffer':buf.getvalue()}])
    page.locator('[data-action="crop-trim"]').click();page.wait_for_timeout(800);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    ok('auto-trim snaps the box to the content inside a uniform border',Image.open(d.value.path()).size==(70,50))
    crop_open([MARK_FILE,MARK2_FILE])
    ok('several images share one file list',page.locator('#taskFiles .file').count()==2)
    page.locator('[data-action="crop-select"][data-index="0"]').click();page.wait_for_timeout(150)
    crop_area(100,50,200,100)
    page.locator('[data-action="crop-apply-all"]').click();page.wait_for_timeout(300);ready(page)
    ok('apply-to-all reuses the same relative box on every file',page.locator('#taskFiles .pill').all_inner_texts()==['200×100','100×77'])
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path())
    ok('download all is one ZIP with a cropped file per input',
       sorted(Image.open(io.BytesIO(z.read(n))).size for n in z.namelist())==[(100,77),(200,100)],str(z.namelist()))
    ok('crop offers the hand-off tools',page.locator('#taskNext .chip').evaluate_all('ns=>ns.map(n=>n.dataset.tool)')==['compress','resize','remove-bg'])
    # --- video and audio (src/task/media.js): trim timeline, chips, one Run, measured result ---
    if shutil.which('ffmpeg') and shutil.which('ffprobe'):
        clip=OUT/'task-media-clip.mp4'
        if not clip.exists():
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','30','-c:a','aac','-b:a','128k','-movflags','+faststart',str(clip)],check=True)
        def media(path):
            page.goto(BASE+path,wait_until='networkidle');page.locator('html[data-task-ready="1"]').wait_for()
            page.locator('#fileInput').set_input_files(str(clip));page.locator('#mediaRun:not([disabled])').wait_for(timeout=60000)
        def encode(name):
            page.locator('#mediaRun').click();page.locator('#taskDownload:not([disabled])').wait_for(timeout=180000)
            with page.expect_download() as got:page.locator('#taskDownload').click()
            target=OUT/name;got.value.save_as(target);return target
        def probe(path):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]))
        media('/en/video/to-gif/');page.locator('#tlStrip img').first.wait_for(timeout=60000)
        ok('a dropped video opens in a player with a decoded timeline strip',page.locator('#video').evaluate('v=>v.videoWidth')==640 and page.locator('#tlStrip img').count()==10)
        page.wait_for_function("()=>document.querySelector('#mediaSummary .summary-big').textContent.includes('≈')",timeout=90000)
        ok('the GIF size is estimated before anything is encoded','B' in page.locator('#mediaSummary .summary-big').inner_text())
        page.locator('#gifWidth [data-value="320"]').click();page.locator('#gifFps [data-value="10"]').click();page.locator('#mediaEnd').fill('1');page.wait_for_timeout(200)
        animation=Image.open(encode('task-media.gif'))
        ok('the GIF chips really change the output',animation.format=='GIF' and animation.size==(320,180) and animation.n_frames==10)
        ok('the result is previewed as an image with a size line',page.locator('#mediaOut img').count()==1 and '→' in page.locator('#mediaResult').inner_text())
        page.locator('#gifWidth [data-value="480"]').click();page.locator('#gifFps [data-value="15"]').click();page.locator('#mediaEnd').fill('3');page.fill('#gifTarget','0.2');page.wait_for_timeout(250)
        ok('"fit under N MB" is measured, not guessed',os.path.getsize(encode('task-media-target.gif'))<=int(.2*1024*1024))
        media('/en/video/to-mp3/');page.locator('#audioBitrate [data-value="128"]').click()
        audio=probe(encode('task-media.mp3'))
        ok('audio extraction writes one decodable MP3 stream of the same length',audio['streams'][0]['codec_name']=='mp3' and abs(float(audio['format']['duration'])-5)<.2)
        ok('audio results are playable in the page',page.locator('#mediaOut audio').count()==1)
        media('/en/video/compress/');page.locator('#videoCap [data-value="480"]').click();page.fill('#videoTarget','0.4');page.wait_for_timeout(200)
        shrunk=encode('task-media-small.mp4');info=probe(shrunk);height=max(int(s['height']) for s in info['streams'] if s['codec_type']=='video')
        ok('compression honours the size target and the resolution cap',os.path.getsize(shrunk)<=int(.4*1024*1024) and height<=480)
        media('/en/video/trim/');page.locator('#mediaStart').fill('1');page.locator('#mediaEnd').fill('3');page.wait_for_timeout(200)
        cut=probe(encode('task-media-cut.mp4'))
        ok('trimming keeps the chosen seconds and the audio track',abs(float(cut['format']['duration'])-2)<.15 and any(s['codec_type']=='audio' for s in cut['streams']))
        media('/en/video/frame/');page.locator('[data-action="media-next"]').click();page.wait_for_timeout(200)
        still=Image.open(encode('task-media-frame.png'))
        ok('a frame grab is saved at the source resolution',still.format=='PNG' and still.size==(640,360))
        media('/ko/media/')
        ok('the media hub offers every job on one page',page.locator('#mediaJob button').count()==5)
        page.locator('#mediaJob [data-job="audio"]').click();ok('choosing a job relabels the one primary button','MP3' in page.locator('#mediaRun').inner_text())
        box=page.locator('#tl').bounding_box()
        page.mouse.move(box['x']+box['width']-2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']*.4,box['y']+box['height']/2,steps=8);page.mouse.up();page.wait_for_timeout(200)
        ok('dragging the out handle shortens the section',float(page.locator('#mediaEnd').input_value())<2.6)
    else:print('SKIP media task checks: ffmpeg unavailable')
    # --- game assets: sprite slicer / frame normaliser / RGBA mask packer (src/task/*.js) ---
    def sheet_png(w,h,boxes):
        im=Image.new('RGBA',(w,h),(0,0,0,0))
        for (x0,y0,x1,y1),c in boxes:
            for x in range(x0,x1+1):
                for y in range(y0,y1+1):im.putpixel((x,y),c)
        b=io.BytesIO();im.save(b,'PNG');return {'name':'sheet.png','mimeType':'image/png','buffer':b.getvalue()}
    def file_of(name,im):
        b=io.BytesIO();im.save(b,'PNG');return {'name':name,'mimeType':'image/png','buffer':b.getvalue()}
    # ===== Sprite Lab (src/task/sprite-lab.js) — BEGIN =========================================
    # One workspace, five stages, one sheet: slice -> normalize -> animate -> pivot & boxes ->
    # pack & export. Every export below is re-opened independently (Pillow / zipfile / json) and
    # compared with the numbers the UI showed. The old sprite-slicer and frame-normalize checks
    # are ported here, because those URLs now open this Lab at Slice and at Normalize.
    from PIL import ImageChops
    LAB_FIXTURE=ROOT/'tests/fixtures/game/irregular-characters.png'
    lab_prompt={'value':''}
    page.on('dialog',lambda d:d.accept(lab_prompt['value']))
    def lab_bbox(im,rect):
        x,y,w,h=rect
        bb=im.crop((x,y,x+w,y+h)).split()[3].point(lambda v:255 if v>8 else 0).getbbox()
        return None if not bb else (x+bb[0],y+bb[1],bb[2]-bb[0],bb[3]-bb[1])
    def lab_same(a,b):return a.size==b.size and ImageChops.difference(a,b).getbbox() is None
    def lab_json(path,name='atlas.json'):return json.loads(zipfile.ZipFile(path).read(name))
    def lab_png(path,name):return Image.open(io.BytesIO(zipfile.ZipFile(path).read(name))).convert('RGBA')

    # --- Slice: one frame per character on a sheet whose parts are drawn 1-2px apart -----------
    page.goto(BASE+'/en/game/sprite-lab/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(str(LAB_FIXTURE))
    page.locator('#labSheet canvas').wait_for(timeout=60000)
    page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length>0',timeout=60000)
    lab_rects=page.eval_on_selector_all('.slicer-box rect','ns=>ns.map(n=>[+n.getAttribute("x"),+n.getAttribute("y"),+n.getAttribute("width"),+n.getAttribute("height")])')
    ok('Sprite Lab: Auto slices an irregular sheet into one frame per character, not one per island',
       len(lab_rects)==6,str(len(lab_rects)))
    ok('Sprite Lab: Auto shows the merge distance it chose, why, and lets you change it',
       '2px' in page.locator('#labMergeReason').inner_text() and page.locator('#labMerge').count()==1)
    ok('Sprite Lab: the frame strip holds one chip per frame',page.locator('.frame-chip[data-id]').count()==6)
    lab_sheet=Image.open(LAB_FIXTURE).convert('RGBA')
    lab_trims=[lab_bbox(lab_sheet,r) for r in lab_rects]
    ok('Sprite Lab: every sliced frame holds opaque pixels',all(lab_trims))

    # --- Normalize ---------------------------------------------------------------------------
    page.locator('[data-action="lab-stage"][data-stage="normalize"]').click();page.wait_for_timeout(500)
    ok('Sprite Lab: normalize shows the common canvas before anything is applied',
       'common canvas' in page.locator('#labNormSize').inner_text(),page.locator('#labNormSize').inner_text())
    page.locator('#taskDownload').click();page.wait_for_timeout(600)

    # --- Pivot ------------------------------------------------------------------------------
    page.locator('[data-action="lab-stage"][data-stage="boxes"]').click();page.wait_for_timeout(500)
    page.locator('[data-action="lab-pivot-scope"][data-scope="all"]').click()
    page.locator('[data-action="lab-pivot-preset"][data-preset="bottom-center"]').click();page.wait_for_timeout(300)
    page.locator('[data-action="lab-pivot-unit"][data-value="pixels"]').click();page.wait_for_timeout(300)
    page.fill('#labPivotX','9');page.fill('#labPivotY','55');page.wait_for_timeout(400)
    ok('Sprite Lab: a pivot can be set by preset and typed in pixels',
       (float(page.input_value('#labPivotX')),float(page.input_value('#labPivotY')))==(9.0,55.0))

    # --- Animate: a Walk animation, jitter measured, then reduced by auto-fix ------------------
    page.locator('[data-action="lab-stage"][data-stage="animate"]').click();page.wait_for_timeout(600)
    lab_prompt['value']='Walk'
    page.locator('[data-action="lab-anim-rename"]').click();page.wait_for_timeout(400)
    ok('Sprite Lab: an animation can be renamed',page.locator('#labAnimList .chip').first.inner_text().startswith('Walk'))
    # Normalizing on the bounding-box bottom pins that anchor, so the wobble a player still sees
    # is the one measured against the alpha centroid.
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    page.select_option('#labReference','alpha-centroid');page.wait_for_timeout(700)
    lab_rms=float(page.locator('#labJitterRms').inner_text().split()[1].replace('px',''))
    ok('Sprite Lab: jitter is a number and an x/y graph, not a feeling',
       lab_rms>0 and page.locator('#labJitterGraph svg polyline').count()==2,str(lab_rms))
    page.locator('[data-action="lab-autofix"]').click();page.wait_for_timeout(700)
    ok('Sprite Lab: auto-fix reports before and after',' → ' in page.locator('#labFixText').inner_text(),
       page.locator('#labFixText').inner_text())
    page.locator('[data-action="lab-fix-keep"]').click();page.wait_for_timeout(700)
    lab_rms_after=float(page.locator('#labJitterRms').inner_text().split()[1].replace('px',''))
    ok('Sprite Lab: auto-fix really reduces the measured jitter',lab_rms_after<lab_rms*0.5,f'{lab_rms} -> {lab_rms_after}')
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    page.locator('.frame-chip[data-id]').nth(1).click();page.wait_for_timeout(200)
    page.fill('#labDuration','250');page.wait_for_timeout(400)

    # --- An Attack animation with a hitbox on frames 4-6 --------------------------------------
    page.locator('.frame-chip[data-id]').first.click()
    page.keyboard.press('Control+a');page.wait_for_timeout(300)
    ok('Sprite Lab: Ctrl+A selects every frame',page.locator('.frame-chip.is-selected').count()==6)
    page.locator('[data-action="lab-anim-new"]').click();page.wait_for_timeout(400)
    lab_prompt['value']='Attack'
    page.locator('[data-action="lab-anim-rename"]').click();page.wait_for_timeout(400)
    page.locator('[data-action="lab-stage"][data-stage="boxes"]').click();page.wait_for_timeout(500)
    page.fill('#labRangeFrom','4');page.fill('#labRangeTo','6')
    for sel,value in [('#labBoxX','3'),('#labBoxY','5'),('#labBoxW','11'),('#labBoxH','7')]:page.fill(sel,value)
    page.wait_for_timeout(200)
    page.locator('[data-action="lab-box-range"]').click();page.wait_for_timeout(600)
    ok('Sprite Lab: the hitbox timeline shows the box active on frames 4-6 and nowhere else',
       page.eval_on_selector_all('.lab-grid tbody tr:first-child td','ns=>ns.map(n=>n.textContent.trim())')==['','','','1','1','1'])

    # --- Collision polygons from alpha --------------------------------------------------------
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    page.locator('[data-action="lab-collision"]').click();page.wait_for_timeout(1500)
    lab_collision_text=page.locator('#labCollisionResult').inner_text()
    ok('Sprite Lab: collision generation reports traced vs simplified vertices and the shape error',
       'traced' in lab_collision_text and 'deviation' in lab_collision_text,lab_collision_text)
    page.locator('.frame-chip[data-id]').first.click();page.wait_for_timeout(300)
    lab_ui=page.evaluate('''()=>({pivotX:+document.querySelector('#labPivotX').value,pivotY:+document.querySelector('#labPivotY').value,
      polygons:+document.querySelector('#labCollisionCount').dataset.polygons,vertices:+document.querySelector('#labCollisionCount').dataset.vertices})''')
    ok('Sprite Lab: the frame now carries collision polygons',lab_ui['polygons']>=1 and lab_ui['vertices']>=3,str(lab_ui))

    # --- Pack, then export Generic and re-open it independently -------------------------------
    page.locator('[data-action="lab-stage"][data-stage="export"]').click();page.wait_for_timeout(1200)
    ok('Sprite Lab: packing reports page size and efficiency per page',
       '%' in page.locator('#labAtlasInfo').inner_text() and page.locator('#labPages .summary-line').count()>=1)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_generic=d.value.path()
    ok('Sprite Lab: the generic export is the atlas page plus one JSON',
       sorted(zipfile.ZipFile(lab_generic).namelist())==['atlas.json','atlas.png'])
    lab_data=lab_json(lab_generic);lab_atlas=lab_png(lab_generic,'atlas.png')
    ok('Sprite Lab: the atlas PNG is the size the JSON claims',
       lab_atlas.size==(lab_data['meta']['size']['w'],lab_data['meta']['size']['h']))
    lab_keys=list(lab_data['frames'])
    lab_bad=[]
    for key,trim in zip(lab_keys,lab_trims):
        r=lab_data['frames'][key]['rect']
        if not lab_same(lab_atlas.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])),
                        lab_sheet.crop((trim[0],trim[1],trim[0]+trim[2],trim[1]+trim[3]))):lab_bad.append(key)
    ok('Sprite Lab: every atlas region is byte-identical to that frame on the source sheet',not lab_bad,str(lab_bad))
    lab_first=lab_data['frames'][lab_keys[0]]
    ok('Sprite Lab: the JSON pivot is the pivot the UI showed (pixels vs normalised)',
       abs(lab_first['pivot']['x']*lab_first['sourceSize']['w']-lab_ui['pivotX'])<1e-6
       and abs(lab_first['pivot']['y']*lab_first['sourceSize']['h']-lab_ui['pivotY'])<1e-6,
       f"{lab_first['pivot']} x {lab_first['sourceSize']} vs {lab_ui}")
    ok('Sprite Lab: the JSON collision is the polygon and vertex count the UI showed',
       len(lab_first['collision'])==lab_ui['polygons'] and sum(len(p) for p in lab_first['collision'])==lab_ui['vertices'])
    lab_boxed=[k for k in lab_keys if lab_data['frames'][k]['boxes']]
    ok('Sprite Lab: the hitbox is on exactly the three frames the timeline showed, with the typed numbers',
       len(lab_boxed)==3 and all(b['type']=='hit' and [b['x'],b['y'],b['w'],b['h']]==[3,5,11,7]
                                 for k in lab_boxed for b in lab_data['frames'][k]['boxes']))
    ok('Sprite Lab: the per-frame duration typed in the UI is in the JSON and in the playback block',
       250 in [lab_data['frames'][k]['duration'] for k in lab_keys]
       and 250 in lab_data['animations']['Walk']['playback']['durations'])
    ok('Sprite Lab: the exported animation order is the strip order',
       lab_data['animations']['Walk']['frames']==lab_keys,
       f"{lab_data['animations']['Walk']['frames']} vs {lab_keys}")
    ok('Sprite Lab: both animations were exported',sorted(lab_data['animations'])==['Attack','Walk'])

    # --- Ping-pong: the playback list must not double its ends --------------------------------
    page.locator('[data-action="lab-stage"][data-stage="animate"]').click();page.wait_for_timeout(500)
    page.locator('#labAnimList .chip').first.click();page.wait_for_timeout(400)
    page.locator('[data-key="direction"][data-value="pingpong"]').click();page.wait_for_timeout(500)
    page.locator('[data-action="lab-stage"][data-stage="export"]').click();page.wait_for_timeout(1000)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_pp=lab_json(d.value.path())['animations']['Walk']
    ok('Sprite Lab: ping-pong playback does not double its end frames',
       lab_pp['playback']['frames']==lab_pp['frames']+lab_pp['frames'][-2:0:-1]
       and lab_pp['playback']['frames'].count(lab_pp['frames'][0])==1
       and lab_pp['playback']['frames'].count(lab_pp['frames'][-1])==1,str(lab_pp['playback']['frames']))

    # --- Godot 4: the validated helper, and the engine itself when GODOT_BIN is set -----------
    page.locator('[data-key="target"][data-value="godot"]').click();page.wait_for_timeout(400)
    ok('Sprite Lab: the Godot target says it was verified in the engine',
       'Godot 4.7.2' in page.locator('#labTargetNote').inner_text())
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_godot=OUT/'sprite-lab-godot.zip';shutil.copy(d.value.path(),lab_godot)
    ok('Sprite Lab: the Godot ZIP ships the atlas, the JSON and the validated GDScript addon and README',
       sorted(zipfile.ZipFile(lab_godot).namelist())==['addons/nerulio_sprite/README.md',
         'addons/nerulio_sprite/nerulio_sprite_frames.gd','addons/nerulio_sprite/nerulio_sprite_import.gd',
         'addons/nerulio_sprite/nerulio_sprite_import_cli.gd','atlas.json','atlas.png'],
       str(sorted(zipfile.ZipFile(lab_godot).namelist())))
    lab_gdata=lab_json(lab_godot)
    ok('Sprite Lab: the Godot JSON is the same envelope with engineTarget godot-4 and relative durations',
       lab_gdata['meta']['engineTarget']=='godot-4' and lab_gdata['animations']['Walk']['godot']['frames'][0]['duration']>0)
    ok('Sprite Lab: no fake engine resource files are written',
       not any(n.endswith(('.tres','.tscn','.meta','.aseprite','.tmx','.tsx')) for n in zipfile.ZipFile(lab_godot).namelist()))
    if os.environ.get('GODOT_BIN'):
        run=subprocess.run(['node',str(ROOT/'tests/fixtures/game/godot-validate-bundle.mjs'),str(lab_godot),
                            '--godot',os.environ['GODOT_BIN']],capture_output=True,text=True,timeout=400)
        ok('Sprite Lab: the exported Godot bundle really loads in Godot 4',
           run.returncode==0 and 'LAB BUNDLE GODOT VALIDATION PASSED' in run.stdout,
           (run.stdout+run.stderr)[-1200:])
    else:
        print('UNVERIFIED: the Lab-produced Godot bundle was not run in the engine (set GODOT_BIN)',flush=True)

    # --- Unity: UNVERIFIED, and it says so everywhere -----------------------------------------
    page.locator('[data-key="target"][data-value="unity"]').click();page.wait_for_timeout(400)
    ok('Sprite Lab: the Unity target is visibly labelled UNVERIFIED in the UI',
       'UNVERIFIED' in page.locator('#labTargetNote').inner_text() and page.locator('#labTargetNote.bad').count()==1)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_uz=zipfile.ZipFile(d.value.path())
    ok('Sprite Lab: the Unity export carries the UNVERIFIED label in the JSON, the C# and the README, and writes no .meta',
       json.loads(lab_uz.read('atlas.json'))['unity']['verified'] is False
       and 'UNVERIFIED' in lab_uz.read('UNITY-README.md').decode()
       and 'UNVERIFIED' in lab_uz.read('Editor/NerulioSpriteImporter.cs').decode()
       and not any(n.endswith('.meta') for n in lab_uz.namelist()))

    # --- Multi-page, and a limit smaller than a frame is explained ----------------------------
    page.locator('[data-key="target"][data-value="generic"]').click()
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    page.fill('#labMaxSize','48');page.wait_for_timeout(1000)
    ok('Sprite Lab: a page limit smaller than one frame is explained, not silently wrong',
       page.locator('#labSummary .summary-line.bad').count()==1 and page.locator('#taskDownload').is_disabled())
    page.fill('#labMaxSize','128');page.wait_for_timeout(1200)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_mz=zipfile.ZipFile(d.value.path());lab_mdata=json.loads(lab_mz.read('atlas.json'))
    ok('Sprite Lab: a small page limit produces a real multi-page export',
       lab_mdata['meta']['pages']>1
       and sorted(n for n in lab_mz.namelist() if n.endswith('.png'))==sorted(lab_mdata['meta']['images'])
       and all(p['w']<=128 and p['h']<=128 for p in lab_mdata['meta']['pageSizes']),
       f"{lab_mdata['meta']['pages']} {lab_mdata['meta']['pageSizes']}")
    lab_pages={n:Image.open(io.BytesIO(lab_mz.read(n))).convert('RGBA') for n in lab_mdata['meta']['images']}
    lab_bad=[]
    for key,trim in zip(list(lab_mdata['frames']),lab_trims):
        f=lab_mdata['frames'][key];r=f['rect']
        if not lab_same(lab_pages[lab_mdata['meta']['images'][f['page']]].crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])),
                        lab_sheet.crop((trim[0],trim[1],trim[0]+trim[2],trim[1]+trim[3]))):lab_bad.append(key)
    ok('Sprite Lab: every frame of a multi-page atlas still reads back as its source pixels',not lab_bad,str(lab_bad))

    # --- Aliasing: identical frames are stored once, and the alias resolves -------------------
    lab_twin=sheet_png(48,12,[((1,2,6,9),(200,40,40,255)),((17,2,22,9),(30,90,200,255)),((33,2,38,9),(200,40,40,255))])
    page.goto(BASE+'/en/game/sprite-lab/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[lab_twin])
    page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length===3',timeout=60000)
    page.locator('[data-action="lab-stage"][data-stage="export"]').click();page.wait_for_timeout(1200)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_az=d.value.path();lab_adata=lab_json(lab_az);lab_apage=lab_png(lab_az,'atlas.png')
    lab_aliases=[(k,f['aliasOf']) for k,f in lab_adata['frames'].items() if f['aliasOf']]
    ok('Sprite Lab: identical frames are stored once and aliased',len(lab_aliases)==1,str(lab_aliases))
    lab_a=lab_adata['frames'][lab_aliases[0][0]]['rect'];lab_b=lab_adata['frames'][lab_aliases[0][1]]['rect']
    ok('Sprite Lab: an alias resolves to the region that really holds those pixels',
       lab_a==lab_b and lab_same(lab_apage.crop((lab_a['x'],lab_a['y'],lab_a['x']+lab_a['w'],lab_a['y']+lab_a['h'])),
                                 Image.open(io.BytesIO(lab_twin['buffer'])).convert('RGBA').crop((1,2,7,10))),
       f'{lab_a} {lab_b}')
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    with page.expect_download() as d:page.locator('[data-action="lab-frames-zip"]').click()
    ok('Sprite Lab: individual frame PNGs are still exportable',
       len(zipfile.ZipFile(d.value.path()).namelist())==3)
    with page.expect_download() as d:page.locator('[data-action="lab-gif"]').click()
    lab_gif=Image.open(d.value.path())
    ok('Sprite Lab: a GIF preview is still exportable',lab_gif.format=='GIF' and lab_gif.n_frames==3)

    # --- The old URLs still work, at the right stage, and still prove what they proved --------
    page.goto(BASE+'/en/sprite-slicer/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[sheet_png(36,20,[((1,2,5,8),(255,0,0,255)),((20,4,27,15),(0,255,0,255))])])
    page.locator('#labSheet canvas').wait_for(timeout=60000)
    page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length===2',timeout=60000)
    ok('the sprite-slicer URL opens the Lab at Slice with the frames already outlined, no Run button',
       page.eval_on_selector_all('.slicer-box rect','ns=>ns.map(n=>[+n.getAttribute("x"),+n.getAttribute("width")])')==[[1,5],[20,8]]
       and page.locator('[data-action="lab-stage"][data-stage="slice"][aria-pressed="true"]').count()==1)
    page.locator('.frame-chip[data-index="1"]').click();page.wait_for_timeout(200)
    ok('selecting a frame offers resize handles and exact numbers',
       page.locator('.slicer-handle').count()==8 and page.input_value('#labRectW')=='8')
    page.fill('#labRectW','6');page.wait_for_timeout(500)
    ok('the edited frame rectangle is what the overlay draws',
       page.eval_on_selector_all('.slicer-box rect','ns=>ns.map(n=>+n.getAttribute("width"))')==[5,6])
    page.locator('[data-action="lab-undo"]').click();page.wait_for_timeout(400)
    ok('undo restores the previous frame rectangle',
       page.eval_on_selector_all('.slicer-box rect','ns=>ns.map(n=>+n.getAttribute("width"))')==[5,8])
    page.locator('[data-key="mode"][data-value="grid"]').click();page.wait_for_timeout(900)
    ok('grid mode offers ranked suggestions, each with the evidence it was scored on',
       page.locator('#labSuggest .chip').count()>=1
       and len(page.locator('#labSuggest .chip').first.get_attribute('title'))>40)
    page.goto(BASE+'/en/normalize-sprite-frames/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[sheet_png(36,20,[((1,2,5,8),(255,0,0,255)),((20,4,27,15),(0,255,0,255))])])
    page.wait_for_function('()=>document.querySelectorAll("#labAfter canvas").length===2',timeout=60000)
    ok('the frame-normalize URL opens the Lab at Normalize and shows the common canvas first',
       page.locator('#labNormSize').inner_text().startswith('8×12')
       and page.locator('[data-action="lab-stage"][data-stage="normalize"][aria-pressed="true"]').count()==1,
       page.locator('#labNormSize').inner_text())
    page.locator('#taskDownload').click();page.wait_for_timeout(500)
    page.locator('[data-action="lab-stage"][data-stage="export"]').click();page.wait_for_timeout(1000)
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    with page.expect_download() as d:page.locator('[data-action="lab-frames-zip"]').click()
    lab_nz=zipfile.ZipFile(d.value.path())
    lab_ims=[Image.open(io.BytesIO(lab_nz.read(n))).convert('RGBA') for n in sorted(lab_nz.namelist())]
    ok('normalised frames share one canvas and one bounding-box bottom edge',
       lab_ims[0].size==lab_ims[1].size==(8,12) and lab_ims[0].getbbox()[3]==lab_ims[1].getbbox()[3]==12,
       f'{lab_ims[0].size} {lab_ims[0].getbbox()} {lab_ims[1].getbbox()}')
    # ===== Sprite Lab — END ====================================================================
    page.goto(BASE+'/en/texture-mask-packer/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[file_of(f'{v}.png',Image.new('RGBA',(2,2),(v,v,v,255))) for v in (10,80,220)])
    page.wait_for_function('()=>document.querySelectorAll("#maskPreviews canvas").length===4',timeout=60000)
    ok('the packer previews the pack and every channel on its own',page.locator('#maskPreviews canvas').count()==4 and page.locator('#maskFiles .file').count()==3)
    for channel,value in enumerate(['input2','input0','input1','zero']):page.locator(f'[data-channel="{channel}"]').select_option(value)
    page.wait_for_timeout(300);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGBA')
    ok('the packed PNG keeps exact channel bytes under zero alpha',set(im.getdata())=={(220,10,80,0)},str(set(im.getdata())))
    page.locator('[data-action="mask-preset"][data-value="unreal-orm"]').click();page.wait_for_timeout(300);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    im=Image.open(d.value.path()).convert('RGBA')
    ok('the Unreal ORM preset really reorders the channels',set(im.getdata())=={(10,80,220,255)},str(set(im.getdata())))
    page.locator('#fileInput').set_input_files(files=[file_of('odd.png',Image.new('RGBA',(4,4),(5,5,5,255)))]);page.wait_for_timeout(600)
    ok('a differently sized mask is explained instead of failing silently',
       page.locator('#taskDownload').is_disabled() and page.locator('#maskSummary .summary-line.bad').count()==1)
    # --- phone ---
    phone=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page();phone.on('pageerror',lambda e:errors.append(str(e)))
    for path in ['/ko/','/ko/image/compress/']:
        phone.goto(BASE+path,wait_until='networkidle')
        ok(f'no horizontal scroll on a phone {path}',phone.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'))
    phone.locator('[data-action="task-sample"]').click();ready(phone)
    ok('sample produces a real saving on a phone',int(phone.locator('#taskSummary .summary-big').inner_text()[1:-1])>=50)
    ok('no horizontal scroll with results on a phone',phone.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'))
    # A long progress label in the file row must not widen the page (seen only on slow machines, where it is still showing).
    phone.evaluate("()=>{document.querySelector('#taskFiles .pill').textContent='AI 모델 받는 중 (처음 한 번) 43%'}")
    ok('a long progress label does not cause horizontal scroll on a phone',phone.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'))
    browser.close()
assert not errors,errors
(OUT/'task-browser-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
print('TASK UI BROWSER PASSED',len(checks))
