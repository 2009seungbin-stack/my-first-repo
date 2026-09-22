/** Aseprite `.ase`/`.aseprite` reader, compositor and writer. Pure: no DOM, no Node APIs, works
 * in the page, in workers and in Node. Format: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
 * Where the spec is silent, behaviour follows Aseprite's own MIT-licensed decoder/encoder
 * (src/dio/aseprite_decoder.cpp, aseprite_encoder.cpp) and renderer (src/render/render.cpp),
 * so that composited frames match Aseprite's exported PNGs pixel for pixel.
 *
 * API (see docs/ASEPRITE-IO.md):
 *   readAseprite(bytes,{limits,strict})           → AseDocument (throws AsepriteError)
 *   renderFrame(doc,frame,{layers,...})           → {width,height,rgba,indices?}
 *   renderLayer(doc,layer,frame)                  → one layer (or group) on a clear canvas
 *   celImage(doc,cel)                             → a cel's own pixels as RGBA
 *   toSpriteProject(doc,{name})                   → Nerulio model frames/animations + metadata
 *   documentFromImages({...})                     → AseDocument from full-canvas RGBA layers
 *   writeAseprite(doc,{linkDuplicates,level})     → Uint8Array (.aseprite bytes)
 *   plainProperties(userData)                     → user-data properties as plain JS values */
import {inflateZlib,deflateZlib,ZlibError} from './zlib.js';
import {blendRGBA,blendGray,mul8,BLEND_MODES} from './aseprite-blend.js';
import {frame as makeFrame,animation as makeAnimation} from './model.js';
export {BLEND_MODES};

export class AsepriteError extends Error{
 constructor(code,message){super(message);this.name='AsepriteError';this.code=code;}
}
/** Hard limits. Everything that allocates is checked against these before allocating, and the
 * byte budget covers every decoded cel and tileset, so a small hostile file cannot make the
 * reader allocate or inflate more than `maxDecodedBytes` in total. */
export const DEFAULT_LIMITS=Object.freeze({
 maxFileBytes:256*1024*1024,
 maxCanvasPixels:8192*8192,
 maxCelPixels:8192*8192,
 maxDecodedBytes:1024*1024*1024,
 maxTiles:1<<20,
 maxPaletteSize:1<<16,
 maxLayers:1<<14,
});
const CHUNK={OLD_PALETTE_8:0x0004,OLD_PALETTE_6:0x000B,LAYER:0x2004,CEL:0x2005,CEL_EXTRA:0x2006,COLOR_PROFILE:0x2007,EXTERNAL_FILES:0x2008,MASK:0x2016,PATH:0x2017,TAGS:0x2018,PALETTE:0x2019,USER_DATA:0x2020,SLICES_OLD:0x2021,SLICE:0x2022,TILESET:0x2023};
export const CHUNK_TYPES=Object.freeze({...CHUNK});
const LAYER_TYPES=['image','group','tilemap'];
const DIRECTIONS=['forward','reverse','pingpong','pingpong_reverse'];
const EXTERNAL_TYPES=['palette','tileset','extension','tile-management'];
const COLOR_MODES={32:'rgba',16:'grayscale',8:'indexed'};
const BPP={rgba:4,grayscale:2,indexed:1};
/** In-memory tile layout (Aseprite's doc::tile_t): index in the low 29 bits, then D/Y/X flips. */
export const TILE={INDEX_MASK:0x1fffffff,DFLIP:0x20000000,YFLIP:0x40000000,XFLIP:0x80000000};
const PROPERTY_TYPES=[null,'bool','int8','uint8','int16','uint16','int32','uint32','int64','uint64','fixed','float','double','string','point','size','rect','vector','map','uuid'];

const utf8=new TextDecoder('utf-8');
const utf8e=new TextEncoder();
const defineKey=(o,k,v)=>Object.defineProperty(o,k,{value:v,enumerable:true,writable:true,configurable:true});

class Reader{
 constructor(u8,start,end,what){this.u=u8;this.dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);this.p=start;this.end=end;this.what=what;}
 need(n){if(n<0||this.p+n>this.end)throw new AsepriteError('truncated',`${this.what} ends early (needs ${n} more bytes at offset ${this.p}, ${Math.max(0,this.end-this.p)} left)`);}
 left(){return this.end-this.p;}
 u8(){this.need(1);return this.u[this.p++];}
 u16(){this.need(2);const v=this.dv.getUint16(this.p,true);this.p+=2;return v;}
 i16(){this.need(2);const v=this.dv.getInt16(this.p,true);this.p+=2;return v;}
 u32(){this.need(4);const v=this.dv.getUint32(this.p,true);this.p+=4;return v;}
 i32(){this.need(4);const v=this.dv.getInt32(this.p,true);this.p+=4;return v;}
 u64(){this.need(8);const v=this.dv.getBigUint64(this.p,true);this.p+=8;return v;}
 i64(){this.need(8);const v=this.dv.getBigInt64(this.p,true);this.p+=8;return v;}
 f32(){this.need(4);const v=this.dv.getFloat32(this.p,true);this.p+=4;return v;}
 f64(){this.need(8);const v=this.dv.getFloat64(this.p,true);this.p+=8;return v;}
 fixed(){return this.i32()/65536;}
 skip(n){this.need(n);this.p+=n;}
 bytes(n){this.need(n);const b=this.u.subarray(this.p,this.p+n);this.p+=n;return b;}
 str(){const n=this.u16();return utf8.decode(this.bytes(n));}
 uuid(){return [...this.bytes(16)].map(b=>b.toString(16).padStart(2,'0')).join('');}
}
function toBytes(input){
 if(input instanceof Uint8Array)return input;
 if(input instanceof ArrayBuffer)return new Uint8Array(input);
 if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
 throw new AsepriteError('input','Expected an ArrayBuffer or Uint8Array');
}
const hex=(r,g,b,a)=>'#'+[r,g,b,a].map(v=>v.toString(16).padStart(2,'0')).join('');

// ---------------------------------------------------------------------------------------------
// Reader

/** Parses an Aseprite file. Structural damage (bad magic, truncated header/frames, chunks that
 * overrun their frame, limit violations) throws AsepriteError. Damage confined to one chunk
 * (a corrupt cel stream, an unreadable user-data block) is reported in `doc.warnings` and the
 * rest of the file still loads, as Aseprite does; pass `strict:true` to throw instead. */
