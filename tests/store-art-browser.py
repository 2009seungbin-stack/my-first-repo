from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import io,zipfile,json,hashlib,os,time
ROOT=Path(__file__).resolve().parents[1]
CORPUS=ROOT/'tests'/'fixtures'/'store-art'
OUT=ROOT/'test-results'/'store-art';OUT.mkdir(parents=True,exist_ok=True)
ART=CORPUS/'scribe-space-key-art-4k.jpg';LOGO=CORPUS/'alloy-transparent-logo.png'
SHOTS=[CORPUS/f'kenney-gameplay-{i:02d}.png' for i in range(1,6)]
BASE=os.environ.get('STORE_ART_URL','http://127.0.0.1:4702')
results={}
with sync_playwright() as pw:
 for name in ['chromium','firefox']:
  browser=getattr(pw,name).launch(headless=True)
  page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  t0=time.perf_counter();page.goto(BASE+'/en/game/store-art-pack/',wait_until='domcontentloaded')
  page.locator('#fileInput').set_input_files(str(ART))
  page.locator('#saLogo').set_input_files(str(LOGO))
  page.locator('#saShots').set_input_files([str(p) for p in SHOTS])
  page.locator('#saTitle').fill('ALLOY');page.locator('#saTitle').dispatch_event('change')
  page.locator('[data-slot="store-small"]').click()
  page.screenshot(path=str(OUT/f'{name}-desktop.png'),full_page=True)
  with page.expect_download(timeout=120000) as info:page.locator('[data-sa="export"]').click()
  download=info.value;zip_path=OUT/f'{name}-art-pack.zip';download.save_as(zip_path)
  duration=time.perf_counter()-t0
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
   small=Image.open(io.BytesIO(z.read('steam/store-small-462x174.png'))).convert('RGB')
   small.resize((120,45),Image.Resampling.LANCZOS).save(OUT/f'{name}-small-120x45.png')
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/f'{name}-mobile.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),name+' horizontal overflow'
  assert not errors,(name,errors)
  results[name]={'durationSeconds':round(duration,3),'zipBytes':zip_path.stat().st_size,'fileCount':len(report['files']),'warnings':report['warnings']}
  browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
