/** Font variations for the OpenType parser: fvar, avar, gvar (TrueType glyph deltas), and the
 * ItemVariationStore used by HVAR and GDEF. Pure; no DOM.
 *
 * Normalisation follows the OpenType spec: user value → [-1,1] against the fvar axis, rounded
 * to F2DOT14, mapped through avar, rounded to F2DOT14 again (HarfBuzz and FreeType do this;
 * fontTools' glyph sets skip the rounding, which only matters for values that are not already
 * exact in 1/16384ths). Region scalars follow fontTools' supportScalar(ot=True) operation for
 * operation, so default-location and exact-location results match it bit for bit.
 *
 * gvar: shared tuples, embedded and intermediate regions, shared and private packed point
 * numbers, packed deltas (zero / byte / word / long runs), IUP interpolation of untouched
 * points per contour, composite component offsets and the four phantom points. */
import {fail} from './otf-read.js';

const q14=v=>Math.round(v*16384)/16384;

export function readFvar(v,name){
 const axesOff=v.u16(4),axisCount=v.u16(8),axisSize=v.u16(10),instCount=v.u16(12),instSize=v.u16(14);
 if(axisSize<20)fail('fvar: axis records are too small');
 v.need(axesOff,axisCount,axisSize,'fvar axes');
 const axes=[];
 for(let i=0;i<axisCount;i++){
  const o=axesOff+i*axisSize,nameID=v.u16(o+18);
  const min=v.fixed(o+4),def=v.fixed(o+8),max=v.fixed(o+12);
  axes.push({tag:v.tag(o),min:Math.min(min,def),default:def,max:Math.max(max,def),name:name.get(nameID)||v.tag(o),flags:v.u16(o+16)});
 }
 const instances=[],io=axesOff+axisCount*axisSize;
 if(instSize>=4+axisCount*4)v.need(io,instCount,instSize,'fvar instances');
 for(let i=0;instSize>=4+axisCount*4&&i<instCount;i++){
  const o=io+i*instSize,coords={};
  for(let a=0;a<axisCount;a++)coords[axes[a].tag]=v.fixed(o+4+a*4);
  instances.push({name:name.get(v.u16(o))||`Instance ${i+1}`,coords});
 }
 return {axes,instances};
}

/** avar segment maps → Array per axis of [[from,to],…]. avar 2.0 adds a variation store after
 * the maps that this parser does not apply; such fonts get `version:2` and normalize() refuses
 * them rather than returning coordinates that are silently wrong. */
export function readAvar(v,axisCount){
 const version=v.u16(0),count=v.u16(6);
 if(version!==1&&version!==2)fail(`avar: unsupported version ${version}`);
 const maps=[];let o=8;
 for(let a=0;a<count;a++){
  const n=v.u16(o);v.need(o+2,n,4,'avar segment map');
  const seg=[];for(let i=0;i<n;i++)seg.push([v.f2(o+2+i*4),v.f2(o+4+i*4)]);
  maps.push(seg);o+=2+n*4;
 }
 while(maps.length<axisCount)maps.push([]);
 maps.version=version;
 return maps;
}

/** fontTools piecewiseLinearMap, operation for operation. */
function mapAvar(value,seg){
 if(!seg||!seg.length)return value;
 let lo=null,hi=null;
 for(const [a,b] of seg){
  if(a===value)return b;
  if(a<value&&(!lo||a>lo[0]))lo=[a,b];
  if(a>value&&(!hi||a<hi[0]))hi=[a,b];
 }
 if(!lo){const k=seg.reduce((m,s)=>s[0]<m[0]?s:m);return value+k[1]-k[0];}
 if(!hi){const k=seg.reduce((m,s)=>s[0]>m[0]?s:m);return value+k[1]-k[0];}
 return lo[1]+(hi[1]-lo[1])*(value-lo[0])/(hi[0]-lo[0]);
}

