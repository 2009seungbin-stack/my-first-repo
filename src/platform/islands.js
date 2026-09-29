/** Nerulio 2.0 page islands: the only JavaScript on channel, post and community pages.
 * Pages are complete without it (server-rendered, edge-cached, identical for everyone); this module
 * adds the reader's own state and the write actions through /api/v2:
 *  account · follow · post/comment votes · compat/issue/rollout reports · comments and replies ·
 *  write form · new-posts bar · countdown · share · the sign-in sheet (configured providers only).
 * Signed out, posts, comments, votes, reports and images go through the anonymous path (nickname + edit
 * password; the server adds today's ID) when the deployment allows it: /api/v2/state says how (anon, uploads).
 * The Turnstile check runs in the /verify/ frame (its own CSP) only when a write asks for it. */
import {buttonsHTML,validReturn} from '../signin-brands.js';
const L=document.documentElement.lang==='en'?'en':document.documentElement.lang==='ja'?'ja':'ko';
const T={
 ko:{login:'로그인',signInTitle:'로그인하고 참여하기',signInNote:'글·댓글·구독·추천·신고는 로그인하면 할 수 있어요. 읽기는 로그인 없이 됩니다.',signInClose:'닫기',follow:'구독',following:'✓ 구독 중',sent:'반영했어요',thanks:'리포트를 남겼어요. 고마워요!',error:'잠시 후 다시 시도해 주세요.',
  rate:'너무 빨라요. 1분 뒤에 다시 해 주세요.',own:'내 글에는 추천할 수 없어요.',newPosts:n=>`↑ 새 글 ${n}개 · 눌러서 보기`,replyTo:n=>`↳ ${n}님에게 답글`,cancel:'취소',copied:'링크를 복사했어요',posting:'등록 중…',empty:'내용을 입력해 주세요.',flagged:'신고를 접수했어요. 운영자가 확인합니다.',voted:'반영했어요. 한 사람당 한 표로 셉니다.',commentPh:'댓글 입력',followed:'구독했어요. 바뀐 것과 새 글은 내 레이더에 모입니다.',unfollowed:'구독을 취소했어요.',addDetails:'환경·증상까지 리포트로 남기기 ›',flagUpdated:r=>`이미 신고한 대상이에요. 사유를 “${r}”에서 바꿨어요.`,backToPost:'원래 글로 돌아가기',
  challenge:'사람인지 확인할게요. 잠시만 기다려 주세요.',challengeFailed:'사람 확인이 끝나지 않았어요. 다시 시도해 주세요.',close:'닫기',needPassword:'비밀번호(4~32자)를 입력해 주세요. 나중에 수정·삭제할 때 필요해요.',
  noBotCheck:'테스트 환경이라 봇 확인이 꺼져 있어요. 대신 로그인 없이 쓰는 한도가 더 낮아요.',anonOff:'로그인 없이 쓰기는 아직 준비 중이에요. 로그인하면 쓸 수 있어요.',
  pwTitle:'비밀번호 확인',pwLabel:'글을 쓸 때 정한 비밀번호',pwOk:'확인',deleted:'삭제했어요.',posted:'등록했어요.',held:'등록했어요. 금지어 검사로 운영자 확인 뒤에 보입니다.',hiddenNow:'신고가 접수되어 이 글은 확인 전까지 숨겨졌어요.',
  imgTooMany:n=>`이미지는 글 하나에 ${n}장까지예요.`,imgFail:'이미지를 올리지 못했어요.',imgBadType:'이 형식은 읽을 수 없어요. JPEG·PNG·WebP로 저장해 올려 주세요.',imgUploading:'이미지를 올리는 중이에요. 끝나면 등록해 주세요.',imgRemove:'이미지 빼기',imgAlt:'이미지',
  reportNeedsLogin:'구조화 리포트는 로그인하고 쓸 수 있어요. 다른 말머리로는 로그인 없이 쓸 수 있어요.',editSave:'수정 저장'},
 en:{login:'Sign in',signInTitle:'Sign in to take part',signInNote:'Posts, comments, follows, votes and reports need an account. Reading does not.',signInClose:'Close',follow:'Follow',following:'✓ Following',sent:'Saved',thanks:'Report saved. Thank you!',error:'Please try again in a moment.',
  rate:'Too fast. Please wait a minute.',own:'You cannot vote on your own post.',newPosts:n=>`↑ ${n} new posts · show`,replyTo:n=>`↳ Reply to ${n}`,cancel:'Cancel',copied:'Link copied',posting:'Posting…',empty:'Please write something.',flagged:'Report received. A moderator will review it.',voted:'Counted. One vote per person.',commentPh:'Write a comment',followed:'Following. Changes and posts go to My Radar.',unfollowed:'Unfollowed.',addDetails:'Add details in a report ›',flagUpdated:r=>`You had already reported this; the reason was changed from “${r}”.`,backToPost:'Back to the post',
  challenge:'Checking that you are human. One moment, please.',challengeFailed:'The human check did not finish. Please try again.',close:'Close',needPassword:'Enter a password (4–32 characters). You need it to edit or delete later.',
  noBotCheck:'Test deployment: the bot check is off, so the limits for writing without an account are lower.',anonOff:'Writing without an account is not available yet. Sign in to write.',
  pwTitle:'Password',pwLabel:'The password you set when writing',pwOk:'OK',deleted:'Deleted.',posted:'Posted.',held:'Posted. It shows after a moderator checks it (blocked-word filter).',hiddenNow:'Reported: this is hidden until a moderator checks it.',
  imgTooMany:n=>`At most ${n} images per post.`,imgFail:'The image could not be uploaded.',imgBadType:'This format cannot be read. Save it as JPEG, PNG or WebP.',imgUploading:'Images are still uploading. Post when they are done.',imgRemove:'Remove image',imgAlt:'image',
  reportNeedsLogin:'Structured reports need an account; other tags work without one.',editSave:'Save'},
}[L==='ja'?'en':L];
// Japanese strings for what anonymous writing adds (the platform pages are ko/en today; ready for /ja/).
if(L==='ja')Object.assign(T,{challenge:'人間であることを確認しています。少々お待ちください。',challengeFailed:'確認が完了しませんでした。もう一度お試しください。',close:'閉じる',needPassword:'パスワード（4〜32文字）を入力してください。編集・削除に使います。',
 noBotCheck:'テスト環境のためボット確認がオフです。代わりにログインなしの上限が低くなっています。',anonOff:'ログインなしの投稿はまだ準備中です。ログインしてください。',pwTitle:'パスワード確認',pwLabel:'投稿時に決めたパスワード',pwOk:'確認',deleted:'削除しました。',posted:'投稿しました。',
 held:'投稿しました。禁止語チェックのため、運営の確認後に表示されます。',hiddenNow:'通報を受け、確認が終わるまで非表示になりました。',imgTooMany:n=>`画像は1投稿につき${n}枚までです。`,imgFail:'画像をアップロードできませんでした。',imgBadType:'この形式は読み込めません。JPEG・PNG・WebPで保存してください。',
 imgUploading:'画像をアップロード中です。完了してから投稿してください。',imgRemove:'画像を外す',imgAlt:'画像',reportNeedsLogin:'構造化レポートはログインが必要です。',editSave:'保存',error:'しばらくしてからもう一度お試しください。',rate:'操作が速すぎます。1分後にもう一度お試しください。',empty:'内容を入力してください。',flagged:'通報を受け付けました。運営が確認します。',voted:'反映しました。1人1票です。'});
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
/** A message that must survive the reload or redirect right after an action. */
function toastNext(text){try{sessionStorage.setItem('n2-toast',text);}catch{}}
function toastPending(){try{const t=sessionStorage.getItem('n2-toast');if(t){sessionStorage.removeItem('n2-toast');toast(t);}}catch{}}
/** Configured sign-in providers (from /api/v2/state). */
let providers=[];
/** Member passkeys — the 고정닉 path (/api/v2/state `passkey`: {signin,signup,turnstileSiteKey}), or null. */
let passkey=null;
const passkeyOn=()=>!!passkey?.signin&&!!window.PublicKeyCredential;
/** This page, as the place sign-in comes back to. */
const here=()=>validReturn(location.pathname+location.search)?location.pathname+location.search:location.pathname;
/** Sign in without leaving the page: a sheet with 지문으로 로그인 (and 지문으로 가입 with a nickname) first,
 * then one branded button per configured OAuth provider. With neither available the account page explains
 * that sign-in is not available yet. The passkey code (src/passkey-client.js) loads only when the sheet opens. */
