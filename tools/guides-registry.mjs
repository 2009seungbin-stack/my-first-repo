/** The how-to guides registry (src/guides.js, branch nerulio/game-guides) as far as the SEO build
 * needs it: sitemap-guides.xml, and links from game landings and the /game/ hub to the guides
 * about the same job. Until that module exists the lists are empty, so both branches merge in any
 * order. Contract used here: GUIDES[{slug, tools:[intent ids], open:{ws}|{tool}, title:{ko,en,ja},
 * description:{ko,en,ja}, updated}], GUIDE_ROUTES, guideLastmod(route), guidePath(slug). */
let mod={};
try{mod=await import('../src/guides.js');}catch(e){if(e?.code!=='ERR_MODULE_NOT_FOUND')throw e;}
export const GUIDES=Object.freeze([...(mod.GUIDES||[])]);
export const GUIDE_ROUTES=Object.freeze([...(mod.GUIDE_ROUTES||[])]);
export const guideLastmod=route=>mod.guideLastmod?.(route)||null;
export const guidePath=slug=>mod.guidePath?mod.guidePath(slug):`guides/${slug}`;
/** Guides about an intent or a Studio workspace, most specific first. */
export function guidesFor({id,ws}={}){
 const byTool=GUIDES.filter(g=>id&&(g.tools||[]).includes(id)||id&&g.open?.tool===id);
 const byWs=GUIDES.filter(g=>ws&&g.open?.ws===ws&&!byTool.includes(g));
 return [...byTool,...byWs];
}
