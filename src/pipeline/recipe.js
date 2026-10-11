// @ts-check
/** Recipes (레시피): the processing steps a post carries, which anyone can replay on their own image
 * ("내 이미지로 해보기"). Pure ES module — no DOM, no Node APIs — so the Worker (POST /api/v2/posts,
 * GET /api/v2/recipes/{id}), the server renderers and the browser pipeline (src/pipeline) share it.
 *
 * Rules (research/AI-COMMUNITY-PIPELINE.md §4.2, docs/MAKE.md):
 *  1. Every parameter is explicit: validateRecipe() writes the defaults out, so a later default change
 *     never changes an old recipe's result.
 *  2. Steps are versioned (`v`), fit presets carry the date their official spec was checked (`rev`).
 *  3. Coordinates are intent, never absolute pixels ("subject + 8 % margin", a border as a share of
 *     the picture's long side), so a recipe means the same thing on someone else's image.
 *  4. Only the ops below exist. There is no face swap, body reshape, clothing removal, age change or
 *     watermark removal, and a recipe cannot name code, models or URLs.
 * The stored JSON is at most 16 KB with at most 20 steps. */

export const RECIPE_SCHEMA='nerulio.recipe/1';
export const RECIPE_MAX_BYTES=16*1024;
export const RECIPE_MAX_STEPS=20;
/** The v1 step catalogue, in the order the workbench lists them. */
export const OPS=Object.freeze(/** @type {const} */(['bg.remove','sheet.split','crop','upscale','fit','pixelize','palette','pixel.snap','sticker.border','caption','motion','export']));
/** @typedef {typeof OPS[number]} Op */
export const GENERATORS=Object.freeze(/** @type {const} */(['chatgpt','gemini','midjourney','sd','novelai','other']));
export const GENERATOR_NAMES=Object.freeze(/** @type {Record<string,{ko:string,en:string}>} */({
 chatgpt:{ko:'ChatGPT',en:'ChatGPT'},gemini:{ko:'제미나이 (나노바나나)',en:'Gemini (Nano Banana)'},midjourney:{ko:'미드저니',en:'Midjourney'},
 sd:{ko:'스테이블 디퓨전',en:'Stable Diffusion'},novelai:{ko:'NovelAI',en:'NovelAI'},other:{ko:'기타',en:'Other'}}));
/** Pinned models a recipe may name (src/ai-models.js holds the download revisions). */
export const MODELS=Object.freeze({matte:'birefnet-lite-512@4a3c40c',sr:'realesr-general-x4v3@c6a9717'});

/** Official output specs the `fit` step and the export checks use. `rev` = when the spec was checked
 * against the platform's own page (research/AI-COMMUNITY-PIPELINE.md §1.3); byte limits are written in
 * decimal kB/MB, the stricter reading. `side`: 'box' = exactly w×h; 'long' = the long side is exactly
 * max(w,h) and the other side ≤ it (Telegram). `even`: both sides even (LINE). */
