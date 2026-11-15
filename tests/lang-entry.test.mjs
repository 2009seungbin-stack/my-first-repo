import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {languageEntryPage,LANGUAGE_HINTS} from '../tools/language-entry-build.mjs';
import {STORAGE_KEY,LOCALES} from '../src/i18n.js';
const source=readFileSync(new URL('../src/lang-entry.js',import.meta.url),'utf8');
// Runs the classic script against a minimal page: returns where it redirected, the picker links and the store.
function run({search='',hash='',saved=null,languages=['en-US']}={}){
 const store=new Map(saved?[[STORAGE_KEY,saved]]:[]),ready=[];let replaced=null;
 const links=LOCALES.map(l=>{const attrs={'data-lang':l,'data-hint-saved':LANGUAGE_HINTS[l].saved,'data-hint-browser':LANGUAGE_HINTS[l].browser},b={children:[],appendChild(e){this.children.push(e);}},on={};
  return {l,b,on,className:'',getAttribute:k=>attrs[k]??null,setAttribute(k,v){attrs[k]=v;},attrs,querySelector:()=>b,addEventListener(t,f){on[t]=f;}};});
 vm.runInNewContext(source,{URL,URLSearchParams,location:{search,hash,replace(u){replaced=u;}},navigator:{languages},
  localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){store.set(k,v);}},
  document:{baseURI:'https://nerulio.example.test/',addEventListener(t,f){if(t==='DOMContentLoaded')ready.push(f);},querySelectorAll:()=>links,createElement:()=>({textContent:''})}});
 ready.forEach(f=>f());
 return {replaced,links,store};
}
test('language entry: ?lang, then the saved choice, then the browser languages, then English',()=>{
 assert.equal(run({languages:['fr-FR','ja-JP','ko']}).replaced,'https://nerulio.example.test/ja/');
 assert.equal(run({languages:['fr-FR']}).replaced,'https://nerulio.example.test/en/');
 assert.equal(run({saved:'ko',languages:['ja']}).replaced,'https://nerulio.example.test/ko/');
 assert.equal(run({search:'?lang=ja&utm=x',hash:'#tools',saved:'ko'}).replaced,'https://nerulio.example.test/ja/?utm=x#tools');
});
test('language entry: ?choose keeps the picker, marks the current language and remembers a click',()=>{
 const {replaced,links,store}=run({search:'?choose',languages:['ja-JP','en']});
 assert.equal(replaced,null);
 const [ko,en,ja]=links;
 assert.deepEqual(ja.b.children.map(e=>e.textContent),[LANGUAGE_HINTS.ja.browser]);
 assert.equal(ja.className,'is-current');assert.equal(ja.attrs['aria-current'],'true');
 assert.equal(ko.b.children.length+en.b.children.length,0);assert.equal(en.className,'');
 assert.equal(store.size,0,'nothing is stored until a language is clicked');
 ko.on.click();assert.equal(store.get(STORAGE_KEY),'ko');
 // with a saved choice, that language is the marked one and the browser language keeps its hint
 const again=run({search:'?choose',saved:'ko',languages:['ja-JP']});
 assert.equal(again.links[0].className,'is-current');assert.equal(again.links[2].className,'');
 assert.deepEqual(again.links[0].b.children.map(e=>e.textContent),[LANGUAGE_HINTS.ko.saved]);
 assert.deepEqual(again.links[2].b.children.map(e=>e.textContent),[LANGUAGE_HINTS.ja.browser]);
 assert.equal(run({search:'?choose',saved:'ko',languages:['ko-KR']}).links[0].b.children.length,1,'one hint per language');
});
test('language entry page carries the hints for every language',()=>{
 const html=languageEntryPage({base:'/',headHTML:''});
 for(const l of LOCALES)assert(html.includes(`<a href="${l}/" hreflang="${l}" lang="${l}" data-lang="${l}" data-hint-saved="${LANGUAGE_HINTS[l].saved}" data-hint-browser="${LANGUAGE_HINTS[l].browser}">`),l);
});
