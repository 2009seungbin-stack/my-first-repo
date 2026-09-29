"""Review exact authored blink and shoulder-breath frames at real small sizes."""
import base64
import json
import subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results/avatar'
OUT.mkdir(parents=True,exist_ok=True)
code="""import {renderLogical,renderMotionFrame} from './src/avatar/render.js';
const state={face:'round',hair:'swept',eyes:'bright',outfit:'jacket',hairPalette:'red',outfitPalette:'gold'};
console.log(JSON.stringify([renderLogical(state),renderMotionFrame(state,'blink'),renderMotionFrame(state,'breathe')].map(x=>Buffer.from(x.data).toString('base64'))));
"""
raw=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,capture_output=True,text=True,check=True).stdout
images=[Image.frombytes('RGBA',(16,16),base64.b64decode(s)) for s in json.loads(raw)]
sheet=Image.new('RGB',(510,280),'#e8eef0')
draw=ImageDraw.Draw(sheet)
for row,size in enumerate([32,64]):
    draw.text((12,35+row*130),f'{size}px',font=ImageFont.load_default(),fill='#223047')
    for col,image in enumerate(images):
        x=70+col*140;y=12+row*130
        draw.rectangle((x-5,y-5,x+68,y+68),fill='white')
        scaled=image.resize((size,size),Image.Resampling.NEAREST)
        sheet.paste(scaled,(x,y),scaled)
for col,label in enumerate(['base','blink','breathe']):draw.text((70+col*140,258),label,font=ImageFont.load_default(),fill='#223047')
sheet.save(OUT/'motion-32-64.png')
assert len({image.tobytes() for image in images})==3
print(OUT/'motion-32-64.png')
