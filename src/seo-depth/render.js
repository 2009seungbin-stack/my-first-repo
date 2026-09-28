/** Renderer of the intent content model (src/seo-depth/*.js, docs/SEO-CONTENT-MODEL.md). Static
 * HTML only: the build calls it for the game landings (tools/game-landing-build.mjs) and the file
 * tools (src/content.js, which the browser also runs for the language switch), so it is
 * dependency-free. Every section renders only when the page has it; the headings are the page's
 * own when it gives one, else the defaults below.
 *
 * Inline markup in prose and table cells (nothing else is interpreted; the rest is escaped):
 *   `code`            → <code>code</code>
 *   [[key|label]]     → a link to another page of the site (key = its canonical path, e.g.
 *                       game/godot-sprite-sheet or sprite-slicer). Unknown keys throw at build time.
 *   [label](https://…) → an external link (official documentation); https only. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DEPTH_UI=Object.freeze({
 answer:{en:'Short answer',ko:'핵심 답변',ja:'要点'},
 concept:{en:'How it works',ko:'원리',ja:'仕組み'},
 example:{en:'Worked example',ko:'예시',ja:'具体例'},
 mapping:{en:'What maps to what',ko:'무엇이 어디로 옮겨지나',ja:'何がどこに対応するか'},
 outputs:{en:'Files you get',ko:'받게 되는 파일',ja:'出力されるファイル'},
 file:{en:'File',ko:'파일',ja:'ファイル'},
 contents:{en:'What it is for',ko:'용도',ja:'用途'},
 target:{en:'Use it in the engine',ko:'엔진에서 쓰기',ja:'エンジンで使う'},
 verify:{en:'Check the result',ko:'결과 확인',ja:'結果の確認'},
 trouble:{en:'Troubleshooting',ko:'문제 해결',ja:'トラブルシューティング'},
 symptom:{en:'Symptom',ko:'증상',ja:'症状'},
 cause:{en:'Likely cause',ko:'유력한 원인',ja:'考えられる原因'},
 check:{en:'How to check',ko:'확인 방법',ja:'確認方法'},
 fix:{en:'Fix',ko:'해결',ja:'対処'},
 alternatives:{en:'Other ways to do it',ko:'다른 방법',ja:'ほかの方法'},
 option:{en:'Option',ko:'방법',ja:'方法'},
 when:{en:'When it is the better choice',ko:'이럴 때 더 낫습니다',ja:'こんなときに向いています'},
 limits:{en:'What this page does not cover',ko:'이 방법의 한계',ja:'この方法の限界'},
 versions:{en:'Versions and sources',ko:'버전과 출처',ja:'バージョンと出典'},
 sources:{en:'Official documentation used',ko:'참고한 공식 문서',ja:'参照した公式ドキュメント'}
});
/** The section ids in page order, and where each sits relative to the page's existing parts:
 * `lead` sections come before "What it does", `after-how` follow the Nerulio steps, `after-table`
 * follow the page's own table, `end` close the reading part before the FAQ. */
