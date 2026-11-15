// @ts-check
import {text,reasonText} from '../messages.js';
/** @param {unknown} value */
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>/** @type {Record<string,string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
/** @param {string|undefined} value */
export function safeLink(value){try{const u=new URL(value||'');return u.protocol==='https:'&&!u.username&&!u.password?u.href:'#';}catch{return '#';}}
/** @param {import('./types').PreflightRecommendation} r @param {string} locale */
export const recommendationText=(r,locale)=>r.reason?reasonText(locale,r.reason):text(locale,r.text);
/** @param {import('./types').PreflightResult} result @param {string} [locale] */
export function copySummary(result,locale='en'){
 return [
  'Nerulio Preflight'+(result.sample?' — SAMPLE DATA':''),
  result.environment.host.name+' '+result.environment.host.version+' → '+result.target.version,
  result.target.platform+' / '+result.target.architecture,
  result.overallVerdict+' — '+text(locale,'verdict.'+result.overallVerdict),
  text(locale,'confidence')+': '+text(locale,'confidence.'+result.confidence),
  text(locale,'checked',{count:result.components.length}),
  Object.entries(result.counts).filter(([,n])=>n).map(([s,n])=>s+': '+n).join(' · '),
  ...result.reasons.map(r=>'• '+reasonText(locale,r)),
  text(locale,'before')+':',
  ...result.recommendations.map((r,i)=>(i+1)+'. ['+text(locale,'kind.'+r.kind)+'] '+recommendationText(r,locale)),
  result.generatedAt+' · Engine '+result.engineVersion,
 ].join('\n');
}
/** Environment is the input contract. Consumers must recompute the informational report.
 * @param {import('./types').PreflightResult} result */
export function exportJSON(result){const {environment,...report}=result;return JSON.stringify({schemaVersion:1,kind:'nerulio-preflight-report',environment,report},null,2);}
/** Status / verdict → colour tone used by the exported and printed report (text labels are always present too). */
const TONE=/** @type {Record<string,string>} */({READY:'ok',UPDATE_REQUIRED:'warn',CAUTION:'warn',LEGACY:'warn',DEPRECATED:'warn',WAIT:'warn',BLOCKED:'bad',UNKNOWN:'unk',NOT_APPLICABLE:'unk'});
/** Shared by the standalone export and, scoped under .pf-print-full, by preflight.css for in-page printing. */
export const REPORT_CSS='.pfr-card{border:1px solid #999;border-radius:8px;padding:16px 18px;margin:16px 0;break-inside:avoid}.pfr-route{font:600 15px ui-monospace,monospace;margin:0 0 10px;overflow-wrap:anywhere}.pfr-verdict{font-size:17px;margin:0 0 12px;padding:8px 12px;border-left:6px solid}.pfr-verdict strong{letter-spacing:.04em;margin-right:8px}.pfr-tiles{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.pfr-tiles div{border:1px solid;border-radius:6px;padding:6px 12px;min-width:92px}.pfr-tiles strong{display:block;font:600 20px ui-monospace,monospace}.pfr-tiles span{font-size:12px}.pfr-ok{color:#1d5a12}.pfr-warn{color:#7a4a00}.pfr-bad{color:#a11212}.pfr-unk{color:#4a4f57}.pfr-status{font-weight:700}.pfr-card ul{margin:8px 0 0;padding-left:20px}.pfr-actions li{margin:6px 0}.pfr-actions small{color:#555}.pfr-foot{color:#555;font-size:12px;margin-top:24px}';
/** Self-contained, escaped, printable HTML; no application scripts, remote assets or setup upload.
 * Opens with a scorecard (route, verdict, status counts, reasons) and the action list, followed by every component and its evidence.
 * @param {import('./types').PreflightResult} result @param {string} [locale] */
