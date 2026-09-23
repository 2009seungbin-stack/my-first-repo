/** Pair kerning for the OpenType parser: GPOS 'kern' PairPos and the legacy 'kern' table. Pure.
 *
 * GPOS: the lookups of every 'kern' feature referenced by any script's default or named
 * language system (DFLT, latn, hang, kana, hani, …; required features included), in lookup
 * order. PairPos formats 1 and 2 are read, directly or through Extension (type 9) lookups.
 * Within one lookup the first subtable that applies wins, as in HarfBuzz: a format 1 subtable
 * applies only when it lists the pair; a format 2 subtable applies whenever its coverage holds
 * the left glyph (even with a zero value). Values of different lookups add up.
 *
 * The kerning value is value1.XAdvance — the pen advance between the two glyphs, which is what a
 * BMFont/engine kerning pair can express. Placement fields and value2 cannot be expressed as a
 * pair kern and are ignored. Device tables (ppem-specific hinting deltas) are ignored.
 * VariationIndex deltas (variable fonts, deltaFormat 0x8000) ARE applied when `coords` are
 * given, through the GDEF ItemVariationStore — so a bold instance gets its own kerning.
 *
 * Legacy 'kern': format 0 subtables of both the Microsoft (version 0) and Apple (version 1)
 * headers, horizontal and not cross-stream; used only when GPOS has no 'kern' feature. */
import {fail} from './otf-read.js';

function coverage(v,o){
 const fmt=v.u16(o),n=v.u16(o+2);
 if(fmt===1){
  v.need(o+4,n,2,'Coverage glyphs');
  return {index(g){let lo=0,hi=n-1;while(lo<=hi){const m=lo+hi>>1,x=v.u16(o+4+m*2);if(x===g)return m;if(x<g)lo=m+1;else hi=m-1;}return -1;}};
 }
 if(fmt===2){
  v.need(o+4,n,6,'Coverage ranges');
  return {index(g){let lo=0,hi=n-1;while(lo<=hi){const m=lo+hi>>1,p=o+4+m*6,a=v.u16(p),b=v.u16(p+2);if(g<a)hi=m-1;else if(g>b)lo=m+1;else return v.u16(p+4)+g-a;}return -1;}};
 }
 fail(`GPOS: unknown Coverage format ${fmt}`);
}
function classDef(v,o){
 if(!o)return ()=>0;
 const fmt=v.u16(o);
 if(fmt===1){const start=v.u16(o+2),n=v.u16(o+4);v.need(o+6,n,2,'ClassDef');return g=>g>=start&&g<start+n?v.u16(o+6+(g-start)*2):0;}
 if(fmt===2){
  const n=v.u16(o+2);v.need(o+4,n,6,'ClassDef ranges');
  return g=>{let lo=0,hi=n-1;while(lo<=hi){const m=lo+hi>>1,p=o+4+m*6,a=v.u16(p),b=v.u16(p+2);if(g<a)hi=m-1;else if(g>b)lo=m+1;else return v.u16(p+4);}return 0;};
 }
 fail(`GPOS: unknown ClassDef format ${fmt}`);
}
const popcount=x=>{let c=0;for(;x;x&=x-1)c++;return c;};

