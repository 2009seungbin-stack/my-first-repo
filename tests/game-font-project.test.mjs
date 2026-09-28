import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBdf} from '../src/game/font-bdf.js';
import {blankFontProject,projectFromBdf,projectFromGrid,renderFontProject,setGlyphPixel,setKerning,validateFontProject,PROJECT_FORMAT} from '../src/game/font-project.js';

test('editable project renders its own pixels and metrics, including kerning',()=>{
 const project=blankFontProject('AB',{cellW:4,cellH:5,baseline:4});
 assert.equal(project.format,PROJECT_FORMAT);
 setGlyphPixel(project,65,1,2,1);setGlyphPixel(project,66,3,4,1);setKerning(project,65,66,-1);
 const {data,width,font}=renderFontProject(project);
 assert.deepEqual([font.lineHeight,font.baseline,font.glyphs.length,font.kernings.length],[5,4,2,1]);
 assert.equal(data[((2*width)+1)*4+3],255);
 assert.equal(data[((4*width)+7)*4+3],255);
 assert.equal(data[((2*width)+2)*4+3],0);
 assert.deepEqual(font.kernings,[{first:65,second:66,amount:-1}]);
 assert.throws(()=>setKerning(project,65,67,1),/must be in/);
 assert.throws(()=>renderFontProject(project,{maxSide:4}),/atlas needs/);
});

test('a real CC0 BDF converts to an editable project without losing any glyph bit',()=>{
 const bdf=parseBdf(readFileSync(new URL('./fixtures/font-maker/sq.bdf',import.meta.url),'utf8'));
 const project=projectFromBdf(bdf),{data,width,font}=renderFontProject(project);
 assert.equal(font.glyphs.length,192);assert.equal(font.baseline,12);
 for(const source of bdf.glyphs){const metric=font.glyphs.find(g=>g.codepoint===source.codepoint);
  assert.deepEqual([metric.xOffset,metric.yOffset,metric.xAdvance],[source.xOffset,source.yOffset,source.xAdvance]);
  for(let y=0;y<source.h;y++)for(let x=0;x<source.w;x++)assert.equal(data[((metric.y+y)*width+metric.x+x)*4+3]>0?1:0,source.mask[y*source.w+x]);
 }
 assert.equal(validateFontProject(JSON.parse(JSON.stringify(project))).glyphs.length,192);
});

test('a source grid is copied into the v2 bitmap and stays unchanged',()=>{
 const source=new Uint8ClampedArray(8*4*4);source[(1*8+2)*4+3]=255;
 const project=projectFromGrid(source,8,4,{cellW:4,cellH:4,chars:'AB',baseline:3});
 assert.equal(project.glyphs[0].pixels[1*4+2],1);
 setGlyphPixel(project,65,2,1,0);assert.equal(source[(1*8+2)*4+3],255);
});
