/** Which tools use the new single-task UI, and how the home directory presents every tool.
 * Dependency-free: imported by the static build, the home page and task pages.
 * A tool moves here only when its task page is a superset of the old editor flow for that
 * job; until then its route keeps the classic editor (docs/PRODUCT-ROADMAP.md). */
export const TASK_TOOLS=Object.freeze({
 compress:{module:'compress',kinds:['image'],next:['convert','resize','image']},
 convert:{module:'convert',kinds:['image'],next:['compress','resize','image']},
 heic:{module:'convert',kinds:['image'],next:['compress','resize','image']},
 resize:{module:'resize',kinds:['image'],next:['compress','convert','image']},
 'pdf-merge':{module:'pdf-organize',kinds:['pdf','image'],next:['pdf-compress','pdf-split','pdf']},
 'pdf-split':{module:'pdf-organize',kinds:['pdf','image'],next:['pdf-merge','pdf-compress','pdf']},
 'jpg-to-pdf':{module:'pdf-organize',kinds:['image','pdf'],next:['pdf-compress','pdf-merge','pdf']},
 'pdf-compress':{module:'pdf-compress',kinds:['pdf'],next:['pdf-merge','pdf-split','pdf']},
 'pdf-to-jpg':{module:'pdf-to-image',kinds:['pdf'],next:['compress','convert','resize']},
 pdf:{module:'pdf-editor',kinds:['pdf'],next:['pdf-compress','pdf-merge','pdf-split']},
 ...Object.fromEntries(Object.entries({'refiner':['sprite-sheet-maker','palette-swap','pixel'],'logo-bg':['margin-crop','favicon-pack','compress'],'palette-swap':['sprite-sheet-maker','refiner','pixel'],'margin-crop':['resize','compress','convert'],'tile-helper':['sprite-sheet-maker','atlas-padding','pixel'],'atlas-padding':['sprite-sheet-maker','tile-helper','compress'],'scan-split':['jpg-to-pdf','margin-crop','compress'],'marketplace-pack':['compress','print-pack','resize'],'print-pack':['jpg-to-pdf','marketplace-pack','compress'],'favicon-pack':['logo-bg','compress','resize'],'bitmap-font':['sprite-sheet-maker','atlas-padding','pixel']}).map(([id,next])=>[id,{module:'recipe',kinds:['image'],next}])),
 // Texture Lab: one workspace, six stages. The legacy texture-map URL opens its Normal stage.
 ...Object.fromEntries(['texture-lab','texture-map','channel-unpacker','normal-map-converter','pbr-texture-validator','texture-edge-bleed'].map(id=>[id,{module:'texture-lab',kinds:['image'],next:['mask-packer','atlas-padding','compress']}])),
 'video-gif':{module:'media',kinds:['media'],next:['video-mp3','video-trim','video-frame']},
 'video-mp3':{module:'media',kinds:['media'],next:['video-gif','video-trim','video-frame']},
 'video-compress':{module:'media',kinds:['media'],next:['video-gif','video-mp3','video-frame']},
 'video-trim':{module:'media',kinds:['media'],next:['video-gif','video-mp3','video-compress']},
 'video-frame':{module:'media',kinds:['media'],next:['compress','convert','resize']},
 media:{module:'media',kinds:['media'],next:['video-gif','video-mp3','video-compress']},
 upscale:{module:'upscale',kinds:['image'],next:['compress','remove-bg','convert']},
 'remove-bg':{module:'remove-bg',kinds:['image'],next:['compress','resize','favicon-pack']},
 pixel:{module:'pixel',kinds:['image'],next:['sprite-sheet-maker','palette-swap','compress']},
 'sprite-sheet-maker':{module:'atlas',kinds:['image'],next:['compress','atlas-padding','sprite-slicer']},
 crop:{module:'crop',kinds:['image'],next:['compress','resize','remove-bg']},
 'sprite-slicer':{module:'sprite-slicer',kinds:['image'],next:['sprite-sheet-maker','frame-normalize','pixel']},
 'frame-normalize':{module:'frame-normalize',kinds:['image'],next:['sprite-sheet-maker','sprite-slicer','pixel']},
 'mask-packer':{module:'mask-packer',kinds:['image'],next:['compress','convert','texture-map']}
});
export const isTask=id=>Object.hasOwn(TASK_TOOLS,id);
/** Home directory: category → tool ids, in the order people look for them. */
export const DIRECTORY=Object.freeze([
 ['image',['compress','convert','resize','crop','remove-bg','upscale','heic','margin-crop','logo-bg','marketplace-pack','print-pack','scan-split','image']],
 ['pdf',['pdf-merge','pdf-split','pdf-compress','pdf-to-jpg','jpg-to-pdf','pdf']],
 ['video',['video-gif','video-mp3','video-compress','video-trim','video-frame','media']],
 ['game',['pixel','refiner','sprite-slicer','sprite-sheet-maker','frame-normalize','palette-swap','atlas-padding','tile-helper','texture-map','mask-packer','bitmap-font','favicon-pack',
  'texture-lab','channel-unpacker','normal-map-converter','pbr-texture-validator','texture-edge-bleed']]
]);
/** Short format-style badge per tool; falls back to the category badge. */
export const BADGES=Object.freeze({compress:'−%',convert:'JPG',resize:'↔',crop:'CROP','remove-bg':'BG',upscale:'2×',heic:'HEIC',image:'EDIT','pdf-merge':'+','pdf-split':'÷','pdf-compress':'−%','pdf-to-jpg':'JPG','jpg-to-pdf':'PDF',pdf:'EDIT',
 'video-gif':'GIF','video-mp3':'MP3','video-compress':'−%','video-trim':'CUT','video-frame':'PNG',media:'EDIT',pixel:'PX','favicon-pack':'ICO','sprite-sheet-maker':'▦','bitmap-font':'FNT'});
export const CATEGORY_BADGE=Object.freeze({image:'IMG',pdf:'PDF',video:'VID',game:'GAME'});
/** File kind → tools worth suggesting when files are dropped on the home page. */
export const SUGGEST=Object.freeze({image:['compress','convert','resize','remove-bg','jpg-to-pdf'],pdf:['pdf-merge','pdf-split','pdf-compress','pdf-to-jpg','pdf'],media:['video-gif','video-mp3','video-compress','video-trim']});
export function kindOf(file){
 const name=String(file?.name||'').toLowerCase(),type=String(file?.type||'');
 if(type==='application/pdf'||name.endsWith('.pdf'))return 'pdf';
 if(type.startsWith('image/')||/\.(png|jpe?g|webp|avif|gif|bmp|heic|heif|svg)$/.test(name))return 'image';
 if(type.startsWith('video/')||type.startsWith('audio/')||/\.(mp4|mov|webm|mkv|m4v|mp3|wav|m4a|ogg)$/.test(name))return 'media';
 return '';
}
