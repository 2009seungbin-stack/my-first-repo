// @ts-check
/** Source-linked publishing feed. Releases already stored by official collectors are independent
 * of the retired discussion UI. No new articles or user posts are created by this read path. */
import {frontPosts,recentVersions} from './db/channel.js';
import {nameOf} from './render/ui.js';
import {versionNotes} from './version-source.js';

/** @param {unknown} raw */
function sourceURL(raw){try{const u=new URL(String(raw));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
/** @param {any[]} releases @param {string} l @param {number} now */
export function releaseNews(releases,l,now){
 const seen=new Set(),out=[];
 const rows=releases.map(r=>{const notes=versionNotes(String(r.entity?.id||''),String(r.version||''),r.notes_url);return {r,notes,url:sourceURL(notes.url),at:Number(r.released_at)};})
  .filter(({r,url,at})=>url&&r.entity?.id&&r.entity.names&&r.version&&r.verification==='OFFICIAL'&&Number.isFinite(at)&&at<=now&&at>=now-30*864e5);
 // Tag dates have day precision. Choose the highest version on that recorded day,
 // independently of input arrival/interleaving; a newer recorded day still wins.
 const tags=new Map();
 for(const row of rows)if(row.notes.kind==='tag'){
  const key=row.r.entity.id+'|'+row.at,previous=tags.get(key);
  if(!previous||String(row.r.version).replace(/^v/,'').localeCompare(String(previous.r.version).replace(/^v/,''),undefined,{numeric:true})>0)tags.set(key,row);
 }
 for(const row of rows.sort((a,b)=>b.at-a.at)){
  const {r,notes,url,at}=row;
  if((notes.kind==='tag'&&tags.get(r.entity.id+'|'+at)!==row)||seen.has(r.entity.id))continue;
  seen.add(r.entity.id);
  const suffix=notes.kind==='tag'?(l==='ko'?'소스 태그':'source tag'):(l==='ko'?'출시·업데이트':'release / update');
  out.push({id:`release:${r.entity.id}:${r.version}`,kind:'release',source_kind:notes.kind,title:`${nameOf(r.entity,l)} ${r.version} — ${suffix}`,created_at:at,url,locale:l,bot:true});
 }
 return out;
}
/** @param {any} db @param {string} l @param {number} [limit] @param {number} [now] */
export async function publishedNews(db,l,limit=6,now=Date.now()){
 const [posts,releases]=await Promise.all([frontPosts(db,{mode:'news',locale:l,limit}),recentVersions(db,{since:now-30*864e5,until:now,limit:160})]);
 return [...posts,...releaseNews(releases,l,now)].sort((a,b)=>b.created_at-a.created_at).slice(0,limit);
}
