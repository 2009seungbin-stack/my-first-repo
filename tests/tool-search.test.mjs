import assert from 'node:assert/strict';
import test from 'node:test';
import {searchTools,queryTokens,nearlyEqual,highlightMatch,moveActive,SEARCH_UI} from '../src/tool-search.js';
import {INTENTS} from '../src/intents.js';
import {SEARCH_TERMS} from '../src/search-terms.js';
import {TOOLS} from '../src/tool-registry.js';
import {t,setLocale,LOCALES} from '../src/i18n.js';

const SAMPLE=[
 {id:'remove-bg',title:'배경 제거',description:'사진 배경을 투명하게 만듭니다',aliases:['remove bg','누끼']},
 {id:'resize',title:'이미지 크기 조절',description:'가로세로 크기를 바꿉니다',aliases:['resize image']},
 {id:'compress',title:'Compress image',description:'Make a file smaller',aliases:['image compressor']},
 {id:'pdf-merge',title:'Merge PDF',description:'Combine several image or PDF files',aliases:['combine pdf']}
];
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');

test('an empty query keeps the catalogue order',()=>{
 assert.deepEqual(searchTools(SAMPLE,'   '),SAMPLE.map(e=>e.id));
 assert.deepEqual(queryTokens('  Merge   PDF '),['merge','pdf']);
});
test('titles outrank aliases, aliases outrank descriptions',()=>{
 assert.deepEqual(searchTools(SAMPLE,'image'),['compress','resize','pdf-merge']);
 assert.deepEqual(searchTools(SAMPLE,'누끼'),['remove-bg']);
});
test('every word must match, in any order',()=>{
 assert.deepEqual(searchTools(SAMPLE,'pdf merge'),['pdf-merge']);
 assert.deepEqual(searchTools(SAMPLE,'pdf compress'),[]);
});
test('spacing is ignored and one typo is forgiven',()=>{
 assert.deepEqual(searchTools(SAMPLE,'배경제거'),['remove-bg']);
 assert.deepEqual(searchTools([{id:'logo-bg',title:'로고 흰 배경 제거'},...SAMPLE],'배경제거'),['remove-bg','logo-bg'],'the exact title wins over a longer one');
 assert.deepEqual(searchTools(SAMPLE,'comprss'),['compress']);
 assert.deepEqual(searchTools(SAMPLE,'mrge'),['pdf-merge']);
 assert.deepEqual(searchTools(SAMPLE,'zzzz'),[]);
 assert.equal(nearlyEqual('merge','merge'),true);assert.equal(nearlyEqual('merge','marge'),true);
 assert.equal(nearlyEqual('merge','mer'),false);assert.equal(nearlyEqual('merge','emrge'),false);
});
test('highlight wraps matched words and escapes the rest',()=>{
 assert.equal(highlightMatch('Compress image','im co',esc),'<mark>Co</mark>mpress <mark>im</mark>age');
 assert.equal(highlightMatch('A <b> & PDF','pdf',esc),'A &lt;b> &amp; <mark>PDF</mark>');
 assert.equal(highlightMatch('Merge PDF','',esc),'Merge PDF');
 assert.equal(highlightMatch('Merge PDF','zzz',esc),'Merge PDF');
});
test('arrow movement wraps and reports no row for an empty list',()=>{
 assert.equal(moveActive(0,1,3),1);assert.equal(moveActive(2,1,3),0);assert.equal(moveActive(0,-1,3),2);assert.equal(moveActive(-1,1,3),0);assert.equal(moveActive(0,1,0),-1);
});
test('the real catalogue finds each tool by its own title in every language',()=>{
 const ids=Object.keys(INTENTS).filter(id=>!['home','image','pdf','media'].includes(id));
 for(const locale of LOCALES){
  setLocale(locale);
  const entries=ids.map(id=>({id,title:t(`intent.${id}.title`),description:t(`intent.${id}.description`),aliases:[INTENTS[id].path,...(SEARCH_TERMS[id]||[]),...(TOOLS[id]?.title||[])]}));
  for(const entry of entries)assert(searchTools(entries,entry.title).includes(entry.id),`${locale}: ${entry.id}`);
  for(const [id,terms] of Object.entries(SEARCH_TERMS))if(ids.includes(id))for(const term of terms)assert(searchTools(entries,term).includes(id),`${locale}: ${id} ← ${term}`);
 }
 setLocale('en');
});
test('dialog copy exists in every tool-site language',()=>{
 for(const locale of LOCALES){
  const ui=SEARCH_UI[locale];
  assert(ui.count(1)&&ui.count(12).includes('12')&&ui.keys.includes('Enter')&&ui.none('x').includes('x')&&ui.clear&&ui.allCategories,locale);
 }
});
