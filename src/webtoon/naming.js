/** Pure export naming. The default prefix keeps the long-standing episode-01.jpg names. */
export const DEFAULT_PREFIX='episode';
const RESERVED=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
/** Removes path separators, control characters and characters Windows/macOS reject in file names. */
export function sanitizePrefix(raw){
 let s=String(raw??'').normalize('NFC').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/gu,'').replace(/\s+/gu,' ').trim();
 s=s.replace(/^\.+/u,'').replace(/[. ]+$/u,'');
 s=[...s].slice(0,40).join('').replace(/[. ]+$/u,'');
 return !s||RESERVED.test(s)?DEFAULT_PREFIX:s;
}
/** Zero-padded part name; the pad width is at least 2 and grows with the part count. */
export function partName(prefix,index,count,extension){
 if(!Number.isSafeInteger(index)||!Number.isSafeInteger(count)||index<1||index>count)throw new RangeError('Invalid part index');
 const width=Math.max(2,String(count).length);
 return `${sanitizePrefix(prefix)}-${String(index).padStart(width,'0')}.${extension}`;
}
/** ZIP name. Only a plain-ASCII prefix is used, because some browsers drop non-ASCII download names. */
export const archiveName=prefix=>{const p=sanitizePrefix(prefix);return p===DEFAULT_PREFIX||!/^[\x20-\x7e]+$/u.test(p)?'webtoon-episode.zip':`${p}.zip`;};
