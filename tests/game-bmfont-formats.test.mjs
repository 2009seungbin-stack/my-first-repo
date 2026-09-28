import test from 'node:test';
import assert from 'node:assert/strict';
import {gridFont,fntText,fntXml,fntBinary} from '../src/game/bmfont.js';

// The binary reader below is deliberately separate from the production writer.
function readBmf(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.deepEqual([...bytes.slice(0,4)],[66,77,70,3]);
 const blocks=new Map();let pos=4;
 while(pos<bytes.length){const id=view.getUint8(pos),length=view.getUint32(pos+1,true);assert(pos+5+length<=bytes.length);blocks.set(id,{at:pos+5,length});pos+=5+length;}
 assert.equal(pos,bytes.length);
 const chars=[],kernings=[];
 const c=blocks.get(4),k=blocks.get(5);
 assert.equal(c.length%20,0);assert.equal(k.length%10,0);
 for(let at=c.at;at<c.at+c.length;at+=20)chars.push({id:view.getUint32(at,true),x:view.getUint16(at+4,true),y:view.getUint16(at+6,true),w:view.getUint16(at+8,true),h:view.getUint16(at+10,true),xoffset:view.getInt16(at+12,true),yoffset:view.getInt16(at+14,true),xadvance:view.getInt16(at+16,true),page:view.getUint8(at+18),chnl:view.getUint8(at+19)});
 for(let at=k.at;at<k.at+k.length;at+=10)kernings.push({first:view.getUint32(at,true),second:view.getUint32(at+4,true),amount:view.getInt16(at+8,true)});
 const info=blocks.get(1),common=blocks.get(2),pages=blocks.get(3),decode=(at,len)=>new TextDecoder().decode(bytes.slice(at,at+len)).split('\0')[0];
 return {face:decode(info.at+14,info.length-14),image:decode(pages.at,pages.length),size:view.getInt16(info.at,true),spacing:view.getUint8(info.at+11),lineHeight:view.getUint16(common.at,true),base:view.getUint16(common.at+2,true),width:view.getUint16(common.at+4,true),height:view.getUint16(common.at+6,true),pages:view.getUint16(common.at+8,true),chars,kernings};
}

test('BMFont text, XML and binary version 3 carry the same Unicode and kerning metrics',()=>{
 const font=gridFont({width:24,height:8,cellW:8,cellH:8,chars:'Aあ😀',baseline:6,image:'font&".png',face:'A&B "test"',spacing:2});
 font.glyphs[0].xOffset=-2;font.glyphs[2].xAdvance=10;
 font.kernings=[{first:65,second:0x1f600,amount:-2}];
 const text=fntText(font),xml=fntXml(font),binary=readBmf(fntBinary(font));
 assert.match(text,/kerning first=65 second=128512 amount=-2/);
 assert.match(xml,/face="A&amp;B &quot;test&quot;"/);
 assert.match(xml,/file="font&amp;&quot;.png"/);
 assert.match(xml,/<char id="128512" x="16" y="0" width="8" height="8" xoffset="0" yoffset="0" xadvance="10" page="0" chnl="15"\/>/);
 assert.match(xml,/<kerning first="65" second="128512" amount="-2"\/>/);
 assert.deepEqual([binary.face,binary.image,binary.size,binary.spacing,binary.lineHeight,binary.base,binary.width,binary.height,binary.pages],['A&B "test"','font&".png',8,2,8,6,24,8,1]);
 assert.deepEqual(binary.chars.map(c=>[c.id,c.x,c.xoffset,c.xadvance]),[[65,0,-2,8],[12354,8,0,8],[128512,16,0,10]]);
 assert.deepEqual(binary.kernings,font.kernings);
});

test('binary writer refuses impossible BMFont values instead of wrapping',()=>{
 const font=gridFont({width:8,height:8,cellW:8,cellH:8,chars:'A'});
 font.glyphs[0].xOffset=40000;
 assert.throws(()=>fntBinary(font),/xoffset/);
 font.glyphs[0].xOffset=0;font.width=70000;
 assert.throws(()=>fntBinary(font),/width/);
});
