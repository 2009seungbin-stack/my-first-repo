/** Small TrueType glyf writer for monochrome pixel projects.
 * The sfnt tables follow Microsoft's OpenType specification. Each filled pixel is a separate
 * clockwise rectangle; OVERLAP_SIMPLE is set because neighbouring rectangles share edges.
 * This intentionally caps glyphs/pixels until large-CJK font output is independently measured. */
import {validateFontProject} from './font-project.js';

const be=(n,w)=>{const b=new Uint8Array(w);for(let i=w-1;i>=0;i--){b[i]=n&255;n=Math.floor(n/256);}return b;};
const s16=n=>be(n<0?n+65536:n,2);
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const write16=(v,o,n)=>{if(!Number.isInteger(n)||n<0||n>65535)throw Error('TTF unsigned metric outside 16-bit range');v.setUint16(o,n,false);};
const writeS16=(v,o,n)=>{if(!Number.isInteger(n)||n<-32768||n>32767)throw Error('TTF signed metric outside 16-bit range');v.setInt16(o,n,false);};
const write32=(v,o,n)=>v.setUint32(o,n>>>0,false);
const sum32=data=>{let sum=0;for(let i=0;i<data.length;i+=4)sum=(sum+(((data[i]||0)<<24|((data[i+1]||0)<<16)|((data[i+2]||0)<<8)|(data[i+3]||0))>>>0))>>>0;return sum;};
const utf16=s=>concat(...[...s].map(ch=>{const n=ch.codePointAt(0);return n<=65535?be(n,2):concat(be(0xd800+((n-0x10000)>>10),2),be(0xdc00+((n-0x10000)&1023),2));}));

