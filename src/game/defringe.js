/** De-fringing: removing the halo a sprite keeps when it was flattened against a background.
 *
 * Where does the halo come from? A cut-out is stored straight (un-premultiplied) RGBA, but the
 * edge pixels of an image that was composited over white hold `body·coverage + white·(1−coverage)`
 * in their RGB while their alpha says `coverage`. Re-composite that over anything darker and the
 * leftover white shows as a light rim. The same happens over black (a dark rim) or over a coloured
 * backdrop (a coloured rim).
 *
 * The fix is to replace the RGB of the semi-transparent edge with the colour the sprite actually
 * is there — propagated outwards from the nearest fully opaque interior pixels — and to leave
 * **every alpha byte exactly as it was**. The silhouette, the soft edge and any engine that reads
 * the alpha channel see no change at all; only the colour under the transparency changes.
 *
 * This is a correction, not a reconstruction: the original coverage-weighted colour is gone and
 * cannot be recovered, so the propagated interior colour is the best available answer. */
import {maskOf,distanceField,NEIGHBOURS,ALPHA_THRESHOLD} from './pixels.js';
export const HALO_TYPES=Object.freeze(['none','white','black','colour']);
const LUMA=(r,g,b)=>.2126*r+.7152*g+.0722*b;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
/** Splits an image into interior (fully opaque), edge (partly transparent) and empty pixels.
 * `solidAlpha` is the alpha at which a pixel counts as interior; 250 rather than 255 because
 * encoders round. */
export function edgeClasses(image,{threshold=ALPHA_THRESHOLD,solidAlpha=250}={}){
 if(!Number.isInteger(solidAlpha)||solidAlpha<=threshold||solidAlpha>255)throw Error('solidAlpha must be an integer above the transparency threshold and at most 255');
 const {data,width,height}=image,classes=new Uint8Array(width*height);
 let interior=0,edge=0;
 for(let p=0;p<classes.length;p++){
  const a=data[p*4+3];
  classes[p]=a>=solidAlpha?2:a>threshold?1:0;
  if(classes[p]===2)interior++;else if(classes[p]===1)edge++;
 }
 return {classes,width,height,interior,edge,empty:classes.length-interior-edge,threshold,solidAlpha};
}
/** What kind of halo the edge carries, judged by comparing the edge's colour with the colour of
 * the interior next to it. `delta` is the luma difference: positive means the edge is lighter. */
export function detectFringe(image,{threshold=ALPHA_THRESHOLD,solidAlpha=250,connectivity=8,minEdge=8}={}){
 const {classes,width,height,edge,interior}=edgeClasses(image,{threshold,solidAlpha});
 const none={type:'none',colour:null,confidence:0,edgePixels:edge,interiorPixels:interior};
 if(edge<minEdge||!interior)return {...none,reason:edge<minEdge?'Too few partly transparent pixels to judge.':'No fully opaque interior to compare with.'};
 const rim={bits:new Uint8Array(width*height),width,height};
 for(let p=0;p<classes.length;p++)rim.bits[p]=classes[p]===1?1:0;
 const {dist}=distanceField(rim,{radius:2,connectivity});
 const edgeRgb=[[],[],[]],nearRgb=[[],[],[]];
 for(let p=0;p<classes.length;p++){
  if(classes[p]===1)for(let c=0;c<3;c++)edgeRgb[c].push(image.data[p*4+c]);
  else if(classes[p]===2&&dist[p]>0)for(let c=0;c<3;c++)nearRgb[c].push(image.data[p*4+c]);
 }
 if(!nearRgb[0].length)return {...none,reason:'The interior does not touch the soft edge.'};
 const e=edgeRgb.map(mean),n=nearRgb.map(mean),delta=LUMA(...e)-LUMA(...n);
 const spread=Math.max(...e.map((v,i)=>Math.abs(v-n[i])));
 const type=Math.abs(delta)<6&&spread<12?'none':delta>=6&&Math.min(...e)>Math.min(...n)&&mean(e)>mean(n)?'white':delta<=-6?'black':'colour';
 return {type,colour:type==='none'?null:e.map(Math.round),interiorColour:n.map(Math.round),
  meanEdgeLuma:LUMA(...e),meanInteriorLuma:LUMA(...n),delta,spread,
  confidence:Math.min(1,Math.max(Math.abs(delta)/48,spread/64)),edgePixels:edge,interiorPixels:interior};
}
/** Corrects the edge RGB and leaves every alpha byte identical.
 * @param radius       how far the interior colour may be carried outwards, in whole pixels
 * @param strength     0…1 blend between the original edge colour and the propagated one
 * @param bleed        also rewrite fully transparent pixels within the radius; harmless on its own
 *                     and it stops a filtered or mip-mapped texture pulling the old halo back in
 * @returns {data,width,height,changed:{count,mask,maxDelta}, before, after, alphaUnchanged, warnings} */