async function signInSheet(){
 if(!providers.length&&!passkeyOn()){location.href=`/${L}/account/?return=${encodeURIComponent(here())}`;return;}
 let d=$('#n2-signin');
 if(!d){
  const pk=passkeyOn()?await import('../passkey-client.js').catch(()=>null):null;
  if(!pk&&!providers.length){location.href=`/${L}/account/?return=${encodeURIComponent(here())}`;return;}
  if($('#n2-signin'))return signInSheet();   // opened twice while the module loaded
  d=document.createElement('dialog');d.id='n2-signin';d.className='signin';d.setAttribute('aria-labelledby','n2-signin-t');
  const h=document.createElement('h2');h.id='n2-signin-t';h.textContent=T.signInTitle;
  const p=document.createElement('p');p.textContent=T.signInNote;
  const x=document.createElement('button');x.type='button';x.className='btn x';x.textContent=T.signInClose;x.addEventListener('click',()=>d.close());
  d.append(h,p);
  if(pk){
   const pt=(k,v)=>pk.passkeyText(L,k,v);
   const msg=document.createElement('p');msg.className='pk-msg';msg.hidden=true;msg.setAttribute('role','alert');
   const fail=r=>{const m=pk.passkeyMessage(L,r);msg.textContent=m;msg.hidden=!m;};
   const done=text=>{toastNext(text);location.reload();};
   const box=document.createElement('div');box.className='sibs';
   const b=document.createElement('button');b.type='button';b.className='sib sib-passkey';b.dataset.provider='passkey';b.innerHTML=pk.PASSKEY_ICON;
   const bl=document.createElement('span');bl.textContent=pt('signIn');b.append(bl);box.append(b);d.append(box);
   b.addEventListener('click',async()=>{b.disabled=true;msg.hidden=true;const r=await pk.passkeySignIn();b.disabled=false;if(r.ok)done(pt('signedIn'));else fail(r);});
   if(passkey.signup){
    const det=document.createElement('details');det.className='pk-new';
    const sm=document.createElement('summary');sm.textContent=pt('newHere');
    const f=document.createElement('form');f.className='pk-form';
    const lb=document.createElement('label');lb.textContent=pt('nickname');
    const inp=document.createElement('input');inp.name='displayName';inp.minLength=2;inp.maxLength=20;inp.required=true;inp.autocomplete='nickname';lb.append(inp);
    const hint=document.createElement('p');hint.className='pk-warn';hint.textContent=pt('nickHint');
    const sb=document.createElement('button');sb.type='submit';sb.className='btn p';sb.textContent=pt('signUp');
    const warn=document.createElement('p');warn.className='pk-warn';warn.textContent=pt('warn');
    f.append(lb,hint,sb,warn);det.append(sm,f);d.append(det);
    f.addEventListener('submit',async e=>{
     e.preventDefault();const name=inp.value.trim();
     if([...name].length<2||[...name].length>20)return fail({code:'BAD_REQUEST',field:'displayName'});
     sb.disabled=true;msg.hidden=true;
     const r=await pk.passkeySignUp({displayName:name,locale:L,getToken:k=>pk.turnstileToken(k||passkey.turnstileSiteKey,'signup',{base:'/',lang:L,title:pt('challenge'),close:pt('close')})});
     sb.disabled=false;if(r.ok)done(pt('welcome',{n:r.data?.displayName||name}));else fail(r);
    });
   }
   d.append(msg);
   if(providers.length){const or=document.createElement('p');or.className='pk-or';or.textContent=pt('or');d.append(or);}
  }
  if(providers.length)d.insertAdjacentHTML('beforeend',buttonsHTML(providers,L,here()));
  d.append(x);
  d.addEventListener('click',e=>{if(e.target===d)d.close();});
  document.body.append(d);
 }
 if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
 d.querySelector('.sib')?.focus();
}
/** The API's messages are English; Korean pages show these instead (unknown ones fall back to T.error). */
const KO_ERR=[[/^This nickname is taken/,'이미 쓰는 닉네임이에요. 다른 닉네임을 골라 주세요.'],[/^This nickname is reserved/,'사용할 수 없는 닉네임이에요.'],[/^displayName must be (\d+)–(\d+)/,'닉네임은 $1~$2자로 써 주세요.'],
 [/^(title|body|reason|note) must be (\d+)–(\d+)/,(m,f,a,b)=>`${{title:'제목은',body:'내용은',reason:'사유는',note:'설명은'}[f]} ${a}~${b}자로 써 주세요.`],[/^(\w+) is required/,'필수 항목을 입력해 주세요.'],
 [/^You cannot vote on your own/,'내 글에는 추천할 수 없어요.'],[/^This account is temporarily restricted/,'이용이 잠시 제한된 계정이에요.'],[/^This account cannot post/,'이 계정은 글을 쓸 수 없어요.'],
 [/^Comments are closed/,'댓글이 닫힌 글이에요.'],[/^Post not found|^No such post/,'글을 찾을 수 없어요. 삭제되었거나 숨겨졌을 수 있어요.'],[/^The comment you replied to is gone/,'답글을 단 댓글이 사라졌어요.'],
 [/^This tag cannot be used/,'이 채널에서는 쓸 수 없는 말머리예요.'],[/^Not hidden/,'숨겨진 상태가 아니에요. 새로고침해 주세요.'],[/^Already hidden/,'이미 임시조치된 대상이에요.'],[/^Already deleted/,'작성자가 이미 삭제했어요.'],
 [/^Only a higher role/,'더 높은 권한만 이 계정을 처리할 수 있어요.'],[/^You cannot moderate your own/,'자기 계정은 처리할 수 없어요.'],[/^This action does not apply/,'이 대상에는 쓸 수 없는 조치예요.'],
 [/^Only questions have an accepted/,'질문 글만 답변을 채택할 수 있어요.'],[/^Invalid reason/,'사유를 선택해 주세요.'],[/^Nothing to report at this address/,'신고할 대상을 찾을 수 없어요.'],[/^tokens_per_s must be/,'토큰/초는 0~5000 사이로 적어 주세요.'],
 [/^A benchmark is a model measured on a GPU/,'모델과 GPU를 골라 주세요.'],[/^This property cannot be proposed/,'이 항목은 제안할 수 없어요.'],[/^A source link/,'출처 링크(https://…)를 넣어 주세요.'],[/^The value does not fit/,'값의 형식이 이 항목과 맞지 않아요. (날짜는 2026-10-20, 숫자는 숫자만)'],[/^Already reviewed/,'이미 처리된 제안이에요.'],[/board is not open yet/,'이 채널 게시판은 아직 준비 중이에요.'],[/^Too many open proposals/,'검토를 기다리는 제안이 많아요. 처리된 뒤에 다시 보내 주세요.'],[/^A compatibility report needs a target/,'호환 대상을 골라 주세요.'],[/^Invalid version/,'버전 형식이 올바르지 않아요.'],
 [/^password must be (\d+)–(\d+)/,'비밀번호는 $1~$2자로 써 주세요.'],[/^name must be (\d+)–(\d+)/,'닉네임은 $1~$2자로 써 주세요.'],[/^This nickname belongs to a member/,'회원(고정닉)이 쓰는 닉네임이에요. 다른 닉네임을 써 주세요.'],
 [/^Wrong password/,'비밀번호가 맞지 않아요.'],[/^Too many wrong passwords/,'비밀번호를 여러 번 틀렸어요. 1시간 뒤에 다시 해 주세요.'],
 [/^Without an account a (post|comment) may contain at most (\d+) link/,(m,k,n)=>`로그인 없이 쓰는 ${k==='post'?'글':'댓글'}에는 링크를 ${n}개까지 넣을 수 있어요.`],
 [/^Links are allowed from your second/,'오늘 처음 쓰는 글·댓글에는 링크를 넣을 수 없어요. 링크 없이 한 번 쓴 뒤에 넣어 주세요.'],[/^The same text was just posted/,'방금 같은 내용이 올라왔어요. 다른 내용으로 써 주세요.'],
 [/^This text contains a blocked/,'금지된 단어나 링크가 들어 있어요.'],[/^Anonymous writing from this network is blocked/,'이 네트워크에서는 로그인 없이 쓰기가 잠시 차단되었어요.'],
 [/^Today's limit for writing without an account/,'이 네트워크에서 오늘 로그인 없이 쓸 수 있는 양을 다 썼어요. 로그인하거나 내일 다시 써 주세요.'],[/^Today's image limit/,'오늘 올릴 수 있는 이미지 수를 다 썼어요.'],
 [/^At most (\d+) images per post/,'이미지는 글 하나에 $1장까지예요.'],[/^An image in the text is not one you uploaded/,'본문에 직접 올리지 않았거나 삭제된 이미지가 있어요.'],[/^Images can be added to posts/,'이미지는 글에만 넣을 수 있어요.'],
 [/^Images must be at most (\d+) MB/,'이미지는 $1MB까지 올릴 수 있어요.'],[/^Images must be at most (\d+)×/,'이미지는 가로·세로 $1픽셀까지예요.'],[/^Only JPEG, PNG and WebP|^GIF files are not accepted|^Send the image bytes/,'JPEG·PNG·WebP 이미지만 올릴 수 있어요.'],
 [/^Animated images are not accepted/,'움직이는 이미지는 올릴 수 없어요.'],[/^This file does not look like|^Broken|^JPEG |^PNG |^WebP |^Empty file|^The image has no size/,'이미지 파일을 읽을 수 없어요.'],
 [/^The human check failed|^Please confirm you are human/,'사람 확인에 실패했어요. 다시 시도해 주세요.'],[/^Anonymous writing needs Turnstile/,'로그인 없이 쓰기는 아직 준비 중이에요. 로그인해 주세요.'],[/^Image uploads need/,'이미지 올리기는 아직 준비 중이에요.'],
 [/^Report the post or comment instead/,'글이나 댓글을 신고해 주세요.'],[/^Only anonymous writers are banned/,'회원은 차단 대신 이용 제한을 써 주세요.'],[/^This item is older than 90 days/,'90일이 지난 글이라 네트워크 정보가 없어 차단할 수 없어요.'],[/^Already deleted/,'이미 삭제된 대상이에요.'],
 [/^Anonymous writers are banned by network/,'비로그인 작성자는 글·댓글의 차단 버튼으로 막아 주세요.']];
function message(m){
 if(L!=='ko')return m;
 for(const [re,ko] of KO_ERR){const x=re.exec(m);if(x)return typeof ko==='function'?ko(...x):ko.replace(/\$(\d)/g,(_,i)=>x[i]);}
 return T.error;
}
function explain(res){
 if(res.code==='LOGIN_REQUIRED'){signInSheet();return;}
 if(res.code==='RATE_LIMITED'&&!/open proposals/.test(res.data?.error?.message||''))return toast(T.rate);
 if(res.data?.error?.message&&res.status<500)return toast(message(res.data.error.message));
 toast(T.error);
}
/** How writing without an account works here (from /api/v2/state): {enabled, check:'turnstile'|'none'|'off', siteKey}. */
let ANON={enabled:false,check:'off',siteKey:''};
/** Turnstile inside the /verify/ frame (strict CSP there; this page only frames its own origin). Resolves
 * to a single-use token, or '' when the reader closes it. The Worker verifies the token. */
