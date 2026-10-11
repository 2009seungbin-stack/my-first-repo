/** 다듬기 작업대 island (platform/render/make.js renders the shell). One picture in, a recipe of steps,
 * an instant preview (≤ 512 px pass) and the full-resolution files for download (src/pipeline).
 *  · workbench: the recipe chain records every step the person applies (add / remove / reorder / turn off);
 *    "조정" opens the step's settings on the right, advanced options folded under 고급
 *  · remix (?recipe=<post id>): the original's steps replayed on the visitor's picture, with per-step
 *    status and time, automatic adaptation (sheet grid), before/after slider, consent box for people,
 *    "원글에 리믹스로 올리기"
 * Pictures stay in this browser until the person posts (then the post's images go through /api/v2/uploads). */
import {PRESETS,FIT_SPECS,GENERATORS,GENERATOR_NAMES,OPS,RECIPE_SCHEMA,validateRecipe,defaultStep,normalizeParams,opName,stepDetail,summaryLine,presetById} from '../pipeline/recipe.js';
import {Pipeline} from '../pipeline/runner.js';
import {readImage,pageAdapters,toCanvas} from '../pipeline/browser.js';
import {FIELDS,HINTS} from './fields.js';
import {api} from './api.js';
import {detectFaces} from './face.js';

const root=document.getElementById('make');
const L=root?.dataset.l==='en'?'en':'ko',ko=L==='ko';
const t=(k,e)=>ko?k:e;
/** The new channels and their 말머리 (AI-COMMUNITY-CONTRACT §2). COMMUNITY owns platform/channels.js; these
 * are the ids the posts API accepts once that lands. */
const CHANNELS=[
 ['sticker',t('이모티콘·스티커','Emoticons & stickers'),[['kakao',t('카톡 대화용','KakaoTalk chat')],['line',t('LINE 판매','LINE sale')],['discord','Discord'],['telegram','Telegram'],['anim',t('움짤','Animated')],['question',t('질문','Question')]]],
 ['pfp',t('프사·프로필','Profile pictures'),[['share',t('작품','Work')],['tip',t('팁','Tip')],['question',t('질문','Question')],['free',t('자유','Free')]]],
 ['pixel',t('도트','Pixel art'),[['share',t('작품','Work')],['fix',t('정리 전후','Before/after')],['tip',t('팁','Tip')],['question',t('질문','Question')]]],
 ['wall',t('배경화면','Wallpapers'),[['phone',t('폰','Phone')],['pc','PC'],['tip',t('팁','Tip')],['question',t('질문','Question')]]],
 ['howto',t('레시피 질문','Recipe questions'),[['question',t('질문','Question')],['request',t('만들어 주세요','Requests')],['tip',t('팁','Tip')]]],
 ['free',t('자유','Free talk'),[['free',t('자유','Free')],['question',t('질문','Question')],['info',t('정보','Info')]]],
];
const DEFAULT_TARGET={'kakao.static':'sticker/kakao','line.sticker':'sticker/line','discord.emoji':'sticker/discord','discord.sticker':'sticker/discord','telegram.sticker':'sticker/telegram','whatsapp.sticker':'sticker/question','pfp.square':'pfp/share','x.pfp':'pfp/share','wall.iphone17':'wall/phone','wall.iphone17promax':'wall/phone','wall.galaxys25':'wall/phone','wall.pc1080':'wall/pc','wall.pc4k':'wall/pc'};
/** Where a new step goes: the natural order of a sticker / picture chain. */
const ORDER=['sheet.split','bg.remove','pixel.snap','crop','upscale','pixelize','palette','sticker.border','caption','fit','motion','export'];
const STICKER_FITS=['line.sticker','kakao.static','discord.emoji','discord.sticker','telegram.sticker','whatsapp.sticker','pfp.square','x.pfp','wall.iphone17','wall.galaxys25','wall.pc1080'];

// ---------------------------------------------------------------- tiny DOM helpers
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function h(tag,attrs={},...kids){
 const el=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs||{})){if(v===false||v==null)continue;if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('on'))el.addEventListener(k.slice(2),v);else if(k==='dataset')Object.assign(el.dataset,v);else el.setAttribute(k,v===true?'':String(v));}
 for(const c of kids.flat(3)){if(c==null||c===false)continue;el.append(c instanceof Node?c:document.createTextNode(String(c)));}
 return el;
}
const svg=(d,size=16,sw=2)=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('width',size);s.setAttribute('height',size);s.setAttribute('viewBox','0 0 24 24');s.setAttribute('fill','none');s.setAttribute('stroke','currentColor');s.setAttribute('stroke-width',sw);s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');s.setAttribute('aria-hidden','true');for(const p of d.split('|')){const e=document.createElementNS('http://www.w3.org/2000/svg','path');e.setAttribute('d',p);s.append(e);}return s;};
const ICON={back:'M15 18l-6-6 6-6',more:'M12 5h.01|M12 12h.01|M12 19h.01',up:'M18 15l-6-6-6 6',down:'M6 9l6 6 6-6',x:'M18 6 6 18|M6 6l12 12',eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',plus:'M12 5v14|M5 12h14',dl:'M12 3v12|M7 10l5 5 5-5|M5 21h14'};
let toastTimer=0;
function toast(text){let el=$('#n2-toast');if(!el){el=h('div',{id:'n2-toast',class:'toast',role:'status'});document.body.append(el);}el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},2800);}
const kb=n=>n>=1e6?`${(n/1e6).toFixed(1)}MB`:`${Math.max(1,Math.round(n/1000))}KB`;
const secs=ms=>ms<1000?`${(ms/1000).toFixed(1)}${t('초','s')}`:`${(ms/1000).toFixed(1)}${t('초','s')}`;

// ---------------------------------------------------------------- state
const S={
 mode:root?.dataset.recipe?'remix':'work',input:null,file:'',srcW:0,srcH:0,thumb:null,
 recipe:null,sel:null,item:0,status:[],prev:null,full:null,fullBusy:false,error:null,progress:'',
 original:null,compare:!!root?.dataset.recipe,face:null,tried:false,st:null,posting:false,adapt:null,
};
const pipe=new Pipeline({ai:pageAdapters({onProgress:p=>{S.progress=friendly(p);paintStatus();paintCheck();}})});
const friendly=p=>{const m=/([\d.]+) MiB \/ ([\d.]+) MiB/.exec(p);if(/download/i.test(p))return t('AI 모델 받는 중','Downloading the AI model')+(m?` ${Math.round(100*Number(m[1])/Number(m[2]))}%`:'');if(/cached model/i.test(p))return t('AI 모델 여는 중','Opening the AI model');if(/infer|tile|refin|matt|run/i.test(p))return t('AI가 처리 중','AI is working');return '';};

