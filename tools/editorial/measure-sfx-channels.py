"""Measure generated WAV inputs through the SFX UI, its sample worker message and downloaded WAV.

Record the unchanged importer with --ui legacy, or the channel-choice importer with --ui fixed.
Default output is private test-results; existing published evidence cannot be overwritten.
"""
import argparse,array,hashlib,json,math,os,socket,subprocess,sys,time,urllib.request,wave
from datetime import datetime,timezone
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser',choices=['chromium','firefox'],default='chromium')
parser.add_argument('--ui',choices=['legacy','fixed'],required=True)
parser.add_argument('--output',type=Path)
args=parser.parse_args()
OUT=(args.output or ROOT/'test-results/editorial-sfx-channels'/args.ui/args.browser).resolve()
if OUT.is_relative_to(ROOT/'assets') and (OUT/'measurements.json').exists():
 parser.error('Published evidence exists; use a new dated directory.')
OUT.mkdir(parents=True,exist_ok=True)
RATE=44100;FRAMES=22050
def sha(raw):return hashlib.sha256(raw).hexdigest()
def samples_le(values):
 data=array.array('h',values)
 if sys.byteorder!='little':data.byteswap()
 return data.tobytes()
inputs=[]
for name in ['mono','left-only','right-only','in-phase','opposite-phase']:
 channels=1 if name=='mono' else 2;data=[]
 for i in range(FRAMES):
  v=round(8192*math.sin(2*math.pi*440*i/RATE))
  data.extend([v] if channels==1 else [v if name!='right-only' else 0,-v if name=='opposite-phase' else v if name!='left-only' else 0])
 file=OUT/(name+'.wav')
 with wave.open(str(file),'wb') as w:
  w.setnchannels(channels);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(samples_le(data))
 inputs.append({'file':file.name,'channels':channels,'rate':RATE,'frames':FRAMES,'sha256':sha(file.read_bytes())})
project={'version':1,'seed':1,'rate':RATE,'bpm':120,'master':1,'limiter':False,
 'layers':[{'kind':'synth','wave':'sine','gain':1,'pan':0,'attack':0,'decay':0,'sustain':1,'hold':.5,'release':0,'lp':20000,'hp':0,'crushBits':16}], 'sequence':[]}
