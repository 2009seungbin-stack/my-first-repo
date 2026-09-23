/** Sprite pixels for the Studio packer: cut, scale (nearest), trim, find identical frames, and draw
 * atlas pages. Pure (typed arrays in, typed arrays out): runs in the pack worker and in node:test.
 *
 * Colour-exact by construction: pixels are copied byte for byte from the decoded source (the
 * caller decodes PNGs with src/game/texture-png.js, which ignores gAMA/cHRM/iCCP instead of
 * colour-managing them), nothing goes through a canvas, and scaling is nearest-neighbour only.
 *
 * Trim modes (TexturePacker's names):
 *   none       the whole frame canvas is stored
 *   trim       transparent borders removed; the frame keeps its canvas size and the offset of the
 *              stored pixels inside it (sourceSize + spriteSourceSize), so it draws exactly where it was
 *   crop-keep  transparent borders removed and the frame becomes that small; its POSITION is kept by
 *              moving the pivot by the removed offset (engines that honour pivots draw it in place)
 *   crop       transparent borders removed, size and position are forgotten (icons, UI pieces) */
export const TRIM_MODES=Object.freeze(['none','trim','crop-keep','crop']);

/** Two independent 32-bit hashes of the visible bytes (RGB under alpha 0 is ignored). */
function hashPixels(data){
 let a=0x811c9dc5,b=5381;
 for(let i=0;i<data.length;i+=4){
  const al=data[i+3],r=al?data[i]:0,g=al?data[i+1]:0,bl=al?data[i+2]:0;
  a=Math.imul(a^r,16777619);a=Math.imul(a^g,16777619);a=Math.imul(a^bl,16777619);a=Math.imul(a^al,16777619);
  b=(Math.imul(b,33)^(r|g<<8|bl<<16|al<<24))>>>0;
 }
 return `${(a>>>0).toString(16)}${b.toString(16)}`;
}
function sameVisible(x,y){
 if(x.length!==y.length)return false;
 for(let i=0;i<x.length;i+=4){
  if(x[i+3]!==y[i+3])return false;
  if(x[i+3]&&(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2]))return false;
 }
 return true;
}
/** Canvas size of a frame at `scale` (nearest). Integer scales are exact multiples. */
export const scaledSize=(n,scale)=>Math.max(1,scale>=1&&Number.isInteger(scale)?n*scale:Math.round(n*scale));
/** The part of the scaled canvas that samples the frame's stored pixels, with its pixels. */
function scaledRegion(src,f,scale){
 const {rect,offX,offY}=f,cw=scaledSize(f.canvasW,scale),ch=scaledSize(f.canvasH,scale);
 const sx=cw/f.canvasW,sy=ch/f.canvasH;// per-axis factors (round() may make them differ slightly)
 const x0=Math.max(0,Math.ceil(offX*sx-.5)),x1=Math.min(cw,Math.ceil((offX+rect.w)*sx-.5));
 const y0=Math.max(0,Math.ceil(offY*sy-.5)),y1=Math.min(ch,Math.ceil((offY+rect.h)*sy-.5));
 const w=Math.max(0,x1-x0),h=Math.max(0,y1-y0),data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++){
  const cy=Math.min(f.canvasH-1,Math.floor((y0+y+.5)/sy)),py=rect.y+cy-offY;
  for(let x=0;x<w;x++){
   const cx=Math.min(f.canvasW-1,Math.floor((x0+x+.5)/sx)),px=rect.x+cx-offX;
   const from=(py*src.width+px)*4,to=(y*w+x)*4;
   data[to]=src.data[from];data[to+1]=src.data[from+1];data[to+2]=src.data[from+2];data[to+3]=src.data[from+3];
  }
 }
 return {x:x0,y:y0,w,h,data,cw,ch};
}
function bbox(img,threshold){
 let l=img.w,t=img.h,r=-1,b=-1;
 for(let y=0;y<img.h;y++){const row=y*img.w*4;for(let x=0;x<img.w;x++)if(img.data[row+x*4+3]>threshold){if(x<l)l=x;if(x>r)r=x;if(y<t)t=y;if(y>b)b=y;}}
 return r<0?null:{x:l,y:t,w:r-l+1,h:b-t+1};
}
function crop(img,r){
 const out=new Uint8Array(r.w*r.h*4);
 for(let y=0;y<r.h;y++)out.set(img.data.subarray(((r.y+y)*img.w+r.x)*4,((r.y+y)*img.w+r.x+r.w)*4),y*r.w*4);
 return out;
}
export function normalizeSpriteSettings(s={}){
 const out={trimMode:s.trimMode??'trim',alphaThreshold:s.alphaThreshold??0,dedupe:s.dedupe!==false};
 if(!TRIM_MODES.includes(out.trimMode))throw Error(`Unknown trim mode ${out.trimMode}`);
 if(!Number.isSafeInteger(out.alphaThreshold)||out.alphaThreshold<0||out.alphaThreshold>254)throw Error('Alpha threshold must be 0…254');
 return out;
}
/** Frame input: {id, name, src (key of `sources`), rect:{x,y,w,h} stored pixels in the source,
 *  canvasW, canvasH, offX, offY (where rect sits on the frame canvas), pivotX, pivotY (normalised
 *  on the canvas)}. `sources`: Map|object key → {width,height,data RGBA}.
 * @returns sprites [{id,name,w,h,data,sourceW,sourceH,ox,oy,trimmed,pivotX,pivotY,key,aliasOf}] */