export const FIT_SPECS=Object.freeze(/** @type {Record<string,{rev:string,w:number,h:number,side:'box'|'long',mode:'contain'|'cover',margin:number,even?:boolean,maxBytes:number,format:'png'|'gif'|'apng'|'webp',names:{ko:string,en:string},note?:{ko:string,en:string},anim?:{w:number,h:number,minFrames:number,maxFrames:number,maxMs:number,maxBytes:number,format:'apng'|'gif'}}>} */({
 'kakao.static':{rev:'2026-10',w:360,h:360,side:'box',mode:'contain',margin:.03,maxBytes:150_000,format:'png',names:{ko:'카톡 이모티콘 (대화용) 360×360',en:'KakaoTalk emoticon 360×360'},
  note:{ko:'카카오 이모티콘 스튜디오는 AI로 만든 이모티콘 제안을 받지 않아요. 개인 사용·시안용이에요.',en:'Kakao does not accept AI-made emoticons for sale: for personal use and drafts.'},
  anim:{w:360,h:360,minFrames:2,maxFrames:24,maxMs:5000,maxBytes:2_000_000,format:'gif'}},
 'line.sticker':{rev:'2026-10',w:370,h:320,side:'box',mode:'contain',margin:.03,even:true,maxBytes:1_000_000,format:'png',names:{ko:'LINE 스탬프 370×320',en:'LINE sticker 370×320'},
  note:{ko:'짝수 크기 · 투명 PNG · 개당 1MB 이하 · 8/16/24/32/40개. 판매할 때는 AI 사용을 표시하세요.',en:'Even sizes · transparent PNG · ≤1 MB each · 8/16/24/32/40 stickers. Mark AI use when selling.'},
  anim:{w:320,h:270,minFrames:5,maxFrames:20,maxMs:4000,maxBytes:1_000_000,format:'apng'}},
 'discord.emoji':{rev:'2026-10',w:128,h:128,side:'box',mode:'contain',margin:0,maxBytes:256_000,format:'png',names:{ko:'디스코드 이모지 128×128',en:'Discord emoji 128×128'},
  anim:{w:128,h:128,minFrames:2,maxFrames:50,maxMs:10000,maxBytes:256_000,format:'gif'}},
 'discord.sticker':{rev:'2026-10',w:320,h:320,side:'box',mode:'contain',margin:0,maxBytes:512_000,format:'png',names:{ko:'디스코드 스티커 320×320',en:'Discord sticker 320×320'},
  anim:{w:320,h:320,minFrames:2,maxFrames:50,maxMs:5000,maxBytes:512_000,format:'apng'}},
 'telegram.sticker':{rev:'2026-10',w:512,h:512,side:'long',mode:'contain',margin:0,maxBytes:512_000,format:'png',names:{ko:'텔레그램 스티커 512',en:'Telegram sticker 512'},
  note:{ko:'한 변이 정확히 512px, 다른 변은 512px 이하예요. @Stickers 봇에 PNG로 보내세요.',en:'One side exactly 512 px, the other ≤ 512 px. Send the PNG to @Stickers.'}},
 'whatsapp.sticker':{rev:'2026-10',w:512,h:512,side:'box',mode:'contain',margin:.03,maxBytes:100_000,format:'webp',names:{ko:'왓츠앱 스티커 512×512',en:'WhatsApp sticker 512×512'}},
 'pfp.square':{rev:'2026-10',w:800,h:800,side:'box',mode:'cover',margin:0,maxBytes:5_000_000,format:'png',names:{ko:'프로필 사진 800×800',en:'Profile picture 800×800'}},
 'x.pfp':{rev:'2026-10',w:400,h:400,side:'box',mode:'cover',margin:0,maxBytes:2_000_000,format:'png',names:{ko:'X 프로필 400×400',en:'X profile 400×400'}},
 'wall.iphone17':{rev:'2026-10',w:1206,h:2622,side:'box',mode:'cover',margin:0,maxBytes:20_000_000,format:'png',names:{ko:'아이폰 17 배경화면 1206×2622',en:'iPhone 17 wallpaper 1206×2622'}},
 'wall.iphone17promax':{rev:'2026-10',w:1320,h:2868,side:'box',mode:'cover',margin:0,maxBytes:20_000_000,format:'png',names:{ko:'아이폰 17 Pro Max 배경화면 1320×2868',en:'iPhone 17 Pro Max wallpaper 1320×2868'}},
 'wall.galaxys25':{rev:'2026-10',w:1080,h:2340,side:'box',mode:'cover',margin:0,maxBytes:20_000_000,format:'png',names:{ko:'갤럭시 S25 배경화면 1080×2340',en:'Galaxy S25 wallpaper 1080×2340'}},
 'wall.pc1080':{rev:'2026-10',w:1920,h:1080,side:'box',mode:'cover',margin:0,maxBytes:20_000_000,format:'png',names:{ko:'PC 배경화면 1920×1080',en:'PC wallpaper 1920×1080'}},
 'wall.pc4k':{rev:'2026-10',w:3840,h:2160,side:'box',mode:'cover',margin:0,maxBytes:40_000_000,format:'png',names:{ko:'PC 배경화면 4K 3840×2160',en:'PC wallpaper 4K 3840×2160'}},
}));
export const FIT_PRESETS=Object.freeze(Object.keys(FIT_SPECS));

