// @ts-check
import {escapeHTML as e,safeLink,recommendationText} from '../core/report.js';
import {text,reasonText} from '../messages.js';
import {TILE_FILTER} from '../core/filters.js';
/** @param {string} status */
export function statusIcon(status){return document.querySelector('#pf-icon-'+status)?.innerHTML||'';}
/** @param {string} status @param {string} locale @param {boolean} [big] */
export function statusBadge(status,locale,big=false){
 return '<span class="pf-status '+e(status)+(big?' pf-big-status':'')+'">'+statusIcon(status)+(big?e(status):e(text(locale,'status.'+status)))+'</span>';
}
/** @param {import('../core/types').PreflightResult} result @param {string} locale */
export function verdictHTML(result,locale){
 const t=(/** @type {string} */ k,/** @type {Record<string,string|number>} */ p={})=>e(text(locale,k,p));
 const counts=result.counts;
 const summary=[['READY',counts.READY],['UPDATE_REQUIRED',counts.UPDATE_REQUIRED],['CAUTION',counts.CAUTION+counts.LEGACY+counts.DEPRECATED],['UNKNOWN',counts.UNKNOWN],['BLOCKED',counts.BLOCKED]];
 return '<div class="pf-verdict">'+(result.sample?'<p class="pf-sample-label" title="'+t('sampleWarning')+'">SAMPLE DATA</p>':'')+'<div class="pf-route">'+e(result.environment.host.name)+' '+e(result.environment.host.version)+' <span>→</span> '+e(result.target.version)+'</div>'+
  statusBadge(result.overallVerdict,locale,true)+'<h3>'+t('verdict.'+result.overallVerdict)+'</h3>'+
  '<div class="pf-confidence" title="'+t('confidenceHelp')+'">'+t('confidence')+' <b>'+t('confidence.'+result.confidence)+'</b> · '+e(result.target.platform)+' / '+e(result.target.architecture)+'</div>'+
  '<ul>'+result.reasons.map(r=>'<li>'+e(reasonText(locale,r))+'</li>').join('')+'</ul></div>'+
  '<p class="pf-count-title">'+t('checked',{count:result.components.length})+'</p><div class="pf-summary">'+summary.map(([s,n])=>'<button type="button" data-tile="'+e(TILE_FILTER[String(s)])+'"'+(n?'':' disabled')+' aria-label="'+t('tileFilter',{status:text(locale,'status.'+s),count:n})+'"><strong>'+n+'</strong>'+statusBadge(String(s),locale)+'</button>').join('')+'</div>'+
  (counts.NOT_APPLICABLE?'<p class="pf-muted">'+counts.NOT_APPLICABLE+' '+t('status.NOT_APPLICABLE')+'</p>':'')+
  '<p class="pf-muted">'+t('risk',{score:result.risk.score})+'</p>';
}
/** @param {import('../core/types').PreflightResult} result @param {string} locale */
export function actionsHTML(result,locale){
 const list=(/** @type {import('../core/types').PreflightRecommendation[]} */ items,start=1)=>'<ol start="'+start+'">'+items.map(r=>'<li>'+e(recommendationText(r,locale))+
  '<span>'+e(text(locale,'kind.'+r.kind))+(r.evidence[0]?.url?' <a class="pf-evidence-link" target="_blank" rel="noopener noreferrer" href="'+e(safeLink(r.evidence[0].url))+'">'+e(text(locale,'evidence'))+' ↗</a>':'')+'</span></li>').join('')+'</ol>';
 const before=result.recommendations.filter(r=>r.phase==='before'),rest=result.recommendations.filter(r=>r.phase!=='before');
 return '<div class="pf-actions"><h2>'+e(text(locale,'before'))+'</h2>'+list(before.slice(0,6))+
  (before.length>6?'<details><summary>'+e(text(locale,'order'))+' ('+result.recommendations.length+')</summary>'+list([...before.slice(6),...rest],7)+'</details>':'<details><summary>'+e(text(locale,'order'))+'</summary>'+list(rest,before.length+1)+'</details>')+'</div>';
}
/** @param {import('../core/types').CompatibilityResult[]} components @param {string} locale @param {Map<string,string|null>} [changes] status in the previous recorded run, for changed components */
export function tableHTML(components,locale,changes=new Map()){
 // data-label feeds the stacked card layout used on narrow screens, where the header row is hidden.
 const cell=(/** @type {string} */ key)=>'</td><td data-label="'+e(text(locale,key))+'">';
 return components.map(c=>{
  const id=c.component.id;
  const mainReason=c.reasons.find(r=>['inventoryMismatch','obsPathBlocked','obsBuiltNewer','breakingChange','runtimeRequirement','missingDependency','dependencyStatus','minimumVersion','missingComponentVersion','beyondTested','obsLegacy'].includes(r.code))||c.reasons[0]||{code:'noRecord'};
  return '<tr data-component="'+e(id)+'"><td><button type="button" class="pf-component-button" data-detail="'+e(id)+'" aria-expanded="false" aria-controls="pf-detail-'+e(id)+'">'+e(c.component.name)+'</button>'+
   '<span class="pf-row-meta">'+e(c.component.vendor||c.component.category)+' · '+e(c.component.category)+'</span>'+
   (c.sample?'<span class="pf-row-meta">SAMPLE DATA</span>':'')+(c.component.ignored?'<span class="pf-row-meta">'+e(text(locale,'excludedLabel'))+'</span>':'')+
   cell('installed')+e(c.component.version||'—')+cell('recommended')+e(c.recommendedVersion||'—')+cell('status')+statusBadge(c.status,locale)+
   (c.status!=='LEGACY'&&c.reasons.some(r=>r.code==='obsLegacy')?'<span class="pf-row-meta">'+statusBadge('LEGACY',locale)+'</span>':'')+
   (c.stale?'<span class="pf-row-meta">'+e(text(locale,'warning'))+'</span>':'')+
   (changes.has(id)?'<span class="pf-row-meta pf-changed">'+e(changes.get(id)?text(locale,'previousStatus',{status:text(locale,'status.'+changes.get(id))}):text(locale,'previousNew'))+'</span>':'')+cell('confidence')+e(text(locale,'confidence.'+c.confidence))+
   cell('reason')+e(reasonText(locale,mainReason))+'<br><button class="pf-component-button pf-row-meta" type="button" data-detail="'+e(id)+'" aria-expanded="false" aria-controls="pf-detail-'+e(id)+'">'+e(text(locale,'detail'))+'</button></td></tr>'+
   '<tr class="pf-row-detail" id="pf-detail-'+e(id)+'" hidden><td colspan="6"></td></tr>';
 }).join('');
}
/** @param {import('../core/types').CompatibilityResult} c @param {import('../core/types').CatalogEntry|undefined} catalog @param {string} locale */
export function detailHTML(c,catalog,locale){
 const t=(/** @type {string} */ k)=>e(text(locale,k));
 const list=(/** @type {string[]} */ rows)=>'<ul>'+rows.map(r=>'<li>'+e(r)+'</li>').join('')+'</ul>';
 return '<div class="pf-detail"><div class="pf-detail-grid"><div><h3>'+t('reason')+'</h3>'+statusBadge(c.status,locale)+
  list(c.reasons.map(r=>reasonText(locale,r)))+'<dl><dt>ID</dt><dd>'+e(c.component.id)+'</dd><dt>'+t('installed')+'</dt><dd>'+e(c.component.version||'—')+
  '</dd><dt>'+t('recommended')+'</dt><dd>'+e(c.recommendedVersion||'—')+'</dd><dt>Minimum</dt><dd>'+e(c.minimumVersion||'—')+
  '</dd><dt>Maximum tested</dt><dd>'+e(c.maximumTestedVersion||'—')+'</dd><dt>'+t('lastVerified')+'</dt><dd>'+e(c.lastVerifiedAt||'—')+
  '</dd><dt>'+t('confidence')+'</dt><dd>'+t('confidence.'+c.confidence)+'</dd></dl><h3>'+t('requiredAction')+'</h3>'+list(c.actions)+
  '<h3>'+t('knownIssues')+'</h3>'+list(c.knownIssues)+
  '<h3>'+t('dependencies')+'</h3><ul>'+c.dependencyResults.map(d=>'<li><button type="button" data-dependency="'+e(d.componentId)+'">'+e(d.componentId)+' → '+e(d.status)+'</button></li>').join('')+'</ul>'+
  '<label class="pf-check"><input type="checkbox" data-ignore="'+e(c.component.id)+'"'+(c.component.ignored?' checked':'')+'>'+t('ignore')+'</label>'+
  '<p class="pf-muted">'+t('excludedLabel')+'</p></div><div><h3>'+t('evidence')+'</h3>'+
  (c.evidence.length?c.evidence.map(ev=>'<div class="pf-evidence"><strong>'+e(ev.sourceType==='sample'?'SAMPLE DATA':ev.sourceType)+' · '+
   (ev.url?'<a href="'+e(safeLink(ev.url))+'" target="_blank" rel="noopener noreferrer">'+e(ev.title)+' ↗</a>':e(ev.title))+'</strong><p>'+e(ev.quoteSummary)+
   '</p><small>'+t('lastVerified')+': '+e(ev.checkedAt)+(ev.sourcePublishedAt?' · Published '+e(ev.sourcePublishedAt):'')+
   (ev.sourceUpdatedAt?' · Updated '+e(ev.sourceUpdatedAt):'')+'</small></div>').join(''):'<p>'+t('noEvidence')+'</p>')+
  (catalog?.vendorUrl?'<p><a href="'+e(safeLink(catalog.vendorUrl))+'" target="_blank" rel="noopener noreferrer">'+t('vendorCheck')+' ↗</a></p>':'')+
  '<p><a href="https://www.google.com/search?q='+encodeURIComponent(c.component.name+' '+c.component.version+' compatibility')+'" target="_blank" rel="noopener noreferrer">'+t('communityCheck')+' ↗</a></p></div></div></div>';
}
/** @param {import('../storage/history.js').RunSnapshot[]} runs newest first @param {string} locale @param {(older:import('../storage/history.js').RunSnapshot,newer:import('../storage/history.js').RunSnapshot)=>ReturnType<typeof import('../storage/history.js').diffRuns>} diff @param {number} componentLimit */
export function historyHTML(runs,locale,diff,componentLimit){
 const t=(/** @type {string} */ k,/** @type {Record<string,string|number>} */ p={})=>e(text(locale,k,p));
 if(!runs.length)return '<p class="pf-muted">'+t('historyEmpty')+'</p>';
 const when=(/** @type {string} */ at)=>{const d=new Date(at);return Number.isNaN(d.getTime())?at:d.toLocaleString(locale,{dateStyle:'medium',timeStyle:'short'});};
 const label=(/** @type {string|null} */ s,/** @type {string} */ none)=>s?statusBadge(s,locale):'<span class="pf-row-meta">'+t(none)+'</span>';
 return '<ol class="pf-history-list">'+runs.map((run,i)=>{
  const older=runs[i+1],d=older?diff(older,run):null;
  return '<li><div class="pf-history-head"><time datetime="'+e(run.at)+'">'+e(when(run.at))+'</time>'+(run.sample?'<span class="pf-sample-label">SAMPLE DATA</span>':'')+'</div>'+
   '<p class="pf-history-route">'+e(run.from||'?')+' → '+e(run.to||'?')+' <span class="pf-row-meta">'+e(run.platform)+' / '+e(run.architecture)+' · '+e(run.name)+'</span></p>'+
   '<p>'+statusBadge(run.verdict,locale,true)+' <span class="pf-row-meta">'+t('checked',{count:run.total})+' — '+Object.entries(run.counts).map(([s,n])=>e(text(locale,'status.'+s))+' '+e(n)).join(' · ')+'</span></p>'+
   (d?(d.changes.length?'<details'+(i===0?' open':'')+'><summary>'+t('historyChanges',{count:d.changes.length})+'</summary><ul>'+d.changes.slice(0,20).map(c=>'<li><b>'+e(c.name)+'</b> '+label(c.before,'historyAdded')+' → '+label(c.after,'historyRemoved')+'</li>').join('')+
     (d.changes.length>20?'<li class="pf-muted">'+t('historyMore',{count:d.changes.length-20})+'</li>':'')+'</ul></details>':'<p class="pf-muted">'+t('historyNoChanges')+'</p>')+
    (d.targetChanged?'<p class="pf-muted">'+t('historyTarget')+'</p>':'')+(d.partial?'<p class="pf-muted">'+t('historyPartial',{components:componentLimit})+'</p>':''):'<p class="pf-muted">'+t('historyFirst')+'</p>')+'</li>';
 }).join('')+'</ol>';
}
