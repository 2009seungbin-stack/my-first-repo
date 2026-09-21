import {normalizeSiteURL} from '../src/seo.js';
import {esc} from '../src/ui.js';
import {BRAND} from '../src/brand.js';
export function configuration(env=process.env){
 const preview=env.SITE_ENV==='preview'||!!(env.CF_PAGES_BRANCH&&env.CF_PAGES_BRANCH!=='main');
 const siteURL=normalizeSiteURL(env.SITE_URL||BRAND.baseUrl);
 const raw=env.ADSENSE_CLIENT||BRAND.adsenseId,verification=env.ADSENSE_VERIFICATION_CLIENT||'';
 for(const [name,value]of [['ADSENSE_CLIENT',raw],['ADSENSE_VERIFICATION_CLIENT',verification]]){
  if(value&&!/^ca-pub-\d{16}$/.test(value))throw Error(`${name} must be ca-pub- followed by exactly 16 digits; leave unset until issued by Google`);
 }
 if(raw&&verification&&raw!==verification)throw Error('AdSense verification and advertising must use the same publisher');
 const verificationClient=preview?'':verification||raw;
 const client=preview?'':raw,slots={};
 for(const [position,name]of [['content-1','ADSENSE_SLOT_CONTENT_1'],['content-2','ADSENSE_SLOT_CONTENT_2']]){
  const value=env[name]||'';if(value&&!/^\d{10}$/.test(value))throw Error(`${name} must be the 10-digit ad unit ID issued by Google`);
  if(client&&value)slots[position]=value;
 }
 if(verificationClient&&(!siteURL||!siteURL.startsWith('https://')))throw Error('AdSense requires an explicit HTTPS SITE_URL');
 if(client&&Object.keys(slots).length&&env.ADSENSE_CMP_READY!=='true')throw Error('Configure and verify a Google-certified CMP, then set ADSENSE_CMP_READY=true before enabling ad units');
 const searchVerification=preview?'':env.GOOGLE_SITE_VERIFICATION||BRAND.searchVerification;
 if(searchVerification&&!/^[A-Za-z0-9_-]{1,256}$/.test(searchVerification))throw Error('Invalid Google verification token');
 const indexNowKey=preview?'':env.INDEXNOW_KEY||'';
 if(indexNowKey&&!/^[A-Za-z0-9-]{8,128}$/.test(indexNowKey))throw Error('INDEXNOW_KEY must be 8-128 letters, digits or hyphens');
 return {siteURL,preview,client,slots,verificationClient,searchVerification,indexNowKey};
}
export function adHead({client='',slots={}}={}){
 if(!client)return '';
 return `<meta name="adsense-config" content="${esc(JSON.stringify({client,slots}))}"><script async crossorigin="anonymous" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}"></script>${Object.keys(slots).length?'<script type="module" src="src/ads.js"></script>':''}`;
}
export function headers(source,{preview}){
 // Enabled HTML uses a per-response nonce CSP from _worker.js, not a fragile
 // list of Google's advertising domains or a reused build-time nonce.
 // Site-wide additions belong to the leading /* block, not to later path blocks.
 const [global,...rest]=source.replace(/\r\n/g,'\n').replace(/\s+$/,'').split(/\n(?=\S)/);
 let out=global+'\n  Cache-Control: public, max-age=0, must-revalidate\n';
 if(preview)out+='  X-Robots-Tag: noindex, nofollow\n';
 return out+rest.map(block=>block+'\n').join('');
}
