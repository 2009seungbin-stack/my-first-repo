#!/usr/bin/env node
/** Audit the Worker-rendered search pages against an isolated, freshly seeded local D1 shim.
 * No network, production database or account is used. Complements audit-seo.py (static HTML). */
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {D1Shim} from '../tests/d1-shim.mjs';
import {seedDatabase} from './platform/seed-db.mjs';
import {renderSitemap,renderPlatformPage} from '../server/platform/pages.js';
import {VERTICALS} from '../platform/schema.js';
import {pageProblems} from './live-check.mjs';

const decode=s=>s.replace(/&(amp|quot|apos|lt|gt);/g,(_,x)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[x]);
const tags=(s,tag)=>[...s.matchAll(new RegExp(`<${tag}\\b[^>]*>`,'gi'))].map(x=>x[0]);
const attr=(s,name)=>decode(s.match(new RegExp(`\\s${name}="([^"]*)"`,'i'))?.[1]||'');
export function sitemapURLs(xml){return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>decode(x[1]));}
/** @param {string} url @param {string} html */
export function platformMarkupProblems(url,html){
 const out=[];
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'';
 if(tags(head,'title').length!==1)out.push('expected one title');
 if(tags(html,'h1').length!==1)out.push('expected one H1');
 const descriptions=tags(head,'meta').filter(x=>attr(x,'name')==='description');
 if(descriptions.length!==1||!attr(descriptions[0],'content').trim())out.push('missing or duplicate description');
 try{
  for(const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)){
   const data=JSON.parse(m[1]),nodes=data['@graph']||[data];
   for(const n of nodes){
    if(typeof n['@type']==='string'&&/^(WebPage|CollectionPage|ItemPage|AboutPage)$/.test(n['@type'])&&n.url&&n.url!==url)out.push('structured page URL differs from canonical');
   }
  }
 }catch{out.push('invalid JSON-LD');}
 return out;
}
/** @param {{origin?:string,now?:number}} [options] */
export async function auditPlatformSEO({origin='https://nerulio.com',now=Date.now()}={}){
 const db=D1Shim.migrated(),errors=[],pages=new Map(),sitemaps={};
 try{
  await seedDatabase(db,undefined,now-2*864e5);
  for(const v of VERTICALS){
   const urls=sitemapURLs(await renderSitemap(db,v,origin));sitemaps[v]=urls.length;
   for(const url of urls){if(pages.has(url))errors.push(`${url}: duplicate sitemap URL`);else pages.set(url,null);}
  }
  const details=new Map();
  for(const url of pages.keys()){
   const res=await renderPlatformPage(new Request(url),{DB:db},{origin,now:()=>now});
   const html=res?await res.text():'';
   const problems=pageProblems(url,{status:res?.status||404,headers:res?Object.fromEntries(res.headers):{},html},origin);
   if(res?.status===200)problems.push(...platformMarkupProblems(url,html));
   errors.push(...problems.map(x=>`${url}: ${x}`));
   details.set(url,new Map(tags(html,'link').filter(x=>attr(x,'rel')==='alternate'&&attr(x,'hreflang')).map(x=>[attr(x,'hreflang'),attr(x,'href')])));
  }
  for(const [url,alts] of details){
   for(const [lang,target] of alts){
    if(!pages.has(target))errors.push(`${url}: ${lang} alternate is absent from the indexable sitemap: ${target}`);
    else{
     const back=details.get(target);
     if(back&&JSON.stringify([...back].sort())!==JSON.stringify([...alts].sort()))errors.push(`${url}: nonreciprocal ${lang} alternate`);
    }
   }
  }
  for(const route of ['/?sort=new','/ko/search/?q=claude','/ko/community/ai/?sort=hot']){
   const res=await renderPlatformPage(new Request(origin+route),{DB:db},{origin,now:()=>now});
   const html=res?await res.text():'';
   if(res?.status!==200||!tags(html,'meta').some(x=>attr(x,'name')==='robots'&&/noindex/i.test(attr(x,'content'))))errors.push(`${route}: filtered page is not noindex`);
  }
  return {source:'isolated local seed; no production reads',pages:pages.size,sitemaps,errors};
 }finally{db.raw.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await auditPlatformSEO();
 await mkdir('test-results',{recursive:true});await writeFile('test-results/platform-seo-audit.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,errors:result.errors.slice(0,25)},null,2));
 if(result.errors.length){console.error(`${result.errors.length} errors; see test-results/platform-seo-audit.json`);process.exitCode=1;}
}
