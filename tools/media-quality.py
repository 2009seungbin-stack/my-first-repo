"""Independent decoded-output checks, beyond container headers and track presence."""
import argparse,array,json,math,re,subprocess
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--browser',default='chromium');parser.add_argument('--large-media',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'test-results'/'quality'
report=json.loads((root/(args.browser+('-media-large' if args.large_media else '-media')+'.json')).read_text(encoding='utf-8'));rows=[]
for row in report['rows']:
 if row.get('format') not in ['mp4','webm','mp3','wav'] or not row.get('artifact'):continue
 artifact=Path(__file__).resolve().parents[1]/row['artifact']
 # Decode every video/audio packet; preserve decoder diagnostics as evidence.
 decoded=subprocess.run(['ffmpeg','-hide_banner','-v','warning','-i',str(artifact),'-map','0','-f','null','-'],capture_output=True,text=True,check=True)
 if not row['audio']:
  frames=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v','-count_frames','-show_entries','stream=nb_read_frames','-of','json',str(artifact)]));n=int(frames['streams'][0]['nb_read_frames']);assert n==60,n
  rows.append({'case':row['case'],'decodedFrames':n,'audio':False,'decoderWarnings':decoded.stderr.strip()});continue
 pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(artifact),'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','-'])
 values=array.array('f');values.frombytes(pcm);central=values[4800:-4800]
 assert len(central)>48000,'Missing decoded audio'
 rms=math.sqrt(sum(v*v for v in central)/len(central));crossings=sum(a<=0<b for a,b in zip(central,central[1:]));hz=crossings*48000/len(central)
 assert .065<rms<.11,(row['case'],'440 Hz source level not retained',rms)
 assert abs(hz-440)<2,(row['case'],'signal frequency changed',hz)
 result={'case':row['case'],'decodedAudioSamples':len(values),'rms':rms,'frequencyHz':hz,'decoderWarnings':decoded.stderr.strip()}
 if row['case']=='precise':
  filters='[0:v]trim=start=1.25:end=3.75,setpts=PTS-STARTPTS,scale=640:360:flags=lanczos,fps=24[ref];[1:v]setpts=PTS-STARTPTS[enc];[ref][enc]ssim'
  comparison=subprocess.run(['ffmpeg','-hide_banner','-i',str(root/'signal-1080p.mp4'),'-i',str(artifact),'-filter_complex',filters,'-an','-f','null','-'],capture_output=True,text=True,check=True)
  match=re.search(r'All:([\d.]+)',comparison.stderr);assert match,comparison.stderr[-1000:]
  result['videoSSIM']=float(match[1]);assert result['videoSSIM']>.85,result
  count=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v','-count_frames','-show_entries','stream=nb_read_frames','-of','json',str(artifact)]))
  result['decodedFrames']=int(count['streams'][0]['nb_read_frames']);assert abs(result['decodedFrames']-60)<=1,result
 rows.append(result)
result={'rows':rows,'scope':'Generated 440 Hz + testsrc2. SSIM against FFmpeg Lanczos/fps temporal reference, not natural-video quality acceptance.'}
(root/f'{args.browser}-media-decoded-quality.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
