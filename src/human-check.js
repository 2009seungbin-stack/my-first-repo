import {text} from './service-content.js';
import {ensureStyles} from './service-ui.js';
/** Turnstile runs inside /verify/ (its own strict CSP), so the editor's CSP never has to
 * allow third-party scripts. The frame posts back only a single-use token, which the
 * Worker verifies server-side. Resolves to the token, or '' if the person cancels. */
const SITE_KEY=/^[0-9A-Za-z_-]{1,100}$/;
export function challenge(siteKey,action,locale='en'){
 if(!SITE_KEY.test(siteKey||''))return Promise.resolve('');
 ensureStyles();
 const dialog=document.createElement('dialog');dialog.className='service-dialog';
 const frame=document.createElement('iframe');frame.className='challenge-frame';frame.title='Turnstile';
 frame.src=`verify/?sitekey=${encodeURIComponent(siteKey)}&action=${encodeURIComponent(action)}&lang=${encodeURIComponent(locale)}`;
 const heading=document.createElement('p');heading.textContent=text(locale,'challenge');
 const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='×';cancel.setAttribute('aria-label','Close');
 dialog.append(heading,frame,cancel);document.body.append(dialog);
 return new Promise(resolve=>{
  let token='';
  const onMessage=event=>{
   if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='nerulio-turnstile')return;
   if(typeof event.data.token==='string'&&event.data.token.length<=2048)token=event.data.token;
   dialog.close();
  };
  const timer=setTimeout(()=>dialog.open&&dialog.close(),180e3);
  addEventListener('message',onMessage);
  cancel.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{clearTimeout(timer);removeEventListener('message',onMessage);dialog.remove();resolve(token);},{once:true});
  dialog.showModal();
 });
}
