"""Scratch: screenshots of the media task page, before and after a run."""
import argparse,os,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=4304);p.add_argument('--route',default='/en/video/to-gif/');p.add_argument('--tag',default='gif');p.add_argument('--width',type=int,default=1440);p.add_argument('--run',action='store_true');a=p.parse_args()
out=ROOT/'test-results'/'media-ui';out.mkdir(parents=True,exist_ok=True);FIX=out/'clip.mp4'
env={**os.environ,'PORT':str(a.port),'PYTHONIOENCODING':'utf-8'}
with (out/'shot-server.log').open('w') as log:
    server=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        for _ in range(200):
            try:urllib.request.urlopen(f'http://127.0.0.1:{a.port}/en/',timeout=1);break
            except OSError:time.sleep(.1)
        with sync_playwright() as pw:
            browser=pw.chromium.launch()
            page=browser.new_context(viewport={'width':a.width,'height':900 if a.width>800 else 844},is_mobile=a.width<800,has_touch=a.width<800).new_page()
            page.on('pageerror',lambda e:print('[pageerror]',e))
            page.set_default_timeout(120000)
            page.goto(f'http://127.0.0.1:{a.port}'+a.route,wait_until='networkidle')
            page.screenshot(path=str(out/f'view-{a.tag}-{a.width}-empty.png'))
            page.locator('#fileInput').set_input_files(str(FIX));page.locator('#mediaRun:not([disabled])').wait_for()
            page.wait_for_timeout(1500)
            page.screenshot(path=str(out/f'view-{a.tag}-{a.width}-loaded.png'),full_page=True)
            if a.run:
                page.locator('#mediaRun').click();page.locator('#taskDownload:not([disabled])').wait_for(timeout=180000)
                page.wait_for_timeout(600);page.evaluate('()=>scrollTo(0,0)')
                page.screenshot(path=str(out/f'view-{a.tag}-{a.width}-result.png'),full_page=True)
            browser.close()
    finally:
        server.terminate()
        try:server.wait(timeout=5)
        except subprocess.TimeoutExpired:server.kill();server.wait()
print('shots saved')
