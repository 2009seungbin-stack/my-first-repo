import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankTools,finderScore,finderWords,finderMove,finderMarks,readToolPrefs,pushRecent,TOOL_PREF_KEY,RECENT_MAX} from '../src/task/home-finder.js';
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
test('recent tools: the home reads and writes the tool kit preference without losing favourites',()=>{
 assert(readFileSync(new URL('../src/toolkit.js',import.meta.url),'utf8').includes(`const prefKey='${TOOL_PREF_KEY}'`),'same key as src/toolkit.js');
 assert.equal(RECENT_MAX,3);
 const known=id=>!!INTENTS[id];
 assert.deepEqual(readToolPrefs(null,known),{favorites:[],recent:[]});
 assert.deepEqual(readToolPrefs('not json',known),{favorites:[],recent:[]});
 assert.deepEqual(readToolPrefs('[1,2]',known),{favorites:[],recent:[]});
 assert.deepEqual(readToolPrefs(JSON.stringify({favorites:['pdf-merge','gone','pdf-merge',7],recent:['sprite-slicer','pdf-merge','tile-lab','pixel-lab']}),known),{favorites:['pdf-merge'],recent:['sprite-slicer','pdf-merge','tile-lab']});
 let raw=null;
 for(const id of ['a','b','c','b','d'])raw=JSON.stringify(pushRecent(raw,id));
 assert.deepEqual(JSON.parse(raw),{favorites:[],recent:['d','b','c']});
 assert.deepEqual(pushRecent(JSON.stringify({favorites:['x'],recent:['a'],other:1}),'a'),{favorites:['x'],recent:['a'],other:1});
 assert.deepEqual(pushRecent('{broken','a'),{favorites:[],recent:['a']});
 assert.deepEqual(pushRecent('"text"','a'),{favorites:[],recent:['a']});
});
test('home page has the (initially hidden) favourites and recent tools region',()=>{
 for(const locale of ['ko','en','ja'])assert(homePage({locale,prefix:locale+'/',base:'/',headHTML:'',contentHTML:''}).includes(`<nav class="gh-recent" id="homeRecent" aria-label="${t('kit.recent',{},locale)}" hidden></nav>`),locale);
});
test('finder: the typed words are marked in a title, case-insensitively, without changing its text',()=>{
 assert.deepEqual(finderMarks('Sprite Sheet Slicer',['sheet']),[['Sprite ',false],['Sheet',true],[' Slicer',false]]);
 assert.deepEqual(finderMarks('PDF to PDF',['pdf']),[['PDF',true],[' to ',false],['PDF',true]]);
 assert.deepEqual(finderMarks('Sprite Sheet',['sprite','sheet','e s']),[['Sprite Sheet',true]],'overlapping matches merge');
 assert.deepEqual(finderMarks('Tile Lab',['zzz']),[['Tile Lab',false]]);
 assert.deepEqual(finderMarks('Tile Lab',[]),[['Tile Lab',false]]);
 assert.deepEqual(finderMarks('',['a']),[]);
 for(const locale of ['ko','en','ja'])for(const e of entries(locale))assert.equal(finderMarks(e.title,finderWords(e.title.slice(0,3))).map(p=>p[0]).join(''),e.title);
 assert.deepEqual(finderMarks('PDF 합치기',finderWords('합치기 pdf')),[['PDF',true],[' ',false],['합치기',true]]);
});
