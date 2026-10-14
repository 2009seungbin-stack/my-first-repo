// @ts-check
/** Tournament bracket logic for /{l}/bracket/: the draw, byes, winners and saved seatings.
 * A bracket of `size` slots (4 · 8 · 16 · 32) has R=log2(size) rounds. slots[i] is a name index or -1
 * (a bye); win[r][m] is the winner of match m in round r (between the entrants 2m and 2m+1), -1 = open.
 * A seating plan fixes who meets whom: `pairs` names first-round opponents (everyone else is drawn), and
 * `fixed` gives every seat. A fixed seating is redrawn by flipping the halves of random sub-brackets, so
 * each draw looks new while every possible meeting stays the same. With `cue` the plan waits: draws stay
 * random until the organiser gives the signal on the page (a prank feature, stated in the page's FAQ). */

export const SIZES=Object.freeze([4,8,16,32]);
export const MAX_NAME=24,MAX_TITLE=40;

/** @typedef {''|'pairs'|'fixed'|'typed'} PlanMode  typed: names meet in their typed order (1–2, 3–4, …) */
/** @typedef {{mode:PlanMode,pair:Record<string,string>,seats:string[],cue:boolean}} Plan  seats: a name or '' (bye) per slot */
/** @typedef {{slots:number[],win:number[][]}} Board */

/** @param {number} size */
export const roundsOf=size=>Math.round(Math.log2(size));
/** @returns {Plan} */
export const emptyPlan=()=>({mode:'',pair:{},seats:[],cue:false});
/** @param {Plan|null|undefined} p */
export const planActive=p=>!!p&&(p.mode==='typed'||(p.mode==='pairs'&&Object.keys(p.pair||{}).length>0)||(p.mode==='fixed'&&(p.seats||[]).some(Boolean)));

/** Participants from free text: one per line (commas and tabs also split a pasted list), trimmed,
 * empty lines dropped, and repeated names numbered ("민수", "민수 (2)") so every slot is distinct.
 * @param {string} text */
export function parseNames(text){
 const out=/** @type {string[]} */([]),seen=new Map();
 for(const raw of String(text).split(/[\n,\t]+/)){
  const base=raw.replace(/\s+/g,' ').trim().slice(0,MAX_NAME);if(!base)continue;
  const n=(seen.get(base)||0)+1;seen.set(base,n);
  out.push(n===1?base:`${base} (${n})`);
 }
 return out;
}

/** The smallest bracket that holds n entrants (at least 4), or 0 when n is over 32. @param {number} n */
export const fitSize=n=>SIZES.find(s=>s>=n)||0;

/** Why n names cannot fill a bracket of `size`, or '' when they can. A bracket needs more than half its
 * slots filled: byes sit at most one per first-round match. @param {number} n @param {number} size */
export function sizeProblem(n,size){
 if(n<2)return 'few';
 if(n>size)return 'many';
 if(n<=size/2)return 'sparse';
 return '';
}

