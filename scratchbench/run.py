"""Scratch: run a browser script, save any returned artifacts, print reports."""
import argparse,base64,json,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--browser',default='firefox');p.add_argument('--port',type=int,default=4304);p.add_argument('--script',required=True);a=p.parse_args()
out=ROOT/'test-results'/'quality';out.mkdir(parents=True,exist_ok=True)
env={**os.environ,'PORT':str(a.port),'PYTHONIOENCODING':'utf-8'}
with (out/'probe-server.log').open('w') as log:
 server=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 try:
  for _ in range(200):
   try:urllib.request.urlopen(f'http://127.0.0.1:{a.port}/en/',timeout=1);break
   except OSError:time.sleep(.1)
  with sync_playwright() as pw:
   browser=getattr(pw,a.browser).launch(headless=True)
   page=browser.new_page(viewport={'width':1440,'height':1000})
   page.on('console',lambda m:print('[console]',m.text[:300],flush=True))
   page.on('pageerror',lambda e:print('[pageerror]',e,flush=True))
   page.goto(f'http://127.0.0.1:{a.port}/en/');page.set_default_timeout(600000)
   result=page.evaluate(Path(a.script).read_text(encoding='utf-8'))
   for row in result.get('cases',[]):
    if '_data' in row:
     path=out/f"{a.browser}-{row['name']}.{row.pop('_ext')}";path.write_bytes(base64.b64decode(row.pop('_data').split(',')[1]));row['artifact']=str(path)
   print(json.dumps(result,indent=1,default=str))
   browser.close()
 finally:
  server.terminate()
  try:server.wait(timeout=5)
  except subprocess.TimeoutExpired:server.kill();server.wait()
