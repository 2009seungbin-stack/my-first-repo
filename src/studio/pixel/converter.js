/** Still/animation raster conversion for the Pixel workspace. Pure and deterministic. Input pixels
 * remain straight RGBA; these functions never perform I/O or mutate their source. The source frame
 * should already be composited by the Sprite importer (GIF/APNG disposal belongs there). */
import {accumulate,oklab,paletteFromHistogram,quantizeIndexed} from '../../pixel-engine.js';

const clamp=v=>Math.max(0,Math.min(255,Math.round(v)));
const labDistance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const rgbaKey=(d,i)=>(d[i]|d[i+1]<<8|d[i+2]<<16|d[i+3]<<24)>>>0;
const unpack=k=>[k&255,k>>>8&255,k>>>16&255,k>>>24&255];

export const SAMPLE_METHODS=Object.freeze(['nearest','median','mode','k-centroid']);
/** Integer-only nearest export; RGBA bytes (including alpha) repeat exactly. */
export function scaleNearest(frame,factor,{maxPixels=48e6}={}){
 if(!Number.isInteger(factor)||factor<1||factor>16)throw Error('Scale must be an integer from 1 to 16');
 const {width,height,data}=frame,W=width*factor,H=height*factor;
 if(!data||data.length!==width*height*4||W*H>maxPixels)throw Error('Scaled PNG exceeds the pixel budget');
 const out=new Uint8Array(W*H*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const pixel=data.subarray((y*width+x)*4,(y*width+x+1)*4);
  for(let dy=0;dy<factor;dy++)for(let dx=0;dx<factor;dx++)out.set(pixel,((y*factor+dy)*W+x*factor+dx)*4);
 }
 return {data:out,width:W,height:H};
}
/** Sample one pixel from each cell, including noninteger cells and an optional grid phase. Transparent
 * colours cannot dominate a cell only because their hidden RGB happens to be frequent. */
export function sampleToGrid(frame,width,height,{method='mode',offsetX=0,offsetY=0}={}){
 if(!SAMPLE_METHODS.includes(method))throw Error('Unknown sampling method');
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>48e6)throw Error('Invalid output size');
 if(!Number.isFinite(offsetX)||!Number.isFinite(offsetY)||Math.abs(offsetX)>frame.width||Math.abs(offsetY)>frame.height)throw Error('Invalid grid offset');
 const {data, width:sw,height:sh}=frame;if(!data||data.length!==sw*sh*4)throw Error('Invalid source pixels');
 const out=new Uint8Array(width*height*4),sx=sw/width,sy=sh/height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const x0=Math.max(0,Math.min(sw-1,Math.floor(offsetX+x*sx))),x1=Math.max(x0+1,Math.min(sw,Math.ceil(offsetX+(x+1)*sx)));
  const y0=Math.max(0,Math.min(sh-1,Math.floor(offsetY+y*sy))),y1=Math.max(y0+1,Math.min(sh,Math.ceil(offsetY+(y+1)*sy)));
  let c;
  if(method==='nearest'){
   const px=Math.max(0,Math.min(sw-1,Math.floor(offsetX+(x+.5)*sx))),py=Math.max(0,Math.min(sh-1,Math.floor(offsetY+(y+.5)*sy)));
   c=Array.from(data.subarray((py*sw+px)*4,(py*sw+px)*4+4));
  }else if(method==='mode'){
   const counts=new Map();for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*sw+xx)*4,k=data[i+3]?rgbaKey(data,i):0;counts.set(k,(counts.get(k)||0)+1);}
   let best=0,n=-1;for(const [k,v] of counts)if(v>n){best=k;n=v;}c=unpack(best);
  }else if(method==='median'){
   // A 256-bin histogram per channel is linear in the cell area. Sorting four copies of an
   // 8,000-pixel cell makes a 4K → 32px photo needlessly slow and allocates many short arrays.
   const bins=new Uint32Array(1024);let count=0;
   for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){
    const i=(yy*sw+xx)*4;if(!data[i+3])continue;count++;
    for(let k=0;k<4;k++)bins[k*256+data[i+k]]++;
   }
   if(!count)c=[0,0,0,0];
   else{const rank=Math.floor((count-1)/2);c=[0,1,2,3].map(k=>{let n=0;for(let v=0;v<256;v++){n+=bins[k*256+v];if(n>rank)return v;}return 255;});}
  }else{
   const pixels=[];for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){const i=(yy*sw+xx)*4;if(data[i+3])pixels.push([data[i],data[i+1],data[i+2],data[i+3]]);}
   if(!pixels.length)c=[0,0,0,0];
   else c=dominantCentroid(pixels);
  }
  out.set(c,(y*width+x)*4);
 }
 return {data:out,width,height};
}

