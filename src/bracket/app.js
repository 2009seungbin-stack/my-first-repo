// @ts-check
/** The /{l}/bracket/ page: names → draw (with a slot-machine reveal) → winners by tap or by a random pick
 * → champion. The prank rig (몰카용 조작) hides behind five taps on the title or Alt+Shift+R; a rigged
 * draw and a rigged pick look exactly like the plain ones. State stays in this browser (localStorage);
 * a share link carries title, size, names and, for "조작 링크", the rig (#b=…, removed from the address
 * once read so the person you sent it to does not see it change). */
import {SIZES,MAX_TITLE,parseNames,sizeProblem,fitSize,fateLabel,rigIndex,rigActive,emptyRig,draw,inOrder,newBoard,entrant,ready,nextMatch,champion,setWinner,pickWinner,roundsOf,encodeShare,decodeShare} from './engine.js';

const STORE='nerulio.bracket.v1';
const ko=document.documentElement.lang==='ko';
const T=ko?{
 count:(/** @type {number} */ n,/** @type {number} */ s)=>`${n}명 · ${s}강${s>n&&n>s/2?` (부전승 ${s-n})`:''}`,
 few:'2명 이상 넣으세요.',many:(/** @type {number} */ s,/** @type {number} */ f)=>f?`${s}강에는 ${s}명까지 들어갑니다. ${f}강을 고르세요.`:'32명까지 넣을 수 있어요.',sparse:(/** @type {number} */ s,/** @type {number} */ f)=>`${s}강은 ${s/2+1}명 이상 필요해요. ${f}강을 고르세요.`,
 round:(/** @type {number} */ s)=>s===2?'결승':`${s}강`,champ:'우승',bye:'부전승',name:'대진표',
 progress:(/** @type {number} */ d,/** @type {number} */ t)=>`${d} / ${t} 경기`,won:(/** @type {string} */ n)=>`우승 · ${n}`,copied:'링크를 복사했어요.',copyFail:'복사하지 못했어요. 주소를 길게 눌러 복사하세요.',
 rigFree:'자유',rigNone:'없음',rigVs:'첫 경기 상대',rigFate:'최종 결과',rigEmpty:'먼저 참가자 이름을 넣으세요.',rigOk:'이대로 추첨됩니다.',rigOff:'정한 결과가 없어요. 평소처럼 랜덤입니다.',
 rigBad:'이 조합은 대진표에서 나올 수 없어요. 결과나 맞대결을 바꿔 보세요.',rigRedraw:'지금 대진에는 아직 반영 안 됐어요. 저장 후 「다시 추첨」을 누르세요.',rigSize:'참가자 수와 대진 크기를 먼저 맞추세요.',
 noUndo:'되돌릴 게 없어요.',done:'경기가 모두 끝났어요.',
}:{
 count:(/** @type {number} */ n,/** @type {number} */ s)=>`${n} players · ${s}-bracket${s>n&&n>s/2?` (${s-n} byes)`:''}`,
 few:'Add at least 2 names.',many:(/** @type {number} */ s,/** @type {number} */ f)=>f?`A ${s}-bracket holds ${s}. Pick ${f}.`:'Up to 32 players.',sparse:(/** @type {number} */ s,/** @type {number} */ f)=>`A ${s}-bracket needs ${s/2+1}+ players. Pick ${f}.`,
 round:(/** @type {number} */ s)=>s===2?'Final':s===4?'Semis':s===8?'Quarters':`Last ${s}`,champ:'Champion',bye:'Bye',name:'Bracket',
 progress:(/** @type {number} */ d,/** @type {number} */ t)=>`${d} / ${t} matches`,won:(/** @type {string} */ n)=>`Champion · ${n}`,copied:'Link copied.',copyFail:'Could not copy. Copy the address by hand.',
 rigFree:'Free',rigNone:'None',rigVs:'First opponent',rigFate:'Finish',rigEmpty:'Add the player names first.',rigOk:'The draw will follow this.',rigOff:'Nothing set. Draws are random as usual.',
 rigBad:'No bracket can produce this. Change a finish or a pairing.',rigRedraw:'Not applied to the current bracket yet. Save, then press “Draw again”.',rigSize:'Fix the player count and bracket size first.',
 noUndo:'Nothing to undo.',done:'All matches are played.',
};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep=(/** @type {number} */ ms)=>new Promise(r=>setTimeout(r,reduce?0:ms));

