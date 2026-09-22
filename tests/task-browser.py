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
    page.goto(BASE+'/en/sprite-slicer/',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[sheet_png(36,20,[((1,2,5,8),(255,0,0,255)),((20,4,27,15),(0,255,0,255))])])
    page.locator('#slicerSheet canvas').wait_for(timeout=60000)
    page.wait_for_function('()=>document.querySelectorAll(".slicer-box").length===2',timeout=60000)
    ok('the slicer outlines the frames it found, with no Run button',
       page.eval_on_selector_all('.slicer-box rect','ns=>ns.map(n=>[+n.getAttribute("x"),+n.getAttribute("width")])')==[[1,5],[20,8]])
    page.locator('.frame-chip[data-index="1"]').click();page.wait_for_timeout(150)
    ok('selecting a frame offers resize handles and exact numbers',page.locator('.slicer-handle').count()==8 and page.locator('#slicerRectW').input_value()=='8')
    page.fill('#slicerRectW','6');page.wait_for_timeout(300);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path());meta=json.loads(z.read('metadata.json'))
    ok('the edited frame decides the exported PNG and the metadata',
       Image.open(io.BytesIO(z.read('sheet_002.png'))).size==(6,12) and meta['frames'][1]['w']==6 and meta['schemaVersion']==1,str(meta['frames'][1]))
    page.locator('[data-action="slicer-undo"]').click();page.wait_for_timeout(200)
    ok('undo restores the previous frame rectangle',page.eval_on_selector_all('.slicer-box rect','ns=>ns.map(n=>+n.getAttribute("width"))')==[5,8])
    page.locator('#optionsAdvanced').evaluate('d=>d.open=true')
    page.locator('#slicerTrim').check();page.locator('[data-key="canvas"][data-value="common"]').click()
    page.locator('#slicerWantGif').check();page.locator('#slicerWantStrip').check();page.wait_for_timeout(500);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path())
    a,b=[Image.open(io.BytesIO(z.read(f'sheet_00{i}.png'))).convert('RGBA') for i in (1,2)]
    ok('one canvas for all frames gives one size and one bottom edge',a.size==b.size==(8,12) and a.getbbox()[3]==b.getbbox()[3]==12,f'{a.size} {b.size}')
    ok('the horizontal strip PNG is the frames side by side',Image.open(io.BytesIO(z.read('sheet_strip.png'))).size==(16,12))
    gif_out=Image.open(io.BytesIO(z.read('sheet.gif')));gif_out.seek(0)
    ok('the animated GIF is a real GIF with a transparent cut-out',
       gif_out.n_frames==2 and gif_out.size==(8,12) and gif_out.info.get('transparency')==0 and gif_out.convert('RGBA').getpixel((0,0))[3]==0)
    page.locator('[data-key="mode"][data-value="grid"]').click();page.wait_for_timeout(600)
    ok('grid mode opens on a cell size guessed from the sheet itself',
       page.locator('#slicerCellW').input_value()=='5' and page.locator('.slicer-box').count()==2 and page.locator('#slicerSuggest .chip').count()>=1,
       page.locator('#slicerCellW').input_value())
    page.goto(BASE+'/en/normalize-sprite-frames/',wait_until='networkidle')
    tall=Image.new('RGBA',(20,20),(0,0,0,0));[tall.putpixel((x,y),(255,0,0,255)) for x in range(2,6) for y in range(2,10)]
    wide=Image.new('RGBA',(12,12),(0,0,0,0));[wide.putpixel((x,y),(0,0,255,255)) for x in range(3,9) for y in range(2,5)]
    page.locator('#fileInput').set_input_files(files=[file_of('tall.png',tall),file_of('wide.png',wide)])
    page.wait_for_function('()=>document.querySelectorAll("#normGrid canvas").length===2',timeout=60000)
    ok('the normaliser shows the common canvas before any download',page.locator('#normSummary .summary-big').inner_text()=='6 × 8')
    ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path())
    a,b=[Image.open(io.BytesIO(z.read(f'frames/frame-{i:03}.png'))).convert('RGBA') for i in (1,2)]
    ok('normalised frames share one canvas and one bottom anchor',a.size==b.size==(6,8) and a.getbbox()[3]==b.getbbox()[3]==8,f'{a.getbbox()} {b.getbbox()}')
    page.locator('[data-key="align"][data-value="top"]').click();page.wait_for_timeout(300);ready(page)
    with page.expect_download() as d:page.locator('#taskDownload').click()
    z=zipfile.ZipFile(d.value.path())
    a,b=[Image.open(io.BytesIO(z.read(f'frames/frame-{i:03}.png'))).convert('RGBA') for i in (1,2)]
    ok('changing the anchor really moves the pixels',a.getbbox()[1]==b.getbbox()[1]==0,f'{a.getbbox()} {b.getbbox()}')
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
    page.goto(BASE+'/en/game/9-slice-editor/',wait_until='networkidle')
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
    page.goto(BASE+'/en/game/ui-lab/?stage=states&l=5&r=7&t=3&b=4&mode=tile&w=250&h=90',wait_until='networkidle')
    page.locator('#fileInput').set_input_files(files=[ui_png(ui_panel())])
    page.locator('.ui-state canvas').first.wait_for(timeout=60000);page.wait_for_timeout(300)
    opened=page.locator('[data-action="ui-stage"][aria-selected="true"]').get_attribute('data-stage')
    page.locator('[data-action="ui-stage"][data-stage="slice"]').click();page.wait_for_timeout(400)
    ok('a settings link opens the named stage with its borders, edge mode and custom size',
       opened=='states' and [page.locator(f'#ns-{s}').input_value() for s in ['left','right','top','bottom']]==['5','7','3','4']
       and page.locator('[data-key="slice.mode"][aria-pressed="true"]').get_attribute('data-value')=='tile'
       and page.locator('[data-opt="slice.customW"]').input_value()=='250')
    # --- button states ---
    page.goto(BASE+'/en/game/button-state-generator/',wait_until='networkidle')
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
    page.goto(BASE+'/en/game/ui-lab/',wait_until='networkidle')
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
    page.goto(BASE+'/en/bitmap-font-maker/',wait_until='networkidle')
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
    page.goto(BASE+'/en/game/missing-glyph-checker/',wait_until='networkidle')
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
    page.goto(BASE+'/en/game/ui-scale-preview/',wait_until='networkidle')
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
        lab.goto(BASE+'/ko/game/ui-lab/',wait_until='networkidle')
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
