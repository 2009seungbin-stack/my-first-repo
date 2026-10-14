// @ts-check
/** Tournament bracket logic for /{l}/bracket/: the draw, byes, winners, and the hidden prank rig.
 * A bracket of `size` slots (4 · 8 · 16 · 32) has R=log2(size) rounds. slots[i] is a name index or -1
 * (a bye); win[r][m] is the winner of match m in round r (between the entrants 2m and 2m+1), -1 = open.
 * The rig (조작) is set per name: `fate` = how far from the top they finish (0 우승, 1 준우승, 2 4강 탈락 …,
 * so it keeps its meaning when the size changes) and `pair` = whom they meet in their first match.
 * The draw places everyone so the rig can happen, and the random winner pick follows it. */

export const SIZES=Object.freeze([4,8,16,32]);
export const MAX_NAME=24,MAX_TITLE=40;

/** @typedef {{fate:Record<string,number>,pair:Record<string,string>}} Rig */
/** @typedef {{slots:number[],win:number[][]}} Board */

/** @param {number} size */
export const roundsOf=size=>Math.round(Math.log2(size));
/** @returns {Rig} */
export const emptyRig=()=>({fate:{},pair:{}});
/** @param {Rig|null|undefined} rig */
export const rigActive=rig=>!!rig&&(Object.keys(rig.fate||{}).length>0||Object.keys(rig.pair||{}).length>0);

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

/** Names of a finish (fate) in a bracket of `size`. @param {number} d @param {number} size @param {'ko'|'en'} l */
export function fateLabel(d,size,l){
 const R=roundsOf(size);
 if(d===0)return l==='ko'?'우승':'Champion';
 if(d===1)return l==='ko'?'준우승':'Runner-up';
 const wins=R-d;
 return l==='ko'?`${size>>wins}강 탈락`:`Out in the round of ${size>>wins}`;
}

/** The rig in name indexes for one list of names (names that left the list drop out).
 * @param {string[]} names @param {number} size @param {Rig|null|undefined} rig */
export function rigIndex(names,size,rig){
 const R=roundsOf(size),idx=new Map(names.map((n,i)=>[n,i]));
 const fate=/** @type {Map<number,number>} */(new Map()),pair=/** @type {Map<number,number>} */(new Map());
 for(const [n,d] of Object.entries(rig?.fate||{})){const i=idx.get(n);if(i!==undefined&&Number.isInteger(d)&&d>=0&&d<=R)fate.set(i,R-d);}
 for(const [a,b] of Object.entries(rig?.pair||{})){const i=idx.get(a),j=idx.get(b);if(i!==undefined&&j!==undefined&&i!==j&&rig?.pair?.[b]===a){pair.set(i,j);}}
 return {fate,pair};
}

/** Who wins a match when the rig decides: a rigged player wins while their target is still ahead of them;
 * between two rigged players the one with the higher target wins. Returns -1 when the rig has no say.
 * @param {number} a @param {number} b @param {number} r round (0 = first) @param {Map<number,number>} fate (name → wins) */
export function rigWinner(a,b,r,fate){
 if(a<0)return b;if(b<0)return a;
 const fa=fate.get(a),fb=fate.get(b);
 if(fa===undefined&&fb===undefined)return -1;
 if(fa!==undefined&&fb!==undefined)return fa===fb?-1:fa>fb?a:b;
 if(fa!==undefined)return fa>r?a:b;
 return /** @type {number} */(fb)>r?b:a;
}

/** Play the bracket out with the rig (open matches between unrigged players go to the first entrant) and
 * report whether every rigged player finishes exactly where the rig says. @param {number[]} slots @param {Map<number,number>} fate */
export function rigHolds(slots,fate){
 const wins=new Map();let cur=slots.slice(),r=0;
 while(cur.length>1){
  const next=[];
  for(let m=0;m<cur.length/2;m++){
   const a=cur[2*m],b=cur[2*m+1];
   if(a<0&&b<0)return false;
   const fa=fate.get(a),fb=fate.get(b);
   // Two rigged players who both have to win (or both have to lose) here cannot both get their way.
   if(a>=0&&b>=0&&fa!==undefined&&fb!==undefined&&(fa===fb||(fa>r&&fb>r)))return false;
   let w=rigWinner(a,b,r,fate);if(w<0)w=a;
   wins.set(w,(wins.get(w)||0)+1);next.push(w);
  }
  cur=next;r++;
 }
 for(const [p,t] of fate)if((wins.get(p)||0)!==t)return false;
 return true;
}

