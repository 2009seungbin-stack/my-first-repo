/** App-level burst limiter for the endpoints that write to D1 (authorize, reconcile, sign-in
 * start, checkout). It is a STOPGAP: `*.pages.dev` cannot carry Cloudflare WAF rules, so until
 * the site runs on a custom domain with a WAF rate-limiting rule (docs/CLOUDFLARE.md), this keeps
 * one network from bursting thousands of writes per minute.
 *
 * - With a Workers Rate Limiting binding named RATE_LIMITER (`{limit({key}) → {success}}`) that
 *   binding decides (shared across Cloudflare's edge).
 * - Otherwise a fixed one-minute window per key in this isolate's memory. Isolates are many and
 *   short-lived, so this bounds bursts, not daily totals — daily totals are the D1 counters. */
export function createLimiter({max=10000}={}){
 const windows=new Map();
 return {
  hit(key,limit,now){
   const minute=Math.floor(now/60e3);let w=windows.get(key);
   if(!w||w.minute!==minute){
    if(windows.size>=max)for(const [k,v]of windows)if(v.minute!==minute)windows.delete(k);
    if(windows.size>=max)windows.clear();
    w={minute,count:0};windows.set(key,w);
   }
   w.count++;
   return w.count<=limit;
  }
 };
}
export const defaultLimiter=createLimiter();
/** true = allowed. Never throws: a broken limiter must not take the API down. */
export async function allowRequest({env,limiter,key,limit,now}){
 try{
  if(env?.RATE_LIMITER?.limit){const r=await env.RATE_LIMITER.limit({key});return r?.success!==false;}
 }catch{}
 return (limiter||defaultLimiter).hit(key,limit,now);
}
