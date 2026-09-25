import {normalizeSiteURL} from '../src/seo.js';
import {esc} from '../src/ui.js';
import {BRAND} from '../src/brand.js';
import {freeDailyLimit,freeStudioLimit,freeAnonStudioLimit} from '../src/quota.js';
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
 // The Studio's desktop ad column (docs/ADS.md) is its own ad unit. It is kept apart from
 // `slots` so content pages never mount it and the Studio never mounts content units.
 const studioSlotValue=env.ADSENSE_SLOT_STUDIO||'';
 if(studioSlotValue&&!/^\d{10}$/.test(studioSlotValue))throw Error('ADSENSE_SLOT_STUDIO must be the 10-digit ad unit ID issued by Google');
 const studioAd=client&&studioSlotValue?{client,slot:studioSlotValue}:null;
 if(verificationClient&&(!siteURL||!siteURL.startsWith('https://')))throw Error('AdSense requires an explicit HTTPS SITE_URL');
 if(client&&(Object.keys(slots).length||studioAd)&&env.ADSENSE_CMP_READY!=='true')throw Error('Configure and verify a Google-certified CMP, then set ADSENSE_CMP_READY=true before enabling ad units');
 const searchVerification=preview?'':env.GOOGLE_SITE_VERIFICATION||BRAND.searchVerification;
 if(searchVerification&&!/^[A-Za-z0-9_-]{1,256}$/.test(searchVerification))throw Error('Invalid Google verification token');
 const indexNowKey=preview?'':env.INDEXNOW_KEY||BRAND.indexNowKey||'';
 const naverVerification=preview?'':env.NAVER_SITE_VERIFICATION||BRAND.naverVerification||'',bingVerification=preview?'':env.BING_SITE_VERIFICATION||BRAND.bingVerification||'';
 for(const [name,value] of [['NAVER_SITE_VERIFICATION',naverVerification],['BING_SITE_VERIFICATION',bingVerification]])if(value&&!/^[A-Za-z0-9_-]{1,256}$/.test(value))throw Error(`Invalid ${name} token`);
 if(indexNowKey&&!/^[A-Za-z0-9-]{8,128}$/.test(indexNowKey))throw Error('INDEXNOW_KEY must be 8-128 letters, digits or hyphens');
 // Accounts, Free/Pro and the /api/v1 Worker are opt-in: a build without SERVICE_API=on is
 // the unchanged static site, so merging this code cannot alter production by itself.
 if(!['','on','off'].includes(env.SERVICE_API||''))throw Error('SERVICE_API must be on or off');
 // Cloudflare Web Analytics is enabled in the Pages dashboard (it injects its beacon at the
 // edge). This flag only widens the CSP for that beacon and updates the privacy page.
 if(!['','on','off'].includes(env.CF_WEB_ANALYTICS||''))throw Error('CF_WEB_ANALYTICS must be on or off');
 const webAnalytics=env.CF_WEB_ANALYTICS==='on'&&!preview;
 const service=env.SERVICE_API==='on';
 // Pro is sold monthly and yearly. PRO_PRICE_MONTHLY_AMOUNT (alias PRO_PRICE_AMOUNT) and
 // PRO_PRICE_YEARLY_AMOUNT are display prices in PRO_PRICE_CURRENCY; what is charged is the provider
 // price each is paired with (BILLING_PRICE_ID / BILLING_PRICE_ID_YEARLY). The yearly saving is
 // computed from the two amounts, never written down.
 const monthly=env.PRO_PRICE_MONTHLY_AMOUNT||env.PRO_PRICE_AMOUNT||'',yearly=env.PRO_PRICE_YEARLY_AMOUNT||env.PRO_PRICE_AMOUNT_YEARLY||'';
 const pricing={amount:monthly,currency:(env.PRO_PRICE_CURRENCY||'').toUpperCase(),interval:env.PRO_PRICE_INTERVAL||'month',yearlyAmount:yearly};
 for(const [name,value]of [['PRO_PRICE_MONTHLY_AMOUNT',pricing.amount],['PRO_PRICE_YEARLY_AMOUNT',pricing.yearlyAmount]]){
  if(value&&!/^\d{1,6}(\.\d{1,2})?$/.test(value))throw Error(`${name} must be a plain decimal such as 4.99`);
 }
 if((pricing.amount||pricing.yearlyAmount)&&!/^[A-Z]{3}$/.test(pricing.currency))throw Error('PRO_PRICE_CURRENCY must be an ISO 4217 code such as USD');
 if(!['month','year'].includes(pricing.interval))throw Error('PRO_PRICE_INTERVAL must be month or year');
 // A retired deployment (e.g. the old *.pages.dev project) builds only a permanent redirect.
 let redirectTo='';
 if(env.REDIRECT_TO){
  let u;try{u=new URL(env.REDIRECT_TO);}catch{throw Error('REDIRECT_TO must be an absolute https origin');}
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('REDIRECT_TO must be a bare https origin such as https://nerulio.pages.dev');
  redirectTo=u.origin;
 }
 // Built by Cloudflare Pages (CF_PAGES=1) rather than locally: the Worker then ignores
 // NERULIO_ENV=development, so the sandbox billing provider cannot be switched on in production.
 const pagesBuild=env.CF_PAGES==='1';
 // Public half of the key that signs service answers (tools/ticket-keys.mjs). Not a secret.
 const ticketPublicKey=env.TICKET_PUBLIC_KEY||'';
 if(ticketPublicKey&&!/^[A-Za-z0-9_-]{87}$/.test(ticketPublicKey))throw Error('TICKET_PUBLIC_KEY must be the value printed by node tools/ticket-keys.mjs');
 return {siteURL,preview,pagesBuild,ticketPublicKey,client,slots,studioAd,verificationClient,searchVerification,naverVerification,bingVerification,indexNowKey,service,pricing,freeDailyJobs:freeDailyLimit(env.FREE_DAILY_JOBS),freeDailyStudio:freeStudioLimit(env.FREE_DAILY_STUDIO_EXPORTS),freeAnonStudio:freeAnonStudioLimit(env.FREE_ANON_STUDIO_EXPORTS,freeStudioLimit(env.FREE_DAILY_STUDIO_EXPORTS)),redirectTo,webAnalytics};
}
export function adHead({client='',slots={},service=false}={}){
 if(!client)return '';
 // With accounts enabled, src/ads.js asks /api/v1/me first and injects AdSense only for
 // Free visitors; Pro pages never request Google's script. 'strict-dynamic' in the
 // per-response nonce CSP lets the nonced loader add it.
 if(service)return `<meta name="adsense-config" content="${esc(JSON.stringify({client,slots}))}"><script type="module" src="src/ads.js"></script>`;
 return `<meta name="adsense-config" content="${esc(JSON.stringify({client,slots}))}"><script async crossorigin="anonymous" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}"></script>${Object.keys(slots).length?'<script type="module" src="src/ads.js"></script>':''}`;
}
export const WEB_ANALYTICS=Object.freeze({script:'https://static.cloudflareinsights.com',connect:'https://cloudflareinsights.com'});
export function headers(source,{preview,webAnalytics=false}){
 // Enabled HTML uses a per-response nonce CSP from _worker.js, not a fragile
 // list of Google's advertising domains or a reused build-time nonce.
 // Site-wide additions belong to the leading /* block, not to later path blocks.
 const [global,...rest]=source.replace(/\r\n/g,'\n').replace(/\s+$/,'').split(/\n(?=\S)/);
 let out=(webAnalytics?global.replace("script-src 'self'",`script-src 'self' ${WEB_ANALYTICS.script}`).replace("connect-src 'self'",`connect-src 'self' ${WEB_ANALYTICS.connect}`):global)+'\n  Cache-Control: public, max-age=0, must-revalidate\n';
 if(preview)out+='  X-Robots-Tag: noindex, nofollow\n';
 const siteCSP=/\n\s*Content-Security-Policy: ([^\n]+)/.exec(out)?.[1];
 out+=rest.map(block=>block+'\n').join('');
 // The Studio's Pixel workspace may load a palette from lospec.com (its only network request,
 // asked first): Studio pages get the site CSP with that one origin added to connect-src.
 if(siteCSP)for(const p of STUDIO_PATHS)out+=`${p}\n  ! Content-Security-Policy\n  Content-Security-Policy: ${siteCSP.replace("connect-src 'self'",`connect-src 'self' ${STUDIO_CONNECT.join(' ')}`)}\n`;
 return out;
}
export const STUDIO_PATHS=Object.freeze(['/game/studio/*','/:lang/game/studio/*']),STUDIO_CONNECT=Object.freeze(['https://lospec.com']);
