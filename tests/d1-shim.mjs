/** Minimal Cloudflare D1 binding over node:sqlite for isolated tests. Mirrors the subset
 * the Worker uses: prepare/bind/first/all/run and batch() as one transaction. Every test
 * gets a fresh in-memory database; production D1 is never contacted. */
import {readFileSync,readdirSync} from 'node:fs';
let DatabaseSync=null;
try{({DatabaseSync}=await import('node:sqlite'));}catch{}
export const sqliteAvailable=!!DatabaseSync;
const MIGRATIONS=new URL('../migrations/',import.meta.url);
export function migrationFiles(){return readdirSync(MIGRATIONS).filter(f=>/^\d{4}_.+\.sql$/.test(f)).sort();}
function value(v){
 if(v===undefined)throw new TypeError('D1_TYPE_ERROR: undefined cannot be bound');
 return typeof v==='boolean'?(v?1:0):v;
}
class Statement{
 constructor(db,sql,params=[]){this.db=db;this.sql=sql;this.params=params;}
 bind(...params){return new Statement(this.db,this.sql,params.map(value));}
 execute(){
  const rows=this.db.raw.prepare(this.sql).all(...this.params).map(r=>({...r}));
  const changes=/^\s*(insert|update|delete)/i.test(this.sql)?Number(this.db.raw.prepare('SELECT changes() AS c').get().c):0;
  return {results:rows,success:true,meta:{changes}};
 }
 async first(column){const row=this.execute().results[0];return row?column?row[column]:row:null;}
 async all(){return this.execute();}
 async run(){return this.execute();}
}
export class D1Shim{
 constructor(){
  if(!DatabaseSync)throw Error('node:sqlite unavailable');
  this.raw=new DatabaseSync(':memory:');this.raw.exec('PRAGMA foreign_keys=ON');
 }
 static migrated(){const db=new D1Shim();for(const f of migrationFiles())db.raw.exec(readFileSync(new URL(f,MIGRATIONS),'utf8'));return db;}
 prepare(sql){return new Statement(this,sql);}
 async batch(statements){
  this.raw.exec('BEGIN IMMEDIATE');
  try{const out=statements.map(s=>s.execute());this.raw.exec('COMMIT');return out;}
  catch(e){this.raw.exec('ROLLBACK');throw e;}
 }
 async exec(sql){this.raw.exec(sql);return {count:1};}
}
