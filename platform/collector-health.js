// @ts-check
/** Collector health in D1 (tables `collectors`, `collector_runs`): when each source last succeeded,
 * so panels can say "확인 전" or show a stale warning instead of presenting old data as current. */

/** Run history kept per adapter: always the newest RUNS_MIN, never more than RUNS_MAX, and nothing
 * older than RUNS_DAYS beyond RUNS_MIN (status collectors run 48 times a day; the admin app shows the
 * newest 100). */
export const RUNS_MIN=20,RUNS_MAX=1000,RUNS_DAYS=90;
/** Delete run rows past the retention above (one indexed DELETE; nothing when there is nothing to prune).
 * @param {any} db @param {string} adapter @param {number} now */
export async function pruneRuns(db,adapter,now){
 await db.prepare(`DELETE FROM collector_runs WHERE adapter=? AND id NOT IN (SELECT id FROM collector_runs WHERE adapter=? ORDER BY id DESC LIMIT ?)
   AND (started_at<? OR id NOT IN (SELECT id FROM collector_runs WHERE adapter=? ORDER BY id DESC LIMIT ?))`)
  .bind(adapter,adapter,RUNS_MIN,now-RUNS_DAYS*864e5,adapter,RUNS_MAX).run();
}

/**
 * Record one run of an adapter (and prune that adapter's old run rows).
 * @param {any} db @param {{id:string,vertical:string,mode?:string,freshnessHours?:number}} adapter
 * `rowsWritten` / `queries` (D1's own rows_written and the REST query count of this run) are kept in
 * collector_runs so the admin app can show what each run cost against the D1 write budget.
 * @param {{started:number,finished:number,error:string|null,observations:number,changes:number,rowsWritten?:number|null,queries?:number|null}} run
 */
export async function recordRun(db,adapter,run){
 const ok=!run.error;
 const counts=[run.rowsWritten??null,run.queries??null].map(v=>v==null||!Number.isFinite(Number(v))?null:Math.max(0,Math.round(Number(v))));
 const upsert=()=>db.prepare(`INSERT INTO collectors (adapter,vertical,mode,freshness_hours,last_attempt_at,last_success_at,last_error,consecutive_failures) VALUES (?,?,?,?,?,?,?,?)
   ON CONFLICT(adapter) DO UPDATE SET vertical=excluded.vertical,mode=excluded.mode,freshness_hours=excluded.freshness_hours,last_attempt_at=excluded.last_attempt_at,
    last_success_at=COALESCE(excluded.last_success_at,collectors.last_success_at),last_error=excluded.last_error,
    consecutive_failures=CASE WHEN excluded.last_error IS NULL THEN 0 ELSE collectors.consecutive_failures+1 END`)
   .bind(adapter.id,adapter.vertical,adapter.mode||'auto',adapter.freshnessHours||24,run.finished,ok?run.finished:null,ok?null:String(run.error).slice(0,1000),ok?0:1);
 const err=ok?null:String(run.error).slice(0,1000);
 try{
  await db.batch([upsert(),db.prepare(`INSERT INTO collector_runs (adapter,started_at,finished_at,status,observations,changes,error,rows_written,queries) VALUES (?,?,?,?,?,?,?,?,?)`)
   .bind(adapter.id,run.started,run.finished,ok?'ok':'error',run.observations,run.changes,err,counts[0],counts[1])]);
 }catch(e){
  // A database without migration 0010 yet (no rows_written column): record the run the old way.
  // The D1 REST batch is not a transaction, so the upsert may already be done; repeating it would
  // count a failure twice, so only the run row is retried.
  if(!/no (such )?column|has no column/i.test(String(/** @type {any} */(e)?.message)))throw e;
  const known=await db.prepare('SELECT last_attempt_at FROM collectors WHERE adapter=?').bind(adapter.id).first();
  await db.batch([...(Number(known?.last_attempt_at)===run.finished?[]:[upsert()]),db.prepare(`INSERT INTO collector_runs (adapter,started_at,finished_at,status,observations,changes,error) VALUES (?,?,?,?,?,?,?)`)
   .bind(adapter.id,run.started,run.finished,ok?'ok':'error',run.observations,run.changes,err)]);
 }
 // Retention never fails a run record.
 try{await pruneRuns(db,adapter.id,run.finished);}catch{}
}
