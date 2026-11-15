import test from 'node:test';
import assert from 'node:assert/strict';
import {smsSegments,platformMeters,limitValue,topKeywords,PLATFORM_LIMITS,LIMIT_UNITS,SMS_RULE} from '../src/task/character-limits.js';
import {countText} from '../src/task/character-core.js';

test('SMS: GSM-7 single part holds 160 septets and concatenated parts hold 153',()=>{
 assert.deepEqual(smsSegments(''),{encoding:'gsm7',units:0,segments:0,perSegment:160,remaining:160});
 assert.deepEqual(smsSegments('a'.repeat(160)),{encoding:'gsm7',units:160,segments:1,perSegment:160,remaining:0});
 assert.deepEqual(smsSegments('a'.repeat(161)),{encoding:'gsm7',units:161,segments:2,perSegment:153,remaining:145});
 assert.equal(smsSegments('a'.repeat(306)).segments,2);
 assert.equal(smsSegments('a'.repeat(307)).segments,3);
});

test('SMS: GSM extension characters cost two septets and are never split across parts',()=>{
 assert.equal(smsSegments('€').units,2);
 assert.equal(smsSegments('[~]').units,6);
 assert.deepEqual(smsSegments('a'.repeat(152)+'€€'),{encoding:'gsm7',units:156,segments:1,perSegment:160,remaining:4});
 // 152 + € fills part one to 154 > 153, so the euro moves to part two and one septet is left unused.
 const split=smsSegments('a'.repeat(152)+'€'+'a'.repeat(153));
 assert.equal(split.units,307);assert.equal(split.segments,3);
});

test('SMS: any non-GSM character switches the whole message to UCS-2 (70 / 67 code units)',()=>{
 assert.deepEqual(smsSegments('가'.repeat(70)),{encoding:'ucs2',units:70,segments:1,perSegment:70,remaining:0});
 assert.deepEqual(smsSegments('가'.repeat(71)),{encoding:'ucs2',units:71,segments:2,perSegment:67,remaining:63});
 assert.equal(smsSegments('hello 한').encoding,'ucs2');
 assert.equal(smsSegments('😀').units,2);
 // A surrogate pair that does not fit the last code unit of a part starts the next part.
 assert.equal(smsSegments('가'.repeat(66)+'😀'+'가'.repeat(67)).segments,3);
 assert.deepEqual(SMS_RULE,{gsm7:{single:160,part:153},ucs2:{single:70,part:67}});
});

test('platform meters use the documented unit per row and report over/remaining',()=>{
 assert.deepEqual(PLATFORM_LIMITS.map(x=>[x.id,x.max]),[['x',280],['instagram',2200],['youtubeTitle',100],['youtubeDescription',5000],['metaTitle',60],['metaDescription',160],['krSms',90]]);
 const r=countText('가'.repeat(101),{locale:'ko'}),rows=Object.fromEntries(platformMeters(r).map(m=>[m.id,m]));
 assert.equal(rows.x.used,202);assert.equal(rows.x.remaining,78);assert.equal(rows.x.over,0);
 assert.equal(rows.youtubeTitle.used,101);assert.equal(rows.youtubeTitle.over,1);assert.equal(rows.youtubeTitle.remaining,0);
 assert.equal(rows.instagram.remaining,2099);
 assert.equal(rows.metaTitle.guide,true);assert.equal(rows.metaTitle.over,41);
 assert.equal(rows.krSms.used,202);assert.equal(rows.krSms.over,112);
});

test('emoji count as two UTF-16 units for Instagram/YouTube rows but one visible character for guides',()=>{
 const rows=Object.fromEntries(platformMeters(countText('😀😀',{locale:'en'})).map(m=>[m.id,m]));
 assert.equal(rows.instagram.used,4);assert.equal(rows.youtubeTitle.used,4);assert.equal(rows.metaTitle.used,2);
 // CP949 cannot encode the emoji: the row reports "not measurable" instead of a guessed byte count.
 assert.equal(rows.krSms.used,null);assert.equal(rows.krSms.over,0);assert.equal(rows.krSms.remaining,null);
});

test('custom limit value follows the selected unit',()=>{
 const r=countText('한글 ab\n',{locale:'ko'});
 assert.deepEqual(LIMIT_UNITS,['chars','utf8','cp949']);
 assert.equal(limitValue(r,{unit:'chars',include:true}),6);
 assert.equal(limitValue(r,{unit:'chars',include:false}),4);
 assert.equal(limitValue(r,{unit:'utf8',include:false}),10);
 assert.equal(limitValue(r,{unit:'cp949',include:false}),8);
 assert.equal(limitValue(countText('😀',{locale:'ko'}),{unit:'cp949'}),null);
 assert.equal(limitValue(r),6);
});

test('keyword list keeps words used twice or more, most frequent first, ties by first appearance',()=>{
 const counts=new Map([['pear',1],['apple',3],['kiwi',2],['fig',2]]);
 assert.deepEqual(topKeywords(counts,8),[{word:'apple',count:3,share:0.375},{word:'kiwi',count:2,share:0.25},{word:'fig',count:2,share:0.25}]);
 assert.deepEqual(topKeywords(counts,8,{limit:1}),[{word:'apple',count:3,share:0.375}]);
 assert.deepEqual(topKeywords(new Map(),0),[]);
});

