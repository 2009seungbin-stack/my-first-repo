/** Aseprite's layer blend modes, ported line by line from Aseprite's doc library
 * (src/doc/blend_funcs.cpp and pixman's MUL_UN8/DIV_UN8; both MIT licensed, Copyright (c)
 * 2001-2025 Igara Studio S.A. and David Capello). The integer rounding, the truncating
 * divisions and even the known quirks (Aseprite's set_sat, grayscale Addition using the
 * Exclusion blender) are kept, because the goal is to reproduce Aseprite's exported pixels, not
 * the W3C compositing spec. Aseprite 1.3 renders with the "new blend" method (the `_n`
 * variants), which is what these functions implement.
 *
 * blendRGBA(dst,i,sr,sg,sb,sa,opacity,mode)   composites one source pixel onto dst[i..i+3]
 * blendGray(dst,i,sv,sa,opacity,mode)         same for a grayscale (value, alpha) pair
 * mul8(a,b)                                   Aseprite/pixman MUL_UN8 */
export const BLEND_MODES=Object.freeze(['normal','multiply','screen','overlay','darken','lighten','color_dodge','color_burn','hard_light','soft_light','difference','exclusion','hue','saturation','color','luminosity','addition','subtract','divide']);
export const mul8=(a,b)=>{const t=a*b+128;return ((t>>8)+t)>>8;};
const div8=(a,b)=>((a*255+(b>>1))/b)|0;

// Channel blend functions (b = backdrop, s = source), 0..255 integers.
const multiply=(b,s)=>mul8(b,s);
const screen=(b,s)=>b+s-mul8(b,s);
const hardLight=(b,s)=>s<128?multiply(b,s<<1):screen(b,(s<<1)-255);
const CH=[
 null,
 multiply,
 screen,
 (b,s)=>hardLight(s,b),                      // overlay
 (b,s)=>b<s?b:s,                             // darken
 (b,s)=>b>s?b:s,                             // lighten
 (b,s)=>{if(b===0)return 0;s=255-s;return b>=s?255:div8(b,s);},            // color dodge
 (b,s)=>{if(b===255)return 255;b=255-b;return b>=s?0:255-div8(b,s);},      // color burn
 hardLight,
 (b,s)=>{                                    // soft light (double precision in Aseprite)
  const B=b/255,S=s/255;const d=B<=0.25?((16*B-12)*B+4)*B:Math.sqrt(B);
  const r=S<=0.5?B-(1-2*S)*B*(1-B):B+(2*S-1)*(d-B);return Math.trunc(r*255+0.5);
 },
 (b,s)=>Math.abs(b-s),                       // difference
 (b,s)=>b+s-2*mul8(b,s),                     // exclusion
 null,null,null,null,                        // HSL modes work on the whole colour
 (b,s)=>Math.min(b+s,255),                   // addition
 (b,s)=>Math.max(b-s,0),                     // subtract
 (b,s)=>{if(b===0)return 0;if(b>=s)return 255;return div8(b,s);},          // divide
];

// HSL helpers (doubles, as in Aseprite).
const lum=(r,g,b)=>0.3*r+0.59*g+0.11*b;
const sat=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b);
const H=new Float64Array(3);
function clipColor(){
 let [r,g,b]=H;const l=lum(r,g,b),n=Math.min(r,g,b),x=Math.max(r,g,b);
 if(n<0){r=l+(((r-l)*l)/(l-n));g=l+(((g-l)*l)/(l-n));b=l+(((b-l)*l)/(l-n));}
 if(x>1){r=l+(((r-l)*(1-l))/(x-l));g=l+(((g-l)*(1-l))/(x-l));b=l+(((b-l)*(1-l))/(x-l));}
 H[0]=r;H[1]=g;H[2]=b;
}
function setLum(l){const d=l-lum(H[0],H[1],H[2]);H[0]+=d;H[1]+=d;H[2]+=d;clipColor();}
function setSat(s){
 const mn=Math.min(H[0],H[1],H[2]),mx=Math.max(H[0],H[1],H[2]),range=mx-mn;
 if(range>0){H[0]=((H[0]-mn)*s)/range;H[1]=((H[1]-mn)*s)/range;H[2]=((H[2]-mn)*s)/range;}else H[0]=H[1]=H[2]=0;
}
/** Writes the blended (pre-alpha) colour of an HSL mode into T[0..2]. */
function hsl(mode,br,bg,bb,sr,sg,sb){
 const Br=br/255,Bg=bg/255,Bb=bb/255,Sr=sr/255,Sg=sg/255,Sb=sb/255;
 if(mode===12){H[0]=Sr;H[1]=Sg;H[2]=Sb;setSat(sat(Br,Bg,Bb));setLum(lum(Br,Bg,Bb));}          // hue
 else if(mode===13){H[0]=Br;H[1]=Bg;H[2]=Bb;setSat(sat(Sr,Sg,Sb));setLum(lum(Br,Bg,Bb));}     // saturation
 else if(mode===14){H[0]=Sr;H[1]=Sg;H[2]=Sb;setLum(lum(Br,Bg,Bb));}                           // color
 else {H[0]=Br;H[1]=Bg;H[2]=Bb;setLum(lum(Sr,Sg,Sb));}                                         // luminosity
 // int(255.0*x) truncates toward zero; rgba() packs without masking, clamp only guards NaN.
 T[0]=Math.trunc(255*H[0])|0;T[1]=Math.trunc(255*H[1])|0;T[2]=Math.trunc(255*H[2])|0;
}
const T=new Int32Array(4),N=new Int32Array(4),M=new Int32Array(4);

