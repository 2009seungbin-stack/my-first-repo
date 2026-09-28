/** Nerulio 2.0 page islands: the only JavaScript on channel, post and community pages.
 * Pages are complete without it (server-rendered, edge-cached, identical for everyone); this module
 * adds the reader's own state and the write actions through /api/v2:
 *  account · follow · post/comment votes · compat/issue/rollout reports · comments and replies ·
 *  write form · new-posts bar · countdown · share. */
const L=document.documentElement.lang==='en'?'en':'ko';
const T={
 ko:{login:'로그인',needLogin:'로그인하면 참여할 수 있어요. 로그인 페이지로 이동할까요?',follow:'구독',following:'✓ 구독 중',sent:'반영했어요',thanks:'리포트를 남겼어요. 고마워요!',error:'잠시 후 다시 시도해 주세요.',
  rate:'너무 빨라요. 1분 뒤에 다시 해 주세요.',own:'내 글에는 추천할 수 없어요.',newPosts:n=>`↑ 새 글 ${n}개 · 눌러서 보기`,replyTo:n=>`↳ ${n}님에게 답글`,cancel:'취소',copied:'링크를 복사했어요',posting:'등록 중…',empty:'내용을 입력해 주세요.'},
 en:{login:'Sign in',needLogin:'Sign in to take part. Go to the sign-in page?',follow:'Follow',following:'✓ Following',sent:'Saved',thanks:'Report saved. Thank you!',error:'Please try again in a moment.',
  rate:'Too fast. Please wait a minute.',own:'You cannot vote on your own post.',newPosts:n=>`↑ ${n} new posts · show`,replyTo:n=>`↳ Reply to ${n}`,cancel:'Cancel',copied:'Link copied',posting:'Posting…',empty:'Please write something.'},
}[L];
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
async function api(path,body){
 try{
  const r=await fetch('/api/v2'+path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>null);
  return {ok:r.ok,status:r.status,data,code:data?.error?.code||''};
 }catch{return {ok:false,status:0,data:null,code:'NETWORK'};}
}
let toastTimer=0;
function toast(text){
 let el=$('#n2-toast');
 if(!el){el=document.createElement('div');el.id='n2-toast';el.className='toast';el.setAttribute('role','status');document.body.append(el);}
 el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},2600);
}
const loginUrl=()=>`/${L}/account/?next=${encodeURIComponent(location.pathname+location.search)}`;
function explain(res){
 if(res.code==='LOGIN_REQUIRED'){if(confirm(T.needLogin))location.href=loginUrl();return;}
 if(res.code==='RATE_LIMITED')return toast(T.rate);
 if(res.data?.error?.message&&res.status<500)return toast(res.data.error.message);
 toast(T.error);
}
/** Run a write; signed-out readers are sent to sign in first. */
async function write(path,body,signedIn){
 if(!signedIn){location.href=loginUrl();return null;}
 const res=await api(path,body);
 if(!res.ok){explain(res);return null;}
 return res.data||{};
}

