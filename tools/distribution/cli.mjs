import {parseArgs} from 'node:util';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,assertNoSecrets} from './common.mjs';
import {lockLedger} from './ledger.mjs';
import {stateStore} from './state.mjs';
import {devto} from './devto.mjs';
import {run} from './run.mjs';
import {inventory} from './inventory.mjs';
import {report} from './report.mjs';
export async function cli(args=process.argv.slice(2),env=process.env){
 const {values:v}=parseArgs({args,options:{'dry-run':{type:'boolean'},mode:{type:'string',default:'dry-run'},route:{type:'string'},out:{type:'string',default:'test-results/distribution'},ledger:{type:'string',default:'ops/distribution-ledger.json'},'state-git':{type:'boolean'},force:{type:'boolean'},report:{type:'boolean'},help:{type:'boolean'}}});
 if(v.help){console.log('node tools/distribution/cli.mjs [--dry-run | --mode draft|publish] [--route /en/game/aseprite-to-godot/] [--state-git] [--report] [--out directory]\nPublic mode requires DISTRIBUTION_PUBLISH=true. Remote modes require DEVTO_API_KEY. Force is restricted to workflow_dispatch.');return;}
 if(v['dry-run']&&v.mode!=='dry-run')throw Error('Conflicting dry-run and remote mode flags');
 const out=path.resolve(ROOT,v.out),file=path.resolve(ROOT,v.ledger),mode=v.mode;
 if(env.GITHUB_ACTIONS==='true'&&mode!=='dry-run'&&!v['state-git'])throw Error('Actions remote mode requires durable --state-git');
 const release=await lockLedger(file);
 try{
  const store=await stateStore({root:ROOT,file,remote:!!v['state-git']||mode!=='dry-run',readOnly:mode==='dry-run'});
  await mkdir(out,{recursive:true});
  const artifact=async result=>{
   assertNoSecrets(result,env);
   await writeFile(path.join(out,'inventory.json'),JSON.stringify(result.inventory,null,2)+'\n');
   await writeFile(path.join(out,'result.json'),JSON.stringify({...result,inventory:undefined,article:result.article?{...result.article,body_markdown:undefined}:undefined},null,2)+'\n');
   if(result.article){
    await writeFile(path.join(out,'article.md'),'# '+result.article.title+'\n\n'+result.article.body_markdown);
    await writeFile(path.join(out,'payload.json'),JSON.stringify({article:{title:result.article.title,body_markdown:result.article.body_markdown,tags:result.article.tags.join(','),canonical_url:result.article.canonical_url,published:mode==='publish'}},null,2)+'\n');
   }
  };
  if(v.report){const ledger=await store.load(),inv=inventory(ledger);const text=report(inv,ledger);assertNoSecrets(text,env);await writeFile(path.join(out,'inventory.json'),JSON.stringify(inv,null,2)+'\n');await writeFile(path.join(out,'STATUS.md'),text);console.log(`Inventory and STATUS.md written to ${out}`);return;}
  const api=mode==='dry-run'?undefined:devto({apiKey:env.DEVTO_API_KEY});
  const result=await run({store,api,mode,route:v.route,force:v.force,env,artifact});
  if(result.selected)console.log(JSON.stringify({mode,status:result.status,source:result.selected.route,canonical:result.article.canonical_url,platform:'devto',title:result.article.title,tags:result.article.tags,reason:result.selected.priorityReason,validation:result.validation,preview:path.join(out,'article.md'),externalUrl:result.externalUrl},null,2));
  else console.log('No reviewed unpublished articles remain. See inventory.json; no remote write attempted.');
 }finally{await release();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await cli();}catch(e){
  // Only our controlled errors are shown. Network/process exceptions never include response data.
  let message=String(e.message||'Distribution failed');try{assertNoSecrets(message);}catch{message='Distribution failed; sensitive error details withheld';}
  console.error(message);process.exitCode=1;
 }
}
