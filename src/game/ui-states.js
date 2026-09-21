import {addOutline} from '../core.js';
/** Button state variants: parametric pixel operations, one per control the user sees.
 * Pure (RGBA in, RGBA out) so the preview and the exported PNG run the same code.
 * Nothing here guesses anything: a variant is exactly the numbers in its op list. */
export const STATES=Object.freeze(['normal','hover','pressed','disabled','focus']);
/** Starting points, not magic: every value is editable in the workspace. */
export const DEFAULT_OPS=Object.freeze({
 normal:{},
 hover:{brightness:.1,saturation:.08},
 pressed:{brightness:-.1,offsetY:1},
 disabled:{saturation:-1,alpha:.5},
 focus:{outline:2,outlineColor:'#3182f6'}
});
const num=(v,lo,hi,fallback=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):fallback;
const check=(data,w,h)=>{if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||data.length!==w*h*4)throw Error('Invalid RGBA data');};
export const rgb=value=>{const m=/^#?([0-9a-f]{6})$/i.exec(String(value));if(!m)throw Error('Colour must be #rrggbb');const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255];};
const LUMA=[.2126,.7152,.0722];
/** Brightness (additive), contrast (around mid grey), saturation (towards/away from luma) and a
 * flat colour overlay, in that order. Alpha is never changed here; transparent pixels stay out. */
export function adjust(data,w,h,{brightness=0,contrast=0,saturation=0,overlayColor=null,overlayAlpha=0}={}){
 check(data,w,h);
 const br=num(brightness,-1,1)*255,co=num(contrast,-1,1),sa=num(saturation,-1,1),oa=num(overlayAlpha,0,1);
 const f=co>=0?1/Math.max(1e-6,1-co):1+co,over=overlayColor&&oa>0?rgb(overlayColor):null;
 const out=new Uint8ClampedArray(data);
 for(let i=0;i<out.length;i+=4){
  if(!data[i+3])continue;
  let c=[data[i],data[i+1],data[i+2]].map(v=>(v+br-128)*f+128);
  const l=LUMA[0]*c[0]+LUMA[1]*c[1]+LUMA[2]*c[2];
  c=c.map(v=>l+(v-l)*(1+sa));
  if(over)c=c.map((v,k)=>v*(1-oa)+over[k]*oa);
  out[i]=c[0];out[i+1]=c[1];out[i+2]=c[2];
 }
 return out;
}
/** Shifts the pixels inside the same canvas; what moves out is dropped, what moves in is clear. */
export function shift(data,w,h,dx=0,dy=0){
 check(data,w,h);const out=new Uint8ClampedArray(data.length);
 const x0=Math.trunc(num(dx,-w,w)),y0=Math.trunc(num(dy,-h,h));
 for(let y=0;y<h;y++){
  const sy=y-y0;if(sy<0||sy>=h)continue;
  for(let x=0;x<w;x++){
   const sx=x-x0;if(sx<0||sx>=w)continue;
   out.set(data.subarray((sy*w+sx)*4,(sy*w+sx)*4+4),(y*w+x)*4);
  }
 }
 return out;
}
export function fadeAlpha(data,w,h,factor=1){
 check(data,w,h);const out=new Uint8ClampedArray(data),a=num(factor,0,1,1);
 for(let i=3;i<out.length;i+=4)out[i]=Math.round(data[i]*a);
 return out;
}
/** Grows the canvas by `pad` on every side; the extra pixels are transparent. An outline needs
 * that room, otherwise it would be drawn over the artwork it is supposed to surround. */
export function grow(data,w,h,pad=0){
 check(data,w,h);const p=Math.trunc(num(pad,0,512)),W=w+p*2,H=h+p*2,out=new Uint8ClampedArray(W*H*4);
 for(let y=0;y<h;y++)out.set(data.subarray(y*w*4,(y+1)*w*4),((y+p)*W+p)*4);
 return {data:out,width:W,height:H,pad:p};
}
/** One state variant. Returns its own canvas size because a focus ring is larger than the base. */
export function variant(data,w,h,op={}){
 check(data,w,h);
 const o={...op},applied=[];
 let pixels=data,width=w,height=h,pad=0;
 if(o.outline>0){const g=grow(pixels,width,height,Math.ceil(num(o.outline,0,32)));pixels=g.data;width=g.width;height=g.height;pad=g.pad;applied.push(`grow ${pad}px`);}
 if(o.brightness||o.contrast||o.saturation||(o.overlayColor&&o.overlayAlpha)){
  pixels=adjust(pixels,width,height,o);
  applied.push(['brightness','contrast','saturation'].filter(k=>o[k]).map(k=>`${k} ${o[k]}`).concat(o.overlayAlpha?[`overlay ${o.overlayColor} ${o.overlayAlpha}`]:[]).join(', '));
 }
 if(o.offsetX||o.offsetY){pixels=shift(pixels,width,height,o.offsetX||0,o.offsetY||0);applied.push(`offset ${o.offsetX||0},${o.offsetY||0}px`);}
 if(o.outline>0){pixels=addOutline(pixels,width,height,Math.round(num(o.outline,1,32,1)),rgb(o.outlineColor||'#3182f6'));applied.push(`outline ${o.outline}px ${o.outlineColor||'#3182f6'}`);}
 if(o.alpha!=null&&o.alpha!==1){pixels=fadeAlpha(pixels,width,height,o.alpha);applied.push(`alpha ${o.alpha}`);}
 return {data:pixels,width,height,pad,applied:applied.filter(Boolean)};
}