const HEX=/^#[0-9a-f]{6}$/;
/** @typedef {{t:'enum',of:readonly (string|number)[],d:string|number}|{t:'int',min:number,max:number,d:number}|{t:'num',min:number,max:number,d:number}|{t:'bool',d:boolean}|{t:'color',d:string}|{t:'text',max:number,d:string}} ParamSpec */
/** Parameter table per op (version 1): type, range and the default that validateRecipe writes out.
 * Fractions (margin, border width, caption size, motion amplitude) are shares of the picture, never pixels.
 * @type {Record<Op,{v:number,cls:'A'|'B'|'C',p:Record<string,ParamSpec>}>} */
export const OP_PARAMS=Object.freeze({
 // AI (BiRefNet-lite, pinned) or a solid backdrop (border-connected flood fill + colour unmixing at the edge);
 // 'auto' = solid when the picture's border is one colour, else AI. `hard` = 0/255 alpha for die-cut stickers.
 'bg.remove':{v:1,cls:'B',p:{mode:{t:'enum',of:['auto','ai','color'],d:'auto'},model:{t:'enum',of:[MODELS.matte],d:MODELS.matte},tolerance:{t:'int',min:4,max:120,d:36},refine:{t:'bool',d:true},hard:{t:'bool',d:false}}},
 // 'auto' finds the cells from the background gutters on every image (a 5×4 sheet works with a 6×4 recipe);
 // 'grid' divides the content box into cols×rows. cols/rows of an 'auto' step record what the author's sheet had.
 'sheet.split':{v:1,cls:'A',p:{mode:{t:'enum',of:['auto','grid'],d:'auto'},cols:{t:'int',min:1,max:16,d:1},rows:{t:'int',min:1,max:16,d:1},tolerance:{t:'int',min:8,max:120,d:40}}},
 'crop':{v:1,cls:'A',p:{mode:{t:'enum',of:['subject','center'],d:'subject'},margin:{t:'num',min:0,max:.5,d:.08},ratio:{t:'enum',of:['free','1:1','4:3','3:4','3:2','2:3','16:9','9:16','4:5'],d:'free'},shape:{t:'enum',of:['rect','circle','rounded'],d:'rect'},radius:{t:'num',min:0,max:.5,d:.12}}},
 // 'ai' = Real-ESRGAN general-x4v3 (pinned); 'smooth' = Lanczos-3; 'pixel' = nearest. maxSide caps the long side.
 'upscale':{v:1,cls:'B',p:{scale:{t:'enum',of:[2,3,4,6,8],d:2},engine:{t:'enum',of:['ai','smooth','pixel'],d:'ai'},maxSide:{t:'int',min:256,max:8192,d:4096}}},
 'fit':{v:1,cls:'A',p:{preset:{t:'enum',of:[...FIT_PRESETS,'custom'],d:'line.sticker'},rev:{t:'text',max:10,d:''},w:{t:'int',min:16,max:8192,d:512},h:{t:'int',min:16,max:8192,d:512},mode:{t:'enum',of:['contain','cover'],d:'contain'},margin:{t:'num',min:0,max:.3,d:0},scale:{t:'enum',of:['smooth','nearest'],d:'smooth'},bg:{t:'text',max:11,d:'transparent'}}},
 // Cells across the long side; the result is the small pixel image (scale it up with upscale · pixel).
 'pixelize':{v:1,cls:'A',p:{size:{t:'int',min:8,max:256,d:64},sampler:{t:'enum',of:['box','mode','nearest','median','k-centroid'],d:'box'}}},
 'palette':{v:1,cls:'A',p:{colors:{t:'int',min:2,max:256,d:16},method:{t:'enum',of:['wu','median-cut','k-means'],d:'wu'},dither:{t:'enum',of:['none','bayer4','bayer8','floyd-steinberg','atkinson','blue-noise'],d:'none'},strength:{t:'num',min:0,max:1,d:1}}},
 // AI "fake pixel art" → one pixel per cell (src/game/pixel-snap.js). scale 0 = detect; colours 0 = keep.
 'pixel.snap':{v:1,cls:'A',p:{scale:{t:'int',min:0,max:64,d:0},colors:{t:'int',min:0,max:256,d:0},background:{t:'enum',of:['auto','keep'],d:'auto'}}},
 // A die-cut border grown by a Euclidean distance transform: width as a share of the long side.
 'sticker.border':{v:1,cls:'A',p:{width:{t:'num',min:0,max:.1,d:.02},color:{t:'color',d:'#ffffff'},shadow:{t:'bool',d:false}}},
 // Bundled fonts only (SUIT). Text is rasterised by the browser, so the bytes may differ per browser (class C).
 'caption':{v:1,cls:'C',p:{text:{t:'text',max:40,d:''},font:{t:'enum',of:['suit-heavy','suit-bold'],d:'suit-heavy'},size:{t:'num',min:.05,max:.4,d:.16},position:{t:'enum',of:['bottom','top','center'],d:'bottom'},color:{t:'color',d:'#ffffff'},stroke:{t:'color',d:'#15171a'},strokeWidth:{t:'num',min:0,max:.3,d:.12}}},
 'motion':{v:1,cls:'A',p:{kind:{t:'enum',of:['bounce','shake','blink','zoom'],d:'bounce'},frames:{t:'int',min:4,max:24,d:8},ms:{t:'int',min:20,max:500,d:80},amp:{t:'num',min:.01,max:.3,d:.06}}},
 // pack: 'auto' = one file for one picture, a ZIP for several. maxBytes 0 = no limit (else colours are
 // reduced until each file fits). PNG/GIF/APNG come from Nerulio's own encoders; WebP from the browser.
 'export':{v:1,cls:'A',p:{format:{t:'enum',of:['png','webp','gif','apng'],d:'png'},pack:{t:'enum',of:['auto','zip','single'],d:'auto'},maxBytes:{t:'int',min:0,max:50_000_000,d:0},loop:{t:'int',min:0,max:10,d:0},extras:{t:'bool',d:false}}},
});

