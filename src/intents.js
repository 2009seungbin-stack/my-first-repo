import {RECIPE_INTENTS,RECIPE_ALIASES} from './tool-registry.js';
/** One source of truth for landing pages, in-app shortcuts and static entries. */
const spec=(path,editor,tool,icon,action,accept,next=[])=>({path,editor,tool,icon,action,accept,next});
export const INTENTS=Object.freeze({
 ...RECIPE_INTENTS,
 home:spec('','image','','image','open','auto'),
 image:spec('image/editor','image','','image','export','image',['upscale','remove-bg','compress','pixel']),
 upscale:spec('image/upscale','image','upscale','upscale','upscale','image',['remove-bg','crop','pixel']),
 'remove-bg':spec('image/remove-bg','image','background','background','background','image',['margin-crop','refiner','favicon-pack']),
 compress:spec('image/compress','image','export','download','compress','image',['convert','resize','marketplace-pack']),
 convert:spec('image/convert','image','export','image','convert','image',['compress','crop','pixel']),
 heic:spec('image/heic-to-jpg','image','export','image','convert','image',['compress','crop','pixel']),
 crop:spec('image/crop','image','crop','crop','crop','image',['upscale','remove-bg','compress']),
 resize:spec('image/resize','image','resize','resize','resize','image',['compress','convert','pixel']),
 pixel:spec('pixel','pixel','pixel','pixel','pixel','image',['sprite-sheet-maker','palette-swap','refiner']),
 pdf:spec('pdf/editor','pdf','','pdf','pdf','pdfImage',['pdf-split','pdf-compress','pdf-to-jpg']),
 'pdf-merge':spec('pdf/merge','pdf','','plus','pdf','pdf',['pdf-compress','pdf-split','pdf-to-jpg']),
 'pdf-split':spec('pdf/split','pdf','export','scissors','pdf','pdf',['pdf-merge','pdf-compress','pdf-to-jpg']),
 'pdf-compress':spec('pdf/compress','pdf','export','download','pdf','pdf',['pdf-split','pdf-to-jpg','pdf']),
 'jpg-to-pdf':spec('jpg-to-pdf','pdf','','pdf','pdf','image',['pdf-merge','pdf-split','pdf-compress']),
 'pdf-to-jpg':spec('pdf-to-jpg','pdf','export','image','pdfImages','pdf',['pdf','pdf-split','pdf-compress']),
 media:spec('media','media','export','media','media','media',['video-frame','video-mp3','video-gif']),
 'video-trim':spec('video/trim','media','export','scissors','media','media',['video-frame','video-mp3','video-gif']),
 'video-frame':spec('video/frame','media','','image','frame','media',['video-gif','video-trim','video-mp3']),
 'video-mp3':spec('video/to-mp3','media','export','audio','media','media',['video-trim','video-frame','video-gif']),
 'video-gif':spec('video/to-gif','media','export','media','media','media',['video-frame','video-trim','video-mp3']),
 'video-compress':spec('video/compress','media','export','download','media','media',['video-frame','video-mp3','video-gif']),
});
export const ALIASES=Object.freeze({...RECIPE_ALIASES,'pixel-art-converter':'refiner','game-asset-refiner':'refiner','sprite-normalizer':'frame-normalize','favicon-maker':'favicon-pack','print-ratio-resizer':'print-pack','image/white-background-remover':'logo-bg','image/transparent-trim':'margin-crop','image/pixel':'pixel','image/target-size':'compress','png-to-webp':'convert','jpg-to-png':'convert','webp-to-jpg':'convert','image/remove-background':'remove-bg'});
export const ROUTES=Object.freeze([...new Set([...Object.values(INTENTS).map(i=>i.path).filter(Boolean),...Object.keys(ALIASES)])]);
export function intentFor(path){const p=String(path).replace(/^\/+|\/+$/g,'');return ALIASES[p]||Object.keys(INTENTS).find(k=>INTENTS[k].path===p)||'home';}
export const isFocused=id=>!['home','image','pdf','media'].includes(id);
export function accepts(id,kinds){const a=INTENTS[id].accept;return kinds.length>0&&kinds.every(k=>k&&(a==='auto'||a==='pdfImage'&&(k==='pdf'||k==='image')||a===k));}
export function intentDefaults(id,path='',search=''){
 const q=new URLSearchParams(search),number=(key,fallback,min,max)=>{const n=Number(q.get(key));return q.has(key)&&Number.isFinite(n)?Math.round(Math.min(max,Math.max(min,n))):fallback;};
 const format=['png','jpeg','webp'].includes(q.get('format'))?q.get('format'):q.get('format')==='jpg'?'jpeg':path==='png-to-webp'?'webp':path==='jpg-to-png'?'png':path==='webp-to-jpg'||id==='heic'?'jpeg':id==='compress'?'webp':'png';
 return {scaleMode:q.get('scaleMode')==='pixel'?'pixel':'smooth',quality:number('quality',92,25,100),shrink:q.get('shrink')==='1',colors:number('colors',16,2,256),dither:q.has('dither')&&Number.isFinite(Number(q.get('dither')))?Math.max(0,Math.min(1,Number(q.get('dither')))):0,outline:number('outline',0,0,4),fit:['contain','cover','stretch'].includes(q.get('fit'))?q.get('fit'):'contain',trim:q.get('trim')!=='0',color:/^#[a-f0-9]{6}$/i.test(q.get('color'))?q.get('color'):'#ffffff',tolerance:number('tolerance',40,0,441),format,kb:number('kb',id==='compress'?500:0,0,32768),width:number('w',0,0,8192),height:number('h',0,0,8192),scale:number('scale',2,2,4)===4?4:2,n:number('n',32,8,512),background:q.get('mode')==='portrait'?'portrait':'solid',mediaFormat:id==='video-mp3'?'mp3':id==='video-gif'?'gif':'webm',pdfFormat:id==='pdf-to-jpg'?'jpeg':'pdf',range:/^[0-9,\s-]{1,256}$/.test(q.get('pages')||'')?q.get('pages'):''};
}
