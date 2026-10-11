"""Zoomed crops for annotating pseudo-pixel size by eye: a 64x64 px window (centre, or CROP_AT=x,y fractions) shown at
4x with a 8-px tick ruler. python zoom_sheet.py <corpus> <out.jpg> <ids...>"""
import sys,json,os
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(sys.argv[1]);man={r['id']:r for r in json.loads((root/'manifest.json').read_text('utf-8'))['items']};ids=sys.argv[3:]
W=int(os.environ.get('WIN','64'));Z=4;T=W*Z;cols=4;sheet=Image.new('RGB',(cols*(T+20),((len(ids)+cols-1)//cols)*(T+34)),(60,60,60));dr=ImageDraw.Draw(sheet)
for k,i in enumerate(ids):
    im=Image.open(root/'images'/man[i]['file']).convert('RGB');fx,fy=[float(v) for v in os.environ.get('CROP_AT','0.5,0.5').split(',')]
    x0=int(im.width*fx-W/2);y0=int(im.height*fy-W/2);x0=max(0,min(im.width-W,x0));y0=max(0,min(im.height-W,y0))
    c=im.crop((x0,y0,x0+W,y0+W)).resize((T,T),Image.NEAREST);X=(k%cols)*(T+20)+20;Y=(k//cols)*(T+34)+20
    sheet.paste(c,(X,Y))
    for t in range(0,W+1,8):
        dr.line([(X+t*Z,Y-6),(X+t*Z,Y-1)],fill=(255,255,0));dr.line([(X-6,Y+t*Z),(X-1,Y+t*Z)],fill=(255,255,0))
    dr.text((X,Y+T+2),f"{i} {im.width}x{im.height} @({x0},{y0})",fill=(255,255,255))
sheet.save(sys.argv[2],quality=92);print(sys.argv[2])
