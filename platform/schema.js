// @ts-check
/** Shared vocabulary of the Nerulio 2.0 graph. Pure data + validators; used by the Worker, the
 * build, collectors and tests. Vertical-specific vocabularies live in platform/verticals/*.js. */

export const VERTICALS=/** @type {const} */(['ai','games','hardware','studio','subculture']);
/** Analytics also attributes tool usage. */
export const ANALYTICS_VERTICALS=/** @type {const} */(['AI','GAMES','HARDWARE','STUDIO','SUBCULTURE','TOOLS']);
export const MATURITY=/** @type {const} */(['LIVE','BETA','EXPERIMENT','PAUSED']);
export const PLATFORM_LOCALES=/** @type {const} */(['ko','en']);
/** Locales the architecture knows (ja: tools only today; platform strings not yet written). */
export const KNOWN_LOCALES=/** @type {const} */(['ko','en','ja']);

/** Ordered by trust: a lower index may supersede a higher one, never the reverse. */
export const VERIFICATION=/** @type {const} */(['OFFICIAL','AUTOMATED','COMMUNITY_VERIFIED','ESTIMATE','COMMUNITY','DISPUTED','UNKNOWN']);
export const SOURCE_KINDS=/** @type {const} */(['OFFICIAL','OFFICIAL_API','FEED','CURATED','COMMUNITY','MANUAL_SOURCE','ESTIMATE_METHOD']);
export const COMPAT_STATUS=/** @type {const} */(['supported','works','works_with_issues','broken','unsupported','unverified_after_update','unknown']);
export const AVAILABILITY_STATE=/** @type {const} */(['available','rolling_out','preview','limited','unavailable','deprecated','unknown']);
export const EVENT_KINDS=/** @type {const} */(['release','event','collab','popup','merch_release','broadcast','exhibition','sale','update','incident','other']);
export const DATE_PRECISION=/** @type {const} */(['time','day','month','quarter','year']);
export const PLATFORMS=/** @type {const} */(['web','ios','android','windows','macos','linux','api','*']);
export const REPORT_KINDS=/** @type {const} */(['compat','benchmark','issue']);
export const REPORT_RESULTS=/** @type {const} */(['works','works_with_issues','broken']);
export const TIERS=/** @type {const} */(['new','contributor','trusted','maintainer','curator']);
export const ROLES=/** @type {const} */(['user','moderator','curator','admin']);

/** Relation predicates shared by all verticals, with reader-facing labels. */
export const PREDICATES=Object.freeze({
 made_by:{en:'Made by',ko:'제조/개발',inverse:{en:'Makes',ko:'제품'}},
 offers:{en:'Offers',ko:'제공 서비스',inverse:{en:'Offered by',ko:'제공사'}},
 has_plan:{en:'Plans',ko:'요금제',inverse:{en:'Plan of',ko:'서비스'}},
 includes_model:{en:'Models',ko:'포함 모델',inverse:{en:'Included in',ko:'포함된 요금제/서비스'}},
 part_of:{en:'Part of',ko:'소속',inverse:{en:'Includes',ko:'포함'}},
 successor_of:{en:'Successor of',ko:'이전 세대',inverse:{en:'Succeeded by',ko:'다음 세대'}},
 variant_of:{en:'Variant of',ko:'변형 모델',inverse:{en:'Variants',ko:'변형'}},
 runs_on:{en:'Runs on',ko:'실행 환경',inverse:{en:'Runs',ko:'실행 가능'}},
 developed_by:{en:'Developer',ko:'개발사',inverse:{en:'Developed',ko:'개발작'}},
 published_by:{en:'Publisher',ko:'퍼블리셔',inverse:{en:'Published',ko:'퍼블리싱'}},
 translates:{en:'Translation of',ko:'번역 대상',inverse:{en:'Translations',ko:'번역 패치'}},
 supports_host:{en:'Runs in',ko:'지원 호스트',inverse:{en:'Plugins',ko:'플러그인'}},
 belongs_to:{en:'Franchise',ko:'프랜차이즈',inverse:{en:'Works',ko:'작품'}},
 appears_in:{en:'Appears in',ko:'등장 작품',inverse:{en:'Characters',ko:'등장인물'}},
 voiced_by:{en:'Voice',ko:'성우',inverse:{en:'Roles',ko:'배역'}},
 produced_by:{en:'Studio',ko:'제작사',inverse:{en:'Productions',ko:'제작 작품'}},
 created_by:{en:'Creator',ko:'원작자',inverse:{en:'Created',ko:'작품'}},
 adapted_from:{en:'Adapted from',ko:'원작',inverse:{en:'Adaptations',ko:'미디어화'}},
 merchandise_of:{en:'Merchandise of',ko:'굿즈 대상',inverse:{en:'Merchandise',ko:'굿즈'}},
 collab_with:{en:'Collaboration',ko:'콜라보',inverse:{en:'Collaborations',ko:'콜라보'}},
 related_to:{en:'Related',ko:'관련',inverse:{en:'Related',ko:'관련'}},
});

