import {SHIFT_JIS,EUC_KR,CP949} from './character-encoding-tables.js';
import {parseTweet,config as xConfig} from '../../assets/vendor/twitter-text-3.1.0.mjs';

export const X_RULE=`twitter-text 3.1.0 / config v${xConfig.version}`;
const tables={shift_jis:SHIFT_JIS,euc_kr:EUC_KR,cp949:CP949};
const decoded=new Map();
function table(name){
 if(decoded.has(name))return decoded.get(name);
 const raw=atob(tables[name]),a=new Uint16Array(65536);
 for(let i=0;i<a.length;i++)a[i]=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
 decoded.set(name,a);return a;
}
export function legacyBytes(input,name){
 if(!Object.hasOwn(tables,name))throw Error('Unknown encoding');
 const map=table(name);let bytes=0,unmappable=0;
 for(const ch of input){const cp=ch.codePointAt(0),v=cp<65536?map[cp]:0;
  if(cp===0){bytes++;continue;}
  if(!v){unmappable++;continue;}
  bytes+=v<256?1:2;
 }
 return {bytes:unmappable?null:bytes,unmappable};
}
const countSegments=(text,locale,granularity)=>{let n=0;for(const _ of new Intl.Segmenter(locale,{granularity}).segment(text))n++;return n;};
const countWordLike=(text,locale)=>{let n=0;for(const part of new Intl.Segmenter(locale,{granularity:'word'}).segment(text))if(part.isWordLike)n++;return n;};
const countNonblankLines=text=>text?text.split(/\r\n|\r|\n/u).filter(s=>s.trim()).length:0;
function scripts(text){const out={han:0,hiragana:0,katakana:0,hangul:0,latin:0,other:0};
 for(const ch of text){if(/\p{Script=Han}/u.test(ch))out.han++;else if(/\p{Script=Hiragana}/u.test(ch))out.hiragana++;else if(/\p{Script=Katakana}/u.test(ch))out.katakana++;else if(/\p{Script=Hangul}/u.test(ch))out.hangul++;else if(/\p{Script=Latin}/u.test(ch))out.latin++;else if(/\p{Letter}/u.test(ch))out.other++;}
 return out;
}
function repeatPhrases(text,locale){
 const found=new Map();let prev='';
 for(const part of new Intl.Segmenter(locale,{granularity:'word'}).segment(text)){if(!part.isWordLike)continue;
  const word=part.segment.toLocaleLowerCase(locale);if(word.length<2)continue;
  if(word===prev)found.set(word,(found.get(word)||0)+1);prev=word;
 }
 return [...found].slice(0,20).map(([phrase,count])=>({phrase,count}));
}
export function countText(text,{locale='en',readRate=250}={}){
 const seg=new Intl.Segmenter(locale,{granularity:'grapheme'});
 let graphemes=0,noSpaces=0,noLineBreaks=0,content=0,half=0,full=0;
 for(const {segment:g} of seg.segment(text)){
  graphemes++;const white=/^\s+$/u.test(g),line=/[\r\n\u2028\u2029]/u.test(g);
  if(!white)noSpaces++;if(!line)noLineBreaks++;if(!white&&!line)content++;
  // A display-width *estimate*, not byte count. Ambiguous and emoji stay in "other".
  if(/^[\x20-\x7e\uff61-\uff9f]$/u.test(g))half++;
  else if(/^[\uff01-\uff60\uffe0-\uffe6]$/u.test(g))full++;
 }
 const logical=text.replace(/\r\n|\r/gu,'\n');
 const paragraphs=logical.trim()?logical.trim().split(/\n\s*\n+/u).filter(Boolean).length:0;
 const words=countWordLike(text,locale),sentences=text.trim()?countSegments(text,locale,'sentence'):0;
 const x=parseTweet(text);
 const legacy=Object.fromEntries(Object.keys(tables).map(name=>[name,legacyBytes(text,name)]));
 return {graphemes,noSpaces,noLineBreaks,content,codePoints:[...text].length,utf16:text.length,
  spaces:graphemes-noSpaces,lines:text?logical.split('\n').length:0,nonblankLines:countNonblankLines(text),paragraphs,words,sentences,
  utf8:new TextEncoder().encode(text).length,legacy,x:{weighted:x.weightedLength,remaining:xConfig.maxWeightedTweetLength-x.weightedLength,valid:x.valid,rule:X_RULE},
  paper:{ja:content?Math.ceil(content/400):0,ko:content?Math.ceil(content/200):0},
  readSeconds:words?Math.max(1,Math.ceil(words/Math.max(1,readRate)*60)):0,
  scripts:scripts(text),width:{half,full,other:graphemes-half-full},repetitions:repeatPhrases(text,locale)};
}
