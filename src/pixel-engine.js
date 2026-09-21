/** Oklab palette clustering, alpha-preserving quantization and bounded error rows. */
const linear=Array.from({length:256},(_,v)=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4);
export function oklab(r,g,b){
 r=linear[Math.max(0,Math.min(255,Math.round(r)))];g=linear[Math.max(0,Math.min(255,Math.round(g)))];b=linear[Math.max(0,Math.min(255,Math.round(b)))];
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
export function parsePalette(text){
 if(Array.isArray(text)){if(text.length>256||text.some(c=>!Array.isArray(c)||c.length!==3||c.some(v=>!Number.isInteger(v)||v<0||v>255)))throw Error('Invalid custom palette');return text.map(c=>[...c]);}
 if(!text?.trim())return [];const colors=[];
 for(const line of text.split(/\r?\n/)){
  const s=line.trim();if(!s)continue;const hex=s.match(/^#?([a-f\d]{6})$/i),gpl=s.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/);
  if(hex)colors.push([0,2,4].map(i=>parseInt(hex[1].slice(i,i+2),16)));
  else if(gpl&&gpl.slice(1).every(v=>+v<=255))colors.push(gpl.slice(1).map(Number));
  else if(!/^(#|GIMP Palette|Name:|Columns:)/.test(s))throw Error('Use one #RRGGBB color per line, or a GIMP palette.');
 }
 if(!colors.length||colors.length>256)throw Error('A palette needs 1–256 colors');return [...new Map(colors.map(c=>[c.join(','),c])).values()];
}
export function perceptualPalette(data,count){
 const histogram=new Map();for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;if(!a)continue;const key=(data[i]>>3)<<10|(data[i+1]>>3)<<5|(data[i+2]>>3);let c=histogram.get(key);if(!c)histogram.set(key,c=[0,0,0,0]);for(let k=0;k<3;k++)c[k]+=data[i+k]*a;c[3]+=a;}
 const points=[...histogram.values()].map(p=>{const rgb=p.slice(0,3).map(v=>v/p[3]);return {rgb,lab:oklab(...rgb),weight:p[3]};});
 if(!points.length)return [[0,0,0]];
 const boxes=[points];while(boxes.length<count){
  let best=-1,bestScore=0,axis=0;
  boxes.forEach((box,index)=>{if(box.length<2)return;const ranges=[0,1,2].map(k=>{let lo=Infinity,hi=-Infinity;for(const p of box){lo=Math.min(lo,p.lab[k]);hi=Math.max(hi,p.lab[k]);}return hi-lo;});const range=Math.max(...ranges),score=range*box.reduce((n,p)=>n+p.weight,0);if(score>bestScore){bestScore=score;best=index;axis=ranges.indexOf(range);}});
  if(best<0)break;const box=boxes[best].sort((a,b)=>a.lab[axis]-b.lab[axis]),half=box.reduce((n,p)=>n+p.weight,0)/2;let mass=0,at=1;for(;at<box.length;at++){mass+=box[at-1].weight;if(mass>=half)break;}boxes.splice(best,1,box.slice(0,at),box.slice(at));
 }
 let palette=boxes.map(box=>{const mass=box.reduce((n,p)=>n+p.weight,0);return [0,1,2].map(k=>Math.round(box.reduce((n,p)=>n+p.rgb[k]*p.weight,0)/mass));});
 // Lloyd refinement in perceptual space; RGB centroids keep the palette in gamut.
 for(let iteration=0;iteration<4;iteration++){
  const labs=palette.map(c=>oklab(...c)),sums=palette.map(()=>[0,0,0,0]);
  for(const p of points){let best=0,d=Infinity;for(let i=0;i<labs.length;i++){const e=distance(p.lab,labs[i]);if(e<d){d=e;best=i;}}const s=sums[best];for(let k=0;k<3;k++)s[k]+=p.rgb[k]*p.weight;s[3]+=p.weight;}
  palette=palette.map((c,i)=>sums[i][3]?sums[i].slice(0,3).map(v=>Math.round(v/sums[i][3])):c);
 }
 return palette;
}
export function quantizePerceptual(data,w,h,count=16,amount=0,{palette:custom,ditherMode='floyd-steinberg'}={}){
 const locked=parsePalette(custom||[]);if(!count&&!locked.length)return new Uint8ClampedArray(data);
 const palette=locked.length?locked:perceptualPalette(data,count),labs=palette.map(c=>oklab(...c)),out=new Uint8ClampedArray(data.length);
 const diffusion=amount>0&&ditherMode!=='ordered';let current=diffusion?new Float32Array((w+2)*3):null,next=diffusion?new Float32Array((w+2)*3):null;
 const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
 for(let y=0;y<h;y++){
  const reverse=diffusion&&y%2===1,step=reverse?-1:1;
  for(let t=0;t<w;t++){
   const x=reverse?w-1-t:t,i=(y*w+x)*4;if(!data[i+3])continue;
   const ordered=amount>0&&ditherMode==='ordered'?(bayer[(y%4)*4+x%4]/16-.46875)*48*amount:0;
   const color=[0,1,2].map(c=>data[i+c]+ordered+(current?.[(x+1)*3+c]||0)),lab=oklab(...color);let best=0,d=Infinity;
   for(let k=0;k<palette.length;k++){const e=distance(lab,labs[k]);if(e<d){d=e;best=k;}}
   out.set(palette[best],i);out[i+3]=data[i+3];
   if(diffusion){
    for(const [dx,dy,weight] of [[step,0,7/16],[-step,1,3/16],[0,1,5/16],[step,1,1/16]]){
     const nx=x+dx;if(nx<0||nx>=w||y+dy>=h||!data[((y+dy)*w+nx)*4+3])continue;
     const row=dy?next:current;for(let c=0;c<3;c++)row[(nx+1)*3+c]+=(color[c]-palette[best][c])*weight*amount;
    }
   }
  }
  if(diffusion){[current,next]=[next,current];next.fill(0);}
 }
 return out;
}
