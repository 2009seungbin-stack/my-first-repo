import {sandbox} from './sandbox.js';
import {paddle} from './paddle.js';
/** Billing provider contract. Adapters translate between a payment provider and Nerulio's
 * normalized subscription record; only a verified webhook may change entitlement.
 *
 *   createCheckout({user,cfg,env,origin,fetcher})      → {url}
 *   verifyWebhook({headers,body,env,now})             → boolean (signature + freshness)
 *   normalizeWebhook(payload,env)                     → {eventId,type,occurredAt,subscription|null}
 *   portal({customerId,subscriptionId,env,origin,fetcher}) → {url}   (manage / cancel)
 *   getSubscription({subscriptionId,env,fetcher})     → normalized subscription (reconciliation)
 *
 * A normalized subscription is
 *   {externalSubscriptionId,externalCustomerId,userId|null,plan,status,currentPeriodEnd,cancelAtPeriodEnd}
 * with times in epoch ms. Cancellation is performed in the provider portal; the webhook that
 * follows is what downgrades the account.
 */
export const PROVIDERS=Object.freeze({sandbox,paddle});
export function billingProvider(cfg){return cfg.billing.mode==='off'?null:PROVIDERS[cfg.billing.provider]||null;}
