import {STORE_SLOTS,SPEC_DATE,validateSlotSpec} from './spec.js';
import {zip} from '../core.js';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(+v)?+v:a));
const clean=s=>String(s||'').replace(/[\u0000-\u001f]/g,' ').slice(0,100);
export function normalizedSettings(raw={}){
 const slots={};for(const slot of STORE_SLOTS){const o=raw.slots?.[slot.id]||{};slots[slot.id]={x:clamp(o.x,0,1),y:clamp(o.y,0,1),zoom:clamp(o.zoom,1,8),logoX:clamp(o.logoX,0,1),logoY:clamp(o.logoY,0,1),logoW:clamp(o.logoW,.05,.9)};
  if(o.x===undefined)slots[slot.id].x=.5;if(o.y===undefined)slots[slot.id].y=.5;
  if(o.logoX===undefined)slots[slot.id].logoX=slot.id==='store-small'?.5:.5;
  if(o.logoY===undefined)slots[slot.id].logoY=slot.id==='library-capsule'?.8:.75;
  if(o.logoW===undefined)slots[slot.id].logoW=slot.id==='store-small'?.82:.58;
 }
 return {slots,pixel:!!raw.pixel,title:clean(raw.title),subtitle:clean(raw.subtitle),platforms:Array.isArray(raw.platforms)?raw.platforms.filter(p=>['steam','itch','google-play','apple'].includes(p)):['steam','itch','google-play','apple'],optional:!!raw.optional};
}
export function cropGeometry(sw,sh,w,h,setting,pixel=false){
 const min=Math.max(w/sw,h/sh)*clamp(setting.zoom,1,8),scale=pixel&&min>=1?Math.ceil(min):min;
 const outW=sw*scale,outH=sh*scale,x=(w-outW)*clamp(setting.x,0,1),y=(h-outH)*clamp(setting.y,0,1);
 return {x,y,w:outW,h:outH,scale,integerNearest:pixel&&min>=1,downsampleNearest:pixel&&min<1};
}
function canvas(w,h){return new OffscreenCanvas(w,h);}
function titleLayer(ctx,slot,settings,loc){
 if(!settings.title||slot.text==='none')return false;
 const w=slot.w,h=slot.h,s=slot.id==='store-small'?Math.floor(h*.39):Math.floor(Math.min(w*.085,h*.18));
 ctx.save();ctx.font=`800 ${s}px system-ui,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.lineJoin='round';ctx.lineWidth=Math.max(3,Math.round(s*.12));ctx.strokeStyle='#111827';ctx.fillStyle='#fff';
 const title=settings.title,maxW=w*.88,y=slot.id==='library-capsule'?h*.77:h*.78;
 ctx.strokeText(title,w*.5,y,maxW);ctx.fillText(title,w*.5,y,maxW);
 if(settings.subtitle&&slot.platform==='steam'&&slot.id!=='library-hero'&&slot.id!=='library-logo'){
  ctx.font=`600 ${Math.max(12,Math.round(s*.38))}px system-ui,sans-serif`;ctx.strokeText(settings.subtitle,w*.5,y+s*.72,maxW);ctx.fillText(settings.subtitle,w*.5,y+s*.72,maxW);
 }
 ctx.restore();return true;
}
function logoLayer(ctx,slot,logo,o){
 if(!logo)return false;
 const maxW=slot.w*o.logoW,maxH=slot.h*(slot.id==='store-small'?.85:.32),scale=Math.min(maxW/logo.width,maxH/logo.height),w=logo.width*scale,h=logo.height*scale;
 const x=clamp(o.logoX,0,1)*(slot.w-w),y=clamp(o.logoY,0,1)*(slot.h-h);
 ctx.drawImage(logo,x,y,w,h);return true;
}
export async function renderSlot(slot,art,logo,settings){
 validateSlotSpec(slot);const o=settings.slots[slot.id],c=canvas(slot.w,slot.h),ctx=c.getContext('2d',{alpha:slot.alpha});
 if(slot.id==='library-logo'){
  ctx.clearRect(0,0,slot.w,slot.h);
  if(logo){const k=Math.min(slot.w*.9/logo.width,slot.h*.9/logo.height),w=logo.width*k,h=logo.height*k;ctx.drawImage(logo,(slot.w-w)/2,(slot.h-h)/2,w,h);}
  else titleLayer(ctx,slot,settings);
 }else{
  ctx.fillStyle='#172033';ctx.fillRect(0,0,slot.w,slot.h);
  const g=cropGeometry(art.width,art.height,slot.w,slot.h,o,settings.pixel);ctx.imageSmoothingEnabled=!settings.pixel;ctx.imageSmoothingQuality='high';ctx.drawImage(art,g.x,g.y,g.w,g.h);
  if(slot.logo&&logo)logoLayer(ctx,slot,logo,o);
  else if(slot.text!=='none'&&!(slot.platform==='google-play'&&slot.id==='icon'))titleLayer(ctx,slot,settings);
 }
 const type=slot.format==='jpeg'?'image/jpeg':'image/png',blob=await c.convertToBlob({type,quality:.94});
 return {blob,geometry:slot.id==='library-logo'?null:cropGeometry(art.width,art.height,slot.w,slot.h,o,settings.pixel),composedLogo:!!(logo&&slot.logo),hasText:!logo&&!!settings.title&&slot.text!=='none'};
}
export async function buildPack({artFile,logoFile,rawSettings,onProgress=()=>{}}){
 if(!artFile)throw Error('Key art is required');
 const settings=normalizedSettings(rawSettings),art=await createImageBitmap(artFile),logo=logoFile?await createImageBitmap(logoFile):null;
 const entries=[],report={tool:'Nerulio Store Art Pack',specCheckedAt:SPEC_DATE,platformApproval:'Not checked by platforms',source:{art:artFile.name,artWidth:art.width,artHeight:art.height,logo:logoFile?.name||null},files:[],warnings:[]};
 try{
  const chosen=STORE_SLOTS.filter(s=>settings.platforms.includes(s.platform)&&(s.required||settings.optional));
  if(!logo)report.warnings.push('No original transparent logo supplied. Typed title is a placeholder; visually review every Steam capsule and the separate library logo.');
  if(settings.platforms.includes('steam'))report.warnings.push('Steam requires at least five genuine gameplay screenshots; this pack does not synthesize them.');
  for(let i=0;i<chosen.length;i++){
   const slot=chosen[i],r=await renderSlot(slot,art,logo,settings);entries.push({name:slot.path,blob:r.blob});
   report.files.push({path:slot.path,slot:slot.id,platform:slot.platform,width:slot.w,height:slot.h,mime:r.blob.type,bytes:r.blob.size,required:slot.required,source:slot.source,notes:slot.notes||undefined,geometry:r.geometry,composedLogo:r.composedLogo,typedTitle:r.hasText,alphaExpected:slot.alpha});
   if(slot.id==='icon'&&r.blob.size>1024*1024)report.warnings.push('Google Play icon exceeds 1024 KB; reduce image complexity before uploading.');
   if(slot.id==='banner-suggested')report.warnings.push('itch.io banner dimensions are a custom suggestion, not an official fixed size.');
   if(slot.id==='icon-source')report.warnings.push('Apple icon is an Xcode source image, not a standalone App Store upload.');
   if(r.geometry?.downsampleNearest)report.warnings.push(`${slot.id}: nearest downsampling used; integer enlargement was impossible at this output size.`);
   onProgress({done:i+1,total:chosen.length,slot:slot.id});
  }
  entries.push({name:'checklist.json',blob:new Blob([JSON.stringify(report,null,2)],{type:'application/json'})});
  const archive=await zip(entries,{paths:true});return {archive,report,entries};
 }finally{art.close();logo?.close();}
}
