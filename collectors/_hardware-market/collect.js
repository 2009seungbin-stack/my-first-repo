import {decode,text,modelMatches,gigglePost,frenchPost,rssPosts,parseItems} from './parse.js';
export const SOURCES=Object.freeze([
 {id:'giggle',name:'기글하드웨어',country:'KR',currency:'KRW',host:'gigglehd.com',board:'https://gigglehd.com/gg/index.php?mid=bbs&category=14058'},
 {id:'hardforum',name:'HardForum RSS',country:'US',currency:'USD',host:'hardforum.com',board:'https://hardforum.com/forums/for-sale-trade.17/index.rss'},
 {id:'hardwarefr',name:'Hardware.fr',country:'FR',currency:'EUR',host:'forum.hardware.fr',board:'https://forum.hardware.fr/hfr/AchatsVentes/Hardware/liste_sujet-1.htm'}
]);
const UA='NerulioCollector/1.0 (+https://nerulio.com/about/)';
/** Robots groups for the actual service UA. Longest matching path wins, Allow wins ties. */
export function robotsAllowed(raw,url){
 const groups=[];let group=null,hasRules=false;
 for(const line of raw.split(/\r?\n/)){const m=line.replace(/#.*$/,'').trim().match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);if(!m)continue;const k=m[1].toLowerCase(),v=m[2].trim();
  if(k==='user-agent'){if(!group||hasRules){group={agents:[],rules:[]};groups.push(group);hasRules=false;}group.agents.push(v.toLowerCase());}
  else if(group){group.rules.push({allow:k==='allow',path:v});hasRules=true;}
 }
 const score=g=>Math.max(-1,...g.agents.map(a=>a==='*'?0:'neruliocollector'.includes(a)?a.length:-1));
 const max=Math.max(-1,...groups.map(score)),path=new URL(url).pathname+new URL(url).search;let best=null;
 for(const g of groups.filter(g=>score(g)===max))for(const r of g.rules){if(!r.path)continue;const re=new RegExp('^'+r.path.split('*').map(s=>s.replace(/[.+?^{}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$'));if(re.test(path)&&(!best||r.path.length>best.path.length||r.path.length===best.path.length&&r.allow))best=r;}
 return best?.allow??true;
}
async function bounded(res){const reader=res.body?.getReader();if(!reader)throw Error('EMPTY');const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw Error('SIZE');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return new TextDecoder('utf-8').decode(bytes);}
export function discovery(html,source){
 const found=new Map();
 for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
  const title=text(m[2]);if(!modelMatches(title).length)continue;
  const u=new URL(decode(m[1]),source.board);if(u.hostname!==source.host)continue;
  let id,url;
  if(source.id==='giggle'){id=u.searchParams.get('document_srl');if(u.searchParams.get('category')!=='14058'||!/^\d+$/.test(id||''))continue;url=`https://${source.host}/gg/${id}`;}
  else {id=u.pathname.match(/-sujet_(\d+)_1\.htm$/)?.[1];if(!id||!u.pathname.startsWith('/hfr/AchatsVentes/Hardware/')||!/\[VDS\]/i.test(title))continue;url=u.origin+u.pathname;}
  found.set(id,{id,url});
 }
 return [...found.values()];
}
/** Bounded scheduled work, never called by a visitor. Fail closed on robots/access/parser errors.
 * Feed content is used directly; challenged HardForum HTML is never fetched. */
export async function collectCommunity({fetch:get=fetch,now=Date.now(),db=null,delay=1000,sources=SOURCES}={}){
 const results=[];
 for(const source of sources){
  const result={source:source.id,country:source.country,status:'ok',observedAt:now,items:[],posts:[],fetches:[],excluded:0};
  let robots='',calls=0;
  async function request(url,postId=''){
   const u=new URL(url);if(u.protocol!=='https:'||u.hostname!==source.host||u.username||u.password)throw Error('HOST');
   if(u.pathname!=='/robots.txt'&&!robotsAllowed(robots,url))throw Error('ROBOTS');
   if(calls++&&delay)await new Promise(r=>setTimeout(r,delay));
   const old=postId&&db?await db.prepare('SELECT etag,modified FROM hardware_market_fetches WHERE url=?').bind(url).first():null;
   const headers={'user-agent':UA,accept:'text/html,application/rss+xml,text/plain'};
   if(old?.etag)headers['if-none-match']=old.etag;if(old?.modified)headers['if-modified-since']=old.modified;
   let res,current=url;
   for(let hop=0;hop<3;hop++){
    try{res=await get(current,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{throw Error('NETWORK');}
    if(![301,302,303,307,308].includes(res.status))break;
    const next=new URL(res.headers.get('location')||'',current);await res.body?.cancel();
    if(!postId||source.id!=='giggle'||next.protocol!=='https:'||next.hostname!==source.host||next.username||next.password||!new RegExp(`^/gg/(?:bbs/)?${postId}$`).test(next.pathname)||!robotsAllowed(robots,next.href)||hop===2)throw Error('REDIRECT');
    current=next.href;if(delay)await new Promise(r=>setTimeout(r,delay));
   }
   if(res.status===304&&old){result.posts.push({id:postId,unchanged:true});result.fetches.push({url,postId,etag:old.etag,modified:old.modified});return null;}
   if(!res.ok)throw Error(postId&&[404,410].includes(res.status)?'GONE':res.status===429?'RATE_LIMITED':res.status===403||res.status===401?'ACCESS_DENIED':`HTTP_${res.status}`);
   const type=res.headers.get('content-type')||'';if(!/text\/(?:html|plain)|application\/(?:rss\+xml|xml)/i.test(type))throw Error('CONTENT_TYPE');
   const body=await bounded(res);
   if(postId)result.fetches.push({url,postId,etag:res.headers.get('etag'),modified:res.headers.get('last-modified')});
   return body;
  }
  try{
   robots=await request(`https://${source.host}/robots.txt`);
   if(source.id==='hardforum'){
    const feed=await request(source.board),posts=rssPosts(feed);
    for(const p of posts.slice(0,30)){
     const u=new URL(p.url),id=u.pathname.match(/^\/threads\/[^/]+\.(\d+)\/$/)?.[1];if(u.protocol!=='https:'||u.hostname!==source.host||!id)continue;
     const parsed=parseItems({...p,source:source.id,postId:id,country:source.country,currency:source.currency});result.items.push(...parsed.items);result.excluded+=parsed.excluded;
     // RSS descriptions are truncated: absence of a prior item never retires it.
    }
   }else{
    const posts=new Map();
    for(let page=1;page<=(source.id==='giggle'?3:1);page++){
     const url=page===1?source.board:source.board+`&page=${page}`,board=await request(url);
     if(source.id==='giggle'&&!/data-gg-block-kind="entry"/.test(board)||source.id==='hardwarefr'&&!/sujetCase3/.test(board))throw Error('SCHEMA');
     for(const p of discovery(board,source))posts.set(p.id,p);
    }
    for(const p of [...posts.values()].slice(0,12)){
     let body;try{body=await request(p.url,p.id);}catch(e){if(e.message==='GONE'){result.posts.push({id:p.id,unchanged:false});result.excluded++;continue;}throw e;}if(body===null)continue;
     const post=source.id==='giggle'?gigglePost(body,p.id):frenchPost(body);
     const parsed=parseItems({...post,source:source.id,postId:p.id,url:p.url,country:source.country,currency:source.currency});
     result.posts.push({id:p.id,unchanged:false});result.items.push(...parsed.items);result.excluded+=parsed.excluded;
    }
   }
  }catch(e){result.status=e instanceof Error?e.message:'ERROR';}
  results.push(result);
 }
 return results;
}
