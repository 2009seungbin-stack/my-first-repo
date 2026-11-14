"""Real keyboard/section navigation with shared-asset base URLs, with and without JS.

CI reuses regression.py's built server. --own-server builds an isolated portal;
--base/--expected-sha verify a frozen production release without changing it.
"""
import argparse,json,os,socket,subprocess,time,urllib.request,wave
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];parser=argparse.ArgumentParser();parser.add_argument('--own-server',action='store_true');parser.add_argument('--base');parser.add_argument('--expected-sha');parser.add_argument('--width',type=int,default=1440);args=parser.parse_args()
BASE=(args.base or os.environ.get('TEST_URL','http://127.0.0.1:4173')).rstrip('/');OUT=ROOT/'test-results/local-fragments'/('production' if args.expected_sha else 'local')/str(args.width);OUT.mkdir(parents=True,exist_ok=True)
fixture=OUT/'authored-fragment-input.wav'
with wave.open(str(fixture),'wb') as audio:audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(32000);audio.writeframes(b'\0\0'*4000)
proc=None;rows=[];errors=[]
try:
 if args.own_server:
  dist=(ROOT/'test-results/local-fragments-build/dist').resolve();assert dist.parent==ROOT/'test-results/local-fragments-build' and dist.name=='dist'
  env={**os.environ,'LOCAL_FRAGMENT_DIST':str(dist),'DIST_DIR':str(dist),'PYTHONIOENCODING':'utf-8'}
  script="const {build}=await import('./tools/build.mjs');await build({outDir:process.env.LOCAL_FRAGMENT_DIST,env:{SITE_URL:'https://fileforge.example.test/',PLATFORM:'on',SERVICE_API:'on',TOOL_METERING:'off'}});"
  with (OUT/'build.log').open('w',encoding='utf-8') as log:subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,env=env,stdout=log,stderr=log,check=True)
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  BASE=f'http://127.0.0.1:{port}';env['PORT']=str(port);server_log=(OUT/'server.log').open('w')
  proc=subprocess.Popen(['node','tools/serve.mjs','--dist'],cwd=ROOT,env=env,stdout=server_log,stderr=server_log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
  for _ in range(100):
   try:urllib.request.urlopen(BASE+'/en/tools/',timeout=2).close();break
   except OSError:time.sleep(.2)
  else:raise RuntimeError('Owned built-site server did not start')
 with sync_playwright() as p:
  probe=p.request.new_context();candidate=probe.get(BASE+'/en/tools/');portal=candidate.status==200 and 'id="home"' in candidate.text();probe.dispose()
  for engine in ['chromium','firefox']:
   browser=getattr(p,engine).launch()
   for javascript in [True,False]:
    ctx=browser.new_context(java_script_enabled=javascript,viewport={'width':args.width,'height':1000});page=ctx.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
    if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
    for locale in ['ko','en','ja']:
     home=f'/{locale}/tools/' if portal and locale in ['ko','en'] else f'/{locale}/'
     for path in [f'/{locale}/audio-lab/',f'/{locale}/game/sfx-generator/',home,f'/{locale}/game/',f'/{locale}/atlas-padding/']:
      response=page.goto(BASE+path,wait_until='load');assert response.status in [200,304],(path,response.status)
      skip=page.locator('a.skip,a.gs-skip').first;expect(skip).to_have_attribute('data-local-fragment','main')
      file_name=None;unsaved=None;file_info=None;file_list=None
      if javascript:
       page.evaluate('history.replaceState(history.state,"",location.pathname+"?fragmentProof=1&retained=a%26b#preserved-state")')
       if '/audio-lab/' in path:
        page.locator('#file').set_input_files(fixture);expect(page.locator('#fileInfo')).to_contain_text(fixture.name);expect(page.locator('#analyze')).to_be_enabled();file_name=fixture.name
        file_info=page.locator('#fileInfo').inner_text();file_list=page.locator('#file').evaluate('(e)=>Array.from(e.files,x=>x.name)')
       if '/sfx-generator/' in path:unsaved='Keep this unsaved text';page.locator('#foreign').fill(unsaved)
      page.evaluate('window.__fragmentDocumentMarker=true');before=page.url;skip.focus();page.keyboard.press('Enter')
      expect(page.locator('main').first if javascript else page.locator('#main')).to_be_focused()
      assert page.evaluate('window.__fragmentDocumentMarker===true'),'skip reloaded the document'
      assert urlsplit(page.url).path==urlsplit(before).path,(path,before,page.url)
      if javascript:
       assert page.url==before,'skip must preserve application query/hash state'
       if file_name:
        expect(page.locator('#fileInfo')).to_have_text(file_info);expect(page.locator('#analyze')).to_be_enabled()
        assert page.locator('#file').evaluate('(e)=>Array.from(e.files,x=>x.name)')==file_list
       if unsaved:expect(page.locator('#foreign')).to_have_value(unsaved)
      rows.append({'engine':engine,'javascript':javascript,'locale':locale,'path':path,'action':'skip','sameDocument':True,'before':before,'after':page.url,'focus':page.evaluate('({tag:document.activeElement.tagName,id:document.activeElement.id})'),'preservedInput':file_name or unsaved})
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(path,javascript,page.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,ready:document.readyState})'))
      section=('file-tools' if path==home else 'concept' if path.endswith('/atlas-padding/') else None) if args.width>=1000 else None
      if section:
       link=page.locator(f'a[data-local-fragment="{section}"]').first;expect(link).to_be_attached();search=urlsplit(page.url).query
       link.click();page.wait_for_url('**#'+section)
       assert page.evaluate('window.__fragmentDocumentMarker===true'),'section link reloaded the document'
       assert urlsplit(page.url).path==urlsplit(before).path and urlsplit(page.url).query==search
       target=page.locator('#'+section);expect(target.locator('summary') if section=='file-tools' else target).to_be_in_viewport()
       rows.append({'engine':engine,'javascript':javascript,'locale':locale,'path':path,'action':section,'sameDocument':True,'after':page.url})
    if args.expected_sha:assert ctx.request.get(BASE+'/build.txt').text().strip()==args.expected_sha
    ctx.close()
   browser.close()
 assert not errors,errors
 (OUT/'results.json').write_text(json.dumps({'base':BASE,'expectedLiveCommit':args.expected_sha,'portal':portal,'width':args.width,'observations':rows,'pageErrors':errors,'scope':'Browser keyboard/section navigation and retained local input at the recorded viewport; no physical-device or screen-reader certification.'},ensure_ascii=False,indent=2),encoding='utf-8')
 print(f'Local fragment navigation passed: {len(rows)} actions in two engines, three languages, JavaScript on/off; retained file/text/query/hash state.')
finally:
 if proc:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
