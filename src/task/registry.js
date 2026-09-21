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
 pdf:{module:'pdf-editor',kinds:['pdf'],next:['pdf-compress','pdf-merge','pdf-split']}
});
export const isTask=id=>Object.hasOwn(TASK_TOOLS,id);
/** Home directory: category → tool ids, in the order people look for them. */
export const DIRECTORY=Object.freeze([
 ['image',['compress','convert','resize','crop','remove-bg','upscale','heic','margin-crop','logo-bg','marketplace-pack','print-pack','scan-split','image']],
 ['pdf',['pdf-merge','pdf-split','pdf-compress','pdf-to-jpg','jpg-to-pdf','pdf']],
 ['video',['video-gif','video-mp3','video-compress','video-trim','video-frame','media']],
 ['game',['pixel','refiner','sprite-slicer','sprite-sheet-maker','frame-normalize','palette-swap','atlas-padding','tile-helper','texture-map','mask-packer','bitmap-font','favicon-pack']]
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
