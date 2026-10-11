"""Stratified sample from DiffusionDB 2M (CC0-1.0, poloclub/diffusiondb) by prompt keywords.
Usage: python fetch_diffusiondb.py <corpus-dir>   (needs _src/diffusiondb-metadata.parquet)
Writes images/ddb-<kind>-<n>.png and appends rows to _src/diffusiondb-picked.json."""
import sys,json,hashlib,random,collections
from pathlib import Path
import pyarrow.parquet as pq
from remotezip import open_zip
ROOT=Path(sys.argv[1]);SRC=ROOT/'_src';IMG=ROOT/'images';IMG.mkdir(exist_ok=True)
URL='https://huggingface.co/datasets/poloclub/diffusiondb/resolve/main/images/part-{:06d}.zip'
# kind -> (regex on lowercased prompt, how many). Over-sampled ×2: a visual screen drops unsuitable ones.
KINDS={
 'sticker':(r'sticker',24),
 'whitebg':(r'white background',24),
 'green':(r'green screen|chroma key|green background',12),
 'anime':(r'\banime\b',16),
 'ghibli':(r'ghibli',16),
 'product':(r'product photo|product shot|figurine|action figure|funko|vinyl toy',16),
 'pixel':(r'pixel art|pixelart|16-bit sprite|8-bit sprite',36),
 'fur':(r'fluffy|furry',12),
 'wallpaper':(r'wallpaper',8),
}
t=pq.read_table(SRC/'diffusiondb-metadata.parquet',columns=['image_name','prompt','part_id','width','height','user_name','image_nsfw','prompt_nsfw']).to_pandas()
t=t[(t.image_nsfw<0.1)&(t.prompt_nsfw<0.1)]
lo=t.prompt.str.lower()
rng=random.Random(20261011);picked=[];used=set()
for kind,(rx,n) in KINDS.items():
    cand=t[lo.str.contains(rx,regex=True)]
    rows=cand.sample(frac=1,random_state=rng.randrange(1<<30)).to_dict('records')
    per_user=collections.Counter();k=0
    for r in rows:
        if k>=n:break
        if r['image_name'] in used or per_user[r['user_name']]>=1:continue
        per_user[r['user_name']]+=1;used.add(r['image_name']);k+=1
        picked.append({**r,'kind':kind,'id':f'ddb-{kind}-{k:02d}'})
by_part=collections.defaultdict(list)
for r in picked:by_part[r['part_id']].append(r)
out=[]
for part,rows in sorted(by_part.items()):
    z=open_zip(URL.format(part))
    for r in rows:
        data=z.read(r['image_name']);path=IMG/(r['id']+'.png');path.write_bytes(data)
        out.append({'id':r['id'],'file':path.name,'kind_hint':r['kind'],'source':'DiffusionDB 2M (Stable Diffusion 1.x, 2022)','url':URL.format(part)+'#'+r['image_name'],
            'license':'CC0-1.0','prompt':r['prompt'],'width':int(r['width']),'height':int(r['height']),'sha256':hashlib.sha256(data).hexdigest()})
        print(r['id'],len(data),flush=True)
(SRC/'diffusiondb-picked.json').write_text(json.dumps(out,indent=1,ensure_ascii=False),encoding='utf-8')
