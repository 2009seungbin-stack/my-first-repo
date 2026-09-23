import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/game/ui/charset.js';
import {readFileSync,existsSync} from 'node:fs';
const texts=r=>r.entries.map(e=>e.text);
const chars=cps=>cps.map(c=>String.fromCodePoint(c)).join('');
test('gettext .po: msgstr (plural forms, continuation lines, escapes), never msgid or the header',()=>{
 const po=`# comment\nmsgid ""\nmsgstr ""\n"Project-Id-Version: x\\n"\n"Language: ko\\n"\n\nmsgid "New Game"\nmsgstr "새 게임"\n\n#: menu.gd:3\nmsgctxt "menu"\nmsgid "Quit"\nmsgstr ""\n"게임 "\n"종료"\n\nmsgid "%d apple"\nmsgid_plural "%d apples"\nmsgstr[0] "사과 %d개"\n\nmsgid "Tab"\nmsgstr "줄\\n바꿈 \\"따옴표\\""\n`;
 const r=C.readTranslations('ko.po',po);
 assert.equal(r.format,'po');assert.equal(r.locale,'ko');
 assert.deepEqual(texts(r),['새 게임','게임 종료','사과 %d개','줄\n바꿈 "따옴표"']);
 assert.equal(r.entries[1].key,'menu|Quit');
 // a template (.pot, empty msgstr) gives its source strings instead of nothing
 assert.deepEqual(texts(C.readTranslations('game.pot','msgid "Start"\nmsgstr ""\n\nmsgid "One"\nmsgid_plural "Many"\nmsgstr[0] ""\nmsgstr[1] ""\n')),['Start','One','Many']);
});
test('CSV: RFC 4180 cells with commas, quotes and line breaks; Godot locale headers become columns',()=>{
 const csv='keys,en,ko,ja\nNEW,New game,새 게임,ニューゲーム\nQUOTE,"Say ""hi"", ok","줄\n바꿈",\n';
 const r=C.readTranslations('text.csv',csv);
 assert.deepEqual(r.columns.map(c=>c.locale),['en','ko','ja']);
 assert.deepEqual(r.entries.filter(e=>e.locale==='ko').map(e=>e.text),['새 게임','줄\n바꿈']);
 assert.equal(r.entries.find(e=>e.locale==='en'&&e.key==='QUOTE').text,'Say "hi", ok');
 const ko=C.buildCharset([{id:'f',kind:'file',file:r,columns:['ko']}]);
 assert.equal(chars(ko.codepoints.slice().sort((a,b)=>a-b)),' 게꿈바새임줄');
 assert.deepEqual(C.parseDelimited('a\tb\r\n"x\ty"\tz','\t').map(r=>r.cells),[['a','b'],['x\ty','z']]);
});
test('JSON (nested, arrays, locale-keyed), Apple .strings (UTF-16), .resx, XLIFF, Android, .properties, Godot .tres',()=>{
 assert.deepEqual(texts(C.readTranslations('ko.json','{"menu":{"start":"시작","items":["검","방패"]},"n":3}')),['시작','검','방패']);
 const byLoc=C.readTranslations('strings.json','{"en":{"a":"Hi"},"ko":{"a":"안녕"}}');assert.deepEqual(byLoc.columns.map(c=>c.locale),['en','ko']);
 assert.deepEqual(C.buildCharset([{id:'j',kind:'file',file:byLoc,locales:['ko']}]).codepoints.map(c=>String.fromCodePoint(c)).sort(),['녕','안']);
 const strings='/* title */\n"TITLE" = "모험 \\"시작\\"";\n// note\n"URL" = "http://x";\n';
 const utf16=new Uint8Array([0xff,0xfe,...[...strings].flatMap(ch=>{const c=ch.charCodeAt(0);return [c&255,c>>8];})]);
 assert.deepEqual(texts(C.readTranslations('Localizable.strings',utf16)),['모험 "시작"','http://x']);
 assert.deepEqual(texts(C.readTranslations('Res.ko.resx','<root><data name="A" xml:space="preserve"><value>체력 &amp; 마나</value></data><data name="Icon" type="System.Drawing.Bitmap"><value>AAAA</value></data></root>')),['체력 & 마나']);
 const x12='<xliff version="1.2"><file target-language="ko"><body><trans-unit id="a"><source>Save</source><target>저장<x id="1"/></target></trans-unit><trans-unit id="b"><source>Load</source></trans-unit></body></file></xliff>';
 const xr=C.readTranslations('m.xlf',x12);assert.deepEqual(texts(xr),['저장'],'an untranslated unit falls back to its source at runtime: not Korean text');assert.equal(xr.entries[0].locale,'ko');
 assert.deepEqual(texts(C.readTranslations('src.xlf','<xliff version="1.2"><file><body><trans-unit id="a"><source>Save</source></trans-unit></body></file></xliff>')),['Save'],'an export with no target at all is read for its sources');
 const android='<resources><string name="a">레벨 \\\'업\\\'</string><string name="k" translatable="false">KEY</string><plurals name="p"><item quantity="other">%d개</item></plurals><string-array name="s"><item>하나</item></string-array></resources>';
 assert.deepEqual(texts(C.readTranslations('values-ko/strings.xml',android)),["레벨 '업'",'%d개','하나']);
 assert.equal(C.readTranslations('values-ko/strings.xml',android).locale,'ko');
 assert.deepEqual(texts(C.readTranslations('messages_ko.properties','# c\ntitle=\\uD0C0\\uC774\\uD2C0\nlong = one \\\n  two\nempty=\n')),['타이틀','one two']);
 const tres='[gd_resource type="Translation" format=3]\n\n[resource]\nlocale = "ko"\nmessages = {\n"START": "시작",\n"QUIT": "종료 \\"확인\\""\n}\n';
 const tr=C.readTranslations('ko.tres',tres);assert.deepEqual(texts(tr),['시작','종료 "확인"']);assert.equal(tr.entries[0].locale,'ko');
 assert.throws(()=>C.readTranslations('x.json','{nope'),/could not be parsed/);
});
test('placeholders and markup are removed and counted; ICU plural branches keep their text',()=>{
 const v=C.visibleText('<b>{0}</b>님, %1$s와 {{name}} [color=#f00]경고[/color] ${gold} {count, plural, one {# 개} other {# 개들}}');
 assert.equal(v.text.replace(/\s+/g,' ').trim(),'님, 와 경고 0 개 0 개들');
 assert.deepEqual(v.removed,{icu:1,dollar:1,braces:2,printf:1,markup:2,bbcode:2});
 assert.equal(C.visibleText('100%% 완료').text,'100 완료');
 assert.equal(C.visibleText('100% complete, 50% off').text,'100% complete, 50% off','a percent sign in prose is text');
 assert.equal(C.visibleText('{0}',{rules:[]}).text,'{0}');
});
test('charset: frequency order puts the most used glyphs first, presets fill in, exclusions and invisible characters are dropped',()=>{
 const r=C.buildCharset([{id:'t',kind:'text',text:'가가가나나다\n\t​'},{id:'p',kind:'preset',preset:'digits'}],{exclude:'9'});
 assert.deepEqual(chars(r.codepoints.slice(0,3)),'가나다');
 assert.ok(r.codepoints.includes(0x30)&&!r.codepoints.includes(0x39)&&r.codepoints.includes(0x20));
 assert.ok(!r.codepoints.includes(0x0a)&&!r.codepoints.includes(0x200b));
 assert.equal(r.counts.get(0xac00),3);assert.equal(r.stats.hangul,3);
 assert.deepEqual(C.buildCharset([{id:'t',kind:'text',text:'다가'}],{order:'codepoint'}).codepoints,[0xac00,0xb2e4]);
});
test('legacy presets are the exact standard sets from the platform decoders',()=>{
 const ks=C.PRESETS['ks-x-1001-hangul']();assert.equal(ks.length,2350);assert.equal(ks[0],0xac00);assert.ok(ks.every(c=>c>=0xac00&&c<=0xd7a3));
 const jis=C.PRESETS['jis-x-0208-kanji-1']();assert.equal(jis.length,2965);assert.equal(jis[0],0x4e00);
 assert.equal(C.PRESETS.kana().length,205);assert.equal(C.PRESETS['hangul-all']().length,11172);
});
test('missing glyphs report count and where each one is used',()=>{
 const file=C.readTranslations('ko.po','msgid "a"\nmsgstr "가나"\n\nmsgid "b"\nmsgstr "나다"\n');
 const cs=C.buildCharset([{id:'f',kind:'file',file}]);
 const miss=C.missingGlyphs(cs.codepoints,c=>c===0xac00,{counts:cs.counts,files:[file]});
 assert.deepEqual(miss.map(m=>[m.char,m.count]),[['나',2],['다',1]]);
 assert.deepEqual(miss[0].where.map(w=>w.line),[1,4],'the msgid line of each entry');
});
test('format and locale detection from names and content',()=>{
 assert.equal(C.detectFormat('a.xml','<?xml version="1.0"?><resources>'),'android');
 assert.equal(C.detectFormat('a.xml','<xliff version="2.0">'),'xliff');
 assert.equal(C.detectFormat('data','{"a":1}'),'json');
 for(const [n,l] of [['ko.po','ko'],['strings_ko.xml','ko'],['values-ja/strings.xml','ja'],['locales/ko-KR.json','ko-KR'],['messages.ja.json','ja'],['game.csv',null]])assert.equal(C.localeFromName(n),l,n);
 assert.equal(C.decodeText(new Uint8Array([0xef,0xbb,0xbf,0xea,0xb0,0x80])),'가');
});
// Real translation files (MIT / Apache-2.0 excerpts, tests/fixtures/ui/l10n/LICENSES.md): the counts are
// the ones that file's own structure gives (entries with a Korean translation).
const L10N=new URL('./fixtures/ui/l10n/',import.meta.url);
const REAL={'po/pixelorama.ko_KR.po':31,'properties/tomcat-catalina-core.LocalStrings_ko.properties':40,'strings/stats.ko.Localizable.strings':50,
 'resx/humanizer.Resources.ko-KR.resx':40,'android/thunderbird-legacy.values-ko.strings.xml':50,'xliff/keepingyouawake.ko.xliff':21,'xliff/dotnet-sign.Resources.ko.xlf':38,
 'json/pokeclicker.settings.ko.json':40,'json/pokeclicker.questlines.ko.json':60,'csv/gravita-maze.StringTable.unity-localization.csv':40,'unity/gravita-maze.StringTable_ko.asset':30,
 'csv/udesktopmascot.LocalizationTable.csv':16,'godot/zip-launcher.Translations.csv':8,'godot/gohud.csv':16,'godot/zip-launcher.ko.godot472-serialized.tres':8};