export function readAseprite(input,{limits={},strict=false}={}){
 const L={...DEFAULT_LIMITS,...limits},u=toBytes(input);
 if(u.length>L.maxFileBytes)throw new AsepriteError('limit',`File is ${u.length} bytes; the limit is ${L.maxFileBytes}`);
 if(u.length<128)throw new AsepriteError('truncated','File is shorter than the 128-byte Aseprite header');
 const h=new Reader(u,0,128,'Header');
 const fileSize=h.u32(),magic=h.u16();
 if(magic!==0xA5E0)throw new AsepriteError('not-aseprite','Not an Aseprite file (bad magic number)');
 const nframes=h.u16(),width=h.u16(),height=h.u16(),depth=h.u16(),flags=h.u32(),speed=h.u16();
 h.skip(8);let transparentIndex=h.u8();h.skip(3);let ncolors=h.u16();
 let pw=h.u8(),ph=h.u8();const gridX=h.i16(),gridY=h.i16(),gridW=h.u16(),gridH=h.u16();
 const colorMode=COLOR_MODES[depth];
 if(!colorMode)throw new AsepriteError('unsupported',`Invalid colour depth ${depth}`);
 if(width<1||height<1)throw new AsepriteError('corrupt',`Invalid sprite size ${width}x${height}`);
 if(width*height>L.maxCanvasPixels)throw new AsepriteError('limit',`Sprite is ${width}x${height}; the limit is ${L.maxCanvasPixels} pixels`);
 if(depth!==8)transparentIndex=0;
 if(ncolors===0)ncolors=256;
 if(!pw||!ph)pw=ph=1;
 const warnings=[],warn=(msg,err)=>{if(strict&&err)throw err;if(strict)throw new AsepriteError('corrupt',msg);if(warnings.length<200)warnings.push(msg);};
 const bpp=BPP[colorMode];
 let budget=L.maxDecodedBytes;
 const spend=(n,what)=>{if(n>budget)throw new AsepriteError('limit',`${what} would exceed the ${L.maxDecodedBytes}-byte decode budget`);budget-=n;};
 const doc={
  format:'aseprite',width,height,colorMode,depth,flags,fileSize,
  layerOpacityValid:!!(flags&1),composeGroups:!!(flags&2),layerUuids:!!(flags&4),
  speed,transparentIndex,numColors:ncolors,pixelRatio:{w:pw,h:ph},grid:{x:gridX,y:gridY,w:gridW,h:gridH},
  frames:[],layers:[],tags:[],slices:[],tilesets:[],palettes:[],externalFiles:[],masks:[],
  colorProfile:null,userData:null,unknownChunks:[],warnings,
 };
 // Palette state (Aseprite: a sprite palette starts as `ncolors` opaque black entries).
 let pal=new Uint8Array(Math.min(ncolors,L.maxPaletteSize)*4);for(let i=3;i<pal.length;i+=4)pal[i]=255;
 let palNames=null,palChanged=true,ignoreOld=false;
 const pushPalette=f=>{if(!palChanged)return;const last=doc.palettes[doc.palettes.length-1];if(last&&last.frame===f)doc.palettes.pop();doc.palettes.push({frame:f,colors:pal.slice(),names:palNames?[...palNames]:null});palChanged=false;};
 const resizePal=n=>{if(n>L.maxPaletteSize)throw new AsepriteError('limit',`Palette of ${n} colours exceeds the limit`);if(n*4===pal.length)return;const p=new Uint8Array(n*4);p.set(pal.subarray(0,Math.min(pal.length,n*4)));for(let i=pal.length+3;i<p.length;i+=4)p[i]=255;pal=p;if(palNames)palNames.length=n;};
 const setEntry=(i,r,g,b,a)=>{if(i*4>=pal.length)resizePal(i+1);const o=i*4;if(pal[o]!==r||pal[o+1]!==g||pal[o+2]!==b||pal[o+3]!==a){pal[o]=r;pal[o+1]=g;pal[o+2]=b;pal[o+3]=a;palChanged=true;}};
 // Layer tree state (NOTE.1 of the spec, resolved the way Aseprite's decoder does).
 let prevLayer=-1,curLevel=-1;const parentOf=i=>i<0?-1:doc.layers[i].parent;
 const tsiMap=new Map();
 // "Last object" that the next User Data chunk belongs to.
 let target={kind:'sprite'},lastCel=null;
 const pending={tags:null,tagIndex:0,tileset:null,tileIndex:0};
 let off=128;
 for(let f=0;f<nframes;f++){
  if(off+16>u.length)throw new AsepriteError('truncated',`Frame ${f+1} of ${nframes} is missing (file ends at byte ${u.length})`);
  const fr=new Reader(u,off,off+16,`Frame ${f} header`);
  const size=fr.u32(),fmagic=fr.u16(),oldChunks=fr.u16(),dur=fr.u16();fr.skip(2);const newChunks=fr.u32();
  if(size<16)throw new AsepriteError('corrupt',`Frame ${f} declares ${size} bytes`);
  if(off+size>u.length)throw new AsepriteError('truncated',`Frame ${f} needs ${size} bytes but the file ends after ${u.length-off}`);
  const frameEnd=off+size,frame={index:f,duration:Math.min(65535,Math.max(1,dur>0?dur:speed)),cels:[]};
  doc.frames.push(frame);
  if(fmagic!==0xF1FA){warn(`Frame ${f} has a bad magic number; its chunks were skipped`);off=frameEnd;pushPalette(f);continue;}
  const nchunks=oldChunks===0xFFFF&&oldChunks<newChunks?newChunks:oldChunks;
  let p=off+16;
  for(let c=0;c<nchunks;c++){
   if(p>=frameEnd){if(p>frameEnd||c<nchunks)warn(`Frame ${f} declares ${nchunks} chunks but holds ${c}`);break;}
   if(p+6>frameEnd)throw new AsepriteError('corrupt',`Chunk header at byte ${p} overruns frame ${f}`);
   const cr=new Reader(u,p,frameEnd,'Chunk');const csize=cr.u32(),type=cr.u16();
   if(csize<6)throw new AsepriteError('corrupt',`Chunk at byte ${p} declares ${csize} bytes`);
   if(p+csize>frameEnd)throw new AsepriteError('corrupt',`Chunk 0x${type.toString(16)} at byte ${p} (${csize} bytes) overruns frame ${f}`);
   const r=new Reader(u,p+6,p+csize,`Chunk 0x${type.toString(16).padStart(4,'0')} in frame ${f}`),layersBefore=doc.layers.length;
   // Tile user data follows a tileset's own user data, one chunk per tile.
   if(pending.tileset&&type!==CHUNK.USER_DATA)pending.tileset=null;
   try{
    switch(type){
     case CHUNK.OLD_PALETTE_8:case CHUNK.OLD_PALETTE_6:{
      if(ignoreOld)break;
      const six=type===CHUNK.OLD_PALETTE_6,packets=r.u16();let skip=0;
      for(let k=0;k<packets;k++){
       skip+=r.u8();let n=r.u8();if(!n)n=256;
       for(let i=skip;i<skip+n;i++){let R=r.u8(),G=r.u8(),B=r.u8();if(six){R=(R<<2)|(R>>4);G=(G<<2)|(G>>4);B=(B<<2)|(B>>4);R&=255;G&=255;B&=255;}setEntry(i,R,G,B,255);}
      }
      break;
     }
     case CHUNK.PALETTE:{
      const newSize=r.u32(),from=r.u32(),to=r.u32();r.skip(8);
      if(newSize>0)resizePal(newSize),palChanged=true;
      if(to>=from){
       if(to>=L.maxPaletteSize)throw new AsepriteError('limit',`Palette index ${to} exceeds the limit`);
       for(let i=from;i<=to;i++){
        const fl=r.u16(),R=r.u8(),G=r.u8(),B=r.u8(),A=r.u8();setEntry(i,R,G,B,A);
        if(fl&1){const name=r.str();palNames??=new Array(pal.length/4).fill(null);if(i>=palNames.length)palNames.length=pal.length/4;palNames[i]=name;palChanged=true;}
       }
      }
      ignoreOld=true;break;
     }
     case CHUNK.LAYER:{
      const idx=doc.layers.length;
      if(idx>=L.maxLayers)throw new AsepriteError('limit',`More than ${L.maxLayers} layers`);
      const fl=r.u16(),lt=r.u16(),level=r.u16();r.skip(4);const blend=r.u16(),opacity=r.u8();r.skip(3);const name=r.str();
      const typeName=LAYER_TYPES[lt]||'unknown';
      const layer={index:idx,name,type:typeName,typeId:lt,flags:fl,childLevel:level,parent:-1,
       visible:!!(fl&1),editable:!!(fl&2),lockMovement:!!(fl&4),background:!!(fl&8),preferLinkedCels:!!(fl&16),collapsed:!!(fl&32),reference:!!(fl&64),
       rawBlendMode:blend,rawOpacity:opacity,blendMode:0,opacity:255,tilesetIndex:null,tilesetId:null,uuid:null,userData:null};
      if(lt===2){const id=r.u32();layer.tilesetId=id;layer.tilesetIndex=tsiMap.has(id)?tsiMap.get(id):(doc.tilesets[id]?id:null);if(layer.tilesetIndex==null)warn(`Tilemap layer "${name}" references missing tileset ${id}`);}
      if(flags&4)layer.uuid=r.uuid();
      const hasBlend=(lt===0||lt===2||(lt===1&&(flags&2)))&&!(fl&8);
      if(hasBlend){layer.blendMode=blend;if(flags&1)layer.opacity=opacity;}
      if(blend>18)warn(`Layer "${name}" uses unknown blend mode ${blend}; rendered as normal`);
      doc.layers.push(layer);
      if(typeName==='unknown'){warn(`Layer "${name}" has unknown type ${lt} and is ignored`);target=null;break;}
      // Parent per NOTE.1 (Aseprite's decoder logic, previous layer = last *known* layer).
      let parent;
      if(prevLayer<0)parent=-1;
      else if(level===curLevel)parent=parentOf(prevLayer);
      else if(level>curLevel)parent=doc.layers[prevLayer].type==='group'?prevLayer:parentOf(prevLayer);
      else{parent=parentOf(prevLayer);for(let k=curLevel-level;k>0&&parent>=0;k--)parent=parentOf(parent);}
      layer.parent=parent;prevLayer=idx;curLevel=level;target={kind:'layer',obj:layer};
      break;
     }
     case CHUNK.CEL:{
      target=null;lastCel=null;
      const li=r.u16(),x=r.i16(),y=r.i16(),opacity=r.u8(),ct=r.u16(),z=r.i16();r.skip(5);
      const layer=doc.layers[li];
      if(!layer||layer.type==='unknown'){warn(`Frame ${f}: cel for missing layer ${li} ignored`);break;}
      if(layer.type==='group'){warn(`Frame ${f}: cel on group layer "${layer.name}" ignored`);break;}
      let cel=null;
      if(ct===1){
       const lf=r.u16(),src=doc.frames[lf]?.cels[li];
       if(!src){warn(`Frame ${f}: linked cel points to frame ${lf}, which has no cel on layer "${layer.name}"`);break;}
       const data=src.data;
       // Aseprite: identical position/opacity → true link (shared data); otherwise a copy.
       if(src.x===x&&src.y===y&&src.opacity===opacity)cel={...src,frame:f,zIndex:z,linkedFrame:src.linkedFrame??src.frame,extra:null};
       else cel={...src,frame:f,x,y,opacity,zIndex:z,linkedFrame:null,copiedFrom:src.frame,data:{userData:data.userData?structuredClone(data.userData):null},extra:null};
      }else if(ct===0||ct===2){
       const w=r.u16(),hh=r.u16();
       if(w>0&&hh>0){
        if(w*hh>L.maxCelPixels)throw new AsepriteError('limit',`Cel ${w}x${hh} exceeds the limit`);
        const n=w*hh*bpp;spend(n,`Cel ${w}x${hh} in frame ${f}`);
        let pixels;
        if(ct===0)pixels=r.bytes(n).slice();
        else pixels=inflateInto(u,r.p,r.end,n,`Frame ${f} layer "${layer.name}" cel`,warn);
        cel={type:'image',layer:li,frame:f,x,y,opacity,zIndex:z,width:w,height:hh,pixels,compressed:ct===2,linkedFrame:null,data:{userData:null},extra:null};
       }
      }else if(ct===3){
       const w=r.u16(),hh=r.u16(),bits=r.u16(),idMask=r.u32(),xm=r.u32(),ym=r.u32(),dm=r.u32();r.skip(10);
       if(bits!==8&&bits!==16&&bits!==32){warn(`Frame ${f}: tilemap cel with ${bits} bits per tile is not supported`);break;}
       if(w>0&&hh>0){
        if(w*hh>L.maxCelPixels)throw new AsepriteError('limit',`Tilemap ${w}x${hh} exceeds the limit`);
        const bytesPer=bits>>3,n=w*hh*bytesPer;spend(n+w*hh*4,`Tilemap ${w}x${hh} in frame ${f}`);
        const raw=inflateInto(u,r.p,r.end,n,`Frame ${f} tilemap cel`,warn),tiles=new Uint32Array(w*hh);
        const dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
        const shift=idMask?31-Math.clz32(idMask&-idMask):0;
        const ts=layer.tilesetIndex!=null?doc.tilesets[layer.tilesetIndex]:null,old=ts&&!(ts.flags&4),delta=old&&ts.baseIndex===0?1:0;
        const fmask=(xm|ym|dm)>>>0;
        for(let i=0;i<w*hh;i++){
         let t=bits===32?dv.getUint32(i*4,true):bits===16?dv.getUint16(i*2,true):raw[i];
         if(old){t=t===0xffffffff?0:(((t&fmask)>>>0)|(((t&idMask)>>>0)+delta))>>>0;}
         const ti=((t&idMask)>>>0)>>>shift;
         if(ts&&ti>ts.numTiles&&ti>0xffffff){tiles[i]=0;continue;}
         const m=(mask,bit)=>mask&&((t&mask)>>>0)===(mask>>>0)?bit:0;
         tiles[i]=((ti&TILE.INDEX_MASK)|m(xm,TILE.XFLIP)|m(ym,TILE.YFLIP)|m(dm,TILE.DFLIP))>>>0;
        }
        cel={type:'tilemap',layer:li,frame:f,x,y,opacity,zIndex:z,width:w,height:hh,tiles,bitsPerTile:bits,masks:{index:idMask,xflip:xm,yflip:ym,dflip:dm},linkedFrame:null,data:{userData:null},extra:null};
       }
      }else{warn(`Frame ${f}: unknown cel type ${ct} ignored`);break;}
      if(!cel)break;
      if(cel.type==='tilemap'&&layer.type!=='tilemap')warn(`Frame ${f}: tilemap cel on non-tilemap layer "${layer.name}"`);
      frame.cels[li]=cel;lastCel=cel;target={kind:'cel',obj:cel.data};
      break;
     }
     case CHUNK.CEL_EXTRA:{
      if(!lastCel)break;
      const fl=r.u32();
      if(fl&1){const x=r.fixed(),y=r.fixed(),w=r.fixed(),hh=r.fixed();if(w&&hh)lastCel.extra={preciseBounds:{x,y,w,h:hh}};}
      break;
     }
     case CHUNK.COLOR_PROFILE:{
      const t=r.u16(),fl=r.u16(),gamma=r.fixed();r.skip(8);
      const cp={type:t,typeName:['none','srgb','icc'][t]||'unknown',gamma:fl&1?gamma:null,iccLength:0};
      if(t===2){cp.iccLength=r.u32();r.skip(cp.iccLength);}
      if(t>2)warn(`Unknown colour profile type ${t}`);
      doc.colorProfile=cp;break;
     }
     case CHUNK.EXTERNAL_FILES:{
      const n=r.u32();r.skip(8);
      for(let i=0;i<n;i++){const id=r.u32(),t=r.u8();r.skip(7);const name=r.str();doc.externalFiles.push({id,type:t,typeName:EXTERNAL_TYPES[t]||'unknown',name});if(t>3)warn(`Unknown external file type ${t}`);}
      break;
     }
     case CHUNK.MASK:{
      const x=r.i16(),y=r.i16(),w=r.u16(),hh=r.u16();r.skip(8);const name=r.str();
      doc.masks.push({name,x,y,w,h:hh});break; // deprecated; bitmap not kept
     }
     case CHUNK.PATH:break;
     case CHUNK.TAGS:{
      const n=r.u16();r.skip(8);const tags=[];
      for(let i=0;i<n&&r.left()>0;i++){
       const from=r.u16(),to=r.u16();let dir=r.u8();if(dir>3)dir=0;
       const repeat=r.u16();r.skip(6);const R=r.u8(),G=r.u8(),B=r.u8();r.skip(1);const name=r.str();
       tags.push({name,from,to,direction:DIRECTIONS[dir],directionId:dir,repeat,color:hex(R,G,B,255),userData:null});
      }
      doc.tags.push(...tags);
      if(tags.length){target={kind:'tag',obj:tags[0]};pending.tags=tags;pending.tagIndex=0;}else target=null;
      break;
     }
     case CHUNK.USER_DATA:{
      const ud=readUserData(r,doc.externalFiles,warn);
      if(pending.tileset){
       const ts=pending.tileset;ts.tileUserData[pending.tileIndex++]=ud;
       if(pending.tileIndex>=ts.numTiles)pending.tileset=null;
       break;
      }
      if(!target)break;
      if(target.kind==='sprite')doc.userData=ud;
      else target.obj.userData=ud;
      if(target.kind==='tag'){
       pending.tagIndex++;target=pending.tagIndex<pending.tags.length?{kind:'tag',obj:pending.tags[pending.tagIndex]}:null;
      }else if(target.kind==='tileset'){
       const ts=target.obj;ts.tileUserData=new Array(ts.numTiles).fill(null);pending.tileset=ts.numTiles?ts:null;pending.tileIndex=0;target=null;
      }
      break;
     }
     case CHUNK.SLICES_OLD:{
      const n=r.u32();r.skip(8);
      for(let i=0;i<n&&r.left()>0;i++)doc.slices.push(readSlice(r));
      break;
     }
     case CHUNK.SLICE:{
      const s=readSlice(r);doc.slices.push(s);target={kind:'slice',obj:s};break;
     }
     case CHUNK.TILESET:{
      const id=r.u32(),fl=r.u32(),ntiles=r.u32(),tw=r.u16(),th=r.u16(),base=r.i16();r.skip(14);const name=r.str();
      if(tw<1||th<1){warn(`Tileset "${name}" has invalid tile size ${tw}x${th}`);target=null;break;}
      if(ntiles>L.maxTiles)throw new AsepriteError('limit',`Tileset "${name}" has ${ntiles} tiles; the limit is ${L.maxTiles}`);
      const ts={index:doc.tilesets.length,id,flags:fl,name,numTiles:ntiles,tileWidth:tw,tileHeight:th,baseIndex:base,external:null,pixels:null,
       matchFlips:{x:!!(fl&8),y:!!(fl&16),d:!!(fl&32)},zeroIsEmpty:!!(fl&4),userData:null,tileUserData:[]};
      if(fl&1){const fid=r.u32(),tid=r.u32();ts.external={fileId:fid,tilesetId:tid,fileName:doc.externalFiles.find(e=>e.id===fid)?.name??null};if(ts.external.fileName==null)warn(`Tileset "${name}" references missing external file ${fid}`);}
      if(fl&2&&ntiles>0){
       const len=r.u32(),n=tw*th*ntiles*bpp;
       if(tw*th*ntiles>L.maxCelPixels)throw new AsepriteError('limit',`Tileset "${name}" image exceeds the limit`);
       spend(n,`Tileset "${name}"`);
       ts.pixels=inflateInto(u,r.p,Math.min(r.end,r.p+len),n,`Tileset "${name}"`,warn);
      }
      if(!(fl&4)&&ts.pixels){
       // Old files: empty tile was 0xffffffff. Aseprite inserts an empty tile 0 unless tile 0 is already empty.
       const tb=tw*th*bpp,empty=isEmptyPixels(ts.pixels.subarray(0,tb),colorMode,transparentIndex);
       if(empty)ts.baseIndex=1;else{const p=new Uint8Array(ts.pixels.length+tb);if(colorMode==='indexed')p.fill(transparentIndex,0,tb);p.set(ts.pixels,tb);ts.pixels=p;ts.numTiles++;ts.baseIndex=0;}
      }
      tsiMap.set(id,ts.index);doc.tilesets.push(ts);target={kind:'tileset',obj:ts};
      break;
     }
     default:
      doc.unknownChunks.push({frame:f,type,size:csize,offset:p});
      warn(`Unsupported chunk type 0x${type.toString(16).padStart(4,'0')} in frame ${f} skipped`);
    }
   }catch(e){
    if(!(e instanceof AsepriteError||e instanceof ZlibError)||e.code==='limit')throw e;
    if(strict)throw e instanceof AsepriteError?e:new AsepriteError('corrupt',e.message);
    warn(`${e.message} (chunk skipped)`);
    // Keep layer numbering intact: cels address layers by their chunk order.
    if(type===CHUNK.LAYER&&doc.layers.length===layersBefore){doc.layers.push({index:layersBefore,name:'',type:'unknown',typeId:-1,flags:0,childLevel:0,parent:-1,visible:false,editable:false,lockMovement:false,background:false,preferLinkedCels:false,collapsed:false,reference:false,rawBlendMode:0,rawOpacity:0,blendMode:0,opacity:255,tilesetIndex:null,tilesetId:null,uuid:null,userData:null});target=null;}
   }
   p+=csize;
  }
  pushPalette(f);off=frameEnd;
 }
 if(fileSize!==u.length)warnings.push(`Header says ${fileSize} bytes; file has ${u.length}`);
 if(!doc.palettes.length)doc.palettes.push({frame:0,colors:pal.slice(),names:null});
 doc.palette=doc.palettes[0];
 // children lists for convenience
 for(const l of doc.layers)l.children=[];
 for(const l of doc.layers)if(l.parent>=0&&l.type!=='unknown')doc.layers[l.parent].children.push(l.index);
 return doc;
}

