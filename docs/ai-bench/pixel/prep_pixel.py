"""Raw RGBA inputs for the Node runner: <cache>/<id>.rgba + index.json.
  python prep_pixel.py <corpus> <cache>            AI-300 items whose use includes 'pixel'
  python prep_pixel.py --cases <data-dir> <cache>  every case of a docs/pixel-bench style cases.json (ids kept)"""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image
def dump(rows,cache):
    cache.mkdir(parents=True,exist_ok=True);idx=[]
    for rid,path in rows:
        im=Image.open(path).convert('RGBA');(cache/f'{rid}.rgba').write_bytes(np.asarray(im).tobytes());idx.append({'id':rid,'w':im.width,'h':im.height})
    (cache/'index.json').write_text(json.dumps(idx));print(len(idx))
if sys.argv[1]=='--cases':
    d=Path(sys.argv[2]);cs=json.loads((d/'cases.json').read_text())['cases'];dump([(c['id'],d/c['path']) for c in cs],Path(sys.argv[3]))
else:
    root=Path(sys.argv[1]);man=json.loads((root/'manifest.json').read_text('utf-8'))
    dump([(r['id'],root/'images'/r['file']) for r in man['items'] if 'pixel' in r['use']],Path(sys.argv[2]))
