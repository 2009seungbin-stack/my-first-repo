import {inventory} from './inventory.mjs';
import {selectContent} from './select-content.mjs';
import {buildArticle} from './build-article.mjs';
import {validate,checkLiveSource} from './validate.mjs';
import {entryFor,enforceCadence} from './ledger.mjs';
import {reconcile} from './devto.mjs';
import {hash} from './common.mjs';
export async function run({store,api,mode='dry-run',route,force=false,env={},now=new Date(),live=checkLiveSource,artifact=async()=>{}}){
 if(!['dry-run','draft','publish'].includes(mode))throw Error('Unknown distribution mode');
 const manual=env.GITHUB_EVENT_NAME==='workflow_dispatch';
 if(force&&!manual)throw Error('Force only supported for operator workflow_dispatch');
 if(mode!=='dry-run'&&env.GITHUB_ACTIONS==='true'&&(env.GITHUB_REF!=='refs/heads/main'||!['schedule','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)))throw Error('Remote writes require main and schedule/workflow_dispatch');
 if(mode==='publish'&&env.DISTRIBUTION_PUBLISH!=='true')throw Error('Public publishing requires DISTRIBUTION_PUBLISH=true');
 const ledger=await store.load();
 if(mode!=='dry-run'){
  if(!api)throw Error('Remote mode requires configured DEV API');
  reconcile(ledger,await api.all(),inventory(ledger).pages);
  await store.save(ledger); // Persist recovered posts before selection or cadence checks.
 }
 const inv=inventory(ledger),page=selectContent(inv.pages,ledger,{route,force,now});
 if(!page){const result={mode,status:'exhausted',inventory:inv};await artifact(result);return result;}
 const article=buildArticle(page),validation=validate(article,ledger,env);
 const result={mode,status:'generated',selected:page,article,validation,inventory:inv};
 await artifact(result);
 if(!validation.ok)throw Error('Article validation failed: '+validation.errors.join('; '));
 if(mode==='dry-run')return result;
 // An unresolved POST anywhere blocks the entire queue, not only this route.
 if(ledger.entries.some(e=>e.uncertain||e.status==='pending'))throw Error('Unresolved attempt: remote search found no match; inspect DEV before clearing uncertainty');
 const e=entryFor(ledger,article,now);
 if(e.publishedAt){result.status='already-published';return result;} // --force never creates a second copy.
 if(mode==='draft'&&e.externalId){result.status='draft';result.externalUrl=e.externalUrl;return result;}
 if(e.externalId&&e.contentHash&&e.contentHash!==article.contentHash)throw Error('Draft content changed; review the local artifact and remote draft before publishing');
 if(e.externalId){
  const remote=await api.read(e.externalId);
  if(remote.canonical!==article.canonical_url||remote.publishedAt||hash(remote.body.trim())!==hash(article.body_markdown.trim()))throw Error('Remote draft differs from reviewed content; inspect it before publishing');
 }
 if(mode==='publish')enforceCadence(ledger,{now,force,manual});
 await live(article.canonical_url);
 Object.assign(e,{status:'generated',generatedTitle:article.title,contentHash:article.contentHash,fingerprint:article.fingerprint});
 await store.save(ledger);
 Object.assign(e,{status:'pending',lastAttemptAt:now.toISOString(),uncertain:true,error:null});
 await store.save(ledger); // If this fails, no API mutation occurs.
 let post;
 try{post=await api.submit(article,{published:mode==='publish',id:e.externalId});}
 catch{
  Object.assign(e,{status:'failed',error:'Remote outcome unknown; reconcile before retry',uncertain:true});
  await store.save(ledger);throw Error(e.error);
 }
 Object.assign(e,{status:post.publishedAt?'published':'draft',externalId:post.id,externalUrl:post.url,publishedAt:post.publishedAt,uncertain:false,error:null});
 await store.save(ledger); // Failure leaves the durable pending reservation for the next run.
 result.status=e.status;result.externalUrl=e.externalUrl;await artifact(result);return result;
}