function newRecipe(steps,src){
 const v=validateRecipe({schema:RECIPE_SCHEMA,source:src||{generator:'other',ai:true},input:{expect:steps.some(s=>s.op==='sheet.split')?'sheet':'single'},steps:steps.some(s=>s.op==='export')?steps:[...steps,defaultStep('export')]});
 if(!v.ok)throw Error(v.error);return v.recipe;
}
const steps=()=>S.recipe.steps;
const exportIndex=()=>steps().findIndex(s=>s.op==='export');
const lastFit=()=>[...steps()].reverse().find(s=>s.op==='fit'&&!s.off)||null;
function lastReal(){const l=steps();for(let i=l.length-1;i>=0;i--)if(l[i].op!=='export'&&!l[i].off)return i;return l.length-1;}
function setRecipe(r,{keepSel=false}={}){S.recipe=r;if(!keepSel||S.sel==null||S.sel>=steps().length)S.sel=lastReal();S.status=steps().map(()=>({status:'wait'}));paintAll();schedule();}
function editStep(i,patch){
 const s=steps()[i],n=normalizeParams(s.op,{...s.p,...patch});if(!n.ok){toast(n.error);return;}
 const next=steps().map((x,j)=>j===i?{...x,p:n.p}:x);
 // A fit preset carries its own byte limit and LINE's extra images into the export step.
 if(s.op==='fit'&&patch.preset&&FIT_SPECS[patch.preset]){const ei=next.findIndex(x=>x.op==='export');if(ei>=0)next[ei]={...next[ei],p:normalizeParams('export',{...next[ei].p,maxBytes:FIT_SPECS[patch.preset].maxBytes,extras:patch.preset==='line.sticker'}).p};}
 S.recipe=newRecipe(next,S.recipe.source);paintChain();paintSettings();schedule();
}
function addStep(op){
 const list=[...steps()],at=list.findIndex(s=>ORDER.indexOf(s.op)>ORDER.indexOf(op));
 const step=defaultStep(op,op==='fit'?{preset:'line.sticker'}:op==='upscale'?{scale:2}:{});
 const i=at<0?list.length:at;list.splice(i,0,step);
 S.recipe=newRecipe(list,S.recipe.source);S.sel=i;S.status.splice(i,0,{status:'wait'});paintAll();schedule();
 toast(t(`${opName(op,'ko')} 단계를 넣었어요`,`Added ${opName(op,'en')}`));
}
function moveStep(i,d){const list=[...steps()],j=i+d;if(j<0||j>=list.length||list[j].op==='export'||list[i].op==='export')return;[list[i],list[j]]=[list[j],list[i]];S.recipe=newRecipe(list,S.recipe.source);S.sel=j;paintAll();schedule();}
function removeStep(i){const list=steps().filter((_,j)=>j!==i);if(!list.length)return;S.recipe=newRecipe(list,S.recipe.source);S.sel=lastReal();S.status.splice(i,1);paintAll();schedule();}
function toggleStep(i){const list=steps().map((s,j)=>j===i?{...s,...(s.off?{off:undefined}:{off:true})}:s).map(s=>{const c={...s};if(!c.off)delete c.off;return c;});S.recipe=newRecipe(list,S.recipe.source);paintAll();schedule();}
function setFit(preset){
 const fi=steps().findLastIndex?steps().findLastIndex(s=>s.op==='fit'):[...steps()].map(s=>s.op).lastIndexOf('fit');
 if(fi>=0)editStep(fi,{preset});
 else{const list=[...steps()],ei=exportIndex();list.splice(ei<0?list.length:ei,0,defaultStep('fit',{preset}));S.recipe=newRecipe(list,S.recipe.source);editStep(list.findIndex(s=>s.op==='fit'),{preset});}
}

// ---------------------------------------------------------------- running
let timer=0,ctrl=null,version=0;
function schedule(){clearTimeout(timer);timer=setTimeout(run,120);}
async function run(){
 if(!S.input||!S.recipe)return;
 ctrl?.abort();ctrl=new AbortController();const v=++version,signal=ctrl.signal;
 S.error=null;S.full=null;S.fullBusy=true;S.status=steps().map(s=>({status:s.off?'off':'wait'}));paintStatus();paintDownload();
 const onStep=ev=>{if(v!==version)return;S.status[ev.index]={...S.status[ev.index],...ev};if(ev.status==='done'||ev.status==='cached')S.progress='';paintStatus();};
 try{
  const prev=await pipe.run(S.input,S.recipe,{preview:true,signal,onStep,stem:stemName()});
  if(v!==version)return;S.prev=prev;noteAdapt(prev);paintView();paintStatus();paintAdapt();paintFile();
  S.fullStep=null;const full=await pipe.run(S.input,S.recipe,{preview:false,signal,stem:stemName(),onStep:ev=>{if(v!==version)return;if(ev.status==='error')onStep(ev);else{S.fullStep=ev.status==='run'?ev.index:null;if(ev.status!=='run')S.progress='';paintCheck();}}});
  if(v!==version)return;S.full=full;S.fullBusy=false;paintView();paintDownload();root.dataset.runs=String(Number(root.dataset.runs||0)+1);
  if(S.mode==='remix'&&S.original&&!S.tried){S.tried=true;api.tried(S.original.id);}
 }catch(e){
  if(e?.name==='AbortError'||v!==version)return;
  S.fullBusy=false;S.error={step:e.step??null,message:String(e.message||e)};root.dataset.runs=String(Number(root.dataset.runs||0)+1);
  if(e.step!=null)S.status[e.step]={status:'error',error:S.error.message};
  paintStatus();paintDownload();paintView();
 }
}
const stemName=()=>(S.file||'nerulio').slice(0,40);
function noteAdapt(r){
 const sp=r.steps.find(s=>s.op==='sheet.split'),n=sp?.notes?.find(x=>x.op==='sheet.split');S.adapt=null;
 if(!n)return;const e=n.expected;
 if(n.method==='auto'&&e&&e.cols*e.rows>1&&(e.cols!==n.cols||e.rows!==n.rows))S.adapt={from:`${e.cols}×${e.rows}`,to:`${n.cols}×${n.rows}`,count:n.count,step:sp.index};
 S.found={cols:n.cols,rows:n.rows,count:n.count,method:n.method};
}
/** The doc shown: the selected step's output (full pass when ready), else the final one. */
function shown(){
 const r=S.full||S.prev;if(!r)return null;
 if(S.sel!=null&&steps()[S.sel]?.op!=='export'){const d=r.docs.find(x=>x.index===S.sel);if(d)return {doc:d.doc,at:S.sel};}
 return {doc:r.doc,at:null};
}
/** The "before" of the compare slider: the cell the sheet split made (same item), else the input. */
function before(i){
 const r=S.full||S.prev,sp=r?.docs.find(x=>steps()[x.index]?.op==='sheet.split'&&!steps()[x.index]?.off),doc=sp?sp.doc:S.input;
 return doc?.items[Math.min(i,doc.items.length-1)]||S.input?.items[0];
}