export function defringe(image,{threshold=ALPHA_THRESHOLD,solidAlpha=250,radius=2,strength=1,connectivity=8,bleed=false}={}){
 if(!Number.isFinite(strength)||strength<0||strength>1)throw Error('Strength is 0…1');
 if(!Number.isSafeInteger(radius)||radius<1||radius>64)throw Error('De-fringe radius must be 1…64 whole pixels');
 if(!NEIGHBOURS[connectivity])throw Error('Connectivity is 4 or 8');
 const {data,width,height}=image,{classes}=edgeClasses(image,{threshold,solidAlpha});
 const out=new Uint8ClampedArray(data),mask=new Uint8Array(width*height);
 const before=detectFringe(image,{threshold,solidAlpha,connectivity}),warnings=[];
 const solid={bits:new Uint8Array(width*height),width,height};
 for(let p=0;p<classes.length;p++)solid.bits[p]=classes[p]===2?1:0;
 if(!solid.bits.some(Boolean))return {data:out,width,height,changed:{count:0,mask,maxDelta:0},before,after:before,alphaUnchanged:true,
  warnings:['Every pixel is partly transparent, so there is no interior colour to propagate from.'],radius,strength};
 const {dist,order}=distanceField(solid,{radius,connectivity});
 // Propagate outwards in breadth-first order: each pixel averages the pixels one step closer to
 // the interior, which are already resolved. That spreads the interior colour smoothly instead of
 // stamping one nearest pixel's colour across the whole band.
 const rgb=new Float32Array(width*height*3);
 for(let p=0;p<classes.length;p++)if(classes[p]===2)for(let c=0;c<3;c++)rgb[p*3+c]=data[p*4+c];
 let count=0,maxDelta=0;
 for(const p of order){
  const x=p%width,y=(p-x)/width,d=dist[p];
  let n=0,r=0,g=0,b=0;
  for(const [dx,dy] of NEIGHBOURS[connectivity]){
   const nx=x+dx,ny=y+dy;
   if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const q=ny*width+nx;
   if(dist[q]<0||dist[q]>=d)continue;
   n++;r+=rgb[q*3];g+=rgb[q*3+1];b+=rgb[q*3+2];
  }
  if(!n)continue;
  rgb[p*3]=r/n;rgb[p*3+1]=g/n;rgb[p*3+2]=b/n;
  if(classes[p]===0&&!bleed)continue;
  let delta=0;
  for(let c=0;c<3;c++){
   const value=Math.round(data[p*4+c]*(1-strength)+rgb[p*3+c]*strength);
   delta=Math.max(delta,Math.abs(value-data[p*4+c]));
   out[p*4+c]=value;
  }
  out[p*4+3]=data[p*4+3];
  if(delta){mask[p]=1;count++;if(delta>maxDelta)maxDelta=delta;}
 }
 for(let p=0;p<classes.length;p++)out[p*4+3]=data[p*4+3];
 const after=detectFringe({data:out,width,height},{threshold,solidAlpha,connectivity});
 let alphaUnchanged=true;
 for(let i=3;i<data.length;i+=4)if(out[i]!==data[i]){alphaUnchanged=false;break;}
 if(before.type==='none')warnings.push('No halo was detected; the edge colours were propagated anyway, which is a no-op on a clean sprite.');
 if(Math.abs(after.delta||0)>Math.abs(before.delta||0)+.5)warnings.push('The edge did not get closer to the interior colour; check the transparency threshold.');
 return {data:out,width,height,changed:{count,mask,maxDelta},before,after,alphaUnchanged,warnings,radius,strength,bleed};
}
