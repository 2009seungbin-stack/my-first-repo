"""Generate the two authored inputs in a new output directory. Requires Pillow.
Usage: python generate_fixtures.py NEW_DIRECTORY
Refuses an existing directory. No network or account access.
"""
from pathlib import Path
from PIL import Image
import sys
out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
for name in ['opaque-chart','alpha-chart']:
 image=Image.new('RGBA',(128,96))
 image.putdata([((x*17+y*3)%256,(x*5+y*19)%256,255 if (x+y)%2 else 0,
                 255 if name=='opaque-chart' else [0,64,128,255][x//32])
                for y in range(96) for x in range(128)])
 image.save(out/(name+'.png'));image.close()
