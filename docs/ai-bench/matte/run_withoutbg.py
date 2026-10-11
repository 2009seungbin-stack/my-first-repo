"""withoutbg open-weights model (Apache-2.0, pip `withoutbg`), library defaults. Run in its own venv (it pins onnxruntime CPU).
Usage: python run_withoutbg.py <corpus> <out-dir>"""
import sys,json,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));from cases import matte_cases
from withoutbg import WithoutBG
root,out=Path(sys.argv[1]),Path(sys.argv[2]);od=out/'withoutbg';od.mkdir(parents=True,exist_ok=True)
m=WithoutBG.open_weights();times={}
for c in matte_cases(root):
    t=time.perf_counter();im=m.remove_background(str(root/c['input']));times[c['id']]=time.perf_counter()-t
    im.save(od/(c['id']+'.png'))
(od/'timing.json').write_text(json.dumps({'provider':'CPU (withoutbg default)','seconds':times},indent=1));print('withoutbg',len(times))
