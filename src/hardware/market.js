// @ts-check
/** Country = the selected local marketplace and its currency, not the seller's location.
 * External links open public searches; automatic feeds run only on the server. */
export const MARKETS=Object.freeze([
 {id:'KR',ko:'한국',en:'South Korea',currency:'KRW',locale:'ko-KR',ebay:null},
 {id:'JP',ko:'일본',en:'Japan',currency:'JPY',locale:'ja-JP',ebay:null},
 {id:'US',ko:'미국',en:'United States',currency:'USD',locale:'en-US',ebay:'www.ebay.com'},
 {id:'GB',ko:'영국',en:'United Kingdom',currency:'GBP',locale:'en-GB',ebay:'www.ebay.co.uk'},
 {id:'DE',ko:'독일',en:'Germany',currency:'EUR',locale:'de-DE',ebay:'www.ebay.de'},
 {id:'FR',ko:'프랑스',en:'France',currency:'EUR',locale:'fr-FR',ebay:'www.ebay.fr'},
 {id:'CA',ko:'캐나다',en:'Canada',currency:'CAD',locale:'en-CA',ebay:'www.ebay.ca'},
 {id:'AU',ko:'호주',en:'Australia',currency:'AUD',locale:'en-AU',ebay:'www.ebay.com.au'},
]);
/** @param {string|null|undefined} id */
export const marketOf=id=>MARKETS.find(m=>m.id===id)||MARKETS[0];
/** @param {string} country @param {string} query */
export function marketLinks(country,query){
 const m=marketOf(country),q=query.trim().slice(0,80);
 if(!q)return [];
 if(m.id==='KR')return [
  {name:'중고나라',kind:'asking',url:`https://web.joongna.com/search/${encodeURIComponent(q)}`},
  {name:'번개장터',kind:'asking',url:`https://m.bunjang.co.kr/search/products?q=${encodeURIComponent(q)}`},
 ];
 if(m.id==='JP')return [{name:'Mercari',kind:'mixed',url:`https://jp.mercari.com/search?keyword=${encodeURIComponent(q)}`}];
 const base=`https://${m.ebay}/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_ItemCondition=3000`;
 return [{name:'eBay',kind:'asking',url:base},{name:'eBay',kind:'sold',url:base+'&LH_Sold=1&LH_Complete=1'}];
}
/** Parse ONE price, using the selected market's separators. Reject negatives, ranges, titles,
 * invalid grouping, extra decimal places and ambiguous lists instead of guessing.
 * @param {string} text @param {string} country @returns {number|null} */
export function parsePrice(text,country){
 const m=marketOf(country),decimal=['DE','FR'].includes(m.id)?',':'.',group=m.id==='DE'?'.':m.id==='FR'?' ':',';
 const esc=(/** @type {string} */ x)=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const symbols=/** @type {Record<string,string[]>} */({KRW:['₩'],JPY:['¥','￥'],USD:['$'],GBP:['£'],EUR:['€'],CAD:['CA$','$'],AUD:['A$','$']});
 const suffix=(m.currency==='KRW'?'KRW|원':m.currency==='JPY'?'JPY|円':m.currency)+'|'+symbols[m.currency].map(esc).join('|');
 let s=text.trim().replace(/[\u00a0\u202f]/g,' ').replace(new RegExp(`^(?:${symbols[m.currency].map(esc).join('|')})\\s*`),'').replace(new RegExp(`\\s*(?:${suffix})$`,'i'),'');
 const digits=`(?:\\d+|\\d{1,3}(?:${esc(group)}\\d{3})+)`,frac=['KRW','JPY'].includes(m.currency)?'':`(?:${esc(decimal)}\\d{1,2})?`;
 if(!new RegExp(`^${digits}${frac}$`).test(s))return null;
 s=s.split(group).join('').replace(decimal,'.');
 const n=Number(s);return Number.isFinite(n)&&n>0&&n<=1e12?n:null;
}
/** Linear interpolation, explicitly displayed as Q1/Q3 (central 50%), not confidence bounds.
 * @param {number[]} sorted @param {number} p */
export function quantile(sorted,p){const i=(sorted.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);}
/** @param {string} text @param {string} country */
export function priceSummary(text,country){
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(!lines.length)return {error:'empty',lines:[]};
 if(lines.length>200)return {error:'limit',lines:[]};
 const values=lines.map(s=>parsePrice(s,country));
 const bad=values.flatMap((n,i)=>n===null?[i+1]:[]);
 if(bad.length)return {error:'invalid',lines:bad};
 const sorted=/** @type {number[]} */(values).sort((a,b)=>a-b);
 return {error:null,lines:[],count:sorted.length,median:quantile(sorted,.5),q1:quantile(sorted,.25),q3:quantile(sorted,.75),min:sorted[0],max:sorted.at(-1)};
}
/** @param {number} value @param {string} country */
export function localMoney(value,country){const m=marketOf(country);return new Intl.NumberFormat(m.locale,{style:'currency',currency:m.currency,maximumFractionDigits:['KRW','JPY'].includes(m.currency)?0:2}).format(value);}
