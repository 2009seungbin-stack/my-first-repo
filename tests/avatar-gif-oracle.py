"""Reopen encoded GIF in Pillow and verify exact palette, loop, disposal and blink."""
import subprocess
from io import BytesIO
from pathlib import Path
from PIL import Image,ImageSequence

ROOT=Path(__file__).resolve().parents[1]
code="""import {encodeAvatarGif} from './src/avatar/gif.js';
const result=encodeAvatarGif({face:'round',hair:'swept',eyes:'bright',outfit:'jacket',hairPalette:'red',outfitPalette:'gold'},{motion:process.argv[1],delay:Number(process.argv[2])});
process.stdout.write(Buffer.from(result.bytes));
"""
for motion,delay,actual in [('blink',125,130),('breathe',200,200)]:
    gif=subprocess.run(['node','--input-type=module','-e',code,motion,str(delay)],cwd=ROOT,capture_output=True,check=True).stdout
    with Image.open(BytesIO(gif)) as image:
        assert image.size==(256,256) and image.n_frames==8
        assert image.info.get('loop')==0
        frames=[]
        for frame in ImageSequence.Iterator(image):
            assert frame.info.get('duration')==actual
            assert frame.disposal_method==2
            rgba=frame.convert('RGBA')
            assert rgba.getpixel((0,0))[3]==0
            frames.append(rgba.tobytes())
        assert frames[0]==frames[1]==frames[6]==frames[7]
        assert frames[3]==frames[4]!=frames[0]
    print(f'{motion} GIF reopened: 256x256, 8 frames, {actual} ms, loop forever, disposal 2, {len(gif)} bytes')
