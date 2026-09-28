// @ts-check
/** Collector runtime shared by every source adapter (collectors/<id>/index.js).
 *
 * An adapter is a module whose default export is:
 *   {
 *     id: 'steam-store',            // unique, also the source `adapter`
 *     vertical: 'games',
 *     mode: 'auto',                 // 'manual' = MANUAL_SOURCE: no fetching, admin maintains it
 *     freshnessHours: 24,           // expected cadence; drives stale warnings
 *     hosts: ['store.steampowered.com'],   // the ONLY hosts ctx.fetch may reach (no SSRF by design)
 *     minIntervalMs: 1500,          // politeness delay between requests to the same host
 *     terms: 'https://…',           // the source's terms/robots notes, reviewed by a human
 *     async collect(ctx) { … return seedDocument }   // a nerulio.seed/1 document (+ snapshots)
 *   }
 *
 * collect() returns the SAME format as curated seed data (docs/n2/SEED-FORMAT.md): facts with
 * `ver: 'AUTOMATED'` or `'OFFICIAL'` (when the endpoint is the owner's official API), sources with
 * `adapter` set. The ingest pipeline diffs it against the graph and writes facts/changes.
 * Every fetched body is recorded as a snapshot (url, time, status, sha256, size, small excerpt).
 */

/** @typedef {{url:string,fetched_at:string,http_status:number,content_type:string,checksum:string,byte_size:number,excerpt?:unknown,error?:string,source:string}} SnapshotRecord */

const UA='NerulioCollector/1.0 (+https://nerulio.com/about/)';
const sleep=(/** @type {number} */ ms)=>new Promise(r=>setTimeout(r,ms));
async function sha256Hex(/** @type {ArrayBuffer} */ buf){
 const d=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,'0')).join('');
}

/**
 * Build the context an adapter receives.
 * @param {{hosts:string[],minIntervalMs?:number,id:string}} adapter
 * @param {{fetch?:typeof fetch,now?:()=>number,log?:(m:string)=>void,maxBytes?:number,targets?:any[]}} [opts]
 */
export function collectorContext(adapter,opts={}){
 const doFetch=opts.fetch||fetch,now=opts.now||Date.now,log=opts.log||(()=>{}),maxBytes=opts.maxBytes||8*1024*1024;
 const allowed=new Set(adapter.hosts);/** @type {Map<string,number>} */const last=new Map();
 /** @type {SnapshotRecord[]} */const snapshots=[];
 /**
  * Fetch an allowlisted https URL; returns {status, text, json(), snapshotIndex}.
  * @param {string} url @param {{source:string,accept?:string,excerpt?:(body:string)=>unknown}} o
  */
 async function get(url,o){
  const u=new URL(url);
  if(u.protocol!=='https:'||!allowed.has(u.hostname))throw Error(`${adapter.id}: host not allowlisted: ${u.hostname}`);
  const wait=(last.get(u.hostname)||0)+(adapter.minIntervalMs??1000)-now();if(wait>0)await sleep(wait);
  last.set(u.hostname,now());
  const fetchedAt=new Date(now()).toISOString();
  /** @type {SnapshotRecord} */let snap;
  try{
   const res=await doFetch(u.href,{headers:{'user-agent':UA,accept:o.accept||'application/json, text/html;q=0.8, */*;q=0.5'},redirect:'follow'});
   const buf=await res.arrayBuffer();
   if(buf.byteLength>maxBytes)throw Error(`response too large (${buf.byteLength} bytes)`);
   const text=new TextDecoder().decode(buf);
   snap={source:o.source,url:u.href,fetched_at:fetchedAt,http_status:res.status,content_type:res.headers.get('content-type')||'',checksum:await sha256Hex(buf),byte_size:buf.byteLength};
   if(o.excerpt&&res.ok){try{snap.excerpt=o.excerpt(text);}catch(e){snap.error='excerpt: '+String(e).slice(0,200);}}
   snapshots.push(snap);
   return {status:res.status,ok:res.ok,text,json:()=>JSON.parse(text),snapshotIndex:snapshots.length-1};
  }catch(e){
   snapshots.push({source:o.source,url:u.href,fetched_at:fetchedAt,http_status:0,content_type:'',checksum:'',byte_size:0,error:String(e).slice(0,500)});
   log(`${adapter.id}: ${u.href} failed: ${e}`);
   throw e;
  }
 }
 return {get,snapshots,now,log,targets:opts.targets||[]};
}

/** Run one adapter; always returns {doc, snapshots, error} (never throws), for health tracking. */
export async function runAdapter(/** @type {any} */ adapter,/** @type {any} */ opts={}){
 const ctx=collectorContext(adapter,opts),started=Date.now();
 if(adapter.mode==='manual')return {doc:null,snapshots:[],error:null,started,finished:Date.now(),manual:true};
 try{
  const doc=await adapter.collect(ctx);
  return {doc,snapshots:ctx.snapshots,error:null,started,finished:Date.now()};
 }catch(e){
  return {doc:null,snapshots:ctx.snapshots,error:String(/** @type {any} */(e)?.stack||e).slice(0,2000),started,finished:Date.now()};
 }
}
