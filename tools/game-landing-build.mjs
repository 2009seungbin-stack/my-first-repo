import {BRAND} from '../src/brand.js';
import {logoMark} from '../src/logo.js';
import {LOCALES,LANGUAGE_NAMES,t} from '../src/i18n.js';
import {INTENTS,ALIASES} from '../src/intents.js';
import {LANDINGS} from '../src/landings.js';
import {footer} from '../src/content.js';
import {DIRECTORY} from '../src/task/registry.js';
import {GAME_INTENT_PAGES,GAME_LAB_PAGES,GAME_KEYWORD_PAGES,GAME_HUB_PATH,STUDIO_ROUTE,SHOTS,STATUS,SPRITE_EXPORTS,TILE_EXPORTS,UI,WORKSPACES,COMMON_FAQ,HUB,HUB_GROUPS,CLASSIC_SUFFIX,APP_SUFFIX,classicPath,appPath,gameCopy,kindOf,isStudioKind,isGameIntentPage,isGameLabPage} from '../src/game-seo.js';
import {guidesFor,guidePath} from './guides-registry.mjs';
/** Static HTML of the game landing pages (src/game-seo.js) and of the /game/ hub.
 * Dark, editor-looking pages whose primary action hands the dropped files to the Studio
 * (src/game-landing.js → src/task/handoff.js → /game/studio/?ws=…). Everything a crawler
 * needs is in the markup; the script only adds the drop/hand-off and the language switch. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const globe='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';

/** Which game page a route is, if any. Intent aliases (e.g. sprite-normalizer) show their
 * intent's landing; <route>/classic (old Lab behind a Studio landing) and <route>/app (the Lab behind
 * a Lab landing) are tool pages, not landings. */
export function gamePageFor(path){
 const p=String(path).replace(/^\/+|\/+$/g,'');
 if(p===GAME_HUB_PATH)return {kind:'hub',key:GAME_HUB_PATH,canonical:GAME_HUB_PATH};
 const land=LANDINGS[p];
 if(land?.studio)return {kind:'keyword',key:p,id:land.intent,page:land.studio,canonical:p};
 if(p.endsWith('/'+CLASSIC_SUFFIX)||p.endsWith('/'+APP_SUFFIX))return null;
 const own=k=>INTENTS[k].path===p||ALIASES[p]===k;
 const id=Object.keys(GAME_INTENT_PAGES).find(own);
 if(id)return {kind:'intent',key:id,id,page:GAME_INTENT_PAGES[id],canonical:INTENTS[id].path};
 const lab=Object.keys(GAME_LAB_PAGES).find(own);
 return lab?{kind:'lab',key:lab,id:lab,page:GAME_LAB_PAGES[lab],canonical:INTENTS[lab].path}:null;
}
/** The route of the tool page behind an intent: the old Lab of a Studio landing, or the Lab of a Lab landing. */
export const toolRoute=id=>isGameIntentPage(id)?classicPath(INTENTS[id].path):isGameLabPage(id)?appPath(INTENTS[id].path):INTENTS[id]?.path;
const TOOL_PATHS=new Set([...Object.keys(GAME_INTENT_PAGES),...Object.keys(GAME_LAB_PAGES)].map(toolRoute));
/** Is `path` a tool page (classic Lab or Lab app) behind a game landing? Those are never indexed. */
export const isClassicPath=path=>TOOL_PATHS.has(String(path).replace(/^\/+|\/+$/g,''));
/** Route of a related entry: an intent id or a keyword landing path. */
const routeOf=key=>INTENTS[key]?INTENTS[key].path:key;
const titleOf=(key,locale)=>gameCopy(key,locale)?.title||t(`intent.${key}.title`,{},locale);
const descOf=(key,locale)=>gameCopy(key,locale)?.description||t(`intent.${key}.description`,{},locale);
/** Where a page sends the files. Studio kinds: /game/studio/?ws=… (a pack page imports through the
 * Sprite workspace, where frame files become one animation, then opens Pack & Export). Lab kinds:
 * the Lab page of the base intent, until that Lab has a Studio workspace. */