export function prepareSprites(frames,sources,settings={},{scale=1}={}){
 const s=normalizeSpriteSettings(settings);
 if(!(scale>0&&scale<=16))throw Error('Scale must be above 0 and at most 16');
 const get=k=>sources instanceof Map?sources.get(k):sources[k];
 const out=[],leaders=new Map();
 for(const f of frames){
  const src=get(f.src);if(!src)throw Error(`No pixels for ${f.name||f.id}`);
  const r=f.rect;if(r.x<0||r.y<0||r.x+r.w>src.width||r.y+r.h>src.height)throw Error(`${f.name||f.id} lies outside its image`);
  const reg=scaledRegion(src,f,scale),cw=reg.cw,ch=reg.ch;
  let w,h,data,ox,oy;
  if(s.trimMode==='none'){
   w=cw;h=ch;ox=0;oy=0;data=new Uint8Array(w*h*4);
   for(let y=0;y<reg.h;y++)data.set(reg.data.subarray(y*reg.w*4,(y+1)*reg.w*4),((reg.y+y)*w+reg.x)*4);
  }else{
   const bb=reg.w&&reg.h?bbox(reg,s.alphaThreshold):null;
   if(!bb){w=1;h=1;ox=0;oy=0;data=new Uint8Array(4);}// fully transparent: one clear pixel, as TexturePacker does
   else{w=bb.w;h=bb.h;ox=reg.x+bb.x;oy=reg.y+bb.y;data=crop(reg,bb);}
  }
  let sourceW=cw,sourceH=ch,pivotX=f.pivotX??.5,pivotY=f.pivotY??1,offX=ox,offY=oy;
  if(s.trimMode==='crop-keep'){pivotX=(pivotX*cw-ox)/w;pivotY=(pivotY*ch-oy)/h;sourceW=w;sourceH=h;offX=0;offY=0;}
  else if(s.trimMode==='crop'){sourceW=w;sourceH=h;offX=0;offY=0;}
  const key=`${w}x${h}:${hashPixels(data)}`;
  let aliasOf=null;
  if(s.dedupe){
   const list=leaders.get(key);
   const hit=list?.find(l=>sameVisible(l.data,data));
   if(hit)aliasOf=hit.id;else if(list)list.push({id:f.id,data});else leaders.set(key,[{id:f.id,data}]);
  }
  out.push({id:f.id,name:f.name,w,h,data,sourceW,sourceH,ox:offX,oy:offY,
   trimmed:w!==sourceW||h!==sourceH||offX!==0||offY!==0,pivotX,pivotY,key,aliasOf});
 }
 return out;
}
/** Writes every placed sprite of one page, rotated 90° clockwise where the layout says so
 * (TexturePacker/Phaser/Pixi convention; `rotation:'ccw'` for Spine/libGDX, whose runtimes turn a
 * rotated region back clockwise — measured with spine-canvas 4.2), then the extrude belt. */
