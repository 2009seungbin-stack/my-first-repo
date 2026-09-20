import {MESSAGES} from './messages.js';
export const LOCALES = Object.freeze(['ko','en','ja']);
export const LANGUAGE_NAMES = Object.freeze({ko:'한국어',en:'English',ja:'日本語'});
export const STORAGE_KEY = 'fileforge.language.v1';
let current = 'en';
/** Use language preferences, never geolocation or an IP lookup. */
export function normalizeLocale(value){
 if(typeof value!=='string')return null;
 const tag=value.trim().replaceAll('_','-').toLowerCase();
 if(!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(tag))return null;
 const base=tag.split('-')[0];return LOCALES.includes(base)?base:null;
}
export function chooseLocale({query,pathname,saved,languages=[]}={}){
 return [query,pathname,saved,...(Array.isArray(languages)?languages:[])].map(normalizeLocale).find(Boolean)||'en';
}
export const getLocale=()=>current;
export function setLocale(value){current=normalizeLocale(value)||'en';return current;}
/** Translation never processes user filenames, annotations or HTML. */
export function t(key,params={},locale=current){
 const list=MESSAGES[key],i=LOCALES.indexOf(normalizeLocale(locale)||'en');
 const text=list?.[i]??list?.[1]??key;
 return String(text).replace(/\{([\w]+)\}/g,(token,name)=>Object.hasOwn(params,name)?String(params[name]):token);
}
export function readPreference(storage){try{return normalizeLocale(storage.getItem(STORAGE_KEY));}catch{return null;}}
export function savePreference(value,storage){try{const lang=normalizeLocale(value);if(lang)storage.setItem(STORAGE_KEY,lang);else storage.removeItem(STORAGE_KEY);return true;}catch{return false;}}
/** Strip only a known locale segment beneath the actual deployment base. */
export function locationParts(pathname,basePath='/'){
 const base=basePath.endsWith('/')?basePath:basePath+'/';
 const relative=pathname.startsWith(base)?pathname.slice(base.length):pathname.replace(/^\/+/, '');
 const parts=relative.replace(/(?:\/)?index\.html$/,'').replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);
 const locale=LOCALES.includes(parts[0])?parts.shift():null;
 return {locale,path:parts.join('/')};
}
export function localizedURL(path,locale,root,query=''){
 const clean=String(path).replace(/^\/+|\/+$/g,'');
 if(clean.split('/').some(p=>p==='..'||p==='.')||clean.includes('://'))throw Error('Invalid local route');
 const prefix=normalizeLocale(locale),url=new URL((prefix?prefix+'/':'')+(clean?clean+'/':''),root);
 url.search=new URLSearchParams(query).toString();url.searchParams.delete('lang');return url;
}
export function localeFromEnvironment(url,root,{storage,languages=[]}={}){
 const parts=locationParts(url.pathname,root.pathname);
 return chooseLocale({query:url.searchParams.get('lang'),pathname:parts.locale,saved:readPreference(storage),languages});
}
export function translateStatic(scope=document){
 for(const element of scope.querySelectorAll('[data-i18n]'))element.textContent=t(element.dataset.i18n);
 for(const [data,attribute] of [['data-i18n-aria','aria-label'],['data-i18n-tip','data-tip'],['data-i18n-placeholder','placeholder']]){
  for(const element of scope.querySelectorAll(`[${data}]`))element.setAttribute(attribute,t(element.getAttribute(data)));
 }
}