function inflateInto(u,start,end,size,what,warn){
 let res;
 try{res=inflateZlib(u,{start,end,size});}
 catch(e){if(e instanceof ZlibError){warn(`${what}: ${e.message}; pixels left empty`,new AsepriteError('corrupt',`${what}: ${e.message}`));return new Uint8Array(size);}throw e;}
 if(res.truncated)warn(`${what}: compressed data is cut off (${res.length} of ${size} bytes decoded)`);
 else if(!res.complete)warn(`${what}: compressed data ends early (${res.length} of ${size} bytes)`);
 else if(res.excess)warn(`${what}: extra compressed data ignored`);
 else if(res.adlerOk===false)warn(`${what}: zlib checksum mismatch`);
 return res.data;
}
function isEmptyPixels(px,mode,ti){
 if(mode==='indexed'){for(const v of px)if(v!==ti)return false;return true;}
 const step=mode==='rgba'?4:2,ao=step-1;for(let i=ao;i<px.length;i+=step)if(px[i])return false;return true;
}
function readSlice(r){
 const nkeys=r.u32(),fl=r.u32();r.skip(4);const name=r.str(),keys=[];
 for(let j=0;j<nkeys&&r.left()>0;j++){
  const key={frame:r.u32(),x:r.i32(),y:r.i32(),w:r.u32(),h:r.u32(),center:null,pivot:null};
  if(fl&1)key.center={x:r.i32(),y:r.i32(),w:r.u32(),h:r.u32()};
  if(fl&2)key.pivot={x:r.i32(),y:r.i32()};
  keys.push(key);
 }
 return {name,flags:fl,nineSlice:!!(fl&1),hasPivot:!!(fl&2),keys,userData:null};
}
function readUserData(r,ext,warn){
 const fl=r.u32(),ud={text:null,color:null,properties:null};
 if(fl&1)ud.text=r.str();
 if(fl&2){const R=r.u8(),G=r.u8(),B=r.u8(),A=r.u8();ud.color=hex(R,G,B,A);}
 if(fl&4){
  const start=r.p,size=r.u32(),nmaps=r.u32(),end=Math.min(r.end,start+size),maps={};
  const sub=new Reader(r.u,r.p,end,'User data properties');
  try{
   for(let i=0;i<nmaps&&sub.left()>0;i++){
    const id=sub.u32(),key=id===0?'':(ext.find(e=>e.id===id)?.name??`__missed__${id}`);
    defineKey(maps,key,readProp(sub,18,0));
   }
  }catch(e){if(!(e instanceof AsepriteError))throw e;warn(`User data properties: ${e.message}`);}
  ud.properties=maps;r.p=Math.max(r.p,end);
 }
 return ud;
}
/** A property as {type, value}: maps are objects of such pairs, vectors arrays of them. */
function readProp(r,type,depth){
 if(depth>128)throw new AsepriteError('corrupt','More than 128 nested property levels');
 const name=PROPERTY_TYPES[type];
 switch(type){
  case 1:return {type:name,value:r.u8()!==0};
  case 2:return {type:name,value:(r.u8()<<24)>>24};
  case 3:return {type:name,value:r.u8()};
  case 4:return {type:name,value:r.i16()};
  case 5:return {type:name,value:r.u16()};
  case 6:return {type:name,value:r.i32()};
  case 7:return {type:name,value:r.u32()};
  case 8:return {type:name,value:r.i64()};
  case 9:return {type:name,value:r.u64()};
  case 10:return {type:name,value:r.fixed()};
  case 11:return {type:name,value:r.f32()};
  case 12:return {type:name,value:r.f64()};
  case 13:return {type:name,value:r.str()};
  case 14:return {type:name,value:{x:r.i32(),y:r.i32()}};
  case 15:return {type:name,value:{w:r.i32(),h:r.i32()}};
  case 16:return {type:name,value:{x:r.i32(),y:r.i32(),w:r.i32(),h:r.i32()}};
  case 17:{
   const n=r.u32(),et=r.u16(),out=[];
   for(let k=0;k<n;k++){const t=et===0?r.u16():et;out.push(readProp(r,t,depth+1));}
   return {type:name,value:out};
  }
  case 18:{
   const n=r.u32(),out={};
   for(let k=0;k<n;k++){const key=r.str(),t=r.u16();defineKey(out,key,readProp(r,t,depth+1));}
   return {type:name,value:out};
  }
  case 19:return {type:name,value:r.uuid()};
  default:throw new AsepriteError('corrupt',`Unknown property type ${type}`);
 }
}
/** Typed user-data properties → plain JS values (64-bit ints stay BigInt only when unsafe). */
export function plainProperties(ud){
 const conv=p=>{
  if(!p||typeof p!=='object'||!('type' in p))return p;
  if(p.type==='map'){const o={};for(const [k,v] of Object.entries(p.value))defineKey(o,k,conv(v));return o;}
  if(p.type==='vector')return p.value.map(conv);
  if(typeof p.value==='bigint')return p.value>=BigInt(Number.MIN_SAFE_INTEGER)&&p.value<=BigInt(Number.MAX_SAFE_INTEGER)?Number(p.value):p.value;
  return p.value;
 };
 const props=ud?.properties;if(!props)return {};
 const out={};for(const [k,v] of Object.entries(props))defineKey(out,k,conv(v));return out;
}

