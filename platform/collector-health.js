// @ts-check
/** Collector health in D1 (tables `collectors`, `collector_runs`): when each source last succeeded,
 * so panels can say "확인 전" or show a stale warning instead of presenting old data as current. */

/**
 * Record one run of an adapter. Returns the run id.
 * @param {any} db @param {{id:string,vertical:string,mode?:string,freshnessHours?:number}} adapter
 * @param {{started:number,finished:number,error:string|null,observations:number,changes:number}} run
 */
export async function recordRun(db,adapter,run){
 const ok=!run.error;
 await db.batch([
  db.prepare(`INSERT INTO collectors (adapter,vertical,mode,freshness_hours,last_attempt_at,last_success_at,last_error,consecutive_failures) VALUES (?,?,?,?,?,?,?,?)
   ON CONFLICT(adapter) DO UPDATE SET vertical=excluded.vertical,mode=excluded.mode,freshness_hours=excluded.freshness_hours,last_attempt_at=excluded.last_attempt_at,
    last_success_at=COALESCE(excluded.last_success_at,collectors.last_success_at),last_error=excluded.last_error,
    consecutive_failures=CASE WHEN excluded.last_error IS NULL THEN 0 ELSE collectors.consecutive_failures+1 END`)
   .bind(adapter.id,adapter.vertical,adapter.mode||'auto',adapter.freshnessHours||24,run.finished,ok?run.finished:null,ok?null:String(run.error).slice(0,1000),ok?0:1),
  db.prepare(`INSERT INTO collector_runs (adapter,started_at,finished_at,status,observations,changes,error) VALUES (?,?,?,?,?,?,?)`)
   .bind(adapter.id,run.started,run.finished,ok?'ok':'error',run.observations,run.changes,ok?null:String(run.error).slice(0,1000)),
 ]);
}