function makeGlyph(g,ascent,unit){
 const points=[];
 for(let y=0;y<g.h;y++)for(let x=0;x<g.w;x++)if(g.pixels[y*g.w+x]){
  const x0=(g.xOffset+x)*unit,x1=x0+unit,y0=(ascent-g.yOffset-y-1)*unit,y1=y0+unit;
  points.push([[x0,y0],[x0,y1],[x1,y1],[x1,y0]]);
 }
 if(!points.length)return {bytes:new Uint8Array(0),bounds:[0,0,0,0],contours:0,points:0};
 const coords=points.flat(),xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
 const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
 const n=coords.length,header=new Uint8Array(10+points.length*2+2+n+n*4),v=new DataView(header.buffer);
 writeS16(v,0,points.length);bounds.forEach((value,i)=>writeS16(v,2+i*2,value));
 for(let i=0;i<points.length;i++)write16(v,10+i*2,i*4+3);
 const flags=12+points.length*2;for(let i=0;i<n;i++)header[flags+i]=0x41;// on-curve + overlap
 let prevX=0,prevY=0;for(let i=0;i<n;i++){const [x,y]=coords[i];writeS16(v,flags+n+i*2,x-prevX);prevX=x;}
 for(let i=0;i<n;i++){const y=coords[i][1];writeS16(v,flags+n+n*2+i*2,y-prevY);prevY=y;}
 return {bytes:header,bounds,contours:points.length,points:n};
}
function makeCmap(pairs){
 const bmp=pairs.filter(([cp])=>cp<=0xffff),seg=bmp.length+1;
 const f4=new Uint8Array(16+seg*8),v4=new DataView(f4.buffer);write16(v4,0,4);write16(v4,2,f4.length);write16(v4,6,seg*2);
 const pow=2**Math.floor(Math.log2(seg));write16(v4,8,pow*2);write16(v4,10,Math.log2(pow));write16(v4,12,seg*2-pow*2);
 let p=14;for(const [cp] of bmp){write16(v4,p,cp);p+=2;}write16(v4,p,0xffff);p+=2;write16(v4,p,0);p+=2;
 for(const [cp] of bmp){write16(v4,p,cp);p+=2;}write16(v4,p,0xffff);p+=2;
 for(const [cp,id] of bmp){write16(v4,p,(id-cp)&65535);p+=2;}write16(v4,p,1);p+=2;
 // idRangeOffset is zero for each one-character segment, including the sentinel.
 const f12=new Uint8Array(16+pairs.length*12),v12=new DataView(f12.buffer);
 write16(v12,0,12);write32(v12,4,f12.length);write32(v12,12,pairs.length);
 pairs.forEach(([cp,id],i)=>{const at=16+i*12;write32(v12,at,cp);write32(v12,at+4,cp);write32(v12,at+8,id);});
 const out=new Uint8Array(20+f4.length+f12.length),v=new DataView(out.buffer);write16(v,2,2);
 write16(v,4,3);write16(v,6,1);write32(v,8,20);write16(v,12,3);write16(v,14,10);write32(v,16,20+f4.length);
 out.set(f4,20);out.set(f12,20+f4.length);return out;
}
function makeName(face){
 const family=String(face||'Nerulio Pixel').replace(/[\u0000-\u001f]/g,' ').slice(0,60),ps=family.replace(/[^A-Za-z0-9]/g,'')||'NerulioPixel';
 const names=[[1,family],[2,'Regular'],[3,`${ps}-1.0`],[4,`${family} Regular`],[5,'Version 1.0'],[6,ps]],records=[],strings=[];let offset=0;
 for(const [id,value] of names){const b=utf16(value);records.push({id,length:b.length,offset});strings.push(b);offset+=b.length;}
 const out=new Uint8Array(6+records.length*12+offset),v=new DataView(out.buffer);write16(v,2,records.length);write16(v,4,6+records.length*12);
 records.forEach((r,i)=>{const p=6+i*12;write16(v,p,3);write16(v,p+2,1);write16(v,p+4,0x409);write16(v,p+6,r.id);write16(v,p+8,r.length);write16(v,p+10,r.offset);});
 let at=6+records.length*12;for(const b of strings){out.set(b,at);at+=b.length;}return out;
}
function makeKern(project,index,unit){
 const pairs=(project.kernings||[]).filter(k=>index.has(k.first)&&index.has(k.second)).map(k=>[index.get(k.first),index.get(k.second),k.amount*unit]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 if(!pairs.length)return null;const out=new Uint8Array(18+pairs.length*6),v=new DataView(out.buffer);
 write16(v,2,1);write16(v,6,out.length-4);write16(v,8,1);write16(v,10,pairs.length);
 const pow=2**Math.floor(Math.log2(pairs.length));write16(v,12,pow*6);write16(v,14,Math.log2(pow));write16(v,16,pairs.length*6-pow*6);
 pairs.forEach(([a,b,n],i)=>{const at=18+i*6;write16(v,at,a);write16(v,at+2,b);writeS16(v,at+4,n);});return out;
}
export function writePixelTtf(project){
 validateFontProject(project);
 const glyphs=[...project.glyphs].sort((a,b)=>a.codepoint-b.codepoint);
 if(glyphs.length>512||project.lineHeight>128)throw Error('TTF export currently supports up to 512 glyphs at 128px line height');
 const filled=glyphs.reduce((n,g)=>n+g.pixels.reduce((m,p)=>m+p,0),0);
 if(filled>30_000)throw Error('TTF contour budget exceeded; choose fewer or smaller glyphs');
 const unit=64,em=project.lineHeight*unit,ascent=project.ascent*unit,descent=-project.descent*unit;
 const index=new Map(glyphs.map((g,i)=>[g.codepoint,i+1])),pairs=glyphs.map((g,i)=>[g.codepoint,i+1]);
 const encoded=[{bytes:new Uint8Array(0),bounds:[0,0,0,0],contours:0,points:0},...glyphs.map(g=>makeGlyph(g,project.ascent,unit))];
 const loca=[0],glyfParts=[];let off=0;for(const g of encoded){const padded=concat(g.bytes,new Uint8Array((4-g.bytes.length%4)%4));glyfParts.push(padded);off+=padded.length;loca.push(off);}
 const glyf=concat(...glyfParts),locaBytes=concat(...loca.map(n=>be(n,4)));
 const allBounds=encoded.slice(1).filter(g=>g.contours).map(g=>g.bounds),bbox=allBounds.length?[Math.min(...allBounds.map(b=>b[0])),Math.min(...allBounds.map(b=>b[1])),Math.max(...allBounds.map(b=>b[2])),Math.max(...allBounds.map(b=>b[3]))]:[0,0,0,0];
 const head=new Uint8Array(54),hv=new DataView(head.buffer);write32(hv,0,0x00010000);write32(hv,4,0x00010000);write32(hv,12,0x5f0f3cf5);write16(hv,16,0x000b);write16(hv,18,em);
 write32(hv,24,3_870_000_000);write32(hv,32,3_870_000_000);
 bbox.forEach((n,i)=>writeS16(hv,36+i*2,n));write16(hv,46,8);writeS16(hv,50,1);
 const hhea=new Uint8Array(36),hh=new DataView(hhea.buffer);write32(hh,0,0x00010000);writeS16(hh,4,ascent);writeS16(hh,6,descent);
 write16(hh,10,Math.max(0,...glyphs.map(g=>g.xAdvance*unit)));writeS16(hh,12,Math.min(0,...bbox.slice(0,1)));writeS16(hh,14,0);writeS16(hh,16,bbox[2]);writeS16(hh,18,1);write16(hh,34,glyphs.length+1);
 const maxp=new Uint8Array(32),mv=new DataView(maxp.buffer);write32(mv,0,0x00010000);write16(mv,4,glyphs.length+1);write16(mv,6,Math.max(0,...encoded.map(g=>g.points)));write16(mv,8,Math.max(0,...encoded.map(g=>g.contours)));write16(mv,14,2);
 const hmtx=concat(be(unit,2),be(0,2),...glyphs.map((g,i)=>concat(be(g.xAdvance*unit,2),s16(encoded[i+1].bounds[0]))));
 const os2=new Uint8Array(78),ov=new DataView(os2.buffer);writeS16(ov,2,Math.round(glyphs.reduce((n,g)=>n+g.xAdvance,0)/Math.max(glyphs.length,1))*unit);write16(ov,4,400);write16(ov,6,5);
 os2.set([78,82,76,79],58);write16(ov,62,0x40);write16(ov,64,Math.min(0xffff,glyphs[0]?.codepoint??0));write16(ov,66,Math.min(0xffff,glyphs.at(-1)?.codepoint??0));
 writeS16(ov,68,ascent);writeS16(ov,70,descent);write16(ov,74,Math.max(0,bbox[3]));write16(ov,76,Math.max(0,-bbox[1]));
 const post=new Uint8Array(32),pv=new DataView(post.buffer);write32(pv,0,0x00030000);
 const gasp=new Uint8Array(8),gv=new DataView(gasp.buffer);write16(gv,2,1);write16(gv,4,65535);write16(gv,6,2);// grayscale allowed, grid fitting off
 const tables=new Map([['OS/2',os2],['cmap',makeCmap(pairs)],['gasp',gasp],['glyf',glyf],['head',head],['hhea',hhea],['hmtx',hmtx],['loca',locaBytes],['maxp',maxp],['name',makeName(project.face)],['post',post]]);
 const kern=makeKern(project,index,unit);if(kern)tables.set('kern',kern);
 const tags=[...tables.keys()].sort(),count=tags.length,pow=2**Math.floor(Math.log2(count));
 let size=12+count*16;const records=[];for(const tag of tags){const data=tables.get(tag),offset=size;records.push({tag,data,offset});size+=(data.length+3)&~3;}
 const out=new Uint8Array(size),v=new DataView(out.buffer);write32(v,0,0x00010000);write16(v,4,count);write16(v,6,pow*16);write16(v,8,Math.log2(pow));write16(v,10,count*16-pow*16);
 records.forEach((r,i)=>{const at=12+i*16;out.set([...r.tag].map(ch=>ch.charCodeAt(0)),at);write32(v,at+4,sum32(r.data));write32(v,at+8,r.offset);write32(v,at+12,r.data.length);out.set(r.data,r.offset);});
 const headRecord=records.find(r=>r.tag==='head');write32(v,headRecord.offset+8,(0xb1b0afba-sum32(out))>>>0);
 return out;
}