test('real translation files of every format give exactly their Korean strings',()=>{
 for(const [f,n] of Object.entries(REAL)){
  const r=C.readTranslations(f.split('/')[1],readFileSync(new URL(f,L10N)));
  const ko=r.columns.length?r.entries.filter(e=>/^ko/.test(e.locale||'')):r.entries;
  assert.equal(ko.length,n,f);
  assert.ok(ko.every(e=>e.text&&!/^\s*$/.test(e.text)),f+': no empty strings');
 }
 // Unity Localization CSV headers name the locale in brackets; the Key and Id columns are not text
 const u=C.readTranslations('StringTable.csv',readFileSync(new URL('csv/gravita-maze.StringTable.unity-localization.csv',L10N)));
 assert.deepEqual(u.columns.map(c=>c.locale),['en','ko']);
 // a \u-escaped YAML scalar reads as one string, same text as the CSV export of the same table
 const a=C.readTranslations('StringTable_ko.asset',readFileSync(new URL('unity/gravita-maze.StringTable_ko.asset',L10N)));
 assert.equal(a.format,'unity');assert.equal(a.entries[0].text,u.entries.find(e=>e.locale==='ko').text);
 assert.throws(()=>C.readTranslations('x.translation',readFileSync(new URL('godot/zip-launcher.Translations.ko.translation',L10N))),/compiled Godot resource/);
 // the .resx schema comment has a sample <data> entry that is not text
 assert.ok(!C.readTranslations('r.resx',readFileSync(new URL('resx/humanizer.Resources.ko-KR.resx',L10N))).entries.some(e=>e.text==='this is my long string'));
});
// Ground truth from full game files (GPL, local corpus only), counted independently in Python
// (scratchpad p5/studio-ui/l10n/ko_groundtruth.py): strings, and unique characters without whitespace/control.
const ADHOC='C:/Users/2009s/nerulio-asset-corpus/_adhoc/nerulio-studio-ui/l10n/';
const GT=[['mindustry/bundle_ko.properties',3496,854],['supertux/ko.po',1310,615],['pixelorama/ko_KR.po',608,444]];
test('full game translation files: string and character counts equal the independent ground truth',{skip:!existsSync(ADHOC+GT[0][0])},()=>{
 for(const [f,strings,chars] of GT){
  const r=C.readTranslations(f,readFileSync(ADHOC+f));assert.equal(r.entries.length,strings,f);
  const cs=C.buildCharset([{id:'a',kind:'file',file:r}],{strip:false});
  assert.equal(cs.codepoints.filter(c=>c!==0x20).length,chars,f+' (unique visible characters, space aside)');
 }
});