const NAMES=/** @type {Record<Op,{ko:string,en:string}>} */({
 'bg.remove':{ko:'배경 지우기',en:'Remove background'},'sheet.split':{ko:'시트 나누기',en:'Split sheet'},crop:{ko:'자르기',en:'Crop'},upscale:{ko:'고화질로 키우기',en:'Upscale'},
 fit:{ko:'규격 맞추기',en:'Fit to spec'},pixelize:{ko:'도트로 만들기',en:'Pixelate'},palette:{ko:'색 줄이기',en:'Reduce colours'},'pixel.snap':{ko:'AI 도트 정리',en:'Fix AI pixel art'},
 'sticker.border':{ko:'흰 테두리',en:'Sticker border'},caption:{ko:'글자 넣기',en:'Add text'},motion:{ko:'움직이게',en:'Animate'},export:{ko:'저장 형식',en:'Save as'}});
/** The step's name as the workbench and the recipe card show it. @param {string} op @param {string} l */
export const opName=(op,l)=>/** @type {any} */(NAMES)[op]?.[l==='ko'?'ko':'en']||op;

/** @typedef {{op:Op,v:number,p:Record<string,any>,off?:boolean}} Step */
/** @typedef {{schema:string,title?:string,source:{generator:string,prompt?:string,ai:boolean},input:{expect:'single'|'sheet'},steps:Step[],result?:{w:number,h:number,frames:number,count:number}}} Recipe */

