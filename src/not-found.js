/** Behaviour of the site-wide 404 page (tools/growth-build.mjs notFound). The page ships one
 * HTML file for every missing address, so the visitor's language, the "did you mean" suggestion
 * and the tool search are all worked out here from data embedded in that file. No network. */
export const NF_LOCALES=Object.freeze(['ko','en','ja']);
const rest=(pathname,base='/')=>{let p=String(pathname||'');try{p=decodeURIComponent(p);}catch{}if(base&&base!=='/'&&p.startsWith(base))p=p.slice(base.length);return p.replace(/^\/+/,'');};
/** Language of the missing address (/ko/…), else the first supported browser language, else English. */
export function localeFor(pathname,languages=[],base='/'){
 const first=rest(pathname,base).split('/')[0].toLowerCase();
 if(NF_LOCALES.includes(first))return first;
 for(const l of languages||[]){const code=String(l).toLowerCase().split('-')[0];if(NF_LOCALES.includes(code))return code;}
 return 'en';
}
/** The address without site base, language prefix, index.html / .html and trailing slashes. */
export function wantedPath(pathname,base='/'){
 const parts=rest(pathname,base).toLowerCase().replace(/(?:index)?\.html?$/,'').split('/').filter(Boolean);
 if(NF_LOCALES.includes(parts[0]))parts.shift();
 return parts.join('/');
}
export function distance(a,b){
 if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row;}
 return prev[b.length];
}
const toolKey=path=>String(path).split('/').filter(Boolean).slice(1).join('/'),last=p=>p.split('/').pop()||'';
/** Closest real tool to a mistyped address, or null when nothing is plausibly what was meant.
 * tools: [[title,'en/image/compress/'],…] for one language. A whole-path typo, a right tool name
 * under the wrong folder and a missing language prefix all count; unrelated addresses do not. */
export function suggest(pathname,tools,base='/'){
 const wanted=wantedPath(pathname,base);if(!wanted)return null;
 let best=null,bestScore=Infinity;
 for(const tool of tools||[]){
  const key=toolKey(tool[1]);if(!key)continue;
  const whole=distance(wanted,key),tail=distance(last(wanted),last(key)),size=Math.min(last(wanted).length,last(key).length);
  const score=Math.min(whole<=Math.max(2,Math.floor(Math.min(wanted.length,key.length)/4))?whole:Infinity,tail<=Math.max(1,Math.floor(size/4))?tail+.5:Infinity);
  if(score<bestScore){best=tool;bestScore=score;}
 }
 return best;
}
export const fold=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[\s\-_/.·]+/g,' ').trim();
/** Tools whose name or address contains every word of the query (titles first, then addresses). */
export function filterTools(query,tools,limit=12){
 const words=fold(query).split(' ').filter(Boolean);if(!words.length)return [];
 const inTitle=[],inPath=[];
 for(const tool of tools||[]){const title=fold(tool[0]),path=fold(toolKey(tool[1]));
  if(words.every(w=>title.includes(w)))inTitle.push(tool);else if(words.every(w=>title.includes(w)||path.includes(w)))inPath.push(tool);}
 return [...inTitle,...inPath].slice(0,limit);
}
function start(){
 const source=document.getElementById('nfData');if(!source)return;
 let data;try{data=JSON.parse(source.textContent);}catch{return;}
 const base=data.base||'/',locale=localeFor(location.pathname,navigator.languages,base),L=data.locales[locale];if(!L)return;
 const $=id=>document.getElementById(id),href=path=>base+path;
 const link=(tool,cls='')=>{const a=document.createElement('a');a.href=href(tool[1]);a.textContent=tool[0];if(cls)a.className=cls;return a;};
 const items=(list,tools)=>{list.replaceChildren(...tools.map(tool=>{const li=document.createElement('li');li.append(link(tool));return li;}));};
 document.documentElement.lang=locale;document.title=data.brand+' · '+L.s.title;
 for(const el of document.querySelectorAll('[data-nf]'))if(L.s[el.dataset.nf])el.textContent=L.s[el.dataset.nf];
 for(const el of document.querySelectorAll('[data-nf-label]'))el.setAttribute('aria-label',L.s[el.dataset.nfLabel]);
 for(const el of document.querySelectorAll('[data-nf-href]'))el.setAttribute('href',href(L.links[el.dataset.nfHref]));
 for(const el of document.querySelectorAll('[data-nf-fallback]'))el.hidden=true;
 for(const a of document.querySelectorAll('[data-nf-lang]'))if(a.dataset.nfLang===locale)a.setAttribute('aria-current','true');
 const asked=$('nfAsked');if(asked){let shown=location.pathname;try{shown=decodeURIComponent(shown);}catch{}asked.textContent=shown.length>80?shown.slice(0,79)+'…':shown;$('nfAskedRow').hidden=false;}
 const guess=suggest(location.pathname,L.tools,base);
 if(guess&&$('nfGuess')){$('nfGuessLink').replaceChildren(link(guess,'nf-guess-link'));$('nfGuess').hidden=false;}
 items($('nfPopular'),L.popular);
 const input=$('nfSearch'),results=$('nfResults'),count=$('nfCount');
 input.placeholder=L.s.placeholder;$('nfSearchBox').hidden=false;
 const run=()=>{
  const query=input.value.trim(),found=filterTools(query,L.tools);
  items(results,found);results.hidden=!found.length;
  count.textContent=!query?'':found.length?(found.length===1?L.s.one:L.s.many.replace('{n}',String(found.length))):L.s.none;
 };
 input.addEventListener('input',run);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=results.querySelector('a');if(first){e.preventDefault();location.assign(first.href);}}});
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
