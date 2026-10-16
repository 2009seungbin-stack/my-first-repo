/** Static indexable pages, sharing the real portal shell, fonts, theme and SVG icons. */
import {page} from '../platform/render/ui.js';
import {html,raw} from '../platform/render/html.js';
import {icon} from '../platform/render/icons.js';
import {ADAPTERS} from '../src/preflight/adapters/index.js';
import {text} from '../src/preflight/messages.js';
import {LANGUAGE_NAMES,LOCALES} from '../src/i18n.js';
import DEPTH from '../src/seo-depth/preflight.js';
import {answerHTML,depthSection,DEPTH_ORDER} from '../src/seo-depth/render.js';
import {BEACON_TAG} from './traffic-build.mjs';
export const PREFLIGHT_PATHS=['preflight',...Object.keys(ADAPTERS).map(v=>'preflight/'+v)];
export const STATUS_ICONS={READY:'check',UPDATE_REQUIRED:'up',CAUTION:'alert',LEGACY:'history',UNKNOWN:'helpCircle',BLOCKED:'xCircle',DEPRECATED:'clock',NOT_APPLICABLE:'dashCircle',WAIT:'clock'};
const FEATURES={
 obs:[
  ['OBS 업그레이드 전에 플러그인부터 확인하세요','Check plugins before upgrading OBS','OBS更新前にプラグインを確認'],
  ['현재 OBS와 목표 버전, 운영체제·아키텍처, 설치된 플러그인 목록을 입력하세요. 플러그인 최소 버전, ABI와 런타임 조건, 설치 경로, 의존성, 근거 날짜를 하나의 보고서로 확인할 수 있습니다.','Enter your current and target OBS versions, OS, architecture and plugin inventory. Review minimum versions, ABI/runtime constraints, installation paths, dependencies and evidence dates in one report.','現在と目標のOBS版、OS、アーキテクチャ、プラグインを入力。最低版、ABI、ランタイム、設置先、依存関係、確認日を一つのレポートで確認できます。'],
  ['OBS 32 → 33, 또는 다른 버전 비교','Compare OBS 32 → 33 or another target','OBS 32 → 33や別の目標版を比較'],
  ['목표 버전을 바꾸면 같은 환경을 다시 검사합니다. OBS 공식 문서의 Windows legacy 설치 구조를 확인하며, 34부터 로드되지 않는 특정 Program Files 구조를 구분합니다. 문서에 없는 버전 지원을 추정하지 않습니다.','Change the target to re-check the same setup. Documented Windows legacy layouts are distinguished from the specific Program Files structure that stops loading with OBS 34. Undocumented version support is not inferred.','目標版を変えて再確認。Windowsのレガシー構造とOBS 34で読み込めなくなる特定のProgram Files構造を区別します。未記載の互換性は推測しません。'],
 ],
 studio:[
  ['VST 하나가 아닌 음악 제작 환경 전체','Your entire music production stack','音楽制作環境全体を確認'],
  ['macOS와 Apple Silicon 전환에는 DAW, VST2·VST3·AU·AAX, 인터페이스, 드라이버, 제어 소프트웨어와 라이선스 관리자가 함께 영향을 받습니다. 목록 붙여넣기와 스캐너 JSON으로 한 번에 가져오세요.','macOS and Apple Silicon upgrades involve DAWs, VST2/VST3/AU/AAX, audio interfaces, drivers, control software and license managers. Import the inventory with a pasted list or scanner JSON.','macOSとApple Siliconの更新はDAW、VST2/VST3/AU/AAX、インターフェイス、ドライバー、ライセンス管理にも影響します。リストかJSONで一括入力してください。'],
  ['네이티브와 Rosetta, 드라이버 의존성','Native, Rosetta and driver dependencies','ネイティブ、Rosetta、ドライバーの依存関係'],
  ['고급 옵션에서 DAW와 지원 형식·런타임을 지정하세요. 근거가 있는 Rosetta·Intel 전용 조건을 판정하며, 드라이버나 라이선스 의존성의 실패는 플러그인 결과에도 반영됩니다.','Specify the DAW, plugin formats and runtimes in advanced options. Evidence-backed Rosetta/Intel constraints and driver/license dependency failures affect the dependent components too.','詳細設定でDAW、形式、ランタイムを指定。根拠のあるRosetta/Intel条件とドライバー・ライセンスの障害を依存する構成にも反映します。'],
 ],
 blender:[
  ['Blender 제작 파이프라인의 업그레이드 검사','Preflight your Blender creator pipeline','Blender制作パイプラインを確認'],
  ['애드온, Extensions, Geometry Nodes 팩, 렌더 엔진, Python 도구, 에셋과 내보내기 파이프라인을 같은 환경에서 검사하세요. LTS 태그와 숫자 버전을 구분해 비교합니다.','Check add-ons, extensions, Geometry Nodes packs, render engines, Python tools, asset libraries and export pipelines together. Numeric versions are compared correctly with LTS tags.','アドオン、Extensions、Geometry Nodes、レンダー、Python、アセット、出力をまとめて確認。LTS表記を含む数字版を正しく比較します。'],
  ['Python과 API 변경을 함께 확인','Review Python and API changes together','PythonとAPI変更を確認'],
  ['최소·최대 검증 버전과 Python 런타임 요구, 바이너리 확장, API 변경을 근거에 따라 판정합니다. 해결책이 없는 필수 변경은 WAIT로 표시합니다.','Resolve tested ranges, Python runtime requirements, binary extensions and API changes from evidence. Unresolved critical changes produce a WAIT verdict.','検証範囲、Python要件、バイナリ拡張、API変更を根拠から判定。未解決の必須変更はWAITになります。'],
 ],
 godot:[
  ['Godot 프로젝트 스택 전체를 확인','Check the whole Godot project stack','Godotのプロジェクト構成全体を確認'],
  ['에디터 플러그인, GDExtension, GodotSteam, 대화·지형 도구, 네이티브 라이브러리와 내보내기 템플릿을 추가하세요. 버전뿐 아니라 렌더러와 프로젝트 언어도 함께 확인합니다.','Add editor plugins, GDExtensions, GodotSteam, dialogue/terrain tools, native libraries and export templates. Check the renderer and project language alongside engine versions.','エディタープラグイン、GDExtension、GodotSteam、会話・地形、ネイティブ、テンプレートを追加。版に加えてレンダラーと言語も確認。'],
  ['.NET과 네이티브 바이너리 조건','Inspect .NET and native binary requirements','.NETとネイティブバイナリ要件'],
  ['고급 옵션에서 .NET 등의 런타임을 지정할 수 있습니다. 필요한 API나 바이너리가 준비되지 않았다면 의존성까지 반영해 기다려야 할 이유와 출처를 보여줍니다.','Use advanced options to specify runtimes such as .NET. If a required API or binary is not ready, the report includes dependency impacts, reasons to wait and their sources.','詳細設定で.NETなどを指定できます。APIやバイナリが未対応なら依存関係の影響、待つ理由、出典を表示します。'],
 ],
};
export function preflightPage({locale='en',path='preflight',siteURL='',preview=false,platform=false,base='/'}={}){
 const v=path.split('/')[1],adapter=ADAPTERS[v],index=locale==='ko'?0:locale==='ja'?2:1;
 const t=k=>text(locale,k),link=p=>'/'+locale+'/'+p+'/';
 const name=adapter?(v==='obs'?'OBS':v==='studio'?'Studio':v==='blender'?'Blender':'Godot'):'Preflight';
 const title=(adapter?t('seo.'+v):'Nerulio Preflight')+' · Nerulio';
 const description=adapter?FEATURES[v][1][index]:t('lead');
 const nav=html`<nav class="pf-nav" aria-label="Preflight">${Object.entries(ADAPTERS).map(([id,a])=>html`<a href="${link('preflight/'+id)}"${id===v?html` aria-current="page"`:''}>${icon(a.icon,18)}${id==='obs'?'OBS':id==='studio'?'Studio':id==='blender'?'Blender':'Godot'}</a>`)}</nav>`;
 const languages=html`<nav class="pf-languages" aria-label="Language">${LOCALES.map(l=>html`<a href="${'/'+l+'/'+path+'/'}" lang="${l}"${l===locale?html` aria-current="page"`:''}>${LANGUAGE_NAMES[l]}</a>`)}</nav>`;
 const hero=html`<header class="pf-head"><div class="pf-kicker"><a href="${link('preflight')}">Nerulio Preflight</a><span> / ${name}</span></div>${languages}<h1>${adapter?t('seo.'+v):t('title')}</h1><p>${adapter?t('vertical.'+v):t('lead')}</p><p class="pf-local">${icon('check',15)}${t('privacy')}</p></header>`;
 const body=adapter?html`${hero}${nav}${workspace(adapter,locale)}${editorial(v,locale)}`:
  html`${hero}<div class="pf-verticals">${Object.entries(ADAPTERS).map(([id,a])=>html`<a href="${link('preflight/'+id)}"><span class="pf-vertical-icon">${icon(a.icon,32)}</span><h2>${id==='obs'?'OBS':id==='studio'?'Studio':id==='blender'?'Blender':'Godot'}</h2><p>${t('vertical.'+id)}</p><span class="pf-vertical-go" aria-hidden="true">→</span></a>`)}</div>${intentContent(path,locale)}`;
 const origin=siteURL||'https://nerulio.com/',canonical=new URL(locale+'/'+path+'/',origin).href;
 const alternates=Object.fromEntries(LOCALES.map(l=>[l,new URL(l+'/'+path+'/',origin).href]));
 let out=String(page({l:locale,title,description,canonical,alternates,channels:[],noindex:preview,body,toolsOnly:true,
  jsonld:{'@context':'https://schema.org','@type':'WebApplication',name:'Nerulio Preflight'+(adapter?' — '+name:''),url:canonical,inLanguage:locale,
   applicationCategory:'UtilitiesApplication',operatingSystem:'Web',description,featureList:['Local inventory analysis','Evidence-backed upgrade verdict','Dependency resolution','JSON report export']}}));
 // The shared shell always contains the portal beacon. The outer static builder adds it
 // only when traffic is enabled, just as it does for the existing tools.
 out=out.replace(BEACON_TAG,'');
 out=out.replaceAll('href="/ja/tools/"','href="/ja/"');
 if(!platform)out=out.replaceAll('href="/ko/tools/"','href="/ko/"').replaceAll('href="/en/tools/"','href="/en/"');
 // The platform shell is reused at build time; Preflight itself has no account or traffic requests.
 return out.replace('<head>','<head>\n<base href="'+base+'">').replace('</head>','<link rel="stylesheet" href="/src/preflight/preflight.css?v=1">\n'+(adapter?'<script type="module" src="/src/preflight/app.js"></script>\n':'')+'</head>')
  .replace('<main class="pg"','<main class="pg pf-main"').replace('class="n2"','class="n2 pf-page"')
  .replace(/(href|src|action)="\/(?!\/)/g,'$1="');
}
function workspace(a,l){
 const t=k=>text(l,k),options=(values,selected)=>values.map(value=>html`<option value="${value}"${value===selected?html` selected`:''}>${value}</option>`);
 const field=(name,label,value='',placeholder='')=>html`<label>${t(label)}<input name="${name}" value="${value}" placeholder="${placeholder}" maxlength="80"></label>`;
 return html`<div id="preflight" data-vertical="${a.id}" data-locale="${l}" aria-busy="true">
 <div class="pf-workspace">
 <section class="pf-input">
 <form id="pf-environment"><h2><span class="pf-step">01</span>${t('step1')}</h2>
 <div class="pf-version-pair">${field('current','current',a.defaultCurrent)}<span aria-hidden="true">→</span>${field('target','target',a.defaultTarget)}</div>
 <div class="pf-fields"><label>${t('platform')}<select name="platform">${options(['windows','macos','linux'],a.defaultPlatform)}</select></label><label>${t('architecture')}<select name="architecture">${options(['x86_64','arm64','x86'],a.defaultArchitecture)}</select></label></div>
 <details class="pf-advanced"><summary>${t('advanced')}</summary>
 <div class="pf-fields">${field('osVersion','osVersion')}
 ${a.id==='godot'?html`<label>${t('renderer')}<select name="renderer">${options(['forward_plus','mobile','compatibility'],'forward_plus')}</select></label><label>${t('language')}<select name="language">${options(['gdscript','dotnet'],'gdscript')}</select></label>`:''}
 ${a.id==='studio'?field('daw','daw'):''}</div>
 ${a.id==='studio'?html`<fieldset class="pf-formats"><legend>${t('formats')}</legend>${['VST2','VST3','AU','AAX'].map(f=>html`<label><input type="checkbox" name="format" value="${f}">${f}</label>`)}</fieldset>`:''}
 <label>${t('runtimes')}<textarea name="runtimes" rows="2" placeholder="${a.id==='blender'?'Python=3.13':a.id==='godot'?'.NET=8.0':'CEF=1.0'}"></textarea></label></details></form>
 <div class="pf-section-title"><h2><span class="pf-step">02</span>${t('step2')}</h2></div>
 <div class="pf-toolbar"><button type="button" data-mode="manual" aria-pressed="true">${icon('plus',16)}${t('manual')}</button><button type="button" data-mode="paste" aria-pressed="false">${icon('sheet',16)}${t('paste')}</button></div>
 <form id="pf-add"><label>${t('name')}<input name="name" id="pf-picker" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pf-picker-options" autocomplete="off" required maxlength="160" placeholder="StreamFX, Kontakt…"></label>
 <div class="pf-picker-options" id="pf-picker-options" role="listbox" aria-label="${t('recent')}" hidden></div>
 <div class="pf-fields"><label>${t('version')}<input name="version" maxlength="80" placeholder="1.2.3"></label><label>${t('category')}<select name="category">${options(a.categories,a.categories[0])}<option>Other</option></select></label></div>
 <label class="pf-check"><input type="checkbox" name="critical" checked title="${t('criticalHelp')}">${t('critical')}</label>
 <details class="pf-advanced"><summary>${t('advanced')}</summary>${field('vendor','vendor')}${field('installPath','installPath')}
 <label>${t('installType')}<select name="installType">${options(['unknown','modern','programdata-legacy','programfiles-legacy','old-plugin-directory','portable-legacy','builtin','flatpak','bundle'],'unknown')}</select></label>
 <div class="pf-fields"><label>${t('binaryOS')}<select name="binaryOS"><option value="">${t('unknownValue')}</option>${options(['windows','macos','linux'],'')}</select></label><label>${t('binaryArch')}<select name="binaryArch"><option value="">${t('unknownValue')}</option>${options(['x86_64','arm64','x86','universal'],'')}</select></label></div>
 <label class="pf-check"><input type="checkbox" name="native">${t('native')}</label>
 ${field('builtForHost','builtForHost')}
 <label>${t('dependencies')}<textarea name="dependencies" rows="2" placeholder="runtime-id@>=1"></textarea></label></details>
 <button type="submit" class="pf-primary">${icon('plus',16)}${t('add')}</button></form>
 <form id="pf-paste" hidden><label>${t('paste')}<textarea name="list" rows="6" placeholder="StreamFX @ 1.0&#10;Aitum Vertical @ 1.5"></textarea></label><p class="pf-muted">${t('pasteHelp')}</p><button type="submit" class="pf-primary">${t('add')}</button></form>
 <div class="pf-toolbar pf-import"><label class="pf-button" tabindex="0" role="button" id="pf-import-label">${icon('folder',16)}${t('import')}<input id="pf-file" type="file" accept=".json,application/json" hidden></label><button type="button" id="pf-sample">${t('sample')}</button></div>
 <p class="pf-muted">${t('scannerHelp')}</p><details class="pf-schema"><summary>${t('schema')}</summary><p>${t('formatHelp')}</p><pre>${JSON.stringify({schemaVersion:1,vertical:a.id,platform:a.defaultPlatform,architecture:a.defaultArchitecture,generatedAt:'2026-10-05T00:00:00Z',host:{name:a.host,version:a.defaultCurrent},components:[{id:'my-component',name:'My component',version:'1.0',category:a.categories[0],critical:true}]},null,2)}</pre></details>
 <details class="pf-inventory"><summary>${t('step2')} <span id="pf-inventory-count">0</span></summary><div id="pf-inventory"></div><button type="button" id="pf-clear">${t('clear')}</button></details>
 <button type="button" id="pf-run" class="pf-primary pf-run" disabled>${icon('check',18)}${t('run')}</button><p class="pf-muted">${t('updateNow')}</p>
 <details class="pf-setups"><summary>${icon('folder',16)}${t('setups')}</summary><div class="pf-fields"><label>${t('setupName')}<input id="pf-setup-name" maxlength="100" value="My setup"></label><button type="button" id="pf-save">${t('save')}</button></div><div id="pf-saved"></div></details>
 </section>
 <section class="pf-overview" aria-labelledby="pf-result-title"><h2 id="pf-result-title"><span class="pf-step">03</span>${t('step3')}</h2><div id="pf-verdict"><p class="pf-muted">${t('running')}</p></div>
 <p class="pf-provenance" id="pf-provenance">${t('realWarning')}</p><div id="pf-actions"></div>
 <details class="pf-comparison"><summary>${icon('convert',17)}${t('compare')}</summary><form id="pf-compare"><label>${t('compareVersion')}<input name="compareVersion" value="${a.id==='obs'?'34.0':''}" maxlength="80" required></label><button type="submit">${t('compare')}</button></form><div id="pf-diff"></div></details>
 <div class="pf-toolbar pf-export"><button id="pf-copy" type="button">${icon('share',16)}${t('summary')}</button><button id="pf-export" type="button">${icon('down',16)}${t('export')}</button><button id="pf-export-report" type="button">${t('exportReport')}</button><button id="pf-print" type="button">${t('print')}</button></div>
 <label id="pf-copy-fallback" hidden>${t('copyFailed')}<textarea readonly rows="8"></textarea></label></section>
 </div>
 <p id="pf-notice" class="pf-notice" role="status" aria-live="polite" hidden></p>
 <section class="pf-report" id="pf-report" hidden><header><h2>${t('report')}</h2><label class="pf-search">${icon('search',17)}<input id="pf-report-search" type="search" aria-label="${t('search')}" placeholder="${t('search')}"></label></header>
 <div class="pf-toolbar pf-filters" role="group" aria-label="${t('status')}">${['all','problems','updates','unknown','ready'].map((f,i)=>html`<button type="button" data-filter="${f}" aria-pressed="${i===0}">${f==='unknown'?t('status.UNKNOWN'):f==='ready'?t('status.READY'):t(f)}</button>`)}</div>
 <div class="pf-table-wrap" tabindex="0" aria-label="${t('report')}"><table><thead><tr>${['name','installed','recommended','status','confidence','reason'].map(k=>html`<th scope="col">${t(k)}</th>`)}</tr></thead><tbody id="pf-results"></tbody></table></div><div class="pf-pagination"><span id="pf-display-count"></span><button id="pf-more" type="button" hidden>${t('showMore')}</button></div></section>
 ${Object.entries(STATUS_ICONS).map(([status,name])=>html`<template id="pf-icon-${status}">${icon(name,18)}</template>`)}
 <noscript><p>${t('empty')} JavaScript is required for local analysis.</p></noscript>
 </div>`;
}
function editorial(v,l){
 const i=l==='ko'?0:l==='ja'?2:1,f=FEATURES[v],t=k=>text(l,k);
 return html`<section class="pf-explain"><h2>${f[0][i]}</h2><p>${f[1][i]}</p><h3>${f[2][i]}</h3><p>${f[3][i]}</p></section>${intentContent('preflight/'+v,l)}`;
}
function intentContent(path,locale){
 const d=DEPTH[path][locale];
 return html`<section class="pf-explain">${raw(answerHTML(d))}${DEPTH_ORDER.map(([id])=>raw(depthSection(id,d,locale,{},'pf-reading')))}</section>`;
}
