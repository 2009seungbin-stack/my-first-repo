/** Applies one verified, normalized billing event exactly once (single D1 batch):
 *  1. claim (provider, event_id) as pending — a duplicate delivery claims nothing
 *  2. upsert the subscription only if this batch claimed the event, the user exists, and the
 *     event is not older than what is stored (providers may deliver out of order)
 *  3. mark the event processed / ignored */
export async function applyBillingEvent(db,provider,event,now){
 const s=event.subscription,pending=`EXISTS(SELECT 1 FROM billing_events WHERE provider=?1 AND event_id=?2 AND state='pending')`;
 const statements=[db.prepare(`INSERT INTO billing_events(provider,event_id,event_type,state,processed_at) VALUES(?1,?2,?3,'pending',?4)
  ON CONFLICT(provider,event_id) DO NOTHING`).bind(provider,event.eventId,event.type.slice(0,80),now)];
 let owner='NULL';
 if(s){
  // A later event may omit our user id; it can then only update a subscription we already own.
  owner=`COALESCE((SELECT id FROM users WHERE id=?3),(SELECT user_id FROM subscriptions WHERE provider=?1 AND external_subscription_id=?4))`;
  statements.push(db.prepare(`INSERT INTO subscriptions(provider,external_subscription_id,user_id,external_customer_id,plan,status,current_period_end,cancel_at_period_end,updated_at)
   SELECT ?1,?4,${owner},?5,?6,?7,?8,?9,?10 WHERE ${pending} AND ${owner} IS NOT NULL
   ON CONFLICT(provider,external_subscription_id) DO UPDATE SET user_id=excluded.user_id,external_customer_id=COALESCE(excluded.external_customer_id,subscriptions.external_customer_id),
    plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at
   WHERE excluded.updated_at>=subscriptions.updated_at`).bind(provider,event.eventId,s.userId,s.externalSubscriptionId,s.externalCustomerId,s.plan,s.status,s.currentPeriodEnd,s.cancelAtPeriodEnd?1:0,event.occurredAt));
 }
 statements.push(db.prepare(`UPDATE billing_events SET state=CASE WHEN ${s?owner+' IS NOT NULL':'0'} THEN 'processed' ELSE 'ignored' END
  WHERE provider=?1 AND event_id=?2 AND state='pending'`).bind(provider,event.eventId,...(s?[s.userId,s.externalSubscriptionId]:[])));
 const results=await db.batch(statements);
 const duplicate=!(results[0].meta?.changes>0);
 return {duplicate};
}
