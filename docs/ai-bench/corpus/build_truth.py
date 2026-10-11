"""Ground-truth alpha for the background-removal benchmark. Three kinds, each recorded per item:
 1. human   - ToonOut test split: the dataset's hand-annotated alpha (copied by the fetcher).
 2. alpha   - AI outputs that were published as transparent PNGs (ChatGPT/DALL-E/Gemini "transparent
              background"): truth = their own alpha; the test input is their composite on white
              (sticker-sheet case) and on a real AI-generated backdrop (scene case).
 3. flatbg  - AI outputs on a flat backdrop (white sheet, chroma green, plain colour). Backdrop colour B =
              median of the 4-px border ring (rejected when the ring is not flat). d = |C-B| (RGB). Pixels
              connected to the border with d<LO are background; d>HI is solid foreground; between, within
              4 px of solid foreground, alpha = d/|F-B| with F the colour of the nearest solid pixel (known-
              backdrop matting); wider low-contrast areas (soft shadows, glows) and enclosed backdrop-coloured
              regions larger than 0.2 % of the image are marked IGNORE (value 128 in ignore/<id>.png) because
              people disagree whether they belong to the cut-out. Each truth was then inspected on a contact
              sheet (truth over magenta) and rejected items are listed in REJECT below with a reason.
Usage: python build_truth.py <corpus-dir> <ids...|all>"""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT=Path(sys.argv[1]);TR=ROOT/'truth';IG=ROOT/'ignore';CO=ROOT/'composite';FG=ROOT/'fg'
for p in (TR,IG,CO,FG):p.mkdir(exist_ok=True)
LO,HI=14.0,70.0
def flatbg(rgb):
    h,w,_=rgb.shape;ring=np.concatenate([rgb[:4].reshape(-1,3),rgb[-4:].reshape(-1,3),rgb[:,:4].reshape(-1,3),rgb[:,-4:].reshape(-1,3)]).astype(np.float32)
    B=np.median(ring,0);spread=np.percentile(np.linalg.norm(ring-B,axis=1),90)
    d=np.linalg.norm(rgb.astype(np.float32)-B,axis=2);solid=d>HI
    def from_border(mask):
        lab,n=ndi.label(mask);keep=np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]]));keep=keep[keep>0]
        return np.isin(lab,keep)
    outside=from_border(~solid)          # reachable from the border without crossing solid foreground
    bg=from_border(d<LO)                 # backdrop core
    dist,(iy,ix)=ndi.distance_transform_edt(~solid,return_indices=True)
    F=rgb[iy,ix].astype(np.float32);dF=np.maximum(np.linalg.norm(F-B,axis=2),1)
    alpha=np.ones((h,w),np.float32);ign=np.zeros((h,w),bool)
    edge=outside&~bg&(dist<=4);alpha[edge]=np.clip(d[edge]/dF[edge],0,1)
    alpha[bg]=0;shadow=outside&~bg&(dist>4);alpha[shadow]=0;ign|=shadow
    # backdrop-coloured holes enclosed by the drawing: small ones are drawing (highlights), big ones ambiguous
    hole=(d<LO)&~outside;el,en=ndi.label(hole)
    if en:
        sizes=ndi.sum(hole,el,range(1,en+1));big=np.isin(el,[i+1 for i,s in enumerate(sizes) if s>0.002*h*w])
        alpha[big]=0;ign|=ndi.binary_dilation(big,iterations=2)
    fg=np.where((alpha>0)[...,None],np.where(solid[...,None]|~outside[...,None],rgb,F),0).astype(np.uint8)
    return alpha,ign,B,spread,fg
def save(id,alpha,ign,fg):
    Image.fromarray((alpha*255+.5).astype(np.uint8)).save(TR/f'{id}.png')
    Image.fromarray((ign*128).astype(np.uint8)).save(IG/f'{id}.png')
    Image.fromarray(np.dstack([fg,(alpha*255+.5).astype(np.uint8)])).save(FG/f'{id}.png')
def composite(fg_rgba,bgfile,id):
    fgim=Image.open(fg_rgba).convert('RGBA');W,H=fgim.size
    bgim=Image.open(bgfile).convert('RGB');s=max(W/bgim.width,H/bgim.height);bgim=bgim.resize((max(W,round(bgim.width*s)),max(H,round(bgim.height*s))),Image.LANCZOS)
    x0=(bgim.width-W)//2;y0=(bgim.height-H)//2;bgim=bgim.crop((x0,y0,x0+W,y0+H)).convert('RGBA');bgim.alpha_composite(fgim)
    bgim.convert('RGB').save(CO/f'{id}.png')
if __name__=='__main__':
    man=json.loads((ROOT/'manifest.json').read_text('utf-8'))
    want=sys.argv[2:]
    for r in man['items']:
        t=r.get('truth') or {}
        if want!=['all'] and r['id'] not in want:continue
        im=Image.open(ROOT/'images'/r['file']);im.load()
        if t.get('method','').startswith('flatbg'):
            rgb=np.asarray(im.convert('RGB'));a,ign,B,spread,fg=flatbg(rgb);save(r['id'],a,ign,fg)
            t.update(file=f'truth/{r["id"]}.png',ignore=f'ignore/{r["id"]}.png',backdrop=[round(float(v)) for v in B],ring_spread=round(float(spread),1),
                     ignored_pct=round(float(ign.mean()*100),2),foreground_pct=round(float((a>.5).mean()*100),1))
        elif t.get('method','').startswith('alpha'):
            rgba=np.asarray(im.convert('RGBA'));a=rgba[...,3]/255.0;save(r['id'],a,np.zeros_like(a,bool),rgba[...,:3]*(a[...,None]>0))
            t.update(file=f'truth/{r["id"]}.png',foreground_pct=round(float((a>.5).mean()*100),1))
        r['truth']=t;print(r['id'],t.get('method'),t.get('ring_spread'),t.get('ignored_pct'),t.get('foreground_pct'))
    (ROOT/'manifest.json').write_text(json.dumps(man,indent=1,ensure_ascii=False),encoding='utf-8')
# ---- scene composites: every alpha/flatbg truth cut-out also placed on a real AI-generated backdrop
SCENES=['wc-flux-01','wc-flux-02','wc-flux-05','wc-flux-08','wc-midjourney-04','wc-midjourney-06','wc-sdxl-03','wc-sdxl-11','d3-08','d3-28','wc-chatgpt-02','ddb-wallpaper-01']
def build_composites(root):
    man=json.loads((root/'manifest.json').read_text('utf-8'));files={r['id']:r['file'] for r in man['items']};out=[];k=0
    for r in man['items']:
        m=str((r.get('truth') or {}).get('method',''))
        if 'matte' not in r['use'] or not m.startswith(('alpha','flatbg')):continue
        bg=SCENES[k%len(SCENES)];k+=1;composite(FG/f"{r['id']}.png",root/'images'/files[bg],r['id'])
        out.append({'id':r['id']+'@scene','of':r['id'],'input':f"composite/{r['id']}.png",'backdrop':bg,'truth':r['truth']['file'],'ignore':r['truth'].get('ignore'),
                    'method':'truth cut-out (fg colour + alpha) alpha-composited over the backdrop image, centre-cropped to the cut-out size'})
    man['composites']=out;(root/'manifest.json').write_text(json.dumps(man,indent=1,ensure_ascii=False),encoding='utf-8');print('composites',len(out))
if __name__=='__main__':build_composites(ROOT)
