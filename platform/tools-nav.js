// @ts-check
/** The file and game tools listed in the platform's left menu (파일 도구 / 게임 도구). The tools are the
 * static site's pages (src/intents.js paths); this short list keeps the Worker free of the tool
 * registry. tests/n2-shell.test.mjs checks every id and path against src/intents.js. */

/** @typedef {{id:string,path:string,ic:string,svg:string,ko:string,en:string}} NavTool */
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