// ---------------------------------------------------------------------------------------------
// Compositor

/** Palette in effect at `frame` (palette chunks apply from their frame onwards). */
export function paletteAt(doc,frame){const list=doc.palettes?.length?doc.palettes:[{frame:0,colors:doc.palette?.colors??new Uint8Array([0,0,0,255])}];let p=list[0];for(const q of list)if(q.frame<=frame)p=q;return p.colors;}
const visibleHierarchy=(doc,i)=>{for(let l=doc.layers[i];l;l=l.parent>=0?doc.layers[l.parent]:null)if(!l.visible)return false;return true;};

/** Child layer indices of `i` from the `parent` fields (documents built by hand need no `children`). */
const buildKids=doc=>{const m=new Map();for(const l of doc.layers){if(l.type==="unknown")continue;const p=l.parent??-1;if(!m.has(p))m.set(p,[]);m.get(p).push(l.index);}return m;};
const kidsOf=(doc,i,kids=buildKids(doc))=>kids.get(i)||[];
/** Items of one render plan (Aseprite's doc::RenderPlan): children of `parent` in back-to-front
 * order (flattened through groups unless composing groups), reordered by cel z-index, hidden
 * layers dropped. */
function plan(doc,parentList,frame,compose,filter,kids){
 const items=[];let order=0;
 const add=i=>{
  const l=doc.layers[i];order++;
  if(l.type==='group'&&!compose){for(const c of kidsOf(doc,i,kids))add(c);return;}
  items.push({order,layer:i,cel:doc.frames[frame]?.cels[i]??null});
 };
 for(const i of parentList)add(i);
 if(items.some(it=>it.cel&&it.cel.zIndex)){
  for(const it of items)it.z=it.cel?.zIndex||0,it.order+=it.z;
  items.sort((a,b)=>a.order-b.order||a.z-b.z);
 }
 return items.filter(it=>doc.layers[it.layer].type!=='unknown'&&(filter?filter(doc.layers[it.layer]):visibleHierarchy(doc,it.layer)));
}
function newCanvas(doc,fillIndex){
 const n=doc.width*doc.height;
 if(doc.colorMode==='indexed'){const a=new Uint8Array(n);if(fillIndex)a.fill(fillIndex);return a;}
 return new Uint8Array(n*BPP[doc.colorMode]);
}
/** Draws one image (cel or tile) of the sprite's colour mode onto `dst` at (dx,dy). */
function drawImage(doc,dst,src,sw,sh,dx,dy,opacity,mode,palSize,tileFlags=0){
 const W=doc.width,H=doc.height,cm=doc.colorMode,ti=doc.transparentIndex;
 const x0=Math.max(0,dx),y0=Math.max(0,dy),x1=Math.min(W,dx+sw),y1=Math.min(H,dy+sh);
 if(x0>=x1||y0>=y1)return;
 const xf=tileFlags&TILE.XFLIP,yf=tileFlags&TILE.YFLIP,df=tileFlags&TILE.DFLIP,minSide=Math.min(sw,sh);
 for(let y=y0;y<y1;y++){
  for(let x=x0;x<x1;x++){
   let sx=x-dx,sy=y-dy;
   if(tileFlags){
    if(xf)sx=sw-1-sx;if(yf)sy=sh-1-sy;
    if(df){const t=sx;sx=sy;sy=t;if(sx>=minSide||sy>=minSide){zeroPixel(dst,cm,y*W+x);continue;}}
   }
   const si=sy*sw+sx,di=y*W+x;
   if(cm==='rgba'){
    const s=si*4,r=src[s],g=src[s+1],b=src[s+2],a=src[s+3];
    if(!(r|g|b|a))continue;
    const d=di*4;
    if(mode===0&&opacity===255&&(a===255||dst[d+3]===0)){dst[d]=r;dst[d+1]=g;dst[d+2]=b;dst[d+3]=a;continue;}
    blendRGBA(dst,d,r,g,b,a,opacity,mode);
   }else if(cm==='grayscale'){
    const s=si*2,v=src[s],a=src[s+1];
    if(!(v|a))continue;
    blendGray(dst,di*2,v,a,opacity,mode);
   }else{
    const v=src[si];
    if(v!==ti&&v<palSize)dst[di]=v;
   }
  }
 }
}
function zeroPixel(dst,cm,di){if(cm==='rgba')dst[di*4]=dst[di*4+1]=dst[di*4+2]=dst[di*4+3]=0;else if(cm==='grayscale')dst[di*2]=dst[di*2+1]=0;else dst[di]=0;}
function drawCel(doc,dst,cel,opacity,mode,palSize){
 if(cel.type==='image'){drawImage(doc,dst,cel.pixels,cel.width,cel.height,cel.x,cel.y,opacity,mode,palSize);return;}
 const layer=doc.layers[cel.layer],ts=layer.tilesetIndex!=null?doc.tilesets[layer.tilesetIndex]:null;
 if(!ts||!ts.pixels)return;
 const tw=ts.tileWidth,th=ts.tileHeight,tb=tw*th*BPP[doc.colorMode];
 for(let v=0;v<cel.height;v++)for(let u=0;u<cel.width;u++){
  const t=cel.tiles[v*cel.width+u];if(!t)continue;
  const i=t&TILE.INDEX_MASK;if(i>=ts.numTiles)continue;
  drawImage(doc,dst,ts.pixels.subarray(i*tb,(i+1)*tb),tw,th,cel.x+u*tw,cel.y+v*th,opacity,mode,palSize,t&~TILE.INDEX_MASK);
 }
}
/** Groups (when composing groups) render into their own cleared buffer, which is then composited
 * with the group's opacity and blend mode. The buffer's mask colour is 0, as in Aseprite's
 * export path, which for indexed sprites means index 0 inside a group is treated as empty. */
