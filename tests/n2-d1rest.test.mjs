import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {D1Rest} from '../platform/db/d1-rest.js';
import {ingest} from '../platform/ingest.js';
import {recordRun} from '../platform/collector-health.js';
import {statusChecked} from '../platform/render/panels/ai.js';

/** A fake Cloudflare D1 REST endpoint backed by node:sqlite. */
function fakeCloudflare(shim,calls=[]){
 return async(url,init)=>{
  calls.push({url,auth:init.headers.authorization});
  const {sql,params}=JSON.parse(init.body);
  try{const s=shim.raw.prepare(sql);const results=s.all(...params).map(r=>({...r}));return new Response(JSON.stringify({success:true,errors:[],result:[{results,success:true,meta:{}}]}));}
  catch(e){return new Response(JSON.stringify({success:false,errors:[{message:String(e.message)}],result:[]}),{status:400});}
 };
}

test('the REST binding speaks the D1 binding API well enough for the ingest pipeline',{skip:!sqliteAvailable},async()=>{
 const shim=D1Shim.migrated(),calls=[];
 const db=new D1Rest({accountId:'acc',databaseId:'db1',token:'tkn',fetch:fakeCloudflare(shim,calls)});
 const doc={schema:'nerulio.seed/1',vertical:'ai',sources:[{id:'src:s',kind:'FEED',url:'https://status.example.com/history.atom',retrieved:'2026-09-29'}],entities:[{id:'service:svc',type:'service',slug:'svc',names:{en:'Svc'}}],
  events:[{kind:'incident',title:{en:'Elevated errors'},starts:'2026-09-29T01:00:00Z',entities:['service:svc'],url:'https://status.example.com/incidents/abc',status:'confirmed',ver:'OFFICIAL',src:'src:s'}]};
 await ingest(db,doc,{mode:'collector',actor:'collector:test',now:Date.UTC(2026,8,29,2)});
 await ingest(db,doc,{mode:'collector',actor:'collector:test',now:Date.UTC(2026,8,29,3)});
 assert.equal(shim.raw.prepare('SELECT COUNT(*) n FROM events').get().n,1,'the same incident URL is one event');
 assert.equal(calls[0].url,'https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db1/query');assert.equal(calls[0].auth,'Bearer tkn');
 await assert.rejects(db.prepare('SELECT nope FROM nowhere').all(),/D1 REST: no such table/);
});

test('collector health: success clears failures, an error keeps the last success',{skip:!sqliteAvailable},async()=>{
 const shim=D1Shim.migrated(),db=new D1Rest({accountId:'a',databaseId:'b',token:'c',fetch:fakeCloudflare(shim)});
 const ad={id:'claude-status',vertical:'ai',freshnessHours:1},T=Date.UTC(2026,8,29,2);
 await recordRun(db,ad,{started:T-5e3,finished:T,error:null,observations:3,changes:1});
 await recordRun(db,ad,{started:T+36e5,finished:T+36e5+1,error:'HTTP 503',observations:0,changes:0});
 const row=shim.raw.prepare("SELECT last_success_at,last_error,consecutive_failures FROM collectors WHERE adapter='claude-status'").get();
 assert.deepEqual({...row},{last_success_at:T,last_error:'HTTP 503',consecutive_failures:1});
 assert.equal(shim.raw.prepare('SELECT COUNT(*) n FROM collector_runs').get().n,2);
 assert.equal(statusChecked({last_success_at:T},T+60e3),true);assert.equal(statusChecked({last_success_at:T},T+3*36e5),false,'stale after 2 hours');
});
