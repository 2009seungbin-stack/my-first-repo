from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
import io,zipfile,json,hashlib,os,time
ROOT=Path(__file__).resolve().parents[1]
CORPUS=ROOT/'tests'/'fixtures'/'store-art'
OUT=ROOT/'test-results'/'store-art';OUT.mkdir(parents=True,exist_ok=True)
JPEG=CORPUS/'scribe-space-key-art-4k.jpg';LOGO=CORPUS/'alloy-transparent-logo.png'
SHOTS=[CORPUS/f'kenney-gameplay-{i:02d}.png' for i in range(1,6)]
BASE=os.environ.get('STORE_ART_URL','http://127.0.0.1:4173')
ART=OUT/'scribe-space-key-art-4k.png'
Image.open(JPEG).save(ART)
results={}
with sync_playwright() as pw:
 for name in ['chromium','firefox']:
  browser=getattr(pw,name).launch(headless=True)
  page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
  # Playwright turns on file-chooser interception when the first listener is added; added only inside
  # expect_file_chooser, the Enter below can win that race and the chooser is never reported (1 in 6 runs).
  page.on('filechooser',lambda c:None)
  errors=[];writes=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:writes.append((r.method,r.url)) if r.method not in ('GET','HEAD') else None)
  page.goto(BASE+'/en/game/store-art-pack/',wait_until='domcontentloaded')
  for lang,label in [('ko','키아트'),('ja','キーアート')]:
   page.goto(BASE+f'/{lang}/game/store-art-pack/',wait_until='domcontentloaded')
   assert label in page.locator('.store-intake').inner_text(),lang
  page.goto(BASE+'/en/game/store-art-pack/',wait_until='domcontentloaded')
  page.locator('[data-slot="store-small"]').focus();page.keyboard.press('ArrowRight')
  assert 'store-small.x=0.51' in page.url,page.url
  page.locator('[data-sa="undo"]').click();assert 'store-small.x=' not in page.url
  page.locator('[data-sa="redo"]').click();assert 'store-small.x=0.51' in page.url
  page.reload(wait_until='domcontentloaded')
  page.locator('[data-slot="store-small"]').wait_for(timeout=10000)
  errors.clear()  # Firefox may cancel the prior route's dynamic import during navigation.
  page.locator('[data-sa="art"]').focus()
  with page.expect_file_chooser() as chooser:page.keyboard.press('Enter')
  chooser.value.set_files(str(ART))
  page.locator('#saLogo').set_input_files(str(LOGO))
  page.locator('#saShots').set_input_files([str(p) for p in SHOTS])
  # Art and logo decode asynchronously and redraw the panel; wait for both before focusing a slider in it.
  for f in (ART,LOGO):page.locator('.store-intake').get_by_text(f.name).wait_for(timeout=10000)
  page.locator('#saTitle').fill('ALLOY');page.locator('#saTitle').dispatch_event('change')
  page.locator('[data-slot="store-small"]').click()
  slider=page.locator('[data-setting="logoW"]');before=float(slider.input_value());slider.focus();page.keyboard.press('ArrowRight')
  assert float(page.locator('[data-setting="logoW"]').input_value())>before
  page.locator('[data-sa="undo"]').click();assert abs(float(page.locator('[data-setting="logoW"]').input_value())-before)<.001
  assert page.locator('#saTiny').count()==1
  page.screenshot(path=str(OUT/f'{name}-desktop.png'),full_page=True)
  t0=time.perf_counter()
  with page.expect_download(timeout=120000) as info:page.locator('[data-sa="export"]').click()
  download=info.value;zip_path=OUT/f'{name}-art-pack.zip';download.save_as(zip_path)
  duration=time.perf_counter()-t0
  assert duration<=12,(name,'4K export exceeded desktop target',duration)
  with zipfile.ZipFile(zip_path) as z:
   report=json.loads(z.read('checklist.json'))
   assert len(report['files'])==17,(name,len(report['files']))
   assert report['warnings']==['Apple icon is an Xcode source image, not a standalone App Store upload.'],report['warnings']
   for item in report['files']:
    data=z.read(item['path']);img=Image.open(io.BytesIO(data));img.load()
    assert img.size==(item['width'],item['height']),(name,item['path'],img.size)
    assert len(data)==item['bytes']
    if item['slot']=='screenshot':
     idx=int(Path(item['path']).stem.split('-')[-1]);assert hashlib.sha256(data).digest()==hashlib.sha256(SHOTS[idx-1].read_bytes()).digest()
    if item['slot']=='library-logo':assert img.mode=='RGBA' and img.getextrema()[3][0]==0
    if item['slot']=='feature':assert img.mode=='RGB'
    if item['slot']=='icon':assert len(data)<=1024*1024,('Google icon over 1MiB',len(data))
   hero=Image.open(io.BytesIO(z.read('steam/library-hero-3840x1240.png'))).convert('RGB')
   expected=Image.open(ART).convert('RGB').crop((0,460,3840,1700))
   mean=ImageStat.Stat(ImageChops.difference(hero,expected)).mean
   assert max(mean)<1.5,(name,'Steam hero was changed beyond crop-only output',mean)
   small=Image.open(io.BytesIO(z.read('steam/store-small-462x174.png'))).convert('RGB')
   small.resize((120,45),Image.Resampling.LANCZOS).save(OUT/f'{name}-small-120x45.png')
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/f'{name}-mobile.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),name+' horizontal overflow'
  mobile_export=None
  if name=='chromium':
   cdp=page.context.new_cdp_session(page);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
   t1=time.perf_counter()
   with page.expect_download(timeout=120000) as info:page.locator('[data-sa="export"]').click()
   info.value.delete()
   mobile_export=round(time.perf_counter()-t1,3)
   cdp.send('Emulation.setCPUThrottlingRate',{'rate':1})
   assert mobile_export<=30,('mobile CPU emulation 4x exceeded target',mobile_export)
  assert not errors,(name,errors)
  assert not writes,(name,'unexpected request that could carry local bytes',writes)
  results[name]={'exportSeconds':round(duration,3),'mobile4xExportSeconds':mobile_export,'zipBytes':zip_path.stat().st_size,'fileCount':len(report['files']),'renderTimingMs':report['timingMs'],'warnings':report['warnings']}
  # A separate 16×16 pixel-art input tests exact nearest pixels and optional slot export.
  pix=OUT/'pixel-fixture.png'
  if not pix.exists():
   pi=Image.new('RGB',(16,16));pi.putdata([(24,38,62) if x<8 else (241,173,45) for y in range(16) for x in range(16)]);pi.save(pix)
  p2=browser.new_page(accept_downloads=True)
  p2.goto(BASE+'/en/game/store-art-pack/');p2.locator('[data-platform="steam"]').uncheck();p2.locator('[data-platform="google-play"]').uncheck();p2.locator('[data-platform="apple"]').uncheck()
  p2.locator('#saPixel').check();p2.locator('#saOptional').check();p2.locator('#fileInput').set_input_files(str(pix))
  with p2.expect_download(timeout=120000) as d:p2.locator('[data-sa="export"]').click()
  pp=OUT/f'{name}-pixel-pack.zip';d.value.save_as(pp)
  with zipfile.ZipFile(pp) as z:
   assert set(z.namelist())=={'itch/cover-630x500.png','itch/banner-suggested-960x300.png','checklist.json'}
   for n in ['itch/cover-630x500.png','itch/banner-suggested-960x300.png']:
    img=Image.open(io.BytesIO(z.read(n))).convert('RGB');colors=set(c for _,c in img.getcolors(256))
    assert colors=={(24,38,62),(241,173,45)},(name,n,colors)
   pr=json.loads(z.read('checklist.json'));assert all(x['geometry']['integerNearest'] for x in pr['files'])
  p2.close();browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