/** One PairPos subtable → {kind:1|2, cov, …}. */
function pairPos(v,o,varDelta){
 const fmt=v.u16(o),cov=coverage(v,o+v.u16(o+2)),vf1=v.u16(o+4),vf2=v.u16(o+6);
 const size1=popcount(vf1&0xff)*2,size2=popcount(vf2&0xff)*2;
 const xAdv=(vf1&4)?popcount(vf1&3)*2:-1;// byte offset of XAdvance inside value1
 const xAdvDev=(vf1&0x40)?popcount(vf1&0x3f)*2:-1;
 const value=(p,coords)=>{
  if(xAdv<0)return 0;
  let x=v.i16(p+xAdv);
  if(coords&&xAdvDev>=0&&varDelta){const d=v.u16(p+xAdvDev);if(d)x+=varDelta(o+d,coords);}// format 2: offsets from the subtable
  return x;
 };
 if(fmt===1){
  const n=v.u16(o+8);v.need(o+10,n,2,'PairSet offsets');
  const rec=2+size1+size2;
  const set=i=>{
   if(i<0||i>=n)return null;
   const so=o+v.u16(o+10+i*2),count=v.u16(so);v.need(so+2,count,rec,'PairValueRecords');
   return {count,at:k=>so+2+k*rec,second:k=>v.u16(so+2+k*rec)};
  };
  // Device/VariationIndex offsets inside a PairSet are relative to the PairSet table.
  const valueIn=(so,p,coords)=>{
   if(xAdv<0)return 0;
   let x=v.i16(p+xAdv);
   if(coords&&xAdvDev>=0&&varDelta){const d=v.u16(p+xAdvDev);if(d)x+=varDelta(so+d,coords);}
   return x;
  };
  return {kind:1,cov,
   /** → value or null when the pair is not listed */
   find(l,r,coords){
    const i=cov.index(l);if(i<0)return null;
    const so=o+v.u16(o+10+i*2),s=set(i);let lo=0,hi=s.count-1;
    while(lo<=hi){const m=lo+hi>>1,g=s.second(m);if(g===r)return valueIn(so,s.at(m)+2,coords);if(g<r)lo=m+1;else hi=m-1;}
    return null;
   },
   /** every listed (right, value) for a covered left glyph */
   *row(l,coords){const i=cov.index(l);if(i<0)return;const so=o+v.u16(o+10+i*2),s=set(i);for(let k=0;k<s.count;k++)yield [s.second(k),valueIn(so,s.at(k)+2,coords)];}
  };
 }
 if(fmt===2){
  const cd1=classDef(v,o+v.u16(o+8)),cd2=classDef(v,o+v.u16(o+10)),c1n=v.u16(o+12),c2n=v.u16(o+14);
  const rec=size1+size2,rows=o+16;v.need(rows,c1n*c2n,rec,'Class1Records');
  return {kind:2,cov,cd1,cd2,c1n,c2n,
   value(c1,c2,coords){if(c1>=c1n||c2>=c2n)return 0;return value(rows+(c1*c2n+c2)*rec,coords);}
  };
 }
 fail(`GPOS: unknown PairPos format ${fmt}`);
}

/** GPOS table → {has:bool, lookups:[[subtable…]…]} for the 'kern' feature. */
export function readGposKern(v,gdefStore){
 const major=v.u16(0);if(major!==1)fail(`GPOS: unsupported version ${major}`);
 const sl=v.u16(4),fl=v.u16(6),ll=v.u16(8);
 const featCount=v.u16(fl);v.need(fl+2,featCount,6,'FeatureRecords');
 const kernFeatures=new Set();
 const addLangSys=o=>{
  const req=v.u16(o+2),n=v.u16(o+4);v.need(o+6,n,2,'LangSys feature indices');
  const idx=[...Array(n)].map((_,i)=>v.u16(o+6+i*2));if(req!==0xffff)idx.push(req);
  for(const f of idx)if(f<featCount&&v.tag(fl+2+f*6)==='kern')kernFeatures.add(f);
 };
 const sc=v.u16(sl);v.need(sl+2,sc,6,'ScriptRecords');
 for(let i=0;i<sc;i++){
  const so=sl+v.u16(sl+2+i*6+4),def=v.u16(so),n=v.u16(so+2);
  if(def)addLangSys(so+def);
  v.need(so+4,n,6,'LangSysRecords');
  for(let k=0;k<n;k++)addLangSys(so+v.u16(so+4+k*6+4));
 }
 const lookupIdx=new Set();
 for(const f of kernFeatures){const fo=fl+v.u16(fl+2+f*6+4),n=v.u16(fo+2);v.need(fo+4,n,2,'Feature lookup indices');for(let k=0;k<n;k++)lookupIdx.add(v.u16(fo+4+k*2));}
 const lookupCount=v.u16(ll);
 const varDelta=gdefStore?(o,coords)=>{
  // VariationIndex table: outer u16, inner u16, deltaFormat 0x8000. Other formats are ppem Device tables: ignored.
  if(v.u16(o+4)!==0x8000)return 0;
  return gdefStore.delta(v.u16(o),v.u16(o+2),coords);
 }:null;
 const lookups=[];
 for(const li of [...lookupIdx].sort((a,b)=>a-b)){
  if(li>=lookupCount)continue;
  const lo=ll+v.u16(ll+2+li*2);let type=v.u16(lo);const n=v.u16(lo+4);v.need(lo+6,n,2,'Lookup subtables');
  const subs=[];
  for(let k=0;k<n;k++){
   let so=lo+v.u16(lo+6+k*2),t=type;
   if(t===9){t=v.u16(so+2);so+=v.u32(so+4);}
   if(t===2)subs.push(pairPos(v,so,varDelta));
  }
  if(subs.length)lookups.push(subs);
 }
 return {has:kernFeatures.size>0,lookups};
}