function renderPlan(doc,items,dst,frame,passBg,passTr,opt,palSize){
 for(const it of items){
  const l=doc.layers[it.layer];
  if(l.type==='group'){
   const buf=newCanvas(doc,0);
   renderPlan(doc,plan(doc,kidsOf(doc,it.layer,opt.kids),frame,true,opt.filter,opt.kids),buf,frame,passBg,passTr,opt,palSize);
   if(doc.colorMode==='indexed'){for(let i=0;i<buf.length;i++){const v=buf[i];if(v&&v<palSize)dst[i]=v;}}
   else drawImage(doc,dst,buf,doc.width,doc.height,0,0,l.opacity,l.blendMode,palSize);
   continue;
  }
  if((!passBg&&l.background)||(!passTr&&!l.background))continue;
  if(l.reference&&!opt.includeReference)continue;
  const cel=it.cel;if(!cel)continue;
  if(cel.type==='tilemap'&&l.type!=='tilemap')continue;
  drawCel(doc,dst,cel,mul8(cel.opacity,l.opacity),l.blendMode,palSize);
 }
}
function toRGBA(doc,buf,frame,bgVisible){
 const n=doc.width*doc.height,out=new Uint8Array(n*4);
 if(doc.colorMode==='rgba')return buf;
 if(doc.colorMode==='grayscale'){for(let i=0;i<n;i++){const v=buf[i*2];out[i*4]=out[i*4+1]=out[i*4+2]=v;out[i*4+3]=buf[i*2+1];}return out;}
 const pal=paletteAt(doc,frame),ti=doc.transparentIndex,psize=pal.length>>2;
 for(let i=0;i<n;i++){
  const v=buf[i];if(v===ti&&!bgVisible)continue;if(v>=psize)continue;
  out[i*4]=pal[v*4];out[i*4+1]=pal[v*4+1];out[i*4+2]=pal[v*4+2];out[i*4+3]=pal[v*4+3];
 }
 return out;
}
const bgLayerVisible=doc=>{const first=doc.layers.find(l=>l.parent===-1&&l.type!=='unknown');return !!(first&&first.background&&first.type!=='group'&&first.visible);};

/** Renders a frame the way Aseprite exports it (new blend method, no checkerboard, reference
 * layers hidden). Options: `layers` — array/Set of layer indices or a predicate; when given,
 * exactly those layers are drawn (group visibility ignored). `composeGroups` defaults to the
 * file's header flag. Returns RGBA, plus `indices` for indexed sprites. */
export function renderFrame(doc,frame,{layers=null,composeGroups=doc.composeGroups,includeReference=false}={}){
 if(!(frame>=0&&frame<doc.frames.length))throw new AsepriteError('input',`Frame ${frame} does not exist`);
 const filter=layers==null?null:typeof layers==='function'?layers:(set=>l=>set.has(l.index))(new Set(layers));
 const opt={filter,includeReference,kids:buildKids(doc)},palSize=paletteAt(doc,frame).length>>2;
 const bgVisible=bgLayerVisible(doc)&&(!filter||filter(doc.layers.find(l=>l.parent===-1&&l.type!=='unknown')));
 const dst=newCanvas(doc,doc.colorMode==='indexed'?doc.transparentIndex:0);
 const roots=doc.layers.filter(l=>l.parent===-1&&l.type!=='unknown').map(l=>l.index);
 let items;
 if(composeGroups){
  // Aseprite adds the root group itself to the plan and composites it like any group, once per pass.
  const sub=plan(doc,roots,frame,true,filter,opt.kids);
  const buf=newCanvas(doc,0);
  renderPlan(doc,sub,buf,frame,true,false,opt,palSize);
  mergeRoot(doc,dst,buf,palSize);
  const buf2=newCanvas(doc,0);
  renderPlan(doc,sub,buf2,frame,false,true,opt,palSize);
  mergeRoot(doc,dst,buf2,palSize);
 }else{
  items=plan(doc,roots,frame,false,filter,opt.kids);
  renderPlan(doc,items,dst,frame,true,false,opt,palSize);
  renderPlan(doc,items,dst,frame,false,true,opt,palSize);
 }
 const rgba=toRGBA(doc,dst,frame,bgVisible);
 return doc.colorMode==='indexed'?{width:doc.width,height:doc.height,rgba,indices:dst}:{width:doc.width,height:doc.height,rgba};
}
function mergeRoot(doc,dst,buf,palSize){
 if(doc.colorMode==='indexed'){for(let i=0;i<buf.length;i++){const v=buf[i];if(v&&v<palSize)dst[i]=v;}}
 else drawImage(doc,dst,buf,doc.width,doc.height,0,0,255,0,palSize);
}
/** One layer (a group renders its visible children composed) on a transparent canvas, with the
 * layer's own opacity and blend mode applied against transparency. */
export function renderLayer(doc,layer,frame,{includeHidden=false,includeReference=true}={}){
 const l=doc.layers[layer];if(!l||l.type==='unknown')throw new AsepriteError('input',`Layer ${layer} does not exist`);
 // The layer itself is drawn even when hidden; its descendants follow their own visibility.
 const want=new Set(),kids=buildKids(doc);const walk=(i,top)=>{const x=doc.layers[i];if(!top&&!includeHidden&&!x.visible)return;want.add(i);for(const c of kidsOf(doc,i,kids))walk(c,false);};walk(layer,true);
 return renderFrame(doc,frame,{layers:want,composeGroups:doc.composeGroups,includeReference});
}
/** A cel's own pixels as RGBA (cel-sized; opacity not applied). Tilemap cels are expanded. */
export function celImage(doc,cel){
 if(cel.type==='image'){
  const n=cel.width*cel.height,out=new Uint8Array(n*4),px=cel.pixels;
  if(doc.colorMode==='rgba')return {width:cel.width,height:cel.height,rgba:px.slice()};
  if(doc.colorMode==='grayscale'){for(let i=0;i<n;i++){out[i*4]=out[i*4+1]=out[i*4+2]=px[i*2];out[i*4+3]=px[i*2+1];}}
  else{const pal=paletteAt(doc,cel.frame),ti=doc.transparentIndex;for(let i=0;i<n;i++){const v=px[i];if(v===ti||v*4>=pal.length)continue;out.set(pal.subarray(v*4,v*4+4),i*4);}}
  return {width:cel.width,height:cel.height,rgba:out};
 }
 const ts=doc.tilesets[doc.layers[cel.layer].tilesetIndex];
 const w=cel.width*(ts?.tileWidth||0),h=cel.height*(ts?.tileHeight||0);
 const tmp={...doc,width:w,height:h};
 const buf=newCanvas(tmp,doc.colorMode==='indexed'?doc.transparentIndex:0);
 drawCel(tmp,buf,{...cel,x:0,y:0},255,0,paletteAt(doc,cel.frame).length>>2);
 return {width:w,height:h,rgba:toRGBA(tmp,buf,cel.frame,false)};
}
/** Cel of `layer` at `frame`, or null. */
export const getCel=(doc,layer,frame)=>doc.frames[frame]?.cels[layer]??null;

// ---------------------------------------------------------------------------------------------
// Mapping to Nerulio's model (src/game/model.js)

const BOX_NAME=[[/hurt/i,'hurt'],[/hit|attack|damage/i,'hit'],[/interact|trigger|use/i,'interact']];
const sliceKeyAt=(s,f)=>{let k=null;for(const key of s.keys)if(key.frame<=f&&(!k||key.frame>=k.frame))k=key;return k&&k.w>0&&k.h>0?k:null;};
/** Frames laid out as a horizontal strip (frame i at x = i·width), one Animation per tag (or one
 * "default" animation), slices mapped to pivots / boxes / 9-slice metadata. Guessed mappings
 * (box type from a slice name, pivot slice choice) are recorded with how they were decided in
 * `metadata.aseprite.mapping`, so a UI can show and undo them. Unknown data is kept in metadata. */
