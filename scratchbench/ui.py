"""Scratch: drive the new media task pages in a real browser and verify downloads."""
import argparse,json,os,shutil,subprocess,time,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--browser',default='chromium');p.add_argument('--port',type=int,default=4304);p.add_argument('--dist',action='store_true');a=p.parse_args()
out=ROOT/'test-results'/'media-ui';out.mkdir(parents=True,exist_ok=True)
FIX=out/'clip.mp4'
if not FIX.exists():
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','30','-c:a','aac','-b:a','128k','-movflags','+faststart',str(FIX)],check=True)
env={**os.environ,'PORT':str(a.port),'PYTHONIOENCODING':'utf-8'}
cmd=['node','tools/serve.mjs']+(['--dist'] if a.dist else [])
BASE=f'http://127.0.0.1:{a.port}'
checks=[]
def ok(name,cond,detail=''):
    assert cond,f'{name} :: {detail}'
    checks.append(name);print('PASS',name,flush=True)
def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]))
with (out/'server.log').open('w') as log:
    server=subprocess.Popen(cmd,cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        for _ in range(200):
            try:urllib.request.urlopen(BASE+'/en/',timeout=1);break
            except OSError:time.sleep(.1)
        with sync_playwright() as pw:
            browser=getattr(pw,a.browser).launch(headless=True)
            ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=ctx.new_page()
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:m.type=='error' and errors.append(m.text[:200]))
            page.set_default_timeout(120000)
            def open_tool(path):
                page.goto(BASE+path,wait_until='networkidle');page.locator('html[data-task-ready="1"]').wait_for()
                page.locator('#fileInput').set_input_files(str(FIX));page.locator('#mediaRun:not([disabled])').wait_for()
            def run_and_save(name):
                page.locator('#mediaRun').click();page.locator('#taskDownload:not([disabled])').wait_for(timeout=180000)
                with page.expect_download() as d:page.locator('#taskDownload').click()
                target=out/name;d.value.save_as(target);return target
            # GIF
            open_tool('/en/video/to-gif/')
            ok('gif page opens the player with the decoded video',page.locator('#video').evaluate('v=>v.videoWidth')==640)
            ok('gif defaults to a short section',abs(float(page.locator('#mediaEnd').input_value())-5)<.01)
            page.wait_for_function("()=>/≈/.test(document.querySelector('#mediaSummary .summary-big').textContent)",timeout=60000)
            estimate=page.locator('#mediaSummary .summary-big').inner_text()
            page.locator('#gifWidth [data-value="320"]').click();page.locator('#gifFps [data-value="10"]').click()
            page.locator('#mediaEnd').fill('1');page.wait_for_timeout(200)
            page.screenshot(path=str(out/f'{a.browser}-gif-before.png'))
            gif=run_and_save(f'{a.browser}-out.gif')
            from PIL import Image
            with Image.open(gif) as im:
                ok('GIF is a real animation at the chosen width',im.format=='GIF' and im.size==(320,180) and im.n_frames==10,f'{im.size} {im.n_frames}')
            ok('result preview is shown as an image',page.locator('#mediaOut img').count()==1)
            page.screenshot(path=str(out/f'{a.browser}-gif-after.png'))
            # GIF target size
            page.locator('#mediaEnd').fill('3');page.locator('#gifWidth [data-value="480"]').click();page.locator('#gifFps [data-value="15"]').click()
            page.locator('#gifTarget').fill('0.2');page.wait_for_timeout(200)
            small=run_and_save(f'{a.browser}-target.gif')
            ok('GIF fits under the requested size',small.stat().st_size<=200*1024,small.stat().st_size)
            # MP3
            open_tool('/en/video/to-mp3/')
            page.locator('#audioBitrate [data-value="128"]').click()
            mp3=run_and_save(f'{a.browser}-out.mp3')
            info=probe(mp3);ok('MP3 has one audio stream of the full length',info['streams'][0]['codec_name']=='mp3' and abs(float(info['format']['duration'])-5)<.2,info['format']['duration'])
            ok('audio result plays in the page',page.locator('#mediaOut audio').count()==1)
            # compress
            open_tool('/en/video/compress/')
            page.locator('#videoCap [data-value="480"]').click();page.locator('#videoTarget').fill('0.4');page.wait_for_timeout(150)
            vid=run_and_save(f'{a.browser}-small.mp4')
            info=probe(vid);v=[s for s in info['streams'] if s['codec_type']=='video'][0]
            ok('compressed video is smaller and capped',vid.stat().st_size<=int(.4*1024*1024) and int(v['height'])<=480,f"{vid.stat().st_size} {v['width']}x{v['height']}")
            ok('video result plays in the page',page.locator('#mediaOut video').count()==1)
            # trim
            open_tool('/en/video/trim/')
            page.locator('#mediaStart').fill('1');page.locator('#mediaEnd').fill('3');page.wait_for_timeout(150)
            cut=run_and_save(f'{a.browser}-cut.mp4')
            info=probe(cut);ok('trim keeps the requested two seconds with audio',abs(float(info['format']['duration'])-2)<.15 and any(s['codec_type']=='audio' for s in info['streams']),info['format']['duration'])
            # frame
            open_tool('/en/video/frame/')
            page.locator('[data-action="media-next"]').click();page.wait_for_timeout(200)
            shot=run_and_save(f'{a.browser}-frame.png')
            with Image.open(shot) as im:ok('frame grab is a source-resolution PNG',im.format=='PNG' and im.size==(640,360),im.size)
            # hub with the job switcher
            page.goto(BASE+'/en/media/',wait_until='networkidle');page.locator('html[data-task-ready="1"]').wait_for()
            page.locator('#fileInput').set_input_files(str(FIX));page.locator('#mediaRun:not([disabled])').wait_for()
            ok('the hub offers every job',page.locator('#mediaJob button').count()==5)
            page.locator('#mediaJob [data-job="audio"]').click()
            ok('switching job relabels the primary button','Extract' in page.locator('#mediaRun').inner_text(),page.locator('#mediaRun').inner_text())
            # localisation + trim handles
            page.goto(BASE+'/ja/video/to-gif/',wait_until='networkidle');page.locator('html[data-task-ready="1"]').wait_for()
            page.locator('#fileInput').set_input_files(str(FIX));page.locator('#mediaRun:not([disabled])').wait_for()
            ok('Japanese page has no Korean left',all(not any('가'<=c<='힣' for c in s) for s in page.locator('#taskApp').all_inner_texts()))
            box=page.locator('#tl').bounding_box()
            page.mouse.move(box['x']+box['width']-2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']*.4,box['y']+box['height']/2,steps=8);page.mouse.up()
            page.wait_for_timeout(200)
            ok('dragging the out handle shortens the section',float(page.locator('#mediaEnd').input_value())<2.6,page.locator('#mediaEnd').input_value())
            page.screenshot(path=str(out/f'{a.browser}-ja-trim.png'))
            # phone
            phone=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True).new_page()
            phone.on('pageerror',lambda e:errors.append(str(e)))
            phone.goto(BASE+'/en/video/to-gif/',wait_until='networkidle');phone.locator('html[data-task-ready="1"]').wait_for()
            ok('phone drop zone fits',phone.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1'))
            phone.locator('#fileInput').set_input_files(str(FIX));phone.locator('#mediaRun:not([disabled])').wait_for()
            phone.wait_for_timeout(700)
            ok('phone workspace has no horizontal scroll',phone.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1'))
            phone.screenshot(path=str(out/f'{a.browser}-phone.png'),full_page=True)
            assert not errors,errors
            browser.close()
    finally:
        server.terminate()
        try:server.wait(timeout=5)
        except subprocess.TimeoutExpired:server.kill();server.wait()
print('MEDIA UI OK',len(checks))
