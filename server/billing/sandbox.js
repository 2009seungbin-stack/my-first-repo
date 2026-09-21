import {hmacHex,randomToken,safeEqual} from '../crypto.js';
/** Internal sandbox provider for preview/local end-to-end tests. It takes no payment and has
 * no success page that grants anything: Pro starts only when a webhook signed with
 * BILLING_WEBHOOK_SECRET arrives (tools/billing-sandbox.mjs or the test harness).
 * server/config.js refuses this provider on production builds. */
export const SANDBOX_SIGNATURE='nerulio-sandbox-signature';
const TOLERANCE_S=300;
export async function signSandbox(secret,body,t=Math.floor(Date.now()/1000)){return `t=${t},v1=${await hmacHex(secret,`${t}.${body}`)}`;}
export const sandbox={
 name:'sandbox',
 async createCheckout({user,origin}){
  return {url:`${origin}/account/?checkout=sandbox&reference=${randomToken(9)}`,reference:`sandbox-${user.id}`};
 },
 async verifyWebhook({headers,body,env,now}){
  const secret=env.BILLING_WEBHOOK_SECRET;if(!secret)return false;
  const parts=Object.fromEntries(String(headers.get(SANDBOX_SIGNATURE)||'').split(',').map(p=>p.split('=')));
  const t=Number(parts.t);if(!Number.isInteger(t)||Math.abs(now/1000-t)>TOLERANCE_S||!parts.v1)return false;
  return safeEqual(await hmacHex(secret,`${t}.${body}`),parts.v1);
 },
 normalizeWebhook(p){
  const d=p?.data||{},occurredAt=Date.parse(p?.occurredAt);
  if(typeof p?.id!=='string'||!p.id||!Number.isFinite(occurredAt))return null;
  const sub=String(p.type||'').startsWith('subscription.')&&typeof d.subscriptionId==='string'?{
   externalSubscriptionId:d.subscriptionId,externalCustomerId:typeof d.customerId==='string'?d.customerId:null,
   userId:typeof d.userId==='string'?d.userId:null,plan:d.plan==='pro'?'pro':'other',status:String(d.status||'unknown'),
   currentPeriodEnd:Date.parse(d.currentPeriodEnd)||null,cancelAtPeriodEnd:d.cancelAtPeriodEnd===true}:null;
  return {eventId:p.id,type:String(p.type||''),occurredAt,subscription:sub};
 },
 async portal({origin}){return {url:`${origin}/account/?portal=sandbox`};},
 async getSubscription(){return null;}
};
