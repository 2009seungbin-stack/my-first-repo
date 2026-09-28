/** Source-scoped export profiles, checked 2026-09-29. Values are bytes, not decimal MB. */
export const PROFILES=Object.freeze({
 custom:Object.freeze({id:'custom',label:'Custom',width:0,maxWidth:0,maxHeight:0,maxBytes:0,maxTotal:0,format:'png',scope:'User-selected export settings',source:'',checked:'2026-09-29'}),
 naver:Object.freeze({id:'naver',label:'Naver Challenge Comics',width:690,maxWidth:690,maxHeight:0,maxBytes:5_000_000,maxTotal:50_000_000,format:'jpeg',scope:'Naver Challenge Comics upload, JPG/GIF; JPEG export used here. No official height cap.',source:'https://help.naver.com/service/5635/contents/18779?lang=ko&osType=COMMONOS',checked:'2026-09-29'}),
 canvas:Object.freeze({id:'canvas',label:'WEBTOON CANVAS',width:800,maxWidth:800,maxHeight:1280,maxBytes:2_000_000,maxTotal:20_000_000,format:'jpeg',scope:'800×1280 from general CANVAS notice. 2 MB/file and 20 MB/episode are conservative export targets from French Creator Academy and a 2025 contest FAQ, not universal permanent upload limits.',source:'https://www.webtoons.com/en/notice/detail?noticeNo=1766',bytesSource:'https://www.webtoons.com/fr/creators101/webtoon-academy',checked:'2026-09-29'}),
 postype:Object.freeze({id:'postype',label:'Postype image post',width:0,maxWidth:10000,maxHeight:10000,maxBytes:50_000_000,maxTotal:0,format:'png',scope:'PNG/JPG, each side at most 10,000 px and each file at most 50 MB; 700 px is a display width, not an upload width.',source:'https://help.postype.com/hc/ko/articles/360012345374-%EC%9D%B4%EB%AF%B8%EC%A7%80-%EC%82%BD%EC%9E%85%ED%95%98%EA%B3%A0-%ED%8E%B8%EC%A7%91%ED%95%98%EA%B8%B0',checked:'2026-09-29'})
});
export const profile=id=>PROFILES[id]||PROFILES.custom;
export function checkOutput(profileId,parts){
 const p=profile(profileId),errors=[],total=parts.reduce((n,x)=>n+x.bytes,0);
 for(const [i,part] of parts.entries()){
  if(p.width&&part.width!==p.width)errors.push(`${i+1}: width ${part.width} ≠ ${p.width}`);
  if(p.maxWidth&&part.width>p.maxWidth)errors.push(`${i+1}: width ${part.width} > ${p.maxWidth}`);
  if(p.maxHeight&&part.height>p.maxHeight)errors.push(`${i+1}: height ${part.height} > ${p.maxHeight}`);
  if(p.maxBytes&&part.bytes>p.maxBytes)errors.push(`${i+1}: ${part.bytes} bytes > ${p.maxBytes}`);
 }
 if(p.maxTotal&&total>p.maxTotal)errors.push(`total ${total} bytes > ${p.maxTotal}`);
 return {ok:errors.length===0,errors,total,scope:p.scope,source:p.source,bytesSource:p.bytesSource||'',checked:p.checked};
}
