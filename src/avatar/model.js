import {CATALOG_VERSION,CATEGORIES,IDS,PALETTES} from './catalog.js';

export const DEFAULT=Object.freeze({v:CATALOG_VERSION,seed:1,face:'round',hair:'bob',eyes:'bright',outfit:'hoodie',accessory:'none',background:'transparent',skinPalette:'skin',hairPalette:'dark',outfitPalette:'blue'});
const ID_KEYS=Object.freeze([...CATEGORIES]);
const ALLOWED=Object.freeze({...IDS,skinPalette:PALETTES.skin,hairPalette:PALETTES.hair,outfitPalette:PALETTES.outfit});
const URL_KEYS=Object.freeze([...ID_KEYS,'skinPalette','hairPalette','outfitPalette']);

export function normalize(input={}){
 const state={...DEFAULT};
 for(const key of URL_KEYS)if(ALLOWED[key].includes(input?.[key]))state[key]=input[key];
 if(input?.v===CATALOG_VERSION||Number(input?.v)===CATALOG_VERSION)state.v=CATALOG_VERSION;
 if(input?.seed!==null&&input?.seed!==undefined&&input?.seed!==''){
  const seed=Number(input.seed);
  if(Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff)state.seed=seed;
 }
 return state;
}
export function xorshift32(seed){let x=(seed>>>0)||0x6d2b79f5;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};}
export function randomize(state,locks={},seed=(Date.now()>>>0)){
 const next=normalize({...state,seed}),rnd=xorshift32(seed);
 for(const key of URL_KEYS){
  const value=ALLOWED[key][Math.floor(rnd()*ALLOWED[key].length)];
  const part=key==='skinPalette'?'face':key.endsWith('Palette')?key.slice(0,-7):key;
  if(!locks[key]&&!locks[part])next[key]=value;
 }
 return next;
}
export function serialize(state){
 const s=normalize(state),params=new URLSearchParams();
 params.set('v',String(CATALOG_VERSION));params.set('seed',String(s.seed));
 for(const key of URL_KEYS)params.set(key,s[key]);
 return params.toString();
}
export function parse(search){
 const supplied=String(search||'');
 const raw=supplied.slice(0,2048);
 const p=new URLSearchParams(raw.startsWith('?')?raw.slice(1):raw);
 const input=Object.fromEntries([...URL_KEYS,'v','seed'].map(key=>[key,p.get(key)]));
 const state=normalize(input);
 const versionMismatch=input.v!==null&&Number(input.v)!==CATALOG_VERSION;
 const badValue=URL_KEYS.some(key=>input[key]!==null&&!ALLOWED[key].includes(input[key]));
 const badSeed=input.seed!==null&&(!/^\d{1,10}$/.test(input.seed)||Number(input.seed)>0xffffffff);
 return {state,valid:supplied.length<=2048&&!versionMismatch&&!badValue&&!badSeed,versionMismatch};
}
