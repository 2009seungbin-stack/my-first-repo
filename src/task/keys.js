/** Pure helpers behind the task shell's keyboard shortcuts and file intake; no DOM, so they
 * are unit-tested (tests/task-keys.test.mjs). src/task/shell.js wires them to the page. */
export const isMac=(platform='')=>/mac|iphone|ipad|ipod/i.test(String(platform));
const KEYS={o:'open',s:'save'};
/** Ctrl+O / Ctrl+S (⌘ on Apple devices) → 'open' | 'save'; anything else → ''.
 * Shift/Alt combinations, key repeat and IME composition are left to the browser. */
export function shortcutOf(e,{mac=false}={}){
 if(!e||e.altKey||e.shiftKey||e.repeat||e.isComposing)return '';
 const mod=mac?!!e.metaKey&&!e.ctrlKey:!!e.ctrlKey&&!e.metaKey;if(!mod)return '';
 return KEYS[String(e.key||'').toLowerCase()]||'';
}
export const shortcutLabel=(name,{mac=false}={})=>{const key={open:'O',save:'S',paste:'V'}[name];return key?(mac?'⌘':'Ctrl+')+key:'';};
/** A drop can mix kinds: the files this tool handles go in, the rest are counted so the page can say so. */
export function splitIntake(files,kinds,kindOf){
 const ok=[],skipped=[];for(const f of files||[])(kinds.includes(kindOf(f))?ok:skipped).push(f);
 return {ok,skipped};
}
/** "−62%" / "+8%" / "=" for a result against its source; '' when either size is unknown. */
export function sizeDelta(before,after){
 if(!(before>0)||!(after>=0))return '';
 const p=Math.round((after/before-1)*100);return p===0?'=':(p<0?'−':'+')+Math.abs(p)+'%';
}
/** A result the clipboard can take as one picture: a single still raster image, not a bundle or a document.
 * GIF is left out: the PNG copy would silently keep only its first frame. */
export const copyable=r=>!!r&&!r.zipped&&!(r.entries?.length>1)&&/^image\/(png|jpeg|webp|avif|bmp)$/.test(r.blob?.type||'');
/** Batch progress for the summary: how many files are finished (done or failed) out of how many. */
export function batchProgress(items){
 const total=items.length,finished=items.filter(i=>i.status==='done'||i.status==='error').length;
 return {total,finished,percent:total?Math.round(finished/total*100):0,active:total>1&&finished<total};
}
/** Pictures on the clipboard (navigator.clipboard.read() items) as named Files; other content is ignored. */
export async function clipboardFiles(items,{now=Date.now()}={}){
 const files=[];
 for(const item of items||[]){
  const type=(item.types||[]).find(t=>/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(t));if(!type)continue;
  const blob=await item.getType(type),ext=type.split('/')[1].replace('jpeg','jpg');
  files.push(new File([blob],`clipboard${files.length?'-'+(files.length+1):''}.${ext}`,{type,lastModified:now}));
 }
 return files;
}
