import {PDFWorkspace} from '../pdf.js';
import {blobOf,release,decode} from '../image.js';
import {bytes,stem,zip} from '../core.js';
import {BRAND} from '../brand.js';
import {t,getLocale} from '../i18n.js';
import {yieldUI} from '../resources.js';
import {parseSelection,reverseOrder,pageNumberMark} from '../pdf-pages.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
/** PDF page organiser behind Merge PDF and Split PDF: every page of every file as a
 * thumbnail you can drag, rotate, duplicate or delete; images may be mixed in as pages.
 * Native page objects are copied (text, vectors and search stay intact) — see src/pdf.js. */
export const accept='application/pdf,.pdf,image/*,.heic,.heif';
const PAGE={a4:[595.28,841.89],letter:[612,792]};
async function hasTransparency(c){
 const ctx=c.getContext('2d');
 for(let y=0;y<c.height;y+=64){
  const data=ctx.getImageData(0,y,c.width,Math.min(64,c.height-y)).data;
  for(let i=3;i<data.length;i+=4)if(data[i]!==255)return true;
  await yieldUI();
 }
 return false;
}
/** One image → one PDF page. JPEG-like inputs stay JPEG (small), PNG keeps its sharp edges and
 * transparency. Other transparent inputs also need PNG: JPEG would flatten them on black.
 * decode() applies the camera orientation, which raw JPEG embedding would lose. */
