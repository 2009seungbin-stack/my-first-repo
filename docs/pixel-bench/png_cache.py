"""Decodes every non-PNG benchmark input (JPEG) to an RGBA PNG in _pngcache/, so the Node runner can
read it (the browser decodes JPEG itself; Node has no JPEG decoder)."""
import json,os
from PIL import Image
DATA=r'C:\Users\2009s\nerulio-asset-corpus\_adhoc\nerulio-studio-pixel'
OUT=os.path.join(os.path.dirname(__file__),'_pngcache');os.makedirs(OUT,exist_ok=True)
for c in json.load(open(os.path.join(DATA,'cases.json'),encoding='utf-8'))['cases']:
    p=os.path.join(DATA,c['path'])
    if p.lower().endswith('.png'):continue
    Image.open(p).convert('RGBA').save(os.path.join(OUT,c['id']+'.png'))
    print(c['id'])