/** @typedef {import('./engine.js').Rig} Rig @typedef {import('./engine.js').Board} Board */
/** @typedef {{title:string,size:number,text:string,rig:Rig,names:string[],board:Board|null}} State */

/** @param {HTMLElement} root */
export function mountBracket(root){
 const $=(/** @type {string} */ s)=>/** @type {any} */(root.querySelector(s));
 const form=/** @type {HTMLFormElement} */($('[data-bk-form]')),boardBox=$('[data-bk-board]'),tree=$('[data-bk-tree]'),status=$('[data-bk-status]'),count=$('[data-bk-count]');
 const dlg=/** @type {HTMLDialogElement} */($('[data-bk-rig]')),toast=$('[data-bk-toast]');
 /** @type {State} */
 let st={title:'',size:16,text:'',rig:emptyRig(),names:[],board:null};
 /** @type {string[]} */
 let undo=[];let busy=false;
 try{const s=JSON.parse(localStorage.getItem(STORE)||'null');if(s&&typeof s==='object')st={...st,...s,rig:{fate:{...s.rig?.fate},pair:{...s.rig?.pair}}};}catch{}
 // A shared link replaces what this browser had, then leaves the address bar.
 const m=/^#b=([\w-]+)$/.exec(location.hash);
 if(m){const d=decodeShare(m[1]);if(d)st={title:d.title,size:d.size,text:d.names.join('\n'),rig:d.rig,names:[],board:null};history.replaceState(null,'',location.pathname+location.search);}
 if(!SIZES.includes(st.size))st.size=16;
 if(st.board&&!validBoard(st.board,st.names))st.board=null;
 const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(st));}catch{}};

 // The form.
 const el=/** @type {any} */(form.elements);
 el.title.value=st.title;el.names.value=st.text;for(const r of form.querySelectorAll('input[name=size]'))/** @type {HTMLInputElement} */(r).checked=Number(/** @type {HTMLInputElement} */(r).value)===st.size;
 $('[data-bk-enable]').disabled=false;
 const names=()=>parseNames(el.names.value);
 function showCount(){
  const n=names().length,p=sizeProblem(n,st.size);
  count.textContent=!n?'':p==='few'?T.few:p==='many'?T.many(st.size,fitSize(n)):p==='sparse'?T.sparse(st.size,fitSize(n)):T.count(n,st.size);
  count.classList.toggle('bad',!!(n&&p));
  // The host's tell: a dot after the count while results are set in advance.
  if(rigActive(liveRig())){const d=document.createElement('span');d.className='bk-dot';d.setAttribute('aria-hidden','true');count.append(d);}
 }
 /** The rig for the names in the box right now. */
 const liveRig=()=>{const ns=new Set(names()),r=emptyRig();for(const [k,v] of Object.entries(st.rig.fate))if(ns.has(k))r.fate[k]=v;for(const [k,v] of Object.entries(st.rig.pair))if(ns.has(k)&&ns.has(v))r.pair[k]=v;return r;};
 const onEdit=()=>{st.title=el.title.value.slice(0,MAX_TITLE);st.text=el.names.value;const s=Number(new FormData(form).get('size'));if(SIZES.includes(s))st.size=s;showCount();save();};
 form.addEventListener('input',onEdit);form.addEventListener('change',onEdit);
 form.addEventListener('submit',e=>{e.preventDefault();start(false);});
 $('[data-bk-order]').addEventListener('click',()=>start(true));
 $('[data-bk-sample]').addEventListener('click',()=>{const pool=ko?['민수','지영','현우','서연','도윤','하은','준호','수아','태민','예린','시우','지호','유나','건우','채원','은우','다인','승민','소율','재원','하린','민재','나연','우진','서진','라희','도현','아린','윤호','지안','태오','세아']:['Alex','Sam','Riley','Jordan','Taylor','Casey','Morgan','Jamie','Avery','Quinn','Drew','Reese','Parker','Rowan','Skyler','Emery','Blake','Cameron','Dakota','Hayden','Jesse','Kai','Logan','Micah','Noel','Oakley','Peyton','Remy','Sage','Tatum','Val','Wren'];el.names.value=pool.slice(0,st.size).join('\n');form.dispatchEvent(new Event('input'));});
 $('[data-bk-clear]').addEventListener('click',()=>{el.names.value='';form.dispatchEvent(new Event('input'));el.names.focus();});

 /** Draw a new first round from the names in the box. @param {boolean} keepOrder */
 async function start(keepOrder){
  if(busy)return;
  const ns=names(),p=sizeProblem(ns.length,st.size);
  if(p){showCount();el.names.focus();return;}
  const slots=keepOrder?inOrder(ns.length,st.size):draw(ns.length,st.size,rigIndex(ns,st.size,liveRig())).slots;
  st.names=ns;st.board=newBoard(slots);undo=[];save();
  boardBox.hidden=false;render();
  boardBox.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  if(!keepOrder)await reveal();
 }

 // The board.
 const R=()=>roundsOf(/** @type {Board} */(st.board).slots.length);
 const nameOf=(/** @type {number} */ i)=>st.names[i]??'';
 /** @param {number} r @param {number} i */
 function slot(r,i){
  const b=/** @type {Board} */(st.board),R0=R(),e=r===R0?b.win[R0-1][0]:entrant(b,r,i),btn=document.createElement('button');
  btn.type='button';btn.className='bk-s';btn.dataset.r=String(r);btn.dataset.i=String(i);
  const waiting=r>0&&e<0;
  if(r===R0){btn.classList.add('champ');btn.disabled=true;}
  if(e>=0){btn.textContent=nameOf(e);btn.title=nameOf(e);}else if(!waiting){btn.textContent=T.bye;btn.classList.add('bye');btn.disabled=true;}else{btn.disabled=true;btn.classList.add('wait');}
  if(r<R0&&e>=0){const w=b.win[r][i>>1];if(w>=0)btn.classList.add(w===e?'won':'lost');else if(ready(b,r,i>>1))btn.classList.add('ready');else btn.disabled=true;}
  return btn;
 }
 /** @param {number} r @param {number} i @param {'l'|'r'} side @returns {HTMLElement} */
 function node(r,i,side){
  if(r===0){const leaf=document.createElement('div');leaf.className='bk-leaf';leaf.append(slot(0,i));return leaf;}
  const n=document.createElement('div'),kids=document.createElement('div'),j=document.createElement('div');
  n.className='bk-n'+(side==='r'?' r':'');kids.className='bk-kids';j.className='bk-j'+(/** @type {Board} */(st.board).win[r-1][i]>=0?' done':'');
  kids.append(node(r-1,2*i,side),node(r-1,2*i+1,side));n.append(kids,j,slot(r,i));return n;
 }
 function render(){
  const b=st.board;if(!b){boardBox.hidden=true;return;}
  boardBox.hidden=false;
  const R0=R(),size=b.slots.length;
  $('[data-bk-name]').textContent=st.title||T.name;
  const head=document.createElement('div');head.className='bk-labels';head.setAttribute('aria-hidden','true');
  const lab=(/** @type {string} */ t,/** @type {string} */ c)=>{const s=document.createElement('span');s.className=c;s.textContent=t;return s;};
  const levels=[...Array(R0).keys()].map(r=>T.round(size>>r));
  head.append(...levels.map(t=>lab(t,'bk-l')),lab(T.champ,'bk-l c'),...levels.slice().reverse().map(t=>lab(t,'bk-l')));
  const body=document.createElement('div');body.className='bk-body';
  const center=document.createElement('div');center.className='bk-c';
  const cup=document.createElement('span');cup.className='bk-cup';cup.setAttribute('aria-hidden','true');cup.innerHTML='<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4.5h8v5.5a4 4 0 0 1-8 0Z"/><path d="M8 6.5H5v1.5a3 3 0 0 0 3 3M16 6.5h3v1.5a3 3 0 0 1-3 3M12 14v3.5M8.5 20.5h7M9.5 17.5h5"/></svg>';
  center.append(cup,slot(R0,0));
  body.append(node(R0-1,0,'l'),center,node(R0-1,1,'r'));
  tree.replaceChildren(head,body);
  const total=size-b.slots.filter(x=>x<0).length-1,played=b.win.flat().filter(x=>x>=0).length-b.slots.filter(x=>x<0).length,c=champion(b);
  status.textContent=c>=0?T.won(nameOf(c)):T.progress(played,total);
  for(const k of ['next','round','auto'])$(`[data-bk-${k}]`).disabled=c>=0||busy;
  $('[data-bk-undo]').disabled=!undo.length||busy;$('[data-bk-redraw]').disabled=busy;
  fit();
 }
 const snap=()=>{undo.push(JSON.stringify(st.board));if(undo.length>200)undo.shift();};
 tree.addEventListener('click',(/** @type {MouseEvent} */ e)=>{
  const t=/** @type {HTMLElement|null} */(/** @type {HTMLElement} */(e.target).closest('.bk-s'));
  if(!t||busy||!st.board)return;
  const r=Number(t.dataset.r),i=Number(t.dataset.i),b=st.board;if(r>=R())return;
  const w=entrant(b,r,i);if(w<0||b.win[r][i>>1]===w)return;
  snap();if(setWinner(b,r,i>>1,w)){save();render();pop(r+1,i>>1);celebrate();}else undo.pop();
 });

 /** The slot-machine reveal of a fresh draw: every first-round slot flickers through the names, then
 * they stop one after another on the drawn order. */
 async function reveal(){
  if(reduce)return;
  busy=true;render();
  const leaves=/** @type {HTMLButtonElement[]} */([...tree.querySelectorAll('.bk-s[data-r="0"]')]),final=leaves.map(x=>x.textContent),pool=st.names;
  leaves.forEach(x=>x.classList.add('spin'));
  const stopAt=leaves.map((_,k)=>700+k*(900/leaves.length));
  for(let t=0;t<=1700;t+=70){
   leaves.forEach((x,k)=>{if(t<stopAt[k])x.textContent=pool[Math.floor(Math.random()*pool.length)];else if(x.classList.contains('spin')){x.classList.remove('spin');x.textContent=final[k];x.classList.add('land');}});
   await sleep(70);
  }
  busy=false;render();
 }
 /** Flicker between the two players of a match and stop on the winner. @param {number} r @param {number} mi @param {number} w @param {number} speed */
 async function spinMatch(r,mi,w,speed){
  const b=/** @type {Board} */(st.board),a=entrant(b,r,2*mi);
  const sa=tree.querySelector(`.bk-s[data-r="${r}"][data-i="${2*mi}"]`),sb=tree.querySelector(`.bk-s[data-r="${r}"][data-i="${2*mi+1}"]`);
  if(sa&&sb&&!reduce){
   const steps=[60,60,70,70,80,95,115,140,175,220,280];
   // Land on the winner: the highlight alternates a, b, a … so the count's parity picks who it stops on.
   const n=steps.length+((steps.length%2===1)===(w===a)?0:1);
   for(let k=0;k<n;k++){sa.classList.toggle('hot',k%2===0);sb.classList.toggle('hot',k%2===1);await sleep((steps[k]??300)*speed);}
   await sleep(260*speed);
  }
  snap();setWinner(b,r,mi,w);save();render();pop(r+1,mi);
 }
 /** @param {number} r @param {number} i */
 function pop(r,i){const s=tree.querySelector(`.bk-s[data-r="${r}"][data-i="${i}"]`);if(s&&!reduce){s.classList.add('pop');}}
 const fate=()=>rigIndex(st.names,/** @type {Board} */(st.board).slots.length,liveRigFor(st.names)).fate;
 /** The rig for the names on the board (they can differ from the box after editing). @param {string[]} ns */
 const liveRigFor=ns=>{const set=new Set(ns),r=emptyRig();for(const [k,v] of Object.entries(st.rig.fate))if(set.has(k))r.fate[k]=v;return r;};
 /** Play matches with the random pick. @param {'next'|'round'|'auto'} mode */
 async function play(mode){
  if(busy||!st.board)return;
  const b=st.board,first=nextMatch(b);if(!first){toastMsg(T.done);return;}
  busy=true;render();
  try{
   for(let at=first;at;at=nextMatch(b)){
    if(mode==='round'&&at.r!==first.r)break;
    await spinMatch(at.r,at.m,pickWinner(b,at.r,at.m,fate()),mode==='next'?1:mode==='round'?.6:.45);
    if(mode==='next')break;
    await sleep(mode==='auto'?220:160);
   }
  }finally{busy=false;render();celebrate();}
 }
 $('[data-bk-next]').addEventListener('click',()=>play('next'));
 $('[data-bk-round]').addEventListener('click',()=>play('round'));
 $('[data-bk-auto]').addEventListener('click',()=>play('auto'));
 $('[data-bk-undo]').addEventListener('click',()=>{if(busy)return;const s=undo.pop();if(!s){toastMsg(T.noUndo);return;}st.board=JSON.parse(s);save();render();});
 $('[data-bk-redraw]').addEventListener('click',()=>start(false));
 $('[data-bk-print]').addEventListener('click',()=>print());
 $('[data-bk-link]').addEventListener('click',()=>copy(link(false)));

 let celebrated=-1;
 function celebrate(){
  const c=st.board?champion(st.board):-1;if(c<0){celebrated=-1;return;}
  if(c===celebrated||reduce)return;celebrated=c;
  const box=document.createElement('div');box.className='bk-confetti';box.setAttribute('aria-hidden','true');
  const colors=['#c6f24e','#3d6608','#e3b75c','#5b3fc4','#c4411d','#15171a'];
  for(let k=0;k<48;k++){const s=document.createElement('i');s.style.left=Math.random()*100+'%';s.style.background=colors[k%colors.length];s.style.animationDelay=Math.random()*.4+'s';s.style.setProperty('--dx',(Math.random()*120-60)+'px');s.style.setProperty('--rot',(Math.random()*720-360)+'deg');box.append(s);}
  boardBox.append(box);setTimeout(()=>box.remove(),2600);
 }

 // Full screen (a TV or a projector): the bracket scales to fill the screen.
 $('[data-bk-full]').addEventListener('click',()=>{
  if(document.fullscreenElement){document.exitFullscreen();return;}
  if(boardBox.requestFullscreen)boardBox.requestFullscreen().catch(()=>boardBox.classList.toggle('max'));else boardBox.classList.toggle('max');
 });
 /** Fit the bracket to its box: shrink a little on a desktop column (a phone scrolls instead, names stay
 * readable), and fill the screen in full-screen view. */
 function fit(){
  const full=document.fullscreenElement===boardBox||boardBox.classList.contains('max'),sc=$('[data-bk-scroll]');
  tree.style.transform='';tree.style.height='';sc.classList.remove('fit');
  const w=tree.scrollWidth,h=tree.scrollHeight,avail=sc.clientWidth;
  let k=1;
  if(full)k=Math.min((avail-8)/w,(innerHeight-sc.getBoundingClientRect().top-24)/h,3);
  else if(w>avail&&avail/w>=.7)k=avail/w;
  if(k>0&&k!==1){sc.classList.add('fit');tree.style.transform=`translateX(${Math.max(0,(avail-w*k)/2)}px) scale(${k})`;tree.style.height=h*k+'px';}
 }
 document.addEventListener('fullscreenchange',fit);addEventListener('resize',fit);
 addEventListener('keydown',e=>{if(e.key==='Escape'&&boardBox.classList.contains('max')){boardBox.classList.remove('max');fit();}});

 // Links and the toast.
 /** @param {boolean} rigged */
 const link=rigged=>`${location.origin}${location.pathname}#b=${encodeShare({title:st.title,size:st.size,names:names(),rig:rigged?liveRig():null})}`;
 /** @param {string} s */
 async function copy(s){
  try{await navigator.clipboard.writeText(s);toastMsg(T.copied);return;}catch{}
  const i=document.createElement('textarea');i.value=s;i.setAttribute('readonly','');i.style.position='fixed';i.style.opacity='0';document.body.append(i);i.select();
  let ok=false;try{ok=document.execCommand('copy');}catch{}i.remove();toastMsg(ok?T.copied:T.copyFail);
 }
 let toastTimer=0;
 /** @param {string} s */
 function toastMsg(s){toast.textContent=s;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2200);}

 // The hidden rig: five quick taps on the title or the trophy, or Alt+Shift+R.
 let taps=0,tapTimer=0;
 for(const s of root.querySelectorAll('[data-bk-secret]'))s.addEventListener('click',()=>{taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>{taps=0;},1500);if(taps>=5){taps=0;openRig();}});
 addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyR'){e.preventDefault();openRig();}});
 const list=$('[data-bk-rig-list]'),msg=$('[data-bk-rig-msg]');
 /** @type {Rig} */
 let draft=emptyRig();
 function openRig(){
  if(dlg.open)return;
  draft=liveRig();buildRig();
  if(dlg.showModal)dlg.showModal();else dlg.setAttribute('open','');
 }
 function buildRig(){
  const ns=names(),R0=roundsOf(st.size);list.replaceChildren();
  if(!ns.length){msg.textContent=T.rigEmpty;return;}
  const head=document.createElement('div');head.className='bk-rr bk-rh';head.innerHTML='<span></span><span></span><span></span>';
  head.children[1].textContent=T.rigFate;head.children[2].textContent=T.rigVs;list.append(head);
  for(const n of ns){
   const row=document.createElement('div');row.className='bk-rr';
   const who=document.createElement('span');who.className='bk-rn';who.textContent=n;
   const f=document.createElement('select');f.dataset.name=n;f.dataset.kind='fate';f.setAttribute('aria-label',`${n} · ${T.rigFate}`);
   f.append(new Option(T.rigFree,''),...[...Array(R0+1).keys()].map(d=>new Option(fateLabel(d,st.size,ko?'ko':'en'),String(d))));
   f.value=draft.fate[n]!==undefined&&draft.fate[n]<=R0?String(draft.fate[n]):'';
   const p=document.createElement('select');p.dataset.name=n;p.dataset.kind='pair';p.setAttribute('aria-label',`${n} · ${T.rigVs}`);
   p.append(new Option(T.rigNone,''),...ns.filter(x=>x!==n).map(x=>new Option(x,x)));p.value=draft.pair[n]||'';
   row.append(who,f,p);list.append(row);
  }
  checkRig();
 }
 list.addEventListener('change',(/** @type {Event} */ e)=>{
  const s=/** @type {HTMLSelectElement} */(e.target),n=/** @type {string} */(s.dataset.name);
  if(s.dataset.kind==='fate'){if(s.value==='')delete draft.fate[n];else draft.fate[n]=Number(s.value);}
  else{
   // Pairs go both ways: the old partners of both players are freed first.
   for(const x of [n,s.value,draft.pair[n]])if(x&&draft.pair[x]){delete draft.pair[draft.pair[x]];delete draft.pair[x];}
   if(s.value){draft.pair[n]=s.value;draft.pair[s.value]=n;}
   for(const o of list.querySelectorAll('select[data-kind=pair]'))/** @type {HTMLSelectElement} */(o).value=draft.pair[/** @type {string} */(/** @type {HTMLSelectElement} */(o).dataset.name)]||'';
  }
  checkRig();
 });
 /** Can a draw make the draft happen? Shows why not. */
 function checkRig(){
  const ns=names();
  if(!ns.length){msg.textContent=T.rigEmpty;msg.className='bk-rig-msg';return true;}
  if(!rigActive(draft)){msg.textContent=T.rigOff;msg.className='bk-rig-msg';return true;}
  if(sizeProblem(ns.length,st.size)){msg.textContent=T.rigSize;msg.className='bk-rig-msg bad';return false;}
  const ok=draw(ns.length,st.size,rigIndex(ns,st.size,draft)).ok;
  msg.textContent=ok?(st.board?`${T.rigOk} ${T.rigRedraw}`:T.rigOk):T.rigBad;msg.className='bk-rig-msg'+(ok?' ok':' bad');
  return ok;
 }
 $('[data-bk-rig-ok]').addEventListener('click',(/** @type {Event} */ e)=>{if(!checkRig()){e.preventDefault();return;}commitRig();});
 $('[data-bk-rig-reset]').addEventListener('click',()=>{draft=emptyRig();buildRig();});
 $('[data-bk-rig-link]').addEventListener('click',()=>{if(!checkRig())return;commitRig();copy(link(true));});
 function commitRig(){
  // Keep what was set for names that are not in the box right now (they may come back).
  const ns=new Set(names()),keep=emptyRig();
  for(const [k,v] of Object.entries(st.rig.fate))if(!ns.has(k))keep.fate[k]=v;
  for(const [k,v] of Object.entries(st.rig.pair))if(!ns.has(k)&&!ns.has(v))keep.pair[k]=v;
  st.rig={fate:{...keep.fate,...draft.fate},pair:{...keep.pair,...draft.pair}};save();showCount();
 }

 showCount();render();
 document.documentElement.dataset.bracketReady='1';
}

/** A stored board still fits its names. @param {any} b @param {string[]} names */
function validBoard(b,names){
 try{
  if(!b||!Array.isArray(b.slots)||!SIZES.includes(b.slots.length)||!Array.isArray(b.win)||b.win.length!==roundsOf(b.slots.length))return false;
  const ok=(/** @type {any} */ x)=>Number.isInteger(x)&&x>=-1&&x<names.length;
  return b.slots.every(ok)&&b.win.every((/** @type {any} */ r,/** @type {number} */ k)=>Array.isArray(r)&&r.length===b.slots.length>>(k+1)&&r.every(ok));
 }catch{return false;}
}