export function renderPage(page,spriteById,{extrude=0,premultiply=false,rotation='cw'}={}){
 const ccw=rotation==='ccw';
 const W=page.width,H=page.height,out=new Uint8Array(W*H*4);
 for(const pl of page.placements){
  const sp=spriteById.get(pl.id);if(!sp)throw Error(`Missing pixels for ${pl.id}`);
  const rw=pl.rotated?sp.h:sp.w,rh=pl.rotated?sp.w:sp.h;
  if(pl.x<0||pl.y<0||pl.x+rw>W||pl.y+rh>H)throw Error(`${pl.id} is placed outside its page`);
  for(let y=0;y<sp.h;y++)for(let x=0;x<sp.w;x++){
   const from=(y*sp.w+x)*4,dx=pl.rotated?(ccw?pl.x+y:pl.x+sp.h-1-y):pl.x+x,dy=pl.rotated?(ccw?pl.y+sp.w-1-x:pl.y+x):pl.y+y,to=(dy*W+dx)*4;
   out[to]=sp.data[from];out[to+1]=sp.data[from+1];out[to+2]=sp.data[from+2];out[to+3]=sp.data[from+3];
  }
  if(extrude>0){
   for(let y=pl.y-extrude;y<pl.y+rh+extrude;y++){
    if(y<0||y>=H)continue;
    const cy=Math.max(pl.y,Math.min(pl.y+rh-1,y));
    for(let x=pl.x-extrude;x<pl.x+rw+extrude;x++){
     if(x<0||x>=W||(y>=pl.y&&y<pl.y+rh&&x>=pl.x&&x<pl.x+rw))continue;
     const cx=Math.max(pl.x,Math.min(pl.x+rw-1,x)),from=(cy*W+cx)*4,to=(y*W+x)*4;
     out[to]=out[from];out[to+1]=out[from+1];out[to+2]=out[from+2];out[to+3]=out[from+3];
    }
   }
  }
 }
 if(premultiply)for(let i=0;i<out.length;i+=4){const a=out[i+3];if(a<255){out[i]=Math.round(out[i]*a/255);out[i+1]=Math.round(out[i+1]*a/255);out[i+2]=Math.round(out[i+2]*a/255);}}
 return {width:W,height:H,data:out};
}
/** A sprite's pixels read back out of a drawn page (rotation undone): the test that the data file
 * describes the image. */
export function readSprite(pageImg,pl,w,h,{rotation='cw'}={}){
 const ccw=rotation==='ccw';
 const out=new Uint8Array(w*h*4),W=pageImg.width;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=pl.rotated?(ccw?pl.x+y:pl.x+h-1-y):pl.x+x,sy=pl.rotated?(ccw?pl.y+w-1-x:pl.y+x):pl.y+y,from=(sy*W+sx)*4,to=(y*w+x)*4;
  out[to]=pageImg.data[from];out[to+1]=pageImg.data[from+1];out[to+2]=pageImg.data[from+2];out[to+3]=pageImg.data[from+3];
 }
 return out;
}
/** A frame's full canvas (sourceW×sourceH at the variant's scale) with its stored pixels put back at
 * their offset — trim undone. For crop modes the canvas is the cropped frame itself. */
export function canvasOf(sp){
 const W=sp.sourceW,H=sp.sourceH,out=new Uint8Array(W*H*4);
 for(let y=0;y<sp.h;y++){const dy=sp.oy+y;if(dy<0||dy>=H)continue;
  for(let x=0;x<sp.w;x++){const dx=sp.ox+x;if(dx<0||dx>=W)continue;const f=(y*sp.w+x)*4,t=(dy*W+dx)*4;out[t]=sp.data[f];out[t+1]=sp.data[f+1];out[t+2]=sp.data[f+2];out[t+3]=sp.data[f+3];}}
 return {width:W,height:H,data:out};
}
/** Draws frame canvases onto one image: items [{id,x,y}] (a `compose` job from an exporter). */
export function compose(job,spriteById){
 const W=job.width,H=job.height,out=new Uint8Array(W*H*4);
 for(const it of job.items){
  const sp=spriteById.get(it.id);if(!sp)throw Error(`Missing pixels for ${it.id}`);
  for(let y=0;y<sp.h;y++){const dy=it.y+sp.oy+y;if(dy<0||dy>=H)continue;
   for(let x=0;x<sp.w;x++){const dx=it.x+sp.ox+x;if(dx<0||dx>=W)continue;const f=(y*sp.w+x)*4,t=(dy*W+dx)*4;
    if(!sp.data[f+3])continue;out[t]=sp.data[f];out[t+1]=sp.data[f+1];out[t+2]=sp.data[f+2];out[t+3]=sp.data[f+3];}}
 }
 return {width:W,height:H,data:out};
}
