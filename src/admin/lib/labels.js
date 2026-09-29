// @ts-check
/** Korean labels for the admin app (the whole app is Korean; codes stay as the API sends them). */

/** What a missing secret blocks, in plain Korean (503 NOT_CONFIGURED `need`). */
export const NEEDS=Object.freeze(/** @type {Record<string,{what:string,how:string}>} */({
 CF_ANALYTICS_TOKEN:{what:'D1 사용량을 보려면 Cloudflare 분석 토큰이 필요해요.',how:'Cloudflare에서 "Account Analytics: Read" 권한 토큰을 만들어 Pages 비밀값 CF_ANALYTICS_TOKEN으로 넣고, CF_ACCOUNT_ID 변수도 설정하세요.'},
 CF_ACCOUNT_ID:{what:'D1 사용량을 보려면 Cloudflare 계정 ID가 필요해요.',how:'Pages 변수 CF_ACCOUNT_ID에 Cloudflare 계정 ID를 넣으세요.'},
 GITHUB_DISPATCH_TOKEN:{what:'수집기를 여기서 바로 실행하려면 GitHub 실행 토큰이 필요해요.',how:'GitHub에서 이 저장소의 Actions 쓰기 권한만 있는 토큰을 만들어 Pages 비밀값 GITHUB_DISPATCH_TOKEN으로 넣으세요. 그 전에는 GitHub Actions 화면에서 직접 실행할 수 있어요.'},
 VAPID_PUBLIC_KEY:{what:'푸시 알림을 받으려면 알림 서명 키(VAPID)가 필요해요.',how:'키 생성 도구로 만든 VAPID_PUBLIC_KEY·VAPID_PRIVATE_KEY·VAPID_SUBJECT를 Pages에 설정하세요.'},
 VAPID_PRIVATE_KEY:{what:'푸시 알림을 보내려면 알림 서명 비밀키(VAPID)가 필요해요.',how:'VAPID_PRIVATE_KEY를 Pages 비밀값으로 넣으세요.'},
 VAPID_SUBJECT:{what:'푸시 알림을 보내려면 연락처(VAPID_SUBJECT, mailto:)가 필요해요.',how:'Pages 변수 VAPID_SUBJECT에 mailto: 주소를 넣으세요.'},
 ADMIN_SETUP_CODE:{what:'처음 등록하려면 설정 코드가 서버에 있어야 해요.',how:'Pages 비밀값 ADMIN_SETUP_CODE를 정한 뒤 여기서 같은 코드를 입력하세요.'},
 NOTIFY_TOKEN:{what:'수집기 실패 알림을 받으려면 알림 토큰이 필요해요.',how:'Pages 비밀값과 GitHub 비밀값 NOTIFY_TOKEN을 같은 값으로 넣으세요.'},
 TRAFFIC:{what:'방문자(사람·봇) 통계가 아직 켜지지 않았어요.',how:'방문 기록 설정이 배포되면 여기에 표시돼요.'},
 DB:{what:'데이터베이스(D1)가 연결되지 않은 배포예요.',how:'Pages 설정에서 D1 바인딩 DB를 확인하세요.'},
}));
/** @param {string|null|undefined} need @param {string} [fallback] */
export function needText(need,fallback='이 기능에 필요한 설정이 아직 없어요.'){
 const n=String(need||'').toUpperCase();
 return NEEDS[n]||{what:fallback,how:n?`서버 설정 ${n} 값이 필요해요.`:'서버 설정을 확인하세요.'};
}

export const VERTICALS=Object.freeze(/** @type {Record<string,string>} */({ai:'AI',games:'게임',hardware:'하드웨어',studio:'스튜디오',subculture:'서브컬처',fx:'환율'}));
/** CSS class for the vertical tag (n2 tokens). @param {string} v */
export const verticalClass=v=>({ai:'ai',games:'games',hardware:'hw',studio:'studio',subculture:'sub'})[v]||'';

export const COLLECTOR_STATE=Object.freeze(/** @type {Record<string,{label:string,tone:string}>} */({
 ok:{label:'정상',tone:'ok'},failing:{label:'실패',tone:'bad'},stale:{label:'오래됨',tone:'warn'},never:{label:'기록 없음',tone:'warn'},manual:{label:'수동',tone:'idle'},
}));
export const SCHEDULE=Object.freeze(/** @type {Record<string,string>} */({'30m':'30분마다 · 상태 페이지','6h':'6시간마다 · 릴리스·뉴스·일정',manual:'수동 입력'}));

export const FLAG_REASONS=Object.freeze(/** @type {Record<string,string>} */({spam:'스팸·도배',abuse:'욕설·혐오',wrong_info:'틀린 정보',source_dispute:'출처 이의',copyright:'권리 침해',duplicate:'중복',other:'기타'}));
export const MOD_ACTIONS=Object.freeze(/** @type {Record<string,string>} */({hide:'임시조치',unhide:'복구',dismiss:'기각',restrict:'이용 제한',unrestrict:'제한 해제',accept:'정보 제안 반영',reject:'정보 제안 반려',adopt:'새 값 채택',keep:'현재 값 유지',approve:'승인',importance:'중요도 조정'}));
export const TARGET_KIND=Object.freeze(/** @type {Record<string,string>} */({discussion:'글',comment:'댓글',user:'계정',proposal:'정보 제안',fact:'사실값',report:'리포트',entity:'채널'}));
export const QUICK_REASONS=Object.freeze(['외부 홍보 링크','욕설·비하','잘못된 정보','중복 글']);

export const BOT_CATEGORIES=Object.freeze(/** @type {Record<string,string>} */({search:'검색',ai:'AI',seo:'SEO',social:'소셜',monitor:'모니터링',library:'라이브러리',other:'기타'}));

/** Service status states (status collectors) → label + tone. @param {string} s */
export function statusState(s){
 const k=String(s||'').toLowerCase();
 if(/^(ok|operational|none|up|normal)$/.test(k))return {label:'정상',tone:'ok'};
 if(/degraded|minor|partial|maint/.test(k))return {label:k.includes('maint')?'점검':'일부 장애',tone:'warn'};
 if(/major|outage|critical|down/.test(k))return {label:'장애',tone:'bad'};
 if(/stale/.test(k))return {label:'오래된 값',tone:'warn'};
 return {label:k||'알 수 없음',tone:'mute'};
}
