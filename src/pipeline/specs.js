/** Checks a finished export against the official spec of its fit preset (platform/recipe.js FIT_SPECS),
 * reading the files' own headers — what the platform's upload form would see. */
import {FIT_SPECS} from './recipe.js';
import {probe} from './encode.js';

const LINE_COUNTS=[8,16,24,32,40];
/**
 * @param {{name:string,bytes:Uint8Array}[]} files @param {string|null} preset @param {{zip?:Uint8Array|null}} [o]
 * @returns {{ok:boolean,checked:number,problems:{file:string,ko:string,en:string}[],spec:string|null}}
 */
export function checkSpec(files,preset,o={}){
 const spec=preset?FIT_SPECS[preset]:null;
 if(!spec)return {ok:true,checked:0,problems:[],spec:null};
 const problems=[],add=(file,ko,en)=>problems.push({file,ko,en});
 const stickers=files.filter(f=>!(preset==='line.sticker'&&(f.name==='main.png'||f.name==='tab.png')));
 for(const f of stickers){
  const p=probe(f.bytes),anim=p.frames>1,lim=anim&&spec.anim?spec.anim:spec;
  if(spec.side==='long'){
   const L=Math.max(spec.w,spec.h);if(Math.max(p.w,p.h)!==L||Math.min(p.w,p.h)>L)add(f.name,`한 변이 정확히 ${L}px이어야 해요 (지금 ${p.w}×${p.h})`,`One side must be exactly ${L}px (now ${p.w}×${p.h})`);
  }else if(p.w!==lim.w||p.h!==lim.h)add(f.name,`크기가 ${lim.w}×${lim.h}이 아니에요 (지금 ${p.w}×${p.h})`,`Size is not ${lim.w}×${lim.h} (now ${p.w}×${p.h})`);
  if(spec.even&&(p.w%2||p.h%2))add(f.name,'가로·세로가 짝수여야 해요','Width and height must be even');
  if(f.bytes.length>lim.maxBytes)add(f.name,`용량이 ${Math.round(lim.maxBytes/1000)}KB를 넘어요 (${Math.round(f.bytes.length/1000)}KB)`,`Larger than ${Math.round(lim.maxBytes/1000)} KB (${Math.round(f.bytes.length/1000)} KB)`);
  if(anim&&spec.anim&&(p.frames<spec.anim.minFrames||p.frames>spec.anim.maxFrames))add(f.name,`프레임 수는 ${spec.anim.minFrames}–${spec.anim.maxFrames}장이어야 해요 (지금 ${p.frames})`,`Frames must be ${spec.anim.minFrames}–${spec.anim.maxFrames} (now ${p.frames})`);
  if(anim&&!spec.anim)add(f.name,'이 규격은 움직이는 파일을 받지 않아요','This spec takes still images only');
  const want=anim&&spec.anim?spec.anim.format:spec.format;if(!(p.type===want||(want==='png'&&p.type==='png')))add(f.name,`${want.toUpperCase()} 파일이어야 해요 (지금 ${p.type.toUpperCase()})`,`Must be ${want.toUpperCase()} (now ${p.type.toUpperCase()})`);
 }
 if(preset==='line.sticker'){
  if(!LINE_COUNTS.includes(stickers.length))add('*',`LINE 스탬프는 8·16·24·32·40개 묶음이에요 (지금 ${stickers.length}개)`,`LINE sets have 8, 16, 24, 32 or 40 stickers (now ${stickers.length})`);
  if(o.zip&&o.zip.length>60_000_000)add('zip','ZIP이 60MB를 넘어요','The ZIP is larger than 60 MB');
 }
 return {ok:!problems.length,checked:stickers.length,problems,spec:preset};
}
