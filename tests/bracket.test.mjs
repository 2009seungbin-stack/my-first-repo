import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNames,sizeProblem,fitSize,pairIndex,pairsFit,draw,mirror,fitSeats,seatNames,drawPlan,inOrder,newBoard,entrant,nextMatch,champion,setWinner,pickWinner,encodeShare,decodeShare,pack,unpack,cleanPlan,planActive} from '../src/bracket/engine.js';
import {matchPlatformRoute,renderPlatformPage,renderSitemap,canonicalQuery} from '../server/platform/pages.js';
import {FUN_TOOLS} from '../platform/tools-nav.js';
import {ICON_NAMES} from '../platform/render/icons.js';
import {D1Shim} from './d1-shim.mjs';

/** A seeded random source, so a failure can be replayed. @param {number} seed */
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
const NAMES=Array.from({length:32},(_,i)=>`P${i+1}`);
/** @param {number[]} slots @param {number} n */
function checkSlots(slots,n){
 const seen=slots.filter(x=>x>=0);assert.equal(seen.length,n);assert.equal(new Set(seen).size,n);
 for(let m=0;m<slots.length/2;m++)assert(!(slots[2*m]<0&&slots[2*m+1]<0),'two byes never meet');
}
/** For every two players, the round where they can meet (the highest bit where their seats differ). @param {number[]} slots */
function meetings(slots){
 const at=new Map(slots.map((p,i)=>[p,i]).filter(([p])=>p>=0)),out={};
 for(const [a,i] of at)for(const [b,j] of at)if(a<b)out[`${a}-${b}`]=31-Math.clz32(i^j);
 return out;
}

test('names: trimmed, split on lines/commas/tabs, repeats numbered, size limits',()=>{
 assert.deepEqual(parseNames(' 민수 \n\n지영,  현우\t민수\n민수'),['민수','지영','현우','민수 (2)','민수 (3)']);
 assert.equal(parseNames('x'.repeat(60))[0].length,24);
 assert.equal(sizeProblem(1,16),'few');assert.equal(sizeProblem(17,16),'many');assert.equal(sizeProblem(8,16),'sparse');assert.equal(sizeProblem(9,16),'');assert.equal(sizeProblem(16,16),'');
 assert.equal(fitSize(3),4);assert.equal(fitSize(9),16);assert.equal(fitSize(33),0);
});

test('plain draws place everyone once with byes one per match; byes advance on their own',()=>{
 const rand=rng(7);
 for(const [n,size] of [[16,16],[9,16],[13,16],[5,8],[3,4],[32,32],[17,32]]){
  for(let k=0;k<50;k++){const {slots,ok}=draw(n,size,new Map(),rand);assert(ok);checkSlots(slots,n);}
  const b=newBoard(inOrder(n,size));checkSlots(b.slots,n);
  assert.equal(b.win[0].filter(x=>x>=0).length,size-n,'every bye is already decided');
  for(let at=nextMatch(b);at;at=nextMatch(b))assert(setWinner(b,at.r,at.m,pickWinner(b,at.r,at.m,rand)));
  assert(champion(b)>=0);
 }
 assert.notEqual(draw(16,16,new Map(),rng(1)).slots.join(),draw(16,16,new Map(),rng(2)).slots.join());
});

test('first-opponent pairs always meet in round one; too many pairs for the byes is refused',()=>{
 const rand=rng(42),names=NAMES.slice(0,16);
 const plan={mode:'pairs',pair:{P1:'P2',P2:'P1',P3:'P9',P9:'P3',P16:'P5',P5:'P16'},seats:[]};
 const pair=pairIndex(names,plan);assert.equal(pair.size,6);
 for(let k=0;k<200;k++){const s=drawPlan(names,16,plan,rand);checkSlots(s,16);for(const [a,b] of pair)assert.equal(s.indexOf(a)^1,s.indexOf(b));}
 // 11 players in a 16: 5 byes leave 3 full matches, so 3 pairs fit and 4 do not.
 const few=NAMES.slice(0,11),three={P1:'P2',P2:'P1',P3:'P4',P4:'P3',P5:'P6',P6:'P5'};
 assert(pairsFit(11,16,pairIndex(few,{mode:'pairs',pair:three,seats:[]})));
 assert(!pairsFit(11,16,pairIndex(few,{mode:'pairs',pair:{...three,P7:'P8',P8:'P7'},seats:[]})));
 for(let k=0;k<100;k++){const {slots,ok}=draw(11,16,pairIndex(few,{mode:'pairs',pair:three,seats:[]}),rand);assert(ok);checkSlots(slots,11);for(const [a,b] of [[0,1],[2,3],[4,5]])assert.equal(slots.indexOf(a)^1,slots.indexOf(b));}
 // One-sided pairs (stale data) are ignored rather than half-applied.
 assert.equal(pairIndex(names,{mode:'pairs',pair:{P1:'P2'},seats:[]}).size,0);
});

