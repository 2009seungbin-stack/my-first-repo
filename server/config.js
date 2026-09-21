import BUILD from './build-info.js';
import {freeDailyLimit} from '../src/quota.js';
/** Runtime configuration. Plain settings are Pages environment variables; credentials are
 * Pages secrets. Nothing here is ever sent to the browser except explicitly public fields. */
export const SESSION_TTL_MS=30*864e5;
export const ANON_TTL_MS=400*864e5;
export const OAUTH_TTL_MS=10*60e3;
export const HUMAN_TTL_MS=12*3600e3;
export const PRO_STATUSES=Object.freeze(['active','trialing']);
function positive(value,fallback,max){const n=Number(value);return value!==undefined&&value!==''&&Number.isInteger(n)&&n>=1&&n<=max?n:fallback;}
export function runtimeConfig(env={},build=BUILD){
 // Preview builds are marked at build time (CF_PAGES_BRANCH !== main); "development" must be explicit.
 const environment=build.preview?'preview':env.NERULIO_ENV==='development'?'development':'production';
 const secret=String(env.SESSION_SECRET||'');
 const freeDailyJobs=freeDailyLimit(env.FREE_DAILY_JOBS);
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
 return Object.freeze({
  environment,siteOrigin,freeDailyJobs,
  configured:!!env.DB&&secret.length>=32,
  secret,
  google:{clientId:env.GOOGLE_OAUTH_CLIENT_ID||'',clientSecret:env.GOOGLE_OAUTH_CLIENT_SECRET||''},
  turnstile:{siteKey:env.TURNSTILE_SITE_KEY||'',secret:env.TURNSTILE_SECRET_KEY||''},
  // Anonymous identities sharing one network may all be legitimate (schools, offices);
  // crossing this only asks for a Turnstile check, it never blocks by itself.
  anonNetworkSoftLimit:positive(env.ANON_NETWORK_DAILY_JOBS,freeDailyJobs*4,1e6),
  billing:{provider:billingMode==='off'?'none':provider,mode:billingMode,reason:billingReason},
  adminSubjects:String(env.ADMIN_GOOGLE_SUBJECTS||'').split(',').map(s=>s.trim()).filter(Boolean)
 });
}
