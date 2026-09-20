"""Real DOM/Canvas/Worker tests. --in-memory adapts module URLs/navigation only.
The restricted execution environment blocks HTTP browsing. This mode does not
verify deployed URLs, CDN libraries, or response CSP. Pure algorithms are also
covered separately by `npm test`. Requires Python Playwright and Chromium.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import argparse, re, json, zipfile, io, shutil, subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--in-memory',action='store_true');args=p.parse_args()
checks=[];errors=[]
def ok(name,condition=True):
 if not condition:
  print("FAIL STATE",globals().get("page").locator("#message").text_content(),globals().get("page").locator("#stageBadge").text_content(),errors,flush=True)
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
def mount(page,route='/'):
 if not args.in_memory:
  page.goto('http://127.0.0.1:4173'+route,wait_until='networkidle');return
 html=(ROOT/'index.html').read_text();html=re.sub(r'<script[^>]*>.*?</script>','',html);html=re.sub(r'<link[^>]*>','',html);html=html.replace('<base href="./">','')
 page.set_content(html);page.add_style_tag(content=(ROOT/'styles.css').read_text())
 sources={n:(ROOT/'src'/f'{n}.js').read_text() for n in ['core','worker','audio-worker','image','pdf','media','ui','app']}
 page.evaluate('''async ({sources,route})=>{
 window.__testURL='https://fileforge.test'+route;
 window.__history={pushState:(s,t,u)=>window.__testURL=new URL(u,window.__testURL).href};
 const urls={};
 for(const[name,original]of Object.entries(sources)){
  let src=original;
  if(name==='app')src=src.replace("new URL('../',import.meta.url)","new URL('https://fileforge.test/')").replaceAll('location.pathname','new URL(window.__testURL).pathname').replaceAll('location.search','new URL(window.__testURL).search').replaceAll('history.pushState','window.__history.pushState');
  for(const[dep,url]of Object.entries(urls)){
   src=src.replaceAll("new URL('./"+dep+".js',import.meta.url)",JSON.stringify(url));
   src=src.replaceAll("'./"+dep+".js'",JSON.stringify(url));
  }
  urls[name]=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
 }
 window.__testModules=urls;await import(urls.app);
}''',{'sources':sources,'route':route})
 page.wait_for_function("document.querySelector('#navigation').children.length>0")
def idle(page):page.wait_for_function("document.querySelector('#workspace').getAttribute('aria-busy')==='false'",timeout=30000)
def click(page,action,scope=''):
 page.locator(f'{scope} [data-action="{action}"]'.strip()).first.click()
 page.wait_for_timeout(80);idle(page)
def picture(w=80,h=60):
 im=Image.new('RGBA',(w,h),'white')
 for x in range(w//4,w*3//4):
  for y in range(h//4,h*3//4):im.putpixel((x,y),(255,90,90,255))
 b=io.BytesIO();im.save(b,format='PNG');return b.getvalue()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=b.new_context(viewport={'width':1440,'height':960},accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 mount(page);ok('home four editors',page.locator('#navigation [data-action^="editor:"]').count()==4)
 ok('home has no open properties',page.locator('#panel').is_hidden())
 page.screenshot(path=str(OUT/'home.png'))
 click(page,'sample');ok('sample decoded in Canvas',page.locator('#canvasWrap').is_visible())
 ok('image dimensions', '720 × 560' in page.locator('#stageBadge').inner_text())
 page.screenshot(path=str(OUT/'image.png'))
 click(page,'tool:resize');page.locator('#resizeW').fill('360');page.locator('#resizeW').dispatch_event('input');ok('aspect link updates height',page.locator('#resizeH').input_value()=='280')
 click(page,'image:resize');ok('resize output','360 × 280' in page.locator('#stageBadge').inner_text())
 click(page,'undo');ok('undo dimensions','720 × 560' in page.locator('#stageBadge').inner_text())
 click(page,'rotate');ok('rotate dimensions','560 × 720' in page.locator('#stageBadge').inner_text());click(page,'undo')
 click(page,'tool:crop');click(page,'crop-preset:1');click(page,'image:crop');ok('square crop','448 × 448' in page.locator('#stageBadge').inner_text())
 click(page,'tool:upscale');click(page,'image:upscale');ok('real 2x dimensions','896 × 896' in page.locator('#stageBadge').inner_text());click(page,'undo');click(page,'undo')
 click(page,'editor:pixel','#navigation');ok('pixel engine compatibility path completed','32 × 32' in page.locator('#stageBadge').inner_text())
 click(page,'size:64');ok('64px output','64 × 64' in page.locator('#stageBadge').inner_text())
 page.screenshot(path=str(OUT/'pixel-screen.png'))
 click(page,'tool:pixel');page.locator('#pixelN').fill('48');page.locator('#pixelDither').select_option('1');click(page,'pixel:apply');ok('custom 48 with dithering','48 × 48' in page.locator('#stageBadge').inner_text())
 click(page,'export')
 with page.expect_download() as dl:click(page,'pixel:save')
 dest=OUT/'pixel.png';dl.value.save_as(dest);im=Image.open(dest);ok('download is native 48x48 PNG',im.size==(48,48) and im.format=='PNG')
 with page.expect_download() as dl:click(page,'pixel:pack')
 dest=OUT/'pixel-pack.zip';dl.value.save_as(dest)
 with zipfile.ZipFile(dest) as z:
  ok('ZIP CRC valid',z.testzip() is None);ok('all four asset sizes',sorted(Image.open(io.BytesIO(z.read(n))).width for n in z.namelist())==[16,32,64,128])
 click(page,'editor:image','#navigation');ok('cross editor original reused','720 × 560' in page.locator('#stageBadge').inner_text())
 page.locator('#fileInput').set_input_files({'name':'white-border.png','mimeType':'image/png','buffer':picture()});page.wait_for_timeout(80);idle(page)
 click(page,'tool:background');click(page,'image:remove');ok('background removal no error',page.locator('#message.error').is_hidden())
 click(page,'export');page.locator('#outFormat').select_option('png')
 with page.expect_download() as dl:click(page,'image:save')
 dest=OUT/'transparent.png';dl.value.save_as(dest);im=Image.open(dest).convert('RGBA');ok('border removed',im.getpixel((0,0))[3]==0);ok('subject retained',im.getpixel((40,30))[3]==255)
 # JPEG encoder, requested target, and batch ZIP.
 click(page,'export');click(page,'export');page.locator('#outFormat').select_option('jpeg');page.locator('#targetKB').fill('10')
 with page.expect_download() as dl:click(page,'image:save')
 dest=OUT/'image.jpg';dl.value.save_as(dest);ok('JPEG actual signature',Image.open(dest).format=='JPEG');ok('JPEG meets target',dest.stat().st_size<=10240)
 page.locator('#exportAll').check()
 with page.expect_download() as dl:click(page,'image:save')
 dest=OUT/'batch.zip';dl.value.save_as(dest)
 with zipfile.ZipFile(dest) as z:ok('batch two valid images',len(z.namelist())==2 and z.testzip() is None)
 click(page,'help');page.locator('#showLabels').check();ok('mobile-friendly label toggle',page.locator('body.show-labels').count()==1);click(page,'close-dialog')
 ok('no uncaught browser exceptions',not errors)
 mobile=context.new_page();mobile.set_viewport_size({'width':390,'height':844});mount(mobile);ok('390px no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'));mobile.screenshot(path=str(OUT/'mobile.png'));click(mobile,'sample');click(mobile,'tool:crop');ok('mobile properties within screen',mobile.locator('#panel').bounding_box()['x']>=0);mobile.screenshot(path=str(OUT/'mobile-edit.png'))
 for path,title in [('/pdf/merge/','PDF 편집'),('/pixel/?n=16','도트화'),('/video/to-mp3/','미디어 편집'),('/image/compress/?kb=200','이미지 편집')]:
  p2=context.new_page();mount(p2,path);ok('initial state '+path,p2.locator('#editorTitle').inner_text()==title)
  if 'kb=200' in path:ok('200KB query populated',p2.locator('#targetKB').input_value()=='200')
  if 'to-mp3' in path:ok('MP3 intent selected',p2.locator('#mediaFormat').input_value()=='mp3')
  p2.close()
 if shutil.which('ffmpeg'):
  fixture=OUT/'test.webm'
  subprocess.run(['ffmpeg','-f','lavfi','-i','testsrc2=size=160x96:rate=12:duration=2','-c:v','libvpx','-b:v','100k','-an',str(fixture),'-y'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  pm=context.new_page();mount(pm,'/media/');pm.locator('#fileInput').set_input_files(str(fixture));pm.wait_for_timeout(100);idle(pm)
  ok('native WebM decoded',pm.locator('#video').evaluate('(v)=>v.videoWidth===160 && v.videoHeight===96'))
  with pm.expect_download() as dl:click(pm,'media:frame')
  dest=OUT/'frame.png';dl.value.save_as(dest);ok('real video frame PNG',Image.open(dest).size==(160,96))
  click(pm,'media:gif');pm.locator('#mediaEnd').fill('1')
  with pm.expect_download() as dl:click(pm,'media:save')
  dest=OUT/'video.gif';dl.value.save_as(dest);im=Image.open(dest);ok('GIF decoded by Pillow',im.format=='GIF' and im.n_frames==8 and im.size==(160,96))
  pm.locator('#mediaFormat').select_option('webm');pm.locator('#mediaEnd').fill('0.5')
  with pm.expect_download() as dl:click(pm,'media:save')
  dest=OUT/'clip.webm';dl.value.save_as(dest);ok('WebM clip EBML header',dest.read_bytes()[:4]==bytes.fromhex('1a45dfa3'))
  pm.locator('#fileInput').set_input_files(str(dest));pm.wait_for_timeout(100);idle(pm);ok('exported WebM reopens',pm.locator('#video').evaluate('(v)=>v.videoWidth===160 && v.readyState>=2'))
  pm.close()
 else:print('SKIP media fixture checks: ffmpeg not installed')
 context.close();b.close()
report={'mode':'in-memory adapted modules/navigation' if args.in_memory else 'HTTP','passed':checks,'errors':errors,'not_validated':['deployed HTTP and CSP in in-memory mode','actual Worker path (blocked in this environment)', 'CDN PDF/HEIC/MP3 dependencies','AI portrait inference/model download','physical low-end devices']}
(OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('PASS TOTAL',len(checks))