export function toSpriteProject(doc,{name='sprite'}={}){
 const W=doc.width,H=doc.height,mapping=[];
 const pivotSlice=doc.slices.find(s=>s.hasPivot&&/pivot|origin|anchor/i.test(s.name))||doc.slices.find(s=>s.hasPivot)||null;
 if(pivotSlice)mapping.push({slice:pivotSlice.name,as:'pivot',basis:/pivot|origin|anchor/i.test(pivotSlice.name)?'name':'first slice with a pivot',confidence:/pivot|origin|anchor/i.test(pivotSlice.name)?'high':'medium'});
 const boxSlices=doc.slices.filter(s=>!s.nineSlice&&s!==pivotSlice);
 for(const s of boxSlices){const m=BOX_NAME.find(([re])=>re.test(s.name));mapping.push({slice:s.name,as:'box',type:m?m[1]:'custom',basis:m?'name':'default',confidence:m?'medium':'low'});}
 for(const s of doc.slices.filter(s=>s.nineSlice))mapping.push({slice:s.name,as:'nineSlice',basis:'9-patch flag',confidence:'high'});
 const tagOf=f=>doc.tags.find(t=>f>=t.from&&f<=t.to)?.name??'';
 const frames=doc.frames.map((fr,i)=>{
  let pivotX=.5,pivotY=1;
  if(pivotSlice){const k=sliceKeyAt(pivotSlice,i);if(k&&k.pivot){pivotX=(k.x+k.pivot.x)/W;pivotY=(k.y+k.pivot.y)/H;}}
  const boxes=[];
  for(const s of boxSlices){const k=sliceKeyAt(s,i);if(!k)continue;const m=mapping.find(x=>x.slice===s.name&&x.as==='box');boxes.push({type:m.type,shape:'rect',x:k.x,y:k.y,w:k.w,h:k.h});}
  const nine=doc.slices.filter(s=>s.nineSlice).map(s=>{const k=sliceKeyAt(s,i);return k&&k.center?{name:s.name,bounds:{x:k.x,y:k.y,w:k.w,h:k.h},center:k.center,borders:{left:k.center.x,top:k.center.y,right:k.w-k.center.x-k.center.w,bottom:k.h-k.center.y-k.center.h}}:null;}).filter(Boolean);
  const cels=doc.layers.map((l,li)=>fr.cels[li]).filter(Boolean).map(c=>({layer:c.layer,x:c.x,y:c.y,opacity:c.opacity,zIndex:c.zIndex,linkedFrame:c.linkedFrame,userData:c.data.userData}));
  return makeFrame({name:`${name} ${i}`,sourceRect:{x:i*W,y:0,w:W,h:H},canvasWidth:W,canvasHeight:H,pivotX,pivotY,duration:fr.duration,tag:tagOf(i),boxes,
   metadata:{aseprite:{frame:i,nineSlices:nine,cels}}});
 });
 const fpsFor=ids=>{const d=ids.map(id=>frames.find(f=>f.id===id).duration);const avg=d.reduce((a,b)=>a+b,0)/d.length;return Math.min(240,Math.max(0.01,Math.round(1000/avg*100)/100));};
 const animations=(doc.tags.length?doc.tags:[{name:'default',from:0,to:doc.frames.length-1,direction:'forward',repeat:0,color:null,userData:null,synthetic:true}]).map(t=>{
  const from=Math.min(t.from,doc.frames.length-1),to=Math.min(Math.max(t.to,from),doc.frames.length-1);
  let ids=frames.slice(from,to+1).map(f=>f.id),direction=t.direction;
  // Ping-pong reverse = ping-pong starting at the last frame: reversing the list is exact.
  if(direction==='pingpong_reverse'){ids=[...ids].reverse();direction='pingpong';}
  const a=makeAnimation({name:t.name,frameIds:ids,fps:fpsFor(ids),direction,loop:t.repeat===0},frames);
  return {...a,metadata:{aseprite:{direction:t.direction,repeat:t.repeat,color:t.color,userData:t.userData,from:t.from,to:t.to,synthetic:!!t.synthetic}}};
 });
 const metadata={aseprite:{
  width:W,height:H,colorMode:doc.colorMode,transparentIndex:doc.transparentIndex,pixelRatio:doc.pixelRatio,grid:doc.grid,composeGroups:doc.composeGroups,
  layers:doc.layers.map(l=>({index:l.index,name:l.name,type:l.type,parent:l.parent,visible:l.visible,opacity:l.opacity,blendMode:BLEND_MODES[l.blendMode]??'normal',background:l.background,reference:l.reference,tileset:l.tilesetIndex,userData:l.userData})),
  tags:doc.tags,slices:doc.slices,userData:doc.userData,
  tilesets:doc.tilesets.map(t=>({name:t.name,numTiles:t.numTiles,tileWidth:t.tileWidth,tileHeight:t.tileHeight,external:t.external,userData:t.userData})),
  palette:doc.colorMode==='indexed'?[...Array(doc.palette.colors.length>>2)].map((_,i)=>hex(...doc.palette.colors.subarray(i*4,i*4+4))):null,
  externalFiles:doc.externalFiles,colorProfile:doc.colorProfile,mapping,warnings:doc.warnings,
 }};
 return {frames,animations,sheet:{layout:'strip',width:W*doc.frames.length,height:H,frameWidth:W,frameHeight:H},metadata};
}
/** Builds the strip sheet that `toSpriteProject` frames point into. */
export function renderStrip(doc,opts={}){
 const W=doc.width,H=doc.height,n=doc.frames.length,out=new Uint8Array(W*n*H*4);
 for(let f=0;f<n;f++){const {rgba}=renderFrame(doc,f,opts);for(let y=0;y<H;y++)out.set(rgba.subarray(y*W*4,(y+1)*W*4),(y*W*n+f*W)*4);}
 return {width:W*n,height:H,rgba:out};
}

// ---------------------------------------------------------------------------------------------
// Building documents to write

const blendId=m=>{if(m==null)return 0;if(typeof m==='number')return m;const i=BLEND_MODES.indexOf(String(m).toLowerCase().replace(/[\s-]/g,'_'));if(i<0)throw new AsepriteError('input',`Unknown blend mode ${m}`);return i;};
function trimRect(px,w,h,mode,ti){
 let x0=w,y0=h,x1=-1,y1=-1;
 const bppx=BPP[mode];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*bppx;
  const on=mode==='indexed'?px[i]!==ti:mode==='rgba'?px[i+3]!==0:px[i+1]!==0;
  if(on){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 }
 return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
function crop(px,w,r,bppx){const out=new Uint8Array(r.w*r.h*bppx);for(let y=0;y<r.h;y++)out.set(px.subarray(((r.y+y)*w+r.x)*bppx,((r.y+y)*w+r.x+r.w)*bppx),y*r.w*bppx);return out;}
/** Builds a writable document from full-canvas RGBA images per layer and frame.
 *  {width,height, layers:[{name,visible,opacity,blendMode,type,parent,userData}],
 *   frames:[{duration, images:{[layer]:Uint8Array RGBA width*height*4}, cels?:{[layer]:{opacity,zIndex,userData}}}],
 *   palette?: [[r,g,b,a],…] → indexed sprite (every colour must be in it; alpha 0 → transparentIndex),
 *   transparentIndex, tags:[{name,from,to,direction,repeat,color,userData}],
 *   slices:[{name,keys:[{frame,x,y,w,h,center?,pivot?}],userData}], userData, grayscale?:true}
 * Transparent borders are trimmed off each cel. */
export function documentFromImages({width,height,layers=[{name:'Layer 1'}],frames,palette=null,transparentIndex=0,tags=[],slices=[],userData=null,grayscale=false,grid=null,composeGroups=false}){
 if(!(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=65535&&height<=65535))throw new AsepriteError('input','width/height must be integers 1…65535');
 if(!Array.isArray(frames)||!frames.length)throw new AsepriteError('input','At least one frame is required');
 const colorMode=palette?'indexed':grayscale?'grayscale':'rgba';
 let colors=null,lookup=null;
 if(palette){
  if(!palette.length||palette.length>256)throw new AsepriteError('input','Indexed palettes need 1…256 colours');
  colors=new Uint8Array(palette.length*4);lookup=new Map();
  palette.forEach((c,i)=>{const [r,g,b,a=255]=c;colors.set([r,g,b,a],i*4);const key=((r<<24)|(g<<16)|(b<<8)|a)>>>0;if(!lookup.has(key)&&i!==transparentIndex)lookup.set(key,i);});
  if(!(transparentIndex>=0&&transparentIndex<palette.length))throw new AsepriteError('input','transparentIndex must be inside the palette');
 }
 const n=width*height,docLayers=layers.map((l,i)=>({index:i,name:String(l.name??`Layer ${i+1}`),type:l.type||'image',parent:l.parent??-1,visible:l.visible!==false,editable:l.editable!==false,
  background:!!l.background,reference:!!l.reference,collapsed:!!l.collapsed,lockMovement:!!l.lockMovement,preferLinkedCels:!!l.preferLinkedCels,blendMode:blendId(l.blendMode),opacity:l.opacity??255,userData:l.userData??null}));
 let unmapped=0;
 const docFrames=frames.map((fr,f)=>{
  const cels=[];
  for(const [key,img] of Object.entries(fr.images||{})){
   const li=Number(key),layer=docLayers[li];
   if(!layer)throw new AsepriteError('input',`Frame ${f}: image for unknown layer ${key}`);
   if(layer.type!=='image')throw new AsepriteError('input',`Frame ${f}: layer ${li} is a ${layer.type} layer`);
   if(!img||img.length!==n*4)throw new AsepriteError('input',`Frame ${f} layer ${li}: expected ${n*4} RGBA bytes`);
   let px;
   if(colorMode==='rgba')px=img;
   else if(colorMode==='grayscale'){px=new Uint8Array(n*2);for(let i=0;i<n;i++){px[i*2]=img[i*4];px[i*2+1]=img[i*4+3];if(img[i*4]!==img[i*4+1]||img[i*4]!==img[i*4+2])unmapped++;}}
   else{px=new Uint8Array(n);for(let i=0;i<n;i++){const a=img[i*4+3];if(!a){px[i]=transparentIndex;continue;}const k=((img[i*4]<<24)|(img[i*4+1]<<16)|(img[i*4+2]<<8)|a)>>>0;const v=lookup.get(k);if(v==null){unmapped++;px[i]=transparentIndex;}else px[i]=v;}}
   const r=layer.background?{x:0,y:0,w:width,h:height}:trimRect(px,width,height,colorMode,transparentIndex);
   if(!r)continue;
   const extra=fr.cels?.[li]||{};
   cels[li]={type:'image',layer:li,frame:f,x:r.x,y:r.y,width:r.w,height:r.h,pixels:crop(px,width,r,BPP[colorMode]),opacity:extra.opacity??255,zIndex:extra.zIndex??0,linkedFrame:null,data:{userData:extra.userData??null},extra:null};
  }
  return {index:f,duration:fr.duration??100,cels};
 });
 if(unmapped)throw new AsepriteError('input',colorMode==='indexed'?`${unmapped} pixels use colours that are not in the palette`:`${unmapped} pixels are not gray (r=g=b) in a grayscale sprite`);
 return {width,height,colorMode,transparentIndex:colorMode==='indexed'?transparentIndex:0,composeGroups,pixelRatio:{w:1,h:1},grid:grid||{x:0,y:0,w:16,h:16},
  layers:docLayers,frames:docFrames,palette:colors?{colors}:null,tags,slices,userData,tilesets:[]};
}

// ---------------------------------------------------------------------------------------------
// Writer

class Writer{
 constructor(n=1<<16){this.b=new Uint8Array(n);this.dv=new DataView(this.b.buffer);this.p=0;}
 ensure(n){if(this.p+n>this.b.length){const nb=new Uint8Array(Math.max(this.b.length*2,this.p+n));nb.set(this.b.subarray(0,this.p));this.b=nb;this.dv=new DataView(nb.buffer);}}
 u8(v){this.ensure(1);this.b[this.p++]=v&255;}
 u16(v){this.ensure(2);this.dv.setUint16(this.p,v&0xffff,true);this.p+=2;}
 i16(v){this.ensure(2);this.dv.setInt16(this.p,v,true);this.p+=2;}
 u32(v){this.ensure(4);this.dv.setUint32(this.p,v>>>0,true);this.p+=4;}
 i32(v){this.ensure(4);this.dv.setInt32(this.p,v|0,true);this.p+=4;}
 u64(v){this.ensure(8);this.dv.setBigUint64(this.p,BigInt(v),true);this.p+=8;}
 i64(v){this.ensure(8);this.dv.setBigInt64(this.p,BigInt(v),true);this.p+=8;}
 f32(v){this.ensure(4);this.dv.setFloat32(this.p,v,true);this.p+=4;}
 f64(v){this.ensure(8);this.dv.setFloat64(this.p,v,true);this.p+=8;}
 zero(n){this.ensure(n);this.b.fill(0,this.p,this.p+n);this.p+=n;}
 bytes(a){this.ensure(a.length);this.b.set(a,this.p);this.p+=a.length;}
 str(s){const e=utf8e.encode(String(s??''));if(e.length>65535)throw new AsepriteError('input','String longer than 65535 bytes');this.u16(e.length);this.bytes(e);}
 at(pos,fn){const p=this.p;this.p=pos;fn();this.p=p;}
}
const colorBytes=c=>{
 if(c==null)return null;
 if(Array.isArray(c))return [c[0]|0,c[1]|0,c[2]|0,c[3]??255];
 const m=/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(c));if(!m)throw new AsepriteError('input',`Bad colour ${c}`);
 const v=parseInt(m[1],16);return [v>>16&255,v>>8&255,v&255,m[2]?parseInt(m[2],16):255];
};
/** Infers a property type for a plain JS value (typed {type,value} pairs pass through). */
function typedProp(v){
 if(v&&typeof v==='object'&&typeof v.type==='string'&&'value' in v&&PROPERTY_TYPES.includes(v.type))return v;
 if(typeof v==='boolean')return {type:'bool',value:v};
 if(typeof v==='bigint')return {type:v<0n?'int64':'uint64',value:v};
 if(typeof v==='number'){
  if(Number.isInteger(v)){if(v>=-2147483648&&v<=2147483647)return {type:'int32',value:v};if(v>=0&&v<=4294967295)return {type:'uint32',value:v};return {type:'int64',value:BigInt(v)};}
  return {type:'double',value:v};
 }
 if(typeof v==='string')return {type:'string',value:v};
 if(Array.isArray(v))return {type:'vector',value:v.map(typedProp)};
 if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v))defineKey(o,k,typedProp(x));return {type:'map',value:o};}
 throw new AsepriteError('input',`Cannot store ${v===null?'null':typeof v} in user data`);
}
function writeProp(w,p,depth){
 if(depth>128)throw new AsepriteError('input','User data nests deeper than 128 levels');
 const v=p.value;
 switch(p.type){
  case 'bool':w.u8(v?1:0);break;
  case 'int8':case 'uint8':w.u8(v);break;
  case 'int16':w.i16(v);break;case 'uint16':w.u16(v);break;
  case 'int32':w.i32(v);break;case 'uint32':w.u32(v);break;
  case 'int64':w.i64(v);break;case 'uint64':w.u64(v);break;
  case 'fixed':w.i32(Math.round(v*65536));break;
  case 'float':w.f32(v);break;case 'double':w.f64(v);break;
  case 'string':w.str(v);break;
  case 'point':w.i32(v.x);w.i32(v.y);break;
  case 'size':w.i32(v.w);w.i32(v.h);break;
  case 'rect':w.i32(v.x);w.i32(v.y);w.i32(v.w);w.i32(v.h);break;
  case 'vector':{
   const items=v.map(typedProp),same=items.length&&items.every(x=>x.type===items[0].type);
   w.u32(items.length);w.u16(same?PROPERTY_TYPES.indexOf(items[0].type):0);
   for(const it of items){if(!same)w.u16(PROPERTY_TYPES.indexOf(it.type));writeProp(w,it,depth+1);}
   break;
  }
  case 'map':{
   const entries=Object.entries(v);w.u32(entries.length);
   for(const [k,x] of entries){const t=typedProp(x);w.str(k);w.u16(PROPERTY_TYPES.indexOf(t.type));writeProp(w,t,depth+1);}
   break;
  }
  case 'uuid':{const s=String(v).replace(/-/g,'');if(!/^[0-9a-f]{32}$/i.test(s))throw new AsepriteError('input','Bad UUID');for(let i=0;i<16;i++)w.u8(parseInt(s.slice(i*2,i*2+2),16));break;}
  default:throw new AsepriteError('input',`Unknown property type ${p.type}`);
 }
}
const udEmpty=ud=>!ud||(!ud.text&&!ud.color&&!(ud.properties&&Object.keys(ud.properties).some(k=>Object.keys(ud.properties[k]?.value??ud.properties[k]??{}).length)));

