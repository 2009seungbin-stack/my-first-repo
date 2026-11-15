import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyFormat,FORMATS} from '../src/platform/format-text.js';
import {renderMarkdown} from '../platform/markdown.js';

/** Apply to the text between ‹ and › and show the result the same way. */
const run=(marked,kind,ph)=>{
 const start=marked.indexOf('‹'),end=marked.indexOf('›')-1,value=marked.replace(/[‹›]/g,'');
 const r=applyFormat(value,start,end,kind,ph);
 return r.value.slice(0,r.start)+'‹'+r.value.slice(r.start,r.end)+'›'+r.value.slice(r.end);
};

test('write formatting: inline marks wrap the selection and come off on a second press',()=>{
 assert.equal(run('a ‹굵게› b','bold'),'a **‹굵게›** b');
 assert.equal(run('a **‹굵게›** b','bold'),'a ‹굵게› b');
 assert.equal(run('a ‹**굵게**› b','bold'),'a ‹굵게› b');
 assert.equal(run('x ‹y› z','italic'),'x *‹y›* z');
 assert.equal(run('x *‹y›* z','italic'),'x ‹y› z');
 assert.equal(run('x **‹y›** z','italic'),'x ***‹y›*** z','bold text gains italic instead of losing a star');
 assert.equal(run('‹gone›','strike'),'~~‹gone›~~');
 assert.equal(run('run ‹npm test›','code'),'run `‹npm test›`');
});

test('write formatting: an empty selection gets a placeholder that is selected; marks stay on one line',()=>{
 assert.equal(run('앞 ‹› 뒤','bold',{text:'굵게'}),'앞 **‹굵게›** 뒤');
 assert.equal(run('‹›','code'),'`‹text›`');
 assert.equal(run('‹one\ntwo›','bold'),'**‹one›**\ntwo');
});

test('write formatting: links keep the label and select the address, or wrap a pasted address',()=>{
 assert.equal(run('see ‹the docs›','link'),'see [the docs](‹https://›)');
 assert.equal(run('‹https://example.com/a?b=1›','link',{text:'링크'}),'[‹링크›](https://example.com/a?b=1)');
 assert.equal(run('‹›','link',{text:'링크'}),'[링크](‹https://›)');
});

test('write formatting: quote and lists act on whole lines, number in order and toggle off',()=>{
 assert.equal(run('a\n‹b\nc›\nd','quote'),'a\n‹> b\n> c›\nd');
 assert.equal(run('a\n‹> b\n> c›\nd','quote'),'a\n‹b\nc›\nd');
 assert.equal(run('on‹›e\ntwo','ul'),'‹- one›\ntwo');
 assert.equal(run('‹one\n\ntwo\nthree›','ol'),'‹1. one\n\n2. two\n3. three›');
 assert.equal(run('‹- one\n- two›','ol'),'‹1. one\n2. two›','a bullet list becomes a numbered one');
 assert.equal(run('‹1. one\n2. two›','ol'),'‹one\ntwo›');
 assert.equal(run('‹›','ul',{item:'항목'}),'- ‹항목›');
 assert.equal(run('a\n‹›','quote',{item:'인용'}),'a\n> ‹인용›');
 assert.equal(run('‹one\n›two','ul'),'‹- one›\ntwo','a selection ending at a line break does not take the next line');
});

test('write formatting: every button writes Markdown the server renderer turns into that element',()=>{
 const tag={bold:'<strong>',italic:'<em>',strike:'<del>',code:'<code>',link:'<a href="https://',quote:'<blockquote>',ul:'<ul><li>',ol:'<ol><li>'};
 assert.deepEqual(Object.keys(tag),FORMATS);
 for(const kind of FORMATS){
  const r=applyFormat('글자',0,2,kind);
  const out=renderMarkdown(kind==='link'?r.value.replace('https://','https://example.com/'):r.value);
  assert(out.includes(tag[kind]),`${kind}: ${r.value} → ${out}`);
  assert(out.includes('글자'));
 }
});

test('write formatting: unknown kinds and out-of-range selections change nothing or stay in range',()=>{
 assert.deepEqual(applyFormat('abc',1,2,'nope'),{value:'abc',start:1,end:2});
 const r=applyFormat('abc',9,-4,'bold');
 assert.equal(r.value,'**abc**');assert.deepEqual([r.start,r.end],[2,5]);
 assert.equal(applyFormat(null,0,0,'bold').value,'**text**');
});