/** Legacy kern table (format 0 subtables) → Map key(l*65536+r) → value, or null. */
export function readKernTable(v){
 const pairs=new Map();let n,p;
 const ver=v.u16(0);
 const addSub=(o,len,format,horizontal,cross,override,minimum)=>{
  if(format!==0||!horizontal||cross||minimum)return;
  const np=v.u16(o);v.need(o+8,np,6,'kern pairs');
  for(let i=0;i<np;i++){
   const q=o+8+i*6,key=v.u16(q)*65536+v.u16(q+2),val=v.i16(q+4);
   pairs.set(key,override?val:(pairs.get(key)||0)+val);
  }
 };
 if(ver===0){
  n=v.u16(2);p=4;
  for(let i=0;i<n;i++){const len=v.u16(p+2),cov=v.u16(p+4);addSub(p+6,len,cov>>8,cov&1,cov&4,cov&8,cov&2);p+=len||6;if(p>v.length)break;}
 }else if(ver===1){
  n=v.u32(4);p=8;
  for(let i=0;i<n;i++){const len=v.u32(p),cov=v.u16(p+4);addSub(p+8,len,cov&0xff,!(cov&0x8000),cov&0x4000,0,cov&0x2000);p+=len||8;if(p>v.length)break;}
 }else return null;
 return pairs;
}

/** Kerning of one pair from parsed GPOS lookups. */
export function gposKern(lookups,l,r,coords){
 let sum=0;
 for(const subs of lookups){
  for(const s of subs){
   if(s.kind===1){const x=s.find(l,r,coords);if(x!=null){sum+=x;break;}}
   else if(s.cov.index(l)>=0){sum+=s.value(s.cd1(l),s.cd2(r),coords);break;}
  }
 }
 return sum;
}

/** All non-zero GPOS pairs among `gids`, without testing every pair: format 1 rows are read
 * directly, format 2 subtables bucket the right-hand glyphs by class once. */
export function gposPairs(lookups,gids,numGlyphs,coords){
 const list=[...new Set(gids)].filter(g=>Number.isInteger(g)&&g>=0&&g<numGlyphs).sort((a,b)=>a-b);
 const inSet=new Uint8Array(numGlyphs);for(const g of list)inSet[g]=1;
 const total=new Map();
 for(const subs of lookups){
  const doneLeft=new Set(),donePair=new Set();
  for(const s of subs){
   const lefts=list.filter(g=>!doneLeft.has(g)&&s.cov.index(g)>=0);
   if(!lefts.length)continue;
   if(s.kind===1){
    for(const l of lefts)for(const [r,x] of s.row(l,coords)){
     if(r>=numGlyphs||!inSet[r])continue;
     const key=l*65536+r;if(donePair.has(key))continue;
     donePair.add(key);if(x)total.set(key,(total.get(key)||0)+x);
    }
   }else{
    const byClass=new Map();
    for(const r of list){const c=s.cd2(r);let b=byClass.get(c);if(!b)byClass.set(c,b=[]);b.push(r);}
    for(const l of lefts){
     const c1=s.cd1(l);
     for(const [c2,rs] of byClass){
      const x=s.value(c1,c2,coords);if(!x)continue;
      for(const r of rs){const key=l*65536+r;if(donePair.has(key))continue;total.set(key,(total.get(key)||0)+x);}
     }
     doneLeft.add(l);
    }
   }
  }
 }
 return total;
}
