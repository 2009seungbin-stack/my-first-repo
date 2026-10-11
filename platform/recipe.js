// @ts-check
/** TEMPORARY STAND-IN written by the COMMUNITY agent from AI-COMMUNITY-CONTRACT.md §4 so the community code
 * and its tests run before MAKER pushes the real platform/recipe.js on origin/nerulio/aic-make. The real file
 * replaces this one verbatim (git checkout origin/nerulio/aic-make -- platform/recipe.js); nothing here is
 * meant to survive the merge. Pure ES module, no DOM.
 *
 * Recipe JSON: {schema, title?, source:{generator,prompt?,ai:true}, input:{expect:'single'|'sheet'},
 * steps:[{op,v,p:{…}}], result:{w,h,frames,count}}. */

export const RECIPE_SCHEMA='nerulio.recipe/1';
export const OPS=Object.freeze(['bg.remove','sheet.split','crop','upscale','fit','pixelize','palette','pixel.snap','sticker.border','caption','motion','export']);
export const GENERATORS=Object.freeze(['chatgpt','gemini','midjourney','sd','novelai','other']);
const MAX_BYTES=16*1024,MAX_STEPS=20;

const NAMES=/** @type {Record<string,{ko:string,en:string}>} */({
 'bg.remove':{ko:'배경 지우기',en:'Remove background'},'sheet.split':{ko:'시트 나누기',en:'Split sheet'},crop:{ko:'자르기',en:'Crop'},
 upscale:{ko:'고화질로 키우기',en:'Upscale'},fit:{ko:'규격 맞추기',en:'Fit to size'},pixelize:{ko:'도트로 만들기',en:'Pixelize'},
 palette:{ko:'팔레트',en:'Palette'},'pixel.snap':{ko:'AI 도트 정리',en:'AI pixel fix'},'sticker.border':{ko:'흰 테두리',en:'White border'},
 caption:{ko:'글자 넣기',en:'Caption'},motion:{ko:'움직임',en:'Motion'},export:{ko:'내보내기',en:'Export'}});

/** @param {unknown} x */
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
/** @param {unknown} x @returns {{ok:true,recipe:any}|{ok:false,error:string}} */
export function validateRecipe(x){
 if(!isObj(x))return {ok:false,error:'recipe must be an object'};
 const r=/** @type {any} */(x);
 let size=0;try{size=new TextEncoder().encode(JSON.stringify(r)).length;}catch{return {ok:false,error:'recipe is not JSON'};}
 if(size>MAX_BYTES)return {ok:false,error:'recipe is larger than 16 KB'};
 if(r.schema!==RECIPE_SCHEMA)return {ok:false,error:'unknown recipe schema'};
 if(!Array.isArray(r.steps)||!r.steps.length||r.steps.length>MAX_STEPS)return {ok:false,error:`recipe needs 1–${MAX_STEPS} steps`};
 const steps=[];
 for(const s of r.steps){
  if(!isObj(s)||!OPS.includes(s.op))return {ok:false,error:'unknown step'};
  const p=isObj(s.p)?s.p:{};
  for(const v of Object.values(p))if(!(typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=200||typeof v==='boolean'||v===null))return {ok:false,error:`bad parameter in ${s.op}`};
  steps.push({op:s.op,v:Number.isInteger(s.v)?s.v:1,p});
 }
 const src=isObj(r.source)?r.source:{};
 const generator=GENERATORS.includes(src.generator)?src.generator:'other';
 const prompt=typeof src.prompt==='string'?src.prompt.slice(0,2000):undefined;
 const title=typeof r.title==='string'?r.title.slice(0,80):undefined;
 const input={expect:isObj(r.input)&&r.input.expect==='sheet'?'sheet':'single'};
 const res=isObj(r.result)?r.result:{};
 const num=(/** @type {unknown} */ v,/** @type {number} */ max)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?Math.round(v):undefined;
 const result={w:num(res.w,16384),h:num(res.h,16384),frames:num(res.frames,1000),count:num(res.count,1000)};
 return {ok:true,recipe:{schema:RECIPE_SCHEMA,...(title?{title}:{}),source:{generator,...(prompt?{prompt}:{}),ai:true},input,steps,result}};
}

/** @param {any} recipe @param {string} l @returns {{steps:{op:string,name:string,detail:string}[],preset?:string}} */
export function summarize(recipe,l){
 const lang=l==='ko'?'ko':'en';
 const steps=(Array.isArray(recipe?.steps)?recipe.steps:[]).map((/** @type {any} */ s)=>{
  const p=isObj(s.p)?s.p:{};
  const detail=Object.entries(p).slice(0,4).map(([k,v])=>`${k} ${v}`).join(' · ');
  return {op:String(s.op),name:NAMES[s.op]?.[lang]||String(s.op),detail};
 });
 const preset=PRESETS.find(x=>x.recipe.steps.at(-1)?.p?.preset===recipe?.steps?.at?.(-1)?.p?.preset&&recipe?.steps?.at?.(-1)?.p?.preset)?.names[lang];
 return preset?{steps,preset}:{steps};
}

/** @param {string} preset @param {number} w @param {number} h */
const fitRecipe=(preset,w,h)=>({schema:RECIPE_SCHEMA,source:{generator:'other',ai:true},input:{expect:'single'},steps:[{op:'bg.remove',v:1,p:{}},{op:'fit',v:1,p:{preset,w,h}},{op:'export',v:1,p:{format:'png'}}],result:{w,h,frames:1,count:1}});
export const PRESETS=Object.freeze([
 {id:'kakao.static',slug:'kakao-emoticon',names:{ko:'카톡 이모티콘 (대화용)',en:'KakaoTalk emoticon (chat)'},spec:'360×360',recipe:fitRecipe('kakao.static',360,360)},
 {id:'line.sticker',slug:'line-sticker',names:{ko:'LINE 스탬프',en:'LINE sticker'},spec:'370×320',recipe:fitRecipe('line.sticker',370,320)},
 {id:'discord.emoji',slug:'discord-emoji',names:{ko:'디스코드 이모지',en:'Discord emoji'},spec:'128×128',recipe:fitRecipe('discord.emoji',128,128)},
 {id:'telegram.sticker',slug:'telegram-sticker',names:{ko:'텔레그램 스티커',en:'Telegram sticker'},spec:'512×512',recipe:fitRecipe('telegram.sticker',512,512)},
 {id:'pfp.round',slug:'round-pfp',names:{ko:'원형 프사',en:'Round profile picture'},spec:'800×800',recipe:fitRecipe('pfp.round',800,800)},
 {id:'wall.iphone17',slug:'phone-wallpaper',names:{ko:'아이폰 17 배경화면',en:'iPhone 17 wallpaper'},spec:'1206×2622',recipe:fitRecipe('wall.iphone17',1206,2622)},
 {id:'pixel.fix',slug:'ai-pixel-fix',names:{ko:'AI 도트 정리',en:'AI pixel-art fix'},spec:'64×64',recipe:fitRecipe('pixel.fix',64,64)},
]);
