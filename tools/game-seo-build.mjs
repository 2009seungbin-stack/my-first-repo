import {mayPromote} from '../src/capabilities.js';
import {seoLinks,pagePath} from '../src/seo.js';
import {BRAND} from '../src/brand.js';
import {verificationHead} from './growth-build.mjs';
import {serviceMeta} from './service-build.mjs';
import {GAME_HUB_PATH,HUB,SHOTS,STATUS,UI} from '../src/game-seo.js';
import {exportsFor} from './game-landing-build.mjs';
/** <head> of the game landing pages: robots decision, canonical + hreflang, SoftwareApplication
 * and BreadcrumbList JSON-LD, and social cards (assets/social/<locale>-<stem>.png). */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=data=>`<script data-site-seo type="application/ld+json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`;
/** File stem of a game page's social card: the intent id, `game` for the hub, or the keyword
 * path with slashes as dashes (game/aseprite-to-godot → game-aseprite-to-godot). */
export const socialStem=game=>game.kind==='intent'?game.key:game.kind==='hub'?'game':game.key.replaceAll('/','-');
export function gameMeta(game,locale){
 if(game.kind==='hub'){const h=HUB[locale];return {title:h.title,description:h.description,shot:'sprite-frame',ws:'sprite',what:[h.sprite,h.pack,h.tile]};}
 const c=game.page.copy[locale];return {title:c.title,description:c.description,shot:game.page.shot,ws:game.page.ws,what:c.what};
}
/** What the application does, from the shipped capabilities: the page's own features, then every
 * export target with its verification label (docs/STUDIO-PACK.md, docs/STUDIO-TILE.md). */
export function featureList(game,locale){
 const m=gameMeta(game,locale),targets=game.kind==='hub'?[...exportsFor('sprite'),...exportsFor('tile')]:exportsFor(m.ws);
 return [...m.what,...targets.map(r=>`${r.name}: ${STATUS[r.status][locale]}${r.engine?` (${r.engine})`:''}`)];
}
export function gameStructuredData(game,locale,siteURL){
 const m=gameMeta(game,locale);
 const app={'@context':'https://schema.org','@type':'SoftwareApplication',name:`${m.title} · ${BRAND.name}`,description:m.description,applicationCategory:'DeveloperApplication',applicationSubCategory:'2D game asset tool',operatingSystem:'Web',browserRequirements:'A current browser with JavaScript and WebGL2 or Canvas 2D',inLanguage:locale,isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},featureList:featureList(game,locale)};
 if(siteURL){app.url=new URL(pagePath(game.canonical,locale),siteURL).href;app.screenshot=new URL(`assets/studio/${SHOTS[m.shot].file}.webp`,siteURL).href;}
 return json(app);
}
export function gameBreadcrumb(game,locale,siteURL){
 if(!siteURL)return '';
 const at=p=>new URL(pagePath(p,locale),siteURL).href,items=[{name:BRAND.name,item:at('')},{name:UI.hub[locale],item:at(GAME_HUB_PATH)}];
 if(game.kind!=='hub')items.push({name:gameMeta(game,locale).title,item:at(game.canonical)});
 return json({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map((x,i)=>({'@type':'ListItem',position:i+1,...x}))});
}
export function gameSocial(game,locale,siteURL){
 const m=gameMeta(game,locale),title=`${m.title} · ${BRAND.name}`,image=siteURL?new URL(`assets/social/${locale}-${socialStem(game)}.png`,siteURL).href:'';
 return `<meta data-site-seo property="og:type" content="website"><meta data-site-seo property="og:site_name" content="${esc(BRAND.name)}"><meta data-site-seo property="og:locale" content="${{en:'en_US',ko:'ko_KR',ja:'ja_JP'}[locale]}"><meta data-site-seo name="twitter:card" content="summary_large_image"><meta data-site-seo name="twitter:title" content="${esc(title)}"><meta data-site-seo name="twitter:description" content="${esc(m.description)}">`+(image?`<meta data-site-seo property="og:image" content="${esc(image)}"><meta data-site-seo property="og:image:width" content="1200"><meta data-site-seo property="og:image:height" content="630"><meta data-site-seo property="og:image:alt" content="${esc(title)}"><meta data-site-seo name="twitter:image" content="${esc(image)}">`:'');
}
/** Indexable exactly when the base tool is qualified (src/capabilities.js mayPromote); the hub
 * only links to game pages and is always indexable (except preview builds). */
export function gameIndexable(game){return game.kind==='hub'||mayPromote(game.id);}
export function gameHead(game,locale,siteURL,config={}){
 const robots=config.preview?'<meta name="robots" content="noindex,nofollow">':gameIndexable(game)?'':'<meta data-quality-robots name="robots" content="noindex,follow">';
 const preload=`<link rel="preload" as="image" href="assets/studio/${SHOTS[gameMeta(game,locale).shot].file}.webp" media="(min-width: 821px)" fetchpriority="high">`;
 return `<meta name="site-url" content="${esc(siteURL)}">${robots}`+seoLinks(game.canonical,locale,siteURL)+preload+verificationHead(config)+serviceMeta(config)+(config.webAnalytics?'<meta name="web-analytics" content="cloudflare">':'')+gameStructuredData(game,locale,siteURL)+gameBreadcrumb(game,locale,siteURL)+gameSocial(game,locale,siteURL);
}
