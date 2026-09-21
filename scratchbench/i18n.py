"""Run tests/browser.py against a private port, minus the block that needs the fixed :4174 subpath server."""
import os,re,subprocess,sys,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
port=int(os.environ.get('MY_PORT','4304'));engine=os.environ.get('BROWSER_ENGINE','chromium')
source=(ROOT/'tests'/'browser.py').read_text(encoding='utf-8').replace('\r','')
lines=source.split('\n');keep=[];skip=False
for line in lines:
    if line.startswith(" page=mount(en,'/my-first-repo/"):skip=True
    if skip:
        if line.strip()=='page.close()':skip=False
        continue
    keep.append(line)
target=ROOT/'tests'/'browser_scratch_port.py'
target.write_text('\n'.join(keep),encoding='utf-8')
env={**os.environ,'PORT':str(port),'PYTHONIOENCODING':'utf-8','TEST_URL':f'http://127.0.0.1:{port}','BROWSER_ENGINE':engine}
log=(ROOT/'test-results'/'i18n-server.log').open('w')
server=subprocess.Popen(['node','tools/serve.mjs','--dist'],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
try:
    for _ in range(200):
        try:urllib.request.urlopen(f'http://127.0.0.1:{port}/en/',timeout=1);break
        except OSError:time.sleep(.1)
    code=subprocess.call([sys.executable,str(target)],cwd=ROOT,env=env)
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill();server.wait()
    log.close();target.unlink(missing_ok=True)
sys.exit(code)
