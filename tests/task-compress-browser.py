"""Original preservation must disclose retained metadata, including equal-width requests.

The fixture has only an authored checkerboard and a synthetic PNG text marker.
Downloads are decoded independently; no user file or real location is involved.
"""
import argparse,hashlib,json,os,socket,subprocess,time,urllib.request
from pathlib import Path
from PIL import Image,PngImagePlugin
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--own-server',action='store_true');parser.add_argument('--base');parser.add_argument('--expected-sha');parser.add_argument('--output');args=parser.parse_args()
BASE=(args.base or os.environ.get('TEST_URL','http://127.0.0.1:4173')).rstrip('/')
OUT=ROOT/'test-results'/(args.output or 'task-compress');OUT.mkdir(parents=True,exist_ok=True)
fixture=OUT/'synthetic-marker.png';image=Image.new('1',(512,512));image.putdata([(x//16+y//16)%2 for y in range(512) for x in range(512)])
info=PngImagePlugin.PngInfo();info.add_text('Location','TEST_ONLY_NOT_REAL_LOCATION');image.save(fixture,pnginfo=info,optimize=True);image.close()
original=fixture.read_bytes();proc=None;log=None;rows=[];errors=[];code=[]
if args.own_server:
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 BASE=f'http://127.0.0.1:{port}';log=(OUT/'server.log').open('w')
 proc=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port)},stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
try:
 if proc:
  for _ in range(100):
   try:urllib.request.urlopen(BASE+'/en/',timeout=2).close();break
   except OSError:
    if proc.poll() is not None:raise RuntimeError('Owned source server exited')
    time.sleep(.2)
  else:raise RuntimeError('Owned source server did not start')
 with sync_playwright() as pw:
  for engine in ['chromium','firefox']:
   browser=getattr(pw,engine).launch();ctx=browser.new_context(accept_downloads=True);page=ctx.new_page();page.set_default_timeout(45000);page.on('pageerror',lambda error:errors.append(str(error)))
   try:
    if args.expected_sha:
     assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
     for source in ['src/task/compress.js','src/task/convert.js','src/task/strings.js','src/compression.js']:
      response=ctx.request.get(BASE+'/'+source);assert response.ok
      expected=subprocess.check_output(['git','show',args.expected_sha+':'+source],cwd=ROOT).replace(b'\r\n',b'\n');assert response.body().replace(b'\r\n',b'\n')==expected
      code.append({'engine':engine,'path':source,'sha256Utf8LF':hashlib.sha256(expected).hexdigest()})
    for locale,metadata_word in [('ko','메타데이터'),('en','metadata'),('ja','メタデータ')]:
     page.set_viewport_size({'width':1440 if locale=='en' else 390,'height':1000})
     for name,path,size,retained in [('no-width','compress/?format=png',(512,512),True),('same-width','compress/?format=png&w=512',(512,512),True),('smaller-width','compress/?format=png&w=256',(256,256),False),('convert-control','convert/?format=png',(512,512),False)]:
      response=page.goto(f'{BASE}/{locale}/image/{path}',wait_until='load');assert response.status in (200,304)
      page.locator('#fileInput').set_input_files(fixture);expect(page.locator('#taskDownload')).to_be_enabled()
      note=page.locator('#viewerNote').inner_text();hints=page.locator('form .hint').all_text_contents()
      assert any(metadata_word in hint for hint in hints),(locale,name,hints)
      if retained:assert metadata_word in note,(locale,name,note)
      with page.expect_download() as event:page.locator('#taskDownload').click()
      download=event.value;dest=OUT/f'{engine}-{locale}-{name}.png';download.save_as(dest);data=dest.read_bytes()
      assert (data==original)==retained,(engine,locale,name)
      if retained:assert download.suggested_filename==fixture.name
      with Image.open(dest) as result:
       result.load();assert result.format=='PNG' and result.size==size
       marker=result.info.get('Location');assert (marker=='TEST_ONLY_NOT_REAL_LOCATION')==retained
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(engine,locale,name,'overflow')
      rows.append({'engine':engine,'browserVersion':browser.version,'locale':locale,'case':name,'dimensions':list(size),'byteIdenticalToInput':data==original,'syntheticMarkerRetained':marker is not None,'filename':download.suggested_filename,'note':note,'hints':hints,'sha256':hashlib.sha256(data).hexdigest()})
      print('PASS',engine,locale,name,flush=True)
    if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
   finally:ctx.close();browser.close()
 assert not errors,errors
 (OUT/'results.json').write_text(json.dumps({'source':args.expected_sha,'observations':rows,'code':code,'pageErrors':errors,'scope':'24 native UI downloads; synthetic PNG text marker only. Not a comprehensive EXIF/GPS or all-format metadata study.'},ensure_ascii=False,indent=2),encoding='utf-8')
 print('PASS original-preservation disclosure:',len(rows),'native downloads',flush=True)
finally:
 if proc:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=5)
 if log:log.close()
