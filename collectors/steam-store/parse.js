// @ts-check
/** Pure parsers for the Steam store appdetails JSON (no network, no clock). Kept separate from the
 * adapter so the tests can pin every edge case with recorded fixtures. */

const MONTHS=/** @type {Record<string,number>} */({jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12});
const pad=(/** @type {number} */ n)=>String(n).padStart(2,'0');

/**
 * Parse `supported_languages` (English response). Steam sends an HTML fragment such as
 *   "English<strong>*</strong>, Korean, Japanese<strong>*</strong><br><strong>*</strong>languages with full audio support"
 * where the asterisk marks languages with full audio. Returns [] for an empty/missing field.
 * @param {unknown} html
 * @returns {{name:string,fullAudio:boolean}[]}
 */
export function parseLanguages(html){
 if(typeof html!=='string'||!html.trim())return [];
 const head=html.split(/<br\s*\/?>/i)[0];
 const flat=head.replace(/<strong>\s*\*\s*<\/strong>/gi,'*').replace(/\[b\]\s*\*\s*\[\/b\]/gi,'*').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
 /** @type {{name:string,fullAudio:boolean}[]} */const out=[];const seen=new Set();
 for(const raw of flat.split(/[,\n\r]+/)){
  const t=raw.trim();if(!t)continue;
  const fullAudio=/\*\s*$/.test(t),name=t.replace(/\*+/g,'').trim();
  // The footnote sometimes arrives without <br>: "languages with full audio support".
  if(!name||/languages with full audio/i.test(name)||seen.has(name))continue;
  seen.add(name);out.push({name,fullAudio});
 }
 return out;
}

/**
 * Map the language list to the games vertical's `korean_official` enum.
 * Steam's field says whether a language is supported and whether it has full audio; it does not
 * separate interface from subtitles, so a Korean entry without the audio marker maps to
 * `interface_subtitles` (documented in docs/n2/sources-games.md).
 * @param {{name:string,fullAudio:boolean}[]} langs
 * @returns {'full_audio'|'interface_subtitles'|'none'|null} null = field missing (unknown)
 */
export function koreanSupport(langs){
 if(!langs.length)return null;
 const ko=langs.find(l=>/^korean$/i.test(l.name));
 return !ko?'none':ko.fullAudio?'full_audio':'interface_subtitles';
}

/**
 * Parse the English `release_date.date` string into an ISO date with the precision given.
 * Accepts "Feb 24, 2017", "24 Feb, 2017", "February 2017", "Feb, 2017", "2017". Returns null for
 * "Coming soon", "To be announced", quarters and anything else (omit rather than guess).
 * @param {unknown} s @returns {string|null}
 */
export function parseReleaseDate(s){
 if(typeof s!=='string')return null;
 const t=s.trim().replace(/\s+/g,' ');
 const mon=(/** @type {string} */ m)=>MONTHS[m.slice(0,3).toLowerCase()];
 const day=(/** @type {number} */ y,/** @type {number} */ m,/** @type {number} */ d)=>{
  const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d?`${y}-${pad(m)}-${pad(d)}`:null;
 };
 let m;
 if((m=/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(t))&&mon(m[1]))return day(+m[3],mon(m[1]),+m[2]);
 if((m=/^(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(t))&&mon(m[2]))return day(+m[3],mon(m[2]),+m[1]);
 if((m=/^([A-Za-z]{3,9})\.?,? (\d{4})$/.exec(t))&&mon(m[1]))return `${m[2]}-${pad(mon(m[1]))}`;
 if((m=/^(\d{4})$/.exec(t)))return m[1];
 return null;
}

/** Steam platform flags → vertical platform keys. @param {unknown} p @returns {string[]} */
export function parsePlatforms(p){
 if(!p||typeof p!=='object')return [];
 const o=/** @type {Record<string,unknown>} */(p);
 return [o.windows&&'windows',o.mac&&'macos',o.linux&&'linux'].filter(/** @returns {x is string} */x=>typeof x==='string');
}

/** Genre descriptions in the response's language. @param {unknown} g @returns {string[]} */
export function parseGenres(g){
 if(!Array.isArray(g))return [];
 return [...new Set(g.map(x=>typeof x?.description==='string'?x.description.trim():'').filter(Boolean))];
}

/** Store names carry ™/®/©; the display name drops them, the raw name stays an alias. @param {string} s */
export function cleanName(s){
 return String(s||'').replace(/[™®©]/g,'').replace(/\s+/g,' ').trim();
}

/** URL-safe key: ASCII letters/digits/dashes. Returns '' when nothing Latin remains. @param {string} s */
export function slugify(s){
 return String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/&/g,' and ').replace(/['’`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/,'');
}

/** Short stable hash for names without a Latin slug (FNV-1a, base36). @param {string} s */
export function shortHash(s){
 let h=0x811c9dc5;for(const ch of String(s)){h^=ch.codePointAt(0)||0;h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(36);
}

/** Company names as listed (developers/publishers), empty entries dropped. @param {unknown} a @returns {string[]} */
export function parseCompanies(a){
 if(!Array.isArray(a))return [];
 return [...new Set(a.map(x=>typeof x==='string'?x.replace(/\s+/g,' ').trim():'').filter(Boolean))];
}

/** http(s) homepage from the store's `website` field, or null. @param {unknown} u */
export function parseWebsite(u){
 if(typeof u!=='string'||!u.trim())return null;
 try{const x=new URL(u.trim());return (x.protocol==='https:'||x.protocol==='http:')&&!x.username&&!x.password&&x.hostname.includes('.')?x.href:null;}catch{return null;}
}

const EN_MONTH=['January','February','March','April','May','June','July','August','September','October','November','December'];
/** Human date for descriptions. @param {string} iso @param {'en'|'ko'} l */
export function humanDate(iso,l){
 const [y,m,d]=iso.split('-').map(Number);
 if(l==='ko')return d?`${y}년 ${m}월 ${d}일`:m?`${y}년 ${m}월`:`${y}년`;
 return d?`${d} ${EN_MONTH[m-1]} ${y}`:m?`${EN_MONTH[m-1]} ${y}`:String(y);
}
