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
