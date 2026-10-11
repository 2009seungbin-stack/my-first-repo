"""Inputs for the upscale benchmark.
 fr/  full-reference: centre crop (<= 1024 px square-ish, multiple of 4) of every 'upscale' item = HR truth (hr/),
      reduced 4x with Pillow BICUBIC (antialiased) = the input (lr/). Engines restore 4x; compare with hr/.
 nr/  no-reference: a 384 px centre crop of 24 items (6 per content class) at ORIGINAL resolution, upscaled 4x for
      side-by-side crops and no-reference metrics (what people actually do with a 1024 px AI output).
Usage: python prep_sr.py <corpus> <work>"""
import sys,json
from pathlib import Path
from PIL import Image
root,work=Path(sys.argv[1]),Path(sys.argv[2]);man=json.loads((root/'manifest.json').read_text('utf-8'))
for d in ('fr/hr','fr/lr','nr/in'):(work/d).mkdir(parents=True,exist_ok=True)
items=[r for r in man['items'] if 'upscale' in r['use']];meta=[];per={}
for r in items:
    im=Image.open(root/'images'/r['file']);im=Image.alpha_composite(Image.new('RGBA',im.size,(255,255,255,255)),im.convert('RGBA')).convert('RGB')
    w,h=im.size;cw,ch=min(w,1024)//4*4,min(h,1024)//4*4;x0,y0=(w-cw)//2,(h-ch)//2;hr=im.crop((x0,y0,x0+cw,y0+ch))
    hr.save(work/'fr/hr'/f"{r['id']}.png");hr.resize((cw//4,ch//4),Image.BICUBIC,reducing_gap=None).save(work/'fr/lr'/f"{r['id']}.png")
    k=r['upscale_kind'];per.setdefault(k,[]).append(r['id'])
    meta.append({'id':r['id'],'kind':k,'hr':[cw,ch],'source':[w,h]})
nr=[]
for k,ids in sorted(per.items()):
    for i in ids[::max(1,len(ids)//6)][:6]:
        r=next(x for x in items if x['id']==i);im=Image.open(root/'images'/r['file']).convert('RGB');w,h=im.size;s=384
        im.crop(((w-s)//2,(h-s)//2,(w-s)//2+s,(h-s)//2+s)).save(work/'nr/in'/f"{i}.png");nr.append({'id':i,'kind':k})
(work/'sr-cases.json').write_text(json.dumps({'fr':meta,'nr':nr},indent=1));print(len(meta),'fr',len(nr),'nr',{k:len(v) for k,v in per.items()})