function challenge(siteKey){
 if(!/^[0-9A-Za-z_-]{1,100}$/.test(siteKey||''))return Promise.resolve('');
 const d=document.createElement('dialog');d.className='hc';
 const p=document.createElement('p');p.textContent=T.challenge;
 const f=document.createElement('iframe');f.title='Turnstile';f.src=`/verify/?sitekey=${encodeURIComponent(siteKey)}&action=community&lang=${L}`;
 const x=document.createElement('button');x.type='button';x.className='btn x';x.textContent=T.close;
 d.append(p,f,x);document.body.append(d);
 return new Promise(resolve=>{
  let token='';
  const onMessage=e=>{if(e.origin!==location.origin||e.source!==f.contentWindow||e.data?.type!=='nerulio-turnstile')return;if(typeof e.data.token==='string'&&e.data.token.length<=2048)token=e.data.token;d.close();};
  const timer=setTimeout(()=>d.open&&d.close(),180e3);
  addEventListener('message',onMessage);x.addEventListener('click',()=>d.close());
  d.addEventListener('close',()=>{clearTimeout(timer);removeEventListener('message',onMessage);d.remove();resolve(token);},{once:true});
  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
 });
}
/** A write without an account: when the server asks for the human check, run it once and retry with the token. */
async function anonApi(path,body){
 let res=await api(path,body);
 if(res.code==='CHALLENGE_REQUIRED'||res.code==='CHALLENGE_FAILED'){
  const token=await challenge(res.data?.error?.siteKey||ANON.siteKey);
  if(!token){toast(T.challengeFailed);return null;}
  res=await api(path,{...body,turnstileToken:token});
 }
 if(!res.ok){if(res.code==='NOT_CONFIGURED'){toast(T.anonOff);signInSheet();return null;}explain(res);return null;}
 return res.data||{};
}
/** Run a write. Signed out: writes that work without an account (anon:true) go the anonymous way when this
 * deployment allows it; everything else asks the reader to sign in first. */
async function write(path,body,signedIn,o={}){
 if(!signedIn){
  if(o.anon&&ANON.enabled)return anonApi(path,body);
  // Say why before leaving the page for sign-in.
  signInSheet();return null;
 }
 const res=await api(path,body);
 if(!res.ok){explain(res);return null;}
 return res.data||{};
}
/** Remembered nickname (this browser only). */
const nick={get(){try{return localStorage.getItem('n2-anon-name')||'';}catch{return '';}},set(v){try{v?localStorage.setItem('n2-anon-name',v):localStorage.removeItem('n2-anon-name');}catch{}}};
/** The nickname/password fields of a form: shown for signed-out readers when anonymous writing is on. */
function anonForm(form,signedIn){
 const box=$('[data-anon-fields]',form);if(!box)return null;
 if(signedIn||!ANON.enabled){box.hidden=true;return null;}
 box.hidden=false;
 const name=$('input[name="anonName"]',box),pw=$('input[name="anonPassword"]',box);
 if(name&&!name.value)name.value=nick.get();
 const note=$('[data-anon-notice]',box);if(note&&ANON.check==='none'){note.hidden=false;note.textContent=T.noBotCheck;}
 return {fields(){const v=(name?.value||'').trim();return {name:v||undefined,password:pw?.value||''};},
  valid(){if(!pw||pw.value.length<4||pw.value.length>32){toast(T.needPassword);pw?.focus();return false;}return true;},
  remember(){nick.set((name?.value||'').trim());if(pw)pw.value='';}};
}
/** Ask for an anonymous item's password; resolves to it or ''. */
function askPassword(){
 const d=document.createElement('dialog');d.className='pw';
 const f=document.createElement('form');f.method='dialog';
 const h=document.createElement('b');h.textContent=T.pwTitle;
 const lb=document.createElement('label');lb.textContent=T.pwLabel;const i=document.createElement('input');i.type='password';i.minLength=4;i.maxLength=32;i.required=true;i.autocomplete='current-password';lb.append(i);
 const acts=document.createElement('div');acts.className='acts';
 const c=document.createElement('button');c.type='button';c.className='btn';c.textContent=T.cancel;
 const ok=document.createElement('button');ok.type='submit';ok.className='btn p';ok.textContent=T.pwOk;acts.append(c,ok);
 f.append(h,lb,acts);d.append(f);document.body.append(d);
 return new Promise(resolve=>{
  let v='';c.addEventListener('click',()=>d.close());
  f.addEventListener('submit',e=>{e.preventDefault();v=i.value;d.close();});
  d.addEventListener('close',()=>{d.remove();resolve(v);},{once:true});
  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');i.focus();
 });
}

/** Downscale and re-encode a picked image on this device: canvas → WebP (JPEG where the browser cannot
 * encode WebP). Re-encoding drops EXIF, including GPS location. A GIF becomes its first frame. */
async function prepareImage(file,maxSide=2560,maxBytes=5*1024*1024){
 const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
 let scale=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
 for(let attempt=0;attempt<4;attempt++){
  const w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  const toBlob=(type,q)=>new Promise(r=>c.toBlob(r,type,q));
  g.drawImage(bmp,0,0,w,h);
  let blob=await toBlob('image/webp',attempt?0.75:0.85);
  if(!blob||blob.type!=='image/webp'){g.fillStyle='#fff';g.globalCompositeOperation='destination-over';g.fillRect(0,0,w,h);g.globalCompositeOperation='source-over';blob=await toBlob('image/jpeg',attempt?0.75:0.88);}
  if(blob&&blob.size<=maxBytes){bmp.close?.();return blob;}
  scale*=0.75;
 }
 bmp.close?.();throw Error('too large');
}
/** Upload one prepared image with progress (XHR); the human check is asked once and passed as a header. */
function sendImage(blob,token,onProgress){
 return new Promise(resolve=>{
  const x=new XMLHttpRequest();x.open('POST','/api/v2/uploads');x.withCredentials=true;x.setRequestHeader('content-type',blob.type);
  if(token)x.setRequestHeader('x-turnstile-token',token);
  x.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total);};
  x.onload=()=>{let data=null;try{data=JSON.parse(x.responseText);}catch{}resolve({ok:x.status>=200&&x.status<300,status:x.status,data,code:data?.error?.code||''});};
  x.onerror=()=>resolve({ok:false,status:0,data:null,code:'NETWORK'});
  x.send(blob);
 });
}
/** The write page's image picker: previews, progress, remove; each finished image is inserted into the body
 * as ![이미지](/u/<id>/full.webp). Hidden when this deployment has no image storage. */
function imagePicker(wf,cfg,signedIn){
 const box=$('[data-image-picker]',wf),input=box&&$('[data-image-input]',box),list=box&&$('[data-image-list]',box),ta=$('textarea[name="body"]',wf);
 if(!box||!input||!list||!ta||!cfg||(!signedIn&&!ANON.enabled))return null;
 box.hidden=false;let pending=0;
 const max=Number(cfg.perPost)||10;
 const count=()=>$$('li',list).length;
 const insert=md=>{const at=ta.selectionStart??ta.value.length;const before=ta.value.slice(0,at),after=ta.value.slice(at);const pre=before&&!before.endsWith('\n')?'\n':'';ta.value=`${before}${pre}${md}\n${after}`;ta.dispatchEvent(new Event('input',{bubbles:true}));};
 input.addEventListener('change',async()=>{
  const files=[...input.files||[]];input.value='';
  if(count()+files.length>max)toast(T.imgTooMany(max));
  for(const file of files.slice(0,Math.max(0,max-count()))){
   const li=document.createElement('li'),img=document.createElement('img'),bar=document.createElement('span'),rm=document.createElement('button');
   img.alt='';bar.className='bar';bar.style.width='0%';rm.type='button';rm.className='rm';rm.textContent='×';rm.setAttribute('aria-label',T.imgRemove);
   li.append(img,bar,rm);list.append(li);pending++;
   rm.addEventListener('click',()=>{const md=li.dataset.md;if(md){ta.value=ta.value.split('\n').filter(line=>line.trim()!==md).join('\n');ta.dispatchEvent(new Event('input',{bubbles:true}));}if(li.dataset.busy){pending--;}URL.revokeObjectURL(img.src);li.remove();});
   li.dataset.busy='1';
   const fail=msg=>{li.classList.add('err');const m=document.createElement('span');m.className='msg';m.textContent=msg;li.append(m);if(li.dataset.busy){delete li.dataset.busy;pending--;}};
   let blob;
   try{blob=await prepareImage(file,2560,Number(cfg.maxBytes)||5*1024*1024);}catch{fail(T.imgBadType);continue;}
   img.src=URL.createObjectURL(blob);
   let res=await sendImage(blob,'',p=>{bar.style.width=`${Math.round(p*100)}%`;});
   if(res.code==='CHALLENGE_REQUIRED'||res.code==='CHALLENGE_FAILED'){const token=await challenge(res.data?.error?.siteKey||ANON.siteKey);if(token)res=await sendImage(blob,token,p=>{bar.style.width=`${Math.round(p*100)}%`;});}
   if(!li.isConnected)continue;
   if(!res.ok){fail(res.data?.error?.message?message(res.data.error.message):T.imgFail);if(res.code==='NOT_CONFIGURED')box.hidden=true;continue;}
   bar.style.width='100%';delete li.dataset.busy;pending--;
   const md=`![${T.imgAlt}](${res.data.url})`;li.dataset.md=md;li.dataset.id=res.data.id;insert(md);
  }
 });
 return {busy:()=>pending>0};
}

