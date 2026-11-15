/** Image metadata reader and remover for JPEG, PNG and WebP.
 * It works on the container only: segments and chunks are listed, then copied or dropped whole,
 * so the compressed pixel data is never decoded or re-encoded. Dependency-free and DOM-free;
 * used by src/task/image-metadata.js and tests/image-metadata.test.mjs. */
const utf8=new TextDecoder(),latin1=new TextDecoder('latin1');
const be16=(b,o)=>b[o]<<8|b[o+1],be32=(b,o)=>(b[o]*0x1000000+(b[o+1]<<16|b[o+2]<<8|b[o+3]))>>>0,le32=(b,o)=>(b[o+3]*0x1000000+(b[o+2]<<16|b[o+1]<<8|b[o]))>>>0;
const starts=(b,o,s)=>{if(o+s.length>b.length)return false;for(let i=0;i<s.length;i++)if(b[o+i]!==s.charCodeAt(i))return false;return true;};
const clip=(s,n=400)=>s.length>n?s.slice(0,n)+'…':s;
export function detect(b){
 if(b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'jpeg';
 if(starts(b,0,'\x89PNG\r\n\x1a\n'))return 'png';
 if(starts(b,0,'RIFF')&&starts(b,8,'WEBP'))return 'webp';
 return '';
}
const TYPE_SIZE=[0,1,1,2,4,8,1,1,2,4,8,4,8];
/** Reads the fields people care about from a TIFF/EXIF block (starting at its II/MM header). */
export function readExif(t){
 if(!t||t.length<8)return null;
 const le=t[0]===0x49&&t[1]===0x49;if(!le&&!(t[0]===0x4d&&t[1]===0x4d))return null;
 const r16=o=>le?t[o]|t[o+1]<<8:t[o]<<8|t[o+1],r32=o=>le?le32(t,o):be32(t,o);
 if(r16(2)!==42)return null;
 let count=0;const seen=new Set();
 const value=(type,n,at)=>{
  if(type===2){const raw=t.subarray(at,at+n),z=raw.indexOf(0);return utf8.decode(z<0?raw:raw.subarray(0,z)).trim();}
  if(type===7)return t.subarray(at,at+n);
  const one=o=>type===1?t[o]:type===6?t[o]<<24>>24:type===3?r16(o):type===8?r16(o)<<16>>16:type===4?r32(o):type===9?r32(o)|0:type===5?(r32(o+4)?r32(o)/r32(o+4):0):type===10?((r32(o+4)|0)?(r32(o)|0)/(r32(o+4)|0):0):0;
  const out=[];for(let i=0;i<Math.min(n,8);i++)out.push(one(at+i*TYPE_SIZE[type]));return n===1?out[0]:out;
 };
 const ifd=off=>{
  const tags=new Map();if(typeof off!=='number'||off<8||seen.has(off)||off+2>t.length)return {tags,next:0};seen.add(off);
  const n=r16(off);
  for(let i=0;i<n;i++){const e=off+2+i*12;if(e+12>t.length)break;const type=r16(e+2),cnt=r32(e+4),size=(TYPE_SIZE[type]||0)*cnt;if(!size)continue;const at=size<=4?e+8:r32(e+8);if(at+size>t.length)continue;tags.set(r16(e),value(type,cnt,at));count++;}
  const end=off+2+n*12;return {tags,next:end+4<=t.length?r32(end):0};
 };
 const first=ifd(r32(4)),exif=ifd(first.tags.get(0x8769)).tags,gpsTags=ifd(first.tags.get(0x8825)).tags,thumb=ifd(first.next).tags;
 const s=(m,k)=>{const v=m.get(k);return typeof v==='string'?v:'';},n=(m,k)=>{let v=m.get(k);if(Array.isArray(v))v=v[0];return typeof v==='number'&&Number.isFinite(v)?v:null;};
 const dms=v=>Array.isArray(v)&&v.length>=3?v[0]+v[1]/60+v[2]/3600:NaN;
 const lat=dms(gpsTags.get(2)),lon=dms(gpsTags.get(4));let gps=null;
 if(Number.isFinite(lat)&&Number.isFinite(lon)&&lat<=90&&lon<=180){
  const alt=n(gpsTags,6);
  gps={latitude:/^s/i.test(s(gpsTags,1))?-lat:lat,longitude:/^w/i.test(s(gpsTags,3))?-lon:lon,altitude:alt===null?null:n(gpsTags,5)===1?-alt:alt,date:s(gpsTags,29)};
 }
 const orientation=n(first.tags,0x0112);
 return {tags:count,orientation:orientation>=1&&orientation<=8?orientation:1,make:s(first.tags,0x010f),model:s(first.tags,0x0110),software:s(first.tags,0x0131),modified:s(first.tags,0x0132),description:s(first.tags,0x010e),artist:s(first.tags,0x013b),copyright:s(first.tags,0x8298),
  taken:s(exif,0x9003)||s(exif,0x9004),exposure:n(exif,0x829a),fNumber:n(exif,0x829d),iso:n(exif,0x8827),focal:n(exif,0x920a),lens:s(exif,0xa434),owner:s(exif,0xa430),serial:s(exif,0xa431),gps,gpsTags:gpsTags.size,thumbnail:n(thumb,0x0202)||0};
}
/** Download name for the cleaned copy: photo.JPG → photo-clean.JPG; a wrong or missing extension is corrected. */
export const cleanName=(name,format)=>{const dot=name.lastIndexOf('.'),ext=dot>0?name.slice(dot+1):'';return (dot>0?name.slice(0,dot):name)+'-clean.'+(/^(jpe?g|png|webp)$/i.test(ext)?ext:{jpeg:'jpg',png:'png',webp:'webp'}[format]);};
/** Decimal degrees and degrees–minutes–seconds text for a GPS position. */
export function formatCoordinates({latitude,longitude}){
 const part=(v,pos,neg)=>{const a=Math.abs(v);let d=Math.floor(a),m=Math.floor((a-d)*60),sec=Math.round(((a-d)*60-m)*600)/10;if(sec>=60){sec=0;m++;}if(m>=60){m=0;d++;}return `${d}°${String(m).padStart(2,'0')}′${sec.toFixed(1).padStart(4,'0')}″${v<0?neg:pos}`;};
 return {decimal:`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,dms:`${part(latitude,'N','S')} ${part(longitude,'E','W')}`};
}
// A part is a byte range of the file. kind '' is structure or pixel data (always kept); any other
// kind is metadata: exif, xmp, icc, iptc, comment, text, time, thumbnail, other, trailing.
function jpegParts(b){
 const parts=[{start:0,end:2,kind:''}],info={width:0,height:0,damaged:false,exif:null};let o=2,ended=false;
 while(o+1<b.length){
  const start=o;if(b[o]!==0xff){info.damaged=true;break;}
  while(b[o+1]===0xff&&o+2<b.length)o++;
  const m=b[o+1];
  if(m===0xd9){parts.push({start,end:o+2,kind:''});o+=2;ended=true;break;}
  if(m===0x01||m>=0xd0&&m<=0xd7){parts.push({start,end:o+2,kind:''});o+=2;continue;}
  if(o+4>b.length){o=start;info.damaged=true;break;}
  const len=be16(b,o+2),body=o+4;let end=o+2+len;
  if(len<2||end>b.length){o=start;info.damaged=true;break;}
  let kind='',label='',text='';
  if(m===0xda){ // entropy-coded scan data runs to the next real marker
   let p=end;for(;;){p=b.indexOf(0xff,p);if(p<0||p+1>=b.length){p=b.length;break;}const x=b[p+1];if(x!==0&&x!==0xff&&!(x>=0xd0&&x<=0xd7))break;p++;}
   end=p;
  }else if(m>=0xc0&&m<=0xcf&&m!==0xc4&&m!==0xc8&&m!==0xcc){if(len>=7){info.height=be16(b,body+1);info.width=be16(b,body+3);}}
  else if(m===0xe0){if(starts(b,body,'JFXX\0')){kind='thumbnail';label='JFXX';}}
  else if(m===0xe1){
   if(starts(b,body,'Exif\0\0')){kind='exif';info.exif||=readExif(b.subarray(body+6,end));}
   else if(starts(b,body,'http://ns.adobe.com/xap/1.0/\0')||starts(b,body,'http://ns.adobe.com/xmp/extension/\0')){kind='xmp';text=latin1.decode(b.subarray(body,end));}
   else{kind='other';label='APP1';}
  }
  else if(m===0xe2){if(starts(b,body,'ICC_PROFILE\0'))kind='icc';else{kind='other';label=starts(b,body,'MPF\0')?'MPF':'APP2';}}
  else if(m===0xed){kind='iptc';}
  else if(m===0xee&&starts(b,body,'Adobe')){kind='';} // the decoder needs Adobe's colour-transform flag
  else if(m>=0xe3&&m<=0xef){kind='other';label='APP'+(m-0xe0);}
  else if(m===0xfe){kind='comment';text=clip(utf8.decode(b.subarray(body,end)).replace(/\0+$/,''));}
  parts.push({start,end,kind,label,text});o=end;
 }
 if(o<b.length)parts.push({start:o,end:b.length,kind:ended&&!info.damaged?'trailing':''});
 return {parts,info};
}
const PNG_KEEP=new Set(['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','cHRM','sRGB','sBIT','cICP','mDCv','cLLi','bKGD','hIST','sPLT','pHYs','acTL','fcTL','fdAT']);
function pngParts(b){
 const parts=[{start:0,end:8,kind:''}],info={width:0,height:0,damaged:false,exif:null};let o=8,ended=false;
 while(o+12<=b.length){
  const len=be32(b,o),type=latin1.decode(b.subarray(o+4,o+8)),end=o+12+len;if(end>b.length){info.damaged=true;break;}
  const data=b.subarray(o+8,o+8+len);let kind='',label='',text='';
  if(type==='IHDR'&&len>=8){info.width=be32(data,0);info.height=be32(data,4);}
  else if(type==='tEXt'||type==='zTXt'||type==='iTXt'){
   const z=data.indexOf(0),key=latin1.decode(data.subarray(0,z<0?data.length:z));label=key;kind=key==='XML:com.adobe.xmp'?'xmp':'text';
   if(z>=0&&type==='tEXt')text=latin1.decode(data.subarray(z+1));
   else if(z>=0&&type==='iTXt'&&data[z+1]===0){let p=data.indexOf(0,z+3);p=p<0?-1:data.indexOf(0,p+1);if(p>=0)text=utf8.decode(data.subarray(p+1));}
   if(kind==='text')text=clip(text);
  }
  else if(type==='eXIf'){kind='exif';info.exif||=readExif(data);}
  else if(type==='tIME'){kind='time';if(len>=7)text=`${be16(data,0)}-${String(data[2]).padStart(2,'0')}-${String(data[3]).padStart(2,'0')} ${String(data[4]).padStart(2,'0')}:${String(data[5]).padStart(2,'0')}:${String(data[6]).padStart(2,'0')} UTC`;}
  else if(type==='iCCP'){kind='icc';}
  else if(!PNG_KEEP.has(type)&&(b[o+4]&0x20)){kind='other';label=type;} // unknown ancillary chunk
  parts.push({start:o,end,kind,label,text});o=end;if(type==='IEND'){ended=true;break;}
 }
 if(o<b.length)parts.push({start:o,end:b.length,kind:ended?'trailing':''});
 if(!ended)info.damaged=true;
 return {parts,info};
}
const WEBP_KEEP=new Set(['VP8X','VP8 ','VP8L','ALPH','ANIM','ANMF']);
function webpParts(b){
 const parts=[{start:0,end:12,kind:''}],info={width:0,height:0,damaged:false,exif:null},limit=Math.min(b.length,8+le32(b,4));let o=12;
 while(o+8<=limit){
  const id=latin1.decode(b.subarray(o,o+4)),len=le32(b,o+4);if(o+8+len>limit){info.damaged=true;break;}
  const end=Math.min(b.length,o+8+len+(len&1)),d=o+8;let kind='',label='';let text='';
  if(id==='VP8X'&&len>=10){info.width=1+(b[d+4]|b[d+5]<<8|b[d+6]<<16);info.height=1+(b[d+7]|b[d+8]<<8|b[d+9]<<16);}
  else if(id==='VP8 '&&!info.width&&len>=10&&b[d+3]===0x9d&&b[d+4]===0x01&&b[d+5]===0x2a){info.width=(b[d+6]|b[d+7]<<8)&0x3fff;info.height=(b[d+8]|b[d+9]<<8)&0x3fff;}
  else if(id==='VP8L'&&!info.width&&len>=5&&b[d]===0x2f){const bits=le32(b,d+1);info.width=1+(bits&0x3fff);info.height=1+(bits>>>14&0x3fff);}
  else if(id==='EXIF'){kind='exif';info.exif||=readExif(b.subarray(starts(b,d,'Exif\0\0')?d+6:d,d+len));}
  else if(id==='XMP '){kind='xmp';text=latin1.decode(b.subarray(d,d+len));}
  else if(id==='ICCP'){kind='icc';}
  else if(!WEBP_KEEP.has(id)){kind='other';label=id.trim();}
  parts.push({start:o,end,kind,label,text});o=end;
 }
 if(o<b.length)parts.push({start:o,end:b.length,kind:info.damaged?'':'trailing'});
 return {parts,info};
}
const walk=(b,format)=>format==='jpeg'?jpegParts(b):format==='png'?pngParts(b):format==='webp'?webpParts(b):null;
/** What a file contains: {format,width,height,size,damaged,exif,blocks:[{kind,bytes,label,text}]}.
 * format is '' for anything that is not JPEG, PNG or WebP. */
export function inspect(bytes){
 const format=detect(bytes),w=walk(bytes,format);
 if(!w)return {format:'',width:0,height:0,size:bytes.length,damaged:false,exif:null,blocks:[],location:false};
 const blocks=w.parts.filter(p=>p.kind).map(p=>({kind:p.kind,bytes:p.end-p.start,label:p.label||'',text:p.kind==='xmp'?'':p.text||'',location:p.kind==='xmp'&&/GPSLatitude/.test(p.text||'')}));
 return {format,width:w.info.width,height:w.info.height,size:bytes.length,damaged:w.info.damaged,exif:w.info.exif,blocks,location:!!w.info.exif?.gps||blocks.some(x=>x.location)};
}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^c>>>1:c>>>1;t[n]=c>>>0;}return t;})();
export function crc32(b){let c=0xffffffff;for(let i=0;i<b.length;i++)c=CRC[(c^b[i])&0xff]^c>>>8;return (c^0xffffffff)>>>0;}
/** The smallest EXIF block that still says how to rotate the picture: one Orientation tag. */
export const orientationExif=o=>Uint8Array.of(0x4d,0x4d,0,0x2a,0,0,0,8,0,1,0x01,0x12,0,3,0,0,0,1,0,o,0,0,0,0,0,0);
/** A copy without metadata. Pixel data is copied byte for byte. Options: keepICC (default true)
 * keeps the colour profile; keepOrientation (default true) writes back a one-tag EXIF block when
 * the removed EXIF rotated the picture, so the copy is not shown sideways.
 * Returns {bytes,removed:[{kind,bytes}],removedBytes,orientationKept}; throws on other formats. */
export function strip(bytes,{keepICC=true,keepOrientation=true}={}){
 const format=detect(bytes),w=walk(bytes,format);if(!w)throw new Error('unsupported');
 const keeps=p=>!p.kind||p.kind==='icc'&&keepICC,removed=w.parts.filter(p=>!keeps(p)).map(p=>({kind:p.kind,bytes:p.end-p.start}));
 const orientation=w.info.exif?.orientation||1,restore=keepOrientation&&orientation>1&&removed.some(p=>p.kind==='exif')&&(format!=='webp'||starts(bytes,12,'VP8X'));
 const chunks=[];let insertAfter=-1,extra=null;
 if(restore){
  const tiff=orientationExif(orientation);
  if(format==='jpeg'){insertAfter=bytes[2]===0xff&&bytes[3]===0xe0&&keeps(w.parts[1])?1:0;const seg=new Uint8Array(10+tiff.length);seg.set([0xff,0xe1,0,8+tiff.length,0x45,0x78,0x69,0x66,0,0]);seg.set(tiff,10);extra=seg;}
  else if(format==='png'){insertAfter=1;const seg=new Uint8Array(12+tiff.length),v=new DataView(seg.buffer);v.setUint32(0,tiff.length);seg.set([0x65,0x58,0x49,0x66],4);seg.set(tiff,8);v.setUint32(8+tiff.length,crc32(seg.subarray(4,8+tiff.length)));extra=seg;}
  else{insertAfter=w.parts.length-1;while(insertAfter>0&&!keeps(w.parts[insertAfter]))insertAfter--;const seg=new Uint8Array(8+tiff.length);seg.set([0x45,0x58,0x49,0x46,tiff.length,0,0,0]);seg.set(tiff,8);extra=seg;}
 }
 w.parts.forEach((p,i)=>{if(keeps(p))chunks.push(bytes.subarray(p.start,p.end));if(i===insertAfter)chunks.push(extra);});
 const out=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}
 if(format==='webp'){
  new DataView(out.buffer).setUint32(4,out.length-8,true);
  if(starts(out,12,'VP8X')){let flags=out[20]&~0x04;if(!restore)flags&=~0x08;if(!keepICC)flags&=~0x20;out[20]=flags;}
 }
 return {bytes:out,removed,removedBytes:removed.reduce((n,p)=>n+p.bytes,0),orientationKept:restore};
}
