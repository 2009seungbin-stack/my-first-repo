/** Keyboard reading on the platform's list pages (boards, tag pages, search results):
 * j / k move the focus through the post links, Enter opens the focused one (it is a link), / goes to
 * the search box and ↓ in the search page's box goes to the first result. These helpers are pure so they can be tested without a page; islands.js wires them up. */

/** The row to focus next: the first row when none is focused yet, otherwise one step, staying inside the list.
 * @param {number} i index of the focused row (-1: none) @param {number} len rows on the page @param {number} dir +1 (j) or -1 (k)
 * @returns {number} the next index, or -1 when there is nothing to move to */
export function stepIndex(i,len,dir){
 if(!(len>0))return -1;
 if(!(i>=0&&i<len))return 0;
 return Math.min(len-1,Math.max(0,i+(dir<0?-1:1)));
}

/** A key the reader is typing into a field (or pressing with a modifier, or while composing Korean/Japanese) is not a shortcut.
 * @param {{tagName?:string,isContentEditable?:boolean}|null|undefined} el the focused element
 * @param {{ctrlKey?:boolean,metaKey?:boolean,altKey?:boolean,defaultPrevented?:boolean,isComposing?:boolean}} [e] */
export function shortcutAllowed(el,e={}){
 if(e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented||e.isComposing)return false;
 if(!el)return true;
 return !(/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName||'')||el.isContentEditable);
}
