/** A separate Git branch is the durable journal. Push the reservation BEFORE calling Forem.
 * No checkout switching, source commits, force push, tokens in arguments or deployment trigger. */
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {emptyLedger,validateLedger,saveLedger} from './ledger.mjs';
export async function stateStore({root,file,remote=false,readOnly=false}){
 if(!remote)return {load:async()=>{const {readLedger}=await import('./ledger.mjs');return readLedger(file);},save:l=>saveLedger(file,l)};
 const ref='refs/heads/distribution-state';let parent='';
 const identity={GIT_AUTHOR_NAME:'github-actions[bot]',GIT_AUTHOR_EMAIL:'41898282+github-actions[bot]@users.noreply.github.com',GIT_COMMITTER_NAME:'github-actions[bot]',GIT_COMMITTER_EMAIL:'41898282+github-actions[bot]@users.noreply.github.com'};
 const git=(args,input)=>{try{return execFileSync('git',args,{cwd:root,input,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,...identity}}).trim();}catch{throw Error('Durable Git state operation failed; no further external mutation is safe');}};
 return {
  async load(){const head=git(['ls-remote','--heads','origin',ref]);if(!head)return emptyLedger();parent=head.split(/\s/)[0];git(['fetch','--no-tags','origin',ref]);return validateLedger(JSON.parse(git(['show',`${parent}:ledger.json`])));},
  async save(l){
   if(readOnly)throw Error('Read-only state store');validateLedger(l);
   const blob=git(['hash-object','-w','--stdin'],JSON.stringify(l,null,2)+'\n');
   const tree=git(['mktree'],`100644 blob ${blob}\tledger.json\n`);
   const commit=git(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m',`Record distribution state ${randomUUID()}`]);
   // Ordinary push is a compare-and-swap against the parent: divergent writers fail closed.
   git(['push','origin',`${commit}:${ref}`]);parent=commit;
   await saveLedger(file,l);
  }
 };
}
