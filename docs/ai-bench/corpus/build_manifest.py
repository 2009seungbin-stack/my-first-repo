"""Merge the fetchers' records into ai-300/manifest.json with screening decisions, per-item kind and use.
Usage: python build_manifest.py <corpus-dir>. Decisions below were made by looking at contact sheets
(contact.py) on 2026-10-11; reasons are recorded per excluded id."""
import sys,json,hashlib
from pathlib import Path
from collections import Counter
from PIL import Image
ROOT=Path(sys.argv[1]);SRC=ROOT/'_src'
rows=[]
for f in ('diffusiondb-picked.json','commons-picked.json','dalle3-toonout-picked.json','oga-picked.json'):rows+=json.loads((SRC/f).read_text('utf-8'))
EXCLUDE={
 'wc-chatgpt-01':'chart','wc-chatgpt-04':'diagram','wc-chatgpt-08':'labelled diagram','wc-chatgpt-10':'infographic','wc-chatgpt-17':'logo/text card',
 'wc-chatgpt-19':'chart','wc-icon-12':'infographic','wc-gemini-08':'UI screenshot','wc-chatgpt-05':'body-focused photo','wc-chatgpt-06':'likeness of a historical person',
 'wc-dalle-09':'body-focused','wc-character-09':'romantic scene, not needed','wc-portrait-02':'possible real-person likeness','wc-portrait-03':'politician likeness',
 'ddb-whitebg-19':'real politician likeness','ddb-wallpaper-04':'politician likeness','ddb-green-02':'real-person likeness','ddb-sticker-12':'real-person likeness',
 'ddb-sticker-24':'real-person likeness','d3-05':'religious-group stereotype',
}
def kinds(prefix,pairs):return {f'{prefix}-{i:02d}':k for i,k in pairs}
# upscale content classes (by eye): ill = anime/cartoon/flat illustration, photo = photoreal or 3D render,
# paint = painterly, text = text-heavy graphic or comic
UPK={**kinds('wc-character',[(1,'ill'),(2,'ill'),(3,'ill'),(4,'ill'),(5,'ill'),(6,'photo'),(7,'ill'),(8,'ill'),(10,'photo'),(11,'ill'),(12,'photo'),(13,'ill'),(14,'paint'),(15,'photo'),(16,'ill')]),
 **kinds('wc-chatgpt',[(2,'paint'),(3,'text'),(7,'photo'),(9,'text'),(11,'ill'),(12,'ill'),(13,'ill'),(14,'ill'),(15,'text'),(16,'photo'),(18,'text'),(20,'ill'),(21,'ill'),(22,'paint')]),
 **kinds('wc-dalle',[(1,'paint'),(2,'ill'),(3,'ill'),(4,'ill'),(5,'paint'),(6,'photo'),(7,'photo'),(8,'ill'),(10,'photo')]),
 **kinds('wc-flux',[(1,'photo'),(2,'photo'),(3,'photo'),(4,'photo'),(5,'photo'),(6,'photo'),(7,'photo'),(8,'photo'),(9,'ill'),(10,'photo')]),
 **kinds('wc-gemini',[(1,'photo'),(2,'photo'),(3,'ill'),(4,'photo'),(5,'text'),(6,'ill'),(7,'photo'),(9,'ill'),(10,'paint'),(11,'photo'),(12,'ill'),(13,'photo'),(14,'photo'),(15,'ill'),(16,'ill'),(17,'photo'),(18,'photo')]),
 **kinds('wc-icon',[(1,'ill'),(2,'text'),(3,'ill'),(4,'ill'),(5,'ill'),(6,'ill'),(7,'ill'),(8,'ill'),(9,'ill'),(10,'ill'),(11,'ill')]),
 **kinds('wc-midjourney',[(1,'photo'),(2,'photo'),(3,'paint'),(4,'photo'),(5,'paint'),(6,'paint'),(7,'photo'),(8,'photo'),(9,'photo'),(10,'photo'),(11,'photo'),(12,'paint'),(13,'photo'),(14,'photo'),(15,'photo'),(16,'paint')]),
 **kinds('wc-portrait',[(1,'paint'),(4,'photo'),(5,'paint'),(6,'photo'),(7,'paint')]),
 **kinds('wc-sdxl',[(1,'photo'),(2,'photo'),(3,'photo'),(4,'photo'),(5,'photo'),(6,'photo'),(7,'paint'),(8,'photo'),(9,'photo'),(10,'photo'),(11,'paint'),(12,'photo')]),
 **kinds('d3',[(1,'ill'),(2,'paint'),(3,'ill'),(4,'photo'),(6,'photo'),(7,'ill'),(8,'paint'),(9,'ill'),(10,'ill'),(11,'photo'),(12,'ill'),(13,'ill'),(14,'ill'),(15,'photo'),(16,'photo'),(17,'photo'),(18,'photo'),(19,'photo'),(20,'photo'),(21,'photo'),(22,'photo'),(23,'photo'),(24,'ill'),(25,'photo'),(26,'ill'),(27,'ill'),(28,'photo'),(29,'photo'),(30,'photo')]),
}
ALPHA={'wc-character-02','wc-chatgpt-11','wc-chatgpt-16','wc-dalle-02','wc-icon-01','wc-icon-03','wc-icon-04','wc-icon-06','wc-icon-07','wc-icon-10','wc-icon-11','wc-sdxl-01'}
# flat-backdrop candidates; build_truth.py derives their truth, review drops bad ones (_src/reject-truth.json)
FLAT={'ddb-whitebg-06','ddb-whitebg-10','ddb-whitebg-13','ddb-whitebg-15','ddb-whitebg-22','ddb-product-03','ddb-product-06','ddb-sticker-04','ddb-sticker-07',
 'ddb-sticker-08','ddb-sticker-14','ddb-sticker-22','ddb-green-04','ddb-pixel-03','wc-gemini-01','wc-gemini-02','wc-gemini-03','wc-gemini-06','wc-gemini-11','wc-gemini-13',
 'wc-character-05','wc-character-07','wc-character-08','wc-character-11','wc-chatgpt-21','wc-icon-02','wc-icon-05','wc-icon-08'}
