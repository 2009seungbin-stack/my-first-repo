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
 // (a number glued to letters, e.g. "Y11S3.1", is not taken: it is part of a larger label)
 new RegExp(`(?:^|[^\\w.])${NUM}\\s*(?:[-\\u2013:]\\s*)?${KW}`,'i'),
 // any x.y.z token ("Terraria 1.4.5.7 - Out Now")
 /(?:^|[^\w.])(\d+\.\d+\.\d+(?:\.\d+)*[a-z]?)(?![\d.])/i,
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

/** Never an update, even when tagged: previews, announcements, notices, sales, diaries. */
const NOT_AN_UPDATE=/\b(upcoming|coming soon|preview|teaser|roadmap|sneak peek|stress test|next week|schedule[d]?|survey|revealed|announc(?:e|es|ed|ing|ement)|launch date|release date|trailer|known issues?|eta|service report|maintenance|bans? notice|dev(?:eloper)? diary|sale|discount|bundle|merch(?:andise)?)\b|\d+\s*% off|예정|예고|로드맵|사전\s*안내|점검|할인/i;
const UPDATE_WORDS=/\bpatch(?:\s*notes?)?\b|\bhot\s*-?fix(?:es)?\b|\bchange\s*log\b|\brelease notes?\b|패치|핫픽스|업데이트\s*(?:안내|내역|노트)/i;
/** A version alone is not enough without some release wording ("Hades II v1.0 Is Now Available!"
 * in the Hades feed is a sequel promo, "Terraria 1.4.5.7 - Out Now" is an update). */
const RELEASE_WORDS=/\b(patch|hot\s*-?fix|update[ds]?|change\s*log|release notes?|released|out now|now live|is live|version|build)\b|패치|업데이트|핫픽스|버전/i;
const BETA=/\b(beta|experimental|exp|public test|test server|ptr|playtest|stress test|public update preview)\b|테스트\s*서버|실험/i;
const SEQUEL=/^(?:[ivx]+|\d{1,2})$/i;

/**
 * True when the title is about a numbered sibling of this game (publishers cross-post:
 * "Civilization VII Update 1.2.2" in the Civilization VI feed, "Hades II v1.0" in the Hades feed).
 * @param {string} title @param {string|undefined} gameName
 */
export function aboutOtherGame(title,gameName){
 if(!gameName)return false;
 const words=String(gameName).replace(/[™®:–-]/g,' ').split(/\s+/).filter(Boolean);
 // anchor word = last non-sequel word of the name; the name's own sequel marker follows it (or none)
 let i=words.length-1;while(i>0&&SEQUEL.test(words[i]))i--;
 const anchor=words[i],own=(words[i+1]||'').toUpperCase();
 if(!anchor||anchor.length<4)return false;
 const re=new RegExp(`\\b${anchor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+([IVX]+|\\d{1,2})(?![\\w.])`,'gi');
 for(const m of title.matchAll(re))if(m[1].toUpperCase()!==own)return true;
 return false;
}

/**
 * Classify one news item.
 * - never an update: previews, announcements, notices, sales, dev diaries, posts about a sibling game;
 * - tagged `patchnotes` by the developer → update;
 * - otherwise the title must use patch/hotfix/changelog wording, or state a version together with
 *   release wording.
 * @param {{title?:string,tags?:string[]}} item @param {string} [gameName]
 * @returns {{update:boolean,version:string|null,channel:'stable'|'beta'}}
 */
export function classify(item,gameName){
 const title=String(item.title||''),tagged=(item.tags||[]).includes('patchnotes');
 const version=versionFromTitle(title);
 const excluded=NOT_AN_UPDATE.test(title)||aboutOtherGame(title,gameName);
 const update=!excluded&&(tagged||UPDATE_WORDS.test(title)||(!!version&&RELEASE_WORDS.test(title)));
 return {update,version:update?version:null,channel:BETA.test(title)?'beta':'stable'};
}

/** Unix seconds → {day:'YYYY-MM-DD', iso}. @param {number} sec */
export function postDate(sec){
 const d=new Date(sec*1000);return {day:d.toISOString().slice(0,10),iso:d.toISOString().replace('.000Z','Z')};
}
