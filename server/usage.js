import {quotaDay,nextReset,STUDIO_SUBJECT_SUFFIX} from '../src/quota.js';
import {ApiError} from './http.js';
import {REPLAY_WINDOW_MS} from './config.js';
import {hmac,base64url} from './crypto.js';
/** Daily heavy-job accounting in D1. Never SELECT → JS increment → UPDATE.
 * One authorization is one db.batch(), which D1 executes as a single transaction:
 *   1. claim (subject, operation) as 'pending'              — no-op on retry
 *   2. conditional upsert: +1 only while used < limit and only if step 1 claimed it
 *   3. count the operation against each network bucket, only if step 2 counted it
 *   4. finalize allowed / used_after from the counter's last_operation_id
 *   5. read the stored decision
 * A retry of the same operation id therefore returns the original decision without
 * charging again (flagged `replay`), and concurrent tabs can never push `used` past `limit`.
 * After REPLAY_WINDOW_MS the id is refused instead of re-confirming an old permission. */
export const resetAt=now=>new Date(nextReset(now)).toISOString();
export async function usageFor(db,subject,limit,now){
 const row=await db.prepare('SELECT used FROM daily_usage WHERE subject_id=?1 AND day=?2').bind(subject,quotaDay(now)).first();
 const used=Number(row?.used||0);
 return {used,limit,remaining:Math.max(0,limit-used),resetAt:resetAt(now)};
}
export async function authorizeJob(db,{subject,operationId,toolId,limit,now,networkSubjects=[],networkSubject='',replayWindow=REPLAY_WINDOW_MS}){
 const day=quotaDay(now),pending='SELECT 1 FROM job_authorizations WHERE subject_id=?1 AND operation_id=?3 AND state=\'pending\'';
 const nets=[...networkSubjects,networkSubject].filter(Boolean);
 const statements=[
  db.prepare(`INSERT INTO job_authorizations(subject_id,operation_id,tool_id,state,created_at) VALUES(?1,?2,?3,'pending',?4)
   ON CONFLICT(subject_id,operation_id) DO NOTHING`).bind(subject,operationId,toolId,now),
  // A limit of 0 never inserts a first row (the plain INSERT branch ignores `used<limit`).
  db.prepare(`INSERT INTO daily_usage(subject_id,day,used,last_operation_id) SELECT ?1,?2,1,?3 WHERE EXISTS(${pending}) AND ?4>0
   ON CONFLICT(subject_id,day) DO UPDATE SET used=used+1,last_operation_id=excluded.last_operation_id WHERE used<?4`).bind(subject,day,operationId,limit)
 ];
 for(const net of nets)statements.push(db.prepare(`INSERT INTO daily_usage(subject_id,day,used) SELECT ?4,?2,1
   WHERE EXISTS(${pending}) AND (SELECT last_operation_id FROM daily_usage WHERE subject_id=?1 AND day=?2)=?3
   ON CONFLICT(subject_id,day) DO UPDATE SET used=used+1`).bind(subject,day,operationId,net));
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
 const replay=!(results[0].meta?.changes>0);
 const at=Number(row.created_at);
 if(replay&&now-at>replayWindow)throw new ApiError('OPERATION_EXPIRED','This operation id is too old; start a new operation.');
 // A replay reports the counter as it stood for that operation, not today's newer value.
 const used=Number(row.used_after||0);
 const base={used,limit,remaining:Math.max(0,limit-used),resetAt:resetAt(at),...(replay?{replay:true}:{})};
 return Number(row.allowed)===1?{allowed:true,...base}:{allowed:false,reason:'daily_limit',...base,remaining:0};
}
export async function networkUsage(db,networkSubject,now){
 const row=await db.prepare('SELECT used FROM daily_usage WHERE subject_id=?1 AND day=?2').bind(networkSubject,quotaDay(now)).first();
 return Number(row?.used||0);
}
/** Today's counter moves from one subject to another with MAX, so neither signing in nor
 * signing out is a quota reset. */
