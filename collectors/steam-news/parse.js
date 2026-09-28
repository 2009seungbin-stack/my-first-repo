// @ts-check
/** Pure helpers for Steam news items (ISteamNews/GetNewsForApp v2). Titles only: post bodies
 * mention older versions ("fixed a bug from 1.2.3"), so a version is taken only from the title. */

/** A version-looking token that is really a date (2026.09.28, 09.25, 2026.9). @param {string} v */
function looksLikeDate(v){
 return /^(19|20)\d\d\.\d{1,2}(\.\d{1,2})?[a-z]?$/i.test(v)||/^0\d\.\d{1,2}$/.test(v);
}

const KW='(?:patch(?:\\s*notes?)?|hot\\s*-?fix|update(?:\\s*notes?)?|version|ver\\.?|build|release(?:\\s*notes?)?|패치(?:\\s*노트)?|업데이트|핫픽스|버전)';
const NUM='(\\d+(?:\\.\\d+)+[a-z]?)';
/** Ordered rules; the match whose version sits EARLIEST in the title wins
 * ("Kenshi 1.0.65 + FCS 2.14.2 Hotfix" → 1.0.65). */
const RULES=[
 // "Patch Version 1.5.12620", "Update notes for v1.5.78", "Update 1.6.4850 released", "패치 1.2"
 new RegExp(`${KW}\\s*(?:for\\s+)?[:#\\-\\u2013]?\\s*v?\\.?\\s*${NUM}(?![\\d.])`,'i'),
 // "v1.2.3", "V 1.4"
 new RegExp(`(?:^|[^a-z0-9])v\\.?\\s?${NUM}(?![\\d.])`,'i'),
 // "12.4a Hotfix", "1.0.68 Patch Notes"
 new RegExp(`(?:^|[^\\d.])${NUM}\\s*(?:[-\\u2013:]\\s*)?${KW}`,'i'),
 // any x.y.z token ("Terraria 1.4.5.7 - Out Now")
 /(?:^|[^\d.])(\d+\.\d+\.\d+(?:\.\d+)*[a-z]?)(?![\d.])/i,
];
/** Named patches without dotted numbers: "Patch 8", "Hotfix #36". */
const NAMED=/\b(Patch|Hotfix)\s*(#?)\s*(\d{1,4})(?![\d.])/i;
/** Date-stamped builds stated as a version: "Marvel Rivals Version 20260924 Patch Notes". */
const STAMP=/\bversion\s+(\d{6,8})\b/i;

/**
 * The version a post title states, or null.
 * @param {string} title @returns {string|null}
 */
export function versionFromTitle(title){
 const t=String(title||'');
 /** @type {{v:string,at:number}|null} */let best=null;
 for(const re of RULES){
  const m=re.exec(t);if(!m)continue;
  const v=m[1];if(looksLikeDate(v))continue;
  const at=m.index+m[0].indexOf(v);
  if(!best||at<best.at)best={v,at};
 }
 if(best)return best.v;
 const st=STAMP.exec(t);if(st)return st[1];
 const n=NAMED.exec(t);
 if(n)return `${/^p/i.test(n[1])?'Patch':'Hotfix'} ${n[2]}${n[3]}`;
 return null;
}

const NOT_AN_UPDATE=/\b(upcoming|coming soon|preview|teaser|roadmap|sneak peek|stress test|next week|schedule[d]?|survey|revealed|announc(?:e|es|ed|ing|ement)|launch date|release date|trailer|known issues?|eta|service report|maintenance|bans? notice)\b|예정|예고|로드맵|사전\s*안내|점검/i;
const UPDATE_WORDS=/\bpatch(?:\s*notes?)?\b|\bhot\s*-?fix(?:es)?\b|\bchange\s*log\b|\brelease notes?\b|패치|핫픽스|업데이트\s*(?:안내|내역|노트)/i;
const BETA=/\b(beta|experimental|public test|test server|ptr|playtest|stress test)\b|테스트\s*서버|실험/i;

/**
 * Classify one news item.
 * - tagged `patchnotes` by the developer → update;
 * - otherwise the title must state a version or use patch/hotfix/changelog wording, and must not
 *   announce something future ("upcoming", "preview", "예정" …).
 * @param {{title?:string,tags?:string[]}} item
 * @returns {{update:boolean,version:string|null,channel:'stable'|'beta'}}
 */
export function classify(item){
 const title=String(item.title||''),tagged=(item.tags||[]).includes('patchnotes');
 const version=versionFromTitle(title);
 const update=tagged||(!NOT_AN_UPDATE.test(title)&&(!!version||UPDATE_WORDS.test(title)));
 return {update,version:update?version:null,channel:BETA.test(title)?'beta':'stable'};
}

/** Unix seconds → {day:'YYYY-MM-DD', iso}. @param {number} sec */
export function postDate(sec){
 const d=new Date(sec*1000);return {day:d.toISOString().slice(0,10),iso:d.toISOString().replace('.000Z','Z')};
}
