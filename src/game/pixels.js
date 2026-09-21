/** Bounded pixel access for the Sprite Lab engine. Every module here reads pixels through a
 * *source*: either plain RGBA (`{data,width,height}`) or a lazy reader (`{width,height,read(rect)}`)
 * that hands back only the requested rectangle. Nothing in src/game ever keeps a full-sheet copy
 * per frame — a sheet is walked in bands and a frame is read one rectangle at a time.
 *
 * Source   {width, height, read(rect) -> Image}
 * Image    {data:Uint8ClampedArray (RGBA), width, height}
 * Mask     {bits:Uint8Array (0|1 per pixel), width, height}   binary alpha silhouette
 * All coordinates are integer pixels, origin top-left, y down. */
export const MAX_SHEET_PIXELS=64_000_000;
export const BAND_PIXELS=1_048_576;
export const ALPHA_THRESHOLD=8;
const int=(v,name)=>{if(!Number.isSafeInteger(v))throw Error(`${name} must be an integer`);return v;};
export function positive(v,name){if(!Number.isSafeInteger(v)||v<1)throw Error(`${name} must be a positive integer`);return v;}
/** Clips nothing: a rectangle that leaves the source is a caller bug, not a soft failure. */
export function checkRect(r,width,height,name='rect'){
 if(!r)throw Error(`${name} is missing`);
 const x=int(r.x,name+'.x'),y=int(r.y,name+'.y'),w=positive(r.w,name+'.w'),h=positive(r.h,name+'.h');
 if(x<0||y<0||x+w>width||y+h>height)throw Error(`${name} ${x},${y} ${w}×${h} leaves the ${width}×${height} source`);
 return {x,y,w,h};
}
export const isImage=v=>!!v&&typeof v==='object'&&v.data&&Number.isSafeInteger(v.width)&&Number.isSafeInteger(v.height);
/** Normalises any accepted input into a Source. Reading the whole of a data-backed source returns
 * the original array (no copy); any sub-rectangle is copied row by row. */
export function source(input){
 if(input&&typeof input.read==='function'){
  const width=positive(input.width,'width'),height=positive(input.height,'height');
  return {width,height,read(r){const rect=checkRect(r,width,height);const out=input.read(rect);
   if(!isImage(out)||out.width!==rect.w||out.height!==rect.h||out.data.length!==rect.w*rect.h*4)throw Error('read() must return RGBA for exactly the requested rectangle');
   return out;}};
 }
 if(!isImage(input))throw Error('Expected {data,width,height} RGBA pixels or {width,height,read(rect)}');
 const {data,width,height}=input;
 positive(width,'width');positive(height,'height');
 if(width*height>MAX_SHEET_PIXELS)throw Error(`Sheets above ${MAX_SHEET_PIXELS} pixels are not supported`);
 if(data.length!==width*height*4)throw Error('RGBA data length does not match width × height');
 return {width,height,read(r){
  const rect=checkRect(r,width,height);
  if(rect.x===0&&rect.y===0&&rect.w===width&&rect.h===height)return {data,width,height};
  const out=new Uint8ClampedArray(rect.w*rect.h*4);
  for(let row=0;row<rect.h;row++){const from=((rect.y+row)*width+rect.x)*4;out.set(data.subarray(from,from+rect.w*4),row*rect.w*4);}
  return {data:out,width:rect.w,height:rect.h};
 }};
}
/** Walks the source in horizontal bands of at most BAND_PIXELS pixels, so peak memory is the band,
 * not the sheet. `onBand(image, y0)` sees rows y0 … y0+image.height-1. */
export function eachBand(src,onBand,{signal,bandPixels=BAND_PIXELS}={}){
 const rows=Math.max(1,Math.min(src.height,Math.floor(bandPixels/src.width)||1));
 for(let y=0;y<src.height;y+=rows){
  signal?.throwIfAborted?.();
  const h=Math.min(rows,src.height-y);
  onBand(src.read({x:0,y,w:src.width,h}),y);
 }
}
/** Binary silhouette of an image (or of a rectangle of a source). One byte per pixel. */
export function maskOf(img,{threshold=ALPHA_THRESHOLD}={}){
 const {data,width,height}=img,bits=new Uint8Array(width*height);
 for(let p=0;p<bits.length;p++)bits[p]=data[p*4+3]>threshold?1:0;
 return {bits,width,height};
}
export function maskOfSource(src,rect,options){return maskOf(src.read(rect||{x:0,y:0,w:src.width,h:src.height}),options);}
export const maskAt=(m,x,y)=>x<0||y<0||x>=m.width||y>=m.height?0:m.bits[y*m.width+x];
export const NEIGHBOURS=Object.freeze({4:Object.freeze([[1,0],[-1,0],[0,1],[0,-1]]),8:Object.freeze([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])});
/** Whole-pixel distance from the set pixels of a mask, by breadth-first search and stopped at
 * `radius` — so the cost is the band around the shape, not the whole canvas. 8-connectivity gives
 * Chebyshev distance (a diagonal step costs 1), 4-connectivity gives Manhattan distance. Cells
 * further than `radius` stay -1. `order` lists the reached pixels nearest first, which lets a
 * caller propagate a value outwards in one pass. */
