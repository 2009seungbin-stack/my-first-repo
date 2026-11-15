import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {policyContent,policyAnchor,policies,POLICY_ROUTES,COMMUNITY_PRIVACY_NOTE,toolFamilyCounts,aboutFamilies,reportTemplate,REPORT_COPY,ISSUES_URL} from '../src/policies.js';
import {INTENTS} from '../src/intents.js';
import {LOCALES} from '../src/i18n.js';

const anchors=html=>[...html.matchAll(/<h2 id="(sec-\d+)" tabindex="-1">([^<]*)<\/h2>/g)].map(m=>[m[1],m[2]]);
const contents=html=>[...(html.match(/<nav class="policy-toc"[\s\S]*?<\/nav>/)?.[0]||'').matchAll(/<a data-policy-anchor href="([^"#]*)#(sec-\d+)">([^<]*)<\/a>/g)].map(m=>[m[1],m[2],m[3]]);

test('every policy page lists each section once, in order, with a matching anchor',()=>{
 for(const locale of LOCALES)for(const page of POLICY_ROUTES){
  const html=policyContent(page,locale),heads=anchors(html),toc=contents(html);
  assert.equal(heads.length,policies[locale][page].length,`${locale}/${page}`);
  assert.deepEqual(heads.map(([id])=>id),heads.map((_,i)=>policyAnchor(i+1)));
  assert.deepEqual(toc.map(([,id,text])=>[id,text]),heads,`${locale}/${page} contents match headings`);
  // The page sets <base>, so a bare "#sec-1" would leave the page; links carry the route.
  for(const [route] of toc)assert.equal(route,`${locale}/${page}/`);
  assert.match(html,new RegExp(`<a data-policy-anchor href="${locale}/${page}/#policy-top">`));
  assert.match(html,/<h1 id="policy-top" tabindex="-1">/);
  assert.equal(new Set(heads.map(([id])=>id)).size,heads.length,'unique ids');
 }
});

test('reading aids do not alter the policy wording',()=>{
 for(const locale of LOCALES)for(const page of POLICY_ROUTES){
  const html=policyContent(page,locale);
  const paragraphs=[...html.matchAll(/<section><h2 id="sec-\d+" tabindex="-1">[^<]*<\/h2><p>([^<]*)<\/p><\/section>/g)].map(m=>m[1]);
  const unescape=s=>s.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
  assert.deepEqual(paragraphs.map(unescape),policies[locale][page].map(([,p])=>p),`${locale}/${page}`);
 }
});

test('former community sections continue the numbering after the main sections',()=>{
 for(const locale of LOCALES){
  const html=policyContent('privacy',locale,false,'accounts',false,true,true),heads=anchors(html),toc=contents(html);
  assert.equal(toc.length,heads.length);
  assert.equal(heads.length,toc.length);
  assert.equal((html.match(/<section class="community-privacy"><h2 id="sec-\d+"/g)||[]).length,COMMUNITY_PRIVACY_NOTE[locale].length);
  assert.deepEqual(heads.map(([id])=>id),heads.map((_,i)=>policyAnchor(i+1)));
  assert(html.indexOf('class="community-closed"')<html.indexOf('class="policy-toc"'),'closure notice stays first');
 }
});

test('the print control is inert without script and labelled in every language',()=>{
 const labels={en:'Print or save as PDF',ko:'인쇄 또는 PDF로 저장',ja:'印刷またはPDFで保存'};
 for(const locale of LOCALES){
  const html=policyContent('terms',locale);
  assert(html.includes(`<button type="button" class="policy-print" data-policy-print hidden>${labels[locale]}</button>`),locale);
 }
});

test('policy stylesheet keeps a print layout and the page script wires the controls',async()=>{
 const css=await readFile(new URL('../content.css',import.meta.url),'utf8');
 assert.match(css,/@media print\{[^@]*\.policy-toc[^@]*display:none/);
 assert.match(css,/\.policy-toc li a\{[^}]*padding:10px 0/);
 const js=await readFile(new URL('../src/policy-page.js',import.meta.url),'utf8');
 assert.match(js,/data-policy-print/);assert.match(js,/window\.print\(\)/);assert.match(js,/prefers-reduced-motion/);
});

test('About lists each tool family with the catalogue count and a route that is built',()=>{
 const counts=toolFamilyCounts(),total=Object.keys(INTENTS).filter(id=>!['home','image','pdf','media'].includes(id)).length;
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),total,'every catalogue tool is counted once');
 const routes=new Set(Object.values(INTENTS).map(intent=>intent.path+'/'));routes.add('game/');
 for(const locale of LOCALES){
  const html=aboutFamilies(locale),cards=[...html.matchAll(/<li><a href="([^"]+)"><strong>([^<]+)<\/strong><span class="about-family-count">([^<]+)<\/span><span>([^<]+)<\/span><span class="about-family-go">([^<]+) →<\/span><\/a><\/li>/g)];
  assert.equal(cards.length,4,locale);
  for(const [,href,,count] of cards){
   assert(href.startsWith(locale+'/')&&routes.has(href.slice(locale.length+1)),`${locale}: ${href}`);
   const family={'game/':'game','image/editor/':'image','pdf/editor/':'pdf','media/':'media'}[href.slice(locale.length+1)];
   assert(count.includes(String(counts[family])),`${locale}: ${family} shows ${counts[family]}`);
  }
  assert(policyContent('about',locale).includes(html),'rendered on About');
  for(const page of ['privacy','terms','contact'])assert(!policyContent(page,locale).includes('about-families'),page);
 }
});

test('Contact keeps the single public channel and offers a report outline in every language',()=>{
 for(const locale of LOCALES){
  const html=policyContent('contact',locale),copy=REPORT_COPY[locale];
  assert.equal(html.split(`href="${ISSUES_URL}"`).length-1,1,'one issue link, no other channel');
  assert(!/mailto:|tel:/.test(html),'no invented address');
  assert(html.includes(`<button type="button" class="policy-print" data-report-copy hidden>${copy.copy}</button>`));
  const blank=reportTemplate(locale);
  assert(html.includes(`<pre class="contact-template" data-report-text>${blank}</pre>`),'outline is readable without script');
  assert.equal(blank.split('\n').length,9);
  for(const label of [...copy.fields,copy.steps,copy.reminder])assert(blank.includes(label),`${locale}: ${label}`);
  const filled=reportTemplate(locale,{url:'https://example.test/en/image/resize/',browser:'TestBrowser/1.0'}).split('\n');
  assert.equal(filled[0],`${copy.fields[0]}: https://example.test/en/image/resize/`);
  assert.equal(filled[1],`${copy.fields[1]}: TestBrowser/1.0`);
  assert.equal(filled[2],`${copy.fields[2]}:`);
  for(const page of ['about','privacy','terms'])assert(!policyContent(page,locale).includes('contact-template'),page);
 }
});