function dominantCentroid(pixels){
 if(pixels.length===1)return pixels[0];
 // Two deterministic Lloyd clusters, seeded at darkest/lightest Oklab lightness. The heavier
 // cluster keeps small high-contrast details from averaging into an unrelated edge colour.
 const points=pixels.map(c=>({rgb:c,lab:oklab(...c)}));
 let lo=points[0],hi=points[0];for(const p of points){if(p.lab[0]<lo.lab[0])lo=p;if(p.lab[0]>hi.lab[0])hi=p;}
 let centers=[lo.lab,hi.lab],parts=[[],[]];
 for(let it=0;it<4;it++){
  parts=[[],[]];for(const p of points)parts[labDistance(p.lab,centers[0])<=labDistance(p.lab,centers[1])?0:1].push(p);
  centers=parts.map((a,k)=>a.length?[0,1,2].map(j=>a.reduce((s,p)=>s+p.lab[j],0)/a.length):centers[k]);
 }
 const dominant=parts[0].length>=parts[1].length?parts[0]:parts[1];
 return [0,1,2,3].map(k=>clamp(dominant.reduce((s,p)=>s+p.rgb[k],0)/dominant.length));
}

export const PALETTE_ALGORITHMS=Object.freeze(['median-cut','k-means','wu']);
/** One histogram across all frames, so a single palette is shared by an animation. */
export function paletteFromFrames(frames,count,{algorithm='median-cut'}={}){
 if(!PALETTE_ALGORITHMS.includes(algorithm))throw Error('Unknown palette algorithm');
 if(!Number.isInteger(count)||count<2||count>256)throw Error('Palette size must be 2–256');
 const hist=new Map();for(const f of frames)accumulate(f.data,hist);
 if(algorithm==='median-cut')return paletteFromHistogram(hist,count);
 const points=[...hist.values()].map(v=>{const rgb=v.slice(0,3).map(x=>x/v[3]);return {rgb,lab:oklab(...rgb),weight:v[3]};});
 if(!points.length)return [[0,0,0]];
 if(algorithm==='k-means')return kmeans(points,count,paletteFromHistogram(hist,count));
 return wuOklab(points,count);
}

function kmeans(points,count,seeds){
 let centers=seeds.map(c=>oklab(...c));while(centers.length<count)centers.push(points[centers.length%points.length].lab);
 const labels=new Uint16Array(points.length);
 for(let iteration=0;iteration<12;iteration++){
  const sums=centers.map(()=>[0,0,0,0]);let changed=false;
  for(let p=0;p<points.length;p++){let best=0,dist=Infinity;for(let i=0;i<centers.length;i++){const d=labDistance(points[p].lab,centers[i]);if(d<dist){dist=d;best=i;}}if(labels[p]!==best){labels[p]=best;changed=true;}const s=sums[best];for(let j=0;j<3;j++)s[j]+=points[p].lab[j]*points[p].weight;s[3]+=points[p].weight;}
  centers=centers.map((c,i)=>sums[i][3]?sums[i].slice(0,3).map(v=>v/sums[i][3]):c);
  if(!changed&&iteration>0)break;
 }
 return represent(points,labels,centers.length);
}

/** Wu-style variance partition on an Oklab histogram. Each candidate split minimizes within-box
 * squared error via between-class variance; 3D moments would be faster for very large histograms,
 * but the 5-bit source histogram bounds this variant to at most 32,768 occupied cells. */
