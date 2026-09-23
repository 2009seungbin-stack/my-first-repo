/** Hue-shifted colour ramps for pixel art. Pure.
 *
 * The rule pixel artists use (Slynyrd's "Pixelblog: hue shifting", Lospec's ramp tutorials): a
 * ramp gets darker AND cooler towards the shadows and lighter AND warmer towards the highlights,
 * and loses chroma at both ends. Everything is done in OkLCh so equal lightness steps look equal.
 * The base colour is kept EXACTLY in the ramp (at `position`), so a ramp made from a palette
 * colour stays connected to that colour. These are starting points to adjust, not art direction. */
import {okLCh,fromOkLCh} from '../../game/palette.js';
const WARM=85,COOL=265;// OkLCh hues of yellow-orange light and blue-violet shade
const toward=(h,target,amount)=>{let d=((target-h+540)%360)-180;const step=Math.sign(d)*Math.min(Math.abs(d),Math.abs(amount));return (h+step+360)%360;};
/** @param base [r,g,b]  @param o {steps (2…32), shift (° of hue at each end), darkest, lightest (OkLCh L 0…1),
 *   chroma (0…2 multiplier at the base), fade (0…1 chroma lost at the ends), position (index of the base; default middle)}
 * @returns {colors:[[r,g,b,255]], position} */
export function hueShiftRamp(base,{steps=5,shift=24,darkest=.18,lightest=.94,chroma=1,fade=.45,position=null}={}){
 steps=Math.max(2,Math.min(32,Math.round(steps)));
 const [L0,C0,H0]=okLCh(base),k=position==null?Math.floor((steps-1)/2):Math.max(0,Math.min(steps-1,Math.round(position)));
 const lo=Math.min(darkest,L0-.02),hi=Math.max(lightest,L0+.02),out=[];
 for(let i=0;i<steps;i++){
  if(i===k){out.push([base[0],base[1],base[2],255]);continue;}
  const t=i<k?(i-k)/Math.max(1,k):(i-k)/Math.max(1,steps-1-k);// −1 … 0 … +1
  const L=i<k?L0+(L0-lo)*t:L0+(hi-L0)*t,C=Math.max(0,C0*chroma*(1-fade*t*t)),H=C0<.01?H0:toward(H0,t<0?COOL:WARM,shift*Math.abs(t));
  out.push([...fromOkLCh([Math.max(0,Math.min(1,L)),C,H]),255]);
 }
 return {colors:out,position:k};
}
/** Ramp between two colours (inclusive) with hue interpolated the short way round in OkLCh. */
export function blendRamp(a,b,steps=5){
 steps=Math.max(2,Math.min(32,Math.round(steps)));
 const A=okLCh(a),B=okLCh(b),dh=((B[2]-A[2]+540)%360)-180,out=[];
 for(let i=0;i<steps;i++){const t=i/(steps-1);if(i===0){out.push([a[0],a[1],a[2],255]);continue;}if(i===steps-1){out.push([b[0],b[1],b[2],255]);continue;}
  out.push([...fromOkLCh([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,(A[2]+dh*t+360)%360]),255]);}
 return out;
}
/** Is this list ordered dark → light (what shading ink expects)? */
export const isRamp=colors=>colors.every((c,i)=>!i||okLCh(c)[0]>=okLCh(colors[i-1])[0]-1e-6);