async function main(){
 const entity=$('[data-entity]')?.dataset.entity||'';
 const post=$('[data-post]')?.dataset.post||'';
 const q=new URLSearchParams();if(entity)q.set('entity',entity);if(post)q.set('post',post);
 const st=(await api('/state?'+q)).data||{signedIn:false,votes:{}};
 const signedIn=!!st.signedIn;

 // Account
 const acc=$('[data-island="account"]');
 if(acc&&signedIn&&st.user?.name&&acc.closest('.hd')){acc.innerHTML='';const a=document.createElement('a');a.className='hb solid';a.href=`/${L}/account/`;a.textContent=st.user.name;acc.append(a);}

 // Follow
 for(const box of $$('[data-island="follow"]')){
  const link=box.querySelector('a.btn:not(.p)');if(!link)continue;
  const btn=document.createElement('button');btn.type='button';btn.className='btn'+(st.following?' on':'');btn.textContent=st.following?T.following:T.follow;btn.setAttribute('aria-pressed',String(!!st.following));
  link.replaceWith(btn);
  btn.addEventListener('click',async()=>{
   const want=btn.getAttribute('aria-pressed')!=='true';
   const r=await write('/follow',{entityId:box.dataset.entity,follow:want},signedIn);if(!r)return;
   btn.setAttribute('aria-pressed',String(want));btn.textContent=want?T.following:T.follow;btn.classList.toggle('on',want);
  });
 }

 // Post votes (up/down), or "same here / can't reproduce" on a compat report post
 for(const box of $$('[data-island="post-vote"]')){
  const buttons=$$('button',box);const rep=box.dataset.report?JSON.parse(box.dataset.report):null;
  buttons.forEach((b,i)=>{
   b.disabled=false;
   if(st.votes?.[box.dataset.post]===1&&i===0)b.classList.add('on');
   b.addEventListener('click',async()=>{
    if(i===0||(!rep&&i===1)){
     const value=i===0?1:-1,cur=st.votes?.[box.dataset.post]||0,next=cur===value?0:value;
     const r=await write('/votes',{kind:'discussion',id:box.dataset.post,value:next},signedIn);if(!r)return;
     st.votes[box.dataset.post]=next;buttons[0].querySelector('b').textContent=r.up;if(!rep)buttons[1].querySelector('b').textContent=r.down;
     buttons[0].classList.toggle('on',next===1);
    }else{
     const r=await write('/reports',{...rep,result:i===1?rep.result:(rep.result==='broken'?'works':'broken')},signedIn);if(!r)return;
     const n=b.querySelector('b');n.textContent=String(Number(n.textContent||0)+1);toast(T.thanks);
    }
   });
  });
 }
 // Comment votes
 for(const a of $$('[data-vote-comment]')){
  a.addEventListener('click',async e=>{e.preventDefault();const id=a.dataset.voteComment,cur=st.votes?.[id]||0;
   const r=await write('/votes',{kind:'comment',id,value:cur===1?0:1},signedIn);if(!r)return;st.votes[id]=cur===1?0:1;a.textContent=`▲ ${r.up}`;a.classList.toggle('on',cur!==1);});
 }

 // Compat strip (game → Korean patch), driver issue, rollout
 for(const box of $$('[data-island="compat-vote"]')){
  const results=['works','works_with_issues','broken'];
  $$('button',box).forEach((b,i)=>{b.disabled=false;b.addEventListener('click',async()=>{
   const r=await write('/reports',{kind:'compat',entityId:box.dataset.subject,targetId:box.dataset.target,targetVersion:box.dataset.targetVersion||undefined,result:results[i]},signedIn);
   if(r){toast(T.thanks);if(r.url)setTimeout(()=>{location.href=r.url;},900);}
  });});
 }
 for(const box of $$('[data-island="issue-vote"]')){
  $$('button',box).forEach((b,i)=>{b.disabled=false;b.addEventListener('click',async()=>{
   const r=await write('/reports',{kind:'issue',entityId:box.dataset.entity,subjectVersion:box.dataset.version||undefined,result:i===0?'works':'broken'},signedIn);
   if(r)toast(T.thanks);
  });});
 }
 for(const box of $$('[data-island="rollout-vote"]')){
  $$('button',box).forEach((b,i)=>{b.disabled=false;b.addEventListener('click',async()=>{
   const r=await write('/rollout',{featureId:box.dataset.feature,hasIt:i===0,country:L==='ko'?'KR':undefined},signedIn);
   if(r)toast(T.thanks);
  });});
 }

 // Comments and replies
 const form=$('form[data-island="comment-form"]');
 if(form){
  const ta=$('textarea',form),parent=$('input[name="parentId"]',form),label=$('.replying',form);
  for(const a of $$('[data-reply]')){
   a.addEventListener('click',e=>{e.preventDefault();parent.value=a.dataset.reply;label.hidden=false;$('span',label).textContent=T.replyTo(a.dataset.name||'');ta.focus();});
  }
  $('button[data-cancel]',form)?.addEventListener('click',()=>{parent.value='';label.hidden=true;});
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(!ta.value.trim())return toast(T.empty);
   const btn=$('button[type="submit"]',form);btn.disabled=true;
   const r=await write('/comments',{postId:form.dataset.post,parentId:parent.value||undefined,body:ta.value},signedIn);
   btn.disabled=false;
   if(r){ta.value='';location.hash=`c-${r.id}`;location.reload();}
  });
 }

 // Write page
 const wf=$('form[data-island="write-form"]');
 if(wf){
  if(!signedIn){const n=$('.needlogin',wf);if(n)n.hidden=false;}
  wf.addEventListener('submit',async e=>{
   e.preventDefault();
   const fd=new FormData(wf),btn=$('button[type="submit"]',wf);
   const kind=String(fd.get('kind')||'');
   btn.disabled=true;btn.textContent=T.posting;
   let r;
   if(kind==='report'&&fd.get('targetId')){
    r=await write('/reports',{kind:'compat',entityId:String(fd.get('subjectId')),subjectVersion:String(fd.get('subjectVersion')||'')||undefined,targetId:String(fd.get('targetId')),targetVersion:String(fd.get('targetVersion')||'')||undefined,
     result:String(fd.get('result')),env:Object.fromEntries(['os','device','note'].map(k=>[k,String(fd.get('env_'+k)||'')]).filter(([,v])=>v)),title:String(fd.get('title')||'')||undefined,comment:String(fd.get('body')||'')||undefined},signedIn);
   }else{
    r=await write('/posts?l='+L,{entityId:wf.dataset.entity,kind,title:String(fd.get('title')||''),body:String(fd.get('body')||'')},signedIn);
   }
   btn.disabled=false;btn.textContent=btn.dataset.label||btn.textContent;
   if(r?.url)location.href=r.url;
  });
  const kindSel=$('select[name="kind"]',wf),rep=$('.repf',wf);
  const sync=()=>{if(rep)rep.hidden=kindSel.value!=='report';};kindSel?.addEventListener('change',sync);sync();
 }

 // New posts bar (polls once a minute while the tab is visible)
 const bar=$('[data-island="new-posts"]');
 if(bar){
  const last=Math.max(0,...$$('.plist .pr .no').map(n=>Number(n.textContent)||0));
  const poll=async()=>{
   if(document.hidden)return;
   const r=await api(`/new-posts?entity=${encodeURIComponent(bar.dataset.entity)}&after=${last}`);
   if(r.ok&&r.data.count>0){bar.hidden=false;bar.textContent='';const a=document.createElement('a');a.href=location.pathname+location.search;a.textContent=T.newPosts(r.data.count);bar.append(a);}
  };
  if(last)setInterval(poll,60e3);
 }

 // Countdown
 for(const cd of $$('[data-island="countdown"]')){
  const at=Number(cd.dataset.at);const cells=$$('b',cd);
  const tick=()=>{const ms=Math.max(0,at-Date.now());if(cells.length===3){cells[0].textContent=String(Math.floor(ms/864e5));cells[1].textContent=String(Math.floor(ms%864e5/36e5)).padStart(2,'0');cells[2].textContent=String(Math.floor(ms%36e5/6e4)).padStart(2,'0');}};
  if(at)setInterval(tick,30e3);
 }

 // Share / copy link
 for(const b of $$('[data-island="share"]')){
  b.addEventListener('click',async()=>{
   const url=location.href.split('#')[0];
   if(navigator.share){try{await navigator.share({title:document.title,url});return;}catch{}}
   try{await navigator.clipboard.writeText(url);toast(T.copied);}catch{prompt('URL',url);}
  });
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',main);else main();