/** Tag search (/api/v2/tags): calls `show` with the matches, debounced; an older answer never replaces a newer one. */
function tagSearch(input,show){
 let timer=0,seq=0;
 input.addEventListener('input',()=>{
  clearTimeout(timer);const q=input.value.trim();
  if(!q){seq++;show([],q);return;}
  timer=setTimeout(async()=>{const n=++seq;const r=await api(`/tags?q=${encodeURIComponent(q)}&l=${L}`);if(n===seq)show(r.ok?r.data.tags||[]:[],q);},200);
 });
}
/** The write form's tags: up to data-limit entities, as hidden `tags` inputs in the writer's order. */
function tagPicker(wf){
 const box=$('[data-tag-picker]',wf);if(!box)return null;
 const max=Number(box.dataset.limit)||3,sel=$('[data-tag-selected]',box),count=$('[data-tag-count]',box),line=$('[data-tag-line]',box);
 const wrap=$('[data-tag-search-wrap]',box),input=$('[data-tag-search]',box),results=$('[data-tag-results]',box);
 const list=()=>$$('.wtag',sel).map(s=>({id:$('input',s).value,name:s.dataset.name||s.firstChild?.nextSibling?.textContent||''}));
 const render=()=>{
  const now=list();
  if(count)count.textContent=`${now.length}/${max}`;
  const full=now.length>=max;
  for(const b of $$('[data-add-tag]',box)){const on=now.some(x=>x.id===b.dataset.addTag);b.hidden=on;b.disabled=full;}
  if(input){input.disabled=full;input.placeholder=full?(L==='ko'?`태그는 ${max}개까지예요`:`Up to ${max} tags`):input.dataset.ph||input.placeholder;}
  if(line)line.textContent=now.length?(L==='ko'?`${now.map(x=>x.name).join(', ')} 태그 페이지에도 보여요.`:`Also shows on ${now.map(x=>x.name).join(', ')}.`):(L==='ko'?'태그 없이도 등록돼요. 달면 그 대상 페이지에도 보여요.':'Tags are optional; a tagged post also shows on that page.');
 };
 const add=(/** @type {{id:string,name:string}} */ x)=>{
  if(!x?.id||list().some(y=>y.id===x.id))return;
  if(list().length>=max){toast(L==='ko'?`태그는 ${max}개까지 달 수 있어요.`:`Up to ${max} tags.`);return;}
  const s=document.createElement('span');s.className='wtag';s.dataset.name=x.name;
  const h=document.createElement('input');h.type='hidden';h.name='tags';h.value=x.id;
  const b=document.createElement('button');b.type='button';b.dataset.tagRemove='';b.setAttribute('aria-label',L==='ko'?'태그 빼기':'Remove tag');b.textContent='×';
  s.append(h,document.createTextNode(x.name),b);sel.append(s);render();wf.dispatchEvent(new Event('input',{bubbles:true}));
 };
 for(const s of $$('.wtag',sel))s.dataset.name=s.textContent.replace(/×$/,'').trim();
 sel.addEventListener('click',e=>{const b=e.target.closest?.('[data-tag-remove]');if(b){b.closest('.wtag').remove();render();wf.dispatchEvent(new Event('input',{bubbles:true}));}});
 box.addEventListener('click',e=>{const b=e.target.closest?.('[data-add-tag]');if(b)add({id:b.dataset.addTag,name:b.dataset.name||b.textContent});});
 if(wrap&&input&&results){
  wrap.hidden=false;input.dataset.ph=input.placeholder;
  tagSearch(input,(tags,q)=>{
   results.textContent='';results.hidden=!q;
   if(!q)return;
   if(!tags.length){const li=document.createElement('li');li.className='fine';li.textContent=L==='ko'?'찾는 태그가 없어요. 아래에서 새 태그를 제안할 수 있어요.':'No match. You can propose a new tag below.';results.append(li);return;}
   for(const t of tags){const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=t.name;const v=document.createElement('span');v.className='fine';v.textContent=` · ${t.type}`;b.append(v);
    b.addEventListener('click',()=>{add({id:t.id,name:t.name});input.value='';results.hidden=true;results.textContent='';input.focus();});li.append(b);results.append(li);}
  });
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('button',results)?.click();}if(e.key==='Escape'){results.hidden=true;}});
 }
 render();
 return {add,list};
}
/** Pinned channels: kept in this browser without an account and moved to the account on sign-in. */
const localPins={get(){try{const v=JSON.parse(localStorage.getItem('n2-pins')||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,10):[];}catch{return [];}},set(v){try{v.length?localStorage.setItem('n2-pins',JSON.stringify(v)):localStorage.removeItem('n2-pins');}catch{}}};
/** Tags the reader looked at lately (this browser), for the channel sheet. */
const recentTags={get(){try{const v=JSON.parse(localStorage.getItem('n2-recent-tags')||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x.id==='string'&&typeof x.url==='string'&&x.url.startsWith('/')):[];}catch{return [];}},
 add(x){try{localStorage.setItem('n2-recent-tags',JSON.stringify([x,...recentTags.get().filter(y=>y.id!==x.id)].slice(0,8)));}catch{}}};
/** The channel bar in the reader's order (pinned first), the pin buttons, 내 채널 lists and the channel sheet. */
async function channels(signedIn){
 const barLinks=$('[data-channel-links]');
 const known=$$('a[data-ch]',barLinks||document).map(a=>a.dataset.ch).filter(Boolean);
 const valid=(/** @type {string[]} */ v)=>v.filter((c,i)=>known.includes(c)&&v.indexOf(c)===i);
 let pins=valid(localPins.get());
 if(signedIn){
  const r=await api('/pins');
  if(r.ok&&Array.isArray(r.data?.pins)){
   const server=valid(r.data.pins),merged=[...server,...pins.filter(c=>!server.includes(c))];
   if(merged.length>server.length){const w=await api('/pins',{channels:merged});if(w.ok)localPins.set([]);}else localPins.set([]);
   pins=merged;
  }
 }
 const nameOf=id=>$(`a[data-ch="${id}"]`,barLinks||document)?.textContent||id;
 const hrefOf=id=>$(`a[data-ch="${id}"]`,barLinks||document)?.getAttribute('href')||'#';
 const apply=()=>{
  if(barLinks){const links=$$('a[data-ch]',barLinks);for(const id of [...pins].reverse()){const a=links.find(x=>x.dataset.ch===id);if(a){a.classList.add('pinned');barLinks.prepend(a);}}for(const a of links)if(!pins.includes(a.dataset.ch)){a.classList.remove('pinned');}
   const rest=links.filter(a=>!pins.includes(a.dataset.ch)).sort((a,b)=>known.indexOf(a.dataset.ch)-known.indexOf(b.dataset.ch));for(const a of rest)barLinks.append(a);}
  for(const b of $$('[data-pin]'))b.setAttribute('aria-pressed',String(pins.includes(b.dataset.pin)));
  const my=$('[data-my-channels]'),ml=$('[data-my-list]');
  if(my&&ml){my.hidden=!pins.length;ml.textContent='';for(const id of pins){const li=document.createElement('li'),a=document.createElement('a');a.href=hrefOf(id);a.textContent=nameOf(id);const up=document.createElement('button');up.type='button';up.className='lnk';up.textContent='↑';up.setAttribute('aria-label',L==='ko'?'앞으로':'Move up');up.hidden=pins[0]===id;up.addEventListener('click',()=>{const i=pins.indexOf(id);if(i>0){pins.splice(i,1);pins.splice(i-1,0,id);save();}});li.append(a,up);ml.append(li);}}
  const side=$('[data-my-channels-side]');
  if(side){for(const li of $$('li[data-pinned]',side))li.remove();for(const id of [...pins].reverse()){const li=document.createElement('li');li.dataset.pinned=id;const a=document.createElement('a');a.className='tt';a.href=hrefOf(id);a.textContent=nameOf(id);li.append(a);side.prepend(li);}}
 };
 const save=async()=>{
  apply();
  if(signedIn){const r=await api('/pins',{channels:pins});if(!r.ok)explain(r);}else localPins.set(pins);
 };
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-pin]');if(!b)return;
  const id=b.dataset.pin;if(!known.includes(id))return;
  pins=pins.includes(id)?pins.filter(x=>x!==id):[...pins,id];
  toast(pins.includes(id)?(L==='ko'?`${nameOf(id)} 채널을 고정했어요. 채널 바 앞에 와요.`:`Pinned ${nameOf(id)}.`):(L==='ko'?'고정을 풀었어요.':'Unpinned.'));
  save();
 });
 apply();
 // The sheet (전체 채널): a bottom sheet on phones, a dialog on wide screens.
 const sheet=$('#chsheet');
 if(sheet){
  const open=()=>{
   const rt=$('[data-recent-tags]',sheet),rl=$('[data-recent-list]',sheet),list=recentTags.get();
   if(rt&&rl){rt.hidden=!list.length;rl.textContent='';for(const x of list){const a=document.createElement('a');a.className='rtag';a.href=x.url;a.textContent=x.name;rl.append(a);}}
   if(typeof sheet.showModal==='function'){if(!sheet.open)sheet.showModal();}else sheet.setAttribute('open','');
  };
  for(const a of $$('[data-open-sheet]'))a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();open();});
  for(const b of $$('[data-close-sheet]',sheet))b.addEventListener('click',()=>sheet.close());
  sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close();});
  const q=$('[data-sheet-q]',sheet),res=$('[data-sheet-results]',sheet);
  if(q&&res)tagSearch(q,(tags,text)=>{
   res.textContent='';res.hidden=!text;if(!text)return;
   const low=text.toLowerCase();
   const chs=$$('.shg li a',sheet).filter(a=>a.textContent.toLowerCase().includes(low)||a.nextElementSibling?.textContent.toLowerCase().includes(low));
   for(const a of chs){const li=document.createElement('li'),x=document.createElement('a');x.href=a.getAttribute('href');x.textContent=a.textContent;const f=document.createElement('span');f.className='fine';f.textContent=L==='ko'?' · 채널':' · channel';x.append(f);li.append(x);res.append(li);}
   for(const t of tags){const li=document.createElement('li'),x=document.createElement('a');x.href=t.url;x.textContent=t.name;const f=document.createElement('span');f.className='fine';f.textContent=L==='ko'?' · 태그':' · tag';x.append(f);li.append(x);res.append(li);}
   if(!res.children.length){const li=document.createElement('li');li.className='fine';li.textContent=L==='ko'?'찾는 채널·태그가 없어요.':'No match.';res.append(li);}
  });
 }
 // A tag page the reader opened goes to the sheet's 최근 본 태그.
 const tagHead=$('[data-tag-name][data-entity]');
 if(tagHead)recentTags.add({id:tagHead.dataset.entity,name:tagHead.dataset.tagName,url:location.pathname});
}

