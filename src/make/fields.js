/** Settings shown for each step on the workbench's right column ("조정"): the first fields are the ones
 * ordinary people need; `adv` fields fold under 고급. Values and ranges come from platform/recipe.js —
 * this file only names and arranges them. */
import {FIT_SPECS} from '../pipeline/recipe.js';

const T=(ko,en)=>({ko,en});
const pct=v=>`${Math.round(v*100)}%`;
/** @typedef {{k:string,label:{ko:string,en:string},kind:'chips'|'range'|'select'|'check'|'color'|'text',opts?:[any,{ko:string,en:string}][],min?:number,max?:number,step?:number,fmt?:(v:any,p:any,l:string)=>string,adv?:boolean,show?:(p:any)=>boolean}} Field */
/** @type {Record<string,Field[]>} */
export const FIELDS={
 'bg.remove':[
  {k:'mode',label:T('방식','Method'),kind:'chips',opts:[['auto',T('자동','Auto')],['ai',T('AI','AI')],['color',T('단색 배경','Solid backdrop')]]},
  {k:'hard',label:T('가장자리 딱 떨어지게 (스티커용)','Hard edge (for stickers)'),kind:'check'},
  {k:'tolerance',label:T('단색으로 볼 범위','Backdrop tolerance'),kind:'range',min:4,max:120,step:1,adv:true,show:p=>p.mode!=='ai'},
  {k:'refine',label:T('AI 가장자리 다듬기','AI edge refinement'),kind:'check',adv:true,show:p=>p.mode!=='color'},
 ],
 'sheet.split':[
  {k:'mode',label:T('나누는 방법','How'),kind:'chips',opts:[['auto',T('자동 감지','Detect')],['grid',T('격자','Grid')]]},
  {k:'cols',label:T('가로 칸','Columns'),kind:'range',min:1,max:16,step:1,show:p=>p.mode==='grid'},
  {k:'rows',label:T('세로 칸','Rows'),kind:'range',min:1,max:16,step:1,show:p=>p.mode==='grid'},
  {k:'tolerance',label:T('배경으로 볼 범위','Backdrop tolerance'),kind:'range',min:8,max:120,step:1,adv:true},
 ],
 crop:[
  {k:'mode',label:T('기준','Around'),kind:'chips',opts:[['subject',T('피사체','Subject')],['center',T('가운데','Centre')]]},
  {k:'margin',label:T('여백','Margin'),kind:'range',min:0,max:.5,step:.01,fmt:pct},
  {k:'ratio',label:T('비율','Ratio'),kind:'select',opts:[['free',T('그대로','Free')],['1:1',T('1:1 정사각','1:1 square')],['4:5',T('4:5','4:5')],['3:4',T('3:4','3:4')],['4:3',T('4:3','4:3')],['2:3',T('2:3','2:3')],['3:2',T('3:2','3:2')],['9:16',T('9:16 세로','9:16 portrait')],['16:9',T('16:9 가로','16:9 landscape')]]},
  {k:'shape',label:T('모양','Shape'),kind:'chips',opts:[['rect',T('네모','Square')],['circle',T('원','Circle')],['rounded',T('둥근 모서리','Rounded')]]},
  {k:'radius',label:T('모서리 둥글기','Corner radius'),kind:'range',min:0,max:.5,step:.01,fmt:pct,adv:true,show:p=>p.shape==='rounded'},
 ],
 upscale:[
  {k:'scale',label:T('배율','Scale'),kind:'chips',opts:[[2,T('×2','×2')],[3,T('×3','×3')],[4,T('×4','×4')],[6,T('×6','×6')],[8,T('×8','×8')]]},
  {k:'engine',label:T('방식','Method'),kind:'chips',opts:[['ai',T('AI (선명하게)','AI (sharp)')],['smooth',T('부드럽게','Smooth')],['pixel',T('도트 그대로','Pixel (nearest)')]]},
  {k:'maxSide',label:T('최대 크기 (긴 변)','Max size (long side)'),kind:'range',min:256,max:8192,step:256,fmt:v=>`${v}px`,adv:true},
 ],
 fit:[
  {k:'preset',label:T('규격','Spec'),kind:'select',opts:[...Object.entries(FIT_SPECS).map(([id,s])=>[id,s.names]),['custom',T('직접 정하기','Custom')]]},
  {k:'w',label:T('가로','Width'),kind:'range',min:16,max:4096,step:2,fmt:v=>`${v}px`,show:p=>p.preset==='custom'},
  {k:'h',label:T('세로','Height'),kind:'range',min:16,max:4096,step:2,fmt:v=>`${v}px`,show:p=>p.preset==='custom'},
  {k:'mode',label:T('맞추는 방법','Fit'),kind:'chips',opts:[['contain',T('전체 보이기','Contain')],['cover',T('꽉 채우기','Cover')]],show:p=>p.preset==='custom'},
  {k:'margin',label:T('여백','Margin'),kind:'range',min:0,max:.3,step:.01,fmt:pct,show:p=>p.preset==='custom'},
  {k:'scale',label:T('크기 바꾸는 방식','Resampling'),kind:'chips',opts:[['smooth',T('부드럽게','Smooth')],['nearest',T('도트 그대로','Nearest')]],adv:true},
  {k:'bg',label:T('배경','Background'),kind:'select',opts:[['transparent',T('투명','Transparent')],['#ffffff',T('흰색','White')],['#000000',T('검정','Black')]],adv:true},
 ],
 pixelize:[
  {k:'size',label:T('칸 수 (긴 변)','Cells (long side)'),kind:'range',min:8,max:256,step:1,fmt:v=>`${v}`},
  {k:'sampler',label:T('색 고르는 방법','Sampling'),kind:'select',opts:[['box',T('평균','Average')],['mode',T('가장 많은 색','Most common')],['median',T('중간값','Median')],['k-centroid',T('대표색','k-centroid')],['nearest',T('가운데 픽셀','Nearest')]],adv:true},
 ],
 palette:[
  {k:'colors',label:T('색 수','Colours'),kind:'range',min:2,max:256,step:1},
  {k:'dither',label:T('디더링','Dithering'),kind:'select',opts:[['none',T('없음','None')],['bayer4',T('Bayer 4×4','Bayer 4×4')],['bayer8',T('Bayer 8×8','Bayer 8×8')],['floyd-steinberg',T('플로이드-스타인버그','Floyd–Steinberg')],['atkinson',T('앳킨슨','Atkinson')],['blue-noise',T('블루 노이즈','Blue noise')]]},
  {k:'method',label:T('팔레트 계산','Palette method'),kind:'select',opts:[['wu',T('Wu (Oklab)','Wu (Oklab)')],['median-cut',T('미디언 컷','Median cut')],['k-means',T('k-평균','k-means')]],adv:true},
  {k:'strength',label:T('디더 세기','Dither strength'),kind:'range',min:0,max:1,step:.05,fmt:pct,adv:true,show:p=>p.dither!=='none'},
 ],
 'pixel.snap':[
  {k:'scale',label:T('격자 크기 (0 = 자동)','Grid size (0 = auto)'),kind:'range',min:0,max:64,step:1,fmt:v=>v?`${v}px`:'auto'},
  {k:'colors',label:T('최대 색 수 (0 = 그대로)','Max colours (0 = keep)'),kind:'range',min:0,max:256,step:1,adv:true},
  {k:'background',label:T('단색 배경','Solid background'),kind:'chips',opts:[['auto',T('투명하게','Make transparent')],['keep',T('그대로','Keep')]],adv:true},
 ],
 'sticker.border':[
  {k:'width',label:T('두께','Width'),kind:'range',min:0,max:.08,step:.002,fmt:(v,p,l,nominal)=>nominal?`${nominal}px`:pct(v)},
  {k:'color',label:T('색','Colour'),kind:'color'},
  {k:'shadow',label:T('그림자','Shadow'),kind:'check'},
 ],
 caption:[
  {k:'text',label:T('글자','Text'),kind:'text'},
  {k:'position',label:T('위치','Position'),kind:'chips',opts:[['bottom',T('아래','Bottom')],['top',T('위','Top')],['center',T('가운데','Centre')]]},
  {k:'size',label:T('크기','Size'),kind:'range',min:.05,max:.4,step:.01,fmt:pct},
  {k:'color',label:T('글자색','Text colour'),kind:'color'},
  {k:'stroke',label:T('테두리색','Outline colour'),kind:'color',adv:true},
  {k:'strokeWidth',label:T('테두리 두께','Outline width'),kind:'range',min:0,max:.3,step:.01,fmt:pct,adv:true},
  {k:'font',label:T('굵기','Weight'),kind:'chips',opts:[['suit-heavy',T('아주 굵게','Heavy')],['suit-bold',T('굵게','Bold')]],adv:true},
 ],
 motion:[
  {k:'kind',label:T('움직임','Motion'),kind:'chips',opts:[['bounce',T('통통','Bounce')],['shake',T('흔들기','Shake')],['blink',T('깜빡','Blink')],['zoom',T('확대','Zoom')]]},
  {k:'frames',label:T('장 수','Frames'),kind:'range',min:4,max:24,step:1},
  {k:'ms',label:T('한 장 시간','Frame time'),kind:'range',min:20,max:500,step:10,fmt:v=>`${v}ms`,adv:true},
  {k:'amp',label:T('세기','Strength'),kind:'range',min:.01,max:.3,step:.01,fmt:pct,adv:true},
 ],
 export:[
  {k:'format',label:T('형식','Format'),kind:'chips',opts:[['png',T('PNG','PNG')],['webp',T('WebP','WebP')],['gif',T('GIF','GIF')],['apng',T('APNG','APNG')]]},
  {k:'pack',label:T('여러 장일 때','Several files'),kind:'chips',opts:[['auto',T('자동','Auto')],['zip',T('ZIP 하나로','One ZIP')],['single',T('따로따로','Separately')]]},
  {k:'maxBytes',label:T('최대 용량 (0 = 제한 없음)','Max size (0 = no limit)'),kind:'range',min:0,max:5_000_000,step:10_000,fmt:v=>v?(v>=1e6?`${+(v/1e6).toFixed(1)}MB`:`${Math.round(v/1000)}KB`):'—',adv:true},
  {k:'loop',label:T('반복 (0 = 계속)','Loops (0 = forever)'),kind:'range',min:0,max:10,step:1,adv:true},
  {k:'extras',label:T('LINE 대표·탭 이미지 함께','LINE main and tab images'),kind:'check',adv:true},
 ],
};
/** Short Korean/English notes shown under a step's settings. */
export const HINTS={
 'bg.remove':T('자동: 배경이 한 가지 색이면 바로 지우고, 아니면 AI 모델(처음 한 번 약 190MB, 미리보기는 5MB 모델)을 써요.','Auto: a one-colour backdrop is removed instantly; otherwise the AI model runs (one-time ~190 MB download; previews use a 5 MB model).'),
 'sheet.split':T('칸은 그림마다 다시 찾아요. 칸 사이에 배경이 없으면 격자로 바꾸세요.','Cells are found anew on every picture. Use Grid for sheets without gaps.'),
 upscale:T('AI는 Real-ESRGAN(약 5MB, 처음 한 번 받기). 새 내용을 그려 넣지 않아요.','AI = Real-ESRGAN (about 5 MB, downloaded once). It does not paint new content.'),
 'pixel.snap':T('격자를 확신하지 못하면 크기를 그대로 둬요. 그럴 땐 격자 크기를 직접 넣으세요.','When unsure of the grid it keeps the size; set the grid size yourself then.'),
 caption:T('번들 글꼴(SUIT)만 써요. 브라우저마다 글자 모양이 조금 다를 수 있어요.','Bundled font (SUIT) only. Text may render slightly differently per browser.'),
 export:T('PNG·GIF·APNG는 Nerulio 자체 인코더라 어느 브라우저에서나 같은 파일이 나와요. WebP는 브라우저 인코더를 써요.','PNG, GIF and APNG come from Nerulio’s own encoders (identical in every browser); WebP uses the browser’s encoder.'),
};
