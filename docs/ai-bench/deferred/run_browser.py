"""Run Nerulio's real engines in Chrome on AI-300 cases (WebGPU or WASM) and save the outputs for the scorers.
Usage:
  python run_browser.py matte <out-dir>/<name> '<options json>' [--wasm] [--ids a,b]   (cases: matte/cases.py)
  python run_browser.py sr <in-dir> <out-dir>/<name> '<options json>' [--wasm]          (every *.png in in-dir)
Serves this worktree with tools/serve.mjs on $PORT (default 4703); corpus files are routed under /__corpus/.
GPU runs use the installed Chrome (Playwright's bundled Chromium cannot create a D3D12 device on Windows).
Each output folder gets run.json: browser version, backend, per-case time and the engine's processing report."""
import sys,os,json,base64,subprocess,time,socket,urllib.request,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];sys.path.insert(0,str(HERE.parent/'matte'))
CORPUS=Path(os.environ.get('AI300','C:/Users/2009s/nerulio-asset-corpus/ai-300'))
ap=argparse.ArgumentParser();ap.add_argument('kind');ap.add_argument('a');ap.add_argument('b',nargs='?');ap.add_argument('c',nargs='?')
ap.add_argument('--wasm',action='store_true');ap.add_argument('--ids');ap.add_argument('--headed',action='store_true');args=ap.parse_args()
if args.kind=='matte':
    from cases import matte_cases
    out=Path(args.a);opts=json.loads(args.b or '{}');jobs=[(c['id'],(CORPUS/c['input'])) for c in matte_cases(CORPUS)]
else:
    ind=Path(args.a);out=Path(args.b);opts=json.loads(args.c or '{}');jobs=[(p.stem,p) for p in sorted(ind.glob('*.png'))]
if args.ids:keep=set(args.ids.split(','));jobs=[j for j in jobs if j[0] in keep]
out.mkdir(parents=True,exist_ok=True)
if args.wasm:opts['backend']='wasm'
port=int(os.environ.get('PORT','4703'))
with socket.socket() as s:
    busy=s.connect_ex(('127.0.0.1',port))==0
server=None if busy else subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try:urllib.request.urlopen(f'http://127.0.0.1:{port}/en/',timeout=1);break
        except OSError:time.sleep(.2)
    files={}
    with sync_playwright() as pw:
        prof=Path(os.environ.get('AIC_PROFILE','C:/Users/2009s/nerulio-handoff/scratch/aic-bench/chrome-profile'))
        ctx=pw.chromium.launch_persistent_context(str(prof),channel='chrome',headless=not args.headed,args=['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan'])
        page=ctx.new_page();page.set_default_timeout(int(os.environ.get('AIC_TIMEOUT','1800000')))
        if os.environ.get('AIC_CONSOLE'):page.on('console',lambda m:print('console:',m.text[:300],flush=True))
        def route(r):
            p=Path(r.request.url.split('/__corpus/',1)[1].split('?')[0]);f=files.get(str(p))
            r.fulfill(path=str(f),headers={'Cross-Origin-Resource-Policy':'same-origin','Content-Type':'image/'+('jpeg' if f.suffix.lower() in ('.jpg','.jpeg') else f.suffix.lower()[1:])}) if f else r.fulfill(status=404)
        page.route('**/__corpus/**',route);page.goto(f'http://127.0.0.1:{port}/ai-runtime/')
        gpu=page.evaluate("async()=>{const a=await navigator.gpu?.requestAdapter();return a?{vendor:a.info?.vendor,architecture:a.info?.architecture,description:a.info?.description}:null}")
        log={'browser':ctx.browser.version if ctx.browser else 'chrome','gpu':gpu,'options':opts,'cases':{}}
        for i,(cid,path) in enumerate(jobs):
            key=f'{cid}{path.suffix}';files[key]=path
            r=page.evaluate("async a=>(await import('/docs/ai-bench/deferred/ai-bench-browser.mjs')).job(a)",{'kind':'matte' if args.kind=='matte' else 'sr','data':base64.b64encode(path.read_bytes()).decode(),'options':opts})
            (out/f'{cid}.png').write_bytes(base64.b64decode(r.pop('png')));log['cases'][cid]=r
            print(i+1,len(jobs),cid,round(r['ms']),(r.get('report') or {}).get('backend'),flush=True)
        ctx.close()
    (out/'run.json').write_text(json.dumps(log,indent=1))
finally:
    if server:server.terminate()
