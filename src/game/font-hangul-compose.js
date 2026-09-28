import {hangulParts} from './font-hangul.js';

// Vowels whose strokes sit mainly below, to the right, or in both regions.
const HORIZONTAL=new Set([8,12,13,17,18]);
const MIXED=new Set([9,10,11,14,15,16,19]);
export function vowelLayout(index){
 if(!Number.isInteger(index)||index<0||index>20)throw Error('Invalid Hangul vowel index');
 return HORIZONTAL.has(index)?'horizontal':MIXED.has(index)?'mixed':'vertical';
}
const mask=(value,length,label)=>{
 if(!value||value.length!==length||Array.from(value).some(v=>v!==0&&v!==1))throw Error(`Invalid ${label} component mask`);
 return value;
};

/** Compose full-cell, position-specific hand-drawn jamo masks.
 * Template slots: leading[19][`${layout}-${open|final}`],
 * vowel[21][open|final], trailing[28][layout] (index 0 is unused).
 * A template artist must draw and review all variants; arithmetic alone
 * cannot establish readable Hangul shapes. This is not wired to the UI. */
export function composeHangulMask(codepoint,templates,{override=null}={}){
 const {leading,vowel,trailing}=hangulParts(codepoint);
 const width=templates?.width,height=templates?.height;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>128||height>128)throw Error('Invalid Hangul template dimensions');
 const length=width*height,layout=vowelLayout(vowel),occupancy=trailing?'final':'open';
 if(override){return {codepoint,width,height,pixels:Array.from(mask(override,length,'override')),layout,overridden:true,collisions:0};}
 const parts=[
  mask(templates.leading?.[leading]?.[`${layout}-${occupancy}`],length,`leading ${leading} ${layout}-${occupancy}`),
  mask(templates.vowel?.[vowel]?.[occupancy],length,`vowel ${vowel} ${occupancy}`)
 ];
 if(trailing)parts.push(mask(templates.trailing?.[trailing]?.[layout],length,`trailing ${trailing} ${layout}`));
 const pixels=Array(length).fill(0);let collisions=0;
 for(const part of parts)for(let i=0;i<length;i++)if(part[i]){if(pixels[i])collisions++;pixels[i]=1;}
 return {codepoint,width,height,pixels,layout,overridden:false,collisions};
}
