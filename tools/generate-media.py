"""Deterministic local test signals; no copyrighted media and no committed large binary."""
import argparse,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--large',action='store_true');a=p.parse_args()
root=Path(__file__).resolve().parents[1]/'test-results'/'quality';root.mkdir(parents=True,exist_ok=True)
jobs=[('signal-1080p.mp4','testsrc2=size=1920x1080:rate=30',6,[]),('signal-4k.mp4','testsrc2=size=3840x2160:rate=30',2,[])]
if a.large:jobs.append(('signal-1h-500MiB.mp4','testsrc2=size=320x180:rate=1',3600,['-b:v','1300k','-minrate','1300k','-maxrate','1300k','-bufsize','2600k','-x264-params','nal-hrd=cbr:force-cfr=1']))
for name,signal,duration,extra in jobs:
 path=root/name
 if path.exists():continue
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i',signal,'-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t',str(duration),'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-g','30','-c:a','aac','-b:a','96k',*extra,'-movflags','+faststart',str(path)],check=True)
 print(name,path.stat().st_size,flush=True)

path=root/'signal-60-noaudio.webm'
if not path.exists():
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=1280x720:rate=60','-t','2','-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','8','-b:v','2M',str(path)],check=True)
 print(path.name,path.stat().st_size,flush=True)
