"""Resize dimensions/format regression over real downloaded files in two browser engines.

CI reuses regression.py's built-site server. --own-server uses an isolated source
preview; --base/--expected-sha permit read-only verification of a frozen release.
"""
import argparse,json,os,socket,subprocess,time,urllib.request
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--own-server',action='store_true');parser.add_argument('--base');parser.add_argument('--expected-sha');args=parser.parse_args()
BASE=(args.base or os.environ.get('TEST_URL','http://127.0.0.1:4173')).rstrip('/')
OUT=ROOT/'test-results'/'task-resize'/('production' if args.expected_sha else 'local');OUT.mkdir(parents=True,exist_ok=True)
fixture=OUT/'authored-32x24.png';image=Image.new('RGBA',(32,24));image.putdata([((x*17)%256,(y*23)%256,(x*7+y*13)%256,255) for y in range(24) for x in range(32)]);image.save(fixture);image.close()
proc=None;rows=[];copy_rows=[];warnings=[];errors=[]
if args.own_server:
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    BASE=f'http://127.0.0.1:{port}';log=(OUT/'server.log').open('w')
    proc=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port)},stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
def ready(page):page.wait_for_function('()=>document.querySelector("#taskDownload")&&!document.querySelector("#taskDownload").disabled')
def changed(page,before):page.wait_for_function('old=>document.querySelector("#cmpAfter").src!==old',arg=before);ready(page)
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
            def load(path):
                assert page.goto(BASE+path,wait_until='networkidle').status==200
                page.locator('#fileInput').set_input_files(fixture);ready(page)
            def save(label,size,fmt='PNG',capped=None):
                ready(page)
                with page.expect_download() as event:page.locator('#taskDownload').click()
                suffix={'PNG':'png','JPEG':'jpg','WEBP':'webp'}[fmt];path=OUT/f'{engine}-{label}.{suffix}';event.value.save_as(path)
                with Image.open(path) as result:
                    result.load();assert result.size==size,(engine,label,result.size,size);assert result.format==fmt
                note=page.locator('#viewerNote').inner_text()
                if capped is not None:assert ('enlargement limit capped' in note)==capped,(label,note)
                rows.append({'engine':engine,'case':label,'size':list(size),'format':fmt,'neverEnlarge':page.locator('#resizeNoEnlarge').is_checked(),'note':note})
            for mode in ['contain','cover','stretch']:
                for allow in [False,True]:
                    for requested,capped in [((128,96),(32,24)),((128,128),(24,24))]:
                        load(f'/en/image/resize/?w={requested[0]}&h={requested[1]}&fit={mode}&enlarge={int(allow)}')
                        assert page.locator('#resizeNoEnlarge').is_checked()==(not allow)
                        save(f'{mode}-{requested[0]}x{requested[1]}-allow{int(allow)}',requested if allow else capped,capped=not allow)
            for query,expected in [('w=128&enlarge=0',(32,24)),('w=128&enlarge=1',(128,96)),('percent=400&enlarge=0',(32,24)),('percent=400&enlarge=1',(128,96))]:
                load('/en/image/resize/?'+query);save(query.replace('&','-').replace('=',''),expected,capped=query.endswith('=0'))
            load('/en/image/resize/?w=16&h=12');save('reduction',(16,12),capped=False)
            load('/en/image/resize/youtube-thumbnail/');assert not page.locator('#resizeNoEnlarge').is_checked();save('fixed-preset',(1280,720),capped=False)
            load('/en/image/resize/youtube-thumbnail/?enlarge=0');assert page.locator('#resizeNoEnlarge').is_checked();save('fixed-preset-capped',(32,18),capped=True)
            load('/en/image/resize/');page.locator('#optionsAdvanced summary').click()
            previous=page.locator('#cmpAfter').get_attribute('src');page.locator('#resizePreset').select_option('1280x720');changed(page,previous)
            assert not page.locator('#resizeNoEnlarge').is_checked();save('selected-preset',(1280,720),capped=False)
            previous=page.locator('#cmpAfter').get_attribute('src');page.locator('#resizeNoEnlarge').check();changed(page,previous);save('selected-preset-capped',(32,18),capped=True)
            for value,fmt in [('jpeg','JPEG'),('webp','WEBP')]:
                previous=page.locator('#cmpAfter').get_attribute('src');page.locator('#resizeFormat').select_option(value);changed(page,previous);save('capped-'+value,(32,18),fmt,capped=True)
            for locale in ['ko','en','ja']:
                for width in [1440,390]:
                    page.set_viewport_size({'width':width,'height':1000});page.goto(BASE+f'/{locale}/image/resize/',wait_until='networkidle')
                    reading=page.locator('.reading-content').inner_text();assert '→ PNG / JPG / WebP' in reading
                    steps=page.locator('.reading-content ol').inner_text();assert '50%' in steps
                    assert ('픽셀 크기' in steps if locale=='ko' else 'ピクセル' in steps if locale=='ja' else 'pixel dimensions' in steps)
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    copy_rows.append({'engine':engine,'locale':locale,'width':width,'steps':steps})
                    if width==390:
                        for img in page.locator('.tool-examples img').all():
                            img.scroll_into_view_if_needed();page.wait_for_function('(e)=>e.complete&&e.naturalWidth>0',arg=img.element_handle());img.evaluate('(e)=>e.decode()')
                        page.locator('.reading-content ol').scroll_into_view_if_needed();page.screenshot(path=str(OUT/f'{engine}-{locale}-390.png'))
                load(f'/{locale}/image/resize/?w=128&h=96&enlarge=0')
                note=page.locator('#viewerNote').inner_text();assert {'ko':'확대 제한','en':'enlargement limit','ja':'拡大制限'}[locale] in note
                warnings.append({'engine':engine,'locale':locale,'note':note});page.screenshot(path=str(OUT/f'{engine}-{locale}-capped.png'))
            if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
            ctx.close();browser.close()
    assert not errors,errors
    (OUT/'results.json').write_text(json.dumps({'expectedLiveCommit':args.expected_sha,'downloads':rows,'copyObservations':copy_rows,'localizedWarnings':warnings,'pageErrors':errors,'scope':'Authored geometry, independent Pillow dimensions/formats, real control states and localized guides. Existing preset numbers are tested configuration, not verification of current third-party platform requirements.'},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Resize passed: {len(rows)} independently decoded downloads; {len(copy_rows)} locale/viewport observations; Chromium and Firefox.')
finally:
    if proc:
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:proc.kill();proc.wait()
        log.close()