// ---------------------------------------------------------------- input
async function load(file){
 if(!file||!/^image\//.test(file.type||'image/')){toast(t('이미지 파일을 골라 주세요','Please choose an image'));return;}
 try{
  const doc=await readImage(file,file.name||'image');
  S.input=doc;S.file=doc.items[0].name;S.srcW=doc.source.w;S.srcH=doc.source.h;S.item=0;S.prev=null;S.full=null;S.tried=false;S.face=null;
  const it=doc.items[0];S.thumb=toCanvas(it.frames[0].data,it.w,it.h);
  $('[data-drop]',root).hidden=true;$('[data-work]',root).hidden=false;
  paintAll();schedule();
  detectFaces(S.thumb).then(f=>{S.face=f;paintConsent();});
 }catch(e){toast(t('이 이미지를 열 수 없어요','This image could not be opened'));console.warn(e);}
}
function bindInput(){
 for(const inp of $$('[data-file-input]',root))inp.addEventListener('change',()=>{const f=inp.files?.[0];inp.value='';if(f)load(f);});
 addEventListener('paste',e=>{const f=[...(e.clipboardData?.items||[])].find(x=>x.kind==='file'&&x.type.startsWith('image/'))?.getAsFile();if(f){e.preventDefault();load(f);}});
 root.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();root.classList.add('mk-dragging');}});
 root.addEventListener('dragleave',e=>{if(e.target===root||!root.contains(/** @type {any} */(e.relatedTarget)))root.classList.remove('mk-dragging');});
 root.addEventListener('drop',e=>{root.classList.remove('mk-dragging');const f=e.dataTransfer?.files?.[0];if(f){e.preventDefault();load(f);}});
}

// ---------------------------------------------------------------- drawing
function drawItem(c,it,frame=0){
 if(!it)return;const f=it.frames[Math.min(frame,it.frames.length-1)];c.width=it.w;c.height=it.h;
 c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.data.buffer,f.data.byteOffset,f.data.byteLength),it.w,it.h),0,0);
 c.classList.toggle('px',Math.max(it.w,it.h)<=128);
}
/** The "before" picture contained in the result's canvas size, so the slider compares like with like. */
function drawFitted(c,it,W,H){
 if(!it)return;c.width=W;c.height=H;c.classList.remove('px');const g=c.getContext('2d');g.clearRect(0,0,W,H);g.imageSmoothingQuality='high';
 const s=Math.min(W/it.w,H/it.h),w=Math.round(it.w*s),hh=Math.round(it.h*s);g.drawImage(toCanvas(it.frames[0].data,it.w,it.h),Math.floor((W-w)/2),Math.floor((H-hh)/2),w,hh);
}
let anim=0;
function play(c,it){cancelAnimationFrame(anim);if(!it||it.frames.length<2){drawItem(c,it);return;}let i=0,last=0;const tick=ts=>{if(!c.isConnected)return;if(ts-last>=(it.frames[i].ms||80)){drawItem(c,it,i);i=(i+1)%it.frames.length;last=ts;}anim=requestAnimationFrame(tick);};anim=requestAnimationFrame(tick);}

// ---------------------------------------------------------------- painting
const W=()=>$('[data-work]',root);
function paintAll(){
 if(!S.recipe)return;
 const work=W();if(!S.input){return;}
 if(!work.firstChild||work.dataset.mode!==S.mode){work.dataset.mode=S.mode;work.replaceChildren(S.mode==='remix'?remixLayout():workLayout());headerButtons();}
 paintFile();paintChain();paintSettings();paintView();paintDownload();paintConsent();paintPost();
}
function headerButtons(){
 const hd=$('.mk-hd',root);$$('[data-hd-act]',hd).forEach(x=>x.remove());
 if(S.mode==='remix')return;
 hd.append(h('button',{type:'button',class:'btn','data-hd-act':'',dataset:{download:''},onclick:download},svg(ICON.dl,15),t('받기','Download')),
  h('a',{class:'btn p','data-hd-act':'',href:'#mk-post',onclick:e=>{e.preventDefault();openPost();}},t('커뮤니티에 올리기','Post to community')));
}
function paintFile(){
 const it=S.input?.items[0];const f=$('[data-file]',root);if(f)f.textContent=it?`${S.file} · ${S.srcW}×${S.srcH}`:'';
 const rf=$('[data-rx-file]',root);if(rf&&it){const thumb=$('canvas',rf);drawItem(thumb,it);$('[data-rx-name]',rf).textContent=S.file;$('[data-rx-size]',rf).textContent=`${S.srcW}×${S.srcH}${S.found&&S.found.count>1?t(` · ${S.found.cols}×${S.found.rows} 격자로 보여요`,` · looks like a ${S.found.cols}×${S.found.rows} grid`):''}`;}
}