/** Serialises a document (the shape `readAseprite` returns, or `documentFromImages` builds) into
 * .aseprite bytes: zlib-compressed cels, linked cels for identical consecutive-or-not cels on the
 * same layer (`linkDuplicates`), tags, slices, user data, tilesets and tilemap cels. */
export function writeAseprite(doc,{linkDuplicates=true,level=6,deflate=null,target="aseprite"}={}){
 // target "libresprite": LibreSprite (an Aseprite 1.1 fork) refuses files with chunks it does not know
 // (slices 0x2022, tilesets 0x2023, external files 0x2008), so those are left out.
 const legacy=target==="libresprite";
 if(legacy&&doc.layers.some(l=>l.type==="tilemap"))throw new AsepriteError("input","LibreSprite has no tilemap layers");
 const z=deflate||(b=>deflateZlib(b,{level}));
 const {width,height,colorMode}=doc,bpp=BPP[colorMode];
 if(!bpp)throw new AsepriteError('input',`Unknown colour mode ${colorMode}`);
 if(!(width>=1&&height>=1&&width<=65535&&height<=65535))throw new AsepriteError('input','Sprite size must be 1…65535');
 const nframes=doc.frames.length;if(nframes<1||nframes>65535)throw new AsepriteError('input','1…65535 frames required');
 const layers=doc.layers.filter(l=>l.type!=='unknown');
 // Layer order must be a pre-order walk (each layer after its parent, subtrees contiguous).
 const remap=new Map(layers.map((l,i)=>[l.index??i,i]));
 const depthOf=[];const stack=[];
 layers.forEach((l,i)=>{
  const parent=l.parent==null||l.parent<0?-1:remap.get(l.parent);
  if(parent===undefined||parent>=i)throw new AsepriteError('input',`Layer "${l.name}" must come after its parent`);
  if(parent>=0&&layers[parent].type!=='group')throw new AsepriteError('input',`Layer "${l.name}" has a non-group parent`);
  while(stack.length&&stack[stack.length-1]!==parent)stack.pop();
  if(parent>=0&&!stack.length)throw new AsepriteError('input',`Layer "${l.name}" breaks its parent's subtree order`);
  depthOf[i]=stack.length;stack.push(i);
  if(l.type==='tilemap'&&!(l.tilesetIndex>=0&&doc.tilesets?.[l.tilesetIndex]))throw new AsepriteError('input',`Tilemap layer "${l.name}" needs a tileset`);
 });
 // Palette
 let pal=doc.palette?.colors??doc.palettes?.[0]?.colors??null;
 if(!pal){
  const seen=new Map();
  if(colorMode==='rgba')outer:for(const fr of doc.frames)for(const c of fr.cels)if(c&&c.type==='image'){const p=c.pixels;for(let i=0;i<p.length;i+=4){if(!p[i+3])continue;const k=((p[i]<<24)|(p[i+1]<<16)|(p[i+2]<<8)|p[i+3])>>>0;if(!seen.has(k)){seen.set(k,[p[i],p[i+1],p[i+2],p[i+3]]);if(seen.size>=256)break outer;}}}
  const list=[[0,0,0,255],...seen.values()].slice(0,256);pal=new Uint8Array(list.length*4);list.forEach((c,i)=>pal.set(c,i*4));
 }
 const ncolors=pal.length>>2;if(ncolors<1||ncolors>65535)throw new AsepriteError('input','Palette must have 1…65535 colours');
 const transparentIndex=colorMode==='indexed'?(doc.transparentIndex|0):0;
 const w=new Writer(1<<16);
 const hasUuid=layers.some(l=>l.uuid);
 // Header
 w.u32(0);w.u16(0xA5E0);w.u16(nframes);w.u16(width);w.u16(height);w.u16(colorMode==='rgba'?32:colorMode==='grayscale'?16:8);
 w.u32(1|(doc.composeGroups?2:0)|(hasUuid?4:0));
 w.u16(Math.min(65535,Math.max(1,doc.frames[0].duration|0||100)));w.u32(0);w.u32(0);
 w.u8(transparentIndex);w.zero(3);w.u16(ncolors);
 w.u8(doc.pixelRatio?.w||1);w.u8(doc.pixelRatio?.h||1);
 const g=doc.grid||{x:0,y:0,w:16,h:16};w.i16(g.x|0);w.i16(g.y|0);w.u16(g.w|0);w.u16(g.h|0);
 w.zero(84);
 if(w.p!==128)throw new Error('header size');
 // External files for extension-keyed property maps and external tilesets
 const ext=new Map();
 const collectExt=ud=>{if(ud?.properties)for(const k of Object.keys(ud.properties))if(k&&!ext.has(k))ext.set(k,{id:ext.size+1,type:2,name:k});};
 collectExt(doc.userData);for(const t of doc.tags||[])collectExt(t.userData);for(const l of layers)collectExt(l.userData);for(const s of doc.slices||[])collectExt(s.userData);
 for(const fr of doc.frames)for(const c of fr.cels)if(c)collectExt(c.data?.userData);
 for(const ts of doc.tilesets||[]){collectExt(ts.userData);for(const u of ts.tileUserData||[])collectExt(u);if(ts.external?.fileName&&!ext.has('ts:'+ts.external.fileName))ext.set('ts:'+ts.external.fileName,{id:ext.size+1,type:1,name:ts.external.fileName});}
 let chunkCount=0;
 const chunk=(type,fn)=>{const start=w.p;w.u32(0);w.u16(type);fn();{const n=w.p-start;w.at(start,()=>w.u32(n));};chunkCount++;};
 const userDataChunk=ud=>chunk(CHUNK.USER_DATA,()=>{
  const props=ud?.properties?Object.entries(ud.properties).filter(([,m])=>Object.keys(m?.type==='map'?m.value:m||{}).length):[];
  const col=colorBytes(ud?.color);
  const fl=(ud?.text?1:0)|(col&&col[3]?2:0)|(props.length?4:0);
  w.u32(fl);if(fl&1)w.str(ud.text);if(fl&2)for(const v of col)w.u8(v);
  if(fl&4){
   const start=w.p;w.u32(0);w.u32(props.length);
   for(const [k,m] of props){w.u32(k?ext.get(k).id:0);const t=m?.type==='map'?m:typedProp(m);writeProp(w,{type:'map',value:t.value},0);}
   {const n=w.p-start;w.at(start,()=>w.u32(n));};
  }
 });
 // Linked-cel detection
 const linkOf=new Map();
 if(linkDuplicates){
  const seen=new Map();
  for(let f=0;f<nframes;f++)for(const c of doc.frames[f].cels){
   if(!c||c.type!=='image'||c.linkedFrame!=null||!udEmpty(c.data?.userData))continue;
   const key=`${c.layer}|${c.x}|${c.y}|${c.opacity}|${c.width}|${c.height}|${hashBytes(c.pixels)}`;
   const prev=seen.get(key);
   if(prev&&bytesEqual(prev.pixels,c.pixels))linkOf.set(c,prev.frame);else if(!prev)seen.set(key,c);
  }
 }
 for(let f=0;f<nframes;f++){
  const fr=doc.frames[f],fstart=w.p;chunkCount=0;w.zero(16);
  if(f===0){
   if(ext.size&&!legacy)chunk(CHUNK.EXTERNAL_FILES,()=>{w.u32(ext.size);w.zero(8);for(const e of ext.values()){w.u32(e.id);w.u8(e.type);w.zero(7);w.str(e.name);}});
   chunk(CHUNK.COLOR_PROFILE,()=>{w.u16(1);w.u16(0);w.u32(0);w.zero(8);});
   chunk(CHUNK.PALETTE,()=>{w.u32(ncolors);w.u32(0);w.u32(ncolors-1);w.zero(8);for(let i=0;i<ncolors;i++){w.u16(0);w.u8(pal[i*4]);w.u8(pal[i*4+1]);w.u8(pal[i*4+2]);w.u8(pal[i*4+3]);}});
   if(!udEmpty(doc.userData))userDataChunk(doc.userData);
   (legacy?[]:doc.tilesets||[]).forEach((ts,si)=>{
    chunk(CHUNK.TILESET,()=>{
     const embed=!!ts.pixels,extFile=ts.external?.fileName?ext.get('ts:'+ts.external.fileName):null;
     w.u32(si);w.u32(4|(embed?2:0)|(extFile?1:0)|(ts.matchFlips?.x?8:0)|(ts.matchFlips?.y?16:0)|(ts.matchFlips?.d?32:0));
     w.u32(ts.numTiles);w.u16(ts.tileWidth);w.u16(ts.tileHeight);w.i16(ts.baseIndex??1);w.zero(14);w.str(ts.name||'');
     if(extFile){w.u32(extFile.id);w.u32(ts.external.tilesetId|0);}
     if(embed){if(ts.pixels.length!==ts.numTiles*ts.tileWidth*ts.tileHeight*bpp)throw new AsepriteError('input',`Tileset "${ts.name}" pixel size mismatch`);const d=z(ts.pixels);w.u32(d.length);w.bytes(d);}
    });
    userDataChunk(ts.userData);
    for(let i=0;i<ts.numTiles;i++)userDataChunk(ts.tileUserData?.[i]||null);
   });
   const tags=doc.tags||[];
   if(tags.length){
    chunk(CHUNK.TAGS,()=>{
     w.u16(tags.length);w.zero(8);
     for(const t of tags){
      const from=Math.max(0,Math.min(nframes-1,t.from|0)),to=Math.max(from,Math.min(nframes-1,t.to|0));
      const dir=typeof t.direction==='number'?t.direction:Math.max(0,DIRECTIONS.indexOf(t.direction??'forward'));
      const col=colorBytes(t.color)||[0,0,0,255];
      w.u16(from);w.u16(to);w.u8(dir);w.u16(Math.min(65535,Math.max(0,t.repeat|0)));w.zero(6);w.u8(col[0]);w.u8(col[1]);w.u8(col[2]);w.u8(0);w.str(t.name??'');
     }
    });
    for(const t of tags)userDataChunk(t.userData?{...t.userData,color:t.userData.color??t.color}:{text:null,color:t.color,properties:null});
   }
   layers.forEach((l,i)=>{
    chunk(CHUNK.LAYER,()=>{
     const fl=(l.visible!==false?1:0)|(l.editable!==false?2:0)|(l.lockMovement?4:0)|(l.background?8:0)|(l.preferLinkedCels?16:0)|(l.collapsed?32:0)|(l.reference?64:0);
     const t=l.type==='group'?1:l.type==='tilemap'?2:0,saveBlend=t!==1||doc.composeGroups;
     w.u16(fl);w.u16(t);w.u16(depthOf[i]);w.u16(0);w.u16(0);
     w.u16(saveBlend?blendId(l.blendMode):0);w.u8(saveBlend?(l.opacity??255):0);w.zero(3);w.str(l.name);
     if(t===2)w.u32(l.tilesetIndex);
     if(hasUuid){const s=(l.uuid||'').replace(/-/g,'').padEnd(32,'0');for(let k=0;k<16;k++)w.u8(parseInt(s.slice(k*2,k*2+2),16)||0);}
    });
    if(!udEmpty(l.userData))userDataChunk(l.userData);
   });
   for(const s of legacy?[]:doc.slices||[]){
    const keys=[...(s.keys||[])].sort((a,b)=>a.frame-b.frame);if(!keys.length)continue;
    const nine=keys.some(k=>k.center),piv=keys.some(k=>k.pivot);
    chunk(CHUNK.SLICE,()=>{
     w.u32(keys.length);w.u32((nine?1:0)|(piv?2:0));w.u32(0);w.str(s.name??'');
     for(const k of keys){
      w.u32(k.frame|0);w.i32(k.x|0);w.i32(k.y|0);w.u32(k.w|0);w.u32(k.h|0);
      if(nine){const c=k.center||{x:0,y:0,w:0,h:0};w.i32(c.x|0);w.i32(c.y|0);w.u32(c.w|0);w.u32(c.h|0);}
      if(piv){const p=k.pivot||{x:0,y:0};w.i32(p.x|0);w.i32(p.y|0);}
     }
    });
    if(!udEmpty(s.userData))userDataChunk(s.userData);
   }
  }
  // Cels, in layer order
  layers.forEach((l,li)=>{
   const c=fr.cels[l.index??li];if(!c||l.type==='group')return;
   const linked=c.linkedFrame!=null&&c.linkedFrame!==f?c.linkedFrame:linkOf.get(c);
   chunk(CHUNK.CEL,()=>{
    w.u16(li);w.i16(c.x|0);w.i16(c.y|0);w.u8(c.opacity??255);
    const type=linked!=null?1:c.type==='tilemap'?3:2;
    w.u16(type);w.i16(c.zIndex|0);w.zero(5);
    if(type===1){if(!(linked<f))throw new AsepriteError('input',`Frame ${f}: linked cel must point to an earlier frame`);w.u16(linked);return;}
    w.u16(c.width);w.u16(c.height);
    if(type===2){
     if(c.pixels.length!==c.width*c.height*bpp)throw new AsepriteError('input',`Frame ${f} layer "${l.name}": pixel buffer size mismatch`);
     w.bytes(z(c.pixels));
    }else{
     w.u16(32);w.u32(TILE.INDEX_MASK);w.u32(TILE.XFLIP);w.u32(TILE.YFLIP);w.u32(TILE.DFLIP);w.zero(10);
     const raw=new Uint8Array(c.tiles.length*4),dv=new DataView(raw.buffer);c.tiles.forEach((t,i)=>dv.setUint32(i*4,t>>>0,true));
     w.bytes(z(raw));
    }
   });
   if(linked==null&&!udEmpty(c.data?.userData))userDataChunk(c.data.userData);
  });
  const size=w.p-fstart;
  w.at(fstart,()=>{w.u32(size);w.u16(0xF1FA);w.u16(Math.min(chunkCount,0xFFFF));w.u16(Math.min(65535,Math.max(1,fr.duration|0||100)));w.zero(2);w.u32(chunkCount);});
 }
 {const n=w.p;w.at(0,()=>w.u32(n));}
 return w.b.slice(0,w.p);
}
function hashBytes(b){let h=0x811c9dc5;const step=Math.max(1,b.length>>12);for(let i=0;i<b.length;i+=step)h=Math.imul(h^b[i],16777619);return (h^b.length)>>>0;}
function bytesEqual(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