export function distanceField(mask,{radius=1,connectivity=8}={}){
 if(!Number.isSafeInteger(radius)||radius<0||radius>4096)throw Error('Radius must be 0…4096 pixels');
 if(!NEIGHBOURS[connectivity])throw Error('Connectivity is 4 or 8');
 const {bits,width,height}=mask,dist=new Int32Array(width*height).fill(-1),queue=new Int32Array(width*height);
 let back=0;
 for(let p=0;p<bits.length;p++)if(bits[p]){dist[p]=0;queue[back++]=p;}
 const seeds=back;
 for(let front=0;front<back;front++){
  const p=queue[front],d=dist[p];
  if(d>=radius)continue;
  const x=p%width,y=(p-x)/width;
  for(const [dx,dy] of NEIGHBOURS[connectivity]){
   const nx=x+dx,ny=y+dy;
   if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const n=ny*width+nx;
   if(dist[n]>=0)continue;
   dist[n]=d+1;queue[back++]=n;
  }
 }
 return {dist,width,height,radius,connectivity,order:queue.subarray(seeds,back),seeds:queue.subarray(0,seeds)};
}
/** Per-row and per-column opaque-pixel counts plus the fully transparent lines. Band-read, so a
 * 8192×8192 sheet costs one band, not 256 MB. */
export function alphaProfile(src,{threshold=ALPHA_THRESHOLD,signal}={}){
 const rows=new Uint32Array(src.height),cols=new Uint32Array(src.width);let opaque=0;
 eachBand(src,(band,y0)=>{
  for(let y=0;y<band.height;y++){let count=0;
   for(let x=0;x<band.width;x++)if(band.data[(y*band.width+x)*4+3]>threshold){count++;cols[x]++;}
   rows[y0+y]=count;opaque+=count;}
 },{signal});
 const emptyRows=new Uint8Array(src.height),emptyCols=new Uint8Array(src.width);
 for(let y=0;y<src.height;y++)emptyRows[y]=rows[y]?0:1;
 for(let x=0;x<src.width;x++)emptyCols[x]=cols[x]?0:1;
 return {width:src.width,height:src.height,rows,cols,emptyRows,emptyCols,opaque,threshold};
}
/** Normalised autocorrelation of a profile at one lag: 1 = the profile repeats exactly. Means are
 * removed first so a constant profile scores 0 instead of 1. */
export function autocorrelationAt(profile,lag){
 const n=profile.length;if(lag<1||lag>=n)return 0;
 let sum=0;for(let i=0;i<n;i++)sum+=profile[i];
 const mean=sum/n;let num=0,den=0;
 for(let i=0;i<n;i++){const a=profile[i]-mean;den+=a*a;if(i+lag<n)num+=a*(profile[i+lag]-mean);}
 return den>0?Math.max(0,num/den):0;
}
export function autocorrelation(profile,maxLag){
 const out=new Float64Array(Math.max(0,Math.min(maxLag,profile.length-1))+1);
 for(let lag=1;lag<out.length;lag++)out[lag]=autocorrelationAt(profile,lag);
 return out;
}
/** Alpha bounds of one rectangle of a source, in source coordinates; null when fully transparent. */
export function boundsIn(src,rect,{threshold=ALPHA_THRESHOLD}={}){
 const r=checkRect(rect,src.width,src.height),img=src.read(r);
 let x0=r.w,y0=r.h,x1=-1,y1=-1;
 for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
  if(img.data[(y*r.w+x)*4+3]<=threshold)continue;
  if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
 return x1<0?null:{x:r.x+x0,y:r.y+y0,w:x1-x0+1,h:y1-y0+1};
}
/** 64-bit FNV-1a over bytes, as 16 hex digits. Used to group identical frames before the exact
 * byte comparison that actually decides aliasing. */
export function hashBytes(bytes,seed=0xcbf29ce484222325n){
 let h=seed;const prime=0x100000001b3n,mask=0xffffffffffffffffn;
 for(let i=0;i<bytes.length;i++){h=(h^BigInt(bytes[i]))*prime&mask;}
 return h.toString(16).padStart(16,'0');
}
export const rectEquals=(a,b)=>!!a&&!!b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
export const innerRect=f=>f.trimmedRect||f.sourceRect;
