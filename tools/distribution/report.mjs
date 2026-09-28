import {selectContent} from './select-content.mjs';
export function report(inv,ledger,now=new Date()){
 const published=ledger.entries.filter(e=>e.publishedAt),failed=ledger.entries.filter(e=>e.status==='failed'||e.uncertain);
 const remaining=inv.pages.filter(p=>!p.alreadyDistributed),next=[];
 let pool=inv.pages;
 for(let i=0;i<5;i++){const p=selectContent(pool,ledger,{now});if(!p)break;next.push(p);pool=pool.filter(x=>x!==p);}
 return ['# Distribution status','',`Generated: ${now.toISOString()}`,'',
  `Eligible English game pages: ${inv.pages.length}. Published: ${published.length}. Remaining: ${remaining.length}.`,
  `Current reviewed adaptations: ${inv.pages.filter(p=>p.articleReady).length}. Awaiting editorial adaptation or source review: ${inv.pages.filter(p=>!p.articleReady).length}.`,'',
  'The inventory comes from the production sitemap registries. General file utilities, hubs, policy and noindex application routes are excluded. Inventory eligibility does not imply a reviewed external article. An exhausted reviewed queue stops without publishing filler.','',
  '## Next candidates','',...next.map(p=>`- [${p.title}](${p.canonical}) — ${p.priorityReason}; ${p.topicCluster}.`),'',
  '## Publication history','',...(published.length?published.map(e=>`- ${e.sourceRoute} — ${e.publishedAt} — ${e.externalUrl}`):['No recorded publications.']),'',
  '## Failed or uncertain attempts','',...(failed.length?failed.map(e=>`- ${e.sourceRoute}: ${e.status}; ${e.error||'Reconciliation required'}`):['None recorded.']),'',
  '## Operator setup','',
  '- DEV.to: adapter implemented; requires DEVTO_API_KEY and manual draft review. This report does not inspect or assert credential availability.',
  '- Public mode additionally requires DISTRIBUTION_PUBLISH=true. Schedule defaults to local dry-run.',
  '- itch.io, AlternativeTo, Product Hunt: manual launch kits prepared; listings not submitted.',
  '- See README.md for the durable distribution-state branch, cadence and recovery procedure.',''].join('\n');
}
