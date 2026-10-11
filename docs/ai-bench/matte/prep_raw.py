"""Raw buffers for the Node refinement bench: <cache>/<id>.rgba (RGBA uint8) and <cache>/<model>/<id>.f32 (model probability).
Usage: python prep_raw.py <corpus> <matte-out> <cache> <model> [...]   (index.json lists id, w, h, prob size)"""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).parent));from cases import matte_cases
root,mo,cache=Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3]);cache.mkdir(parents=True,exist_ok=True);idx=[]
for c in matte_cases(root):
    p=cache/f"{c['id']}.rgba";im=Image.open(root/c['input']).convert('RGBA')
    if not p.exists():p.write_bytes(np.asarray(im).tobytes())
    row={'id':c['id'],'w':im.width,'h':im.height,'prob':{}}
    for m in sys.argv[4:]:
        a=np.load(mo/m/'raw'/f"{c['id']}.npy").astype(np.float32);(cache/m).mkdir(exist_ok=True);(cache/m/f"{c['id']}.f32").write_bytes(a.tobytes());row['prob'][m]=list(a.shape)
    idx.append(row)
(cache/'index.json').write_text(json.dumps(idx));print(len(idx))
