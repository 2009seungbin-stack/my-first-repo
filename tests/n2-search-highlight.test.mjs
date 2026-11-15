import {test} from 'node:test';
import assert from 'node:assert/strict';
import {highlightParts} from '../platform/render/search.js';

const hits=(text,q)=>highlightParts(text,q).filter(p=>p.hit).map(p=>p.text);
const whole=(text,q)=>highlightParts(text,q).map(p=>p.text).join('');

test('search highlight: every query word is marked, case-insensitively, and the text is unchanged',()=>{
 assert.deepEqual(highlightParts('Claude Code 사용 후기','claude 후기'),[{text:'Claude',hit:true},{text:' Code 사용 ',hit:false},{text:'후기',hit:true}]);
 assert.deepEqual(hits('RTX 5070 Ti로 로컬 LLM 돌리기','5070 llm'),['5070','LLM']);
 for(const [text,q] of [['Claude Code 사용 후기','claude 후기'],['a.b (c) [d] 100%+','. ( [ +'],['İstanbul ß ǅ','i ss'],['',' x ']])assert.equal(whole(text,q),text);
});

test('search highlight: regex characters in the query are literal and overlapping words give one run',()=>{
 assert.deepEqual(hits('C++ (beta) 1.2.3 a*b','c++ (beta) 1.2 a*b'),['C++','(beta)','1.2','a*b']);
 assert.deepEqual(hits('.*','x'),[]);
 assert.deepEqual(hits('abcabc','abc bc'),['abcabc']);
 assert.deepEqual(hits('블루 아카이브 공략','블루 블루 아카'),['블루','아카']);
});

test('search highlight: nothing to match gives the text back whole, an empty text gives nothing',()=>{
 assert.deepEqual(highlightParts('제목','   '),[{text:'제목',hit:false}]);
 assert.deepEqual(highlightParts('제목','없는말'),[{text:'제목',hit:false}]);
 assert.deepEqual(highlightParts('',''),[]);
 assert.deepEqual(highlightParts(null,'x'),[]);
});
