import {normalizeSiteURL} from '../src/seo.js';
import {esc} from '../src/ui.js';
export function configuration(env=process.env){
 const preview=env.SITE_ENV==='preview'||!!(env.CF_PAGES_BRANCH&&env.CF_PAGES_BRANCH!=='main');
 const siteURL=normalizeSiteURL(env.SITE_URL||'');
 const raw=env.ADSENSE_CLIENT||'';
 if(raw&&!/^ca-pub-\d{16}$/.test(raw))throw Error('ADSENSE_CLIENT must be ca-pub- followed by exactly 16 digits; leave unset until issued by Google');
 const client=preview?'':raw,slots={};
 for(const [position,name]of [['content-1','ADSENSE_SLOT_CONTENT_1'],['content-2','ADSENSE_SLOT_CONTENT_2']]){
  const value=env[name]||'';if(value&&!/^\d{10}$/.test(value))throw Error(`${name} must be the 10-digit ad unit ID issued by Google`);
  if(client&&value)slots[position]=value;
 }
 if(client&&(!siteURL||!siteURL.startsWith('https://')))throw Error('AdSense requires an explicit HTTPS SITE_URL');
 if(client&&Object.keys(slots).length&&env.ADSENSE_CMP_READY!=='true')throw Error('Configure and verify a Google-certified CMP, then set ADSENSE_CMP_READY=true before enabling ad units');
 return {siteURL,preview,client,slots};
}
export function adHead({client='',slots={}}={}){
 if(!client)return '';
 return `<meta name="adsense-config" content="${esc(JSON.stringify({client,slots}))}"><script async crossorigin="anonymous" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}"></script>${Object.keys(slots).length?'<script type="module" src="src/ads.js"></script>':''}`;
}
export function headers(source,{preview}){
 let out=source;
 // Enabled HTML uses a per-response nonce CSP from _worker.js, not a fragile
 // list of Google's advertising domains or a reused build-time nonce.
 out+='\n  Cache-Control: public, max-age=0, must-revalidate\n';
 if(preview)out+='  X-Robots-Tag: noindex, nofollow\n';
 return out;
}
