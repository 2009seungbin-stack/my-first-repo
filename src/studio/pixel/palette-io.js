/** Palette files in and out for the Pixel workspace. Pure (bytes/text in, bytes/text out).
 *
 *  .gpl   GIMP palette (also Aseprite's and Lospec's; "Channels: RGBA" alpha extension read/written)
 *  .pal   JASC-PAL text (Paint Shop Pro / Aseprite) and Microsoft RIFF PAL (binary) — both read
 *  .hex   one RRGGBB per line (Lospec)
 *  .ase   Adobe Swatch Exchange ('ASEF', RGB / CMYK / LAB / Gray swatches) — NOT the Aseprite sprite
 *         format, which shares the extension; an Aseprite sprite's palette is read by readAseprite
 *  .act   Adobe Color Table (768 bytes + optional count)
 *  .json  Lospec's palette JSON ({name, author, colors:['rrggbb']}) and plain lists
 * Every reader detects the format from the bytes, never from the extension alone, and throws a
 * readable error instead of guessing. Colours come back as [r,g,b,a]. */
import {readAseprite} from '../../game/aseprite.js';
import {MAX_PALETTE,hex} from './indexed.js';
const td=new TextDecoder('utf-8');
const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
const cap=colors=>{if(!colors.length)throw Error('No colours found in this palette file');if(colors.length>MAX_PALETTE)throw Error(`A palette holds at most ${MAX_PALETTE} colours (this file has ${colors.length})`);return colors;};
// ------------------------------------------------------------------ GPL
export function parseGPL(text){
 const lines=String(text).replace(/^﻿/,'').split(/\r\n|\r|\n/);let at=0;while(at<lines.length&&!lines[at].trim())at++;
 if(lines[at]?.trim()!=='GIMP Palette')throw Error('Not a GIMP palette: the first line must be "GIMP Palette"');
 let name='',rgba=false;const colors=[],names=[];
 for(at++;at<lines.length;at++){
  const s=lines[at].trim();if(!s)continue;
  if(s.startsWith('#')){const m=/^#\s*Palette Name:\s*(.+)$/i.exec(s);if(m&&!name)name=m[1].trim();continue;}
  const meta=/^(Name|Columns|Channels):\s*(.*)$/i.exec(s);
  if(meta){if(meta[1].toLowerCase()==='name')name=meta[2].trim();else if(meta[1].toLowerCase()==='channels')rgba=/rgba/i.test(meta[2]);continue;}
  const m=rgba?/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(s):/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/.exec(s);
  if(!m)throw Error(`Line ${at+1} is not a palette colour: "${s.slice(0,40)}"`);
  const c=m.slice(1,rgba?5:4).map(Number);if(c.some(v=>v>255))throw Error(`Line ${at+1} has a channel above 255`);
  colors.push(rgba?c:[...c,255]);names.push((m[rgba?5:4]||'').trim());
 }
 return {format:'gpl',name,colors:cap(colors),names};
}
export function toGPL(colors,{name='Palette',names=[]}={}){
 const alpha=colors.some(c=>(c[3]??255)<255),pad=v=>String(clamp(v)).padStart(3,' ');
 const rows=colors.map((c,i)=>`${pad(c[0])} ${pad(c[1])} ${pad(c[2])}${alpha?' '+pad(c[3]??255):''}\t${names[i]||hex(c).slice(1).toUpperCase()}`);
 return `GIMP Palette\n${alpha?'Channels: RGBA\n':''}Name: ${String(name).replace(/[\r\n]+/g,' ').trim()||'Palette'}\nColumns: ${Math.min(16,colors.length)}\n#\n${rows.join('\n')}\n`;
}
// ------------------------------------------------------------------ JASC-PAL / RIFF PAL
export function parseJASC(text){
 const lines=String(text).replace(/^﻿/,'').split(/\r\n|\r|\n/).map(s=>s.trim()).filter(Boolean);
 if(lines[0]!=='JASC-PAL')throw Error('Not a JASC palette');
 const n=Number(lines[2]);if(!Number.isInteger(n)||n<1)throw Error('JASC palette: bad colour count');
 const colors=[];
 for(let i=0;i<n;i++){const m=/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s+(\d{1,3}))?$/.exec(lines[3+i]||'');if(!m)throw Error(`JASC palette: colour ${i+1} is missing or malformed`);colors.push([+m[1],+m[2],+m[3],m[4]!=null?+m[4]:255].map(clamp));}
 return {format:'pal',name:'',colors:cap(colors),names:colors.map(()=>'')};
}
export const toJASC=colors=>`JASC-PAL\r\n0100\r\n${colors.length}\r\n${colors.map(c=>`${clamp(c[0])} ${clamp(c[1])} ${clamp(c[2])}`).join('\r\n')}\r\n`;
function parseRIFF(b){
 const s=(o,n)=>String.fromCharCode(...b.subarray(o,o+n)),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(s(0,4)!=='RIFF'||s(8,4)!=='PAL ')throw Error('Not a RIFF palette');
 for(let at=12;at+8<=b.length;){const id=s(at,4),len=v.getUint32(at+4,true);
  if(id==='data'){const n=v.getUint16(at+10,true),colors=[];for(let i=0;i<n;i++){const o=at+12+i*4;if(o+3>=b.length)break;colors.push([b[o],b[o+1],b[o+2],255]);}return {format:'pal',name:'',colors:cap(colors),names:colors.map(()=>'')};}
  at+=8+len+(len&1);}
 throw Error('RIFF palette without a data chunk');
}
// ------------------------------------------------------------------ Adobe Swatch Exchange
function parseASEF(b){
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(String.fromCharCode(b[0],b[1],b[2],b[3])!=='ASEF')throw Error('Not an Adobe swatch file');
 const blocks=v.getUint32(8),colors=[],names=[];let at=12;
 for(let k=0;k<blocks&&at+6<=b.length;k++){
  const type=v.getUint16(at),len=v.getUint32(at+2),body=at+6;at=body+len;
  if(type!==1)continue;// group start/end
  const nlen=v.getUint16(body);let name='';for(let i=0;i<nlen-1;i++)name+=String.fromCharCode(v.getUint16(body+2+i*2));
  let o=body+2+nlen*2;const model=String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3]).trim();o+=4;
  const f=i=>v.getFloat32(o+i*4);let c;
  if(model==='RGB')c=[f(0),f(1),f(2)].map(x=>clamp(x*255));
  else if(model==='Gray'){const g=clamp(f(0)*255);c=[g,g,g];}
  else if(model==='CMYK'){const [C,M,Y,K]=[f(0),f(1),f(2),f(3)];c=[255*(1-C)*(1-K),255*(1-M)*(1-K),255*(1-Y)*(1-K)].map(clamp);}
  else if(model==='LAB'){c=labToRGB(f(0)*100,f(1),f(2));}
  else throw Error(`Swatch "${name}" uses an unknown colour model ${model}`);
  colors.push([...c,255]);names.push(name);
 }
 return {format:'ase',name:'',colors:cap(colors),names};
}
function labToRGB(L,a,bb){// CIE L*a*b* (D50) → sRGB, as Adobe swatches define it
 const fy=(L+16)/116,fx=fy+a/500,fz=fy-bb/200,e=216/24389,k=24389/27,f3=t=>t**3>e?t**3:(116*t-16)/k;
 let X=.9642*f3(fx),Y=L>k*e?fy**3:L/k,Z=.8249*f3(fz);
 // Bradford D50 → D65
 const x=.9555766*X-.0230393*Y+.0631636*Z,y=-.0282895*X+1.0099416*Y+.0210077*Z,z=.0122982*X-.020483*Y+1.3299098*Z;
 const lin=[3.2404542*x-1.5371385*y-.4985314*z,-.969266*x+1.8760108*y+.041556*z,.0556434*x-.2040259*y+1.0572252*z];
 return lin.map(u=>clamp(255*(u<=.0031308?12.92*u:1.055*Math.pow(Math.max(0,u),1/2.4)-.055)));
}
export function toASEF(colors,{names=[]}={}){
 const blocks=colors.map((c,i)=>{const name=names[i]||hex(c).slice(1).toUpperCase(),nlen=name.length+1,len=2+nlen*2+4+12+2,buf=new Uint8Array(6+len),v=new DataView(buf.buffer);
  v.setUint16(0,1);v.setUint32(2,len);v.setUint16(6,nlen);for(let k=0;k<name.length;k++)v.setUint16(8+k*2,name.charCodeAt(k));
  let o=8+nlen*2;buf.set([82,71,66,32],o);o+=4;for(let k=0;k<3;k++)v.setFloat32(o+k*4,c[k]/255);v.setUint16(o+12,2);return buf;});
 const head=new Uint8Array(12),hv=new DataView(head.buffer);head.set([65,83,69,70],0);hv.setUint16(4,1);hv.setUint16(6,0);hv.setUint32(8,colors.length);
 const out=new Uint8Array(12+blocks.reduce((n,b)=>n+b.length,0));out.set(head,0);let at=12;for(const b of blocks){out.set(b,at);at+=b.length;}return out;
}
// ------------------------------------------------------------------ ACT
function parseACT(b){
 if(b.length!==768&&b.length!==772)throw Error('Not an Adobe Color Table');
 let n=256;if(b.length===772){n=(b[768]<<8)|b[769];if(!n||n>256)n=256;}
 const colors=[];for(let i=0;i<n;i++)colors.push([b[i*3],b[i*3+1],b[i*3+2],255]);
 return {format:'act',name:'',colors:cap(colors),names:colors.map(()=>'')};
}
export function toACT(colors){const out=new Uint8Array(772);colors.slice(0,256).forEach((c,i)=>out.set([c[0],c[1],c[2]].map(clamp),i*3));out[768]=colors.length>>8;out[769]=colors.length&255;out[770]=0xff;out[771]=0xff;return out;}
// ------------------------------------------------------------------ HEX / JSON (Lospec)
export function parseHexText(text){
 const colors=[];
 for(const [row,line]of String(text).replace(/^﻿/,'').split(/\r\n|\r|\n/).entries()){
  const s=line.trim();if(!s||/^(;|\/\/|#(?![0-9a-f]{3,8}\b))/i.test(s))continue;
  for(const t of s.split(/[\s,;]+/).filter(Boolean)){const m=/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(t);if(!m)throw Error(`Line ${row+1} is not a colour: "${t.slice(0,20)}"`);const n=parseInt(m[1],16);colors.push([n>>16&255,n>>8&255,n&255,m[2]?parseInt(m[2],16):255]);}
 }
 return {format:'hex',name:'',colors:cap(colors),names:colors.map(()=>'')};
}
export const toHexText=colors=>colors.map(c=>hex(c).slice(1)).join('\n')+'\n';
export function parsePaletteJSON(text){
 let v;try{v=typeof text==='string'?JSON.parse(text):text;}catch{throw Error('This file is not valid JSON');}
 const list=Array.isArray(v)?v:Array.isArray(v?.colors)?v.colors:null;if(!list)throw Error('A JSON palette needs a "colors" array');
 const colors=list.map((e,i)=>{const s=typeof e==='string'?e:e?.hex??e?.color;if(Array.isArray(e)&&e.length>=3)return [e[0],e[1],e[2],e[3]??255].map(clamp);const m=/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(s||''));if(!m)throw Error(`Colour ${i+1} is not a hex colour`);const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255,m[2]?parseInt(m[2],16):255];});
 return {format:'json',name:String(v?.name||''),author:String(v?.author||''),colors:cap(colors),names:colors.map(()=>'')};
}
export const toPaletteJSON=(colors,{name='Palette'}={})=>JSON.stringify({name,colors:colors.map(c=>hex(c).slice(1))},null,1)+'\n';
// ------------------------------------------------------------------ one entry point
const text=b=>td.decode(b);
/** Reads any supported palette file. `bytes` Uint8Array (or a string for text formats). */
export function readPalette(bytes,filename=''){
 if(typeof bytes==='string')bytes=new TextEncoder().encode(bytes);
 const b=bytes,head=String.fromCharCode(...b.subarray(0,4));
 if(head==='ASEF')return parseASEF(b);
 if(head==='RIFF')return parseRIFF(b);
 if(b.length>=6&&b[4]===0xE0&&b[5]===0xA5){// Aseprite sprite: take its palette
  const doc=readAseprite(b),p=doc.palette?.colors;if(!p?.length)throw Error('This Aseprite file has no palette');
  const colors=[];for(let i=0;i<p.length;i+=4)colors.push([p[i],p[i+1],p[i+2],p[i+3]]);
  return {format:'aseprite',name:'',colors:cap(colors),names:colors.map(()=>''),transparentIndex:doc.colorMode==='indexed'?doc.transparentIndex:null};
 }
 if(/\.act$/i.test(filename)&&(b.length===768||b.length===772))return parseACT(b);
 const s=text(b).replace(/^﻿/,''),t=s.trimStart();
 if(t.startsWith('GIMP Palette'))return parseGPL(s);
 if(t.startsWith('JASC-PAL'))return parseJASC(s);
 if(t.startsWith('{')||t.startsWith('['))return parsePaletteJSON(s);
 if(b.length===768||b.length===772)return parseACT(b);
 return parseHexText(s);
}
export const PALETTE_WRITERS=Object.freeze({
 gpl:{ext:'gpl',type:'text/plain',write:(c,o)=>toGPL(c,o)},
 pal:{ext:'pal',type:'text/plain',write:c=>toJASC(c)},
 hex:{ext:'hex',type:'text/plain',write:c=>toHexText(c)},
 ase:{ext:'ase',type:'application/octet-stream',write:(c,o)=>toASEF(c,o)},
 act:{ext:'act',type:'application/octet-stream',write:c=>toACT(c)},
 json:{ext:'json',type:'application/json',write:(c,o)=>toPaletteJSON(c,o)}
});
// ------------------------------------------------------------------ Lospec
/** Lospec's slug rule: lower case, spaces → '-', only letters, digits and dashes. */
export const lospecSlug=name=>String(name||'').trim().toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
export const lospecURL=slug=>`https://lospec.com/palette-list/${encodeURIComponent(lospecSlug(slug))}.json`;
/** A few well-known Lospec palettes, so the search box can suggest names without a request. */
export const LOSPEC_POPULAR=Object.freeze(['pico-8','endesga-32','endesga-64','sweetie-16','resurrect-64','apollo','aap-64','journey','slso8','nyx8','oil-6','ammo-8','dawnbringer-16','dawnbringer-32','zughy-32','lospec500','twilight-5','ice-cream-gb','kirokaze-gameboy','nintendo-gameboy-bgb','1bit-monitor-glow','cga-palette-1-high','commodore64','zx-spectrum','nes','sega-master-system','steam-lords','fantasy-24','vinik24','cc-29','bubblegum-16','island-joy-16','na16','rosy-42','sunset-8','hollow','paper-8','funkyfuture-8','blessing','pear36']);