// ---- workbench (mockup 5)
function workLayout(){
 return h('div',{class:'mk-cols'},
  h('section',{class:'mk-chain','aria-labelledby':'mk-chain-h'},
   h('div',{class:'mk-ch-h'},h('h2',{id:'mk-chain-h'},t('레시피 (자동 기록)','Recipe (recorded)')),h('span',{class:'fine','data-count':''})),
   h('ol',{class:'mk-steps','data-steps':''}),
   h('button',{type:'button',class:'mk-add',onclick:()=>{const c=$('[data-catalog]',root);c.hidden=!c.hidden;if(!c.hidden)$('button',c)?.focus();}},'+ ',t('단계 추가','Add a step')),
   h('div',{class:'mk-cat','data-catalog':''},h('span',{class:'fine'},t('추가할 수 있는 단계','Steps you can add')),
    h('div',{class:'mk-chips'},OPS.filter(op=>op!=='export').map(op=>h('button',{type:'button',class:'mk-chip',onclick:()=>addStep(op)},opName(op,L))))),
   h('div',{class:'mk-cat'},h('span',{class:'fine'},t('규격 바로 맞추기','Ready presets')),
    h('div',{class:'mk-chips'},PRESETS.map(p=>h('button',{type:'button',class:'mk-chip',title:p.spec,onclick:()=>{setRecipe(newRecipe(p.recipe.steps,S.recipe.source));toast(t(`${p.names.ko} 레시피로 바꿨어요`,`Switched to ${p.names.en}`));}},p.names[L].replace(/ 만들기$| maker$/,'')))))),
  h('section',{class:'mk-view','aria-label':t('미리보기','Preview')},
   h('div',{class:'mk-vh'},h('strong',{'data-view-title':''}),h('span',{class:'fine','data-view-count':''}),h('span',{class:'sp'}),h('span',{class:'mono fine','data-view-size':''}),
    h('div',{class:'mk-seg',role:'group','aria-label':t('보기','View')},h('button',{type:'button','aria-pressed':'true','data-cmp':'1',onclick:()=>{S.compare=true;paintView();}},t('전후 비교','Before/after')),h('button',{type:'button','aria-pressed':'false','data-cmp':'0',onclick:()=>{S.compare=false;paintView();}},t('결과만','Result')))),
   stage(),
   h('div',{class:'mk-strip','data-strip':'',role:'listbox','aria-label':t('결과 낱장','Results')}),
   h('p',{class:'mk-check','data-check':'',role:'status'})),
  h('aside',{class:'mk-side'},
   h('section',{class:'mk-set','data-settings':'','aria-live':'polite'}),
   postPanel()));
}
function stage(){
 const s=h('div',{class:'mk-stage chk','data-stage':''},
  h('canvas',{class:'mk-before','data-before':'','aria-hidden':'true'}),h('canvas',{class:'mk-after','data-after':'',role:'img','aria-label':t('결과','Result')}),
  h('span',{class:'mk-lab l','data-lab-before':''},t('원본','Original')),h('span',{class:'mk-lab r','data-lab-after':''},t('결과','Result')),
  h('span',{class:'mk-split','data-split':''},h('i',{},'⇔')),
  h('input',{type:'range',min:0,max:100,value:50,class:'mk-slider','data-slider':'','aria-label':t('전후 비교 위치','Before/after position'),oninput:e=>{s.style.setProperty('--cut',`${e.target.value}%`);}}),
  h('div',{class:'mk-busy','data-busy':'',hidden:true},h('span',{class:'mk-spin'}),h('span',{'data-busy-text':''})));
 s.style.setProperty('--cut','50%');return s;
}
function paintChain(){
 const ol=$('[data-steps]',root);if(!ol||S.mode==='remix'){paintRemixSteps();return;}
 const list=steps();$('[data-count]',root).textContent=t(`${list.filter(s=>!s.off&&s.op!=='export').length}단계`,`${list.filter(s=>!s.off&&s.op!=='export').length} steps`);
 ol.replaceChildren(...list.map((s,i)=>{
  const on=S.sel===i;
  const menu=h('div',{class:'mk-menu',hidden:true,role:'menu'},
   h('button',{type:'button',role:'menuitem',onclick:()=>moveStep(i,-1),disabled:i===0||s.op==='export'},svg(ICON.up,14),t('위로','Up')),
   h('button',{type:'button',role:'menuitem',onclick:()=>moveStep(i,1),disabled:s.op==='export'||list[i+1]?.op==='export'},svg(ICON.down,14),t('아래로','Down')),
   s.op!=='export'?h('button',{type:'button',role:'menuitem',onclick:()=>toggleStep(i)},svg(ICON.eye,14),s.off?t('다시 켜기','Turn on'):t('끄기','Turn off')):null,
   s.op!=='export'?h('button',{type:'button',role:'menuitem',onclick:()=>removeStep(i)},svg(ICON.x,14),t('빼기','Remove')):null);
  return h('li',{class:`mk-step${on?' on':''}${s.off?' off':''}`,dataset:{i}},
   h('button',{type:'button',class:'mk-sb','aria-pressed':on?'true':'false',onclick:()=>{S.sel=i;paintChain();paintSettings();paintView();}},
    h('span',{class:'mono mk-n'},s.op==='export'?'↓':String(i+1)),
    h('span',{class:'mk-sn'},h('strong',{},s.op==='sticker.border'&&s.p.color!=='#ffffff'?t('테두리','Border'):opName(s.op,L)),h('span',{class:'fine'},s.off?t('꺼짐','off'):stepDetail(s,L,list,i))),
    h('span',{class:'mk-st','data-st':i})),
   h('button',{type:'button',class:'mk-more','aria-label':t(`${opName(s.op,'ko')} 메뉴`,`${opName(s.op,'en')} menu`),'aria-haspopup':'menu',onclick:e=>{e.stopPropagation();const open=menu.hidden;$$('.mk-menu',root).forEach(m=>m.hidden=true);menu.hidden=!open;}},svg(ICON.more,18)),menu);
 }));
 paintStatus();
}
document.addEventListener('click',e=>{if(!/** @type {any} */(e.target).closest?.('.mk-more,.mk-menu'))$$('.mk-menu',root||document).forEach(m=>m.hidden=true);});
function paintStatus(){
 for(const [i,s] of steps().entries()){
  const st=S.status[i]||{status:'wait'};
  for(const el of $$(`[data-st="${i}"]`,root)){
   el.className=`mk-st ${st.status}`;
   el.textContent=st.status==='done'?secs(st.ms||0):st.status==='cached'?t('그대로','same'):st.status==='run'?(S.progress||t('처리 중','working')):st.status==='error'?t('오류','error'):st.status==='off'||s.off?t('꺼짐','off'):'';
   el.title=st.error||'';
  }
  for(const el of $$(`[data-dot="${i}"]`,root)){const k=s.off?'off':st.status==='done'||st.status==='cached'?'done':st.status==='run'?'run':st.status==='error'?'err':'wait';el.className=`mk-dot ${k}`;el.textContent=k==='done'?'✓':k==='run'?'…':k==='err'?'!':'·';}
  for(const el of $$(`[data-time="${i}"]`,root))el.textContent=st.status==='done'?secs(st.ms||0):st.status==='cached'?'—':st.status==='run'?(S.progress||t('진행 중','running')):st.status==='error'?t('오류','error'):s.off?t('꺼짐','off'):S.input?t('대기','waiting'):'';
 }
 const busy=$('[data-busy]',root);if(busy){const running=S.status.some(s=>s.status==='run');busy.hidden=!running;$('[data-busy-text]',busy).textContent=S.progress||t('처리 중…','Working…');}
 const rs=$('[data-rx-progress]',root);if(rs){const live=steps().filter(s=>!s.off&&s.op!=='export'),done=S.status.filter((s,i)=>!steps()[i]?.off&&steps()[i]?.op!=='export'&&(s.status==='done'||s.status==='cached')).length;rs.textContent=t(`${done} / ${live.length}단계`,`${done} / ${live.length} steps`)+(S.prev?t(` · ${S.prev.doc.items.length}장`,` · ${S.prev.doc.items.length} pictures`):'');}
 if(S.error){const err=$('[data-error]',root);if(err){err.hidden=false;err.textContent=t(`${S.error.step!=null?`${S.error.step+1}단계`:''} 처리하지 못했어요: ${S.error.message}`,`Step ${S.error.step!=null?S.error.step+1:''} failed: ${S.error.message}`);}}
 else{const err=$('[data-error]',root);if(err)err.hidden=true;}
}
function field(f,s,i,list){
 const p=s.p,id=`mk-f-${i}-${f.k}`,lab=f.label[L];
 const nominal=s.op==='sticker.border'?(()=>{const fit=list.slice(i+1).find(x=>x.op==='fit'&&!x.off);return Math.max(1,Math.round(p.width*(fit?Math.max(fit.p.w,fit.p.h):512)));})():0;
 const set=v=>editStep(i,{[f.k]:v});
 if(f.kind==='chips')return h('fieldset',{class:'mk-f'},h('legend',{},lab),h('div',{class:'mk-seg wrap'},f.opts.map(([v,n])=>h('button',{type:'button','aria-pressed':p[f.k]===v?'true':'false',onclick:()=>set(v)},n[L]))));
 if(f.kind==='range'){const out=h('span',{class:'mono'},f.fmt?f.fmt(p[f.k],p,L,nominal):String(p[f.k]));return h('label',{class:'mk-f',for:id},h('span',{class:'mk-fl'},h('span',{},lab),out),h('input',{id,type:'range',min:f.min,max:f.max,step:f.step,value:p[f.k],oninput:e=>{const v=Number(e.target.value);out.textContent=f.fmt?f.fmt(v,p,L,s.op==='sticker.border'?Math.max(1,Math.round(v*(nominal/Math.max(p.width,1e-9)||512))):0):String(v);},onchange:e=>set(Number(e.target.value))}));}
 if(f.kind==='select')return h('label',{class:'mk-f',for:id},h('span',{},lab),h('select',{id,onchange:e=>{const v=e.target.value;set(typeof f.opts[0][0]==='number'?Number(v):v);}},f.opts.map(([v,n])=>h('option',{value:v,selected:p[f.k]===v},n[L]))));
 if(f.kind==='check')return h('label',{class:'mk-f row',for:id},h('input',{id,type:'checkbox',checked:!!p[f.k],onchange:e=>set(e.target.checked)}),h('span',{},lab));
 if(f.kind==='color')return h('label',{class:'mk-f row sb',for:id},h('span',{},lab),h('input',{id,type:'color',value:p[f.k],onchange:e=>set(e.target.value)}));
 if(f.kind==='text')return h('label',{class:'mk-f',for:id},h('span',{},lab),h('input',{id,type:'text',maxlength:40,value:p[f.k],placeholder:t('예: 고마워요','e.g. Thank you'),onchange:e=>set(e.target.value)}));
 return null;
}
function settingsFor(i,{compact=false}={}){
 const list=steps(),s=list[i];if(!s)return h('p',{class:'fine'},t('단계를 고르면 설정이 여기에 나와요.','Pick a step to change it.'));
 const fs=(FIELDS[s.op]||[]).filter(f=>!f.show||f.show(s.p));
 const main=fs.filter(f=>!f.adv).map(f=>field(f,s,i,list)),adv=fs.filter(f=>f.adv).map(f=>field(f,s,i,list));
 const hint=HINTS[s.op];
 return h('div',{class:'mk-setb'},
  compact?null:h('h2',{},s.op==='sticker.border'&&s.p.color!=='#ffffff'?t('테두리','Border'):opName(s.op,L)),
  main,adv.length?h('details',{class:'mk-adv'},h('summary',{},t('고급','Advanced')),adv):null,
  hint?h('p',{class:'fine mk-hint'},hint[L]):null,
  s.op==='fit'&&FIT_SPECS[s.p.preset]?.note?h('p',{class:'fine mk-hint'},FIT_SPECS[s.p.preset].note[L]):null);
}
function paintSettings(){
 const box=$('[data-settings]',root);if(!box)return;
 const i=S.sel??lastReal();keepFocus(()=>box.replaceChildren(settingsFor(i)));
}
function paintView(){
 const stg=$('[data-stage]',root);if(!stg)return;
 const sh=shown(),doc=sh?.doc;
 const n=doc?.items.length||0;if(S.item>=n)S.item=0;
 const it=doc?.items[S.item];
 const title=$('[data-view-title]',root);
 if(title){const at=sh?.at;title.textContent=at!=null?t(`${at+1}단계 ${opName(steps()[at].op,'ko')} 결과`,`After step ${at+1}: ${opName(steps()[at].op,'en')}`):t('최종 결과','Final result');}
 const cnt=$('[data-view-count]',root);if(cnt)cnt.textContent=n?t(`${n}장 중 ${S.item+1}번째`,`${S.item+1} of ${n}`):'';
 const sz=$('[data-view-size]',root);if(sz)sz.textContent=it?`${it.w}×${it.h}${it.frames.length>1?` · ${it.frames.length}${t('프레임','f')}`:''}`:'';
 for(const b of $$('[data-cmp]',root))b.setAttribute('aria-pressed',String(b.dataset.cmp===(S.compare?'1':'0')));
 stg.classList.toggle('cmp',!!S.compare&&!!it);
 const after=$('[data-after]',stg),bef=$('[data-before]',stg);
 if(it)play(after,it);else{after.width=after.height=1;}
 if(S.compare&&it)drawFitted(bef,before(S.item),it.w,it.h);
 const lab=$('[data-lab-after]',stg);if(lab)lab.textContent=it?t(`결과 ${it.w}×${it.h}`,`Result ${it.w}×${it.h}`):t('결과','Result');
 // Strip
 const strip=$('[data-strip]',root);
 if(strip){strip.replaceChildren(...(doc?.items||[]).slice(0,80).map((x,k)=>{const c=h('canvas',{});drawItem(c,x);return h('button',{type:'button',class:`mk-th chk${k===S.item?' on':''}`,role:'option','aria-selected':k===S.item?'true':'false','aria-label':t(`${k+1}번째`,`#${k+1}`),onclick:()=>{S.item=k;paintView();}},c);}));strip.hidden=n<2;}
 paintCheck();
}
function paintCheck(){
 const el=$('[data-check]',root);if(!el)return;
 const r=S.full;if(!r?.check){const st=S.fullStep!=null?steps()[S.fullStep]:null;el.textContent=S.fullBusy&&S.prev?t('원본 크기로 마무리하는 중…','Finishing at full size…')+(st?` (${S.fullStep+1}${t('단계','.')} ${opName(st.op,L)}${S.progress?` · ${S.progress}`:''})`:''):'';el.className='mk-check';return;}
 const c=r.check,files=r.exported.files,big=Math.max(...files.map(f=>f.bytes.length));
 if(!c.spec){el.textContent=t(`파일 ${files.length}개 · 가장 큰 파일 ${kb(big)}`,`${files.length} file(s) · largest ${kb(big)}`);el.className='mk-check';return;}
 const name=FIT_SPECS[c.spec].names[L];
 el.className=`mk-check ${c.ok?'ok':'bad'}`;
 el.replaceChildren(h('b',{},c.ok?t('규격 확인 ✓','Spec check ✓'):t('규격 확인 ✕','Spec check ✕')),` ${name} · ${c.checked}${t('개','')} · ${t('가장 큰 파일','largest')} ${kb(big)}`,
  c.ok?'':h('span',{class:'mk-probs'},c.problems.slice(0,3).map(p=>h('span',{},`${p.file==='*'?'':p.file+': '}${p[L]}`))));
}
function paintDownload(){
 for(const b of $$('[data-download]',root)){
  b.disabled=!S.input;
  const lab=S.full?.exported?(S.full.exported.pack?t(`받기 · ZIP ${kb(S.full.exported.pack.bytes.length)}`,`Download · ZIP ${kb(S.full.exported.pack.bytes.length)}`):t(`받기 · ${kb(S.full.exported.files[0].bytes.length)}`,`Download · ${kb(S.full.exported.files[0].bytes.length)}`)):S.fullBusy&&S.input?t('받기 (마무리 중…)','Download (finishing…)'):t('받기','Download');
  b.title=lab;if(b.hasAttribute('data-short'))continue;
  const txt=[...b.childNodes].find(n=>n.nodeType===3);if(txt)txt.textContent=lab;else b.append(lab);
 }
 paintCheck();
}
let wantDownload=false;
async function download(){
 if(!S.input)return;
 if(!S.full){wantDownload=true;toast(t('원본 크기로 마무리하고 있어요. 끝나면 바로 받아요.','Finishing at full size; the download starts when it is done.'));await new Promise(r=>{const iv=setInterval(()=>{if(S.full||S.error){clearInterval(iv);r(null);}},150);});if(!S.full)return;}
 wantDownload=false;
 const ex=S.full.exported;
 const save=(name,bytes,type)=>{const url=URL.createObjectURL(new Blob([bytes],{type}));const a=h('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
 const stem=stemName().replace(/[\\/:*?"<>|]+/g,'-');
 if(ex.pack)save(ex.pack.name.replace(/^nerulio/,stem),ex.pack.bytes,'application/zip');
 else if(ex.files.length===1){const f=ex.files[0];
  // Phones: the share sheet saves to the photo library ("사진첩에 저장").
  const file=new File([f.bytes],f.name.replace(/^nerulio/,stem),{type:f.mime});
  if(matchMedia('(max-width:760px)').matches&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});return;}catch(e){if(e?.name==='AbortError')return;}}
  save(file.name,f.bytes,f.mime);}
 else for(const f of ex.files)save(`${stem}-${f.name}`,f.bytes,f.mime);
}

// ---- remix (mockups 4 and 8)
function remixLayout(){
 const o=S.original;
 const sel=h('select',{'data-final':'','aria-label':t('마지막 규격','Final spec'),onchange:e=>setFit(e.target.value)},STICKER_FITS.map(id=>h('option',{value:id},FIT_SPECS[id].names[L])));
 return h('div',{class:'mk-rx'},
  h('div',{class:'mk-rx-top'},o?h('a',{href:o.url||'#',class:'mk-back'},svg(ICON.back,16),t('원글: ','Original: '),o.title||''):null),
  h('div',{class:'mk-rx-cols'},
   h('section',{class:'mk-rx-l','aria-label':t('레시피 단계','Recipe steps')},
    h('label',{class:'mk-rx-file','data-rx-file':''},h('canvas',{class:'chk'}),h('span',{class:'mk-rx-fn'},h('strong',{'data-rx-name':''}),h('span',{class:'fine','data-rx-size':''})),h('span',{class:'btn sm'},t('바꾸기','Change')),h('input',{type:'file',accept:'image/*',class:'sr-only','data-file-input':'','aria-label':t('다른 이미지 고르기','Choose another image'),onchange:e=>{const f=e.target.files?.[0];e.target.value='';if(f)load(f);}})),
    h('ol',{class:'mk-rx-steps','data-rx-steps':''}),
    h('p',{class:'fine mk-adapt','data-adapt':'',hidden:true}),
    h('p',{class:'mk-err','data-error':'',hidden:true,role:'alert'}),
    consentBox()),
   h('section',{class:'mk-rx-r','aria-labelledby':'mk-pv-h'},
    h('div',{class:'mk-vh'},h('h2',{id:'mk-pv-h'},t('결과 미리보기','Preview')),h('span',{class:'fine','data-rx-progress':''}),h('span',{class:'sp'}),
     h('div',{class:'mk-seg',role:'group','aria-label':t('보기','View')},h('button',{type:'button','aria-pressed':'true','data-cmp':'1',onclick:()=>{S.compare=true;paintView();}},t('전후 비교','Before/after')),h('button',{type:'button','aria-pressed':'false','data-cmp':'0',onclick:()=>{S.compare=false;paintView();}},t('전체 장','All')))),
    stage(),
    h('div',{class:'mk-strip','data-strip':'',role:'listbox','aria-label':t('결과 낱장','Results')}),
    h('p',{class:'mk-check','data-check':'',role:'status'}),
    h('div',{class:'mk-rx-bar'},
     h('label',{class:'mk-final'},h('span',{},t('마지막 규격','Final spec')),sel),h('span',{class:'sp'}),
     h('button',{type:'button',class:'btn','data-download':'','data-short':'',onclick:download},svg(ICON.dl,15),h('span',{class:'dl-w'},t('ZIP 받기','Download ZIP')),h('span',{class:'dl-m'},t('사진첩에 저장','Save'))),
     h('button',{type:'button',class:'btn p',onclick:()=>openPost(true)},t('원글에 리믹스로 올리기','Post as a remix'))))),
  h('div',{class:'mk-rx-post'},postPanel()));
}
function paintRemixSteps(){
 const ol=$('[data-rx-steps]',root);if(!ol)return;
 const list=steps(),open=S.rxOpen;
 keepFocus(()=>ol.replaceChildren(...list.map((s,i)=>s.op==='export'?'':h('li',{class:`mk-rx-step${s.off?' off':''}`},
  h('div',{class:'mk-rx-row'},h('span',{class:'mk-dot wait','data-dot':i},'·'),
   h('span',{class:'mk-sn'},h('strong',{},opName(s.op,L)),h('span',{class:'fine'},stepDetail(s,L,list,i))),
   h('span',{class:'mono fine','data-time':i}),
   h('button',{type:'button',class:'mk-adj','aria-expanded':open===i?'true':'false','aria-label':t(`${opName(s.op,'ko')} 설정 바꾸기`,`Adjust ${opName(s.op,'en')}`),onclick:()=>{S.rxOpen=open===i?null:i;S.sel=i;paintRemixSteps();paintView();}},t('조정','Adjust'))),
  open===i?h('div',{class:'mk-rx-set'},settingsFor(i,{compact:true}),h('label',{class:'mk-f row'},h('input',{type:'checkbox',checked:!s.off,onchange:()=>toggleStep(i)}),h('span',{},t('이 단계 쓰기','Use this step')))):null))));
 const sel=$('[data-final]',root),fit=lastFit();if(sel&&fit&&STICKER_FITS.includes(fit.p.preset))sel.value=fit.p.preset;
 paintAdapt();paintStatus();
}
function paintAdapt(){
 const ad=$('[data-adapt]',root);
 if(ad){ad.hidden=!S.adapt;if(S.adapt)ad.textContent=t(`원글은 ${S.adapt.from}였는데 내 이미지는 ${S.adapt.to}로 보여서 단계 ${S.adapt.step+1}만 자동으로 맞췄어요. 나머지는 원글 설정 그대로예요.`,`The original was ${S.adapt.from}; yours looks like ${S.adapt.to}, so only step ${S.adapt.step+1} adapted automatically. Everything else is the original's setting.`);}
}
/** Re-render a part without losing keyboard focus (a slider moved with the arrow keys rebuilds the panel). */
function keepFocus(fn){const id=document.activeElement?.id;fn();if(id){const el=document.getElementById(id);if(el&&el!==document.activeElement)el.focus({preventScroll:true});}}

// ---- consent (LEGAL §3.2) and posting
function consentBox(){
 return h('div',{class:'mk-consent','data-consent-box':'',hidden:true},
  h('strong',{'data-consent-title':''}),
  h('label',{},h('input',{type:'checkbox','data-consent':'',onchange:e=>{for(const c of $$('[data-consent]',root))c.checked=e.target.checked;}}),h('span',{},t('본인 사진이거나, 나온 사람 모두에게 허락을 받았어요 (성인만)','It is me, or everyone shown agreed (adults only)'))),
  h('span',{class:'mk-cnote'},t('얼굴 교체·몸 변형·옷 지우기 같은 단계는 이 사이트에 없어요.','There are no face swap, body reshape or clothing removal steps on this site.')));
}
function paintConsent(){
 for(const box of $$('[data-consent-box]',root)){
  // A face found in this browser, or a recipe with steps that change people (AI background removal,
  // AI upscaling) on a picture we could not check: ask.
  const people=S.face?.count>0,unknown=!S.face?.supported&&steps().some(s=>!s.off&&(s.op==='bg.remove'||s.op==='upscale'&&s.p.engine==='ai'));
  box.hidden=!(S.input&&(people||unknown));
  const ti=$('[data-consent-title]',box);if(ti)ti.textContent=people?t('사람 얼굴이 보여요','A face is visible'):t('사람이 나오나요?','Is there a person in it?');
 }
}
function postPanel(){
 const opts=CHANNELS.flatMap(([ch,name,flairs])=>flairs.map(([f,fn])=>h('option',{value:`${ch}/${f}`},`${name} · ${fn}`)));
 return h('section',{class:'mk-post',id:'mk-post','aria-labelledby':'mk-post-h'},
  h('h2',{id:'mk-post-h'},S.mode==='remix'?t('원글에 리믹스로 올리기','Post as a remix'):t('커뮤니티에 올리기','Post to the community')),
  h('form',{class:'mk-pf','data-post-form':'',onsubmit:e=>{e.preventDefault();submit(/** @type {HTMLFormElement} */(e.target));}},
   h('label',{class:'mk-f'},h('span',{},t('채널','Channel')),h('select',{name:'target'},opts)),
   h('label',{class:'mk-f'},h('span',{},t('제목','Title')),h('input',{name:'title',required:true,minlength:2,maxlength:100,autocomplete:'off',placeholder:t('예: 나노바나나 피규어로 LINE 스탬프 24개','e.g. 24 LINE stickers from a Nano Banana figure')})),
   h('label',{class:'mk-f'},h('span',{},t('만든 곳 · 프롬프트 (선택)','Made with · prompt (optional)')),h('select',{name:'generator'},GENERATORS.map(g=>h('option',{value:g},GENERATOR_NAMES[g][L]))),h('textarea',{name:'prompt',rows:3,maxlength:2000,placeholder:t('첨부한 캐릭터로 표정 24개를 6×4 격자에…','24 expressions of the attached character in a 6×4 grid…')})),
   h('details',{class:'mk-adv'},h('summary',{},t('설명 쓰기 (선택)','Add a description (optional)')),h('textarea',{name:'body',rows:4,maxlength:20000})),
   h('label',{class:'mk-f row top'},h('input',{type:'checkbox',name:'withRecipe',checked:true}),h('span',{},h('strong',{},t('레시피 같이 올리기','Share the recipe')),t(' — 다른 사람이 \'내 이미지로 해보기\'를 할 수 있어요',' — others can try it on their own image'))),
   h('label',{class:'mk-f row top'},h('input',{type:'checkbox',name:'consent','data-consent':'',required:true}),h('span',{},t('전연령이고, 실제 사람이 나오면 본인이거나 허락받은 성인이에요','All ages, and any real person is me or a consenting adult'))),
   h('div',{'data-anon':''}),
   h('p',{class:'fine','data-post-note':''},t('\'AI 생성\' 표시가 자동으로 붙어요','An “AI-generated” label is added automatically')),
   h('button',{type:'submit',class:'btn p mk-go'},S.mode==='remix'?t('리믹스로 올리기','Post remix'):t('올리기','Post'))));
}
function paintPost(){
 const f=$('[data-post-form]',root);if(!f)return;
 const fit=lastFit(),target=S.original?`${S.original.channel}/${CHANNELS.find(c=>c[0]===S.original.channel)?.[2][0][0]||'share'}`:DEFAULT_TARGET[fit?.p.preset]||(steps().some(s=>s.op==='pixel.snap'||s.op==='pixelize')?'pixel/fix':'pfp/share');
 const sel=f.elements.namedItem('target');if(sel&&!sel.dataset.touched){sel.value=target;sel.addEventListener('change',()=>{sel.dataset.touched='1';},{once:true});}
 if(S.original){const g=f.elements.namedItem('generator');if(g&&!g.dataset.touched&&GENERATORS.includes(S.original.generator))g.value=S.original.generator;}
 const anon=$('[data-anon]',f);
 if(anon&&S.st&&!S.st.signedIn&&S.st.anon?.enabled&&!anon.firstChild){const tpl=/** @type {HTMLTemplateElement} */($('#mk-anon'));if(tpl){anon.append(tpl.content.cloneNode(true));const box=$('[data-anon-fields]',anon);if(box)box.hidden=false;try{const n=$('input[name="anonName"]',anon);if(n&&!n.value)n.value=localStorage.getItem('n2-anon-name')||'';}catch{}}}
 const note=$('[data-post-note]',f);
 if(note&&S.st){note.textContent=t('\'AI 생성\' 표시가 자동으로 붙어요','An “AI-generated” label is added automatically')+(S.st.signedIn?'':S.st.anon?.enabled?t(' · 로그인 없이 올리면 닉네임 옆에 오늘의 ID가 붙어요',' · without an account your nickname shows today’s ID'):t(' · 올리려면 로그인이 필요해요',' · sign in to post'));}
}
function openPost(){
 const p=$('#mk-post',root);if(!p)return;p.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 setTimeout(()=>$('input[name="title"]',p)?.focus({preventScroll:true}),350);
}
/** A picture for the post: WebP (JPEG where the browser cannot), at most `side` px. */
async function postImage(data,w,h,side=1600){
 const s=Math.min(1,side/Math.max(w,h)),cw=Math.max(1,Math.round(w*s)),ch=Math.max(1,Math.round(h*s));
 const src=toCanvas(data,w,h),c=document.createElement('canvas');c.width=cw;c.height=ch;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(src,0,0,cw,ch);
 let b=await new Promise(r=>c.toBlob(r,'image/webp',.88));
 if(!b||b.type!=='image/webp'){g.globalCompositeOperation='destination-over';g.fillStyle='#fff';g.fillRect(0,0,cw,ch);b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));}
 return b;
}
/** The results side by side (up to 24) on one transparent sheet, for the post. */
function resultSheet(doc){
 const items=doc.items.slice(0,24),cols=Math.min(items.length,items.length>12?6:items.length>4?4:items.length),rows=Math.ceil(items.length/cols),cell=Math.min(360,Math.floor(1600/cols)),gap=Math.round(cell*.06);
 const W=cols*cell+(cols-1)*gap,H=rows*cell+(rows-1)*gap,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.imageSmoothingQuality='high';
 items.forEach((it,k)=>{const s=Math.min(cell/it.w,cell/it.h),w=Math.round(it.w*s),hh=Math.round(it.h*s),x=(k%cols)*(cell+gap)+Math.round((cell-w)/2),y=Math.floor(k/cols)*(cell+gap)+Math.round((cell-hh)/2);g.drawImage(toCanvas(it.frames[0].data,it.w,it.h),x,y,w,hh);});
 return g.getImageData(0,0,W,H);
}
async function submit(form){
 if(S.posting)return;
 const fd=new FormData(form),btn=$('button[type="submit"]',form);
 const title=String(fd.get('title')||'').trim();
 if(!S.input){toast(t('먼저 이미지를 올려 주세요','Add an image first'));return;}
 if(title.length<2){toast(t('제목을 써 주세요','Please add a title'));$('input[name="title"]',form)?.focus();return;}
 if(!fd.get('consent')){toast(t('전연령·실존 인물 확인에 체크해 주세요','Please confirm the all-ages / real-person box'));return;}
 const st=S.st||await api.state();S.st=st;
 if(!st.signedIn&&!st.anon?.enabled){toast(t('올리려면 로그인이 필요해요','Please sign in to post'));location.href=`/${L}/account/?return=${encodeURIComponent(location.pathname+location.search)}`;return;}
 let anon={};
 if(!st.signedIn){const pw=String(fd.get('anonPassword')||'');if(pw.length<4||pw.length>32){toast(t('비밀번호(4~32자)를 입력해 주세요. 나중에 수정·삭제할 때 필요해요.','Enter a password (4–32 characters) to edit or delete later.'));$('input[name="anonPassword"]',form)?.focus();return;}anon={name:String(fd.get('anonName')||'').trim()||undefined,password:pw};}
 if(!S.full){toast(t('원본 크기로 마무리하는 중이에요. 잠시만요.','Finishing at full size, one moment.'));await new Promise(r=>{const iv=setInterval(()=>{if(S.full||S.error){clearInterval(iv);r(null);}},150);});if(!S.full)return;}
 S.posting=true;btn.disabled=true;const label=btn.textContent;btn.textContent=t('올리는 중…','Posting…');
 try{
  // Images: the original and the results (both made on this device; re-encoding drops EXIF/GPS).
  const urls=[];
  if(st.uploads){
   const src=S.input.items[0],orig=await postImage(src.frames[0].data,src.w,src.h);
   const sheet=resultSheet(S.full.doc),res=await postImage(sheet.data,sheet.width,sheet.height);
   for(const [blob,alt] of [[orig,t('원본','Original')],[res,t('결과','Result')]]){const u=await api.upload(blob,st.anon?.siteKey||'');if(u?.error){toast(t('이미지를 올리지 못했어요','The image could not be uploaded'));return;}urls.push(`![${alt}](${u.url})`);}
  }
  const [channel,kind]=String(fd.get('target')).split('/');
  const withRecipe=!!fd.get('withRecipe');
  // What the author's picture actually had (an 'auto' sheet split records the grid it found).
  const rec=withRecipe?recordRecipe(String(fd.get('generator')),String(fd.get('prompt')||''),title):null;
  const desc=String(fd.get('body')||'').trim();
  const body=[desc,urls.join('\n'),rec?`${t('레시피','Recipe')}: ${summaryLine(rec,L)}`:''].filter(Boolean).join('\n\n')||title;
  const payload={channel,kind,tags:[],title,body,ai:true,consent:true,generator:String(fd.get('generator')),prompt:String(fd.get('prompt')||'').trim()||undefined,...(rec?{recipe:rec}:{}),...(S.mode==='remix'&&S.original?{remixOf:S.original.id}:{}),...anon};
  const r=await api.post(payload,st.anon?.siteKey||'');
  if(r?.error){toast(r.status===429?t('너무 빨라요. 1분 뒤에 다시 해 주세요.','Too fast. Please wait a minute.'):t(`올리지 못했어요: ${r.error}`,`Could not post: ${r.error}`));return;}
  try{if(anon.name!==undefined)localStorage.setItem('n2-anon-name',anon.name||'');sessionStorage.setItem('n2-toast',r.held?t('등록했어요. 운영자 확인 뒤에 보입니다.','Posted. It shows after a moderator checks it.'):t('등록했어요.','Posted.'));}catch{}
  if(r.url)location.href=r.url;else toast(t('등록했어요.','Posted.'));
 }finally{S.posting=false;btn.disabled=false;btn.textContent=label;}
}
function recordRecipe(generator,prompt,title){
 const list=steps().map(s=>{if(s.op==='sheet.split'&&s.p.mode==='auto'&&S.found)return {...s,p:{...s.p,cols:S.found.cols,rows:S.found.rows}};return s;});
 const it=S.full?.doc.items[0];
 const v=validateRecipe({schema:RECIPE_SCHEMA,title,source:{generator,prompt,ai:true},input:{expect:list.some(s=>s.op==='sheet.split'&&!s.off)?'sheet':'single'},steps:list,result:it?{w:it.w,h:it.h,frames:it.frames.length,count:S.full.doc.items.length}:undefined});
 return v.ok?v.recipe:null;
}

