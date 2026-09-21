/** Localized copy for the account layer (pricing, account, upgrade modal). Loaded only by
 * the pricing/account pages and lazily by the upgrade modal — never on a tool's first paint.
 * Prices are never written here: they come from build configuration (PRO_PRICE_*). */
export const SERVICE_ROUTES=Object.freeze(['pricing','account']);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const S={
 en:{
  pricing:'Pricing',account:'Account',home:'All tools',
  pricingTitle:'Same quality. Free or Pro.',pricingLead:'Every tool runs on your device in both plans, with identical output quality. Pro removes ads and the daily heavy-job limit.',
  freeName:'Nerulio Free',freePrice:'Free',proName:'Nerulio Pro',priceTBA:'Price announced at launch',perMonth:'/ month',perYear:'/ year',
  freeFeatures:['All tools','Full output quality — no watermark, no reduced resolution','Local processing: your files stay on your device','{n} heavy jobs per day','Ads'],
  proFeatures:['Unlimited heavy jobs','No ads','Full output quality','Local processing'],
  startFree:'Use the tools',upgrade:'Upgrade to Pro',signInToUpgrade:'Sign in with Google to upgrade',purchasesClosed:'Purchases are not open yet.',youArePro:'You have Nerulio Pro.',
  faq:[['What is a heavy job?','AI upscaling and AI background removal, image and PDF compression, video, GIF and audio exports, and large game-asset packs. Crop, rotate, resize, convert, PDF page editing and other light tools never count.'],
   ['When does the daily limit reset?','Every day at 00:00 UTC. Your account page shows the time remaining.'],
   ['Do my files go to a server?','No. Processing happens in your browser on both plans. To check the daily limit, only the tool name and a random operation id are sent — never the file, its name or its contents.']],
  accountTitle:'Nerulio Account',name:'Name',email:'Email',plan:'Plan',heavyJobs:'Heavy jobs today',unlimited:'Unlimited',reset:'Resets in',ads:'Ads',on:'On',off:'Off',free:'Free',pro:'Pro',
  manage:'Manage subscription',signOut:'Sign out',signIn:'Sign in with Google',signedOutLead:'Every tool works without an account. Sign in only to buy or manage Pro.',
  noHistory:'Nerulio keeps no history of your files — they never reach our servers.',loginFailed:'Sign-in did not complete. Please try again.',
  activating:'Activating Pro. This usually takes a few seconds after payment.',activationSlow:'Your payment is being confirmed. Refresh this page in a minute; you will not be charged twice.',
  sandbox:'Sandbox checkout created. No payment was taken. Pro starts only when a signed test webhook is delivered.',
  proActive:'Nerulio Pro is active.',endsOn:'Pro ends on {date}',renewsOn:'Renews on {date}',
  serviceDown:'The account service is temporarily unavailable. All tools still work.',serviceOff:'Accounts are not enabled on this deployment.',
  limitTitle:'You have used today’s free heavy jobs',limitBody:'They refresh for free in {time}.',keepWork:'Your current file and settings are still here.',
  proPitch:'Nerulio Pro',proBullets:['Unlimited heavy jobs','No ads','Same local processing','Same output quality'],later:'Come back tomorrow',
  remaining:'{n} free heavy jobs left today',graceUsed:'The account service did not respond, so this job used a temporary allowance.',
  paused:'Heavy tools are paused because the account service cannot be reached. Light tools keep working. Please try again in a few minutes.',
  challenge:'Quick check to keep free jobs available for everyone.',challengeFailed:'The check did not complete. Please try again.',hm:'{h}h {m}m'
 },
 ko:{
  pricing:'요금제',account:'계정',home:'모든 도구',
  pricingTitle:'품질은 같습니다. Free 또는 Pro.',pricingLead:'두 요금제 모두 모든 도구가 기기에서 실행되며 결과 품질이 같습니다. Pro는 광고와 하루 무거운 작업 제한을 없앱니다.',
  freeName:'Nerulio Free',freePrice:'무료',proName:'Nerulio Pro',priceTBA:'가격은 출시 시 공개',perMonth:'/ 월',perYear:'/ 년',
  freeFeatures:['모든 도구','원본 품질 그대로 — 워터마크·해상도 제한 없음','로컬 처리: 파일이 기기 밖으로 나가지 않음','무거운 작업 하루 {n}회','광고 표시'],
  proFeatures:['무거운 작업 무제한','광고 없음','원본 품질 그대로','로컬 처리'],
  startFree:'도구 사용하기',upgrade:'Pro로 업그레이드',signInToUpgrade:'Google로 로그인하고 업그레이드',purchasesClosed:'아직 결제를 받지 않습니다.',youArePro:'Nerulio Pro 사용 중입니다.',
  faq:[['무거운 작업이란?','AI 확대·AI 배경 제거, 이미지·PDF 압축, 영상·GIF·오디오 내보내기, 대용량 게임 에셋 묶음입니다. 자르기·회전·크기 조절·변환·PDF 페이지 편집 같은 가벼운 도구는 횟수에 포함되지 않습니다.'],
   ['하루 제한은 언제 초기화되나요?','매일 00:00 UTC(한국 시간 오전 9시)입니다. 계정 페이지에서 남은 시간을 볼 수 있습니다.'],
   ['파일이 서버로 가나요?','아니요. 두 요금제 모두 브라우저에서 처리합니다. 하루 제한 확인에는 도구 이름과 임의의 작업 ID만 보내며 파일·파일명·내용은 보내지 않습니다.']],
  accountTitle:'Nerulio 계정',name:'이름',email:'이메일',plan:'요금제',heavyJobs:'오늘 무거운 작업',unlimited:'무제한',reset:'초기화까지',ads:'광고',on:'표시',off:'없음',free:'Free',pro:'Pro',
  manage:'구독 관리',signOut:'로그아웃',signIn:'Google로 로그인',signedOutLead:'모든 도구는 계정 없이 사용할 수 있습니다. Pro 구매·관리에만 로그인이 필요합니다.',
  noHistory:'Nerulio는 파일 기록을 보관하지 않습니다. 파일은 서버에 전송되지 않습니다.',loginFailed:'로그인이 완료되지 않았습니다. 다시 시도해 주세요.',
  activating:'Pro를 활성화하는 중입니다. 결제 후 보통 몇 초 걸립니다.',activationSlow:'결제를 확인하고 있습니다. 1분 뒤 새로고침해 주세요. 중복 청구되지 않습니다.',
  sandbox:'샌드박스 결제 화면을 만들었습니다. 실제 결제는 없으며 서명된 테스트 webhook이 도착해야 Pro가 시작됩니다.',
  proActive:'Nerulio Pro가 활성화되어 있습니다.',endsOn:'{date}에 Pro 종료',renewsOn:'{date}에 갱신',
  serviceDown:'계정 서비스에 일시적으로 연결할 수 없습니다. 모든 도구는 계속 사용할 수 있습니다.',serviceOff:'이 배포에서는 계정 기능이 꺼져 있습니다.',
  limitTitle:'오늘 무료 작업을 모두 사용했습니다',limitBody:'{time} 뒤에 다시 무료로 사용할 수 있습니다.',keepWork:'지금 작업 중인 파일과 설정은 그대로 있습니다.',
  proPitch:'Nerulio Pro',proBullets:['무거운 작업 무제한','광고 없음','같은 로컬 처리','같은 결과 품질'],later:'내일 다시 사용',
  remaining:'오늘 무료 무거운 작업 {n}회 남음',graceUsed:'계정 서비스가 응답하지 않아 임시 허용 횟수로 실행했습니다.',
  paused:'계정 서비스에 연결할 수 없어 무거운 작업을 잠시 멈췄습니다. 가벼운 도구는 계속 사용할 수 있습니다. 몇 분 뒤 다시 시도해 주세요.',
  challenge:'모두가 무료 작업을 쓸 수 있도록 간단히 확인합니다.',challengeFailed:'확인이 완료되지 않았습니다. 다시 시도해 주세요.',hm:'{h}시간 {m}분'
 },
 ja:{
  pricing:'料金',account:'アカウント',home:'すべてのツール',
  pricingTitle:'品質は同じ。FreeかProか。',pricingLead:'どちらのプランでも全ツールが端末上で動き、出力品質は同じです。Proは広告と1日の重い処理の上限をなくします。',
  freeName:'Nerulio Free',freePrice:'無料',proName:'Nerulio Pro',priceTBA:'価格は公開時にお知らせします',perMonth:'/ 月',perYear:'/ 年',
  freeFeatures:['すべてのツール','出力品質はそのまま — 透かし・解像度制限なし','ローカル処理：ファイルは端末の外に出ません','重い処理は1日{n}回','広告あり'],
  proFeatures:['重い処理が無制限','広告なし','同じ出力品質','ローカル処理'],
  startFree:'ツールを使う',upgrade:'Proにアップグレード',signInToUpgrade:'Googleでログインしてアップグレード',purchasesClosed:'現在は購入を受け付けていません。',youArePro:'Nerulio Proをご利用中です。',
  faq:[['重い処理とは？','AI拡大・AI背景除去、画像・PDF圧縮、動画・GIF・音声の書き出し、大きなゲーム素材パックです。切り抜き・回転・リサイズ・変換・PDFページ編集などの軽いツールは数えません。'],
   ['上限はいつリセットされますか？','毎日00:00 UTC（日本時間9:00）です。アカウントページで残り時間を確認できます。'],
   ['ファイルはサーバーに送られますか？','いいえ。どちらのプランでもブラウザで処理します。上限の確認にはツール名とランダムな処理IDだけを送り、ファイル・ファイル名・内容は送りません。']],
  accountTitle:'Nerulioアカウント',name:'名前',email:'メール',plan:'プラン',heavyJobs:'今日の重い処理',unlimited:'無制限',reset:'リセットまで',ads:'広告',on:'あり',off:'なし',free:'Free',pro:'Pro',
  manage:'サブスクリプションを管理',signOut:'ログアウト',signIn:'Googleでログイン',signedOutLead:'すべてのツールはアカウントなしで使えます。ログインはProの購入・管理のときだけ必要です。',
  noHistory:'Nerulioはファイルの履歴を保存しません。ファイルはサーバーに送られません。',loginFailed:'ログインが完了しませんでした。もう一度お試しください。',
  activating:'Proを有効化しています。支払い後、通常数秒で完了します。',activationSlow:'支払いを確認中です。1分後に再読み込みしてください。二重に請求されることはありません。',
  sandbox:'サンドボックスの決済を作成しました。実際の支払いはなく、署名付きテストWebhookが届いたときだけProが始まります。',
  proActive:'Nerulio Proが有効です。',endsOn:'{date}にPro終了',renewsOn:'{date}に更新',
  serviceDown:'アカウントサービスに一時的に接続できません。すべてのツールは引き続き使えます。',serviceOff:'このデプロイではアカウント機能が無効です。',
  limitTitle:'今日の無料の重い処理を使い切りました',limitBody:'{time}後にまた無料で使えます。',keepWork:'作業中のファイルと設定はそのまま残っています。',
  proPitch:'Nerulio Pro',proBullets:['重い処理が無制限','広告なし','同じローカル処理','同じ出力品質'],later:'明日また使う',
  remaining:'今日の無料の重い処理：残り{n}回',graceUsed:'アカウントサービスが応答しないため、一時的な許可枠で実行しました。',
  paused:'アカウントサービスに接続できないため、重い処理を一時停止しています。軽いツールは使えます。数分後にもう一度お試しください。',
  challenge:'すべての方が無料で使えるよう、簡単な確認をお願いします。',challengeFailed:'確認が完了しませんでした。もう一度お試しください。',hm:'{h}時間{m}分'
 }
};
export const text=(locale,key,vars={})=>String((S[locale]||S.en)[key]??S.en[key]).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
export function duration(locale,ms){const m=Math.max(0,Math.ceil(ms/60e3));return text(locale,'hm',{h:Math.floor(m/60),m:m%60});}
/** Pricing configuration → display text. One formatter for every page and the modal. */
export function priceText(pricing,locale){
 if(!pricing?.amount||!pricing?.currency)return text(locale,'priceTBA');
 const amount=new Intl.NumberFormat(locale,{style:'currency',currency:pricing.currency}).format(Number(pricing.amount));
 return `${amount} ${text(locale,pricing.interval==='year'?'perYear':'perMonth')}`;
}
const list=items=>`<ul class="plan-features">${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`;
export function pricingHTML(locale,{pricing,freeDailyJobs}){
 const t=k=>text(locale,k),s=S[locale]||S.en;
 return `<h1>${esc(t('pricingTitle'))}</h1><p class="service-lead">${esc(t('pricingLead'))}</p>
<div class="plans">
<section class="plan" data-plan="free"><h2>${esc(t('freeName'))}</h2><p class="plan-price">${esc(t('freePrice'))}</p>${list(s.freeFeatures.map(f=>f.replace('{n}',freeDailyJobs)))}<a class="plan-cta secondary" href="${locale}/">${esc(t('startFree'))}</a></section>
<section class="plan featured" data-plan="pro"><h2>${esc(t('proName'))}</h2><p class="plan-price" data-price>${esc(priceText(pricing,locale))}</p>${list(s.proFeatures)}<div class="plan-action" id="proAction"><p class="plan-note">${esc(t('purchasesClosed'))}</p></div></section>
</div>
<section class="service-faq">${s.faq.map(([q,a])=>`<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join('')}</section>`;
}
export function accountHTML(locale){
 const t=k=>text(locale,k);
 return `<h1>${esc(t('accountTitle'))}</h1><div id="accountStatus" class="service-status" role="status" aria-live="polite"></div>
<div id="accountBody" class="account-card" aria-busy="true"><p class="service-lead">${esc(t('signedOutLead'))}</p></div>
<p class="service-note">${esc(t('noHistory'))}</p>`;
}
