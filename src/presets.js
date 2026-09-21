import {defaults} from './recipes.js';
const enums={format:['png','jpeg','webp'],fit:['contain','cover','stretch'],align:['bottom','center','top'],platform:['all','etsy','shopify','custom'],mode:['normal','gray','invert','alpha','solid','portrait'],order:['LR','RL'],ditherMode:['floyd-steinberg','ordered']};
const limits={n:[8,512],colors:[2,256],dither:[0,1],outline:[0,4],padding:[0,64],tolerance:[0,441],threshold:[0,255],minArea:[1,4000000],columns:[1,24],width:[0,65535],height:[0,65535],w:[0,65535],h:[0,65535],cellW:[1,8192],cellH:[1,8192],anchor:[0,1],longSide:[64,4096],baseline:[0,8192],strength:[0,10],divider:[.01,.99],quality:[25,100],kb:[0,32768],scale:[2,4]};
export function cleanOption(key,value,initial) {
  if(key==='chars'||key==='palette')return initial; // User-authored glyph text is not a shared preset.
  if(Array.isArray(initial)) {
    const list=String(value).split(',').map(v=>/^\d$/.test(v)?Number(v):v);
    return list.length===4&&list.every(v=>['zero','one',0,1,2,3].includes(v))?list:[...initial];
  }
  if(typeof initial==='boolean')return value===true||value==='1';
  if(typeof initial==='number') {
    const n=Number(value),[lo,hi]=limits[key]||[0,8192];
    return Number.isFinite(n)?Math.min(hi,Math.max(lo,['dither','anchor','strength','divider'].includes(key)?n:Math.round(n))):initial;
  }
  if(enums[key])return enums[key].includes(value)?value:initial;
  if(['background','from','to','color'].includes(key))return /^#[0-9a-f]{6}$/i.test(value)?value:initial;
  return initial;
}
export function parsePreset(id,query='') {
  const o=defaults(id),q=new URLSearchParams(query);
  for(const [key,value] of Object.entries(o))if(q.has(key))o[key]=cleanOption(key,q.get(key),value);
  return o;
}
export function serializePreset(id,options) {
  const q=new URLSearchParams(),base=defaults(id);
  for(const [key,value] of Object.entries(base)) {
    if(key==='chars'||key==='palette')continue;
    const v=cleanOption(key,options[key]??value,value);
    q.set(key,Array.isArray(v)?v.join(','):typeof v==='boolean'?(v?'1':'0'):String(v));
  }
  return q;
}