test('a fixed seating: every draw looks different, every meeting stays',()=>{
 const rand=rng(9);
 for(const [n,size] of [[16,16],[12,16],[8,8],[32,32],[4,4]]){
  const names=NAMES.slice(0,n),seats=seatNames(draw(n,size,new Map(),rand).slots,names),plan={mode:'fixed',pair:{},seats};
  assert(planActive(plan));
  const want=meetings(fitSeats(names,size,seats)),looks=new Set();
  for(let k=0;k<60;k++){const s=drawPlan(names,size,plan,rand);checkSlots(s,n);assert.deepEqual(meetings(s),want);looks.add(s.join());}
  assert(looks.size>(size>=8?20:2),`${size}: the picture changes (${looks.size} looks)`);
 }
 const s=[...Array(16).keys()];for(let k=0;k<50;k++)assert.deepEqual(meetings(mirror(s,rand)),meetings(s));
});

test('typed order: 1st meets 2nd, 3rd meets 4th, the pairs of pairs meet next; the picture is shuffled',()=>{
 const rand=rng(5),plan={mode:'typed',pair:{},seats:[],cue:false};
 assert(planActive(plan));
 assert.equal(cleanPlan(unpack(pack({m:'typed',p:{},a:[]}))).mode,'typed');
 for(const [n,size] of [[16,16],[11,16],[8,8],[32,32]]){
  const want=meetings(inOrder(n,size)),looks=new Set();
  for(let k=0;k<40;k++){const s=drawPlan(NAMES.slice(0,n),size,plan,rand);checkSlots(s,n);assert.deepEqual(meetings(s),want);looks.add(s.join());}
  assert(looks.size>10,`${size}: the picture changes`);
  const s=drawPlan(NAMES.slice(0,n),size,plan,rand);
  assert.equal(s.indexOf(0)^1,s.indexOf(1),'1st meets 2nd');
  if(n===16)assert.equal(s.indexOf(0)>>2,s.indexOf(3)>>2,'1st can meet 4th in round two');
 }
});

test('an exact seating comes out as saved on every draw',()=>{
 const rand=rng(3),names=['1-1','1-2','1-3','1-4','1-5','1-6','1-7','1-8','2-1','2-2','2-3','2-4','2-5','2-6','2-7','2-8'];
 const seats=['2-1','2-8','2-2','1-1','2-4','1-3','1-6','1-4','2-3','1-2','2-6','1-7','1-8','2-7','2-5','1-5'];
 for(let k=0;k<20;k++)assert.deepEqual(seatNames(drawPlan(names,16,{mode:'fixed',pair:{},seats,cue:true,exact:true},rand),names),seats);
});

test('a saved seating follows edits to the names: kept seats stay, new names fill, no double byes',()=>{
 const names=NAMES.slice(0,16),seats=names.slice();
 assert.deepEqual(fitSeats(names,16,seats),[...Array(16).keys()]);
 const edited=names.filter(x=>x!=='P3').concat('Q'),f=fitSeats(edited,16,seats);
 assert.equal(edited[f[2]],'Q');for(let i=0;i<16;i++)if(i!==2)assert.equal(edited[f[i]],seats[i]);
 const fewer=names.filter(x=>x!=='P1'&&x!=='P2');
 for(let k=0;k<30;k++)checkSlots(fitSeats(fewer,16,seats,rng(k+1)),14);
 checkSlots(fitSeats(NAMES.slice(0,8),8,seats),8);checkSlots(fitSeats(NAMES.slice(0,20),32,seats),20);
});

test('manual winners: changing an earlier result clears what the old winner reached',()=>{
 const b=newBoard(inOrder(4,4));
 assert(setWinner(b,0,0,0));assert(setWinner(b,0,1,2));assert(setWinner(b,1,0,0));assert.equal(champion(b),0);
 assert(setWinner(b,0,0,1));assert.equal(b.win[1][0],-1,'the final reopens');assert.equal(entrant(b,1,0),1);
 assert.equal(setWinner(b,0,0,3),false,'not in that match');
 assert.equal(setWinner(b,1,0,1),true);assert.equal(champion(b),1);
});

test('share links and stored data round-trip; junk is rejected',()=>{
 const plan={mode:'fixed',pair:{},seats:['신라면','','진라면','짜파게티'],cue:true,exact:true};
 const d={title:'라면 월드컵',size:4,names:['신라면','진라면','짜파게티'],plan};
 const s=encodeShare(d);assert.match(s,/^[\w-]+$/);
 assert.deepEqual(decodeShare(s),{title:d.title,size:4,names:d.names,plan});
 assert.equal(decodeShare(encodeShare({...d,plan:null}))?.plan.mode,'');
 assert.deepEqual(unpack(pack({a:[1,'가']})),{a:[1,'가']});
 assert.deepEqual(cleanPlan({m:'x',p:{a:'b'},a:'no'}),{mode:'',pair:{},seats:[],cue:false,exact:false});
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
  // The FAQ states the prank features plainly.
  assert(body.includes(l==='ko'?'장난용 기능 안내':'prank features')&&body.includes(l==='ko'?'공정한 추첨의 증거가 될 수 없습니다':'no proof of a fair draw'));
 }
 const r=await renderPlatformPage(new Request('https://nerulio.com/ko/bracket/?utm=1'),{DB:db},{origin:'https://nerulio.com/'});assert.equal(r.status,301);
 const xml=await renderSitemap(db,'ai','https://nerulio.com');assert(xml.includes('https://nerulio.com/ko/bracket/')&&xml.includes('https://nerulio.com/en/bracket/'));
 db.raw.close();
});