export function targetOf(game){
 const ws=game.page.ws;
 if(isStudioKind(ws))return ws==='pack'?{type:'studio',entry:'sprite',then:'pack',route:`${STUDIO_ROUTE}/?ws=sprite`,empty:`${STUDIO_ROUTE}/?ws=pack`}:{type:'studio',entry:ws,then:'',route:`${STUDIO_ROUTE}/?ws=${ws}`,empty:`${STUDIO_ROUTE}/?ws=${ws}`};
 const route=toolRoute(game.kind==='keyword'?game.page.intent:game.key)+'/';
 return {type:'lab',entry:'',then:'',route,empty:route};
}
export const exportsFor=ws=>ws==='tile'?TILE_EXPORTS:isStudioKind(ws)?SPRITE_EXPORTS:kindOf(ws).exports;
const LAB_UI={
 open:{en:'Open the {name}',ko:'{name} 열기',ja:'{name}を開く'},
 outputs:{en:'Outputs and how each was checked',ko:'출력 파일과 검증 방법',ja:'出力ファイルと検証方法'},
 outputsLead:{en:'"Measured" means the downloaded file was opened again outside the page (Pillow, numpy or an independent parser) and the property was measured. Loading these files in a game engine was not tested.',ko:'"측정 확인"은 내려받은 파일을 페이지 밖에서(Pillow·numpy·별도 파서) 다시 열어 그 속성을 측정했다는 뜻입니다. 게임 엔진에서 불러오는 것은 시험하지 않았습니다.',ja:'「測定確認」は、ダウンロードしたファイルをページ外（Pillow・numpy・独立したパーサー）で開き直して性質を測ったという意味です。ゲームエンジンでの読み込みは試していません。'},
 guides:{en:'Guides',ko:'가이드',ja:'ガイド'}
};
function header(locale,prefix){
 return `<header class="gl-header"><a class="gl-brand" href="${prefix}" aria-label="${esc(BRAND.name)}">${logoMark({size:26})}<strong>${esc(BRAND.name)}<span>.</span></strong></a><nav class="gl-header-end" aria-label="${esc(UI.hub[locale])}"><a class="header-studio" data-studio-link href="${prefix}${STUDIO_ROUTE}/">${esc(UI.studio[locale])}</a><a class="gl-header-link" href="${prefix}${GAME_HUB_PATH}/">${esc(UI.allGame[locale])}</a><a class="gl-header-link gl-hide-s" href="${prefix}">${esc(UI.allTools[locale])}</a><label class="gl-lang">${globe}<select id="languageSelect" aria-label="${esc(t('language.label',{},locale))}"><option value="auto">${esc(t('language.auto',{},locale))}</option>${LOCALES.map(l=>`<option value="${l}" lang="${l}"${prefix===l+'/'?' selected':''}>${LANGUAGE_NAMES[l]}</option>`).join('')}</select></label></nav></header>`;
}
function shell({locale,base,title,description,headHTML,body}){
 return `<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#101217"><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><base href="${base}"><title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="src/game-landing.css"><script type="module" src="src/game-landing.js"></script>${headHTML}
</head><body class="game-landing" data-ad-exclude>${body}<input id="glFiles" type="file" multiple hidden></body></html>`;
}
function shot(key,locale,{priority=false}={}){
 const s=SHOTS[key];if(!s)return '';
 return `<figure class="gl-shot"><picture><source media="(max-width: 820px)" srcset="assets/studio/${s.file}-780.webp"><img src="assets/studio/${s.file}.webp" width="${s.w}" height="${s.h}" alt="${esc(s.alt[locale])}" decoding="async"${priority?' fetchpriority="high"':' loading="lazy"'}></picture><figcaption>${esc(UI.shotCaption[locale])}</figcaption></figure>`;
}
function badges(ws,locale,highlight=[]){
 const rows=exportsFor(ws),order=[...rows.filter(r=>highlight.includes(r.id)),...rows.filter(r=>!highlight.includes(r.id))];
 return `<ul class="gl-badges" aria-label="${esc(UI.exports[locale])}">${order.map(r=>`<li class="gl-badge is-${r.status}${highlight.includes(r.id)?' is-hl':''}" data-engine="${esc(r.id)}" title="${esc(r.note[locale])}"><b>${esc(r.name)}</b><span>${esc(STATUS[r.status][locale])}${r.engine?' · '+esc(r.engine):''}</span></li>`).join('')}</ul>`;
}
function exportTable(ws,locale){
 return `<div class="gl-table-wrap"><table class="gl-table"><thead><tr><th scope="col">${esc(UI.target[locale])}</th><th scope="col">${esc(UI.files[locale])}</th><th scope="col">${esc(UI.check[locale])}</th></tr></thead><tbody>${exportsFor(ws).map(r=>`<tr data-engine="${esc(r.id)}"><th scope="row">${esc(r.name)}</th><td><code>${esc(r.files)}</code></td><td><span class="gl-status is-${r.status}">${esc(STATUS[r.status][locale])}</span>${r.engine?` <span class="gl-engine">${esc(r.engine)}</span>`:''}<small>${esc(r.note[locale])}</small></td></tr>`).join('')}</tbody></table></div>`;
}
const EVIDENCE={
 sprite:{en:'GIF decoder: 408 of 408 frames identical to Pillow on 29 real GIFs; APNG 132 of 132 on 16 files. .aseprite: 231 corpus files imported, re-written and reopened in Aseprite 1.3.18 with the same tags, durations and pixels (231/231). Exports: 49 runs in the real engines on real CC0 assets, 47 pass — the 2 failures are Phaser 3.90\'s trimmed-XML bug, which the Phaser 3 preset avoids.',ko:'GIF 디코더: 실제 GIF 29개 408/408프레임이 Pillow와 동일, APNG 16개 132/132프레임. .aseprite: 코퍼스 231개 파일을 가져와 다시 쓰고 Aseprite 1.3.18로 열었을 때 태그·길이·픽셀 231/231 일치. 내보내기: 실제 CC0 에셋으로 실제 엔진에서 49회 실행해 47회 통과. 실패 2회는 Phaser 3.90의 트림 XML 버그이며 Phaser 3 프리셋으로 피합니다.',ja:'GIFデコーダー：実在のGIF 29本で408/408フレームがPillowと一致、APNG 16本で132/132。.aseprite：コーパス231ファイルを読み込み・書き直し、Aseprite 1.3.18で開いてタグ・長さ・ピクセルが231/231一致。書き出し：実在のCC0アセットで実際のエンジンを49回実行し47回合格。失敗2回はPhaser 3.90のトリムXMLの不具合で、Phaser 3プリセットで回避できます。'},
 pack:{en:'Exports: 49 runs in the real engines on real CC0 assets, 47 pass — the 2 failures are Phaser 3.90\'s trimmed-XML bug, which the Phaser 3 preset avoids. Packer head-to-head on 5 real frame sets (CodeAndWeb free web packer, GAPTools, free-tex-packer): smallest sheet on all 5 with rotation allowed, 4 of 5 without; every frame restored pixel-exact.',ko:'내보내기: 실제 CC0 에셋으로 실제 엔진에서 49회 실행해 47회 통과. 실패 2회는 Phaser 3.90의 트림 XML 버그이며 Phaser 3 프리셋으로 피합니다. 실제 프레임 세트 5개로 패커 비교(CodeAndWeb 무료 웹 패커, GAPTools, free-tex-packer): 회전 허용 시 5개 모두 가장 작은 시트, 회전 없이는 5개 중 4개. 모든 프레임이 픽셀 단위로 복원됩니다.',ja:'書き出し：実在のCC0アセットで実際のエンジンを49回実行し47回合格。失敗2回はPhaser 3.90のトリムXMLの不具合で、Phaser 3プリセットで回避。実在の5フレームセットでパッカー比較（CodeAndWeb無料Webパッカー、GAPTools、free-tex-packer）：回転ありで5つすべて最小、回転なしで5つ中4つ。全フレームがピクセル単位で復元できます。'},
 tile:{en:'Layouts identified from the pixels alone on the tile corpus: 4 blob-47 templates and 2 Wang templates with high confidence, a real 64 px cave tileset with medium confidence — every tile\'s bits right. Godot 4.7.2 painted every test cell exactly as the Studio predicted (485/485 per blob set, 251/251 on a 4-terrain dual-grid pack); Tiled 1.12.2 read every Wang ID back; Unity 6000.5 matched on every painted cell of the blob and side sets.',ko:'타일 코퍼스에서 픽셀만으로 배치를 인식: 블롭 47 템플릿 4개와 Wang 템플릿 2개는 높은 신뢰도, 실제 64px 동굴 타일셋은 중간 신뢰도로 모든 타일의 비트가 정확. Godot 4.7.2가 모든 테스트 칸을 Studio 예측대로 칠함(블롭 세트마다 485/485, 지형 4개 듀얼 그리드 팩 251/251). Tiled 1.12.2가 모든 Wang ID를 다시 읽음. Unity 6000.5에서 블롭·변 세트의 칠한 모든 칸 일치.',ja:'タイルコーパスでピクセルだけから配置を判定：ブロブ47テンプレート4つとWangテンプレート2つは高信頼度、実在の64px洞窟タイルセットは中信頼度で全タイルのビットが正解。Godot 4.7.2は全テストセルをStudioの予測どおりに塗りました（ブロブセットごとに485/485、4地形のデュアルグリッド251/251）。Tiled 1.12.2は全Wang IDを読み戻し、Unity 6000.5はブロブ・辺セットの塗った全セルで一致。'}
};
function faqHTML(items,locale){
 return `<section class="gl-section gl-faq" id="faq"><h2>${esc(UI.faq[locale])}</h2>${items.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`;
}
function related(keys,locale,prefix,{id,ws}={}){
 const list=keys.filter(k=>INTENTS[k]||LANDINGS[k]),guides=guidesFor({id,ws}).slice(0,3);
 if(!list.length&&!guides.length)return '';
 const item=(href,title,desc)=>`<li><a href="${href}"><b>${esc(title)}</b><small>${esc(desc)}</small></a></li>`;
 return `<nav class="gl-section gl-related" aria-label="${esc(UI.related[locale])}"><h2>${esc(UI.related[locale])}</h2><ul>${list.map(k=>item(`${prefix}${routeOf(k)}/`,titleOf(k,locale),descOf(k,locale))).join('')}</ul>${guides.length?`<h3>${esc(LAB_UI.guides[locale])}</h3><ul class="gl-guides">${guides.map(g=>item(`${prefix}${guidePath(g.slug)}/`,g.title?.[locale]||g.title?.en||g.slug,g.description?.[locale]||g.description?.en||'')).join('')}</ul>`:''}</nav>`;
}
function dropZone({game,locale,prefix}){
 const k=kindOf(game.page.ws),target=targetOf(game);
 const emptyLabel=target.type==='studio'?UI.empty[locale]:LAB_UI.open[locale].replace('{name}',k.name[locale]);
 return `<div class="gl-drop" data-gl-drop role="button" tabindex="0" aria-describedby="glDropHint"><div class="gl-drop-art" aria-hidden="true"><i></i><i></i><i></i><i></i></div><strong>${esc(k.drop[locale])}</strong><div class="gl-drop-actions"><button type="button" class="gl-primary" data-gl-pick>${esc(UI.choose[locale])}</button><a class="gl-secondary" data-gl-empty href="${prefix}${target.empty}">${esc(emptyLabel)}</a></div><small id="glDropHint" class="gl-local">${esc(UI.local[locale])}</small><p class="gl-status-line" data-gl-status role="status" aria-live="polite" hidden></p></div>`;
}
const targetAttrs=(game,prefix)=>{const t=targetOf(game);return ` data-target="${t.type}" data-href="${esc(prefix+t.route)}" data-then="${t.then}" data-ws="${esc(game.page.ws)}"`;};
/** A game landing page (Studio intent, Lab intent or keyword landing). */
export function gameLandingPage({game,locale,prefix,base,headHTML}){
 const {page,kind,key}=game,c=page.copy[locale],ws=page.ws,k=kindOf(ws),studio=isStudioKind(ws);
 const title=`${c.title} · ${BRAND.name}`,classic=kind==='intent'&&page.classic?`${prefix}${classicPath(INTENTS[key].path)}/`:'';
 const tool=kind==='keyword'?toolRoute(page.intent):toolRoute(key);
 const crumb=`<nav class="gl-crumb" aria-label="Breadcrumb"><a href="${prefix}">${esc(BRAND.name)}</a><span aria-hidden="true">/</span><a href="${prefix}${GAME_HUB_PATH}/">${esc(UI.hub[locale])}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(k.name[locale])}</span></nav>`;
 const hero=`<section class="gl-hero"><div class="gl-hero-copy">${crumb}<h1>${esc(c.title)}</h1><p class="gl-lead">${esc(c.lead)}</p>${dropZone({game,locale,prefix})}</div>${shot(page.shot,locale,{priority:true})}</section>`;
 const what=`<section class="gl-section" id="what"><h2>${esc(UI.what[locale])}</h2><ul class="gl-cards">${c.what.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
 const how=`<section class="gl-section" id="how"><h2>${esc(UI.how[locale])}</h2><ol class="gl-steps">${c.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section>`;
 const exp=`<section class="gl-section" id="exports"><h2>${esc(studio?UI.exports[locale]:LAB_UI.outputs[locale])}</h2><p class="gl-muted">${esc(studio?UI.exportsLead[locale]:LAB_UI.outputsLead[locale])}</p>${exportTable(ws,locale)}<h3>${esc(UI.evidence[locale])}</h3><p class="gl-evidence">${esc((EVIDENCE[ws]||k.evidence)[locale])}</p></section>`;
 const limits=`<section class="gl-section" id="limits"><h2>${esc(UI.limits[locale])}</h2><ul class="gl-limits">${k.limits[locale].map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`;
 const classicHTML=classic?`<aside class="gl-section gl-classic" data-gl-classic><h2>${esc(UI.classic[locale])}</h2><p>${esc(page.classic[locale])}</p><a href="${classic}" rel="nofollow">${esc(UI.classicLink[locale])} →</a></aside>`:'';
 const faq=faqHTML(gameFaq(game,locale),locale);
 const body=`${header(locale,prefix)}<main class="gl-main" data-game-landing${targetAttrs(game,prefix)} data-key="${esc(key)}" data-kind="${kind}" data-accept="${esc(k.accept)}"${tool?` data-classic="${esc(tool)}"`:''}>${hero}${badges(ws,locale,page.highlight||[])}<div class="gl-body">${what}${how}${exp}${limits}${classicHTML}${faq}${related(page.related||[],locale,prefix,{id:kind==='keyword'?page.intent:key,ws})}</div></main><div class="gl-footer">${footer(locale)}</div>`;
 return shell({locale,base,title,description:c.description,headHTML,body});
}
/** The questions a page shows (and its FAQPage data states): its own, then the common ones. */
export const gameFaq=(game,locale)=>game.kind==='hub'?COMMON_FAQ.map(x=>x[locale]):[...game.page.copy[locale].faq,...COMMON_FAQ.map(x=>x[locale])];
const GROUP_ORDER=['sprite','pack','tile','pixel','texture','ui','tilelab','spritelab'];
/** Every game page, grouped by workflow for the hub and the sitemap: {ws: [keys…]}. */
export function gameGroups(){
 const groups=Object.fromEntries(GROUP_ORDER.map(g=>[g,[]]));
 for(const [id,p] of Object.entries(GAME_INTENT_PAGES))groups[p.ws].push(id);
 for(const [id,p] of Object.entries(GAME_LAB_PAGES))groups[p.ws].push(id);
 for(const [path,p] of Object.entries(GAME_KEYWORD_PAGES))groups[p.ws].push(path);
 return groups;
}
/** Sitemap order of the game pages: hub, then each workflow group (tool landings before keyword
 * pages), then any other game tool from the home directory. The caller drops what is not indexable. */
export function gameSitemapPaths(){
 const g=gameGroups(),grouped=GROUP_ORDER.flatMap(ws=>[...g[ws].filter(k=>INTENTS[k]),...g[ws].filter(k=>!INTENTS[k])].map(routeOf));
 const others=(DIRECTORY.find(([c])=>c==='game')?.[1]||[]).map(id=>INTENTS[id]?.path).filter(Boolean);
 return [...new Set([GAME_HUB_PATH,...grouped,...others])];
}
export const HUB_GAME={kind:'hub',key:GAME_HUB_PATH,canonical:GAME_HUB_PATH,page:{ws:'sprite',shot:'sprite-frame'}};
export function gameHubPage({locale,prefix,base,headHTML}){
 const h=HUB[locale],title=`${h.title} · ${BRAND.name}`,groups=gameGroups();
 const section=ws=>groups[ws].length?`<section class="gl-section gl-hub-group" id="hub-${ws}"><h2>${esc(HUB_GROUPS[ws][locale])}</h2><ul class="gl-hub-list">${groups[ws].map(k=>`<li><a href="${prefix}${routeOf(k)}/"><b>${esc(titleOf(k,locale))}</b><small>${esc(descOf(k,locale))}</small></a></li>`).join('')}</ul></section>`:'';
 const crumb=`<nav class="gl-crumb" aria-label="Breadcrumb"><a href="${prefix}">${esc(BRAND.name)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(UI.hub[locale])}</span></nav>`;
 const hero=`<section class="gl-hero"><div class="gl-hero-copy">${crumb}<h1>${esc(h.title)}</h1><p class="gl-lead">${esc(h.lead)}</p>${dropZone({game:HUB_GAME,locale,prefix})}</div>${shot('sprite-frame',locale,{priority:true})}</section>`;
 const nav=`<nav class="gl-hub-nav" aria-label="${esc(UI.hub[locale])}">${GROUP_ORDER.filter(ws=>groups[ws].length).map(ws=>`<a href="${prefix}${GAME_HUB_PATH}/#hub-${ws}">${esc(HUB_GROUPS[ws][locale])}</a>`).join('')}</nav>`;
 const guides=guidesFor({}).length?'':'';
 const body=`${header(locale,prefix)}<main class="gl-main" data-game-landing${targetAttrs(HUB_GAME,prefix)} data-key="${GAME_HUB_PATH}" data-kind="hub" data-accept="${esc(WORKSPACES.sprite.accept)}">${hero}${badges('sprite',locale)}${nav}<div class="gl-body">${GROUP_ORDER.map(section).join('')}${guides}<section class="gl-section"><h2>${esc(UI.exports[locale])}</h2><p class="gl-muted">${esc(UI.exportsLead[locale])}</p>${badges('tile',locale)}</section>${faqHTML(COMMON_FAQ.map(x=>x[locale]),locale)}</div></main><div class="gl-footer">${footer(locale)}</div>`;
 return shell({locale,base,title,description:h.description,headHTML,body});
}
