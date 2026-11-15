// The digest article page's reading aids: reading time, table of contents and previous / next links.
import test from 'node:test';
import assert from 'node:assert/strict';
import {digestReadingMinutes,digestSections,digestNeighbours,renderDigestArticle,renderDigestIndex} from '../platform/render/digest.js';
import {useDigestArticles} from '../platform/digest.js';

const site={origin:'https://nerulio.test'};
const article=(/** @type {string} */ slug,/** @type {string} */ date,/** @type {string} */ body,locale='en')=>({slug,locale,date,updated:date,title:`Title ${slug}`,summary:`Summary ${slug}`,status:'published',sources:[{title:'Source',url:'https://example.com/'}],body});

test('reading time comes from the text: words for English, characters for Korean, never below one minute',()=>{
 assert.equal(digestReadingMinutes('short note','en'),1);
 assert.equal(digestReadingMinutes(Array(230).fill('word').join(' '),'en'),1);
 assert.equal(digestReadingMinutes(Array(231).fill('word').join(' '),'en'),2);
 assert.equal(digestReadingMinutes('가'.repeat(500),'ko'),1);
 assert.equal(digestReadingMinutes('가'.repeat(501),'ko'),2);
 // Code blocks and link targets are not read as prose.
 assert.equal(digestReadingMinutes('intro\n\n```\n'+Array(2000).fill('code').join(' ')+'\n```\n','en'),1);
 assert.equal(digestReadingMinutes('[link]('+'x'.repeat(5000)+')','ko'),1);
});

test('section headings get ids in order and the contents list uses their escaped text',()=>{
 const {html,toc}=digestSections('<p>a</p><h2>First &amp; <strong>bold</strong></h2><h3>sub</h3><h2>Second <code>x&lt;y</code></h2>');
 assert.deepEqual(toc,[{id:'sec-1',text:'First &amp; bold'},{id:'sec-2',text:'Second x&lt;y'}]);
 assert(html.includes('<h2 id="sec-1" tabindex="-1">First &amp; <strong>bold</strong></h2>'));
 assert(html.includes('<h3>sub</h3>'),'only h2 is touched');
 assert.deepEqual(digestSections('<p>no headings</p>'),{html:'<p>no headings</p>',toc:[]});
});

test('neighbours follow the newest-first list and stop at both ends',()=>{
 const list=[{slug:'c'},{slug:'b'},{slug:'a'}];
 assert.deepEqual(digestNeighbours(list,'b'),{newer:{slug:'c'},older:{slug:'a'}});
 assert.deepEqual(digestNeighbours(list,'c'),{newer:null,older:{slug:'b'}});
 assert.deepEqual(digestNeighbours(list,'a'),{newer:{slug:'b'},older:null});
 assert.deepEqual(digestNeighbours(list,'zz'),{newer:null,older:null});
});

test('the article page links its sections and its neighbours; a short article has no contents box',()=>{
 const long='Intro.\n\n## One <tag>\n\ntext\n\n## Two\n\ntext\n\n## Three\n\ntext\n';
 useDigestArticles([article('old','2026-10-01','Just a paragraph.'),article('mid','2026-10-02',long),article('new','2026-10-03','## Only\n\ntext'),article('mid','2026-10-02',long,'ko')]);
 try{
  const mid=String(renderDigestArticle({l:'en',slug:'mid',channels:[]},site));
  assert(mid.includes('aria-labelledby="digest-toc"'));
  for(const n of [1,2,3]){assert(mid.includes(`href="#sec-${n}"`));assert(mid.includes(`<h2 id="sec-${n}" tabindex="-1">`));}
  assert(mid.includes('One &lt;tag&gt;</a>')&&!mid.includes('<tag>'),'heading text stays escaped in the contents list');
  assert(mid.includes('rel="prev" href="/en/ai/digest/old/"')&&mid.includes('rel="next" href="/en/ai/digest/new/"'));
  assert(mid.includes('About 1 min read'));
  const newest=String(renderDigestArticle({l:'en',slug:'new',channels:[]},site));
  assert(!newest.includes('digest-toc')&&newest.includes('<h2>Only</h2>'),'one heading is not a table of contents and keeps a plain heading');
  assert(newest.includes('rel="prev" href="/en/ai/digest/mid/"')&&!newest.includes('rel="next"'));
  // Korean: its own list (one article → no neighbours) and Korean labels.
  const ko=String(renderDigestArticle({l:'ko',slug:'mid',channels:[]},site));
  assert(ko.includes('>목차<')&&ko.includes('읽는 데 약 1분')&&!ko.includes('rel="prev"')&&!ko.includes('rel="next"'));
  const index=String(renderDigestIndex({l:'en',channels:[]},site));
  assert(index.includes('3 published articles · newest first')&&index.includes('About 1 min read'));
  assert(String(renderDigestIndex({l:'ko',channels:[]},site)).includes('게시된 글 1편 · 최신순'));
 }finally{useDigestArticles([]);}
});
