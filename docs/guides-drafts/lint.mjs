// Lints every registered guide: renderer problems, structure parity, word counts.
const W='file:///C:/Users/2009s/Desktop/SITE/.claude/worktrees/agent-aef499f5f486793c5/';
const {GUIDES}=await import(W+'src/guides.js');
const {renderGuide,wordCount}=await import(W+'tools/guides-build.mjs');
for(const g of GUIDES){
 const r=Object.fromEntries(['en','ko','ja'].map(l=>[l,renderGuide(g.slug,l)]));
 const probs=Object.entries(r).flatMap(([l,x])=>x.problems.filter(p=>!p.startsWith('unknown guide link')).map(p=>l+': '+p));
 const same=['ko','ja'].every(l=>JSON.stringify(r[l].toc.map(t=>t.id))===JSON.stringify(r.en.toc.map(t=>t.id))&&r[l].steps.length===r.en.steps.length&&r[l].faq.length===r.en.faq.length);
 console.log(g.slug.padEnd(42),'en',wordCount(r.en.text,'en'),'ko',wordCount(r.ko.text,'ko'),'ja',wordCount(r.ja.text,'ja'),'faq',r.en.faq.length,'steps',r.en.steps.length,'img',r.en.images.length,same?'':'STRUCTURE DIFFERS',probs.length?'\n   '+probs.join('\n   '):'');
}
