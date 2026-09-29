import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {inventory,recipes,sourceDigest} from '../tools/distribution/inventory.mjs';
import {selectContent} from '../tools/distribution/select-content.mjs';
import {buildArticle} from '../tools/distribution/build-article.mjs';
import {validate,checkLiveSource} from '../tools/distribution/validate.mjs';
import {validCanonical,hash,fingerprint,ROOT,assertNoSecrets} from '../tools/distribution/common.mjs';
import {emptyLedger,entryFor,enforceCadence,readLedger,saveLedger,lockLedger,validateLedger} from '../tools/distribution/ledger.mjs';
import {devto,reconcile} from '../tools/distribution/devto.mjs';
import {stateStore} from '../tools/distribution/state.mjs';
import {run} from '../tools/distribution/run.mjs';
import {sitemapGroups} from '../tools/sitemaps.mjs';
import {gamePageFor} from '../tools/game-landing-build.mjs';
import {DEPTH} from '../src/seo-depth/index.js';
const now=new Date('2026-09-28T12:00:00Z');
const pages=inventory().pages;
const page=selectContent(pages,emptyLedger(),{now}),article=buildArticle(page);
const copy=x=>structuredClone(x);
async function cleanup(dir){const target=path.resolve(dir);assert.equal(path.dirname(target),path.resolve(tmpdir()));assert(path.basename(target).startsWith('distribution-'));await rm(target,{recursive:true,force:true});}
function memoryStore(initial=emptyLedger()){
 let durable=copy(initial);const saves=[];
 return {saves,load:async()=>copy(durable),save:async l=>{validateLedger(l);durable=copy(l);saves.push(copy(l));},value:()=>copy(durable)};
}
const post=(a=article,published=false)=>({id:101,url:'https://dev.to/operator/example-101',canonical:a.canonical_url,title:a.title,publishedAt:published?now.toISOString():null});
function fakeAPI(){const remote=[],calls=[],bodies=new Map();return {remote,calls,all:async()=>copy(remote),read:async id=>({...remote.find(p=>p.id===id),body:bodies.get(id)}),submit:async(a,o)=>{calls.push(o);const p=post(a,o.published),old=remote.findIndex(p=>p.id===o.id);if(old>=0)remote[old]=p;else remote.push(p);bodies.set(p.id,a.body_markdown);return p;}};}
const stamp=(a=article,date=now.toISOString())=>({...entryFor(emptyLedger(),a,now),status:'published',externalId:101,externalUrl:'https://dev.to/operator/example-101',publishedAt:date});
const response=data=>({ok:true,status:200,json:async()=>data});
const raw=(overrides={})=>({id:101,url:'https://dev.to/operator/example-101',canonical_url:article.canonical_url,title:article.title,published_at:null,...overrides});

