import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {countText,quickCountText,legacyBytes,X_RULE} from '../src/task/character-core.js';
import {parseTweet} from '../assets/vendor/twitter-text-3.1.0.mjs';

const WINDOWS_ICONV='C:/Program Files/Git/usr/bin/iconv.exe';
const ICONV=process.env.ICONV_BIN||(process.platform==='win32'&&existsSync(WINDOWS_ICONV)?WINDOWS_ICONV:'iconv');
const cases={shift_jis:['ABCかな漢字','Shift_JIS'],euc_kr:['가각한글漢字','EUC-KR'],cp949:['가뷁힣漢字','CP949']};
test('legacy byte mappings agree with independent GNU iconv output',()=>{
 for(const [name,[sample,encoding]] of Object.entries(cases)){
  const p=spawnSync(ICONV,['-f','UTF-8','-t',encoding],{input:Buffer.from(sample),maxBuffer:1024*1024});
  assert.equal(p.status,0,`${name}: ${p.stderr}`);
  assert.equal(legacyBytes(sample,name).bytes,p.stdout.length,name);
 }
 assert.deepEqual(legacyBytes('뷁','euc_kr'),{bytes:null,unmappable:1});
 assert.deepEqual(legacyBytes('뷁','cp949'),{bytes:2,unmappable:0});
 assert.deepEqual(legacyBytes('😀','shift_jis'),{bytes:null,unmappable:1});
});
test('mixed Unicode units and honest bytes are distinct',()=>{
 const s='A 한 😀\nＢ é',r=countText(s,{locale:'ko'});
 assert.equal(r.graphemes,9);assert.equal(r.codePoints,10);assert.equal(r.utf16,11);
 assert.equal(r.utf8,18);assert.equal(r.lines,2);assert.equal(r.paper.ja,1);
 assert.equal(r.legacy.shift_jis.bytes,null);assert.equal(r.x.rule,X_RULE);
});
test('script proportions and literal forbidden terms are explicit',()=>{
 const r=countText('한글 漢字 かな カナ test test',{locale:'ko',forbidden:['한글','test']});
 assert.equal(r.scripts.hangul,2);assert.equal(r.scripts.han,2);
 assert.deepEqual(r.forbidden,[{phrase:'한글',count:1},{phrase:'test',count:2}]);
 assert.deepEqual(r.repetitions,[{phrase:'test',count:1}]);
});
test('early exact grapheme result equals the detailed result',()=>{
 for(const s of ['', 'A 한 😀\nＢ é', '👨‍👩‍👧‍👦🇯🇵\r\nカナ', '뷁\t한글']){
  const quick=quickCountText(s,'ko'),full=countText(s,{locale:'ko'},quick);
  for(const key of ['graphemes','noSpaces','noLineBreaks','content'])assert.equal(quick[key],full[key],`${key}: ${s}`);
 }
});
test('official twitter-text weighted conformance fixtures',()=>{
 const python=spawnSync('python',['-c',`import yaml,json,sys;d=yaml.safe_load(open(sys.argv[1],encoding='utf8'))['tests'];sys.stdout.buffer.write(json.dumps([x for k in ('WeightedTweetsWithDiscountedEmojiCounterTest','UnicodeDirectionalMarkerCounterTest') for x in d[k]],ensure_ascii=False).encode('utf8'))`,'tests/fixtures/twitter-validate.yml'],{encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(python.status,0,python.stderr);
 const rows=JSON.parse(python.stdout);assert(rows.length>=20);
 for(const row of rows){if(typeof row.expected?.weightedLength!=='number')continue;
  assert.equal(parseTweet(row.text).weightedLength,row.expected.weightedLength,row.description);
 }
});
