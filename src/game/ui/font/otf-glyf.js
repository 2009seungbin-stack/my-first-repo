/** TrueType outlines (loca + glyf, with gvar variations) for the OpenType parser. Pure; no DOM.
 *
 * glyphPoints(gid, coords) returns the flattened points of one glyph instance:
 * {xy: Float64Array x,y…, on: Uint8Array, ends: contour end indices, pp1x, pp2x}.
 * Composite glyphs are flattened here: every component is loaded (recursively, at the same
 * variation coordinates) and its points transformed with the component's 2×2 matrix and offset.
 * Transforms are applied to the points one level at a time, inner first, exactly as fontTools'
 * nested TransformPens do, so scaled/rotated components match it bit for bit.
 *   · ARGS_ARE_XY_VALUES: the offset is (arg1,arg2), moved by gvar deltas when varied.
 *   · point matching (args are point numbers): the component is moved so its point arg2 lands
 *     on point arg1 of the glyph assembled so far (FreeType and fontTools do the same).
 *   · SCALED_COMPONENT_OFFSET (and not UNSCALED): the offset is transformed by the matrix, as
 *     FreeType does; fontTools ignores this rare Apple flag.
 * Nesting deeper than 16 levels (usually a component loop) throws.
 *
 * pp1x/pp2x are the horizontal phantom points (origin and advance). Callers subtract pp1x so the
 * glyph origin is at x=0: that is how FreeType positions an outline whose hmtx lsb disagrees
 * with its glyf xMin, and how variations that move the origin are honoured. */
import {fail} from './otf-read.js';
import {applyGvar} from './otf-var.js';

const ON=1,X_SHORT=2,Y_SHORT=4,REPEAT=8,X_SAME=16,Y_SAME=32;
const WORDS=1,XY=2,SCALE=8,MORE=0x20,XY_SCALE=0x40,TWO_BY_TWO=0x80,SCALED_OFFSET=0x800,UNSCALED_OFFSET=0x1000;
export const MAX_COMPONENT_DEPTH=16;

