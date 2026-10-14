import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNames,sizeProblem,fitSize,fateLabel,rigIndex,draw,inOrder,newBoard,entrant,nextMatch,champion,setWinner,pickWinner,encodeShare,decodeShare,rigHolds} from '../src/bracket/engine.js';
import {matchPlatformRoute,renderPlatformPage,renderSitemap,canonicalQuery} from '../server/platform/pages.js';
import {FUN_TOOLS} from '../platform/tools-nav.js';
import {ICON_NAMES} from '../platform/render/icons.js';
import {D1Shim} from './d1-shim.mjs';

/** A seeded random source, so a failure can be replayed. @param {number} seed */
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
const NAMES=Array.from({length:32},(_,i)=>`P${i+1}`);
/** Play a board to the end with the rigged random pick; returns name index → wins (byes count). */
function playOut(b,fate,rand){
 for(let at=nextMatch(b);at;at=nextMatch(b))assert(setWinner(b,at.r,at.m,pickWinner(b,at.r,at.m,fate,rand)));
 const wins=new Map();for(const w of b.win.flat())wins.set(w,(wins.get(w)||0)+1);
 return wins;
}
/** @param {number[]} slots @param {number} n */
function checkSlots(slots,n){
 const seen=slots.filter(x=>x>=0);assert.equal(seen.length,n);assert.equal(new Set(seen).size,n);
 for(let m=0;m<slots.length/2;m++)assert(!(slots[2*m]<0&&slots[2*m+1]<0),'two byes never meet');
}

test('names: trimmed, split on lines/commas/tabs, repeats numbered, size limits',()=>{
 assert.deepEqual(parseNames(' 민수 \n\n지영,  현우\t민수\n민수'),['민수','지영','현우','민수 (2)','민수 (3)']);
 assert.equal(parseNames('x'.repeat(60))[0].length,24);
 assert.equal(sizeProblem(1,16),'few');assert.equal(sizeProblem(17,16),'many');assert.equal(sizeProblem(8,16),'sparse');assert.equal(sizeProblem(9,16),'');assert.equal(sizeProblem(16,16),'');
 assert.equal(fitSize(3),4);assert.equal(fitSize(9),16);assert.equal(fitSize(33),0);
 assert.deepEqual([0,1,2,3,4].map(d=>fateLabel(d,16,'ko')),['우승','준우승','4강 탈락','8강 탈락','16강 탈락']);
});

test('plain draws place everyone once with byes one per match; byes advance on their own',()=>{
 const rand=rng(7);
 for(const [n,size] of [[16,16],[9,16],[13,16],[5,8],[3,4],[32,32],[17,32]]){
  for(let k=0;k<50;k++){const {slots,ok}=draw(n,size,{fate:new Map(),pair:new Map()},rand);assert(ok);checkSlots(slots,n);}
  const b=newBoard(inOrder(n,size));checkSlots(b.slots,n);
  assert.equal(b.win[0].filter(x=>x>=0).length,size-n,'every bye is already decided');
  const wins=playOut(b,new Map(),rand);assert(champion(b)>=0);assert.equal([...wins.values()].reduce((a,c)=>a+c,0),size-1);
 }
 // A draw is not always the same order.
 const a=draw(16,16,{fate:new Map(),pair:new Map()},rng(1)).slots.join(),b=draw(16,16,{fate:new Map(),pair:new Map()},rng(2)).slots.join();assert.notEqual(a,b);
});

test('rigged draws come true when played with the random pick (finish and first-round pairs)',()=>{
 const rand=rng(42);
 const cases=[
  {n:16,size:16,fate:{P5:0,P9:1},pair:{}},
  {n:16,size:16,fate:{P1:0},pair:{P2:'P3',P3:'P2'}},
  {n:16,size:16,fate:{P1:0,P2:1,P3:2,P4:2,P5:3},pair:{P6:'P7',P7:'P6'}},
  {n:12,size:16,fate:{P12:0,P11:4,P10:4},pair:{}}, // first-match losers never get a bye
  {n:16,size:16,fate:{P2:4},pair:{P2:'P1',P1:'P2'}},
  {n:32,size:32,fate:{P32:0,P31:1,P30:2,P29:2},pair:{P1:'P2',P2:'P1',P3:'P4',P4:'P3'}},
  {n:5,size:8,fate:{P3:0,P4:1},pair:{}},
 ];
 for(const c of cases){
  const names=NAMES.slice(0,c.n),rig=rigIndex(names,c.size,{fate:c.fate,pair:c.pair});
  for(let k=0;k<120;k++){
   const {slots,ok}=draw(c.n,c.size,rig,rand);assert(ok,JSON.stringify(c));checkSlots(slots,c.n);
   for(const [a,b] of rig.pair)assert.equal(slots.indexOf(a)^1,slots.indexOf(b),'pair meets in round one');
   const wins=playOut(newBoard(slots),rig.fate,rand);
   for(const [p,t] of rig.fate)assert.equal(wins.get(p)||0,t,`${names[p]} finishes as rigged`);
  }
 }
});

