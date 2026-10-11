"""Score background-removal outputs against AI-300 truth.
Usage: python score_matte.py <corpus> <out-dir> <model> [...]  ->  <out-dir>/<model>/scores.json and a table on stdout
A prediction is <out-dir>/<model>/<case id>.png: either 8-bit alpha (L; colour = the input, as rembg's cut-out does)
or RGBA (the tool's own colours, e.g. Nerulio's edge colour clean-up). @ in case ids is written as _ in file names.

Metrics (pixels marked IGNORE in the truth are left out of every metric):
 iou        foreground IoU after thresholding both alphas at 0.5
 mae        mean |alpha error| x 100 over the whole image
 edge       mean |alpha error| x 100 inside the boundary band (truth boundary dilated by max(3, 0.6 % of the diagonal) px)
 thin       recall of thin truth structures (foreground pixels removed by a 2-px opening: hair strands, whiskers, sparkles)
 halo       sheets + scenes only: cut-out re-composited on BLACK; mean luminance (0-255) of what the tool left in the
            ring 1-6 px OUTSIDE the truth foreground (the white or backdrop glow people see as a halo)
 recomp     sheets + scenes only: mean RGB error (0-255) of the cut-out re-composited on black vs the truth cut-out on
            black, inside the boundary band (halo + colour contamination + alpha error, i.e. what a sticker edge looks like)
 islands    extra connected pieces (alpha >= 0.5, > 16 px) beyond the truth's count (stray specks on a sticker)"""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0,str(Path(__file__).parent));from cases import matte_cases
def load_pred(path,src):
    im=Image.open(path)
    if im.size!=src.shape[1::-1]:im=im.resize(src.shape[1::-1],Image.BILINEAR)
    if im.mode in('RGBA','LA'):a=np.asarray(im.convert('RGBA'),np.float32);return a[...,3]/255,a[...,:3]
    return np.asarray(im.convert('L'),np.float32)/255,src
def pieces(mask):
    lab,n=ndi.label(mask);
    if not n:return 0
    return int((ndi.sum(mask,lab,range(1,n+1))>16).sum())
def score_case(root,c,pred_path):
    src=np.asarray(Image.open(root/c['input']).convert('RGB'),np.float32)
    t=np.asarray(Image.open(root/c['truth']).convert('L'),np.float32)/255
    ign=np.asarray(Image.open(root/c['ignore']))>0 if c.get('ignore') and (root/c['ignore']).exists() else np.zeros(t.shape,bool)
    a,rgb=load_pred(pred_path,src);valid=~ign
    T=t>=.5;P=a>=.5;inter=(T&P&valid).sum();union=((T|P)&valid).sum()
    h,w=t.shape;band_r=max(3,int(.006*np.hypot(h,w)))
    edge=T^ndi.binary_erosion(T,iterations=1);band=ndi.binary_dilation(edge,iterations=band_r)&valid
    opened=ndi.binary_opening(T,structure=np.ones((5,5)));thin=T&~opened&valid
    r={'iou':float(inter/max(union,1)),'mae':float(np.abs(a-t)[valid].mean()*100),'edge':float(np.abs(a-t)[band].mean()*100) if band.any() else 0.0,
       'thin':float((P&thin).sum()/thin.sum()) if thin.sum()>=50 else None,'islands':max(0,pieces(P&valid)-pieces(T&valid))}
    if c['group']!='anime':
        fgp=root/'fg'/f"{c['id'].split('@')[0]}.png";fg=np.asarray(Image.open(fgp).convert('RGB'),np.float32)
        outside=ndi.binary_dilation(T,iterations=6)&~ndi.binary_dilation(t>0.02,iterations=1)&valid
        lum=(a[...,None]*rgb).mean(2)
        r['halo']=float(lum[outside].mean()) if outside.any() else 0.0
        r['recomp']=float(np.abs(a[...,None]*rgb-t[...,None]*fg)[band].mean()) if band.any() else 0.0
    return r
def aggregate(rows):
    out={}
    for g in ['anime','sheet','scene','all']:
        rs=[r for r in rows if g=='all' or r['group']==g]
        if not rs:continue
        agg={'n':len(rs)}
        for k in ['iou','mae','edge','thin','halo','recomp','islands']:
            v=[r[k] for r in rs if r.get(k) is not None]
            if v:agg[k]=round(float(np.mean(v)),4 if k=='iou' else 3)
        agg['iou<0.9']=sum(r['iou']<.9 for r in rs);out[g]=agg
    return out
if __name__=='__main__':
    root,outd=Path(sys.argv[1]),Path(sys.argv[2]);cases=matte_cases(root)
    for m in sys.argv[3:]:
        rows=[]
        for c in cases:
            p=outd/m/(c['id'].replace('@','_')+'.png')
            if not p.exists():p=outd/m/(c['id']+'.png')
            if not p.exists():rows.append({'id':c['id'],'group':c['group'],'missing':True});continue
            rows.append({'id':c['id'],'group':c['group'],**score_case(root,c,p)})
        ok=[r for r in rows if not r.get('missing')];agg=aggregate(ok)
        (outd/m/'scores.json').write_text(json.dumps({'model':m,'missing':len(rows)-len(ok),'aggregate':agg,'cases':rows},indent=1))
        print(m,'missing',len(rows)-len(ok),json.dumps(agg))
