"""Original CC0 Audio Lab ground-truth fixtures. Run `python generate.py` to reproduce bytes.

No recorded, sampled or third-party sound is used. Musical ground truth is the
construction parameter, not a claim about every listener's perceived pulse.
"""
from pathlib import Path
from hashlib import sha256
import json,math,struct,wave
ROOT=Path(__file__).resolve().parent
SR=22050
SECONDS=8
CHORDS={
 'C major': [[60,64,67],[65,69,72],[67,71,74],[60,64,67]],
 'G major': [[67,71,74],[60,64,67],[62,66,69],[67,71,74]],
 'F major': [[65,69,72],[70,74,77],[60,64,67],[65,69,72]],
 'A minor': [[57,60,64],[62,65,69],[64,67,71],[57,60,64]],
 'E minor': [[64,67,71],[69,72,76],[71,74,78],[64,67,71]],
 'D minor': [[62,65,69],[67,70,74],[69,73,76],[62,65,69]],
}
CASES=[]
for bpm in [60,75,90,120,150,180]:CASES.append((f'tempo-{bpm}',bpm,'C major','music'))
for key in CHORDS:
 if key!='C major':CASES.append((f'key-{key.lower().replace(" ", "-")}',120,key,'music'))
CASES.extend([('silence',None,None,'silence'),('single-tone',None,None,'tone')])

def render(bpm,key,kind):
    out=bytearray();chords=CHORDS.get(key,())
    for i in range(SR*SECONDS):
        t=i/SR
        if kind=='silence':v=0.
        elif kind=='tone':v=.2*math.sin(2*math.pi*440*t)
        else:
            # Four bars of specified I-IV-V-I or i-iv-v-i notes. Each chord
            # lasts 2 s. Beeps are mathematical sines, no borrowed recording.
            notes=chords[min(3,int(t/2))]
            harmonic=.12*sum(math.sin(2*math.pi*440*2**((m-69)/12)*t) for m in notes)
            phase=(t*bpm/60)%1;beat=int(t*bpm/60)
            click=.4*(1-phase/.012)*math.sin(2*math.pi*1800*t)*(1.2 if beat%4==0 else 1) if phase<.012 else 0.
            v=harmonic+click
        out.extend(struct.pack('<h',round(max(-1,min(1,v))*32767)))
    return bytes(out)

def main():
    manifest=[]
    for name,bpm,key,kind in CASES:
        path=ROOT/f'{name}.wav'
        with wave.open(str(path),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(render(bpm,key,kind))
        manifest.append({'file':path.name,'sha256':sha256(path.read_bytes()).hexdigest(),
            'sampleRate':SR,'channels':1,'seconds':SECONDS,'constructionTempoBpm':bpm,
            'constructionKey':key,'kind':kind,'license':'CC0-1.0',
            'groundTruthMeaning':'synthesis construction; half/double and relative key may be perceptually ambiguous'})
    (ROOT/'manifest.json').write_text(json.dumps({'generator':'generate.py','source':'Original mathematical synthesis by Nerulio','license':'CC0-1.0','cases':manifest},indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Generated {len(manifest)} original CC0 WAV fixtures')
if __name__=='__main__':main()
