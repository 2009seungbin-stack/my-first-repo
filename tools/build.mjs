import {mkdir,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {LOCALES,locationParts,t} from '../src/i18n.js';
import {INTENTS,intentFor,ROUTES} from '../src/intents.js';
export {ROUTES};
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ALL_ROUTES=['',...ROUTES,...LOCALES.flatMap(l=>[l,...ROUTES.map(r=>`${l}/${r}`)])];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Localized static HTML remains meaningful before JavaScript runs. */
export function entry(html,route='',siteURL=''){
 const parts=locationParts('/'+route),locale=parts.locale||'en',id=intentFor(parts.path),intent=INTENTS[id];
 const depth=route.split('/').filter(Boolean).length,base='../'.repeat(depth)||'./';
 const title=t(`intent.${id}.title`,{},locale)+' · FileForge',description=t(`intent.${id}.description`,{},locale);
 let out=html.replace('<base href="./">',`<base href="${base}">`).replace(/<html lang="[^"]*"/,`<html lang="${locale}"`);
 out=out.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`);
 out=out.replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}">`);
 out=out.replace(/<meta property="og:title"[^>]*>/,`<meta property="og:title" content="${escape(title)}">`).replace(/<meta property="og:description"[^>]*>/,`<meta property="og:description" content="${escape(description)}">`);
 out=out.replace(/<([a-z][\w-]*)([^>]*\bdata-i18n="([^"]+)"[^>]*)>[\s\S]*?<\/\1>/gi,(_,tag,attrs,key)=>`<${tag}${attrs}>${escape(t(key,{},locale))}</${tag}>`);
 for(const [data,attribute]of [['data-i18n-aria','aria-label'],['data-i18n-tip','data-tip'],['data-i18n-placeholder','placeholder']]){
  out=out.replace(new RegExp(`<[^>]*\\b${data}="([^"]+)"[^>]*>`,'g'),(tag,key)=>tag.replace(new RegExp(`${attribute}="[^"]*"`),`${attribute}="${escape(t(key,{},locale))}"`));
 }
 for(const [elementId,key]of [['editorTitle',`intent.${id}.title`],['emptyTitle',`intent.${id}.headline`],['emptySubtitle',`intent.${id}.description`],['pickLabel',intent.accept==='pdf'?'intent.pickPDF':intent.accept==='media'?'intent.pickMedia':intent.accept==='auto'?'shell.open':'intent.pick']]){
  out=out.replace(new RegExp(`(<[a-z][^>]*\\bid="${elementId}"[^>]*>)[\\s\\S]*?(<\\/[a-z][\\w-]*>)`),(whole,a,b)=>a+escape(t(key,{},locale))+b);
 }
 if(siteURL){
  const root=new URL(siteURL.endsWith('/')?siteURL:siteURL+'/');if(!['http:','https:'].includes(root.protocol))throw Error('SITE_URL must use HTTP or HTTPS');
  const target=intent.path?intent.path+'/':'',canonical=new URL(`${locale}/${target}`,root);
  const links=`<link rel="canonical" href="${escape(canonical.href)}">`+LOCALES.map(l=>`<link rel="alternate" hreflang="${l}" href="${escape(new URL(`${l}/${target}`,root).href)}">`).join('')+`<link rel="alternate" hreflang="x-default" href="${escape(new URL(target,root).href)}">`;
  out=out.replace('</head>',links+'\n</head>');
 }
 return out;
}
export async function build({siteURL=process.env.SITE_URL||''}={}){
 const dist=path.join(ROOT,'dist');await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
 for(const f of ['styles.css','experience.css','favicon.svg','src','_headers'])await cp(path.join(ROOT,f),path.join(dist,f),{recursive:true});
 const html=await readFile(path.join(ROOT,'index.html'),'utf8');
 for(const route of ALL_ROUTES){const dir=path.join(dist,route);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),entry(html,route,siteURL));}
 await writeFile(path.join(dist,'.nojekyll'),'');
 await writeFile(path.join(dist,'404.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FileForge · Not found</title><body style="font-family:system-ui;padding:15vh 10vw"><h1>Page not found.</h1><p>Check the address or return to the previous page.</p></body></html>');
 if(siteURL){const root=new URL(siteURL.endsWith('/')?siteURL:siteURL+'/');const urls=ALL_ROUTES.map(r=>`<url><loc>${escape(new URL(r?r+'/':'',root).href)}</loc></url>`).join('');await writeFile(path.join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);}
 console.log(`Built ${ALL_ROUTES.length} static entry pages → dist/`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
