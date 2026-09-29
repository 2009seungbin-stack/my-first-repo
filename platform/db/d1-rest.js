// @ts-check
/** A D1 binding (prepare/bind/first/all/run/batch) over Cloudflare's D1 REST API, for code that
 * runs outside the Worker — the scheduled collectors on GitHub Actions and one-off operator scripts
 * — so they write through the same ingest pipeline as everything else (architecture D6).
 *   POST https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query {sql, params}
 * batch() sends the statements in order and stops at the first failure; the REST API has no
 * multi-statement transaction with parameters, so ingest writes are idempotent by design. */

/** @typedef {{accountId:string,databaseId:string,token:string,fetch?:typeof fetch,endpoint?:string}} RestOptions */

export class D1Rest{
 /** @param {RestOptions} o */
 constructor(o){
  if(!o.accountId||!o.databaseId||!o.token)throw Error('D1Rest needs accountId, databaseId and token');
  this.url=`${o.endpoint||'https://api.cloudflare.com/client/v4'}/accounts/${encodeURIComponent(o.accountId)}/d1/database/${encodeURIComponent(o.databaseId)}/query`;
  this.token=o.token;this.fetch=o.fetch||fetch;this.queries=0;
  /** D1's own count of rows written (indexes included) — what the daily write limit is measured in. */
  this.rowsWritten=0;
 }
 /** @param {string} sql @param {unknown[]} params */
 async query(sql,params){
  this.queries++;
  const res=await this.fetch(this.url,{method:'POST',headers:{authorization:`Bearer ${this.token}`,'content-type':'application/json'},body:JSON.stringify({sql,params:params.map(v=>typeof v==='boolean'?(v?1:0):v)})});
  const body=/** @type {any} */(await res.json().catch(()=>null));
  if(!res.ok||!body?.success){const msg=body?.errors?.map((/** @type {any} */ e)=>e.message).join('; ')||`HTTP ${res.status}`;throw Error(`D1 REST: ${msg}`);}
  const r=body.result?.[0]||{};
  this.rowsWritten+=Number(r.meta?.rows_written)||0;
  return {results:r.results||[],success:true,meta:r.meta||{}};
 }
 /** @param {string} sql */
 prepare(sql){return new RestStatement(this,sql,[]);}
 /** @param {RestStatement[]} statements */
 async batch(statements){const out=[];for(const s of statements)out.push(await s.run());return out;}
}
class RestStatement{
 /** @param {D1Rest} db @param {string} sql @param {unknown[]} params */
 constructor(db,sql,params){this.db=db;this.sql=sql;this.params=params;}
 /** @param {...unknown} params */
 bind(...params){
  for(const p of params)if(p===undefined)throw new TypeError('D1_TYPE_ERROR: undefined cannot be bound');
  return new RestStatement(this.db,this.sql,params);
 }
 /** @param {string} [column] */
 async first(column){const r=(await this.db.query(this.sql,this.params)).results[0];return r?column?r[column]:r:null;}
 async all(){return this.db.query(this.sql,this.params);}
 async run(){return this.db.query(this.sql,this.params);}
}
