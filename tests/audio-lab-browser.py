"""Audio Lab browser acceptance. Run with TEST_URL pointing at this worktree's own served dist."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
import json,math,os,shutil,struct,subprocess,time,wave
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'/'audio-lab';OUT.mkdir(parents=True,exist_ok=True)
BASE=os.getenv('TEST_URL','http://127.0.0.1:4705').rstrip('/')
checks=[];errors=[]
def ok(name,condition,detail=''):
    if not condition:raise AssertionError(f'{name}: {detail}')
    checks.append(name);print('PASS',name,flush=True)
def sample(path):
    rate=22050;length=16*rate;chords=[[261.63,329.63,392.0],[349.23,440.0,523.25],[392.0,493.88,587.33],[261.63,329.63,392.0]]
    with wave.open(str(path),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
        for start in range(0,length,4096):
            chunk=bytearray()
            for i in range(start,min(length,start+4096)):
                t=i/rate;phase=(t*2)%1;beat=int(t*2);notes=chords[int(t/4)%4]
                click=.4*(1-phase/.012)*math.sin(2*math.pi*1800*t)*(1.2 if beat%4==0 else 1) if phase<.012 else 0
                v=max(-1,min(1,.12*sum(math.sin(2*math.pi*f*t) for f in notes)+click))
                chunk.extend(struct.pack('<h',round(v*32767)))
            w.writeframesraw(chunk)
def probe(path):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],text=True))
FIX=OUT/'known-120-c.wav';sample(FIX)
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    ctx=browser.new_context(accept_downloads=True,viewport={'width':1366,'height':900});p=ctx.new_page()
    p.on('pageerror',lambda e:errors.append(str(e)))
    uploads=[];p.on('request',lambda r:uploads.append(r.url) if r.method!='GET' and r.method!='HEAD' else None)
    for locale in ('ko','en','ja'):
        p.goto(f'{BASE}/{locale}/audio-lab/')
        ok(f'{locale} page language',p.locator('html').get_attribute('lang')==locale)
        ok(f'{locale} editor and reading content',p.locator('#file,#wave,#save,.sd-answer').count()==4)
        ok(f'{locale} ad-free and M4R disabled',p.locator('.adsbygoogle,[data-ad-host]').count()==0 and p.locator('option[value=m4r]').evaluate('(e)=>e.disabled'))
        ok(f'{locale} no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    p.goto(f'{BASE}/en/media/')
    p.locator('a[href="en/audio-lab/"]').click()
    ok('media guide opens Audio Lab',p.url.endswith('/en/audio-lab/'),p.url)
    aac_capability=p.evaluate('''async () => {
      if (!window.AudioEncoder?.isConfigSupported) return {api: false, supported: false};
      try { const result = await AudioEncoder.isConfigSupported({codec:'mp4a.40.2',sampleRate:44100,numberOfChannels:2,bitrate:128000});
        return {api:true,supported:!!result.supported}; }
      catch(error) { return {api:true,supported:false,error:String(error)}; }
    }''')
    print('AAC capability probe (not an M4R export or phone test):',aac_capability,flush=True)
    p.locator('#file').set_input_files(str(FIX))
    expect(p.locator('#preview')).to_be_enabled(timeout=25000)
    ok('worker decoded local 16s WAV',abs(float(p.locator('#end').input_value())-16)<.1,p.locator('#status').inner_text())
    p.locator('#analyze').click();expect(p.locator('#tempo')).to_contain_text('BPM',timeout=25000)
    ok('known BPM fixture',abs(float(p.locator('#tempo').inner_text().split()[0])-120)<1,p.locator('#tempo').inner_text())
    ok('known C major fixture',p.locator('#key').inner_text()=='C major',p.locator('#key').inner_text())
    p.screenshot(path=str(OUT/'desktop-loaded.png'),full_page=True)
    p.locator('#start').fill('2');p.locator('#start').press('Tab');p.locator('#end').fill('12');p.locator('#end').press('Tab')
    ok('numeric edit enters undo history',p.locator('#undo').is_enabled())
    p.locator('#undo').click();ok('undo restores previous range',float(p.locator('#end').input_value())>15)
    p.locator('#redo').click();ok('redo restores edited range',abs(float(p.locator('#end').input_value())-12)<.01)
    p.locator('#fadeIn').fill('0.1');p.locator('#fadeOut').fill('0.1')
    p.locator('#preview').click()
    deadline=time.monotonic()+30
    while time.monotonic()<deadline and p.locator('#player').evaluate('(e)=>e.readyState')<1:time.sleep(.1)
    ok('preview audio metadata ready',p.locator('#player').evaluate('(e)=>e.readyState')>=1)
    ok('local preview decodes in browser audio element',9.5<p.evaluate("document.querySelector('#player').duration")<10.5)
    p.locator('#stop').click()
    for codec in ('wav','ogg','mp3'):
        p.locator('#format').select_option(codec)
        with p.expect_download(timeout=60000) as event:p.locator('#save').click()
        target=OUT/f'export-{codec}.{codec}';event.value.save_as(str(target))
        ok(f'{codec} output nonempty',target.stat().st_size>1000)
        if shutil.which('ffprobe'):
            meta=probe(target);audio=[s for s in meta['streams'] if s.get('codec_type')=='audio']
            ok(f'{codec} independent ffprobe reopen',bool(audio),str(meta)[:300])
            ok(f'{codec} actual audio codec',audio[0]['codec_name']=={'wav':'pcm_s16le','ogg':'vorbis','mp3':'mp3'}[codec],audio[0]['codec_name'])
            ok(f'{codec} selected duration',9.5<float(meta['format']['duration'])<11.0,str(meta['format']['duration']))
            if shutil.which('ffmpeg'):
                decoded=subprocess.run(['ffmpeg','-v','error','-i',str(target),'-f','null','NUL' if os.name=='nt' else '/dev/null'],capture_output=True,text=True)
                ok(f'{codec} independent ffmpeg decode',decoded.returncode==0,decoded.stderr[-300:])
        with open(target,'rb') as f:head=f.read(4)
        ok(f'{codec} container signature',{'wav':head==b'RIFF','ogg':head==b'OggS','mp3':head[:3]==b'ID3' or head[:2] in (b'\xff\xfb',b'\xff\xf3',b'\xff\xf2')}[codec])
    # Real CC0 music is a decode/edit/export fixture, not a BPM/key accuracy label.
    kenney=ROOT/'tests'/'fixtures'/'audio-lab'/'kenney-preview.ogg'
    p.locator('#file').set_input_files(str(kenney));expect(p.locator('#preview')).to_be_enabled(timeout=25000)
    ok('Kenney CC0 Vorbis decoded in worker',12.5<float(p.locator('#end').input_value())<13.5)
    p.locator('#analyze').click();expect(p.locator('#confidence')).not_to_have_text('—',timeout=25000)
    ok('real CC0 analysis completed without forced truth label',p.locator('#confidence').inner_text()!='—')
    p.locator('#start').fill('2');p.locator('#end').fill('8');p.locator('#format').select_option('wav')
    with p.expect_download(timeout=60000) as event:p.locator('#save').click()
    real_out=OUT/'kenney-edited.wav';event.value.save_as(str(real_out))
    if shutil.which('ffprobe'):
        meta=probe(real_out);ok('real CC0 edit independently reopened',5.5<float(meta['format']['duration'])<6.5)
    mobile=browser.new_context(accept_downloads=True,viewport={'width':390,'height':844},device_scale_factor=2,has_touch=True);m=mobile.new_page();m.on('pageerror',lambda e:errors.append(str(e)))
    m.on('request',lambda r:uploads.append(r.url) if r.method!='GET' and r.method!='HEAD' else None)
    m.goto(f'{BASE}/ja/audio-lab/')
    ok('390px mobile no horizontal overflow',m.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    ok('mobile file picker label visible',m.locator('.al-file').is_visible())
    m.screenshot(path=str(OUT/'mobile-ja.png'),full_page=True)
    ok('no upload or processing POST',not uploads,str(uploads))
    ok('no JavaScript page errors',not errors,str(errors))
    mobile.close();ctx.close();browser.close()
(OUT/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'aacCapability':aac_capability},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(checks)}/{len(checks)} checks passed',flush=True)
