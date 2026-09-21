"""Reproducible HTTP regression with owned server lifecycles; does not contact live ads."""
from pathlib import Path
import os,subprocess,sys,time,urllib.request,socket,json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
env=os.environ.copy()
for key in ['ADSENSE_CLIENT','ADSENSE_VERIFICATION_CLIENT','ADSENSE_SLOT_CONTENT_1','ADSENSE_SLOT_CONTENT_2','ADSENSE_CMP_READY','GOOGLE_SITE_VERIFICATION','INDEXNOW_KEY','CF_PAGES_BRANCH','SITE_ENV','PORT','BASE_PATH','DIST_DIR']:env.pop(key,None)
env.update(SITE_URL='https://fileforge.example.test/',PYTHONIOENCODING='utf-8')
def run(name,command):
    print('RUN',name,flush=True)
    with (OUT/(name+'.log')).open('w',encoding='utf-8') as log:
        result=subprocess.run(command,cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT)
    if result.returncode:
        print((OUT/(name+'.log')).read_text(encoding='utf-8')[-8000:]);raise SystemExit(result.returncode)
    print('PASS',name,flush=True)
for port in [4173,4174]:
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1',port))==0:raise SystemExit(f'Port {port} already in use; stop only the relevant test server first')
run('syntax',['node','tools/check.mjs'])
run('node',['node','--test',*[str(p.relative_to(ROOT)) for p in sorted((ROOT/'tests').glob('*.test.mjs'))]])
run('build',['node','tools/build.mjs'])
servers=[];logs=[]
try:
    for port,mount in [(4173,''),(4174,'/my-first-repo')]:
        log=(OUT/f'server-{port}.log').open('w');logs.append(log)
        servers.append(subprocess.Popen(['node','tools/serve.mjs','--dist'],cwd=ROOT,env={**env,'PORT':str(port),'BASE_PATH':mount},stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0)))
        for attempt in range(100):
            try:urllib.request.urlopen(f'http://127.0.0.1:{port}{mount}/en/',timeout=1);break
            except OSError:time.sleep(.1)
        else:raise RuntimeError(f'Server {port} did not start')
    for suite in ['browser','recipes-browser','growth-browser','seo-browser','landings-browser','task-browser']:run(suite,[sys.executable,'tests/'+suite+'.py'])
finally:
    for server in servers:
        server.terminate()
        try:server.wait(timeout=5)
        except subprocess.TimeoutExpired:server.kill();server.wait()
    for log in logs:log.close()
summary={}
for name,relative,key in [('existing','browser-results.json','passed'),('recipes','recipes-browser-results.json','checks'),('growth','growth-browser-results.json','checks'),('seo','seo/results.json','checks')]:
    report=json.loads((OUT/relative).read_text(encoding='utf-8'));summary[name]=len(report[key])
(OUT/'regression-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print('FULL HTTP REGRESSION PASSED',json.dumps(summary))