/** {tag:userValue} → normalized Float64Array in fvar order (missing axes stay at default). */
export function normalize(axes,avar,user){
 if(avar&&avar.version===2)fail('avar version 2 (non-linear axis mapping through a variation store) is not supported');
 const out=new Float64Array(axes.length);
 axes.forEach((a,i)=>{
  let v=user&&user[a.tag]!=null?Number(user[a.tag]):a.default;
  if(!Number.isFinite(v))fail(`Axis ${a.tag}: ${user[a.tag]} is not a number`);
  v=Math.max(a.min,Math.min(a.max,v));
  let n=v===a.default?0:v<a.default?(v-a.default)/(a.default-a.min):(v-a.default)/(a.max-a.default);
  n=q14(n);
  if(avar)n=q14(mapAvar(n,avar[i]));
  out[i]=n;
 });
 return out;
}

/** fontTools supportScalar(location, support, ot=True). `peak/start/end` are per-axis arrays. */
export function tupleScalar(coords,peak,start,end){
 let s=1;
 for(let i=0;i<peak.length;i++){
  const p=peak[i];if(p===0)continue;
  const lo=start[i],hi=end[i];
  if(lo>p||p>hi)continue;
  if(lo<0&&hi>0)continue;
  const v=coords[i]||0;
  if(v===p)continue;
  if(v<=lo||hi<=v)return 0;
  s*=v<p?(v-lo)/(p-lo):(v-hi)/(p-hi);
 }
 return s;
}

/** ItemVariationStore → {delta(outer,inner,coords)} with per-coords region scalar caching. */
export function readItemVariationStore(v){
 if(v.u16(0)!==1)fail('ItemVariationStore: unsupported format');
 const regOff=v.u32(2),count=v.u16(6);v.need(8,count,4,'ItemVariationStore data offsets');
 const axisCount=v.u16(regOff),regionCount=v.u16(regOff+2);
 v.need(regOff+4,regionCount,axisCount*6,'variation regions');
 const regions=[];
 for(let r=0;r<regionCount;r++){
  const start=[],peak=[],end=[];
  for(let a=0;a<axisCount;a++){const o=regOff+4+(r*axisCount+a)*6;start.push(v.f2(o));peak.push(v.f2(o+2));end.push(v.f2(o+4));}
  regions.push({start,peak,end});
 }
 const data=[];
 for(let i=0;i<count;i++){
  const o=v.u32(8+i*4);
  if(!o){data.push(null);continue;}
  const itemCount=v.u16(o),wc=v.u16(o+2),regionIndexCount=v.u16(o+4),long=!!(wc&0x8000),words=wc&0x7fff;
  v.need(o+6,regionIndexCount,2,'variation region indices');
  const idx=[];for(let k=0;k<regionIndexCount;k++){const r=v.u16(o+6+k*2);if(r>=regionCount)fail('ItemVariationStore: region index out of range');idx.push(r);}
  if(words>regionIndexCount)fail('ItemVariationStore: more word deltas than regions');
  const rowSize=long?words*4+(regionIndexCount-words)*2:words*2+(regionIndexCount-words);
  const rows=o+6+regionIndexCount*2;v.need(rows,itemCount,rowSize,'delta sets');
  data.push({itemCount,long,words,idx,rows,rowSize});
 }
 let cacheKey=null,cache=null;
 return {
  delta(outer,inner,coords){
   const d=data[outer];if(!d||inner>=d.itemCount)return 0;
   const key=Array.prototype.join.call(coords,',');
   if(key!==cacheKey){cacheKey=key;cache=regions.map(r=>tupleScalar(coords,r.peak,r.start,r.end));}
   let sum=0,p=d.rows+inner*d.rowSize;
   for(let k=0;k<d.idx.length;k++){
    let x;
    if(k<d.words){x=d.long?v.i32(p):v.i16(p);p+=d.long?4:2;}else{x=d.long?v.i16(p):v.i8(p);p+=d.long?2:1;}
    const s=cache[d.idx[k]];if(s)sum+=s*x;
   }
   return sum;
  }
 };
}