export function makeGlyf({loca,glyf,longLoca,numGlyphs,hmtx,gvar}){
 const count=Math.min(numGlyphs,loca.length/(longLoca?4:2)-1);
 const range=gid=>{
  if(!(gid>=0&&gid<count))return null;
  const a=longLoca?loca.u32(gid*4):loca.u16(gid*2)*2,b=longLoca?loca.u32(gid*4+4):loca.u16(gid*2+2)*2;
  if(b<a||b>glyf.length)fail(`glyf: glyph ${gid} lies outside the glyf table (loca ${a}–${b}, table ${glyf.length} bytes) — the font is truncated or corrupt`);
  return [a,b];
 };
 const empty=gid=>{const r=range(gid);return !r||r[0]===r[1];};

 /** Raw glyph record, no variations. */
 function decode(gid){
  const r=range(gid);
  if(!r||r[0]===r[1])return {kind:'empty',xMin:0};
  const v=glyf.sub(r[0],r[1]-r[0],`glyf (glyph ${gid})`),nc=v.i16(0),xMin=v.i16(2);
  if(nc>=0){
   v.need(10,nc,2,'contour end points');
   const ends=[];let prev=-1;
   for(let i=0;i<nc;i++){const e=v.u16(10+i*2);if(e<=prev)fail(`glyf: glyph ${gid} has contour ends out of order`);ends.push(e);prev=e;}
   const n=nc?ends[nc-1]+1:0;let p=10+nc*2;p+=2+v.u16(p);// skip instructions
   const flags=new Uint8Array(n);
   for(let i=0;i<n;){const f=v.u8(p++);flags[i++]=f;if(f&REPEAT){let k=v.u8(p++);if(i+k>n)fail(`glyf: glyph ${gid} flag repeat runs past its points`);while(k--)flags[i++]=f;}}
   const xy=new Float64Array(n*2),on=new Uint8Array(n);
   let x=0,y=0;
   for(let i=0;i<n;i++){const f=flags[i];if(f&X_SHORT){const d=v.u8(p++);x+=f&X_SAME?d:-d;}else if(!(f&X_SAME)){x+=v.i16(p);p+=2;}xy[i*2]=x;on[i]=f&ON;}
   for(let i=0;i<n;i++){const f=flags[i];if(f&Y_SHORT){const d=v.u8(p++);y+=f&Y_SAME?d:-d;}else if(!(f&Y_SAME)){y+=v.i16(p);p+=2;}xy[i*2+1]=y;}
   return {kind:'simple',xMin,xy,on,ends};
  }
  const comps=[];let p=10,flags;
  do{
   flags=v.u16(p);const glyph=v.u16(p+2);p+=4;
   let a1,a2;
   if(flags&WORDS){a1=flags&XY?v.i16(p):v.u16(p);a2=flags&XY?v.i16(p+2):v.u16(p+2);p+=4;}
   else{a1=flags&XY?v.i8(p):v.u8(p);a2=flags&XY?v.i8(p+1):v.u8(p+1);p+=2;}
   let m=[1,0,0,1];
   if(flags&SCALE){const s=v.f2(p);m=[s,0,0,s];p+=2;}
   else if(flags&XY_SCALE){m=[v.f2(p),0,0,v.f2(p+2)];p+=4;}
   else if(flags&TWO_BY_TWO){m=[v.f2(p),v.f2(p+2),v.f2(p+4),v.f2(p+6)];p+=8;}
   comps.push({glyph,flags,a1,a2,m});
   if(comps.length>65535)fail(`glyf: glyph ${gid} has too many components`);
  }while(flags&MORE);
  return {kind:'composite',xMin,comps};
 }

 const cache=new Map();
 /** Flattened points of glyph `gid` at normalized `coords` (null = default). */
 function points(gid,coords,key,depth=0){
  if(depth>MAX_COMPONENT_DEPTH)fail(`glyf: composite glyphs nest deeper than ${MAX_COMPONENT_DEPTH} levels (glyph ${gid}) — probably a component loop`);
  const ck=gid+'|'+key;
  const hit=cache.get(ck);if(hit)return hit;
  const g=decode(gid),adv=hmtx.advance(gid),lsb=hmtx.lsb(gid);
  const pp1=g.xMin-lsb,phantom=[pp1,0,pp1+adv,0,0,0,0,0];
  const vary=coords&&gvar?gvar.variations(gid,(g.kind==='simple'?g.on.length:g.kind==='composite'?g.comps.length:0)+4):null;
  let out;
  if(g.kind!=='composite'){
   const n=g.kind==='simple'?g.on.length:0,all=new Float64Array(n*2+8);
   if(n)all.set(g.xy);all.set(phantom,n*2);
   if(vary)applyGvar(vary,coords,all,g.kind==='simple'?g.ends:[]);
   out={xy:all.subarray(0,n*2),on:n?g.on:new Uint8Array(0),ends:n?g.ends:[],pp1x:all[n*2],pp2x:all[n*2+2]};
  }else{
   const k=g.comps.length,all=new Float64Array(k*2+8);
   g.comps.forEach((c,i)=>{if(c.flags&XY){all[i*2]=c.a1;all[i*2+1]=c.a2;}});
   all.set(phantom,k*2);
   if(vary)applyGvar(vary,coords,all,null);
   const xs=[],on=[],ends=[];
   g.comps.forEach((c,i)=>{
    if(c.glyph>=numGlyphs)fail(`glyf: glyph ${gid} uses component ${c.glyph}, which does not exist`);
    const sub=points(c.glyph,coords,key,depth+1),[a,b,cc,d]=c.m,n=sub.on.length,base=on.length;
    const t=new Float64Array(n*2);
    // TransformPen: x' = xx·x + yx·y + dx, y' = xy·x + yy·y + dy with (xx,xy,yx,yy) = (a,b,c,d)
    for(let j=0;j<n;j++){const x=sub.xy[j*2],y=sub.xy[j*2+1];t[j*2]=a*x+cc*y;t[j*2+1]=b*x+d*y;}
    let dx,dy;
    if(c.flags&XY){
     dx=all[i*2];dy=all[i*2+1];
     if(c.flags&SCALED_OFFSET&&!(c.flags&UNSCALED_OFFSET)){const ox=dx,oy=dy;dx=a*ox+cc*oy;dy=b*ox+d*oy;}
    }else{
     if(c.a1>=base||c.a2>=n)fail(`glyf: glyph ${gid} anchors component ${c.glyph} to a point that does not exist`);
     dx=xs[c.a1*2]-t[c.a2*2];dy=xs[c.a1*2+1]-t[c.a2*2+1];
    }
    for(let j=0;j<n;j++){xs.push(t[j*2]+dx,t[j*2+1]+dy);on.push(sub.on[j]);}
    for(const e of sub.ends)ends.push(e+base);
   });
   out={xy:Float64Array.from(xs),on:Uint8Array.from(on),ends,pp1x:all[k*2],pp2x:all[k*2+2]};
  }
  if(cache.size>4096)cache.clear();
  cache.set(ck,out);
  return out;
 }
 return {count,empty,decode,points};
}
