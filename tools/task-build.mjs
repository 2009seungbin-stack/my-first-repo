import {BRAND} from '../src/brand.js';
import {logoMark} from '../src/logo.js';
import {LOCALES,LANGUAGE_NAMES,t} from '../src/i18n.js';
import {INTENTS} from '../src/intents.js';
import {TOOLS} from '../src/tool-registry.js';
import {TASK_TOOLS,DIRECTORY,BADGES,CATEGORY_BADGE} from '../src/task/registry.js';
import {ui} from '../src/task/strings.js';
/** Static HTML for the home directory and single-task pages. Everything a visitor or a
 * crawler needs is in the markup (real links, headings, drop zone); src/task/shell.js adds
 * behaviour. `prefix` is '' for the language-neutral URLs and 'ko/' etc. otherwise. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const globe='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';
function shell({locale,base,title,description,headHTML,body,pageClass,themeColor='#f5f7fa'}){
 return `<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="${themeColor}"><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><base href="${base}"><title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="experience.css"><link rel="stylesheet" href="content.css"><link rel="stylesheet" href="src/task/task.css"><script type="module" src="src/task/shell.js"></script>${headHTML}
</head><body class="${pageClass}">${body}<div id="toast" class="toast" role="status" aria-live="polite" hidden></div><input id="fileInput" type="file" multiple hidden></body></html>`;
}
function header(locale,prefix,home){
 return `<header class="page-header"><a class="brand" data-home-link href="${prefix}" aria-label="${esc(BRAND.name)}">${logoMark()}<strong>${esc(BRAND.name)}<span class="brand-dot">.</span></strong></a><div class="header-end">${home?`<a class="header-link" href="#file-tools" data-ui="gh.fileToolsLink">${esc(ui(locale,'gh.fileToolsLink'))}</a>`:`<a class="header-link" data-home-link data-ui="allTools" href="${prefix}">${esc(ui(locale,'allTools'))}</a>`}<a class="header-studio" data-studio-link href="${prefix}game/studio/" data-ui="gh.studioLink">${esc(ui(locale,'gh.studioLink'))}</a><label class="language-control">${globe}<select id="languageSelect" aria-label="${esc(t('language.label',{},locale))}"><option value="auto">${esc(t('language.auto',{},locale))}</option>${LOCALES.map(l=>`<option value="${l}" lang="${l}"${prefix===l+'/'?' selected':''}>${LANGUAGE_NAMES[l]}</option>`).join('')}</select></label><span class="local-pill"><span></span><span data-ui="local">${esc(ui(locale,'local'))}</span></span><a class="account-link" id="accountLink" target="_blank" rel="noopener" hidden></a></div></header>`;
}
const category=id=>DIRECTORY.find(([,ids])=>ids.includes(id))?.[0]||(TOOLS[id]?.category==='game'?'game':'image');
/** Game-first home: the studio is the product; image/PDF/video tools stay reachable as extras. */
const WORKSPACES=[['sprite','studio'],['pack','studio'],['tile','studio'],['pixel','pixel-lab'],['texture','texture-lab'],['ui','ui-lab']];
// Verified = the export was loaded back in the engine and compared (docs/ENGINE-VERIFY.md, STUDIO-PACK.md, STUDIO-TILE.md).
// Search demand first (docs: competitors/PAIN-POINTS.md): sheets, packing, autotiles, pixel cleanup, normal maps, fonts.
const FEATURED=['sprite-slicer','sprite-sheet-maker','autotile-tester','tileset-slicer','sprite-animation-preview','hitbox-editor','pixel-lab','pixel-art-cleanup','palette-extractor','normal-map-converter','9-slice-editor','bitmap-font'];
const ENGINES=[['Godot 4',1],['Unity 6',1],['Phaser 3 / 4',1],['PixiJS 8',1],['Defold',1],['LÖVE',1],['Spine',1],['Tiled',1],['Aseprite',1],['LDtk',0],['GameMaker',0]];
export function homePage({locale,prefix,base,headHTML,contentHTML}){
 const title=`${BRAND.name} — ${ui(locale,'homeTitle')}`,description=ui(locale,'homeLead'),g=k=>esc(ui(locale,'gh.'+k));
 const card=(id,cat)=>`<a class="tool-card" data-tool="${id}" href="${prefix}${INTENTS[id].path}/"><span class="tool-badge ${cat}">${esc(BADGES[id]||CATEGORY_BADGE[cat])}</span><span><b>${esc(t(`intent.${id}.title`,{},locale))}</b><small>${esc(t(`intent.${id}.description`,{},locale))}</small></span></a>`;
 const ws=([id,where])=>{const href=where==='studio'?`${prefix}game/studio/?ws=${id}`:`${prefix}${INTENTS[where].path}/`;
  return `<a class="ws-card${where==='studio'?' is-ready':''}" data-ws-card="${id}" ${where==='studio'?`data-studio-link data-studio-ws="${id}"`:`data-tool-link="${where}"`} href="${href}"><img src="assets/home/ws-${id}.svg" width="40" height="40" alt="" loading="lazy"><span><b data-ui="gh.ws.${id}.0">${esc(ui(locale,`gh.ws.${id}.0`))}</b><small data-ui="gh.ws.${id}.1">${esc(ui(locale,`gh.ws.${id}.1`))}</small></span><em data-ui="gh.${where==='studio'?'ready':'lab'}">${g(where==='studio'?'ready':'lab')}</em></a>`;};
 const [gameCat,gameIds]=DIRECTORY.find(([c])=>c==='game'),files=DIRECTORY.filter(([c])=>c!=='game');
 const body=`${header(locale,prefix,true)}<main class="page game-home-main" id="home" data-ad-exclude>
<section class="gh-hero"><div class="gh-copy"><p class="gh-kicker" data-ui="gh.kicker">${g('kicker')}</p><h1 id="taskTitle">${esc(ui(locale,'homeTitle'))}</h1><p class="page-lead" id="taskLead">${esc(description)}</p>
<div class="gh-cta"><a class="primary gh-open" data-studio-link href="${prefix}game/studio/" data-ui="gh.openStudio">${g('openStudio')}</a><button type="button" class="gh-pick" data-action="pick" data-ui="pick">${esc(ui(locale,'pick'))}</button></div></div>
<figure class="gh-shot"><img id="heroShot" src="assets/home/studio-sprite-${locale}.webp" width="1200" height="750" alt="${g('heroAlt')}" fetchpriority="high"></figure></section>
<div class="dropzone home-drop gh-drop" data-action="pick" role="button" tabindex="0"><div class="drop-copy"><strong data-ui="dropTitle">${esc(ui(locale,'dropTitle'))}</strong><span data-ui="dropHint">${esc(ui(locale,'dropHint'))}</span></div><button type="button" class="primary" data-action="pick" data-ui="pick">${esc(ui(locale,'pick'))}</button></div>
<div class="suggest" id="suggest" role="region" aria-live="polite" hidden></div>
<section class="gh-section"><h2 data-ui="gh.workspaces">${g('workspaces')}</h2><div class="ws-grid">${WORKSPACES.map(ws).join('')}</div></section>
<section class="gh-section gh-engines"><h2 data-ui="gh.engines">${g('engines')}</h2><ul class="engine-list">${ENGINES.map(([n,v])=>`<li class="${v?'is-verified':'is-format'}">${esc(n)}</li>`).join('')}</ul><p class="gh-note" data-ui="gh.enginesNote">${g('enginesNote')}</p></section>
<input class="tool-query" id="toolQuery" type="search" placeholder="${esc(ui(locale,'search'))}" aria-label="${esc(ui(locale,'searchLabel'))}" autocomplete="off">
<div class="directory" id="directory"><section><h2 data-ui="gh.tools">${g('tools')}</h2><div class="tool-grid">${FEATURED.map(id=>card(id,gameCat)).join('')}</div>
<details class="more-tools"><summary data-ui="gh.moreTools">${g('moreTools')}</summary><div class="tool-grid">${gameIds.filter(id=>!FEATURED.includes(id)).map(id=>card(id,gameCat)).join('')}</div></details></section>
<details class="file-tools" id="file-tools"><summary><b data-ui="gh.fileTools">${g('fileTools')}</b><small data-ui="gh.fileToolsLead">${g('fileToolsLead')}</small></summary>${files.map(([cat,ids])=>`<section><h2 data-cat="${cat}">${esc(ui(locale,'cat.'+cat))}</h2><div class="tool-grid">${ids.map(id=>card(id,cat)).join('')}</div></section>`).join('')}</details>
<p class="no-result" id="noResult" hidden></p></div></main><div id="siteContent">${contentHTML}</div>`;
 return shell({locale,base,title,description,headHTML,body,pageClass:'task-page home-page game-home',themeColor:'#0f1115'});
}
export function taskPage({id,locale,prefix,base,title,heading,description,headHTML,contentHTML,landing=''}){
 const kinds=TASK_TOOLS[id].kinds.map(k=>ui(locale,'kinds.'+k)).join(' · ');
 const body=`${header(locale,prefix,false)}<main class="page" id="task" data-ad-exclude data-tool="${id}" data-landing="${esc(landing)}"><nav class="crumb"><a data-home-link href="${prefix}">← <span data-ui="allTools">${esc(ui(locale,'allTools'))}</span></a> / ${esc(ui(locale,'cat.'+category(id)))}</nav><h1 id="taskTitle">${esc(heading)}</h1><p class="page-lead" id="taskLead">${esc(description)}</p>
<div id="taskApp"><div class="dropzone" data-action="pick" role="button" tabindex="0"><strong>${esc(ui(locale,'taskDrop',{kind:kinds}))}</strong><span>${esc(ui(locale,'multi'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(ui(locale,'pick'))}</button></div><small class="local-note">${esc(ui(locale,'local'))}</small></div></div></main><div id="siteContent">${contentHTML}</div>`;
 return shell({locale,base,title,description,headHTML,body,pageClass:'task-page'});
}