export function exportCompatibilityReport(result,locale='en'){
 const e=escapeHTML,t=(/** @type {string} */ k,/** @type {Record<string,string|number>} */ p={})=>e(text(locale,k,p)),tone=(/** @type {string} */ s)=>'pfr-'+(TONE[s]||'unk');
 const status=(/** @type {string} */ s)=>'<span class="pfr-status '+tone(s)+'">'+t('status.'+s)+'</span>';
 const rows=result.components.map(c=>'<tr><td>'+e(c.component.name)+'</td><td>'+e(c.component.version||'?')+'</td><td>'+e(c.recommendedVersion||'?')+'</td><td>'+status(c.status)+(c.component.ignored?' ('+t('excludedLabel')+')':'')+'</td><td>'+t('confidence.'+c.confidence)+'</td><td>'+c.reasons.map(r=>e(reasonText(locale,r))).join('<br>')+'</td></tr>').join('');
 const details=result.components.map(c=>'<section><h2>'+e(c.component.name)+' — '+status(c.status)+'</h2><p>'+c.reasons.map(r=>e(reasonText(locale,r))).join('<br>')+'</p><h3>'+t('requiredAction')+'</h3><ul>'+c.actions.map(a=>'<li>'+e(a)+'</li>').join('')+'</ul><h3>'+t('knownIssues')+'</h3><ul>'+c.knownIssues.map(a=>'<li>'+e(a)+'</li>').join('')+'</ul><h3>'+t('dependencies')+'</h3><ul>'+c.dependencyResults.map(d=>'<li>'+e(d.componentId)+' — '+e(d.status)+'</li>').join('')+'</ul><h3>'+t('evidence')+'</h3>'+c.evidence.map(ev=>'<p><b>'+e(ev.sourceType)+' · '+e(ev.title)+'</b><br>'+e(ev.quoteSummary)+(ev.url?'<br><a href="'+e(safeLink(ev.url))+'">'+e(ev.url)+'</a>':'')+'<br>'+t('lastVerified')+': '+e(ev.checkedAt)+'</p>').join('')+'<p>'+t('lastVerified')+': '+e(c.lastVerifiedAt||'?')+'</p></section>').join('');
 const scorecard='<div class="pfr-card"><p class="pfr-route">'+e(result.environment.host.name)+' '+e(result.environment.host.version)+' → '+e(result.target.version)+' · '+e(result.target.platform)+' / '+e(result.target.architecture)+'</p>'+
  '<p class="pfr-verdict '+tone(result.overallVerdict)+'"><strong>'+e(result.overallVerdict)+'</strong>'+t('verdict.'+result.overallVerdict)+'</p>'+
  '<div class="pfr-tiles">'+Object.entries(result.counts).filter(([,n])=>n).map(([s,n])=>'<div class="'+tone(s)+'"><strong>'+e(n)+'</strong><span>'+t('status.'+s)+'</span></div>').join('')+'</div>'+
  '<p>'+t('checked',{count:result.components.length})+' · '+t('confidence')+': '+t('confidence.'+result.confidence)+' · '+t('risk',{score:result.risk.score})+'</p>'+
  '<ul>'+result.reasons.map(r=>'<li>'+e(reasonText(locale,r))+'</li>').join('')+'</ul></div>';
 const actions='<h2>'+t('before')+'</h2><ol class="pfr-actions">'+result.recommendations.map(r=>{const url=safeLink(r.evidence[0]?.url);
  return '<li>'+e(recommendationText(r,locale))+' <small>'+t('kind.'+r.kind)+'</small>'+(url==='#'?'':' <a href="'+e(url)+'">'+t('evidence')+'</a>')+'</li>';}).join('')+'</ol>';
 return '<!doctype html><html lang="'+e(locale)+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Nerulio Preflight report</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 20px;color:#15171a}table{border-collapse:collapse;width:100%;font-size:12px}td,th{text-align:left;border-bottom:1px solid #bbb;padding:10px;overflow-wrap:anywhere;vertical-align:top}section{border-top:1px solid #aaa;margin-top:24px;break-inside:avoid}a{overflow-wrap:anywhere;color:#315d06}'+REPORT_CSS+'@page{margin:14mm}@media print{body{margin:0;padding:0;max-width:none}thead{display:table-header-group}tr{break-inside:avoid}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><h1>Nerulio Preflight — '+e(result.overallVerdict)+'</h1>'+
  (result.sample?'<p><strong>'+t('sampleWarning')+'</strong></p>':'')+scorecard+actions+'<h2>'+t('report')+'</h2><table><thead><tr>'+['name','installed','recommended','status','confidence','reason'].map(k=>'<th>'+t(k)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>'+details+
  '<p class="pfr-foot">'+e(result.generatedAt)+' · Engine '+e(result.engineVersion)+'</p></body></html>';
}
export const MARKDOWN_ROW_LIMIT=200;
/** Inventory text is untrusted: collapse line breaks and escape Markdown table / link / HTML syntax.
 * @param {unknown} value */
export const escapeMarkdown=value=>String(value??'').replace(/\s+/g,' ').trim().replace(/([\\|`*_[\]<>])/g,'\\$1');
/** GitHub-flavoured Markdown for issues, wikis and chat. Problems are listed first; long inventories are truncated with a stated limit.
 * @param {import('./types').PreflightResult} result @param {string} [locale] */
export function markdownReport(result,locale='en'){
 const m=escapeMarkdown,t=(/** @type {string} */ k,/** @type {Record<string,string|number>} */ p={})=>text(locale,k,p);
 const ok=(/** @type {string} */ s)=>s==='READY'||s==='NOT_APPLICABLE';
 const ordered=[...result.components.filter(c=>!ok(c.status)),...result.components.filter(c=>ok(c.status))],shown=ordered.slice(0,MARKDOWN_ROW_LIMIT);
 const link=(/** @type {import('./types').PreflightRecommendation} */ r)=>{const url=safeLink(r.evidence[0]?.url);return url==='#'?'':' ([↗]('+url.replace(/[()]/g,c=>'%'+c.charCodeAt(0).toString(16))+'))';};
 return [
  '# Nerulio Preflight'+(result.sample?' — SAMPLE DATA':''),'',
  '**'+m(result.environment.host.name)+' '+m(result.environment.host.version)+' → '+m(result.target.version)+'** · '+m(result.target.platform)+' / '+m(result.target.architecture),'',
  '**'+result.overallVerdict+'** — '+m(t('verdict.'+result.overallVerdict)),'',
  ...(result.sample?['> '+m(t('sampleWarning')),'']:[]),
  '- '+m(t('confidence'))+': '+m(t('confidence.'+result.confidence)),
  '- '+m(t('checked',{count:result.components.length}))+(Object.values(result.counts).some(Boolean)?' — '+Object.entries(result.counts).filter(([,n])=>n).map(([s,n])=>m(t('status.'+s))+' '+n).join(' · '):''),
  '- '+m(t('risk',{score:result.risk.score})),
  ...result.reasons.map(r=>'- '+m(reasonText(locale,r))),'',
  '## '+m(t('before')),'',
  ...result.recommendations.map(r=>'- [ ] '+m(recommendationText(r,locale))+' _('+m(t('kind.'+r.kind))+')_'+link(r)),'',
  '## '+m(t('report')),'',
  '| '+['name','installed','recommended','status','confidence','reason'].map(k=>m(t(k))).join(' | ')+' |','| --- | --- | --- | --- | --- | --- |',
  ...shown.map(c=>'| '+[m(c.component.name),m(c.component.version||'—'),m(c.recommendedVersion||'—'),m(t('status.'+c.status))+(c.component.ignored?' ('+m(t('excludedLabel'))+')':''),
   m(t('confidence.'+c.confidence)),c.reasons.map(r=>m(reasonText(locale,r))).join('; ')||'—'].join(' | ')+' |'),
  ...(ordered.length>shown.length?['',m(t('markdownMore',{shown:shown.length,count:ordered.length}))]:[]),'',
  '_'+m(result.generatedAt)+' · Engine '+m(result.engineVersion)+'_',
 ].join('\n');
}
