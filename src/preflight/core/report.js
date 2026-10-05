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
/** Self-contained, escaped, printable HTML; no application scripts, remote assets or setup upload.
 * @param {import('./types').PreflightResult} result @param {string} [locale] */
export function exportCompatibilityReport(result,locale='en'){
 const e=escapeHTML,t=(/** @type {string} */ k)=>e(text(locale,k));
 const rows=result.components.map(c=>'<tr><td>'+e(c.component.name)+'</td><td>'+e(c.component.version||'?')+'</td><td>'+e(c.recommendedVersion||'?')+'</td><td>'+e(c.status)+(c.component.ignored?' (excluded)':'')+'</td><td>'+e(c.confidence)+'</td><td>'+c.reasons.map(r=>e(reasonText(locale,r))).join('<br>')+'</td></tr>').join('');
 const details=result.components.map(c=>'<section><h2>'+e(c.component.name)+' — '+e(c.status)+'</h2><p>'+c.reasons.map(r=>e(reasonText(locale,r))).join('<br>')+'</p><h3>'+t('requiredAction')+'</h3><ul>'+c.actions.map(a=>'<li>'+e(a)+'</li>').join('')+'</ul><h3>'+t('knownIssues')+'</h3><ul>'+c.knownIssues.map(a=>'<li>'+e(a)+'</li>').join('')+'</ul><h3>'+t('dependencies')+'</h3><ul>'+c.dependencyResults.map(d=>'<li>'+e(d.componentId)+' — '+e(d.status)+'</li>').join('')+'</ul><h3>'+t('evidence')+'</h3>'+c.evidence.map(ev=>'<p><b>'+e(ev.sourceType)+' · '+e(ev.title)+'</b><br>'+e(ev.quoteSummary)+(ev.url?'<br><a href="'+e(safeLink(ev.url))+'">'+e(ev.url)+'</a>':'')+'<br>'+t('lastVerified')+': '+e(ev.checkedAt)+'</p>').join('')+'<p>'+t('lastVerified')+': '+e(c.lastVerifiedAt||'?')+'</p></section>').join('');
 return '<!doctype html><html lang="'+e(locale)+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Nerulio Preflight report</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 20px;color:#15171a}table{border-collapse:collapse;width:100%;font-size:12px}td,th{text-align:left;border-bottom:1px solid #bbb;padding:10px;overflow-wrap:anywhere}section{border-top:1px solid #aaa;margin-top:24px;break-inside:avoid}a{overflow-wrap:anywhere;color:#315d06}pre{white-space:pre-wrap}@media print{body{margin:0;padding:0}thead{display:table-header-group}}</style></head><body><h1>Nerulio Preflight — '+e(result.overallVerdict)+'</h1>'+
  (result.sample?'<p><strong>'+t('sampleWarning')+'</strong></p>':'')+'<pre>'+e(copySummary(result,locale))+'</pre><table><thead><tr>'+['name','installed','recommended','status','confidence','reason'].map(k=>'<th>'+t(k)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table>'+details+'</body></html>';
}
