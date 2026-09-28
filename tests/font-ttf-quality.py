"""Independent fontTools/Pillow audit of pixel TTF from real CC0 BDF files."""
from pathlib import Path
import subprocess
import struct
import tempfile
from PIL import BdfFontFile, Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
JS = """import fs from 'node:fs';import {parseBdf} from './src/game/font-bdf.js';import {projectFromBdf} from './src/game/font-project.js';import {writePixelTtf} from './src/game/font-ttf.js';const bdf=parseBdf(fs.readFileSync(process.argv[1],'utf8'));fs.writeFileSync(process.argv[2],writePixelTtf(projectFromBdf(bdf)));"""

def check_one(bdf_path, out):
    subprocess.run(['node', '--input-type=module', '-e', JS, str(bdf_path), str(out)], cwd=ROOT, check=True)
    raw=out.read_bytes()
    padded=raw+b'\0'*((-len(raw))%4)
    assert sum(struct.unpack('>'+str(len(padded)//4)+'I',padded)) & 0xffffffff == 0xB1B0AFBA, 'sfnt checksum adjustment'
    font=TTFont(out, lazy=False)
    assert font.sfntVersion=='\x00\x01\x00\x00'
    cmap=font.getBestCmap()
    assert len(cmap)==192 and font['maxp'].numGlyphs==193
    assert font['head'].unitsPerEm==15*64
    bdf=BdfFontFile.BdfFontFile(open(bdf_path,'rb'))
    checked=0
    for cp,name in cmap.items():
        source=bdf.glyph[cp]
        assert source is not None
        mask=source[3]
        top=12+source[1][1]
        left=source[1][0]
        expected={(left+x,top+y) for y in range(mask.height) for x in range(mask.width) if mask.getpixel((x,y))}
        glyph=font['glyf'][name]
        actual=set()
        if glyph.numberOfContours:
            coords,endpoints,_=glyph.getCoordinates(font['glyf'])
            first=0
            for end in endpoints:
                contour=coords[first:end+1];first=end+1
                assert len(contour)==4, 'each source pixel is one pixel-square contour'
                xs={x for x,_ in contour};ys={y for _,y in contour}
                assert len(xs)==len(ys)==2
                x=min(xs)//64;y=12-max(ys)//64
                actual.add((x,y))
        assert actual==expected, f'outline pixels differ for U+{cp:04X}'
        assert font['hmtx'][name][0]==source[0][0]*64
        checked+=1
    font.close()
    return checked

def raster_note(path,bdf_path):
    """Default FreeType hinting can move detached dots/accents; record, don't hide it."""
    font=ImageFont.truetype(path,15)
    bdf=BdfFontFile.BdfFontFile(open(bdf_path,'rb'))
    mismatches=[]
    for cp in range(32,127):
        source=bdf.glyph[cp]
        ref=Image.new('1',(16,15));ref.paste(source[3],(source[1][0],12+source[1][1]))
        drawn=Image.new('1',(16,15))
        ImageDraw.Draw(drawn).text((0,12),chr(cp),font=font,fill=255,anchor='ls')
        if list(ref.get_flattened_data())!=list(drawn.get_flattened_data()):mismatches.append(cp)
    return mismatches

def main():
    with tempfile.TemporaryDirectory() as folder:
        out=Path(folder)/'font.ttf'
        for file in ['sq.bdf','sqb.bdf']:
            source=ROOT/'tests/fixtures/font-maker'/file
            count=check_one(source,out)
            print(f'{file}: {count} glyphs reopened by fontTools, source pixel outlines exact')
            print(f'{file}: FreeType default-hint ASCII raster mismatches {[f"U+{cp:04X}" for cp in raster_note(out,source)]}')

if __name__=='__main__':main()