REJECT=json.loads((SRC/'reject-truth.json').read_text()) if (SRC/'reject-truth.json').exists() else {}
# natural-background items for the visual (no-truth) matte comparison
VISUAL={'wc-portrait-04','wc-portrait-06','wc-gemini-18','wc-dalle-06','d3-06','d3-07','d3-11','d3-13','d3-14','wc-character-16','wc-character-01','wc-flux-06',
 'ddb-fur-01','ddb-fur-10','ddb-fur-12','ddb-anime-11','ddb-product-10','ddb-product-11','wc-midjourney-08','wc-sdxl-06'}
old={r['id']:r for r in json.loads((ROOT/'manifest.json').read_text('utf-8'))['items']} if (ROOT/'manifest.json').exists() else {}
items=[];excluded=[]
for r in rows:
    if r['id'] in EXCLUDE:excluded.append({'id':r['id'],'reason':EXCLUDE[r['id']]});continue
    p=ROOT/'images'/r['file'];data=p.read_bytes();im=Image.open(p)
    r['sha256']=hashlib.sha256(data).hexdigest();r['width'],r['height']=im.size;r['bytes']=len(data)
    use=[];kh=r['kind_hint'];prev=old.get(r['id'],{}).get('truth',{})
    if kh.startswith('anime-toonout'):
        r['kind']='anime-character';r['matte_kind']='anime';use.append('matte');r['truth']['method']='human: ToonOut annotation'
    if r['id'] in ALPHA:
        r['kind']='transparent-output';r['matte_kind']='sheet';use.append('matte');r['truth']={**prev,'method':'alpha: published transparent PNG'}
    if r['id'] in FLAT:
        if r['id'] in REJECT:r['truth_rejected']=REJECT[r['id']]
        else:r['matte_kind']='sheet';use.append('matte');r['truth']={**prev,'method':'flatbg: known-backdrop matting (build_truth.py)'}
    if r['id'] in VISUAL:use.append('matte-visual')
    if r['id'] in UPK and min(im.size)>=500:use.append('upscale');r['upscale_kind']=UPK[r['id']]
    if r['id'].startswith(('ddb-pixel','wc-pixel','oga-')):use.append('pixel')
    r.setdefault('kind',kh);r['use']=sorted(set(use));items.append(r)
man={'name':'Nerulio AI-300 (openly licensed AI outputs)','built':'2026-10-11','count':len(items),'excluded':excluded,
 'sources':{'DiffusionDB 2M':'CC0-1.0 - https://huggingface.co/datasets/poloclub/diffusiondb','Wikimedia Commons':'public domain (PD-algorithm and similar) - per-file page in url',
  'DALL-E 3 1M captions':'MIT (dataset) - https://huggingface.co/datasets/ProGamerGov/synthetic-dataset-1m-dalle3-high-quality-captions',
  'OpenGameArt':'CC0-1.0 - AI-generated pixel art; tool named on each page (url)',
  'ToonOut':'CC-BY-4.0 - https://huggingface.co/datasets/joelseytre/toonout (Muratori, Seytre, Aubourg; arXiv:2509.06839)'},
 'items':items}
(ROOT/'manifest.json').write_text(json.dumps(man,indent=1,ensure_ascii=False),encoding='utf-8')
print(len(items),'items',len(excluded),'excluded',Counter(u for r in items for u in r['use']))
