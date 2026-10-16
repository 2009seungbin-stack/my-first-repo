// @ts-check
/** Public routes that connect the portal to its source-backed reference pages. Keep these links in
 * visible HTML: channel search and the sitemap should not be the only way to find the directories. */
export const DISCOVERY_TOPICS=Object.freeze([
 {id:'ai',icon:'ai',ko:'AI 서비스·모델·요금',en:'AI services, models and pricing',
  koDesc:'공식 요금·API 가격과 서비스 상태를 확인하세요.',enDesc:'Compare published plan and API prices, and check service status.',
  links:[{path:'ai/?type=plan',ko:'요금제 비교',en:'Plan comparison'},{path:'ai/?type=model',ko:'API 가격 비교',en:'API price comparison'}]},
 {id:'games',icon:'games',ko:'게임·한글패치',en:'Games and Korean patches',
  koDesc:'게임 정보와 패치 배포처, 커뮤니티의 작동 리포트를 함께 봅니다.',enDesc:'Find game information, patch sources and community compatibility reports.',
  links:[{path:'community/games/?kind=patch',ko:'한글패치 모음',en:'Korean patch collection'}]},
 {id:'hardware',icon:'hw',ko:'PC·그래픽카드',en:'PC hardware and GPUs',
  koDesc:'공식 스펙·벤치마크·국가별 중고 시세를 구분해서 비교하세요.',enDesc:'Compare official specifications, benchmark results and used-market snapshots.',
  links:[{path:'hardware/?type=gpu',ko:'GPU 스펙·VRAM 비교',en:'GPU specs and VRAM'},{path:'hardware/performance/',ko:'GPU·CPU 성능 비교',en:'GPU and CPU benchmarks'},{path:'hardware/used-prices/',ko:'국가별 중고 시세',en:'Used-market prices'}]},
 {id:'studio',icon:'studio',ko:'창작 도구·엔진',en:'Creator tools and engines',
  koDesc:'Godot·Blender·DAW 등 창작 도구의 정보와 관련 작업 도구를 찾습니다.',enDesc:'Explore Godot, Blender, DAWs and related creator workflows.',
  links:[{path:'tools/',ko:'브라우저 도구 전체',en:'All browser tools'}]},
 {id:'subculture',icon:'sub',ko:'애니·서브컬처',en:'Anime and subculture',
  koDesc:'작품·방송·행사 정보를 출처와 함께 확인하세요.',enDesc:'Find works, broadcasts and events with their source references.',links:[]}
]);
/** @param {string} l */
export function discoveryTopics(l){
 const lang=l==='ko'?'ko':'en';
 return DISCOVERY_TOPICS.map(x=>({id:x.id,icon:x.icon,name:x[lang],description:x[lang==='ko'?'koDesc':'enDesc'],href:`/${lang}/${x.id}/`,
  links:x.links.map(a=>({name:a[lang],href:`/${lang}/${a.path}`}))}));
}
