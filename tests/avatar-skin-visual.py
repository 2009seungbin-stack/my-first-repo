"""Render authored skin ramps as a 32/48/64 review sheet without a browser."""
import base64
import json
import subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results/avatar'
OUT.mkdir(parents=True,exist_ok=True)
code="""import {renderLogical} from './src/avatar/render.js';
console.log(JSON.stringify(['skin','skinTan','skinDeep'].map(s=>Buffer.from(renderLogical({skinPalette:s}).data).toString('base64'))));
"""
raw=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,capture_output=True,text=True,check=True).stdout
images=[Image.frombytes('RGBA',(16,16),base64.b64decode(s)) for s in json.loads(raw)]
sheet=Image.new('RGB',(475,365),'#e8eef0')
draw=ImageDraw.Draw(sheet)
for y,size in enumerate([32,48,64]):
    draw.text((15,30+y*108),f'{size}px',fill='#223047',font=ImageFont.load_default())
    for x,source in enumerate(images):
        scaled=source.resize((size,size),Image.Resampling.NEAREST)
        ox=86+x*128;oy=18+y*108
        draw.rectangle((ox-5,oy-5,ox+69,oy+69),fill='white')
        sheet.paste(scaled,(ox,oy),scaled)
for x,name in enumerate(['light','tan','deep']):draw.text((86+x*128,342),name,fill='#223047',font=ImageFont.load_default())
sheet.save(OUT/'skin-32-48-64.png')
assert all(images[0].tobytes()!=im.tobytes() for im in images[1:])
assert images[1].tobytes()!=images[2].tobytes()
print(OUT/'skin-32-48-64.png')
