/** The sitemap set: sitemap.xml is an index of
 *   sitemap-game.xml    home, the /game/ hub and every indexable game page, grouped by workflow
 *   sitemap-guides.xml  the how-to guides (src/guides.js), only once there are guides
 *   sitemap-tools.xml   the image / PDF / video tools, their task landings, policies and pricing
 *   sitemap-images.xml  the screenshots and before/after examples shown on those pages
 * Every <url> is a language page (ko, en, ja; plus / for the home page) with its hreflang alternates
 * (xhtml:link; x-default = / for the home page, the English page elsewhere, see src/seo.js) and a real <lastmod> (tools/lastmod.mjs) when one is known.
 * Only pages whose tool is qualified (src/capabilities.js mayPromote) are listed; noindex pages
 * never are. Limits and format follow sitemaps.org (≤50,000 URLs and ≤50 MB uncompressed per file,
 * W3C datetime) — checked by tests/sitemap.test.mjs. */
import {mayPromote} from '../src/capabilities.js';
import {LOCALES} from '../src/i18n.js';
import {INTENTS} from '../src/intents.js';
import {LANDINGS,LANDING_PATHS} from '../src/landings.js';
import {POLICY_ROUTES} from '../src/policies.js';
import {pagePath,X_DEFAULT_LOCALE} from '../src/seo.js';
import {GAME_HUB_PATH} from '../src/game-seo.js';
import {gameSitemapPaths} from './game-landing-build.mjs';
import {GUIDE_ROUTES,guideLastmod} from './guides-registry.mjs';
import {imageSitemap} from './growth-build.mjs';

export const SITEMAP_LIMITS=Object.freeze({urls:50000,bytes:50*1024*1024});
export const SITEMAP_INDEX='sitemap.xml';
export const SITEMAP_FILES=Object.freeze({game:'sitemap-game.xml',guides:'sitemap-guides.xml',tools:'sitemap-tools.xml',images:'sitemap-images.xml'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NS='xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
/** W3C datetime as sitemaps.org accepts it: a date, or a date and time with seconds and a zone. */
export const W3C_DATETIME=/^\d{4}-\d\d-\d\d(T\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d))?$/;

/** Language-neutral page paths per sitemap, in listing order. `extra` adds paths (pricing). */
export function sitemapGroups(extra=[]){
 const indexable=[...Object.entries(INTENTS).filter(([id])=>mayPromote(id)).map(([,i])=>i.path),...LANDING_PATHS.filter(p=>mayPromote(LANDINGS[p].intent))];
 const game=[...new Set([...(indexable.includes('')?['']:[]),...gameSitemapPaths().filter(p=>p===GAME_HUB_PATH||indexable.includes(p))])];
 const inGame=new Set(game);
 const tools=[...new Set([...indexable,...POLICY_ROUTES,...extra])].filter(p=>!inGame.has(p));
 return {game,guides:[...GUIDE_ROUTES],tools};
}
/** The <url> entries of `paths` in every language. `lastmod(route)` → W3C datetime or null, where
 * route is the build route of the language page ('en', 'en/game/tile-lab'). */
export function urlEntries(paths,siteURL,lastmod=()=>null){
 if(!siteURL)return '';
 const href=(p,l)=>esc(new URL(pagePath(p,l),siteURL).href);
 // The home page's language-neutral URL (/) is a canonical page of its own (x-default, src/seo.js):
 // it is listed too, dated like the English page it renders by default.
 return paths.flatMap(p=>[...LOCALES,...(X_DEFAULT_LOCALE(p)===null?[null]:[])].map(l=>{
  const when=lastmod(p?`${l||'en'}/${p}`:l||'en');
  if(when&&!W3C_DATETIME.test(when))throw Error(`lastmod of ${l}/${p} is not a W3C datetime: ${when}`);
  return `<url><loc>${href(p,l)}</loc>${when?`<lastmod>${when}</lastmod>`:''}${LOCALES.map(a=>`<xhtml:link rel="alternate" hreflang="${a}" href="${href(p,a)}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${href(p,X_DEFAULT_LOCALE(p))}"/></url>`;
 })).join('');
}
export const urlset=body=>`<?xml version="1.0" encoding="UTF-8"?><urlset ${NS} xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;
const newest=dates=>dates.filter(Boolean).reduce((a,d)=>!a||Date.parse(d)>Date.parse(a)?d:a,null);
/** Guide pages carry the registry's own date (src/guides.js `updated`). */
const guideDate=route=>guideLastmod(route.replace(/^(ko|en|ja)\//,''));
/** Every sitemap file of a build: {file name: XML}. Without a site URL (preview builds) the index
 * is an empty urlset, as before, and nothing else is listed. */
export function sitemapFiles(siteURL,{extra=[],lastmod=()=>null}={}){
 if(!siteURL)return {[SITEMAP_INDEX]:urlset(''),[SITEMAP_FILES.images]:imageSitemap('')};
 const g=sitemapGroups(extra),out={},dated={};
 const add=(key,paths,dateOf)=>{
  if(!paths.length)return;
  out[SITEMAP_FILES[key]]=urlset(urlEntries(paths,siteURL,dateOf));
  dated[SITEMAP_FILES[key]]=newest(paths.flatMap(p=>LOCALES.map(l=>dateOf(p?`${l}/${p}`:l))));
 };
 add('game',g.game,lastmod);add('guides',g.guides,guideDate);add('tools',g.tools,lastmod);
 out[SITEMAP_FILES.images]=imageSitemap(siteURL);
 const entries=Object.keys(out).map(f=>`<sitemap><loc>${esc(new URL(f,siteURL).href)}</loc>${dated[f]?`<lastmod>${dated[f]}</lastmod>`:''}</sitemap>`).join('');
 return {[SITEMAP_INDEX]:`<?xml version="1.0" encoding="UTF-8"?><sitemapindex ${NS}>${entries}</sitemapindex>`,...out};
}
/** Every page URL of the site in one urlset (game, guides, then tools): what IndexNow submits and
 * what the tests read. The published sitemap.xml is the index above. */
export function allPagesSitemap(siteURL,extra=[],lastmod=()=>null){
 const g=sitemapGroups(extra);
 return urlset(urlEntries(g.game,siteURL,lastmod)+urlEntries(g.guides,siteURL,guideDate)+urlEntries(g.tools,siteURL,lastmod));
}
