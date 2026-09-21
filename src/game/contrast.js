/** WCAG 2.x contrast: the published formula, nothing added. Pure; no DOM.
 * A ratio is a reference number about two colours — it is not a verdict on a design, and
 * text over artwork or a gradient has as many ratios as it has pixels. */
export function parseColor(value){
 if(Array.isArray(value)){const [r,g,b,a=1]=value;return [r,g,b,a];}
 const s=String(value).trim(),m=/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
 if(!m)throw Error('Colour must be #rgb, #rgba, #rrggbb or #rrggbbaa');
 const hex=m[1],short=hex.length<=4,part=i=>short?parseInt(hex[i]+hex[i],16):parseInt(hex.slice(i*2,i*2+2),16);
 const count=short?hex.length:hex.length/2;
 return [part(0),part(1),part(2),count===4?part(3)/255:1];
}
const channel=v=>{const c=Math.max(0,Math.min(255,v))/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
/** WCAG relative luminance (sRGB). */
export const relativeLuminance=color=>{const [r,g,b]=parseColor(color);return .2126*channel(r)+.7152*channel(g)+.0722*channel(b);};
/** A translucent colour has no contrast of its own; it has the contrast of what it composites
 * to. Simple source-over in sRGB bytes, which is what a browser or engine draws. */
export function flatten(color,backdrop){
 const [r,g,b,a]=parseColor(color),[br,bg,bb]=parseColor(backdrop);
 return [r*a+br*(1-a),g*a+bg*(1-a),b*a+bb*(1-a),1];
}
/** (L1 + 0.05) / (L2 + 0.05), lighter first. Black on white is exactly 21. */
export function contrastRatio(foreground,background){
 const bg=parseColor(background),fg=parseColor(foreground);
 const a=relativeLuminance(fg[3]<1?flatten(fg,bg):fg),b=relativeLuminance(bg);
 const [hi,lo]=a>=b?[a,b]:[b,a];
 return (hi+.05)/(lo+.05);
}
/** WCAG 2.1 thresholds for text. "Large" is 24px, or 18.66px when bold (1.5rem / 14pt bold). */
export function wcag(ratio,{fontSizePx=16,bold=false}={}){
 const large=fontSizePx>=24||bold&&fontSizePx>=18.66;
 return {large,aa:ratio>=(large?3:4.5),aaa:ratio>=(large?4.5:7),ui:ratio>=3,
  needed:{aa:large?3:4.5,aaa:large?4.5:7}};
}
export const round2=n=>Math.round(n*100)/100;
