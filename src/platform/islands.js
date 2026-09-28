/** Nerulio 2.0 page islands: the only JavaScript on channel, post and community pages.
 * Pages are complete without it (server-rendered, edge-cached, identical for everyone); this module
 * adds the reader's own state and the write actions through /api/v2:
 *  account · follow · post/comment votes · compat/issue/rollout reports · comments and replies ·
 *  write form · new-posts bar · countdown · share. */
const L=document.documentElement.lang==='en'?'en':'ko';
const T={
 ko:{login:'로그인',needLogin:'로그인하면 참여할 수 있어요. 로그인 페이지로 이동할까요?',follow:'구독',following:'✓ 구독 중',sent:'반영했어요',thanks:'리포트를 남겼어요. 고마워요!',error:'잠시 후 다시 시도해 주세요.',
  rate:'너무 빨라요. 1분 뒤에 다시 해 주세요.',own:'내 글에는 추천할 수 없어요.',newPosts:n=>`↑ 새 글 ${n}개 · 눌러서 보기`,replyTo:n=>`↳ ${n}님에게 답글`,cancel:'취소',copied:'링크를 복사했어요',posting:'등록 중…',empty:'내용을 입력해 주세요.',flagged:'신고를 접수했어요. 운영자가 확인합니다.',voted:'반영했어요. 한 사람당 한 표로 셉니다.',commentPh:'댓글 입력',followed:'구독했어요. 바뀐 것과 새 글은 내 레이더에 모입니다.',unfollowed:'구독을 취소했어요.',addDetails:'환경·증상까지 리포트로 남기기 ›',flagUpdated:r=>`이미 신고한 대상이에요. 사유를 “${r}”에서 바꿨어요.`,backToPost:'원래 글로 돌아가기'},
 en:{login:'Sign in',needLogin:'Sign in to take part. Go to the sign-in page?',follow:'Follow',following:'✓ Following',sent:'Saved',thanks:'Report saved. Thank you!',error:'Please try again in a moment.',
  rate:'Too fast. Please wait a minute.',own:'You cannot vote on your own post.',newPosts:n=>`↑ ${n} new posts · show`,replyTo:n=>`↳ Reply to ${n}`,cancel:'Cancel',copied:'Link copied',posting:'Posting…',empty:'Please write something.',flagged:'Report received. A moderator will review it.',voted:'Counted. One vote per person.',commentPh:'Write a comment',followed:'Following. Changes and posts go to My Radar.',unfollowed:'Unfollowed.',addDetails:'Add details in a report ›',flagUpdated:r=>`You had already reported this; the reason was changed from “${r}”.`,backToPost:'Back to the post'},
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
const loginUrl=()=>`/api/v1/auth/google/start?return=${encodeURIComponent(location.pathname+location.search)}`;
/** The API's messages are English; Korean pages show these instead (unknown ones fall back to T.error). */
const KO_ERR=[[/^This nickname is taken/,'이미 쓰는 닉네임이에요. 다른 닉네임을 골라 주세요.'],[/^This nickname is reserved/,'사용할 수 없는 닉네임이에요.'],[/^displayName must be (\d+)–(\d+)/,'닉네임은 $1~$2자로 써 주세요.'],
 [/^(title|body|reason|note) must be (\d+)–(\d+)/,(m,f,a,b)=>`${{title:'제목은',body:'내용은',reason:'사유는',note:'설명은'}[f]} ${a}~${b}자로 써 주세요.`],[/^(\w+) is required/,'필수 항목을 입력해 주세요.'],
 [/^You cannot vote on your own/,'내 글에는 추천할 수 없어요.'],[/^This account is temporarily restricted/,'이용이 잠시 제한된 계정이에요.'],[/^This account cannot post/,'이 계정은 글을 쓸 수 없어요.'],
 [/^Comments are closed/,'댓글이 닫힌 글이에요.'],[/^Post not found|^No such post/,'글을 찾을 수 없어요. 삭제되었거나 숨겨졌을 수 있어요.'],[/^The comment you replied to is gone/,'답글을 단 댓글이 사라졌어요.'],
 [/^This tag cannot be used/,'이 채널에서는 쓸 수 없는 말머리예요.'],[/^Not hidden/,'숨겨진 상태가 아니에요. 새로고침해 주세요.'],[/^Already hidden/,'이미 임시조치된 대상이에요.'],[/^Already deleted/,'작성자가 이미 삭제했어요.'],
 [/^Only a higher role/,'더 높은 권한만 이 계정을 처리할 수 있어요.'],[/^You cannot moderate your own/,'자기 계정은 처리할 수 없어요.'],[/^This action does not apply/,'이 대상에는 쓸 수 없는 조치예요.'],
 [/^Only questions have an accepted/,'질문 글만 답변을 채택할 수 있어요.'],[/^Invalid reason/,'사유를 선택해 주세요.'],[/^Nothing to report at this address/,'신고할 대상을 찾을 수 없어요.'],[/^tokens_per_s must be/,'토큰/초는 0~5000 사이로 적어 주세요.'],
 [/^A benchmark is a model measured on a GPU/,'모델과 GPU를 골라 주세요.'],[/^A compatibility report needs a target/,'호환 대상을 골라 주세요.'],[/^Invalid version/,'버전 형식이 올바르지 않아요.']];
function message(m){
 if(L!=='ko')return m;
 for(const [re,ko] of KO_ERR){const x=re.exec(m);if(x)return typeof ko==='function'?ko(...x):ko.replace(/\$(\d)/g,(_,i)=>x[i]);}
 return T.error;
}
function explain(res){
 if(res.code==='LOGIN_REQUIRED'){if(confirm(T.needLogin))location.href=loginUrl();return;}
 if(res.code==='RATE_LIMITED')return toast(T.rate);
 if(res.data?.error?.message&&res.status<500)return toast(message(res.data.error.message));
 toast(T.error);
}
/** Run a write; signed-out readers are sent to sign in first. */
async function write(path,body,signedIn){
 // Say why before leaving the page for sign-in.
 if(!signedIn){if(confirm(T.needLogin))location.href=loginUrl();return null;}
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
 if(acc&&signedIn&&st.user?.name&&acc.closest('.hd')){acc.innerHTML='';const a=document.createElement('a');a.className='hb solid';a.href=`/${L}/community/me`;a.textContent=st.user.name;acc.append(a);}
 // Signed in: the comment box no longer says "sign-in needed", and the front page's sign-in box
 // becomes the reader's own channels.
 if(signedIn){
  for(const ta of $$('#comment-form textarea'))ta.placeholder=T.commentPh;
  const lb=$('.box.login[data-island="account"]');
  if(lb){
   const fr=await api(`/follows?l=${L}`);
   lb.textContent='';const h=document.createElement('b');h.textContent=L==='ko'?'내 구독 채널':'My channels';lb.append(h);
   const list=fr.ok?fr.data.follows.slice(0,8):[];
   if(!list.length){const p=document.createElement('span');p.className='fine';p.textContent=L==='ko'?'채널 화면의 “구독”을 누르면 여기와 내 레이더에 모입니다.':'Follow channels to see them here and in My Radar.';lb.append(p);}
   else{const ul=document.createElement('ul');ul.className='rows';for(const f of list){const li=document.createElement('li');const a=document.createElement('a');a.className='tt';a.href=f.url;a.textContent=f.name;li.append(a);ul.append(li);}lb.append(ul);}
   const r=document.createElement('a');r.className='btn';r.href=`/${L}/radar/#mine`;r.textContent=L==='ko'?'내 레이더 ›':'My Radar ›';lb.append(r);
  }
 }

 // My Radar (radar page) and the unread count in the header
 if(signedIn){
  const mine=$('[data-island="my-radar"]');
  const mr=await api(`/my-radar?l=${L}`);
  if(mr.ok){
   const d=mr.data;
   const nav=$('.hd .hn');
   if(nav&&d.unread>0){const a=document.createElement('a');a.className='hb';a.href=`/${L}/radar/#mine`;a.textContent=(L==='ko'?'알림 ':'Alerts ')+d.unread;nav.append(a);}
   if(mine){
    const ul=$('ul',mine);mine.hidden=false;
    const items=[...d.changes.map(c=>({at:c.at,eventAt:c.eventAt,channel:c.channel,text:`${c.title}${c.detail?' — '+c.detail:''}`,url:c.url,unread:c.unread})),...d.posts.map(p=>({at:p.at,channel:p.channel,text:`${p.title}${p.comments?` [${p.comments}]`:''}`,url:p.url,unread:false}))].sort((a,b)=>b.at-a.at).slice(0,30);
    if(!items.length){const li=document.createElement('li');li.textContent=d.following?(L==='ko'?'구독한 채널에 아직 새 소식이 없어요.':'Nothing new in your channels yet.'):(L==='ko'?'채널을 구독하면 바뀐 것과 새 글이 여기에 모입니다.':'Follow channels to see their changes and posts here.');ul.append(li);}
    const md=ms=>{const x=new Date(ms);return `${String(x.getMonth()+1).padStart(2,'0')}.${String(x.getDate()).padStart(2,'0')}`;};
    const dd=ms=>{const n=Math.round((new Date(ms).setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/864e5);return n===0?'D-DAY':n>0?`D-${n}`:`D+${-n}`;};
    for(const it of items){
     const li=document.createElement('li');li.className='mr';
     const t=document.createElement('span');t.className='tm';t.textContent=it.eventAt?dd(it.eventAt):md(it.at);
     if(it.eventAt)t.title=(L==='ko'?'일정 ':'On ')+new Date(it.eventAt).toLocaleDateString(L==='ko'?'ko-KR':'en-US');
     const a=document.createElement('a');a.className='tt';a.href=it.url||'#';a.textContent=it.text;if(it.unread)a.classList.add('unread');
     const c=document.createElement('span');c.className='chn fine';c.textContent=it.channel;
     li.append(t,a,c);ul.append(li);}
    if(d.unread>0)api('/my-radar/seen',{lastChangeId:d.lastChangeId});
    // "내 구독만": the Radar's lists narrowed to followed channels (items link to their channel).
    if(d.following){
     const fr=await api(`/follows?l=${L}`);
     const mine=new Set(fr.ok?fr.data.follows.map(f=>f.url):[]);
     for(const bx of $$('.box.mf')){
      const bh=$('.bh',bx);if(!bh)continue;
      const b=document.createElement('button');b.type='button';b.className='btn x';b.textContent=L==='ko'?'내 구독만':'Mine only';b.setAttribute('aria-pressed','false');
      b.addEventListener('click',()=>{const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));b.classList.toggle('on',on);
       for(const li of $$('.rows > li',bx)){const hit=$$('a[href]',li).some(a=>mine.has(new URL(a.href).pathname));li.hidden=on&&!hit;}
       for(const g of $$('.hist > li',bx))g.hidden=on&&!$$('.rows > li',g).some(li=>!li.hidden);});
      bh.append(b);
     }
    }
   }
  }
 }

 // Follow
 for(const box of $$('[data-island="follow"]')){
  const link=box.querySelector('a.btn:not(.p)');if(!link)continue;
  const btn=document.createElement('button');btn.type='button';btn.className='btn'+(st.following?' on':'');btn.textContent=st.following?T.following:T.follow;btn.setAttribute('aria-pressed',String(!!st.following));
  link.replaceWith(btn);
  btn.addEventListener('click',async()=>{
   const want=btn.getAttribute('aria-pressed')!=='true';
   const r=await write('/follow',{entityId:box.dataset.entity,follow:want},signedIn);if(!r)return;
   btn.setAttribute('aria-pressed',String(want));btn.textContent=want?T.following:T.follow;btn.classList.toggle('on',want);
   const n=$('[data-followers]');if(n){const v=Math.max(0,Number(n.dataset.followers||0)+(want?1:-1));n.dataset.followers=String(v);n.textContent=v.toLocaleString(L==='ko'?'ko-KR':'en-US');}
   toast(want?T.followed:T.unfollowed);
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
     // One vote per person: a repeat click changes the vote instead of adding one.
     if(b.classList.contains('on'))return toast(T.voted);
     const r=await write('/reports',{...rep,result:i===1?rep.result:(rep.result==='broken'?'works':'broken')},signedIn);if(!r)return;
     const other=buttons[i===1?2:1],n=b.querySelector('b');
     if(other.classList.contains('on')){other.classList.remove('on');const o=other.querySelector('b');o.textContent=String(Math.max(0,Number(o.textContent||0)-1));}
     n.textContent=String(Number(n.textContent||0)+1);b.classList.add('on');toast(T.voted);
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
   if(!r)return;
   $$('button',box).forEach((x,j)=>x.classList.toggle('on',j===i));
   // A click is a vote (one per person); details go in a 리포트 post from the write page.
   let more=$('.vmore',box.parentElement);
   if(!more&&box.dataset.write){more=document.createElement('a');more.className='vmore fine';more.href=box.dataset.write;more.textContent=T.addDetails;box.after(more);}
   toast(T.voted);
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

 for(const box of $$('[data-island="outage-report"]')){
  $$('button',box).forEach(b=>{b.disabled=false;b.addEventListener('click',async()=>{
   const r=await write('/reports',{kind:'issue',entityId:box.dataset.entity,result:'broken',env:{symptom:b.dataset.symptom,platform:/Android|iPhone|iPad/.test(navigator.userAgent)?'mobile':'desktop'}},signedIn);
   if(r){toast(T.thanks);b.classList.add('on');}
  });});
 }

 // The author's own post and comments: edit / delete
 const own=$('[data-island="own-post"]');
 if(own&&st.mine?.post){
  own.hidden=false;
  // No reporting or "same here" on one's own post.
  for(const a of $$('.pact a[href*="/community/report"]'))a.hidden=true;
  const pv=$('[data-island="post-vote"][data-report]');if(pv)for(const b of $$('button',pv).slice(1))b.hidden=true;
  $('[data-delete]',own).addEventListener('click',async()=>{if(!confirm(L==='ko'?'이 글을 삭제할까요?':'Delete this post?'))return;const r=await write('/posts/delete',{postId:own.dataset.post},signedIn);if(r)location.href=location.pathname.replace(/\d+$/,'');});
  $('[data-edit]',own).addEventListener('click',async()=>{
   const src=await api(`/posts/source?id=${encodeURIComponent(own.dataset.post)}`);if(!src.ok)return explain(src);
   const art=$('article.post');const f=document.createElement('form');f.className='wform';
   const ti=document.createElement('input');ti.name='title';ti.value=src.data.title;ti.maxLength=120;ti.setAttribute('aria-label',L==='ko'?'제목':'Title');
   const ta=document.createElement('textarea');ta.name='body';ta.value=src.data.body;ta.maxLength=20000;ta.setAttribute('aria-label',L==='ko'?'본문':'Body');
   const b=document.createElement('button');b.type='submit';b.className='btn p';b.textContent=L==='ko'?'수정 저장':'Save';
   f.append(ti,ta,b);art.replaceChildren(f);ti.focus();
   f.addEventListener('submit',async e=>{e.preventDefault();const r=await write('/posts/edit',{postId:own.dataset.post,title:ti.value,body:ta.value},signedIn);if(r)location.reload();});
  });
 }
 // The question's author accepts an answer
 if(st.mine?.post)for(const b of $$('[data-accept]')){
  if(st.mine.comments?.includes(b.dataset.accept))continue;b.hidden=false;
  b.addEventListener('click',async()=>{const r=await write('/posts/solve',{postId:own?.dataset.post,commentId:b.dataset.accept},signedIn);if(r)location.reload();});
 }
 for(const b of $$('[data-own-comment]')){
  if(!st.mine?.comments?.includes(b.dataset.ownComment))continue;b.hidden=false;
  b.addEventListener('click',async()=>{if(!confirm(L==='ko'?'이 댓글을 삭제할까요?':'Delete this comment?'))return;const r=await write('/comments/delete',{commentId:b.dataset.ownComment},signedIn);if(r)location.reload();});
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
  // Draft kept in this browser (title, body) so signing in or a closed tab does not lose it.
  const dkey='n2-draft:'+location.pathname,ti=$('input[name="title"]',wf),ta=$('textarea[name="body"]',wf);
  const store={get(){try{return JSON.parse(localStorage.getItem(dkey)||'null');}catch{return null;}},set(v){try{v?localStorage.setItem(dkey,JSON.stringify(v)):localStorage.removeItem(dkey);}catch{}}};
  const saved=store.get();
  if(saved&&ti&&ta&&!ti.value&&!ta.value){ti.value=saved.title||'';ta.value=saved.body||'';toast(L==='ko'?'임시저장한 글을 불러왔어요.':'Draft restored.');}
  let dt=0;wf.addEventListener('input',()=>{clearTimeout(dt);dt=setTimeout(()=>store.set(ti?.value||ta?.value?{title:ti?.value||'',body:ta?.value||''}:null),400);});
  wf.addEventListener('submit',async e=>{
   e.preventDefault();
   const fd=new FormData(wf),btn=$('button[type="submit"]',wf);
   if(String(fd.get('kind'))!=='report'&&!String(fd.get('body')||'').trim()){toast(T.empty);ta?.focus();return;}
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
   if(r?.url){store.set(null);location.href=r.url;}
  });
  const kindSel=$('select[name="kind"]',wf),rep=$('.repf',wf);
  const title=$('input[name="title"]',wf);
  const sync=()=>{const r=kindSel.value==='report'&&!!rep;if(rep){rep.hidden=!r;for(const el of $$('select,input',rep))el.disabled=!r;}if(title)title.required=!r;};kindSel?.addEventListener('change',sync);sync();
 }

 // Benchmark (GPU local-LLM page)
 const bf=$('form[data-island="bench-form"]');
 if(bf)bf.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(bf);
  const r=await write('/reports',{kind:'benchmark',entityId:String(fd.get('model')),targetId:bf.dataset.gpu,metrics:{tokens_per_s:Number(String(fd.get('tps')).replace(',','.'))},env:Object.fromEntries([['runtime',fd.get('runtime')],['quant',fd.get('quant')],['ctx',fd.get('ctx')],['os',fd.get('os')]].filter(([,v])=>v).map(([k,v])=>[k,String(v)]))},signedIn);
  if(r){toast(T.thanks);setTimeout(()=>location.reload(),900);}});

 // 신고 form
 const ff=$('form[data-island="flag-form"]');
 if(ff)ff.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(ff);
  const r=await write('/flags',{target:ff.dataset.target,reason:String(fd.get('reason')),note:String(fd.get('note')||'')||undefined},signedIn);
  if(!r)return;
  const reasons=[...$('select[name="reason"]',ff).options].reduce((o,x)=>(o[x.value]=x.textContent,o),{});
  toast(r.updated?T.flagUpdated(reasons[r.previousReason]||r.previousReason):T.flagged);$('button[type="submit"]',ff).disabled=true;
  const back=ff.dataset.back;if(back)setTimeout(()=>{location.href=back;},1600);});

 // 내 정보: nickname and followed channels
 const me=$('[data-island="me"]');
 if(me&&signedIn){
  $('[data-signed-out]',me).hidden=true;
  const nf=$('form[data-nickname]',me);nf.hidden=false;$('input',nf).value=st.user?.name||'';
  const auto=/^user-[0-9a-z]{1,6}$/.test(st.user?.name||'');$('[data-autonick]',nf).hidden=!auto;
  nf.addEventListener('submit',async e=>{e.preventDefault();const name=$('input',nf).value.trim();const r=await write('/profile',{displayName:name},signedIn);
   if(r){toast(T.sent);$('[data-autonick]',nf).hidden=true;const h=$('.hd [data-island="account"] a');if(h)h.textContent=name;}});
  const lo=$('[data-logout]',me);lo.hidden=false;
  lo.addEventListener('click',async()=>{
   try{await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'});}catch{}
   location.href=`/${L}/community/`;});
  const [mr,fr0]=await Promise.all([api(`/mine?l=${L}`),api(`/follows?l=${L}`)]);
  if(mr.ok){
   for(const sec of $$('[data-mine]',me))sec.hidden=false;
   const fill=(ul,list,emptyText,row)=>{if(!list.length){const li=document.createElement('li');li.className='empty';li.textContent=emptyText;ul.append(li);}for(const x of list)ul.append(row(x));};
   const md=ms=>{const x=new Date(ms);return `${String(x.getMonth()+1).padStart(2,'0')}.${String(x.getDate()).padStart(2,'0')}`;};
   const line=(at,text,href,side)=>{const li=document.createElement('li');li.className='mr';const t=document.createElement('span');t.className='tm';t.textContent=md(at);const a=document.createElement('a');a.className='tt';a.href=href;a.textContent=text;const c=document.createElement('span');c.className='chn fine';c.textContent=side;li.append(t,a,c);return li;};
   fill($('[data-posts]',me),mr.data.posts,L==='ko'?'아직 쓴 글이 없어요.':'No posts yet.',p=>line(p.at,`${p.title}${p.comments?` [${p.comments}]`:''}`,p.url,p.channel));
   fill($('[data-comments]',me),mr.data.comments,L==='ko'?'아직 쓴 댓글이 없어요.':'No comments yet.',c=>line(c.at,c.text,c.url,c.on));
  }
  const fr=fr0,box=$('[data-follows]',me);
  if(fr.ok){box.hidden=false;const ul=$('ul',box);
   if(!fr.data.follows.length){const li=document.createElement('li');li.textContent=L==='ko'?'아직 구독한 채널이 없어요.':'No channels yet.';ul.append(li);}
   for(const f of fr.data.follows){const li=document.createElement('li');const a=document.createElement('a');a.className='tt';a.href=f.url;a.textContent=f.name;const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=L==='ko'?'구독 취소':'Unfollow';
    b.addEventListener('click',async()=>{const r=await write('/follow',{entityId:f.id,follow:false},signedIn);if(r)li.remove();});li.append(a,b);ul.append(li);}
  }
 }

 // Moderator queue
 const mq=$('[data-island="mod-queue"]');
 if(mq&&signedIn){
  const r=await api('/mod/queue');
  if(r.ok){
   const {items,hidden=[],log}=r.data,ko=L==='ko';
   const REASON=ko?{spam:'스팸·도배',abuse:'욕설·혐오',wrong_info:'틀린 정보',source_dispute:'출처 이의',copyright:'권리 침해',duplicate:'중복',other:'기타'}:{};
   const STATUS=ko?{hidden:'임시조치 중',deleted:'작성자가 삭제',locked:'댓글 잠김'}:{};
   const ACTION=ko?{hide:'임시조치',unhide:'복구',dismiss:'기각',restrict:'이용 제한',unrestrict:'제한 해제'}:{};
   const KIND=ko?{discussion:'글',comment:'댓글',user:'계정'}:{};
   const when=t=>new Date(t).toLocaleString(ko?'ko-KR':'en-US',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
   const act=async(target,action,label)=>{const reason=prompt(`${label} — ${ko?'사유(처리 기록에 남습니다)':'reason (kept in the log)'}`);if(!reason)return;const x=await api('/mod/action',{target,action,reason});if(x.ok){toast(ko?`${label} 처리했어요`:'Done');setTimeout(()=>location.reload(),700);}else explain(x);};
   /** One row: title (linked while it is public), who wrote it and where, the excerpt, then the actions that apply. */
   const row=(it,head,actions)=>{
    const li=document.createElement('li');li.className='mq';
    const top=document.createElement('p');top.className='mqh';
    const tag=document.createElement('span');tag.className='mqt';tag.textContent=head;top.append(tag);
    const t=document.createElement(it.url&&it.status!=='hidden'?'a':'b');t.className='tt';if(it.url&&it.status!=='hidden')t.href=it.url;
    t.textContent=it.preview||it.target;top.append(' ',t);li.append(top);
    const meta=[`${KIND[it.target.split(':')[0]]||it.target.split(':')[0]}`,it.author&&(ko?`작성 ${it.author}`:`by ${it.author}`),it.context&&(ko?`「${it.context}」의 댓글`:`on “${it.context}”`),it.status&&it.status!=='published'&&(STATUS[it.status]||it.status)].filter(Boolean);
    const m=document.createElement('p');m.className='fine';m.textContent=meta.join(' · ');li.append(m);
    if(it.excerpt){const ex=document.createElement('p');ex.className='mqx';ex.textContent=it.excerpt;li.append(ex);}
    if(it.note){const n=document.createElement('p');n.className='mqn';n.textContent=(ko?'신고자 설명: ':'Reporter: ')+it.note;li.append(n);}
    const bar=document.createElement('p');bar.className='mqa';
    for(const [a,lab] of actions){const b=document.createElement('button');b.type='button';b.className='btn'+(a==='hide'?' p':'');b.textContent=lab;b.addEventListener('click',()=>act(it.target,a,lab));bar.append(b);}
    if(it.authorId){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=ACTION.restrict||'Restrict author';b.addEventListener('click',()=>act('user:'+it.authorId,'restrict',ACTION.restrict||'Restrict'));bar.append(b);}
    li.append(bar);return li;
   };
   const ul=$('[data-items]',mq),empty=$('[data-empty]',mq);
   empty.textContent=items.length?'':(ko?'열린 신고가 없습니다.':'No open reports.');empty.hidden=!!items.length;
   for(const it of items){
    const head=`${it.reasons.map(x=>REASON[x]||x).join(', ')}${it.count>1?` ×${it.count}`:''} · ${when(it.firstAt)}`;
    const acts=it.status==='hidden'?[['unhide',ACTION.unhide||'Restore'],['dismiss',ACTION.dismiss||'Dismiss']]:it.status==='deleted'?[['dismiss',ACTION.dismiss||'Dismiss']]:[['hide',ACTION.hide||'Hide'],['dismiss',ACTION.dismiss||'Dismiss']];
    ul.append(row(it,head,acts));
   }
   const hb=$('[data-hidden]'),hu=$('ul',hb);
   if(hb){hb.hidden=false;
    if(!hidden.length){const li=document.createElement('li');li.className='empty';li.textContent=ko?'임시조치 중인 글·댓글이 없습니다.':'Nothing is hidden.';hu.append(li);}
    for(const it of hidden)hu.append(row(it,`${ko?'임시조치':'Hidden'} ${when(it.hiddenAt)}${it.reason?` · ${it.reason}`:''}`,[['unhide',ACTION.unhide||'Restore']]));
   }
   const lg=$('[data-log]');
   for(const x of log){const li=document.createElement('li');li.className='fine';li.textContent=`${when(x.created_at)} · ${ACTION[x.action]||x.action} · ${KIND[x.target_kind]||x.target_kind} ${String(x.target_id).slice(0,14)} · ${x.reason||''}`;lg.append(li);}
  }
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