test('countText exposes keywords and SMS data without changing adjacent-repeat output',()=>{
 const r=countText('사과 바나나 사과 포도 사과 바나나 Apple apple apple',{locale:'ko'});
 assert.deepEqual(r.keywords.map(k=>[k.word,k.count]),[['사과',3],['apple',3],['바나나',2]]);
 assert.equal(r.keywords[0].share,3/9);
 assert.deepEqual(r.repetitions,[{phrase:'apple',count:2}]);
 assert.equal(r.sms.encoding,'ucs2');
 assert.equal(countText('plain ascii',{locale:'en'}).sms.encoding,'gsm7');
});

import {overflowIndex,quickCountText,legacyBytes} from '../src/task/character-core.js';

test('overflowIndex returns the UTF-16 index of the first character that does not fit',()=>{
 const text='한글 ab 😀 테스트';
 assert.equal(overflowIndex(text,{unit:'chars',limit:4}),4);
 assert.equal(overflowIndex(text,{unit:'chars',include:false,limit:4}),6);
 assert.equal(overflowIndex(text,{unit:'utf8',limit:7}),3);
 assert.equal(overflowIndex('한글 ab',{unit:'cp949',limit:5}),3);
 assert.equal(overflowIndex('abc',{unit:'chars',limit:3}),null);
 assert.equal(overflowIndex('abc',{unit:'chars',limit:0}),null);
 assert.equal(overflowIndex('abc',{unit:'nope',limit:1}),null);
 // A character CP949 cannot encode makes the byte limit unmeasurable instead of guessed.
 assert.equal(overflowIndex('😀한글',{unit:'cp949',limit:2}),null);
});

test('the kept prefix always fits the limit exactly as the counter measures it',()=>{
 const text='자기소개서 초안입니다.\n두 번째 줄 with ASCII, 그리고 👨‍👩‍👧 가족 이모지와 é 결합 문자.';
 for(const limit of [1,5,12,20,33]){
  for(const include of [true,false]){
   const at=overflowIndex(text,{unit:'chars',include,limit,locale:'ko'}),q=quickCountText(text.slice(0,at??text.length),'ko');
   assert.ok((include?q.graphemes:q.content)<=limit);
   // When something overflows, the kept prefix uses the limit fully.
   if(at!==null)assert.equal(include?q.graphemes:q.content,limit);
  }
  const utf8At=overflowIndex(text,{unit:'utf8',limit});
  assert.ok(new TextEncoder().encode(text.slice(0,utf8At??text.length)).length<=limit);
 }
 const plain='한글과 English 섞인 문장입니다';
 for(const limit of [1,2,3,10,17]){const at=overflowIndex(plain,{unit:'cp949',limit});assert.ok(legacyBytes(plain.slice(0,at??plain.length),'cp949').bytes<=limit);}
 // A grapheme cluster is never split: the family emoji stays whole or is dropped whole.
 assert.equal(overflowIndex('a👨‍👩‍👧b',{unit:'chars',limit:1}),1);
 assert.equal(overflowIndex('a👨‍👩‍👧b',{unit:'chars',limit:2}),'a👨‍👩‍👧'.length);
});

test('countText reports overflow only when the selected limit is exceeded',()=>{
 assert.deepEqual(countText('한글 ab',{locale:'ko',limit:5,unit:'cp949'}).overflow,{unit:'cp949',include:true,limit:5,at:3});
 assert.deepEqual(countText('한글 ab',{locale:'ko',limit:7,unit:'cp949'}).overflow,{unit:'cp949',include:true,limit:7,at:null});
 assert.deepEqual(countText('a b c d',{locale:'en',limit:3,include:false}).overflow,{unit:'chars',include:false,limit:3,at:6});
 assert.deepEqual(countText('한글 ab',{locale:'ko'}).overflow,{unit:'chars',include:true,limit:0,at:null});
 assert.equal(countText('😀'.repeat(9),{locale:'ko',limit:2,unit:'cp949'}).overflow.at,null);
});

test('SMS segmentation stays exact and fast on multi-megabyte input',()=>{
 const ascii='lorem ipsum dolor '.repeat(450000),start=performance.now(),a=smsSegments(ascii);
 assert.equal(a.encoding,'gsm7');assert.equal(a.units,ascii.length);assert.equal(a.segments,Math.ceil(ascii.length/153));
 const hangul='가나다라 '.repeat(1600000),b=smsSegments(hangul);
 assert.equal(b.encoding,'ucs2');assert.equal(b.units,hangul.length);assert.equal(b.segments,Math.ceil(hangul.length/67));
 assert.ok(performance.now()-start<3000);
 // A lone surrogate is one unit; only a real pair is kept together.
 assert.equal(smsSegments('가'.repeat(66)+'\ud83d'+'가'.repeat(67)).segments,2);
});
