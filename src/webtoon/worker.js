import {profile,checkOutput} from './specs.js';
import {evenlySpaced,validateCuts,joinedLayout} from './geometry.js';
import {EFFECTS} from './effects.js';

const MAX_FILES=40,MAX_INPUT_BYTES=80_000_000,MAX_PIXELS=64_000_000,MAX_SIDE=32767;
const send=(id,type,data={})=>postMessage({id,type,...data});
const fail=(id,error)=>send(id,'error',{error:error?.message||String(error)});
let cancelled=new Set();
async function dimensions(file){
 const b=new DataView(await file.slice(0,65536).arrayBuffer());
 if(b.byteLength>=24&&b.getUint32(0)===0x89504e47&&b.getUint32(4)===0x0d0a1a0a)return {width:b.getUint32(16),height:b.getUint32(20),type:'png'};
 if(b.byteLength>=4&&b.getUint16(0)===0xffd8){let at=2;while(at+9<b.byteLength){if(b.getUint8(at)!==0xff){at++;continue;}const mark=b.getUint8(at+1);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(mark))return {width:b.getUint16(at+7),height:b.getUint16(at+5),type:'jpeg'};const len=b.getUint16(at+2);if(len<2)break;at+=2+len;}}
 if(b.byteLength>=30&&b.getUint32(0,true)===0x46464952&&b.getUint32(8,true)===0x50424557){const chunk=b.getUint32(12,true);if(chunk===0x58385056)return {width:1+b.getUint8(24)+(b.getUint8(25)<<8)+(b.getUint8(26)<<16),height:1+b.getUint8(27)+(b.getUint8(28)<<8)+(b.getUint8(29)<<16),type:'webp'};if(chunk===0x20385056)return {width:b.getUint16(26,true)&0x3fff,height:b.getUint16(28,true)&0x3fff,type:'webp'};}
 throw new Error('Could not read PNG, JPEG or WebP dimensions before decoding. Re-save the image as PNG.');
}
function memoryGate(d){if(d.width<1||d.height<1||d.width>MAX_SIDE||d.height>MAX_SIDE||d.width*d.height>MAX_PIXELS)throw new Error(`Image ${d.width}×${d.height} exceeds the safe 64 MP / 32,767 px side budget. Split it in your drawing app first.`);}
function canvas(w,h){const c=new OffscreenCanvas(w,h);if(!c.getContext('2d'))throw new Error('Canvas unavailable');return c;}
function ctx(c){return c.getContext('2d',{alpha:true,willReadFrequently:false});}
function inkRows(bitmap){
 const w=64,h=Math.min(bitmap.height,8192),c=canvas(w,h),g=ctx(c);g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(bitmap,0,0,w,h);
 const data=g.getImageData(0,0,w,h).data,rows=new Float32Array(bitmap.height),sample=new Float32Array(h);
 for(let y=0;y<h;y++){let ink=0;for(let x=0;x<w;x++){const i=(y*w+x)*4;ink+=1-(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;}sample[y]=ink/w;}
 for(let y=0;y<bitmap.height;y++)rows[y]=sample[Math.min(h-1,Math.floor(y*h/bitmap.height))];
 // Low-resolution analysis is advisory only; manually selected rows are authoritative.
 return rows;
}
async function encodeTile(c,format,maxBytes){
 const type=format==='jpeg'?'image/jpeg':'image/png';
 if(type==='image/png'){const blob=await c.convertToBlob({type});if(maxBytes&&blob.size>maxBytes)throw new Error(`PNG output ${blob.size} bytes exceeds ${maxBytes}. Choose JPEG or smaller cuts.`);return blob;}
 let best=null;
 for(const q of [.92,.84,.76,.68,.60,.50,.4,.3]){const b=await c.convertToBlob({type,quality:q});if(!maxBytes||b.size<=maxBytes)return b;best=b;}
 throw new Error(`JPEG output ${best?.size||0} bytes exceeds ${maxBytes} even at quality 0.3. Shorten the cut.`);
}
async function verify(blob,width,height,format){
 const b=await createImageBitmap(blob);const ok=b.width===width&&b.height===height&&blob.type===(format==='jpeg'?'image/jpeg':'image/png');b.close();if(!ok)throw new Error('Encoded tile failed independent decode/dimension check');
}
const pending=id=>{if(cancelled.has(id))throw new Error('Cancelled');};
async function runSplit(id,files,opts){
 if(files.length<1||files.length>MAX_FILES)throw new Error(`Choose 1–${MAX_FILES} images`);
 const p=profile(opts.profile),out=[];let index=0;
 for(const f of files){
  pending(id);if(f.size>MAX_INPUT_BYTES)throw new Error(`${f.name}: input exceeds 80 MB safe budget`);
  const d=await dimensions(f);memoryGate(d);
  send(id,'progress',{stage:'decode',done:index,total:files.length});
  const bmp=await createImageBitmap(f);try{
   if(bmp.width!==d.width||bmp.height!==d.height)throw new Error('Image header and decoded size disagree');
   if(p.width&&d.width<p.width)throw new Error(`Source width ${d.width} px is narrower than this exact ${p.width} px profile. Choose Custom to avoid silent upscaling.`);
   const outWidth=p.width||Math.min(d.width,p.maxWidth||d.width);
   const scale=outWidth/d.width,scaledHeight=Math.round(d.height*scale);
   if(outWidth>MAX_SIDE||scaledHeight>MAX_SIDE||outWidth*scaledHeight>MAX_PIXELS)throw new Error('Resized image exceeds safe canvas budget');
   const target=Math.max(1,Math.min(p.maxHeight||MAX_SIDE,Number(opts.height)||p.maxHeight||1280));
   // Explicit boundaries are in source rows; requested output height is converted back to source rows.
   const sourceTarget=Math.max(1,Math.floor(target/scale));
   const cuts=files.length===1&&Array.isArray(opts.cuts)&&opts.cuts.length?opts.cuts:evenlySpaced(d.height,sourceTarget);
   const segments=validateCuts(d.height,cuts);
   if(segments.length>200)throw new Error('More than 200 output slices would be needed. Use a taller target or split the source in a drawing app.');
   for(const segment of segments){
    pending(id);const h=Math.max(1,Math.round((segment.y+segment.height)*scale)-Math.round(segment.y*scale));
    if(p.maxHeight&&h>p.maxHeight)throw new Error('Manual cut exceeds profile height');
    const c=canvas(outWidth,h),g=ctx(c);
    if((opts.format||p.format)==='jpeg'){g.fillStyle=opts.matte||'#ffffff';g.fillRect(0,0,outWidth,h);}
    g.drawImage(bmp,0,segment.y,d.width,segment.height,0,0,outWidth,h);
    const format=opts.format||p.format,blob=await encodeTile(c,format,p.maxBytes);await verify(blob,outWidth,h,format);
    out.push({blob,width:outWidth,height:h,bytes:blob.size,source:f.name,sourceY:segment.y,sourceHeight:segment.height,sourceWidth:d.width,format});
    send(id,'progress',{stage:'encode',done:out.length,total:files.length});
   }
  }finally{bmp.close();}index++;
 }
 const report=checkOutput(opts.profile,out);if(!report.ok)throw new Error(report.errors.join('; '));
 send(id,'done',{parts:out,report});
}
async function runJoin(id,files,opts){
 if(files.length<2||files.length>MAX_FILES)throw new Error(`Join 2–${MAX_FILES} images`);
 const dims=[];for(const f of files){if(f.size>MAX_INPUT_BYTES)throw new Error('Input exceeds 80 MB safe budget');const d=await dimensions(f);memoryGate(d);dims.push(d);}
 const layout=joinedLayout(dims,{maxPixels:MAX_PIXELS,maxSide:MAX_SIDE}),c=canvas(layout.width,layout.height),g=ctx(c);
 for(let i=0;i<files.length;i++){pending(id);const b=await createImageBitmap(files[i]);try{g.drawImage(b,layout.placements[i].x,layout.placements[i].y);}finally{b.close();}send(id,'progress',{stage:'join',done:i+1,total:files.length});}
 const blob=await encodeTile(c,'png',0);await verify(blob,layout.width,layout.height,'png');
 send(id,'done',{parts:[{blob,width:layout.width,height:layout.height,bytes:blob.size,format:'png',source:'joined'}],report:{ok:true,total:blob.size,scope:'Custom joined PNG; input order preserved',source:'',checked:'2026-09-29'}});
}
async function runInspect(id,files){
 const sizes=[];for(const f of files){if(f.size>MAX_INPUT_BYTES)throw new Error(`${f.name}: input exceeds 80 MB safe budget`);const d=await dimensions(f);memoryGate(d);sizes.push({...d,name:f.name,bytes:f.size});}
 const first=await createImageBitmap(files[0]);let preview,rowInk;try{rowInk=inkRows(first);const width=Math.min(360,first.width),height=Math.max(1,Math.round(first.height*width/first.width));const c=canvas(width,Math.min(600,height)),g=ctx(c);g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(first,0,0,c.width,c.height);preview=await c.convertToBlob({type:'image/png'});}finally{first.close();}
 send(id,'inspect',{sizes,preview,rowInk});
}
async function runEffect(id,options){
 const kind=options.kind,make=EFFECTS[kind];if(!make)throw new Error('Unknown effect');
 const svg=make(options),vector=new Blob([svg],{type:'image/svg+xml'}),bitmap=await createImageBitmap(vector);try{
  pending(id);const c=canvas(bitmap.width,bitmap.height),g=ctx(c);g.drawImage(bitmap,0,0);
  const png=await c.convertToBlob({type:'image/png'});await verify(png,bitmap.width,bitmap.height,'png');
  send(id,'done',{parts:[{blob:png,width:bitmap.width,height:bitmap.height,bytes:png.size,format:'png',source:kind},{blob:vector,width:bitmap.width,height:bitmap.height,bytes:vector.size,format:'svg',source:kind}],report:{ok:true,total:png.size+vector.size,scope:'Original deterministic effect; PNG re-decoded locally; SVG sanitised by construction.',source:'',checked:'2026-09-29'}});
 }finally{bitmap.close();}
}
self.onmessage=async e=>{const {id,action,files=[],options={}}=e.data||{};if(action==='cancel'){cancelled.add(id);return;}try{if(action==='inspect')await runInspect(id,files);else if(action==='split')await runSplit(id,files,options);else if(action==='join')await runJoin(id,files,options);else if(action==='effect')await runEffect(id,options);else throw new Error('Unknown action');}catch(error){fail(id,error);}finally{cancelled.delete(id);}};
