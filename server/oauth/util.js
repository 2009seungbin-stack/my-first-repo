// @ts-check
/** Shared pieces of the provider modules (no imports, so providers and flow can both use them). */
/** @typedef {'google'|'github'|'discord'} ProviderId */
/** Verified facts from the provider. `subject` is the stable account id (Google sub, GitHub numeric id,
 * Discord snowflake) and the only lookup key; `email` is set only when the provider says it is verified.
 * @typedef {{subject:string,email:string|null,name:string|null,handle:string|null}} Profile */
/** @typedef {{ok:true,profile:Profile}|{ok:false,reason:string}} ProfileResult */
/** @typedef {{clientId:string,clientSecret:string}} Credentials */
/** @typedef {(input:string,init?:RequestInit)=>Promise<Response>} Fetch */
/** Maps a provider URL to the one actually called (a local mock in development E2E runs). @typedef {(url:string)=>string} Upstream */
/**
 * @typedef {{id:ProviderId,name:string,
 *  authorizeURL:(o:{clientId:string,redirectURI:string,state:string,challenge:string,nonce:string},upstream:Upstream)=>string,
 *  profile:(o:{code:string,verifier:string,nonce:string,redirectURI:string,credentials:Credentials,now:number,fetch:Fetch,upstream:Upstream})=>Promise<ProfileResult>}} Provider
 */

const TIMEOUT_MS=10e3;
/** One provider request: never throws; status 0 = network error or timeout. JSON bodies only.
 * @param {Fetch} fetcher @param {string} url @param {RequestInit} init @returns {Promise<{status:number,data:any}>} */
export async function call(fetcher,url,init){
 let response;
 try{response=await fetcher(url,{...init,signal:AbortSignal.timeout(TIMEOUT_MS)});}catch{return {status:0,data:null};}
 let data=null;try{data=await response.json();}catch{}
 return {status:response.status,data};
}
/** A failed provider call: the provider is down (5xx, network, timeout) or refused the request. @param {number} status */
export const failure=status=>status===0||status>=500?'unavailable':'exchange';
/** Trimmed display text or null. @param {unknown} v @param {number} max */
export const textOrNull=(v,max)=>typeof v==='string'&&v.trim()?v.trim().slice(0,max):null;
/** A plausible e-mail address or null (display data only; never a lookup key). @param {unknown} v */
export const emailOrNull=v=>typeof v==='string'&&v.length<=320&&/^[^\s@]+@[^\s@]+$/.test(v)?v:null;
