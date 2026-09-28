import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {configuration} from './site-config.mjs';
/** Production smoke check: reads the LIVE site, not dist/. CI builds with a test origin, so a wrong
 * Cloudflare SITE_URL, a stale deploy or an edge rewrite (Cloudflare Email Address Obfuscation turned
 * "hero@2x.png" into "[email protected]") passes every build check; this catches it after the deploy.
 *
 *   SITE_URL=https://nerulio.com/ node tools/live-check.mjs
 *   LEGACY_ORIGINS="https://nerulio.pages.dev/ …"   hosts that must 301/308 to the same path on SITE_URL
 *
 * .github/workflows/indexnow.yml runs it after every production deploy. Exits nonzero on any problem. */
const attr=(tag,name)=>tag.match(new RegExp(`\\s${name}="([^"]*)"`,'i'))?.[1]??null;
const tags=(html,re)=>[...html.matchAll(re)].map(m=>m[0]);
/** Problems of one live sitemap page: status, noindex, canonical/og:url/hreflang origin, edge rewrites. */
export function pageProblems(url,{status,headers={},html=''},siteURL){
 const site=new URL(siteURL).origin,out=[];
 if(status!==200)return [`HTTP ${status}${headers.location?' → '+headers.location:''}`];
 if(/noindex/i.test(headers['x-robots-tag']||''))out.push('X-Robots-Tag noindex');
 if(tags(html,/<meta\b[^>]*\bname="robots"[^>]*>/gi).some(t=>/noindex/i.test(attr(t,'content')||'')))out.push('meta robots noindex');
 const canonical=tags(html,/<link\b[^>]*\brel="canonical"[^>]*>/gi).map(t=>attr(t,'href'));
 if(canonical.length!==1)out.push(`${canonical.length} canonical links`);else if(canonical[0]!==url)out.push(`canonical ${canonical[0]}`);
 const og=tags(html,/<meta\b[^>]*\bproperty="og:url"[^>]*>/gi).map(t=>attr(t,'content'));
 if(og.some(v=>v!==url))out.push(`og:url ${og.join(' ')}`);
 const foreign=tags(html,/<link\b[^>]*\bhreflang="[^"]*"[^>]*>/gi).map(t=>attr(t,'href')).filter(h=>!h||new URL(h).origin!==site);
 if(foreign.length)out.push(`hreflang off-origin ${foreign.join(' ')}`);
 if(/__cf_email__|\/cdn-cgi\/l\/email-protection/.test(html))out.push('text rewritten by Cloudflare Email Address Obfuscation');
 return out;
}
const locs=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
async function get(u){
 const r=await fetch(u,{redirect:'manual',cache:'no-store',headers:{'User-Agent':'nerulio-live-check'}});
 return {status:r.status,headers:Object.fromEntries(r.headers),html:r.status===200?await r.text():''};
}
async function pool(items,n,fn){const out=[];let i=0;await Promise.all(Array.from({length:n},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k]);}}));return out;}
export async function liveCheck(siteURL,legacy=[]){
 const site=new URL(siteURL),errors=[],fail=(where,what)=>errors.push(`${where}: ${what}`);
 const robots=await get(new URL('robots.txt',site));
 if(robots.status!==200)fail('robots.txt',`HTTP ${robots.status}`);
 else{
  if(/^Disallow:\s*\/\s*$/m.test(robots.html))fail('robots.txt','Disallow: /');
  if(!robots.html.includes(`Sitemap: ${new URL('sitemap.xml',site).href}`))fail('robots.txt',`no Sitemap line for ${site.origin}`);
 }
 const index=await get(new URL('sitemap.xml',site)),pages=[];
 if(index.status!==200)fail('sitemap.xml',`HTTP ${index.status}`);
 for(const child of index.html.includes('<sitemapindex')?locs(index.html):[]){
  if(new URL(child).origin!==site.origin){fail('sitemap.xml',`lists ${child}`);continue;}
  const x=await get(child);
  if(x.status!==200){fail(child,`HTTP ${x.status}`);continue;}
  for(const u of locs(x.html)){if(new URL(u).origin!==site.origin)fail(child,`lists ${u}`);else if(!child.endsWith('/sitemap-images.xml'))pages.push(u);}
 }
 if(index.html.includes('<urlset'))pages.push(...locs(index.html));
 if(!pages.length)fail('sitemaps','no page URLs');
 const unique=[...new Set(pages)];
 for(const [u,problems] of await pool(unique,8,async u=>[u,pageProblems(u,await get(u),site.href)]))for(const p of problems)fail(u,p);
 for(const origin of legacy){
  const from=new URL('en/game/',origin).href,to=new URL('en/game/',site).href,r=await get(from);
  if(![301,308].includes(r.status)||r.headers.location!==to)fail(from,`expected a permanent redirect to ${to}, got HTTP ${r.status} ${r.headers.location||''}`);
 }
 return {pages:unique.length,errors};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const config=configuration();
 if(config.preview||!config.siteURL)throw Error('A production SITE_URL is required');
 const legacy=(process.env.LEGACY_ORIGINS||'').split(/\s+/).filter(Boolean);
 const {pages,errors}=await liveCheck(config.siteURL,legacy);
 for(const e of errors.slice(0,100))console.log(e);
 if(errors.length){console.log(`${errors.length} problems on the live site ${config.siteURL} (${pages} sitemap pages checked).`);process.exit(1);}
 console.log(`Live site ${config.siteURL}: ${pages} sitemap pages, robots.txt, sitemaps${legacy.length?` and ${legacy.length} retired-host redirects`:''} OK.`);
}
