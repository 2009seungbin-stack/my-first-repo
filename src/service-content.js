/** Localized copy for the account layer (pricing, account, upgrade modal). Loaded only by
 * the pricing/account pages and lazily by the upgrade modal — never on a tool's first paint.
 * Prices are never written here: they come from build configuration (PRO_PRICE_*). */
export const SERVICE_ROUTES=Object.freeze(['pricing','account']);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const S={
 en:{
  pricing:'Pricing',account:'Account',home:'All tools',
  pricingTitle:'Same quality. Free or Pro.',pricingLead:'Nerulio is a game-asset studio in your browser. Both plans get the whole Studio and every tool, running on your device with identical output quality. Pro is the game-studio plan: no ads and no daily limits.',
  freeName:'Nerulio Free',freePrice:'Free',proName:'Nerulio Pro',priceTBA:'Price announced at launch',perMonth:'/ month',perYear:'/ year',
  freeFeatures:['The whole Studio and every tool','Full output quality — no watermark, no reduced resolution','Local processing: your files stay on your device','{s} Studio engine exports per day with a free sign-in ({a} without an account) — editing, saving projects and single PNGs are unlimited','{n} heavy jobs per day in the file tools','Ads (in the Studio: one labelled column on large screens)'],
  proFeatures:['Unlimited Studio engine exports','No ads — the Studio uses the full screen','Unlimited heavy jobs in the file tools','Full output quality','Local processing'],
  startFree:'Open the Studio',upgrade:'Upgrade to Pro',signInToUpgrade:'Sign in with Google to upgrade',purchasesClosed:'Purchases are not open yet.',youArePro:'You have Nerulio Pro.',
  faq:[['What counts as a Studio export?','Exporting an engine bundle from the Studio: a Pack & Export atlas, a Tile tileset or a Texture map set (the ZIP for Godot, Unity, Phaser and the other targets). Importing, editing, previewing, undo, autosave, saving the .nerulio project and exporting a single PNG or .aseprite file never count.'],
   ['What is a heavy job?','AI upscaling and AI background removal, image and PDF compression, video, GIF and audio exports, and large game-asset packs. Crop, rotate, resize, convert, PDF page editing and other light tools never count.'],
   ['When does the daily limit reset?','Every day at 00:00 UTC. Your account page shows the time remaining.'],
   ['Do my files go to a server?','No. Processing happens in your browser on both plans. To check the daily limit, only the tool name and a random operation id are sent — never the file, its name or its contents.']],
  accountTitle:'Nerulio Account',name:'Name',email:'Email',plan:'Plan',heavyJobs:'Heavy jobs today',studioExports:'Studio exports today',unlimited:'Unlimited',reset:'Resets in',ads:'Ads',on:'On',off:'Off',free:'Free',pro:'Pro',
  manage:'Manage subscription',signOut:'Sign out',signIn:'Sign in with Google',signedOutLead:'Every tool works without an account. A free Google sign-in unlocks more Studio engine exports each day, and is needed to buy or manage Pro.',
  noHistory:'Nerulio keeps no history of your files — they never reach our servers.',loginFailed:'Sign-in did not complete. Please try again.',
  activating:'Activating Pro. This usually takes a few seconds after payment.',activationSlow:'Your payment is being confirmed. Refresh this page in a minute; you will not be charged twice.',
  sandbox:'Sandbox checkout created. No payment was taken. Pro starts only when a signed test webhook is delivered.',
  proActive:'Nerulio Pro is active.',endsOn:'Pro ends on {date}',renewsOn:'Renews on {date}',
  serviceDown:'The account service is temporarily unavailable. All tools still work.',serviceOff:'Accounts are not enabled on this deployment.',
  limitTitle:'You have used today’s free heavy jobs',limitBody:'They refresh for free in {time}.',keepWork:'Your current file and settings are still here.',
  proPitch:'Nerulio Pro',proBullets:['Unlimited heavy jobs','Unlimited Studio engine exports','No ads','Same local processing','Same output quality'],later:'Come back tomorrow',
  remaining:'{n} free heavy jobs left today',graceUsed:'Nerulio could not be reached, so this job used one of today’s offline allowances. It counts toward today’s limit.',
  paused:'Heavy tools are paused: Nerulio can’t confirm your plan right now. Light tools keep working and your file is still here. Please try again in a moment.',
  updated:'Nerulio was just updated. Reload the page to continue — light tools keep working.',signInRequired:'Sign in with Google (free) to continue.',
  networkLimit:'Free heavy jobs from this network are paused until the daily reset (00:00 UTC). Light tools keep working.',rateLimited:'Too many requests at once. Please wait a minute and try again.',
  backToStudio:'You’re signed in. Go back to the Studio tab — your project is still open there, and you can export again.',studioAnon:'{a} a day without an account · {s} when signed in (free)',
  disputed:'Pro is paused while a payment dispute is reviewed. Please contact support.',pastDue:'The last payment failed. Pro stays on until {date} while the card is retried — update it in Manage subscription.',
  monthly:'Monthly',yearly:'Yearly',perYearSave:'{price} · save {pct}%',upgradeMonthly:'Upgrade — monthly',upgradeYearly:'Upgrade — yearly',accountFlagged:'This account needs a review before a new purchase. Please contact support.',
  challenge:'Quick check to keep free jobs available for everyone.',challengeFailed:'The check did not complete. Please try again.',hm:'{h}h {m}m'
 },
 ko:{
  pricing:'요금제',account:'계정',home:'모든 도구',
  pricingTitle:'품질은 같습니다. Free 또는 Pro.',pricingLead:'Nerulio는 브라우저에서 쓰는 게임 에셋 스튜디오입니다. 두 요금제 모두 스튜디오 전체와 모든 도구를 기기에서 같은 결과 품질로 사용합니다. Pro는 게임 스튜디오 요금제로, 광고와 하루 제한이 없습니다.',
  freeName:'Nerulio Free',freePrice:'무료',proName:'Nerulio Pro',priceTBA:'가격은 출시 시 공개',perMonth:'/ 월',perYear:'/ 년',
  freeFeatures:['스튜디오 전체와 모든 도구','원본 품질 그대로 — 워터마크·해상도 제한 없음','로컬 처리: 파일이 기기 밖으로 나가지 않음','스튜디오 엔진 내보내기 하루 {s}회(무료 로그인 시, 계정 없이 {a}회) — 편집·프로젝트 저장·PNG 한 장 내보내기는 무제한','파일 도구의 무거운 작업 하루 {n}회','광고 표시 (스튜디오에서는 큰 화면에서만 표시된 광고 칸 하나)'],
  proFeatures:['스튜디오 엔진 내보내기 무제한','광고 없음 — 스튜디오를 화면 전체로 사용','파일 도구의 무거운 작업 무제한','원본 품질 그대로','로컬 처리'],
  startFree:'스튜디오 열기',upgrade:'Pro로 업그레이드',signInToUpgrade:'Google로 로그인하고 업그레이드',purchasesClosed:'아직 결제를 받지 않습니다.',youArePro:'Nerulio Pro 사용 중입니다.',
  faq:[['스튜디오 내보내기란?','스튜디오에서 엔진용 묶음을 내보내는 것입니다. Pack & Export 아틀라스, Tile 타일셋, Texture 맵 세트(Godot·Unity·Phaser 등 대상별 ZIP)가 해당합니다. 가져오기·편집·미리보기·실행 취소·자동 저장·.nerulio 프로젝트 저장·PNG 한 장이나 .aseprite 파일 내보내기는 횟수에 포함되지 않습니다.'],
   ['무거운 작업이란?','AI 확대·AI 배경 제거, 이미지·PDF 압축, 영상·GIF·오디오 내보내기, 대용량 게임 에셋 묶음입니다. 자르기·회전·크기 조절·변환·PDF 페이지 편집 같은 가벼운 도구는 횟수에 포함되지 않습니다.'],
   ['하루 제한은 언제 초기화되나요?','매일 00:00 UTC(한국 시간 오전 9시)입니다. 계정 페이지에서 남은 시간을 볼 수 있습니다.'],
   ['파일이 서버로 가나요?','아니요. 두 요금제 모두 브라우저에서 처리합니다. 하루 제한 확인에는 도구 이름과 임의의 작업 ID만 보내며 파일·파일명·내용은 보내지 않습니다.']],
  accountTitle:'Nerulio 계정',name:'이름',email:'이메일',plan:'요금제',heavyJobs:'오늘 무거운 작업',studioExports:'오늘 스튜디오 내보내기',unlimited:'무제한',reset:'초기화까지',ads:'광고',on:'표시',off:'없음',free:'Free',pro:'Pro',
  manage:'구독 관리',signOut:'로그아웃',signIn:'Google로 로그인',signedOutLead:'모든 도구는 계정 없이 사용할 수 있습니다. 무료 Google 로그인을 하면 하루 스튜디오 엔진 내보내기 횟수가 늘어나며, Pro 구매·관리에도 로그인이 필요합니다.',
  noHistory:'Nerulio는 파일 기록을 보관하지 않습니다. 파일은 서버에 전송되지 않습니다.',loginFailed:'로그인이 완료되지 않았습니다. 다시 시도해 주세요.',
  activating:'Pro를 활성화하는 중입니다. 결제 후 보통 몇 초 걸립니다.',activationSlow:'결제를 확인하고 있습니다. 1분 뒤 새로고침해 주세요. 중복 청구되지 않습니다.',
  sandbox:'샌드박스 결제 화면을 만들었습니다. 실제 결제는 없으며 서명된 테스트 webhook이 도착해야 Pro가 시작됩니다.',
  proActive:'Nerulio Pro가 활성화되어 있습니다.',endsOn:'{date}에 Pro 종료',renewsOn:'{date}에 갱신',
  serviceDown:'계정 서비스에 일시적으로 연결할 수 없습니다. 모든 도구는 계속 사용할 수 있습니다.',serviceOff:'이 배포에서는 계정 기능이 꺼져 있습니다.',
  limitTitle:'오늘 무료 작업을 모두 사용했습니다',limitBody:'{time} 뒤에 다시 무료로 사용할 수 있습니다.',keepWork:'지금 작업 중인 파일과 설정은 그대로 있습니다.',
  proPitch:'Nerulio Pro',proBullets:['무거운 작업 무제한','스튜디오 엔진 내보내기 무제한','광고 없음','같은 로컬 처리','같은 결과 품질'],later:'내일 다시 사용',
  remaining:'오늘 무료 무거운 작업 {n}회 남음',graceUsed:'Nerulio에 연결되지 않아 오늘의 오프라인 허용 횟수로 실행했습니다. 오늘 사용 횟수에 포함됩니다.',
  paused:'지금은 요금제를 확인할 수 없어 무거운 작업을 잠시 멈췄습니다. 가벼운 도구는 계속 쓸 수 있고 파일도 그대로 있습니다. 잠시 뒤 다시 시도해 주세요.',
  updated:'Nerulio가 방금 업데이트되었습니다. 페이지를 새로고침한 뒤 계속해 주세요. 가벼운 도구는 계속 쓸 수 있습니다.',signInRequired:'계속하려면 Google로 무료 로그인해 주세요.',
  networkLimit:'이 네트워크의 무료 무거운 작업이 하루 초기화(00:00 UTC, 한국 시간 오전 9시)까지 멈췄습니다. 가벼운 도구는 계속 쓸 수 있습니다.',rateLimited:'요청이 한꺼번에 너무 많습니다. 1분 뒤 다시 시도해 주세요.',
  backToStudio:'로그인되었습니다. 스튜디오 탭으로 돌아가세요. 프로젝트는 그대로 열려 있고 다시 내보낼 수 있습니다.',studioAnon:'계정 없이 하루 {a}회 · 무료 로그인 시 {s}회',
  disputed:'결제 이의 제기를 검토하는 동안 Pro가 중지됩니다. 고객 지원에 문의해 주세요.',pastDue:'최근 결제가 실패했습니다. 카드 재시도 동안 {date}까지 Pro가 유지됩니다. 구독 관리에서 결제 수단을 바꿔 주세요.',
  monthly:'월간',yearly:'연간',perYearSave:'{price} · {pct}% 절약',upgradeMonthly:'월간으로 업그레이드',upgradeYearly:'연간으로 업그레이드',accountFlagged:'새 결제 전에 계정 확인이 필요합니다. 고객 지원에 문의해 주세요.',
  challenge:'모두가 무료 작업을 쓸 수 있도록 간단히 확인합니다.',challengeFailed:'확인이 완료되지 않았습니다. 다시 시도해 주세요.',hm:'{h}시간 {m}분'
 },
 ja:{
  pricing:'料金',account:'アカウント',home:'すべてのツール',
  pricingTitle:'品質は同じ。FreeかProか。',pricingLead:'Nerulioはブラウザで使うゲーム素材スタジオです。どちらのプランでもスタジオ全体と全ツールが端末上で動き、出力品質は同じです。Proはゲームスタジオ向けプランで、広告と1日の上限がありません。',
  freeName:'Nerulio Free',freePrice:'無料',proName:'Nerulio Pro',priceTBA:'価格は公開時にお知らせします',perMonth:'/ 月',perYear:'/ 年',
  freeFeatures:['スタジオ全体とすべてのツール','出力品質はそのまま — 透かし・解像度制限なし','ローカル処理：ファイルは端末の外に出ません','スタジオのエンジン書き出しは1日{s}回（無料ログイン時。アカウントなしは{a}回） — 編集・プロジェクト保存・PNG 1枚の書き出しは無制限','ファイルツールの重い処理は1日{n}回','広告あり（スタジオでは大きな画面でのみ、表示付きの広告枠が1つ）'],
  proFeatures:['スタジオのエンジン書き出しが無制限','広告なし — スタジオを画面いっぱいに','ファイルツールの重い処理が無制限','同じ出力品質','ローカル処理'],
  startFree:'スタジオを開く',upgrade:'Proにアップグレード',signInToUpgrade:'Googleでログインしてアップグレード',purchasesClosed:'現在は購入を受け付けていません。',youArePro:'Nerulio Proをご利用中です。',
  faq:[['スタジオの書き出しとは？','スタジオからエンジン向けのパックを書き出すことです。Pack & Exportのアトラス、Tileのタイルセット、Textureのマップセット（Godot・Unity・Phaserなど向けのZIP）が該当します。読み込み・編集・プレビュー・元に戻す・自動保存・.nerulioプロジェクトの保存・PNG 1枚や.asepriteファイルの書き出しは数えません。'],
   ['重い処理とは？','AI拡大・AI背景除去、画像・PDF圧縮、動画・GIF・音声の書き出し、大きなゲーム素材パックです。切り抜き・回転・リサイズ・変換・PDFページ編集などの軽いツールは数えません。'],
   ['上限はいつリセットされますか？','毎日00:00 UTC（日本時間9:00）です。アカウントページで残り時間を確認できます。'],
   ['ファイルはサーバーに送られますか？','いいえ。どちらのプランでもブラウザで処理します。上限の確認にはツール名とランダムな処理IDだけを送り、ファイル・ファイル名・内容は送りません。']],
  accountTitle:'Nerulioアカウント',name:'名前',email:'メール',plan:'プラン',heavyJobs:'今日の重い処理',studioExports:'今日のスタジオ書き出し',unlimited:'無制限',reset:'リセットまで',ads:'広告',on:'あり',off:'なし',free:'Free',pro:'Pro',
  manage:'サブスクリプションを管理',signOut:'ログアウト',signIn:'Googleでログイン',signedOutLead:'すべてのツールはアカウントなしで使えます。無料のGoogleログインでスタジオのエンジン書き出し回数が1日あたり増え、Proの購入・管理にもログインが必要です。',
  noHistory:'Nerulioはファイルの履歴を保存しません。ファイルはサーバーに送られません。',loginFailed:'ログインが完了しませんでした。もう一度お試しください。',
  activating:'Proを有効化しています。支払い後、通常数秒で完了します。',activationSlow:'支払いを確認中です。1分後に再読み込みしてください。二重に請求されることはありません。',
  sandbox:'サンドボックスの決済を作成しました。実際の支払いはなく、署名付きテストWebhookが届いたときだけProが始まります。',
  proActive:'Nerulio Proが有効です。',endsOn:'{date}にPro終了',renewsOn:'{date}に更新',
  serviceDown:'アカウントサービスに一時的に接続できません。すべてのツールは引き続き使えます。',serviceOff:'このデプロイではアカウント機能が無効です。',
  limitTitle:'今日の無料の重い処理を使い切りました',limitBody:'{time}後にまた無料で使えます。',keepWork:'作業中のファイルと設定はそのまま残っています。',
  proPitch:'Nerulio Pro',proBullets:['重い処理が無制限','スタジオのエンジン書き出しが無制限','広告なし','同じローカル処理','同じ出力品質'],later:'明日また使う',
  remaining:'今日の無料の重い処理：残り{n}回',graceUsed:'Nerulioに接続できないため、今日のオフライン許可枠で実行しました。今日の回数に数えられます。',
  paused:'現在プランを確認できないため、重い処理を一時停止しています。軽いツールは使え、ファイルもそのまま残っています。少し待ってからもう一度お試しください。',
  updated:'Nerulioが更新されました。ページを再読み込みしてから続けてください。軽いツールはそのまま使えます。',signInRequired:'続けるにはGoogleで無料ログインしてください。',
  networkLimit:'このネットワークからの無料の重い処理は、1日のリセット（00:00 UTC、日本時間9:00）まで停止しています。軽いツールは使えます。',rateLimited:'リクエストが集中しています。1分ほど待ってからもう一度お試しください。',
  backToStudio:'ログインしました。スタジオのタブに戻ってください。プロジェクトは開いたままで、また書き出せます。',studioAnon:'アカウントなしで1日{a}回・無料ログインで{s}回',
  disputed:'支払いの異議申し立てを確認している間、Proは停止されます。サポートにお問い合わせください。',pastDue:'直近の支払いに失敗しました。カードの再試行中は{date}までProが続きます。サブスクリプション管理で支払い方法を更新してください。',
  monthly:'月額',yearly:'年額',perYearSave:'{price}・{pct}%お得',upgradeMonthly:'月額でアップグレード',upgradeYearly:'年額でアップグレード',accountFlagged:'新しい購入の前にアカウントの確認が必要です。サポートにお問い合わせください。',
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
/** Yearly price line with the saving computed from the configured amounts (never hard-coded). */
export function yearlySaving(pricing){
 const m=Number(pricing?.amount),y=Number(pricing?.yearlyAmount);
 if(!(m>0&&y>0))return 0;
 return Math.max(0,Math.round((1-y/(m*12))*100));
}
export function yearlyText(pricing,locale){
 if(!pricing?.yearlyAmount||!pricing?.currency)return '';
 const price=`${new Intl.NumberFormat(locale,{style:'currency',currency:pricing.currency}).format(Number(pricing.yearlyAmount))} ${text(locale,'perYear')}`;
 const pct=yearlySaving(pricing);
 return pct>0?text(locale,'perYearSave',{price,pct}):price;
}
const list=items=>`<ul class="plan-features">${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`;
export function pricingHTML(locale,{pricing,freeDailyJobs,freeDailyStudio=10,freeAnonStudio=3}){
 const t=k=>text(locale,k),s=S[locale]||S.en;
 return `<h1>${esc(t('pricingTitle'))}</h1><p class="service-lead">${esc(t('pricingLead'))}</p>
<div class="plans">
<section class="plan" data-plan="free"><h2>${esc(t('freeName'))}</h2><p class="plan-price">${esc(t('freePrice'))}</p>${list(s.freeFeatures.map(f=>f.replace('{n}',freeDailyJobs).replace('{s}',freeDailyStudio).replace('{a}',freeAnonStudio)))}<a class="plan-cta secondary" href="${locale}/game/studio/">${esc(t('startFree'))}</a></section>
<section class="plan featured" data-plan="pro"><h2>${esc(t('proName'))}</h2><p class="plan-price" data-price>${esc(priceText(pricing,locale))}</p>${yearlyText(pricing,locale)?`<p class="plan-price-alt" data-price-yearly>${esc(yearlyText(pricing,locale))}</p>`:''}${list(s.proFeatures)}<div class="plan-action" id="proAction"><p class="plan-note">${esc(t('purchasesClosed'))}</p></div></section>
</div>
<section class="service-faq">${s.faq.map(([q,a])=>`<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join('')}</section>`;
}
export function accountHTML(locale){
 const t=k=>text(locale,k);
 return `<h1>${esc(t('accountTitle'))}</h1><div id="accountStatus" class="service-status" role="status" aria-live="polite"></div>
<div id="accountBody" class="account-card" aria-busy="true"><p class="service-lead">${esc(t('signedOutLead'))}</p></div>
<p class="service-note">${esc(t('noHistory'))}</p>`;
}