test('a fully decided 16 (every finish set) is still drawn',()=>{
 const names=NAMES.slice(0,16),fate={};
 [0,1,2,2,3,3,3,3,4,4,4,4,4,4,4,4].forEach((d,i)=>{fate[names[i]]=d;});
 const rig=rigIndex(names,16,{fate,pair:{}});
 for(let k=0;k<40;k++){const {slots,ok}=draw(16,16,rig,rng(100+k));assert(ok);assert(rigHolds(slots,rig.fate));}
});

test('impossible rigs are reported and fall back to a plain draw',()=>{
 const names=NAMES.slice(0,16);
 for(const r of [
  {fate:{P1:0,P2:0},pair:{}}, // two champions
  {fate:{P1:0,P2:1},pair:{P1:'P2',P2:'P1'}}, // the final pair cannot meet in round one
  {fate:{P1:2,P2:2,P3:2,P4:2,P5:2},pair:{}}, // five semifinal losers
 ]){const res=draw(16,16,rigIndex(names,16,r),rng(3));assert.equal(res.ok,false);checkSlots(res.slots,16);}
 // One-sided pairs (stale data) are ignored rather than half-applied.
 assert.equal(rigIndex(names,16,{fate:{},pair:{P1:'P2'}}).pair.size,0);
 // Finishes beyond this size (a 32 rig on an 8 board) drop out.
 assert.equal(rigIndex(NAMES.slice(0,8),8,{fate:{P1:5},pair:{}}).fate.size,0);
});

test('manual winners: changing an earlier result clears what the old winner reached',()=>{
 const b=newBoard(inOrder(4,4));
 assert(setWinner(b,0,0,0));assert(setWinner(b,0,1,2));assert(setWinner(b,1,0,0));assert.equal(champion(b),0);
 assert(setWinner(b,0,0,1));assert.equal(b.win[1][0],-1,'the final reopens');assert.equal(entrant(b,1,0),1);
 assert.equal(setWinner(b,0,0,3),false,'not in that match');
 assert.equal(setWinner(b,1,0,1),true);assert.equal(champion(b),1);
});

test('share links round-trip, keep the rig unreadable, and reject junk',()=>{
 const d={title:'라면 월드컵',size:16,names:['신라면','진라면','짜파게티'],rig:{fate:{'신라면':0},pair:{}}};
 const s=encodeShare(d);assert.match(s,/^[\w-]+$/);
 assert(!Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8').includes('신라면'));
 const back=decodeShare(s);assert.deepEqual(back,{title:d.title,size:16,names:d.names,rig:d.rig});
 const plain=decodeShare(encodeShare({...d,rig:null}));assert.deepEqual(plain?.rig,{fate:{},pair:{}});
 for(const junk of ['','abc','!!!',encodeShare({title:'',size:16,names:[]}).slice(0,5)])assert.equal(decodeShare(junk),null);
});

test('the page: route, nav entry, structured data, sitemap and no query parameters',async()=>{
 assert.deepEqual(matchPlatformRoute('/ko/bracket/'),{l:'ko',page:'bracket'});
 assert.equal(matchPlatformRoute('/ko/bracket'),null);assert.equal(matchPlatformRoute('/ja/bracket/'),null);
 assert.equal(canonicalQuery('bracket',new URLSearchParams('x=1')),'');
 for(const x of FUN_TOOLS)assert(ICON_NAMES.includes(x.svg));
 const db=D1Shim.migrated();
 for(const l of ['ko','en']){
  const res=await renderPlatformPage(new Request(`https://nerulio.com/${l}/bracket/`),{DB:db},{origin:'https://nerulio.com/'});assert.equal(res.status,200);
  const body=await res.text();
  assert(body.includes('data-island="bracket"')&&body.includes('nav-fun')&&body.includes(`href="/${l}/bracket/"`)&&body.includes('"FAQPage"'));
  assert(body.includes(`<link rel="canonical" href="https://nerulio.com/${l}/bracket/">`));
 }
 const r=await renderPlatformPage(new Request('https://nerulio.com/ko/bracket/?utm=1'),{DB:db},{origin:'https://nerulio.com/'});assert.equal(r.status,301);
 const xml=await renderSitemap(db,'ai','https://nerulio.com');assert(xml.includes('https://nerulio.com/ko/bracket/')&&xml.includes('https://nerulio.com/en/bracket/'));
 db.raw.close();
});