// ---------------------------------------------------------------- start
async function start(){
 if(!root)return;
 bindInput();
 api.state().then(st=>{S.st=st;paintPost();});
 if(S.mode==='remix'){
  const id=root.dataset.recipe;
  const got=await api.recipe(id);const v=got?validateRecipe(got.recipe):null;
  if(!got||!v?.ok){S.mode='work';toast(t('레시피를 불러오지 못했어요. 작업대로 열게요.','The recipe could not be loaded; opening the workbench.'));$('.mk-t',root).textContent=t('다듬기 작업대','Workbench');S.recipe=newRecipe([defaultStep('bg.remove')]);}
  else{
   S.original={id:got.id||id,title:got.title||v.recipe.title||'',channel:got.channel||'sticker',no:got.no,generator:got.generator||v.recipe.source.generator,author:got.author,url:got.channel&&got.no?`/${L}/community/${got.channel}/${got.no}`:null};
   S.recipe=v.recipe;
   // Before an image is picked: the original's steps, waiting.
   const drop=$('[data-drop]',root),will=$('[data-rx-preview]',drop)||drop.appendChild(h('div',{class:'mk-will'}));
   const list=v.recipe.steps.filter(s=>s.op!=='export'&&!s.off);
   will.replaceChildren(h('p',{class:'mk-rx-ph'},h('b',{},t('원글 레시피','The original recipe')),' ',t(`${list.length}단계`,`${list.length} steps`)),
    h('ol',{class:'mk-rx-steps'},list.map(s=>h('li',{class:'mk-rx-step'},h('div',{class:'mk-rx-row'},h('span',{class:'mk-dot wait'},'·'),h('span',{class:'mk-sn'},h('strong',{},opName(s.op,L)),h('span',{class:'fine'},stepDetail(s,L,v.recipe.steps,v.recipe.steps.indexOf(s)))))))));
   const back=h('p',{class:'mk-rx-orig'},h('a',{href:S.original.url||'#'},svg(ICON.back,15),t('원글: ','Original: '),S.original.title));drop.prepend(back);
  }
 }else{
  const p=root.dataset.preset?presetById(root.dataset.preset):null;
  S.recipe=p?newRecipe(p.recipe.steps):newRecipe([defaultStep('bg.remove')]);
 }
 S.status=steps().map(()=>({status:'wait'}));S.sel=lastReal();
 // Preset links on the empty workbench switch the recipe in place.
 for(const a of $$('[data-preset-link]',root))a.addEventListener('click',e=>{if(S.input){e.preventDefault();const p=presetById(a.dataset.presetLink);if(p)setRecipe(newRecipe(p.recipe.steps,S.recipe.source));}});
}
start();