test('inventory derives every game source from indexable registries, with English canonical and real evidence',()=>{
 const expected=sitemapGroups().game.filter(p=>DEPTH[p]?.en&&gamePageFor(p));
 assert.equal(pages.length,expected.length);assert(pages.length>100);
 for(const p of pages){assert(validCanonical(p.canonical));assert(expected.includes(p.route.slice(4,-1)));assert(p.primaryTopic);assert(p.priorityReason);assert(p.sourceEvidence.length);assert(p.assets.length);}
 assert(!pages.some(p=>/\/classic\/|\/app\/|\/studio\/|\/image\/|\/privacy\//.test(p.route)));
});
test('all reviewed articles are useful adaptations with current source fingerprints and valid tags',()=>{
 assert.equal(pages.filter(p=>p.articleReady).length,8);
 for(const p of pages.filter(p=>p.articleReady)){const a=buildArticle(p),v=validate(a);assert(v.ok,JSON.stringify(v));assert(a.body_markdown.indexOf('Nerulio')>a.body_markdown.length*0.7);assert.equal(recipes()[p.route.slice(4,-1)].sourceDigest,sourceDigest(p.route.slice(4,-1)));}
});
test('unadapted source fails closed instead of producing filler',()=>{assert.throws(()=>buildArticle(pages.find(p=>!p.articleReady)),/adaptation/);});
test('selection is deterministic across registry order and honours explicit route',()=>{
 assert.equal(selectContent([...pages].reverse(),emptyLedger(),{now}).route,page.route);
 assert.equal(selectContent(pages,emptyLedger(),{route:'game/aseprite-to-godot',now}).route,'/en/game/aseprite-to-godot/');
});
test('published source cannot be selected; related topic gets a cooldown',()=>{
 const l={schemaVersion:1,entries:[stamp()]};const inv=inventory(l);
 assert.notEqual(selectContent(inv.pages,l,{now}).route,page.route);
 assert.throws(()=>selectContent(inv.pages,l,{route:page.route,now}),/already published/);
 const tagged=copy(l);tagged.entries[0].topicCluster='aseprite-timing';
 const ready=pages.filter(p=>p.articleReady&&['aseprite-timing','pixel-cleanup'].includes(p.topicCluster));
 assert.equal(selectContent(ready,tagged,{now}).topicCluster,'pixel-cleanup');
});
test('canonical rejects lookalikes, credentials, query, traversal, non-English and HTTP',()=>{
 for(const u of ['http://nerulio.com/en/game/x/','https://nerulio.com.evil.test/en/game/x/','https://evil@nerulio.com/en/game/x/','https://nerulio.com/en/game/x/?q=1','https://nerulio.com/en/game/x/#h','https://nerulio.com/ko/game/x/','https://nerulio.com/en/game/../x/','https://nerulio.com:444/en/game/x/'])assert.equal(validCanonical(u),false,u);
 assert(validCanonical(article.canonical_url));
});
test('validation rejects missing target, wrong Nerulio CTA, copied source, filler, irrelevant and excessive tags',()=>{
 for(const change of [
  {sourceRoute:'/en/game/missing/'}, {canonical_url:'https://example.test/'}, {tags:['trending']}, {tags:['godot','gamedev','pixelart','aseprite','fifth']},
  {body_markdown:article.body_markdown.replace(article.canonical_url,'https://nerulio.com/')},
  {body_markdown:article.body_markdown+'\nTODO'}, {body_markdown:'Generic intro. '.repeat(400)},
  {body_markdown:JSON.stringify(DEPTH[page.route.slice(4,-1)].en)}, {body_markdown:'Nerulio is the best tool. '+article.body_markdown}
 ]){const a={...article,...change};a.contentHash=hash(a.body_markdown);a.fingerprint=fingerprint(a.body_markdown);assert.equal(validate(a).ok,false);}
});
test('fingerprint prevents duplication across routes independent of punctuation and link',()=>{
 assert.equal(fingerprint('One, TWO.'),fingerprint('one two'));
 const l={schemaVersion:1,entries:[{...stamp(),sourceRoute:'/en/game/another/',sourceCanonical:'https://nerulio.com/en/game/another/'}]};
 assert(validate(article,l).errors.some(x=>x.includes('Fingerprint')));
});
test('ledger schema rejects corruption and duplicate identity',()=>{
 assert.throws(()=>validateLedger({schemaVersion:1,entries:[stamp(),stamp()]}),/duplicate/);
 assert.throws(()=>validateLedger({schemaVersion:1,entries:[{...stamp(),publishedAt:'nonsense'}]}),/timestamp/);
});
test('cadence enforces rolling seven days and 72-hour spacing; only manual force can override',()=>{
 const l={schemaVersion:1,entries:[stamp(article,new Date(+now-864e5).toISOString())]};
 assert.throws(()=>enforceCadence(l,{now}),/72 hours/);
 l.entries[0].publishedAt=new Date(+now-4*864e5).toISOString();enforceCadence(l,{now});
 l.entries.push({...stamp(),sourceRoute:'/en/game/other/',publishedAt:new Date(+now-6*864e5).toISOString()});
 assert.throws(()=>enforceCadence(l,{now}),/two publications/);
 assert.throws(()=>enforceCadence(l,{now,force:true}),/operator/);
 enforceCadence(l,{now,force:true,manual:true});
 l.entries[0].uncertain=true;assert.throws(()=>enforceCadence(l,{now,force:true,manual:true}),/unresolved/);
});
test('dry-run is default, ignores publish env, does not call API or change ledger',async()=>{
 const store=memoryStore();const result=await run({store,api:{all:()=>assert.fail(),submit:()=>assert.fail()},env:{DISTRIBUTION_PUBLISH:'true'},now});
 assert.equal(result.mode,'dry-run');assert.equal(result.article.published,false);assert.equal(store.saves.length,0);
});
test('public mode requires explicit opt-in; Actions cannot publish on PR or other branch',async()=>{
 for(const env of [{},{DISTRIBUTION_PUBLISH:'TRUE'},{DISTRIBUTION_PUBLISH:'true',GITHUB_ACTIONS:'true',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'pull_request'},{DISTRIBUTION_PUBLISH:'true',GITHUB_ACTIONS:'true',GITHUB_REF:'refs/heads/feature',GITHUB_EVENT_NAME:'workflow_dispatch'}])await assert.rejects(run({store:memoryStore(),mode:'publish',env,now}),/requires|require/);
});
test('draft mode persists a reservation before creating a private draft',async()=>{
 const store=memoryStore(),api=fakeAPI();let during;
 const submit=api.submit;api.submit=async(a,o)=>{during=store.value();return submit(a,o);};
 const r=await run({store,api,mode:'draft',now,live:async()=>{}});
 assert.equal(r.status,'draft');assert.equal(api.calls[0].published,false);
 assert.equal(during.entries[0].status,'pending');assert.equal(during.entries[0].uncertain,true);
 await run({store,api,mode:'draft',route:page.route,now,live:async()=>{}});assert.equal(api.calls.length,1);
});
test('public retry reconciles a created post after a lost response and obeys cadence',async()=>{
 const store=memoryStore(),api=fakeAPI();api.submit=async(a,o)=>{api.calls.push(o);api.remote.push(post(a,true));throw Error('timeout');};
 const args={store,api,mode:'publish',env:{DISTRIBUTION_PUBLISH:'true'},now,live:async()=>{}};
 await assert.rejects(run(args),/unknown/);assert.equal(store.value().entries[0].status,'failed');
 await assert.rejects(run(args),/Cadence/);assert.equal(api.calls.length,1);assert.equal(store.value().entries[0].status,'published');
});
test('reviewed remote draft is promoted with PUT identity, never another creation',async()=>{
 const store=memoryStore(),api=fakeAPI();await run({store,api,mode:'draft',now,live:async()=>{}});
 const r=await run({store,api,mode:'publish',route:page.route,env:{DISTRIBUTION_PUBLISH:'true'},now,live:async()=>{}});
 assert.equal(r.status,'published');assert.equal(api.calls.length,2);assert.equal(api.calls[1].id,101);assert.equal(api.remote.length,1);
});
test('manually changed remote draft cannot be overwritten by publishing',async()=>{
 const store=memoryStore(),api=fakeAPI();await run({store,api,mode:'draft',now,live:async()=>{}});const read=api.read;
 api.read=async id=>({...await read(id),body:'Operator edited the draft'});
 await assert.rejects(run({store,api,mode:'publish',route:page.route,env:{DISTRIBUTION_PUBLISH:'true'},now,live:async()=>{}}),/differs/);assert.equal(api.calls.length,1);
});
test('a recovered draft with identical reviewed body can safely be promoted',async()=>{
 const api=fakeAPI();await api.submit(article,{published:false});const store=memoryStore();
 await run({store,api,mode:'publish',route:page.route,env:{DISTRIBUTION_PUBLISH:'true'},now,live:async()=>{}});
 assert.equal(api.calls[1].id,101);assert.equal(store.value().entries[0].contentHash,article.contentHash);
});
test('unknown remote result with no visible match blocks all later creation',async()=>{
 const store=memoryStore(),api=fakeAPI();api.submit=async()=>{api.calls.push(1);throw Error('lost');};
 await assert.rejects(run({store,api,mode:'draft',now,live:async()=>{}}),/unknown/);
 await assert.rejects(run({store,api,mode:'draft',now,live:async()=>{}}),/Unresolved/);assert.equal(api.calls.length,1);
});
test('failed durable reservation prevents API mutation',async()=>{
 const store=memoryStore(),api=fakeAPI(),save=store.save;store.save=async l=>{if(l.entries.some(e=>e.status==='pending'))throw Error('storage failure');await save(l);};
 await assert.rejects(run({store,api,mode:'draft',now,live:async()=>{}}),/storage/);assert.equal(api.calls.length,0);
});
test('crash after platform success before final save is reconciled without another POST',async()=>{
 const store=memoryStore(),api=fakeAPI(),save=store.save;let fail=true;
 store.save=async l=>{if(fail&&l.entries.some(e=>e.status==='draft'))throw Error('disk full');await save(l);};
 await assert.rejects(run({store,api,mode:'draft',now,live:async()=>{}}),/disk full/);
 assert.equal(store.value().entries[0].status,'pending');fail=false;
 await run({store,api,mode:'draft',now,live:async()=>{}});assert.equal(api.calls.length,1);assert.equal(store.value().entries[0].status,'draft');
});
test('force never creates a second copy of a published canonical',async()=>{
 const store=memoryStore({schemaVersion:1,entries:[stamp()]}),api=fakeAPI();api.remote.push(post(article,true));
 const r=await run({store,api,mode:'publish',route:page.route,force:true,env:{DISTRIBUTION_PUBLISH:'true',GITHUB_EVENT_NAME:'workflow_dispatch'},now,live:async()=>{}});
 assert.equal(r.status,'already-published');assert.equal(api.calls.length,0);
});
test('reconciliation rejects duplicate remote canonical and changed identity',()=>{
 assert.throws(()=>reconcile(emptyLedger(),[post(),{...post(),id:102}],pages),/Multiple/);
 assert.throws(()=>reconcile({schemaVersion:1,entries:[stamp()]},[{...post(),id:102}],pages),/identity/);
});
test('official API uses draft default, canonical field, max four tags and fixed credential host',async()=>{
 let call;const api=devto({apiKey:'test-key',fetchImpl:async(u,o)=>{call={u,o};return response(raw());}});
 await api.submit(article);assert.equal(call.u,'https://dev.to/api/articles');
 const b=JSON.parse(call.o.body).article;assert.equal(b.published,false);assert.equal(b.canonical_url,article.canonical_url);assert.equal(b.tags,article.tags.join(','));assert.equal(call.o.redirect,'error');
});
test('pagination reaches an empty page even after a short page; malformed pagination fails closed',async()=>{
 const urls=[];const api=devto({apiKey:'k',fetchImpl:async u=>{urls.push(u);return response(urls.length===1?[raw()]:urls.length===2?[raw({id:102})]:[]);}});
 assert.equal((await api.all()).length,2);assert.equal(urls.length,3);
 await assert.rejects(devto({apiKey:'k',fetchImpl:async()=>response([raw()])}).all(),/repeated/);
});
test('unrelated remote articles may have no canonical; detail reader validates body and identity',async()=>{
 let n=0;const a=devto({apiKey:'k',fetchImpl:async()=>response(n++===0?[raw({canonical_url:null})]:[])});assert.equal((await a.all()).length,1);
 const b=devto({apiKey:'k',fetchImpl:async()=>response({...raw(),body_markdown:article.body_markdown})});assert.equal((await b.read(101)).body,article.body_markdown);
 await assert.rejects(b.read(102),/Malformed/);
});
test('malformed API objects, invalid JSON, failures and response-body secrets never leak',async()=>{
 for(const payload of [{},raw({id:'101'}),raw({url:'https://evil.test/x'}),raw({published_at:'bad'}),raw({canonical_url:'https://other.test/'})])await assert.rejects(devto({apiKey:'secret-value',fetchImpl:async()=>response(payload)}).submit(article));
 const secret='super-private-secret';
 for(const fetchImpl of [async()=>{throw Error(secret);},async()=>({ok:false,status:401,json:async()=>({error:secret})}),async()=>({ok:true,json:async()=>{throw Error(secret);}})]){
  try{await devto({apiKey:secret,fetchImpl}).submit(article);assert.fail();}catch(e){assert(!e.message.includes(secret));}
 }
});
test('secret checks cover supplied environment values and recognizable credentials',()=>{
 const secret='sample-private-value-123';assert.throws(()=>assertNoSecrets({text:secret},{DEVTO_API_KEY:secret}),/withheld/);
 const a={...article,body_markdown:article.body_markdown+secret};a.contentHash=hash(a.body_markdown);a.fingerprint=fingerprint(a.body_markdown);
 assert.equal(validate(a,emptyLedger(),{DEVTO_API_KEY:secret}).ok,false);
 assert.throws(()=>assertNoSecrets('ghp_12345678901234567890'));
});
test('live target checks status, robots headers, HTML noindex and exact self canonical',async()=>{
 const html=`<html><head><link rel="canonical" href="${article.canonical_url}"></head></html>`;
 const live=(body=html,status=200,headers={})=>async()=>({status,headers:new Headers({'content-type':'text/html',...headers}),text:async()=>body});
 await checkLiveSource(article.canonical_url,live());
 for(const f of [live(html,404),live(html,200,{'x-robots-tag':'noindex'}),live(html.replace('</head>','<meta name="robots" content="noindex"></head>')),live('<html>fallback</html>'),live(html.replace(article.canonical_url,'https://nerulio.com/'))])await assert.rejects(checkLiveSource(article.canonical_url,f));
});
test('local ledger write is atomic and process lock prevents concurrent writers',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'distribution-'));try{const file=path.join(dir,'ledger.json');await saveLedger(file,emptyLedger());assert.deepEqual(await readLedger(file),emptyLedger());const release=await lockLedger(file);await assert.rejects(lockLedger(file),/locked/);await release();await writeFile(file,'broken');await assert.rejects(readLedger(file));}finally{await cleanup(dir);}
});
test('CLI dry run writes preview and payload without changing the seed ledger or using credentials',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'distribution-cli-'));try{
  const seed=await readFile(path.join(ROOT,'ops/distribution-ledger.json'),'utf8');
  const p=spawnSync(process.execPath,['tools/distribution/cli.mjs','--dry-run','--out',dir,'--route','game/aseprite-to-godot'],{cwd:ROOT,encoding:'utf8',env:{...process.env,DEVTO_API_KEY:'fake-private-value-123',DISTRIBUTION_PUBLISH:'true'}});
  assert.equal(p.status,0,p.stderr);assert(!p.stdout.includes('fake-private-value'));
  const payload=JSON.parse(await readFile(path.join(dir,'payload.json'),'utf8'));assert.equal(payload.article.published,false);assert.equal(payload.article.canonical_url,'https://nerulio.com/en/game/aseprite-to-godot/');
  assert.equal(await readFile(path.join(ROOT,'ops/distribution-ledger.json'),'utf8'),seed);
 }finally{await cleanup(dir);}
});
test('durable Git journal survives fresh checkouts and rejects racing writers',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'distribution-git-'));
 const git=(cwd,args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 try{
  const remote=path.join(dir,'remote.git'),one=path.join(dir,'one'),two=path.join(dir,'two');
  git(dir,['init','--bare',remote]);git(dir,['clone',remote,one]);git(dir,['clone',remote,two]);
  const a=await stateStore({root:one,file:path.join(one,'journal.json'),remote:true});assert.deepEqual(await a.load(),emptyLedger());await a.save(emptyLedger());
  const b=await stateStore({root:two,file:path.join(two,'journal.json'),remote:true});assert.deepEqual(await b.load(),emptyLedger());
  await a.save({schemaVersion:1,entries:[stamp()]});await assert.rejects(b.save(emptyLedger()),/Durable/);
  const fresh=await stateStore({root:two,file:path.join(two,'journal.json'),remote:true});assert.equal((await fresh.load()).entries[0].status,'published');
  assert.notEqual(git(one,['symbolic-ref','--short','HEAD']).trim(),'distribution-state');
  const sameA=await stateStore({root:one,file:path.join(one,'journal.json'),remote:true}),sameB=await stateStore({root:two,file:path.join(two,'journal.json'),remote:true});
  const l=await sameA.load();await sameB.load();await sameA.save(l);await assert.rejects(sameB.save(l),/Durable/);
 }finally{await cleanup(dir);}
});
test('workflow has explicit main/event guards, concurrency, durable state and safe defaults',async()=>{
 const y=await readFile(path.join(ROOT,'.github/workflows/distribution.yml'),'utf8');
 assert(y.includes("github.ref == 'refs/heads/main'"));assert(!/^  pull_request:/m.test(y));assert(y.includes('cancel-in-progress: false'));assert(y.includes('default: dry-run'));assert(y.includes('--state-git'));assert(y.includes('secrets.DEVTO_API_KEY'));assert(y.includes('if: always()'));
});