/** @param {unknown} v */
export const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Entity id: 'type:key' with a lower-case key of letters, digits, dot, dash. */
export const ENTITY_ID=/^[a-z_]+:[a-z0-9][a-z0-9.-]{0,95}$/;
export const SLUG=/^[a-z0-9][a-z0-9-]{0,95}$/;
export const SOURCE_ID=/^src:[a-z0-9][a-z0-9._-]{0,120}$/;
export const ISO_DATE=/^\d{4}(-\d\d(-\d\d)?)?$/;
export const REGION=/^(\*|GLOBAL|EEA|EU|[A-Z]{2})$/;

/** Normalize a searchable name: NFKC, lower case, drop spaces and punctuation (Hangul/Kana kept). */
export function normName(/** @type {string} */ s){
 return String(s).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
}
/** Parse a (partial) ISO date to epoch ms at UTC midnight; year-only → Jan 1. */
export function dateMs(/** @type {string} */ s){
 if(!ISO_DATE.test(s))throw Error(`Not an ISO date: ${s}`);
 const [y,m='01',d='01']=s.split('-');return Date.UTC(+y,+m-1,+d);
}
/** Precision of a partial ISO date. */
export const datePrecision=(/** @type {string} */ s)=>s.length===4?'year':s.length===7?'month':'day';
export function isHttpURL(/** @type {unknown} */ u){
 if(typeof u!=='string')return false;
 try{const x=new URL(u);return (x.protocol==='https:'||x.protocol==='http:')&&!x.username&&!x.password;}catch{return false;}
}
/** Stable string for a compatibility environment ({} → ''). */
export function envKey(/** @type {Record<string,unknown>} */ env){
 return Object.keys(env||{}).sort().map(k=>`${k}=${String(env[k])}`).join(';');
}
/** a may supersede b (a is at least as trusted). */
export function mayOverride(/** @type {string} */ a,/** @type {string} */ b){
 const ia=VERIFICATION.indexOf(/** @type {any} */(a)),ib=VERIFICATION.indexOf(/** @type {any} */(b));
 return ia>=0&&ib>=0&&ia<=ib;
}

/** Properties that name "the newest release of X". They only move forward in time, so a value
 * that is older than reality is wrong however trusted its label was when it was written. */
export const VERSION_PROPERTIES=Object.freeze(new Set(['latest_version','current_build','current_version','latest_driver','patch_version']));
/** Compare two version strings by their dotted numeric part ("v7.81", "Ver.1.042.00.02", "b4567",
 * "580.95.05"); a positive result means a is newer. null when either is not version-like or they
 * differ only in a suffix ("7.80" vs "7.80a", "5.0-beta1") — then no order is assumed.
 * @param {unknown} a @param {unknown} b @returns {number|null} */
export function compareVersionStrings(a,b){
 const parse=(/** @type {unknown} */ v)=>{
  const m=/^[^\d]{0,12}?(\d+(?:[._]\d+)*)(.*)$/.exec(String(v??'').trim());
  return m&&String(v).length<=64?{n:m[1].split(/[._]/).map(Number),rest:m[2]}:null;
 };
 const x=parse(a),y=parse(b);if(!x||!y)return null;
 for(let i=0;i<Math.max(x.n.length,y.n.length);i++){const d=(x.n[i]||0)-(y.n[i]||0);if(d)return d>0?1:-1;}
 return x.rest===y.rest?0:null;
}
/** May an incoming observation replace the current value of a fact? The trust ladder (mayOverride),
 * plus one exception for VERSION_PROPERTIES: a collector's AUTOMATED reading of a strictly NEWER
 * version supersedes an OFFICIAL value (typically curated seed data that has since gone stale).
 * The older value stays in history; an older or unparseable automated value still only raises a
 * conflict. Collectors that read the vendor's own release channel label their facts OFFICIAL and
 * never need the exception.
 * @param {{ver:string,value:unknown,property:string}} incoming @param {{verification:string,value:unknown}} current */
export function supersedes(incoming,current){
 if(mayOverride(incoming.ver,current.verification))return true;
 return VERSION_PROPERTIES.has(incoming.property)&&incoming.ver==='AUTOMATED'&&current.verification==='OFFICIAL'
  &&(compareVersionStrings(incoming.value,current.value)??0)>0;
}
