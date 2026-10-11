"""Run 4x super-resolution engines on a list of PNG inputs (competitors + candidate models).
Usage: python run_sr.py <in-dir> <out-dir> <engine> [...]  (inputs = every *.png in in-dir)
Engines: lanczos, onnx:<file.onnx> (SRVGG/RRDB: RGB 0..1 in/out, tiles 256 + 24 px overlap, centre crop),
waifu2x:<onnx> (swin_unet 4x: reference offset 32 / tile 400, replication padding), upscayl:<model> (upscayl-bin, Vulkan).
Timings in <out-dir>/<engine-name>/timing.json. Models: $AIC_SR (default scratch/aic-bench)."""
import sys,os,json,time,subprocess,shutil
from pathlib import Path
import numpy as np
from PIL import Image
W=Path(os.environ.get('AIC_SR','C:/Users/2009s/nerulio-handoff/scratch/aic-bench'))
def name_of(e):return e.replace(':','-').replace('/','_').replace('.onnx','')
_sess={}
def session(path):
    import onnxruntime as ort
    if path not in _sess:_sess[path]=ort.InferenceSession(str(path),providers=['DmlExecutionProvider','CPUExecutionProvider'])
    return _sess[path]
def tiled(x,run,scale,tile=256,ov=24,unit=1):
    """x: HxWx3 float; run(tile CHW batch)->(1,3,h*s,w*s)"""
    H,Wd,_=x.shape;out=np.zeros((H*scale,Wd*scale,3),np.float32)
    pad=np.pad(x,((ov,ov+tile),(ov,ov+tile),(0,0)),mode='reflect')
    for y in range(0,H,tile):
        for x0 in range(0,Wd,tile):
            t=pad[y:y+tile+2*ov,x0:x0+tile+2*ov]
            r=run(t.transpose(2,0,1)[None].astype(np.float32))[0].transpose(1,2,0)
            h=min(tile,H-y);w=min(tile,Wd-x0)
            out[y*scale:(y+h)*scale,x0*scale:(x0+w)*scale]=r[ov*scale:(ov+h)*scale,ov*scale:(ov+w)*scale]
    return out
def run_onnx(img,f):
    s=session(W/'sr-models'/f);n=s.get_inputs()[0].name
    x=np.asarray(img,np.float32)/255;return tiled(x,lambda t:s.run(None,{n:t})[0],4)
def run_waifu2x(img,f):
    s=session(W/'competitors'/'waifu2x'/'onnx_models'/f);n=s.get_inputs()[0].name
    x=np.asarray(img,np.float32)/255;T=400;off=8  # 400 is an allowed swin_unet tile; output loses 32 px (= 8 input px) per side
    H,Wd,_=x.shape;step=T-2*off;out=np.zeros((H*4,Wd*4,3),np.float32)
    pad=np.pad(x,((off,off+T),(off,off+T),(0,0)),mode='edge')
    for y in range(0,H,step):
        for x0 in range(0,Wd,step):
            t=pad[y:y+T,x0:x0+T].transpose(2,0,1)[None]
            r=s.run(None,{n:t})[0][0].transpose(1,2,0)  # (T*4-64)^2 covering input [off, T-off)
            h=min(step,H-y);w=min(step,Wd-x0);out[y*4:(y+h)*4,x0*4:(x0+w)*4]=r[:h*4,:w*4]
    return out
def run_upscayl(src,dst,model):
    b=W/'competitors'/'upscayl'/'resources'/'bin'/'upscayl-bin.exe';m=W/'competitors'/'upscayl'/'resources'/'models'
    subprocess.run([str(b),'-i',str(src),'-o',str(dst),'-s','4','-m',str(m),'-n',model,'-f','png'],check=True,capture_output=True)
if __name__=='__main__':
    ind,outd=Path(sys.argv[1]),Path(sys.argv[2])
    files=sorted(ind.glob('*.png'))
    for e in sys.argv[3:]:
        od=outd/name_of(e);od.mkdir(parents=True,exist_ok=True);times={}
        for f in files:
            dst=od/f.name
            if dst.exists():continue
            img=Image.open(f).convert('RGB');t=time.perf_counter()
            if e=='lanczos':img.resize((img.width*4,img.height*4),Image.LANCZOS).save(dst)
            elif e.startswith('upscayl:'):run_upscayl(f,dst,e.split(':',1)[1])
            else:
                y=run_onnx(img,e.split(':',1)[1]) if e.startswith('onnx:') else run_waifu2x(img,e.split(':',1)[1])
                Image.fromarray((np.clip(y,0,1)*255+.5).astype(np.uint8)).save(dst)
            times[f.stem]=time.perf_counter()-t
        old=json.loads((od/'timing.json').read_text()) if (od/'timing.json').exists() else {}
        (od/'timing.json').write_text(json.dumps({**old,**times},indent=1));print(e,len(times),flush=True)
