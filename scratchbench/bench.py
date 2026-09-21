"""Real browser benchmark with owned HTTP server; generated fixtures stay out of Git."""
import argparse,json,os,platform,socket,subprocess,time,urllib.request,random,hashlib,base64,threading
import psutil
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--full',action='store_true');parser.add_argument('--ai',action='store_true');parser.add_argument('--matte',action='store_true');parser.add_argument('--pdf',action='store_true');parser.add_argument('--media',action='store_true');parser.add_argument('--large-media',action='store_true');parser.add_argument('--browser',choices=['chromium','firefox','webkit'],default='chromium');args=parser.parse_args()
out=ROOT/'test-results'/'quality';out.mkdir(parents=True,exist_ok=True)
port=4304
with socket.socket() as s:
 if s.connect_ex(('127.0.0.1',port))==0:raise SystemExit('Benchmark port 4304 already in use')
env={**os.environ,'PORT':str(port),'PYTHONIOENCODING':'utf-8'}
with (out/'server.log').open('w') as log:
 server=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 memory={'peakBrowserProcessRSS':0,'samples':0,'note':'Sum of owned browser child-process RSS, sampled every 100ms. Shared pages may be double-counted; GPU allocations and short peaks may be missed.'};stop_memory=threading.Event()
 def sample_memory():
  parent=psutil.Process()
  while not stop_memory.is_set():
   total=0
   for process in parent.children(recursive=True):
    try:
     if any(name in process.name().lower() for name in ['chrome','firefox','minibrowser','webkit']):total+=process.memory_info().rss
    except (psutil.NoSuchProcess,psutil.AccessDenied):pass
   memory['peakBrowserProcessRSS']=max(memory['peakBrowserProcessRSS'],total);memory['samples']+=1;stop_memory.wait(.1)
 sampler=threading.Thread(target=sample_memory,daemon=True);sampler.start()
 try:
  for attempt in range(100):
   try:urllib.request.urlopen(f'http://127.0.0.1:{port}/en/',timeout=1);break
   except OSError:time.sleep(.1)
  with sync_playwright() as pw:
   launch_flags=['--enable-unsafe-webgpu','--ignore-gpu-blocklist'] if os.environ.get('BENCH_GPU')=='1' and args.browser=='chromium' else []
   # Playwright's bundled Chromium lacks dxil.dll/dxcompiler.dll, so Dawn cannot create a D3D12
   # device on Windows. GPU runs therefore default to an installed Chrome; BENCH_CHANNEL overrides.
   channel=(os.environ.get('BENCH_CHANNEL') or 'chrome') if launch_flags else os.environ.get('BENCH_CHANNEL')
   launch={'headless':True,'args':launch_flags,**({'channel':channel} if channel else {})}
   context=getattr(pw,args.browser).launch_persistent_context(str(out/('ai-profile-'+(channel or 'bundled'))),**launch) if args.ai or args.matte else None
   browser=context.browser if context else getattr(pw,args.browser).launch(**launch)
   page=context.new_page() if context else browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'http://127.0.0.1:{port}/en/');page.set_default_timeout(180000)
   if args.media:
    page.on('console',lambda m:print(m.text,flush=True))
    if args.large_media:
     page.evaluate("()=>{const el=document.createElement('input');el.id='largeFixture';el.type='file';document.body.append(el)}");page.locator('#largeFixture').set_input_files(str(out/'signal-1h-500MiB.mp4'))
    result=page.evaluate("async large => (await import('/tests/media-browser.mjs')).run({largeFile:large?document.querySelector('#largeFixture').files[0]:null})",args.large_media)
   elif args.pdf:
    page.on('console',lambda m:print(m.text,flush=True));result=page.evaluate("async () => (await import('/tests/pdf-browser.mjs')).run()")
   elif args.matte:
    page.on('console',lambda m:print(m.text,flush=True));result=page.evaluate("async () => (await import('/tests/matte-browser.mjs')).run()")
   elif args.ai:
    page.on('console',lambda m:print(m.text,flush=True))
    result=page.evaluate("async options => (await import('/tests/ai-browser.mjs')).run(options)",{'smoke':os.environ.get('AI_SMOKE')=='1','engine':os.environ.get('AI_ENGINE','quality'),'backend':'auto' if launch_flags else 'wasm','strictGPU':bool(launch_flags)})
   else:result=page.evaluate("async full => (await import('/tests/quality-browser.mjs')).run({full})",args.full)
   if args.full and not args.media and not args.pdf:
    fixture=out/'noise-8k-100MiB.png'
    if not fixture.exists():
     image=Image.frombytes('RGB',(7680,4320),random.Random(90210).randbytes(7680*4320*3)).convert('RGBA');image.save(fixture,compress_level=0);image.close()
    page.goto(f'http://127.0.0.1:{port}/en/image/resize/')
    started=time.perf_counter();page.locator('#fileInput').set_input_files(str(fixture));page.locator('#workspace[aria-busy="false"]').wait_for()
    assert '7680 × 4320' in page.locator('#stageBadge').inner_text(),page.locator('#message').inner_text()
    page.locator('#resizeW').fill('3840');page.locator('#resizeH').fill('2160');page.locator('[data-action="intent-run"]').click();page.locator('#workspace[aria-busy="false"]').wait_for()
    assert '3840 × 2160' in page.locator('#stageBadge').inner_text(),page.locator('#message').inner_text()
    with page.expect_download() as pending:page.locator('[data-action="intent-download"]').click()
    output=out/'noise-4k-result.png';pending.value.save_as(output)
    with Image.open(output) as decoded:assert decoded.size==(3840,2160);assert decoded.getpixel((1920,1080))[-1]==255
    result['rows'].append({'case':'100MiB actual file / UI resize / independent Pillow decode','inputBytes':fixture.stat().st_size,'input':[7680,4320],'output':[3840,2160],'outputBytes':output.stat().st_size,'elapsedMs':(time.perf_counter()-started)*1000,'fixtureSHA256':hashlib.file_digest(fixture.open('rb'),'sha256').hexdigest() if hasattr(hashlib,'file_digest') else hashlib.sha256(fixture.read_bytes()).hexdigest()})
   for i,row in enumerate(result['rows']):
    if '_data' in row:
     artifact=out/f'{args.browser}-media-{i}.{row.pop("_extension")}';artifact.write_bytes(base64.b64decode(row.pop('_data').split(',')[1]));row['artifact']=str(artifact.relative_to(ROOT))
     if artifact.suffix=='.gif':
      with Image.open(artifact) as gif:assert gif.size[0]==row['width'] and gif.n_frames==row['frames'];row['independentVerification']={'dimensions':gif.size,'frames':gif.n_frames}
     else:
      probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(artifact)]));row['independentVerification']=probe;assert any(s['codec_type']=='audio' for s in probe['streams'])==row['audio']
    if '_png' in row:
     artifact=out/f'{args.browser}-{"ai" if args.ai else "matte"}-{i}.png';artifact.write_bytes(base64.b64decode(row.pop('_png').split(',')[1]));row['artifact']=str(artifact.relative_to(ROOT))
   result.update(launchFlags=launch_flags,channel=channel or 'bundled',host={'platform':platform.platform(),'processor':platform.processor(),'logicalCPUs':os.cpu_count(),'physicalMemoryBytes':psutil.virtual_memory().total},browserVersion=browser.version,errors=errors,memory=dict(memory))
   suffix='-media-large' if args.large_media else '-media' if args.media else '-pdf' if args.pdf else '-matte' if args.matte else '-ai-'+os.environ.get('AI_ENGINE','quality')+('-smoke' if os.environ.get('AI_SMOKE')=='1' else '-photo') if args.ai else '-full' if args.full else '-quick'
   path=out/(args.browser+suffix+('-gpu-'+channel if launch_flags else '')+'.json');path.write_text(json.dumps(result,indent=2),encoding='utf-8')
   print(json.dumps(result,indent=2));assert not errors,errors
   if context:context.close()
   browser.close()
 finally:
  stop_memory.set();sampler.join(timeout=2)
  server.terminate()
  try:server.wait(timeout=5)
  except subprocess.TimeoutExpired:server.kill();server.wait()