/** DeltaSetIndexMap → (i) → [outer, inner]; indices past the end use the last entry. */
export function readDeltaSetIndexMap(v){
 const format=v.u8(0),entryFormat=v.u8(1),count=format===0?v.u16(2):format===1?v.u32(2):fail('DeltaSetIndexMap: unsupported format');
 const at=format===0?4:6,size=(entryFormat>>4&3)+1,innerBits=(entryFormat&15)+1;
 v.need(at,count,size,'DeltaSetIndexMap entries');
 return i=>{
  if(!count)return [0,i];
  const p=at+Math.min(i,count-1)*size;let e=0;for(let k=0;k<size;k++)e=e*256+v.u8(p+k);
  return [Math.floor(e/2**innerBits),e%2**innerBits];
 };
}

/** gvar header → {variations(gid) → [{peak,start,end,points|null,dx,dy}] | null} (decoded lazily). */
export function readGvar(v,axisCount,numGlyphs){
 if(v.u16(0)!==1)fail('gvar: unsupported version');
 if(v.u16(4)!==axisCount)fail('gvar: axis count does not match fvar');
 const sharedCount=v.u16(6),sharedOff=v.u32(8),glyphCount=Math.min(v.u16(12),numGlyphs),long=v.u16(14)&1,dataOff=v.u32(16);
 v.need(sharedOff,sharedCount,axisCount*2,'gvar shared tuples');
 const shared=[];for(let i=0;i<sharedCount;i++){const t=[];for(let a=0;a<axisCount;a++)t.push(v.f2(sharedOff+(i*axisCount+a)*2));shared.push(t);}
 v.need(20,glyphCount+1,long?4:2,'gvar offsets');
 const offset=i=>long?v.u32(20+i*4):v.u16(20+i*2)*2;
 return {
  /** `numPoints` includes the four phantom points. */
  variations(gid,numPoints){
   if(gid>=glyphCount)return null;
   const a=offset(gid),b=offset(gid+1);if(b<=a)return null;
   const g=v.sub(dataOff+a,b-a,'gvar glyph variation data');
   const head=g.u16(0),count=head&0x0fff;let data=g.u16(2);
   let sharedPoints=null;
   if(head&0x8000){const r=readPoints(g,data,numPoints);sharedPoints=r.points;data=r.next;}
   const out=[];let h=4;
   for(let t=0;t<count;t++){
    const size=g.u16(h),index=g.u16(h+2);h+=4;
    let peak;
    if(index&0x8000){peak=[];for(let i=0;i<axisCount;i++)peak.push(g.f2(h+i*2));h+=axisCount*2;}
    else{peak=shared[index&0x0fff];if(!peak)fail('gvar: shared tuple index out of range');}
    let start,end;
    if(index&0x4000){start=[];end=[];for(let i=0;i<axisCount;i++){start.push(g.f2(h+i*2));end.push(g.f2(h+(axisCount+i)*2));}h+=axisCount*4;}
    else{start=peak.map(p=>Math.min(p,0));end=peak.map(p=>Math.max(p,0));}
    let p=data,points=sharedPoints;
    const stop=data+size;if(stop>g.length)fail('gvar: tuple data runs past the glyph variation data');
    if(index&0x2000){const r=readPoints(g,p,numPoints);points=r.points;p=r.next;}
    const n=points?points.length:numPoints;
    const dx=readDeltas(g,p,n,stop),dy=readDeltas(g,dx.next,n,stop);
    out.push({peak,start,end,points,dx:dx.values,dy:dy.values});
    data=stop;
   }
   return out;
  }
 };
}
/** Packed point numbers → {points: Array|null (null = all points), next}. */
function readPoints(g,p,numPoints){
 let count=g.u8(p++);
 if(count===0)return {points:null,next:p};
 if(count&0x80)count=(count&0x7f)<<8|g.u8(p++);
 const points=[];let last=0;
 while(points.length<count){
  const ctrl=g.u8(p++),run=(ctrl&0x7f)+1,words=ctrl&0x80;
  for(let i=0;i<run&&points.length<count;i++){last+=words?g.u16(p):g.u8(p);p+=words?2:1;points.push(last);}
 }
 return {points,next:p};
}
function readDeltas(g,p,n,stop){
 const values=new Float64Array(n);let i=0;
 while(i<n){
  if(p>=stop)fail('gvar: packed deltas run past their tuple');
  const ctrl=g.u8(p++),run=(ctrl&0x3f)+1,kind=ctrl&0xc0;
  if(kind===0x80){i+=run;continue;}
  const size=kind===0xc0?4:kind===0x40?2:1;
  for(let k=0;k<run&&i<n;k++,i++){values[i]=size===4?g.i32(p):size===2?g.i16(p):g.i8(p);p+=size;}
 }
 return {values,next:p};
}