async function main(){
 const entity=$('[data-entity]')?.dataset.entity||'';
 const post=$('[data-post]')?.dataset.post||'';
 const q=new URLSearchParams();if(entity)q.set('entity',entity);if(post)q.set('post',post);
 const st=(await api('/state?'+q)).data||{signedIn:false,votes:{}};
 const signedIn=!!st.signedIn;
 providers=Array.isArray(st.providers)?st.providers:[];
 if(st.anon)ANON={enabled:!!st.anon.enabled,check:String(st.anon.check||'off'),siteKey:String(st.anon.siteKey||'')};
 passkey=st.passkey&&typeof st.passkey==='object'?st.passkey:null;
 toastPending();
 // Server-rendered sign-in links (header, 구독, 글쓰기 notes) open the sheet instead of the account page.
 if(!signedIn)document.addEventListener('click',e=>{const a=e.target.closest?.('a[data-signin]');if(a&&(providers.length||passkeyOn())&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();signInSheet();}});

 // Header search inside a channel: × drops the channel scope.
 for(const x of $$('[data-unscope]'))x.addEventListener('click',()=>{const f=x.closest('form');$('input[name="in"]',f)?.remove();x.parentElement.remove();const q=$('input[name="q"]',f);if(q){q.placeholder=L==='ko'?'검색':'Search';q.focus();}});

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
   lb.textContent='';const h=document.createElement('b');h.textContent=L==='ko'?'구독한 태그':'Followed tags';lb.append(h);
   const list=fr.ok?fr.data.follows.slice(0,8):[];
   if(!list.length){const p=document.createElement('span');p.className='fine';p.textContent=L==='ko'?'태그 페이지(Claude, RTX 5070 …)의 “구독”을 누르면 여기와 내 레이더에 모입니다.':'Follow tags to see them here and in My Radar.';lb.append(p);}
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
   // The unread count rides on the Radar link (a separate link squeezed the search box on phones).
   const rl=nav&&$('a[href$="/radar/"]',nav);
   if(rl&&d.unread>0){rl.href=`/${L}/radar/#mine`;const b=document.createElement('b');b.className='bdg';b.textContent=String(Math.min(99,d.unread));b.setAttribute('aria-label',(L==='ko'?'새 알림 ':'new alerts ')+d.unread);rl.append(' ',b);}
   if(mine){
    const ul=$(':scope > ul.rows',mine);mine.hidden=false;
    // 내 글의 새 댓글 / 내 댓글에 달린 답글, above the channel news.
    const rb=$('[data-replies]',mine);
    if(rb&&d.replies?.length){rb.hidden=false;const ru=$('ul',rb);
     for(const x of d.replies.slice(0,8)){const li=document.createElement('li');li.className='mr';
      const t=document.createElement('span');t.className='tm';const dt=new Date(x.at);t.textContent=`${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
      const a=document.createElement('a');a.className='tt'+(x.unread?' unread':'');a.href=x.url;a.textContent=`${x.author}: ${x.text}`;
      const c=document.createElement('span');c.className='chn fine';c.textContent=(x.why==='comment'?(L==='ko'?'내 댓글에 답글 · ':'reply · '):x.why==='proposal'?(L==='ko'?'정보 제안 · ':'proposal · '):(L==='ko'?'내 글에 댓글 · ':'on your post · '))+x.on;
      li.append(t,a,c);ru.append(li);}
     if(d.unreadReplies>0)api('/my-radar/seen',{lastChangeId:0,repliesSeenAt:Math.max(...d.replies.map(r=>r.at))});
    }
    const nowMs=Date.now();
    const all=[...d.changes.map(c=>({at:c.at,eventAt:c.eventAt,eventEnd:c.eventEnd,channel:c.channel,text:`${c.title}${c.detail?' — '+c.detail:''}`,url:c.url,unread:c.unread})),...d.posts.map(p=>({at:p.at,channel:p.channel,text:`${p.title}${p.comments?` [${p.comments}]`:''}`,url:p.url,unread:false}))];
    // Coming dates first, soonest first; then what is running now; then news by when it happened.
    const coming=all.filter(x=>x.eventAt&&x.eventAt>=nowMs).sort((a,b)=>a.eventAt-b.eventAt);
    const running=all.filter(x=>x.eventAt&&x.eventAt<nowMs&&x.eventEnd&&x.eventEnd>=nowMs).sort((a,b)=>a.eventEnd-b.eventEnd);
    const rest=all.filter(x=>!coming.includes(x)&&!running.includes(x)).map(x=>x.eventAt?{...x,eventAt:null,at:x.eventAt}:x).sort((a,b)=>b.at-a.at);
    const items=[...coming,...running.map(x=>({...x,running:true})),...rest].slice(0,30);
    if(!items.length){const li=document.createElement('li');li.textContent=d.following?(L==='ko'?'구독한 채널에 아직 새 소식이 없어요.':'Nothing new in your channels yet.'):(L==='ko'?'채널을 구독하면 바뀐 것과 새 글이 여기에 모입니다.':'Follow channels to see their changes and posts here.');ul.append(li);}
    const md=ms=>{const x=new Date(ms);return `${String(x.getMonth()+1).padStart(2,'0')}.${String(x.getDate()).padStart(2,'0')}`;};
    const dd=ms=>{const n=Math.round((new Date(ms).setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/864e5);return n===0?'D-DAY':n>0?`D-${n}`:`D+${-n}`;};
    for(const it of items){
     const li=document.createElement('li');li.className='mr';
     const t=document.createElement('span');t.className='tm';t.textContent=it.running?(L==='ko'?'진행 중':'Now'):it.eventAt?dd(it.eventAt):md(it.at);
     if(it.running&&it.eventEnd)it.text+=L==='ko'?` · 마감 ${dd(it.eventEnd)}`:` · ends ${dd(it.eventEnd)}`;
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
       for(const li of $$('.rows > li:not(.mfe)',bx)){const hit=$$('a[href]',li).some(a=>mine.has(new URL(a.href).pathname))||(li.dataset.ch||'').split(' ').some(p=>mine.has(p));li.hidden=on&&!hit;}
       for(const g of $$('.hist > li',bx))g.hidden=on&&!$$('.rows > li',g).some(li=>!li.hidden);
       // Say so when nothing is left, instead of an empty box.
       let em=$('.mfe',bx);const any=$$('.rows > li:not(.mfe)',bx).some(li=>!li.hidden&&!li.closest('li[hidden]'));
       if(on&&!any){if(!em){em=document.createElement('p');em.className='empty mfe';em.textContent=L==='ko'?'구독한 채널에 해당하는 항목이 없어요.':'Nothing here from channels you follow.';bx.append(em);}em.hidden=false;}else if(em)em.hidden=true;});
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
     const r=await write('/votes',{kind:'discussion',id:box.dataset.post,value:next},signedIn,{anon:true});if(!r)return;
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
   const r=await write('/votes',{kind:'comment',id,value:cur===1?0:1},signedIn,{anon:true});if(!r)return;st.votes[id]=cur===1?0:1;const n=a.querySelector('b');if(n)n.textContent=String(r.up);else a.textContent=`▲ ${r.up}`;a.classList.toggle('on',cur!==1);});
 }

 // Compat strip (game → Korean patch), driver issue, rollout
 for(const box of $$('[data-island="compat-vote"]')){
  const results=['works','works_with_issues','broken'];
  const key=`${box.dataset.subject}|${box.dataset.targetVersion||'*'}`;let mineNow=st.compat?.[key]||null;
  const strip=box.closest('.strip');
  const more=r=>{let a=$('.vmore',box.parentElement);if(!a&&box.dataset.write){a=document.createElement('a');a.className='vmore fine';box.after(a);}if(a){a.href=`${box.dataset.write}&result=${r}`;a.textContent=T.addDetails;}};
  if(mineNow){$$('button',box).forEach((x,j)=>x.classList.toggle('on',results[j]===mineNow));more(mineNow);}
  $$('button',box).forEach((b,i)=>{b.disabled=false;b.addEventListener('click',async()=>{
   const r=await write('/reports',{kind:'compat',entityId:box.dataset.subject,targetId:box.dataset.target,targetVersion:box.dataset.targetVersion||undefined,result:results[i]},signedIn);
   if(!r)return;
   $$('button',box).forEach((x,j)=>x.classList.toggle('on',j===i));
   // One vote per person: move this person's count from the old result to the new one.
   const bump=(res,d)=>{const n=strip&&$(`[data-tally] [data-n="${res}"]`,strip);if(n)n.textContent=String(Math.max(0,Number(n.textContent||0)+d));};
   if(mineNow!==results[i]){if(mineNow)bump(mineNow,-1);bump(results[i],1);mineNow=results[i];}
   // A click is a vote; details (setup, symptoms) go in a 리포트 post from the write page.
   more(results[i]);
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

 // "안 돼요": one tap, with or without an account (the anonymous path when this deployment allows it).
 const outage=(entityId,symptom)=>write('/reports',{kind:'issue',entityId,result:'broken',env:{symptom,platform:/Android|iPhone|iPad/.test(navigator.userAgent)?'mobile':'desktop'}},signedIn,{anon:true});
 const outageToast=r=>toast(r.counted===false?(L==='ko'?'이번 시간에는 이미 알렸어요. 한 사람당 1시간에 한 번 셉니다.':'Already counted this hour. One report per person per hour.'):(L==='ko'?'리포트를 반영했어요. 한 사람당 1시간에 한 번 셉니다.':'Counted. One report per person per hour.'));
 for(const box of $$('[data-island="outage-report"]')){
  const note=$('[data-report-note]',box);
  if(note&&!signedIn&&ANON.enabled)note.textContent=L==='ko'?'로그인 없이 한 번 누르면 사용자 리포트로 집계돼요 · 한 사람당 1시간에 한 번 · 공식 상태와 따로 셉니다':'One tap, no account needed · once per person per hour · counted apart from the official status';
  $$('button',box).forEach(b=>{b.disabled=false;b.addEventListener('click',async()=>{
   const r=await outage(box.dataset.entity,b.dataset.symptom);
   if(!r)return;
   // Show it counted: one report per person per hour, so only the first click adds to the total.
   const first=!$$('button.on',box).length&&r.counted!==false;$$('button',box).forEach(x=>x.classList.toggle('on',x===b));
   const tot=$('[data-total24]');if(tot&&first){const v=Number(tot.dataset.total24||0)+1;tot.dataset.total24=String(v);tot.textContent=String(v);}
   outageToast(r);
  });});
 }
 // The compact "안 돼요" beside each service on the home status box and the phone strip (a link to the
 // status page's report box without JavaScript).
 for(const a of $$('a[data-outage]'))a.addEventListener('click',async e=>{
  if(e.ctrlKey||e.metaKey||e.shiftKey)return;
  e.preventDefault();if(a.classList.contains('on'))return outageToast({counted:false});
  const r=await outage(a.dataset.outage,'down');if(!r)return;
  for(const x of $$(`a[data-outage="${CSS.escape(a.dataset.outage)}"]`))x.classList.add('on');
  outageToast(r);
 });

 channels(signedIn);

 // The author's own post and comments: edit / delete
 const own=$('[data-island="own-post"]');
 if(own&&st.mine?.post){
  own.hidden=false;
  // No reporting or "same here" on one's own post.
  for(const a of $$('.pact a[href*="/community/report"]'))a.hidden=true;
  const pv=$('[data-island="post-vote"][data-report]');if(pv)for(const b of $$('button',pv).slice(1))b.hidden=true;
  $('[data-delete]',own).addEventListener('click',async()=>{if(!confirm(L==='ko'?'이 글을 삭제할까요?':'Delete this post?'))return;const r=await write('/posts/delete',{postId:own.dataset.post},signedIn);if(r)location.href=location.pathname.replace(/\d+$/,'');});
  $('[data-edit]',own).addEventListener('click',async()=>{
   const src=await api(`/posts/source?id=${encodeURIComponent(own.dataset.post)}&l=${L}`);if(!src.ok)return explain(src);
   const art=$('article.post'),before=[...art.childNodes];const f=document.createElement('form');f.className='wform';
   const field=(text,el)=>{const lb=document.createElement('label');lb.append(text,el);return lb;};
   let sel=null;
   if(src.data.kinds?.length){sel=document.createElement('select');sel.name='kind';for(const k of src.data.kinds){const o=document.createElement('option');o.value=k.id;o.textContent=k.label;o.selected=k.id===src.data.kind;sel.append(o);}}
   const ti=document.createElement('input');ti.name='title';ti.value=src.data.title;ti.maxLength=120;ti.required=true;
   const ta=document.createElement('textarea');ta.name='body';ta.value=src.data.body;ta.maxLength=20000;ta.rows=12;
   const acts=document.createElement('div');acts.className='acts';
   const c=document.createElement('button');c.type='button';c.className='btn';c.textContent=L==='ko'?'취소':'Cancel';c.addEventListener('click',()=>art.replaceChildren(...before));
   const b=document.createElement('button');b.type='submit';b.className='btn p';b.textContent=L==='ko'?'수정 저장':'Save';acts.append(c,b);
   f.append(...(sel?[field(L==='ko'?'말머리':'Tag',sel)]:[]),field(L==='ko'?'제목':'Title',ti),field(L==='ko'?'본문':'Body',ta),acts);art.replaceChildren(f);ti.focus();
   f.addEventListener('submit',async e=>{e.preventDefault();if(!ta.value.trim())return toast(T.empty);const r=await write('/posts/edit',{postId:own.dataset.post,title:ti.value,body:ta.value,...(sel?{kind:sel.value}:{})},signedIn);if(r)location.reload();});
  });
 }
 // The question's author accepts an answer
 if(st.mine?.post)for(const b of $$('[data-accept]')){
  if(st.mine.comments?.includes(b.dataset.accept))continue;b.hidden=false;
  b.addEventListener('click',async()=>{const r=await write('/posts/solve',{postId:own?.dataset.post,commentId:b.dataset.accept},signedIn);if(r)location.reload();});
 }
 for(const b of $$('[data-edit-comment]')){
  const id=b.dataset.editComment;if(!st.mine?.comments?.includes(id))continue;b.hidden=false;
  b.addEventListener('click',async()=>{
   const src=await api(`/comments/source?id=${encodeURIComponent(id)}`);if(!src.ok)return explain(src);
   const cb=$('.cb',b.closest('li')),before=[...cb.childNodes];
   const f=document.createElement('form');f.className='cedit';
   const ta=document.createElement('textarea');ta.value=src.data.body;ta.maxLength=4000;ta.rows=3;ta.setAttribute('aria-label',L==='ko'?'댓글 수정':'Edit comment');
   const c=document.createElement('button');c.type='button';c.className='btn';c.textContent=L==='ko'?'취소':'Cancel';c.addEventListener('click',()=>cb.replaceChildren(...before));
   const s=document.createElement('button');s.type='submit';s.className='btn p';s.textContent=L==='ko'?'저장':'Save';
   f.append(ta,c,s);cb.replaceChildren(f);ta.focus();
   f.addEventListener('submit',async e=>{e.preventDefault();if(!ta.value.trim())return toast(T.empty);const r=await write('/comments/edit',{commentId:id,body:ta.value},signedIn);if(r)location.reload();});
  });
 }
 for(const b of $$('[data-own-comment]')){
  if(!st.mine?.comments?.includes(b.dataset.ownComment))continue;b.hidden=false;
  b.addEventListener('click',async()=>{if(!confirm(L==='ko'?'이 댓글을 삭제할까요?':'Delete this comment?'))return;const r=await write('/comments/delete',{commentId:b.dataset.ownComment},signedIn);if(r)location.reload();});
 }

 // Anonymous posts and comments: edit / delete with the password set when writing.
 for(const b of $$('[data-anon-edit],[data-anon-delete]')){
  b.hidden=false;const box=b.closest('[data-island="anon-own"]');if(box)box.hidden=false;
  b.addEventListener('click',async()=>{
   const target=b.dataset.anonEdit||b.dataset.anonDelete,[kind,id]=target.split(':'),del=!!b.dataset.anonDelete;
   const password=await askPassword();if(!password)return;
   const chk=await api('/anon/check',{target,password});if(!chk.ok)return explain(chk);
   if(del){
    if(!confirm(kind==='discussion'?(L==='ko'?'이 글을 삭제할까요?':'Delete this post?'):(L==='ko'?'이 댓글을 삭제할까요?':'Delete this comment?')))return;
    const r=await anonApi(kind==='discussion'?'/posts/delete':'/comments/delete',kind==='discussion'?{postId:id,password}:{commentId:id,password});
    if(!r)return;toastNext(T.deleted);if(kind==='discussion')location.href=location.pathname.replace(/\d+$/,'');else location.reload();return;
   }
   if(kind==='comment'){
    const cb=$('.cb',b.closest('li')),before=[...cb.childNodes];
    const f=document.createElement('form');f.className='cedit';
    const ta=document.createElement('textarea');ta.value=chk.data.body;ta.maxLength=4000;ta.rows=3;ta.setAttribute('aria-label',L==='ko'?'댓글 수정':'Edit comment');
    const c=document.createElement('button');c.type='button';c.className='btn';c.textContent=T.cancel;c.addEventListener('click',()=>cb.replaceChildren(...before));
    const sv=document.createElement('button');sv.type='submit';sv.className='btn p';sv.textContent=T.editSave;
    f.append(ta,c,sv);cb.replaceChildren(f);ta.focus();
    f.addEventListener('submit',async e=>{e.preventDefault();if(!ta.value.trim())return toast(T.empty);const r=await anonApi('/comments/edit',{commentId:id,body:ta.value,password});if(r)location.reload();});
    return;
   }
   const art=$('article.post'),before=[...art.childNodes];const f=document.createElement('form');f.className='wform';
   const field=(text,el)=>{const lb=document.createElement('label');lb.append(text,el);return lb;};
   let sel=null;
   if(chk.data.kinds?.length){sel=document.createElement('select');sel.name='kind';for(const k of chk.data.kinds){const o=document.createElement('option');o.value=k.id;o.textContent=k.label;o.selected=k.id===chk.data.kind;sel.append(o);}}
   const ti=document.createElement('input');ti.name='title';ti.value=chk.data.title;ti.maxLength=120;ti.required=true;
   const ta=document.createElement('textarea');ta.name='body';ta.value=chk.data.body;ta.maxLength=20000;ta.rows=12;
   const acts=document.createElement('div');acts.className='acts';
   const c=document.createElement('button');c.type='button';c.className='btn';c.textContent=T.cancel;c.addEventListener('click',()=>art.replaceChildren(...before));
   const sv=document.createElement('button');sv.type='submit';sv.className='btn p';sv.textContent=T.editSave;acts.append(c,sv);
   f.append(...(sel?[field(L==='ko'?'말머리':'Tag',sel)]:[]),field(L==='ko'?'제목':'Title',ti),field(L==='ko'?'본문':'Body',ta),acts);art.replaceChildren(f);ti.focus();
   f.addEventListener('submit',async e=>{e.preventDefault();if(!ta.value.trim())return toast(T.empty);const r=await anonApi('/posts/edit',{postId:id,title:ti.value,body:ta.value,password,...(sel?{kind:sel.value}:{})});if(r)location.reload();});
  });
 }

 // Comments and replies
 const form=$('form[data-island="comment-form"]');
 if(form){
  const ta=$('textarea',form),parent=$('input[name="parentId"]',form),label=$('.replying',form);
  for(const a of $$('[data-reply]')){
   a.addEventListener('click',e=>{e.preventDefault();parent.value=a.dataset.reply;label.hidden=false;$('span',label).textContent=T.replyTo(a.dataset.name||'');ta.focus();});
  }
  $('button[data-cancel]',form)?.addEventListener('click',()=>{parent.value='';label.hidden=true;});
  // A comment typed before signing in survives the round trip to the provider (this tab only).
  const draftKey=`n2-draft-c:${form.dataset.post}`;
  try{const d=sessionStorage.getItem(draftKey);if(d&&signedIn){if(!ta.value)ta.value=d;sessionStorage.removeItem(draftKey);}}catch{}
  if(!signedIn)for(const a of $$('a[data-signin]',form))a.addEventListener('click',()=>{try{sessionStorage.setItem(draftKey,ta.value);}catch{}});
  const af=anonForm(form,signedIn);
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   if(!ta.value.trim())return toast(T.empty);
   if(!signedIn&&!af)try{sessionStorage.setItem(draftKey,ta.value);}catch{}
   if(af&&!af.valid())return;
   const btn=$('button[type="submit"]',form);btn.disabled=true;
   const r=await write('/comments',{postId:form.dataset.post,parentId:parent.value||undefined,body:ta.value,...(af?af.fields():{})},signedIn,{anon:true});
   btn.disabled=false;
   if(r){af?.remember();if(r.held)toastNext(T.held);ta.value='';location.hash=`c-${r.id}`;location.reload();}
  });
 }

 // Write page: channel, 말머리, 0–3 tags, then the post.
 const wf=$('form[data-island="write-form"]');
 if(wf){
  const af=anonForm(wf,signedIn);
  if(!signedIn&&!af){const n=$('.needlogin',wf);if(n)n.hidden=false;}
  // Structured reports (리포트 on a game) are member-only.
  const repRadio=$('input[name="kind"][value="report"]',wf);
  if(!signedIn&&af&&repRadio&&$('[data-report-fields]',wf)){repRadio.disabled=true;const sp=repRadio.nextElementSibling;if(sp)sp.textContent+=L==='ko'?' (로그인)':' (sign-in)';if(repRadio.checked){const first=$('input[name="kind"]:not([disabled])',wf);if(first)first.checked=true;}}
  const pick=imagePicker(wf,st.uploads,signedIn);
  const picker=tagPicker(wf);
  // Draft kept in this browser (title, body, tags) so switching channels, signing in or a closed tab does not lose it.
  const dkey=`n2-draft:${L}:write`,ti=$('input[name="title"]',wf),ta=$('textarea[name="body"]',wf);
  const store={get(){try{return JSON.parse(localStorage.getItem(dkey)||'null');}catch{return null;}},set(v){try{v?localStorage.setItem(dkey,JSON.stringify(v)):localStorage.removeItem(dkey);}catch{}}};
  const saved=store.get();
  if(saved&&ti&&ta&&!ti.value&&!ta.value&&(saved.title||saved.body)){ti.value=saved.title||'';ta.value=saved.body||'';for(const x of Array.isArray(saved.tags)?saved.tags:[])picker?.add(x);toast(L==='ko'?'임시저장한 글을 불러왔어요.':'Draft restored.');}
  const keep=()=>store.set(ti?.value||ta?.value?{title:ti?.value||'',body:ta?.value||'',tags:picker?.list()||[]}:null);
  let dt=0;wf.addEventListener('input',()=>{clearTimeout(dt);dt=setTimeout(keep,400);});
  // Another channel keeps what was written (and the picked tags).
  for(const a of $$('[data-channel-link]',wf))a.addEventListener('click',()=>{clearTimeout(dt);keep();});
  wf.addEventListener('submit',async e=>{
   e.preventDefault();
   const fd=new FormData(wf),btn=$('button[type="submit"]',wf);
   const kind=String(fd.get('kind')||'');
   if(kind!=='report'&&!String(fd.get('body')||'').trim()){toast(T.empty);ta?.focus();return;}
   if(pick?.busy())return toast(T.imgUploading);
   if(!signedIn&&kind==='report'&&$('[data-report-fields]',wf)){toast(T.reportNeedsLogin);return;}
   if(af&&!af.valid())return;
   btn.disabled=true;btn.textContent=T.posting;
   let r;
   if(kind==='report'&&fd.get('targetId')&&$('[data-report-fields]:not([hidden])',wf)){
    r=await write('/reports',{kind:'compat',entityId:String(fd.get('subjectId')),subjectVersion:String(fd.get('subjectVersion')||'')||undefined,targetId:String(fd.get('targetId')),targetVersion:String(fd.get('targetVersion')||'')||undefined,
     result:String(fd.get('result')),env:Object.fromEntries(['os','device','note'].map(k=>[k,String(fd.get('env_'+k)||'')]).filter(([,v])=>v)),title:String(fd.get('title')||'')||undefined,comment:String(fd.get('body')||'')||undefined},signedIn);
   }else{
    r=await write('/posts?l='+L,{channel:wf.dataset.channel,kind,tags:fd.getAll('tags').map(String),title:String(fd.get('title')||''),body:String(fd.get('body')||''),...(af?af.fields():{})},signedIn,{anon:true});
   }
   btn.disabled=false;btn.textContent=btn.dataset.label||btn.textContent;
   if(r?.held){af?.remember();store.set(null);toastNext(T.held);location.href=location.pathname.replace(/write$/,'');return;}
   if(r?.url){af?.remember();store.set(null);toastNext(T.posted);location.href=r.url;}
  });
  const subj=$('select[name="subjectId"]',wf),sv=$('input[name="subjectVersion"]',wf);
  // Picking a patch fills in its latest known version (the reader can still change it).
  subj?.addEventListener('change',()=>{const v=subj.selectedOptions[0]?.dataset.v;if(sv&&v)sv.value=v;});
  const rep=$('[data-report-fields]',wf),title=$('input[name="title"]',wf);
  const sync=()=>{const on=$('input[name="kind"]:checked',wf)?.value==='report'&&!!rep;if(rep){rep.hidden=!on;for(const el of $$('select,input',rep))el.disabled=!on;}if(title)title.required=!on;};
  for(const r of $$('input[name="kind"]',wf))r.addEventListener('change',sync);sync();
 }
 // New tag proposals (members only; the owner decides in /admin/).
 const tp=$('[data-island="tag-propose"]');
 if(tp){
  const st2=$('[data-propose-status]',tp),send=$('[data-propose-send]',tp);
  send?.addEventListener('click',async()=>{
   const name=$('input[name="proposeName"]',tp),url=$('input[name="proposeUrl"]',tp),note=$('input[name="proposeNote"]',tp);
   if(!signedIn){if(st2)st2.textContent=L==='ko'?'새 태그 제안은 로그인한 회원(고정닉)만 할 수 있어요.':'Only members can propose tags.';signInSheet();return;}
   if(!name?.value.trim()||name.value.trim().length<2){name?.focus();return toast(L==='ko'?'태그 이름을 2자 이상 적어 주세요.':'Enter a tag name (2+ characters).');}
   send.disabled=true;
   const r=await write('/tags/propose',{name:name.value.trim(),channel:tp.dataset.channel,sourceUrl:url?.value.trim()||undefined,note:note?.value.trim()||undefined},signedIn);
   send.disabled=false;
   if(r){if(st2)st2.textContent=L==='ko'?`“${name.value.trim()}” 제안을 보냈어요. 운영자가 확인하면 태그로 추가돼요.`:'Sent. The owner reviews each proposal.';name.value='';if(url)url.value='';if(note)note.value='';}
  });
 }

 // Benchmark (GPU local-LLM page)
 const bf=$('form[data-island="bench-form"]');
 if(bf)bf.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(bf);
  const r=await write('/reports',{kind:'benchmark',entityId:String(fd.get('model')),targetId:bf.dataset.gpu,metrics:{tokens_per_s:Number(String(fd.get('tps')).replace(',','.'))},env:Object.fromEntries([['runtime',fd.get('runtime')],['quant',fd.get('quant')],['ctx',fd.get('ctx')],['os',fd.get('os')]].filter(([,v])=>v).map(([k,v])=>[k,String(v)]))},signedIn);
  if(r){toastNext(L==='ko'?'측정값을 올렸어요. 표의 중앙값에 반영됐어요.':'Measurement added to the median.');location.reload();}});

 // 정보 제안 (wiki box): values are typed by the property (number, yes/no, list) before sending.
 for(const pf of $$('form[data-island="propose"]')){
  pf.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(pf);
   const opt=$('select[name="property"]',pf).selectedOptions[0],type=opt?.dataset.type||'text',raw=String(fd.get('value')||'').trim();
   let value=raw;
   if(type==='number'||type==='money'||type==='tokens')value=Number(raw.replace(/,/g,''));
   else if(type==='bool')value=/^(예|yes|true|y|o|있음)$/i.test(raw);
   else if(type==='list')value=raw.split(/[,·]/).map(x=>x.trim()).filter(Boolean);
   const unit=String(fd.get('unit')||'').trim().toUpperCase()||(type==='money'?opt?.dataset.unit||undefined:undefined);
   const r=await write('/facts/propose',{entityId:pf.dataset.entity,property:String(fd.get('property')),value,...(unit&&type==='money'?{unit}:{}),sourceUrl:String(fd.get('sourceUrl')||''),note:String(fd.get('note')||'')||undefined,...(pf.dataset.post?{postId:pf.dataset.post}:{})},signedIn);
   if(r){toast(L==='ko'?'제안을 보냈어요. 운영자가 출처를 확인한 뒤 반영합니다.':'Sent. A moderator will check the source.');pf.reset();pf.closest('details').open=false;}});
 }

 // 신고 form
 const ff=$('form[data-island="flag-form"]');
 if(ff)ff.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(ff);
  const r=await write('/flags',{target:ff.dataset.target,reason:String(fd.get('reason')),note:String(fd.get('note')||'')||undefined},signedIn,{anon:true});
  if(!r)return;
  if(r.hidden){$('button[type="submit"]',ff).disabled=true;const back=ff.dataset.back;if(!back)return toast(T.hiddenNow);toastNext(T.hiddenNow);
   // The hidden post is gone from the site: back to its channel (a hidden comment: back to its post).
   location.href=ff.dataset.target.startsWith('comment:')?back.replace(/#.*$/,''):back.replace(/#.*$/,'').replace(/\/\d+$/,'/');return;}
  const reasons=[...$('select[name="reason"]',ff).options].reduce((o,x)=>(o[x.value]=x.textContent,o),{});
  const msg=r.updated?T.flagUpdated(reasons[r.previousReason]||r.previousReason):T.flagged;$('button[type="submit"]',ff).disabled=true;
  const back=ff.dataset.back;if(back){toastNext(msg);location.href=back;}else toast(msg);});
 // Already reported this? Say so before the form is filled in again.
 if(ff&&(signedIn||ANON.enabled)){const fs=await api(`/state?flag=${encodeURIComponent(ff.dataset.target)}`);const prev=fs.data?.flagged;
  if(prev){const sel=$('select[name="reason"]',ff);const lab=[...sel.options].find(o=>o.value===prev.reason)?.textContent||prev.reason;const p=document.createElement('p');p.className='needlogin';p.textContent=L==='ko'?`이미 “${lab}” 사유로 신고했어요. 다시 보내면 사유가 바뀝니다.`:`You already reported this (${lab}). Sending again changes the reason.`;ff.prepend(p);}}

 // 내 정보: nickname and followed channels
 const me=$('[data-island="me"]');
 if(me&&signedIn){
  $('[data-signed-out]',me).hidden=true;
  const nf=$('form[data-nickname]',me);nf.hidden=false;$('input',nf).value=st.user?.name||'';
  const auto=/^user-[0-9a-z]{1,6}$/.test(st.user?.name||'');$('[data-autonick]',nf).hidden=!auto;
  // A GitHub/Discord handle is offered as the nickname; it is used only once the member saves it.
  if(auto&&st.user?.suggest){$('input',nf).value=st.user.suggest;const sg=$('[data-suggested]',nf);if(sg)sg.hidden=false;}
  nf.addEventListener('submit',async e=>{e.preventDefault();const name=$('input',nf).value.trim();const r=await write('/profile',{displayName:name},signedIn);
   if(r){toast(T.sent);$('[data-autonick]',nf).hidden=true;const h=$('.hd [data-island="account"] a');if(h)h.textContent=name;}});
  const lo=$('[data-logout]',me);lo.hidden=false;
  lo.addEventListener('click',async()=>{
   try{await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:'{}'});}catch{}
   location.href=L==='ko'?'/':`/${L}/`;});
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
   const REASON=ko?{spam:'스팸·도배',abuse:'욕설·혐오',wrong_info:'틀린 정보',source_dispute:'출처 이의',copyright:'권리 침해',duplicate:'중복',other:'기타',privacy:'개인정보 노출',illegal_filming:'불법촬영물',csam:'아동·청소년 성착취물',sexual:'음란물',violence:'폭력·자해'}:{};
   const STATUS=ko?{hidden:'임시조치 중',deleted:'작성자가 삭제',locked:'댓글 잠김'}:{};
   const ACTION=ko?{hide:'임시조치',unhide:'복구',dismiss:'기각',restrict:'이용 제한',unrestrict:'제한 해제',accept:'정보 제안 반영',reject:'정보 제안 반려',delete:'영구 삭제',ban:'ID 차단',unban:'차단 해제'}:{};
   const KIND=ko?{discussion:'글',comment:'댓글',user:'계정',proposal:'정보 제안'}:{};
   const when=t=>new Date(t).toLocaleString(ko?'ko-KR':'en-US',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,...(ko?{timeZone:'Asia/Seoul'}:{})});
   const act_=async(...a)=>act(...a);
   const act=async(target,action,label,extra={})=>{const reason=prompt(`${label} — ${ko?'사유(처리 기록에 남습니다)':'reason (kept in the log)'}`);if(!reason)return;const x=await api('/mod/action',{target,action,reason,...extra});if(x.ok){toast(ko?`${label} 처리했어요`:'Done');setTimeout(()=>location.reload(),700);}else explain(x);};
   /** One row: title (linked while it is public), who wrote it and where, the excerpt, then the actions that apply. */
   const row=(it,head,actions)=>{
    const li=document.createElement('li');li.className='mq';
    const top=document.createElement('p');top.className='mqh';
    const tag=document.createElement('span');tag.className='mqt';tag.textContent=head;top.append(tag);
    const t=document.createElement(it.url&&it.status!=='hidden'?'a':'b');t.className='tt';if(it.url&&it.status!=='hidden')t.href=it.url;
    t.textContent=it.preview||it.target;top.append(' ',t);li.append(top);
    const meta=[`${KIND[it.target.split(':')[0]]||it.target.split(':')[0]}`,it.author&&(ko?`작성 ${it.author}`:`by ${it.author}`),it.context&&(ko?`「${it.context}」의 댓글`:`on “${it.context}”`),it.status&&it.status!=='published'&&(STATUS[it.status]||it.status)].filter(Boolean);
    const m=document.createElement('p');m.className='fine';m.textContent=meta.join(' · ');li.append(m);
    if(it.excerpt){
     // The whole text is here: a hidden post is 404 on the site, even for moderators.
     if(it.excerpt.length>300){const dt=document.createElement('details');const sm=document.createElement('summary');sm.textContent=ko?'본문 전체 보기':'Full text';const pre=document.createElement('p');pre.className='mqx full';pre.textContent=it.excerpt;dt.append(sm,pre);const ex=document.createElement('p');ex.className='mqx';ex.textContent=it.excerpt.slice(0,300)+'…';li.append(ex,dt);}
     else{const ex=document.createElement('p');ex.className='mqx';ex.textContent=it.excerpt;li.append(ex);}}
    if(it.note){const n=document.createElement('p');n.className='mqn';n.textContent=(ko?'신고자 설명: ':'Reporter: ')+it.note;li.append(n);}
    // The post's images (moderators see them even while hidden).
    if(it.images?.length){const g=document.createElement('p');g.className='mqi';for(const src of it.images){const a=document.createElement('a');a.href=src;a.target='_blank';a.rel='noopener';const im=document.createElement('img');im.src=src;im.alt='';im.loading='lazy';im.width=96;im.height=96;a.append(im);g.append(a);}li.append(g);}
    const bar=document.createElement('p');bar.className='mqa';
    for(const [a,lab] of actions){const b=document.createElement('button');b.type='button';b.className='btn'+(a==='hide'?' p':'');b.textContent=lab;b.addEventListener('click',()=>act(it.target,a,lab));bar.append(b);}
    if(it.status!=='deleted'&&/^(discussion|comment):/.test(it.target)){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=ACTION.delete||'Delete';b.addEventListener('click',()=>{if(confirm(ko?'되돌릴 수 없어요. 이미지도 저장소에서 지워집니다. 삭제할까요?':'This cannot be undone; images are deleted too. Delete?'))act(it.target,'delete',ACTION.delete||'Delete');});bar.append(b);}
    if(it.authorId){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=ACTION.restrict||'Restrict author';b.addEventListener('click',()=>act('user:'+it.authorId,'restrict',ACTION.restrict||'Restrict'));bar.append(b);}
    // An anonymous author: ban the network behind today's ID (1, 7 or 30 days), or lift the ban.
    if(it.anon?.bannable){
     if(it.anon.bannedUntil){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=`${ACTION.unban||'Unban'} (${when(it.anon.bannedUntil)})`;b.addEventListener('click',()=>act(it.target,'unban',ACTION.unban||'Unban'));bar.append(b);}
     else for(const d of [1,7,30]){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=ko?`이 ID 차단 ${d}일`:`Ban ID ${d}d`;b.addEventListener('click',()=>act(it.target,'ban',b.textContent,{days:d}));bar.append(b);}
    }
    li.append(bar);return li;
   };
   const ul=$('[data-items]',mq),empty=$('[data-empty]',mq);
   empty.textContent=items.length?'':(ko?'열린 신고가 없습니다.':'No open reports.');empty.hidden=!!items.length;
   for(const it of items){
    const head=`${it.severe?'⚠ ':''}${it.reasons.map(x=>REASON[x]||x).join(', ')}${it.count>1?` ×${it.count}`:''} · ${when(it.firstAt)}`;
    const acts=it.status==='hidden'?[['unhide',ACTION.unhide||'Restore'],['dismiss',ACTION.dismiss||'Dismiss']]:it.status==='deleted'?[['dismiss',ACTION.dismiss||'Dismiss']]:[['hide',ACTION.hide||'Hide'],['dismiss',ACTION.dismiss||'Dismiss']];
    ul.append(row(it,head,acts));
   }
   const hb=$('[data-hidden]'),hu=$('ul',hb);
   if(hb){hb.hidden=false;
    if(!hidden.length){const li=document.createElement('li');li.className='empty';li.textContent=ko?'임시조치 중인 글·댓글이 없습니다.':'Nothing is hidden.';hu.append(li);}
    for(const it of hidden)hu.append(row(it,`${ko?'임시조치':'Hidden'} ${when(it.hiddenAt)}${it.reason?` · ${it.reason}`:''}`,[['unhide',ACTION.unhide||'Restore']]));
   }
   // 정보 제안: proposed value next to the current one, with the source to check.
   const pb=$('[data-proposals]');
   if(pb){pb.hidden=false;const pu=$('ul',pb),proposals=r.data.proposals||[];
    const show=v=>Array.isArray(v)?v.join(', '):typeof v==='boolean'?(v?(ko?'예':'yes'):(ko?'아니요':'no')):String(v);
    if(!proposals.length){const li=document.createElement('li');li.className='empty';li.textContent=ko?'검토할 정보 제안이 없습니다.':'No proposals to review.';pu.append(li);}
    for(const it of proposals){
     const li=document.createElement('li');li.className='mq';
     const top=document.createElement('p');top.className='mqh';const a=document.createElement('a');a.className='tt';a.href=it.url;a.textContent=`${it.channel} · ${it.property}`;top.append(a);li.append(top);
     const v=document.createElement('p');v.className='mqx';v.textContent=`${ko?'제안':'Proposed'}: ${show(it.value)}${it.unit?' '+it.unit:''}   ←   ${ko?'현재':'Now'}: ${it.current?show(it.current.value)+(it.current.unit?' '+it.current.unit:'')+` (${it.current.verification}${it.current.region&&it.current.region!=='*'?' · '+it.current.region:''})`:'—'}`;li.append(v);
     const src=document.createElement('p');src.className='fine';const sa=document.createElement('a');sa.href=it.source;sa.target='_blank';sa.rel='noopener nofollow';sa.textContent=(ko?'출처: ':'Source: ')+it.source;src.append(sa,` · ${it.author} · ${when(it.at)}`);li.append(src);
     if(it.note){const n=document.createElement('p');n.className='mqn';n.textContent=it.note;li.append(n);}
     const bar=document.createElement('p');bar.className='mqa';
     for(const [act,lab] of [['accept',ko?'반영':'Accept'],['reject',ko?'반려':'Reject']]){const b=document.createElement('button');b.type='button';b.className='btn'+(act==='accept'?' p':'');b.textContent=lab;b.addEventListener('click',()=>act_(it.target,act,lab));bar.append(b);}
     li.append(bar);pu.append(li);
    }
   }
   const lg=$('[data-log]');
   if(!log.length){const li=document.createElement('li');li.className='empty';li.textContent=ko?'아직 처리 기록이 없습니다.':'No actions yet.';lg.append(li);}
   for(const x of log){const li=document.createElement('li');li.className='fine';li.textContent=`${when(x.created_at)} · ${ACTION[x.action]||x.action} · ${KIND[x.target_kind]||x.target_kind} ${x.label?`「${x.label}」`:String(x.target_id).slice(0,14)} · ${x.reason||''}`;lg.append(li);}
  }
 }

 // New posts bar on a channel board (polls once a minute while the tab is visible)
 const bar=$('[data-island="new-posts"]');
 if(bar&&bar.dataset.channel){
  const last=Number(bar.dataset.after)||0;
  const poll=async()=>{
   if(document.hidden)return;
   const r=await api(`/new-posts?channel=${encodeURIComponent(bar.dataset.channel)}&after=${last}`);
   if(r.ok&&r.data.count>0){bar.hidden=false;bar.textContent='';const a=document.createElement('a');a.href=location.pathname+location.search;a.textContent=T.newPosts(r.data.count);bar.append(a);}
  };
  setInterval(poll,60e3);
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
