"""Descriptive photo quality measurements on one CC0 photo; not a preference study.

Run local server first. Saves independently reopened PNGs and a nearest-neighbour contact sheet.
"""
from pathlib import Path
from io import BytesIO
import base64,json,os
import numpy as np
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PHOTO=ROOT/'tests/fixtures/pixel-converter/flower-landscape.jpg'
OUT=ROOT/'test-results/pixel-converter/quality';OUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('TEST_URL','http://127.0.0.1:4173').rstrip('/')
source=Image.open(PHOTO).convert('RGB')
reference=np.asarray(source.resize((32,32),Image.Resampling.BOX),dtype=np.float32)
rows=[];pictures=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch();p=browser.new_page(viewport={'width':1440,'height':900})
 p.goto(BASE+'/en/game/studio/?ws=pixel&mode=convert')
 p.wait_for_function('()=>document.documentElement.dataset.studioStarted==="1"')
 p.set_input_files('input[type=file][multiple]',str(PHOTO))
 p.wait_for_function('()=>window.nerulioStudio.doc.assets.length>0')
 p.evaluate("()=>window.nerulioStudio.runCommand('pixel.cleanup')")
 p.locator('[data-px="clean-measure"]').click()
 p.wait_for_function('()=>document.querySelector("[data-px=cleanup]")?.dataset.state==="measured"')
 if p.locator('.px-clean-opts').get_attribute('open') is None:p.locator('.px-clean-opts summary').click()
 p.locator('[data-px="clean-maxColors"]').fill('16');p.locator('[data-px="clean-maxColors"]').dispatch_event('change')
 for sampler in ['nearest','box','median','mode','k-centroid']:
  p.locator('[data-px="clean-sampleMethod"]').select_option(sampler)
  for algorithm in ['median-cut','k-means','wu']:
   p.locator('[data-px="clean-paletteAlgorithm"]').select_option(algorithm)
   p.locator('[data-px="clean-preview"]').click()
   p.wait_for_function('()=>document.querySelector("[data-px=cleanup]")?.dataset.state==="done"')
   result=p.evaluate('''()=>{const f=window.__pixel.cleanupUI.state().result.frames[0],c=document.createElement('canvas');c.width=f.width;c.height=f.height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.data),f.width,f.height),0,0);return c.toDataURL('image/png').split(',')[1]}''')
   raw=base64.b64decode(result);name=f'{sampler}-{algorithm}.png';(OUT/name).write_bytes(raw)
   decoded=Image.open(BytesIO(raw)).convert('RGB');a=np.asarray(decoded,dtype=np.float32)
   row={'sampler':sampler,'palette':algorithm,'colours':len(set(decoded.getdata())),'box_rgb_rmse':round(float(np.sqrt(np.mean((a-reference)**2))),2)}
   assert decoded.size==(32,32) and row['colours']<=16
   rows.append(row);pictures.append((name,decoded.resize((256,256),Image.Resampling.NEAREST)))
 browser.close()
sheet=Image.new('RGB',(5*276,3*288),'#f4f4f4');draw=ImageDraw.Draw(sheet)
for i,(name,im) in enumerate(pictures):
 x=(i//3)*276;y=(i%3)*288;sheet.paste(im,(x,y+20));draw.text((x+4,y+2),name,fill='black')
sheet.save(OUT/'contact-sheet.png')
(OUT/'measurements.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(rows,indent=2))
