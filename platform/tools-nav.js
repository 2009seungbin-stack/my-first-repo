// @ts-check
/** Tools linked from the platform's left menu. Since the AI 창작 pivot (2026-10-11) the menu holds one group,
 * 다듬기 도구: the workbench's preset landings (/{l}/make/<slug>/, MAKER's platform/render/make.js) and
 * "도구 전체 보기" (/{l}/tools/). The file, game and PC tool lists stay (their pages keep working and other
 * pages link them); tests/n2-shell.test.mjs checks every id and path against src/intents.js. */

/** @typedef {{id:string,path:string,ic:string,svg:string,ko:string,en:string}} NavTool */
/** @typedef {{slug:string,svg:string,ko:string,en:string,spec:string}} MakeTool */
/** 다듬기 도구: the workbench presets people come for, in menu order (AI-COMMUNITY-CONTRACT.md §3). `spec` is
 * the size shown beside the name (the preset's own spec in platform/recipe.js PRESETS when it has one). */
export const MAKE_TOOLS=Object.freeze(/** @type {MakeTool[]} */([
 {slug:'kakao-emoticon',svg:'smile',ko:'카톡 이모티콘',en:'KakaoTalk emoticon',spec:'360×360'},
 {slug:'line-sticker',svg:'smile',ko:'LINE 스탬프',en:'LINE sticker',spec:'370×320'},
 {slug:'discord-emoji',svg:'smile',ko:'디스코드 이모지',en:'Discord emoji',spec:'128×128'},
 {slug:'telegram-sticker',svg:'smile',ko:'텔레그램 스티커',en:'Telegram sticker',spec:'512×512'},
 {slug:'round-pfp',svg:'user',ko:'원형 프사',en:'Round profile picture',spec:'800×800'},
 {slug:'phone-wallpaper',svg:'phone',ko:'폰 배경화면',en:'Phone wallpaper',spec:'1206×2622'},
 {slug:'ai-pixel-fix',svg:'pixel',ko:'AI 도트 정리',en:'AI pixel-art fix',spec:'64×64'},
]));
/** A preset landing of the workbench. @param {string} l @param {{slug:string}} x */
export const makeHref=(l,x)=>`/${l}/make/${x.slug}/`;
export const FILE_TOOLS=Object.freeze(/** @type {NavTool[]} */([
 {id:'compress',path:'image/compress',ic:'IMG',svg:'compress',ko:'이미지 압축',en:'Compress image'},
 {id:'convert',path:'image/convert',ic:'JPG',svg:'convert',ko:'이미지 형식 변환',en:'Convert image'},
 {id:'resize',path:'image/resize',ic:'SIZE',svg:'resize',ko:'이미지 크기 변경',en:'Resize image'},
 {id:'remove-bg',path:'image/remove-bg',ic:'BG',svg:'eraser',ko:'배경 제거',en:'Remove background'},
 {id:'video-gif',path:'video/to-gif',ic:'GIF',svg:'film',ko:'영상 → GIF',en:'Video to GIF'},
 {id:'pdf-merge',path:'pdf/merge',ic:'PDF',svg:'filePlus',ko:'PDF 합치기',en:'Merge PDF'},
 {id:'heic',path:'image/heic-to-jpg',ic:'HEIC',svg:'photo',ko:'HEIC → JPG',en:'HEIC to JPG'},
]));
export const GAME_TOOLS=Object.freeze(/** @type {NavTool[]} */([
 {id:'sprite-lab',path:'game/sprite-lab',ic:'SPR',svg:'sprite',ko:'스프라이트 랩',en:'Sprite Lab'},
 {id:'pixel-lab',path:'game/pixel-lab',ic:'PX',svg:'pixel',ko:'픽셀 랩',en:'Pixel Lab'},
 {id:'tile-lab',path:'game/tile-lab',ic:'TILE',svg:'tile',ko:'타일셋 작업실',en:'Tile Lab'},
 {id:'sprite-sheet-maker',path:'sprite-sheet-maker',ic:'SHEET',svg:'sheet',ko:'스프라이트 시트 만들기',en:'Sprite sheet maker'},
 {id:'sprite-slicer',path:'sprite-slicer',ic:'CUT',svg:'scissors',ko:'스프라이트 자동 분리',en:'Sprite sheet slicer'},
 {id:'palette-swap',path:'palette-swap',ic:'PAL',svg:'palette',ko:'팔레트 색 교체',en:'Palette swap'},
 {id:'bitmap-font',path:'bitmap-font-maker',ic:'FNT',svg:'font',ko:'비트맵 폰트 만들기',en:'Bitmap font maker'},
]));
/** A tool's page in a language. @param {string} l @param {NavTool} x */
export const toolHref=(l,x)=>`/${l}/${x.path}/`;
/** Every tool (the former home page of the static site). @param {string} l */
export const toolsHome=l=>`/${l}/tools/`;
/** Worker-rendered PC utilities, separate from the static file/game tool registry. */
export const PC_TOOLS=Object.freeze(/** @type {NavTool[]} */([
 {id:'used-prices',path:'hardware/used-prices',ic:'USED',svg:'chip',ko:'국가별 중고 시세',en:'Used prices by country'},
 {id:'performance',path:'hardware/performance',ic:'BENCH',svg:'chip',ko:'GPU·CPU 성능 비교',en:'GPU / CPU performance'},
]));
