"""Measure grid spacing through the public landing, Studio controls and downloaded atlas.

Run: python tools/editorial/measure-sprite-grid.py [--browser chromium|firefox]
New runs default to test-results and cannot overwrite published evidence.
"""
import os,json,socket,subprocess,time,urllib.request,hashlib,io,zipfile,argparse,shutil
from pathlib import Path,PurePosixPath
from datetime import datetime,timezone
from PIL import Image,ImageDraw,ImageFont,__version__ as pillow_version
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser',choices=['chromium','firefox'],default='chromium')
parser.add_argument('--output',type=Path)
args=parser.parse_args()
OUT=(args.output or ROOT/'test-results/editorial-sprite-grid'/args.browser).resolve()
if OUT.is_relative_to(ROOT/'assets') and (OUT/'measurements.json').exists():
 parser.error('Published evidence already exists; record a new dated directory instead.')
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'tests/fixtures/kenney/tiny-dungeon-tilemap.png'
def sha(raw):return hashlib.sha256(raw).hexdigest()
if sha(SOURCE.read_bytes())!='5653222ac495d89e942f9b636300759b3f38e85b26e9b888676f2e9ab834095a':
 raise RuntimeError('The case-study input changed; use the recorded source commit.')
assert Image.open(SOURCE).size==(203,186)
def visible(im):
 data=bytearray(im.convert('RGBA').tobytes())
 for i in range(0,len(data),4):
  if data[i+3]==0:data[i:i+3]=b'\0\0\0'
 return bytes(data)
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
server=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
base=f'http://127.0.0.1:{port}';records=[]
shutil.copyfile(SOURCE,OUT/'source.png')
try:
 for _ in range(100):
  try:urllib.request.urlopen(base+'/en/sprite-slicer/',timeout=1).close();break
  except Exception:
   if server.poll() is not None:raise RuntimeError('Source preview exited; check the Node dependencies.')
   time.sleep(.1)
 else:raise RuntimeError('Source preview did not start')
 with sync_playwright() as p:
  browser=getattr(p,args.browser).launch()
  for gap in [1,0]:
   context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
   pg=context.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.goto(base+'/en/sprite-slicer/',wait_until='domcontentloaded')
   pg.wait_for_function('()=>document.documentElement.dataset.glReady==="1"')
   with pg.expect_navigation():pg.locator('#glFiles').set_input_files(str(SOURCE))
   pg.wait_for_function('()=>window.nerulioStudio?.doc.assets.length>0')
   pg.wait_for_selector('[data-sp="plan-count"]')
   initial=pg.locator('[data-sp="plan-count"]').inner_text()
   pg.locator('button[data-dec="animations"][data-alt="none"]').click()
   if gap==0:
    pg.locator('button[data-dec="slice"][data-alt="custom"]').click()
    for axis in ['sx','sy']:
     pg.locator(f'[data-sp="grid-{axis}"]').fill('0')
     pg.locator(f'[data-sp="grid-{axis}"]').press('Enter')
     pg.wait_for_function('(key)=>document.querySelector(`[data-sp="grid-${key}"]`)?.value==="0"',arg=axis)
   plan=pg.locator('[data-sp="plan-count"]').inner_text()
   fit=pg.locator('[data-sp="custom-fit"]').inner_text() if gap==0 else None
   pg.screenshot(path=str(OUT/f'gap-{gap}-preview.png'))
   pg.locator('[data-sp="import-apply"]').click()
   pg.wait_for_function('()=>window.nerulioStudio.doc.assets[0].frames.length===132')
   asset=pg.evaluate('()=>JSON.parse(JSON.stringify(window.nerulioStudio.doc.assets[0]))')
   applied=asset['grid']
   assert all(applied[k]==v for k,v in {'w':16,'h':16,'ox':0,'oy':0,'sx':gap,'sy':gap}.items()), ('Requested grid was not applied',gap,applied)
   pg.locator('.st-ws-tab[data-ws="pack"]').click()
   pg.wait_for_selector('[data-pack="efficiency"]')
   godot_blocked=pg.locator('[data-export="godot4"]').is_disabled()
   assert godot_blocked and 'animation tag' in pg.locator('[data-export="godot4"]').get_attribute('title')
   pg.locator('[data-pack="preset"]').select_option('phaser')
   pg.locator('[data-pack="target"]').select_option('phaser')
   pg.wait_for_function('()=>!document.querySelector("[data-action=pack-cancel]")&&document.querySelector("[data-export-main=phaser]")&&!document.querySelector("[data-export-main=phaser]").disabled',timeout=120000)
   implicit=pg.locator('[data-pack="implicit"]').inner_text() if pg.locator('[data-pack="implicit"]').count() else None
   with pg.expect_download(timeout=120000) as download:pg.locator('[data-export-main="phaser"]').click()
   raw=Path(download.value.path()).read_bytes();(OUT/f'gap-{gap}-phaser.zip').write_bytes(raw)
   pg.screenshot(path=str(OUT/f'gap-{gap}-export.png'))
   z=zipfile.ZipFile(io.BytesIO(raw));atlas_name=next(n for n in z.namelist() if n.endswith('.json') and '.anims.' not in n)
   atlas=json.loads(z.read(atlas_name))
   image_name=str(PurePosixPath(atlas_name).parent/atlas['meta']['image'])
   atlas_image=Image.open(io.BytesIO(z.read(image_name))).convert('RGBA')
   source=Image.open(SOURCE).convert('RGBA');rows=[]
   assert len(atlas['frames'])==len(asset['frames'])==132
   assert not implicit and not any('.anims.' in n for n in z.namelist())
   for i,((key,f),frame) in enumerate(zip(atlas['frames'].items(),asset['frames'])):
    assert not f['rotated']
    r,offset,size=f['frame'],f['spriteSourceSize'],f['sourceSize']
    restored=Image.new('RGBA',(size['w'],size['h']))
    restored.paste(atlas_image.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h'])),(offset['x'],offset['y']))
    rect=frame['sourceRect'];actual=source.crop((rect['x'],rect['y'],rect['x']+rect['w'],rect['y']+rect['h']))
    wanted=(i%12*17,i//12*17);reference=source.crop((*wanted,wanted[0]+16,wanted[1]+16))
    rows.append({'index':i,'exportKey':key,'sourceRect':rect,'referenceX':wanted[0],'referenceY':wanted[1],
                 'outputMatchesSelectedCrop':visible(restored)==visible(actual),
                 'outputMatchesReferenceTile':visible(restored)==visible(reference),'visiblePixelSha256':sha(visible(restored))})
    if i==131:restored.save(OUT/f'gap-{gap}-last-tile.png')
   assert all(r['outputMatchesSelectedCrop'] for r in rows)
   records.append({'gap':gap,'appliedGrid':applied,'initialPreview':initial,'previewBeforeApply':plan,'customFit':fit,'frames':len(rows),
                   'declaredAnimationTags':len(asset['tags']),'implicitAnimationNotice':implicit,'godotExportRequiresTag':godot_blocked,
                   'animationFiles':[n for n in z.namelist() if '.anims.' in n],
                   'downloadBytes':len(raw),'downloadSha256':sha(raw),'selectedCropMatches':sum(r['outputMatchesSelectedCrop'] for r in rows),
                   'referenceTileMatches':sum(r['outputMatchesReferenceTile'] for r in rows),
                   'referenceCoordinateMatches':sum(r['sourceRect']['x']==r['referenceX'] and r['sourceRect']['y']==r['referenceY'] for r in rows),
                   'atlasWidth':atlas_image.width,'atlasHeight':atlas_image.height,'rows':rows,'pageErrors':errors})
   assert not errors
   context.close()
  result={'measuredAtUTC':datetime.now(timezone.utc).isoformat(),'browserEngine':args.browser,'browser':browser.version,'pillow':pillow_version,
          'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
          'sourceModifiedAfterCommit':subprocess.run(['git','diff','--quiet','HEAD','--','src','tools'],cwd=ROOT).returncode!=0,
          'reproduce':'python tools/editorial/measure-sprite-grid.py --browser '+args.browser,
          'inputSha256':sha(SOURCE.read_bytes()),
          'inputWidth':203,'inputHeight':186,'referenceGrid':{'cellWidth':16,'cellHeight':16,'columns':12,'rows':11,'gapX':1,'gapY':1},
          'comparison':'RGBA bytes with RGB zeroed only where alpha is zero; PNG file bytes may differ. Pillow reconstructs each frame from the downloaded Phaser atlas. No Phaser engine run is claimed.',
          'records':records}
  # Diagnostic figure: exact nearest-neighbour enlargement on a checkerboard, not new artwork.
  source=Image.open(SOURCE).convert('RGBA')
  figure=Image.new('RGB',(360,660),'#f5f5f5');draw=ImageDraw.Draw(figure);font=ImageFont.load_default(size=16)
  panels=[('Reference tile: x187, y170',source.crop((187,170,203,186))),
          ('Gap 1 export: x187, y170',Image.open(OUT/'gap-1-last-tile.png').convert('RGBA')),
          ('Gap 0 export: x176, y160',Image.open(OUT/'gap-0-last-tile.png').convert('RGBA'))]
  for i,(label,image) in enumerate(panels):
   y=10+i*210;draw.text((12,y),label,font=font,fill='#111111')
   checker=Image.new('RGBA',(160,160));d=ImageDraw.Draw(checker)
   for cy in range(16):
    for cx in range(16):d.rectangle((cx*10,cy*10,cx*10+9,cy*10+9),fill='#d6d6d6' if (cx+cy)%2 else '#ffffff')
   checker=Image.alpha_composite(checker,image.resize((160,160),Image.Resampling.NEAREST))
   figure.paste(checker.convert('RGB'),(100,y+30))
  draw.text((12,640),'10x pixels; no smoothing',font=font,fill='#111111')
  figure.save(OUT/'gap-comparison.png')
  (OUT/'measurements.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(json.dumps([{k:r[k] for k in ['gap','frames','declaredAnimationTags','implicitAnimationNotice','animationFiles','selectedCropMatches','referenceTileMatches']} for r in records],ensure_ascii=True))
  browser.close()
finally:server.terminate();server.wait(timeout=10)
