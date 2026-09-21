"""Raised-limit check: 1024 detected sprites, 4096 tiles over 128 MiB, a 300-input sheet and an OPFS-streamed
GIF, each reopened independently with zipfile / Pillow. Usage: python tools/limits.py [chromium|firefox|webkit]"""
import base64,io,json,os,re,subprocess,sys,time,urllib.request,zipfile
from pathlib import Path
import psutil
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'test-results'/'quality';out.mkdir(parents=True,exist_ok=True)
engine=sys.argv[1] if len(sys.argv)>1 else 'chromium';port=os.environ.get('LIMITS_PORT','4295')
video=out/'signal-1080p.mp4'
if not video.exists():subprocess.run([sys.executable,'tools/generate-media.py'],cwd=root,check=True)
server=subprocess.Popen(['node','tools/serve.mjs'],cwd=root,env={**os.environ,'PORT':port},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
peak=0
def rss():
 total=0
 for p in psutil.Process().children(recursive=True):
  try:
   if any(k in p.name().lower() for k in ['chrome','firefox','webkit','minibrowser']):total+=p.memory_info().rss
  except psutil.Error:pass
 return total
try:
 for _ in range(100):
  try:urllib.request.urlopen(f'http://127.0.0.1:{port}/en/',timeout=1);break
  except OSError:time.sleep(.1)
 with sync_playwright() as pw:
  browser=getattr(pw,engine).launch(headless=True);page=browser.new_page();page.set_default_timeout(900000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{port}/en/')
  page.evaluate("()=>{const el=document.createElement('input');el.id='fixture';el.type='file';document.body.append(el)}");page.locator('#fixture').set_input_files(str(video))
  started=time.perf_counter()
  result=page.evaluate("async()=>{window.L=await import('/tests/limits-browser.mjs');return L.run({video:document.querySelector('#fixture').files[0]})}")
  peak=rss()
  def fetch(key,size):
   buf=bytearray()
   for offset in range(0,size,16*1024**2):buf+=base64.b64decode(page.evaluate('([k,o,s])=>L.chunk(k,o,s)',[key,offset,16*1024**2]))
   page.evaluate('k=>L.drop(k)',key);return bytes(buf)
  verified=[]
  for row in result['rows']:
   if 'key' not in row:verified.append(row['case']);continue
   data=fetch(row['key'],row['bytes'])
   if row['key']=='gif':
    im=Image.open(io.BytesIO(data));frames=getattr(im,'n_frames',1);assert frames==90 and im.size[0]==480,(frames,im.size);verified.append(f'Pillow decodes GIF: {frames} frames, {im.size[0]}x{im.size[1]}');continue
   z=zipfile.ZipFile(io.BytesIO(data));assert z.testzip() is None;names=[n for n in z.namelist() if n.startswith('frames/') or n.endswith('.png')]
   if row['key']=='slicer':
    assert len(names)==1024 and names==sorted(names) and names[-1]=='frames/frame-1024.png',names[-3:]
    sizes={Image.open(z.open(n)).size for n in names[::97]};verified.append(f'zipfile: 1024 sorted frames, CRCs valid, sample sizes {sorted(sizes)[:3]}')
   elif row['key']=='tiles':
    assert len(names)==4096 and names[-1]=='frames/frame-4096.png';assert {Image.open(z.open(n)).size for n in names[::511]}=={(128,128)}
    meta=json.loads(z.read('metadata.json'));assert len(meta['frames'])==4096;verified.append(f'zipfile: 4096 tiles of 128x128 in {len(data)/1024**2:.0f} MiB archive, CRCs valid')
   elif row['key']=='sheet':
    meta=json.loads(z.read('metadata.json'));sheet=Image.open(z.open('sprite-sheet.png'));assert len(meta['frames'])==300 and sheet.size==(meta['width'],meta['height']),(len(meta['frames']),sheet.size)
    verified.append(f'zipfile: 300-frame sheet {sheet.size[0]}x{sheet.size[1]} matches metadata')
  # UI: 40 images in one workspace (old cap 24), each opened for a thumbnail and released.
  tmp=out/'limits-inputs';tmp.mkdir(exist_ok=True);files=[]
  for i in range(40):
   f=tmp/f'in-{i:02d}.png';Image.new('RGBA',(64,48),(i*6,120,200,255)).save(f);files.append(str(f))
  ui=browser.new_page();ui.set_default_timeout(120000);ui.goto(f'http://127.0.0.1:{port}/en/image/resize/')
  ui.locator('#fileInput').set_input_files(files);ui.locator('#workspace[aria-busy="false"]').wait_for()
  thumbs=ui.locator('.thumb').count();assert thumbs==40,(thumbs,ui.locator('#message').inner_text());verified.append(f'UI accepted {thumbs} images in one workspace');ui.close()
  report={'engine':engine,'browser':browser.version,'checks':result['checks'],'independent':verified,'rows':[{k:v for k,v in r.items() if k!='key'} for r in result['rows']],'elapsedS':round(time.perf_counter()-started,1),'browserRSSAfter':peak,'errors':errors}
  browser.close()
 (out/f'{engine}-limits.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=1))
 assert not errors,errors
finally:
 server.terminate()
