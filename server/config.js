import BUILD from './build-info.js';
import {freeDailyLimit,freeStudioLimit,freeAnonStudioLimit} from '../src/quota.js';
/** Runtime configuration. Plain settings are Pages environment variables; credentials are
 * Pages secrets. Nothing here is ever sent to the browser except explicitly public fields. */
export const SESSION_TTL_MS=30*864e5;
export const ANON_TTL_MS=400*864e5;
export const OAUTH_TTL_MS=10*60e3;
export const HUMAN_TTL_MS=12*3600e3;
/** A retried authorize with the same operationId returns its original decision for this long;
 * afterwards the id is refused (OPERATION_EXPIRED) instead of re-confirming an old permission. */
export const REPLAY_WINDOW_MS=10*60e3;
export const PRO_STATUSES=Object.freeze(['active','trialing']);
function positive(value,fallback,max){const n=Number(value);return value!==undefined&&value!==''&&Number.isInteger(n)&&n>=1&&n<=max?n:fallback;}
function between(value,fallback,min,max){const n=Number(value);return value!==undefined&&value!==''&&Number.isInteger(n)&&n>=min&&n<=max?n:fallback;}
/** Every provider price id that grants Pro: the monthly price, the yearly price and any
 * retired prices still billed to existing subscribers. Unknown price ids never grant Pro. */
export function proPriceIds(env={}){
 const ids=[env.BILLING_PRICE_ID,env.BILLING_PRICE_ID_YEARLY,...String(env.BILLING_PRICE_IDS_LEGACY||'').split(',')].map(s=>String(s||'').trim()).filter(Boolean);
 return [...new Set(ids)];
}
export function runtimeConfig(env={},build=BUILD){
 // Preview builds are marked at build time (CF_PAGES_BRANCH !== main). "development" is only
 // honoured for local builds: a production build made on Cloudflare Pages ignores
 // NERULIO_ENV, so a stray variable can never re-enable the sandbox billing provider there.
 const devRequested=env.NERULIO_ENV==='development';
 const environment=build.preview?'preview':devRequested&&!build.pages?'development':'production';
 const secret=String(env.SESSION_SECRET||'');
 const freeDailyJobs=freeDailyLimit(env.FREE_DAILY_JOBS),freeDailyStudio=freeStudioLimit(env.FREE_DAILY_STUDIO_EXPORTS);
 const freeAnonStudio=freeAnonStudioLimit(env.FREE_ANON_STUDIO_EXPORTS,freeDailyStudio);
 let siteOrigin='';try{siteOrigin=new URL(env.SITE_URL||build.siteURL).origin;}catch{}
 const provider=String(env.BILLING_PROVIDER||'none').toLowerCase();
 let billingMode='off',billingReason='BILLING_PROVIDER is not set';
 if(provider==='sandbox'){
  // The internal sandbox provider can never run on a production build.
  if(environment==='production')billingReason='sandbox provider is refused on production';
  else{billingMode='sandbox';billingReason='';}
 }else if(provider==='paddle'){
  const mode=String(env.BILLING_MODE||'sandbox').toLowerCase();
  if(mode==='live'&&environment!=='production')billingReason='live billing is refused outside production';
  else if(!['sandbox','live'].includes(mode))billingReason='BILLING_MODE must be sandbox or live';
  else if(!env.BILLING_API_KEY||!env.BILLING_WEBHOOK_SECRET||!env.BILLING_PRICE_ID)billingReason='BILLING_API_KEY, BILLING_WEBHOOK_SECRET and BILLING_PRICE_ID are required';
  else{billingMode=mode;billingReason='';}
 }else if(provider!=='none')billingReason='unknown BILLING_PROVIDER';
 // Network buckets count every Free identity's metered work (anonymous and signed-in).
 // soft: crossing asks for a Turnstile check (never blocks by itself — schools, offices).
 // hard: crossing refuses Free metered work from that network until 00:00 UTC.
 // wide: the same over the surrounding /24 (IPv4) or /48 (IPv6), against address rotation.
 const networkSoftLimit=positive(env.ANON_NETWORK_DAILY_JOBS,(freeDailyJobs+freeDailyStudio)*4,1e6);
 const networkHardLimit=Math.max(networkSoftLimit,positive(env.NETWORK_DAILY_HARD_LIMIT,networkSoftLimit*5,1e7));
 const networkWideLimit=Math.max(networkHardLimit,positive(env.NETWORK_WIDE_DAILY_HARD_LIMIT,networkHardLimit*4,1e8));
 return Object.freeze({
  environment,environmentOverrideRefused:devRequested&&environment!=='development',siteOrigin,freeDailyJobs,freeDailyStudio,freeAnonStudio,
  configured:!!env.DB&&secret.length>=32,
  secret,
  google:{clientId:env.GOOGLE_OAUTH_CLIENT_ID||'',clientSecret:env.GOOGLE_OAUTH_CLIENT_SECRET||''},
  turnstile:{siteKey:env.TURNSTILE_SITE_KEY||'',secret:env.TURNSTILE_SECRET_KEY||''},
  anonNetworkSoftLimit:networkSoftLimit,networkSoftLimit,networkHardLimit,networkWideLimit,
  // Signed offline allowance per identity per day (docs/MONETIZATION-SECURITY.md §3a).
  graceExports:between(env.OFFLINE_GRACE_EXPORTS,3,0,10),
  // App-level stopgap against bursts; the real limit is a WAF rule on a custom domain.
  ratePerMinute:positive(env.API_RATE_PER_MINUTE,120,100000),
  maxSessionsPerUser:positive(env.MAX_SESSIONS_PER_USER,5,50),
  // past_due keeps Pro this many days while the provider retries the card (3–7).
  pastDueGraceDays:between(env.PAST_DUE_GRACE_DAYS,7,3,7),
  sharingNetworks:positive(env.PRO_SHARING_NETWORKS,10,1000),
  billing:{provider:billingMode==='off'?'none':provider,mode:billingMode,reason:billingReason,
   prices:{month:env.BILLING_PRICE_ID||'',year:env.BILLING_PRICE_ID_YEARLY||''},proPriceIds:proPriceIds(env)},
  adminSubjects:String(env.ADMIN_GOOGLE_SUBJECTS||'').split(',').map(s=>s.trim()).filter(Boolean)
 });
}
