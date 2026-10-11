"""Full-reference upscale scores: python score_sr.py <work> <engine-dir-name> [...]
Compares <work>/fr/out/<engine>/<id>.png (4x of fr/lr) with fr/hr/<id>.png. Per image: PSNR and SSIM on luma (Y of
BT.601, 4-px border shaved, as SR papers do), LPIPS (AlexNet, v0.1; lower is better; perceptual) on RGB. Aggregates per
content class (ill / photo / paint / text) and overall -> <work>/fr/out/<engine>/scores.json."""
import sys,json
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity
import torch,lpips
torch.set_num_threads(8)
work=Path(sys.argv[1]);cases=json.loads((work/'sr-cases.json').read_text())['fr'];net=lpips.LPIPS(net='alex',verbose=False)
def y(a):return 16+(65.481*a[...,0]+128.553*a[...,1]+24.966*a[...,2])/255
for eng in sys.argv[2:]:
    d=work/'fr'/'out'/eng;rows=[]
    for c in cases:
        p=d/f"{c['id']}.png"
        if not p.exists():continue
        hr=np.asarray(Image.open(work/'fr'/'hr'/f"{c['id']}.png").convert('RGB'),np.float32);sr=np.asarray(Image.open(p).convert('RGB'),np.float32)
        sr=sr[:hr.shape[0],:hr.shape[1]];s=4;Y1,Y2=y(hr)[s:-s,s:-s],y(sr)[s:-s,s:-s]
        mse=float(((Y1-Y2)**2).mean());psnr=10*np.log10(255**2/max(mse,1e-10));ssim=structural_similarity(Y1,Y2,data_range=255)
        t=lambda a:torch.from_numpy(a/127.5-1).permute(2,0,1)[None].float()
        with torch.no_grad():lp=float(net(t(hr),t(sr)))
        rows.append({'id':c['id'],'kind':c['kind'],'psnr':psnr,'ssim':float(ssim),'lpips':lp})
    agg={}
    for k in ['ill','photo','paint','text','all']:
        rs=[r for r in rows if k=='all' or r['kind']==k]
        if rs:agg[k]={'n':len(rs),**{m:round(float(np.mean([r[m] for r in rs])),4) for m in ('psnr','ssim','lpips')}}
    (d/'scores.json').write_text(json.dumps({'engine':eng,'aggregate':agg,'cases':rows},indent=1));print(eng,json.dumps(agg),flush=True)