(OUT/'project.json').write_text(json.dumps(project,indent=2),encoding='utf-8')
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
env={k:v for k,v in os.environ.items() if not k.startswith('ADSENSE_')}
server=subprocess.Popen(['node','tools/serve.mjs'],cwd=ROOT,env={**env,'PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
BASE=f'http://127.0.0.1:{port}';records=[];rejected=[]
try:
 for _ in range(100):
  try:urllib.request.urlopen(BASE+'/en/game/sfx-generator/',timeout=1).close();break
  except Exception:
   if server.poll() is not None:raise RuntimeError('Source preview exited; check Node dependencies.')
   time.sleep(.1)
 else:raise RuntimeError('Source preview did not start')
 with sync_playwright() as p:
  browser=getattr(p,args.browser).launch()
  cases=[(n,'legacy-channel1' if args.ui=='legacy' else 'mix') for n in ['mono','left-only','right-only','in-phase','opposite-phase']]
  if args.ui=='fixed':cases += [('right-only','channel2'),('opposite-phase','channel1'),('opposite-phase','channel2'),('mono','channel2')]
  for name,mode in cases:
   context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
   external=[];uploads=[];errors=[]
   def route(r):
    if not r.request.url.startswith(BASE+'/'):
     external.append(r.request.url);r.abort()
    else:r.continue_()
   context.route('**/*',route)
   pg=context.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
   pg.on('request',lambda r:uploads.append({'method':r.method,'path':r.url.removeprefix(BASE)}) if r.method not in ['GET','HEAD'] and '/api/v2/hit' not in r.url else None)
   assert pg.goto(BASE+'/en/game/sfx-generator/').status==200
   pg.locator('#metrics').filter(has_text='Duration').wait_for()
   pg.locator('#advanced').evaluate('(e)=>e.open=true')
   pg.locator('#projectFile').set_input_files(str(OUT/'project.json'))
   expect(pg.locator('#master')).to_have_value('1')
   expect(pg.locator('#limiter')).not_to_be_checked()
   expect(pg.locator('#layers [data-field="gain"]').first).to_have_value('1')
   choice=pg.locator('#sampleChannels')
   assert choice.count()==(1 if args.ui=='fixed' else 0), 'Unexpected importer UI; do not relabel this condition.'
   if args.ui=='fixed':choice.select_option(mode);assert choice.input_value()==mode
   pg.evaluate('''()=>{window.sfxImport=null;const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){
     if(m.op==='sample'){let peak=0,power=0;for(const v of m.pcm){peak=Math.max(peak,Math.abs(v));power+=v*v;}
       const copy=m.pcm.slice();window.sfxImport={rate:m.rate,frames:m.pcm.length,peak,rms:Math.sqrt(power/m.pcm.length)};
       window.sfxImportHash=crypto.subtle.digest('SHA-256',copy.buffer).then(b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join(''));}
     return post.call(this,m,...args);};}''')
   pg.locator('#sampleFile').set_input_files(str(OUT/(name+'.wav')))
   if args.ui=='fixed' and name=='mono' and mode=='channel2':
    expect(pg.locator('#status')).to_have_attribute('data-error','1')
    assert 'second channel' in pg.locator('#status').inner_text().lower()
    expect(pg.locator('#layers select[data-field="kind"]').first).to_have_value('synth')
    assert pg.evaluate('window.sfxImport===null')
    rejected.append({'input':name,'mode':mode,'message':pg.locator('#status').inner_text(),'sampleTransferred':False})
   else:
    expect(pg.locator('#layers select[data-field="kind"]').first).to_have_value('sample')
    imported=pg.evaluate('async()=>({...window.sfxImport,sha256:await window.sfxImportHash})')
    assert imported['frames']==FRAMES and imported['rate']==RATE
    notice=None
    if args.ui=='fixed':
     note=pg.locator('#sampleImportNote');assert note.get_attribute('data-mode')==mode
     assert note.get_attribute('data-channels')==str(next(x['channels'] for x in inputs if x['file']==name+'.wav'))
     notice={'text':note.inner_text(),'mixCancelled':note.get_attribute('data-mix-cancelled')=='1'}
     assert notice['mixCancelled']==(name=='opposite-phase' and mode=='mix')
    pg.locator('#format').select_option('wav');pg.locator('#bits').select_option('16')
    with pg.expect_download(timeout=30000) as download:pg.locator('#saveAudio').click()
    filename=f'{name}-{mode}-output.wav';target=OUT/filename;download.value.save_as(str(target))
    with wave.open(str(target),'rb') as w:
     pcm=array.array('h');pcm.frombytes(w.readframes(w.getnframes()))
     if sys.byteorder!='little':pcm.byteswap()
     assert w.getsampwidth()==2 and w.getnchannels()==2 and w.getframerate()==RATE
     frames=w.getnframes();peak=max(abs(v) for v in pcm);rms=math.sqrt(sum(v*v for v in pcm)/len(pcm))
    should_silence=(args.ui=='legacy' and name=='right-only') or (args.ui=='fixed' and name=='opposite-phase' and mode=='mix')
    assert (peak==0)==should_silence,(name,mode,peak)
    records.append({'input':name+'.wav','mode':mode,'importedMono':imported,'notice':notice,'outputFile':filename,
     'outputSha256':sha(target.read_bytes()),'outputBytes':target.stat().st_size,'outputChannels':2,'rate':RATE,'frames':frames,'durationSeconds':frames/RATE,
     'peakPCM16':peak,'rmsPCM16':rms,'nonzeroSamples':sum(v!=0 for v in pcm)})
   pg.screenshot(path=str(OUT/f'{name}-{mode}.png'),full_page=True)
   assert not errors,errors
   assert not external,external
   assert not uploads,uploads
   context.close()
  report={'measuredAtUTC':datetime.now(timezone.utc).isoformat(),'ui':args.ui,'browserEngine':args.browser,'browser':browser.version,
   'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
   'sourceModifiedAfterCommit':subprocess.run(['git','diff','--quiet','HEAD','--','src','tools'],cwd=ROOT).returncode!=0,
   'reproductionScriptSha256':sha(Path(__file__).read_bytes()),'reproduce':f'python tools/editorial/measure-sfx-channels.py --ui {args.ui} --browser {args.browser}',
   'inputDefinition':'Self-generated 440 Hz, 0.5 s, PCM16/44100, peak 8192 integer samples. No recording or third-party audio.',
   'scope':'Actual source-preview UI and worker PCM, independently decoded downloaded WAV. No listening, native engine or original-stereo preservation claim.',
   'projectFile':'project.json','inputs':inputs,'records':records,'rejected':rejected,'externalRequests':[],'unexpectedUploads':[]}
  (OUT/'measurements.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
  print(json.dumps({'browser':args.browser,'ui':args.ui,'exports':len(records),'rejected':len(rejected),'sourceCommit':report['sourceCommit'],
   'sourceModifiedAfterCommit':report['sourceModifiedAfterCommit'],'peaks':[{k:r[k] for k in ['input','mode','peakPCM16']} for r in records]}))
  browser.close()
finally:
 server.terminate()
 try:server.wait(timeout=10)
 except subprocess.TimeoutExpired:server.kill();server.wait()
