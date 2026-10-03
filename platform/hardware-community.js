// @ts-check
import {quantile} from '../src/hardware/market.js';
/** @param {any} db @param {any[]} results */
export async function saveCommunity(db,results){
 for(const r of results){
  // A failed source must not advance freshness, retire inventory or commit partial facts.
  if(r.status==='ok'){
   for(const p of r.posts){
    if(p.unchanged)await db.prepare('UPDATE hardware_market_items SET last_seen=? WHERE source=? AND post_id=? AND active=1').bind(r.observedAt,r.source,p.id).run();
    else await db.prepare('UPDATE hardware_market_items SET active=0 WHERE source=? AND post_id=? AND active=1').bind(r.source,p.id).run();
   }
   for(const i of r.items){
    const fingerprint=JSON.stringify([i.model,i.capacity,i.price,i.shipping,i.basis]),old=await db.prepare('SELECT fingerprint FROM hardware_market_items WHERE id=?').bind(i.id).first();
    if(old?.fingerprint!==fingerprint)await db.prepare('INSERT OR IGNORE INTO hardware_market_revisions(item_id,fingerprint,observed_at,price,shipping,basis) VALUES(?,?,?,?,?,?)').bind(i.id,fingerprint,r.observedAt,i.price,i.shipping,i.basis).run();
    await db.prepare(`INSERT INTO hardware_market_items(id,source,post_id,url,country,currency,model,capacity,price,shipping,basis,fingerprint,first_seen,changed_at,last_seen,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
     ON CONFLICT(id) DO UPDATE SET price=excluded.price,shipping=excluded.shipping,basis=excluded.basis,changed_at=CASE WHEN hardware_market_items.fingerprint!=excluded.fingerprint THEN excluded.changed_at ELSE hardware_market_items.changed_at END,fingerprint=excluded.fingerprint,last_seen=excluded.last_seen,active=1`).bind(i.id,i.source,i.postId,i.url,i.country,i.currency,i.model,i.capacity,i.price,i.shipping,i.basis,fingerprint,r.observedAt,r.observedAt,r.observedAt).run();
   }
   for(const f of r.fetches)await db.prepare('INSERT INTO hardware_market_fetches(url,source,post_id,etag,modified,checked_at) VALUES(?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET etag=excluded.etag,modified=excluded.modified,checked_at=excluded.checked_at').bind(f.url,r.source,f.postId,f.etag,f.modified,r.observedAt).run();
  }
  await db.prepare(`INSERT INTO hardware_market_sources(source,country,attempted_at,success_at,status,accepted,excluded) VALUES(?,?,?,?,?,?,?) ON CONFLICT(source) DO UPDATE SET attempted_at=excluded.attempted_at,success_at=CASE WHEN excluded.status='ok' THEN excluded.success_at ELSE hardware_market_sources.success_at END,status=excluded.status,accepted=excluded.accepted,excluded=excluded.excluded`).bind(r.source,r.country,r.observedAt,r.status==='ok'?r.observedAt:null,r.status,r.status==='ok'?r.items.length:0,r.excluded).run();
 }
 // Keep bounded facts/history. No source bodies or identities have ever entered these tables.
 const cutoff=Date.now()-180*86400e3;
 await db.prepare('DELETE FROM hardware_market_revisions WHERE observed_at<?').bind(cutoff).run();
 await db.prepare('DELETE FROM hardware_market_items WHERE last_seen<?').bind(cutoff).run();
 await db.prepare('DELETE FROM hardware_market_fetches WHERE checked_at<?').bind(cutoff).run();
}
const NAMES=/** @type {Record<string,string>} */({giggle:'기글하드웨어',hardforum:'HardForum RSS',hardwarefr:'Hardware.fr'});
/** @param {any} db @param {string} country @param {string} query @param {URLSearchParams} params @param {number} now @param {(title:string,query:string)=>boolean} matches */
export async function communitySnapshot(db,country,query,params,now,matches){
 if(!db||!['KR','US','FR'].includes(country))return null;
 const basis=params.get('basis')==='sold'?'sold':'asking',days=['7','30','90'].includes(params.get('days')||'')?Number(params.get('days')):30;
 let sources;try{sources=(await db.prepare('SELECT * FROM hardware_market_sources WHERE country=?').bind(country).all()).results;}catch{return null;}
 if(!sources.length)return null;
 const healthy=sources.filter((/** @type {any} */ s)=>s.status==='ok'&&s.success_at>now-3*86400e3),observed=Math.max(...sources.map((/** @type {any} */ s)=>s.success_at||0));
 const source=sources.map((/** @type {any} */ s)=>NAMES[s.source]||s.source).join(' · ');
 const rows=(await db.prepare(`SELECT * FROM hardware_market_items AS i WHERE country=? AND basis=? AND active=1 AND last_seen>? AND changed_at>? AND (basis='asking' OR EXISTS(SELECT 1 FROM hardware_market_revisions AS r WHERE r.item_id=i.id AND r.basis='asking')) ORDER BY last_seen DESC LIMIT 500`).bind(country,basis,now-3*86400e3,now-days*86400e3).all()).results;
 const items=rows.filter((/** @type {any} */ r)=>healthy.some((/** @type {any} */ s)=>s.source===r.source)&&matches(r.model+(r.capacity?' '+r.capacity+'GB':''),query)).slice(0,50).map((/** @type {any} */ r)=>({id:r.id,title:r.model+(r.capacity?' '+r.capacity+'GB':''),url:r.url,price:r.price,shipping:r.shipping,currency:r.currency,source:NAMES[r.source],basis:r.basis}));
 const prices=items.map((/** @type {any} */ i)=>i.price).sort((/** @type {number} */ a,/** @type {number} */ b)=>a-b);
 const matched=rows.filter((/** @type {any} */ r)=>items.some((/** @type {any} */ i)=>i.id===r.id));
 const comparable=matched.length>0&&new Set(matched.map((/** @type {any} */ r)=>r.capacity+'|'+r.shipping)).size===1&&(!/^(RTX|GTX|RX|Arc)\b/i.test(matched[0].model)||!!matched[0].capacity);
 return {country,query,status:healthy.length?items.length?'available':'no_results':'stale',source,observedAt:observed?new Date(observed).toISOString():null,items,excluded:0,summary:comparable&&prices.length>=5?{count:prices.length,median:quantile(prices,.5),q1:quantile(prices,.25),q3:quantile(prices,.75)}:null,cached:true,community:true,basis,days};
}
