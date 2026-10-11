"""Raw RGBA of the AI-300 'pixel' items for the Node runners: <cache>/<id>.rgba + index.json. python prep_pixel.py <corpus> <cache>"""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image
root,cache=Path(sys.argv[1]),Path(sys.argv[2]);cache.mkdir(parents=True,exist_ok=True)
man=json.loads((root/'manifest.json').read_text('utf-8'));idx=[]
for r in man['items']:
    if 'pixel' not in r['use']:continue
    im=Image.open(root/'images'/r['file']).convert('RGBA');(cache/f"{r['id']}.rgba").write_bytes(np.asarray(im).tobytes());idx.append({'id':r['id'],'w':im.width,'h':im.height,'file':r['file']})
(cache/'index.json').write_text(json.dumps(idx));print(len(idx))
