"""Home directory and single-task UI, end to end (served by tools/regression.py on :4173)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io,json,math,os,shutil,subprocess,zipfile
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
    # The home is the game studio's front door: images dropped there open in the Studio (hand-off, no upload).
    drop(page,'body',B64);page.wait_for_url('**/en/game/studio/**',timeout=20000)
    page.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"&&window.nerulioStudio.doc.assets.length===2',timeout=30000)
    ok('dropping images on the home opens them in the Studio without re-selecting',page.evaluate('window.nerulioStudio.workspace')=='sprite')
    # PDFs and video still get the file-tool suggestions on the home.
    page.goto(BASE+'/en/');page.wait_for_timeout(300)
    drop(page,'body',[{'name':'doc.pdf','type':'application/pdf','b64':base64.b64encode(b'%PDF-1.4'+bytes([10])+b'%%EOF'+bytes([10])).decode()}]);page.locator('#suggest .chip').first.wait_for()
    ok('dropping a PDF on the home suggests the PDF tools',page.locator('#suggest [data-suggest]').evaluate_all('ns=>ns.map(n=>n.dataset.suggest)')[:2]==['pdf-merge','pdf-split'])
    page.goto(BASE+'/en/image/compress/');page.wait_for_function('()=>document.documentElement.dataset.taskReady==="1"')
    drop(page,'body',B64);ready(page)
    ok('files dropped on a file tool are processed there',page.locator('.file').count()==2)
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
    ok('editor opens with a toolbar, page rail and one primary action',page.locator('.ed-tool[data-tool]').count()>=11 and page.locator('.ed-thumb').count()==2 and page.locator('.ed-side .primary').count()==1)
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
    page.goto(BASE+'/en/sprite-sheet-maker/classic/',wait_until='networkidle');page.locator('#fileInput').set_input_files(files=sprites);page.locator('#atlasCanvas').wait_for();page.wait_for_timeout(400)
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
    page.goto(BASE+'/en/game/sprite-lab/classic/',wait_until='networkidle')
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

    page.locator('.frame-chip[data-id]').nth(3).click();page.wait_for_timeout(400)
    ok('Sprite Lab: the box is drawn on the frame it belongs to, listed and selectable',
       page.locator('#labFrameOverlay .lab-box-hit').count()==1
       and page.locator('#labBoxList [data-action="lab-box-pick"]').count()==1,
       page.locator('#labBoxList').inner_text().replace('\n',' | '))
    page.locator('#labBoxList [data-action="lab-box-pick"]').click();page.wait_for_timeout(300)
    ok('Sprite Lab: selecting a box in the list highlights it on the frame',
       page.locator('#labFrameOverlay .lab-box.is-selected').count()==1)
    page.locator('.frame-chip[data-id]').first.click();page.wait_for_timeout(300)
    ok('Sprite Lab: a frame with no boxes says so instead of showing another frame\'s',
       page.locator('#labFrameOverlay .lab-box').count()==0 and 'no boxes' in page.locator('#labBoxList').inner_text())
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
       # An error is an error card (B7: it used to be red text inside the green success card).
       page.locator('#labSummary.is-error').count()==1 and page.locator('#labSummary .summary-big').inner_text()=='!' and page.locator('#taskDownload').is_disabled())
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
    page.goto(BASE+'/en/game/sprite-lab/classic/',wait_until='networkidle')
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

    # --- Mirroring: the atlas must hold really flipped pixels, not flipped metadata ------------
    lab_asym=sheet_png(24,14,[((2,2,9,11),(200,40,40,255)),((2,2,3,4),(255,255,255,255))])
    page.goto(BASE+'/en/game/sprite-lab/classic/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[lab_asym])
    page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length===1',timeout=60000)
    page.locator('[data-action="lab-stage"][data-stage="animate"]').click();page.wait_for_timeout(600)
    page.locator('[data-action="lab-mirror"]').click();page.wait_for_timeout(700)
    ok('Sprite Lab: mirroring adds a mirrored animation and its frames',
       page.locator('#labAnimList .chip').count()==2 and page.locator('.frame-chip[data-id]').count()==2)
    page.locator('[data-action="lab-stage"][data-stage="export"]').click();page.wait_for_timeout(1200)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_mirz=d.value.path();lab_mird=lab_json(lab_mirz);lab_mirp=lab_png(lab_mirz,'atlas.png')
    lab_src=Image.open(io.BytesIO(lab_asym['buffer'])).convert('RGBA').crop((2,2,10,12))
    lab_mkeys=list(lab_mird['frames'])
    lab_regions=[]
    for k in lab_mkeys:
        r=lab_mird['frames'][k]['rect']
        lab_regions.append(lab_mirp.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])))
    ok('Sprite Lab: the mirrored frame is stored as really flipped pixels, and is not aliased to the original',
       len(lab_regions)==2 and lab_same(lab_regions[0],lab_src)
       and lab_same(lab_regions[1],lab_src.transpose(Image.FLIP_LEFT_RIGHT))
       and not any(f['aliasOf'] for f in lab_mird['frames'].values()),
       str([r.size for r in lab_regions]))
    ok('Sprite Lab: the mirrored frame mirrors its pivot too',
       abs(lab_mird['frames'][lab_mkeys[1]]['pivot']['x']-(1-lab_mird['frames'][lab_mkeys[0]]['pivot']['x']))<1e-6)

    # --- A sheet past the old 4 MP component-labelling cap is sliced by Auto (B7) -------------
    lab_big=Image.new('RGBA',(2048,2048),(0,0,0,0))
    lab_block=Image.new('RGBA',(200,200),(60,140,220,255))
    for row in range(8):
        for col in range(8):lab_big.paste(lab_block,(col*256+28,row*256+28))
    lab_bb=io.BytesIO();lab_big.save(lab_bb,'PNG')
    page.goto(BASE+'/en/game/sprite-lab/classic/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[{'name':'big.png','mimeType':'image/png','buffer':lab_bb.getvalue()}])
    page.locator('#labSheet canvas').wait_for(timeout=120000)
    page.wait_for_function('()=>document.querySelector("#labSummary.is-error")||document.querySelectorAll(".slicer-box").length>1',timeout=180000)
    ok('Sprite Lab: a 2048x2048 sheet (past the old 4 MP Auto cap) is sliced by Auto into its 64 islands',
       page.locator('.slicer-box').count()==64 and not page.locator('#labSummary.is-error').count(),
       page.locator('#labSummary').inner_text().replace('\n',' | '))
    page.locator('[data-key="mode"][data-value="grid"]').click()
    page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length>1',timeout=180000)
    ok('Sprite Lab: Grid handles the same sheet and suggests the cell size that made it',
       page.locator('#labSuggest .chip').first.inner_text().startswith('256×256'),
       page.locator('#labSuggest .chip').first.inner_text())
    page.locator('#labSuggest .chip').first.click();page.wait_for_timeout(4000)
    ok('Sprite Lab: the 2048x2048 sheet slices into its 64 cells',page.locator('.slicer-box').count()==64,
       str(page.locator('.slicer-box').count()))
    page.locator('[data-action="lab-stage"][data-stage="export"]').click()
    page.wait_for_function('()=>document.querySelector("#labAtlasCanvas")&&document.querySelector("#labAtlasCanvas").width>1',timeout=180000)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    lab_bigd=lab_json(d.value.path())
    ok('Sprite Lab: 64 identical cells pack into one region with 63 aliases',
       len(lab_bigd['frames'])==64 and sum(1 for f in lab_bigd['frames'].values() if f['aliasOf'])==63
       and lab_bigd['meta']['pages']==1,
       f"{lab_bigd['meta']['pageSizes']} {sum(1 for f in lab_bigd['frames'].values() if f['aliasOf'])}")

    # --- The old URLs still work, at the right stage, and still prove what they proved --------
    page.goto(BASE+'/en/sprite-slicer/classic/',wait_until='networkidle')
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
    page.goto(BASE+'/en/normalize-sprite-frames/classic/',wait_until='networkidle')
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
    # --- A settings link is a preset, and carries no image data -------------------------------
    page.goto(BASE+'/en/game/sprite-lab/classic/?mode=grid&cellW=48&cellH=48&atlasPadding=4&maxSize=512&bg=black',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[sheet_png(96,48,[((0,0,47,47),(200,40,40,255)),((48,0,95,47),(30,90,200,255))])])
    page.locator('#labSheet canvas').wait_for(timeout=60000)
    page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length>0',timeout=60000)
    ok('Sprite Lab: a settings link restores the mode and the cell size it names',
       page.locator('[data-key="mode"][data-value="grid"][aria-pressed="true"]').count()==1
       and page.input_value('#labCellW')=='48' and page.locator('.slicer-box').count()==2,
       f"{page.input_value('#labCellW')} {page.locator('.slicer-box').count()}")
    page.locator('[data-action="lab-stage"][data-stage="export"]').click();page.wait_for_timeout(1200)
    ok('Sprite Lab: a settings link restores the packing settings too',page.input_value('#labAtlasPadding')=='4'
       and page.input_value('#labMaxSize')=='512')
    lab_shared=page.evaluate('''async()=>{
      const {settingsQuery,settingsFromQuery}=await import('/src/game/project.js');
      const q=settingsQuery({mode:'grid',cellW:48,atlasPadding:4},{mode:'auto',cellW:32,atlasPadding:2});
      return {query:q,back:settingsFromQuery(q,{mode:'auto',cellW:32,atlasPadding:2})};}''')
    ok('Sprite Lab: the settings query holds only settings',
       'data:' not in lab_shared['query'] and lab_shared['back']=={'mode':'grid','cellW':48,'atlasPadding':4},
       str(lab_shared))
    # ===== Sprite Lab — END ====================================================================
    page.goto(BASE+'/en/texture-mask-packer/app/',wait_until='networkidle')
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
    # --- Texture Lab (src/task/texture-lab*.js): one set of maps, seven stages ---------------
    def grey(name,v,size=(64,64)):return file_of(name,Image.new('RGBA',size,(v,v,v,255)))
    def ramp(name,size=(64,64)):
        im=Image.new('RGBA',size,(0,0,0,255))
        for y in range(size[1]):
            for x in range(size[0]):im.putpixel((x,y),(y*4%256,y*4%256,y*4%256,255))
        return file_of(name,im)
    packed=Image.new('RGBA',(32,32))
    for y in range(32):
        for x in range(32):packed.putpixel((x,y),(200+x%40,60+y%60,10+(x*y)%30,0 if x<16 else 255))
    sprite=Image.new('RGBA',(32,32),(0,0,0,0))
    for y in range(10,22):
        for x in range(10,22):sprite.putpixel((x,y),(210,40,30,255))
    page.goto(BASE+'/en/game/texture-lab/app/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[grey('rock_basecolor.png',180),ramp('rock_height.png'),file_of('rock_orm.png',packed)])
    page.wait_for_function('()=>document.querySelectorAll("#texFiles .file").length===3',timeout=60000)
    ok('filenames classify into map roles without being asked',
       page.locator('#texFiles select').evaluate_all('els=>els.map(e=>e.value)')==['albedo','height','orm'])
    ok('the set is checked against the workflow, slot by slot',
       page.locator('.tex-slots li').count()>=6 and page.locator('.tex-issues li').count()>0)
    ok('the checks name the file and the measurement, not just a code',
       'rock_orm.png' in page.locator('.tex-issues').inner_text())
    with page.expect_download() as d:page.locator('#taskDownload').click()
    report=json.loads(Path(d.value.path()).read_text(encoding='utf-8'))
    orm_entry=[t for t in report['textures'] if t['name']=='rock_orm.png'][0]
    ok('the check report is envelope JSON with real measurements',
       report['meta']['schemaVersion']==1 and orm_entry['alpha']['zeroPixels']==16*32 and orm_entry['exactChannels'])
    # Channels: a packed texture comes apart into exact greyscale PNGs, alpha-0 RGB included.
    page.locator('[data-action="tex-select"]').last.click()
    page.locator('[data-action="tex-stage"][data-stage="channels"]').first.click()
    page.wait_for_function('()=>document.querySelectorAll(".tex-channel canvas").length===4',timeout=60000)
    ok('every channel is previewed with its engine meaning',
       page.locator('.tex-channel').count()==4 and 'Ambient occlusion' in page.locator('.tex-channel figcaption').first.inner_text())
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path())
    planes={n.split('-')[-2]:Image.open(io.BytesIO(z.read(n))) for n in z.namelist()}
    ok('the unpacker writes one single-channel PNG per channel',
       sorted(planes)==['a','b','g','r'] and all(im.mode=='L' and im.size==(32,32) for im in planes.values()))
    ok('channel bytes are exact, including RGB under fully transparent texels',
       [planes['r'].getpixel((x,0)) for x in (0,15,31)]==[packed.getpixel((x,0))[0] for x in (0,15,31)]
       and [planes['a'].getpixel((x,0)) for x in (0,31)]==[0,255])
    # Pack: the same module as the standalone packer, reading its layouts from texture-presets.js.
    page.locator('[data-action="tex-stage"][data-stage="pack"]').first.click()
    page.wait_for_function('()=>document.querySelectorAll("#maskPreviews canvas").length===4',timeout=60000)
    ok('the Pack stage hosts the packer and leaves one primary action on the page',
       page.locator('#taskDownload').count()==1 and page.locator('[data-action="mask-preset"][data-value="unreal-orm"]').count()==1)
    # Normal: the flat-normal guarantee, and a convention flip that only moves green.
    page.locator('[data-action="tex-select"]').nth(1).click()
    page.locator('[data-action="tex-stage"][data-stage="normal"]').first.click()
    page.locator('#texNormalOut').wait_for(timeout=60000);page.wait_for_timeout(700)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    gl=Image.open(d.value.path()).convert('RGBA')
    page.locator('[data-action="tex-normal-set"][data-key="convention"][data-value="directx"]').click();page.wait_for_timeout(700)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    dx=Image.open(d.value.path()).convert('RGBA')
    a,b=list(gl.getdata()),list(dx.getdata())
    ok('OpenGL and DirectX outputs differ in green and nowhere else',
       gl.size==(64,64)==dx.size and [(p[0],p[2],p[3]) for p in a]==[(q[0],q[2],q[3]) for q in b]
       and [255-p[1] for p in a]==[q[1] for q in b])
    ok('the engine conventions are shown with the documentation behind them',
       page.locator('.tex-conventions .tex-doc').count()>=4)
    # Fix: edge bleed writes RGB under transparent texels and never touches alpha.
    page.locator('#fileInput').set_input_files(files=[file_of('sprite.png',sprite)]);page.wait_for_timeout(800)
    page.locator('[data-action="tex-select"]').last.click()
    page.locator('[data-action="tex-stage"][data-stage="fix"]').first.click()
    page.locator('#texFixOut').wait_for(timeout=60000);page.wait_for_timeout(600)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    bled=Image.open(d.value.path()).convert('RGBA')
    ok('edge bleed keeps alpha and only colours transparent texels',
       [p[3] for p in bled.getdata()]==[p[3] for p in sprite.getdata()]
       and bled.getpixel((9,10))==(210,40,30,0) and bled.getpixel((15,15))==(210,40,30,255))
    # Preview: WebGL2 when there is one, an explanation when there is not.
    page.locator('[data-action="tex-stage"][data-stage="preview"]').first.click();page.wait_for_timeout(1200)
    ok('the material preview either renders or says why it cannot',
       page.evaluate('()=>{const c=document.querySelector("#texGL");const f=document.querySelector("#texGLFallback");return (c&&!c.hidden&&c.width>0)||(f&&!f.hidden)}'))
    # Export: every texture, one at a time, into one ZIP.
    page.locator('[data-action="tex-stage"][data-stage="export"]').first.click();page.wait_for_timeout(300)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path())
    ok('the batch optimiser exports every texture in one archive',
       # plus the normal map generated on the Normal stage above: generated maps join the set (B13)
       sorted(n for n in z.namelist() if not n.endswith('-normal.png'))==['rock_basecolor.png','rock_height.png','rock_orm.png','sprite.png']
       and all(n.endswith('-normal.png') for n in z.namelist() if n not in ('rock_basecolor.png','rock_height.png','rock_orm.png','sprite.png')),
       str(z.namelist()))
    page.set_viewport_size({'width':320,'height':720});page.wait_for_timeout(300)
    ok('no horizontal scroll in Texture Lab at 320 px',page.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'))
    page.locator('[data-action="tex-stage"][data-stage="channels"]').first.click();page.wait_for_timeout(600)
    ok('no horizontal scroll with four channel previews at 320 px',page.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'))
    page.set_viewport_size({'width':1366,'height':900})
    # --- PDF: compression that resolves references, then protect and unlock (nerulio/agent-pdf-depth) ---
    page.goto(BASE+'/en/pdf/compress/',wait_until='networkidle')
    page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
    # A 200 dpi photo page plus a text page: the photo is what a real compressor has to find.
    pdf=page.evaluate("""async()=>{
      const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
      const c=new OffscreenCanvas(1654,2339),x=c.getContext('2d');
      const g=x.createLinearGradient(0,0,1654,2339);g.addColorStop(0,'#1b4f9c');g.addColorStop(1,'#e0a13b');
      x.fillStyle=g;x.fillRect(0,0,1654,2339);
      for(let i=0;i<4000;i++){x.fillStyle=`hsl(${i%360},70%,${30+i%40}%)`;x.fillRect(Math.random()*1654,Math.random()*2339,9,9);}
      const jpeg=new Uint8Array(await (await c.convertToBlob({type:'image/jpeg',quality:.95})).arrayBuffer());
      const d=await L.PDFDocument.create(),font=await d.embedFont(L.StandardFonts.Helvetica),img=await d.embedJpg(jpeg);
      d.addPage([595,842]).drawImage(img,{x:0,y:0,width:595,height:842});
      d.getPage(0);const text=d.addPage([595,842]);
      for(let i=0;i<30;i++)text.drawText('Searchable compression corpus line '+i,{x:40,y:790-i*24,size:12,font});
      const bytes=await d.save({useObjectStreams:true});
      return btoa(Array.from(bytes,v=>String.fromCharCode(v)).join(''));
    }""")
    PDF=[{'name':'scan and text.pdf','type':'application/pdf','b64':pdf}]
    drop(page,'.dropzone',PDF);ready(page)
    saving=int(page.locator('#taskSummary .summary-big').inner_text()[1:-1])
    note=page.locator('#viewerNote').inner_text()
    ok('PDF compression finds the embedded photo behind an indirect colour space',saving>=40,f'only {saving}%')
    ok('PDF compression says text and search survived',('text and search kept' in note) and ('image(s) optimised' in note),note)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    smaller=Path(d.value.path()).read_bytes()
    kept=page.evaluate("""async b64=>{
      const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
      const doc=await L.PDFDocument.load(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
      return doc.getPageCount();
    }""",base64.b64encode(smaller).decode())
    ok('the compressed PDF still re-opens with both pages',kept==2,str(kept))
    page.goto(BASE+'/en/pdf/protect/',wait_until='networkidle')
    page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
    drop(page,'.dropzone',PDF);page.wait_for_selector('#secPassword')
    page.fill('#secPassword','task browser pass');page.fill('#secConfirm','task browser pass')
    page.locator('#secAdvanced summary').click();page.uncheck('[data-perm="copy"]')
    page.locator('#secRun').click();page.wait_for_selector('#secDownload:not([hidden])',timeout=120000)
    ok('protect reports the page count and the handler','AES-256' in page.locator('#secLead').inner_text())
    with page.expect_download() as d:page.locator('#secDownload').click()
    locked=Path(d.value.path()).read_bytes()
    ok('protect writes a real AES-256 encryption dictionary',b'/Encrypt' in locked and b'/AESV3' in locked and b'/Perms' in locked)
    refused=page.evaluate("""async b64=>{
      const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
      try{await L.PDFDocument.load(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));return 'loaded';}catch(e){return e.message;}
    }""",base64.b64encode(locked).decode())
    ok('a reader refuses the protected file without the password','is encrypted' in refused,refused)
    page.goto(BASE+'/en/pdf/unlock/',wait_until='networkidle')
    page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
    drop(page,'.dropzone',[{'name':'locked.pdf','type':'application/pdf','b64':base64.b64encode(locked).decode()}])
    page.wait_for_selector('#secPassword')
    page.fill('#secPassword','wrong one');page.locator('#secRun').click()
    page.wait_for_selector('#secFiles .pill.bad',timeout=120000)
    ok('a wrong password is refused, not guessed around','Wrong password' in page.locator('#secFiles').inner_text())
    page.fill('#secPassword','task browser pass');page.locator('#secRun').click()
    page.wait_for_selector('#secDownload:not([hidden])',timeout=120000)
    with page.expect_download() as d:page.locator('#secDownload').click()
    opened=Path(d.value.path()).read_bytes()
    ok('unlock removes the encryption dictionary',b'/Encrypt' not in opened)
    pages=page.evaluate("""async b64=>{
      const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
      const doc=await L.PDFDocument.load(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
      return doc.getPageCount();
    }""",base64.b64encode(opened).decode())
    ok('the unlocked PDF opens with no password and keeps its pages',pages==2,str(pages))
    # --- PDF compression: a page size in pixels, and automatic grayscale (nerulio/agent-pdf-depth) ---
    # Every image-to-PDF converter writes a MediaBox of one point per pixel, which turns an A4
    # scan into a 17x24in page at a genuine 72dpi. A resolution rule finds nothing to do there,
    # so the pixel cap has to carry the file. `tint` paints a patch of real colour, which the
    # automatic grayscale must refuse to throw away.
    def pixel_page_pdf(page,tint):
        return page.evaluate("""async tint=>{
          const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
          const W=1240,H=1754,d=await L.PDFDocument.create();
          for(let n=0;n<3;n++){
            const c=new OffscreenCanvas(W,H),x=c.getContext('2d');
            x.fillStyle='#fbfbfb';x.fillRect(0,0,W,H);
            x.fillStyle='#181818';x.font='34px serif';
            for(let i=0;i<34;i++)x.fillText('Scanned line '+(i+1)+' of page '+(n+1)+' - small print stays legible',90,150+i*44);
            const g=x.getImageData(0,0,W,H);                       // paper grain, and no colour
            for(let i=0;i<g.data.length;i+=4){const j=(Math.random()*13|0)-6;g.data[i]+=j;g.data[i+1]+=j;g.data[i+2]+=j;}
            x.putImageData(g,0,0);
            if(tint){x.strokeStyle='#0d1f8f';x.lineWidth=7;x.strokeRect(70,70,W-140,H-140);}
            const jpeg=new Uint8Array(await (await c.convertToBlob({type:'image/jpeg',quality:.92})).arrayBuffer());
            d.addPage([W,H]).drawImage(await d.embedJpg(jpeg),{x:0,y:0,width:W,height:H});
          }
          const bytes=await d.save({useObjectStreams:true});
          return btoa(Array.from(bytes,v=>String.fromCharCode(v)).join(''));
        }""",tint)
    page.goto(BASE+'/en/pdf/compress/',wait_until='networkidle')
    page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
    drop(page,'.dropzone',[{'name':'pixel sized scan.pdf','type':'application/pdf','b64':pixel_page_pdf(page,False)}])
    ready(page)
    saved=int(page.locator('#taskSummary .summary-big').inner_text()[1:-1])
    note=page.locator('#viewerNote').inner_text()
    ok('a page whose box is in pixels is still downsampled by the pixel cap',saved>=55,f'{saved}% · {note}')
    ok('a colourless scan is reported as turned grayscale','turned grayscale' in note,note)
    page.locator('[data-action="task-clear"]').click()
    drop(page,'.dropzone',[{'name':'scan with a blue frame.pdf','type':'application/pdf','b64':pixel_page_pdf(page,True)}])
    ready(page)
    tinted=page.locator('#viewerNote').inner_text()
    ok('a scan carrying real colour keeps it','turned grayscale' not in tinted,tinted)
    ok('that scan is still compressed',int(page.locator('#taskSummary .summary-big').inner_text()[1:-1])>=50,tinted)
    page.locator('[data-action="task-clear"]').click()
    # --- PDF editor: redaction really removes, crop sets the box, rotation and forms survive ---
    page.goto(BASE+'/en/pdf/editor/',wait_until='networkidle')
    page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
    form=page.evaluate("""async()=>{
      const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
      const d=await L.PDFDocument.create(),font=await d.embedFont(L.StandardFonts.Helvetica);
      const one=d.addPage([595,842]);
      one.drawText('Confidential account 4929-8817-0032-5511',{x:60,y:760,size:14,font});
      one.drawText('Keep this line',{x:60,y:700,size:14,font});
      const two=d.addPage([595,842]);
      for(let i=0;i<12;i++)two.drawText('Clause '+(i+1)+': processed in the browser.',{x:60,y:780-i*28,size:11,font});
      // The field goes on page two on purpose: page one is redacted below and becomes an image.
      const field=d.getForm().createTextField('reference');field.addToPage(two,{x:300,y:640,width:220,height:22});
      const bytes=await d.save();return btoa(Array.from(bytes,v=>String.fromCharCode(v)).join(''));
    }""")
    drop(page,'.dropzone',[{'name':'confidential.pdf','type':'application/pdf','b64':form}])
    page.wait_for_selector('#edSave');page.wait_for_timeout(900)
    ok('the editor offers the document’s own form fields',page.locator('#edFormActions:not([hidden])').count()==1)
    page.click('[data-action="ed-form"]');page.fill('[data-field="0"]','REF-2026-77');page.click('[data-form-ok]')
    page.click('.ed-tool[data-tool="redact"]')
    b=page.locator('#edRot').bounding_box()
    page.mouse.move(b['x']+55,b['y']+b['height']*.07);page.mouse.down()
    page.mouse.move(b['x']+b['width']*.75,b['y']+b['height']*.115,steps=6);page.mouse.up()
    page.wait_for_timeout(250)
    ok('the editor names the pages a redaction will rasterise','1' in page.locator('#edWarn').inner_text() and not page.locator('#edWarn').is_hidden())
    page.click('.ed-tool[data-tool="crop"]')
    b=page.locator('#edRot').bounding_box()
    page.mouse.move(b['x']+b['width']*.05,b['y']+b['height']*.02);page.mouse.down()
    page.mouse.move(b['x']+b['width']*.95,b['y']+b['height']*.5,steps=8);page.mouse.up()
    page.wait_for_timeout(250)
    ok('a crop is recorded for the page',page.locator('.ed-crop').count()==1)
    page.click('.ed-thumb[data-page="1"]');page.wait_for_timeout(600)
    page.click('[data-action="ed-rot-right"]');page.wait_for_timeout(800)
    ok('the rotated page is shown in landscape',page.locator('#edPage').bounding_box()['width']>page.locator('#edPage').bounding_box()['height'])
    with page.expect_download() as d:page.click('#edSave')
    edited=Path(d.value.path()).read_bytes()
    ok('the result says how many pages were rasterised','image' in page.locator('#edResult').inner_text())
    ok('the redacted string is not in the saved bytes at all',b'4929-8817' not in edited)
    shape=page.evaluate("""async b64=>{
      const L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
      const doc=await L.PDFDocument.load(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
      const one=doc.getPage(0),two=doc.getPage(1),box=one.getCropBox();
      const named=doc.getForm().getFields().map(f=>f.getName());
      return {pages:doc.getPageCount(),cropW:Math.round(box.width),cropH:Math.round(box.height),
              rotation:two.getRotation().angle,fields:named,value:named.includes('reference')?doc.getForm().getTextField('reference').getText():null};
    }""",base64.b64encode(edited).decode())
    ok('the crop changed the page box, not the page count',shape['pages']==2 and shape['cropH']<600 and shape['cropW']<595,json.dumps(shape))
    ok('the page rotated in the editor carries /Rotate 90',shape['rotation']==90,json.dumps(shape))
    ok('the form field survives as a field and carries the typed value',shape['fields']==['reference'] and shape['value']=='REF-2026-77',json.dumps(shape))
    # ===== Pixel Lab (src/task/pixel-lab.js) =========================================
    import importlib.util
    _spec=importlib.util.spec_from_file_location('plab_fx',ROOT/'tests/pixel-lab-fixtures.py')
    fx=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fx)
    def plab_files(pairs):return [{'name':n,'mimeType':'image/png','buffer':b} for n,b in pairs]
    def plab_open(path,pairs):
        page.goto(BASE+'/en/'+path+'/app/',wait_until='networkidle')
        page.locator('#fileInput').set_input_files(files=plab_files(pairs));page.locator('#plabCanvas').wait_for();page.wait_for_timeout(700)
    def plab_zip(entries=None):
        with page.expect_download() as d:page.locator('[data-action="plab-export"]').click()
        z=zipfile.ZipFile(d.value.path());meta=json.loads(z.read('pixel-lab.json'))
        pal={tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in meta['meta']['palette']}
        union,bands=set(),[]
        for name in sorted(x for x in z.namelist() if x.endswith('.png')):
            im=Image.open(io.BytesIO(z.read(name))).convert('RGBA')
            union|={p[:3] for p in im.getdata() if p[3]>0}
            bands.append(tuple(im.crop((0,im.height-8,im.width,im.height)).getdata()))
        return z,meta,pal,union,bands
    # One palette for eight anti-aliased animation frames, proven from the exported PNGs.
    plab_open('game/pixel-lab',fx.frames(8))
    ok('pixel lab shows every frame and one palette',page.locator('.frame-chip').count()==8 and '16 colours' in page.locator('#plabSummary').inner_text())
    z,meta,pal,union,bands=plab_zip()
    ok('pixel lab exports one PNG per frame with the palette and the JSON envelope',
       len([x for x in z.namelist() if x.endswith('.png')])==8 and 'pixel-lab.json' in z.namelist() and any(x.endswith('.gpl') for x in z.namelist()))
    ok('the locked palette bounds every exported frame',union<=pal and len(pal)<=16,f'{len(union-pal)} of {len(union)} colours outside a {len(pal)}-colour palette')
    ok('an unchanged region keeps identical pixels in all eight frames',len(set(bands))==1,f'{len(set(bands))} versions')
    ok('the JSON envelope is the shared game schema',meta['meta']['schemaVersion']==1 and meta['meta']['engineTarget']=='generic' and len(meta['frames'])==8)
    ok('the exported palette is a real GIMP palette',z.read([x for x in z.namelist() if x.endswith('.gpl')][0]).decode().startswith('GIMP Palette\n'))
    # Ordered dithering is position-only, so the same unchanged region still matches everywhere.
    page.locator('[data-action="plab-set"][data-key="dither"][data-value="bayer4"]').click();page.wait_for_timeout(700)
    z2,_,pal2,union2,bands2=plab_zip()
    ok('ordered Bayer dithering neither flickers nor leaves the palette',len(set(bands2))==1 and union2<=pal2)
    page.locator('.options .hint').last.wait_for()
    page.locator('[data-action="plab-set"][data-key="dither"][data-value="floyd-steinberg"]').click();page.wait_for_timeout(500)
    ok('error diffusion warns that animations can flicker','flicker' in page.locator('.options .hint').last.inner_text().lower())
    page.locator('[data-action="plab-set"][data-key="dither"][data-value="none"]').click();page.wait_for_timeout(500)
    # Anti-alias remover: palette-only output, silhouette untouched.
    plab_open('game/pixel-art-cleanup',fx.frames(2))
    ok('the cleanup stage counts candidates before changing anything','Stray pixels:' in page.locator('#plabCleanupOut').inner_text())
    page.locator('#plabAA').check();page.wait_for_timeout(800)
    z3,_,pal3,union3,_=plab_zip()
    after=Image.open(io.BytesIO(z3.read(sorted(x for x in z3.namelist() if x.endswith('.png'))[0]))).convert('RGBA')
    before=Image.open(io.BytesIO(fx.frames(2)[0][1])).convert('RGBA')
    moved=sum(1 for a,b in zip(before.split()[3].point(lambda v:255 if v else 0).getdata(),after.split()[3].point(lambda v:255 if v else 0).getdata()) if a!=b)
    distinct_before=len({p[:3] for p in before.getdata() if p[3]>0})
    ok('the anti-alias remover snaps every pixel into the palette',union3<=pal3 and len(union3)<=len(pal3),f'{distinct_before} distinct colours in, {len(union3)} out')
    ok('removing anti-aliasing does not move the silhouette',moved==0,f'{moved} alpha pixels differ')
    # Colour budget audit and one-click merge of the rarest colours.
    plab_open('game/palette-extractor',fx.frames(4))
    page.locator('#plabBudget').fill('8');page.wait_for_timeout(700)
    ok('the auditor lists the colours that are over budget',page.locator('.plab-offenders li').count()==8,page.locator('#plabBudget-out').inner_text().split(chr(10))[0])
    page.locator('[data-action="plab-merge"]').click();page.wait_for_timeout(900)
    _,_,pal4,union4,_=plab_zip()
    ok('merging the rarest colours really reaches the budget',len(union4)<=8 and union4<=pal4,f'{len(union4)} colours out')
    page.keyboard.press('Control+z');page.wait_for_timeout(800)
    ok('Ctrl+Z on the document restores the merged colours',page.locator('.plab-swatch').count()>8)
    # Pixel-grid checks against known 1x, 3x, 2.5x-nearest and 2.5x-bilinear inputs.
    for name,image,expected in [('flat-1x',fx.flat_sprite(),'Already 1'),('nearest-3x',fx.upscaled(3),'3\u00d7 \u00b7 logical size 16\u00d716'),
                                ('nearest-2.5x',fx.nearest_non_integer(),'No integer grid')]:
        plab_open('game/pixel-perfect-checker',[(name+'.png',fx.png(image))])
        ok(f'the checker reads {name} correctly',expected in page.locator('#plabReport').inner_text(),page.locator('#plabReport').inner_text().replace(chr(10),' | ')[:120])
    plab_open('game/pixel-perfect-checker',[('bilinear.png',fx.png(fx.bilinear()))])
    report=page.locator('#plabReport').inner_text()
    ok('the checker measures blurred edges instead of guessing a scale','Intermediate edge pixels' in report and 'Integer pixel grid' not in report,report.replace(chr(10),' | ')[:120])
    plab_open('game/pixel-perfect-checker',[('up3.png',fx.png(fx.upscaled(3)))])
    with page.expect_download() as d:
        page.locator('[data-action="plab-recover"]').click();page.wait_for_timeout(500);page.locator('[data-action="plab-export-one"]').click()
    ok('recovering the 1x source returns the original grid',Image.open(d.value.path()).size==(16,16))
    for path,stage in [('game/pixel-lab','convert'),('game/palette-extractor','palette'),('game/palette-swap-ramp','recolor'),('game/pixel-art-cleanup','cleanup'),('game/pixel-perfect-checker','check')]:
        plab_open(path,fx.frames(2))
        ok(f'{path} opens the Lab at its own stage',page.locator(f'[data-action="plab-stage"][data-stage="{stage}"]').get_attribute('aria-current')=='page')
    for width in (390,320):
        plab_phone=browser.new_context(viewport={'width':width,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page()
        plab_phone.on('pageerror',lambda e:errors.append(str(e)))
        plab_phone.goto(BASE+'/ko/game/pixel-lab/app/',wait_until='networkidle')
        plab_phone.locator('#fileInput').set_input_files(files=plab_files(fx.frames(8)));plab_phone.locator('#plabCanvas').wait_for();plab_phone.wait_for_timeout(800)
        for stage in ('palette','cleanup','check'):
            plab_phone.locator(f'[data-action="plab-stage"][data-stage="{stage}"]').click();plab_phone.wait_for_timeout(700)
            ok(f'pixel lab has no horizontal scroll at {width} on {stage}',plab_phone.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'),str(plab_phone.evaluate('()=>document.documentElement.scrollWidth')))
        plab_phone.close()
    # ===== end Pixel Lab =============================================================
    # ===== Tile Lab (src/task/tile-lab.js, docs/TILE-LAB.md) =====================================
    # The blob reduction is re-derived here so the page cannot verify itself: a corner neighbour
    # only counts behind both of its edges, which turns the 256 raw masks into exactly 47 slots.
    NBIT=dict(n=1,ne=2,e=4,se=8,s=16,sw=32,w=64,nw=128)
    def reduce_mask(m):
        r=m&(NBIT['n']|NBIT['e']|NBIT['s']|NBIT['w'])
        for corner,(a,b) in {'ne':('n','e'),'se':('s','e'),'sw':('s','w'),'nw':('n','w')}.items():
            if m&NBIT[corner] and m&NBIT[a] and m&NBIT[b]:r|=NBIT[corner]
        return r
    BLOB=sorted({reduce_mask(m) for m in range(256)})
    ok('the blob rule set has 47 classes',len(BLOB)==47 and BLOB[-1]==255)
    TILE=16;COLS=8
    def slot_colour(i):return ((i*5+10)%256,60+(i%3)*30,200-i*3,255)
    def blob_sheet(blank=()):
        # One flat, unique colour per slot: the rendered map can then be checked by reading pixels.
        im=Image.new('RGBA',(COLS*TILE,6*TILE),(0,0,0,0))
        for i in range(len(BLOB)):
            if i in blank:continue
            x0,y0=(i%COLS)*TILE,(i//COLS)*TILE
            for y in range(TILE):
                for x in range(TILE):im.putpixel((x0+x,y0+y),slot_colour(i))
        b=io.BytesIO();im.save(b,'PNG');return b.getvalue()
    def open_lab(path,buffer,query=''):
        page.goto(BASE+path+query,wait_until='networkidle')
        page.locator('#fileInput').set_input_files([{'name':'terrain.png','mimeType':'image/png','buffer':buffer}])
        page.wait_for_function("()=>!!document.querySelector('.tl-stages')",timeout=60000);page.wait_for_timeout(250)
    def pixel(selector,cx,cy,size=TILE):
        return tuple(page.evaluate("""([sel,cx,cy,size])=>{const c=document.querySelector(sel),g=c.getContext('2d');
          const d=g.getImageData(Math.floor(cx*size+size/2),Math.floor(cy*size+size/2),1,1).data;return [d[0],d[1],d[2],d[3]];}""",[selector,cx,cy,size]))
    sheet=blob_sheet()
    open_lab('/en/game/tile-lab/classic/',sheet)
    ok('the Lab opens as one workspace with its stages',page.locator('.tl-stages button').count()==6 and page.locator('#tlSheet').count()==1)
    top=page.locator('.tl-cand').first.inner_text().replace('×','x')
    ok('the grid is measured, and the measured grid is the one offered first','16x16' in top,top)
    ok('the suggestion is applied but every number stays editable',
       [page.locator('[data-option="'+k+'"]').input_value() for k in ['tileWidth','tileHeight','marginX','spacingX']]==['16','16','0','0'])
    ok('each candidate shows the numbers it was ranked on',page.locator('.tl-cand .tl-ev i').count()>=3)
    ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path());assert z.testzip() is None
    meta=json.loads(z.read('metadata.json'))
    written=[n for n in z.namelist() if n.startswith('tiles/')]
    ok('slicing writes one PNG per non-blank tile plus metadata',len(written)==47 and meta['tileSet']['skippedBlank']==1 and len(meta['frames'])==47,len(written))
    ok('the metadata says exactly where tile 5 came from',meta['frames']['tile-005.png']['rect']=={'x':5*TILE,'y':0,'w':TILE,'h':TILE})
    tile5=Image.open(io.BytesIO(z.read('tiles/tile-005.png'))).convert('RGBA')
    ok('a sliced tile is the source region, not a re-render',tile5.size==(TILE,TILE) and set(tile5.getdata())=={slot_colour(5)})
    # --- rule check: what the sheet is missing for the chosen kind ---
    page.locator('[data-action="tl-stage"][data-stage="rules"]').click();page.wait_for_timeout(400)
    ok('a complete 47-tile blob sheet reports nothing missing',
       page.locator('#tlRules .summary-big').inner_text()=='0' and page.locator('[data-ghost]').count()==0)
    open_lab('/en/game/tile-lab/classic/',blob_sheet(blank={5,17,40}),'?stage=rules')
    ok('a sheet with three slots painted out reports exactly those three',
       sorted(int(v) for v in page.locator('[data-ghost]').evaluate_all('ns=>ns.map(n=>n.dataset.ghost)'))==[5,17,40],
       page.locator('#tlRules .summary-line').first.inner_text())
    # --- autotile tester: the rules choose the tile, and the pixels prove which one ---
    open_lab('/en/game/autotile-tester/classic/',sheet)
    ok('the autotile route opens the Lab at its tester',page.locator('[data-action="tl-stage"][data-stage="tester"]').get_attribute('aria-pressed')=='true')
    ok('the sheet is used as the tile art when it can cover the rule set',
       page.locator('[data-key="source"][data-value="sheet"]').get_attribute('aria-pressed')=='true')
    page.locator('[data-action="tl-fill"]').click();page.wait_for_timeout(300)
    ok('a filled terrain leaves no cell without a tile',page.locator('#tlMapSummary .summary-big').inner_text()=='✓')
    ok('the middle of a filled area draws the all-neighbours tile',pixel('#tlMap',8,8)==slot_colour(BLOB.index(255)),pixel('#tlMap',8,8))
    ok('its top-left corner draws the tile whose only neighbours are E, SE and S',
       pixel('#tlMap',0,0)==slot_colour(BLOB.index(NBIT['e']|NBIT['se']|NBIT['s'])),pixel('#tlMap',0,0))
    page.locator('[data-action="tl-clear"]').click();page.wait_for_timeout(250)
    ok('clearing the terrain empties the map',pixel('#tlMap',8,8)[3]==0)
    # The keyboard is a real alternative to painting, not a decoration.
    page.locator('#tlMap').click(position={'x':4,'y':4});page.wait_for_timeout(200)
    page.locator('#tlMap').press('ArrowRight');page.locator('#tlMap').press(' ');page.wait_for_timeout(250)
    ok('arrow keys plus Space paint the cell next to the one that was clicked',
       pixel('#tlMap',1,0)==slot_colour(BLOB.index(NBIT['w'])),pixel('#tlMap',1,0))
    # Undo is the terrain grid itself (one byte per cell), so a step restores the exact map.
    page.locator('[data-action="tl-fill"]').click();page.wait_for_timeout(250)
    filled=pixel('#tlMap',8,8)
    page.locator('[data-action="tl-clear"]').click();page.wait_for_timeout(250)
    page.locator('[data-action="tl-undo"]').click();page.wait_for_timeout(250)
    ok('undo restores the exact map that was painted before',pixel('#tlMap',8,8)==filled,pixel('#tlMap',8,8))
    page.locator('[data-action="tl-redo"]').click();page.wait_for_timeout(250)
    ok('redo empties it again and exhausts itself',pixel('#tlMap',8,8)[3]==0 and page.locator('#tlRedo').is_disabled())
    # --- seams: one repeating texture, measured against its own interior ---
    wrap=Image.new('RGBA',(32,32))
    for y in range(32):
        for x in range(32):
            v=int(128+60*math.cos(2*math.pi*x/32)+40*math.cos(2*math.pi*y/32));wrap.putpixel((x,y),(v,v,v,255))
    b=io.BytesIO();wrap.save(b,'PNG')
    open_lab('/en/game/seamless-tile-checker/app/',b.getvalue())
    # The seams stage has no grid fields; the tile it measures is named in the board bar.
    ok('the seam checker treats the whole image as the tile','32'+chr(215)+'32' in page.locator('#tlSeamInfo').inner_text(),page.locator('#tlSeamInfo').inner_text())
    ok('a tile that wraps is reported seamless','without a visible seam' in page.locator('#tlSeamSummary .summary-line').inner_text())
    ramp=Image.new('RGBA',(32,32))
    for y in range(32):
        for x in range(32):ramp.putpixel((x,y),(x*8,y*8,90,255))
    b=io.BytesIO();ramp.save(b,'PNG')
    open_lab('/en/game/seamless-tile-checker/app/',b.getvalue())
    ok('a tile that does not wrap is reported honestly','shows a seam' in page.locator('#tlSeamSummary .summary-line').inner_text())
    ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    healed=Image.open(d.value.path()).convert('RGBA')
    worst=max(max(abs(a-b) for a,b in zip(healed.getpixel((0,y)),healed.getpixel((31,y)))) for y in range(32))
    ok('the seamless helper really joins the wrap it showed',healed.size==(32,32) and worst<=8,worst)
    # --- templates: guide art whose cells are the layout table ---
    open_lab('/en/game/tile-lab/classic/',sheet,'?stage=templates&kind=edge16')
    ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path())
    layout=json.loads(z.read('edge16-layout.json'))['layout']
    guide=Image.open(io.BytesIO(z.read('edge16-template.png'))).convert('RGBA')
    ok('a template PNG and its layout JSON describe the same 16 cells',
       layout['count']==16 and len(layout['slots'])==16 and guide.size==(4*layout['tileSize']['w'],4*layout['tileSize']['h']))
    ok('every template cell is drawn where the JSON says it is',
       all(guide.crop((s['rect']['x'],s['rect']['y'],s['rect']['x']+s['rect']['w'],s['rect']['y']+s['rect']['h'])).getbbox() for s in layout['slots']))
    # --- Godot pack: generic JSON plus a helper script, never a hand-written resource ---
    open_lab('/en/game/tile-lab/classic/',sheet,'?stage=export&kind=blob47')
    ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path());pack=set(z.namelist())
    gj=json.loads(z.read('nerulio-tileset.json'))
    ok('the Godot pack is JSON plus a readable helper, with no fake engine file',
       {'nerulio-tileset.json','nerulio_tileset_import.gd','README.txt'}<=pack and not any(n.endswith(('.tres','.tscn','.meta','.import')) for n in pack),sorted(pack))
    NAME={'n':'top_side','ne':'top_right_corner','e':'right_side','se':'bottom_right_corner','s':'bottom_side','sw':'bottom_left_corner','w':'left_side','nw':'top_left_corner'}
    ok('every peering bit in the pack is the neighbour mask of its slot',
       all(t['peering']=={NAME[k]:0 for k,bit in NBIT.items() if t['slot']['mask']&bit} for t in gj['tileSet']['tiles'])
       and len(gj['tileSet']['tiles'])==47 and gj['tileSet']['terrainSets'][0]['mode']=='match_corners_and_sides')
    # ===== end Tile Lab ==========================================================================
    # === UI Lab (src/task/ui-lab.js, docs/UI-LAB.md) =========================================
    # Every claim here is checked against pixels or re-parsed data, never against the UI's words.
    def ui_png(im):
        b=io.BytesIO();im.save(b,'PNG');return {'name':'panel.png','mimeType':'image/png','buffer':b.getvalue()}
    def ui_panel(size=24,border=6):
        im=Image.new('RGBA',(size,size),(0,0,0,0))
        for y in range(size):
            for x in range(size):
                inner=border<=x<size-border and border<=y<size-border
                im.putpixel((x,y),(79,126,192,255) if inner else (56,83,125,255) if 2<=x<size-2 and 2<=y<size-2 else (36,52,77,255))
        for (x,y),c in [((0,0),(229,72,77,255)),((size-1,0),(18,146,95,255)),((0,size-1),(49,130,246,255)),((size-1,size-1),(245,165,36,255))]:im.putpixel((x,y),c)
        return im
    def ui_striped(size=12,border=4):
        # A pattern along each edge: without one, tiling and stretching a uniform edge look the same.
        im=Image.new('RGBA',(size,size),(0,0,0,0))
        for y in range(size):
            for x in range(size):
                edge=x<border or y<border or x>=size-border or y>=size-border
                stripe=((x if y<border or y>=size-border else y)%4)<2
                im.putpixel((x,y),(230,90,90,255) if edge and stripe else (40,60,95,255) if edge else (90,200,140,255) if (x+y)%4<2 else (30,110,80,255))
        return im
    def ui_sheet():
        im=Image.new('RGBA',(128,64),(0,0,0,0))
        for box,c in [((4,4,44,20),(49,130,246,255)),((56,6,80,30),(18,146,95,255)),((92,6,116,30),(229,72,77,255)),((8,36,60,56),(130,80,223,255))]:
            for y in range(box[1],box[3]):
                for x in range(box[0],box[2]):im.putpixel((x,y),c)
        for y in range(8,16):
            for x in range(20,28):im.putpixel((x,y),(0,0,0,0))
        return im
    def ui_fontsheet(glyphs,cell=8):
        im=Image.new('RGBA',(cell*len(glyphs),cell),(0,0,0,0))
        for i,ch in enumerate(glyphs):
            if ch==' ':continue
            for y in range(1,7):
                for x in range(i*cell+1,min(i*cell+2+i,i*cell+cell-1)):im.putpixel((x,y),(255,255,255,255))
        return im
    def ui_fnt(text):
        # An independent BMFont text parser: no code shared with the page that wrote the file.
        out={'info':{},'common':{},'pages':{},'chars':[]}
        for line in text.splitlines():
            parts=line.strip().split();  # tag then key=value pairs
            if not parts:continue
            fields={}
            for pair in parts[1:]:
                if '=' not in pair:continue
                key,value=pair.split('=',1)
                fields[key]=value.strip('"') if value.startswith('"') else [int(v) for v in value.split(',')] if ',' in value else int(value) if value.lstrip('-').isdigit() else value
            if parts[0] in ('info','common'):out[parts[0]]=fields
            elif parts[0]=='page':out['pages'][fields.get('id',0)]=fields.get('file')
            elif parts[0]=='char':out['chars'].append(fields)
        return out
    def ui_zip(action):
        with page.expect_download() as d:page.locator(action).click()
        z=zipfile.ZipFile(d.value.path());assert z.testzip() is None;return z
    def ui_image(z,name):return Image.open(io.BytesIO(z.read(name))).convert('RGBA')
    # --- 9-slice: suggestion, keyboard, and corners that survive every resize ---
    page.goto(BASE+'/en/game/9-slice-editor/app/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[ui_png(ui_panel())])
    page.locator('#nsCanvas').wait_for(timeout=60000);page.wait_for_timeout(400)
    ok('the 9-slice route opens the Lab at its own stage',page.locator('[data-action="ui-stage"][data-stage="slice"]').get_attribute('aria-selected')=='true')
    ok('borders are offered as a suggestion, with the run they were found from',
       page.locator('.ui-suggest span').first.inner_text().startswith('6 · 6 · 6 · 6') and 'identical columns' in page.locator('.ui-suggest span').first.inner_text())
    page.locator('[data-action="ui-accept"]').click();page.wait_for_timeout(200)
    ok('accepting the suggestion fills the four numbers',[page.locator(f'#ns-{s}').input_value() for s in ['left','right','top','bottom']]==['6']*4)
    page.locator('.ns-guide.left').focus();page.keyboard.press('ArrowRight');page.keyboard.press('ArrowRight');page.wait_for_timeout(150)
    ok('arrow keys are a real alternative to dragging a guide',page.locator('#ns-left').input_value()=='8')
    page.locator('.ns-guide.left').focus();page.keyboard.press('Shift+ArrowLeft');page.wait_for_timeout(150)
    ok('Shift+arrow moves ten pixels and clamps at the edge',page.locator('#ns-left').input_value()=='0')
    page.fill('#ns-left','6');page.wait_for_timeout(200)
    ok('the stretch region is marked with a pattern, not colour alone','repeating-linear-gradient' in page.locator('#nsCenter').evaluate('e=>getComputedStyle(e).backgroundImage'))
    page.locator('[data-opt="slice.customW"]').fill('8');page.locator('[data-opt="slice.customH"]').fill('8');page.wait_for_timeout(300)
    ok('a target narrower than its own corners is warned about',page.locator('#nsSummary .summary-line.bad').count()>=1)
    page.locator('[data-opt="slice.customW"]').fill('420');page.locator('[data-opt="slice.customH"]').fill('120');page.wait_for_timeout(300)
    z=ui_zip('[data-action="ui-export-slice"]')
    ok('the nine-slice ZIP holds the source, one preview per target, the JSON and setup notes',
       sorted(z.namelist())==sorted(['panel.png','nine-slice.json','SETUP.md','previews/100x40.png','previews/300x80.png','previews/800x200.png','previews/420x120.png']),str(z.namelist()))
    src=ui_image(z,'panel.png');meta=json.loads(z.read('nine-slice.json'))
    blocks=all(ui_image(z,n).crop(d).tobytes()==src.crop(s).tobytes()
               for n in [e for e in z.namelist() if e.startswith('previews/')]
               for d,s in [((0,0,6,6),(0,0,6,6)),
                           ((ui_image(z,n).width-6,0,ui_image(z,n).width,6),(18,0,24,6)),
                           ((0,ui_image(z,n).height-6,6,ui_image(z,n).height),(0,18,6,24)),
                           ((ui_image(z,n).width-6,ui_image(z,n).height-6,ui_image(z,n).width,ui_image(z,n).height),(18,18,24,24))])
    ok('every resized render keeps all four 6x6 corner blocks byte-identical to the source',blocks)
    nine=meta['frames']['panel']['nineSlice']
    ok('the JSON carries the borders in pixels, normalised and in each engine order',
       nine['pixels']=={'left':6,'right':6,'top':6,'bottom':6} and nine['normalized']['left']==6/24
       and nine['godot4']['patch_margin_top']==6 and nine['unity']['border']==[6,6,6,6] and meta['meta']['schemaVersion']==1)
    setup=z.read('SETUP.md').decode('utf-8')
    ok('the setup notes name the real engine fields, Unity order included, and say they are unverified',
       'patch_margin_left' in setup and 'texture_margin' in setup and 'L, B, R, T' in setup and 'UNVERIFIED' in setup)
    page.locator('#fileInput').set_input_files(files=[ui_png(ui_striped())])
    page.locator('#nsCanvas').wait_for(timeout=60000);page.wait_for_timeout(400)
    for side in ['left','right','top','bottom']:page.fill('#ns-'+side,'4')
    page.wait_for_timeout(300);z_stretch=ui_zip('[data-action="ui-export-slice"]')
    page.locator('[data-action="ui-set"][data-key="slice.mode"][data-value="tile"]').click();page.wait_for_timeout(300)
    z_tile=ui_zip('[data-action="ui-export-slice"]')
    tiled,stretched,striped=ui_image(z_tile,'previews/300x80.png'),ui_image(z_stretch,'previews/300x80.png'),ui_image(z_tile,'panel.png')
    ok('tiled edges repeat the source at its natural size, and differ from stretched ones',
       tiled.tobytes()!=stretched.tobytes() and tiled.crop((4,0,8,4)).tobytes()==tiled.crop((8,0,12,4)).tobytes()==striped.crop((4,0,8,4)).tobytes())
    ok('stretching instead smears that middle across the span',
       stretched.crop((4,0,5,4)).tobytes()==stretched.crop((6,0,7,4)).tobytes() and tiled.crop((4,0,5,4)).tobytes()!=tiled.crop((6,0,7,4)).tobytes())
    # A shared link carries settings only: no image data can be in a URL.
    page.goto(BASE+'/en/game/ui-lab/app/?stage=states&l=5&r=7&t=3&b=4&mode=tile&w=250&h=90',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[ui_png(ui_panel())])
    page.locator('.ui-state canvas').first.wait_for(timeout=60000);page.wait_for_timeout(300)
    opened=page.locator('[data-action="ui-stage"][aria-selected="true"]').get_attribute('data-stage')
    page.locator('[data-action="ui-stage"][data-stage="slice"]').click();page.wait_for_timeout(400)
    ok('a settings link opens the named stage with its borders, edge mode and custom size',
       opened=='states' and [page.locator(f'#ns-{s}').input_value() for s in ['left','right','top','bottom']]==['5','7','3','4']
       and page.locator('[data-key="slice.mode"][aria-pressed="true"]').get_attribute('data-value')=='tile'
       and page.locator('[data-opt="slice.customW"]').input_value()=='250')
    # --- button states ---
    page.goto(BASE+'/en/game/button-state-generator/app/',wait_until='networkidle')
    button=Image.new('RGBA',(40,16),(60,120,200,255))
    page.locator('#fileInput').set_input_files(files=[{'name':'button.png','mimeType':'image/png','buffer':io.BytesIO(),'buffer':ui_png(button)['buffer']}])
    page.locator('.ui-state canvas').first.wait_for(timeout=60000);page.wait_for_timeout(400)
    ok('five state variants are previewed at once',page.locator('.ui-state').count()==5)
    page.locator('[data-key="states.selected"][data-value="pressed"]').first.click();page.wait_for_timeout(200)
    page.locator('[data-state="offsetY"]').fill('3');page.wait_for_timeout(400)
    z=ui_zip('[data-action="ui-export-states"]')
    normal,hover,pressed,disabled,focus=[ui_image(z,f'states/{n}.png') for n in ['normal','hover','pressed','disabled','focus']]
    ok('normal is the source byte for byte',normal.tobytes()==button.tobytes())
    ok('hover is brighter, pressed is offset by the requested pixels and clears what it left',
       hover.getpixel((20,8))[0]>normal.getpixel((20,8))[0] and pressed.getpixel((20,3))==pressed.getpixel((20,8))==pressed.getpixel((20,15)) and pressed.getpixel((20,0))[3]==0 and pressed.size==normal.size)
    ok('disabled is grey and half transparent; focus grows by its outline and rings it',
       len(set(disabled.getpixel((20,8))[:3]))==1 and disabled.getpixel((20,8))[3]==128
       and focus.size==(44,20) and focus.getpixel((1,1))[:3]==(49,130,246) and focus.getpixel((22,10))==normal.getpixel((20,8)))
    strip=ui_image(z,'button-states.png');states=json.loads(z.read('states.json'))
    ok('every rect in states.json cuts exactly that state out of the packed strip',
       all(strip.crop((f['rect']['x'],f['rect']['y'],f['rect']['x']+f['rect']['w'],f['rect']['y']+f['rect']['h'])).tobytes()==ui_image(z,f'states/{n}.png').tobytes() for n,f in states['frames'].items()))
    ok('the JSON records the operation values each state used',states['states']['pressed']['ops']['offsetY']==3 and states['states']['disabled']['ops']['alpha']==0.5)
    # --- UI atlas + component slicer ---
    page.goto(BASE+'/en/game/ui-lab/app/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[{'name':'ui-sheet.png','mimeType':'image/png','buffer':ui_png(ui_sheet())['buffer']}])
    page.locator('#nsCanvas').wait_for(timeout=60000)
    page.locator('[data-action="ui-stage"][data-stage="atlas"]').click();page.locator('.ui-element').first.wait_for(timeout=60000);page.wait_for_timeout(300)
    ok('the four UI elements on the transparent sheet are detected as one box each',page.locator('.ui-element').count()==4,str(page.locator('.ui-element').count()))
    page.locator('[data-element="0"]').fill('button_wide');page.wait_for_timeout(300)
    page.locator('[data-action="ui-element-slice"][data-index="0"]').click();page.locator('#nsCanvas').wait_for(timeout=60000);page.wait_for_timeout(300)
    for side,value in [('left','5'),('right','5'),('top','4'),('bottom','4')]:page.fill('#ns-'+side,value)
    page.wait_for_timeout(300);page.locator('[data-action="ui-back-atlas"]').click();page.wait_for_timeout(400)
    page.locator('[data-opt="atlas.padding"]').fill('2');page.locator('[data-opt="atlas.extrude"]').fill('1');page.wait_for_timeout(400)
    z=ui_zip('[data-action="ui-export-atlas"]')
    atlas=ui_image(z,'ui-atlas.png');data=json.loads(z.read('ui-atlas.json'));named=data['frames']['button_wide']
    ok('the renamed element keeps the borders set for it in the envelope',named['nineSlice']['pixels']=={'left':5,'right':5,'top':4,'bottom':4})
    piece=atlas.crop((named['rect']['x'],named['rect']['y'],named['rect']['x']+named['rect']['w'],named['rect']['y']+named['rect']['h']))
    ok('the packed element is the source pixels, and extrude duplicated its edge outside the rect',
       piece.tobytes()==ui_image(z,'ui-atlas.png').crop((named['rect']['x'],named['rect']['y'],named['rect']['x']+named['rect']['w'],named['rect']['y']+named['rect']['h'])).tobytes()
       and atlas.getpixel((named['rect']['x']-1,named['rect']['y']))==piece.getpixel((0,0))
       and data['packing']=={'padding':2,'extrude':1,'mergeDistance':4,'alphaThreshold':8})
    page.locator('[data-opt="atlas.merge"]').fill('40');page.wait_for_timeout(500)
    ok('a larger merge distance really joins neighbouring boxes',page.locator('.ui-element').count()<4)
    # --- bitmap font: the original URL, the original guarantee, plus measured and TTF modes ---
    page.goto(BASE+'/en/bitmap-font-maker/app/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[{'name':'font.png','mimeType':'image/png','buffer':ui_png(Image.new('RGBA',(16,8),(255,255,255,255)))['buffer']}])
    page.locator('#rc-chars').wait_for(timeout=60000);page.wait_for_timeout(300)
    ok('the original bitmap-font URL opens the Lab at its Font stage',page.locator('[data-action="ui-stage"][data-stage="font"]').get_attribute('aria-selected')=='true')
    for field,value in [('#rc-cellW','8'),('#rc-cellH','8'),('#rc-baseline','6'),('#rc-chars','Aあ')]:page.locator(field).fill(value)
    page.wait_for_timeout(400);z=ui_zip('[data-action="ui-export-font"]')
    meta=json.loads(z.read('font.json'));fnt=z.read('font.fnt').decode('utf-8');parsed=ui_fnt(fnt)
    ok('BMFont and JSON contain exact Unicode glyph coordinates',
       'char id=12354 x=8 y=0 width=8 height=8' in fnt and meta['glyphs'][1]['codepoint']==12354 and ui_image(z,'font.png').size==(16,8))
    sheet_img=ui_image(z,'font.png')
    ok('an independent parser reads the header back and every glyph rect lies inside the atlas',
       parsed['common']['lineHeight']==8 and parsed['common']['base']==6 and parsed['common']['scaleW']==16
       and parsed['pages'][0]=='font.png' and parsed['info']['unicode']==1
       and all(0<=c['x'] and c['x']+c['width']<=sheet_img.width and 0<=c['y'] and c['y']+c['height']<=sheet_img.height for c in parsed['chars'])
       and [(c['id'],c['x'],c['y'],c['width'],c['height'],c['xadvance']) for c in parsed['chars']]==[(g['codepoint'],g['x'],g['y'],g['w'],g['h'],g['xAdvance']) for g in meta['glyphs']])
    page.locator('#fileInput').set_input_files(files=[{'name':'font2.png','mimeType':'image/png','buffer':ui_png(ui_fontsheet('AB C'))['buffer']}])
    page.wait_for_timeout(400);page.locator('[data-action="ui-set"][data-key="font.mode"][data-value="measured"]').click();page.wait_for_timeout(300)
    for field,value in [('#rc-cellW','8'),('#rc-cellH','8'),('#rc-baseline','7'),('#rc-chars','AB C')]:page.locator(field).fill(value)
    page.wait_for_timeout(400);z=ui_zip('[data-action="ui-export-font"]')
    measured=json.loads(z.read('font.json'));sheet_img=ui_image(z,'font.png')
    ok('measured mode trims each glyph to its ink and still advances for an empty cell',
       all(sheet_img.crop((g['x'],g['y'],g['x']+g['w'],g['y']+g['h'])).getbbox()==(0,0,g['w'],g['h']) for g in measured['glyphs'] if g['w'])
       and len({g['xAdvance'] for g in measured['glyphs']})>=3 and all(g['xAdvance']>0 for g in measured['glyphs']))
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    page.locator('[data-opt="font.sample"]').fill('Start 시작 スタート');page.wait_for_timeout(200)
    page.locator('[data-action="ui-charset"][data-preset="ko"]').click();page.wait_for_timeout(300)
    korean=page.locator('#rc-chars').input_value()
    page.locator('[data-action="ui-charset"][data-preset="ascii"]').click();page.wait_for_timeout(300)
    ok('a character-set preset collects only what the text uses, and ASCII stays 95 characters',
       korean=='시작' and len(page.locator('#rc-chars').input_value())==95,korean)
    page.locator('[data-action="ui-set"][data-key="font.mode"][data-value="ttf"]').click();page.wait_for_timeout(300)
    if os.path.exists('C:/Windows/Fonts/arial.ttf'):
        page.locator('#fontFile').set_input_files('C:/Windows/Fonts/arial.ttf');page.wait_for_timeout(700)
        page.locator('#rc-chars').fill('AWil j');page.locator('[data-opt="font.size"]').fill('24');page.wait_for_timeout(800)
        z=ui_zip('[data-action="ui-export-font"]')
        ttf=json.loads(z.read('font.json'));sheet_img=ui_image(z,'font.png');widths={g['char']:g['xAdvance'] for g in ttf['glyphs']}
        ok('a font file becomes a real atlas: tight rects and the font\'s own advances',
           len(ttf['glyphs'])==6 and widths['W']>widths['i'] and widths[' ']>0
           and all(sheet_img.crop((g['x'],g['y'],g['x']+g['w'],g['y']+g['h'])).getbbox()==(0,0,g['w'],g['h']) for g in ttf['glyphs'] if g['w']))
        page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
        page.locator('[data-opt="font.sdf"]').check();page.wait_for_timeout(500)
        z=ui_zip('[data-action="ui-export-font"]')
        sdf_meta=json.loads(z.read('font-sdf.json'));sdf_img=ui_image(z,'font-sdf.png');source=ui_image(z,'font.png')
        ink=max((g for g in json.loads(z.read('font.json'))['glyphs'] if g['w']>3),key=lambda g:g['w']*g['h'])
        inside=[(source.getpixel((x,y))[3]>127,sdf_img.getpixel((x,y))[0]) for y in range(ink['y'],ink['y']+ink['h']) for x in range(ink['x'],ink['x']+ink['w'])]
        ok('the SDF texture is beta-labelled and positive exactly where the glyph has ink',
           sdf_meta['beta'] is True and sdf_meta['contour']==128 and 'fwidth' in sdf_meta['shader']
           and sum(1 for o,v in inside if o and v>=128)>=0.9*sum(1 for o,_ in inside if o)
           and sum(1 for o,v in inside if not o and v<=128)>=0.9*sum(1 for o,_ in inside if not o))
        page.locator('[data-opt="font.sdf"]').uncheck();page.wait_for_timeout(200)
    # --- missing glyphs, safe areas, localisation overflow, contrast ---
    page.goto(BASE+'/en/game/missing-glyph-checker/app/',wait_until='networkidle')
    fnt_text=('info face="Test" size=8 bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0\n'
              'common lineHeight=8 base=6 scaleW=64 scaleH=8 pages=1 packed=0\npage id=0 file="font.png"\nchars count=5\n'
              +'\n'.join(f'char id={ord(c)} x=0 y=0 width=4 height=8 xoffset=0 yoffset=0 xadvance=5 page=0 chnl=15' for c in 'Str가')+'\n')
    page.locator('[data-action="ui-set"][data-key="check.source"][data-value="fnt"]').click();page.wait_for_timeout(200)
    page.locator('#fntFile').set_input_files({'name':'ui.fnt','mimeType':'text/plain','buffer':fnt_text.encode()});page.wait_for_timeout(300)
    page.locator('#localeFile').set_input_files({'name':'ko.po','mimeType':'text/plain','buffer':'msgid "start"\nmsgstr "Start 시작"\n\nmsgid "quit"\nmsgstr "끝내기"\n'.encode()})
    page.wait_for_timeout(600)
    rows=page.locator('.ui-table tbody tr')
    missing={rows.nth(i).locator('td').first.inner_text():rows.nth(i).locator('td').nth(2).inner_text() for i in range(rows.count())}
    ok('a .po file is unwrapped and every character the .fnt lacks is listed with a count',
       set(missing)==set('a시작끝내기') and missing['기']=='1' and '가' not in missing,json.dumps(missing,ensure_ascii=False))
    z=ui_zip('[data-action="ui-export-missing"]')
    report=json.loads(z.read('missing-glyphs.json'))
    ok('the missing report names the font it compared against and each codepoint with its lines',
       report['source']=='ui.fnt' and report['fontGlyphs']==4
       and any(m['codepoint']=='U+'+format(ord('끝'),'04X') and m['lines']==[2] for m in report['missing']))
    page.goto(BASE+'/en/game/ui-scale-preview/app/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[ui_png(ui_panel())])
    page.locator('.ui-screen canvas').wait_for(timeout=60000);page.wait_for_timeout(400)
    page.locator('[data-key="check.screen"][data-value="4k"]').click();page.wait_for_timeout(300)
    page.select_option('[data-opt="check.anchor"]','top-left');page.wait_for_timeout(300)
    page.select_option('[data-opt="check.safe"]','title-safe');page.wait_for_timeout(300)
    ok('anchors and the 90% title-safe rectangle are computed for the chosen resolution',
       'at 64, 64' in page.locator('#sizeSummary').inner_text() and '192, 108 · 3456' in page.locator('#sizeSummary').inner_text(),
       page.locator('#sizeSummary').inner_text())
    ok('integer scales are marked crisp and the fractional ones are not',page.locator('.ui-scale.crisp').count()==3 and page.locator('.ui-scale').count()==7)
    page.locator('[data-key="check.tab"][data-value="text"]').click();page.wait_for_timeout(300)
    page.locator('[data-string="en"]').fill('Continue playing this very long label');page.locator('[data-opt="check.boxW"]').fill('120');page.wait_for_timeout(400)
    ok('a string too long for the button is flagged per language while the others fit',
       page.locator('.ui-overflow-row .pill').all_inner_texts()[1]=='overflows' and page.locator('.ui-overflow-row .pill').all_inner_texts()[0]=='fits',
       str(page.locator('.ui-overflow-row .pill').all_inner_texts()))
    page.locator('[data-key="check.tab"][data-value="contrast"]').click();page.wait_for_timeout(300)
    for field,value in [('check.fg','#000000'),('check.bg','#ffffff')]:
        page.locator(f'[data-opt="{field}"]').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',value)
    page.wait_for_timeout(300)
    ok('black on white is exactly 21:1 and passes every reference level',
       page.locator('.ui-contrast-figures strong').inner_text()=='21:1' and page.locator('.ui-contrast-figures .pill.good').count()==3)
    # --- the Lab on phones: every stage, both widths ---
    for width in [390,320]:
        lab=browser.new_context(viewport={'width':width,'height':860},device_scale_factor=2,is_mobile=True,has_touch=True).new_page()
        lab.on('pageerror',lambda e:errors.append(str(e)))
        lab.goto(BASE+'/ko/game/ui-lab/app/',wait_until='networkidle')
        lab.locator('#fileInput').set_input_files(files=[ui_png(ui_panel())])
        lab.locator('#nsCanvas').wait_for(timeout=60000);lab.wait_for_timeout(400)
        for stage in ['slice','states','atlas','font','check']:
            lab.locator(f'[data-action="ui-stage"][data-stage="{stage}"]').click();lab.wait_for_timeout(500)
            ok(f'UI Lab {stage} stage has no horizontal scroll at {width}px',
               lab.evaluate('()=>document.documentElement.scrollWidth<=window.innerWidth+1'),
               str(lab.evaluate('()=>[document.documentElement.scrollWidth,window.innerWidth]')))
        lab.close()
    # === end UI Lab ==========================================================================
    # --- phone ---
    phone=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page();phone.on('pageerror',lambda e:errors.append(str(e)))
    # compress stays last: the sample check below runs on whatever this loop left open.
    for path in ['/ko/','/ko/game/tile-lab/','/ko/game/tile-lab/classic/','/ko/game/autotile-tester/','/ko/image/compress/']:
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