/** A random integer below n. @param {()=>number} rand @param {number} n */
const pick=(rand,n)=>Math.floor(rand()*n);
/** @template T @param {T[]} a @param {()=>number} rand */
export function shuffle(a,rand=Math.random){for(let i=a.length-1;i>0;i--){const j=pick(rand,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}

/** First-round opponents in name indexes; only pairs named from both sides count. @param {string[]} names @param {Plan|null|undefined} plan */
export function pairIndex(names,plan){
 const idx=new Map(names.map((n,i)=>[n,i])),pair=/** @type {Map<number,number>} */(new Map());
 for(const [a,b] of Object.entries(plan?.pair||{})){const i=idx.get(a),j=idx.get(b);if(i!==undefined&&j!==undefined&&i!==j&&plan?.pair?.[b]===a)pair.set(i,j);}
 return pair;
}

/**
 * A random first round: byes at most one per match, the given pairs together in matches without a bye,
 * everyone else anywhere. `ok` is false when the pairs do not fit (then it is a plain draw).
 * @param {number} n @param {number} size @param {Map<number,number>} [pair] @param {()=>number} [rand]
 * @returns {{slots:number[],ok:boolean}}
 */
export function draw(n,size,pair=new Map(),rand=Math.random){
 const half=size/2,byes=size-n,units=/** @type {number[][]} */([]),done=new Set();
 for(const [a,b] of pair)if(!done.has(a)&&!done.has(b)){done.add(a);done.add(b);units.push(shuffle([a,b],rand));}
 const ok=units.length<=half-byes;
 const slots=new Array(size).fill(-2),matches=shuffle([...Array(half).keys()],rand);
 if(ok)for(const u of units){const m=/** @type {number} */(matches.pop());slots[2*m]=u[0];slots[2*m+1]=u[1];}
 for(const m of matches.slice(0,byes))slots[2*m+pick(rand,2)]=-1;
 const rest=shuffle([...Array(n).keys()].filter(p=>!ok||!done.has(p)),rand);
 for(let i=0;i<size;i++)if(slots[i]===-2)slots[i]=/** @type {number} */(rest.pop());
 return {slots,ok};
}

/** Flip the two halves of random sub-brackets (any size, the whole bracket included): the picture
 * changes, but who can meet whom in every round does not. @param {number[]} slots @param {()=>number} [rand] */
export function mirror(slots,rand=Math.random){
 const s=slots.slice();
 for(let w=2;w<=s.length;w*=2)for(let at=0;at<s.length;at+=w)if(rand()<.5){const h=w/2,a=s.slice(at,at+h);for(let k=0;k<h;k++){s[at+k]=s[at+h+k];s[at+h+k]=a[k];}}
 return s;
}

/** A saved seating fitted to the names and size of now: names that are still in keep their seat, new names
 * take the free seats at random, and a match left with two byes borrows a player from a full match.
 * @param {string[]} names @param {number} size @param {string[]} seats @param {()=>number} [rand] */
export function fitSeats(names,size,seats,rand=Math.random){
 const idx=new Map(names.map((n,i)=>[n,i])),slots=new Array(size).fill(-2),used=new Set();
 for(let i=0;i<size;i++){const p=idx.get(seats[i]??'');if(p!==undefined&&!used.has(p)){slots[i]=p;used.add(p);}}
 const free=shuffle([...Array(size).keys()].filter(i=>slots[i]===-2),rand),left=shuffle([...Array(names.length).keys()].filter(p=>!used.has(p)),rand);
 // New names go first to seats facing a player, so the byes stay spread out.
 free.sort((a,b)=>Number(slots[b^1]>=0)-Number(slots[a^1]>=0));
 for(const i of free)slots[i]=left.length?/** @type {number} */(left.shift()):-1;
 for(let m=0;m<size/2;m++)if(slots[2*m]<0&&slots[2*m+1]<0){
  const full=[...Array(size/2).keys()].find(k=>slots[2*k]>=0&&slots[2*k+1]>=0);if(full===undefined)break;
  slots[2*m]=slots[2*full+1];slots[2*full+1]=-1;
 }
 return slots;
}

/** Seats as names ('' = bye), for storing and editing. @param {number[]} slots @param {string[]} names */
export const seatNames=(slots,names)=>slots.map(i=>i>=0?names[i]:'');

/** The first round for a plan: a fixed seating or the typed order (both flipped as in mirror()), drawn pairs,
 * or a plain draw.
 * @param {string[]} names @param {number} size @param {Plan|null|undefined} plan @param {()=>number} [rand] */
export function drawPlan(names,size,plan,rand=Math.random){
 if(plan?.mode==='fixed'&&planActive(plan))return mirror(fitSeats(names,size,plan.seats,rand),rand);
 if(plan?.mode==='typed')return mirror(inOrder(names.length,size),rand);
 return draw(names.length,size,plan?.mode==='pairs'?pairIndex(names,plan):new Map(),rand).slots;
}

/** Can these pairs be seated together in a bracket of `size`? @param {number} n @param {number} size @param {Map<number,number>} pair */
export const pairsFit=(n,size,pair)=>pair.size/2<=size/2-(size-n);

/** Names in their typed order with byes spread one per match from the bottom (the "seed order" draw).
 * @param {number} n @param {number} size */
export function inOrder(n,size){
 const slots=new Array(size).fill(-1),byes=size-n,half=size/2;let p=0;
 for(let m=0;m<half;m++){slots[2*m]=p++;if(m<half-byes)slots[2*m+1]=p++;}
 return slots;
}

/** A fresh board for a first round; byes advance at once. @param {number[]} slots @returns {Board} */
export function newBoard(slots){
 const R=roundsOf(slots.length),win=[];
 for(let r=0;r<R;r++)win.push(new Array(slots.length>>(r+1)).fill(-1));
 const b={slots:slots.slice(),win};settleByes(b);return b;
}
/** The entrant in slot i of round r (r=0: the drawn names). @param {Board} b @param {number} r @param {number} i */
export const entrant=(b,r,i)=>r===0?b.slots[i]:b.win[r-1][i];
/** Is round r slot i still waiting for an earlier match? (-1 there means "not decided yet", not a bye.) */
const pending=(/** @type {Board} */ b,/** @type {number} */ r,/** @type {number} */ i)=>r>0&&b.win[r-1][i]<0;
/** First-round byes: the other entrant goes through. @param {Board} b */
function settleByes(b){
 for(let m=0;m<b.win[0].length;m++){const a=b.slots[2*m],c=b.slots[2*m+1];if(b.win[0][m]<0&&(a<0)!==(c<0))b.win[0][m]=a<0?c:a;}
}
/** Can match m of round r be played now (both entrants known, not decided)? @param {Board} b @param {number} r @param {number} m */
export function ready(b,r,m){
 if(b.win[r][m]>=0)return false;
 return !pending(b,r,2*m)&&!pending(b,r,2*m+1)&&entrant(b,r,2*m)>=0&&entrant(b,r,2*m+1)>=0;
}
/** The next match to play, round by round, top to bottom; null when the tournament is over. @param {Board} b */
export function nextMatch(b){
 for(let r=0;r<b.win.length;r++)for(let m=0;m<b.win[r].length;m++)if(ready(b,r,m))return {r,m};
 return null;
}
/** The champion, or -1. @param {Board} b */
export const champion=b=>b.win[b.win.length-1][0];

/** Put entrant `w` through match m of round r. Changing an earlier result clears the later matches that the
 * old winner had reached. Returns false when w is not in that match. @param {Board} b @param {number} r @param {number} m @param {number} w */
export function setWinner(b,r,m,w){
 const a=entrant(b,r,2*m),c=entrant(b,r,2*m+1);
 if(w<0||(w!==a&&w!==c)||pending(b,r,2*m)||pending(b,r,2*m+1))return false;
 const old=b.win[r][m];b.win[r][m]=w;
 if(old>=0&&old!==w)for(let rr=r+1,mm=m>>1;rr<b.win.length;rr++,mm>>=1){if(b.win[rr][mm]<0)break;b.win[rr][mm]=-1;}
 return true;
}
/** A coin flip between the two entrants of a ready match. @param {Board} b @param {number} r @param {number} m @param {()=>number} [rand] */
export const pickWinner=(b,r,m,rand=Math.random)=>rand()<.5?entrant(b,r,2*m):entrant(b,r,2*m+1);

/* Packed data (share links #b=… and the stored seating): JSON scrambled with a fixed key, then base64url. */
const KEY=[0x6e,0x31,0x72,0x75,0x6c,0x69,0x6f,0x5f,0x76,0x73];
/** @param {Uint8Array} bytes */
function scramble(bytes){const out=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)out[i]=bytes[i]^KEY[i%KEY.length]^(i*29&255);return out;}
/** @param {unknown} o */
export function pack(o){
 let bin='';for(const x of scramble(new TextEncoder().encode(JSON.stringify(o))))bin+=String.fromCharCode(x);
 return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/** @param {string} s @returns {any} */
export function unpack(s){
 try{return JSON.parse(new TextDecoder().decode(scramble(Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))));}catch{return null;}
}
/** A plan read back from stored or shared data, with anything malformed dropped. @param {any} o @returns {Plan} */
export function cleanPlan(o){
 const p=emptyPlan();if(!o||typeof o!=='object')return p;
 if(o.m==='pairs'||o.m==='fixed'||o.m==='typed')p.mode=o.m;
 for(const [k,v] of Object.entries(o.p||{}))if(typeof v==='string'&&o.p[v]===k)p.pair[k]=v;
 p.cue=o.c===1;
 if(Array.isArray(o.a)&&o.a.length<=32)p.seats=o.a.map((/** @type {unknown} */ x)=>typeof x==='string'?x.slice(0,MAX_NAME+5):'');
 return p;
}
/** @param {Plan} p */
export const planData=p=>({m:p.mode,p:p.pair,a:p.seats,...(p.cue?{c:1}:{})});

/** @param {{title:string,size:number,names:string[],plan?:Plan|null}} d */
export const encodeShare=d=>pack({v:1,t:d.title||'',s:d.size,n:d.names,...(planActive(d.plan)?{r:planData(/** @type {Plan} */(d.plan))}:{})});
/** @param {string} s @returns {{title:string,size:number,names:string[],plan:Plan}|null} */
export function decodeShare(s){
 const o=unpack(s);
 if(!o||o.v!==1||!Array.isArray(o.n))return null;
 const names=parseNames(o.n.map(String).join('\n')).slice(0,32),size=SIZES.includes(o.s)?o.s:fitSize(names.length)||16;
 return {title:String(o.t||'').slice(0,MAX_TITLE),size,names,plan:cleanPlan(o.r)};
}