export function carryOverStatement(db,fromSubject,toSubject,now){
 return db.prepare(`INSERT INTO daily_usage(subject_id,day,used) SELECT ?2,day,used FROM daily_usage WHERE subject_id=?1 AND day=?3
  ON CONFLICT(subject_id,day) DO UPDATE SET used=MAX(used,excluded.used)`).bind(fromSubject,toSubject,quotaDay(now));
}
/** Every daily counter of the identity (file-tool jobs and Studio exports) carries over. */
export function carryOverStatements(db,fromSubject,toSubject,now){
 return [carryOverStatement(db,fromSubject,toSubject,now),carryOverStatement(db,fromSubject+STUDIO_SUBJECT_SUFFIX,toSubject+STUDIO_SUBJECT_SUFFIX,now)];
}
/** Aggregate refusal / abuse counters (admin stats). Counts only, no identities. */
export function eventStatement(db,now,kind){
 return db.prepare('INSERT INTO daily_events(day,kind,n) VALUES(?1,?2,1) ON CONFLICT(day,kind) DO UPDATE SET n=n+1').bind(quotaDay(now),String(kind).slice(0,40));
}
export async function bumpEvent(db,now,kind){try{await eventStatement(db,now,kind).run();}catch{}}
/** Signed offline allowance ("grace"). /me hands a Free identity up to OFFLINE_GRACE_EXPORTS
 * opaque tokens per class for today, never more than it has left. The page may spend one per
 * metered action ONLY when the service cannot be reached; once it is reachable again the
 * page reports the spent tokens (POST /jobs/reconcile) and each is charged exactly once.
 * Tokens are HMACs of (subject, class, day, index): they cannot be forged or moved to another
 * identity, they expire at 00:00 UTC, and a page that never reached the service has none. */
const GRACE_PREFIX={heavy:'h',studio:'s'};
async function graceMac(secret,subject,cls,day,i){
 return base64url(await hmac(secret,`grace/v1\n${subject}\n${cls}\n${day}\n${i}`)).slice(0,22);
}
export async function graceTokens(secret,subject,cls,now,count){
 const day=quotaDay(now),out=[];
 for(let i=1;i<=count;i++)out.push(`${GRACE_PREFIX[cls]}${i}.${await graceMac(secret,subject,cls,day,i)}`);
 return out;
}
/** → {cls,i} for a genuine token of this subject for today, else null. */
export async function readGraceToken(secret,subject,token,now,max){
 const m=/^([hs])(\d{1,2})\.([A-Za-z0-9_-]{22})$/.exec(String(token||''));if(!m)return null;
 const cls=m[1]==='h'?'heavy':'studio',i=Number(m[2]);if(!(i>=1&&i<=max))return null;
 const expected=await graceMac(secret,subject,cls,quotaDay(now),i);
 let diff=0;for(let k=0;k<22;k++)diff|=expected.charCodeAt(k)^m[3].charCodeAt(k);
 return diff===0?{cls,i}:null;
}
/** Retention: expired sessions immediately; usage 7 days; idempotency keys 3 days;
 * activity and event counters 30 days; webhook de-duplication keys 90 days. */
export function cleanupStatements(db,now){
 return [
  db.prepare('DELETE FROM sessions WHERE expires_at<=?1').bind(now),
  db.prepare('DELETE FROM job_authorizations WHERE created_at<?1').bind(now-3*864e5),
  db.prepare('DELETE FROM daily_usage WHERE day<?1').bind(quotaDay(now-7*864e5)),
  db.prepare('DELETE FROM account_activity WHERE day<?1').bind(quotaDay(now-30*864e5)),
  db.prepare('DELETE FROM daily_events WHERE day<?1').bind(quotaDay(now-30*864e5)),
  db.prepare('DELETE FROM billing_events WHERE processed_at<?1').bind(now-90*864e5)
 ];
}
