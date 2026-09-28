/** Modern Hangul arithmetic per Unicode §3.12. KS X 1001 membership is a pinned bitset:
 * Ken Lunde, Unicode Technical Note #60 v2 (2026-07-02), KS X 1001 column, 2,350 rows.
 * Cross-checked byte-for-byte against Python's EUC-KR B0A1–C8FE repertoire.
 * This module decides coverage and size; it does not claim that a composed glyph is legible. */
export const HANGUL_BASE=0xac00,HANGUL_COUNT=11172;
const KS_BITS='kwf/PhGwAxMBKBARAACTBXseEbADlwE7EhGgAJOVazBRsAIRATIwEbACEQEKMHm4BhMBMBAAgAATAQsQEQAAkwMrEAAAAJMFa3RRsCMTATswEAAAAAAAcBGwAxMAKRARgCEBAAAwFbAOAwEwMAAAAhEBIxAAAAATgWsQEAADEwETEBEwAAEAADBVuCIAAAAwEbAClwf7OhGwAxMBIQAAAAAbDTs4EbADEwEzEQEAABMFKxwRAAEAAAAQEbAAEwEqMBmwAgEAEBAAAAARAQMwEDACEwdrFBEAABMFK3T5uI8TATsQAAAAAAAAcNmwShMBOxARAAMRAAAwWbEqEQEAEAAAAREBCxAAAAATASsQAAABAQAgEBGgAhEBITBZsAIBAAAwGbAHEwE7OBGwAwAAAAAAAAATDTs4EbADAQAQAAAAABMBIBAQAAABAAAQAQAAAAAAMBEYAgAAABAAAAARASMAAAAAkwELEBEwABEBKzARsMcTATswAYACAAAAMBGwgxMBKzARsAMRAAowEbACEQAgAAAAAREBKxARoAITASsQAAABAQAAMBGQAhMBKzARsGYAAAAwEbAC0wdrOhGwBwMBIAAAAAATBWs4EbADEwG4EAAAABsFKxABAAMAAAAQEaACEQEKcHmwohEBChAAAAARAQAQEZAAEQEJAAAAAJMFu/L5sCITATsyASAAAAAAMFmwBpMBOzARoCMRAABwEbACEQAQEAAAARMBAxABAACTBysWEAABAQAAMBEAAhEBKTARsAAAAAAwUbAOEwU7OBGwAwMAAQAAAACTATkQAAACAwA7AAAAABMBIwAAAAAAAAAQAAAAAQAgMBGQAgAAAAAAAAAAAAAQAAACEQEDAAAAABMBK7B5sCMTATswEbACEQEh8NmwQxMBOzARsAMRASBwUbAiEwEgEBGQAREBCzARsAKTAasWAAABEwEhMBGwAgMBKTAxsAIAAAAwGbhCGwEzOBEwAwAAIAAAAAATBTMQEQAAAAAAAAEAAJMFIzABAAEBABAQETAAAQAAMBEwAgEAEBAAAAARAAAAAAACE4UDEBEQABMBKzB3uGMTATswkbCiEQECMHvwVxMBK3DR8OMRARswcbkKEwE7MAGQAhMBKzARsAITByswETADEwEjMBGwAhMBqzARtP4RAQkwcbhH0wV7MBGwA1MBIRARAAATBWswEbACEQEzEAAAABMF6zgQoAIBADAQEbACEwAgMHGwAgEAEBAAAAATAQsQERAAEwErAAAAAJMFazaVsAMTATsQAQACAAAAMBGwAwEAIBAAAAEAAAAwEbAKAwEQEAAAAREBAwAAAAITASMQAAADAAAAEAAAAAEAABAAkAIAAAAwETCGUwF7MBGwA1EBIQAAAAATATswEbACEQAQEAEAAhMBKxARAAIAAAAQEbACAQABMBGwAgEAEBABAAARASsQERACEwErAAAAAJMDKzARsAITATswAAACAAAAMBmwAxMBKxARsAMBAAAwEbACEwEhEAAAAgEBABAAAAATASsQEQACAQAgMBGwAhEBATARMAIAAAAwEbACEwM7MBGwAwEAIAAAAAATBTswEbACEQAQEAEAABMBKxQBAAABAAAQAYACAQAAMBGwAgEAEBAAAAATASMQERACkwULEBEwABMBK3BRsCMTATswAAAAAAAAMBGwAxMBKxARMAMBAQowEbACAQAgAAAAABEAABARoACTBSsQAAACAAAAEBGQABEBKRARsAAAAAAwEbACEyErMBGwAwEAIAAAAAATBSswEbACEwE7EBEgABMhKzIRgAITACgwEaACEQEKMBGSAhEBITARAAITASswEZAC0wMrEhEwAhMBKwA=';
const KS_BYTES=Uint8Array.from(atob(KS_BITS),c=>c.charCodeAt(0));
export function hangulParts(codepoint){
 if(!Number.isInteger(codepoint)||codepoint<HANGUL_BASE||codepoint>=HANGUL_BASE+HANGUL_COUNT)throw Error('Not a modern precomposed Hangul syllable');
 const n=codepoint-HANGUL_BASE;
 return {leading:Math.floor(n/588),vowel:Math.floor((n%588)/28),trailing:n%28};
}
export function composeHangul(leading,vowel,trailing=0){
 for(const [n,limit,name] of [[leading,19,'leading'],[vowel,21,'vowel'],[trailing,28,'trailing']])
  if(!Number.isInteger(n)||n<0||n>=limit)throw Error('Invalid Hangul '+name+' index');
 return HANGUL_BASE+(leading*21+vowel)*28+trailing;
}
export function ksX1001Hangul(){
 const bits=KS_BYTES,out=[];
 for(let i=0;i<HANGUL_COUNT;i++)if(bits[i>>3]&(1<<(i&7)))out.push(HANGUL_BASE+i);
 return out;
}
export function isKsX1001Hangul(codepoint){
 if(codepoint<HANGUL_BASE||codepoint>=HANGUL_BASE+HANGUL_COUNT)return false;
 const i=codepoint-HANGUL_BASE;return !!(KS_BYTES[i>>3]&(1<<(i&7)));
}
export function kanaSet({hiragana=true,katakana=true}={}){
 const out=[];if(hiragana)for(let cp=0x3041;cp<=0x3096;cp++)out.push(cp);
 if(katakana)for(let cp=0x30a1;cp<=0x30fa;cp++)out.push(cp);
 return out;
}
/** Conservative one-page and total raw-RGBA estimate. Actual packed dimensions must be measured. */
export function estimateGlyphAtlas(count,cellW,cellH,{maxSide=4096,maxPixels=16_777_216}={}){
 if(![count,cellW,cellH,maxSide,maxPixels].every(Number.isSafeInteger)||count<1||cellW<1||cellH<1)throw Error('Invalid atlas estimate input');
 const capacity=Math.floor(maxSide/cellW)*Math.floor(maxSide/cellH);
 if(!capacity)throw Error('Cell exceeds atlas side');
 const perPage=Math.min(capacity,Math.floor(maxPixels/(cellW*cellH)));
 if(!perPage)throw Error('Cell exceeds pixel budget');
 const pixels=count*cellW*cellH,pages=Math.ceil(count/perPage);
 return {glyphs:count,cellW,cellH,pixels,rawRgbaBytes:pixels*4,minimumPages:pages,
  onePageFits:pages===1&&pixels<=maxPixels,warning:pages>1?'Multi-page engine import is unverified for this size':null};
}
