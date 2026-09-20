"""FileForge intent + localization integration tests.

Normal mode uses http://127.0.0.1:4173 (run npm run dev first).
--in-memory mounts the same modules as Blob URLs when policy blocks HTTP.
Only module URLs, location/history and Storage are adapted in that mode.
It does NOT validate deployed HTTP/CSP, actual storage persistence, or CDN engines.
Requires Python Playwright, Pillow and /usr/bin/chromium.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import argparse, re, json, io, hashlib, shutil, subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--in-memory',action='store_true');args=p.parse_args()
checks=[];errors=[]
MODULES=['messages','i18n','intents','core','worker','audio-worker','image','pdf','media','ui','experience','app']
SOURCES={n:(ROOT/'src'/f'{n}.js').read_text() for n in MODULES}
def ok(name,condition=True):
 assert condition,name
 checks.append(name);print('PASS',name,flush=True)
def idle(page):
 page.wait_for_function("document.querySelector('#workspace').getAttribute('aria-busy')==='false'",timeout=30000)
def click(page,action,scope=''):
 page.locator(f'{scope} [data-action="{action}"]:visible'.strip()).first.click()
 page.wait_for_timeout(50);idle(page)
def lang(page,value):
 page.locator('#languageSelect').select_option(value);page.wait_for_timeout(80);idle(page)
def mount(context,path='/',saved=None,blocked=False,base='/'):
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 if not args.in_memory:
  page.goto('http://127.0.0.1:4173'+path,wait_until='networkidle')
  return page
 local_path=path.split('?')[0].removeprefix(base).strip('/')
 # Built HTML verifies the actual localized static document, not a test template.
 html_path=ROOT/'dist'/local_path/'index.html'
 if not html_path.exists():html_path=ROOT/'index.html'
 html=html_path.read_text();html=re.sub(r'<script[^>]*>.*?</script>','',html);html=re.sub(r'<link[^>]*>','',html);html=re.sub(r'<base[^>]*>','',html)
 page.set_content(html);page.add_style_tag(content=(ROOT/'styles.css').read_text()+(ROOT/'experience.css').read_text())
 page.evaluate('''async ({sources,path,saved,blocked,base})=>{
  window.__testURL='https://fileforge.test'+path;
  const stack=[window.__testURL];let position=0;
  window.__history={
   pushState:(s,t,u)=>{stack.splice(position+1);stack.push(new URL(u,window.__testURL).href);window.__testURL=stack[++position];},
   replaceState:(s,t,u)=>{window.__testURL=new URL(u,window.__testURL).href;stack[position]=window.__testURL;},
   back:()=>{if(position>0){window.__testURL=stack[--position];window.dispatchEvent(new PopStateEvent('popstate'));}}
  };
  const data=new Map(saved?[['fileforge.language.v1',saved]]:[]);
  window.__testStorage={getItem:k=>{if(blocked)throw Error('denied');return data.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('denied');data.set(k,v);},removeItem:k=>{if(blocked)throw Error('denied');data.delete(k);}};
  const urls={};
  for(const[name,original]of Object.entries(sources)){
   let src=original;
   if(name==='app')src=src.replace("new URL('../',import.meta.url)","new URL("+JSON.stringify('https://fileforge.test'+base)+")");
   if(['app','experience'].includes(name))src=src.replaceAll('location.pathname','new URL(window.__testURL).pathname').replaceAll('location.search','new URL(window.__testURL).search').replaceAll('location.href','window.__testURL').replaceAll('history.pushState','window.__history.pushState').replaceAll('history.replaceState','window.__history.replaceState').replaceAll('window.localStorage','window.__testStorage');
   for(const[dep,url]of Object.entries(urls)){
    src=src.replaceAll("new URL('./"+dep+".js',import.meta.url)",JSON.stringify(url));src=src.replaceAll("'./"+dep+".js'",JSON.stringify(url));
   }
   urls[name]=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
  }
  window.__testModules=urls;await import(urls.app);
 }''',{'sources':SOURCES,'path':path,'saved':saved,'blocked':blocked,'base':base})
 page.wait_for_function("document.querySelector('#navigation').children.length>0")
 return page
def visible_words(page):
 # Native language names are intentionally always written in their own language.
 return page.locator('body').inner_text().replace('한국어','').replace('日本語','')
def assert_no_korean(page,name):ok(name,not re.search('[가-힣]',visible_words(page)))
def image_bytes(w=80,h=60):
 im=Image.new('RGBA',(w,h),'white')
 for x in range(w//4,w*3//4):
  for y in range(h//4,h*3//4):im.putpixel((x,y),(255,80,80,255))
 stream=io.BytesIO();im.save(stream,format='PNG');return stream.getvalue()
def upload(page,name='fixture.png',buffer=None,mime='image/png'):
 page.locator('#fileInput').set_input_files({'name':name,'mimeType':mime,'buffer':buffer or image_bytes()});page.wait_for_timeout(60);idle(page)
def download(page,name):
 with page.expect_download() as event:click(page,'intent-download')
 path=OUT/name;event.value.save_as(path);return path
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 en=browser.new_context(locale='en-US',viewport={'width':1440,'height':1000},accept_downloads=True)
 ja=browser.new_context(locale='ja-JP',viewport={'width':1440,'height':1000},accept_downloads=True)
 ko=browser.new_context(locale='ko-KR',viewport={'width':1440,'height':1000},accept_downloads=True)
 es=browser.new_context(locale='es-ES',viewport={'width':1440,'height':1000},accept_downloads=True)
 for context in [en,ja,ko,es]:context.set_default_timeout(6000)
 for context,expected in [(en,'en'),(ja,'ja'),(ko,'ko'),(es,'en')]:
  page=mount(context,'/image/upscale/');ok('browser language resolves to '+expected,page.locator('html').get_attribute('lang')==expected);page.close()
 if args.in_memory:
  for path,saved,expected in [('/image/upscale/','ja','ja'),('/ko/image/upscale/','en','ko'),('/en/image/upscale/?lang=ja','ko','ja')]:
   page=mount(en,path,saved);ok('language priority '+path+':'+str(saved),page.locator('html').get_attribute('lang')==expected);page.close()
  page=mount(en,'/image/upscale/',blocked=True);lang(page,'ja');ok('storage denied still switches',page.locator('html').get_attribute('lang')=='ja');ok('storage denial is explained',page.locator('#message').is_visible());page.close()
 page=mount(en,'/en/image/upscale/')
 ok('upscale headline is specific',page.locator('#emptyTitle').inner_text()=='Make your image bigger')
 ok('no settings wall before file',page.locator('#panel').is_hidden())
 ok('four unified editors remain',page.locator('#navigation [data-action^="editor:"]').count()==4)
 assert_no_korean(page,'English landing translated')
 page.screenshot(path=str(OUT/'en-upscale.png'))
 click(page,'sample');ok('upscale purpose survives input',page.locator('#editorTitle').inner_text()=='Quick image upscaler')
 ok('actual source dimensions', '720 × 560' in page.locator('#stageBadge').inner_text())
 ok('obvious primary upscale action',page.locator('[data-action="intent-run"]').inner_text()=='Enlarge 2×')
 click(page,'intent-run');ok('upscale produces real result','1440 × 1120' in page.locator('#stageBadge').inner_text())
 ok('recommendations appear only after success',page.locator('.next-steps').is_visible())
 png=download(page,'upscale-2x.png');ok('download is actual 2x PNG',Image.open(png).size==(1440,1120))
 click(page,'compare:original');ok('before comparison uses unchanged source','720 × 560' in page.locator('#stageBadge').inner_text())
 click(page,'compare:result');lang(page,'ja')
 ok('language switches without dropping result','1440 × 1120' in page.locator('#stageBadge').inner_text())
 ok('result primary translated',page.locator('[data-action="intent-download"]').inner_text()=='ダウンロード')
 assert_no_korean(page,'Japanese result translated')
 same=download(page,'upscale-ja.png');ok('language switch leaves result bytes unchanged',hashlib.sha256(png.read_bytes()).digest()==hashlib.sha256(same.read_bytes()).digest())
 page.screenshot(path=str(OUT/'ja-upscale-result.png'))
 click(page,'intent-settings');page.locator('#scale').select_option('4');page.locator('#scaleMode').select_option('pixel')
 ok('changing settings invalidates old download',page.locator('[data-action="intent-run"]').is_visible())
 lang(page,'ko');ok('pending scale survives language switch',page.locator('#scale').input_value()=='4');ok('pending method survives language switch',page.locator('#scaleMode').input_value()=='pixel')
 click(page,'intent-run');ok('4x recomputes from source not previous 2x result','2880 × 2240' in page.locator('#stageBadge').inner_text())
 click(page,'undo');ok('undo discards preview without corrupting source','720 × 560' in page.locator('#stageBadge').inner_text())
 click(page,'preset:scale:2');click(page,'intent-run');click(page,'next:pixel')
 ok('next tool reuses processed image','1440 × 1120' in page.locator('#stageBadge').inner_text())
 click(page,'intent-settings');page.locator('#pixelN').fill('48');page.locator('#pixelDither').select_option('1')
 lang(page,'en');ok('custom pixel size survives language switch',page.locator('#pixelN').input_value()=='48')
 click(page,'intent-run');result=download(page,'pixel-48.png');ok('native 48x48 pixel asset',Image.open(result).size==(48,48));ok('pixel preview scales sharply',page.locator('#stage.pixel-mode').count()==1)
 page.screenshot(path=str(OUT/'en-pixel.png'))
 page.locator('#pixelN').fill('0');click(page,'intent-run')
 ok('invalid custom size gives localized error',page.locator('#message.error').is_visible());assert_no_korean(page,'English validation error translated')
 page.close()
 page=mount(en,'/en/image/compress/?kb=200');ok('compress preset from query',page.locator('#landingPresets [aria-pressed="true"]').inner_text()=='≤ 200 KB')
 click(page,'sample');click(page,'intent-settings');ok('compression target opens directly',page.locator('#targetKB').input_value()=='200')
 page.locator('#targetKB').fill('777');lang(page,'ja');ok('export inputs survive language switch',page.locator('#targetKB').input_value()=='777');assert_no_korean(page,'Japanese export panel translated')
 page.locator('#targetKB').fill('200');click(page,'intent-run');compressed=download(page,'compressed.webp');ok('target size is measured, not guessed',compressed.stat().st_size<=200*1024);ok('format really is WebP',Image.open(compressed).format=='WEBP');page.close()
 page=mount(en,'/en/image/remove-bg/');upload(page);click(page,'intent-run');transparent=download(page,'removed.png');image=Image.open(transparent).convert('RGBA');ok('solid background actual alpha removed',image.getpixel((0,0))[3]==0);ok('solid background keeps subject',image.getpixel((40,30))[3]==255)
 click(page,'intent-settings');page.locator('#tolerance').fill('0');lang(page,'ja');ok('zero tolerance survives switch',page.locator('#tolerance').input_value()=='0');page.close()
 page=mount(ja,'/ja/pdf/merge/');ok('Japanese PDF intent headline',page.locator('#emptyTitle').inner_text()=='結合するPDFを追加');assert_no_korean(page,'Japanese PDF landing translated')
 upload(page);ok('wrong format rejected without changing editor',page.locator('#editorTitle').inner_text()=='PDFを結合' and page.locator('#message.error').is_visible());page.close()
 page=mount(en,'/png-to-webp/');ok('format alias preset',page.locator('#landingPresets [aria-pressed="true"]').inner_text()=='WebP');upload(page);click(page,'intent-run');actual=download(page,'converted.webp');ok('alias executes the correct converter',Image.open(actual).format=='WEBP');page.close()
 page=mount(en,'/');ok('home emphasizes four named features',page.locator('.feature-link').count()==4);click(page,'intent:upscale');ok('featured card keeps unified app',page.locator('#emptyTitle').inner_text()=='Make your image bigger');page.close()
 page=mount(en,'/my-first-repo/ja/image/upscale/?scale=4',base='/my-first-repo/')
 ok('repository subpath and language retained',page.locator('html').get_attribute('lang')=='ja');ok('4x query preset',page.locator('#landingPresets [aria-pressed="true"]').inner_text()=='4×')
 click(page,'sample');click(page,'tool:crop');ok('related tool changes intent',page.locator('#editorTitle').inner_text()=='画像を切り抜き')
 if args.in_memory:
  page.evaluate('window.__history.back()');page.wait_for_timeout(100);ok('back navigation restores upscale with file','720 × 560' in page.locator('#stageBadge').inner_text() and page.locator('#editorTitle').inner_text()=='かんたん画像拡大')
  lang(page,'en');ok('manual locale URL preserves repository base',page.evaluate('window.__testURL').startswith('https://fileforge.test/my-first-repo/en/'))
  lang(page,'auto');ok('automatic mode removes saved preference',page.evaluate('window.__testStorage.getItem("fileforge.language.v1")') is None);ok('automatic mode removes locale prefix',page.evaluate('window.__testURL').startswith('https://fileforge.test/my-first-repo/image/'))
 page.close()
 for language,context in [('en',en),('ja',ja),('ko',ko)]:
  page=mount(context,f'/{language}/image/upscale/');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
  ok(language+' mobile landing no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.screenshot(path=str(OUT/f'{language}-mobile.png'),full_page=True)
  click(page,'sample');click(page,'intent-settings');lang(page,language);ok(language+' mobile panel inside viewport',page.locator('#panel').bounding_box()['x']>=0)
  ok(language+' mobile primary visible',page.locator('[data-action="intent-run"]').is_visible());page.close()
 if shutil.which('ffmpeg'):
  fixture=OUT/'i18n-video.webm'
  subprocess.run(['ffmpeg','-f','lavfi','-i','testsrc2=size=160x96:rate=12:duration=2','-c:v','libvpx','-b:v','100k','-an',str(fixture),'-y'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  page=mount(ja,'/ja/video/to-gif/');page.locator('#fileInput').set_input_files(str(fixture));page.wait_for_timeout(100);idle(page)
  ok('Japanese GIF intent retains decoded video',page.locator('#editorTitle').inner_text()=='動画 → GIF' and page.locator('#video').evaluate('(v)=>v.videoWidth===160'))
  page.locator('#mediaEnd').fill('1');click(page,'intent-run');output=download(page,'localized.gif');animation=Image.open(output)
  ok('localized GIF pipeline saves actual eight-frame GIF',animation.format=='GIF' and animation.n_frames==8 and animation.size==(160,96))
  assert_no_korean(page,'Japanese GIF result translated');page.close()
 else:print('SKIP media regression: ffmpeg unavailable')
 ok('no uncaught browser exceptions',not errors)
 for c in [en,ja,ko,es]:c.close()
 browser.close()
report={'mode':'in-memory module/location/history/storage adaptation' if args.in_memory else 'HTTP','passed':checks,'errors':errors,'not_validated':['deployed browser HTTP and CSP in memory mode','real persistent Storage in memory mode','actual Worker success path when blocked','external PDF/HEIC/MP3/AI integrations','physical low-end devices']}
(OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('PASS TOTAL',len(checks))
