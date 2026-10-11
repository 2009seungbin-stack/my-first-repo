"""Probe candidate ONNX models in Chrome (WebGPU and WASM): load, create session, time 3 runs on random input.
Usage: python probe_models.py  -> prints JSON per model/backend"""
import os,json,subprocess,socket,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];port=int(os.environ.get('PORT','4703'))
M=[{'name':'ben2-community-fp16','spec':{'id':'onnx-community/BEN2-ONNX','revision':'c552aa82688edce09f0ac9d2e31ad53d9d629010','file':'onnx/model_fp16.onnx'}},
   {'name':'ben2-prama','spec':{'id':'PramaLLC/BEN2','revision':'e48a20765fb421d19dcdb0bf3cc61e802ca5ec8f','file':'BEN2_Base.onnx'}},
   {'name':'birefnet-lite-1024-fp16','spec':{'id':'onnx-community/BiRefNet_lite-ONNX','revision':'de15b22ba131738a16dff04aab8bdf8dc32e3ac1','file':'onnx/model_fp16.onnx'}},
   {'name':'birefnet-lite-1024-fp32','spec':{'id':'onnx-community/BiRefNet_lite-ONNX','revision':'de15b22ba131738a16dff04aab8bdf8dc32e3ac1','file':'onnx/model.onnx'}},
   {'name':'birefnet-lite-512 (current)','size':512,'spec':{'id':'studioludens/birefnet-lite-512','revision':'4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7','file':'onnx/model.onnx'}}]
only=os.environ.get('PROBE_ONLY');devices=os.environ.get('PROBE_DEVICES','webgpu,wasm').split(',')
with socket.socket() as s:busy=s.connect_ex(('127.0.0.1',port))==0
server=None if busy else subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env={**os.environ,'PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    time.sleep(1.5)
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context('C:/Users/2009s/nerulio-handoff/scratch/aic-bench/chrome-profile',channel='chrome',headless=True,args=['--enable-unsafe-webgpu','--ignore-gpu-blocklist'])
        page=ctx.new_page();page.set_default_timeout(1800000);page.goto(f'http://127.0.0.1:{port}/ai-runtime/')
        for m in M:
            if only and only not in m['name']:continue
            for d in devices:
                r=page.evaluate("async a=>(await import('/tests/ai-bench-browser.mjs')).probe(a)",{'spec':m['spec'],'device':d,'size':m.get('size',1024),'runs':3 if d=='webgpu' else 1,'ortVersion':os.environ.get('PROBE_ORT')})
                print(json.dumps({'model':m['name'],**r})[:700],flush=True)
        ctx.close()
finally:
    if server:server.terminate()
