"""Run tests/task-browser.py against a private port and dist build."""
import os,subprocess,sys,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
port=int(os.environ.get('MY_PORT','4304'))
env={**os.environ,'PORT':str(port),'PYTHONIOENCODING':'utf-8','TEST_URL':f'http://127.0.0.1:{port}'}
log=(ROOT/'test-results'/'taskui-server.log').open('w')
server=subprocess.Popen(['node','tools/serve.mjs','--dist'],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
try:
    for _ in range(200):
        try:urllib.request.urlopen(f'http://127.0.0.1:{port}/en/',timeout=1);break
        except OSError:time.sleep(.1)
    code=subprocess.call([sys.executable,'tests/task_browser_scratch.py'],cwd=ROOT,env=env)
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill();server.wait()
    log.close()
sys.exit(code)
