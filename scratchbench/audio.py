"""Decode audio artifacts and report peak plus per-second RMS, to see gain and fades."""
import array,math,subprocess,sys
from pathlib import Path
for name in sys.argv[1:]:
    f=str(Path(name))
    pcm=subprocess.check_output(['ffmpeg','-v','error','-i',f,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','-'])
    v=array.array('f');v.frombytes(pcm)
    peak=max(abs(x) for x in v)
    rms=[]
    for s in range(0,len(v)//48000):
        chunk=v[s*48000:(s+1)*48000]
        rms.append(round(math.sqrt(sum(x*x for x in chunk)/len(chunk)),4))
    print(Path(f).name,'samples',len(v),'peak',round(peak,4),'rms/s',rms)
