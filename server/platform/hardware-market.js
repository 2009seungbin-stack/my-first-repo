// @ts-check
/** Server-only marketplace access. No scraping, private endpoints or browser credentials.
 * Browse returns active asking prices, not completed transactions. eBay price statistics stay
 * disabled until the operator has separate written permission for that use (docs/n2/hardware-tools.md).
 */
import {MARKETS,marketOf,quantile} from '../../src/hardware/market.js';
import {allowRequest} from '../ratelimit.js';
import {readBody} from '../http.js';

/** @typedef {{id:string,title:string,url:string,price:number,shipping:number|null,currency:string}} Listing */
/** @typedef {{status:string,country:string,query:string,source:string|null,observedAt:string|null,items:Listing[],excluded:number,summary:null|{count:number,median:number,q1:number,q3:number},cached:boolean}} Snapshot */
/** @type {Map<string,{value:Snapshot,until:number}>} */ const snapshots=new Map();
/** @type {Map<string,Promise<Snapshot>>} */ const pending=new Map();
/** @type {Map<string,{secret:string,token:string,until:number}>} */ const tokens=new Map();
const MAX_ITEMS=50,TTL=300e3;
/** @param {string} country @param {string} query @param {string} status @returns {Snapshot} */
const empty=(country,query,status)=>({status,country,query,source:marketOf(country).ebay?'eBay':null,observedAt:null,items:[],excluded:0,summary:null,cached:false});
/** @param {string} query */
export function normalizeMarketQuery(query){return query.normalize('NFKC').replace(/\s+/g,' ').trim();}
/** Search a single GPU / CPU, not an arbitrary marketplace category. @param {string} query */
export function hardwareQuery(query){return query.length<=80&&!/[\u0000-\u001f\u007f<>]/.test(query)&&/\b(?:RTX\s*\d{4}|GTX\s*\d{3,4}|RX\s*\d{3,4}|Arc\s*[AB]\d{3}|Ryzen\s*(?:[3579]\s*)?\d{4,5}[A-Z0-9]*|(?:Core\s*)?i[3579][ -]\d{4,5}[A-Z]*|Core\s*Ultra\s*[579]\s*\d{3}[A-Z]*)\b/i.test(query);}
/** A conservative title filter, not a condition guarantee. Keep every accepted price including
 * outliers; exclude ambiguous variants, bundles, wanted ads and parts-only listings by title.
 * @param {string} title @param {string} query */
