"""Pending PDF rebuilds must not accept settings or offer an obsolete download.

Clear/save gates delay the real operations without replacing their results. These
are timing-stress checks, followed by native PDF downloads and independent renders.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
from pypdf import PdfReader
import json, math, os, subprocess, time

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = ROOT / 'test-results' / os.environ.get('PDF_PAPER_REPORT', 'pdf-paper-settings-browser')
OUT.mkdir(parents=True, exist_ok=True)
SHA = os.environ.get('EXPECTED_BUILD_SHA')
module_path = 'src/task/pdf-organize.js'
module = (subprocess.check_output(['git', 'show', SHA + ':' + module_path], cwd=ROOT) if SHA
          else (ROOT / module_path).read_bytes()).replace(b'\r\n', b'\n')
fixture = OUT / 'authored-square.png'
Image.new('RGB', (96, 96), (210, 30, 70)).save(fixture)
rows, gates, errors = [], [], []

def guard(ctx):
    if SHA:
        assert ctx.request.get(BASE + '/build.txt').text().strip() == SHA
    response = ctx.request.get(BASE + '/' + module_path)
    assert response.status == 200 and response.body().replace(b'\r\n', b'\n') == module

def held(page, key):
    for _ in range(300):
        if page.evaluate('(key)=>window[key] === true', key):
            return
        time.sleep(.01)
    raise AssertionError('Native operation did not reach timing gate: ' + key)

def locked(page):
    assert page.locator('#pdfRun').is_disabled()
    assert page.locator('#pdfOptions button,#pdfOptions input').evaluate_all('(controls)=>controls.length>0&&controls.every(c=>c.disabled)')
    assert page.locator('#pdfResult').is_hidden()

def output(page, engine, label, size, margin):
    with page.expect_download() as event:
        page.locator('#pdfRun:not([disabled])').click()
    path = OUT / f'{engine}-{label}.pdf'
    event.value.save_as(path)
    doc = PdfReader(path)
    assert len(doc.pages) == 1
    actual = [float(doc.pages[0].mediabox.width), float(doc.pages[0].mediabox.height)]
    assert max(abs(a-b) for a,b in zip(actual, size)) < .01, (label, actual)
    prefix = OUT / f'{engine}-{label}-render'
    subprocess.run(['pdftoppm', '-f', '1', '-singlefile', '-r', '72', '-png',
                    str(path), str(prefix)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    with Image.open(Path(str(prefix)+'.png')) as rendered:
        image = rendered.convert('RGB')
        assert image.size == tuple(math.ceil(v) for v in size)
        bbox = ImageChops.difference(image, Image.new('RGB', image.size, 'white')).getbbox()
        side = min(size[0]-margin*2, size[1]-margin*2)
        expected = [(size[0]-side)/2, (size[1]-side)/2, (size[0]+side)/2, (size[1]+side)/2]
        assert bbox and max(abs(a-b) for a,b in zip(bbox, expected)) <= 1.5, (label, bbox, expected)
        center = image.getpixel((image.width//2, image.height//2))
        assert max(abs(a-b) for a,b in zip(center, (210,30,70))) <= 3
    rows.append({'engine':engine,'case':label,'pagePoints':actual,'marginPoints':margin,'inkBounds':bbox})

with sync_playwright() as pw:
    for engine in ['chromium','firefox']:
        browser = getattr(pw,engine).launch()
        try:
            ctx = browser.new_context(accept_downloads=True)
            page = ctx.new_page()
            page.set_default_timeout(30000)
            page.on('pageerror',lambda error:errors.append(str(error)))
            guard(ctx)
            page.goto(BASE+'/en/jpg-to-pdf/',wait_until='load')
            page.locator('html[data-task-ready="1"]').wait_for()
            with page.expect_file_chooser() as event:
                page.locator('.dropzone button[data-action="pick"]').click()
            event.value.set_files(str(fixture))
            ready = page.locator('#pdfRun:not([disabled])')
            ready.wait_for()
            output(page,engine,'default-a4',[595.28,841.89],24)
            assert page.locator('#pdfResult').is_visible()
            page.evaluate('''async()=>{
                const {PDFWorkspace}=await import('/src/pdf.js');
                const {PDFDocument}=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');
                const clear=PDFWorkspace.prototype.clear,save=PDFDocument.prototype.save;
                PDFWorkspace.prototype.clear=async function(...args){
                    if(window.__holdClear){window.__holdClear=false;window.__clearHeld=true;await new Promise(r=>window.__releaseClear=r);}
                    return clear.apply(this,args);
                };
                PDFDocument.prototype.save=async function(...args){
                    const bytes=await save.apply(this,args);
                    if(window.__holdSave){window.__holdSave=false;window.__saveHeld=true;await new Promise(r=>window.__releaseSave=r);}
                    return bytes;
                };
                window.__holdClear=true;
            }''')
            page.locator('[data-action="pdf-pagesize"][data-size="fit"]').click()
            held(page,'__clearHeld');locked(page)
            gates.append({'engine':engine,'gate':'before native reader clear','oldDownloadHidden':True,'settingsLocked':True})
            page.evaluate('window.__releaseClear()');ready.wait_for()
            page.evaluate('window.__holdSave=true')
            page.locator('[data-action="pdf-margin"][data-margin="0"]').click()
            held(page,'__saveHeld');locked(page)
            assert page.locator('[data-action="pdf-margin"][data-margin="0"]').get_attribute('aria-pressed')=='true'
            gates.append({'engine':engine,'gate':'native PDF bytes ready before load completes','settingsLocked':True})
            page.evaluate('window.__releaseSave()');ready.wait_for()
            output(page,engine,'fit-zero-margin',[72,72],0)
            page.locator('[data-action="pdf-pagesize"][data-size="letter"]').click();ready.wait_for()
            page.locator('[data-action="pdf-margin"][data-margin="48"]').click();ready.wait_for()
            output(page,engine,'letter-wide-margin',[612,792],48)
            assert page.locator('[data-action="pdf-pagesize"][data-size="letter"]').get_attribute('aria-pressed')=='true'
            assert page.locator('[data-action="pdf-margin"][data-margin="48"]').get_attribute('aria-pressed')=='true'
            guard(ctx)
        finally:
            browser.close()
assert not errors,errors
(OUT/'results.json').write_text(json.dumps({'build':SHA,'base':BASE,'timingScope':'Controlled clear/save completion delays, not natural latency measurements. Native operations and PDF bytes are not replaced.','gates':gates,'downloads':rows,'pageErrors':errors},indent=2),encoding='utf-8')
print('PDF PAPER SETTINGS PASSED',len(rows),'native downloads;',len(gates),'timing gates; page sizes and ink bounds')
