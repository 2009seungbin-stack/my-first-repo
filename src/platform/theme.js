/* Nerulio platform pages: the theme (white unless the reader chose dark on this browser) and the menu
   drawer on narrow screens. Loaded as a classic script in <head> so the saved theme applies before the
   first paint; everything else waits for the document. */
(()=>{
 const KEY='nerulio-theme',root=document.documentElement;
 let saved=null;
 try{saved=localStorage.getItem(KEY);}catch{}
 if(saved==='dark')root.dataset.theme='dark';
 const sync=()=>{const dark=root.dataset.theme==='dark';for(const b of document.querySelectorAll('[data-theme-toggle]')){b.setAttribute('aria-pressed',String(dark));}};
 const ready=()=>{
  sync();
  const drawer=document.getElementById('lnav'),opener=document.querySelector('[data-drawer-open]'),narrow=matchMedia('(max-width:1000px)'),backdrop=new Map();
  // Once enhanced, only the class drives visibility. replaceState clears the URL's hash but some
  // engines retain the old :target until a real fragment navigation; the CSS-only fallback stays separate.
  if(drawer&&opener)drawer.setAttribute('data-drawer-controlled','');
  let modal=false,lastFocus=document.activeElement;
  const controls=()=>drawer?[...drawer.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('details:not([open]) > :not(summary)')):[];
  const first=()=>controls()[0]?.focus();
  const syncDrawer=()=>{
   if(!drawer||!opener)return;
   modal=narrow.matches&&(document.body.classList.contains('drawer')||location.hash==='#lnav');
   document.body.classList.toggle('drawer',modal);
   opener.setAttribute('aria-expanded',String(modal));opener.setAttribute('aria-haspopup','dialog');
   if(modal){
    drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');
    for(const el of document.querySelectorAll('.app > .col,body > .skip')){
     if(!backdrop.has(el))backdrop.set(el,el.inert);el.inert=true;
    }
    if(!drawer.contains(document.activeElement))first();
   }else{
    drawer.removeAttribute('role');drawer.removeAttribute('aria-modal');
    for(const [el,wasInert] of backdrop)el.inert=wasInert;backdrop.clear();
    if(narrow.matches&&drawer.contains(document.activeElement))opener.focus();
   }
  };
  const closeDrawer=(restore=true)=>{
   document.body.classList.remove('drawer');
   // Clear the no-script #lnav fallback too, preserving the rest of the URL and history state.
   if(location.hash==='#lnav')history.replaceState(history.state,'',location.pathname+location.search);
   syncDrawer();if(restore&&narrow.matches)opener?.focus();
  };
  addEventListener('hashchange',()=>{
   const wasModal=modal,target=document.getElementById(location.hash.slice(1));
   document.body.classList.toggle('drawer',narrow.matches&&!!target&&!!drawer?.contains(target));
   syncDrawer();if(wasModal&&!modal&&narrow.matches)opener?.focus();
  });
  narrow.addEventListener('change',()=>{const hiddenFocus=narrow.matches&&drawer?.contains(lastFocus);closeDrawer(false);if(hiddenFocus)opener?.focus();});
  document.addEventListener('focusin',e=>{
   // A visibility change can blur the old link before matchMedia's change event runs.
   if(e.target!==document.body)lastFocus=e.target;
   if(modal&&drawer&&!drawer.contains(e.target))first();
  });
  syncDrawer();
  document.addEventListener('click',e=>{
   const t=e.target instanceof Element?e.target:null;if(!t)return;
   if(t.closest('[data-theme-toggle]')){
    const dark=root.dataset.theme!=='dark';
    if(dark)root.dataset.theme='dark';else delete root.dataset.theme;
    try{localStorage.setItem(KEY,dark?'dark':'light');}catch{}
    sync();return;
   }
   // FILE / GAME in the icon column open their group in the menu.
   const jump=t.closest('a[href^="#nav-"]');
   if(jump){const d=document.getElementById(String(jump.getAttribute('href')).slice(1));if(d&&d.tagName==='DETAILS')/** @type {HTMLDetailsElement} */(d).open=true;return;}
   // Menu drawer: without JavaScript the links fall back to #lnav (:target); with it, a class.
   if(t.closest('[data-drawer-open]')){e.preventDefault();document.body.classList.add('drawer');syncDrawer();first();return;}
   if(t.closest('[data-drawer-close]')){e.preventDefault();closeDrawer();}
  });
  document.addEventListener('keydown',e=>{
   if(!modal)return;
   if(e.key==='Escape'){e.preventDefault();closeDrawer();return;}
   if(e.key!=='Tab')return;
   const items=controls(),active=document.activeElement,first=items[0],last=items.at(-1);
   if(!items.includes(active)||e.shiftKey&&active===first||!e.shiftKey&&active===last){e.preventDefault();(e.shiftKey?last:first)?.focus();}
  });
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
