"""Run ONNX background-removal models (competitors and our candidates) the way their reference code does.
Usage: python run_models.py <corpus-dir> <out-dir> <model> [<model> ...]  (env MATTE_IDS=comma list to limit)
Writes <out-dir>/<model>/<id>.png = 8-bit alpha at source size, and raw/<id>.npy = model-resolution probability
for the Nerulio candidates (fed to the JS refinement). Timings go to <out-dir>/<model>/timing.json.
Models live in $AIC_MODELS (default C:/Users/2009s/nerulio-handoff/scratch/aic-bench/models)."""
import sys,os,json,time
from pathlib import Path
import numpy as np
from PIL import Image
import onnxruntime as ort
M=Path(os.environ.get('AIC_MODELS','C:/Users/2009s/nerulio-handoff/scratch/aic-bench/models'))
IMN=((0.485,0.456,0.406),(0.229,0.224,0.225))
# name: file, size, (mean,std), divide-by ('max' = rembg style, 255 = HF processors), output transform
SPECS={
 'rembg-u2net':('u2net.onnx',320,IMN,'max','minmax'),
 'rembg-isnet-general':('isnet-general-use.onnx',1024,((.5,.5,.5),(1,1,1)),'max','minmax'),
 'rembg-isnet-anime':('isnet-anime.onnx',1024,((.485,.456,.406),(1,1,1)),'max','minmax'),
 'rembg-birefnet-general':('BiRefNet-general-epoch_244.onnx',1024,IMN,'max','sigmoid-minmax'),
 'rembg-birefnet-lite':('BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx',1024,IMN,'max','sigmoid-minmax'),
 'rembg-birefnet-portrait':('BiRefNet-portrait-epoch_150.onnx',1024,IMN,'max','sigmoid-minmax'),
 'ben2':('ben2_fp16.onnx',1024,IMN,255,'auto'),
 'nerulio-lite512':('birefnet_lite_512.onnx',512,IMN,255,'sigmoid'),
 'nerulio-lite1024':('birefnet_lite_1024.onnx',1024,IMN,255,'sigmoid'),
 'nerulio-lite1024-fp16':('birefnet_lite_1024_fp16.onnx',1024,IMN,255,'sigmoid'),
 'nerulio-u2netp':('u2netp.onnx',320,IMN,255,'minmax'),
}
corpus,out=Path(sys.argv[1]),Path(sys.argv[2]);names=sys.argv[3:]
from cases import matte_cases
ids=set(os.environ['MATTE_IDS'].split(',')) if os.environ.get('MATTE_IDS') else None
items=[c for c in matte_cases(corpus) if ids is None or c['id'] in ids]
for name in names:
    f,S,(mean,std),div,post=SPECS[name]
    prov=['CPUExecutionProvider'] if os.environ.get('MATTE_CPU') else ['DmlExecutionProvider','CPUExecutionProvider']
    so=ort.SessionOptions();so.graph_optimization_level=ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess=ort.InferenceSession(str(M/f),so,providers=prov);inp=sess.get_inputs()[0];fp16='float16' in inp.type
    od=out/name;od.mkdir(parents=True,exist_ok=True);raw=od/'raw';raw.mkdir(exist_ok=True)
    times={}
    for r in items:
        src=Image.open(corpus/r['input']).convert('RGB')
        x=np.asarray(src.resize((S,S),Image.BILINEAR if div==255 else Image.LANCZOS),dtype=np.float32)
        x=x/max(float(x.max()),1e-6) if div=='max' else x/255
        x=((x-np.array(mean,np.float32))/np.array(std,np.float32)).transpose(2,0,1)[None]
        t=time.perf_counter();y=sess.run(None,{inp.name:x.astype(np.float16 if fp16 else np.float32)})[0].astype(np.float32);times[r['id']]=time.perf_counter()-t
        y=y.reshape(y.shape[-2:])
        if post=='auto':post_=('sigmoid' if (y.min()<-.01 or y.max()>1.01) else 'id')
        else:post_=post
        if 'sigmoid' in post_:y=1/(1+np.exp(-y))
        if 'minmax' in post_:y=(y-y.min())/max(y.max()-y.min(),1e-6)
        np.save(raw/(r['id']+'.npy'),y.astype(np.float16))
        a=Image.fromarray((np.clip(y,0,1)*255+.5).astype(np.uint8)).resize(src.size,Image.LANCZOS if div=='max' else Image.BILINEAR)
        a.save(od/(r['id']+'.png'))
    (od/'timing.json').write_text(json.dumps({'provider':sess.get_providers()[0],'model':f,'size':S,'seconds':times},indent=1))
    print(name,len(items),'mean s',round(float(np.mean(list(times.values()) or [0])),3),flush=True)