export function comparableTitle(title,query){
 const flat=(/** @type {string} */ s)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 if(/(?:laptop|notebook|desktop|gaming\s*pc|complete\s*(?:pc|system)|motherboard|bundle|for\s*parts|parts\s*only|not\s*working|broken|defective|empty\s*box|box\s*only|wanted|buying|sealed|brand\s*new|노트북|데스크탑|완본체|본체|메인보드|세트|고장|불량|부품용|박스만|삽니다|구매합니다|미개봉)/i.test(title))return false;
 // 4060 does not match 4060 Ti, 5600 does not match 5600X, and 4060 does not match 40600.
 const model=query.match(/(?:RTX|GTX|RX)\s*(\d{3,4})(?:\s*(Ti|Super|XTX|XT))?|Arc\s*([AB]\d{3})|Ryzen\s*(?:[3579]\s*)?(\d{4,5}(?:X3D|X|G|F)?)|(?:Core\s*)?(i[3579][ -]\d{4,5}[A-Z]*)|Core\s*Ultra\s*[579]\s*(\d{3}[A-Z]*)/i);
 if(!model)return false;
 const family=model[1]?model[0].match(/^(RTX|GTX|RX)/i)?.[0]||'':model[3]?'Arc':model[4]?'Ryzen':'';
 const product=model[1]?model[1]+(model[2]||''):model[3]||model[4]||model[5]||model[6];
 const found=title.match(new RegExp(family?`${family}\\s*(?:[3579]\\s+)?([AB]?\\d{3,5}(?:\\s*(?:X3D|XTX|SUPER|TI|XT|X|G|F))?)(?![A-Z0-9])`:model[5]?'(i[3579][ -]\\d{4,5}[A-Z]*)\\b':'(\\d{3}[A-Z]*)\\b', 'i'));
 if(!found||flat(found[1])!==flat(product))return false;
 const capacity=query.match(/\b(\d{1,2})\s*GB\b/i);
 if(capacity&&!new RegExp(`\\b${capacity[1]}\\s*GB\\b`,'i').test(title))return false;
 const extras=query.replace(model[0],'').replace(/\b\d{1,2}\s*GB\b/ig,'').replace(/\b(NVIDIA|GeForce|AMD|Radeon|Intel|Core)\b/ig,'').trim().split(/\s+/).filter(Boolean);
 return extras.every(word=>flat(title).includes(flat(word)));
}
/** @param {unknown} value */
function money(value){if(typeof value!=='string'||!/^\d+(?:\.\d{1,2})?$/.test(value))return null;const n=Number(value);return Number.isFinite(n)&&n>0&&n<=1e9?n:null;}
/** @param {any} payload @param {string} country @param {string} query */
export function normalizeEbayItems(payload,country,query){
 if(!payload||!Array.isArray(payload.itemSummaries))throw new Error('SCHEMA');
 const m=marketOf(country),seen=new Set();/** @type {Listing[]} */ const items=[];let excluded=0;
 for(const r of payload.itemSummaries.slice(0,MAX_ITEMS)){
  let url;try{url=new URL(r.itemWebUrl);}catch{excluded++;continue;}
  const price=money(r.price?.value),title=typeof r.title==='string'?r.title:'';
  if(!title||title.length>500||/[\u0000-\u001f\u007f]/.test(title)||typeof r.itemId!=='string'||seen.has(r.itemId)||url.protocol!=='https:'||url.username||url.password||!MARKETS.some(x=>x.ebay===url.hostname)||!/^\/itm\//.test(url.pathname)||r.price?.currency!==m.currency||r.itemLocation?.country!==m.id||String(r.conditionId)!=='3000'||!r.buyingOptions?.includes('FIXED_PRICE')||!price||!comparableTitle(title,query)){excluded++;continue;}
  seen.add(r.itemId);const shipping=r.shippingOptions?.[0]?.shippingCost;
  const ship=shipping?.currency===m.currency&&shipping.value==='0.00'?0:shipping?.currency===m.currency?money(shipping.value):null;
  items.push({id:r.itemId,title,url:url.href,price,shipping:ship,currency:m.currency});
 }
 return {items,excluded};
}
/** @param {typeof fetch} get @param {string} url @param {RequestInit} [options] */
async function upstream(get,url,options={}){
 const res=await get(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw new Error(res.status===401||res.status===403?'ACCESS':res.status===429?'LIMIT':'UPSTREAM');
 if(!/^application\/json\b/i.test(res.headers.get('content-type')||''))throw new Error('SCHEMA');
 return JSON.parse(await readBody(res,1024*1024));
}
/** @param {any} env @param {typeof fetch} get @param {number} now @param {boolean} [retry] */
async function appToken(env,get,now,retry=false){
 const id=String(env.EBAY_APP_ID),secret=String(env.EBAY_CERT_ID),hit=tokens.get(id);
 if(!retry&&hit?.secret===secret&&hit.until>now)return hit.token;
 const result=await upstream(get,'https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:`Basic ${btoa(id+':'+secret)}`},body:new URLSearchParams({grant_type:'client_credentials',scope:'https://api.ebay.com/oauth/api_scope'}).toString()});
 if(typeof result.access_token!=='string'||!result.access_token||!Number.isFinite(Number(result.expires_in))||Number(result.expires_in)<=60)throw new Error('SCHEMA');
 if(tokens.size>=4)tokens.clear();tokens.set(id,{secret,token:result.access_token,until:now+Math.min(Number(result.expires_in)-60,7200)*1000});return result.access_token;
}
/** @param {any} env @param {string} country @param {string} query @param {{fetch?:typeof fetch,now?:number}} deps @returns {Promise<Snapshot>} */
async function collect(env,country,query,deps){
 const get=deps.fetch||fetch,now=deps.now??Date.now(),m=marketOf(country);
 try{
  const url=new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  url.search=new URLSearchParams({q:query,limit:String(MAX_ITEMS),filter:`conditionIds:{3000},buyingOptions:{FIXED_PRICE},itemLocationCountry:${country}`}).toString();
  const search=async(/** @type {boolean} */ retry)=>upstream(get,url.href,{headers:{Authorization:`Bearer ${await appToken(env,get,now,retry)}`,'X-EBAY-C-MARKETPLACE-ID':`EBAY_${country}`,'Accept-Language':m.locale}});
  let raw;try{raw=await search(false);}catch(e){if(e instanceof Error&&e.message==='ACCESS')raw=await search(true);else throw e;}
  if(raw.errors?.length)throw new Error('UPSTREAM');
  if(raw.total===0&&!raw.itemSummaries)raw.itemSummaries=[];
  const {items,excluded}=normalizeEbayItems(raw,country,query);
  const prices=items.map(r=>r.price).sort((a,b)=>a-b);
  return {...empty(country,query,items.length?'available':'no_results'),observedAt:new Date(now).toISOString(),items,excluded,summary:env.EBAY_PRICE_STATS_APPROVED==='on'&&prices.length>=5?{count:prices.length,median:quantile(prices,.5),q1:quantile(prices,.25),q3:quantile(prices,.75)}:null};
 }catch(e){const msg=e instanceof Error?e.message:'';return empty(country,query,msg==='ACCESS'?'access_denied':msg==='LIMIT'?'rate_limited':'upstream_error');}
}
/** Search-triggered automatic collection, shared five-minute cache; no account/session required.
 * Bound per-network and per-isolate request budgets apply before external calls, not cache hits.
 * @param {Request} request @param {any} env @param {{fetch?:typeof fetch,now?:number}} [deps] @returns {Promise<Snapshot>} */
export async function marketSnapshot(request,env,deps={}){
 const u=new URL(request.url),country=u.searchParams.get('country')||(u.pathname.startsWith('/en/')?'US':'KR'),query=normalizeMarketQuery(u.searchParams.get('q')||'');
 if(!MARKETS.some(m=>m.id===country))return empty(country,query,'invalid_query');
 if(!query)return empty(country,query,'idle');
 if(!hardwareQuery(query))return empty(country,query,'invalid_query');
 if(!marketOf(country).ebay||env.EBAY_BROWSE_APPROVED!=='on'||!env.EBAY_APP_ID||!env.EBAY_CERT_ID)return empty(country,query,'not_connected');
 const now=deps.now??Date.now(),key=[country,query.toLowerCase(),env.EBAY_APP_ID,env.EBAY_PRICE_STATS_APPROVED==='on'].join('|'),hit=snapshots.get(key);
 if(hit&&hit.until>now)return {...hit.value,cached:true};
 if(pending.has(key))return /** @type {Promise<Snapshot>} */(pending.get(key));
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 if(!await allowRequest({env,limiter:undefined,key:`hw-market:${ip}`,limit:10,now})||!await allowRequest({env,limiter:undefined,key:'hw-market:upstream',limit:100,now}))return empty(country,query,'rate_limited');
 // Recheck after the async limiter so concurrent misses share one OAuth/search request.
 if(pending.has(key))return /** @type {Promise<Snapshot>} */(pending.get(key));
 const task=collect(env,country,query,deps).then(value=>{if(snapshots.size>=256){for(const [k,v] of snapshots)if(v.until<=now)snapshots.delete(k);if(snapshots.size>=256)snapshots.delete(/** @type {string} */(snapshots.keys().next().value));}snapshots.set(key,{value,until:now+(value.observedAt?TTL:30e3)});return value;}).finally(()=>pending.delete(key));
 pending.set(key,task);return task;
}
/** Test isolation; never exposed to a browser. */
export function resetMarketCache(){snapshots.clear();pending.clear();tokens.clear();}
