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
 const pixels=Array(length).fill(0),overlaps=new Set();
 for(const part of parts)for(let i=0;i<length;i++)if(part[i]){if(pixels[i])overlaps.add(i);pixels[i]=1;}
 return {codepoint,width,height,pixels,layout,overridden:false,collisions:overlaps.size};
}

export const HANGUL_PARTS=Object.freeze(['leading','vowel','trailing']);
export function hangulTemplateSlot(codepoint,part){
 if(!HANGUL_PARTS.includes(part))throw Error('Invalid Hangul component');
 const indices=hangulParts(codepoint),layout=vowelLayout(indices.vowel),occupancy=indices.trailing?'final':'open';
 if(part==='trailing'&&!indices.trailing)throw Error('This syllable has no trailing component');
 return {part,index:indices[part],key:part==='leading'?`${layout}-${occupancy}`:part==='vowel'?occupancy:layout};
}
export function blankHangulTemplates(width=16,height=16){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>128||height>128)throw Error('Invalid Hangul template dimensions');
 return {width,height,leading:{},vowel:{},trailing:{}};
}
export function validateHangulTemplates(templates){
 const {width,height}=templates||{};blankHangulTemplates(width,height);
 const limits={leading:19,vowel:21,trailing:28},keys={
  leading:['vertical-open','vertical-final','horizontal-open','horizontal-final','mixed-open','mixed-final'],
  vowel:['open','final'],trailing:['vertical','horizontal','mixed']};
 for(const part of HANGUL_PARTS){
  const group=templates[part];if(!group||typeof group!=='object'||Array.isArray(group))throw Error('Invalid Hangul template group');
  for(const [rawIndex,slots] of Object.entries(group)){
   const index=Number(rawIndex);if(!Number.isInteger(index)||String(index)!==rawIndex||index<0||index>=limits[part]||(part==='trailing'&&index===0))throw Error('Invalid Hangul template index');
   if(!slots||typeof slots!=='object'||Array.isArray(slots))throw Error('Invalid Hangul template slots');
   for(const [key,value] of Object.entries(slots)){
    if(!keys[part].includes(key))throw Error('Invalid Hangul template variant');
    mask(value,width*height,'Hangul template');
   }
  }
 }
 return templates;
}
export function hangulTemplateMask(templates,codepoint,part,{create=false}={}){
 validateHangulTemplates(templates);
 const {index,key}=hangulTemplateSlot(codepoint,part),group=templates[part];
 if(create&&!group[index])group[index]={};
 if(create&&!group[index][key])group[index][key]=Array(templates.width*templates.height).fill(0);
 return group[index]?.[key]||null;
}
export function paintHangulTemplate(templates,codepoint,part,x,y,ink){
 const pixels=hangulTemplateMask(templates,codepoint,part,{create:true});
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=templates.width||y>=templates.height)throw Error('Hangul template pixel outside cell');
 pixels[y*templates.width+x]=ink?1:0;return templates;
}
export function missingHangulTemplates(templates,codepoint){
 const parts=hangulParts(codepoint),names=parts.trailing?HANGUL_PARTS:HANGUL_PARTS.slice(0,2);
 return names.filter(part=>!hangulTemplateMask(templates,codepoint,part)?.some(Boolean));
}
