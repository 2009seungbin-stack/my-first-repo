"""Review sheet: source | truth cut-out over magenta (ignored area hatched grey). python review_truth.py <corpus> <out.jpg> [ids...]"""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
R=Path(sys.argv[1]);man=json.loads((R/'manifest.json').read_text('utf-8'));ids=sys.argv[3:]
rows=[r for r in man['items'] if (r['id'] in ids if ids else str(r.get('truth',{}).get('method','')).startswith(('flatbg','alpha')))]
T=200;sheet=Image.new('RGB',(4*(2*T+8),((len(rows)+3)//4)*(T+14)),(90,90,90));dr=ImageDraw.Draw(sheet)
for k,r in enumerate(rows):
    im=Image.open(R/'images'/r['file']).convert('RGBA');src=Image.alpha_composite(Image.new('RGBA',im.size,(255,255,255,255)),im).convert('RGB')
    a=np.asarray(Image.open(R/r['truth']['file']).convert('L'),np.float32)/255;fg=np.asarray(Image.open(R/'fg'/f"{r['id']}.png").convert('RGBA'))[...,:3].astype(np.float32)
    out=fg*a[...,None]+np.array([255,0,255],np.float32)*(1-a[...,None])
    ig=R/'ignore'/f"{r['id']}.png"
    if ig.exists():
        m=np.asarray(Image.open(ig))>0;yy,xx=np.mgrid[:m.shape[0],:m.shape[1]];out[m&(((xx+yy)//6)%2==0)]=(128,128,128)
    o=Image.fromarray(out.clip(0,255).astype(np.uint8));src.thumbnail((T,T));o.thumbnail((T,T))
    x=(k%4)*(2*T+8);y=(k//4)*(T+14);sheet.paste(src,(x,y));sheet.paste(o,(x+T,y));dr.text((x+2,y+T),f"{r['id']} {r['truth'].get('ignored_pct','')}",fill=(255,255,0))
sheet.save(sys.argv[2],quality=88);print(len(rows))
