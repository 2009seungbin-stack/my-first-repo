import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BRAND} from '../src/brand.js';
import {logoMark} from '../src/logo.js';
import {LOCALES,LANGUAGE_NAMES,t} from '../src/i18n.js';
import {INTENTS} from '../src/intents.js';
import {footer} from '../src/content.js';
import {GUIDES,GUIDE_INDEX,GUIDE_SECTIONS,GUIDE_ENGINES,STUDIO_WORKSPACES,guidePath,guideBySlug,guideRoute} from '../src/guides.js';
/** Static pages of the editorial guides (src/guides.js): /guides/ and /guides/<slug>/ in every
 * language. Pure apart from reading content/guides/<slug>/<locale>.md and the size of the images
 * under assets/guides/ (both relative to `root`). No page script is needed to read a guide;
 * src/guides-page.js only adds the language switch and copy buttons. */
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=d=>`<script type="application/ld+json">${JSON.stringify(d).replaceAll('<','\\u003c')}</script>`;

export const COPY={
 ko:{guides:'게임 개발 가이드',indexLead:'Godot·Unity·Phaser·PixiJS·Defold·LÖVE·GameMaker에서 스프라이트 시트, 선명한 픽셀 아트, 오토타일, 아틀라스, 노멀맵, 폰트를 다루는 방법을 단계별로 정리했습니다. 각 엔진의 공식 문서와 실제 실행으로 확인한 내용입니다.',byTopic:'주제별',byEngine:'엔진별',updated:'업데이트',tested:'직접 실행해 확인',toc:'목차',doIt:'Nerulio에서 하기',related:'관련 가이드',tools:'관련 도구',faq:'자주 묻는 질문',home:'홈',studio:'스튜디오',allGuides:'모든 가이드',copy:'복사',copied:'복사됨',language:'언어',
  open:{sprite:'스프라이트 작업 공간 열기',pack:'패킹·내보내기 작업 공간 열기',tile:'타일 작업 공간 열기',tool:'{name} 열기'},count:'가이드 {n}개',author:'Nerulio 팀',readTime:'{m}분 분량'},
 en:{guides:'Game dev guides',indexLead:'Step-by-step guides for sprite sheets, crisp pixel art, autotiles, texture atlases, normal maps and fonts in Godot, Unity, Phaser, PixiJS, Defold, LÖVE and GameMaker — checked against each engine’s official docs and run in the real engines.',byTopic:'By topic',byEngine:'By engine',updated:'Updated',tested:'Tested in',toc:'On this page',doIt:'Do it in Nerulio',related:'Related guides',tools:'Tools for this',faq:'FAQ',home:'Home',studio:'Studio',allGuides:'All guides',copy:'Copy',copied:'Copied',language:'Language',
  open:{sprite:'Open the Sprite workspace',pack:'Open Pack & Export',tile:'Open the Tile workspace',tool:'Open {name}'},count:'{n} guides',author:'Nerulio team',readTime:'{m} min read'},
 ja:{guides:'ゲーム開発ガイド',indexLead:'Godot・Unity・Phaser・PixiJS・Defold・LÖVE・GameMakerで、スプライトシート、くっきりしたドット絵、オートタイル、アトラス、ノーマルマップ、フォントを扱う手順をまとめました。各エンジンの公式ドキュメントと実際の動作で確認しています。',byTopic:'トピック別',byEngine:'エンジン別',updated:'更新日',tested:'実行して確認',toc:'目次',doIt:'Nerulioでやる',related:'関連ガイド',tools:'関連ツール',faq:'よくある質問',home:'ホーム',studio:'スタジオ',allGuides:'すべてのガイド',copy:'コピー',copied:'コピーしました',language:'言語',
  open:{sprite:'スプライト作業画面を開く',pack:'パック・書き出しを開く',tile:'タイル作業画面を開く',tool:'{name}を開く'},count:'{n}本のガイド',author:'Nerulioチーム',readTime:'約{m}分'}
};
const fill=(s,v)=>String(s).replace(/\{(\w+)\}/g,(m,k)=>k in v?v[k]:m);