/** rgba_blender_normal → o[0..3] */
function normal(o,Br,Bg,Bb,Ba,Sr,Sg,Sb,Sa,op){
 if(!Ba){o[0]=Sr;o[1]=Sg;o[2]=Sb;o[3]=mul8(Sa,op);return;}
 if(!Sa){o[0]=Br;o[1]=Bg;o[2]=Bb;o[3]=Ba;return;}
 Sa=mul8(Sa,op);const Ra=Sa+Ba-mul8(Ba,Sa);
 o[0]=Br+(((Sr-Br)*Sa/Ra)|0);o[1]=Bg+(((Sg-Bg)*Sa/Ra)|0);o[2]=Bb+(((Sb-Bb)*Sa/Ra)|0);o[3]=Ra;
}
/** rgba_blender_merge → o[0..3] */
function merge(o,Br,Bg,Bb,Ba,Sr,Sg,Sb,Sa,op){
 let r,g,b;
 if(!Ba){r=Sr;g=Sg;b=Sb;}else if(!Sa){r=Br;g=Bg;b=Bb;}
 else{r=Br+mul8(Sr-Br,op);g=Bg+mul8(Sg-Bg,op);b=Bb+mul8(Sb-Bb,op);}
 const a=Ba+mul8(Sa-Ba,op);
 if(!a){r=g=b=0;}
 o[0]=r;o[1]=g;o[2]=b;o[3]=a;
}

/** Composites source (sr,sg,sb,sa) with layer opacity onto dst[i..i+3] using Aseprite's blend
 * mode `mode` (0…18). Callers skip fully zero source pixels (Aseprite's mask colour). */
export function blendRGBA(dst,i,sr,sg,sb,sa,op,mode){
 const Br=dst[i],Bg=dst[i+1],Bb=dst[i+2],Ba=dst[i+3];
 if(mode===0||!Ba||mode>18||mode<0){normal(N,Br,Bg,Bb,Ba,sr,sg,sb,sa,op);dst[i]=N[0];dst[i+1]=N[1];dst[i+2]=N[2];dst[i+3]=N[3];return;}
 // blended colour (the "blend" pixel keeps the source alpha)
 if(mode>=12&&mode<=15)hsl(mode,Br,Bg,Bb,sr,sg,sb);
 else{const f=CH[mode];T[0]=f(Br,sr);T[1]=f(Bg,sg);T[2]=f(Bb,sb);}
 // blend = normal(backdrop, blended-with-src-alpha, opacity)
 normal(M,Br,Bg,Bb,Ba,T[0],T[1],T[2],sa,op);const b0=M[0],b1=M[1],b2=M[2],b3=M[3];
 normal(N,Br,Bg,Bb,Ba,sr,sg,sb,sa,op);
 merge(N,N[0],N[1],N[2],N[3],b0,b1,b2,b3,Ba);
 const total=mul8(sa,op),comp=mul8(Ba,total);
 merge(N,N[0],N[1],N[2],N[3],b0,b1,b2,b3,comp);
 dst[i]=N[0];dst[i+1]=N[1];dst[i+2]=N[2];dst[i+3]=N[3];
}

// Grayscale ---------------------------------------------------------------------------------
function gNormal(o,Bv,Ba,Sv,Sa,op){
 if(!Ba){o[0]=Sv;o[1]=mul8(Sa,op);return;}
 if(!Sa){o[0]=Bv;o[1]=Ba;return;}
 Sa=mul8(Sa,op);const Ra=Ba+Sa-mul8(Ba,Sa);o[0]=Bv+(((Sv-Bv)*Sa/Ra)|0);o[1]=Ra;
}
function gMerge(o,Bv,Ba,Sv,Sa,op){
 let v;if(!Ba)v=Sv;else if(!Sa)v=Bv;else v=Bv+mul8(Sv-Bv,op);
 const a=Ba+mul8(Sa-Ba,op);o[0]=a?v:0;o[1]=a;
}
/** Grayscale mode map of get_graya_blender(): HSL modes fall back to normal and, with the new
 * blend method, Addition uses the Exclusion blender (an Aseprite quirk kept on purpose). */
const GRAY_MODE=[0,1,2,3,4,5,6,7,8,9,10,11,0,0,0,0,11,17,18];
export function blendGray(dst,i,sv,sa,op,mode){
 const Bv=dst[i],Ba=dst[i+1];
 mode=mode>=0&&mode<=18?GRAY_MODE[mode]:0;
 if(mode===0||!Ba){gNormal(N,Bv,Ba,sv,sa,op);dst[i]=N[0];dst[i+1]=N[1];return;}
 const v=CH[mode](Bv,sv);
 gNormal(M,Bv,Ba,v,sa,op);const b0=M[0],b1=M[1];
 gNormal(N,Bv,Ba,sv,sa,op);
 gMerge(N,N[0],N[1],b0,b1,Ba);
 const total=mul8(sa,op),comp=mul8(Ba,total);
 gMerge(N,N[0],N[1],b0,b1,comp);
 dst[i]=N[0];dst[i+1]=N[1];
}
