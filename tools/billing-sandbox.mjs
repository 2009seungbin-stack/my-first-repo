/** Deliver a signed *sandbox* subscription webhook to a preview or local deployment.
 * This is the only way the internal sandbox provider grants Pro; production builds refuse
 * the sandbox provider entirely (server/config.js).
 *
 *   BILLING_WEBHOOK_SECRET=… node tools/billing-sandbox.mjs --url https://<preview>.pages.dev \
 *     --user <users.id> [--status active|canceled] [--days 30] [--cancel-at-period-end]
 */
import {signSandbox,SANDBOX_SIGNATURE} from '../server/billing/sandbox.js';
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const url=arg('url'),user=arg('user'),secret=process.env.BILLING_WEBHOOK_SECRET;
if(!url||!user||!secret){console.error('Usage: BILLING_WEBHOOK_SECRET=… node tools/billing-sandbox.mjs --url <site> --user <user id> [--status active] [--days 30] [--cancel-at-period-end]');process.exit(2);}
const days=Number(arg('days','30')),now=Date.now();
const body=JSON.stringify({id:`evt-sandbox-${crypto.randomUUID()}`,type:'subscription.updated',occurredAt:new Date(now).toISOString(),
 data:{subscriptionId:`sandbox-${user}`,customerId:`sandbox-customer-${user}`,userId:user,plan:'pro',status:arg('status','active'),
  currentPeriodEnd:new Date(now+days*864e5).toISOString(),cancelAtPeriodEnd:args.includes('--cancel-at-period-end')}});
const response=await fetch(new URL('/api/v1/billing/webhook',url),{method:'POST',headers:{'Content-Type':'application/json',[SANDBOX_SIGNATURE]:await signSandbox(secret,body)},body});
console.log(response.status,await response.text());
process.exit(response.ok?0:1);
