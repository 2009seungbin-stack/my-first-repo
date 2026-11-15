import test from 'node:test';
import assert from 'node:assert/strict';
import {rankTools,finderScore,finderWords,finderMove} from '../src/task/home-finder.js';
import {homePage} from '../tools/task-build.mjs';
import {INTENTS} from '../src/intents.js';
import {SEARCH_TERMS} from '../src/search-terms.js';
import {DIRECTORY} from '../src/task/registry.js';
import {t} from '../src/i18n.js';
import {ui} from '../src/task/strings.js';

// The entries the page builds from its own cards (src/task/home.js finderEntries), from the real registries.
const entries=locale=>DIRECTORY.flatMap(([cat,ids])=>ids.map(id=>({id,group:cat,title:t(`intent.${id}.title`,{},locale),
 search:[t(`intent.${id}.title`,{},locale),t(`intent.${id}.description`,{},locale),...(SEARCH_TERMS[id]||[]),id,INTENTS[id].path].join(' ').toLowerCase()})));

test('finder: an empty query lists the first tool of each group, in directory order',()=>{
 const all=entries('en'),first=rankTools('',all);
 assert.deepEqual(first.map(e=>e.id),DIRECTORY.map(([,ids])=>ids[0]));
 assert.deepEqual(rankTools('   ',all),first);
});
test('finder: every word must match, and title matches rank above description matches',()=>{
 const all=entries('en');
 const merge=rankTools('merge pdf',all);
 assert.equal(merge[0].id,'pdf-merge');
 assert(merge.every(e=>finderWords('merge pdf').every(w=>(e.title.toLowerCase()+' '+e.search).includes(w))));
 assert.deepEqual(rankTools('zzzz-no-such-tool',all),[]);
 assert.equal(finderScore(['sprite','zzzz'],all.find(e=>e.id==='sprite-slicer')),0);
 const a={title:'Sprite Sheet Slicer',search:'cut frames'},b={title:'Atlas padding',search:'sprite sheet bleed'};
 assert.deepEqual(rankTools('sprite',[b,a]),[a,b],'a title match beats a match in the search terms');
 assert(finderScore(['sheet'],a)>finderScore(['sheet'],b)&&finderScore(['sheet'],b)>0);
 assert(finderScore(['sprite','sheet','slicer'],a)>finderScore(['sprite'],a),'the exact title scores highest');
});
test('finder: ties keep directory order and input is normalised',()=>{
 const list=[{title:'PDF one',search:''},{title:'PDF two',search:''}];
 assert.deepEqual(rankTools('pdf',list),list);
 assert.deepEqual(rankTools('ＰＤＦ',list),list,'full-width letters match');
 assert.deepEqual(finderWords('  Sprite   SHEET '),['sprite','sheet']);
});
test('finder: finds tools by their names in Korean and Japanese',()=>{
 for(const locale of ['ko','ja']){
  const all=entries(locale),title=t('intent.pdf-merge.title',{},locale);
  assert.equal(rankTools(title,all)[0].id,'pdf-merge',locale);
  assert(rankTools('pdf',all).length>1,locale);
 }
});
test('finder: arrow keys wrap, Home and End jump, an empty list has no active row',()=>{
 assert.equal(finderMove(0,3,'ArrowDown'),1);
 assert.equal(finderMove(2,3,'ArrowDown'),0);
 assert.equal(finderMove(0,3,'ArrowUp'),2);
 assert.equal(finderMove(1,3,'Home'),0);
 assert.equal(finderMove(1,3,'End'),2);
 assert.equal(finderMove(1,3,'x'),1);
 assert.equal(finderMove(0,0,'ArrowDown'),-1);
});
test('home page ships the finder in every language, with a link that works without JavaScript',()=>{
 for(const locale of ['ko','en','ja']){
  const html=homePage({locale,prefix:locale+'/',base:'/',headHTML:'',contentHTML:''});
  assert(html.includes('<a class="gh-find" href="#tools" data-finder-open>')&&html.includes('id="tools"'),locale);
  assert(html.includes('<dialog class="gh-finder" id="toolFinder"')&&html.includes('role="combobox"')&&html.includes('role="listbox"'),locale);
  for(const key of ['open','hint','keys','close','list']){const s=ui(locale,'gh.find.'+key);assert(s&&!s.startsWith('gh.find')&&html.includes(s.replace(/&/g,'&amp;')),`${locale} ${key}`);}
  for(const key of ['count','each'])assert(ui(locale,'gh.find.'+key,{n:7}).includes('7'),`${locale} ${key}`);
 }
 assert.notEqual(ui('ko','gh.find.open'),ui('en','gh.find.open'));assert.notEqual(ui('ja','gh.find.open'),ui('en','gh.find.open'));
});
