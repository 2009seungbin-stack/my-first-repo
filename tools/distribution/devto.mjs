/** Official Forem V1: https://developers.forem.com/api/v1 (reviewed 2026-09-28).
 * Never retry POST automatically. Never log response bodies, request headers or upstream errors. */
export function devto({apiKey,fetchImpl=fetch}={}){
 if(!apiKey)throw Error('DEVTO_API_KEY is required for remote mode');
 async function request(method,endpoint,body){
  let r;try{r=await fetchImpl('https://dev.to/api'+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{'api-key':apiKey,accept:'application/vnd.forem.api-v1+json','content-type':'application/json','user-agent':'NerulioDistribution/1.0'},...(body?{body:JSON.stringify(body)}:{})});}catch{throw Error('DEV request failed or timed out; reconcile before retry');}
  if(!r.ok)throw Error(`DEV HTTP ${r.status}; response withheld`);
  try{return await r.json();}catch{throw Error('DEV returned malformed JSON; reconcile before retry');}
 }
 function normalize(a){
  let u;try{u=new URL(a?.url);}catch{throw Error('Malformed DEV article URL');}
  if(!Number.isSafeInteger(a.id)||a.id<1||u.origin!=='https://dev.to'||u.username||u.password||(a.canonical_url!==null&&typeof a.canonical_url!=='string')||typeof a.title!=='string'||!Object.hasOwn(a,'published_at')||(a.published_at!==null&&!Number.isFinite(Date.parse(a.published_at))))throw Error('Malformed DEV article response');
  return {id:a.id,url:a.url,canonical:a.canonical_url,title:a.title,publishedAt:a.published_at};
 }
 return {
  async all(){
   const out=[],ids=new Set();
   for(let page=1;page<=1000;page++){
    const data=await request('GET',`/articles/me/all?page=${page}&per_page=100`);
    if(!Array.isArray(data))throw Error('Malformed DEV article list');
    if(!data.length)return out;
    for(const raw of data){const a=normalize(raw);if(ids.has(a.id))throw Error('DEV pagination repeated an article; retry read later');ids.add(a.id);out.push(a);}
   }
   throw Error('DEV pagination limit reached; cannot establish duplicate safety');
  },
  async submit(article,{published=false,id=null}={}){
   const payload={article:{title:article.title,body_markdown:article.body_markdown,canonical_url:article.canonical_url,tags:article.tags.join(','),published}};
   const result=normalize(await request(id?'PUT':'POST',id?`/articles/${id}`:'/articles',payload));
   if(result.canonical!==article.canonical_url||Boolean(result.publishedAt)!==published||(id&&result.id!==id))throw Error('DEV mutation response mismatch; reconcile before retry');
   return result;
  },
  async read(id){
   if(!Number.isSafeInteger(id)||id<1)throw Error('Invalid DEV article ID');
   const a=await request('GET',`/articles/${id}`),normalized=normalize(a);
   if(normalized.id!==id||typeof a.body_markdown!=='string')throw Error('Malformed DEV article detail');
   return {...normalized,body:a.body_markdown};
  }
 };
}
export function reconcile(ledger,remote,pages){
 for(const p of pages){
  const matches=remote.filter(a=>a.canonical===p.canonical),old=ledger.entries.find(e=>e.sourceRoute===p.route);
  if(matches.length>1)throw Error('Multiple DEV articles share a source canonical; operator reconciliation required');
  if(!matches.length)continue;
  const a=matches[0];
  if(old?.externalId&&old.externalId!==a.id)throw Error('DEV identity changed; operator reconciliation required');
  if(old?.publishedAt&&!a.publishedAt)throw Error('Previously published article is now a draft; operator reconciliation required');
  const e=old||{sourceRoute:p.route,sourceCanonical:p.canonical,platform:'devto',createdAt:new Date().toISOString(),lastAttemptAt:null,contentHash:null,fingerprint:null,topicCluster:p.topicCluster};
  Object.assign(e,{generatedTitle:a.title,externalId:a.id,externalUrl:a.url,publishedAt:a.publishedAt,status:a.publishedAt?'published':'draft',uncertain:false,error:null});
  if(!old)ledger.entries.push(e);
 }
 return ledger;
}
