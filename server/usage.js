import {quotaDay,nextReset,STUDIO_SUBJECT_SUFFIX} from '../src/quota.js';
import {ApiError} from './http.js';
/** Daily heavy-job accounting in D1. Never SELECT → JS increment → UPDATE.
 * One authorization is one db.batch(), which D1 executes as a single transaction:
 *   1. claim (subject, operation) as 'pending'              — no-op on retry
 *   2. conditional upsert: +1 only while used < limit and only if step 1 claimed it
 *   3. (anonymous) count the request against its network bucket if it was counted
 *   4. finalize allowed / used_after from the counter's last_operation_id
 *   5. read the stored decision
 * A retry of the same operation id therefore returns the original decision without
 * charging again, and concurrent tabs can never push `used` past `limit`. */
export const resetAt=now=>new Date(nextReset(now)).toISOString();
export async function usageFor(db,subject,limit,now){
 const row=await db.prepare('SELECT used FROM daily_usage WHERE subject_id=?1 AND day=?2').bind(subject,quotaDay(now)).first();
 const used=Number(row?.used||0);
 return {used,limit,remaining:Math.max(0,limit-used),resetAt:resetAt(now)};
}
export async function authorizeJob(db,{subject,operationId,toolId,limit,now,networkSubject=''}){
 const day=quotaDay(now),pending='SELECT 1 FROM job_authorizations WHERE subject_id=?1 AND operation_id=?3 AND state=\'pending\'';
 const statements=[
  db.prepare(`INSERT INTO job_authorizations(subject_id,operation_id,tool_id,state,created_at) VALUES(?1,?2,?3,'pending',?4)
   ON CONFLICT(subject_id,operation_id) DO NOTHING`).bind(subject,operationId,toolId,now),
  db.prepare(`INSERT INTO daily_usage(subject_id,day,used,last_operation_id) SELECT ?1,?2,1,?3 WHERE EXISTS(${pending})
   ON CONFLICT(subject_id,day) DO UPDATE SET used=used+1,last_operation_id=excluded.last_operation_id WHERE used<?4`).bind(subject,day,operationId,limit)
 ];
 if(networkSubject)statements.push(db.prepare(`INSERT INTO daily_usage(subject_id,day,used) SELECT ?4,?2,1
   WHERE EXISTS(${pending}) AND (SELECT last_operation_id FROM daily_usage WHERE subject_id=?1 AND day=?2)=?3
   ON CONFLICT(subject_id,day) DO UPDATE SET used=used+1`).bind(subject,day,operationId,networkSubject));
 statements.push(
  db.prepare(`UPDATE job_authorizations SET state='done',
   allowed=COALESCE((SELECT last_operation_id=?3 FROM daily_usage WHERE subject_id=?1 AND day=?2),0),
   used_after=(SELECT used FROM daily_usage WHERE subject_id=?1 AND day=?2)
   WHERE subject_id=?1 AND operation_id=?3 AND state='pending'`).bind(subject,day,operationId),
  db.prepare('SELECT tool_id,state,allowed,used_after,created_at FROM job_authorizations WHERE subject_id=?1 AND operation_id=?2').bind(subject,operationId)
 );
 const results=await db.batch(statements),row=results.at(-1).results?.[0];
 if(!row)throw new ApiError('INTERNAL');
 if(row.tool_id!==toolId)throw new ApiError('OPERATION_CONFLICT','operationId was already used for a different tool.');
 // A replay reports the counter as it stood for that operation, not today's newer value.
 const used=Number(row.used_after||0),at=Number(row.created_at);
 return Number(row.allowed)===1?{allowed:true,used,limit,remaining:Math.max(0,limit-used),resetAt:resetAt(at)}
  :{allowed:false,reason:'daily_limit',used,limit,remaining:0,resetAt:resetAt(at)};
}
export async function networkUsage(db,networkSubject,now){
 const row=await db.prepare('SELECT used FROM daily_usage WHERE subject_id=?1 AND day=?2').bind(networkSubject,quotaDay(now)).first();
 return Number(row?.used||0);
}
/** On sign-in, today's anonymous usage carries over so signing in is not a quota reset. */
export function carryOverStatement(db,anonSubject,userSubject,now){
 return db.prepare(`INSERT INTO daily_usage(subject_id,day,used) SELECT ?2,day,used FROM daily_usage WHERE subject_id=?1 AND day=?3
  ON CONFLICT(subject_id,day) DO UPDATE SET used=MAX(used,excluded.used)`).bind(anonSubject,userSubject,quotaDay(now));
}
/** Every daily counter of the identity (file-tool jobs and Studio exports) carries over. */
export function carryOverStatements(db,anonSubject,userSubject,now){
 return [carryOverStatement(db,anonSubject,userSubject,now),carryOverStatement(db,anonSubject+STUDIO_SUBJECT_SUFFIX,userSubject+STUDIO_SUBJECT_SUFFIX,now)];
}
/** Retention: expired sessions immediately; usage 7 days; idempotency keys 3 days;
 * webhook de-duplication keys 90 days (longer than any provider's retry window). */
export function cleanupStatements(db,now){
 return [
  db.prepare('DELETE FROM sessions WHERE expires_at<=?1').bind(now),
  db.prepare('DELETE FROM job_authorizations WHERE created_at<?1').bind(now-3*864e5),
  db.prepare('DELETE FROM daily_usage WHERE day<?1').bind(quotaDay(now-7*864e5)),
  db.prepare('DELETE FROM billing_events WHERE processed_at<?1').bind(now-90*864e5)
 ];
}
