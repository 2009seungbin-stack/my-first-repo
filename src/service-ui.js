import {text} from './service-content.js';
/** Small, lazily imported UI helpers for the account layer on tool pages. */
export const pageLocale=()=>['ko','en','ja'].includes(document.documentElement.lang)?document.documentElement.lang:'en';
export function ensureStyles(){
 if(document.querySelector('link[data-service-css]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href='src/service.css';link.dataset.serviceCss='';
 document.head.append(link);
}
let toastTimer=0;
/** Quiet status line; never blocks the editor and disappears on its own. */
export function toast(key,vars={},{subtle=key==='remaining'}={}){
 ensureStyles();
 let el=document.getElementById('serviceToast');
 if(!el){el=document.createElement('div');el.id='serviceToast';el.className='service-toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.append(el);}
 el.classList.toggle('subtle',subtle);el.textContent=text(pageLocale(),key,vars);el.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},key==='paused'?9000:5000);
}
