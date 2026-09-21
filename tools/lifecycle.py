"""Ten sequential image/PDF/media jobs with forced GC at observation boundaries only."""
import json,os,subprocess,time,urllib.request
from pathlib import Path
import psutil
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'test-results'/'quality';out.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen(['node','tools/serve.mjs'],cwd=root,env={**os.environ,'PORT':'4282'},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
try:
 for _ in range(100):
  try:urllib.request.urlopen('http://127.0.0.1:4282/en/',timeout=1);break
  except OSError:time.sleep(.1)
 with sync_playwright() as pw:
  browser=pw.chromium.launch();page=browser.new_page();page.goto('http://127.0.0.1:4282/en/');session=page.context.new_cdp_session(page);session.send('Performance.enable')
  page.evaluate("""async()=>{window.Im=await import('/src/image.js');window.Pdf=await import('/src/pdf.js');window.Media=await import('/src/media-modern.js');window.L=await import('/assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js');const doc=await L.PDFDocument.create();for(let i=0;i<320;i++)doc.addPage().drawText('Lifecycle '+i);window.pdfFile=new File([await doc.save()],'lifecycle.pdf');window.mediaFile=new File([await(await fetch('/test-results/quality/signal-1080p.mp4')).blob()],'signal.mp4');} """)
  rows=[]
  for i in range(10):
   page.evaluate("""async()=>{const c=Im.canvas(3840,2160);c.getContext('2d').fillRect(0,0,c.width,c.height);const r=await Im.resizeQuality(c,7680,4320);Im.release(r);Im.release(c);const w=new Pdf.PDFWorkspace();try{await w.add([pdfFile]);await w.export();}finally{await w.clear();}const media=await Media.modernMedia('convert',mediaFile,{format:'mp4',mode:'fast',start:1,end:3});await Media.releaseOutput(media.blob);} """)
   session.send('HeapProfiler.collectGarbage');time.sleep(.15);metrics={x['name']:x['value'] for x in session.send('Performance.getMetrics')['metrics']};rss=0
   for process in psutil.Process().children(recursive=True):
    try:
     if 'chrome' in process.name().lower():rss+=process.memory_info().rss
    except psutil.Error:pass
   rows.append({'iteration':i+1,'jsHeapBytes':metrics['JSHeapUsedSize'],'browserProcessRSS':rss,**session.send('Memory.getDOMCounters')})
  temp=page.evaluate("""async()=>{const r=await navigator.storage.getDirectory(),names=[];for await(const [name]of r.entries())if(name.startsWith('nerulio-media-'))names.push(name);return names;}""");assert not temp,temp
  report={'browser':browser.version,'rows':rows,'tempFilesAfterRelease':temp,'scope':'Ten 4K→8K resizes, 320-page PDF copies and MP4 remux jobs. GC forced only for measurement. RSS sums shared pages; not GPU memory or AI-model lifecycle certification.'};(out/'lifecycle.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2));browser.close()
finally:
 server.terminate();server.wait(timeout=5)