/** One step's parameters: unknown keys dropped, numbers clamped, enums and types checked, defaults written.
 * @param {string} op @param {any} p @returns {{ok:true,p:Record<string,any>}|{ok:false,error:string}} */
export function normalizeParams(op,p){
 const spec=/** @type {any} */(OP_PARAMS)[op];if(!spec)return {ok:false,error:`unknown op ${String(op).slice(0,40)}`};
 if(p!=null&&(typeof p!=='object'||Array.isArray(p)))return {ok:false,error:`${op}: p must be an object`};
 /** @type {Record<string,any>} */const out={};
 for(const [k,s] of Object.entries(/** @type {Record<string,ParamSpec>} */(spec.p))){
  const has=p!=null&&Object.prototype.hasOwnProperty.call(p,k),x=has?p[k]:undefined;
  if(x===undefined||x===null){out[k]=s.d;continue;}
  switch(s.t){
   case 'enum':{if(!s.of.includes(x))return {ok:false,error:`${op}.${k}: not one of ${s.of.join(', ')}`};out[k]=x;break;}
   case 'int':case 'num':{const n=typeof x==='number'?x:typeof x==='string'&&x.trim()!==''?Number(x):NaN;if(!Number.isFinite(n))return {ok:false,error:`${op}.${k}: not a number`};
    const c=Math.min(s.max,Math.max(s.min,n));out[k]=s.t==='int'?Math.round(c):Math.round(c*1e4)/1e4;break;}
   case 'bool':{if(typeof x!=='boolean')return {ok:false,error:`${op}.${k}: not true/false`};out[k]=x;break;}
   case 'color':{const v=String(x).toLowerCase();if(!HEX.test(v))return {ok:false,error:`${op}.${k}: not a #rrggbb colour`};out[k]=v;break;}
   case 'text':{if(typeof x!=='string')return {ok:false,error:`${op}.${k}: not text`};out[k]=x.normalize('NFC').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g,'').trim().slice(0,s.max);break;}
  }
 }
 // Cross-field rules.
 if(op==='fit'){
  if(out.preset!=='custom'){const f=FIT_SPECS[out.preset];out.rev=f.rev;out.w=f.w;out.h=f.h;out.mode=f.mode;out.margin=f.margin;}
  else out.rev='';
  if(out.bg!=='transparent'&&!HEX.test(out.bg))return {ok:false,error:'fit.bg: transparent or #rrggbb'};
 }
 return {ok:true,p:out};
}

/** Defaults of an op, all written out. @param {Op} op @param {Record<string,any>} [over] */
export function defaultStep(op,over={}){
 const r=normalizeParams(op,over);if(!r.ok)throw Error(r.error);
 return /** @type {Step} */({op,v:OP_PARAMS[op].v,p:r.p});
}

const clampInt=(/** @type {any} */ x,/** @type {number} */ lo,/** @type {number} */ hi)=>{const n=Number(x);return Number.isFinite(n)?Math.min(hi,Math.max(lo,Math.round(n))):lo;};
/**
 * Validate and normalise a recipe from anywhere (a post body, a URL, localStorage). Accepts an object or
 * a JSON string. On success the recipe has every parameter explicit and is ≤ 16 KB as JSON.
 * @param {unknown} x @returns {{ok:true,recipe:Recipe}|{ok:false,error:string}}
 */
