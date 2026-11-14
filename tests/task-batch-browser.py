"""Pending option edits must never export or hand off the previous result.

CI reuses regression.py's built HTTP server. The controlled component case uses
the actual createBatch UI and an explicitly delayed tool contract to preserve
valid interim downloads without external model dependencies.
"""
import argparse,io,json,os,socket,subprocess,time,urllib.request,zipfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--own-server',action='store_true');parser.add_argument('--base');parser.add_argument('--expected-sha');args=parser.parse_args()
BASE=(args.base or os.environ.get('TEST_URL','http://127.0.0.1:4173')).rstrip('/')
OUT=ROOT/'test-results'/'task-batch'/('production' if args.expected_sha else 'local');OUT.mkdir(parents=True,exist_ok=True)
fixtures=[]
for name,size in [('a',(32,24)),('b',(48,32))]:
    path=OUT/f'authored-{name}.png';im=Image.new('RGBA',size,'#3182ee');im.save(path);im.close();fixtures.append(path)
proc=None;rows=[];errors=[]
if args.own_server:
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    BASE=f'http://127.0.0.1:{port}';log=(OUT/'server.log').open('w')
    proc=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port)},stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
def ready(page):page.wait_for_function('()=>document.querySelector("#taskDownload")&&!document.querySelector("#taskDownload").disabled')
try:
    if proc:
        for _ in range(100):
            try:urllib.request.urlopen(BASE+'/en/',timeout=2).close();break
            except OSError:
                if proc.poll() is not None:raise RuntimeError('Owned source server exited')
                time.sleep(.2)
        else:raise RuntimeError('Owned source server did not start')
    with sync_playwright() as p:
        for engine in ['chromium','firefox']:
            browser=getattr(p,engine).launch();ctx=browser.new_context(accept_downloads=True,viewport={'width':1440,'height':1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
            if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
            def load(path='/en/image/resize/'):
                page.evaluate('()=>window.__batchPreviousDocument=true')
                response=page.goto(BASE+path,wait_until='networkidle')
                # Firefox exposes the CDN's conditional 304 while loading the cached HTML into
                # a fresh document. Require that fresh document and its actual tool input too.
                assert response.status in (200,304),(response.status,page.url)
                assert not page.evaluate('()=>window.__batchPreviousDocument===true')
                expect(page.locator('#fileInput')).to_be_attached()
                page.locator('#fileInput').set_input_files(fixtures[0]);ready(page)
            def download(label,size,fmt=None,selector='#taskDownload'):
                with page.expect_download() as event:page.locator(selector).click()
                path=OUT/f'{engine}-{label}.bin';event.value.save_as(path)
                with Image.open(path) as image:
                    image.load();assert image.size==size,(label,image.size,size)
                    if fmt:assert image.format==fmt,(label,image.format,fmt)
                    actual_format=image.format
                rows.append({'engine':engine,'case':label,'dimensions':list(size),'format':actual_format})
            def mount_controlled(bundle=False):
                page.goto(BASE+'/en/image/resize/',wait_until='networkidle')
                page.evaluate('''async bundle=>{
                  const {createBatch}=await import('/src/task/batch.js');
                  const el=document.createElement('section');el.id='batchHarness';document.querySelector('#taskApp').replaceWith(el);
                  const result=async width=>{const c=document.createElement('canvas');c.width=width;c.height=1;c.getContext('2d').fillRect(0,0,width,1);const blob=await new Promise(r=>c.toBlob(r));return {blob,name:`${width}.png`,sourceWidth:width,sourceHeight:1,note:String(width),...(bundle?{entries:[{blob,name:`first-${width}.png`},{blob,name:`second-${width}.png`}]}:{})};};
                  const h=window.__batchHarness={calls:[]};
                  h.api=createBatch({el,def:{kinds:['image'],next:['convert']}},{options:()=>({width:16}),simple:o=>`<label>Width<input id="hWidth" type="number" value="${o.width}"></label>`,advanced:()=>'',read:form=>({width:Number(form.querySelector('#hWidth').value)}),contents:bundle?it=>it.result?.entries:undefined,process:(file,o,context)=>new Promise(resolve=>{h.calls.push({width:o.width,interim:async()=>context.interim(await result(o.width)),finish:async()=>resolve(await result(o.width))});})});
                  await h.api.add([new File([await (await result(32)).blob],'controlled.png',{type:'image/png'})]);
                }''',bundle)
                page.wait_for_function('()=>window.__batchHarness.calls.length===1')
            for label,selector in [('pending-main','#taskDownload'),('pending-row','[data-action="task-save"]')]:
                load()
                page.evaluate('''()=>document.addEventListener('input',()=>{window.__pendingState={disabled:document.querySelector('#taskDownload').disabled,actions:document.querySelectorAll('[data-action="task-save"],[data-action="task-next"]').length};},{once:true})''')
                page.locator('#resizePercent').fill('25')
                assert page.evaluate('window.__pendingState')=={'disabled':True,'actions':0}
                download(label,(8,6),'PNG',selector)
            load('/en/image/compress/?format=png');page.locator('#compressFormat').select_option('jpeg')
            download('pending-format',(32,24),'JPEG')
            load();page.locator('#resizePercent').fill('25')
            page.locator('[data-action="task-next"][data-tool="convert"]').click();page.wait_for_url('**/en/image/convert/');ready(page)
            download('pending-handoff',(8,6))
            load();page.evaluate('()=>window.__sameDocument="batch-locale"')
            page.locator('#resizePercent').fill('25');page.locator('#languageSelect').select_option('ko');ready(page)
            assert page.evaluate('window.__sameDocument')=='batch-locale'
            assert page.locator('#resizePercent').input_value()=='25'
            download('pending-locale',(8,6),'PNG')
            load();page.locator('#resizePercent').fill('25');page.locator('[data-action="task-clear"]').click()
            page.locator('#fileInput').set_input_files(fixtures[0]);ready(page)
            download('pending-clear-reimport',(8,6),'PNG')
            load();previous=page.locator('#cmpAfter').get_attribute('src')
            page.evaluate('''()=>{const e=document.querySelector('#resizePercent');for(const value of ['25','50']){e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}}''');ready(page)
            assert page.locator('#cmpAfter').get_attribute('src')==previous,'reverted edits should reuse the still-current result'
            page.locator('#cmpCut').focus();page.keyboard.press('ArrowRight')
            expect(page.locator('#taskDownload')).to_be_enabled()
            assert page.locator('#cmpAfter').get_attribute('src')==previous
            download('reverted-edit-and-compare',(16,12),'PNG')
            load();page.locator('#resizePercent').fill('25');page.locator('#fileInput').set_input_files(fixtures[1]);ready(page)
            with page.expect_download() as event:page.locator('#taskDownload').click()
            path=OUT/f'{engine}-pending-add.zip';event.value.save_as(path)
            with zipfile.ZipFile(path) as archive:
                dimensions=[]
                for name in archive.namelist():
                    with Image.open(io.BytesIO(archive.read(name))) as im:im.load();dimensions.append(im.size)
                assert sorted(dimensions)==[(8,6),(12,8)],dimensions
            rows.append({'engine':engine,'case':'pending-add','dimensions':[list(s) for s in sorted(dimensions)]})
            load();page.locator('#fileInput').set_input_files(fixtures[1]);ready(page)
            page.locator('#resizePercent').fill('25');page.locator('[data-action="task-remove"]').first.click();ready(page)
            download('pending-remove',(12,8),'PNG')
            # A deterministic slow tool exercises valid interim results and a late completion.
            mount_controlled()
            page.evaluate('()=>window.__batchHarness.calls[0].interim()');ready(page)
            download('valid-interim',(16,1),'PNG')
            state=page.evaluate('''async()=>{const h=window.__batchHarness,input=document.querySelector('#hWidth');input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}));await h.calls[0].interim();await h.calls[0].finish();await new Promise(r=>setTimeout(r,0));return {disabled:document.querySelector('#taskDownload').disabled,actions:document.querySelectorAll('[data-action="task-save"],[data-action="task-next"]').length};}''')
            assert state=={'disabled':True,'actions':0},state
            page.wait_for_function('()=>window.__batchHarness.calls.length===2')
            assert page.evaluate('window.__batchHarness.calls[1].width')==8
            page.evaluate('()=>window.__batchHarness.calls[1].interim()');ready(page)
            download('current-interim',(8,1),'PNG')
            page.locator('[data-action="task-next"][data-tool="convert"]').click();page.wait_for_url('**/en/image/convert/');ready(page)
            download('interim-handoff',(8,1))
            mount_controlled(bundle=True)
            page.evaluate('()=>window.__batchHarness.calls[0].finish()');ready(page)
            assert page.locator('[data-action="task-content"]').count()==2
            page.evaluate('''()=>{const e=document.querySelector('#hWidth');e.value='8';e.dispatchEvent(new Event('input',{bubbles:true}));window.__bundlePending={disabled:document.querySelector('#taskDownload').disabled,contents:document.querySelectorAll('[data-action="task-content"]').length};}''')
            assert page.evaluate('window.__bundlePending')=={'disabled':True,'contents':0}
            page.wait_for_function('()=>window.__batchHarness.calls.length===2')
            page.evaluate('()=>window.__batchHarness.calls[1].finish()');ready(page)
            download('bundle-content-after-edit',(8,1),'PNG','[data-action="task-content"][data-entry="0"]')
            if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
            ctx.close();browser.close()
    assert not errors,errors
    (OUT/'results.json').write_text(json.dumps({'expectedLiveCommit':args.expected_sha,'cases':rows,'pageErrors':errors,'scope':'Real UI input/download/handoff over generated PNG files, plus the actual batch component with a controlled slow tool. Not external model quality or physical-device testing.'},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Batch readiness passed: {len(rows)} cases in Chromium and Firefox; pending edits, formats, handoff, locale, clear/add, reverted edits and valid interim results.')
finally:
    if proc:
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:proc.kill();proc.wait()
        log.close()
