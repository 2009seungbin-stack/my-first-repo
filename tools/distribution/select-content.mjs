import {normalizeRoute} from './common.mjs';
export function selectContent(pages,ledger,{route,force=false,now=new Date()}={}){
 const recent=ledger.entries.filter(e=>e.publishedAt&&Date.parse(e.publishedAt)>+now-28*864e5).map(e=>e.topicCluster);
 const candidates=pages.filter(p=>p.articleReady&&(!p.alreadyDistributed||force)&&(!route||p.route===normalizeRoute(route)));
 candidates.sort((a,b)=>Number(recent.includes(a.topicCluster))-Number(recent.includes(b.topicCluster))||a.priority-b.priority||(a.route<b.route?-1:a.route>b.route?1:0));
 if(route&&!candidates.length)throw Error('Requested source is missing, unreviewed, changed or already published');
 return candidates[0]||null;
}