export function validateRecipe(x){
 let r=/** @type {any} */(x);
 if(typeof r==='string'){if(r.length>RECIPE_MAX_BYTES*2)return {ok:false,error:'recipe too large'};try{r=JSON.parse(r);}catch{return {ok:false,error:'recipe is not JSON'};}}
 if(!r||typeof r!=='object'||Array.isArray(r))return {ok:false,error:'recipe must be an object'};
 if(r.schema!==RECIPE_SCHEMA)return {ok:false,error:`schema must be ${RECIPE_SCHEMA}`};
 if(!Array.isArray(r.steps)||!r.steps.length)return {ok:false,error:'recipe needs at least one step'};
 if(r.steps.length>RECIPE_MAX_STEPS)return {ok:false,error:`at most ${RECIPE_MAX_STEPS} steps`};
 /** @type {Step[]} */const steps=[];
 for(const [i,s] of r.steps.entries()){
  if(!s||typeof s!=='object'||Array.isArray(s))return {ok:false,error:`step ${i+1} must be an object`};
  if(!OPS.includes(s.op))return {ok:false,error:`step ${i+1}: unknown op ${String(s.op).slice(0,40)}`};
  const op=/** @type {Op} */(s.op),v=s.v===undefined?OP_PARAMS[op].v:s.v;
  if(v!==OP_PARAMS[op].v)return {ok:false,error:`step ${i+1}: ${op} v${String(v).slice(0,8)} is not supported`};
  const n=normalizeParams(op,s.p);if(!n.ok)return {ok:false,error:`step ${i+1}: ${n.error}`};
  /** @type {Step} */const step={op,v,p:n.p};if(s.off===true)step.off=true;steps.push(step);
 }
 // An export step can only be the last one, and there is at most one.
 const ex=steps.findIndex(s=>s.op==='export');
 if(ex>=0&&ex!==steps.length-1)return {ok:false,error:'export must be the last step'};
 const src=r.source&&typeof r.source==='object'?r.source:{};
 const generator=GENERATORS.includes(src.generator)?src.generator:'other';
 const prompt=typeof src.prompt==='string'?src.prompt.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,2000):'';
 /** @type {Recipe} */const out={schema:RECIPE_SCHEMA,source:{generator,...(prompt?{prompt}:{}),ai:src.ai!==false},input:{expect:r.input?.expect==='sheet'?'sheet':'single'},steps};
 if(typeof r.title==='string'){const t=r.title.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,80);if(t)out.title=t;}
 if(r.result&&typeof r.result==='object')out.result={w:clampInt(r.result.w,1,8192),h:clampInt(r.result.h,1,8192),frames:clampInt(r.result.frames,1,300),count:clampInt(r.result.count,1,400)};
 if(JSON.stringify(out).length>RECIPE_MAX_BYTES)return {ok:false,error:'recipe is larger than 16 KB'};
 return {ok:true,recipe:out};
}

const pct=(/** @type {number} */ x)=>`${Math.round(x*100)}%`;
/** The nominal pixel size of a share of the picture, measured on the following fit's long side (else 512). */
function nominalPx(/** @type {Step[]} */ steps,/** @type {number} */ i,/** @type {number} */ share){
 const fit=steps.slice(i+1).find(s=>s.op==='fit'&&!s.off);const side=fit?Math.max(fit.p.w,fit.p.h):512;
 return Math.max(1,Math.round(share*side));
}
/** One line describing a step's settings, for the recipe card and the workbench chain.
 * @param {Step} s @param {string} l @param {Step[]} [all] @param {number} [i] */
