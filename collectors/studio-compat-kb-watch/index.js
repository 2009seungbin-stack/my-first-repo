// @ts-check
/** Change watcher for vendor compatibility articles hosted on Zendesk Help Centers.
 *
 * Why: the studio vertical's compatibility rows (plugin/app/interface × macOS/Windows release)
 * are curated by hand from vendor knowledge-base articles ("macOS Golden Gate compatibility",
 * "Windows 11 product compatibility", …). Parsing their free-form tables automatically would be
 * fragile and could invent statuses, so this adapter does NOT write compatibility rows. It only
 * records, per tracked article, the title, `edited_at` and a SHA-256 of the body, so the ingest
 * pipeline / admin can see which curated rows need re-verification when an article changes.
 *
 * Endpoint (documented by Zendesk, public for published articles, no auth):
 *   GET https://{host}/api/v2/help_center/{locale}/articles/{id}.json
 *   https://developer.zendesk.com/api-reference/help_center/help-center-api/articles/#show-article
 * Observed responding for every host below on 2026-09-28 (help.ableton.com's HTML pages sit behind
 * a Cloudflare challenge, the JSON API does not).
 *
 * Output: a nerulio.seed/1 document with one source per article (no entities, no facts). The
 * `cites` list maps each article to the curated seed source ids built from it.
 */

/** @typedef {{host:string,locale:string,id:string,publisher:string,cites:string[]}} Tracked */
/** @type {readonly Tracked[]} */
export const TRACKED=Object.freeze([
 {host:'help.ableton.com',locale:'en-us',id:'115001261150',publisher:'Ableton',cites:['src:ableton-mac-compatibility']},
 {host:'help.ableton.com',locale:'en-us',id:'115001663530',publisher:'Ableton',cites:['src:ableton-live-system-requirements']},
 {host:'help.ableton.com',locale:'en-us',id:'209775965',publisher:'Ableton',cites:['src:ableton-windows-compatibility']},
 {host:'helpcenter.steinberg.de',locale:'en-us',id:'38919570456594',publisher:'Steinberg',cites:['src:steinberg-macos-27-compatibility']},
 {host:'helpcenter.steinberg.de',locale:'en-us',id:'32601471585810',publisher:'Steinberg',cites:['src:steinberg-macos-26-compatibility']},
 {host:'helpcenter.steinberg.de',locale:'en-us',id:'4407350910866',publisher:'Steinberg',cites:['src:steinberg-windows-11-compatibility']},
 {host:'support.presonus.com',locale:'en-us',id:'39570418779277',publisher:'PreSonus',cites:['src:presonus-macos-26-compatibility']},
 {host:'support.izotope.com',locale:'en-us',id:'47669667496333',publisher:'iZotope',cites:['src:izotope-macos-compatibility']},
 {host:'support.izotope.com',locale:'en-us',id:'47669619038349',publisher:'iZotope',cites:['src:izotope-windows-compatibility']},
 {host:'support.arturia.com',locale:'en-us',id:'22274015764380',publisher:'Arturia',cites:['src:arturia-macos-26-compatibility']},
 {host:'support.arturia.com',locale:'en-us',id:'4405748310034',publisher:'Arturia',cites:['src:arturia-instruments-compatibility']},
 {host:'support.plugin-alliance.com',locale:'en-us',id:'52323552569876',publisher:'Plugin Alliance',cites:['src:plugin-alliance-macos-26']},
 {host:'support.plugin-alliance.com',locale:'en-us',id:'52323592156436',publisher:'Plugin Alliance',cites:['src:plugin-alliance-system-requirements']},
 {host:'support.slatedigital.com',locale:'en-us',id:'55408100632723',publisher:'Slate Digital',cites:['src:slate-digital-macos-27']},
 {host:'support.xlnaudio.com',locale:'en-us',id:'6451881314589',publisher:'XLN Audio',cites:['src:xln-audio-system-requirements']},
 {host:'help.uaudio.com',locale:'en-us',id:'210208926',publisher:'Universal Audio',cites:['src:universal-audio-os-compatibility']},
 {host:'support.focusrite.com',locale:'en-gb',id:'12033372452754',publisher:'Focusrite',cites:['src:focusrite-macos-compatibility']},
 {host:'support.focusrite.com',locale:'en-gb',id:'14369604878738',publisher:'Focusrite',cites:['src:focusrite-windows-compatibility']},
 {host:'support.solidstatelogic.com',locale:'en-gb',id:'39240987137693',publisher:'Solid State Logic',cites:['src:ssl-360-macos-27']},
 {host:'support.solidstatelogic.com',locale:'en-gb',id:'4408964173073',publisher:'Solid State Logic',cites:['src:ssl-2-compatibility']},
 {host:'support.audient.com',locale:'en-us',id:'47496148269204',publisher:'Audient',cites:['src:audient-macos-26-announcement']},
 {host:'support.audient.com',locale:'en-us',id:'7931530978196',publisher:'Audient',cites:['src:audient-id-range-compatibility']},
]);
export const articleUrl=(/** @type {Tracked} */ t)=>`https://${t.host}/api/v2/help_center/${t.locale}/articles/${t.id}.json`;
export const watchSourceId=(/** @type {Tracked} */ t)=>`src:kbwatch-${t.host.replace(/[^a-z0-9]+/g,'-')}-${t.id}`;
const ISO=/^\d{4}-\d\d-\d\dT/;

