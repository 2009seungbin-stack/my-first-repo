import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanText,CLEANUPS} from '../src/task/character-cleanup.js';

test('trimLines removes trailing spaces per line and blank lines at both ends only',()=>{
 assert.equal(cleanText('\n\n첫 줄  \n\n둘째 줄\t　\n  들여쓰기 유지 \n\n','trimLines'),'첫 줄\n\n둘째 줄\n  들여쓰기 유지');
 assert.equal(cleanText('a \r\nb\r','trimLines'),'a\nb');
});

test('collapseSpaces keeps one space per run and the kind of the first space',()=>{
 assert.equal(cleanText('안녕   하세요  반갑습니다','collapseSpaces'),'안녕 하세요 반갑습니다');
 assert.equal(cleanText('a\t\t b','collapseSpaces'),'a\tb');
 assert.equal(cleanText('全角　　 空白','collapseSpaces'),'全角　空白');
 assert.equal(cleanText('줄\n\n바꿈  유지','collapseSpaces'),'줄\n\n바꿈 유지');
});

test('removeBlankLines drops empty and whitespace-only lines but keeps the rest untouched',()=>{
 assert.equal(cleanText('하나\n\n  \n둘  \n\t\n셋','removeBlankLines'),'하나\n둘  \n셋');
 assert.equal(cleanText('','removeBlankLines'),'');
});

test('joinLines makes one paragraph: a space between lines, none between Japanese or Chinese lines',()=>{
 assert.equal(cleanText('첫 문장입니다.\n  둘째 문장입니다.\n\n셋째.','joinLines'),'첫 문장입니다. 둘째 문장입니다. 셋째.');
 assert.equal(cleanText('hello\nworld','joinLines'),'hello world');
 assert.equal(cleanText('これは一行目です。\n二行目です。','joinLines'),'これは一行目です。二行目です。');
 assert.equal(cleanText('日本語\nEnglish','joinLines'),'日本語 English');
 assert.equal(cleanText('\n\n','joinLines'),'');
});

test('clean-up actions are idempotent and reject unknown names',()=>{
 const sample='  제목  \n\n\n본문   첫 줄  \n본문 둘째 줄\t\n\n';
 for(const action of CLEANUPS){const once=cleanText(sample,action);assert.equal(cleanText(once,action),once,action);}
 assert.deepEqual([...CLEANUPS],['trimLines','collapseSpaces','removeBlankLines','joinLines']);
 assert.throws(()=>cleanText('x','nope'),RangeError);
 assert.equal(cleanText(null,'trimLines'),'');
});