/* ---------------------------------------------------------------- markdown (the dialect in
 * scratchpad WRITER-SPEC / docs: headings with {#id}, lists, tables, fences, shot images,
 * callouts, :::steps and :::nerulio blocks). Anything else is a paragraph. */
const HEADING=/^(#{2,3})\s+(.+?)(?:\s+\{#([a-z0-9][a-z0-9-]*)\})?\s*$/;
const FENCE=/^```\s*([\w+-]*)\s*$/;
const LIST=/^(\s*)(-|\d+\.)\s+(.*)$/;
const IMAGE=/^!\[([^\]]*)\]\(shot:([a-z0-9-]+)(?:\s+"([^"]*)")?\)\s*$/;
const slugify=s=>s.toLowerCase().replace(/<[^>]+>/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
/** `ctx` = {locale, prefix, slug, root, problems:[]} — links and images are resolved against it. */
export function inline(text,ctx){
 const codes=[];let s=String(text).replace(/`([^`]+)`/g,(m,c)=>{codes.push(c);return `\u0000${codes.length-1}\u0000`;});
 s=esc(s);
 s=s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(m,label,href)=>{
  const url=resolveLink(href.replaceAll('&amp;','&'),ctx);
  const ext=/^https?:/.test(url);
  return `<a href="${esc(url)}"${ext?' rel="noopener"':''}>${label}</a>`;
 });
 s=s.replace(/\*\*([^*]+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g,'$1<em>$2</em>');
 return s.replace(/\u0000(\d+)\u0000/g,(m,i)=>`<code>${esc(codes[+i])}</code>`);
}
export function resolveLink(href,ctx){
 const {prefix='',slug=''}=ctx;let m;
 if(/^https?:\/\//.test(href))return href;
 if(href.startsWith('#'))return `${prefix}${guidePath(slug)}/${href}`;
 if((m=href.match(/^guide:([a-z0-9-]+)(#[a-z0-9-]+)?$/))){if(!guideBySlug(m[1]))ctx.problems?.push(`unknown guide link ${href}`);return `${prefix}${guidePath(m[1])}/${m[2]||''}`;}
 if((m=href.match(/^tool:([\w-]+)$/))){if(!INTENTS[m[1]]){ctx.problems?.push(`unknown tool link ${href}`);return prefix;}return `${prefix}${INTENTS[m[1]].path}/`;}
 if((m=href.match(/^studio:([a-z]+)$/))){if(!STUDIO_WORKSPACES.includes(m[1]))ctx.problems?.push(`unknown studio workspace ${href}`);return `${prefix}game/studio/?ws=${m[1]}`;}
 ctx.problems?.push(`unsupported link ${href}`);return href;
}
/** Width/height of a PNG or WebP (VP8, VP8L, VP8X) file, for layout-stable <img> tags. */
export function imageSize(file){
 const b=readFileSync(file);
 if(b.toString('ascii',1,4)==='PNG')return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){
  const kind=b.toString('ascii',12,16);
  if(kind==='VP8X')return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
  if(kind==='VP8L'){const v=b.readUInt32LE(21);return {width:1+(v&0x3fff),height:1+((v>>14)&0x3fff)};}
  if(kind==='VP8 ')return {width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
 }
 throw Error('Unknown image format: '+file);
}
/** `shot:<name>` → the localized screenshot if there is one, else the shared one. */
export function shotFile(name,locale,root=ROOT){
 for(const f of [`assets/guides/${name}-${locale}.webp`,`assets/guides/${name}.webp`,`assets/guides/${name}-${locale}.png`,`assets/guides/${name}.png`])if(existsSync(path.join(root,f)))return f;
 return null;
}
function figure(alt,name,caption,ctx){
 const file=shotFile(name,ctx.locale,ctx.root);
 if(!file){ctx.problems?.push(`missing screenshot ${name}`);return '';}
 const {width,height}=imageSize(path.join(ctx.root||ROOT,file));ctx.images?.push(file);
 return `<figure class="guide-shot"><a href="${file}" target="_blank" rel="noopener"><img src="${file}" width="${width}" height="${height}" alt="${esc(alt)}" loading="lazy" decoding="async"></a>${caption?`<figcaption>${inline(caption,ctx)}</figcaption>`:''}</figure>`;
}
function parseList(lines,i){
 // One list (ordered or not) with an optional nested level. Returns [html-less items, next index].
 const first=lines[i].match(LIST),ordered=/\d/.test(first[2]),base=first[1].length,items=[];
 while(i<lines.length){
  const line=lines[i];if(!line.trim()){
   // a blank line ends the list unless the next line continues it
   const next=lines[i+1]?.match(LIST);if(next&&next[1].length>=base&&/\d/.test(next[2])===ordered){i++;continue;}break;}
  const m=line.match(LIST);
  if(m&&m[1].length===base){if(/\d/.test(m[2])!==ordered)break;items.push({text:m[3],sub:[],subOrdered:false});i++;continue;}
  if(m&&m[1].length>base&&items.length){items.at(-1).sub.push(m[3]);items.at(-1).subOrdered=/\d/.test(m[2]);i++;continue;}
  if(/^\s{2,}\S/.test(line)&&items.length){const it=items.at(-1);if(it.sub.length)it.sub[it.sub.length-1]+=' '+line.trim();else it.text+=' '+line.trim();i++;continue;}
  break;
 }
 return [{ordered,items},i];
}
const listHTML=({ordered,items},ctx,cls='')=>`<${ordered?'ol':'ul'}${cls?` class="${cls}"`:''}>${items.map(it=>`<li>${inline(it.text,ctx)}${it.sub.length?`<${it.subOrdered?'ol':'ul'}>${it.sub.map(s=>`<li>${inline(s,ctx)}</li>`).join('')}</${it.subOrdered?'ol':'ul'}>`:''}</li>`).join('')}</${ordered?'ol':'ul'}>`;
const splitRow=r=>r.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(c=>c.trim().replaceAll('\\|','|'));
/** Plain text of inline markdown (for structured data and word counts). */
export const plain=s=>String(s).replace(/`([^`]+)`/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1');
/** Markdown → {html, intro, toc, steps, faq, nerulio, problems, images, text}. */
export function renderMarkdown(src,ctx){
 ctx={problems:[],images:[],...ctx};
 const lines=String(src).replace(/\r\n?/g,'\n').split('\n');
 const out=[],toc=[],steps=[],faq=[],text=[],ids=new Set();let nerulio=null,section='',introEnd=-1,i=0,faqQ=null;
 const emit=(html,words)=>{out.push(html);if(words)text.push(words);};
 function block(until){
  // Parses lines[i…] until a line equal to `until` (for ::: blocks) or the end.
  const start=out.length;
  while(i<lines.length){
   const line=lines[i];
   if(until&&line.trim()===until){i++;break;}
   if(!line.trim()){i++;continue;}
   let m;
   if((m=line.match(FENCE))){
    const lang=m[1],code=[];i++;
    while(i<lines.length&&!/^```\s*$/.test(lines[i]))code.push(lines[i++]);
    if(i>=lines.length)ctx.problems.push('unclosed code fence');i++;
    emit(`<div class="guide-code"><pre><code${lang?` class="language-${esc(lang)}" data-lang="${esc(lang)}"`:''}>${esc(code.join('\n'))}</code></pre></div>`);continue;
   }
   if((m=line.match(/^:::(steps|nerulio)(.*)$/))){
    i++;const kind=m[1],args=Object.fromEntries([...m[2].matchAll(/(\w+)=([\w-]+)/g)].map(a=>[a[1],a[2]]));
    if(kind==='steps'){
     if(steps.length)ctx.problems.push('more than one :::steps block');
     while(i<lines.length&&!lines[i].trim())i++;
     if(!lines[i]?.match(LIST)){ctx.problems.push(':::steps must contain an ordered list');continue;}
     const [list,next]=parseList(lines,i);i=next;
     while(i<lines.length&&lines[i].trim()!==':::'){if(lines[i].trim())ctx.problems.push('text after the list inside :::steps');i++;}i++;
     list.items.forEach((it,k)=>{const nm=it.text.match(/^\*\*(.+?)\*\*\s*(.*)$/);steps.push({name:plain(nm?nm[1]:it.text).replace(/[.:。：]$/,''),text:plain(nm?nm[2]||nm[1]:it.text)+(it.sub.length?' '+it.sub.map(plain).join(' '):''),id:`step-${k+1}`});});
     emit(`<ol class="guide-steps">${list.items.map((it,k)=>`<li id="step-${k+1}">${inline(it.text,ctx)}${it.sub.length?listHTML({ordered:it.subOrdered,items:it.sub.map(s=>({text:s,sub:[]}))},ctx):''}</li>`).join('')}</ol>`,list.items.map(it=>plain(it.text)+' '+it.sub.map(plain).join(' ')).join(' '));
    }else{
     if(nerulio)ctx.problems.push('more than one :::nerulio block');
     const target=args.ws?{ws:args.ws}:args.tool?{tool:args.tool}:null;
     if(!target)ctx.problems.push(':::nerulio needs ws= or tool=');
     if(target?.ws&&!STUDIO_WORKSPACES.includes(target.ws))ctx.problems.push(`unknown workspace ${target.ws}`);
     if(target?.tool&&!INTENTS[target.tool])ctx.problems.push(`unknown tool ${target.tool}`);
     const at=out.length;block(':::');const body=out.splice(at).join('');
     nerulio={target:target||{ws:'sprite'},html:body};toc.push({id:'nerulio',text:COPY[ctx.locale]?.doIt||'Nerulio'});
     emit(nerulioBlock(nerulio,ctx));
    }
    continue;
   }
   if((m=line.match(HEADING))){
    i++;const level=m[1].length,label=m[2];let id=m[3];
    if(level===2&&!id)ctx.problems.push(`## heading without {#id}: ${label}`);
    id=id||slugify(plain(label))||`h-${out.length}`;
    if(ids.has(id))ctx.problems.push(`duplicate id ${id}`);ids.add(id);
    if(level===2){section=id;toc.push({id,text:plain(label)});if(introEnd<0)introEnd=out.length;faqQ=null;}
    if(level===3&&section==='faq'){faqQ={q:plain(label),a:[]};faq.push(faqQ);}
    emit(`<h${level} id="${id}">${inline(label,ctx)}</h${level}>`,plain(label));continue;
   }
   if((m=line.match(IMAGE))){i++;emit(figure(m[1],m[2],m[3],ctx));continue;}
   if(line.startsWith('>')){
    const quote=[];while(i<lines.length&&lines[i].startsWith('>'))quote.push(lines[i++].replace(/^>\s?/,''));
    emit(`<aside class="guide-note"><p>${inline(quote.join(' '),ctx)}</p></aside>`,plain(quote.join(' ')));continue;
   }
   if(line.trim().startsWith('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]||'')){
    const head=splitRow(line),align=splitRow(lines[i+1]).map(c=>c.endsWith(':')?(c.startsWith(':')?'center':'right'):'');i+=2;const rows=[];
    while(i<lines.length&&lines[i].trim().startsWith('|'))rows.push(splitRow(lines[i++]));
    const cell=(tag,c,k)=>`<${tag}${align[k]?` style="text-align:${align[k]}"`:''}>${inline(c,ctx)}</${tag}>`;
    emit(`<div class="guide-table"><table><thead><tr>${head.map((c,k)=>cell('th',c,k)).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,k)=>cell('td',c,k)).join('')}</tr>`).join('')}</tbody></table></div>`,[head,...rows].flat().map(plain).join(' '));continue;
   }
   if(LIST.test(line)&&!/^\s{2,}/.test(line)){
    const [list,next]=parseList(lines,i);i=next;
    emit(listHTML(list,ctx),list.items.map(it=>plain(it.text)+' '+it.sub.map(plain).join(' ')).join(' '));
    if(faqQ)faqQ.a.push(list.items.map(it=>plain(it.text)).join(' '));continue;
   }
   const para=[];
   while(i<lines.length&&lines[i].trim()&&!FENCE.test(lines[i])&&!HEADING.test(lines[i])&&!IMAGE.test(lines[i])&&!lines[i].startsWith('>')&&!/^:::/.test(lines[i])&&!(LIST.test(lines[i])&&!/^\s{2,}/.test(lines[i]))&&!(lines[i].trim().startsWith('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]||'')))para.push(lines[i++].trim());
   if(!para.length){ctx.problems.push(`cannot parse line ${i+1}: ${line}`);i++;continue;}
   emit(`<p>${inline(para.join(' '),ctx)}</p>`,plain(para.join(' ')));
   if(faqQ)faqQ.a.push(plain(para.join(' ')));
  }
  return out.slice(start);
 }
 block(null);
 if(introEnd<0)introEnd=out.length;
 for(const f of faq)if(!f.a.length)ctx.problems.push(`FAQ without an answer: ${f.q}`);
 return {html:out.slice(introEnd).join('\n'),intro:out.slice(0,introEnd).join('\n'),toc,steps,faq:faq.map(f=>({q:f.q,a:f.a.join(' ')})),nerulio,problems:ctx.problems,images:ctx.images,text:text.join(' ')};
}
function nerulioTarget(target,locale,prefix){
 const c=COPY[locale];
 if(target.ws)return {href:`${prefix}game/studio/?ws=${target.ws}`,label:c.open[target.ws],attrs:`data-studio-ws="${target.ws}"`};
 const intent=INTENTS[target.tool];
 return {href:`${prefix}${intent?.path||''}/`,label:fill(c.open.tool,{name:t(`intent.${target.tool}.title`,{},locale)}),attrs:`data-tool-link="${esc(target.tool)}"`};
}
function nerulioBlock(n,ctx){
 const c=COPY[ctx.locale],to=nerulioTarget(n.target,ctx.locale,ctx.prefix);
 return `<section class="guide-nerulio" id="nerulio" aria-labelledby="nerulio-title"><h2 id="nerulio-title">${esc(c.doIt)}</h2>${n.html}<p class="guide-nerulio-cta"><a class="guide-open" ${to.attrs} href="${esc(to.href)}">${esc(to.label)} →</a></p></section>`;
}
/** Words for Latin text; characters (without spaces and punctuation) for Korean and Japanese. */
export function wordCount(text,locale){
 const s=String(text);
 if(locale==='en')return (s.match(/[A-Za-z0-9][\w'’.-]*/g)||[]).length;
 return s.replace(/[\s\p{P}\p{S}]/gu,'').length;
}

/* ---------------------------------------------------------------- pages */
const contentCache=new Map();
export function guideSource(slug,locale,root=ROOT){
 const file=path.join(root,'content','guides',slug,`${locale}.md`);
 const stamp=existsSync(file)?statSync(file).mtimeMs:0,key=file;
 const hit=contentCache.get(key);if(hit&&hit.stamp===stamp)return hit.text;
 const text=stamp?readFileSync(file,'utf8'):'';contentCache.set(key,{stamp,text});return text;
}
export function renderGuide(slug,locale,{prefix=locale+'/',root=ROOT}={}){
 return renderMarkdown(guideSource(slug,locale,root),{locale,prefix,slug,root});
}
const abs=(p,siteURL)=>siteURL?new URL(p,siteURL).href:'';
const localPath=(route,locale)=>`${locale?locale+'/':''}${route?route+'/':''}`;
function headLinks(route,locale,siteURL){
 if(!siteURL)return '';
 return `<link rel="canonical" href="${esc(abs(localPath(route,locale),siteURL))}"><meta property="og:url" content="${esc(abs(localPath(route,locale),siteURL))}">`+LOCALES.map(l=>`<link rel="alternate" hreflang="${l}" href="${esc(abs(localPath(route,l),siteURL))}">`).join('')+`<link rel="alternate" hreflang="x-default" href="${esc(abs(localPath(route,null),siteURL))}">`;
}
function social({title,description,image,locale,siteURL,type='article',modified=''}){
 const img=siteURL&&image?abs(image,siteURL):'';
 return `<meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(BRAND.name)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:locale" content="${{en:'en_US',ko:'ko_KR',ja:'ja_JP'}[locale]}">${LOCALES.filter(l=>l!==locale).map(l=>`<meta property="og:locale:alternate" content="${{en:'en_US',ko:'ko_KR',ja:'ja_JP'}[l]}">`).join('')}${modified?`<meta property="article:modified_time" content="${modified}">`:''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">`+(img?`<meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:image" content="${esc(img)}">`:'');
}
const globe='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';
function header(locale,prefix,route){
 const c=COPY[locale];
 return `<header class="page-header guide-header"><a class="brand" href="${prefix}" aria-label="${esc(BRAND.name)}">${logoMark()}<strong>${esc(BRAND.name)}<span class="brand-dot">.</span></strong></a><div class="header-end"><a class="header-link" href="${prefix}${GUIDE_INDEX}/">${esc(c.guides)}</a><a class="header-studio" href="${prefix}game/studio/">${esc(c.studio)}</a><label class="language-control">${globe}<select id="guideLanguage" aria-label="${esc(c.language)}">${LOCALES.map(l=>`<option value="${l}" lang="${l}" data-href="${l}/${route}/"${l===locale?' selected':''}>${LANGUAGE_NAMES[l]}</option>`).join('')}</select></label></div></header>`;
}
function shell({locale,base,title,description,head,body,neutral}){
 return `<!doctype html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#131518"><meta name="color-scheme" content="dark"><base href="${base}"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="content.css"><link rel="stylesheet" href="src/task/task.css"><link rel="stylesheet" href="src/guides.css"><script type="module" src="src/guides-page.js"></script>${head}</head><body class="task-page game-home guide-page"${neutral?' data-neutral':''}>${body}</body></html>`;
}
const engineChips=(g,cls='guide-engines')=>`<ul class="${cls}">${g.engines.map(e=>`<li>${esc(GUIDE_ENGINES[e]||e)}</li>`).join('')}</ul>`;
const sectionName=(id,locale)=>GUIDE_SECTIONS.find(([s])=>s===id)?.[1][locale]||id;
const date=(d,locale)=>{const [y,m,dd]=d.split('-').map(Number);return locale==='en'?new Date(Date.UTC(y,m-1,dd)).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}):locale==='ko'?`${y}년 ${m}월 ${dd}일`:`${y}年${m}月${dd}日`;};
function breadcrumb(items,siteURL){
 if(!siteURL)return '';
 return json({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:items.map(([name,p],k)=>({'@type':'ListItem',position:k+1,name,item:abs(p,siteURL)}))});
}
/** One guide page. `locale` is the content language; `neutral` marks the language-neutral URL. */
export function guidePage({slug,locale,base,siteURL='',config={},neutral=false,extraHead=''}){
 const g=guideBySlug(slug);if(!g)throw Error('Unknown guide '+slug);
 const c=COPY[locale],prefix=neutral?'':locale+'/',route=guidePath(slug);
 const r=renderGuide(slug,locale,{prefix});
 const title=`${g.title[locale]} · ${BRAND.name}`,description=g.description[locale],image=`assets/social/${locale}-guide-${slug}.png`;
 const minutes=Math.max(3,Math.round(wordCount(r.text,locale)/(locale==='en'?220:locale==='ko'?500:600)));
 const pageURL=abs(localPath(route,locale),siteURL);
 const data=[];
 if(siteURL){
  data.push(json({'@context':'https://schema.org','@type':'Article',headline:g.title[locale],description,inLanguage:locale,datePublished:g.published||g.updated,dateModified:g.updated,author:{'@type':'Organization',name:BRAND.name,url:abs(localPath('',locale),siteURL)},publisher:{'@type':'Organization',name:BRAND.name,logo:{'@type':'ImageObject',url:abs('favicon.svg',siteURL)}},image:abs(image,siteURL),mainEntityOfPage:pageURL,url:pageURL,about:g.engines.map(e=>GUIDE_ENGINES[e]||e),articleSection:sectionName(g.section,locale)}));
  data.push(breadcrumb([[BRAND.name,localPath('',locale)],[c.guides,localPath(GUIDE_INDEX,locale)],[g.title[locale],localPath(route,locale)]],siteURL));
  if(r.faq.length)data.push(json({'@context':'https://schema.org','@type':'FAQPage',inLanguage:locale,mainEntity:r.faq.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))}));
  if(r.steps.length)data.push(json({'@context':'https://schema.org','@type':'HowTo',name:g.title[locale],description,inLanguage:locale,step:r.steps.map((s,k)=>({'@type':'HowToStep',position:k+1,name:s.name,text:s.text,url:`${pageURL}#${s.id}`}))}));
 }
 const head=headLinks(route,locale,siteURL)+(config.preview?'<meta name="robots" content="noindex,nofollow">':'')+`<meta name="author" content="${esc(BRAND.name)}">`+social({title,description,image,locale,siteURL,modified:g.updated})+data.join('')+extraHead;
 const related=(g.related||[]).map(guideBySlug).filter(Boolean);
 const tools=(g.tools||[]).filter(id=>INTENTS[id]);
 const toc=r.toc;
 const body=`${header(locale,prefix,route)}<main class="page guide-main" id="guide" data-guide="${slug}">
<nav class="crumb" aria-label="breadcrumb"><a href="${prefix}">${esc(c.home)}</a> / <a href="${prefix}${GUIDE_INDEX}/">${esc(c.guides)}</a> / <span>${esc(sectionName(g.section,locale))}</span></nav>
<article class="guide-article" lang="${locale}"><header class="guide-head"><h1>${esc(g.title[locale])}</h1><p class="guide-meta"><span>${esc(c.updated)} <time datetime="${g.updated}">${esc(date(g.updated,locale))}</time></span><span>${esc(fill(c.readTime,{m:minutes}))}</span><span>${esc(c.author)}</span></p>${engineChips(g)}${g.tested?.length?`<p class="guide-tested">${esc(c.tested)}: ${g.tested.map(esc).join(' · ')}</p>`:''}</header>
<div class="guide-intro">${r.intro}</div>
${toc.length>2?`<nav class="guide-toc" aria-labelledby="toc-title"><h2 id="toc-title">${esc(c.toc)}</h2><ol>${toc.map(x=>`<li><a href="${prefix}${route}/#${x.id}">${esc(x.text)}</a></li>`).join('')}</ol></nav>`:''}
<div class="guide-body">${r.html}</div></article>
<aside class="guide-more">${related.length?`<section><h2>${esc(c.related)}</h2><ul class="guide-cards">${related.map(x=>`<li><a href="${prefix}${guidePath(x.slug)}/"><b>${esc(x.title[locale])}</b><small>${esc(x.description[locale])}</small></a></li>`).join('')}</ul></section>`:''}${tools.length?`<section><h2>${esc(c.tools)}</h2><ul class="guide-toollinks">${tools.map(id=>`<li><a href="${prefix}${INTENTS[id].path}/" data-tool="${id}">${esc(t(`intent.${id}.title`,{},locale))}</a></li>`).join('')}</ul></section>`:''}<p class="guide-all"><a href="${prefix}${GUIDE_INDEX}/">← ${esc(c.allGuides)}</a></p></aside>
</main><div id="siteContent">${footer(locale)}</div>`;
 return shell({locale,base,title,description,head,body,neutral});
}
/** The /guides/ index: grouped by topic, with an engine filter that is plain links. */
export function guidesIndexPage({locale,base,siteURL='',config={},neutral=false,extraHead=''}){
 const c=COPY[locale],prefix=neutral?'':locale+'/',route=GUIDE_INDEX;
 const title=`${c.guides} · ${BRAND.name}`,description=c.indexLead,image=`assets/social/${locale}-guides.png`;
 const updated=GUIDES.reduce((a,g)=>g.updated>a?g.updated:a,'');
 const data=siteURL?[json({'@context':'https://schema.org','@type':'CollectionPage',name:c.guides,description,inLanguage:locale,url:abs(localPath(route,locale),siteURL),dateModified:updated||undefined,mainEntity:{'@type':'ItemList',itemListElement:GUIDES.map((g,k)=>({'@type':'ListItem',position:k+1,url:abs(localPath(guidePath(g.slug),locale),siteURL),name:g.title[locale]}))}}),breadcrumb([[BRAND.name,localPath('',locale)],[c.guides,localPath(route,locale)]],siteURL)]:[];
 const head=headLinks(route,locale,siteURL)+(config.preview?'<meta name="robots" content="noindex,nofollow">':'')+social({title,description,image,locale,siteURL,type:'website'})+data.join('')+extraHead;
 const card=g=>`<li data-engines="${g.engines.join(' ')}"><a href="${prefix}${guidePath(g.slug)}/"><b>${esc(g.title[locale])}</b><small>${esc(g.description[locale])}</small><span class="guide-card-meta">${g.engines.map(e=>esc(GUIDE_ENGINES[e]||e)).join(' · ')} · <time datetime="${g.updated}">${esc(g.updated)}</time></span></a></li>`;
 const engines=Object.keys(GUIDE_ENGINES).filter(e=>GUIDES.some(g=>g.engines.includes(e)));
 const body=`${header(locale,prefix,route)}<main class="page guide-main guide-index" id="guides">
<nav class="crumb" aria-label="breadcrumb"><a href="${prefix}">${esc(c.home)}</a> / <span>${esc(c.guides)}</span></nav>
<header class="guide-head"><h1>${esc(c.guides)}</h1><p class="page-lead">${esc(description)}</p><p class="guide-meta"><span>${esc(fill(c.count,{n:GUIDES.length}))}</span>${updated?`<span>${esc(c.updated)} <time datetime="${updated}">${esc(date(updated,locale))}</time></span>`:''}</p></header>
<nav class="guide-engine-nav" aria-labelledby="by-engine"><h2 id="by-engine">${esc(c.byEngine)}</h2><ul>${engines.map(e=>`<li><a href="${prefix}${route}/#engine-${e}">${esc(GUIDE_ENGINES[e])} <span>${GUIDES.filter(g=>g.engines.includes(e)).length}</span></a></li>`).join('')}</ul></nav>
<h2 class="guide-index-h" id="by-topic">${esc(c.byTopic)}</h2>
${GUIDE_SECTIONS.map(([id,name])=>{const list=GUIDES.filter(g=>g.section===id);return list.length?`<section class="guide-section" id="topic-${id}"><h3>${esc(name[locale])}</h3><ul class="guide-cards">${list.map(card).join('')}</ul></section>`:'';}).join('')}
<h2 class="guide-index-h">${esc(c.byEngine)}</h2>
<div class="guide-by-engine">${engines.map(e=>`<section id="engine-${e}"><h3>${esc(GUIDE_ENGINES[e])}</h3><ul>${GUIDES.filter(g=>g.engines.includes(e)).map(g=>`<li><a href="${prefix}${guidePath(g.slug)}/">${esc(g.title[locale])}</a></li>`).join('')}</ul></section>`).join('')}</div>
</main><div id="siteContent">${footer(locale)}</div>`;
 return shell({locale,base,title,description,head,body,neutral});
}
/** Router hook for tools/build.mjs entry(): the page for a guide route, or null. */
export function guideEntry(route,locale,{base,siteURL,config,neutral,extraHead}){
 const r=guideRoute(route);if(!r)return null;
 return r.index?guidesIndexPage({locale,base,siteURL,config,neutral,extraHead}):guidePage({slug:r.guide.slug,locale,base,siteURL,config,neutral,extraHead});
}