export const DEPTH_ORDER=Object.freeze([
 ['concept','lead'],['example','lead'],['mapping','lead'],
 ['outputs','after-how'],['target','after-how'],['verify','after-how'],
 ['trouble','after-table'],['alternatives','after-table'],
 ['limits','end'],['versions','end']
]);
/** Inline markup → HTML. `resolve(key)` returns the site-relative route of a page or null. */
export function inline(text,{prefix='',resolve=()=>null}={}){
 const parts=[];let rest=String(text),m;
 const re=/`([^`]+)`|\[\[([^|\]]+)\|([^\]]+)\]\]|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/;
 while((m=re.exec(rest))){
  parts.push(esc(rest.slice(0,m.index)));
  if(m[1]!==undefined)parts.push(`<code>${esc(m[1])}</code>`);
  else if(m[2]!==undefined){const route=resolve(m[2].trim());if(route===null||route===undefined)throw Error(`seo-depth: unknown page link [[${m[2]}]]`);parts.push(`<a href="${esc(prefix+route)}/">${esc(m[3])}</a>`);}
  else parts.push(`<a href="${esc(m[5])}" rel="noopener">${esc(m[4])}</a>`);
  rest=rest.slice(m.index+m[0].length);
 }
 parts.push(esc(rest));return parts.join('');
}
/** Plain text of a string with inline markup (tests, structured data, similarity checks). */
export const plain=s=>String(s).replace(/`([^`]+)`/g,'$1').replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g,'$1').replace(/\[([^\]]+)\]\(https:\/\/[^)\s]+\)/g,'$1');
/** Every page key a string links to with [[key|label]]. */
export const linksIn=s=>[...String(s).matchAll(/\[\[([^|\]]+)\|[^\]]+\]\]/g)].map(m=>m[1].trim());
const paras=(list,o)=>(Array.isArray(list)?list:[list]).filter(Boolean).map(p=>`<p>${inline(p,o)}</p>`).join('');
function table(head,rows,o,{cls='',codeFirst=false}={}){
 return `<div class="gl-table-wrap sd-table-wrap"><table class="gl-table sd-table${cls?' '+cls:''}"><thead><tr>${head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${codeFirst?`<code>${esc(r[0])}</code>`:inline(r[0],o)}</th>${r.slice(1).map((x,i)=>`<td data-label="${esc(head[i+1]||'')}">${inline(x,o)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const title=(block,id,locale)=>block?.title||DEPTH_UI[id][locale];
/** HTML of one section of a page's locale copy `d`, or '' when the page has none. */
export function depthSection(id,d,locale,o={},sectionClass='gl-section'){
 const b=d?.[id];if(!b||(Array.isArray(b)&&!b.length))return '';
 const open=h=>`<section class="${sectionClass} sd-section sd-${id}" id="${id}"><h2>${esc(h)}</h2>`,U=k=>DEPTH_UI[k][locale];
 switch(id){
  case 'concept':return `${open(title(b,id,locale))}${paras(b.body,o)}${b.terms?.length?`<dl class="sd-terms">${b.terms.map(([t,v])=>`<dt>${inline(t,o)}</dt><dd>${inline(v,o)}</dd>`).join('')}</dl>`:''}</section>`;
  case 'example':return `${open(title(b,id,locale))}${paras(b.lead,o)}${b.lines?.length?`<pre class="sd-calc"><code>${esc(b.lines.join('\n'))}</code></pre>`:''}${paras(b.after,o)}</section>`;
  case 'mapping':return `${open(title(b,id,locale))}${paras(b.lead,o)}${table(b.head,b.rows,o)}${paras(b.note,o)}</section>`;
  case 'outputs':return `${open(title(b,id,locale))}${paras(b.lead,o)}${table([U('file'),U('contents')],b.rows,o,{codeFirst:true})}</section>`;
  case 'target':return `${open(title(b,id,locale))}${paras(b.lead,o)}<ol class="gl-steps sd-steps">${b.steps.map(s=>`<li>${inline(s,o)}</li>`).join('')}</ol>${paras(b.note,o)}</section>`;
  case 'verify':return `${open(title(b,id,locale))}${paras(b.lead,o)}<ul class="sd-checks">${b.steps.map(s=>`<li>${inline(s,o)}</li>`).join('')}</ul></section>`;
  case 'trouble':return `${open(title(b,id,locale))}${paras(b.lead,o)}${table([U('symptom'),U('cause'),U('check'),U('fix')],b.rows,o,{cls:'sd-trouble'})}</section>`;
  case 'alternatives':return `${open(title(b,id,locale))}${paras(b.lead,o)}${table([U('option'),U('when')],b.rows,o)}</section>`;
  case 'limits':return `${open(title(b,id,locale))}<ul class="gl-limits sd-limits">${(b.items||b).map(s=>`<li>${inline(s,o)}</li>`).join('')}</ul></section>`;
  case 'versions':return `${open(title(b,id,locale))}${paras(b.body,o)}${b.sources?.length?`<h3>${esc(U('sources'))}</h3><ul class="sd-sources">${b.sources.map(s=>`<li>${inline(s,o)}</li>`).join('')}</ul>`:''}</section>`;
 }
 throw Error('seo-depth: unknown section '+id);
}
/** The short answer shown under the H1. */
export const answerHTML=(d,o={})=>d?.answer?`<p class="sd-answer">${inline(d.answer,o)}</p>`:'';
/** [[id,label,html]] of every section a page has at `slot`, in page order. */
export function depthSlot(slot,d,locale,o={},sectionClass='gl-section'){
 return DEPTH_ORDER.filter(([,s])=>s===slot).map(([id])=>[id,title(d?.[id],id,locale),depthSection(id,d,locale,o,sectionClass)]).filter(([, ,h])=>h);
}
