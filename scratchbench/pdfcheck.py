"""Scratch: reproduce the pdf/merge delete+undo step in isolation."""
import io,os,subprocess,time,urllib.request
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];port=int(os.environ.get('MY_PORT','4304'))
def pdf(n,label):
    ims=[]
    for i in range(n):
        im=Image.new('RGB',(400,560),'white');px=im.load()
        for x in range(40,360):
            for y in range(100+i*40,110+i*40):px[x,y]=(20,40,160)
        ims.append(im)
    b=io.BytesIO();ims[0].save(b,'PDF',save_all=True,append_images=ims[1:]);return {'name':label+'.pdf','mimeType':'application/pdf','buffer':b.getvalue()}
img=Image.new('RGB',(300,300),'white');b=io.BytesIO();img.save(b,'PNG')
env={**os.environ,'PORT':str(port),'PYTHONIOENCODING':'utf-8'}
log=(ROOT/'test-results'/'pdfcheck.log').open('w')
server=subprocess.Popen(['node','tools/serve.mjs','--dist'],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
try:
    for _ in range(200):
        try:urllib.request.urlopen(f'http://127.0.0.1:{port}/en/',timeout=1);break
        except OSError:time.sleep(.1)
    with sync_playwright() as pw:
        page=pw.chromium.launch().new_page(viewport={'width':1366,'height':900})
        page.on('pageerror',lambda e:print('[pageerror]',e))
        page.on('console',lambda m:print('[console]',m.type,m.text[:200]) if m.type=='error' else None)
        page.set_default_timeout(60000)
        page.goto(f'http://127.0.0.1:{port}/ko/pdf/merge/',wait_until='networkidle')
        page.locator('#fileInput').set_input_files(files=[pdf(3,'b-report'),pdf(2,'a-cover'),{'name':'product.png','mimeType':'image/png','buffer':b.getvalue()}])
        page.wait_for_function('()=>document.querySelectorAll(".pg").length===6')
        page.locator('.pg').nth(1).click();page.locator('.pg').nth(3).click(modifiers=['Control'])
        print('selected',page.locator('.pg.is-selected').count())
        print('delete disabled?',page.locator('[data-action="pdf-delete"]').is_disabled(),'count',page.locator('[data-action="pdf-delete"]').count())
        page.locator('[data-action="pdf-delete"]').click()
        page.wait_for_timeout(1000)
        print('after delete .pg =',page.locator('.pg').count())
        page.keyboard.press('Control+z');page.wait_for_timeout(1000)
        print('after undo .pg =',page.locator('.pg').count())
        page.screenshot(path=str(ROOT/'test-results'/'pdfcheck.png'))
finally:
    server.terminate()
    try:server.wait(timeout=5)
    except subprocess.TimeoutExpired:server.kill();server.wait()
    log.close()
