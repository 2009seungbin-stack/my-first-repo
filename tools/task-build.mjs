import {BRAND} from '../src/brand.js';
import {logoMark} from '../src/logo.js';
import {LOCALES,LANGUAGE_NAMES,t} from '../src/i18n.js';
import {INTENTS} from '../src/intents.js';
import {TOOLS} from '../src/tool-registry.js';
import {TASK_TOOLS,DIRECTORY} from '../src/task/registry.js';
import {ui} from '../src/task/strings.js';
import {SPRITE_EXPORTS,TILE_EXPORTS} from '../src/game-seo.js';
import {siteHeader,footerBrand,arrow} from './game-chrome.mjs';
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
/** Game-first home: the Studio is the product; image/PDF/video tools stay reachable as extras.
 * Layout and visuals: docs/HANDOFF-DESIGN.md. Every UI string carries data-ui so the page relabels
 * itself in place on a language switch (src/task/shell.js renderChrome, src/task/home.js). */
// The single tools, grouped by the workspace they belong to (the index under "Single game tools").
const TOOL_GROUPS=[
 ['sprite',['sprite-slicer','sprite-animation-preview','sprite-pivot-editor','hitbox-editor','collision-polygon-generator','frame-normalize','sprite-lab']],
 ['pack',['sprite-sheet-maker','atlas-padding','favicon-pack']],
 ['tile',['tile-lab','tileset-slicer','autotile-tester','seamless-tile-checker','tile-helper']],
 ['pixel',['pixel-lab','pixel-art-cleanup','palette-extractor','palette-swap-ramp','palette-swap','pixel-perfect-checker','pixel','refiner']],
 ['texture',['texture-lab','normal-map-converter','channel-unpacker','mask-packer','pbr-texture-validator','texture-edge-bleed','texture-map']],
 ['ui',['ui-lab','9-slice-editor','button-state-generator','bitmap-font','missing-glyph-checker','ui-scale-preview']]
];
// Engines and their verification, merged from the Studio's own export tables (src/game-seo.js; the
// same words and evidence as docs/STUDIO-PACK.md and docs/STUDIO-TILE.md). The weakest label wins.
const ENGINE_ROWS=[['Godot 4',['s:godot4','t:godot']],['Unity 6',['s:unity','t:unity']],['Phaser 3 / 4',['s:phaser']],['PixiJS 8',['s:pixi']],['Aseprite',['s:aseprite','s:aseprite-json']],['Spine',['s:spine']],['LÖVE',['s:love']],['Tiled',['t:tiled']],['Starling / Sparrow',['s:starling']],['Defold',['s:defold']],['LDtk',['t:ldtk']],['GameMaker',['s:gamemaker']]];
const RANK=['verified','built','decoded','partial','unverified'];
export function engineRows(){
 return ENGINE_ROWS.map(([name,keys])=>{
  const rows=keys.map(k=>(k[0]==='s'?SPRITE_EXPORTS:TILE_EXPORTS).find(r=>r.id===k.slice(2)));
  const status=rows.map(r=>r.status).sort((a,b)=>RANK.indexOf(b)-RANK.indexOf(a))[0];
  return {name,status,engine:rows.find(r=>r.engine)?.engine||''};
 });
}
const SHOT={w:2560,h:1520,cw:1040,ch:1072};
export const heroSrcset=locale=>[1280,1600,2560].map(w=>`assets/home/shot-hero-${locale}-${w}.webp ${w}w`).join(', ');
export const heroCropSrcset=locale=>[780,1040].map(w=>`assets/home/shot-hero-crop-${locale}-${w}.webp ${w}w`).join(', ');
const HERO_SIZES='(max-width: 1248px) calc(100vw - 48px), 1200px';
/** <link rel=preload> for the hero picture (the LCP element), one per layout. */
export function homePreload(locale){
 return `<link rel="preload" as="image" imagesrcset="${heroCropSrcset(locale)}" imagesizes="calc(100vw - 32px)" media="(max-width: 700px)" fetchpriority="high"><link rel="preload" as="image" imagesrcset="${heroSrcset(locale)}" imagesizes="${HERO_SIZES}" media="(min-width: 701px)" fetchpriority="high">`;
}
function homeShell({locale,base,title,description,headHTML,body}){
 return `<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#0f1114"><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><base href="${base}"><title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="src/game-site.css"><link rel="stylesheet" href="src/game-home.css">${homePreload(locale)}<script type="module" src="src/task/shell.js"></script>${headHTML}
</head><body class="gs task-page home-page game-home">${body}<div class="gh-dropover" aria-hidden="true"><div><strong data-ui="gh.dragTitle">${esc(ui(locale,'gh.dragTitle'))}</strong><span data-ui="dropHint">${esc(ui(locale,'dropHint'))}</span></div></div><div id="toast" class="toast" role="status" aria-live="polite" hidden></div><input id="fileInput" type="file" multiple hidden></body></html>`;
}
export function homePage({locale,prefix,base,headHTML,contentHTML}){
 const title=`${BRAND.name} — ${ui(locale,'homeTitle')}`,description=ui(locale,'homeLead');
 const u=(key,tag='span',cls='')=>`<${tag}${cls?` class="${cls}"`:''} data-ui="${key}">${esc(ui(locale,key))}</${tag}>`;
 const studioHref=ws=>`${prefix}game/studio/${ws?'?ws='+ws:''}`;
 const header=siteHeader({locale,prefix,brandAttrs:{'data-home-link':true},navLabel:BRAND.name,
  links:[{href:'#workflow',label:ui(locale,'gh.navWorkflow'),attrs:{'data-ui':'gh.navWorkflow'}},{href:'#engines',label:ui(locale,'gh.navEngines'),attrs:{'data-ui':'gh.navEngines'}},{href:'#tools',label:ui(locale,'gh.navTools'),attrs:{'data-ui':'gh.navTools'}},{href:'#file-tools',label:ui(locale,'gh.fileToolsLink'),attrs:{'data-ui':'gh.fileToolsLink','data-file-tools-link':true}}],
  studio:{href:studioHref(''),label:ui(locale,'gh.studioLink'),attrs:{'data-studio-link':true,'data-ui':'gh.studioLink'}},
  extra:'<a class="gs-account account-link" id="accountLink" target="_blank" rel="noopener" hidden></a>'});
 // 1. Hero: one message, one primary action, the real Studio at a readable size.
 const hero=`<section class="gh-hero" aria-labelledby="taskTitle"><div class="gs-wrap"><div class="gh-hero-copy">${u('gh.kicker','p','gs-kicker gh-kicker')}<h1 id="taskTitle">${esc(ui(locale,'homeTitle'))}</h1><p class="gh-lead page-lead" id="taskLead">${esc(description)}</p>
<div class="gh-cta"><a class="gs-btn gs-btn-primary gs-btn-l gh-open" data-studio-link href="${studioHref('')}"><span data-ui="gh.openStudio">${esc(ui(locale,'gh.openStudio'))}</span>${arrow}</a><button type="button" class="gs-btn gs-btn-ghost gs-btn-l gh-pick" data-action="pick" data-ui="pick">${esc(ui(locale,'pick'))}</button></div>
${u('gh.dropOr','p','gh-drop-hint')}</div>
<figure class="gh-shot"><div class="gs-frame gh-shot-frame"><picture><source media="(max-width: 700px)" srcset="${heroCropSrcset(locale)}" sizes="calc(100vw - 32px)" width="${SHOT.cw}" height="${SHOT.ch}"><img id="heroShot" src="assets/home/shot-hero-${locale}-1600.webp" srcset="${heroSrcset(locale)}" sizes="${HERO_SIZES}" width="${SHOT.w}" height="${SHOT.h}" alt="${esc(ui(locale,'gh.heroAlt'))}" fetchpriority="high" decoding="async"></picture></div>${u('gh.shotCaption','figcaption','gs-caption')}</figure></div></section>
<div class="gs-wrap"><div class="suggest" id="suggest" role="region" aria-live="polite" hidden></div></div>`;
 // 2. The workflow, one real visual per step.
 const row=(id,visual,cta,{flip=false}={})=>`<article class="gh-row${flip?' is-flip':''}" id="flow-${id}"><div class="gh-row-copy"><p class="gh-row-ws"><img src="assets/home/ws-${id}.svg" width="28" height="28" alt="" loading="lazy">${u(`gh.ws.${id}.0`)}</p><h3>${u(`gh.flow.${id}.0`)}</h3><p>${u(`gh.flow.${id}.1`)}</p>${cta}</div><div class="gh-row-visual">${visual}</div></article>`;
 const go=(ws,key)=>`<a class="gs-link" data-studio-link data-studio-ws="${ws}" href="${studioHref(ws)}" data-ui="gh.flow.${key}">${esc(ui(locale,`gh.flow.${key}`))}</a>`;
 const TAG_NAMES=['idle','walk','jump','swim','shoot'];
 const demo=`<figure class="gh-demo"><div class="gh-demo-stage" role="img" aria-label="${esc(ui(locale,'gh.flow.demo'))}"><div class="gh-demo-sheet"><div class="gh-demo-head">${u('gh.flow.sheet')}<small>classic-hero.png · 16×16</small></div><div class="gh-demo-body"><ol class="gh-demo-tags" aria-hidden="true">${TAG_NAMES.map((n,i)=>`<li class="t${i}">${n}</li>`).join('')}</ol><div class="gh-demo-grid"><img src="assets/home/art/classic-hero-frames.png" width="96" height="80" alt="" loading="lazy" decoding="async"><i class="gh-demo-cursor"></i></div></div></div><div class="gh-demo-preview"><div class="gh-demo-head">${u('gh.flow.preview')}<small>walk · 10 fps</small></div><div class="gh-demo-play"><i class="gh-demo-sprite"></i></div></div></div>${u('gh.flow.demo','figcaption','gs-caption')}</figure>`;
 const shotFig=(name,cap,w,h)=>`<figure class="gh-row-shot"><div class="gs-frame"><img src="assets/home/shot-${name}-${locale}-1040.webp" srcset="assets/home/shot-${name}-${locale}-1040.webp 1040w, assets/home/shot-${name}-${locale}-1600.webp 1600w" sizes="(max-width: 900px) calc(100vw - 32px), 700px" width="${w}" height="${h}" alt="${esc(ui(locale,`gh.flow.${cap}`))}" data-shot="${name}" loading="lazy" decoding="async"></div>${u(`gh.flow.${cap}`,'figcaption','gs-caption')}</figure>`;
 const labs=[['pixel','pixel-lab'],['texture','texture-lab'],['ui','ui-lab']].map(([ws,id])=>`<a class="gh-lab" data-tool-link="${id}" href="${prefix}${INTENTS[id].path}/"><span class="gh-lab-img"><img src="assets/home/lab-${ws}.webp" width="640" height="480" alt="" loading="lazy" decoding="async"></span><span class="gh-lab-copy"><b>${u(`gh.ws.${ws}.0`)}<em data-ui="gh.lab">${esc(ui(locale,'gh.lab'))}</em></b><small data-ui="gh.ws.${ws}.1">${esc(ui(locale,`gh.ws.${ws}.1`))}</small></span></a>`).join('');
 const flow=`<section class="gs-section gh-flow" id="workflow" aria-labelledby="flowTitle"><div class="gs-wrap"><header class="gs-head">${u('gh.flow.kicker','p','gs-kicker')}<h2 class="gs-h2" id="flowTitle" data-ui="gh.flow.title">${esc(ui(locale,'gh.flow.title'))}</h2>${u('gh.flow.lead','p','gs-lead')}</header>
${row('sprite',demo,go('sprite','openSprite'))}
${row('pack',shotFig('pack','packCaption',1600,980),go('pack','openPack'),{flip:true})}
${row('tile',shotFig('tile','tileCaption',1600,980),go('tile','openTile'))}
<article class="gh-row gh-row-labs" id="flow-labs"><div class="gh-row-copy"><h3>${u('gh.flow.labs.0')}</h3><p>${u('gh.flow.labs.1')}</p></div><div class="gh-labs">${labs}</div></article></div></section>`;
 // 3. Proof: which engines loaded the exports, with the Studio's own honest labels.
 const engines=`<section class="gs-section gh-engines" id="engines" aria-labelledby="enginesTitle"><div class="gs-wrap"><div class="gh-engines-box"><header class="gh-engines-head"><h2 class="gs-h2" id="enginesTitle" data-ui="gh.engines">${esc(ui(locale,'gh.engines'))}</h2>${u('gh.enginesNote','p','gs-lead')}</header><ul class="gh-engine-grid engine-list">${engineRows().map(r=>`<li class="gh-engine is-${r.status}"><b>${esc(r.name)}</b><span class="gs-status is-${r.status}" data-ui="gh.status.${r.status}">${esc(ui(locale,'gh.status.'+r.status))}</span>${r.engine?`<small>${esc(r.engine)}</small>`:''}</li>`).join('')}</ul></div></div></section>`;
 // 4. Every single tool, as a compact index grouped by workspace (search filters it; src/task/home.js).
 const [,gameIds]=DIRECTORY.find(([c])=>c==='game'),files=DIRECTORY.filter(([c])=>c!=='game');
 const grouped=new Set(TOOL_GROUPS.flatMap(([,ids])=>ids)),groups=[...TOOL_GROUPS.map(([g,ids])=>[g,ids.filter(id=>gameIds.includes(id))]),['more',gameIds.filter(id=>!grouped.has(id))]].filter(([,ids])=>ids.length);
 const card=id=>`<li><a class="tool-card" data-tool="${id}" href="${prefix}${INTENTS[id].path}/"><b>${esc(t(`intent.${id}.title`,{},locale))}</b><small>${esc(t(`intent.${id}.description`,{},locale))}</small></a></li>`;
 const groupName=g=>g==='more'?u('gh.moreTools','h4'):`<h4><span data-ui="gh.ws.${g}.0">${esc(ui(locale,`gh.ws.${g}.0`))}</span></h4>`;
 const index=`<section class="gs-section gh-index" id="tools" aria-labelledby="toolsTitle"><div class="gs-wrap"><header class="gh-index-head"><div><h2 class="gs-h2" id="toolsTitle" data-ui="gh.tools">${esc(ui(locale,'gh.tools'))}</h2>${u('gh.toolsLead','p','gs-lead')}</div><label class="gh-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="tool-query" id="toolQuery" type="search" placeholder="${esc(ui(locale,'search'))}" aria-label="${esc(ui(locale,'searchLabel'))}" autocomplete="off"></label></header>
<div class="directory" id="directory"><section class="gh-dir-game" aria-labelledby="toolsTitle"><div class="gh-groups">${groups.map(([g,ids])=>`<div class="gh-group" data-group="${g}">${groupName(g)}<ul>${ids.map(card).join('')}</ul></div>`).join('')}</div></section>
<details class="file-tools" id="file-tools"><summary><b data-ui="gh.fileTools">${esc(ui(locale,'gh.fileTools'))}</b><small data-ui="gh.fileToolsLead">${esc(ui(locale,'gh.fileToolsLead'))}</small></summary><div class="gh-groups is-files">${files.map(([cat,ids])=>`<section class="gh-group"><h3 data-cat="${cat}">${esc(ui(locale,'cat.'+cat))}</h3><ul>${ids.map(card).join('')}</ul></section>`).join('')}</div></details>
<p class="no-result" id="noResult" hidden></p></div></div></section>`;
 const body=`${header}<main class="page game-home-main" id="home" data-ad-exclude><span id="main"></span>${hero}${flow}${engines}${index}</main><div id="siteContent" class="gh-content gs-footgrid">${withFooterBrand(contentHTML,locale,prefix)}</div>`;
 return homeShell({locale,base,title,description,headHTML,body});
}
/** The footer brand column sits inside #siteContent, just before src/content.js's footer, so a
 * language switch (src/site-content.js, which swaps only the editorial regions) leaves it in place. */
