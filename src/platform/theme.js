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
   if(t.closest('[data-drawer-open]')){e.preventDefault();document.body.classList.add('drawer');document.getElementById('lnav')?.querySelector('a,summary')?.focus();return;}
   if(t.closest('[data-drawer-close]')){e.preventDefault();document.body.classList.remove('drawer');document.querySelector('[data-drawer-open]')?.focus();}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('drawer')){document.body.classList.remove('drawer');document.querySelector('[data-drawer-open]')?.focus();}});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
