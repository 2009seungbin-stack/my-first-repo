/** Palette of a sprite and several colour swaps in one pass. Pure: RGBA in, RGBA out.
 *
 * `imagePalette` lists the exact colours the art uses (opaque pixels only), most used first —
 * pixel art has a small palette, and it is the thing a person picks from.
 * `swapColors` applies every rule to the ORIGINAL colour of each pixel, first matching rule
 * wins, so red→blue and blue→green in the same run swap red to blue and blue to green instead of
 * chaining red→blue→green. Alpha is never touched. `shading` keeps the pixel's offset from the
 * picked colour, so a ramp of reds becomes the same ramp of blues. */
const hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
export const parseHex=s=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(s).trim());if(!m)throw Error(`Not a #RRGGBB colour: ${s}`);const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255];};
/** @returns {colors:[{color,hex,count,share}], distinct, total, more} */
export function imagePalette({data,width,height},{max=256,threshold=0}={}){
 if(!data||data.length!==width*height*4)throw Error('Needs {data,width,height} RGBA pixels');
 const counts=new Map();let total=0;
 for(let i=0;i<data.length;i+=4){if(data[i+3]<=threshold)continue;const k=data[i]<<16|data[i+1]<<8|data[i+2];counts.set(k,(counts.get(k)||0)+1);total++;}
 const all=[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
 const colors=all.slice(0,max).map(([k,count])=>{const color=[k>>16&255,k>>8&255,k&255];return {color,hex:hex(color),count,share:total?count/total:0};});
 return {colors,distinct:all.length,total,more:Math.max(0,all.length-max)};
}
/** @param rules [{from:[r,g,b]|'#hex', to:[r,g,b]|'#hex', tolerance=0 (RGB distance), shading=false}]
 * @returns {data, width, height, changed, perRule:[count]} */
export function swapColors({data,width,height},rules){
 if(!data||data.length!==width*height*4)throw Error('Needs {data,width,height} RGBA pixels');
 const list=(rules||[]).map(r=>{const from=Array.isArray(r.from)?r.from:parseHex(r.from),to=Array.isArray(r.to)?r.to:parseHex(r.to);
  const tolerance=Math.max(0,Math.min(441,Number(r.tolerance)||0));return {from,to,limit:tolerance*tolerance,shading:!!r.shading};});
 const out=new Uint8ClampedArray(data),perRule=list.map(()=>0);let changed=0;
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;
  for(let k=0;k<list.length;k++){
   const r=list[k],dr=data[i]-r.from[0],dg=data[i+1]-r.from[1],db=data[i+2]-r.from[2];
   if(dr*dr+dg*dg+db*db>r.limit)continue;
   if(r.shading){out[i]=r.to[0]+dr;out[i+1]=r.to[1]+dg;out[i+2]=r.to[2]+db;}else{out[i]=r.to[0];out[i+1]=r.to[1];out[i+2]=r.to[2];}
   if(out[i]!==data[i]||out[i+1]!==data[i+1]||out[i+2]!==data[i+2]){changed++;perRule[k]++;}
   break;
  }
 }
 return {data:out,width,height,changed,perRule};
}
