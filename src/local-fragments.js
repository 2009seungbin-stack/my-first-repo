/** Keep named in-page links in their current document despite its shared-asset <base>.
 * Skip links focus content without changing an application's query/hash or file state. */
/** @param {HTMLAnchorElement} anchor */
function prepare(anchor){
 const id=anchor.getAttribute('data-local-fragment');if(!id)return null;
 const target=document.getElementById(id);if(!target)return null;
 anchor.setAttribute('href',location.pathname+location.search+'#'+encodeURIComponent(id));
 return {id,target};
}
/** @param {Event} event */
function eventAnchor(event){const element=event.target instanceof Element?event.target.closest('a[data-local-fragment]'):null;return element instanceof HTMLAnchorElement?element:null;}
for(const element of document.querySelectorAll('a[data-local-fragment]'))if(element instanceof HTMLAnchorElement)prepare(element);
for(const name of ['focusin','pointerdown','contextmenu'])document.addEventListener(name,event=>{const anchor=eventAnchor(event);if(anchor)prepare(anchor);});
document.addEventListener('click',event=>{
 const anchor=eventAnchor(event);if(!anchor)return;
 const jump=prepare(anchor);
 if(!jump||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target&&anchor.target!=='_self')return;
 if(anchor.matches('.skip,.gs-skip,.skip-link')){
  event.preventDefault();
  const focus=jump.target.closest('main')||jump.target;
  if(!focus.hasAttribute('tabindex'))focus.setAttribute('tabindex','-1');
  focus.focus({preventScroll:true});jump.target.scrollIntoView({block:'start'});
 }
});