export function stepDetail(s,l,all=[s],i=0){
 const ko=l==='ko',p=s.p;
 switch(s.op){
  case 'bg.remove':return p.mode==='color'?(ko?`단색 배경 · 허용 ${p.tolerance}`:`Solid backdrop · tolerance ${p.tolerance}`):p.mode==='ai'?(ko?`AI${p.refine?' · 가장자리 다듬기':''}${p.hard?' · 딱 떨어지게':''}`:`AI${p.refine?' · refined edges':''}${p.hard?' · hard edge':''}`):(ko?`자동 (단색이면 빠르게, 아니면 AI)${p.hard?' · 딱 떨어지게':''}`:`Auto (solid backdrop fast, else AI)${p.hard?' · hard edge':''}`);
  case 'sheet.split':{const n=p.cols*p.rows;return p.mode==='grid'?(ko?`${p.cols}×${p.rows} → ${n}장`:`${p.cols}×${p.rows} → ${n}`):n>1?(ko?`자동 감지 (원글 ${p.cols}×${p.rows} → ${n}장)`:`Auto (author's ${p.cols}×${p.rows} → ${n})`):(ko?'칸 자동 감지':'Cells detected automatically');}
  case 'crop':{const shape=p.shape==='circle'?(ko?'원형':'circle'):p.shape==='rounded'?(ko?'둥근 모서리':'rounded'):'';const r=p.ratio==='free'?'':p.ratio;
   return [p.mode==='subject'?(ko?`피사체 맞춤 · 여백 ${pct(p.margin)}`:`Fit the subject · ${pct(p.margin)} margin`):(ko?'가운데':'Centre'),r,shape].filter(Boolean).join(' · ');}
  case 'upscale':return `×${p.scale} · ${p.engine==='ai'?(ko?'AI':'AI'):p.engine==='pixel'?(ko?'도트 그대로':'pixel (nearest)'):(ko?'부드럽게':'smooth')}`;
  case 'fit':{const f=FIT_SPECS[p.preset];return f?f.names[ko?'ko':'en']:`${p.w}×${p.h} · ${p.mode==='cover'?(ko?'꽉 채우기':'cover'):(ko?'전체 보이기':'contain')}`;}
  case 'pixelize':return ko?`${p.size}칸`:`${p.size} cells`;
  case 'palette':return `${p.colors}${ko?'색':' colours'}${p.dither!=='none'?` · ${p.dither}`:''}`;
  case 'pixel.snap':return [p.scale?(ko?`격자 ${p.scale}px`:`grid ${p.scale}px`):(ko?'격자 자동':'grid auto'),p.colors?`${p.colors}${ko?'색':' colours'}`:''].filter(Boolean).join(' · ');
  case 'sticker.border':return `${nominalPx(all,i,p.width)}px${p.color!=='#ffffff'?` · ${p.color}`:''}${p.shadow?(ko?' · 그림자':' · shadow'):(ko?' · 그림자 없음':'')}`;
  case 'caption':return p.text?`“${p.text}” · ${p.position==='top'?(ko?'위':'top'):p.position==='center'?(ko?'가운데':'centre'):(ko?'아래':'bottom')}`:(ko?'글자 없음':'no text');
  case 'motion':return `${{bounce:ko?'통통':'bounce',shake:ko?'흔들기':'shake',blink:ko?'깜빡':'blink',zoom:ko?'확대':'zoom'}[/** @type {'bounce'} */(p.kind)]} · ${p.frames}${ko?'장':' frames'} · ${p.ms}ms`;
  case 'export':{const f=String(p.format).toUpperCase();return `${f}${p.pack==='zip'?' ZIP':p.pack==='auto'?(ko?' (여러 장이면 ZIP)':' (ZIP when several)'):''}${p.maxBytes?` · ≤${p.maxBytes>=1e6?`${+(p.maxBytes/1e6).toFixed(1)}MB`:`${Math.round(p.maxBytes/1000)}KB`}`:''}`;}
 }
 return '';
}
/** The recipe card: each step's name and settings (the 흰 테두리 step is named after its colour), and the
 * fit preset's name as the recipe's target. @param {Recipe} recipe @param {string} l */
export function summarize(recipe,l){
 const ko=l==='ko',steps=recipe.steps.filter(s=>!s.off);
 const out=steps.map((s,i)=>({op:s.op,name:s.op==='sticker.border'&&s.p.color!=='#ffffff'?(ko?'테두리':'Border'):opName(s.op,l),detail:stepDetail(s,l,steps,i)}));
 const fit=[...steps].reverse().find(s=>s.op==='fit');
 const spec=fit&&FIT_SPECS[fit.p.preset];
 return spec?{steps:out,preset:spec.names[ko?'ko':'en']}:{steps:out};
}
/** "시트 나누기 → 배경 지우기 → 흰 테두리 6px → LINE 370×320", for feed rows. @param {Recipe} recipe @param {string} l */
export function summaryLine(recipe,l){
 return summarize(recipe,l).steps.filter(s=>s.op!=='export').map(s=>s.op==='fit'?s.detail:s.op==='sticker.border'?`${s.name} ${s.detail.split(' · ')[0]}`:s.name).join(' → ');
}

