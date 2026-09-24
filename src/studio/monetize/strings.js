/** ko/en/ja copy for Studio monetization (ad column, Studio export limit, Pro touchpoints).
 * Self-contained so the shell's strings.js stays untouched; parity is tested like the others. */
export const MONETIZE_STRINGS={
 en:{
  'ad.label':'Advertisement',
  'ad.house':'Ads keep Nerulio Studio free. Your files never leave your device.',
  'ad.removePro':'Remove ads — Nerulio Pro',
  'meter.left':'{n} free Studio exports left today',
  'meter.none':'No free Studio exports left today',
  'meter.leftTitle':'Engine export bundles count toward the free daily limit. Saving the project, single PNG exports and all editing never count.',
  'meter.grace':'The account service did not respond, so this export used a temporary allowance.',
  'meter.paused':'Engine exports are paused because the account service cannot be reached. Your project is safe: keep editing, save it (.nerulio) and try again in a few minutes.',
  'meter.challengeFailed':'The check did not complete. Please try again.',
  'limit.title':'Today’s free Studio exports are used up',
  'limit.body':'You have used {used} of {limit} free engine exports today. They refresh for free in {time} (00:00 UTC).',
  'limit.safe':'Nothing is lost: your project is autosaved in this browser, and you can still edit, save the project (.nerulio) and export single PNGs.',
  'limit.pro':'Nerulio Pro — the game-studio plan',
  'limit.bullets':'Unlimited engine exports in the Studio|No ads in the Studio|Unlimited heavy jobs in the file tools|Same local processing and output quality',
  'limit.save':'Save project',
  'limit.upgrade':'See Pro',
  'limit.close':'Close',
  'limit.hm':'{h} h {m} min'
 },
 ko:{
  'ad.label':'광고',
  'ad.house':'광고 덕분에 Nerulio 스튜디오는 무료입니다. 파일은 기기 밖으로 나가지 않습니다.',
  'ad.removePro':'광고 없애기 — Nerulio Pro',
  'meter.left':'오늘 남은 무료 스튜디오 내보내기 {n}회',
  'meter.none':'오늘 무료 스튜디오 내보내기를 모두 사용했습니다',
  'meter.leftTitle':'엔진용 내보내기 묶음만 하루 무료 횟수에 포함됩니다. 프로젝트 저장, PNG 한 장 내보내기, 모든 편집은 횟수에 포함되지 않습니다.',
  'meter.grace':'계정 서비스가 응답하지 않아 임시 허용 횟수로 내보냈습니다.',
  'meter.paused':'계정 서비스에 연결할 수 없어 엔진 내보내기를 잠시 멈췄습니다. 프로젝트는 안전합니다. 계속 편집하고 프로젝트(.nerulio)를 저장한 뒤 몇 분 뒤에 다시 시도해 주세요.',
  'meter.challengeFailed':'확인이 완료되지 않았습니다. 다시 시도해 주세요.',
  'limit.title':'오늘 무료 스튜디오 내보내기를 모두 사용했습니다',
  'limit.body':'오늘 무료 엔진 내보내기 {limit}회 중 {used}회를 사용했습니다. {time} 뒤(00:00 UTC, 한국 시간 오전 9시)에 다시 무료로 사용할 수 있습니다.',
  'limit.safe':'잃는 것은 없습니다. 프로젝트는 이 브라우저에 자동 저장되며, 계속 편집하고 프로젝트(.nerulio)를 저장하고 PNG 한 장씩 내보낼 수 있습니다.',
  'limit.pro':'Nerulio Pro — 게임 스튜디오 요금제',
  'limit.bullets':'스튜디오 엔진 내보내기 무제한|스튜디오에 광고 없음|파일 도구의 무거운 작업 무제한|같은 로컬 처리와 같은 결과 품질',
  'limit.save':'프로젝트 저장',
  'limit.upgrade':'Pro 보기',
  'limit.close':'닫기',
  'limit.hm':'{h}시간 {m}분'
 },
 ja:{
  'ad.label':'広告',
  'ad.house':'Nerulioスタジオは広告により無料で提供されています。ファイルは端末の外に出ません。',
  'ad.removePro':'広告をなくす — Nerulio Pro',
  'meter.left':'今日の無料スタジオ書き出し：残り{n}回',
  'meter.none':'今日の無料スタジオ書き出しを使い切りました',
  'meter.leftTitle':'エンジン向けの書き出しパックだけが1日の無料回数に数えられます。プロジェクトの保存、PNG 1枚の書き出し、すべての編集は数えません。',
  'meter.grace':'アカウントサービスが応答しないため、一時的な許可枠で書き出しました。',
  'meter.paused':'アカウントサービスに接続できないため、エンジン向け書き出しを一時停止しています。プロジェクトは安全です。編集を続け、プロジェクト（.nerulio）を保存して、数分後にもう一度お試しください。',
  'meter.challengeFailed':'確認が完了しませんでした。もう一度お試しください。',
  'limit.title':'今日の無料スタジオ書き出しを使い切りました',
  'limit.body':'今日の無料エンジン書き出し{limit}回のうち{used}回を使いました。{time}後（00:00 UTC、日本時間9:00）にまた無料で使えます。',
  'limit.safe':'失われるものはありません。プロジェクトはこのブラウザに自動保存され、編集、プロジェクト（.nerulio）の保存、PNG 1枚ずつの書き出しは引き続きできます。',
  'limit.pro':'Nerulio Pro — ゲームスタジオ向けプラン',
  'limit.bullets':'スタジオのエンジン書き出しが無制限|スタジオに広告なし|ファイルツールの重い処理が無制限|同じローカル処理と同じ出力品質',
  'limit.save':'プロジェクトを保存',
  'limit.upgrade':'Proを見る',
  'limit.close':'閉じる',
  'limit.hm':'{h}時間{m}分'
 }
};
export function mt(locale,key,vars={}){
 const table=MONETIZE_STRINGS[locale]||MONETIZE_STRINGS.en;
 return String(table[key]??MONETIZE_STRINGS.en[key]??key).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
