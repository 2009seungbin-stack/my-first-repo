"""Existing intent/localization regression suite; shared mount is in browser_harness.py."""
from browser_harness import *
ENGINE=os.environ.get('BROWSER_ENGINE','chromium')  # chromium | firefox | webkit; results for non-Chromium engines get a suffix
with sync_playwright() as pw:
 browser=(pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']) if ENGINE=='chromium' else getattr(pw,ENGINE).launch(headless=True))
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
 # Upscale is a single-task page (src/task/upscale.js). The classical methods need no model download.
 done="()=>{const b=document.querySelector('#taskDownload');return b&&!b.disabled}"
 def save(page,name):
  page.wait_for_function(done,timeout=120000)
  with page.expect_download() as event:page.locator('#taskDownload').click()
  target=OUT/name;event.value.save_as(target);return target
 page=mount(en,'/en/image/upscale/?mode=smooth')
 ok('upscale headline is specific',page.locator('#taskTitle').inner_text()=='AI image upscaler')
 ok('no settings wall before file',page.locator('#taskOptions').count()==0 and page.locator('.dropzone').is_visible())
 assert_no_korean(page,'English landing translated')
 page.screenshot(path=str(OUT/'en-upscale.png'))
 page.locator('[data-action="task-sample"]').click();page.wait_for_function(done,timeout=120000)
 ok('upscale purpose survives input',page.locator('#taskTitle').inner_text()=='AI image upscaler')
 ok('upscale produces real result',page.locator('#taskSummary .summary-big').inner_text()=='720 × 560')
 ok('recommendations appear only after success',page.locator('#taskNext [data-action="task-next"]').count()==3)
 png=save(page,'upscale-2x.png');ok('download is actual 2x PNG',Image.open(png).size==(720,560))
 lang(page,'ja')
 ok('language switches without dropping result',page.locator('#taskSummary .summary-big').inner_text()=='720 × 560')
 ok('result primary translated',page.locator('#taskDownload').inner_text()=='ダウンロード')
 assert_no_korean(page,'Japanese result translated')
 same=save(page,'upscale-ja.png');ok('language switch leaves result bytes unchanged',hashlib.sha256(png.read_bytes()).digest()==hashlib.sha256(same.read_bytes()).digest())
 page.screenshot(path=str(OUT/'ja-upscale-result.png'))
 page.locator('#upScale [data-scale="4"]').click();page.locator('#upMode [data-mode="pixel"]').click()
 lang(page,'ko');ok('pending scale survives language switch',page.locator('#upScale [data-scale="4"]').get_attribute('aria-pressed')=='true');ok('pending method survives language switch',page.locator('#upMode [data-mode="pixel"]').get_attribute('aria-pressed')=='true')
 big=Image.open(save(page,'upscale-4x.png')).convert('RGB');ok('4x recomputes from source not previous 2x result',big.size==(1440,1120) and big.getpixel((0,0))==big.getpixel((3,3)))
 ok('pixel-art result is previewed with hard pixels',page.locator('#cmpAfter.px').count()==1)
 lang(page,'en');page.locator('#upScale [data-scale="2"]').click();page.wait_for_timeout(300);page.wait_for_function(done,timeout=120000)
 page.locator('#taskNext [data-tool="compress"]').click();page.wait_for_url('**/image/compress/**');page.wait_for_function(done,timeout=120000)
 ok('next tool reuses processed image',page.locator('#taskFiles .file b').first.inner_text()=='nerulio-sample-2x.png')
 page.close()
 # Compression is a single-task page now (src/task); the classic editor keeps its export panel.
 done="()=>{const b=document.querySelector('#taskDownload');return b&&!b.disabled}"
 page=mount(en,'/en/image/compress/?kb=200');page.locator('[data-action="task-sample"]').click();page.wait_for_function(done,timeout=120000)
 ok('compress preset from query',page.locator('#compressTarget').input_value()=='200');ok('compression target opens directly',page.locator('#optionsAdvanced').evaluate('d=>d.open'))
 page.locator('#compressTarget').fill('777');page.wait_for_timeout(600);page.wait_for_function(done,timeout=120000);page.locator('#languageSelect').select_option('ja');page.wait_for_timeout(300)
 ok('export inputs survive language switch',page.locator('#compressTarget').input_value()=='777');assert_no_korean(page,'Japanese export panel translated')
 page.locator('#compressTarget').fill('200');page.wait_for_timeout(600);page.wait_for_function(done,timeout=120000)
 with page.expect_download() as event:page.locator('#taskDownload').click()
 compressed=OUT/'compressed.webp';event.value.save_as(compressed);ok('target size is measured, not guessed',compressed.stat().st_size<=200*1024);ok('format really is WebP',Image.open(compressed).format=='WEBP');page.close()
 # Background removal is a single-task page (src/task/remove-bg.js); the solid-backdrop mode needs no model download.
 page=mount(en,'/en/image/remove-bg/?mode=solid');upload(page);page.wait_for_function("()=>{const b=document.querySelector('#taskDownload');return b&&!b.disabled}",timeout=60000)
 with page.expect_download() as removed:page.locator('#taskDownload').click()
 transparent=OUT/'removed.png';removed.value.save_as(transparent);image=Image.open(transparent).convert('RGBA');ok('solid background actual alpha removed',image.getpixel((0,0))[3]==0);ok('solid background keeps subject',image.getpixel((40,30))[3]==255)
 page.locator('#bgTolerance').evaluate("e=>{e.value='0';e.dispatchEvent(new Event('input',{bubbles:true}));}");page.wait_for_timeout(600);lang(page,'ja');ok('zero tolerance survives switch',page.locator('#bgTolerance').input_value()=='0' and page.locator('#bgMode [data-mode="color"]').get_attribute('aria-pressed')=='true');page.close()
 page=mount(ja,'/ja/pdf/merge/');ok('Japanese PDF intent headline',page.locator('#taskTitle').inner_text()=='PDFを結合' and 'PDF' in page.locator('.dropzone strong').inner_text());assert_no_korean(page,'Japanese PDF landing translated')
 page.locator('#fileInput').set_input_files({'name':'notes.txt','mimeType':'text/plain','buffer':b'x'});page.wait_for_timeout(300)
 ok('wrong format rejected without changing editor',page.locator('#taskTitle').inner_text()=='PDFを結合' and page.locator('#toast.error').is_visible());page.close()
 page=mount(en,'/png-to-webp/');page.locator('#fileInput').set_input_files({'name':'fixture.png','mimeType':'image/png','buffer':image_bytes()});page.wait_for_function(done,timeout=120000)
 ok('format alias preset',page.locator('#convertFormat [aria-pressed="true"]').inner_text().startswith('WebP'))
 with page.expect_download() as event:page.locator('#taskDownload').click()
 actual=OUT/'converted.webp';event.value.save_as(actual);ok('alias executes the correct converter',Image.open(actual).format=='WEBP');page.close()
 page=mount(en,'/');ok('home is the tool directory',page.locator('.tool-card').count()>=35 and page.locator('#workspace').count()==0);page.close()
 page=mount(en,'/en/image/editor/');page.keyboard.press('Control+k');page.locator('#toolSearch').fill('upscale');page.locator('[data-action="kit-open:upscale"]:visible').first.click();page.wait_for_url('**/image/upscale/**');page.locator('body.task-page').wait_for()
 ok('the classic editor opens single-task tools as their own page',page.locator('#taskTitle').inner_text()=='AI image upscaler');page.close()
 page=mount(en,'/my-first-repo/ja/image/upscale/?scale=4',base='/my-first-repo/')
 ok('repository subpath and language retained',page.locator('html').get_attribute('lang')=='ja');page.locator('[data-action="task-sample"]').click();page.locator('#upScale').wait_for();ok('4x query preset',page.locator('#upScale [aria-pressed="true"]').inner_text()=='4×')
 if args.in_memory:
  lang(page,'en');ok('manual locale URL preserves repository base',page.evaluate('window.__testURL').startswith('https://fileforge.test/my-first-repo/en/'))
  lang(page,'auto');ok('automatic mode removes saved preference',page.evaluate('window.__testStorage.getItem("fileforge.language.v1")') is None);ok('automatic mode removes locale prefix',page.evaluate('window.__testURL').startswith('https://fileforge.test/my-first-repo/image/'))
 page.close()
 for language,context in [('en',en),('ja',ja),('ko',ko)]:
  page=mount(context,f'/{language}/image/upscale/');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
  ok(language+' mobile landing no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.screenshot(path=str(OUT/f'{language}-mobile.png'),full_page=True)
  page.locator('[data-action="task-sample"]').click();page.locator('#taskOptions').wait_for();lang(page,language);ok(language+' mobile panel inside viewport',page.locator('#taskOptions').bounding_box()['x']>=0 and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  ok(language+' mobile primary visible',page.locator('#taskDownload').is_visible());page.close()
 # Video → GIF is a single-task page now (src/task/media.js); the same evidence is kept on it.
 if shutil.which('ffmpeg'):
  fixture=OUT/'i18n-video.webm'
  subprocess.run(['ffmpeg','-f','lavfi','-i','testsrc2=size=160x96:rate=12:duration=2','-c:v','libvpx','-b:v','100k','-an',str(fixture),'-y'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  page=mount(ja,'/ja/video/to-gif/?fps=12');page.locator('#fileInput').set_input_files(str(fixture));page.locator('#mediaRun:not([disabled])').wait_for(timeout=60000)
  ok('Japanese GIF intent retains decoded video',page.locator('#taskTitle').inner_text()=='動画 → GIF' and page.locator('#video').evaluate('(v)=>v.videoWidth===160'))
  page.locator('#mediaEnd').fill('1');page.wait_for_timeout(120);page.locator('#mediaRun').click()
  page.locator('#taskDownload:not([disabled])').wait_for(timeout=120000)
  with page.expect_download() as event:page.locator('#taskDownload').click()
  output=OUT/'localized.gif';event.value.save_as(output);animation=Image.open(output)
  ok('localized GIF pipeline saves actual twelve-frame GIF',animation.format=='GIF' and animation.n_frames==12 and animation.size==(160,96))
  assert_no_korean(page,'Japanese GIF result translated');page.close()
 else:print('SKIP media regression: ffmpeg unavailable')
 ok('no uncaught browser exceptions',not errors)
 for c in [en,ja,ko,es]:c.close()
 browser.close()
report={'mode':'in-memory module/location/history/storage adaptation' if args.in_memory else 'HTTP','passed':checks,'errors':errors,'not_validated':['deployed browser HTTP and CSP in memory mode','real persistent Storage in memory mode','actual Worker success path when blocked','external PDF/HEIC/MP3/AI integrations','physical low-end devices']}
(OUT/('browser-results'+('' if ENGINE=='chromium' else '-'+ENGINE)+'.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print('PASS TOTAL',len(checks))