const R=(/** @type {[Op,Record<string,any>?][]} */ list,/** @type {'single'|'sheet'} */ expect='single')=>{
 const v=validateRecipe({schema:RECIPE_SCHEMA,source:{generator:'other',ai:true},input:{expect},steps:list.map(([op,p])=>({op,p:p||{}}))});
 if(!v.ok)throw Error(v.error);return v.recipe;
};
/** Ready recipes: the workbench presets (?preset=<id>) and the SEO landings (/{l}/make/<slug>/).
 * @type {readonly {id:string,slug:string,names:{ko:string,en:string},spec:string,fit?:string,recipe:Recipe}[]} */
export const PRESETS=Object.freeze([
 {id:'kakao.static',slug:'kakao-emoticon',names:{ko:'카톡 이모티콘 만들기',en:'KakaoTalk emoticon maker'},spec:'360×360 PNG · ≤150KB',fit:'kakao.static',
  recipe:R([['sheet.split'],['bg.remove'],['crop',{margin:.04,ratio:'1:1'}],['fit',{preset:'kakao.static'}],['export',{maxBytes:150_000}]],'sheet')},
 {id:'line.sticker',slug:'line-sticker',names:{ko:'LINE 스탬프 만들기',en:'LINE sticker maker'},spec:'370×320 PNG · ≤1MB',fit:'line.sticker',
  recipe:R([['sheet.split'],['bg.remove'],['crop',{margin:.04}],['sticker.border',{width:.018}],['fit',{preset:'line.sticker'}],['export',{maxBytes:1_000_000,extras:true}]],'sheet')},
 {id:'discord.emoji',slug:'discord-emoji',names:{ko:'디스코드 이모지 만들기',en:'Discord emoji maker'},spec:'128×128 PNG · ≤256KB',fit:'discord.emoji',
  recipe:R([['sheet.split'],['bg.remove'],['crop',{margin:.02,ratio:'1:1'}],['fit',{preset:'discord.emoji'}],['export',{maxBytes:256_000}]],'sheet')},
 {id:'telegram.sticker',slug:'telegram-sticker',names:{ko:'텔레그램 스티커 만들기',en:'Telegram sticker maker'},spec:'512px PNG · ≤512KB',fit:'telegram.sticker',
  recipe:R([['sheet.split'],['bg.remove'],['crop',{margin:.02}],['sticker.border',{width:.02}],['fit',{preset:'telegram.sticker'}],['export',{maxBytes:512_000}]],'sheet')},
 {id:'pfp.round',slug:'round-pfp',names:{ko:'원형 프사 만들기',en:'Round profile picture maker'},spec:'800×800 PNG · 원형',fit:'pfp.square',
  recipe:R([['crop',{mode:'center',margin:0,ratio:'1:1'}],['fit',{preset:'pfp.square'}],['crop',{mode:'center',margin:0,ratio:'1:1',shape:'circle'}],['export']])},
 {id:'wall.iphone17',slug:'phone-wallpaper',names:{ko:'폰 배경화면 만들기',en:'Phone wallpaper maker'},spec:'1206×2622 PNG',fit:'wall.iphone17',
  recipe:R([['upscale',{scale:2,engine:'ai',maxSide:4096}],['fit',{preset:'wall.iphone17'}],['export']])},
 {id:'pixel.fix',slug:'ai-pixel-fix',names:{ko:'AI 도트 정리',en:'AI pixel art fixer'},spec:'1픽셀 = 1칸 PNG',
  recipe:R([['pixel.snap'],['upscale',{scale:8,engine:'pixel',maxSide:2048}],['export']])},
]);
/** @param {string} id */
export const presetById=id=>PRESETS.find(p=>p.id===id)||null;
/** @param {string} slug */
export const presetBySlug=slug=>PRESETS.find(p=>p.slug===slug)||null;
