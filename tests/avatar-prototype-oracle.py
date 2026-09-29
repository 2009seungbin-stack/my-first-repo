"""Independent Pillow comparison of JS logical pixels with approved CC0 study PNGs."""
import base64
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
COMBOS=[
    {'face':'round','hair':'bob','eyes':'bright','outfit':'hoodie','hairPalette':'dark','outfitPalette':'blue'},
    {'face':'angular','hair':'bob','eyes':'bright','outfit':'hoodie','hairPalette':'dark','outfitPalette':'blue'},
    {'face':'round','hair':'swept','eyes':'bright','outfit':'jacket','hairPalette':'red','outfitPalette':'gold'},
    {'face':'round','hair':'swept','eyes':'sleepy','outfit':'jacket','hairPalette':'red','outfitPalette':'gold'},
]
code="""import {renderLogical} from './src/avatar/render.js';
const combos=JSON.parse(process.argv[1]);
console.log(JSON.stringify(combos.map(c=>Buffer.from(renderLogical(c).data).toString('base64'))));
"""
result=subprocess.run(['node','--input-type=module','-e',code,json.dumps(COMBOS)],cwd=ROOT,capture_output=True,text=True,check=True)
for i,encoded in enumerate(json.loads(result.stdout),1):
    with Image.open(ROOT/f'docs/avatar-prototype/output/avatar-{i}-16.png') as image:
        assert image.mode=='RGBA' and image.size==(16,16)
        assert image.tobytes()==base64.b64decode(encoded),f'avatar {i} differs from approved prototype'
print('Four JS logical avatars match independently reopened CC0 prototype PNGs, byte for byte.')
