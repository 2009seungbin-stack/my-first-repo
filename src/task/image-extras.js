/** Strings and pure helpers used only by the image file tools (compress, convert, resize).
 * Kept apart from the shared string table so these tools can grow without touching it.
 * No DOM access at import time: everything here is testable in Node. */
const S={
 ko:{
  targetGroup:'목표 용량',targetOff:'제한 없음',
  targetMet:'목표 {t} 이하 달성',
  targetMissed:'목표 {t} 이하를 맞추지 못했습니다. 이 설정에서 가장 작은 결과는 {b}로, 목표보다 {over} 큽니다.',
  targetTryShrink:'고급 설정의 “목표 용량을 못 맞추면 크기도 줄이기”를 켜거나 최대 너비를 줄여 보세요.',
  targetShort:'{t} 이하 ✓',targetShortMissed:'{t} 초과',
  targetTally:'{m}개 중 {n}개가 {t} 이하',
  alphaFilled:'JPG는 투명도를 저장할 수 없어 투명한 부분을 {bg} 색으로 채웠습니다. 투명도를 유지하려면 PNG나 WebP를 선택하세요.',
  grew:'{f}로 저장하니 원본보다 커졌습니다({a} → {b}). 용량이 중요하면 원본을 그대로 쓰거나 다른 형식을 선택하세요.',
  pngLossless:'PNG는 무손실이라 화질 값이 적용되지 않습니다.',
  noAvif:'이 브라우저에는 AVIF 인코더가 없어 AVIF로 저장하기는 표시하지 않았습니다.',
  ssimNote:'(SSIM은 긴 변 512px 이하 축소본에서 측정)',
  presetGroup:'자주 쓰는 크기',swap:'가로·세로 바꾸기',
 },
 en:{
  targetGroup:'Target size',targetOff:'No limit',
  targetMet:'target of {t} or less met',
  targetMissed:'Target size not reached. The smallest result with these settings is {b}, {over} over the {t} target.',
  targetTryShrink:'Turn on “Reduce dimensions if the target cannot be met” under Advanced settings, or lower the max width.',
  targetShort:'under {t} ✓',targetShortMissed:'over {t}',
  targetTally:'{n} of {m} under {t}',
  alphaFilled:'JPG cannot store transparency, so transparent areas were filled with {bg}. Choose PNG or WebP to keep transparency.',
  grew:'Saving as {f} made this file larger than the original ({a} → {b}). If size matters, keep the original file or try another format.',
  pngLossless:'PNG is lossless, so the quality value does not apply.',
  noAvif:'Saving as AVIF is not offered here because this browser has no AVIF encoder.',
  ssimNote:'(SSIM measured on a copy whose longest side is at most 512 px)',
  presetGroup:'Popular sizes',swap:'Swap width and height',
 },
 ja:{
  targetGroup:'目標サイズ',targetOff:'制限なし',
  targetMet:'目標 {t} 以下を達成',
  targetMissed:'{t} 以下にできませんでした。この設定での最小結果は {b} で、目標より {over} 大きいです。',
  targetTryShrink:'詳細設定の「目標に届かない場合はサイズも縮小」をオンにするか、最大幅を小さくしてください。',
  targetShort:'{t} 以下 ✓',targetShortMissed:'{t} 超過',
  targetTally:'{m}件中 {n}件が {t} 以下',
  alphaFilled:'JPGは透明度を保存できないため、透明部分を {bg} で塗りつぶしました。透明度を残すにはPNGかWebPを選んでください。',
  grew:'{f}で保存すると元のファイルより大きくなりました（{a} → {b}）。容量が重要なら元のファイルを使うか、別の形式を選んでください。',
  pngLossless:'PNGは可逆形式のため、画質の値は適用されません。',
  noAvif:'このブラウザにはAVIFエンコーダーがないため、AVIFでの保存は表示していません。',
  ssimNote:'（SSIMは長辺512px以下の縮小コピーで計測）',
  presetGroup:'よく使うサイズ',swap:'幅と高さを入れ替える',
 },
};
export const EXTRA_LOCALES=Object.keys(S);
export function say(locale,key,vars={}){
 const s=S[locale]?.[key]??S.en[key]??key;
 return s.replace(/\{(\w+)\}/g,(m,k)=>Object.hasOwn(vars,k)?String(vars[k]):m);
}
/** Target-size shortcuts, in KB. 0 (no limit) is rendered separately. */
export const TARGETS=[100,500,1024,2048];
export const targetLabel=kb=>kb>=1024&&kb%1024===0?`${kb/1024} MB`:`${kb} KB`;
/** Whether an output of `size` bytes meets a target of `kb` kilobytes; null when no target is set. */
export function targetVerdict(size,kb){
 if(!(kb>0))return null;
 const limit=kb*1024;
 return {met:size<=limit,limit,over:Math.max(0,size-limit)};
}
/** Batch tally over results that carry {targetKb,met}; null unless every result shares one target. */
export function targetTally(results){
 const kbs=[...new Set(results.map(r=>r?.targetKb||0))];
 if(kbs.length!==1||!kbs[0])return null;
 return {kb:kbs[0],met:results.filter(r=>r.met).length,total:results.length};
}
/** "WebP · Quality 80 · SSIM 0.975": what the encoder search actually picked and how it scored.
 * The score is floored, never rounded up, and PNG shows no quality because it has none. */
export function chosenLabel({format,quality,ssim}={},qualityWord='Quality'){
 const parts=[{jpeg:'JPG',png:'PNG',webp:'WebP',avif:'AVIF'}[format]||String(format||'').toUpperCase()];
 if(format!=='png'&&Number.isFinite(quality)&&quality>0)parts.push(`${qualityWord} ${Math.round(quality*100)}`);
 if(Number.isFinite(ssim))parts.push(`SSIM ${(Math.floor(Math.min(1,Math.max(0,ssim))*1000)/1000).toFixed(3)}`);
 return parts.filter(Boolean).join(' · ');
}
/** Short chip labels for the platform sizes in landings.js (SOCIAL); the full name stays in the chip's title. */
const SHORT={
 ko:{'instagram-post':'인스타 1:1','instagram-portrait':'인스타 4:5','instagram-story':'스토리 9:16','youtube-thumbnail':'유튜브 16:9','youtube-banner':'유튜브 배너','x-header':'X 헤더','linkedin-banner':'링크드인','discord-banner':'디스코드'},
 en:{'instagram-post':'Instagram 1:1','instagram-portrait':'Instagram 4:5','instagram-story':'Story 9:16','youtube-thumbnail':'YouTube 16:9','youtube-banner':'YouTube banner','x-header':'X header','linkedin-banner':'LinkedIn','discord-banner':'Discord'},
 ja:{'instagram-post':'Instagram 1:1','instagram-portrait':'Instagram 4:5','instagram-story':'ストーリー 9:16','youtube-thumbnail':'YouTube 16:9','youtube-banner':'YouTubeバナー','x-header':'Xヘッダー','linkedin-banner':'LinkedIn','discord-banner':'Discord'},
};
export const presetLabel=(slug,w,h,locale='en')=>(SHORT[locale]||SHORT.en)[slug]||`${w}×${h}`;
/** The tools' own stylesheet, attached once (same pattern as pixel-avatar.css). */
export function attachStyles(){
 if(typeof document==='undefined'||document.querySelector('[data-image-tools-css]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./image-tools.css',import.meta.url).href;link.dataset.imageToolsCss='';document.head.append(link);
}
