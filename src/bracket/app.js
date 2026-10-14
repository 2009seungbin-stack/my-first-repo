// @ts-check
/** The /{l}/bracket/ page: names → draw (with a slot-machine reveal) → winners by tap or by a random pick
 * → champion. The organiser's seating panel (대진 배치) opens from five taps on the title or Alt+Shift+R and
 * is built here, not in the page HTML. A seated draw looks and animates like any other. State stays in this
 * browser; the seating is stored packed. A share link (#b=…) leaves the address bar once read.
 * With "신호 줄 때만" (cue) the seating waits: draws are random until two quick taps on the trophy
 * (or Alt+Shift+A) arm it for the following draws; the same signal disarms it. Phones confirm with a
 * vibration. The FAQ on the page states that these prank features exist. */
import {SIZES,MAX_TITLE,parseNames,sizeProblem,fitSize,planActive,emptyPlan,drawPlan,pairIndex,pairsFit,fitSeats,seatNames,inOrder,newBoard,entrant,ready,nextMatch,champion,setWinner,pickWinner,roundsOf,encodeShare,decodeShare,pack,unpack,cleanPlan,planData} from './engine.js';

const STORE='nerulio.bracket.v1';
const ko=document.documentElement.lang==='ko';
const T=ko?{
 count:(/** @type {number} */ n,/** @type {number} */ s)=>`${n}명 · ${s}강${s>n&&n>s/2?` (부전승 ${s-n})`:''}`,
 few:'2명 이상 넣으세요.',many:(/** @type {number} */ s,/** @type {number} */ f)=>f?`${s}강에는 ${s}명까지 들어갑니다. ${f}강을 고르세요.`:'32명까지 넣을 수 있어요.',sparse:(/** @type {number} */ s,/** @type {number} */ f)=>`${s}강은 ${s/2+1}명 이상 필요해요. ${f}강을 고르세요.`,
 round:(/** @type {number} */ s)=>s===2?'결승':`${s}강`,champ:'우승',bye:'부전승',name:'대진표',
 progress:(/** @type {number} */ d,/** @type {number} */ t)=>`${d} / ${t} 경기`,won:(/** @type {string} */ n)=>`우승 · ${n}`,copied:'링크를 복사했어요.',copyFail:'복사하지 못했어요. 주소를 길게 눌러 복사하세요.',
 noUndo:'되돌릴 게 없어요.',done:'경기가 모두 끝났어요.',
 ed:'대진 배치',modes:[['','랜덤'],['pairs','첫 상대만'],['fixed','전체 배치']],
 help:{'':'평소처럼 무작위로 추첨합니다.',pairs:'정한 두 사람은 첫 경기에서 만나고, 나머지는 무작위입니다.',fixed:'붙어 있는 두 경기의 승자끼리 다음 라운드에서 만나고, 같은 쪽 승자끼리 4강에서 만납니다. 추첨할 때마다 자리 모양은 바뀌어도 만나는 상대는 그대로입니다.'},
 vsHead:'첫 경기 상대',none:'없음',left:'왼쪽',right:'오른쪽',match:(/** @type {number} */ k)=>`${k}경기`,
 save:'저장',shuffle:'섞기',fromBoard:'지금 대진 가져오기',link:'이 배치로 링크 복사',close:'닫기',
 empty:'먼저 참가자 이름을 넣으세요.',sizeBad:'참가자 수와 대진 크기를 먼저 맞추세요.',twoByes:'한 경기에 부전승이 둘이면 안 돼요.',tooManyPairs:'부전승 자리 때문에 짝을 이만큼 넣을 수 없어요.',
 saved:'저장했어요.',redraw:'저장 후 「다시 추첨」을 누르면 반영돼요.',
 cue:'신호 줄 때만 적용',cueHelp:'평소엔 진짜 랜덤으로 추첨됩니다. 트로피 아이콘을 빠르게 두 번 누르면(PC: Alt+Shift+A) 다음 추첨부터 이 배치가 나오고, 다시 두 번 누르면 랜덤으로 돌아갑니다. 휴대폰은 짧은 진동 한 번(켜짐)·두 번(꺼짐)으로 알려 줍니다. 새로고침하면 꺼집니다.',
}:{
 count:(/** @type {number} */ n,/** @type {number} */ s)=>`${n} players · ${s}-bracket${s>n&&n>s/2?` (${s-n} byes)`:''}`,
 few:'Add at least 2 names.',many:(/** @type {number} */ s,/** @type {number} */ f)=>f?`A ${s}-bracket holds ${s}. Pick ${f}.`:'Up to 32 players.',sparse:(/** @type {number} */ s,/** @type {number} */ f)=>`A ${s}-bracket needs ${s/2+1}+ players. Pick ${f}.`,
 round:(/** @type {number} */ s)=>s===2?'Final':s===4?'Semis':s===8?'Quarters':`Last ${s}`,champ:'Champion',bye:'Bye',name:'Bracket',
 progress:(/** @type {number} */ d,/** @type {number} */ t)=>`${d} / ${t} matches`,won:(/** @type {string} */ n)=>`Champion · ${n}`,copied:'Link copied.',copyFail:'Could not copy. Copy the address by hand.',
 noUndo:'Nothing to undo.',done:'All matches are played.',
 ed:'Seating',modes:[['','Random'],['pairs','First opponents'],['fixed','Every seat']],
 help:{'':'Draws are random as usual.',pairs:'Paired players meet in their first match; everyone else is random.',fixed:'Winners of neighbouring matches meet next, and each side’s winners meet in the semis. Every draw looks different, but who meets whom stays.'},
 vsHead:'First opponent',none:'None',left:'Left',right:'Right',match:(/** @type {number} */ k)=>`Match ${k}`,
 save:'Save',shuffle:'Shuffle',fromBoard:'Use current bracket',link:'Copy link with seating',close:'Close',
 empty:'Add the player names first.',sizeBad:'Fix the player count and bracket size first.',twoByes:'A match cannot have two byes.',tooManyPairs:'Too many pairs for the byes in this bracket.',
 saved:'Saved.',redraw:'Save, then press “Draw again” to apply it.',
 cue:'Only on signal',cueHelp:'Draws stay truly random. Two quick taps on the trophy (PC: Alt+Shift+A) apply this seating from the next draw; two more taps go back to random. Phones vibrate once (on) or twice (off). Reloading turns it off.',
};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep=(/** @type {number} */ ms)=>new Promise(r=>setTimeout(r,reduce?0:ms));

