"""Contact sheet for visual screening: python contact.py <images-dir> <glob> <out.jpg> [thumb=160] [cols=8]"""
import sys,glob,os
from PIL import Image,ImageDraw
d,pat,out=sys.argv[1:4];T=int(sys.argv[4]) if len(sys.argv)>4 else 160;C=int(sys.argv[5]) if len(sys.argv)>5 else 8
files=sorted(glob.glob(os.path.join(d,pat)));R=(len(files)+C-1)//C
sheet=Image.new('RGB',(C*T,R*(T+14)),(128,128,128));dr=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
    im=Image.open(f);im.thumbnail((T,T));im=im.convert('RGBA')
    bg=Image.new('RGBA',im.size,(255,0,255,255));bg.alpha_composite(im)
    x,y=(i%C)*T,(i//C)*(T+14);sheet.paste(bg.convert('RGB'),(x,y));dr.text((x+2,y+T),os.path.basename(f).rsplit('.',1)[0][:26],fill=(0,0,0))
sheet.save(out,quality=85);print(out,len(files))