async function imagePage(file,o){
 const L=await import('../../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js'),c=await decode(file);
 try{
  const png=file.type==='image/png'||await hasTransparency(c),bytes=await (await blobOf(c,png?'image/png':'image/jpeg',.92)).arrayBuffer(),doc=await L.PDFDocument.create(),img=png?await doc.embedPng(bytes):await doc.embedJpg(bytes);
  let [pw,ph]=o.pageSize==='fit'?[c.width*.75+o.margin*2,c.height*.75+o.margin*2]:PAGE[o.pageSize];if(o.pageSize!=='fit'&&(o.orient==='landscape'||(o.orient!=='portrait'&&c.width>c.height)))[pw,ph]=[ph,pw];
  const k=Math.min((pw-o.margin*2)/c.width,(ph-o.margin*2)/c.height),w=c.width*k,h=c.height*k;doc.addPage([pw,ph]).drawImage(img,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});
  return new File([await doc.save()],file.name,{type:'application/pdf'});
 }finally{release(c);}
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LETTER=i=>String.fromCharCode(65+i%26)+(i>=26?Math.floor(i/26):'');
/** Strings of the page picker, blank-page and reverse tools live here, next to the code that uses them. */
const LOCAL={
 ko:{pick:'페이지 번호로 선택',pickHint:'예: 1-3, 7, 10-',pickGo:'선택',odd:'홀수 쪽',even:'짝수 쪽',invert:'선택 반전',pickBad:'1-3, 7, 10- 처럼 입력하세요. 이 문서는 {n}쪽까지 있습니다.',picked:'{n}쪽을 선택했습니다.',blank:'빈 페이지',blankAdd:'+ 빈 페이지',blankTitle:'선택한 쪽 뒤(선택이 없으면 맨 끝)에 같은 크기의 빈 페이지를 넣습니다',blankDone:'{n}쪽 자리에 빈 페이지를 넣었습니다.',reverse:'순서 뒤집기',reverseTitle:'여러 쪽을 선택했으면 그 쪽들만, 아니면 전체 순서를 거꾸로 바꿉니다',orient:'용지 방향',orientAuto:'방향 자동',orientPortrait:'세로 방향',orientLandscape:'가로 방향',numbers:'쪽 번호 넣기',numbersHint:'모든 쪽 아래에 번호를 실제 글자로 그려 넣습니다. 그 자리의 원본 내용과 겹칠 수 있으니 저장한 뒤 확인하세요.',numberStyle:'번호 형식',numberPos:'번호 위치',styleOf:'1 / 전체 쪽수',posCenter:'아래 가운데',posRight:'아래 오른쪽',posLeft:'아래 왼쪽',numbered:'쪽 번호 넣음',zoom:'크게 보기',zoomPrev:'이전 쪽',zoomNext:'다음 쪽',zoomClose:'닫기',zoomLoading:'쪽을 그리는 중…',zoomFail:'이 쪽을 그리지 못했습니다.',toFirst:'맨 앞으로 이동',toLast:'맨 뒤로 이동',canceled:'취소했습니다. 파일은 만들어지지 않았습니다.'},
 en:{pick:'Select by page number',pickHint:'e.g. 1-3, 7, 10-',pickGo:'Select',odd:'Odd pages',even:'Even pages',invert:'Invert selection',pickBad:'Type pages like 1-3, 7, 10-. This document has {n} pages.',picked:'{n} page(s) selected.',blank:'Blank page',blankAdd:'+ Blank page',blankTitle:'Insert a blank page of the same size after the selected page (or at the end when nothing is selected)',blankDone:'Blank page inserted as page {n}.',reverse:'Reverse order',reverseTitle:'Reverses the selected pages when several are selected, otherwise the whole document',orient:'Page orientation',orientAuto:'Auto-rotate',orientPortrait:'Portrait',orientLandscape:'Landscape',numbers:'Add page numbers',numbersHint:'Numbers are drawn as real text at the bottom of every page. They can overlap content that is already there, so check the saved file.',numberStyle:'Number format',numberPos:'Number position',styleOf:'1 / total pages',posCenter:'Bottom centre',posRight:'Bottom right',posLeft:'Bottom left',numbered:'page numbers added',zoom:'View larger',zoomPrev:'Previous page',zoomNext:'Next page',zoomClose:'Close',zoomLoading:'Rendering page…',zoomFail:'This page could not be rendered.',toFirst:'Move to the start',toLast:'Move to the end',canceled:'Cancelled. No file was made.'},
 ja:{pick:'ページ番号で選択',pickHint:'例: 1-3, 7, 10-',pickGo:'選択',odd:'奇数ページ',even:'偶数ページ',invert:'選択を反転',pickBad:'1-3, 7, 10- のように入力してください。この文書は{n}ページまであります。',picked:'{n}ページを選択しました。',blank:'空白ページ',blankAdd:'+ 空白ページ',blankTitle:'選択したページの後ろ（未選択なら末尾）に同じサイズの空白ページを挿入します',blankDone:'{n}ページ目に空白ページを挿入しました。',reverse:'順序を逆にする',reverseTitle:'複数ページを選択中はそのページだけ、それ以外は全体の順序を逆にします',orient:'用紙の向き',orientAuto:'向き自動',orientPortrait:'縦向き',orientLandscape:'横向き',numbers:'ページ番号を入れる',numbersHint:'すべてのページの下部に番号を実際の文字として描き込みます。その位置の元の内容と重なることがあるので、保存後に確認してください。',numberStyle:'番号の形式',numberPos:'番号の位置',styleOf:'1 / 総ページ数',posCenter:'下・中央',posRight:'下・右',posLeft:'下・左',numbered:'ページ番号を追加',zoom:'拡大表示',zoomPrev:'前のページ',zoomNext:'次のページ',zoomClose:'閉じる',zoomLoading:'ページを描画中…',zoomFail:'このページを描画できませんでした。',toFirst:'先頭へ移動',toLast:'末尾へ移動',canceled:'キャンセルしました。ファイルは作成されていません。'}
};
const LT=(k,v={})=>String((LOCAL[getLocale()]||LOCAL.en)[k]??LOCAL.en[k]??k).replace(/\{(\w+)\}/g,(_,n)=>v[n]??'');
const STYLE=`.pdf-work .pg-pick{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:-4px 0 14px;font-size:12.5px}.pdf-work .pg-pick label{font-weight:700;color:#51647d}.pdf-work .pg-pick input{flex:1 1 140px;min-width:0;max-width:230px;height:34px;padding:0 10px;border:1px solid #c9d3e0;border-radius:9px;font:inherit;color:inherit;background:#fff}.pdf-work .pg-pick input[aria-invalid="true"]{border-color:#b3383f;background:#fff7f7}.pdf-work .pg-pick button{font-size:12.5px;font-weight:700;color:#51647d;padding:7px 10px;border-radius:9px;background:#f3f6fa}.pdf-work .pg-pick button:hover:not(:disabled){background:#e6edf6;color:var(--ink)}.pdf-work .pg-pick button:disabled{opacity:.5}.pdf-work .pg-pick .pg-pick-gap{flex:1 1 0}.pdf-work .pg-pick-error{flex:1 0 100%;margin:0;color:#b3383f;font-weight:650}.pdf-work .pg-pick-error:empty{display:none}@media(max-width:560px){.pdf-work .pg-pick .pg-pick-gap{display:none}}.pg-actions svg{display:block;margin:auto}.pg-preview{border:0;border-radius:16px;padding:0;width:min(920px,calc(100vw - 24px));max-height:calc(100dvh - 24px);background:#fff;color:#192638;box-shadow:0 20px 60px #0005;overflow:hidden}.pg-preview[open]{display:flex;flex-direction:column}.pg-preview::backdrop{background:#0b1524b3}.pg-preview-bar{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #e3e9f1}.pg-preview-bar strong{flex:1;min-width:0;font-size:13px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pg-preview-bar button{min-width:44px;min-height:44px;border-radius:10px;background:#f3f6fa;color:#34465c;font-size:20px;font-weight:700;line-height:1}.pg-preview-bar button:hover:not(:disabled){background:#e6edf6}.pg-preview-bar button:disabled{opacity:.4}.pg-preview-body{flex:1;min-height:220px;overflow:auto;background:#eef2f7;display:grid;place-items:center;padding:12px;font-size:13px;color:#51647d}.pg-preview-body img{max-width:100%;max-height:calc(100dvh - 120px);background:#fff;box-shadow:0 2px 14px #0003}.pg-preview-body img:not([src]){display:none}@media(pointer:coarse){.pdf-work .pg-pick button,.pdf-work .pg-pick input,.pdf-work .board-tools button{min-height:44px;min-width:44px}}`;
function ensureStyle(){if(document.getElementById('pdfOrganizeStyle'))return;const s=document.createElement('style');s.id='pdfOrganizeStyle';s.textContent=STYLE;document.head.append(s);}
export function mount({el,def}){
 const ws=new PDFWorkspace(),split=route.id==='pdf-split',images=route.id==='jpg-to-pdf',inputs=[],thumbs=new Map(),selected=new Set();
 let anchor=null,busy=false,abort=null,result=null,dragId=null,queue=[],loading=0,observer=null,pickText='',pickError='',zoomIndex=-1,zoomToken=0,zoomURL='';const blanks=new Map();
 let options={mode:split?'each':'merge',every:2,ranges:'',optimize:false,removeMetadata:false,name:'',pageSize:'a4',margin:24,orient:'auto',numbers:false,numberStyle:'n',numberPos:'center'};
 const T=(k,v)=>text('pdf.'+k,v),pages=()=>ws.pages,indexOf=id=>pages().findIndex(p=>p.id===id);
 const sourceIndex=p=>ws.sources.filter(s=>pages().some(x=>x.source===s)).indexOf(p.source);
 function empty(){
  el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T(images?'dropImages':'drop'))}</strong><span>${esc(T(images?'dropImagesHint':'dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;
 }
 function frame(){
  ensureStyle();el.innerHTML=`<div class="work pdf-work"><section class="board"><div class="board-bar" role="toolbar" aria-label="${esc(T('tools'))}"><span class="board-count" id="pdfSelection"></span><span class="board-tools">
<button type="button" data-action="pdf-all">${esc(T('selectAll'))}</button><button type="button" data-action="pdf-left" title="${esc(T('rotateLeft'))}" aria-label="${esc(T('rotateLeft'))}">⟲</button><button type="button" data-action="pdf-right" title="${esc(T('rotateRight'))}" aria-label="${esc(T('rotateRight'))}">⟳</button><button type="button" data-action="pdf-first" title="${esc(LT('toFirst'))}" aria-label="${esc(LT('toFirst'))}">⇤</button><button type="button" data-action="pdf-back" title="${esc(T('moveBack'))}" aria-label="${esc(T('moveBack'))}">←</button><button type="button" data-action="pdf-forward" title="${esc(T('moveForward'))}" aria-label="${esc(T('moveForward'))}">→</button><button type="button" data-action="pdf-last" title="${esc(LT('toLast'))}" aria-label="${esc(LT('toLast'))}">⇥</button><button type="button" data-action="pdf-duplicate">${esc(T('duplicate'))}</button><button type="button" data-action="pdf-delete" class="danger">${esc(T('delete'))}</button><button type="button" data-action="pdf-undo">${esc(T('undo'))}</button></span></div>
<div class="pg-pick" role="group" aria-label="${esc(LT('pick'))}"><label for="pdfPick">${esc(LT('pick'))}</label><input id="pdfPick" type="text" autocomplete="off" spellcheck="false" maxlength="200" value="${esc(pickText)}" placeholder="${esc(LT('pickHint'))}" aria-describedby="pdfPickError"><button type="button" data-action="pdf-pick">${esc(LT('pickGo'))}</button><button type="button" data-action="pdf-odd">${esc(LT('odd'))}</button><button type="button" data-action="pdf-even">${esc(LT('even'))}</button><button type="button" data-action="pdf-invert">${esc(LT('invert'))}</button><span class="pg-pick-gap" aria-hidden="true"></span><button type="button" data-action="pdf-reverse" title="${esc(LT('reverseTitle'))}">${esc(LT('reverse'))}</button><button type="button" data-action="pdf-blank" title="${esc(LT('blankTitle'))}">${esc(LT('blankAdd'))}</button><p class="pg-pick-error" id="pdfPickError" role="alert">${esc(pickError)}</p></div>
<div class="pages" id="pdfPages" role="listbox" aria-multiselectable="true" aria-label="${esc(T('pages'))}"></div><p class="viewer-note">${esc(T('hint'))}</p></section>
<aside class="side"><div class="summary" id="pdfSummary" role="status" aria-live="polite"></div><form id="pdfOptions" class="options" autocomplete="off">${split?`<div class="segmented split-modes" role="group" id="pdfMode">${['each','every','ranges','selected','odd-even'].map(m=>`<button type="button" data-action="pdf-mode" data-mode="${m}" aria-pressed="${options.mode===m}">${esc(T('mode.'+m))}</button>`).join('')}</div><div id="pdfModeFields"></div>`:''}
${images?`<div class="segmented" role="group" id="pdfPageSize">${['a4','letter','fit'].map(v=>`<button type="button" data-action="pdf-pagesize" data-size="${v}" aria-pressed="${options.pageSize===v}">${esc(T('size.'+v))}</button>`).join('')}</div><div class="segmented" role="group" id="pdfMargin" style="margin-top:8px">${[0,24,48].map(v=>`<button type="button" data-action="pdf-margin" data-margin="${v}" aria-pressed="${options.margin===v}">${esc(T('margin.'+v))}</button>`).join('')}</div><div class="segmented" role="group" id="pdfOrient" aria-label="${esc(LT('orient'))}" style="margin-top:8px" ${options.pageSize==='fit'?'hidden':''}>${[['auto','orientAuto'],['portrait','orientPortrait'],['landscape','orientLandscape']].map(([v,k])=>`<button type="button" data-action="pdf-orient" data-orient="${v}" aria-pressed="${options.orient===v}">${esc(LT(k))}</button>`).join('')}</div>`:''}
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary><label class="field"><span>${esc(T('fileName'))}</span><input id="pdfName" type="text" maxlength="80" value="${esc(options.name)}" placeholder="${esc(defaultName())}"></label><label class="check"><input id="pdfOptimize" type="checkbox" ${options.optimize?'checked':''}> ${esc(T('optimize'))}</label><label class="check"><input id="pdfMeta" type="checkbox" ${options.removeMetadata?'checked':''}> ${esc(T('removeMeta'))}</label>${split?'':`<label class="check"><input id="pdfNumbers" type="checkbox" ${options.numbers?'checked':''} aria-describedby="pdfNumbersHint"> ${esc(LT('numbers'))}</label><p class="hint" id="pdfNumbersHint">${esc(LT('numbersHint'))}</p><div class="field-row"><label class="field spaced"><span>${esc(LT('numberStyle'))}</span><select id="pdfNumberStyle"><option value="n" ${options.numberStyle==='n'?'selected':''}>1, 2, 3 …</option><option value="of" ${options.numberStyle==='of'?'selected':''}>${esc(LT('styleOf'))}</option></select></label><label class="field spaced"><span>${esc(LT('numberPos'))}</span><select id="pdfNumberPos">${[['center','posCenter'],['right','posRight'],['left','posLeft']].map(([v,k])=>`<option value="${v}" ${options.numberPos===v?'selected':''}>${esc(LT(k))}</option>`).join('')}</select></label></div>`}</details></form>
<div class="file-list" id="pdfFiles"></div><div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('addFiles'))}</button>${split?'':`<button type="button" class="link" data-action="pdf-sort">${esc(T('sortAZ'))}</button>`}<button type="button" class="link" data-action="pdf-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="pdfRun" data-action="pdf-run"></button><button type="button" class="ghost" id="pdfCancel" data-action="pdf-cancel" style="margin-top:8px;min-height:44px" hidden>${esc(text('cancel'))}</button><div class="result-box" id="pdfResult" hidden></div><nav class="next" id="pdfNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
  observer?.disconnect();observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);want(e.target.dataset.id);}},{root:null,rootMargin:'400px'});
  modeFields();
 }
 const defaultName=()=>images?stem(ws.sources[0]?.name||'images'):`${stem(ws.sources[0]?.name||BRAND.name.toLowerCase())}-${split?'split':'merged'}`;
 function modeFields(){
  const host=el.querySelector('#pdfModeFields');if(!host)return;
  host.innerHTML=options.mode==='every'?`<label class="field"><span>${esc(T('everyLabel'))}</span><input id="pdfEvery" type="number" min="1" max="9999" value="${options.every}" inputmode="numeric"></label>`
   :options.mode==='ranges'?`<label class="field"><span>${esc(T('rangesLabel'))}</span><input id="pdfRanges" type="text" value="${esc(options.ranges)}" placeholder="1-3; 4-8; 9"><small>${esc(T('rangesHint'))}</small></label>`
   :options.mode==='selected'?`<p class="hint">${esc(T('selectedHint'))}</p>`:'';
 }
 /** 1-based page groups for the current split mode; also drives the "file 2 starts here" markers. */
 function groups(){
  const n=pages().length;if(!split||!n)return [];
  if(options.mode==='each')return pages().map((_,i)=>[i+1]);
  if(options.mode==='every'){const k=Math.max(1,options.every|0),out=[];for(let i=0;i<n;i+=k)out.push(Array.from({length:Math.min(k,n-i)},(_,j)=>i+j+1));return out;}
  if(options.mode==='odd-even')return [pages().map((_,i)=>i+1).filter(i=>i%2),pages().map((_,i)=>i+1).filter(i=>i%2===0)].filter(g=>g.length);
  if(options.mode==='selected')return [pages().map((p,i)=>selected.has(p.id)?i+1:0).filter(Boolean)].filter(g=>g.length);
  const out=[];for(const part of options.ranges.split(';').map(s=>s.trim()).filter(Boolean)){const g=[];for(const piece of part.split(',')){const m=piece.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);if(!m)return null;const a=+m[1],b=+(m[2]??m[1]);if(a<1||b>n||a>b)return null;for(let i=a;i<=b;i++)g.push(i);}out.push(g);}return out;
 }
 function want(id){const p=pages().find(x=>x.id===id);if(!p||thumbs.has(key(p)))return;queue.push(p);pump();}
 const key=p=>`${p.source.id}:${p.index}`;
 async function pump(){
  while(loading<2&&queue.length){
   const p=queue.shift(),k=key(p);if(thumbs.has(k))continue;loading++;thumbs.set(k,'');
   (async()=>{let c=null;try{c=await ws.render({...p,angle:0,marks:[]},260,false);thumbs.set(k,URL.createObjectURL(await blobOf(c,'image/jpeg',.72)));for(const img of el.querySelectorAll(`img[data-key="${k}"]`))img.src=thumbs.get(k);}catch{thumbs.delete(k);}finally{release(c);loading--;pump();}})();
  }
 }
 function renderPages(){
  const host=el.querySelector('#pdfPages');if(!host)return;const g=groups(),starts=new Map();if(g&&options.mode!=='odd-even'&&options.mode!=='selected')g.forEach((grp,i)=>starts.set(grp[0],i+1));
  host.innerHTML=pages().map((p,i)=>{const k=key(p),s=sourceIndex(p);
   return `<div class="pg ${selected.has(p.id)?'is-selected':''} ${starts.has(i+1)&&starts.get(i+1)>1?'starts-part':''}" role="option" aria-selected="${selected.has(p.id)}" tabindex="0" draggable="true" data-id="${p.id}" ${starts.has(i+1)?`data-part="${esc(T('part',{n:starts.get(i+1)}))}"`:''}><div class="pg-frame"><img data-key="${k}" alt="${esc(T('pageN',{n:i+1}))}" ${thumbs.get(k)?`src="${thumbs.get(k)}"`:''} style="transform:rotate(${p.angle}deg)" draggable="false"></div><span class="pg-num">${i+1}</span><span class="pg-src s${s%6}" title="${esc(p.source.name)}">${LETTER(s)}</span><span class="pg-actions"><button type="button" data-action="pg-zoom" title="${esc(LT('zoom'))}" aria-label="${esc(LT('zoom'))} · ${esc(T('pageN',{n:i+1}))}"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/></svg></button><button type="button" data-action="pg-rotate" title="${esc(T('rotateRight'))}" aria-label="${esc(T('rotateRight'))}">⟳</button><button type="button" data-action="pg-delete" title="${esc(T('delete'))}" aria-label="${esc(T('delete'))}">×</button></span></div>`;}).join('');
  for(const card of host.children)if(!thumbs.get(card.querySelector('img').dataset.key))observer.observe(card);
 }
 function renderSide(){
  const n=pages().length,used=ws.sources.filter(s=>pages().some(p=>p.source===s)),g=groups();
  el.querySelector('#pdfSummary').innerHTML=`<div class="summary-big">${esc(T('pagesN',{n}))}</div><div class="summary-line">${esc(text('files',{n:used.length}))} · ${esc(bytes(used.reduce((s,f)=>s+f.file.size,0)))}${split&&g?` · ${esc(T('outputs',{n:g.length}))}`:''}</div>`;
  el.querySelector('#pdfFiles').innerHTML=used.map((s,i)=>`<div class="file"><span class="pg-src s${i%6} inline">${LETTER(i)}</span><span class="file-main static"><span><b>${esc(s.name)}</b><small>${esc(T('pagesN',{n:pages().filter(p=>p.source===s).length}))} · ${esc(bytes(s.file.size))}</small></span></span><button type="button" class="icon" data-action="pdf-file-remove" data-source="${s.id}" title="${esc(text('remove'))}" aria-label="${esc(text('remove'))}">×</button></div>`).join('');
  el.querySelector('#pdfSelection').textContent=selected.size?T('selectedN',{n:selected.size}):T('noneSelected');
  const run=el.querySelector('#pdfRun'),invalid=split&&(!g||!g.length);run.disabled=busy||!n||invalid;
  run.textContent=busy?T('working'):split?(invalid?T(options.mode==='selected'?'needSelection':'badRanges'):T('runSplit',{n:g.length})):T(images?'runPdf':'runMerge');
  for(const control of el.querySelectorAll('#pdfOptions button,#pdfOptions input,#pdfOptions select'))control.disabled=busy;
  for(const b of el.querySelectorAll('.board-tools button'))if(!['pdf-all','pdf-undo'].includes(b.dataset.action))b.disabled=!selected.size||busy;
  el.querySelector('[data-action="pdf-undo"]').disabled=!ws.history.length||busy;
  el.querySelector('#pdfCancel').hidden=!abort;
  for(const b of el.querySelectorAll('.pg-pick button,.pg-pick input'))b.disabled=busy||(b.dataset.action==='pdf-reverse'&&n<2);
 }
 const render=()=>{renderPages();renderSide();};
 function clearResult(){result=null;const box=el.querySelector('#pdfResult');if(box){box.hidden=true;el.querySelector('#pdfNext').innerHTML='';}}
 function changed(){clearResult();for(const id of [...selected])if(indexOf(id)<0)selected.delete(id);render();}
 function mutate(fn){if(busy)return;ws.snapshot();fn();changed();}
 const chosen=()=>pages().filter(p=>selected.has(p.id));
 function moveSelection(delta){
  mutate(()=>{const list=pages(),order=delta<0?list.slice():list.slice().reverse();
   for(const p of order){if(!selected.has(p.id))continue;const i=list.indexOf(p),j=i+delta;if(j<0||j>=list.length||selected.has(list[j].id))continue;[list[i],list[j]]=[list[j],list[i]];}});
 }
 function dropAt(target,after){
  mutate(()=>{const list=pages(),moving=selected.has(dragId)?list.filter(p=>selected.has(p.id)):list.filter(p=>p.id===dragId),ids=new Set(moving.map(p=>p.id));
   if(ids.has(target))return;const rest=list.filter(p=>!ids.has(p.id)),at=rest.findIndex(p=>p.id===target)+(after?1:0);rest.splice(at,0,...moving);list.splice(0,list.length,...rest);});
 }
 /** A large look at one page, as it will be saved (turned the way the board shows it), with
  * previous / next. A native modal dialog: Escape closes it and focus returns to the page card. */
 function zoomDialog(){
  let d=el.querySelector('#pdfZoom');if(d)return d;
  if(zoomURL){URL.revokeObjectURL(zoomURL);zoomURL='';}d=document.createElement('dialog');d.id='pdfZoom';d.className='pg-preview';d.setAttribute('aria-labelledby','pdfZoomTitle');
  d.innerHTML=`<div class="pg-preview-bar"><button type="button" data-action="pdf-zoom-prev" title="${esc(LT('zoomPrev'))}" aria-label="${esc(LT('zoomPrev'))}">‹</button><strong id="pdfZoomTitle" aria-live="polite"></strong><button type="button" data-action="pdf-zoom-next" title="${esc(LT('zoomNext'))}" aria-label="${esc(LT('zoomNext'))}">›</button><button type="button" data-action="pdf-zoom-close" title="${esc(LT('zoomClose'))}" aria-label="${esc(LT('zoomClose'))}">×</button></div><div class="pg-preview-body"><span id="pdfZoomState" role="status"></span><img id="pdfZoomImage" alt=""></div>`;
  d.addEventListener('close',()=>{zoomToken++;zoomIndex=-1;if(zoomURL)URL.revokeObjectURL(zoomURL);zoomURL='';d.querySelector('img').removeAttribute('src');});
  d.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();zoom(zoomIndex+(e.key==='ArrowLeft'?-1:1));}});
  el.append(d);return d;
 }
 async function zoom(i){
  const p=pages()[i];if(!p)return;const d=zoomDialog(),token=++zoomToken,img=d.querySelector('img'),state=d.querySelector('#pdfZoomState');zoomIndex=i;
  d.querySelector('#pdfZoomTitle').textContent=`${i+1} / ${pages().length} · ${p.source.name}`;
  d.querySelector('[data-action="pdf-zoom-prev"]').disabled=i<=0;d.querySelector('[data-action="pdf-zoom-next"]').disabled=i>=pages().length-1;
  img.removeAttribute('src');img.alt=T('pageN',{n:i+1});state.textContent=LT('zoomLoading');
  if(!d.open)d.showModal();
  // A button that has just disabled itself drops focus to <body>: keep it inside the dialog.
  const focused=d.querySelector(':focus');if(!focused||focused.disabled)(d.querySelector('[data-action^="pdf-zoom-"]:not(:disabled)')||d).focus();
  let c=null;
  try{c=await ws.render({...p,marks:[]},1500,false);const blob=await blobOf(c,'image/jpeg',.86);if(token!==zoomToken)return;if(zoomURL)URL.revokeObjectURL(zoomURL);zoomURL=URL.createObjectURL(blob);img.src=zoomURL;state.textContent='';}
  catch{if(token===zoomToken)state.textContent=LT('zoomFail');}
  finally{release(c);}
 }
 /** Selection helpers: by typed page numbers, odd / even, or inverted. */
 function pickError_(message){pickError=message;const box=el.querySelector('#pdfPickError'),input=el.querySelector('#pdfPick');if(box)box.textContent=message;if(input)message?input.setAttribute('aria-invalid','true'):input.removeAttribute('aria-invalid');}
 function select(numbers){selected.clear();for(const n of numbers)selected.add(pages()[n-1].id);anchor=numbers.length?pages()[numbers[0]-1].id:null;pickError_('');render();if(numbers.length){toast(LT('picked',{n:numbers.length}));el.querySelector(`.pg[data-id="${pages()[numbers[0]-1].id}"]`)?.scrollIntoView({block:'nearest'});}}
 function pick(){
  const input=el.querySelector('#pdfPick');pickText=input.value;const numbers=parseSelection(pickText,pages().length);
  if(!numbers){pickError_(LT('pickBad',{n:pages().length}));input.focus();return;}
  select(numbers);
 }
 /** A blank page the size of the page it follows. Blank pages of one size share a single tiny source. */
 async function insertBlank(){
  if(busy||!pages().length)return;const sel=chosen(),ref=sel.length?sel[sel.length-1]:pages()[pages().length-1],at=indexOf(ref.id)+1;
  let w=ref.angle%180?ref.logicalH:ref.logicalW,h=ref.angle%180?ref.logicalW:ref.logicalH;if(!(w>0&&h>0))[w,h]=PAGE.a4;
  const k=`${Math.round(w)}x${Math.round(h)}`,known=blanks.get(k);
  const place=page=>{selected.clear();selected.add(page.id);anchor=page.id;};
  if(known&&ws.sources.includes(known.source)){const page={...known,id:crypto.randomUUID(),angle:0,marks:[]};mutate(()=>{pages().splice(at,0,page);place(page);});}
  else{
   busy=true;renderSide();
   try{
    const L=await import('../../assets/vendor/pdf-lib-1.17.1/pdf-lib.esm.min.js'),doc=await L.PDFDocument.create();doc.addPage([w,h]);
    const before=pages().length;await ws.add([new File([await doc.save()],LT('blank'),{type:'application/pdf'})]);
    const added=pages().splice(before);pages().splice(Math.min(at,pages().length),0,...added);if(added[0]){blanks.set(k,added[0]);place(added[0]);}
   }catch(error){toast(error?.message||String(error),{error:true});busy=false;renderSide();return;}
   busy=false;changed();
  }
  toast(LT('blankDone',{n:at+1}));el.querySelector('.pg.is-selected')?.scrollIntoView({block:'nearest'});
 }
 async function add(files){
  if(busy)return;busy=true;const first=!pages().length;if(first)frame();renderSide();
  try{inputs.push(...files);const ready=[];for(const f of files)ready.push(f.type==='application/pdf'||/.pdf$/i.test(f.name)?f:await imagePage(f,options));await ws.add(ready,p=>{const r=el.querySelector('#pdfRun');if(r)r.textContent=p;});track('tool_run',{intent:route.id});}
  catch(error){toast(error?.message||String(error),{error:true});}
  finally{busy=false;if(!pages().length){empty();}else changed();}
 }
 /** Page size / margin apply to the image pages, so those are rebuilt from the original files. */
 async function rebuild(){
  if(busy)return;
  // Clearing PDF readers is asynchronous: lock settings and retire the old download first.
  busy=true;clearResult();renderSide();const files=inputs.slice();
  try{await ws.clear();selected.clear();blanks.clear();inputs.length=0;}
  finally{busy=false;renderSide();}
  await add(files);
 }
 async function run(){
  if(busy)return;busy=true;abort=new AbortController();renderSide();const base=(options.name.trim()||defaultName()).replace(/\.pdf$/i,''),progress=p=>{const r=el.querySelector('#pdfRun');if(r)r.textContent=p;};
  const numbered=!split&&options.numbers,kept=numbered?pages().map(p=>[p,p.marks]):[];
  // Page numbers are ordinary text marks that exist only while the file is written.
  kept.forEach(([p,marks],i)=>{p.marks=[...marks,pageNumberMark(p,options.numberStyle==='of'?`${i+1} / ${kept.length}`:String(i+1),options.numberPos)];});
  try{
   const common={optimize:options.optimize,removeMetadata:options.removeMetadata};let blob,name,count=1;
   if(!split){blob=await ws.export(common,progress,abort.signal);name=base+'.pdf';}
   else{const g=groups(),entries=[];for(let i=0;i<g.length;i++){progress(T('partProgress',{a:i+1,b:g.length}));entries.push({name:`${base}-${String(i+1).padStart(String(g.length).length,'0')}.pdf`,blob:await ws.export({...common,range:g[i].join(',')},()=>{},abort.signal)});}
    count=entries.length;if(count===1){blob=entries[0].blob;name=entries[0].name;}else{blob=await zip(entries,{signal:abort.signal});name=base+'.zip';}result={entries};}
   result={...(result||{}),blob,name,count};download(blob,name);track('tool_success',{intent:route.id});
   const box=el.querySelector('#pdfResult');box.hidden=false;box.innerHTML=`<strong>${esc(T(split?'doneSplit':images?'donePdf':'doneMerge'))}</strong><span>${esc(split?T('outputs',{n:count}):T('pagesN',{n:pages().length}))} · ${esc(bytes(blob.size))}${numbered?' · '+esc(LT('numbered')):''}</span><button type="button" class="ghost" data-action="pdf-again">${esc(T('again'))}</button>`;
   el.querySelector('#pdfNext').innerHTML=`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="pdf-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
  }catch(error){if(error?.name!=='AbortError'){toast(error?.message||String(error),{error:true});track('tool_error',{intent:route.id,error_code:'processing_failed'});}else toast(LT('canceled'));}
  finally{for(const [p,marks] of kept)p.marks=marks;busy=false;abort=null;renderSide();}
 }
 function readOptions(){
  const q=s=>el.querySelector(s);options={...options,every:Math.max(1,Number(q('#pdfEvery')?.value)||options.every),ranges:q('#pdfRanges')?.value??options.ranges,name:q('#pdfName')?.value??options.name,optimize:!!q('#pdfOptimize')?.checked,removeMetadata:!!q('#pdfMeta')?.checked,numbers:!!q('#pdfNumbers')?.checked,numberStyle:q('#pdfNumberStyle')?.value==='of'?'of':'n',numberPos:['center','right','left'].includes(q('#pdfNumberPos')?.value)?q('#pdfNumberPos').value:'center'};
  clearResult();render();
 }
 el.addEventListener('click',e=>{
  if(e.target.id==='pdfZoom'){e.target.close();return;}// a click on the backdrop
  const b=e.target.closest('[data-action]'),card=e.target.closest('.pg');
  if(b){const a=b.dataset.action;
   if(a==='pg-zoom'){zoom(indexOf(card.dataset.id));return;}
   if(a==='pdf-zoom-prev'||a==='pdf-zoom-next'){zoom(zoomIndex+(a==='pdf-zoom-prev'?-1:1));return;}
   if(a==='pdf-zoom-close'){el.querySelector('#pdfZoom')?.close();return;}
   if(a==='pg-rotate'||a==='pg-delete'){const id=card.dataset.id;mutate(()=>{const i=indexOf(id);if(a==='pg-rotate')pages()[i].angle=(pages()[i].angle+90)%360;else pages().splice(i,1);});return;}
   if(a==='pdf-all'){if(selected.size===pages().length)selected.clear();else for(const p of pages())selected.add(p.id);render();}
   else if(a==='pdf-left'||a==='pdf-right')mutate(()=>{for(const p of chosen())p.angle=(p.angle+(a==='pdf-left'?270:90))%360;});
   else if(a==='pdf-first'||a==='pdf-last')mutate(()=>{const list=pages(),moving=list.filter(p=>selected.has(p.id)),rest=list.filter(p=>!selected.has(p.id));list.splice(0,list.length,...(a==='pdf-first'?[...moving,...rest]:[...rest,...moving]));});
   else if(a==='pdf-cancel')abort?.abort();
   else if(a==='pdf-back')moveSelection(-1);else if(a==='pdf-forward')moveSelection(1);
   else if(a==='pdf-duplicate')mutate(()=>{for(const p of chosen()){const copy={...p,id:crypto.randomUUID(),marks:[]};pages().splice(indexOf(p.id)+1,0,copy);}});
   else if(a==='pdf-delete')mutate(()=>{const keep=pages().filter(p=>!selected.has(p.id));pages().splice(0,pages().length,...keep);selected.clear();});
   else if(a==='pdf-undo'){if(ws.undo())changed();}
   else if(a==='pdf-file-remove')mutate(()=>{const keep=pages().filter(p=>p.source.id!==b.dataset.source);pages().splice(0,pages().length,...keep);});
   else if(a==='pdf-sort')mutate(()=>{const order=ws.sources.slice().sort((x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true}));pages().sort((x,y)=>order.indexOf(x.source)-order.indexOf(y.source)||x.index-y.index);});
   else if(a==='pdf-pick')pick();
   else if(a==='pdf-odd'||a==='pdf-even'){if(!busy)select(pages().map((_,i)=>i+1).filter(i=>i%2===(a==='pdf-odd'?1:0)));}
   else if(a==='pdf-invert'){if(!busy)select(pages().map((p,i)=>selected.has(p.id)?0:i+1).filter(Boolean));}
   else if(a==='pdf-reverse')mutate(()=>{pages().splice(0,pages().length,...reverseOrder(pages(),p=>selected.has(p.id)));});
   else if(a==='pdf-blank')insertBlank();
   else if(a==='pdf-orient'){options.orient=b.dataset.orient;for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));rebuild();}
   else if(a==='pdf-clear'){inputs.length=0;blanks.clear();pickText='';pickError='';ws.clear();selected.clear();for(const u of thumbs.values())if(u)URL.revokeObjectURL(u);thumbs.clear();result=null;empty();}
   else if(a==='pdf-mode'){options.mode=b.dataset.mode;for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));modeFields();clearResult();render();}
   else if(a==='pdf-pagesize'||a==='pdf-margin'){if(a==='pdf-pagesize'){options.pageSize=b.dataset.size;const orient=el.querySelector('#pdfOrient');if(orient)orient.hidden=options.pageSize==='fit';}else options.margin=Number(b.dataset.margin);for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));rebuild();}
   else if(a==='pdf-run')run();
   else if(a==='pdf-again'&&result)download(result.blob,result.name);
   else if(a==='pdf-next'&&result)continueWith(b.dataset.tool,result.entries?result.entries.map(x=>new File([x.blob],x.name,{type:'application/pdf'})):[new File([result.blob],result.name,{type:'application/pdf'})]);
   if(a.startsWith('pdf-')||a.startsWith('pg-'))return;
  }
  if(card){const id=card.dataset.id;
   if(e.shiftKey&&anchor&&indexOf(anchor)>=0){const [a,z]=[indexOf(anchor),indexOf(id)].sort((x,y)=>x-y);for(let i=a;i<=z;i++)selected.add(pages()[i].id);}
   else if(e.ctrlKey||e.metaKey||matchMedia('(pointer: coarse)').matches){selected.has(id)?selected.delete(id):selected.add(id);anchor=id;}
   else{const only=selected.size===1&&selected.has(id);selected.clear();if(!only)selected.add(id);anchor=id;}
   render();el.querySelector(`.pg[data-id="${id}"]`)?.focus();}
 });
 // On the document, not the workspace: a button that disables itself after its click drops focus to
 // <body>, and shortcuts (undo, delete) pressed next would otherwise never reach the workspace.
 document.addEventListener('keydown',e=>{
  if(!el.isConnected||e.target.closest?.('dialog'))return;
  if(e.target.matches('input,textarea,select'))return;
  // While the large view is open the board's shortcuts (Delete, Ctrl+A…) are off.
  if(el.querySelector('#pdfZoom')?.open){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();zoom(zoomIndex+(e.key==='ArrowLeft'?-1:1));}return;}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  if(!pages().length)return;const card=e.target.closest?.('.pg');
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();for(const p of pages())selected.add(p.id);render();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(ws.undo())changed();}
  else if((e.key==='Delete'||e.key==='Backspace')&&selected.size){e.preventDefault();el.querySelector('[data-action="pdf-delete"]').click();}
  else if(card&&e.target.closest('button')&&(e.key===' '||e.key==='Enter'))return;// the card's own buttons (view, rotate, delete) act on their own
  else if(card&&(e.key===' '||e.key==='Enter')){e.preventDefault();card.click();}
  else if(card&&e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();if(!selected.has(card.dataset.id)){selected.clear();selected.add(card.dataset.id);}moveSelection(e.key==='ArrowLeft'?-1:1);el.querySelector(`.pg[data-id="${card.dataset.id}"]`)?.focus();}
  else if(card&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();(e.key==='ArrowLeft'?card.previousElementSibling:card.nextElementSibling)?.focus();}
 });
 el.addEventListener('dragstart',e=>{const card=e.target.closest?.('.pg');if(!card||busy)return;dragId=card.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);card.classList.add('is-dragging');});
 el.addEventListener('dragend',()=>{dragId=null;for(const c of el.querySelectorAll('.is-dragging,.drop-before,.drop-after'))c.classList.remove('is-dragging','drop-before','drop-after');});
 el.addEventListener('dragover',e=>{if(!dragId)return;const card=e.target.closest?.('.pg');e.preventDefault();e.stopPropagation();for(const c of el.querySelectorAll('.drop-before,.drop-after'))c.classList.remove('drop-before','drop-after');if(!card||card.dataset.id===dragId)return;const r=card.getBoundingClientRect();card.classList.add(e.clientX>r.left+r.width/2?'drop-after':'drop-before');});
 el.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();const card=e.target.closest?.('.pg');if(card&&card.dataset.id!==dragId){const r=card.getBoundingClientRect();dropAt(card.dataset.id,e.clientX>r.left+r.width/2);}});
 el.addEventListener('input',e=>{if(e.target.id==='pdfPick'){pickText=e.target.value;if(pickError)pickError_('');return;}if(e.target.closest('#pdfOptions'))readOptions();});
 el.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='pdfPick'){e.preventDefault();pick();}});
 el.addEventListener('submit',e=>e.preventDefault());
 onLocale(()=>{if(!pages().length){empty();return;}frame();render();});
 empty();
 return {add,get pages(){return pages();}};
}
