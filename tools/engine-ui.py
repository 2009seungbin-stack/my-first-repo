"""Visible control → engine → downloaded file checks for the replaced PDF/media workflows."""
import json,os,subprocess,time,urllib.request,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'test-results'/'quality';checks=[]
server=subprocess.Popen(['node','tools/serve.mjs'],cwd=root,env={**os.environ,'PORT':'4283'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
try:
 for _ in range(100):
  try:urllib.request.urlopen('http://127.0.0.1:4283/en/',timeout=1);break
  except OSError:time.sleep(.1)
 with sync_playwright() as pw:
  browser=pw.chromium.launch();page=browser.new_page(accept_downloads=True);page.set_default_timeout(60000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:4283/en/',wait_until='networkidle')
  startup=page.evaluate("()=>{const r=performance.getEntriesByType('resource');return {requests:r.length,jsBytes:r.filter(x=>/\\.(?:mjs|js)$/.test(x.name)).reduce((n,x)=>n+x.encodedBodySize,0),optionalRequests:r.filter(x=>x.name.includes('/assets/vendor/')||x.name.includes('huggingface.co')).map(x=>x.name)}}")
  assert not startup['optionalRequests'],startup;checks.append('initial page loads no optional engine or model bundles')
  # Trim is a single-task page now (src/task/media.js): chips and one Run button, same evidence.
  page.goto('http://127.0.0.1:4283/en/video/trim/');page.locator('html[data-task-ready="1"]').wait_for();page.locator('#fileInput').set_input_files(str(out/'signal-1080p.mp4'));page.locator('#mediaRun:not([disabled])').wait_for()
  page.locator('#optionsAdvanced').evaluate('d=>d.open=true');page.locator('#videoFormat [data-value="mp4"]').click();page.locator('#videoMode [data-value="fast"]').click()
  page.locator('#mediaStart').fill('1');page.locator('#mediaEnd').fill('4');page.wait_for_timeout(200);page.locator('#mediaRun').click();page.locator('#taskDownload:not([disabled])').wait_for(timeout=180000)
  with page.expect_download() as pending:page.locator('#taskDownload').click()
  video=out/'ui-fast.mp4';pending.value.save_as(video);probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]));assert abs(float(probe['format']['duration'])-3)<.05 and any(s['codec_type']=='audio' for s in probe['streams']);checks.append('MP4 Fast cut controls produce decoded audio/video container')
  # pdf/compress is a task page now: it processes on intake and exposes #taskDownload, not the editor's run/download pair.
  page.goto('http://127.0.0.1:4283/en/pdf/compress/');page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
  raw=page.evaluate("""async()=>{const {PDFDocument}=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js'),d=await PDFDocument.create();for(let i=0;i<320;i++)d.addPage().drawText('UI source '+i);const b=await d.save();return btoa(Array.from(b,v=>String.fromCharCode(v)).join(''));}""");file=out/'ui-320.pdf';file.write_bytes(base64.b64decode(raw))
  page.locator('#fileInput').set_input_files(str(file));page.locator('#taskDownload:not([disabled])').wait_for()
  assert page.locator('#pdfcLevel [data-level="balanced"][aria-pressed="true"]').count()==1 and not page.locator('#pdfcRaster').is_checked() and not page.locator('#pdfcGray').is_checked();checks.append('PDF compressor defaults to structure-preserving mode')
  note=page.locator('#viewerNote').inner_text();assert 'text not selectable' not in note and ('text and search kept' in note or 'original kept' in note),note;checks.append('PDF compressor reports honestly that text and search survived')
  with page.expect_download() as pending:page.locator('#taskDownload').click()
  pending.value.save_as(out/'ui-preserved.pdf');checks.append('320-page PDF exports through focused UI')
  # pdf/protect: the visible password field has to reach the encryption engine.
  page.goto('http://127.0.0.1:4283/en/pdf/protect/');page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
  page.locator('#fileInput').set_input_files(str(file));page.locator('#secPassword').wait_for()
  page.locator('#secPassword').fill('engine-ui-pass');page.locator('#secConfirm').fill('engine-ui-pass');page.locator('#secRun').click()
  page.locator('#secDownload:not([hidden])').wait_for()
  with page.expect_download() as pending:page.locator('#secDownload').click()
  locked=out/'ui-protected.pdf';pending.value.save_as(locked)
  assert b'/Encrypt' in locked.read_bytes() and b'/AESV3' in locked.read_bytes();checks.append('pdf/protect writes an AES-256 encryption dictionary')
  # pdf/unlock takes that file back to an openable one.
  page.goto('http://127.0.0.1:4283/en/pdf/unlock/');page.wait_for_function("()=>document.documentElement.dataset.taskReady==='1'")
  page.locator('#fileInput').set_input_files(str(locked));page.locator('#secPassword').wait_for()
  page.locator('#secPassword').fill('engine-ui-pass');page.locator('#secRun').click()
  page.locator('#secDownload:not([hidden])').wait_for()
  with page.expect_download() as pending:page.locator('#secDownload').click()
  opened=out/'ui-unlocked.pdf';pending.value.save_as(opened)
  assert b'/Encrypt' not in opened.read_bytes() and b'/Root' in opened.read_bytes();checks.append('pdf/unlock removes the encryption dictionary')
  for route in ['video/trim','pdf/compress','pdf/protect','pdf/unlock']:
   page.set_viewport_size({'width':390,'height':844});page.goto('http://127.0.0.1:4283/ko/'+route+'/');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');checks.append(route+' mobile viewport fits')
  assert not errors,errors;(out/'engine-ui.json').write_text(json.dumps({'checks':checks,'errors':errors,'startup':startup,'video':probe},indent=2),encoding='utf-8');print(checks);browser.close()
finally:server.terminate();server.wait(timeout=5)
