"""Visual sheet: input | truth | each tool's cut-out, on a dark checker (halos show) — python compare_sheet.py <corpus> <out-dir> <out.jpg> <ids,> <model> [...]"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,str(Path(__file__).parent));from cases import matte_cases
root,od,dst,ids=Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3],sys.argv[4].split(',');models=sys.argv[5:];T=int(__import__('os').environ.get('THUMB','260'))
cs={c['id']:c for c in matte_cases(root)};rows=[cs[i] for i in ids]
cols=2+len(models);sheet=Image.new('RGB',(cols*T,len(rows)*(T+14)),(40,40,40));dr=ImageDraw.Draw(sheet)
def board(w,h):
    yy,xx=np.mgrid[:h,:w];return np.where(((xx//12+yy//12)%2)[...,None]==0,[30,30,40],[60,30,60]).astype(np.float32)
def cut(rgb,a):
    return Image.fromarray((rgb*a[...,None]+board(rgb.shape[1],rgb.shape[0])*(1-a[...,None])).clip(0,255).astype(np.uint8))
for r,c in enumerate(rows):
    src=Image.open(root/c['input']).convert('RGB');s=np.asarray(src,np.float32)
    t=np.asarray(Image.open(root/c['truth']).convert('L'),np.float32)/255
    fgp=root/'fg'/f"{c['id'].split('@')[0]}.png";fg=np.asarray(Image.open(fgp).convert('RGB'),np.float32) if fgp.exists() else s
    tiles=[src,cut(fg,t)]
    for m in models:
        im=Image.open(od/m/f"{c['id']}.png")
        if im.mode in('RGBA','LA') or (im.mode=='P' and 'transparency' in im.info):a=np.asarray(im.convert('RGBA'),np.float32);tiles.append(cut(a[...,:3],a[...,3]/255))
        else:tiles.append(cut(s,np.asarray(im.convert('L'),np.float32)/255))
    for k,tile in enumerate(tiles):
        crop=__import__('os').environ.get('CROP')
        if crop:x0,y0,x1,y1=[float(v) for v in crop.split(':')];tile=tile.crop((int(x0*tile.width),int(y0*tile.height),int(x1*tile.width),int(y1*tile.height)))
        tile.thumbnail((T,T));sheet.paste(tile,(k*T,r*(T+14)))
        dr.text((k*T+2,r*(T+14)+T),(['input','truth']+models)[k][:30]+('  '+c['id'] if k==0 else ''),fill=(255,255,0))
sheet.save(dst,quality=90);print(dst)
