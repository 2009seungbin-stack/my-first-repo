import {hmacHex,safeEqual} from '../crypto.js';
import {ApiError} from '../http.js';
/** Paddle Billing adapter (merchant of record; handles tax and supports sellers in Korea).
 * Written against Paddle's public API documentation. It has NOT been exercised against a
 * Paddle sandbox account from this repository — verify it there before BILLING_MODE=live.
 * Env: BILLING_API_KEY (secret), BILLING_WEBHOOK_SECRET (secret), BILLING_PRICE_ID, BILLING_MODE. */
const API={sandbox:'https://sandbox-api.paddle.com',live:'https://api.paddle.com'};
const TOLERANCE_S=300;
const base=env=>API[String(env.BILLING_MODE||'sandbox').toLowerCase()]||API.sandbox;
async function call(env,fetcher,path,body){
 let response;
 try{response=await fetcher(base(env)+path,{method:'POST',headers:{Authorization:`Bearer ${env.BILLING_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
 catch{throw new ApiError('UPSTREAM_FAILED','Billing provider unreachable.');}
 if(!response.ok)throw new ApiError('UPSTREAM_FAILED','Billing provider rejected the request.');
 return (await response.json()).data;
}
export const paddle={
 name:'paddle',
 async createCheckout({user,env,fetcher=fetch}){
  // custom_data travels from the transaction to the subscription and back in webhooks.
  const data=await call(env,fetcher,'/transactions',{items:[{price_id:env.BILLING_PRICE_ID,quantity:1}],custom_data:{nerulio_user_id:user.id}});
  if(!data?.checkout?.url)throw new ApiError('UPSTREAM_FAILED','Billing provider returned no checkout URL. Set a default payment link in Paddle.');
  return {url:data.checkout.url,reference:data.id};
 },
 /** Paddle-Signature: ts=<unix>;h1=<hex HMAC-SHA256(secret, ts + ":" + raw body)> */
 async verifyWebhook({headers,body,env,now}){
  const secret=env.BILLING_WEBHOOK_SECRET;if(!secret)return false;
  const fields=String(headers.get('paddle-signature')||'').split(';').map(p=>p.split('='));
  const ts=Number(fields.find(([k])=>k==='ts')?.[1]),h1=fields.filter(([k])=>k==='h1').map(([,v])=>v);
  if(!Number.isInteger(ts)||Math.abs(now/1000-ts)>TOLERANCE_S||!h1.length)return false;
  const expected=await hmacHex(secret,`${ts}:${body}`);
  return h1.some(v=>safeEqual(v,expected));
 },
 normalizeWebhook(p,env){
  const occurredAt=Date.parse(p?.occurred_at);
  if(typeof p?.event_id!=='string'||!p.event_id||!Number.isFinite(occurredAt))return null;
  const type=String(p.event_type||''),d=p.data||{};
  const sub=type.startsWith('subscription.')&&typeof d.id==='string'?{
   externalSubscriptionId:d.id,externalCustomerId:typeof d.customer_id==='string'?d.customer_id:null,
   userId:typeof d.custom_data?.nerulio_user_id==='string'?d.custom_data.nerulio_user_id:null,
   plan:(d.items||[]).some(i=>i?.price?.id===env.BILLING_PRICE_ID)?'pro':'other',
   status:String(d.status||'unknown'),currentPeriodEnd:Date.parse(d.current_billing_period?.ends_at)||null,
   cancelAtPeriodEnd:d.scheduled_change?.action==='cancel'}:null;
  return {eventId:p.event_id,type,occurredAt,subscription:sub};
 },
 async portal({customerId,subscriptionId,env,fetcher=fetch}){
  if(!customerId)throw new ApiError('BILLING_UNAVAILABLE','No billing customer on file.');
  const data=await call(env,fetcher,`/customers/${encodeURIComponent(customerId)}/portal-sessions`,subscriptionId?{subscription_ids:[subscriptionId]}:{});
  const url=data?.urls?.general?.overview;if(!url)throw new ApiError('UPSTREAM_FAILED','No portal URL.');
  return {url};
 },
 async getSubscription(){return null;}
};
