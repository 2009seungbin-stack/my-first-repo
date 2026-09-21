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