async function sha256Hex(/** @type {string} */ s){
 const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
 return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');
}

/**
 * Pure-ish transform (async only for hashing): article JSON → source record.
 * @param {Tracked} t @param {any} json @param {{retrieved:string}} o
 */
export async function toSource(t,json,o){
 const a=json?.article;
 if(!a||typeof a!=='object')throw Error(`${t.host}/${t.id}: no "article" object`);
 if(String(a.id)!==t.id)throw Error(`${t.host}/${t.id}: unexpected article id ${a.id}`);
 const html=String(a.html_url||'');
 const url=html.startsWith(`https://${t.host}/`)?html:`https://${t.host}/hc/${t.locale}/articles/${t.id}`;
 const edited=ISO.test(String(a.edited_at||''))?String(a.edited_at):null;
 const hash=(await sha256Hex(String(a.body||''))).slice(0,16);
 return {
  id:watchSourceId(t),kind:'OFFICIAL_API',url,title:String(a.title||'').slice(0,300)||`Article ${t.id}`,publisher:t.publisher,retrieved:o.retrieved,adapter:'studio-compat-kb-watch',
  note:`edited_at=${edited||'unknown'}; body_sha256_16=${hash}; re-verify rows citing ${t.cites.join(', ')} when this changes.`,
 };
}

export default {
 id:'studio-compat-kb-watch',
 vertical:'studio',
 mode:'auto',
 freshnessHours:24,
 hosts:[...new Set(TRACKED.map(t=>t.host))],
 minIntervalMs:1500,
 terms:'Zendesk Help Center API, public read access to published articles (https://developer.zendesk.com/api-reference/help_center/help-center-api/articles/). One request per tracked article per run; only metadata and a body hash are stored.',
 /** @param {{get:(url:string,o:{source:string,accept?:string,excerpt?:(b:string)=>unknown})=>Promise<{ok:boolean,status:number,json:()=>any}>,now:()=>number,log:(m:string)=>void}} ctx */
 async collect(ctx){
  const retrieved=new Date(ctx.now()).toISOString().slice(0,10);
  const sources=[];let failed=0;
  for(const t of TRACKED){
   try{
    const res=await ctx.get(articleUrl(t),{source:watchSourceId(t),accept:'application/json',excerpt:b=>{const a=JSON.parse(b).article;return {title:a.title,edited_at:a.edited_at,updated_at:a.updated_at};}});
    if(!res.ok){failed++;ctx.log(`${t.host}/${t.id}: HTTP ${res.status}`);continue;}
    sources.push(await toSource(t,res.json(),{retrieved}));
   }catch(e){failed++;ctx.log(`${t.host}/${t.id}: ${e}`);}
  }
  if(!sources.length)throw Error(`all ${TRACKED.length} tracked articles failed`);
  if(failed)ctx.log(`${failed} of ${TRACKED.length} tracked articles failed`);
  return {schema:'nerulio.seed/1',vertical:'studio',sources,entities:[]};
 },
};
