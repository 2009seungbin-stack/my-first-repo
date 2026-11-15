// Pure helpers for the character counter: SMS segmentation, platform limit meters and word frequency.
// Nothing here touches the DOM, so it runs unchanged in the worker and under node:test.

// GSM 03.38 default alphabet (1 septet each) and its extension table (2 septets each).
const GSM_BASIC=new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ!"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà');
const GSM_EXTENDED=new Set('^{}\\[~]|€\f');
export const SMS_RULE={gsm7:{single:160,part:153},ucs2:{single:70,part:67}};

// Septet cost per UTF-16 code unit (0 = not in the GSM alphabet). Every GSM character is in the BMP.
const GSM_COST=new Uint8Array(65536);
for(const ch of GSM_BASIC)GSM_COST[ch.charCodeAt(0)]=1;
for(const ch of GSM_EXTENDED)GSM_COST[ch.charCodeAt(0)]=2;

// Returns how a text splits into SMS parts. A two-septet GSM character or a surrogate pair is never
// split across parts, so the part count comes from greedy packing rather than a plain division.
// Index loops (no per-character strings or arrays) keep this cheap for multi-megabyte input.
export function smsSegments(input){
 const text=String(input??''),n=text.length;
 let gsm=true,units=0;
 for(let i=0;i<n;i++){const cost=GSM_COST[text.charCodeAt(i)];if(!cost){gsm=false;break;}units+=cost;}
 if(!gsm)units=n;
 const encoding=gsm?'gsm7':'ucs2',rule=SMS_RULE[encoding];
 if(!units)return {encoding,units:0,segments:0,perSegment:rule.single,remaining:rule.single};
 if(units<=rule.single)return {encoding,units,segments:1,perSegment:rule.single,remaining:rule.single-units};
 let segments=1,used=0;
 for(let i=0;i<n;){
  let size=1;
  if(gsm)size=GSM_COST[text.charCodeAt(i)];
  else{const c=text.charCodeAt(i);if(c>=0xd800&&c<=0xdbff&&i+1<n){const d=text.charCodeAt(i+1);if(d>=0xdc00&&d<=0xdfff)size=2;}}
  if(used+size>rule.part){segments++;used=0;}
  used+=size;i+=gsm?1:size;
 }
 return {encoding,units,segments,perSegment:rule.part,remaining:rule.part-used};
}

// Published limits. `guide` rows are rules of thumb, not enforced limits.
export const PLATFORM_LIMITS=[
 {id:'x',max:280,unit:'weighted'},
 {id:'instagram',max:2200,unit:'utf16'},
 {id:'youtubeTitle',max:100,unit:'utf16'},
 {id:'youtubeDescription',max:5000,unit:'utf16'},
 {id:'metaTitle',max:60,unit:'graphemes',guide:true},
 {id:'metaDescription',max:160,unit:'graphemes',guide:true},
 {id:'krSms',max:90,unit:'cp949'}
];
function usedFor(unit,r){
 if(unit==='weighted')return r.x?.weighted??null;
 if(unit==='utf16')return r.utf16??null;
 if(unit==='graphemes')return r.graphemes??null;
 if(unit==='cp949')return r.legacy?.cp949?.bytes??null;
 if(unit==='utf8')return r.utf8??null;
 return null;
}
// Turns one count result into meter rows. `used:null` means the text cannot be measured in that unit
// (for example a character CP949 cannot encode), which is reported instead of guessed.
export function platformMeters(result){
 return PLATFORM_LIMITS.map(({id,max,unit,guide=false})=>{
  const used=usedFor(unit,result);
  return {id,max,unit,guide,used,over:used===null?0:Math.max(0,used-max),remaining:used===null?null:Math.max(0,max-used)};
 });
}

export const LIMIT_UNITS=['chars','utf8','cp949'];
// Value measured against the user's own limit. Byte units always include spaces and line breaks.
export function limitValue(result,{unit='chars',include=true}={}){
 if(unit==='utf8')return result.utf8??null;
 if(unit==='cp949')return result.legacy?.cp949?.bytes??null;
 return include?result.graphemes:result.content;
}

// Words used at least `minCount` times, most frequent first, with their share of all counted words.
// Ties keep first-appearance order. `counts` is a Map(word → count) in insertion order.
export function topKeywords(counts,total,{limit=8,minCount=2}={}){
 const rows=[];let index=0;
 for(const [word,count] of counts){if(count>=minCount)rows.push({word,count,index});index++;}
 rows.sort((a,b)=>b.count-a.count||a.index-b.index);
 return rows.slice(0,limit).map(({word,count})=>({word,count,share:total?count/total:0}));
}