/** A random integer below n. @param {()=>number} rand @param {number} n */
const pick=(rand,n)=>Math.floor(rand()*n);
/** @template T @param {T[]} a @param {()=>number} rand */
export function shuffle(a,rand=Math.random){for(let i=a.length-1;i>0;i--){const j=pick(rand,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}

/** One random attempt at slots for the rig: byes first, then the pairs, then the rigged players from the
 * highest target down into leaves that keep their path clear, then everyone else. Null when stuck.
 * @param {number} n @param {number} size @param {{fate:Map<number,number>,pair:Map<number,number>}} rig @param {()=>number} rand */
function attempt(n,size,rig,rand){
 const slots=new Array(size).fill(-2),half=size/2;
 // Byes: at most one per first-round match, on a random side.
 for(const m of shuffle([...Array(half).keys()],rand).slice(0,size-n))slots[2*m+pick(rand,2)]=-1;
 const fate=rig.fate,placed=new Set();
 /** The leaves of the subtree of 2^k slots around leaf i. @param {number} i @param {number} k */
 const block=(i,k)=>{const w=1<<k,s=Math.floor(i/w)*w;return slots.slice(s,s+w);};
 /** Does leaf i keep a rigged player with `t` wins clear? @param {number} i @param {number} t */
 const fits=(i,t)=>{
  if(t===0&&slots[i^1]===-1)return false; // a bye would hand them a win
  if(block(i,t).some(x=>x>=0))return false; // nobody already placed may stand in the way of their t wins
  const other=block(i,t+1);return !other.some(x=>x>=0&&fate.get(x)===t); // nor meet an equal at round t
 };
 const units=/** @type {{p:number[],t:number}[]} */([]),inPair=new Set();
 for(const [a,b] of rig.pair)if(!inPair.has(a)&&!inPair.has(b)){inPair.add(a);inPair.add(b);units.push({p:shuffle([a,b],rand),t:Math.max(fate.get(a)??-1,fate.get(b)??-1)});}
 for(const [p,t] of fate)if(!inPair.has(p))units.push({p:[p],t});
 units.sort((x,y)=>y.t-x.t||y.p.length-x.p.length);
 for(const u of units){
  if(u.p.length===2){
   const open=shuffle([...Array(half).keys()].filter(m=>slots[2*m]===-2&&slots[2*m+1]===-2&&u.p.every((p,k)=>!fate.has(p)||fits(2*m+k,/** @type {number} */(fate.get(p))))),rand);
   if(!open.length)return null;
   slots[2*open[0]]=u.p[0];slots[2*open[0]+1]=u.p[1];
  }else{
   const t=u.t,open=shuffle([...Array(size).keys()].filter(i=>slots[i]===-2&&!(slots[i^1]>=0&&inPair.has(slots[i^1]))&&fits(i,t)),rand);
   if(!open.length)return null;
   slots[open[0]]=u.p[0];
  }
  for(const p of u.p)placed.add(p);
 }
 const rest=shuffle([...Array(n).keys()].filter(p=>!placed.has(p)),rand);
 // Paired players already sit together; the rest fill the open leaves (never next to a pair: those are full).
 for(let i=0;i<size;i++)if(slots[i]===-2)slots[i]=/** @type {number} */(rest.pop());
 return slots;
}

/**
 * Draw the first round: a random order that makes the rig come true. `ok` is false when the rig cannot
 * happen (then the slots are a plain random draw).
 * @param {number} n names @param {number} size @param {{fate:Map<number,number>,pair:Map<number,number>}} rig
 * @param {()=>number} [rand]
 * @returns {{slots:number[],ok:boolean}}
 */
export function draw(n,size,rig,rand=Math.random){
 const rigged=rig.fate.size>0||rig.pair.size>0;
 for(let k=0;k<(rigged?600:1);k++){
  const s=attempt(n,size,rigged?rig:{fate:new Map(),pair:new Map()},rand);
  if(s&&(!rigged||(rigHolds(s,rig.fate)&&[...rig.pair].every(([a,b])=>(s.indexOf(a)^1)===s.indexOf(b)))))return {slots:s,ok:true};
 }
 const plain=/** @type {number[]} */(attempt(n,size,{fate:new Map(),pair:new Map()},rand));
 return {slots:plain,ok:!rigged};
}

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

/** The winner of a ready match: the rig's choice, else a coin flip. @param {Board} b @param {number} r @param {number} m @param {Map<number,number>} fate @param {()=>number} [rand] */
export function pickWinner(b,r,m,fate,rand=Math.random){
 const a=entrant(b,r,2*m),c=entrant(b,r,2*m+1),w=rigWinner(a,c,r,fate);
 return w>=0?w:rand()<.5?a:c;
}

/* Share links: #b=<data>. Rigged and plain links look the same — the data is scrambled with a fixed key and
 * base64url, so the rig is not readable from the address (it is a prank, not a secret). */
const KEY=[0x6e,0x31,0x72,0x75,0x6c,0x69,0x6f,0x5f,0x76,0x73];
/** @param {Uint8Array} bytes */
function scramble(bytes){const out=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)out[i]=bytes[i]^KEY[i%KEY.length]^(i*29&255);return out;}
/** @param {{title:string,size:number,names:string[],rig?:Rig|null}} d */
export function encodeShare(d){
 const o={v:1,t:d.title||'',s:d.size,n:d.names,...(rigActive(d.rig)?{r:{f:d.rig?.fate,p:d.rig?.pair}}:{})};
 const bytes=scramble(new TextEncoder().encode(JSON.stringify(o)));
 let bin='';for(const x of bytes)bin+=String.fromCharCode(x);
 return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/** @param {string} s @returns {{title:string,size:number,names:string[],rig:Rig}|null} */
export function decodeShare(s){
 try{
  const bin=atob(String(s).replace(/-/g,'+').replace(/_/g,'/'));
  const o=JSON.parse(new TextDecoder().decode(scramble(Uint8Array.from(bin,c=>c.charCodeAt(0)))));
  if(!o||o.v!==1||!Array.isArray(o.n))return null;
  const names=parseNames(o.n.map(String).join('\n')).slice(0,32),size=SIZES.includes(o.s)?o.s:fitSize(names.length)||16;
  const rig=emptyRig();
  for(const [k,v] of Object.entries(o.r?.f||{}))if(Number.isInteger(v))rig.fate[k]=Number(v);
  for(const [k,v] of Object.entries(o.r?.p||{}))if(typeof v==='string')rig.pair[k]=v;
  return {title:String(o.t||'').slice(0,MAX_TITLE),size,names,rig};
 }catch{return null;}
}
