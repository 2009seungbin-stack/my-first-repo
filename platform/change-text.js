// @ts-check
/** Human text for a `changes` row in the reader's language. Generated at render time from
 * (kind, property, old, new), so every language reads the same fact the same way; only curated
 * changes carry a stored `summary`. Values are formatted from the property definition. */
import {verticalOf} from './verticals/index.js';
import {COMPAT_STATUS_LABEL,AVAILABILITY_LABEL,label} from './labels.js';

/** Same display names as the wiki (platform/render/format.js PLATFORM_NAMES). */
const LIST_NAMES=/** @type {Record<string,string>} */({web:'Web',ios:'iOS',android:'Android',windows:'Windows',macos:'macOS',linux:'Linux',api:'API'});
/** @param {unknown} v @param {any} def @param {string|null|undefined} unit @param {'ko'|'en'} l */
export function formatValue(v,def,unit,l){
 if(v===null||v===undefined)return '—';
 const type=def?.type;
 if(type==='bool')return v?(l==='ko'?'예':'Yes'):(l==='ko'?'아니오':'No');
 if(type==='enum'&&def.values?.[/** @type {string} */(v)])return label(def.values[/** @type {string} */(v)],l);
 if(type==='list'&&Array.isArray(v))return v.map(x=>LIST_NAMES[x]||x).join(' · ');
 if(type==='date'&&typeof v==='string'&&/^\d{4}-\d{2}(-\d{2})?$/.test(v))return v.replace(/-/g,'.');
 if(type==='tokens'&&typeof v==='number')return v>=1e6?`${+(v/1e6).toFixed(2)}M`:v>=1e3?`${+(v/1e3).toFixed(1)}K`:String(v);
 if(type==='money'&&typeof v==='number'){
  const cur=def.unit||unit||'';
  const sym=({USD:'$',KRW:'₩',JPY:'¥',EUR:'€',GBP:'£'})[/** @type {'USD'} */(cur)];
  const n=v.toLocaleString(l==='ko'?'ko-KR':'en-US',{maximumFractionDigits:cur==='KRW'||cur==='JPY'?0:2});
  return sym?sym+n:`${n} ${cur}`.trim();
 }
 if(typeof v==='number'){const u=def?.unit||unit;return v.toLocaleString(l==='ko'?'ko-KR':'en-US')+(u&&u!=='tokens'?` ${u}`:'');}
 return String(v);
}
const parse=(/** @type {string|null} */ s)=>{if(s===null||s===undefined)return null;try{return JSON.parse(s);}catch{return s;}};

/**
 * @param {{kind:string,property?:string|null,scope?:string,old_value?:string|null,new_value?:string|null,summary?:string|null,vertical:string}} c
 * @param {{name:string,names?:Record<string,string>}} ctx entity name in this language + a map of other entity ids → names (plans, targets)
 * @param {'ko'|'en'} l
 * @returns {{title:string,detail:string}}
 */
export function describeChange(c,ctx,l){
 if(c.summary){const s=parse(c.summary);if(s&&typeof s==='object'&&s[l])return {title:s[l],detail:''};}
 const v=verticalOf(c.vertical),def=c.property?v?.properties[c.property]:null,prop=def?label(def.label,l):c.property||'';
 const oldV=parse(c.old_value??null),newV=parse(c.new_value??null),scope=parse(c.scope||'{}')||{},name=ctx.name,other=(/** @type {string} */ id)=>ctx.names?.[id]||id;
 const ko=l==='ko';
 const where=[scope.plan&&scope.plan!=='*'?other(scope.plan):'',scope.platform&&scope.platform!=='*'?scope.platform:'',scope.region&&scope.region!=='*'?scope.region:''].filter(Boolean).join(' · ');
 switch(c.kind){
  case 'fact_changed':return {title:ko?`${name} ${prop} 변경`:`${name}: ${prop} changed`,detail:`${formatValue(oldV,def,null,l)} → ${formatValue(newV,def,null,l)}${where?` (${where})`:''}`};
  case 'fact_added':return {title:ko?`${name} ${prop} 확인`:`${name}: ${prop} added`,detail:`${formatValue(newV,def,null,l)}${where?` (${where})`:''}`};
  case 'fact_removed':return {title:ko?`${name} ${prop} 정보 삭제`:`${name}: ${prop} removed`,detail:formatValue(oldV,def,null,l)};
  case 'version_released':return {title:ko?`${name} ${newV} 출시`:`${name} ${newV} released`,detail:''};
  case 'entity_added':return {title:ko?`${name} 추가됨`:`${name} added`,detail:''};
  case 'availability_changed':{
   const s=label(AVAILABILITY_LABEL[/** @type {'available'} */(newV)]||{en:String(newV),ko:String(newV)},l);
   return {title:ko?`${name} — ${where||'전체'} ${s}`:`${name}: ${s}${where?` for ${where}`:''}`,detail:oldV?`${label(AVAILABILITY_LABEL[/** @type {'available'} */(oldV)]||{en:String(oldV),ko:String(oldV)},l)} → ${s}`:''};
  }
  case 'compat_changed':{
   const target=other(scope.target||''),tv=scope.target_version&&scope.target_version!=='*'?` ${scope.target_version}`:'';
   if(newV==='unverified_after_update')return {title:ko?`${target}${tv} 업데이트 — ${name} 호환 재확인 필요`:`${target}${tv} update: ${name} needs re-checking`,detail:oldV?(ko?`이전 상태: ${label(COMPAT_STATUS_LABEL[/** @type {'works'} */(oldV)],l)}`:`Previously: ${label(COMPAT_STATUS_LABEL[/** @type {'works'} */(oldV)],l)}`):''};
   const st=label(COMPAT_STATUS_LABEL[/** @type {'works'} */(newV)]||{en:String(newV),ko:String(newV)},l);
   return {title:ko?`${name} × ${target}${tv}: ${st}`:`${name} on ${target}${tv}: ${st}`,detail:scope.verification==='COMMUNITY_VERIFIED'?(ko?'커뮤니티 검증':'Community verified'):scope.verification==='DISPUTED'?(ko?'리포트가 엇갈림':'Reports disagree'):''};
  }
  case 'event_announced':case 'event_changed':{
   const t=newV&&typeof newV==='object'&&!Array.isArray(newV)?(newV[l]||newV.en):null;
   return {title:t?(ko?`${name}: ${t}`:`${name}: ${t}`):(ko?`${name} 일정 ${c.kind==='event_changed'?'변경':'발표'}`:`${name}: schedule ${c.kind==='event_changed'?'changed':'announced'}`),detail:''};
  }
  case 'relation_added':return {title:ko?`${name} 관련 정보 추가`:`${name}: new relation`,detail:''};
  case 'incident':return {title:ko?`${name} 장애`:`${name} incident`,detail:''};
  default:return {title:name,detail:''};
 }
}
