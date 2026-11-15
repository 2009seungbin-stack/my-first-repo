/** Peak normalisation for exported files. One gain is applied to both channels so the largest
 * sample lands on targetDb (dBFS); the stereo balance and the waveform shape are unchanged.
 */
export const NORMALIZE_PEAK_DB=-1;
export function normalizePeak(left,right,targetDb=NORMALIZE_PEAK_DB){let peak=0;for(let i=0;i<left.length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
 if(!(peak>1e-6)||!Number.isFinite(peak))return {left,right,gain:1,gainDb:0,peak:Number.isFinite(peak)?peak:0};
 const gain=10**(targetDb/20)/peak,l=new Float32Array(left.length),r=new Float32Array(right.length);for(let i=0;i<left.length;i++){l[i]=left[i]*gain;r[i]=right[i]*gain;}
 return {left:l,right:r,gain,gainDb:20*Math.log10(gain),peak};}
