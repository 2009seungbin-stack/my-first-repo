import test from 'node:test';
import assert from 'node:assert/strict';
import {describeChange,formatValue} from '../platform/change-text.js';
import {verticalOf} from '../platform/verticals/index.js';
const j=JSON.stringify;
test('changes read naturally in ko and en with formatted values',()=>{
 const price={kind:'fact_changed',vertical:'ai',property:'api_input_price',old_value:j(5),new_value:j(4)};
 assert.deepEqual(describeChange(price,{name:'Claude Opus 5.5'},'ko'),{title:'Claude Opus 5.5 API 입력 가격 (100만 토큰당) 변경',detail:'$5 → $4'});
 assert.equal(describeChange(price,{name:'Claude Opus 5.5'},'en').detail,'$5 → $4');
 const ko={kind:'fact_changed',vertical:'games',property:'korean_official',old_value:j('none'),new_value:j('interface_subtitles')};
 assert.equal(describeChange(ko,{name:'게임 Y'},'ko').detail,'공식 한국어 없음 → 한국어 인터페이스·자막');
 const compat={kind:'compat_changed',vertical:'games',scope:j({target:'game:x',target_version:'2.3.1'}),old_value:j('works'),new_value:j('unverified_after_update')};
 assert.equal(describeChange(compat,{name:'한글패치 1.7',names:{'game:x':'게임 X'}},'ko').title,'게임 X 2.3.1 업데이트 — 한글패치 1.7 호환 재확인 필요');
 assert.equal(describeChange({kind:'version_released',vertical:'studio',new_value:j('5.0')},{name:'Blender'},'en').title,'Blender 5.0 released');
 assert.equal(describeChange({kind:'note',vertical:'ai',summary:j({ko:'직접 쓴 요약',en:'Curated'})},{name:'x'},'ko').title,'직접 쓴 요약');
 assert.equal(formatValue(1000000,verticalOf('ai').properties.context_window,null,'en'),'1M');
 assert.equal(formatValue(29000,{type:'money'},'KRW','ko'),'₩29,000');
});