/** fontTools iup_segment for one axis, applied in place to `out` (deltas of one tuple). */
function iupContour(coords,deltas,touched,start,end,axis,out){
 const touchedIdx=[];for(let i=start;i<=end;i++)if(touched[i])touchedIdx.push(i);
 if(!touchedIdx.length)return;
 if(touchedIdx.length===1){const d=deltas[touchedIdx[0]];for(let i=start;i<=end;i++)if(!touched[i])out[i]=d;return;}
 const len=end-start+1;
 for(let k=0;k<touchedIdx.length;k++){
  const i1=touchedIdx[k],i2=touchedIdx[(k+1)%touchedIdx.length];
  let x1=coords[i1*2+axis],x2=coords[i2*2+axis],d1=deltas[i1],d2=deltas[i2];
  const gap=(i2-i1-1+len)%len;if(!gap)continue;
  if(x1===x2){const d=d1===d2?d1:0;for(let s=1;s<=gap;s++)out[start+(i1-start+s)%len]=d;continue;}
  if(x1>x2){[x1,x2]=[x2,x1];[d1,d2]=[d2,d1];}
  const scale=(d2-d1)/(x2-x1);
  for(let s=1;s<=gap;s++){
   const i=start+(i1-start+s)%len,x=coords[i*2+axis];
   out[i]=x<=x1?d1:x>=x2?d2:d1+(x-x1)*scale;
  }
 }
}

/** Adds the deltas of every applicable tuple to `pts` (Float64Array of x,y incl. 4 phantoms).
 * `ends` are contour end indices (null for composites: untouched points get no delta).
 * Accumulates tuple by tuple exactly like fontTools' glyph set (coordinates += delta·scalar). */
export function applyGvar(tuples,coords,pts,ends){
 if(!tuples)return;
 const n=pts.length/2,orig=Float64Array.from(pts);
 for(const t of tuples){
  const s=tupleScalar(coords,t.peak,t.start,t.end);if(!s)continue;
  let dx,dy;
  if(!t.points){dx=t.dx;dy=t.dy;}
  else{
   dx=new Float64Array(n);dy=new Float64Array(n);const touched=new Uint8Array(n);
   t.points.forEach((p,i)=>{if(p<n){dx[p]=t.dx[i];dy[p]=t.dy[i];touched[p]=1;}});
   if(ends){
    const xs=Float64Array.from(dx),ys=Float64Array.from(dy);
    let start=0;
    for(const e of ends){iupContour(orig,xs,touched,start,e,0,dx);iupContour(orig,ys,touched,start,e,1,dy);start=e+1;}
   }
  }
  for(let i=0;i<n;i++){if(dx[i])pts[i*2]+=dx[i]*s;if(dy[i])pts[i*2+1]+=dy[i]*s;}
 }
}
