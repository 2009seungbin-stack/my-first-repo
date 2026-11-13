// @ts-check
/** Source-linked publishing feed. Releases already stored by official collectors are independent
 * of the retired discussion UI. No new articles or user posts are created by this read path. */
import {frontPosts,recentVersions} from './db/channel.js';
import {nameOf} from './render/ui.js';

/** @param {unknown} raw */
function sourceURL(raw){try{const u=new URL(String(raw));return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
/** @param {any[]} releases @param {string} l @param {number} now */
export function releaseNews(releases,l,now){
 const seen=new Set(),out=[];
 for(const r of [...releases].sort((a,b)=>b.released_at-a.released_at)){
  const url=sourceURL(r.notes_url),at=Number(r.released_at);
  if(!url||!r.entity?.id||!r.entity.names||!r.version||r.verification!=='OFFICIAL'||!Number.isFinite(at)||at>now||at<now-30*864e5||seen.has(r.entity.id))continue;
  seen.add(r.entity.id);
  out.push({id:`release:${r.entity.id}:${r.version}`,kind:'release',title:l==='ko'?`${nameOf(r.entity,l)} ${r.version} — 출시·업데이트`:`${nameOf(r.entity,l)} ${r.version} — release / update`,created_at:at,url,locale:l,bot:true});
 }
 return out;
}
/** @param {any} db @param {string} l @param {number} [limit] @param {number} [now] */
export async function publishedNews(db,l,limit=6,now=Date.now()){
 const [posts,releases]=await Promise.all([frontPosts(db,{mode:'news',locale:l,limit}),recentVersions(db,{since:now-30*864e5,until:now,limit:160})]);
 return [...posts,...releaseNews(releases,l,now)].sort((a,b)=>b.created_at-a.created_at).slice(0,limit);
}
