"""Generate static, generic locale cards from Nerulio's original CC0 avatar parts."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/social'
OUT.mkdir(parents=True,exist_ok=True)
ART=ROOT/'docs/avatar-prototype/output'
FONT_KO=Path('C:/Windows/Fonts/malgunbd.ttf')
FONT_JA=Path('C:/Windows/Fonts/YuGothB.ttc')
FONT_EN=ROOT/'assets/vendor/pdfjs-dist-6.3.289/standard_fonts/LiberationSans-Bold.ttf'

for locale,title,subtitle,fontpath in [
 ('en','Pixel Avatar Maker','Original CC0 parts · exact pixel exports',FONT_EN),
 ('ko','픽셀 아바타 만들기','오리지널 CC0 파츠 · 정수 픽셀 출력',FONT_KO),
 ('ja','ピクセルアバター作成','オリジナルCC0パーツ · 整数ピクセル出力',FONT_JA),
]:
    image=Image.new('RGB',(1200,630),'#142a42')
    d=ImageDraw.Draw(image)
    d.rounded_rectangle((40,42,1160,588),radius=38,fill='#1d3c53',outline='#4d7c80',width=3)
    d.rounded_rectangle((650,84,1110,546),radius=26,fill='#315263')
    # Pixel blocks are visual context, not a generated avatar for a URL query.
    with Image.open(ART/'avatar-1-16.png') as source:
        image.paste(source.resize((320,320),Image.Resampling.NEAREST),(714,132),source.resize((320,320),Image.Resampling.NEAREST))
    d.text((96,104),'Nerulio.',font=ImageFont.truetype(str(FONT_EN),39),fill='#8bd0c8')
    title_font=ImageFont.truetype(str(fontpath),59 if locale!='ja' else 54)
    d.text((94,226),title,font=title_font,fill='#f8e8c8')
    subtitle_font=ImageFont.truetype(str(fontpath),27)
    d.text((96,338),subtitle,font=subtitle_font,fill='#bad5d9')
    d.rounded_rectangle((96,452,466,513),radius=12,fill='#0f797b')
    d.text((120,465),'16 px  →  32 · 48 · 64 px',font=ImageFont.truetype(str(FONT_EN),22),fill='white')
    image.save(OUT/f'{locale}-pixel-avatar-maker.png',optimize=True)
    print(OUT/f'{locale}-pixel-avatar-maker.png')
