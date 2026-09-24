/** Applies one verified, normalized billing event exactly once (single D1 batch):
 *  1. claim (provider, event_id) as pending — a duplicate delivery claims nothing
 *  2a. subscription event: upsert the subscription only if this batch claimed the event, the
 *      user exists, and the event is not older than what is stored (out-of-order delivery)
 *  2b. dispute (chargeback / chargeback_warning): mark the subscription disputed and flag its
 *      account — both are immediate and survive later "active" events (operator clears them)
 *  2c. refund / credit / reversal: recorded only; Pro keeps the paid period (owner policy)
 *  3. mark the event processed / ignored
 * Paid-period rules (docs/BILLING.md): a 'canceled' event without a period end keeps the stored
 * end (the paid period is honoured); past_due_since is the start of the current past_due spell. */
export const DISPUTE_ACTIONS=Object.freeze(['chargeback','chargeback_warning']);
export async function applyBillingEvent(db,provider,event,now){
 const s=event.subscription,a=event.adjustment,pending=`EXISTS(SELECT 1 FROM billing_events WHERE provider=?1 AND event_id=?2 AND state='pending')`;
 const statements=[db.prepare(`INSERT INTO billing_events(provider,event_id,event_type,state,processed_at) VALUES(?1,?2,?3,'pending',?4)
  ON CONFLICT(provider,event_id) DO NOTHING`).bind(provider,event.eventId,event.type.slice(0,80),now)];
 let done;
 if(s){
  // A later event may omit our user id; it can then only update a subscription we already own.
  const owner=`COALESCE((SELECT id FROM users WHERE id=?3),(SELECT user_id FROM subscriptions WHERE provider=?1 AND external_subscription_id=?4))`;
  statements.push(db.prepare(`INSERT INTO subscriptions(provider,external_subscription_id,user_id,external_customer_id,plan,status,current_period_end,cancel_at_period_end,updated_at,past_due_since,price_id)
   SELECT ?1,?4,${owner},?5,?6,?7,?8,?9,?10,CASE WHEN ?7='past_due' THEN ?10 ELSE NULL END,?11 WHERE ${pending} AND ${owner} IS NOT NULL
   ON CONFLICT(provider,external_subscription_id) DO UPDATE SET user_id=excluded.user_id,external_customer_id=COALESCE(excluded.external_customer_id,subscriptions.external_customer_id),
    plan=excluded.plan,status=excluded.status,
    current_period_end=CASE WHEN excluded.status='canceled' AND excluded.current_period_end IS NULL THEN subscriptions.current_period_end ELSE excluded.current_period_end END,
    cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at,
    past_due_since=CASE WHEN excluded.status='past_due' THEN COALESCE(subscriptions.past_due_since,excluded.updated_at) ELSE NULL END,
    price_id=COALESCE(excluded.price_id,subscriptions.price_id)
   WHERE excluded.updated_at>=subscriptions.updated_at`).bind(provider,event.eventId,s.userId,s.externalSubscriptionId,s.externalCustomerId,s.plan,s.status,s.currentPeriodEnd,s.cancelAtPeriodEnd?1:0,event.occurredAt,s.priceId??null));
  done=db.prepare(`UPDATE billing_events SET state=CASE WHEN ${owner} IS NOT NULL THEN 'processed' ELSE 'ignored' END
   WHERE provider=?1 AND event_id=?2 AND state='pending'`).bind(provider,event.eventId,s.userId,s.externalSubscriptionId);
 }else if(a){
  // Match the subscription by id, or by customer when the adjustment carries no subscription.
  const match=`(provider=?1 AND ((?3 IS NOT NULL AND external_subscription_id=?3) OR (?3 IS NULL AND ?4 IS NOT NULL AND external_customer_id=?4)))`;
  const dispute=DISPUTE_ACTIONS.includes(a.action)&&a.status!=='rejected';
  if(dispute){
   statements.push(
    db.prepare(`UPDATE users SET flagged_at=COALESCE(flagged_at,?5),flag_reason=COALESCE(flag_reason,'chargeback') WHERE id IN (SELECT user_id FROM subscriptions WHERE ${match}) AND ${pending}`).bind(provider,event.eventId,a.externalSubscriptionId,a.externalCustomerId,event.occurredAt),
    db.prepare(`UPDATE subscriptions SET disputed_at=COALESCE(disputed_at,?5) WHERE ${match} AND ${pending}`).bind(provider,event.eventId,a.externalSubscriptionId,a.externalCustomerId,event.occurredAt));
  }
  done=db.prepare(`UPDATE billing_events SET state=CASE WHEN EXISTS(SELECT 1 FROM subscriptions WHERE ${match}) THEN 'processed' ELSE 'ignored' END
   WHERE provider=?1 AND event_id=?2 AND state='pending'`).bind(provider,event.eventId,a.externalSubscriptionId,a.externalCustomerId);
 }else{
  done=db.prepare(`UPDATE billing_events SET state='ignored' WHERE provider=?1 AND event_id=?2 AND state='pending'`).bind(provider,event.eventId);
 }
 statements.push(done);
 const results=await db.batch(statements);
 const duplicate=!(results[0].meta?.changes>0);
 return {duplicate};
}