function withFooterBrand(html,locale,prefix){
 const brand=footerBrand({locale,prefix,attrs:{'data-ui':'gh.footerLine'},linkAttrs:{'data-home-link':true},line:ui(locale,'gh.footerLine')});
 return html.includes('<footer class="site-footer">')?html.replace('<footer class="site-footer">',brand+'<footer class="site-footer">'):html+brand;
}
export function taskPage({id,locale,prefix,base,title,heading,description,headHTML,contentHTML,landing=''}){
 const kinds=TASK_TOOLS[id].kinds.map(k=>ui(locale,'kinds.'+k)).join(' · ');
 const body=`${header(locale,prefix,false)}<main class="page" id="task" data-ad-exclude data-tool="${id}" data-landing="${esc(landing)}"><nav class="crumb"><a data-home-link href="${prefix}">← <span data-ui="allTools">${esc(ui(locale,'allTools'))}</span></a> / ${esc(ui(locale,'cat.'+category(id)))}</nav><h1 id="taskTitle">${esc(heading)}</h1><p class="page-lead" id="taskLead">${esc(description)}</p>
<div id="taskApp"><div class="dropzone" data-action="pick" role="button" tabindex="0"><strong>${esc(ui(locale,'taskDrop',{kind:kinds}))}</strong><span>${esc(ui(locale,'multi'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(ui(locale,'pick'))}</button></div><small class="local-note">${esc(ui(locale,'local'))}</small></div></div></main><div id="siteContent">${contentHTML}</div>`;
 return shell({locale,base,title,description,headHTML,body,pageClass:'task-page'});
}
