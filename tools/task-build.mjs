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
function shell({locale,base,title,description,headHTML,body,pageClass}){
 return `<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f5f7fa"><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><base href="${base}"><title>${esc(title)}</title><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="experience.css"><link rel="stylesheet" href="content.css"><link rel="stylesheet" href="src/task/task.css"><script type="module" src="src/task/shell.js"></script>${headHTML}
</head><body class="${pageClass}">${body}<div id="toast" class="toast" role="status" aria-live="polite" hidden></div><input id="fileInput" type="file" multiple hidden></body></html>`;
}
function header(locale,prefix,home){
 return `<header class="page-header"><a class="brand" data-home-link href="${prefix}" aria-label="${esc(BRAND.name)}">${logoMark()}<strong>${esc(BRAND.name)}<span class="brand-dot">.</span></strong></a><div class="header-end">${home?'':`<a class="header-link" data-home-link data-ui="allTools" href="${prefix}">${esc(ui(locale,'allTools'))}</a>`}<label class="language-control">${globe}<select id="languageSelect" aria-label="${esc(t('language.label',{},locale))}"><option value="auto">${esc(t('language.auto',{},locale))}</option>${LOCALES.map(l=>`<option value="${l}" lang="${l}"${prefix===l+'/'?' selected':''}>${LANGUAGE_NAMES[l]}</option>`).join('')}</select></label><span class="local-pill"><span></span><span data-ui="local">${esc(ui(locale,'local'))}</span></span><a class="account-link" id="accountLink" target="_blank" rel="noopener" hidden></a></div></header>`;
}
const category=id=>DIRECTORY.find(([,ids])=>ids.includes(id))?.[0]||(TOOLS[id]?.category==='game'?'game':'image');
export function homePage({locale,prefix,base,headHTML,contentHTML}){
 const title=`${BRAND.name} — ${ui(locale,'homeTitle')}`,description=ui(locale,'homeLead');
 const card=(id,cat)=>`<a class="tool-card" data-tool="${id}" href="${prefix}${INTENTS[id].path}/"><span class="tool-badge ${cat}">${esc(BADGES[id]||CATEGORY_BADGE[cat])}</span><span><b>${esc(t(`intent.${id}.title`,{},locale))}</b><small>${esc(t(`intent.${id}.description`,{},locale))}</small></span></a>`;
 const body=`${header(locale,prefix,true)}<main class="page" id="home" data-ad-exclude><h1 id="taskTitle">${esc(ui(locale,'homeTitle'))}</h1><p class="page-lead" id="taskLead">${esc(description)}</p>
<div class="dropzone home-drop" data-action="pick" role="button" tabindex="0"><div class="drop-copy"><strong data-ui="dropTitle">${esc(ui(locale,'dropTitle'))}</strong><span data-ui="dropHint">${esc(ui(locale,'dropHint'))}</span></div><button type="button" class="primary" data-action="pick" data-ui="pick">${esc(ui(locale,'pick'))}</button></div>
<div class="suggest" id="suggest" role="region" aria-live="polite" hidden></div>
<input class="tool-query" id="toolQuery" type="search" placeholder="${esc(ui(locale,'search'))}" aria-label="${esc(ui(locale,'searchLabel'))}" autocomplete="off">
<div class="directory" id="directory">${DIRECTORY.map(([cat,ids])=>`<section><h2 data-cat="${cat}">${esc(ui(locale,'cat.'+cat))}</h2><div class="tool-grid">${ids.map(id=>card(id,cat)).join('')}</div></section>`).join('')}<p class="no-result" id="noResult" hidden></p></div></main><div id="siteContent">${contentHTML}</div>`;
 return shell({locale,base,title,description,headHTML,body,pageClass:'task-page home-page'});
}
export function taskPage({id,locale,prefix,base,title,heading,description,headHTML,contentHTML,landing=''}){
 const kinds=TASK_TOOLS[id].kinds.map(k=>ui(locale,'kinds.'+k)).join(' · ');
 const body=`${header(locale,prefix,false)}<main class="page" id="task" data-ad-exclude data-tool="${id}" data-landing="${esc(landing)}"><nav class="crumb"><a data-home-link href="${prefix}">← <span data-ui="allTools">${esc(ui(locale,'allTools'))}</span></a> / ${esc(ui(locale,'cat.'+category(id)))}</nav><h1 id="taskTitle">${esc(heading)}</h1><p class="page-lead" id="taskLead">${esc(description)}</p>
<div id="taskApp"><div class="dropzone" data-action="pick" role="button" tabindex="0"><strong>${esc(ui(locale,'taskDrop',{kind:kinds}))}</strong><span>${esc(ui(locale,'multi'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(ui(locale,'pick'))}</button></div><small class="local-note">${esc(ui(locale,'local'))}</small></div></div></main><div id="siteContent">${contentHTML}</div>`;
 return shell({locale,base,title,description,headHTML,body,pageClass:'task-page'});
}
