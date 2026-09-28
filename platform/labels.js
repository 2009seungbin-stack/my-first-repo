// @ts-check
/** Reader-facing labels for shared enums (ko/en; ja falls back to en until written). */
/** @param {{en:string,ko:string,ja?:string}|undefined} x @param {string} l */
export const label=(x,l)=>x?(/** @type {any} */(x)[l]||x.en):'';
export const VERIFICATION_LABEL=Object.freeze({
 OFFICIAL:{en:'✓ Official',ko:'✓ 공식'},
 AUTOMATED:{en:'⚙ Auto-detected',ko:'⚙ 자동 감지'},
 COMMUNITY_VERIFIED:{en:'● Community verified',ko:'● 커뮤니티 검증'},
 COMMUNITY:{en:'Community report',ko:'커뮤니티 리포트'},
 ESTIMATE:{en:'≈ Estimate',ko:'≈ 추정'},
 DISPUTED:{en:'Disputed',ko:'리포트 엇갈림'},
 UNKNOWN:{en:'? Unverified',ko:'? 미검증'},
});
export const COMPAT_STATUS_LABEL=Object.freeze({
 supported:{en:'Supported',ko:'공식 지원'},
 works:{en:'Works',ko:'작동'},
 works_with_issues:{en:'Works with issues',ko:'일부 문제'},
 broken:{en:"Doesn't work",ko:'안 됨'},
 unsupported:{en:'Not supported',ko:'미지원'},
 unverified_after_update:{en:'Unverified after update',ko:'업데이트 후 미검증'},
 unknown:{en:'Unknown',ko:'알 수 없음'},
});
export const AVAILABILITY_LABEL=Object.freeze({
 available:{en:'available',ko:'제공'},
 rolling_out:{en:'rolling out',ko:'롤아웃 중'},
 preview:{en:'in preview',ko:'프리뷰'},
 limited:{en:'limited',ko:'제한적 제공'},
 unavailable:{en:'not available',ko:'미제공'},
 deprecated:{en:'deprecated',ko:'지원 종료 예정'},
 unknown:{en:'unknown',ko:'확인 안 됨'},
});