/** @typedef {import('./engine.js').Plan} Plan @typedef {import('./engine.js').Board} Board */
/** @typedef {{title:string,size:number,text:string,plan:Plan,names:string[],board:Board|null}} State */

/** @param {HTMLElement} root */
export function mountBracket(root){
 const $=(/** @type {string} */ s)=>/** @type {any} */(root.querySelector(s));
 const form=/** @type {HTMLFormElement} */($('[data-bk-form]')),boardBox=$('[data-bk-board]'),tree=$('[data-bk-tree]'),status=$('[data-bk-status]'),count=$('[data-bk-count]'),toast=$('[data-bk-toast]');
 /** @type {State} */
 let st={title:'',size:16,text:'',plan:emptyPlan(),names:[],board:null};
 /** @type {string[]} */
 let undo=[];let busy=false;
 // The signal for a seating that waits (cue): in memory only, so a reload is always random again.
 let armed=false;
 try{const s=JSON.parse(localStorage.getItem(STORE)||'null');if(s&&typeof s==='object')st={title:String(s.title||''),size:Number(s.size)||16,text:String(s.text||''),names:Array.isArray(s.names)?s.names.map(String):[],board:s.board||null,plan:cleanPlan(unpack(s.x||''))};}catch{}
 // A shared link replaces what this browser had, then leaves the address bar.
 const m=/^#b=([\w-]+)$/.exec(location.hash);
 if(m){const d=decodeShare(m[1]);if(d)st={title:d.title,size:d.size,text:d.names.join('\n'),plan:d.plan,names:[],board:null};history.replaceState(null,'',location.pathname+location.search);}
 if(!SIZES.includes(st.size))st.size=16;
 if(st.board&&!validBoard(st.board,st.names))st.board=null;
 const save=()=>{try{localStorage.setItem(STORE,JSON.stringify({title:st.title,size:st.size,text:st.text,names:st.names,board:st.board,x:pack(planData(st.plan))}));}catch{}};

 // The form.
 const el=/** @type {any} */(form.elements);
 el.title.value=st.title;el.names.value=st.text;for(const r of form.querySelectorAll('input[name=size]'))/** @type {HTMLInputElement} */(r).checked=Number(/** @type {HTMLInputElement} */(r).value)===st.size;
 $('[data-bk-enable]').disabled=false;
 const names=()=>parseNames(el.names.value);
 function showCount(){
  const n=names().length,p=sizeProblem(n,st.size);
  count.textContent=!n?'':p==='few'?T.few:p==='many'?T.many(st.size,fitSize(n)):p==='sparse'?T.sparse(st.size,fitSize(n)):T.count(n,st.size);
  count.classList.toggle('bad',!!(n&&p));
 }
 const onEdit=()=>{st.title=el.title.value.slice(0,MAX_TITLE);st.text=el.names.value;const s=Number(new FormData(form).get('size'));if(SIZES.includes(s))st.size=s;showCount();save();};
 form.addEventListener('input',onEdit);form.addEventListener('change',onEdit);
 form.addEventListener('submit',e=>{e.preventDefault();start(false);});
 $('[data-bk-order]').addEventListener('click',()=>start(true));
 $('[data-bk-sample]').addEventListener('click',()=>{const pool=ko?['민수','지영','현우','서연','도윤','하은','준호','수아','태민','예린','시우','지호','유나','건우','채원','은우','다인','승민','소율','재원','하린','민재','나연','우진','서진','라희','도현','아린','윤호','지안','태오','세아']:['Alex','Sam','Riley','Jordan','Taylor','Casey','Morgan','Jamie','Avery','Quinn','Drew','Reese','Parker','Rowan','Skyler','Emery','Blake','Cameron','Dakota','Hayden','Jesse','Kai','Logan','Micah','Noel','Oakley','Peyton','Remy','Sage','Tatum','Val','Wren'];el.names.value=pool.slice(0,st.size).join('\n');onEdit();});
 $('[data-bk-clear]').addEventListener('click',()=>{el.names.value='';onEdit();el.names.focus();});

 /** Draw a new first round from the names in the box. @param {boolean} keepOrder */
 async function start(keepOrder){
  if(busy)return;
  const ns=names(),p=sizeProblem(ns.length,st.size);
  if(p){showCount();el.names.focus();return;}
  st.names=ns;st.board=newBoard(keepOrder?inOrder(ns.length,st.size):drawPlan(ns,st.size,st.plan.cue&&!armed?null:st.plan));undo=[];save();
  boardBox.hidden=false;render();
  boardBox.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
  if(!keepOrder)await reveal();
 }

 // The board.
 const R=()=>roundsOf(/** @type {Board} */(st.board).slots.length);
 const nameOf=(/** @type {number} */ i)=>st.names[i]??'';
 /** @param {number} r @param {number} i */
 function slot(r,i){
  const b=/** @type {Board} */(st.board),R0=R(),e=entrant(b,r,i),btn=document.createElement('button');
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
 /** Play matches with the random pick. @param {'next'|'round'|'auto'} mode */
 async function play(mode){
  if(busy||!st.board)return;
  const b=st.board,first=nextMatch(b);if(!first){toastMsg(T.done);return;}
  busy=true;render();
  try{
   for(let at=first;at;at=nextMatch(b)){
    if(mode==='round'&&at.r!==first.r)break;
    await spinMatch(at.r,at.m,pickWinner(b,at.r,at.m),mode==='next'?1:mode==='round'?.6:.45);
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
 /** @param {boolean} withPlan */
 const link=withPlan=>`${location.origin}${location.pathname}#b=${encodeShare({title:st.title,size:st.size,names:names(),plan:withPlan?st.plan:null})}`;
 /** @param {string} s */
 async function copy(s){
  try{await navigator.clipboard.writeText(s);toastMsg(T.copied);return;}catch{}
  const i=document.createElement('textarea');i.value=s;i.setAttribute('readonly','');i.style.position='fixed';i.style.opacity='0';document.body.append(i);i.select();
  let ok=false;try{ok=document.execCommand('copy');}catch{}i.remove();toastMsg(ok?T.copied:T.copyFail);
 }
 let toastTimer=0;
 /** @param {string} s */
 function toastMsg(s){toast.textContent=s;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2200);}

 // 대진 배치: five quick taps on the title or the trophy, or Alt+Shift+R.
 // The signal: two quick taps on the trophy, or Alt+Shift+A.
 let cueTap=0;
 const cue=$('[data-bk-c]');
 function toggleArmed(){
  armed=!armed;
  try{navigator.vibrate?.(armed?40:[30,70,30]);}catch{}
  if(armed&&!reduce){cue.classList.remove('pop');void cue.offsetWidth;cue.classList.add('pop');}
 }
 cue?.addEventListener('click',()=>{const now=Date.now();if(now-cueTap<450){cueTap=0;toggleArmed();}else cueTap=now;});
 addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyA'){e.preventDefault();toggleArmed();}});
 let taps=0,tapTimer=0;
 for(const s of root.querySelectorAll('[data-bk-t]'))s.addEventListener('click',()=>{taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>{taps=0;},1500);if(taps>=5){taps=0;openSeating();}});
 addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyR'){e.preventDefault();openSeating();}});
 /** @type {HTMLDialogElement|null} */
 let dlg=null;
 /** @type {Plan} */
 let draft=emptyPlan();
 /** The panel, built on first use. */
 function panel(){
  if(dlg)return dlg;
  const d=document.createElement('dialog');d.className='bk-ed';d.setAttribute('aria-labelledby','bk-ed-h');
  const f=document.createElement('form');f.method='dialog';f.className='bk-ed-in';
  const h=document.createElement('h2');h.id='bk-ed-h';h.textContent=T.ed;
  const modes=document.createElement('div');modes.className='bk-size bk-ed-mode';modes.setAttribute('role','radiogroup');modes.setAttribute('aria-label',T.ed);
  for(const [v,label] of T.modes){const l=document.createElement('label'),i=document.createElement('input'),s=document.createElement('span');i.type='radio';i.name='mode';i.value=v;s.textContent=label;l.append(i,s);modes.append(l);}
  const help=document.createElement('p');help.className='fine';help.dataset.edHelp='';
  const cueRow=document.createElement('label');cueRow.className='bk-ed-cue';cueRow.dataset.edCue='';
  const cueBox=document.createElement('input');cueBox.type='checkbox';cueBox.name='cue';
  const cueText=document.createElement('span');cueText.textContent=T.cue;
  const cueHelp=document.createElement('small');cueHelp.className='fine';cueHelp.textContent=T.cueHelp;
  cueRow.append(cueBox,cueText,cueHelp);
  cueBox.addEventListener('change',()=>{draft.cue=cueBox.checked;});
  const list=document.createElement('div');list.className='bk-ed-list';list.dataset.edList='';
  const msg=document.createElement('p');msg.className='bk-ed-msg';msg.dataset.edMsg='';msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
  const acts=document.createElement('div');acts.className='bk-actions';
  const btn=(/** @type {string} */ label,/** @type {string} */ key,primary=false)=>{const b=document.createElement('button');b.type='button';b.className='btn'+(primary?' p':'');b.textContent=label;b.dataset.ed=key;acts.append(b);return b;};
  btn(T.save,'save',true);btn(T.shuffle,'shuffle');btn(T.fromBoard,'board');btn(T.link,'link');btn(T.close,'close');
  f.append(h,modes,help,cueRow,list,msg,acts);d.append(f);root.append(d);
  modes.addEventListener('change',()=>{draft.mode=/** @type {any} */(new FormData(f).get('mode')||'');if(draft.mode==='fixed'&&!draft.seats.some(Boolean)&&!sizeProblem(names().length,st.size))draft.seats=startSeats();fill();});
  list.addEventListener('change',onPick);
  acts.addEventListener('click',(/** @type {Event} */ e)=>{
   const k=/** @type {HTMLElement} */(e.target).closest('button')?.dataset.ed;
   if(k==='close')d.close();
   else if(k==='save'){if(check()){commit();toastMsg(T.saved);d.close();}}
   else if(k==='link'){if(check()){commit();copy(link(true));}}
   else if(k==='shuffle'){draft.seats=seatNames(drawPlan(names(),st.size,null),names());fill();}
   else if(k==='board'&&boardSeats()){draft.seats=/** @type {string[]} */(boardSeats());fill();}
  });
  return dlg=d;
 }
 /** The current board as seats, when it was drawn from the names now in the box. */
 const boardSeats=()=>st.board&&st.board.slots.length===st.size&&st.names.join('\n')===names().join('\n')?seatNames(st.board.slots,st.names):null;
 /** Seats to start a fixed seating from: the saved one fitted to the names of now, the board, or a draw. */
 const startSeats=()=>{const ns=names();return st.plan.seats.some(Boolean)?seatNames(fitSeats(ns,st.size,st.plan.seats),ns):boardSeats()||seatNames(drawPlan(ns,st.size,null),ns);};
 function openSeating(){
  const d=panel();if(d.open)return;
  draft={mode:st.plan.mode,pair:{...st.plan.pair},seats:[],cue:st.plan.cue};
  /** @type {HTMLInputElement} */(d.querySelector('input[name=cue]')).checked=draft.cue;
  if(!sizeProblem(names().length,st.size))draft.seats=startSeats();
  /** @type {HTMLInputElement} */(d.querySelector(`input[name=mode][value="${draft.mode}"]`)).checked=true;
  fill();
  if(d.showModal)d.showModal();else d.setAttribute('open','');
 }
 /** Draw the list for the chosen mode. */
 function fill(){
  const d=/** @type {HTMLDialogElement} */(dlg),list=/** @type {HTMLElement} */(d.querySelector('[data-ed-list]')),ns=names(),bad=sizeProblem(ns.length,st.size);
  /** @type {HTMLElement} */(d.querySelector('[data-ed-help]')).textContent=T.help[draft.mode];
  /** @type {HTMLElement} */(d.querySelector('[data-ed-cue]')).hidden=!draft.mode;
  for(const k of ['shuffle','board'])/** @type {HTMLElement} */(d.querySelector(`[data-ed="${k}"]`)).hidden=draft.mode!=='fixed'||(k==='board'&&!boardSeats());
  list.replaceChildren();list.className='bk-ed-list'+(draft.mode?'':' off');
  if(draft.mode&&(!ns.length||bad)){check();return;}
  if(draft.mode==='pairs'){
   const head=document.createElement('div');head.className='bk-rr bk-rh';head.append(document.createElement('span'),document.createElement('span'));/** @type {HTMLElement} */(head.lastChild).textContent=T.vsHead;list.append(head);
   for(const n of ns){
    const row=document.createElement('div');row.className='bk-rr';
    const who=document.createElement('span');who.className='bk-rn';who.textContent=n;
    const p=document.createElement('select');p.dataset.name=n;p.dataset.kind='pair';p.setAttribute('aria-label',`${n} · ${T.vsHead}`);
    p.append(new Option(T.none,''),...ns.filter(x=>x!==n).map(x=>new Option(x,x)));p.value=draft.pair[n]||'';
    row.append(who,p);list.append(row);
   }
  }else if(draft.mode==='fixed'){
   const size=st.size,group=size>=8?4:2;
   for(const [side,from] of [[T.left,0],[T.right,size/2]]){
    const sec=document.createElement('div');sec.className='bk-ed-side';
    const hd=document.createElement('h3');hd.textContent=/** @type {string} */(side);sec.append(hd);
    for(let g=/** @type {number} */(from);g</** @type {number} */(from)+size/2;g+=group){
     const box=document.createElement('div');box.className='bk-ed-g';
     for(let i=g;i<g+group;i+=2){
      const row=document.createElement('div');row.className='bk-ed-m';
      const no=document.createElement('span');no.className='bk-ed-no';no.textContent=T.match(i/2+1);
      const vs=document.createElement('span');vs.className='bk-ed-vs';vs.textContent='vs';
      row.append(no,seatSelect(i,ns),vs,seatSelect(i+1,ns));box.append(row);
     }
     sec.append(box);
    }
    list.append(sec);
   }
  }
  check();
 }
 /** @param {number} i @param {string[]} ns */
 function seatSelect(i,ns){
  const s=document.createElement('select');s.dataset.seat=String(i);s.setAttribute('aria-label',`${T.match((i>>1)+1)} · ${i%2+1}`);
  s.append(...ns.map(x=>new Option(x,x)));if(ns.length<st.size)s.append(new Option(T.bye,''));
  s.value=draft.seats[i]??'';return s;
 }
 /** A pick in either list. Seats swap (the chosen name leaves its old seat for this one's); pairs go both ways. @param {Event} e */
 function onPick(e){
  const s=/** @type {HTMLSelectElement} */(e.target),list=/** @type {HTMLElement} */(s.closest('[data-ed-list]'));
  if(s.dataset.seat!==undefined){
   const i=Number(s.dataset.seat),v=s.value,old=draft.seats[i]??'';
   let j=draft.seats.findIndex((x,k)=>k!==i&&x===v);
   // A bye moves to the seat it is taken from; prefer one that keeps the byes spread.
   if(v===''){const byes=draft.seats.map((x,k)=>x===''&&k!==i?k:-1).filter(k=>k>=0);j=byes.find(k=>draft.seats[k^1]!==''&&(k^1)!==i)??byes[0]??-1;}
   if(j>=0){draft.seats[j]=old;draft.seats[i]=v;}
   for(const o of list.querySelectorAll('select[data-seat]'))/** @type {HTMLSelectElement} */(o).value=draft.seats[Number(/** @type {HTMLSelectElement} */(o).dataset.seat)]??'';
  }else{
   const n=/** @type {string} */(s.dataset.name);
   for(const x of [n,s.value,draft.pair[n]])if(x&&draft.pair[x]){delete draft.pair[draft.pair[x]];delete draft.pair[x];}
   if(s.value){draft.pair[n]=s.value;draft.pair[s.value]=n;}
   for(const o of list.querySelectorAll('select[data-kind=pair]'))/** @type {HTMLSelectElement} */(o).value=draft.pair[/** @type {string} */(/** @type {HTMLSelectElement} */(o).dataset.name)]||'';
  }
  check();
 }
 /** Is the draft usable? Says why not. */
 function check(){
  const msg=/** @type {HTMLElement} */(/** @type {HTMLDialogElement} */(dlg).querySelector('[data-ed-msg]')),ns=names();
  const say=(/** @type {string} */ t,/** @type {boolean} */ ok)=>{msg.textContent=t;msg.className='bk-ed-msg'+(t?ok?' ok':' bad':'');return ok;};
  if(!draft.mode)return say('',true);
  if(!ns.length)return say(T.empty,false);
  if(sizeProblem(ns.length,st.size))return say(T.sizeBad,false);
  if(draft.mode==='fixed'){for(let m=0;m<st.size/2;m++)if(!draft.seats[2*m]&&!draft.seats[2*m+1])return say(T.twoByes,false);}
  else if(!pairsFit(ns.length,st.size,pairIndex(ns,draft)))return say(T.tooManyPairs,false);
  return say(st.board?T.redraw:'',true);
 }
 function commit(){
  st.plan={mode:draft.mode,pair:{...draft.pair},seats:draft.mode==='fixed'?draft.seats.slice():st.plan.seats,cue:draft.cue};armed=false;
  save();
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