function wuOklab(points,count){
 const boxes=[points.map((_,i)=>i)];
 const stats=ids=>{let w=0,s=[0,0,0],q=0;for(const i of ids){const p=points[i],m=p.weight;w+=m;for(let j=0;j<3;j++)s[j]+=p.lab[j]*m;q+=m*(p.lab[0]**2+p.lab[1]**2+p.lab[2]**2);}return {w,s,q,error:w?q-s.reduce((a,v)=>a+v*v,0)/w:0};};
 while(boxes.length<count){let choice=null;
  for(let b=0;b<boxes.length;b++){
   const ids=boxes[b];if(ids.length<2)continue;const total=stats(ids);
   for(let axis=0;axis<3;axis++){
    const sorted=[...ids].sort((a,c)=>points[a].lab[axis]-points[c].lab[axis]||a-c);
    let lw=0,ls=[0,0,0],lq=0;for(let at=1;at<sorted.length;at++){
     const p=points[sorted[at-1]],m=p.weight;lw+=m;lq+=m*p.lab.reduce((v,x)=>v+x*x,0);for(let j=0;j<3;j++)ls[j]+=p.lab[j]*m;
     if(points[sorted[at-1]].lab[axis]===points[sorted[at]].lab[axis])continue;
     const rw=total.w-lw;if(!rw)continue;const rs=total.s.map((v,j)=>v-ls[j]);
     const err=lq-ls.reduce((a,v)=>a+v*v,0)/lw+(total.q-lq)-rs.reduce((a,v)=>a+v*v,0)/rw;
     const gain=total.error-err;if(gain>1e-10&&(!choice||gain>choice.gain))choice={b,at,sorted,gain};
    }
   }
  }
  if(!choice)break;boxes.splice(choice.b,1,choice.sorted.slice(0,choice.at),choice.sorted.slice(choice.at));
 }
 return boxes.map(ids=>{let mass=0,s=[0,0,0];for(const i of ids){const p=points[i];mass+=p.weight;for(let j=0;j<3;j++)s[j]+=p.rgb[j]*p.weight;}return s.map(v=>clamp(v/mass));});
}
function represent(points,labels,n){
 const sums=Array.from({length:n},()=>[0,0,0,0]);for(let i=0;i<points.length;i++){const p=points[i],s=sums[labels[i]];for(let j=0;j<3;j++)s[j]+=p.rgb[j]*p.weight;s[3]+=p.weight;}
 return sums.filter(s=>s[3]).map(s=>s.slice(0,3).map(v=>clamp(v/s[3])));
}

/** Existing pixel-engine quantizer supplies Bayer, Floyd–Steinberg and Atkinson. An optional fixed
 * blue-noise threshold uses a seeded void-like tile; the seed is stable across all frames. */
export function quantizeFrames(frames,palette,{dither='none',strength=1}={}){
 if(dither!=='blue-noise')return frames.map(f=>({...f,...quantizeIndexed(f.data,f.width,f.height,palette,{mode:dither,amount:strength})}));
 const labs=palette.map(c=>oklab(...c)),tile=blueTile();
 return frames.map(f=>{const data=new Uint8Array(f.data.length),indices=new Int16Array(f.width*f.height).fill(-1);for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
  const i=(y*f.width+x)*4;if(!f.data[i+3])continue;const n=(tile[(y&63)*64+(x&63)]-.5)*48*strength,lab=oklab(f.data[i]+n,f.data[i+1]+n,f.data[i+2]+n);let best=0,d=Infinity;
  for(let k=0;k<labs.length;k++){const e=labDistance(lab,labs[k]);if(e<d){d=e;best=k;}}indices[y*f.width+x]=best;data.set(palette[best],i);data[i+3]=f.data[i+3];
 }return {data,width:f.width,height:f.height,indices};});
}
let cachedTile=null;
function blueTile(){
 if(cachedTile)return cachedTile;
 // Fixed high-pass ranked noise: each placement maximizes distance to prior points in its 8×8
 // neighbourhood. This is an ordered blue-noise-like mask, not a calibrated spectral blue noise.
 const n=64,out=new Float32Array(n*n),used=new Uint8Array(n*n);let seed=0x6e657275;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let rank=0;rank<n*n;rank++){
  let best=-1,score=-Infinity;for(let t=0;t<24;t++){const at=Math.floor(rand()*out.length);if(used[at])continue;const x=at%n,y=(at-x)/n;let s=0;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const a=((y+dy+n)%n)*n+(x+dx+n)%n;if(used[a])s+=1/(1+dx*dx+dy*dy);}const v=-s+rand()*.001;if(v>score){score=v;best=at;}}
  if(best<0)best=used.indexOf(0);used[best]=1;out[best]=(rank+.5)/(n*n);
 }
 return cachedTile=out;
}
