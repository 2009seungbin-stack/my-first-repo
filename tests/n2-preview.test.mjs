import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {handlePlatformApi} from '../server/platform/api.js';
import {createLimiter} from '../server/ratelimit.js';
import {renderMarkdown} from '../platform/markdown.js';
import {LIMITS} from '../platform/community.js';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const ORIGIN='https://nerulio.test',T0=Date.UTC(2026,8,28,6,0);

function harness(){
 const db=D1Shim.migrated(),limiter=createLimiter();
 const env={DB:db,SESSION_SECRET:'test-session-secret-0123456789abcdef-0123456789',NERULIO_ENV:'development',SITE_URL:ORIGIN};
 const call=async(method,body,{origin=ORIGIN,ip='203.0.113.7'}={})=>{
  const headers=new Headers({'cf-connecting-ip':ip});
  if(origin)headers.set('origin',origin);
  if(body!==undefined)headers.set('content-type','application/json');
  const r=await handlePlatformApi(new Request(ORIGIN+'/api/v2/preview',{method,headers,body:body!==undefined?JSON.stringify(body):undefined}),env,null,{now:()=>T0,limiter});
  return {status:r.status,headers:r.headers,json:await r.json()};
 };
 return {db,call};
}

test('preview: the body comes back as the post page would render it, without an account and without storing anything',{skip},async()=>{
 const h=harness(),md='**굵게** `코드`\n\n- 하나\n- 둘\n\n<script>alert(1)</script> [링크](https://example.com/) [x](javascript:alert(1))';
 const r=await h.call('POST',{body:md});
 assert.equal(r.status,200);
 assert.equal(r.json.html,renderMarkdown(md));
 assert(r.json.html.includes('<strong>굵게</strong>')&&r.json.html.includes('<ul><li>하나</li>'));
 assert(!r.json.html.includes('<script>')&&!r.json.html.includes('javascript:'),'input HTML and unsafe links never come back');
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('set-cookie'),null,'no session is read or set');
 const n=await h.db.prepare('SELECT COUNT(*) AS n FROM discussions').first();
 assert.equal(Number(n.n),0);
});

test('preview: wrong input, another origin and GET are refused; the text is capped at a post body',{skip},async()=>{
 const h=harness();
 assert.equal((await h.call('POST',{body:42})).status,400);
 assert.equal((await h.call('POST',{})).status,400);
 assert.equal((await h.call('POST',{body:'x'},{origin:'https://evil.example'})).status,403);
 assert.equal((await h.call('GET')).status,405);
 const long='가'.repeat(LIMITS.body[1])+'TAIL';
 const r=await h.call('POST',{body:long});
 assert.equal(r.status,200);assert(!r.json.html.includes('TAIL'));
});

test('preview: thirty a minute per network',{skip},async()=>{
 const h=harness();
 for(let i=0;i<30;i++)assert.equal((await h.call('POST',{body:'x'})).status,200);
 assert.equal((await h.call('POST',{body:'x'})).status,429);
 assert.equal((await h.call('POST',{body:'x'},{ip:'198.51.100.9'})).status,200,'another network is not affected');
});
